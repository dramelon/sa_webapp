<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

const EVENTS_PER_PAGE = 20;

$currentStaffId = isset($_SESSION['staff_id']) ? (int) $_SESSION['staff_id'] : 0;

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

    $offset = ($page - 1) * EVENTS_PER_PAGE;

    $allowedSorts = [
        'event_id' => 'e.EventID',
        'ref_event_id' => 'e.RefEventID',
        'event_name' => 'e.EventName',
        'customer_name' => 'c.Customer_Name',
        'staff_name' => 's.FullName',
        'start_date' => 'e.StartDate',
        'status' => 'e.Status',
        'created_at' => 'e.CreatedAt',
    ];

    $sortKey = $_GET['sort_key'] ?? 'event_id';
    if (!isset($allowedSorts[$sortKey])) {
        $sortKey = 'event_id';
    }

    $sortDirection = strtolower($_GET['sort_direction'] ?? 'desc');
    if (!in_array($sortDirection, ['asc', 'desc'], true)) {
        $sortDirection = 'desc';
    }

    $orderParts = [];
    $orderParts[] = $allowedSorts[$sortKey] . ' ' . strtoupper($sortDirection);
    if ($sortKey !== 'event_id') {
        $orderParts[] = 'e.EventID DESC';
    }
    $orderSql = implode(', ', $orderParts);

    $allowedStatuses = ['draft', 'planning', 'waiting', 'processing', 'billing', 'completed', 'cancelled'];
    $status = $_GET['status'] ?? 'all';
    if ($status !== 'all' && !in_array($status, $allowedStatuses, true)) {
        $status = 'all';
    }

    $search = trim($_GET['search'] ?? '');
    $assignedOnly = filter_var($_GET['assigned_only'] ?? null, FILTER_VALIDATE_BOOLEAN);

    $whereClauses = [];
    $params = [];

    if ($search !== '') {
        $whereClauses[] = '(
            e.EventID LIKE :search
            OR e.RefEventID LIKE :search
            OR e.EventName LIKE :search
            OR c.Customer_Name LIKE :search
            OR s.FullName LIKE :search
            OR l.Loc_Name LIKE :search
        )';
        $params[':search'] = '%' . $search . '%';
    }

    if ($assignedOnly && $currentStaffId > 0) {
        $whereClauses[] = 'e.StaffID = :current_staff';
        $params[':current_staff'] = $currentStaffId;
    }

    $whereSql = '';
    if ($whereClauses) {
        $whereSql = 'WHERE ' . implode(' AND ', $whereClauses);
    }

    // Build counts (per status) respecting search term but not status filter
    $countsSql = "
        SELECT e.Status AS status, COUNT(*) AS total
        FROM events e
        LEFT JOIN customers c ON c.CustomerID = e.CustomerID
        LEFT JOIN staffs s ON s.StaffID = e.StaffID
        LEFT JOIN locations l ON l.LocationID = e.LocationID
        $whereSql
        GROUP BY e.Status
    ";

    $countsStmt = $db->prepare($countsSql);
    foreach ($params as $key => $value) {
        $countsStmt->bindValue($key, $value, $key === ':current_staff' ? PDO::PARAM_INT : PDO::PARAM_STR);
    }
    $countsStmt->execute();

    $counts = ['all' => 0];
    foreach ($allowedStatuses as $key) {
        $counts[$key] = 0;
    }

    foreach ($countsStmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $statusKey = $row['status'];
        $total = (int) $row['total'];
        if (isset($counts[$statusKey])) {
            $counts[$statusKey] = $total;
        }
        $counts['all'] += $total;
    }

    // Data query with pagination and status filter
    $dataClauses = $whereClauses;
    $dataParams = $params;
    if ($status !== 'all') {
        $dataClauses[] = 'e.Status = :status';
        $dataParams[':status'] = $status;
    }

    $dataWhereSql = '';
    if ($dataClauses) {
        $dataWhereSql = 'WHERE ' . implode(' AND ', $dataClauses);
    }

    $dataSql = "
        SELECT
            e.EventID AS event_id,
            e.RefEventID AS ref_event_id,
            e.EventName AS event_name,
            e.CreatedAt AS created_at,
            e.StartDate AS start_date,
            e.Status AS status,
            c.Customer_Name AS customer_name,
            s.StaffID AS staff_id,
            s.FullName AS staff_name,
            l.Loc_Name AS location_name
        FROM events e
        LEFT JOIN customers c ON c.CustomerID = e.CustomerID
        LEFT JOIN staffs s ON s.StaffID = e.StaffID
        LEFT JOIN locations l ON l.LocationID = e.LocationID
        $dataWhereSql
        ORDER BY $orderSql
        LIMIT :limit OFFSET :offset
    ";

    $stmt = $db->prepare($dataSql);
    foreach ($dataParams as $key => $value) {
        $stmt->bindValue($key, $value, $key === ':search' ? PDO::PARAM_STR : PDO::PARAM_STR);
        $paramType = PDO::PARAM_STR;
        if ($key === ':current_staff') {
            $paramType = PDO::PARAM_INT;
        }
        $stmt->bindValue($key, $value, $paramType);
    }
    $stmt->bindValue(':limit', EVENTS_PER_PAGE + 1, PDO::PARAM_INT);
    $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
    $stmt->execute();

    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $hasNext = false;
    if (count($rows) > EVENTS_PER_PAGE) {
        $hasNext = true;
        $rows = array_slice($rows, 0, EVENTS_PER_PAGE);
    }

    echo json_encode([
        'data' => $rows,
        'page' => $page,
        'per_page' => EVENTS_PER_PAGE,
        'has_next' => $hasNext,
        'has_prev' => $page > 1,
        'counts' => $counts,
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'server']);
}