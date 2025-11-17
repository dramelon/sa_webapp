<?php
require_once __DIR__ . '/database_connector.php';

session_start();
header('Content-Type: application/json; charset=utf-8');

const ITEMS_PER_PAGE = 20;

try {
    $db = DatabaseConnector::getConnection();

    $page = isset($_GET['page']) ? (int) $_GET['page'] : 1;
    if ($page < 1) {
        $page = 1;
    }
    $offset = ($page - 1) * ITEMS_PER_PAGE;

    $allowedSorts = [
        'item_id' => 'i.ItemID',
        'ref_item_id' => 'i.RefItemID',
        'item_name' => 'i.ItemName',
        'item_type' => 'i.ItemType',
        'category_name' => 'c.Name',
        'brand' => 'i.Brand',
        'uom' => 'i.UOM',
        'rate' => 'i.Rate',
        'updated_at' => 'i.UpdatedAt',
    ];

    $sortKey = $_GET['sort_key'] ?? 'item_id';
    if (!isset($allowedSorts[$sortKey])) {
        $sortKey = 'item_id';
    }

    $sortDirection = strtolower($_GET['sort_direction'] ?? 'desc');
    if (!in_array($sortDirection, ['asc', 'desc'], true)) {
        $sortDirection = 'desc';
    }

    $orderParts = [];
    $orderParts[] = $allowedSorts[$sortKey] . ' ' . strtoupper($sortDirection);
    if ($sortKey !== 'item_id') {
        $statusFilter = $_GET['status'] ?? 'all';
    $allowedStatuses = ['all', 'with_items', 'empty'];
    if (!in_array($statusFilter, $allowedStatuses, true)) {
        $statusFilter = 'all';
    }
        $orderParts[] = 'i.ItemID DESC';
    }
    $orderSql = implode(', ', $orderParts);

    $allowedTypes = ['อุปกร', 'วัสดุ', 'บริการ'];
    $typeFilter = $_GET['type'] ?? 'all';
    if ($typeFilter !== 'all' && !in_array($typeFilter, $allowedTypes, true)) {
        $typeFilter = 'all';
    }

    $categoryFilter = $_GET['category_id'] ?? 'all';
    if ($categoryFilter !== 'all' && !ctype_digit((string) $categoryFilter)) {
        $categoryFilter = 'all';
    }

    $search = trim($_GET['search'] ?? '');

    $where = [];
    $params = [];

    if ($search !== '') {
        $where[] = '(
            i.ItemID LIKE :search
            OR i.RefItemID LIKE :search
            OR i.ItemName LIKE :search
            OR i.Brand LIKE :search
            OR i.Model LIKE :search
        )';
        $params[':search'] = '%' . $search . '%';
    }

    if ($typeFilter !== 'all') {
        $where[] = 'i.ItemType = :item_type';
        $params[':item_type'] = $typeFilter;
    }

    if ($categoryFilter !== 'all') {
        $where[] = 'i.ItemCategoryID = :category_id';
        $params[':category_id'] = (int) $categoryFilter;
    }

    $whereSql = $where ? 'WHERE ' . implode(' AND ', $where) : '';

    $countSql = "
        SELECT i.ItemType AS item_type, COUNT(*) AS total
        FROM items i
        $whereSql
        GROUP BY i.ItemType
    ";
    $countStmt = $db->prepare($countSql);
    foreach ($params as $key => $value) {
        $countStmt->bindValue($key, $value, $key === ':category_id' ? PDO::PARAM_INT : PDO::PARAM_STR);
    }
    $countStmt->execute();

    $counts = ['all' => 0, 'อุปกร' => 0, 'วัสดุ' => 0, 'บริการ' => 0];
    foreach ($countStmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $type = $row['item_type'];
        $total = (int) $row['total'];
        if (isset($counts[$type])) {
            $counts[$type] = $total;
        }
        $counts['all'] += $total;
    }

    $dataSql = "
        SELECT
            i.ItemID AS item_id,
            i.RefItemID AS ref_item_id,
            i.ItemName AS item_name,
            i.ItemType AS item_type,
            i.Brand AS brand,
            i.Model AS model,
            i.UOM AS uom,
            i.Rate AS rate,
            i.Period AS period,
            i.UpdatedAt AS updated_at,
            i.CreatedAt AS created_at,
            c.ItemCategoryID AS category_id,
            c.Name AS category_name
        FROM items i
        LEFT JOIN itemcategory c ON c.ItemCategoryID = i.ItemCategoryID
        $whereSql
        ORDER BY $orderSql
        LIMIT :limit OFFSET :offset
    ";

    $stmt = $db->prepare($dataSql);
    foreach ($params as $key => $value) {
        $paramType = $key === ':category_id' ? PDO::PARAM_INT : PDO::PARAM_STR;
        $stmt->bindValue($key, $value, $paramType);
    }
    $stmt->bindValue(':limit', ITEMS_PER_PAGE + 1, PDO::PARAM_INT);
    $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
    $stmt->execute();

    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $hasNext = count($rows) > ITEMS_PER_PAGE;
    if ($hasNext) {
        array_pop($rows);
    }
    $hasPrev = $page > 1;

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