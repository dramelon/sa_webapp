<?php
require_once __DIR__ . '/database_connector.php';

session_start();
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'method_not_allowed']);
    exit;
}

if (empty($_SESSION['staff_id'])) {
    http_response_code(401);
    echo json_encode(['error' => 'unauthorized']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) {
    http_response_code(400);
    echo json_encode(['error' => 'invalid_payload']);
    exit;
}

$itemId = parseNullableInt($input['item_id'] ?? null);
if ($itemId === null || $itemId <= 0) {
    http_response_code(400);
    echo json_encode(['error' => 'missing_item']);
    exit;
}

$allowedStatuses = ['useable', 'in use', 'pending booking', 'booked', 'damaged', 'reparing', 'delivering', 'returned', 'depreciated'];
$status = $input['status'] ?? 'useable';
if (!in_array($status, $allowedStatuses, true)) {
    $status = 'useable';
}

$allowedOwnership = ['company', 'rented'];
$ownership = $input['ownership'] ?? 'company';
if (!in_array($ownership, $allowedOwnership, true)) {
    $ownership = 'company';
}

$warehouseId = parseNullableInt($input['warehouse_id'] ?? null);
$supplierId = parseNullableInt($input['supplier_id'] ?? null);
$serialNumber = trimNullable($input['serial_number'] ?? null);
$conditionIn = normalizeCondition($input['condition_in'] ?? 'good');
$conditionOut = normalizeCondition($input['condition_out'] ?? 'good');
$expectedReturn = parseNullableDateTime($input['expected_return_at'] ?? null);
$returnAt = parseNullableDateTime($input['return_at'] ?? null);

$staffId = (int) $_SESSION['staff_id'];

try {
    $db = DatabaseConnector::getConnection();

    $checkItem = $db->prepare('SELECT ItemID FROM items WHERE ItemID = :id LIMIT 1');
    $checkItem->bindValue(':id', $itemId, PDO::PARAM_INT);
    $checkItem->execute();
    if (!$checkItem->fetch(PDO::FETCH_ASSOC)) {
        http_response_code(404);
        echo json_encode(['error' => 'item_not_found']);
        exit;
    }

    $sql = "
        INSERT INTO item_unit (
            ItemID,
            WarehouseID,
            SupplierID,
            SerialNumber,
            OwnerShip,
            ConditionIn,
            ConditionOut,
            ExpectedReturnAt,
            ReturnAt,
            Status,
            CreatedBy,
            UpdatedBy
        ) VALUES (
            :item_id,
            :warehouse_id,
            :supplier_id,
            :serial_number,
            :ownership,
            :condition_in,
            :condition_out,
            :expected_return,
            :return_at,
            :status,
            :created_by,
            :updated_by
        )
    ";

    $stmt = $db->prepare($sql);
    $stmt->bindValue(':item_id', $itemId, PDO::PARAM_INT);
    bindNullableInt($stmt, ':warehouse_id', $warehouseId);
    bindNullableInt($stmt, ':supplier_id', $supplierId);
    bindNullableString($stmt, ':serial_number', $serialNumber);
    $stmt->bindValue(':ownership', $ownership, PDO::PARAM_STR);
    $stmt->bindValue(':condition_in', $conditionIn, PDO::PARAM_STR);
    $stmt->bindValue(':condition_out', $conditionOut, PDO::PARAM_STR);
    bindNullableDate($stmt, ':expected_return', $expectedReturn);
    bindNullableDate($stmt, ':return_at', $returnAt);
    $stmt->bindValue(':status', $status, PDO::PARAM_STR);
    bindNullableInt($stmt, ':created_by', $staffId ?: null);
    bindNullableInt($stmt, ':updated_by', $staffId ?: null);
    $stmt->execute();

    $itemUnitId = (int) $db->lastInsertId();
    $detail = fetchItemUnitDetail($db, $itemUnitId);
    echo json_encode(['success' => true, 'data' => $detail], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'server']);
}

function trimNullable($value): ?string
{
    if ($value === null) {
        return null;
    }
    $text = trim((string) $value);
    return $text === '' ? null : $text;
}

function parseNullableInt($value): ?int
{
    if ($value === null || $value === '') {
        return null;
    }
    if (ctype_digit((string) $value)) {
        return (int) $value;
    }
    return null;
}

function normalizeCondition($value): string
{
    return $value === 'damaged' ? 'damaged' : 'good';
}

function parseNullableDateTime($value): ?string
{
    if ($value === null || $value === '') {
        return null;
    }
    $time = strtotime((string) $value);
    if ($time === false) {
        return null;
    }
    return date('Y-m-d H:i:s', $time);
}

function bindNullableInt(PDOStatement $stmt, string $param, ?int $value): void
{
    if ($value === null) {
        $stmt->bindValue($param, null, PDO::PARAM_NULL);
    } else {
        $stmt->bindValue($param, $value, PDO::PARAM_INT);
    }
}

function bindNullableString(PDOStatement $stmt, string $param, ?string $value): void
{
    if ($value === null) {
        $stmt->bindValue($param, null, PDO::PARAM_NULL);
    } else {
        $stmt->bindValue($param, $value, PDO::PARAM_STR);
    }
}

function bindNullableDate(PDOStatement $stmt, string $param, ?string $value): void
{
    if ($value === null) {
        $stmt->bindValue($param, null, PDO::PARAM_NULL);
    } else {
        $stmt->bindValue($param, $value, PDO::PARAM_STR);
    }
}

function fetchItemUnitDetail(PDO $db, int $itemUnitId): array
{
    $sql = "
        SELECT
            iu.ItemUnitID AS item_unit_id,
            iu.ItemID AS item_id,
            i.ItemName AS item_name,
            i.ItemType AS item_type,
            iu.WarehouseID AS warehouse_id,
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
        LEFT JOIN staffs cb ON cb.StaffID = iu.CreatedBy
        LEFT JOIN staffs ub ON ub.StaffID = iu.UpdatedBy
        WHERE iu.ItemUnitID = :id
        LIMIT 1
    ";
    $stmt = $db->prepare($sql);
    $stmt->bindValue(':id', $itemUnitId, PDO::PARAM_INT);
    $stmt->execute();
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return $row ?: [];
}