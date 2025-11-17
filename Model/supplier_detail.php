<?php
require_once __DIR__ . '/database_connector.php';

session_start();
header('Content-Type: application/json; charset=utf-8');

$supplierId = isset($_GET['id']) ? (int) $_GET['id'] : 0;
if ($supplierId <= 0) {
    http_response_code(400);
    echo json_encode(['error' => 'invalid_id']);
    exit;
}

try {
    $db = DatabaseConnector::getConnection();

    $sql = "
        SELECT
            s.SupplierID AS supplier_id,
            s.RefSupplierID AS ref_supplier_id,
            s.SupplierName AS supplier_name,
            s.OrgName AS organization,
            s.Email AS email,
            s.Phone AS phone,
            s.TaxID AS tax_id,
            s.ContactPerson AS contact_person,
            s.Note AS notes,
            s.Status AS status,
            s.LocationID AS location_id,
            s.CreatedAt AS created_at,
            s.UpdatedAt AS updated_at,
            s.CreatedBy AS created_by_id,
            s.UpdatedBy AS updated_by_id,
            l.LocationName AS location_name,
            l.RefLocationID AS ref_location_id,
            l.Email AS location_email,
            l.Phone AS location_phone,
            l.Country AS location_country,
            created.FullName AS created_by_name,
            created.Role AS created_by_role,
            updated.FullName AS updated_by_name,
            updated.Role AS updated_by_role
        FROM suppliers s
        LEFT JOIN locations l ON l.LocationID = s.LocationID
        LEFT JOIN staffs created ON created.StaffID = s.CreatedBy
        LEFT JOIN staffs updated ON updated.StaffID = s.UpdatedBy
        WHERE s.SupplierID = :id
        LIMIT 1
    ";

    $stmt = $db->prepare($sql);
    $stmt->bindValue(':id', $supplierId, PDO::PARAM_INT);
    $stmt->execute();
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$row) {
        http_response_code(404);
        echo json_encode(['error' => 'not_found']);
        exit;
    }

    $payload = [
        'supplier_id' => (int) $row['supplier_id'],
        'ref_supplier_id' => $row['ref_supplier_id'],
        'supplier_name' => $row['supplier_name'],
        'organization' => $row['organization'],
        'email' => $row['email'],
        'phone' => $row['phone'],
        'tax_id' => $row['tax_id'],
        'contact_person' => $row['contact_person'],
        'notes' => $row['notes'],
        'status' => $row['status'],
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