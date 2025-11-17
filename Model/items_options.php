<?php
require_once __DIR__ . '/database_connector.php';

session_start();
header('Content-Type: application/json; charset=utf-8');

if (empty($_SESSION['staff_id'])) {
    http_response_code(401);
    echo json_encode(['error' => 'unauthorized']);
    exit;
}

$query = trim($_GET['q'] ?? '');

try {
    $db = DatabaseConnector::getConnection();

    $sql = "
        SELECT
            i.ItemID AS id,
            i.ItemName AS name,
            COALESCE(i.RefItemID, '') AS ref_id,
            COALESCE(c.Name, '') AS category_name,
            COALESCE(i.UOM, '') AS uom,
            COALESCE(i.Brand, '') AS brand,
            COALESCE(i.Model, '') AS model,
            i.Rate AS rate,
            COALESCE(i.Period, '') AS period
        FROM items i
        LEFT JOIN itemcategory c ON c.ItemCategoryID = i.ItemCategoryID
    ";
    $params = [];
    if ($query !== '') {
        $sql .= " WHERE i.ItemName LIKE :term OR i.RefItemID LIKE :term OR i.ItemID LIKE :term";
        $params[':term'] = '%' . $query . '%';
    }
    $sql .= ' ORDER BY i.ItemName ASC LIMIT 100';

    $stmt = $db->prepare($sql);
    foreach ($params as $key => $value) {
        $stmt->bindValue($key, $value, PDO::PARAM_STR);
    }
    $stmt->execute();

    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode(['data' => $rows], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'server']);
}