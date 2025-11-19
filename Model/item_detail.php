<?php
require_once __DIR__ . '/database_connector.php';
require_once __DIR__ . '/audit_log.php';

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
            i.Note AS note,
            c.Name AS category_name
        FROM items i
        LEFT JOIN itemcategorys c ON c.ItemCategoryID = i.ItemCategoryID
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

    $audit = fetchAuditMetadataForEntity($db, 'item', $itemId);

    $payload = [
        'item_id' => (int) $item['item_id'],
        'ref_item_id' => $item['ref_item_id'],
        'item_name' => $item['item_name'],
        'item_type' => $item['item_type'],
        'item_category_id' => $item['item_category_id'] ? (int) $item['item_category_id'] : null,
        'category_name' => $item['category_name'],
        'brand' => $item['brand'],
        'model' => $item['model'],
        'uom' => $item['uom'],
        'rate' => $item['rate'],
        'period' => $item['period'],
        'note' => $item['note'],
        'created_at' => $audit['created_at'],
        'updated_at' => $audit['updated_at'],
        'created_by_name' => formatStaffLabel($audit['created_by_id'], $audit['created_by_name'], $audit['created_by_role']),
        'updated_by_name' => formatStaffLabel($audit['updated_by_id'], $audit['updated_by_name'], $audit['updated_by_role']),
    ];

    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'server']);
}

function formatStaffLabel($id, $name, $role)
{
    if ($id === null) return '';
    $displayName = $name ?: 'ไม่ทราบชื่อ';
    $roleInitial = $role ? mb_strtoupper(mb_substr($role, 0, 1, 'UTF-8')) : 'S';
    return sprintf('%s%d - %s', $roleInitial, $id, $displayName);
}