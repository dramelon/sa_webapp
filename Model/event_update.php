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

$eventId = isset($input['event_id']) ? (int) $input['event_id'] : 0;
if ($eventId <= 0) {
    http_response_code(400);
    echo json_encode(['error' => 'invalid_id']);
    exit;
}

$eventName = trim((string) ($input['event_name'] ?? ''));
if ($eventName === '') {
    http_response_code(400);
    echo json_encode(['error' => 'missing_event_name']);
    exit;
}

$allowedStatuses = ['draft', 'planning', 'waiting', 'processing', 'billing', 'completed', 'cancelled'];
$status = strtolower((string) ($input['status'] ?? 'draft'));
if (!in_array($status, $allowedStatuses, true)) {
    http_response_code(400);
    echo json_encode(['error' => 'invalid_status']);
    exit;
}

$isProjectRole = isset($_SESSION['role']) && strtolower((string) $_SESSION['role']) === 'project';

$customerId = parseNullableInt($input['customer_id'] ?? null);
$staffId = parseNullableInt($input['staff_id'] ?? null);
$locationId = parseNullableInt($input['location_id'] ?? null);
$startDate = normalizeDateTime($input['start_date'] ?? null);
$endDate = normalizeDateTime($input['end_date'] ?? null);
$refEventId = sanitizeRefEventId($input['ref_event_id'] ?? null);
$description = trimText($input['description'] ?? '');
$notes = trimText($input['notes'] ?? '');
$updatedBy = (int) $_SESSION['staff_id'];

try {
    $db = DatabaseConnector::getConnection();

    $db->beginTransaction();

    $checkStmt = $db->prepare('SELECT Status, CreatedAt FROM events WHERE EventID = :id FOR UPDATE');
    $checkStmt->bindValue(':id', $eventId, PDO::PARAM_INT);
    $checkStmt->execute();
    $existingRow = $checkStmt->fetch(PDO::FETCH_ASSOC);
    if (!$existingRow) {
        $db->rollBack();
        http_response_code(404);
        echo json_encode(['error' => 'not_found']);
        exit;
    }

    if ($isProjectRole) {
        $status = strtolower((string) ($existingRow['Status'] ?? 'draft'));
        if (!in_array($status, $allowedStatuses, true)) {
            $status = 'draft';
        }
    }

    if ($refEventId !== null) {
        ensureUniqueRefEventId($db, $refEventId, $eventId);
    }
    
    $updateSql = "
        UPDATE events SET
            EventName = :event_name,
            Status = :status,
            CustomerID = :customer_id,
            StaffID = :staff_id,
            LocationID = :location_id,
            StartDate = :start_date,
            EndDate = :end_date,
            Description = :description,
            Notes = :notes,
            RefEventID = :ref_event_id,
            UpdatedBy = :updated_by
        WHERE EventID = :event_id
    ";

    $stmt = $db->prepare($updateSql);
    $stmt->bindValue(':event_name', $eventName, PDO::PARAM_STR);
    $stmt->bindValue(':status', $status, PDO::PARAM_STR);
    bindNullableInt($stmt, ':customer_id', $customerId);
    bindNullableInt($stmt, ':staff_id', $staffId);
    bindNullableInt($stmt, ':location_id', $locationId);
    bindNullableDateTime($stmt, ':start_date', $startDate);
    bindNullableDateTime($stmt, ':end_date', $endDate);
    bindNullableString($stmt, ':description', $description);
    bindNullableString($stmt, ':notes', $notes);
    bindNullableString($stmt, ':ref_event_id', $refEventId);
    $stmt->bindValue(':updated_by', $updatedBy, PDO::PARAM_INT);
    $stmt->bindValue(':event_id', $eventId, PDO::PARAM_INT);
    $stmt->execute();

    $finalRefEventId = $refEventId;
    if ($finalRefEventId === null) {
        $finalRefEventId = assignGeneratedRefEventId($db, $eventId, $existingRow['CreatedAt'] ?? null);
    }
    
    $detailSql = "
        SELECT
            e.EventID AS event_id,
            e.Status AS status,
            e.UpdatedAt AS updated_at,
            e.CustomerID AS customer_id,
            e.StaffID AS staff_id,
            e.LocationID AS location_id,
            e.UpdatedBy AS updated_by_id,
            c.CustomerName AS customer_name,
            e.RefEventID AS ref_event_id,
            c.CustomerName AS customer_name,
            c.Phone AS customer_phone,
            c.Email AS customer_email,
            l.LocationName AS location_name,
            s.FullName AS staff_name,
            s.Role AS staff_role,
            updated.FullName AS updated_by_name,
            updated.Role AS updated_by_role
        FROM events e
        LEFT JOIN customers c ON c.CustomerID = e.CustomerID
        LEFT JOIN locations l ON l.LocationID = e.LocationID
        LEFT JOIN staffs s ON s.StaffID = e.StaffID
        LEFT JOIN staffs updated ON updated.StaffID = e.UpdatedBy
        WHERE e.EventID = :event_id
        LIMIT 1
    ";

    $detailStmt = $db->prepare($detailSql);
    $detailStmt->bindValue(':event_id', $eventId, PDO::PARAM_INT);
    $detailStmt->execute();
    $row = $detailStmt->fetch(PDO::FETCH_ASSOC);

    $db->commit();
    
    $response = [
        'success' => true,
        'status' => $row['status'] ?? $status,
        'updated_at' => $row['updated_at'] ?? null,
        'customer_id' => isset($row['customer_id']) ? (int) $row['customer_id'] : null,
        'customer_label' => formatCustomerLabel($row['customer_id'] ?? null, $row['customer_name'] ?? null),
        'customer_name' => $row['customer_name'] ?? null,
        'customer_phone' => $row['customer_phone'] ?? null,
        'customer_email' => $row['customer_email'] ?? null,
        'staff_id' => isset($row['staff_id']) ? (int) $row['staff_id'] : null,
        'staff_label' => formatStaffLabel($row['staff_id'] ?? null, $row['staff_name'] ?? null, $row['staff_role'] ?? null),
        'location_id' => isset($row['location_id']) ? (int) $row['location_id'] : null,
        'location_label' => formatLocationLabel($row['location_id'] ?? null, $row['location_name'] ?? null),
        'location_name' => $row['location_name'] ?? null,
        'updated_by_id' => isset($row['updated_by_id']) ? (int) $row['updated_by_id'] : $updatedBy,
        'updated_by_label' => formatStaffLabel($row['updated_by_id'] ?? $updatedBy, $row['updated_by_name'] ?? null, $row['updated_by_role'] ?? null),
        'ref_event_id' => $row['ref_event_id'] ?? $finalRefEventId,
    ];

    echo json_encode($response, JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    if (isset($db) && $db instanceof PDO && $db->inTransaction()) {
        $db->rollBack();
    }
    if ($e instanceof RuntimeException) {
        if ($e->getMessage() === 'ref_event_exists') {
            http_response_code(409);
            echo json_encode(['error' => 'ref_event_exists']);
            return;
        }
        if ($e->getMessage() === 'ref_event_overflow') {
            http_response_code(500);
            echo json_encode(['error' => 'ref_event_capacity_reached']);
            return;
        }
    }
    http_response_code(500);
    echo json_encode(['error' => 'server']);
}

function parseNullableInt($value)
{
    if ($value === null || $value === '') {
        return null;
    }
    if (is_numeric($value)) {
        $int = (int) $value;
        return $int > 0 ? $int : null;
    }
    return null;
}

function trimText($value)
{
    $text = trim((string) $value);
    return $text === '' ? null : $text;
}

function normalizeDateTime($value)
{
    if (!$value) {
        return null;
    }
    $value = str_replace('T', ' ', (string) $value);
    $date = date_create($value);
    if (!$date) {
        return null;
    }
    return $date->format('Y-m-d H:i:s');
}

function bindNullableInt(PDOStatement $stmt, string $parameter, ?int $value)
{
    if ($value === null) {
        $stmt->bindValue($parameter, null, PDO::PARAM_NULL);
    } else {
        $stmt->bindValue($parameter, $value, PDO::PARAM_INT);
    }
}

function bindNullableDateTime(PDOStatement $stmt, string $parameter, ?string $value)
{
    if ($value === null) {
        $stmt->bindValue($parameter, null, PDO::PARAM_NULL);
    } else {
        $stmt->bindValue($parameter, $value, PDO::PARAM_STR);
    }
}

function bindNullableString(PDOStatement $stmt, string $parameter, ?string $value)
{
    if ($value === null || $value === '') {
        $stmt->bindValue($parameter, null, PDO::PARAM_NULL);
    } else {
        $stmt->bindValue($parameter, $value, PDO::PARAM_STR);
    }
}

function sanitizeRefEventId($value)
{
    if ($value === null) {
        return null;
    }
    $text = trim((string) $value);
    if ($text === '') {
        return null;
    }
    if (function_exists('mb_substr')) {
        $text = mb_substr($text, 0, 20, 'UTF-8');
    } else {
        $text = substr($text, 0, 20);
    }
    return $text;
}

function ensureUniqueRefEventId(PDO $db, string $refEventId, int $eventId)
{
    $stmt = $db->prepare('SELECT COUNT(*) FROM events WHERE RefEventID = :ref AND EventID <> :event_id');
    $stmt->bindValue(':ref', $refEventId, PDO::PARAM_STR);
    $stmt->bindValue(':event_id', $eventId, PDO::PARAM_INT);
    $stmt->execute();
    $count = (int) $stmt->fetchColumn();
    if ($count > 0) {
        throw new RuntimeException('ref_event_exists');
    }
}

function assignGeneratedRefEventId(PDO $db, int $eventId, ?string $createdAt)
{
    if ($createdAt === null) {
        $createdStmt = $db->prepare('SELECT CreatedAt FROM events WHERE EventID = :event_id');
        $createdStmt->bindValue(':event_id', $eventId, PDO::PARAM_INT);
        $createdStmt->execute();
        $createdAt = $createdStmt->fetchColumn() ?: null;
    }

    try {
        $created = $createdAt ? new DateTimeImmutable($createdAt) : new DateTimeImmutable();
    } catch (Exception $ex) {
        $created = new DateTimeImmutable();
    }

    $prefix = sprintf('01EV%02d%02d', (int) $created->format('y'), (int) $created->format('m'));

    $seqStmt = $db->prepare('SELECT MAX(CAST(SUBSTRING(RefEventID, 9, 4) AS UNSIGNED)) AS seq FROM events WHERE RefEventID LIKE :prefix FOR UPDATE');
    $seqStmt->bindValue(':prefix', $prefix . '%', PDO::PARAM_STR);
    $seqStmt->execute();
    $current = (int) $seqStmt->fetchColumn();
    if ($current >= 9999) {
        throw new RuntimeException('ref_event_overflow');
    }
    $next = $current + 1;
    $refEventId = $prefix . str_pad((string) $next, 4, '0', STR_PAD_LEFT);

    $updateStmt = $db->prepare('UPDATE events SET RefEventID = :ref WHERE EventID = :event_id');
    $updateStmt->bindValue(':ref', $refEventId, PDO::PARAM_STR);
    $updateStmt->bindValue(':event_id', $eventId, PDO::PARAM_INT);
    $updateStmt->execute();

    return $refEventId;
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