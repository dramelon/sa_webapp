<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

$itemUnitId = isset($_GET['id']) ? (int) $_GET['id'] : 0;
if ($itemUnitId <= 0) {
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
            iu.Status AS status,
            iu.CreatedAt AS created_at,
            iu.CreatedBy AS created_by,
            iu.UpdatedAt AS updated_at,
            iu.UpdatedBy AS updated_by,
            cb.FullName AS created_by_name,
            ub.FullName AS updated_by_name
        FROM item_unit iu
        LEFT JOIN items i ON i.ItemID = iu.ItemID
        LEFT JOIN warehouse w ON w.WarehouseID = iu.WarehouseID
        LEFT JOIN staffs cb ON cb.StaffID = iu.CreatedBy
        LEFT JOIN staffs ub ON ub.StaffID = iu.UpdatedBy
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

    echo json_encode($row, JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'server']);
}