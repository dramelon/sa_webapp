<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

$locationId = isset($_GET['id']) ? (int) $_GET['id'] : 0;
if ($locationId <= 0) {
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
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$row) {
        http_response_code(404);
        echo json_encode(['error' => 'not_found']);
        exit;
    }

    $payload = [
        'location_id' => (int) $row['location_id'],
        'ref_location_id' => $row['ref_location_id'],
        'location_name' => $row['location_name'],
        'email' => $row['email'],
        'phone' => $row['phone'],
        'house_number' => $row['house_number'],
        'village' => $row['village'],
        'building_name' => $row['building_name'],
        'floor' => $row['floor'],
        'room' => $row['room'],
        'street' => $row['street'],
        'subdistrict' => $row['subdistrict'],
        'district' => $row['district'],
        'province' => $row['province'],
        'postal_code' => $row['postal_code'],
        'country' => $row['country'],
        'notes' => $row['note'],
        'status' => $row['status'],
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