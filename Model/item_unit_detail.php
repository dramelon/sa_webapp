<?php
require_once __DIR__ . '/database_connector.php';
require_once __DIR__ . '/audit_log.php';

session_start();
header('Content-Type: application/json; charset=utf-8');

$itemUnitId = isset($_GET['id']) ? (int) $_GET['id'] : 0;
if ($itemUnitId <= 0) {
    http_response_code(400);
    echo json_encode(['error' => 'invalid_id']);
    exit;
}

try {
    $db = DatabaseConnector::getConnection();

    $sql = "
        SELECT
            iu.ItemUnitID AS item_unit_id,
            iu.ItemID AS item_id,
            i.ItemName AS item_name,
            i.ItemType AS item_type,
            iu.WarehouseID AS warehouse_id,
            w.WarehouseName AS warehouse_name,
            w.WarehouseSN AS warehouse_sn,
            w.Status AS warehouse_status,
            iu.SupplierID AS supplier_id,
            iu.SerialNumber AS serial_number,
            iu.OwnerShip AS ownership,
            iu.ConditionIn AS condition_in,
            iu.ConditionOut AS condition_out,
            iu.ExpectedReturnAt AS expected_return_at,
            iu.ReturnAt AS return_at,
            iu.Status AS status
        FROM item_units iu
        LEFT JOIN items i ON i.ItemID = iu.ItemID
        LEFT JOIN warehouse w ON w.WarehouseID = iu.WarehouseID
        WHERE iu.ItemUnitID = :id
        LIMIT 1
    ";

    $stmt = $db->prepare($sql);
    $stmt->bindValue(':id', $itemUnitId, PDO::PARAM_INT);
    $stmt->execute();

    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row) {
        http_response_code(404);
        echo json_encode(['error' => 'not_found']);
        exit;
    }

    $audit = fetchAuditMetadataForEntity($db, 'item_unit', $itemUnitId);

    $payload = array_merge($row, [
        'item_unit_id' => (int) $row['item_unit_id'],
        'item_id' => (int) $row['item_id'],
        'warehouse_id' => $row['warehouse_id'] ? (int) $row['warehouse_id'] : null,
        'supplier_id' => $row['supplier_id'] ? (int) $row['supplier_id'] : null,
        'created_at' => $audit['created_at'],
        'updated_at' => $audit['updated_at'],
        'created_by_id' => $audit['created_by_id'],
        'updated_by_id' => $audit['updated_by_id'],
        'created_by_name' => formatStaffLabel($audit['created_by_id'], $audit['created_by_name'], $audit['created_by_role']),
        'updated_by_name' => formatStaffLabel($audit['updated_by_id'], $audit['updated_by_name'], $audit['updated_by_role']),
    ]);

    echo json_encode($payload, flags: JSON_UNESCAPED_UNICODE);
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