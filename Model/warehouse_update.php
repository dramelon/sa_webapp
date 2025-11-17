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

$warehouseId = isset($input['warehouse_id']) ? (int) $input['warehouse_id'] : 0;
if ($warehouseId <= 0) {
    http_response_code(400);
    echo json_encode(['error' => 'invalid_id']);
    exit;
}

$warehouseName = trim((string) ($input['warehouse_name'] ?? ''));
if ($warehouseName === '') {
    http_response_code(400);
    echo json_encode(['error' => 'missing_name']);
    exit;
}

$warehouseSn = trimNullable($input['warehouse_sn'] ?? null);
if ($warehouseSn !== null) {
    $warehouseSn = truncate($warehouseSn, 200);
}
$note = trimNullable($input['note'] ?? null);
if ($note !== null) {
    $note = truncate($note, 500);
}
$locationId = parseNullableInt($input['location_id'] ?? null);
$allowedStatuses = ['active', 'inactive'];
$status = strtolower((string) ($input['status'] ?? 'active'));
if (!in_array($status, $allowedStatuses, true)) {
    $status = 'active';
}
$staffId = (int) $_SESSION['staff_id'];

try {
    $db = DatabaseConnector::getConnection();

    if ($locationId !== null) {
        $checkLocation = $db->prepare('SELECT LocationID FROM locations WHERE LocationID = :id LIMIT 1');
        $checkLocation->bindValue(':id', $locationId, PDO::PARAM_INT);
        $checkLocation->execute();
        if (!$checkLocation->fetch(PDO::FETCH_ASSOC)) {
            $locationId = null;
        }
    }

    $sql = "
        UPDATE warehouse SET
            LocationID = :location_id,
            WarehouseName = :name,
            WarehouseSN = :sn,
            Note = :note,
            Status = :status,
            UpdatedBy = :updated_by
        WHERE WarehouseID = :id
        LIMIT 1
    ";
    $stmt = $db->prepare($sql);
    bindNullableInt($stmt, ':location_id', $locationId);
    $stmt->bindValue(':name', truncate($warehouseName, 200), PDO::PARAM_STR);
    bindNullableString($stmt, ':sn', $warehouseSn);
    bindNullableString($stmt, ':note', $note);
    $stmt->bindValue(':status', $status, PDO::PARAM_STR);
    $stmt->bindValue(':updated_by', $staffId, PDO::PARAM_INT);
    $stmt->bindValue(':id', $warehouseId, PDO::PARAM_INT);
    $stmt->execute();

    $detail = fetchWarehouseDetail($db, $warehouseId);
    echo json_encode(['success' => true, 'data' => $detail], JSON_UNESCAPED_UNICODE);
} catch (PDOException $e) {
    if ((int) $e->getCode() === 23000) {
        http_response_code(409);
        echo json_encode(['error' => 'warehouse_sn_exists']);
        return;
    }
    http_response_code(500);
    echo json_encode(['error' => 'server']);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'server']);
}

function fetchWarehouseDetail(PDO $db, int $warehouseId): array
{
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
    $row = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];

    return [
        'warehouse_id' => $warehouseId,
        'warehouse_name' => $row['warehouse_name'] ?? null,
        'warehouse_sn' => $row['warehouse_sn'] ?? null,
        'status' => $row['status'] ?? null,
        'note' => $row['note'] ?? null,
        'location_id' => isset($row['location_id']) ? (int) $row['location_id'] : null,
        'location_name' => $row['location_name'] ?? null,
        'location_label' => formatLocationLabel($row['location_id'] ?? null, $row['location_name'] ?? ''),
        'created_at' => $row['created_at'] ?? null,
        'updated_at' => $row['updated_at'] ?? null,
        'created_by_id' => isset($row['created_by_id']) ? (int) $row['created_by_id'] : null,
        'updated_by_id' => isset($row['updated_by_id']) ? (int) $row['updated_by_id'] : null,
        'created_by_label' => formatStaffLabel($row['created_by_id'] ?? null, $row['created_by_name'] ?? null, $row['created_by_role'] ?? null),
        'updated_by_label' => formatStaffLabel($row['updated_by_id'] ?? null, $row['updated_by_name'] ?? null, $row['updated_by_role'] ?? null),
    ];
}

function trimNullable($value)
{
    if ($value === null) {
        return null;
    }
    $text = trim((string) $value);
    return $text === '' ? null : $text;
}

function parseNullableInt($value)
{
    if ($value === null || $value === '') {
        return null;
    }
    if (is_numeric($value)) {
        $int = (int) $value;
        return $int > 0 ? $int : null;
    }
    return null;
}

function truncate($value, $length)
{
    if ($value === null) {
        return null;
    }
    if (mb_strlen($value, 'UTF-8') > $length) {
        return mb_substr($value, 0, $length, 'UTF-8');
    }
    return $value;
}

function bindNullableString(PDOStatement $stmt, string $param, $value): void
{
    if ($value === null) {
        $stmt->bindValue($param, null, PDO::PARAM_NULL);
    } else {
        $stmt->bindValue($param, $value, PDO::PARAM_STR);
    }
}

function bindNullableInt(PDOStatement $stmt, string $param, $value): void
{
    if ($value === null) {
        $stmt->bindValue($param, null, PDO::PARAM_NULL);
    } else {
        $stmt->bindValue($param, (int) $value, PDO::PARAM_INT);
    }
}

function formatLocationLabel($id, $name)
{
    if ($id === null) {
        return '';
    }
    $labelName = $name !== null && $name !== '' ? $name : 'ไม่ระบุสถานที่';
    return sprintf('%d - %s', $id, $labelName);
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