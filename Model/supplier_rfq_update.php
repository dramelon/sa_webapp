<?php
require_once __DIR__ . '/database_connector.php';
require_once __DIR__ . '/audit_log.php';

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

$rfqId = (int) ($input['supplier_rfq_id'] ?? 0);
$eventId = (int) ($input['event_id'] ?? 0);
$title = trim((string) ($input['title'] ?? ''));
$rfqRequestDate = normalizeDateTime($input['rfq_request_date'] ?? null);
$rfqValidityDays = (int) ($input['rfq_validity_days'] ?? 0);
$rfqDueDate = normalizeDateTime($input['rfq_due_date'] ?? $input['due_date'] ?? null);
$orderDate = normalizeDateTime($input['order_date'] ?? null);
$orderDeadline = normalizeDateTime($input['order_deadline'] ?? null);
$orderExpectedArrival = normalizeDateTime($input['order_expected_arrival'] ?? $input['expected_arrival'] ?? null);
$paymentTerm = strtoupper(trim((string) ($input['payment_term'] ?? '30D')));
$paymentMethod = strtolower(trim((string) ($input['payment_method'] ?? 'bank')));
$note = trimNullable($input['note'] ?? null);
$refRfqId = sanitizeRefId($input['ref_supplier_rfq_id'] ?? null);
$status = strtolower(trim((string) ($input['status'] ?? 'draft')));
$deliverTo = (int) ($input['deliver_to'] ?? $eventId);
$staffId = (int) $_SESSION['staff_id'];
$contactPerson = (int) ($input['contact_person'] ?? $staffId);
$missingLines = array_filter(is_array($input['missing_lines'] ?? []) ? $input['missing_lines'] : [], function ($line) {
    return is_array($line);
});

if ($rfqId <= 0) {
    http_response_code(400);
    echo json_encode(['error' => 'invalid_rfq_id', 'message' => 'ไม่พบ RFQ ที่ต้องการบันทึก']);
    exit;
}

if ($eventId <= 0) {
    http_response_code(400);
    echo json_encode(['error' => 'invalid_event', 'message' => 'ต้องระบุอีเว้นที่เกี่ยวข้อง']);
    exit;
}

if ($title === '') {
    http_response_code(400);
    echo json_encode(['error' => 'missing_title', 'message' => 'กรุณากรอกหัวข้อ RFQ']);
    exit;
}

if (empty($missingLines)) {
    http_response_code(400);
    echo json_encode(['error' => 'empty_lines', 'message' => 'ไม่มีรายการสินค้าที่จะบันทึก']);
    exit;
}

$allowedPaymentMethods = ['bank', 'credit', 'cash', 'others'];
if (!in_array($paymentMethod, $allowedPaymentMethods, true)) {
    $paymentMethod = 'bank';
}

$allowedStatuses = ['draft', 'approved', 'cancelled'];
if (!in_array($status, $allowedStatuses, true)) {
    $status = 'draft';
}

try {
    $db = DatabaseConnector::getConnection();

    if (!tableExists($db, 'supplier_rfq') || !tableExists($db, 'supplier_rfq_line')) {
        http_response_code(500);
        echo json_encode(['error' => 'missing_tables', 'message' => 'ไม่พบตาราง RFQ ในฐานข้อมูล']);
        exit;
    }

    $db->beginTransaction();

    $rfqCheck = $db->prepare('SELECT SupplierRFQID FROM supplier_rfq WHERE SupplierRFQID = :id LIMIT 1');
    $rfqCheck->bindValue(':id', $rfqId, PDO::PARAM_INT);
    $rfqCheck->execute();
    if (!$rfqCheck->fetchColumn()) {
        $db->rollBack();
        http_response_code(404);
        echo json_encode(['error' => 'not_found', 'message' => 'ไม่พบ RFQ ที่ต้องการปรับปรุง']);
        exit;
    }

    $rfqValidityDays = $rfqValidityDays > 0 ? $rfqValidityDays : 30;

    $update = $db->prepare('
        UPDATE supplier_rfq SET
            RefSupplierRFQID = :ref_id,
            EventID = :event_id,
            StaffID = :staff_id,
            ContactPerson = :contact_person,
            Title = :title,
            RFQValidityDays = :rfq_validity_days,
            RFQDueDate = :rfq_due_date,
            RFQRequestDate = :rfq_request_date,
            OrderDate = :order_date,
            OrderDeadline = :order_deadline,
            OrderExpectedArrival = :order_expected_arrival,
            PaymentTerm = :payment_term,
            PaymentMethod = :payment_method,
            DeliverTo = :deliver_to,
            Note = :note,
            Status = :status
        WHERE SupplierRFQID = :rfq_id
        LIMIT 1
    ');

    bindNullableString($update, ':ref_id', $refRfqId);
    $update->bindValue(':event_id', $eventId, PDO::PARAM_INT);
    $update->bindValue(':staff_id', $staffId, PDO::PARAM_INT);
    $update->bindValue(':contact_person', $contactPerson, PDO::PARAM_INT);
    $update->bindValue(':title', $title, PDO::PARAM_STR);
    $update->bindValue(':rfq_validity_days', $rfqValidityDays, PDO::PARAM_INT);
    $update->bindValue(':rfq_due_date', $rfqDueDate ?? date('Y-m-d H:i:s'), PDO::PARAM_STR);
    $update->bindValue(':rfq_request_date', $rfqRequestDate ?? date('Y-m-d H:i:s'), PDO::PARAM_STR);
    $update->bindValue(':order_date', $orderDate ?? date('Y-m-d H:i:s'), PDO::PARAM_STR);
    $update->bindValue(':order_deadline', $orderDeadline ?? $rfqDueDate ?? date('Y-m-d H:i:s'), PDO::PARAM_STR);
    $update->bindValue(':order_expected_arrival', $orderExpectedArrival ?? $orderDeadline ?? date('Y-m-d H:i:s'), PDO::PARAM_STR);
    $update->bindValue(':payment_term', $paymentTerm, PDO::PARAM_STR);
    $update->bindValue(':payment_method', $paymentMethod, PDO::PARAM_STR);
    $update->bindValue(':deliver_to', $deliverTo > 0 ? $deliverTo : $eventId, PDO::PARAM_INT);
    bindNullableString($update, ':note', $note);
    $update->bindValue(':status', $status, PDO::PARAM_STR);
    $update->bindValue(':rfq_id', $rfqId, PDO::PARAM_INT);

    $update->execute();

    recordAuditEvent($db, 'rfq', $rfqId, 'UPDATE', $staffId, 'ปรับปรุงรายละเอียด RFQ');

    $db->commit();

    echo json_encode([
        'success' => true,
        'data' => [
            'supplier_rfq_id' => $rfqId,
            'ref_supplier_rfq_id' => $refRfqId,
            'event_id' => $eventId,
            'status' => $status,
        ],
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    if (isset($db) && $db->inTransaction()) {
        $db->rollBack();
    }
    if ($e instanceof PDOException && (int) $e->getCode() === 23000) {
        http_response_code(409);
        echo json_encode(['error' => 'duplicate_ref_id']);
        exit;
    }
    http_response_code(500);
    echo json_encode(['error' => 'server_error', 'message' => 'ไม่สามารถบันทึก RFQ ได้']);
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

function tableExists(PDO $db, string $tableName): bool
{
    $stmt = $db->prepare('SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = :table LIMIT 1');
    $stmt->bindValue(':table', $tableName, PDO::PARAM_STR);
    $stmt->execute();

    return (bool) $stmt->fetchColumn();
}
