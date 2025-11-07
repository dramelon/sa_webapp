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

$customerName = trim((string) ($input['customer_name'] ?? ''));
if ($customerName === '') {
    http_response_code(400);
    echo json_encode(['error' => 'missing_name']);
    exit;
}

$allowedStatuses = ['active', 'inactive'];
$status = strtolower((string) ($input['status'] ?? 'active'));
if (!in_array($status, $allowedStatuses, true)) {
    $status = 'active';
}

$orgName = trimNullable($input['org_name'] ?? null);
$email = trimNullable($input['email'] ?? null);
$phone = trimNullable($input['phone'] ?? null);
$taxId = trimNullable($input['tax_id'] ?? null);
$notes = trimNullable($input['notes'] ?? null);
$locationId = parseNullableInt($input['location_id'] ?? null);

try {
    $db = new PDO(
        'mysql:host=localhost;dbname=sa_webapp;charset=utf8mb4',
        'dramelon',
        'dramelon',
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );

    if ($locationId !== null) {
        $checkLocation = $db->prepare('SELECT LocationID FROM locations WHERE LocationID = :id LIMIT 1');
        $checkLocation->bindValue(':id', $locationId, PDO::PARAM_INT);
        $checkLocation->execute();
        if (!$checkLocation->fetch(PDO::FETCH_ASSOC)) {
            $locationId = null;
        }
    }

    $sql = "
        INSERT INTO customers (Customer_Name, OrgName, Email, Phone, TaxID, Status, Notes, LocationID)
        VALUES (:name, :org, :email, :phone, :tax_id, :status, :notes, :location_id)
    ";
    $stmt = $db->prepare($sql);
    $stmt->bindValue(':name', $customerName, PDO::PARAM_STR);
    bindNullableString($stmt, ':org', $orgName);
    bindNullableString($stmt, ':email', $email);
    bindNullableString($stmt, ':phone', $phone);
    bindNullableString($stmt, ':tax_id', $taxId);
    $stmt->bindValue(':status', $status, PDO::PARAM_STR);
    bindNullableString($stmt, ':notes', $notes);
    bindNullableInt($stmt, ':location_id', $locationId);
    $stmt->execute();

    $customerId = (int) $db->lastInsertId();

    $detailSql = "
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
            l.Loc_Name AS location_name
        FROM customers c
        LEFT JOIN locations l ON l.LocationID = c.LocationID
        WHERE c.CustomerID = :id
        LIMIT 1
    ";

    $detailStmt = $db->prepare($detailSql);
    $detailStmt->bindValue(':id', $customerId, PDO::PARAM_INT);
    $detailStmt->execute();
    $row = $detailStmt->fetch(PDO::FETCH_ASSOC);

    $payload = [
        'customer_id' => $customerId,
        'customer_name' => $row['customer_name'] ?? $customerName,
        'organization' => $row['organization'] ?? $orgName,
        'email' => $row['email'] ?? $email,
        'phone' => $row['phone'] ?? $phone,
        'tax_id' => $row['tax_id'] ?? $taxId,
        'status' => $row['status'] ?? $status,
        'notes' => $row['notes'] ?? $notes,
        'location_id' => isset($row['location_id']) ? (int) $row['location_id'] : $locationId,
        'location_name' => $row['location_name'] ?? null,
        'customer_label' => formatCustomerLabel($customerId, $row['customer_name'] ?? $customerName),
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