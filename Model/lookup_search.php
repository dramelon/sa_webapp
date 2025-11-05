<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

$type = $_GET['type'] ?? '';
$type = is_string($type) ? strtolower(trim($type)) : '';
$query = isset($_GET['q']) ? trim((string) $_GET['q']) : '';

$allowedTypes = ['customer', 'location', 'staff'];
if (!in_array($type, $allowedTypes, true)) {
    http_response_code(400);
    echo json_encode(['error' => 'invalid_type']);
    exit;
}

try {
    $db = new PDO(
        'mysql:host=localhost;dbname=sa_webapp;charset=utf8mb4',
        'dramelon',
        'dramelon',
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );

    $likeTerm = '%' . $query . '%';
    $limit = 12;

    switch ($type) {
        case 'customer':
            $sql = "
                SELECT CustomerID AS id, Customer_Name AS name
                FROM customers
                WHERE Customer_Name LIKE :term OR CAST(CustomerID AS CHAR) LIKE :term
                ORDER BY Customer_Name ASC
                LIMIT :limit
            ";
            $stmt = $db->prepare($sql);
            $stmt->bindValue(':term', $likeTerm, PDO::PARAM_STR);
            break;
        case 'location':
            $sql = "
                SELECT LocationID AS id, COALESCE(Loc_Name, '') AS name
                FROM locations
                WHERE COALESCE(Loc_Name, '') LIKE :term OR CAST(LocationID AS CHAR) LIKE :term
                ORDER BY Loc_Name ASC
                LIMIT :limit
            ";
            $stmt = $db->prepare($sql);
            $stmt->bindValue(':term', $likeTerm, PDO::PARAM_STR);
            break;
        case 'staff':
            $sql = "
                SELECT StaffID AS id, COALESCE(FullName, Username) AS name, Role
                FROM staffs
                WHERE (COALESCE(FullName, Username) LIKE :term OR CAST(StaffID AS CHAR) LIKE :term OR Role LIKE :term)
                ORDER BY FullName ASC
                LIMIT :limit
            ";
            $stmt = $db->prepare($sql);
            $stmt->bindValue(':term', $likeTerm, PDO::PARAM_STR);
            break;
        default:
            throw new RuntimeException('Unsupported type');
    }

    $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
    $stmt->execute();
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $results = array_map(function ($row) use ($type) {
        switch ($type) {
            case 'customer':
                return [
                    'id' => (int) $row['id'],
                    'label' => formatCustomerLabel($row['id'], $row['name'])
                ];
            case 'location':
                return [
                    'id' => (int) $row['id'],
                    'label' => formatLocationLabel($row['id'], $row['name'])
                ];
            case 'staff':
                return [
                    'id' => (int) $row['id'],
                    'label' => formatStaffLabel($row['id'], $row['name'], $row['Role'] ?? '')
                ];
            default:
                return ['id' => $row['id'], 'label' => $row['name']];
        }
    }, $rows);

    echo json_encode(['data' => $results], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'server']);
}

function formatCustomerLabel($id, $name)
{
    $labelName = $name !== null && $name !== '' ? $name : 'ไม่ระบุชื่อลูกค้า';
    return sprintf('%d - %s', $id, $labelName);
}

function formatLocationLabel($id, $name)
{
    $labelName = $name !== null && $name !== '' ? $name : 'ไม่ระบุสถานที่';
    return sprintf('%d - %s', $id, $labelName);
}

function formatStaffLabel($id, $name, $role)
{
    $displayName = $name !== null && $name !== '' ? $name : 'ไม่ทราบชื่อผู้รับผิดชอบ';
    $roleInitial = $role !== null && $role !== '' ? mb_strtoupper(mb_substr($role, 0, 1, 'UTF-8'), 'UTF-8') : 'S';
    return sprintf('%s%d - %s', $roleInitial, $id, $displayName);
}