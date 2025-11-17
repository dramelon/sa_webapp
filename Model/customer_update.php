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

$customerId = isset($input['customer_id']) ? (int) $input['customer_id'] : 0;
if ($customerId <= 0) {
    http_response_code(400);
    echo json_encode(['error' => 'invalid_id']);
    exit;
}

$customerName = trim((string) ($input['customer_name'] ?? ''));
if ($customerName === '') {
    http_response_code(400);
    echo json_encode(['error' => 'missing_name']);
    exit;
}

$refCustomerId = sanitizeRefId($input['ref_customer_id'] ?? null);
$orgName = trimNullable($input['org_name'] ?? null);
$email = trimNullable($input['email'] ?? null);
$phone = trimNullable($input['phone'] ?? null);
$taxId = trimNullable($input['tax_id'] ?? null);
$contactPerson = trimNullable($input['contact_person'] ?? null);
$notes = trimNullable($input['notes'] ?? null);
$locationId = parseNullableInt($input['location_id'] ?? null);

$allowedStatuses = ['active', 'inactive'];
$status = strtolower((string) ($input['status'] ?? 'active'));
if (!in_array($status, $allowedStatuses, true)) {
    $status = 'active';
}

$staffId = (int) $_SESSION['staff_id'];

try {
    $db = DatabaseConnector::getConnection();

    if ($locationId !== null) {
        $checkLocation = $db->prepare('SELECT LocationID FROM locations WHERE LocationID = :id LIMIT 1');
        $checkLocation->bindValue(':id', $locationId, PDO::PARAM_INT);
        $checkLocation->execute();
        if (!$checkLocation->fetch(PDO::FETCH_ASSOC)) {
            $locationId = null;
        }
    }

    $sql = "
        UPDATE customers SET
            RefCustomerID = :ref_customer_id,
            CustomerName = :name,
            OrgName = :org,
            Email = :email,
            Phone = :phone,
            TaxID = :tax_id,
            ContactPerson = :contact_person,
            Status = :status,
            Notes = :notes,
            LocationID = :location_id,
            UpdatedBy = :updated_by
        WHERE CustomerID = :id
        LIMIT 1
    ";

    $stmt = $db->prepare($sql);
    bindNullableString($stmt, ':ref_customer_id', $refCustomerId);
    $stmt->bindValue(':name', $customerName, PDO::PARAM_STR);
    bindNullableString($stmt, ':org', $orgName);
    bindNullableString($stmt, ':email', $email);
    bindNullableString($stmt, ':phone', $phone);
    bindNullableString($stmt, ':tax_id', $taxId);
    bindNullableString($stmt, ':contact_person', $contactPerson);
    $stmt->bindValue(':status', $status, PDO::PARAM_STR);
    bindNullableString($stmt, ':notes', $notes);
    bindNullableInt($stmt, ':location_id', $locationId);
    $stmt->bindValue(':updated_by', $staffId, PDO::PARAM_INT);
    $stmt->bindValue(':id', $customerId, PDO::PARAM_INT);
    $stmt->execute();

    $detail = fetchCustomerDetail($db, $customerId);

    echo json_encode(['success' => true, 'data' => $detail], JSON_UNESCAPED_UNICODE);
} catch (PDOException $e) {
    if ((int) $e->getCode() === 23000) {
        http_response_code(409);
        echo json_encode(['error' => 'ref_customer_exists']);
        return;
    }
    http_response_code(500);
    echo json_encode(['error' => 'server']);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'server']);
}

function fetchCustomerDetail(PDO $db, int $customerId): array
{
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
    $row = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];

    return [
        'customer_id' => $customerId,
        'ref_customer_id' => $row['ref_customer_id'] ?? null,
        'customer_name' => $row['customer_name'] ?? null,
        'organization' => $row['organization'] ?? null,
        'email' => $row['email'] ?? null,
        'phone' => $row['phone'] ?? null,
        'tax_id' => $row['tax_id'] ?? null,
        'contact_person' => $row['contact_person'] ?? null,
        'status' => $row['status'] ?? null,
        'notes' => $row['notes'] ?? null,
        'location_id' => isset($row['location_id']) ? (int) $row['location_id'] : null,
        'location_name' => $row['location_name'] ?? null,
        'created_at' => $row['created_at'] ?? null,
        'updated_at' => $row['updated_at'] ?? null,
        'created_by_id' => isset($row['created_by_id']) ? (int) $row['created_by_id'] : null,
        'updated_by_id' => isset($row['updated_by_id']) ? (int) $row['updated_by_id'] : null,
        'created_by_label' => formatStaffLabel($row['created_by_id'] ?? null, $row['created_by_name'] ?? null, $row['created_by_role'] ?? null),
        'updated_by_label' => formatStaffLabel($row['updated_by_id'] ?? null, $row['updated_by_name'] ?? null, $row['updated_by_role'] ?? null),
        'customer_label' => formatCustomerLabel($customerId, $row['customer_name'] ?? ''),
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
function parseNullableInt($value)
{
    if ($value === null || $value === '') {
        return null;
    }
    if (is_numeric($value)) {
        $intValue = (int) $value;
        return $intValue > 0 ? $intValue : null;
    }
    return null;
}

function bindNullableString(PDOStatement $stmt, string $param, $value)
{
    if ($value === null) {
        $stmt->bindValue($param, null, PDO::PARAM_NULL);
    } else {
        $stmt->bindValue($param, $value, PDO::PARAM_STR);
    }
}

function bindNullableInt(PDOStatement $stmt, string $param, $value)
{
    if ($value === null) {
        $stmt->bindValue($param, null, PDO::PARAM_NULL);
    } else {
        $stmt->bindValue($param, (int) $value, PDO::PARAM_INT);
    }
}

function formatCustomerLabel($id, $name)
{
    $labelName = $name !== null && $name !== '' ? $name : 'ไม่ระบุชื่อลูกค้า';
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