<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

const LOCATIONS_PER_PAGE = 20;

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
    $offset = ($page - 1) * LOCATIONS_PER_PAGE;

    $search = trim((string) ($_GET['search'] ?? ''));
    $status = strtolower((string) ($_GET['status'] ?? 'all'));
    $allowedStatuses = ['all', 'active', 'inactive'];
    if (!in_array($status, $allowedStatuses, true)) {
        $status = 'all';
    }

    $allowedSorts = [
        'location_id' => 'l.LocationID',
        'location_name' => 'l.LocationName',
        'district' => 'l.District',
        'province' => 'l.Province',
        'country' => 'l.Country',
        'status' => 'l.Status',
    ];
    $sortKey = $_GET['sort_key'] ?? 'location_name';
    if (!isset($allowedSorts[$sortKey])) {
        $sortKey = 'location_name';
    }
    $sortDirection = strtolower((string) ($_GET['sort_direction'] ?? 'asc'));
    if (!in_array($sortDirection, ['asc', 'desc'], true)) {
        $sortDirection = 'asc';
    }
    $orderSql = $allowedSorts[$sortKey] . ' ' . strtoupper($sortDirection);
    if ($sortKey !== 'location_id') {
        $orderSql .= ', l.LocationID ASC';
    }

    $searchClauses = [];
    $searchParams = [];

    if ($search !== '') {
        $searchClauses[] = '(
            l.LocationName LIKE :search
            OR l.District LIKE :search
            OR l.Province LIKE :search
            OR l.Country LIKE :search
            OR l.Subdistrict LIKE :search
            OR l.RefLocationID LIKE :search
            OR l.Email LIKE :search
            OR l.Phone LIKE :search
            OR CAST(l.LocationID AS CHAR) LIKE :search
        )';
        $searchParams[':search'] = '%' . $search . '%';
    }

    $dataClauses = $searchClauses;
    $dataParams = $searchParams;

    if ($status !== 'all') {
        $dataClauses[] = 'l.Status = :status';
        $dataParams[':status'] = $status;
    }

    $whereSql = $dataClauses ? 'WHERE ' . implode(' AND ', $dataClauses) : '';
    $countWhereSql = $searchClauses ? 'WHERE ' . implode(' AND ', $searchClauses) : '';

    $counts = ['all' => 0, 'active' => 0, 'inactive' => 0];

    $countSql = "SELECT l.Status AS status, COUNT(*) AS total FROM locations l $countWhereSql GROUP BY l.Status";
    $countStmt = $db->prepare($countSql);
    foreach ($searchParams as $key => $value) {
        $countStmt->bindValue($key, $value, PDO::PARAM_STR);
    }
    $countStmt->execute();
    foreach ($countStmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $statusKey = strtolower((string) ($row['status'] ?? ''));
        $total = (int) ($row['total'] ?? 0);
        if (isset($counts[$statusKey])) {
            $counts[$statusKey] = $total;
        }
        $counts['all'] += $total;
    }

    $dataSql = "
        SELECT
            l.LocationID AS location_id,
            l.RefLocationID AS ref_location_id,
            l.LocationName AS location_name,
            l.Email AS email,
            l.Phone AS phone,
            l.HouseNumber AS house_number,
            l.Village AS village,
            l.BuildingName AS building_name,
            l.Floor AS floor,
            l.Room AS room,
            l.Street AS street,
            l.Subdistrict AS subdistrict,
            l.District AS district,
            l.Province AS province,
            l.PostalCode AS postal_code,
            l.Country AS country,
            l.Note AS notes,
            l.Status AS status,
            l.CreatedAt AS created_at,
            l.UpdatedAt AS updated_at
        FROM locations l
        $whereSql
        ORDER BY $orderSql
        LIMIT :limit OFFSET :offset
    ";

    $stmt = $db->prepare($dataSql);
    foreach ($dataParams as $key => $value) {
        $stmt->bindValue($key, $value, PDO::PARAM_STR);
    }
    $stmt->bindValue(':limit', LOCATIONS_PER_PAGE + 1, PDO::PARAM_INT);
    $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
    $stmt->execute();

    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $hasNext = false;
    if (count($rows) > LOCATIONS_PER_PAGE) {
        $hasNext = true;
        $rows = array_slice($rows, 0, LOCATIONS_PER_PAGE);
    }

    echo json_encode([
        'data' => $rows,
        'page' => $page,
        'per_page' => LOCATIONS_PER_PAGE,
        'has_next' => $hasNext,
        'has_prev' => $page > 1,
        'counts' => $counts,
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'server']);
}