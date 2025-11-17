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

$locationName = trim((string) ($input['location_name'] ?? ''));
if ($locationName === '') {
    http_response_code(400);
    echo json_encode(['error' => 'missing_name']);
    exit;
}

$refLocationId = sanitizeRefId($input['ref_location_id'] ?? null);
$email = trimNullable($input['email'] ?? null);
$phone = trimNullable($input['phone'] ?? null);
$houseNumber = trimNullable($input['house_number'] ?? null);
$village = trimNullable($input['village'] ?? null);
$buildingName = trimNullable($input['building_name'] ?? null);
$floor = trimNullable($input['floor'] ?? null);
$room = trimNullable($input['room'] ?? null);
$street = trimNullable($input['street'] ?? null);
$subdistrict = trimNullable($input['subdistrict'] ?? null);
$district = trimNullable($input['district'] ?? null);
$province = trimNullable($input['province'] ?? null);
$postalCode = trimNullable($input['postal_code'] ?? null);
$country = trimNullable($input['country'] ?? null);
$notes = trimNullable($input['notes'] ?? null);

$allowedStatuses = ['active', 'inactive'];
$status = strtolower((string) ($input['status'] ?? 'active'));
if (!in_array($status, $allowedStatuses, true)) {
    $status = 'active';
}

$staffId = (int) $_SESSION['staff_id'];

try {
    $db = DatabaseConnector::getConnection();

    $sql = "
        INSERT INTO locations (
            RefLocationID,
            LocationName,
            Email,
            Phone,
            Village,
            HouseNumber,
            BuildingName,
            Room,
            Floor,
            Street,
            Subdistrict,
            District,
            Province,
            Country,
            PostalCode,
            Note,
            Status,
            CreatedBy,
            UpdatedBy
        ) VALUES (
            :ref_location_id,
            :location_name,
            :email,
            :phone,
            :village,
            :house_number,
            :building_name,
            :room,
            :floor,
            :street,
            :subdistrict,
            :district,
            :province,
            :country,
            :postal_code,
            :note,
            :status,
            :created_by,
            :updated_by
        )
    ";

    $stmt = $db->prepare($sql);
    bindNullableString($stmt, ':ref_location_id', $refLocationId);
    $stmt->bindValue(':location_name', $locationName, PDO::PARAM_STR);
    bindNullableString($stmt, ':email', $email);
    bindNullableString($stmt, ':phone', $phone);
    bindNullableString($stmt, ':village', $village);
    bindNullableString($stmt, ':house_number', $houseNumber);
    bindNullableString($stmt, ':building_name', $buildingName);
    bindNullableString($stmt, ':room', $room);
    bindNullableString($stmt, ':floor', $floor);
    bindNullableString($stmt, ':street', $street);
    bindNullableString($stmt, ':subdistrict', $subdistrict);
    bindNullableString($stmt, ':district', $district);
    bindNullableString($stmt, ':province', $province);
    bindNullableString($stmt, ':country', $country);
    bindNullableString($stmt, ':postal_code', $postalCode);
    bindNullableString($stmt, ':note', $notes);
    $stmt->bindValue(':status', $status, PDO::PARAM_STR);
    $stmt->bindValue(':created_by', $staffId, PDO::PARAM_INT);
    $stmt->bindValue(':updated_by', $staffId, PDO::PARAM_INT);
    $stmt->execute();

    $locationId = (int) $db->lastInsertId();

    $detail = fetchLocationDetail($db, $locationId);

    echo json_encode(['success' => true, 'data' => $detail], JSON_UNESCAPED_UNICODE);
} catch (PDOException $e) {
    if ((int) $e->getCode() === 23000) {
        http_response_code(409);
        echo json_encode(['error' => 'ref_location_exists']);
        return;
    }
    http_response_code(500);
    echo json_encode(['error' => 'server']);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'server']);
}

function fetchLocationDetail(PDO $db, int $locationId): array
{
    $sql = "
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
            l.Country AS country,
            l.PostalCode AS postal_code,
            l.Note AS note,
            l.Status AS status,
            l.CreatedAt AS created_at,
            l.UpdatedAt AS updated_at,
            l.CreatedBy AS created_by_id,
            l.UpdatedBy AS updated_by_id,
            created.FullName AS created_by_name,
            created.Role AS created_by_role,
            updated.FullName AS updated_by_name,
            updated.Role AS updated_by_role
        FROM locations l
        LEFT JOIN staffs created ON created.StaffID = l.CreatedBy
        LEFT JOIN staffs updated ON updated.StaffID = l.UpdatedBy
        WHERE l.LocationID = :id
        LIMIT 1
    ";

    $stmt = $db->prepare($sql);
    $stmt->bindValue(':id', $locationId, PDO::PARAM_INT);
    $stmt->execute();
    $row = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];

    return [
        'location_id' => $locationId,
        'ref_location_id' => $row['ref_location_id'] ?? null,
        'location_name' => $row['location_name'] ?? null,
        'email' => $row['email'] ?? null,
        'phone' => $row['phone'] ?? null,
        'house_number' => $row['house_number'] ?? null,
        'village' => $row['village'] ?? null,
        'building_name' => $row['building_name'] ?? null,
        'floor' => $row['floor'] ?? null,
        'room' => $row['room'] ?? null,
        'street' => $row['street'] ?? null,
        'subdistrict' => $row['subdistrict'] ?? null,
        'district' => $row['district'] ?? null,
        'province' => $row['province'] ?? null,
        'postal_code' => $row['postal_code'] ?? null,
        'country' => $row['country'] ?? null,
        'notes' => $row['note'] ?? null,
        'status' => $row['status'] ?? null,
        'created_at' => $row['created_at'] ?? null,
        'updated_at' => $row['updated_at'] ?? null,
        'created_by_id' => isset($row['created_by_id']) ? (int) $row['created_by_id'] : null,
        'updated_by_id' => isset($row['updated_by_id']) ? (int) $row['updated_by_id'] : null,
        'created_by_label' => formatStaffLabel($row['created_by_id'] ?? null, $row['created_by_name'] ?? null, $row['created_by_role'] ?? null),
        'updated_by_label' => formatStaffLabel($row['updated_by_id'] ?? null, $row['updated_by_name'] ?? null, $row['updated_by_role'] ?? null),
        'location_label' => formatLocationLabel($locationId, $row['location_name'] ?? ''),
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

function sanitizeRefId($value)
{
    $value = trimNullable($value);
    if ($value === null) {
        return null;
    }
    if (mb_strlen($value, 'UTF-8') > 30) {
        $value = mb_substr($value, 0, 30, 'UTF-8');
    }
    return $value;
}

function bindNullableString(PDOStatement $stmt, string $parameter, ?string $value): void
{
    if ($value === null) {
        $stmt->bindValue($parameter, null, PDO::PARAM_NULL);
    } else {
        $stmt->bindValue($parameter, $value, PDO::PARAM_STR);
    }
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
    $labelName = $name !== null && $name !== '' ? $name : 'ไม่ระบุสถานที่';
    return sprintf('%d - %s', $id, $labelName);
}