<?php
require_once __DIR__ . '/database_connector.php';

session_start();
header('Content-Type: application/json; charset=utf-8');

$type = $_GET['type'] ?? '';
$type = is_string($type) ? strtolower(trim($type)) : '';
$query = isset($_GET['q']) ? trim((string) $_GET['q']) : '';

$allowedTypes = ['customer', 'location', 'staff', 'item', 'warehouse'];
if (!in_array($type, $allowedTypes, true)) {
    http_response_code(400);
    echo json_encode(['error' => 'invalid_type']);
    exit;
}

try {
    $db = DatabaseConnector::getConnection();

    $likeTerm = '%' . $query . '%';
    $limit = 12;

    switch ($type) {
        case 'customer':
            $sql = "
                SELECT
                    CustomerID AS id,
                    CustomerName AS name,
                    COALESCE(Phone, '') AS phone,
                    COALESCE(Email, '') AS email
                FROM customers
                WHERE Status = 'active' AND (CustomerName LIKE :term OR CAST(CustomerID AS CHAR) LIKE :term OR RefCustomerID LIKE :term)
                ORDER BY CustomerID DESC
                LIMIT :limit
            ";
            $stmt = $db->prepare($sql);
            $stmt->bindValue(':term', $likeTerm, PDO::PARAM_STR);
            break;
        case 'location':
            $sql = "
                SELECT LocationID AS id, COALESCE(LocationName, '') AS name
                FROM locations
                WHERE Status = 'active' AND (COALESCE(LocationName, '') LIKE :term OR CAST(LocationID AS CHAR) LIKE :term OR RefLocationID LIKE :term)
                ORDER BY LocationID DESC
                LIMIT :limit
            ";
            $stmt = $db->prepare($sql);
            $stmt->bindValue(':term', $likeTerm, PDO::PARAM_STR);
            break;
        case 'staff':
            $sql = "
                SELECT StaffID AS id, COALESCE(FullName, Username) AS name, Role
                FROM staffs
                WHERE Status = 'active' AND (COALESCE(FullName, Username) LIKE :term OR CAST(StaffID AS CHAR) LIKE :term OR Role LIKE :term)
                ORDER BY StaffID DESC
                LIMIT :limit
            ";
            $stmt = $db->prepare($sql);
            $stmt->bindValue(':term', $likeTerm, PDO::PARAM_STR);
            break;
        case 'item':
            $sql = "
                SELECT
                    i.ItemID AS id,
                    COALESCE(i.ItemName, '') AS name,
                    COALESCE(i.RefItemID, '') AS ref_id,
                    COALESCE(c.Name, '') AS category_name
                FROM items i
                LEFT JOIN itemcategorys c ON c.ItemCategoryID = i.ItemCategoryID
                WHERE (
                    COALESCE(i.ItemName, '') LIKE :term
                    OR COALESCE(i.RefItemID, '') LIKE :term
                    OR CAST(i.ItemID AS CHAR) LIKE :term
                )
                ORDER BY i.ItemID DESC
                LIMIT :limit
            ";
            $stmt = $db->prepare($sql);
            $stmt->bindValue(':term', $likeTerm, PDO::PARAM_STR);
            break;
        case 'warehouse':
            $sql = "
                SELECT
                    w.WarehouseID AS id,
                    COALESCE(w.WarehouseName, '') AS name,
                    COALESCE(w.WarehouseSN, '') AS short_name,
                    COALESCE(w.Status, '') AS status
                FROM warehouse w
                WHERE (
                    COALESCE(w.WarehouseName, '') LIKE :term
                    OR COALESCE(w.WarehouseSN, '') LIKE :term
                    OR CAST(w.WarehouseID AS CHAR) LIKE :term
                )
                ORDER BY w.WarehouseID DESC
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
                    'label' => formatCustomerLabel($row['id'], $row['name']),
                    'name' => $row['name'],
                    'phone' => $row['phone'] ?? '',
                    'email' => $row['email'] ?? ''
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
            case 'item':
                return [
                    'id' => (int) $row['id'],
                    'label' => formatItemLabel($row['id'], $row['name'], $row['ref_id'] ?? '', $row['category_name'] ?? ''),
                    'name' => $row['name'] ?? '',
                    'ref_id' => $row['ref_id'] ?? '',
                    'category_name' => $row['category_name'] ?? ''
                ];
            case 'warehouse':
                return [
                    'id' => (int) $row['id'],
                    'label' => formatWarehouseLabel($row['id'], $row['name'], $row['short_name'] ?? '', $row['status'] ?? ''),
                    'name' => $row['name'] ?? '',
                    'short_name' => $row['short_name'] ?? '',
                    'status' => $row['status'] ?? ''
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

function formatItemLabel($id, $name, $refId, $category)
{
    if ($id === null) {
        return '';
    }
    $labelName = $name !== null && $name !== '' ? $name : 'ไม่ทราบชื่อสินค้า';
    $refPart = $refId !== null && $refId !== '' ? sprintf(' (%s)', $refId) : '';
    $categoryPart = $category !== null && $category !== '' ? sprintf(' [%s]', $category) : '';
    return sprintf('%d - %s%s%s', $id, $labelName, $refPart, $categoryPart);
}

function formatWarehouseLabel($id, $name, $shortName, $status)
{
    if ($id === null) {
        return '';
    }
    $labelName = $name !== null && $name !== '' ? $name : 'ไม่ทราบชื่อคลัง';
    $shortPart = $shortName !== null && $shortName !== '' ? sprintf(' (%s)', $shortName) : '';
    $statusMap = [
        'active' => ' • ใช้งาน',
        'inactive' => ' • ปิดใช้งาน'
    ];
    $statusPart = $statusMap[strtolower((string) $status)] ?? '';
    return sprintf('%d - %s%s%s', $id, $labelName, $shortPart, $statusPart);
}