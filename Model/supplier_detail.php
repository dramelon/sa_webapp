<?php
require_once __DIR__ . '/database_connector.php';
require_once __DIR__ . '/audit_log.php';

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
            l.LocationName AS location_name,
            l.RefLocationID AS ref_location_id,
            l.Email AS location_email,
            l.Phone AS location_phone,
            l.Country AS location_country
        FROM suppliers s
        LEFT JOIN locations l ON l.LocationID = s.LocationID
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

    $audit = fetchAuditMetadataForEntity($db, 'supplier', (int) $row['supplier_id']);

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
        'created_at' => $audit['created_at'],
        'updated_at' => $audit['updated_at'],
        'created_by_id' => $audit['created_by_id'],
        'updated_by_id' => $audit['updated_by_id'],
        'created_by_label' => formatStaffLabel($audit['created_by_id'], $audit['created_by_name'], $audit['created_by_role']),
        'updated_by_label' => formatStaffLabel($audit['updated_by_id'], $audit['updated_by_name'], $audit['updated_by_role']),
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