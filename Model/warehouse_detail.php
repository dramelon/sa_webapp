<?php
require_once __DIR__ . '/database_connector.php';
require_once __DIR__ . '/audit_log.php';

session_start();
header('Content-Type: application/json; charset=utf-8');

$warehouseId = isset($_GET['id']) ? (int) $_GET['id'] : 0;
if ($warehouseId <= 0) {
    http_response_code(400);
    echo json_encode(['error' => 'invalid_id']);
    exit;
}

try {
    $db = DatabaseConnector::getConnection();

    $sql = "
        SELECT
            w.WarehouseID AS warehouse_id,
            w.WarehouseName AS warehouse_name,
            w.WarehouseSN AS warehouse_sn,
            w.Status AS status,
            w.Note AS note,
            w.LocationID AS location_id,
            l.LocationName AS location_name,
            l.RefLocationID AS ref_location_id,
            l.Email AS location_email,
            l.Phone AS location_phone,
            l.Country AS location_country
        FROM warehouse w
        LEFT JOIN locations l ON l.LocationID = w.LocationID
        WHERE w.WarehouseID = :id
        LIMIT 1
    ";
    $stmt = $db->prepare($sql);
    $stmt->bindValue(':id', $warehouseId, PDO::PARAM_INT);
    $stmt->execute();
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$row) {
        http_response_code(404);
        echo json_encode(['error' => 'not_found']);
        exit;
    }

    $audit = fetchAuditMetadataForEntity($db, 'warehouse', $warehouseId);

    $payload = [
        'warehouse_id' => (int) $row['warehouse_id'],
        'warehouse_name' => $row['warehouse_name'],
        'warehouse_sn' => $row['warehouse_sn'],
        'status' => $row['status'],
        'note' => $row['note'],
        'location_id' => $row['location_id'] !== null ? (int) $row['location_id'] : null,
        'location_name' => $row['location_name'],
        'location_label' => formatLocationLabel($row['location_id'] ?? null, $row['location_name'] ?? ''),
        'location_ref' => $row['ref_location_id'],
        'location_email' => $row['location_email'],
        'location_phone' => $row['location_phone'],
        'location_country' => $row['location_country'],
        'created_at' => $audit['created_at'],
        'updated_at' => $audit['updated_at'],
        'created_by_id' => $audit['created_by_id'],
        'updated_by_id' => $audit['updated_by_id'],
        'created_by_label' => formatStaffLabel($audit['created_by_id'], $audit['created_by_name'], $audit['created_by_role']),
        'updated_by_label' => formatStaffLabel($audit['updated_by_id'], $audit['updated_by_name'], $audit['updated_by_role']),
    ];

    echo json_encode(['data' => $payload], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'server']);
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

function formatLocationLabel($id, $name)
{
    if ($id === null) {
        return '';
    }
    $labelName = $name !== null && $name !== '' ? $name : 'ไม่ระบุสถานที่';
    return sprintf('%d - %s', $id, $labelName);
}