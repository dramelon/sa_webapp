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
        SELECT ItemCategoryID AS id, Name AS name
        FROM itemcategorys
    ";
    $params = [];
    if ($query !== '') {
        $sql .= " WHERE Name LIKE :term";
        $params[':term'] = '%' . $query . '%';
    }
    $sql .= ' ORDER BY Name ASC LIMIT 100';

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