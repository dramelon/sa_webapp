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

$eventName = trim((string) ($input['event_name'] ?? ''));
if ($eventName === '') {
    http_response_code(400);
    echo json_encode(['error' => 'missing_event_name']);
    exit;
}

$allowedStatuses = ['draft', 'planning', 'waiting', 'processing', 'billing', 'completed', 'cancelled'];
$statusInput = strtolower((string) ($input['status'] ?? 'draft'));
$status = in_array($statusInput, $allowedStatuses, true) ? $statusInput : 'draft';
$isProjectRole = isset($_SESSION['role']) && strtolower((string) $_SESSION['role']) === 'project';
if ($isProjectRole) {
    $status = 'draft';
}

$customerId = parseNullableInt($input['customer_id'] ?? null);
$staffId = parseNullableInt($input['staff_id'] ?? null);
$locationId = parseNullableInt($input['location_id'] ?? null);
$startDate = normalizeDateTime($input['start_date'] ?? null);
$endDate = normalizeDateTime($input['end_date'] ?? null);
$description = trimText($input['description'] ?? '');
$notes = trimText($input['notes'] ?? '');
$refEventId = sanitizeRefEventId($input['ref_event_id'] ?? null);

$createdBy = (int) $_SESSION['staff_id'];
if ($staffId === null) {
    $staffId = $createdBy;
}

try {
    $db = new PDO(
        'mysql:host=localhost;dbname=sa_webapp;charset=utf8mb4',
        'dramelon',
        'dramelon',
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );

    $db->beginTransaction();

    if ($refEventId !== null) {
        ensureUniqueRefEventId($db, $refEventId, null);
    }

    $sql = "
        INSERT INTO events (
            EventName,
            Status,
            CustomerID,
            StaffID,
            LocationID,
            StartDate,
            EndDate,
            Description,
            Notes,
            CreatedBy,
            RefEventID,
            UpdatedBy
        ) VALUES (
            :event_name,
            :status,
            :customer_id,
            :staff_id,
            :location_id,
            :start_date,
            :end_date,
            :description,
            :notes,
            :ref_event_id,
            :created_by,
            :updated_by
        )
    ";

    $stmt = $db->prepare($sql);
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
    $stmt->bindValue(':created_by', $createdBy, PDO::PARAM_INT);
    $stmt->bindValue(':updated_by', $createdBy, PDO::PARAM_INT);
    $stmt->execute();

    $eventId = (int) $db->lastInsertId();

    $assignedRefEventId = $refEventId;
    if ($assignedRefEventId === null) {
        $assignedRefEventId = assignGeneratedRefEventId($db, $eventId, null);
    }

    $db->commit();
    
    echo json_encode([
        'success' => true,
        'event_id' => $eventId,
        'status' => $status,
    'ref_event_id' => $assignedRefEventId,
    ], JSON_UNESCAPED_UNICODE);
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
    if ($value === null) {
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

function ensureUniqueRefEventId(PDO $db, string $refEventId, ?int $excludeEventId)
{
    $sql = 'SELECT COUNT(*) FROM events WHERE RefEventID = :ref';
    if ($excludeEventId !== null) {
        $sql .= ' AND EventID <> :event_id';
    }
    $stmt = $db->prepare($sql);
    $stmt->bindValue(':ref', $refEventId, PDO::PARAM_STR);
    if ($excludeEventId !== null) {
        $stmt->bindValue(':event_id', $excludeEventId, PDO::PARAM_INT);
    }
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