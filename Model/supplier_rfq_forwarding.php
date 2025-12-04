<?php
require_once __DIR__ . '/database_connector.php';

session_start();
header('Content-Type: application/json; charset=utf-8');

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if (!in_array($method, ['GET', 'POST'], true)) {
    http_response_code(405);
    echo json_encode(['error' => 'method_not_allowed']);
    exit;
}

try {
    $db = DatabaseConnector::getConnection();
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'database_unavailable']);
    exit;
}

$rfqId = isset($_GET['rfq_id']) ? (int) $_GET['rfq_id'] : 0;

if ($method === 'POST') {
    $payload = json_decode(file_get_contents('php://input'), true) ?? [];
    if (isset($payload['rfq_id'])) {
        $rfqId = (int) $payload['rfq_id'];
    }
}

if ($rfqId <= 0) {
    http_response_code(400);
    echo json_encode(['error' => 'invalid_rfq_id', 'message' => 'รหัส RFQ ไม่ถูกต้อง']);
    exit;
}

try {
    if ($method === 'GET') {
        handleList($db, $rfqId);
    } else {
        handleForward($db, $rfqId);
    }
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'server_error', 'message' => 'ไม่สามารถประมวลผลคำขอได้']);
}

function normalizeStatus($status)
{
    $normalized = strtolower(trim((string) $status));
    if ($normalized === '') {
        return 'draft';
    }
    $synonyms = [
        'approved' => 'completed',
        'complete' => 'completed',
        'confirmed' => 'completed',
    ];
    $mapped = $synonyms[$normalized] ?? $normalized;
    $allowed = ['draft', 'completed', 'cancelled'];
    return in_array($mapped, $allowed, true) ? $mapped : 'draft';
}

function fetchRfq(PDO $db, int $rfqId)
{
    $stmt = $db->prepare('
        SELECT
            SupplierRFQID,
            RefSupplierRFQID,
            StaffID,
            ContactPerson,
            Title,
            RFQValidityDays,
            RFQDueDate,
            RFQRequestDate,
            OrderDate,
            OrderDeadline,
            OrderExpectedArrival,
            PaymentTerm,
            PaymentMethod,
            DeliverTo,
            Note,
            Status
        FROM supplier_rfq
        WHERE SupplierRFQID = :rfq_id
        LIMIT 1
    ');
    $stmt->bindValue(':rfq_id', $rfqId, PDO::PARAM_INT);
    $stmt->execute();
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row) {
        http_response_code(404);
        echo json_encode(['error' => 'rfq_not_found', 'message' => 'ไม่พบ RFQ ที่ต้องการ']);
        exit;
    }
    $row['Status'] = normalizeStatus($row['Status'] ?? 'draft');
    return $row;
}

function fetchRfqLines(PDO $db, int $rfqId)
{
    $stmt = $db->prepare('
        SELECT
            SupplierRFQLineID,
            ItemID,
            ItemDesc,
            UOM,
            QuantityRequested,
            Note
        FROM supplier_rfq_line
        WHERE SupplierRFQID = :rfq_id
        ORDER BY SupplierRFQLineID ASC
    ');
    $stmt->bindValue(':rfq_id', $rfqId, PDO::PARAM_INT);
    $stmt->execute();
    return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
}

function handleList(PDO $db, int $rfqId)
{
    $rfq = fetchRfq($db, $rfqId);
    $rfqStatus = $rfq['Status'];
    $search = trim($_GET['search'] ?? '');

    $where = ['s.Status = "active"'];
    $params = [':rfq_id' => $rfqId];

    if ($search !== '') {
        $where[] = '(
            s.SupplierID LIKE :search
            OR s.RefSupplierID LIKE :search
            OR s.SupplierName LIKE :search
            OR s.OrgName LIKE :search
            OR s.ContactPerson LIKE :search
            OR s.Email LIKE :search
            OR s.Phone LIKE :search
        )';
        $params[':search'] = '%' . $search . '%';
    }

    $whereSql = $where ? 'WHERE ' . implode(' AND ', $where) : '';

    $sql = "
        SELECT
            s.SupplierID AS supplier_id,
            s.RefSupplierID AS ref_supplier_id,
            s.SupplierName AS supplier_name,
            s.OrgName AS org_name,
            s.ContactPerson AS contact_person,
            s.Email AS email,
            s.Phone AS phone,
            s.Status AS status,
            EXISTS(
                SELECT 1 FROM supplier_quotation q
                WHERE q.SupplierRFQID = :rfq_id
                AND q.SupplierID = s.SupplierID
                LIMIT 1
            ) AS has_forwarded
        FROM suppliers s
        $whereSql
        ORDER BY s.SupplierID DESC
    ";

    $stmt = $db->prepare($sql);
    foreach ($params as $key => $value) {
        $paramType = $key === ':rfq_id' ? PDO::PARAM_INT : PDO::PARAM_STR;
        $stmt->bindValue($key, $value, $paramType);
    }
    $stmt->execute();

    $rows = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $contactMeta = '';
        if (!empty($row['email'])) {
            $contactMeta = $row['email'];
        }
        if ($contactMeta === '' && !empty($row['phone'])) {
            $contactMeta = $row['phone'];
        }
        $rows[] = [
            'supplier_id' => (int) $row['supplier_id'],
            'ref_supplier_id' => $row['ref_supplier_id'],
            'supplier_name' => $row['supplier_name'],
            'org_name' => $row['org_name'],
            'contact_person' => $row['contact_person'],
            'contact_meta' => $contactMeta,
            'status' => $row['status'],
            'has_forwarded' => (bool) $row['has_forwarded'],
        ];
    }

    echo json_encode([
        'data' => $rows,
        'rfq_status' => $rfqStatus,
    ], JSON_UNESCAPED_UNICODE);
}

function handleForward(PDO $db, int $rfqId)
{
    $rfq = fetchRfq($db, $rfqId);
    $rfqStatus = $rfq['Status'];
    if ($rfqStatus !== 'completed') {
        http_response_code(409);
        echo json_encode(['error' => 'rfq_not_confirmed', 'message' => 'กรุณายืนยันและบันทึก RFQ ก่อนส่ง']);
        exit;
    }

    $payload = json_decode(file_get_contents('php://input'), true) ?? [];
    $supplierId = isset($payload['supplier_id']) ? (int) $payload['supplier_id'] : 0;

    if ($supplierId <= 0) {
        http_response_code(400);
        echo json_encode(['error' => 'invalid_supplier', 'message' => 'รหัสซัพพลายเออร์ไม่ถูกต้อง']);
        exit;
    }

    $supplierStmt = $db->prepare('SELECT Status, RefSupplierID FROM suppliers WHERE SupplierID = :supplier_id LIMIT 1');
    $supplierStmt->bindValue(':supplier_id', $supplierId, PDO::PARAM_INT);
    $supplierStmt->execute();
    $supplierRow = $supplierStmt->fetch(PDO::FETCH_ASSOC);
    if (!$supplierRow) {
        http_response_code(404);
        echo json_encode(['error' => 'supplier_not_found', 'message' => 'ไม่พบซัพพลายเออร์ที่ต้องการ']);
        exit;
    }
    if (strtolower((string) $supplierRow['Status']) !== 'active') {
        http_response_code(409);
        echo json_encode(['error' => 'supplier_inactive', 'message' => 'ไม่สามารถส่ง RFQ ให้ซัพพลายเออร์ที่ไม่เปิดใช้งาน']);
        exit;
    }

    $checkStmt = $db->prepare('SELECT SupplierQuotationID FROM supplier_quotation WHERE SupplierRFQID = :rfq_id AND SupplierID = :supplier_id LIMIT 1');
    $checkStmt->bindValue(':rfq_id', $rfqId, PDO::PARAM_INT);
    $checkStmt->bindValue(':supplier_id', $supplierId, PDO::PARAM_INT);
    $checkStmt->execute();
    if ($checkStmt->fetchColumn()) {
        http_response_code(409);
        echo json_encode(['error' => 'already_forwarded', 'message' => 'ได้ส่ง RFQ ให้ซัพพลายเออร์รายนี้แล้ว']);
        exit;
    }

    $lines = fetchRfqLines($db, $rfqId);

    $staffId = (int) ($rfq['StaffID'] ?? ($_SESSION['staff_id'] ?? 0));
    $contactPerson = (int) ($rfq['ContactPerson'] ?? $staffId);
    if ($staffId <= 0) {
        http_response_code(500);
        echo json_encode(['error' => 'missing_staff', 'message' => 'ไม่สามารถระบุผู้รับผิดชอบ RFQ']);
        exit;
    }
    if ($contactPerson <= 0) {
        $contactPerson = $staffId;
    }

    try {
        $db->beginTransaction();

        $insertQuotation = $db->prepare('
            INSERT INTO supplier_quotation (
                RefSupplierQuotationID,
                SupplierRFQID,
                SupplierID,
                StaffID,
                ContactPerson,
                Title,
                BidValidityDays,
                QuotationDate,
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
                :ref_supplier_quotation_id,
                :supplier_rfq_id,
                :supplier_id,
                :staff_id,
                :contact_person,
                :title,
                :bid_validity_days,
                :quotation_date,
                :order_date,
                :order_deadline,
                :expected_arrival,
                :payment_term,
                :payment_method,
                :deliver_to,
                :ref_vendor_id,
                :note,
                :status
            )
        ');

        $insertQuotation->bindValue(':ref_supplier_quotation_id', null, PDO::PARAM_NULL);
        $insertQuotation->bindValue(':supplier_rfq_id', $rfqId, PDO::PARAM_INT);
        $insertQuotation->bindValue(':supplier_id', $supplierId, PDO::PARAM_INT);
        $insertQuotation->bindValue(':staff_id', $staffId, PDO::PARAM_INT);
        $insertQuotation->bindValue(':contact_person', $contactPerson, PDO::PARAM_INT);
        $insertQuotation->bindValue(':title', $rfq['Title'], PDO::PARAM_STR);
        $insertQuotation->bindValue(':bid_validity_days', $rfq['RFQDueDate'] ?? date('Y-m-d H:i:s'), PDO::PARAM_STR);
        $insertQuotation->bindValue(':quotation_date', $rfq['RFQRequestDate'] ?? date('Y-m-d H:i:s'), PDO::PARAM_STR);
        $insertQuotation->bindValue(':order_date', $rfq['OrderDate'] ?? date('Y-m-d H:i:s'), PDO::PARAM_STR);
        $insertQuotation->bindValue(':order_deadline', $rfq['OrderDeadline'] ?? $rfq['RFQDueDate'] ?? date('Y-m-d H:i:s'), PDO::PARAM_STR);
        $insertQuotation->bindValue(':expected_arrival', $rfq['OrderExpectedArrival'] ?? $rfq['OrderDeadline'] ?? date('Y-m-d H:i:s'), PDO::PARAM_STR);
        $insertQuotation->bindValue(':payment_term', $rfq['PaymentTerm'], PDO::PARAM_STR);
        $insertQuotation->bindValue(':payment_method', $rfq['PaymentMethod'], PDO::PARAM_STR);
        $insertQuotation->bindValue(':deliver_to', (int) $rfq['DeliverTo'], PDO::PARAM_INT);
        if (!empty($supplierRow['RefSupplierID'])) {
            $insertQuotation->bindValue(':ref_vendor_id', $supplierRow['RefSupplierID'], PDO::PARAM_STR);
        } else {
            $insertQuotation->bindValue(':ref_vendor_id', null, PDO::PARAM_NULL);
        }
        if (!empty($rfq['Note'])) {
            $insertQuotation->bindValue(':note', $rfq['Note'], PDO::PARAM_STR);
        } else {
            $insertQuotation->bindValue(':note', null, PDO::PARAM_NULL);
        }
        $insertQuotation->bindValue(':status', 'submitted', PDO::PARAM_STR);
        $insertQuotation->execute();

        $supplierQuotationId = (int) $db->lastInsertId();

        if (!empty($lines)) {
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

            foreach ($lines as $line) {
                $lineNote = $line['Note'] ?? null;
                $insertLine->bindValue(':supplier_quotation_id', $supplierQuotationId, PDO::PARAM_INT);
                $insertLine->bindValue(':supplier_rfq_line_id', $line['SupplierRFQLineID'], PDO::PARAM_INT);
                $insertLine->bindValue(':item_id', $line['ItemID'], PDO::PARAM_INT);
                $insertLine->bindValue(':item_desc', $line['ItemDesc'], PDO::PARAM_STR);
                $insertLine->bindValue(':item_spec', null, PDO::PARAM_NULL);
                if ($lineNote !== null && $lineNote !== '') {
                    $insertLine->bindValue(':item_note', $lineNote, PDO::PARAM_STR);
                } else {
                    $insertLine->bindValue(':item_note', null, PDO::PARAM_NULL);
                }
                $insertLine->bindValue(':uom', $line['UOM'], PDO::PARAM_STR);
                $insertLine->bindValue(':quantity_offered', (int) $line['QuantityRequested'], PDO::PARAM_INT);
                $insertLine->bindValue(':unit_price', 0, PDO::PARAM_STR);
                $insertLine->bindValue(':discount_percent', null, PDO::PARAM_NULL);
                $insertLine->bindValue(':discount_amount', null, PDO::PARAM_NULL);
                $insertLine->bindValue(':tax_include', 1, PDO::PARAM_INT);
                if ($lineNote !== null && $lineNote !== '') {
                    $insertLine->bindValue(':note', $lineNote, PDO::PARAM_STR);
                } else {
                    $insertLine->bindValue(':note', null, PDO::PARAM_NULL);
                }
                $insertLine->execute();
            }
        }

        $db->commit();

        echo json_encode([
            'data' => [
                'supplier_quotation_id' => $supplierQuotationId,
                'supplier_rfq_id' => $rfqId,
                'supplier_id' => $supplierId,
            ],
            'rfq_status' => $rfqStatus,
        ], JSON_UNESCAPED_UNICODE);
    } catch (Throwable $e) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        http_response_code(500);
        echo json_encode(['error' => 'server_error', 'message' => 'ไม่สามารถส่ง RFQ ให้ซัพพลายเออร์ได้']);
    }
}
