<?php
require_once __DIR__ . '/database_connector.php';
require_once __DIR__ . '/audit_log.php';

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

$supplierName = trim((string) ($input['supplier_name'] ?? ''));
if ($supplierName === '') {
    http_response_code(400);
    echo json_encode(['error' => 'missing_name']);
    exit;
}

$refSupplierId = sanitizeRefId($input['ref_supplier_id'] ?? null);
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
        INSERT INTO suppliers (
            RefSupplierID,
            SupplierName,
            OrgName,
            Email,
            Phone,
            TaxID,
            ContactPerson,
            Note,
            Status,
            LocationID
        ) VALUES (
            :ref_supplier_id,
            :name,
            :org,
            :email,
            :phone,
            :tax_id,
            :contact_person,
            :notes,
            :status,
            :location_id
        )
    ";

    $stmt = $db->prepare($sql);
    bindNullableString($stmt, ':ref_supplier_id', $refSupplierId);
    $stmt->bindValue(':name', $supplierName, PDO::PARAM_STR);
    bindNullableString($stmt, ':org', $orgName);
    bindNullableString($stmt, ':email', $email);
    bindNullableString($stmt, ':phone', $phone);
    bindNullableString($stmt, ':tax_id', $taxId);
    bindNullableString($stmt, ':contact_person', $contactPerson);
    bindNullableString($stmt, ':notes', $notes);
    $stmt->bindValue(':status', $status, PDO::PARAM_STR);
    bindNullableInt($stmt, ':location_id', $locationId);
    $stmt->execute();

    $supplierId = (int) $db->lastInsertId();

    recordAuditEvent($db, 'supplier', $supplierId, 'CREATE', $staffId);

    $detail = fetchSupplierDetail($db, $supplierId);

    echo json_encode(['success' => true, 'data' => $detail], JSON_UNESCAPED_UNICODE);
} catch (PDOException $e) {
    if ((int) $e->getCode() === 23000) {
        http_response_code(409);
        echo json_encode(['error' => 'ref_supplier_exists']);
        return;
    }
    http_response_code(500);
    echo json_encode(['error' => 'server']);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'server']);
}

function fetchSupplierDetail(PDO $db, int $supplierId): array
{
    $sql = "
        SELECT
            s.SupplierID AS supplier_id,
            s.RefSupplierID AS ref_supplier_id,
            s.SupplierName AS supplier_name,
            s.OrgName AS organization,
            s.Email AS email,
            s.Phone AS phone,
            s.ContactPerson AS contact_person,
            s.TaxID AS tax_id,
            s.Note AS notes,
            s.Status AS status,
            s.LocationID AS location_id,
            l.LocationName AS location_name
        FROM suppliers s
        LEFT JOIN locations l ON l.LocationID = s.LocationID
        WHERE s.SupplierID = :id
        LIMIT 1
    ";

    $stmt = $db->prepare($sql);
    $stmt->bindValue(':id', $supplierId, PDO::PARAM_INT);
    $stmt->execute();
    $row = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];

    $audit = fetchAuditMetadataForEntity($db, 'supplier', $supplierId);

    return [
        'supplier_id' => $supplierId,
        'ref_supplier_id' => $row['ref_supplier_id'] ?? null,
        'supplier_name' => $row['supplier_name'] ?? null,
        'organization' => $row['organization'] ?? null,
        'email' => $row['email'] ?? null,
        'phone' => $row['phone'] ?? null,
        'tax_id' => $row['tax_id'] ?? null,
        'contact_person' => $row['contact_person'] ?? null,
        'notes' => $row['notes'] ?? null,
        'status' => $row['status'] ?? null,
        'location_id' => isset($row['location_id']) ? (int) $row['location_id'] : null,
        'location_name' => $row['location_name'] ?? null,
        'created_at' => $audit['created_at'],
        'updated_at' => $audit['updated_at'],
        'created_by_id' => $audit['created_by_id'],
        'updated_by_id' => $audit['updated_by_id'],
        'created_by_label' => formatStaffLabel($audit['created_by_id'], $audit['created_by_name'], $audit['created_by_role']),
        'updated_by_label' => formatStaffLabel($audit['updated_by_id'], $audit['updated_by_name'], $audit['updated_by_role']),
        'supplier_label' => formatSupplierLabel($supplierId, $row['supplier_name'] ?? ''),
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

function formatSupplierLabel($id, $name)
{
    $labelName = $name !== null && $name !== '' ? $name : 'ไม่ระบุชื่อซัพพลายเออร์';
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