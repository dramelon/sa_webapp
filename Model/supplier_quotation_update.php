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

$quotationId = (int) ($input['supplier_quotation_id'] ?? 0);
$eventId = isset($input['event_id']) ? (int) $input['event_id'] : null;
$title = trim((string) ($input['title'] ?? ''));
$refQuotationId = sanitizeRefId($input['ref_supplier_quotation_id'] ?? null);
$bidValidity = normalizeDateTime($input['bid_validity_days'] ?? null);
$quotationDate = normalizeDateTime($input['quotation_date'] ?? null);
$orderDate = normalizeDateTime($input['order_date'] ?? null);
$orderDeadline = normalizeDateTime($input['order_deadline'] ?? null);
$expectedArrival = normalizeDateTime($input['expected_arrival'] ?? null);
$paymentTerm = strtoupper(trim((string) ($input['payment_term'] ?? '30D')));
$paymentMethod = strtolower(trim((string) ($input['payment_method'] ?? 'bank')));
$deliverTo = isset($input['deliver_to']) ? (int) $input['deliver_to'] : null;
$refVendorId = sanitizeRefId($input['ref_vendor_id'] ?? null);
$note = trimNullable($input['note'] ?? null);
$status = strtolower(trim((string) ($input['status'] ?? 'submitted')));
$contactPerson = isset($input['contact_person']) ? (int) $input['contact_person'] : null;
$staffId = isset($input['staff_id']) ? (int) $input['staff_id'] : (int) $_SESSION['staff_id'];
$linesInput = $input['lines'] ?? [];

if ($quotationId <= 0) {
    http_response_code(400);
    echo json_encode(['error' => 'invalid_quotation_id', 'message' => 'ไม่พบใบเสนอราคาที่ต้องการบันทึก']);
    exit;
}

if ($title === '') {
    http_response_code(400);
    echo json_encode(['error' => 'missing_title', 'message' => 'กรุณาระบุชื่อใบเสนอราคา']);
    exit;
}

$allowedPaymentMethods = ['bank', 'credit', 'cash', 'others'];
if (!in_array($paymentMethod, $allowedPaymentMethods, true)) {
    $paymentMethod = 'bank';
}

$allowedStatuses = ['submitted', 'pending', 'approved', 'cancelled', 'closed'];
if (!in_array($status, $allowedStatuses, true)) {
    $status = 'submitted';
}

if (!is_array($linesInput) || empty($linesInput)) {
    http_response_code(400);
    echo json_encode(['error' => 'missing_lines', 'message' => 'กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ']);
    exit;
}

$cleanLines = [];
foreach ($linesInput as $index => $line) {
    if (!is_array($line)) {
        http_response_code(400);
        echo json_encode(['error' => 'invalid_line', 'message' => 'ข้อมูลรายการสินค้าไม่ถูกต้อง']);
        exit;
    }

    $lineId = isset($line['supplier_quotation_line_id']) ? (int) $line['supplier_quotation_line_id'] : null;
    if ($lineId !== null && $lineId <= 0) {
        $lineId = null;
    }

    $itemId = (int) ($line['item_id'] ?? 0);
    if ($itemId <= 0) {
        http_response_code(400);
        echo json_encode(['error' => 'invalid_line_item', 'message' => sprintf('กรุณาเลือกสินค้าในรายการที่ %d', $index + 1)]);
        exit;
    }

    $itemDesc = trim((string) ($line['item_desc'] ?? ''));
    if ($itemDesc === '') {
        http_response_code(400);
        echo json_encode(['error' => 'missing_item_desc', 'message' => sprintf('กรุณากรอกรายละเอียดสินค้าในรายการที่ %d', $index + 1)]);
        exit;
    }

    $uom = trim((string) ($line['uom'] ?? 'unit'));
    if ($uom === '') {
        $uom = 'unit';
    }

    $quantityOffered = isset($line['quantity_offered']) ? (int) $line['quantity_offered'] : 0;
    if ($quantityOffered < 0) {
        $quantityOffered = 0;
    }

    $unitPrice = isset($line['unit_price']) ? (float) $line['unit_price'] : 0;
    $discountPercent = isset($line['discount_percent']) && $line['discount_percent'] !== ''
        ? (float) $line['discount_percent']
        : null;
    $discountAmount = isset($line['discount_amount']) && $line['discount_amount'] !== ''
        ? (float) $line['discount_amount']
        : null;
    $taxInclude = !empty($line['tax_include']) ? 1 : 0;

    $cleanLines[] = [
        'supplier_quotation_line_id' => $lineId,
        'supplier_rfq_line_id' => isset($line['supplier_rfq_line_id']) && $line['supplier_rfq_line_id'] !== null
            ? (int) $line['supplier_rfq_line_id']
            : null,
        'item_id' => $itemId,
        'item_desc' => mb_substr($itemDesc, 0, 500, 'UTF-8'),
        'item_spec' => trimNullable($line['item_spec'] ?? null),
        'item_note' => trimNullable($line['item_note'] ?? null),
        'uom' => mb_substr($uom, 0, 50, 'UTF-8'),
        'quantity_offered' => $quantityOffered,
        'unit_price' => $unitPrice,
        'discount_percent' => $discountPercent,
        'discount_amount' => $discountAmount,
        'tax_include' => $taxInclude,
        'note' => trimNullable($line['note'] ?? null),
    ];
}

try {
    $db = DatabaseConnector::getConnection();

    $db->beginTransaction();

    $quotationStmt = $db->prepare('SELECT SupplierQuotationID, SupplierRFQID, SupplierID, DeliverTo FROM supplier_quotation WHERE SupplierQuotationID = :id LIMIT 1');
    $quotationStmt->bindValue(':id', $quotationId, PDO::PARAM_INT);
    $quotationStmt->execute();
    $quotationRow = $quotationStmt->fetch(PDO::FETCH_ASSOC);

    if (!$quotationRow) {
        $db->rollBack();
        http_response_code(404);
        echo json_encode(['error' => 'not_found', 'message' => 'ไม่พบใบเสนอราคาที่ต้องการบันทึก']);
        exit;
    }

    $rfqId = $quotationRow['SupplierRFQID'] !== null ? (int) $quotationRow['SupplierRFQID'] : null;
    $deliverFallback = $quotationRow['DeliverTo'] !== null ? (int) $quotationRow['DeliverTo'] : null;

    $deliverTarget = $deliverTo !== null && $deliverTo > 0
        ? $deliverTo
        : ($deliverFallback !== null && $deliverFallback > 0 ? $deliverFallback : null);

    if ($rfqId !== null && $eventId !== null) {
        $eventStmt = $db->prepare('SELECT EventID FROM supplier_rfq WHERE SupplierRFQID = :rfq LIMIT 1');
        $eventStmt->bindValue(':rfq', $rfqId, PDO::PARAM_INT);
        $eventStmt->execute();
        $rfqEventId = $eventStmt->fetchColumn();
        if ($rfqEventId !== false && (int) $rfqEventId !== $eventId) {
            $db->rollBack();
            http_response_code(400);
            echo json_encode(['error' => 'event_mismatch', 'message' => 'อีเว้นไม่ตรงกับใบเสนอราคา']);
            exit;
        }
    }

    $update = $db->prepare('
        UPDATE supplier_quotation SET
            RefSupplierQuotationID = :ref_id,
            StaffID = :staff_id,
            ContactPerson = :contact_person,
            Title = :title,
            BidValidityDays = :bid_validity_days,
            QuotationDate = :quotation_date,
            OrderDate = :order_date,
            OrderDeadline = :order_deadline,
            ExpectedArrival = :expected_arrival,
            PaymentTerm = :payment_term,
            PaymentMethod = :payment_method,
            DeliverTo = :deliver_to,
            RefVendorID = :ref_vendor_id,
            Note = :note,
            Status = :status
        WHERE SupplierQuotationID = :id
        LIMIT 1
    ');

    bindNullableString($update, ':ref_id', $refQuotationId);
    $update->bindValue(':staff_id', $staffId, PDO::PARAM_INT);
    $update->bindValue(':contact_person', $contactPerson !== null ? $contactPerson : $staffId, PDO::PARAM_INT);
    $update->bindValue(':title', $title, PDO::PARAM_STR);
    $update->bindValue(':bid_validity_days', $bidValidity ?? date('Y-m-d H:i:s'), PDO::PARAM_STR);
    $update->bindValue(':quotation_date', $quotationDate ?? date('Y-m-d H:i:s'), PDO::PARAM_STR);
    $update->bindValue(':order_date', $orderDate ?? date('Y-m-d H:i:s'), PDO::PARAM_STR);
    $update->bindValue(':order_deadline', $orderDeadline ?? $bidValidity ?? date('Y-m-d H:i:s'), PDO::PARAM_STR);
    $update->bindValue(':expected_arrival', $expectedArrival ?? $orderDeadline ?? date('Y-m-d H:i:s'), PDO::PARAM_STR);
    $update->bindValue(':payment_term', $paymentTerm, PDO::PARAM_STR);
    $update->bindValue(':payment_method', $paymentMethod, PDO::PARAM_STR);
    if ($deliverTarget === null) {
        $update->bindValue(':deliver_to', null, PDO::PARAM_NULL);
    } else {
        $update->bindValue(':deliver_to', $deliverTarget, PDO::PARAM_INT);
    }
    bindNullableString($update, ':ref_vendor_id', $refVendorId);
    bindNullableString($update, ':note', $note);
    $update->bindValue(':status', $status, PDO::PARAM_STR);
    $update->bindValue(':id', $quotationId, PDO::PARAM_INT);

    $update->execute();

    $updateLine = $db->prepare('
        UPDATE supplier_quotation_line SET
            SupplierRFQLineID = :supplier_rfq_line_id,
            ItemID = :item_id,
            ItemDesc = :item_desc,
            ItemSpec = :item_spec,
            ItemNote = :item_note,
            UOM = :uom,
            QuantityOffered = :quantity_offered,
            UnitPrice = :unit_price,
            DiscountPercent = :discount_percent,
            DiscountAmount = :discount_amount,
            TaxInclude = :tax_include,
            Note = :note
        WHERE SupplierQuotationLineID = :line_id AND SupplierQuotationID = :quotation_id
    ');

    $insertLine = $db->prepare('
        INSERT INTO supplier_quotation_line (
            SupplierQuotationID,
            SupplierRFQLineID,
            ItemID,
            ItemDesc,
            ItemSpec,
            ItemNote,
            UOM,
            QuantityOffered,
            UnitPrice,
            DiscountPercent,
            DiscountAmount,
            TaxInclude,
            Note
        ) VALUES (
            :supplier_quotation_id,
            :supplier_rfq_line_id,
            :item_id,
            :item_desc,
            :item_spec,
            :item_note,
            :uom,
            :quantity_offered,
            :unit_price,
            :discount_percent,
            :discount_amount,
            :tax_include,
            :note
        )
    ');

    $persistedLineIds = [];

    foreach ($cleanLines as $line) {
        if ($line['supplier_quotation_line_id']) {
            $updateLine->bindValue(':supplier_rfq_line_id', $line['supplier_rfq_line_id'], $line['supplier_rfq_line_id'] !== null ? PDO::PARAM_INT : PDO::PARAM_NULL);
            $updateLine->bindValue(':item_id', $line['item_id'], PDO::PARAM_INT);
            $updateLine->bindValue(':item_desc', $line['item_desc'], PDO::PARAM_STR);
            bindNullableString($updateLine, ':item_spec', $line['item_spec']);
            bindNullableString($updateLine, ':item_note', $line['item_note']);
            $updateLine->bindValue(':uom', $line['uom'], PDO::PARAM_STR);
            $updateLine->bindValue(':quantity_offered', $line['quantity_offered'], PDO::PARAM_INT);
            $updateLine->bindValue(':unit_price', $line['unit_price'], PDO::PARAM_STR);
            bindNullableFloat($updateLine, ':discount_percent', $line['discount_percent']);
            bindNullableFloat($updateLine, ':discount_amount', $line['discount_amount']);
            $updateLine->bindValue(':tax_include', $line['tax_include'], PDO::PARAM_INT);
            bindNullableString($updateLine, ':note', $line['note']);
            $updateLine->bindValue(':line_id', $line['supplier_quotation_line_id'], PDO::PARAM_INT);
            $updateLine->bindValue(':quotation_id', $quotationId, PDO::PARAM_INT);
            $updateLine->execute();
            $persistedLineIds[] = (int) $line['supplier_quotation_line_id'];
        } else {
            $insertLine->bindValue(':supplier_quotation_id', $quotationId, PDO::PARAM_INT);
            $insertLine->bindValue(':supplier_rfq_line_id', $line['supplier_rfq_line_id'], $line['supplier_rfq_line_id'] !== null ? PDO::PARAM_INT : PDO::PARAM_NULL);
            $insertLine->bindValue(':item_id', $line['item_id'], PDO::PARAM_INT);
            $insertLine->bindValue(':item_desc', $line['item_desc'], PDO::PARAM_STR);
            bindNullableString($insertLine, ':item_spec', $line['item_spec']);
            bindNullableString($insertLine, ':item_note', $line['item_note']);
            $insertLine->bindValue(':uom', $line['uom'], PDO::PARAM_STR);
            $insertLine->bindValue(':quantity_offered', $line['quantity_offered'], PDO::PARAM_INT);
            $insertLine->bindValue(':unit_price', $line['unit_price'], PDO::PARAM_STR);
            bindNullableFloat($insertLine, ':discount_percent', $line['discount_percent']);
            bindNullableFloat($insertLine, ':discount_amount', $line['discount_amount']);
            $insertLine->bindValue(':tax_include', $line['tax_include'], PDO::PARAM_INT);
            bindNullableString($insertLine, ':note', $line['note']);
            $insertLine->execute();
            $persistedLineIds[] = (int) $db->lastInsertId();
        }
    }

    if (!empty($persistedLineIds)) {
        $placeholders = implode(', ', array_fill(0, count($persistedLineIds), '?'));
        $deleteStmt = $db->prepare(
            "DELETE FROM supplier_quotation_line WHERE SupplierQuotationID = ? AND SupplierQuotationLineID NOT IN ($placeholders)"
        );
        $deleteStmt->bindValue(1, $quotationId, PDO::PARAM_INT);
        foreach ($persistedLineIds as $idx => $id) {
            $deleteStmt->bindValue($idx + 2, $id, PDO::PARAM_INT);
        }
        $deleteStmt->execute();
    }

    recordAuditEvent($db, 'supplier_quotation', $quotationId, 'UPDATE', $staffId, 'ปรับปรุงใบเสนอราคา');

    $db->commit();

    $lineFetch = $db->prepare('SELECT SupplierQuotationLineID, SupplierRFQLineID, ItemID, ItemDesc, ItemSpec, ItemNote, UOM, QuantityOffered, UnitPrice, DiscountPercent, DiscountAmount, TaxInclude, Note FROM supplier_quotation_line WHERE SupplierQuotationID = :id ORDER BY SupplierQuotationLineID ASC');
    $lineFetch->bindValue(':id', $quotationId, PDO::PARAM_INT);
    $lineFetch->execute();
    $lines = [];
    while ($row = $lineFetch->fetch(PDO::FETCH_ASSOC)) {
        $lines[] = [
            'supplier_quotation_line_id' => (int) $row['SupplierQuotationLineID'],
            'supplier_rfq_line_id' => $row['SupplierRFQLineID'] !== null ? (int) $row['SupplierRFQLineID'] : null,
            'item_id' => (int) $row['ItemID'],
            'item_desc' => $row['ItemDesc'],
            'item_spec' => $row['ItemSpec'],
            'item_note' => $row['ItemNote'],
            'uom' => $row['UOM'],
            'quantity_offered' => (int) $row['QuantityOffered'],
            'unit_price' => (float) $row['UnitPrice'],
            'discount_percent' => $row['DiscountPercent'] !== null ? (float) $row['DiscountPercent'] : null,
            'discount_amount' => $row['DiscountAmount'] !== null ? (float) $row['DiscountAmount'] : null,
            'tax_include' => (bool) $row['TaxInclude'],
            'note' => $row['Note'],
        ];
    }

    echo json_encode([
        'success' => true,
        'data' => [
            'supplier_quotation_id' => $quotationId,
            'status' => $status,
            'ref_supplier_quotation_id' => $refQuotationId,
            'lines' => $lines,
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
    echo json_encode(['error' => 'server_error', 'message' => 'ไม่สามารถบันทึกใบเสนอราคาได้']);
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

function trimNullable($value): ?string
{
    if ($value === null) {
        return null;
    }
    $trimmed = trim((string) $value);
    return $trimmed === '' ? null : $trimmed;
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

function bindNullableString(PDOStatement $stmt, string $param, ?string $value): void
{
    if ($value === null) {
        $stmt->bindValue($param, null, PDO::PARAM_NULL);
        return;
    }
    $stmt->bindValue($param, $value, PDO::PARAM_STR);
}

function bindNullableFloat(PDOStatement $stmt, string $param, $value): void
{
    if ($value === null) {
        $stmt->bindValue($param, null, PDO::PARAM_NULL);
        return;
    }
    $stmt->bindValue($param, $value, PDO::PARAM_STR);
}
