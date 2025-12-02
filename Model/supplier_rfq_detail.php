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

$rfqId = isset($_GET['rfq_id']) ? (int) $_GET['rfq_id'] : 0;
if ($rfqId <= 0) {
    http_response_code(400);
    echo json_encode(['error' => 'invalid_rfq_id', 'message' => 'รหัส RFQ ไม่ถูกต้อง']);
    exit;
}

try {
    $db = DatabaseConnector::getConnection();

    $rfqSql = <<<SQL
        SELECT
            s.SupplierRFQID,
            s.RefSupplierRFQID,
            s.EventID,
            s.StaffID,
            s.ContactPerson,
            s.Title,
            s.RFQValidityDays,
            s.RFQDueDate,
            s.RFQRequestDate,
            s.OrderDate,
            s.OrderDeadline,
            s.OrderExpectedArrival,
            s.PaymentTerm,
            s.PaymentMethod,
            s.DeliverTo,
            s.Note,
            s.Status,
            e.EventName,
            e.RefEventID,
            e.StartDate,
            e.EndDate
        FROM supplier_rfq s
        LEFT JOIN events e ON e.EventID = s.EventID
        WHERE s.SupplierRFQID = :rfq_id
        LIMIT 1
    SQL;

    $rfqStmt = $db->prepare($rfqSql);
    $rfqStmt->bindValue(':rfq_id', $rfqId, PDO::PARAM_INT);
    $rfqStmt->execute();
    $rfqRow = $rfqStmt->fetch(PDO::FETCH_ASSOC);

    if (!$rfqRow) {
        http_response_code(404);
        echo json_encode(['error' => 'not_found', 'message' => 'ไม่พบ RFQ ที่ต้องการ']);
        exit;
    }

    $linesSql = <<<SQL
        SELECT
            l.SupplierRFQLineID,
            l.ItemID,
            l.ItemDesc,
            l.UOM,
            l.QuantityRequested,
            l.Note,
            i.RefItemID,
            i.ItemName
        FROM supplier_rfq_line l
        LEFT JOIN items i ON i.ItemID = l.ItemID
        WHERE l.SupplierRFQID = :rfq_id
        ORDER BY l.SupplierRFQLineID ASC
    SQL;

    $lineStmt = $db->prepare($linesSql);
    $lineStmt->bindValue(':rfq_id', $rfqId, PDO::PARAM_INT);
    $lineStmt->execute();

    $lines = [];
    while ($line = $lineStmt->fetch(PDO::FETCH_ASSOC)) {
        $lines[] = [
            'rfq_line_id' => (int) $line['SupplierRFQLineID'],
            'item_id' => (int) $line['ItemID'],
            'item_name' => $line['ItemName'] ?? $line['ItemDesc'] ?? '',
            'item_reference' => $line['RefItemID'] ?? '',
            'item_desc' => $line['ItemDesc'] ?? '',
            'uom' => $line['UOM'] ?? '',
            'quantity_requested' => (int) $line['QuantityRequested'],
            'note' => $line['Note'] ?? null,
        ];
    }

    $audit = fetchAuditMetadataForEntity($db, 'rfq', $rfqId);
    $auditLogs = fetchAuditLogsForEntity($db, 'rfq', $rfqId);

    $payload = [
        'supplier_rfq_id' => (int) $rfqRow['SupplierRFQID'],
        'ref_supplier_rfq_id' => $rfqRow['RefSupplierRFQID'],
        'event_id' => (int) $rfqRow['EventID'],
        'staff_id' => $rfqRow['StaffID'] !== null ? (int) $rfqRow['StaffID'] : null,
        'contact_person' => $rfqRow['ContactPerson'] !== null ? (int) $rfqRow['ContactPerson'] : null,
        'title' => $rfqRow['Title'],
        'rfq_validity_days' => (int) $rfqRow['RFQValidityDays'],
        'rfq_due_date' => $rfqRow['RFQDueDate'],
        'rfq_request_date' => $rfqRow['RFQRequestDate'],
        'order_date' => $rfqRow['OrderDate'],
        'order_deadline' => $rfqRow['OrderDeadline'],
        'order_expected_arrival' => $rfqRow['OrderExpectedArrival'],
        'payment_term' => $rfqRow['PaymentTerm'],
        'payment_method' => $rfqRow['PaymentMethod'],
        'deliver_to' => $rfqRow['DeliverTo'] !== null ? (int) $rfqRow['DeliverTo'] : null,
        'note' => $rfqRow['Note'],
        'status' => strtolower((string) ($rfqRow['Status'] ?? 'draft')),
        'created_at' => $audit['created_at'],
        'updated_at' => $audit['updated_at'],
        'created_by_id' => $audit['created_by_id'],
        'updated_by_id' => $audit['updated_by_id'],
        'created_by_label' => formatStaffLabel($audit['created_by_id'], $audit['created_by_name'], $audit['created_by_role']),
        'updated_by_label' => formatStaffLabel($audit['updated_by_id'], $audit['updated_by_name'], $audit['updated_by_role']),
        'audit_logs' => array_map(
            function ($log) {
                return [
                    'audit_id' => $log['audit_id'],
                    'action' => $log['action'],
                    'reason' => $log['reason'],
                    'action_at' => $log['action_at'],
                    'action_by_id' => $log['action_by_id'],
                    'action_by_label' => formatStaffLabel($log['action_by_id'], $log['action_by_name'], $log['action_by_role']),
                    'action_by_name' => $log['action_by_name'],
                    'action_by_role' => $log['action_by_role'],
                ];
            },
            $auditLogs
        ),
        'event' => [
            'event_id' => (int) $rfqRow['EventID'],
            'event_name' => $rfqRow['EventName'],
            'event_code' => $rfqRow['RefEventID'],
            'start_date' => $rfqRow['StartDate'],
            'end_date' => $rfqRow['EndDate'],
        ],
        'lines' => $lines,
    ];

    echo json_encode(['data' => $payload], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'server_error', 'message' => 'ไม่สามารถโหลดข้อมูล RFQ ได้']);
}

function formatStaffLabel($id, $name, $role)
{
    if ($id === null) {
        return '';
    }
    $displayName = $name !== null && $name !== '' ? $name : 'ไม่ทราบชื่อผู้รับผิดชอบ';
    $roleInitial = $role !== null && $role !== '' ? mb_strtoupper(mb_substr($role, 0, 1, 'UTF-8'), 'UTF-8') : 'S';
    return sprintf('%s%d - %s', $roleInitial, $id, $displayName);
}
