<?php
require_once __DIR__ . '/database_connector.php';

session_start();
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'method_not_allowed']);
    exit;
}

$itemId = isset($_GET['item_id']) ? (int) $_GET['item_id'] : 0;
if ($itemId <= 0) {
    http_response_code(400);
    echo json_encode(['error' => 'invalid_item_id', 'message' => 'รหัสสินค้าที่ระบุไม่ถูกต้อง']);
    exit;
}

$defaultStatuses = ['useable', 'returned'];
$statusesParam = isset($_GET['statuses']) ? trim((string) $_GET['statuses']) : '';
$requestedStatuses = array_filter(array_map('trim', explode(',', $statusesParam)));
$allowedStatuses = [
    'useable',
    'returned',
    'pending booking',
    'booked',
    'in use',
    'delivering',
    'reparing',
    'damaged',
    'archived',
    'depreciated',
];
$statuses = [];

foreach ($requestedStatuses as $status) {
    if (in_array($status, $allowedStatuses, true)) {
        $statuses[] = $status;
    }
}

if (!$statuses) {
    $statuses = $defaultStatuses;
}

try {
    $db = DatabaseConnector::getConnection();

    $placeholders = implode(', ', array_fill(0, count($statuses), '?'));
    $sql = "
        SELECT
            iu.ItemUnitID AS item_unit_id,
            iu.ItemID AS item_id,
            iu.SerialNumber AS serial_number,
            iu.Status AS status,
            iu.OwnerShip AS ownership,
            iu.ExpectedReturnAt AS expected_return_at,
            iu.ReturnAt AS return_at,
            iu.WarehouseID AS warehouse_id,
            w.WarehouseName AS warehouse_name
        FROM item_units AS iu
        LEFT JOIN warehouse AS w ON w.WarehouseID = iu.WarehouseID
        WHERE iu.ItemID = ?
            AND iu.Status IN ($placeholders)
        ORDER BY iu.ItemUnitID ASC
    ";

    $stmt = $db->prepare($sql);
    $stmt->bindValue(1, $itemId, PDO::PARAM_INT);
    foreach ($statuses as $index => $status) {
        $stmt->bindValue($index + 2, $status, PDO::PARAM_STR);
    }
    $stmt->execute();

    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'data' => $rows,
        'item_id' => $itemId,
        'statuses' => $statuses,
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(500);
    // Log the detailed error to the PHP error log for debugging
    error_log('Error in item_units_by_item.php: ' . $e->getMessage());
    echo json_encode([
        'error' => 'server_error',
        'message' => 'ไม่สามารถโหลดข้อมูลหน่วยสินค้าได้'
    ]);
}