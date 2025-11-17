<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

const WAREHOUSES_PER_PAGE = 20;

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
    $offset = ($page - 1) * WAREHOUSES_PER_PAGE;

    $allowedSorts = [
        'warehouse_id' => 'w.WarehouseID',
        'warehouse_name' => 'w.WarehouseName',
        'location_name' => 'l.LocationName',
        'warehouse_sn' => 'w.WarehouseSN',
        'status' => 'w.Status',
        'updated_at' => 'w.UpdatedAt',
    ];
    $sortKey = $_GET['sort_key'] ?? 'warehouse_id';
    if (!isset($allowedSorts[$sortKey])) {
        $sortKey = 'warehouse_id';
    }
    $sortDirection = strtolower($_GET['sort_direction'] ?? 'desc');
    if (!in_array($sortDirection, ['asc', 'desc'], true)) {
        $sortDirection = 'desc';
    }
    $orderSql = $allowedSorts[$sortKey] . ' ' . strtoupper($sortDirection);
    if ($sortKey !== 'warehouse_id') {
        $orderSql .= ', w.WarehouseID DESC';
    }

    $allowedStatuses = ['active', 'inactive'];
    $status = $_GET['status'] ?? 'all';
    if ($status !== 'all' && !in_array($status, $allowedStatuses, true)) {
        $status = 'all';
    }

    $search = trim($_GET['search'] ?? '');

    $searchClauses = [];
    $searchParams = [];
    if ($search !== '') {
        $searchClauses[] = '(
            w.WarehouseName LIKE :search
            OR w.WarehouseSN LIKE :search
            OR CAST(w.WarehouseID AS CHAR) LIKE :search
            OR l.LocationName LIKE :search
        )';
        $searchParams[':search'] = '%' . $search . '%';
    }

    $countsWhere = $searchClauses ? 'WHERE ' . implode(' AND ', $searchClauses) : '';
    $countsStmt = $db->prepare(
        "SELECT w.Status AS status, COUNT(*) AS total
        FROM warehouse w
        LEFT JOIN locations l ON l.LocationID = w.LocationID
        $countsWhere
        GROUP BY w.Status"
    );
    foreach ($searchParams as $key => $value) {
        $countsStmt->bindValue($key, $value, PDO::PARAM_STR);
    }
    $countsStmt->execute();
    $counts = ['all' => 0, 'active' => 0, 'inactive' => 0];
    foreach ($countsStmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $statusKey = $row['status'];
        $total = (int) $row['total'];
        if (isset($counts[$statusKey])) {
            $counts[$statusKey] = $total;
        }
        $counts['all'] += $total;
    }

    $dataClauses = $searchClauses;
    $dataParams = $searchParams;
    if ($status !== 'all') {
        $dataClauses[] = 'w.Status = :status';
        $dataParams[':status'] = $status;
    }
    $dataWhere = $dataClauses ? 'WHERE ' . implode(' AND ', $dataClauses) : '';
    $dataSql = "
        SELECT
            w.WarehouseID AS warehouse_id,
            w.WarehouseName AS warehouse_name,
            w.WarehouseSN AS warehouse_sn,
            w.Status AS status,
            w.UpdatedAt AS updated_at,
            w.Note AS note,
            l.LocationName AS location_name
        FROM warehouse w
        LEFT JOIN locations l ON l.LocationID = w.LocationID
        $dataWhere
        ORDER BY $orderSql
        LIMIT :limit OFFSET :offset
    ";
    $stmt = $db->prepare($dataSql);
    foreach ($dataParams as $key => $value) {
        if ($key === ':status') {
            $stmt->bindValue($key, $value, PDO::PARAM_STR);
        } else {
            $stmt->bindValue($key, $value, PDO::PARAM_STR);
        }
    }
    $stmt->bindValue(':limit', WAREHOUSES_PER_PAGE + 1, PDO::PARAM_INT);
    $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
    $stmt->execute();
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $hasNext = false;
    if (count($rows) > WAREHOUSES_PER_PAGE) {
        $hasNext = true;
        $rows = array_slice($rows, 0, WAREHOUSES_PER_PAGE);
    }

    echo json_encode([
        'data' => $rows,
        'page' => $page,
        'per_page' => WAREHOUSES_PER_PAGE,
        'has_next' => $hasNext,
        'has_prev' => $page > 1,
        'counts' => $counts,
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'server']);
}