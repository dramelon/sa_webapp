<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

const CUSTOMERS_PER_PAGE = 20;

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
    $offset = ($page - 1) * CUSTOMERS_PER_PAGE;

    $status = strtolower((string) ($_GET['status'] ?? 'all'));
    $allowedStatuses = ['all', 'active', 'inactive'];
    if (!in_array($status, $allowedStatuses, true)) {
        $status = 'all';
    }

    $search = trim((string) ($_GET['search'] ?? ''));

    $allowedSorts = [
        'customer_id' => 'c.CustomerID',
        'customer_name' => 'c.CustomerName',
        'organization' => 'c.OrgName',
        'email' => 'c.Email',
        'phone' => 'c.Phone',
        'status' => 'c.Status',
        'ref_customer_id' => 'c.RefCustomerID',
    ];
    $sortKey = $_GET['sort_key'] ?? 'customer_name';
    if (!isset($allowedSorts[$sortKey])) {
        $sortKey = 'customer_name';
    }
    $sortDirection = strtolower((string) ($_GET['sort_direction'] ?? 'asc'));
    if (!in_array($sortDirection, ['asc', 'desc'], true)) {
        $sortDirection = 'asc';
    }
    $orderSql = $allowedSorts[$sortKey] . ' ' . strtoupper($sortDirection);
    if ($sortKey !== 'customer_id') {
        $orderSql .= ', c.CustomerID ASC';
    }

    $searchClauses = [];
    $searchParams = [];

    if ($search !== '') {
        $searchClauses[] = '(
            c.CustomerName LIKE :search
            OR c.OrgName LIKE :search
            OR c.Email LIKE :search
            OR c.Phone LIKE :search
            OR c.TaxID LIKE :search
            OR c.RefCustomerID LIKE :search
            OR CAST(c.CustomerID AS CHAR) LIKE :search
        )';
        $searchParams[':search'] = '%' . $search . '%';
    }

    $dataClauses = $searchClauses;
    $dataParams = $searchParams;

    if ($status !== 'all') {
        $dataClauses[] = 'c.Status = :status';
        $dataParams[':status'] = $status;
    }

    $whereSql = $dataClauses ? 'WHERE ' . implode(' AND ', $dataClauses) : '';
    $countWhereSql = $searchClauses ? 'WHERE ' . implode(' AND ', $searchClauses) : '';

    $counts = [
        'all' => 0,
        'active' => 0,
        'inactive' => 0,
    ];

    $countsSql = "SELECT c.Status AS status, COUNT(*) AS total FROM customers c $countWhereSql GROUP BY c.Status";
    $countsStmt = $db->prepare($countsSql);
    foreach ($searchParams as $key => $value) {
        $countsStmt->bindValue($key, $value, PDO::PARAM_STR);
    }
    $countsStmt->execute();
    foreach ($countsStmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $statusKey = strtolower((string) ($row['status'] ?? ''));
        $total = (int) ($row['total'] ?? 0);
        if (isset($counts[$statusKey])) {
            $counts[$statusKey] = $total;
        }
        $counts['all'] += $total;
    }

    $dataSql = "
        SELECT
            c.CustomerID AS customer_id,
            c.RefCustomerID AS ref_customer_id,
            c.CustomerName AS customer_name,
            c.OrgName AS organization,
            c.Email AS email,
            c.Phone AS phone,
            c.TaxID AS tax_id,
            c.ContactPerson AS contact_person,
            c.Status AS status,
            c.Notes AS notes,
            c.LocationID AS location_id,
            l.LocationName AS location_name
        FROM customers c
        LEFT JOIN locations l ON l.LocationID = c.LocationID
        $whereSql
        ORDER BY $orderSql
        LIMIT :limit OFFSET :offset
    ";

    $stmt = $db->prepare($dataSql);
    foreach ($dataParams as $key => $value) {
        $stmt->bindValue($key, $value, PDO::PARAM_STR);
    }
    $stmt->bindValue(':limit', CUSTOMERS_PER_PAGE + 1, PDO::PARAM_INT);
    $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
    $stmt->execute();

    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $hasNext = false;
    if (count($rows) > CUSTOMERS_PER_PAGE) {
        $hasNext = true;
        $rows = array_slice($rows, 0, CUSTOMERS_PER_PAGE);
    }

    echo json_encode([
        'data' => $rows,
        'page' => $page,
        'per_page' => CUSTOMERS_PER_PAGE,
        'has_next' => $hasNext,
        'has_prev' => $page > 1,
        'counts' => $counts,
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'server']);
}