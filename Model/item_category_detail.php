<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

$categoryId = isset($_GET['id']) ? (int) $_GET['id'] : 0;
if ($categoryId <= 0) {
    http_response_code(400);
    echo json_encode(['error' => 'invalid_id']);
    exit;
}

try {
    $db = new PDO(
        'mysql:host=localhost;dbname=sa_webapp;charset=utf8mb4',
        'dramelon',
        'dramelon',
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );

    $sql = "
        SELECT
            ic.ItemCategoryID AS item_category_id,
            ic.Name AS name,
            ic.Note AS note,
            COUNT(i.ItemID) AS item_count
        FROM itemcategory ic
        LEFT JOIN items i ON i.ItemCategoryID = ic.ItemCategoryID
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

    $row['updated_at'] = null;
    $row['updated_by'] = null;
    $row['updated_by_name'] = null;

    echo json_encode($row, JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'server']);
}