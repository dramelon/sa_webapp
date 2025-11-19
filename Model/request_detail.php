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

$requestId = isset($_GET['request_id']) ? (int) $_GET['request_id'] : 0;
if ($requestId <= 0) {
    http_response_code(400);
    echo json_encode(['error' => 'invalid_request_id', 'message' => 'รหัสคำขอไม่ถูกต้อง']);
    exit;
}

try {
    $db = DatabaseConnector::getConnection();

    $sql = "
        SELECT
            r.RequestID,
            r.EventID,
            r.RequestName,
            r.RequestSeqNo,
            r.Note AS request_note,
            r.Status,
            e.EventName,
            e.RefEventID,
            e.StartDate,
            e.EndDate
        FROM requests r
        INNER JOIN events e ON e.EventID = r.EventID
        WHERE r.RequestID = :request_id
        LIMIT 1
    ";

    $stmt = $db->prepare($sql);
    $stmt->bindValue(':request_id', $requestId, PDO::PARAM_INT);
    $stmt->execute();
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$row) {
        http_response_code(404);
        echo json_encode(['error' => 'not_found', 'message' => 'ไม่พบคำขอที่ต้องการ']);
        exit;
    }

    $audit = fetchAuditMetadataForEntity($db, 'request', $requestId);

    $lineSql = "
        SELECT
            rl.RequestLineID,
            rl.LineNo,
            rl.ItemID,
            rl.QuantityRequested,
            rl.Note,
            rl.Status,
            i.ItemName,
            i.RefItemID,
            i.Rate,
            i.Period,
            i.UOM,
            i.Brand,
            i.Model,
            c.Name AS category_name
        FROM request_lines rl
        LEFT JOIN items i ON i.ItemID = rl.ItemID
        LEFT JOIN itemcategorys c ON c.ItemCategoryID = i.ItemCategoryID
        WHERE rl.RequestID = :request_id
        ORDER BY rl.LineNo ASC, rl.RequestLineID ASC
    ";

    $lineStmt = $db->prepare($lineSql);
    $lineStmt->bindValue(':request_id', $requestId, PDO::PARAM_INT);
    $lineStmt->execute();

    $lines = [];
    while ($line = $lineStmt->fetch(PDO::FETCH_ASSOC)) {
        if (($line['Status'] ?? '') === 'deleted') {
            continue;
        }
        $lines[] = [
            'request_line_id' => (int) $line['RequestLineID'],
            'item_id' => (int) $line['ItemID'],
            'item_name' => $line['ItemName'],
            'item_reference' => $line['RefItemID'],
            'quantity' => (int) $line['QuantityRequested'],
            'note' => $line['Note'],
            'uom' => $line['UOM'],
            'rate' => $line['Rate'],
            'period' => $line['Period'],
            'category_name' => $line['category_name'],
            'brand' => $line['Brand'],
            'model' => $line['Model'],
        ];
    }

    $statusKey = strtolower((string) ($row['Status'] ?? 'draft'));

    $payload = [
        'request_id' => (int) $row['RequestID'],
        'event_id' => (int) $row['EventID'],
        'request_name' => $row['RequestName'],
        'note' => $row['request_note'],
        'request_seq_no' => $row['RequestSeqNo'] !== null ? (int) $row['RequestSeqNo'] : null,
        'reference' => formatRequestReference($row['RequestSeqNo'], $row['RequestID']),
        'status' => $statusKey ?: 'draft',
        'created_at' => $audit['created_at'],
        'updated_at' => $audit['updated_at'],
        'created_by_id' => $audit['created_by_id'],
        'updated_by_id' => $audit['updated_by_id'],
        'created_by_label' => formatStaffLabel($audit['created_by_id'], $audit['created_by_name'], $audit['created_by_role']),
        'updated_by_label' => formatStaffLabel($audit['updated_by_id'], $audit['updated_by_name'], $audit['updated_by_role']),
        'event' => [
            'event_id' => (int) $row['EventID'],
            'event_name' => $row['EventName'],
            'event_code' => $row['RefEventID'],
            'start_date' => $row['StartDate'],
            'end_date' => $row['EndDate'],
        ],
        'lines' => $lines,
    ];

    echo json_encode(['data' => $payload], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'server_error', 'message' => 'ไม่สามารถโหลดข้อมูลคำขอได้']);
}

function formatRequestReference($seqNo, $id)
{
    if ($seqNo !== null) {
        return sprintf('REQ-%05d', (int) $seqNo);
    }
    return sprintf('REQ#%d', (int) $id);
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