<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

const ITEM_UNITS_PER_PAGE = 20;

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
    $offset = ($page - 1) * ITEM_UNITS_PER_PAGE;

    $allowedSorts = [
        'item_unit_id' => 'iu.ItemUnitID',
        'item_name' => 'i.ItemName',
        'serial_number' => 'iu.SerialNumber',
        'status' => 'iu.Status',
        'ownership' => 'iu.OwnerShip',
        'expected_return_at' => 'iu.ExpectedReturnAt',
        'return_at' => 'iu.ReturnAt',
        'updated_at' => 'iu.UpdatedAt',
    ];

    $sortKey = $_GET['sort_key'] ?? 'item_unit_id';
    if (!isset($allowedSorts[$sortKey])) {
        $sortKey = 'item_unit_id';
    }

    $sortDirection = strtolower($_GET['sort_direction'] ?? 'desc');
    if (!in_array($sortDirection, ['asc', 'desc'], true)) {
        $sortDirection = 'desc';
    }

    $orderParts = [];
    $orderParts[] = $allowedSorts[$sortKey] . ' ' . strtoupper($sortDirection);
    if ($sortKey !== 'item_unit_id') {
        $orderParts[] = 'iu.ItemUnitID DESC';
    }
    $orderSql = implode(', ', $orderParts);

    $allowedStatuses = ['useable', 'in use', 'pending booking', 'booked', 'damaged', 'reparing', 'delivering', 'returned', 'depreciated'];
    $statusFilter = $_GET['status'] ?? 'all';
    if ($statusFilter !== 'all' && !in_array($statusFilter, $allowedStatuses, true)) {
        $statusFilter = 'all';
    }

    $allowedOwnership = ['company', 'rented'];
    $ownershipFilter = $_GET['ownership'] ?? 'all';
    if ($ownershipFilter !== 'all' && !in_array($ownershipFilter, $allowedOwnership, true)) {
        $ownershipFilter = 'all';
    }

    $search = trim($_GET['search'] ?? '');

    $where = [];
    $params = [];

    if ($search !== '') {
        $where[] = '(
            iu.ItemUnitID LIKE :search
            OR iu.SerialNumber LIKE :search
            OR i.ItemName LIKE :search
        )';
        $params[':search'] = '%' . $search . '%';
    }

    if ($statusFilter !== 'all') {
        $where[] = 'iu.Status = :status';
        $params[':status'] = $statusFilter;
    }

    if ($ownershipFilter !== 'all') {
        $where[] = 'iu.OwnerShip = :ownership';
        $params[':ownership'] = $ownershipFilter;
    }

    $whereSql = $where ? 'WHERE ' . implode(' AND ', $where) : '';

    $countSql = "
        SELECT iu.Status AS status, COUNT(*) AS total
        FROM item_unit iu
        LEFT JOIN items i ON i.ItemID = iu.ItemID
        $whereSql
        GROUP BY iu.Status
    ";
    $countStmt = $db->prepare($countSql);
    foreach ($params as $key => $value) {
        $countStmt->bindValue($key, $value, PDO::PARAM_STR);
    }
    $countStmt->execute();

    $counts = ['all' => 0];
    foreach ($allowedStatuses as $status) {
        $counts[$status] = 0;
    }

    foreach ($countStmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $status = $row['status'];
        $total = (int) $row['total'];
        if (isset($counts[$status])) {
            $counts[$status] = $total;
        }
        $counts['all'] += $total;
    }

    $dataSql = "
        SELECT
            iu.ItemUnitID AS item_unit_id,
            iu.ItemID AS item_id,
            i.ItemName AS item_name,
            i.ItemType AS item_type,
            iu.WarehouseID AS warehouse_id,
            iu.SupplierID AS supplier_id,
            iu.SerialNumber AS serial_number,
            iu.OwnerShip AS ownership,
            iu.ConditionIn AS condition_in,
            iu.ConditionOut AS condition_out,
            iu.ExpectedReturnAt AS expected_return_at,
            iu.ReturnAt AS return_at,
            iu.Status AS status,
            iu.CreatedAt AS created_at,
            iu.CreatedBy AS created_by,
            iu.UpdatedAt AS updated_at,
            iu.UpdatedBy AS updated_by
        FROM item_unit iu
        LEFT JOIN items i ON i.ItemID = iu.ItemID
        $whereSql
        ORDER BY $orderSql
        LIMIT :limit OFFSET :offset
    ";

    $stmt = $db->prepare($dataSql);
    foreach ($params as $key => $value) {
        $stmt->bindValue($key, $value, PDO::PARAM_STR);
    }
    $stmt->bindValue(':limit', ITEM_UNITS_PER_PAGE + 1, PDO::PARAM_INT);
    $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
    $stmt->execute();

    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $hasNext = count($rows) > ITEM_UNITS_PER_PAGE;
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