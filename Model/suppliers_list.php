<?php
require_once __DIR__ . '/database_connector.php';
require_once __DIR__ . '/audit_log.php';

session_start();
header('Content-Type: application/json; charset=utf-8');

const SUPPLIERS_PER_PAGE = 20;

try {
    $db = DatabaseConnector::getConnection();

    $page = isset($_GET['page']) ? (int) $_GET['page'] : 1;
    if ($page < 1) {
        $page = 1;
    }
    $offset = ($page - 1) * SUPPLIERS_PER_PAGE;

    $allowedSorts = [
        'supplier_id' => 's.SupplierID',
        'ref_supplier_id' => 's.RefSupplierID',
        'supplier_name' => 's.SupplierName',
        'org_name' => 's.OrgName',
        'contact_person' => 's.ContactPerson',
        'contact_meta' => "COALESCE(NULLIF(TRIM(s.Email), ''), NULLIF(TRIM(s.Phone), ''))",
        'email' => 's.Email',
        'phone' => 's.Phone',
        'status' => 's.Status',
        'location_name' => 'l.LocationName',
        'created_at' => 's.CreatedAt',
    ];

    $sortKey = $_GET['sort_key'] ?? 'supplier_id';
    if (!isset($allowedSorts[$sortKey])) {
        $sortKey = 'supplier_id';
    }

    $sortDirection = strtolower($_GET['sort_direction'] ?? 'desc');
    if (!in_array($sortDirection, ['asc', 'desc'], true)) {
        $sortDirection = 'desc';
    }

    $orderParts = [];
    $orderParts[] = $allowedSorts[$sortKey] . ' ' . strtoupper($sortDirection);
    if ($sortKey !== 'supplier_id') {
        $orderParts[] = 's.SupplierID DESC';
    }
    $orderSql = implode(', ', $orderParts);

    $allowedStatuses = ['active', 'inactive'];
    $status = $_GET['status'] ?? 'all';
    if ($status !== 'all' && !in_array($status, $allowedStatuses, true)) {
        $status = 'all';
    }

    $search = trim($_GET['search'] ?? '');

    $whereClauses = [];
    $params = [];

    if ($search !== '') {
        $whereClauses[] = '(
            s.SupplierID LIKE :search
            OR s.RefSupplierID LIKE :search
            OR s.SupplierName LIKE :search
            OR s.OrgName LIKE :search
            OR s.ContactPerson LIKE :search
            OR s.Email LIKE :search
            OR s.Phone LIKE :search
            OR s.TaxID LIKE :search
        )';
        $params[':search'] = '%' . $search . '%';
    }

    $whereSql = $whereClauses ? 'WHERE ' . implode(' AND ', $whereClauses) : '';

    $countsSql = "
        SELECT s.Status AS status, COUNT(*) AS total
        FROM suppliers s
        LEFT JOIN locations l ON l.LocationID = s.LocationID
        $whereSql
        GROUP BY s.Status
    ";
    $countsStmt = $db->prepare($countsSql);
    foreach ($params as $key => $value) {
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

    $dataClauses = $whereClauses;
    $dataParams = $params;
    if ($status !== 'all') {
        $dataClauses[] = 's.Status = :status';
        $dataParams[':status'] = $status;
    }
    $dataWhereSql = $dataClauses ? 'WHERE ' . implode(' AND ', $dataClauses) : '';

    $dataSql = "
        SELECT
            s.SupplierID AS supplier_id,
            s.RefSupplierID AS ref_supplier_id,
            s.SupplierName AS supplier_name,
            s.OrgName AS org_name,
            s.ContactPerson AS contact_person,
            s.Email AS email,
            s.Phone AS phone,
            s.Status AS status,
            l.LocationName AS location_name
        FROM suppliers s
        LEFT JOIN locations l ON l.LocationID = s.LocationID
        $dataWhereSql
        ORDER BY $orderSql
        LIMIT :limit OFFSET :offset
    ";

    $stmt = $db->prepare($dataSql);
    foreach ($dataParams as $key => $value) {
        $stmt->bindValue($key, $value, PDO::PARAM_STR);
    }
    $stmt->bindValue(':limit', SUPPLIERS_PER_PAGE + 1, PDO::PARAM_INT);
    $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
    $stmt->execute();

    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $hasNext = false;
    if (count($rows) > SUPPLIERS_PER_PAGE) {
        $hasNext = true;
        $rows = array_slice($rows, 0, SUPPLIERS_PER_PAGE);
    }

    $metadata = fetchAuditMetadataForEntities($db, 'supplier', array_column($rows, 'supplier_id'));
    foreach ($rows as &$row) {
        $audit = $metadata[$row['supplier_id']] ?? buildEmptyAuditMetadata();
        $row['created_at'] = $audit['created_at'];
        $row['updated_at'] = $audit['updated_at'];
    }
    unset($row);

    echo json_encode([
        'data' => $rows,
        'page' => $page,
        'per_page' => SUPPLIERS_PER_PAGE,
        'has_next' => $hasNext,
        'has_prev' => $page > 1,
        'counts' => $counts,
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'server']);
}