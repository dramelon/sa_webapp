<?php
require_once __DIR__ . '/database_connector.php';

session_start();
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'method_not_allowed']);
    exit;
}

$requestLineId = isset($_GET['request_line_id']) ? (int) $_GET['request_line_id'] : 0;
if ($requestLineId <= 0) {
    http_response_code(400);
    echo json_encode(['error' => 'invalid_request_line_id', 'message' => 'รหัสบรรทัดคำขอไม่ถูกต้อง']);
    exit;
}

try {
    $db = DatabaseConnector::getConnection();

    $sql = "
        SELECT
            rl.RequestLineID,
            rl.RequestID,
            rl.LineNo,
            rl.ItemID,
            rl.QuantityRequested,
            rl.FulfillmentStatus,
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
        WHERE rl.RequestLineID = :request_line_id
        LIMIT 1
    ";

    $stmt = $db->prepare($sql);
    $stmt->bindValue(':request_line_id', $requestLineId, PDO::PARAM_INT);
    $stmt->execute();

    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row || ($row['Status'] ?? '') === 'deleted') {
        http_response_code(404);
        echo json_encode(['error' => 'not_found', 'message' => 'ไม่พบบรรทัดคำขอที่ระบุ']);
        exit;
    }

    $payload = [
        'request_line_id' => (int) $row['RequestLineID'],
        'request_id' => (int) $row['RequestID'],
        'line_no' => $row['LineNo'] !== null ? (int) $row['LineNo'] : null,
        'item_id' => $row['ItemID'] !== null ? (int) $row['ItemID'] : null,
        'item_name' => $row['ItemName'],
        'item_reference' => $row['RefItemID'],
        'quantity' => $row['QuantityRequested'] !== null ? (int) $row['QuantityRequested'] : null,
        'fulfillment_status' => strtolower((string) $row['FulfillmentStatus']),
        'note' => $row['Note'],
        'uom' => $row['UOM'],
        'rate' => $row['Rate'],
        'period' => $row['Period'],
        'category_name' => $row['category_name'],
        'brand' => $row['Brand'],
        'model' => $row['Model'],
    ];

    echo json_encode(['data' => $payload], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'server_error', 'message' => 'ไม่สามารถโหลดข้อมูลบรรทัดคำขอได้']);
}