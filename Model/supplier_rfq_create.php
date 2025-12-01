<?php
require_once __DIR__ . '/database_connector.php';

session_start();
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'method_not_allowed']);
    exit;
}

if (empty($_SESSION['staff_id'])) {
    http_response_code(401);
    echo json_encode(['error' => 'unauthorized']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) {
    http_response_code(400);
    echo json_encode(['error' => 'invalid_payload']);
    exit;
}

$eventId = (int) ($input['event_id'] ?? 0);
$requestId = (int) ($input['request_id'] ?? 0);
$title = trim((string) ($input['title'] ?? ''));
$dueDate = normalizeDateTime($input['due_date'] ?? null);
$expectedArrival = normalizeDateTime($input['expected_arrival'] ?? null);
$paymentTerm = strtoupper(trim((string) ($input['payment_term'] ?? '30D')));
$paymentMethod = strtolower(trim((string) ($input['payment_method'] ?? 'bank')));
$note = trimNullable($input['note'] ?? null);
$refRfqId = sanitizeRefId($input['ref_supplier_rfq_id'] ?? null);
$deliverTo = (int) ($input['deliver_to'] ?? $eventId);
$staffId = (int) $_SESSION['staff_id'];
$contactPerson = (int) ($input['contact_person'] ?? $staffId);
$missingLines = array_filter(is_array($input['missing_lines'] ?? []) ? $input['missing_lines'] : [], function ($line) {
    return is_array($line);
});

if ($eventId <= 0 || $requestId <= 0) {
    http_response_code(400);
    echo json_encode(['error' => 'invalid_reference', 'message' => 'ต้องระบุรหัสอีเว้นและคำขอเบิก']);
    exit;
}

if ($title === '') {
    http_response_code(400);
    echo json_encode(['error' => 'missing_title', 'message' => 'กรุณากรอกหัวข้อ RFQ']);
    exit;
}

if (empty($missingLines)) {
    http_response_code(400);
    echo json_encode(['error' => 'empty_lines', 'message' => 'ไม่มีรายการสินค้าที่จะสร้าง RFQ']);
    exit;
}

$allowedPaymentMethods = ['bank', 'credit', 'cash', 'others'];
if (!in_array($paymentMethod, $allowedPaymentMethods, true)) {
    $paymentMethod = 'bank';
}

try {
    $db = DatabaseConnector::getConnection();

    if (!tableExists($db, 'supplier_rfq') || !tableExists($db, 'supplier_rfq_line')) {
        http_response_code(500);
        echo json_encode(['error' => 'missing_tables', 'message' => 'ไม่พบตาราง RFQ ในฐานข้อมูล']);
        exit;
    }

    $db->beginTransaction();

    $now = date('Y-m-d H:i:s');
    $bidValidity = $dueDate ?? $now;
    $orderDeadline = $dueDate ?? $now;
    $expectedArrivalValue = $expectedArrival ?? $dueDate ?? $now;

    $insertRfq = $db->prepare('
        INSERT INTO supplier_rfq (
            RefSupplierRFQID,
            EventID,
            StaffID,
            ContactPerson,
            Title,
            BidValidityDays,
            DueDate,
            RequestDate,
            OrderDate,
            OrderDeadline,
            ExpectedArrival,
            PaymentTerm,
            PaymentMethod,
            DeliverTo,
            RefVendorID,
            Note,
            Status
        ) VALUES (
            :ref_id,
            :event_id,
            :staff_id,
            :contact_person,
            :title,
            :bid_validity,
            :due_date,
            :request_date,
            :order_date,
            :order_deadline,
            :expected_arrival,
            :payment_term,
            :payment_method,
            :deliver_to,
            NULL,
            :note,
            'draft'
        )
    ');

    bindNullableString($insertRfq, ':ref_id', $refRfqId);
    $insertRfq->bindValue(':event_id', $eventId, PDO::PARAM_INT);
    $insertRfq->bindValue(':staff_id', $staffId, PDO::PARAM_INT);
    $insertRfq->bindValue(':contact_person', $contactPerson, PDO::PARAM_INT);
    $insertRfq->bindValue(':title', $title, PDO::PARAM_STR);
    $insertRfq->bindValue(':bid_validity', $bidValidity, PDO::PARAM_STR);
    $insertRfq->bindValue(':due_date', $dueDate ?? $now, PDO::PARAM_STR);
    $insertRfq->bindValue(':request_date', $now, PDO::PARAM_STR);
    $insertRfq->bindValue(':order_date', $now, PDO::PARAM_STR);
    $insertRfq->bindValue(':order_deadline', $orderDeadline, PDO::PARAM_STR);
    $insertRfq->bindValue(':expected_arrival', $expectedArrivalValue, PDO::PARAM_STR);
    $insertRfq->bindValue(':payment_term', $paymentTerm, PDO::PARAM_STR);
    $insertRfq->bindValue(':payment_method', $paymentMethod, PDO::PARAM_STR);
    $insertRfq->bindValue(':deliver_to', $deliverTo > 0 ? $deliverTo : $eventId, PDO::PARAM_INT);
    bindNullableString($insertRfq, ':note', appendRequestToNote($note, $requestId));

    $insertRfq->execute();

    $supplierRfqId = (int) $db->lastInsertId();

    $insertLine = $db->prepare('
        INSERT INTO supplier_rfq_line (
            SupplierRFQID,
            ItemID,
            ItemDesc,
            UOM,
            QuantityRequested,
            Note
        ) VALUES (
            :rfq_id,
            :item_id,
            :item_desc,
            :uom,
            :quantity,
            :note
        )
    ');

    $insertedLines = 0;
    foreach ($missingLines as $line) {
        $itemId = (int) ($line['item_id'] ?? 0);
        $itemDesc = trim((string) ($line['item_desc'] ?? '')) ?: 'ไม่ทราบชื่อสินค้า';
        $uom = trim((string) ($line['uom'] ?? '')) ?: '-';
        $quantity = (int) ($line['quantity_requested'] ?? 0);
        $lineNote = trimNullable($line['note'] ?? null);

        if ($quantity <= 0 || $itemId <= 0) {
            continue;
        }

        $insertLine->bindValue(':rfq_id', $supplierRfqId, PDO::PARAM_INT);
        $insertLine->bindValue(':item_id', $itemId, PDO::PARAM_INT);
        $insertLine->bindValue(':item_desc', $itemDesc, PDO::PARAM_STR);
        $insertLine->bindValue(':uom', $uom, PDO::PARAM_STR);
        $insertLine->bindValue(':quantity', $quantity, PDO::PARAM_INT);
        bindNullableString($insertLine, ':note', $lineNote);
        $insertLine->execute();
        $insertedLines++;
    }

    if ($insertedLines === 0) {
        $db->rollBack();
        http_response_code(400);
        echo json_encode(['error' => 'empty_lines', 'message' => 'ไม่มีรายการสินค้าที่เหมาะสมสำหรับสร้าง RFQ']);
        exit;
    }

    $db->commit();

    echo json_encode([
        'success' => true,
        'data' => [
            'supplier_rfq_id' => $supplierRfqId,
            'ref_supplier_rfq_id' => $refRfqId,
            'event_id' => $eventId,
            'request_id' => $requestId,
            'status' => 'draft',
        ],
    ], JSON_UNESCAPED_UNICODE);
} catch (PDOException $e) {
    $db->rollBack();
    if ((int) $e->getCode() === 23000) {
        http_response_code(409);
        echo json_encode(['error' => 'duplicate_ref_id']);
        exit;
    }
    http_response_code(500);
    echo json_encode(['error' => 'server_error', 'message' => 'ไม่สามารถบันทึก RFQ ได้']);
} catch (Throwable $e) {
    if (isset($db) && $db->inTransaction()) {
        $db->rollBack();
    }
    http_response_code(500);
    echo json_encode(['error' => 'server_error', 'message' => 'ไม่สามารถบันทึก RFQ ได้']);
}

function tableExists(PDO $db, string $tableName): bool
{
    $stmt = $db->prepare('SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = :table LIMIT 1');
    $stmt->bindValue(':table', $tableName, PDO::PARAM_STR);
    $stmt->execute();

    return (bool) $stmt->fetchColumn();
}

function trimNullable($value): ?string
{
    if ($value === null) {
        return null;
    }
    $trimmed = trim((string) $value);
    return $trimmed === '' ? null : $trimmed;
}

function bindNullableString(PDOStatement $stmt, string $param, ?string $value): void
{
    if ($value === null) {
        $stmt->bindValue($param, null, PDO::PARAM_NULL);
        return;
    }
    $stmt->bindValue($param, $value, PDO::PARAM_STR);
}

function normalizeDateTime($value): ?string
{
    if ($value === null || $value === '') {
        return null;
    }
    $ts = strtotime((string) $value);
    if ($ts === false) {
        return null;
    }
    return date('Y-m-d H:i:s', $ts);
}

function sanitizeRefId($value): ?string
{
    if ($value === null) {
        return null;
    }
    $ref = preg_replace('/[^A-Za-z0-9\-]/', '', (string) $value);
    $ref = substr($ref, 0, 30);
    return $ref === '' ? null : $ref;
}

function appendRequestToNote(?string $note, int $requestId): ?string
{
    $suffix = $requestId > 0 ? "อ้างอิงคำขอเบิก #{$requestId}" : null;
    if ($note && $suffix) {
        return $note . "\n" . $suffix;
    }
    if ($suffix) {
        return $suffix;
    }
    return $note;
}
