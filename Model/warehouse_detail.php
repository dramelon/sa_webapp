<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

$warehouseId = isset($_GET['id']) ? (int) $_GET['id'] : 0;
if ($warehouseId <= 0) {
    http_response_code(400);
    echo json_encode(['error' => 'invalid_id']);
    exit;
}

try {
    $db = new PDO(
        'mysql:host=localhost;dbname=sa_webapp;charset=utf8mb4',
        'dramelon',
        'dramelon',
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );

    $sql = "
        SELECT
            w.WarehouseID AS warehouse_id,
            w.WarehouseName AS warehouse_name,
            w.WarehouseSN AS warehouse_sn,
            w.Status AS status,
            w.Note AS note,
            w.LocationID AS location_id,
            w.CreatedAt AS created_at,
            w.CreatedBy AS created_by_id,
            w.UpdatedAt AS updated_at,
            w.UpdatedBy AS updated_by_id,
            l.LocationName AS location_name,
            created.FullName AS created_by_name,
            created.Role AS created_by_role,
            updated.FullName AS updated_by_name,
            updated.Role AS updated_by_role
        FROM warehouse w
        LEFT JOIN locations l ON l.LocationID = w.LocationID
        LEFT JOIN staffs created ON created.StaffID = w.CreatedBy
        LEFT JOIN staffs updated ON updated.StaffID = w.UpdatedBy
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

    $payload = [
        'warehouse_id' => (int) $row['warehouse_id'],
        'warehouse_name' => $row['warehouse_name'],
        'warehouse_sn' => $row['warehouse_sn'],
        'status' => $row['status'],
        'note' => $row['note'],
        'location_id' => $row['location_id'] !== null ? (int) $row['location_id'] : null,
        'location_name' => $row['location_name'],
        'location_label' => formatLocationLabel($row['location_id'] ?? null, $row['location_name'] ?? ''),
        'created_at' => $row['created_at'],
        'updated_at' => $row['updated_at'],
        'created_by_id' => $row['created_by_id'] !== null ? (int) $row['created_by_id'] : null,
        'updated_by_id' => $row['updated_by_id'] !== null ? (int) $row['updated_by_id'] : null,
        'created_by_label' => formatStaffLabel($row['created_by_id'], $row['created_by_name'], $row['created_by_role']),
        'updated_by_label' => formatStaffLabel($row['updated_by_id'], $row['updated_by_name'], $row['updated_by_role']),
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