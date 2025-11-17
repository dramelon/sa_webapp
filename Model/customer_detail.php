<?php
require_once __DIR__ . '/database_connector.php';

session_start();
header('Content-Type: application/json; charset=utf-8');

$customerId = isset($_GET['id']) ? (int) $_GET['id'] : 0;
if ($customerId <= 0) {
    http_response_code(400);
    echo json_encode(['error' => 'invalid_id']);
    exit;
}

try {
    $db = DatabaseConnector::getConnection();

    $sql = "
        SELECT
            c.CustomerID AS customer_id,
            c.RefCustomerID AS ref_customer_id,
            c.CustomerName AS customer_name,
            c.OrgName AS organization,
            c.Email AS email,
            c.Phone AS phone,
            c.TaxID AS tax_id,
            c.ContactPerson AS contact_person,
            c.Status AS status,
            c.Notes AS notes,
            c.LocationID AS location_id,
            c.CreatedAt AS created_at,
            c.UpdatedAt AS updated_at,
            c.CreatedBy AS created_by_id,
            c.UpdatedBy AS updated_by_id,
            l.LocationName AS location_name,
            l.RefLocationID AS ref_location_id,
            l.Email AS location_email,
            l.Phone AS location_phone,
            l.Country AS location_country,
            created.FullName AS created_by_name,
            created.Role AS created_by_role,
            updated.FullName AS updated_by_name,
            updated.Role AS updated_by_role
        FROM customers c
        LEFT JOIN locations l ON l.LocationID = c.LocationID
        LEFT JOIN staffs created ON created.StaffID = c.CreatedBy
        LEFT JOIN staffs updated ON updated.StaffID = c.UpdatedBy
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
        'ref_customer_id' => $row['ref_customer_id'],
        'customer_name' => $row['customer_name'],
        'organization' => $row['organization'],
        'email' => $row['email'],
        'phone' => $row['phone'],
        'tax_id' => $row['tax_id'],
        'contact_person' => $row['contact_person'],
        'status' => $row['status'],
        'notes' => $row['notes'],
        'location_id' => $row['location_id'] !== null ? (int) $row['location_id'] : null,
        'location_name' => $row['location_name'],
        'location_ref' => $row['ref_location_id'],
        'location_email' => $row['location_email'],
        'location_phone' => $row['location_phone'],
        'location_country' => $row['location_country'],
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
