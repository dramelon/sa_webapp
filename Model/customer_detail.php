<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

$customerId = isset($_GET['id']) ? (int) $_GET['id'] : 0;
if ($customerId <= 0) {
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
            c.CustomerID AS customer_id,
            c.Customer_Name AS customer_name,
            c.OrgName AS organization,
            c.Email AS email,
            c.Phone AS phone,
            c.TaxID AS tax_id,
            c.Status AS status,
            c.Notes AS notes,
            c.LocationID AS location_id,
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
            l.Notes AS location_notes
        FROM customers c
        LEFT JOIN locations l ON l.LocationID = c.LocationID
        WHERE c.CustomerID = :id
        LIMIT 1
    ";

    $stmt = $db->prepare($sql);
    $stmt->bindValue(':id', $customerId, PDO::PARAM_INT);
    $stmt->execute();
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$row) {
        http_response_code(404);
        echo json_encode(['error' => 'not_found']);
        exit;
    }

    $payload = [
        'customer_id' => (int) $row['customer_id'],
        'customer_name' => $row['customer_name'],
        'organization' => $row['organization'],
        'email' => $row['email'],
        'phone' => $row['phone'],
        'tax_id' => $row['tax_id'],
        'status' => $row['status'],
        'notes' => $row['notes'],
        'location_id' => $row['location_id'] !== null ? (int) $row['location_id'] : null,
        'location_name' => $row['location_name'],
        'location' => [
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
            'notes' => $row['location_notes'],
        ],
    ];

    echo json_encode(['data' => $payload], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'server']);
}