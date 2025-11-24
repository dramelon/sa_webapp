<?php
require_once __DIR__ . '/database_connector.php';
require_once __DIR__ . '/audit_log.php';

session_start();
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'method_not_allowed']);
    exit;
}

$allowedTypes = [
    'staff', 'location', 'customer', 'supplier', 'warehouse',
    'item', 'item_unit', 'item_category', 'event',
    'request', 'rfq', 'quotation', 'po', 'deliveryin', 'deliveryout', 'receipt', 'otherdocs', 'announcement',
];

$entityType = isset($_GET['entity_type']) ? trim((string) $_GET['entity_type']) : '';
$entityId = isset($_GET['entity_id']) ? (int) $_GET['entity_id'] : 0;
$actionFilterRaw = isset($_GET['action']) ? trim((string) $_GET['action']) : '';
$actionByRaw = isset($_GET['action_by']) ? trim((string) $_GET['action_by']) : '';
$page = isset($_GET['page']) ? (int) $_GET['page'] : 1;
$pageSize = isset($_GET['page_size']) ? (int) $_GET['page_size'] : 100;

$page = $page > 0 ? $page : 1;
$pageSize = $pageSize > 0 ? min($pageSize, 100) : 100;

$isEntityMode = $entityId > 0;

if ($isEntityMode) {
    if ($entityType === '' || !in_array($entityType, $allowedTypes, true)) {
        http_response_code(400);
        echo json_encode(['error' => 'invalid_entity_type', 'message' => 'ประเภทข้อมูลไม่ถูกต้อง']);
        exit;
    }
}

function normalizeActions(string $raw): array
{
    $allowedActions = ['CREATE', 'UPDATE', 'ARCHIVE', 'UNARCHIVED', 'DELETE'];
    $parts = array_map('trim', explode(',', strtoupper($raw)));
    $parts = array_filter($parts, function ($value) use ($allowedActions) {
        return $value !== '' && in_array($value, $allowedActions, true);
    });
    return array_values(array_unique($parts));
}

function normalizeEntityTypes(string $raw, array $allowedTypes): array
{
    $parts = array_map('trim', explode(',', $raw));
    $parts = array_filter($parts, function ($value) use ($allowedTypes) {
        return $value !== '' && in_array($value, $allowedTypes, true);
    });
    return array_values(array_unique($parts));
}

function normalizeActionBy(string $raw): array
{
    $parts = array_map('trim', explode(',', $raw));
    $ids = [];
    foreach ($parts as $part) {
        if ($part === '') {
            continue;
        }
        $value = (int) $part;
        if ($value > 0) {
            $ids[] = $value;
        }
    }
    return array_values(array_unique($ids));
}

function buildPlaceholders(string $prefix, int $count): array
{
    $placeholders = [];
    for ($i = 0; $i < $count; $i++) {
        $placeholders[] = ':' . $prefix . $i;
    }
    return $placeholders;
}

function fetchLabels(PDO $db, string $table, string $idColumn, string $labelColumn, array $ids): array
{
    if (empty($ids)) {
        return [];
    }
    $placeholders = buildPlaceholders('id', count($ids));
    $sql = sprintf('SELECT %s AS id, %s AS label FROM %s WHERE %s IN (%s)', $idColumn, $labelColumn, $table, $idColumn, implode(', ', $placeholders));
    $stmt = $db->prepare($sql);
    foreach ($ids as $idx => $id) {
        $stmt->bindValue($placeholders[$idx], $id, PDO::PARAM_INT);
    }
    $stmt->execute();
    $labels = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $labels[(int) $row['id']] = $row['label'] ?? '';
    }
    return $labels;
}

function buildEntityLabels(PDO $db, array $logs): array
{
    $entities = [];
    foreach ($logs as $log) {
        $type = $log['entity_type'] ?? '';
        $id = isset($log['entity_id']) ? (int) $log['entity_id'] : null;
        if ($type === '' || $id === null) {
            continue;
        }
        if (!isset($entities[$type])) {
            $entities[$type] = [];
        }
        $entities[$type][] = $id;
    }

    $labels = [];
    foreach ($entities as $type => $ids) {
        $uniqueIds = array_values(array_unique($ids));
        switch ($type) {
            case 'request':
                $labels[$type] = fetchLabels($db, 'requests', 'RequestID', 'RequestName', $uniqueIds);
                break;
            case 'event':
                $labels[$type] = fetchLabels($db, 'events', 'EventID', 'EventName', $uniqueIds);
                break;
            case 'item':
                $labels[$type] = fetchLabels($db, 'items', 'ItemID', 'ItemName', $uniqueIds);
                break;
            case 'item_category':
                $labels[$type] = fetchLabels($db, 'itemcategorys', 'ItemCategoryID', 'Name', $uniqueIds);
                break;
            case 'item_unit':
                $labels[$type] = fetchLabels($db, 'itemunits', 'ItemUnitID', 'UnitName', $uniqueIds);
                break;
            case 'supplier':
                $labels[$type] = fetchLabels($db, 'suppliers', 'SupplierID', 'SupplierName', $uniqueIds);
                break;
            case 'customer':
                $labels[$type] = fetchLabels($db, 'customers', 'CustomerID', 'CustomerName', $uniqueIds);
                break;
            case 'warehouse':
                $labels[$type] = fetchLabels($db, 'warehouses', 'WarehouseID', 'WarehouseName', $uniqueIds);
                break;
            case 'location':
                $labels[$type] = fetchLabels($db, 'locations', 'LocationID', 'LocationName', $uniqueIds);
                break;
            case 'staff':
                $labels[$type] = fetchLabels($db, 'staffs', 'StaffID', 'FullName', $uniqueIds);
                break;
            case 'announcement':
                $labels[$type] = fetchLabels($db, 'announcements', 'AnnouncementID', 'Title', $uniqueIds);
                break;
            default:
                $labels[$type] = [];
        }
    }

    return $labels;
}

$actions = normalizeActions($actionFilterRaw);
$actionByFilter = normalizeActionBy($actionByRaw);
$entityTypes = $isEntityMode ? [$entityType] : normalizeEntityTypes($entityType, $allowedTypes);

try {
    $db = DatabaseConnector::getConnection();

    $where = [];
    $bindings = [];

    if (!empty($entityTypes)) {
        $placeholders = buildPlaceholders('etype', count($entityTypes));
        $where[] = 'a.EntityType IN (' . implode(', ', $placeholders) . ')';
        foreach ($entityTypes as $idx => $type) {
            $bindings[$placeholders[$idx]] = [$type, PDO::PARAM_STR];
        }
    }

    if ($isEntityMode) {
        $where[] = 'a.EntityID = :entity_id';
        $bindings[':entity_id'] = [$entityId, PDO::PARAM_INT];
    }

    if (!empty($actions)) {
        $placeholders = buildPlaceholders('act', count($actions));
        $where[] = 'a.Action IN (' . implode(', ', $placeholders) . ')';
        foreach ($actions as $idx => $action) {
            $bindings[$placeholders[$idx]] = [$action, PDO::PARAM_STR];
        }
    }

    if (!empty($actionByFilter)) {
        $placeholders = buildPlaceholders('staff', count($actionByFilter));
        $where[] = 'a.ActionBy IN (' . implode(', ', $placeholders) . ')';
        foreach ($actionByFilter as $idx => $staffId) {
            $bindings[$placeholders[$idx]] = [$staffId, PDO::PARAM_INT];
        }
    }

    $whereClause = empty($where) ? '' : 'WHERE ' . implode(' AND ', $where);

    $countSql = 'SELECT COUNT(*) AS total FROM audit a ' . $whereClause;
    $countStmt = $db->prepare($countSql);
    foreach ($bindings as $placeholder => [$value, $type]) {
        $countStmt->bindValue($placeholder, $value, $type);
    }
    $countStmt->execute();
    $total = (int) $countStmt->fetchColumn();

    $sql = 'SELECT a.AuditID, a.EntityType, a.EntityID, a.Action, a.Reason, a.ActionAt, a.ActionBy, s.FullName AS staff_name, s.Role AS staff_role'
        . ' FROM audit a LEFT JOIN staffs s ON s.StaffID = a.ActionBy '
        . $whereClause
        . ' ORDER BY a.ActionAt DESC, a.AuditID DESC'
        . ' LIMIT :limit OFFSET :offset';

    $stmt = $db->prepare($sql);
    foreach ($bindings as $placeholder => [$value, $type]) {
        $stmt->bindValue($placeholder, $value, $type);
    }
    $stmt->bindValue(':limit', $pageSize, PDO::PARAM_INT);
    $stmt->bindValue(':offset', ($page - 1) * $pageSize, PDO::PARAM_INT);
    $stmt->execute();

    $logs = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $logs[] = [
            'audit_id' => (int) $row['AuditID'],
            'entity_type' => $row['EntityType'],
            'entity_id' => (int) $row['EntityID'],
            'action' => strtoupper((string) ($row['Action'] ?? '')),
            'reason' => $row['Reason'],
            'action_at' => $row['ActionAt'],
            'action_by_id' => $row['ActionBy'] !== null ? (int) $row['ActionBy'] : null,
            'action_by_name' => $row['staff_name'] ?? null,
            'action_by_role' => $row['staff_role'] ?? null,
        ];
    }

    $labels = buildEntityLabels($db, $logs);

    foreach ($logs as &$log) {
        $type = $log['entity_type'];
        $id = $log['entity_id'];
        $log['entity_label'] = $labels[$type][$id] ?? '';
        $log['action_by_label'] = formatStaffLabel($log['action_by_id'], $log['action_by_name'], $log['action_by_role']);
    }
    unset($log);

    $response = [
        'data' => [
            'logs' => $logs,
            'page' => $page,
            'page_size' => $pageSize,
            'total' => $total,
        ],
    ];

    if ($isEntityMode) {
        $entityLabel = '';
        if ($entityType === 'request') {
            $entityLabelQuery = $db->prepare('SELECT RequestName FROM requests WHERE RequestID = :id LIMIT 1');
            $entityLabelQuery->bindValue(':id', $entityId, PDO::PARAM_INT);
            $entityLabelQuery->execute();
            $row = $entityLabelQuery->fetch(PDO::FETCH_ASSOC);
            if ($row && isset($row['RequestName'])) {
                $entityLabel = (string) $row['RequestName'];
            }
        }
        $response['data']['entity_type'] = $entityType;
        $response['data']['entity_id'] = $entityId;
        $response['data']['entity_label'] = $entityLabel;
    }

    echo json_encode($response, JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'server_error', 'message' => 'ไม่สามารถโหลดประวัติการดำเนินการได้']);
}
?>
