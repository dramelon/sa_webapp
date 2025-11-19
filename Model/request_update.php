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
    echo json_encode(['error' => 'invalid_payload', 'message' => 'รูปแบบข้อมูลไม่ถูกต้อง']);
    exit;
}

$requestId = isset($input['request_id']) ? (int) $input['request_id'] : 0;
if ($requestId <= 0) {
    http_response_code(400);
    echo json_encode(['error' => 'invalid_request', 'message' => 'ไม่พบคำขอที่ต้องการบันทึก']);
    exit;
}

$eventId = isset($input['event_id']) ? (int) $input['event_id'] : 0;
if ($eventId <= 0) {
    http_response_code(400);
    echo json_encode(['error' => 'invalid_event', 'message' => 'ไม่พบอีเว้นที่ต้องการบันทึกคำขอ']);
    exit;
}

$requestName = trim((string) ($input['request_name'] ?? ''));
if ($requestName === '') {
    http_response_code(400);
    echo json_encode(['error' => 'missing_request_name', 'message' => 'กรุณาระบุชื่อคำขอ']);
    exit;
}
$requestName = mb_substr($requestName, 0, 200, 'UTF-8');
$note = trim((string) ($input['note'] ?? ''));

$allowedStatuses = ['draft', 'submitted', 'approved', 'closed', 'cancelled'];
$statusInput = strtolower((string) ($input['status'] ?? 'draft'));
$status = in_array($statusInput, $allowedStatuses, true) ? $statusInput : 'draft';

$linesInput = $input['lines'] ?? [];
if (!is_array($linesInput) || empty($linesInput)) {
    http_response_code(400);
    echo json_encode(['error' => 'missing_lines', 'message' => 'กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ']);
    exit;
}

$cleanLines = [];
foreach ($linesInput as $index => $line) {
    if (!is_array($line)) {
        http_response_code(400);
        echo json_encode(['error' => 'invalid_line', 'message' => 'ข้อมูลรายการสินค้าไม่ถูกต้อง']);
        exit;
    }
    $itemId = isset($line['item_id']) ? (int) $line['item_id'] : 0;
    if ($itemId <= 0) {
        http_response_code(400);
        echo json_encode(['error' => 'invalid_line_item', 'message' => sprintf('กรุณาเลือกสินค้าในรายการที่ %d', $index + 1)]);
        exit;
    }
    $quantity = isset($line['quantity']) ? (int) $line['quantity'] : 0;
    if ($quantity <= 0) {
        http_response_code(400);
        echo json_encode(['error' => 'invalid_line_quantity', 'message' => sprintf('จำนวนต้องมากกว่า 0 ในรายการที่ %d', $index + 1)]);
        exit;
    }
    $note = trim((string) ($line['note'] ?? ''));
    if ($note !== '') {
        $note = mb_substr($note, 0, 500, 'UTF-8');
    } else {
        $note = null;
    }
    $cleanLines[] = [
        'item_id' => $itemId,
        'quantity' => $quantity,
        'note' => $note,
    ];
}

$updatedBy = (int) $_SESSION['staff_id'];

try {
    $db = DatabaseConnector::getConnection();

    $db->beginTransaction();

    $requestStmt = $db->prepare('SELECT RequestID, EventID FROM requests WHERE RequestID = :request_id LIMIT 1');
    $requestStmt->execute([':request_id' => $requestId]);
    $requestRow = $requestStmt->fetch(PDO::FETCH_ASSOC);
    if (!$requestRow) {
        $db->rollBack();
        http_response_code(404);
        echo json_encode(['error' => 'not_found', 'message' => 'ไม่พบคำขอที่ต้องการบันทึก']);
        exit;
    }

    $requestEventId = (int) $requestRow['EventID'];
    if ($requestEventId !== $eventId) {
        $db->rollBack();
        http_response_code(400);
        echo json_encode(['error' => 'event_mismatch', 'message' => 'คำขอไม่ตรงกับอีเว้นที่เลือก']);
        exit;
    }

    $eventStmt = $db->prepare('SELECT StartDate, EndDate FROM events WHERE EventID = :event_id LIMIT 1');
    $eventStmt->execute([':event_id' => $eventId]);
    $eventRow = $eventStmt->fetch(PDO::FETCH_ASSOC);
    if (!$eventRow) {
        $db->rollBack();
        http_response_code(404);
        echo json_encode(['error' => 'event_not_found', 'message' => 'ไม่พบอีเว้นที่ต้องการบันทึกคำขอ']);
        exit;
    }

    $eventStartRaw = $eventRow['StartDate'] ?? null;
    $eventEndRaw = $eventRow['EndDate'] ?? null;
    $fallbackNow = date('Y-m-d H:i:s');
    $startTimestamp = $eventStartRaw ? strtotime($eventStartRaw) : false;
    if ($startTimestamp === false) {
        $eventStart = $fallbackNow;
        $startTimestamp = strtotime($eventStart);
    } else {
        $eventStart = date('Y-m-d H:i:s', $startTimestamp);
    }
    $endTimestamp = $eventEndRaw ? strtotime($eventEndRaw) : false;
    if ($endTimestamp === false || $endTimestamp < $startTimestamp) {
        $eventEnd = $eventStart;
    } else {
        $eventEnd = date('Y-m-d H:i:s', $endTimestamp);
    }

    $updateRequest = $db->prepare('UPDATE requests SET RequestName = :name, Status = :status, Note = :note WHERE RequestID = :request_id');
    $updateRequest->execute([
        ':name' => $requestName,
        ':status' => $status,
        ':note' => $note ?: null,
        ':request_id' => $requestId,
    ]);

    $deleteLines = $db->prepare('DELETE FROM request_lines WHERE RequestID = :request_id');
    $deleteLines->execute([':request_id' => $requestId]);

    $insertLine = $db->prepare('INSERT INTO request_lines (RequestID, LineNo, ItemID, QuantityRequested, StartTime, EndTime, FulfillmentStatus, Note, Status) VALUES (:request_id, :line_no, :item_id, :quantity, :start_time, :end_time, :fulfillment_status, :note, :status)');
    foreach ($cleanLines as $lineNo => $line) {
        $insertLine->execute([
            ':request_id' => $requestId,
            ':line_no' => $lineNo + 1,
            ':item_id' => $line['item_id'],
            ':quantity' => $line['quantity'],
            ':start_time' => $eventStart,
            ':end_time' => $eventEnd,
            ':fulfillment_status' => 'pending',
            ':note' => $line['note'],
            ':status' => 'active',
        ]);
    }

    recordAuditEvent($db, 'request', $requestId, 'UPDATE', $updatedBy);

    $db->commit();

    echo json_encode([
        'success' => true,
        'request_id' => $requestId,
        'status' => $status,
    ], JSON_UNESCAPED_UNICODE);
} catch (PDOException $e) {
    if (isset($db) && $db instanceof PDO && $db->inTransaction()) {
        $db->rollBack();
    }
    http_response_code(500);
    echo json_encode(['error' => 'database_error', 'message' => 'ไม่สามารถบันทึกคำขอได้']);
} catch (Throwable $e) {
    if (isset($db) && $db instanceof PDO && $db->inTransaction()) {
        $db->rollBack();
    }
    http_response_code(500);
    echo json_encode(['error' => 'server_error', 'message' => 'ระบบไม่สามารถบันทึกคำขอได้']);
}