<?php
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

try {
    $db = new PDO(
        'mysql:host=localhost;dbname=sa_webapp;charset=utf8mb4',
        'dramelon',
        'dramelon',
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );

    $sql = "
        INSERT INTO locations (
            Loc_Name, House_Number, Village, Building_Name, Floor, Room, Street,
            Subdistrict, District, Province, Postal_Code, Country, Notes
        ) VALUES (
            :name, :house_number, :village, :building_name, :floor, :room, :street,
            :subdistrict, :district, :province, :postal_code, :country, :notes
        )
    ";

    $stmt = $db->prepare($sql);
    $stmt->bindValue(':name', $locationName, PDO::PARAM_STR);
    bindNullableString($stmt, ':house_number', $houseNumber);
    bindNullableString($stmt, ':village', $village);
    bindNullableString($stmt, ':building_name', $buildingName);
    bindNullableString($stmt, ':floor', $floor);
    bindNullableString($stmt, ':room', $room);
    bindNullableString($stmt, ':street', $street);
    bindNullableString($stmt, ':subdistrict', $subdistrict);
    bindNullableString($stmt, ':district', $district);
    bindNullableString($stmt, ':province', $province);
    bindNullableString($stmt, ':postal_code', $postalCode);
    bindNullableString($stmt, ':country', $country);
    bindNullableString($stmt, ':notes', $notes);
    $stmt->execute();

    $locationId = (int) $db->lastInsertId();

    $detailSql = "
        SELECT
            l.LocationID AS location_id,
            l.Loc_Name AS location_name,
            l.House_Number AS house_number,
            l.Village AS village,
            l.Building_Name AS building_name,
            l.Floor AS floor,
            l.Room AS room,
            l.Street AS street,
            l.Subdistrict AS subdistrict,
            l.District AS district,
            l.Province AS province,
            l.Postal_Code AS postal_code,
            l.Country AS country,
            l.Notes AS notes
        FROM locations l
        WHERE l.LocationID = :id
        LIMIT 1
    ";

    $detailStmt = $db->prepare($detailSql);
    $detailStmt->bindValue(':id', $locationId, PDO::PARAM_INT);
    $detailStmt->execute();
    $row = $detailStmt->fetch(PDO::FETCH_ASSOC);

    $payload = [
        'location_id' => $locationId,
        'location_name' => $row['location_name'] ?? $locationName,
        'house_number' => $row['house_number'] ?? $houseNumber,
        'village' => $row['village'] ?? $village,
        'building_name' => $row['building_name'] ?? $buildingName,
        'floor' => $row['floor'] ?? $floor,
        'room' => $row['room'] ?? $room,
        'street' => $row['street'] ?? $street,
        'subdistrict' => $row['subdistrict'] ?? $subdistrict,
        'district' => $row['district'] ?? $district,
        'province' => $row['province'] ?? $province,
        'postal_code' => $row['postal_code'] ?? $postalCode,
        'country' => $row['country'] ?? $country,
        'notes' => $row['notes'] ?? $notes,
        'location_label' => formatLocationLabel($locationId, $row['location_name'] ?? $locationName),
    ];

    echo json_encode(['success' => true, 'data' => $payload], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'server']);
}

function trimNullable($value)
{
    if ($value === null) {
        return null;
    }
    $text = trim((string) $value);
    return $text === '' ? null : $text;
}

function bindNullableString(PDOStatement $stmt, string $param, $value)
{
    if ($value === null) {
        $stmt->bindValue($param, null, PDO::PARAM_NULL);
    } else {
        $stmt->bindValue($param, $value, PDO::PARAM_STR);
    }
}

function formatLocationLabel($id, $name)
{
    $labelName = $name !== null && $name !== '' ? $name : 'ไม่ระบุสถานที่';
    return sprintf('%d - %s', $id, $labelName);
}