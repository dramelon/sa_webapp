<?php
require_once __DIR__ . '/database_connector.php';
require_once __DIR__ . '/audit_log.php';

session_start();
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'method_not_allowed']);
    exit;
}

$quotationId = isset($_GET['supplier_quotation_id']) ? (int) $_GET['supplier_quotation_id'] : 0;
if ($quotationId <= 0) {
    http_response_code(400);
    echo json_encode(['error' => 'invalid_quotation_id', 'message' => 'รหัสใบเสนอราคาไม่ถูกต้อง']);
    exit;
}

try {
    $db = DatabaseConnector::getConnection();

    $headerSql = <<<SQL
        SELECT
            q.SupplierQuotationID,
            q.RefSupplierQuotationID,
            q.SupplierRFQID,
            q.SupplierID,
            q.StaffID,
            q.ContactPerson,
            q.Title,
            q.BidValidityDays,
            q.QuotationDate,
            q.OrderDate,
            q.OrderDeadline,
            q.ExpectedArrival,
            q.PaymentTerm,
            q.PaymentMethod,
            q.DeliverTo,
            q.RefVendorID,
            q.Note,
            q.Status,
            r.EventID,
            r.Title AS RfqTitle,
            r.RefSupplierRFQID,
            e.EventName,
            e.RefEventID,
            e.StartDate,
            e.EndDate,
            s.SupplierName,
            s.OrgName,
            s.RefSupplierID
        FROM supplier_quotation q
        LEFT JOIN supplier_rfq r ON r.SupplierRFQID = q.SupplierRFQID
        LEFT JOIN events e ON e.EventID = r.EventID
        LEFT JOIN suppliers s ON s.SupplierID = q.SupplierID
        WHERE q.SupplierQuotationID = :id
        LIMIT 1
    SQL;

    $headerStmt = $db->prepare($headerSql);
    $headerStmt->bindValue(':id', $quotationId, PDO::PARAM_INT);
    $headerStmt->execute();

    $quotation = $headerStmt->fetch(PDO::FETCH_ASSOC);
    if (!$quotation) {
        http_response_code(404);
        echo json_encode(['error' => 'not_found', 'message' => 'ไม่พบใบเสนอราคาที่ต้องการ']);
        exit;
    }

    $lineSql = <<<SQL
        SELECT
            l.SupplierQuotationLineID,
            l.SupplierRFQLineID,
            l.ItemID,
            l.ItemDesc,
            l.ItemSpec,
            l.ItemNote,
            l.UOM,
            l.QuantityOffered,
            l.UnitPrice,
            l.DiscountPercent,
            l.DiscountAmount,
            l.TaxInclude,
            l.Note,
            i.RefItemID,
            i.ItemName
        FROM supplier_quotation_line l
        LEFT JOIN items i ON i.ItemID = l.ItemID
        WHERE l.SupplierQuotationID = :quotation_id
        ORDER BY l.SupplierQuotationLineID ASC
    SQL;

    $lineStmt = $db->prepare($lineSql);
    $lineStmt->bindValue(':quotation_id', $quotationId, PDO::PARAM_INT);
    $lineStmt->execute();

    $lines = [];
    while ($line = $lineStmt->fetch(PDO::FETCH_ASSOC)) {
        $lines[] = [
            'supplier_quotation_line_id' => (int) $line['SupplierQuotationLineID'],
            'supplier_rfq_line_id' => $line['SupplierRFQLineID'] !== null ? (int) $line['SupplierRFQLineID'] : null,
            'item_id' => (int) $line['ItemID'],
            'item_reference' => $line['RefItemID'] ?? '',
            'item_name' => $line['ItemName'] ?? $line['ItemDesc'] ?? '',
            'item_desc' => $line['ItemDesc'] ?? '',
            'item_spec' => $line['ItemSpec'] ?? null,
            'item_note' => $line['ItemNote'] ?? null,
            'uom' => $line['UOM'] ?? 'unit',
            'quantity_offered' => (int) $line['QuantityOffered'],
            'unit_price' => (float) $line['UnitPrice'],
            'discount_percent' => $line['DiscountPercent'] !== null ? (float) $line['DiscountPercent'] : null,
            'discount_amount' => $line['DiscountAmount'] !== null ? (float) $line['DiscountAmount'] : null,
            'tax_include' => (bool) $line['TaxInclude'],
            'note' => $line['Note'] ?? null,
        ];
    }

    $audit = fetchAuditMetadataForEntity($db, 'supplier_quotation', $quotationId);

    $payload = [
        'supplier_quotation_id' => (int) $quotation['SupplierQuotationID'],
        'ref_supplier_quotation_id' => $quotation['RefSupplierQuotationID'],
        'supplier_rfq_id' => $quotation['SupplierRFQID'] !== null ? (int) $quotation['SupplierRFQID'] : null,
        'supplier_id' => $quotation['SupplierID'] !== null ? (int) $quotation['SupplierID'] : null,
        'staff_id' => $quotation['StaffID'] !== null ? (int) $quotation['StaffID'] : null,
        'contact_person' => $quotation['ContactPerson'] !== null ? (int) $quotation['ContactPerson'] : null,
        'title' => $quotation['Title'] ?? '',
        'bid_validity_days' => $quotation['BidValidityDays'],
        'quotation_date' => $quotation['QuotationDate'],
        'order_date' => $quotation['OrderDate'],
        'order_deadline' => $quotation['OrderDeadline'],
        'expected_arrival' => $quotation['ExpectedArrival'],
        'payment_term' => $quotation['PaymentTerm'],
        'payment_method' => $quotation['PaymentMethod'],
        'deliver_to' => $quotation['DeliverTo'] !== null ? (int) $quotation['DeliverTo'] : null,
        'ref_vendor_id' => $quotation['RefVendorID'],
        'note' => $quotation['Note'],
        'status' => strtolower((string) ($quotation['Status'] ?? 'submitted')),
        'rfq' => [
            'supplier_rfq_id' => $quotation['SupplierRFQID'] !== null ? (int) $quotation['SupplierRFQID'] : null,
            'title' => $quotation['RfqTitle'] ?? null,
            'ref_supplier_rfq_id' => $quotation['RefSupplierRFQID'] ?? null,
        ],
        'event' => [
            'event_id' => $quotation['EventID'] !== null ? (int) $quotation['EventID'] : null,
            'event_name' => $quotation['EventName'] ?? null,
            'event_code' => $quotation['RefEventID'] ?? null,
            'start_date' => $quotation['StartDate'] ?? null,
            'end_date' => $quotation['EndDate'] ?? null,
        ],
        'supplier' => [
            'supplier_id' => $quotation['SupplierID'] !== null ? (int) $quotation['SupplierID'] : null,
            'supplier_name' => $quotation['SupplierName'] ?? null,
            'org_name' => $quotation['OrgName'] ?? null,
            'ref_supplier_id' => $quotation['RefSupplierID'] ?? null,
        ],
        'created_at' => $audit['created_at'],
        'updated_at' => $audit['updated_at'],
        'created_by_id' => $audit['created_by_id'],
        'updated_by_id' => $audit['updated_by_id'],
        'created_by_label' => formatStaffLabel($audit['created_by_id'], $audit['created_by_name'], $audit['created_by_role']),
        'updated_by_label' => formatStaffLabel($audit['updated_by_id'], $audit['updated_by_name'], $audit['updated_by_role']),
        'lines' => $lines,
    ];

    echo json_encode(['data' => $payload], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'server_error', 'message' => 'ไม่สามารถโหลดข้อมูลใบเสนอราคาได้']);
}
