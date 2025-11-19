<?php
require_once __DIR__ . '/database_connector.php';
require_once __DIR__ . '/audit_log.php';

session_start();
header('Content-Type: application/json; charset=utf-8');

$categoryId = isset($_GET['id']) ? (int) $_GET['id'] : 0;
if ($categoryId <= 0) {
    http_response_code(400);
    echo json_encode(['error' => 'invalid_id']);
    exit;
}

try {
    $db = DatabaseConnector::getConnection();

    $sql = "
        SELECT
            ic.ItemCategoryID AS item_category_id,
            ic.Name AS name,
            ic.Note AS note,
            COUNT(DISTINCT i.ItemID) AS item_count,
            COUNT(DISTINCT iu.ItemUnitID) AS item_unit_count
        FROM itemcategorys ic
        LEFT JOIN items i ON i.ItemCategoryID = ic.ItemCategoryID
        LEFT JOIN item_units iu ON iu.ItemID = i.ItemID
        WHERE ic.ItemCategoryID = :id
        GROUP BY ic.ItemCategoryID
        LIMIT 1
    ";

    $stmt = $db->prepare($sql);
    $stmt->bindValue(':id', $categoryId, PDO::PARAM_INT);
    $stmt->execute();
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$row) {
        http_response_code(404);
        echo json_encode(['error' => 'not_found']);
        exit;
    }

    $audit = fetchAuditMetadataForEntity($db, 'item_category', $categoryId);

    $payload = [
        'item_category_id' => (int) $row['item_category_id'],
        'name' => $row['name'],
        'note' => $row['note'],
        'item_count' => (int) $row['item_count'],
        'item_unit_count' => (int) $row['item_unit_count'],
        'created_at' => $audit['created_at'],
        'updated_at' => $audit['updated_at'],
        'created_by_id' => $audit['created_by_id'],
        'updated_by_id' => $audit['updated_by_id'],
        'created_by_label' => formatStaffLabel($audit['created_by_id'], $audit['created_by_name'], $audit['created_by_role']),
        'updated_by_label' => formatStaffLabel($audit['updated_by_id'], $audit['updated_by_name'], $audit['updated_by_role']),
    ];

    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'server']);
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