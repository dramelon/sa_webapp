<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

const CATEGORIES_PER_PAGE = 20;

try {
    $db = new PDO(
        'mysql:host=localhost;dbname=sa_webapp;charset=utf8mb4',
        'dramelon',
        'dramelon',
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );

    $page = isset($_GET['page']) ? (int) $_GET['page'] : 1;
    if ($page < 1) {
        $page = 1;
    }
    $offset = ($page - 1) * CATEGORIES_PER_PAGE;

    $allowedSorts = [
        'item_category_id' => 'ic.ItemCategoryID',
        'name' => 'ic.Name',
        'notes' => 'ic.Note',
        'item_count' => 'item_count'
    ];

    $sortKey = $_GET['sort_key'] ?? 'item_category_id';
    if (!isset($allowedSorts[$sortKey])) {
        $sortKey = 'item_category_id';
    }

    $sortDirection = strtolower($_GET['sort_direction'] ?? 'desc');
    if (!in_array($sortDirection, ['asc', 'desc'], true)) {
        $sortDirection = 'desc';
    }

    $orderParts = [];
    $orderParts[] = $allowedSorts[$sortKey] . ' ' . strtoupper($sortDirection);
    if ($sortKey !== 'item_category_id') {
        $orderParts[] = 'ic.ItemCategoryID DESC';
    }
    $orderSql = implode(', ', $orderParts);

    $search = trim($_GET['search'] ?? '');
    $where = [];
    $params = [];

    if ($search !== '') {
        $where[] = '(
            ic.ItemCategoryID LIKE :search
            OR ic.Name LIKE :search
            OR ic.Note LIKE :search
        )';
        $params[':search'] = '%' . $search . '%';
    }

    $whereSql = $where ? 'WHERE ' . implode(' AND ', $where) : '';

    $totalSql = "
        SELECT COUNT(*) AS total
        FROM itemcategory ic
        $whereSql
    ";
    $totalStmt = $db->prepare($totalSql);
    foreach ($params as $key => $value) {
        $totalStmt->bindValue($key, $value, PDO::PARAM_STR);
    }
    $totalStmt->execute();
    $totalRow = $totalStmt->fetch(PDO::FETCH_ASSOC);
    $totalCategories = (int) ($totalRow['total'] ?? 0);

    $usageSql = "
        SELECT COUNT(*) AS used_total
        FROM (
            SELECT ic.ItemCategoryID
            FROM itemcategory ic
            LEFT JOIN items i ON i.ItemCategoryID = ic.ItemCategoryID
            $whereSql
            GROUP BY ic.ItemCategoryID
            HAVING COUNT(i.ItemID) > 0
        ) t
    ";
    $usageStmt = $db->prepare($usageSql);
    foreach ($params as $key => $value) {
        $usageStmt->bindValue($key, $value, PDO::PARAM_STR);
    }
    $usageStmt->execute();
    $usageRow = $usageStmt->fetch(PDO::FETCH_ASSOC);
    $usedCategories = (int) ($usageRow['used_total'] ?? 0);

    $dataSql = "
        SELECT
            ic.ItemCategoryID AS item_category_id,
            ic.Name AS name,
            ic.Note AS note,
            COUNT(i.ItemID) AS item_count
        FROM itemcategory ic
        LEFT JOIN items i ON i.ItemCategoryID = ic.ItemCategoryID
        $whereSql
        GROUP BY ic.ItemCategoryID
        ORDER BY $orderSql
        LIMIT :limit OFFSET :offset
    ";

    $stmt = $db->prepare($dataSql);
    foreach ($params as $key => $value) {
        $stmt->bindValue($key, $value, PDO::PARAM_STR);
    }
    $stmt->bindValue(':limit', CATEGORIES_PER_PAGE + 1, PDO::PARAM_INT);
    $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
    $stmt->execute();

    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $hasNext = count($rows) > CATEGORIES_PER_PAGE;
    if ($hasNext) {
        array_pop($rows);
    }
    $hasPrev = $page > 1;

    $counts = [
        'all' => $totalCategories,
        'with_items' => $usedCategories,
        'empty' => max(0, $totalCategories - $usedCategories),
    ];

    echo json_encode([
        'data' => $rows,
        'counts' => $counts,
        'has_next' => $hasNext,
        'has_prev' => $hasPrev,
        'page' => $page,
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'server']);
}