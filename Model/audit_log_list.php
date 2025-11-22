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

$entityType = isset($_GET['entity_type']) ? trim((string) $_GET['entity_type']) : '';
$entityId = isset($_GET['entity_id']) ? (int) $_GET['entity_id'] : 0;

$allowedTypes = [
    'staff', 'location', 'customer', 'supplier', 'warehouse',
    'item', 'item_unit', 'item_category', 'event',
    'request', 'rfq', 'quotation', 'po', 'deliveryin', 'deliveryout', 'receipt', 'otherdocs', 'announcement',
];

if ($entityType === '' || !in_array($entityType, $allowedTypes, true)) {
    http_response_code(400);
    echo json_encode(['error' => 'invalid_entity_type', 'message' => 'ประเภทข้อมูลไม่ถูกต้อง']);
    exit;
}

if ($entityId <= 0) {
    http_response_code(400);
    echo json_encode(['error' => 'invalid_entity_id', 'message' => 'รหัสข้อมูลไม่ถูกต้อง']);
    exit;
}

try {
    $db = DatabaseConnector::getConnection();
    $logs = fetchAuditLogsForEntity($db, $entityType, $entityId);

    $entityLabel = '';
    if ($entityType === 'request') {
        $stmt = $db->prepare('SELECT RequestName FROM requests WHERE RequestID = :id LIMIT 1');
        $stmt->bindValue(':id', $entityId, PDO::PARAM_INT);
        $stmt->execute();
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($row && isset($row['RequestName'])) {
            $entityLabel = (string) $row['RequestName'];
        }
    }

    echo json_encode([
        'data' => [
            'entity_type' => $entityType,
            'entity_id' => $entityId,
            'entity_label' => $entityLabel,
            'logs' => array_map(
                function ($log) {
                    return [
                        'audit_id' => $log['audit_id'],
                        'action' => $log['action'],
                        'reason' => $log['reason'],
                        'action_at' => $log['action_at'],
                        'action_by_id' => $log['action_by_id'],
                        'action_by_label' => formatStaffLabel($log['action_by_id'], $log['action_by_name'], $log['action_by_role']),
                    ];
                },
                $logs
            ),
        ],
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'server_error', 'message' => 'ไม่สามารถโหลดประวัติการดำเนินการได้']);
}

function formatStaffLabel($id, $name, $role)
{
    if ($id === null) {
        return '';
    }
    $displayName = $name !== null && $name !== '' ? $name : 'ไม่ทราบชื่อผู้รับผิดชอบ';
    $roleInitial = $role !== null && $role !== '' ? mb_strtoupper(mb_substr($role, 0, 1, 'UTF-8'), 'UTF-8') : 'S';
    return sprintf('%s%d - %s', $roleInitial, $id, $displayName);
}
?>