<?php
require_once __DIR__ . '/database_connector.php';

session_start();
header('Content-Type: application/json; charset=utf-8');

$itemId = isset($_GET['id']) ? (int) $_GET['id'] : 0;
if ($itemId <= 0) {
    http_response_code(400);
    echo json_encode(['error' => 'invalid_id']);
    exit;
}

try {
    $db = DatabaseConnector::getConnection();

    $sql = "
        SELECT
            i.ItemID AS item_id,
            i.RefItemID AS ref_item_id,
            i.ItemName AS item_name,
            i.ItemType AS item_type,
            i.ItemCategoryID AS item_category_id,
            i.Brand AS brand,
            i.Model AS model,
            i.UOM AS uom,
            i.Rate AS rate,
            i.Period AS period,
            i.CreatedAt AS created_at,
            i.CreatedBy AS created_by,
            i.UpdatedAt AS updated_at,
            i.UpdatedBy AS updated_by,
            c.Name AS category_name,
            cb.FullName AS created_by_name,
            ub.FullName AS updated_by_name
        FROM items i
        LEFT JOIN itemcategory c ON c.ItemCategoryID = i.ItemCategoryID
        LEFT JOIN staffs cb ON cb.StaffID = i.CreatedBy
        LEFT JOIN staffs ub ON ub.StaffID = i.UpdatedBy
        WHERE i.ItemID = :item_id
        LIMIT 1
    ";

    $stmt = $db->prepare($sql);
    $stmt->bindValue(':item_id', $itemId, PDO::PARAM_INT);
    $stmt->execute();

    $item = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$item) {
        http_response_code(404);
        echo json_encode(['error' => 'not_found']);
        exit;
    }

    echo json_encode($item, JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'server']);
}