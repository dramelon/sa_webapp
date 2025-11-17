<?php
require_once __DIR__ . '/database_connector.php';

session_start();
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'method_not_allowed']);
    exit;
}

$eventId = isset($_GET['id']) ? (int) $_GET['id'] : 0;
if ($eventId <= 0) {
    http_response_code(400);
    echo json_encode(['error' => 'invalid_id']);
    exit;
}

try {
    $db = DatabaseConnector::getConnection();

    $sql = "
        SELECT
            e.EventID AS event_id,
            e.RefEventID AS ref_event_id,
            e.EventName AS event_name,
            e.Status AS status,
            e.Description AS description,
            e.Notes AS notes,
            e.StartDate AS start_date,
            e.EndDate AS end_date,
            e.CreatedAt AS created_at,
            e.UpdatedAt AS updated_at,
            e.CustomerID AS customer_id,
            e.StaffID AS staff_id,
            e.LocationID AS location_id,
            e.CreatedBy AS created_by_id,
            e.UpdatedBy AS updated_by_id,
            c.CustomerName AS customer_name,
            c.Phone AS customer_phone,
            c.Email AS customer_email,
            l.LocationName AS location_name,
            s.FullName AS staff_name,
            s.Role AS staff_role,
            created.FullName AS created_by_name,
            created.Role AS created_by_role,
            updated.FullName AS updated_by_name,
            updated.Role AS updated_by_role
        FROM events e
        LEFT JOIN customers c ON c.CustomerID = e.CustomerID
        LEFT JOIN locations l ON l.LocationID = e.LocationID
        LEFT JOIN staffs s ON s.StaffID = e.StaffID
        LEFT JOIN staffs created ON created.StaffID = e.CreatedBy
        LEFT JOIN staffs updated ON updated.StaffID = e.UpdatedBy
        WHERE e.EventID = :event_id
        LIMIT 1
    ";

    $stmt = $db->prepare($sql);
    $stmt->bindValue(':event_id', $eventId, PDO::PARAM_INT);
    $stmt->execute();
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$row) {
        http_response_code(404);
        echo json_encode(['error' => 'not_found']);
        exit;
    }

    $payload = [
        'event_id' => (int) $row['event_id'],
        'ref_event_id' => $row['ref_event_id'],
        'event_name' => $row['event_name'],
        'status' => $row['status'],
        'description' => $row['description'],
        'notes' => $row['notes'],
        'start_date' => $row['start_date'],
        'end_date' => $row['end_date'],
        'created_at' => $row['created_at'],
        'updated_at' => $row['updated_at'],
        'customer_id' => $row['customer_id'] !== null ? (int) $row['customer_id'] : null,
        'staff_id' => $row['staff_id'] !== null ? (int) $row['staff_id'] : null,
        'location_id' => $row['location_id'] !== null ? (int) $row['location_id'] : null,
        'created_by_id' => $row['created_by_id'] !== null ? (int) $row['created_by_id'] : null,
        'updated_by_id' => $row['updated_by_id'] !== null ? (int) $row['updated_by_id'] : null,
        'customer_label' => formatCustomerLabel($row['customer_id'], $row['customer_name']),
        'customer_name' => $row['customer_name'],
        'customer_phone' => $row['customer_phone'],
        'customer_email' => $row['customer_email'],
        'location_label' => formatLocationLabel($row['location_id'], $row['location_name']),
        'location_name' => $row['location_name'],
        'staff_label' => formatStaffLabel($row['staff_id'], $row['staff_name'], $row['staff_role']),
        'created_by_label' => formatStaffLabel($row['created_by_id'], $row['created_by_name'], $row['created_by_role']),
        'updated_by_label' => formatStaffLabel($row['updated_by_id'], $row['updated_by_name'], $row['updated_by_role'])
    ];

    echo json_encode(['data' => $payload], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'server']);
}

function formatCustomerLabel($id, $name)
{
    if ($id === null) {
        return '';
    }
    $labelName = $name !== null && $name !== '' ? $name : 'ไม่ระบุชื่อลูกค้า';
    return sprintf('%d - %s', $id, $labelName);
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