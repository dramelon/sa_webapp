<?php
require_once __DIR__ . '/database_connector.php';
require_once __DIR__ . '/audit_log.php';

session_start();
header('Content-Type: application/json; charset=utf-8');

function tableExists(PDO $db, string $tableName): bool
{
    $stmt = $db->prepare(
        'SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = :table LIMIT 1'
    );
    $stmt->bindValue(':table', $tableName, PDO::PARAM_STR);
    $stmt->execute();

    return (bool) $stmt->fetchColumn();
}

function deleteRemovedFulfillmentUnits(PDO $db, int $fulfillmentId, int $requestLineId, array $existingByUnit, array $removedUnitIds): void
{
    if (empty($removedUnitIds)) {
        return;
    }

    $lineIdsToDelete = [];
    foreach ($removedUnitIds as $unitId) {
        if (isset($existingByUnit[$unitId])) {
            $lineIdsToDelete[] = $existingByUnit[$unitId];
        }
    }

    if (!empty($lineIdsToDelete)) {
        $placeholders = implode(', ', array_fill(0, count($lineIdsToDelete), '?'));
        $deleteStmt = $db->prepare(
            "DELETE FROM request_fulfillment_line WHERE RequestFulfillmentID = ? AND RequestFulfillmentLineID IN ($placeholders)"
        );
        $deleteStmt->bindValue(1, $fulfillmentId, PDO::PARAM_INT);
        foreach (array_values($lineIdsToDelete) as $idx => $lineIdToDelete) {
            $deleteStmt->bindValue($idx + 2, $lineIdToDelete, PDO::PARAM_INT);
        }
        $deleteStmt->execute();
    }

    $unitIdsToDelete = array_values(array_intersect(array_keys($existingByUnit), $removedUnitIds));
    if (!empty($unitIdsToDelete)) {
        $unitPlaceholders = implode(', ', array_fill(0, count($unitIdsToDelete), '?'));
        $deleteBookingSql = "DELETE FROM booking WHERE RequestAllocationID = ? AND ItemUnitID IN ($unitPlaceholders)";
        $deleteBookingStmt = $db->prepare($deleteBookingSql);
        $deleteBookingStmt->bindValue(1, $requestLineId, PDO::PARAM_INT);
        foreach ($unitIdsToDelete as $idx => $unitId) {
            $deleteBookingStmt->bindValue($idx + 2, $unitId, PDO::PARAM_INT);
        }
        $deleteBookingStmt->execute();
    }
}

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

$requestLineId = isset($input['request_line_id']) ? (int) $input['request_line_id'] : 0;
if ($requestLineId <= 0) {
    http_response_code(400);
    echo json_encode(['error' => 'invalid_request_line_id', 'message' => 'ไม่พบบรรทัดคำขอที่ต้องการบันทึก']);
    exit;
}

$note = trim((string) ($input['note'] ?? ''));
if ($note === '') {
    $note = null;
} else {
    $note = mb_substr($note, 0, 2000, 'UTF-8');
}

$linesInput = $input['lines'] ?? [];
if (!is_array($linesInput)) {
    http_response_code(400);
    echo json_encode(['error' => 'invalid_lines', 'message' => 'ข้อมูลรายการไม่ถูกต้อง']);
    exit;
}

$allowedSources = ['inventory', 'customer_provided', 'other'];
$cleanLines = [];
foreach ($linesInput as $index => $line) {
    if (!is_array($line)) {
        http_response_code(400);
        echo json_encode(['error' => 'invalid_line', 'message' => sprintf('รูปแบบรายการที่ %d ไม่ถูกต้อง', $index + 1)]);
        exit;
    }
    $itemUnitId = isset($line['item_unit_id']) ? (int) $line['item_unit_id'] : 0;
    if ($itemUnitId <= 0) {
        http_response_code(400);
        echo json_encode(['error' => 'invalid_item_unit', 'message' => sprintf('กรุณาเลือก Item Unit ในรายการที่ %d', $index + 1)]);
        exit;
    }
    $sourceType = strtolower((string) ($line['source_type'] ?? 'inventory'));
    if (!in_array($sourceType, $allowedSources, true)) {
        $sourceType = 'inventory';
    }

    $cleanLines[$itemUnitId] = [
        'item_unit_id' => $itemUnitId,
        'source_type' => $sourceType,
        'return_customer_flag' => !empty($line['return_customer_flag']),
        'paid_excluded_flag' => !empty($line['paid_excluded_flag']),
    ];
}

$db = null;

try {
    $db = DatabaseConnector::getConnection();

    $lineStmt = $db->prepare(
        "SELECT
            rl.RequestLineID,
            rl.RequestID,
            r.EventID,
            rl.QuantityRequested,
            e.StartDate,
            e.EndDate
        FROM request_lines rl
        INNER JOIN requests r ON r.RequestID = rl.RequestID
        INNER JOIN events e ON e.EventID = r.EventID
        WHERE rl.RequestLineID = :request_line_id
            AND rl.Status <> 'deleted'
        LIMIT 1"
    );
    $lineStmt->bindValue(':request_line_id', $requestLineId, PDO::PARAM_INT);
    $lineStmt->execute();
    $lineRow = $lineStmt->fetch(PDO::FETCH_ASSOC);

    if (!$lineRow) {
        http_response_code(404);
        echo json_encode(['error' => 'not_found', 'message' => 'ไม่พบบรรทัดคำขอที่ต้องการบันทึก']);
        exit;
    }

    if (!tableExists($db, 'booking')) {
        http_response_code(500);
        echo json_encode([
            'error' => 'booking_table_missing',
            'message' => 'ไม่พบตาราง booking กรุณาสร้างตารางก่อนทำการบันทึก',
        ]);
        exit;
    }

    $eventStartRaw = $lineRow['StartDate'] ?? null;
    $eventEndRaw = $lineRow['EndDate'] ?? null;
    $now = date('Y-m-d H:i:s');
    $startTimestamp = $eventStartRaw ? strtotime($eventStartRaw) : false;
    $endTimestamp = $eventEndRaw ? strtotime($eventEndRaw) : false;

    if ($startTimestamp === false) {
        $eventStart = $now;
        $startTimestamp = strtotime($eventStart);
    } else {
        $eventStart = date('Y-m-d H:i:s', $startTimestamp);
    }

    if ($endTimestamp === false || $endTimestamp < $startTimestamp) {
        $eventEnd = $eventStart;
    } else {
        $eventEnd = date('Y-m-d H:i:s', $endTimestamp);
    }

    $db->beginTransaction();

    $fulfillmentStmt = $db->prepare('SELECT RequestFulfillmentID FROM request_fulfillment WHERE RequestLineID = :request_line_id LIMIT 1');
    $fulfillmentStmt->bindValue(':request_line_id', $requestLineId, PDO::PARAM_INT);
    $fulfillmentStmt->execute();
    $fulfillmentId = $fulfillmentStmt->fetchColumn();

    if ($fulfillmentId) {
        $updateFulfillment = $db->prepare('UPDATE request_fulfillment SET Note = :note WHERE RequestFulfillmentID = :id');
        $updateFulfillment->bindValue(':note', $note, $note === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
        $updateFulfillment->bindValue(':id', $fulfillmentId, PDO::PARAM_INT);
        $updateFulfillment->execute();
    } else {
        $insertFulfillment = $db->prepare('INSERT INTO request_fulfillment (RequestLineID, Note) VALUES (:request_line_id, :note)');
        $insertFulfillment->bindValue(':request_line_id', $requestLineId, PDO::PARAM_INT);
        $insertFulfillment->bindValue(':note', $note, $note === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
        $insertFulfillment->execute();
        $fulfillmentId = (int) $db->lastInsertId();
    }

    $currentLineStmt = $db->prepare('SELECT RequestFulfillmentLineID, ItemUnitID FROM request_fulfillment_line WHERE RequestFulfillmentID = :fulfillment_id');
    $currentLineStmt->bindValue(':fulfillment_id', $fulfillmentId, PDO::PARAM_INT);
    $currentLineStmt->execute();
    $existingLines = $currentLineStmt->fetchAll(PDO::FETCH_ASSOC);

    $existingByUnit = [];
    foreach ($existingLines as $line) {
        if ($line['ItemUnitID'] !== null) {
            $existingByUnit[(int) $line['ItemUnitID']] = (int) $line['RequestFulfillmentLineID'];
        }
    }

    $selectedUnitIds = array_keys($cleanLines);
    $removedUnitIds = array_values(array_diff(array_keys($existingByUnit), $selectedUnitIds));
    deleteRemovedFulfillmentUnits($db, (int) $fulfillmentId, $requestLineId, $existingByUnit, $removedUnitIds);

    foreach ($cleanLines as $itemUnitId => $line) {
        if (isset($existingByUnit[$itemUnitId])) {
            $updateLine = $db->prepare(
                'UPDATE request_fulfillment_line
                SET SourceType = :source_type,
                    ReturnCustomerFlag = :return_flag,
                    PaidExcludedFlag = :paid_flag
                WHERE RequestFulfillmentLineID = :line_id'
            );
            $updateLine->bindValue(':source_type', $line['source_type'], PDO::PARAM_STR);
            $updateLine->bindValue(':return_flag', $line['return_customer_flag'] ? 1 : 0, PDO::PARAM_INT);
            $updateLine->bindValue(':paid_flag', $line['paid_excluded_flag'] ? 1 : 0, PDO::PARAM_INT);
            $updateLine->bindValue(':line_id', $existingByUnit[$itemUnitId], PDO::PARAM_INT);
            $updateLine->execute();
        } else {
            $insertLine = $db->prepare(
                'INSERT INTO request_fulfillment_line (RequestFulfillmentID, ItemUnitID, SourceType, ReturnCustomerFlag, PaidExcludedFlag)
                VALUES (:fulfillment_id, :item_unit_id, :source_type, :return_flag, :paid_flag)'
            );
            $insertLine->bindValue(':fulfillment_id', $fulfillmentId, PDO::PARAM_INT);
            $insertLine->bindValue(':item_unit_id', $itemUnitId, PDO::PARAM_INT);
            $insertLine->bindValue(':source_type', $line['source_type'], PDO::PARAM_STR);
            $insertLine->bindValue(':return_flag', $line['return_customer_flag'] ? 1 : 0, PDO::PARAM_INT);
            $insertLine->bindValue(':paid_flag', $line['paid_excluded_flag'] ? 1 : 0, PDO::PARAM_INT);
            $insertLine->execute();
        }
    }

    $bookingStmt = $db->prepare('SELECT BookingID, ItemUnitID, StartTime, EndTime FROM booking WHERE RequestAllocationID = :request_line_id');
    $bookingStmt->bindValue(':request_line_id', $requestLineId, PDO::PARAM_INT);
    $bookingStmt->execute();
    $existingBookings = $bookingStmt->fetchAll(PDO::FETCH_ASSOC);

    $bookingByUnit = [];
    $duplicateBookings = [];
    foreach ($existingBookings as $booking) {
        $unitId = (int) $booking['ItemUnitID'];
        if (!isset($bookingByUnit[$unitId])) {
            $bookingByUnit[$unitId] = $booking;
        } else {
            $duplicateBookings[] = (int) $booking['BookingID'];
        }
    }

    $bookingsToDelete = $duplicateBookings;
    foreach ($bookingByUnit as $unitId => $booking) {
        if (!in_array($unitId, $selectedUnitIds, true)) {
            $bookingsToDelete[] = (int) $booking['BookingID'];
        }
    }

    if ($bookingsToDelete) {
        $deletePlaceholders = implode(', ', array_fill(0, count($bookingsToDelete), '?'));
        $deleteBookingStmt = $db->prepare("DELETE FROM booking WHERE BookingID IN ($deletePlaceholders)");
        foreach (array_values($bookingsToDelete) as $idx => $bookingId) {
            $deleteBookingStmt->bindValue($idx + 1, $bookingId, PDO::PARAM_INT);
        }
        $deleteBookingStmt->execute();
    }

    foreach ($cleanLines as $itemUnitId => $line) {
        if (isset($bookingByUnit[$itemUnitId])) {
            $booking = $bookingByUnit[$itemUnitId];
            if ($booking['StartTime'] !== $eventStart || $booking['EndTime'] !== $eventEnd) {
                $updateBooking = $db->prepare(
                    'UPDATE booking SET StartTime = :start_time, EndTime = :end_time WHERE BookingID = :booking_id'
                );
                $updateBooking->bindValue(':start_time', $eventStart, PDO::PARAM_STR);
                $updateBooking->bindValue(':end_time', $eventEnd, PDO::PARAM_STR);
                $updateBooking->bindValue(':booking_id', $booking['BookingID'], PDO::PARAM_INT);
                $updateBooking->execute();
            }
        } else {
            $insertBooking = $db->prepare(
                'INSERT INTO booking (RequestAllocationID, ItemUnitID, StartTime, EndTime, ScheduleStatus, Note, Status)
                VALUES (:allocation_id, :item_unit_id, :start_time, :end_time, :schedule_status, :note, :status)'
            );
            $insertBooking->bindValue(':allocation_id', $requestLineId, PDO::PARAM_INT);
            $insertBooking->bindValue(':item_unit_id', $itemUnitId, PDO::PARAM_INT);
            $insertBooking->bindValue(':start_time', $eventStart, PDO::PARAM_STR);
            $insertBooking->bindValue(':end_time', $eventEnd, PDO::PARAM_STR);
            $insertBooking->bindValue(':schedule_status', 'event_use', PDO::PARAM_STR);
            $insertBooking->bindValue(':note', 'Generated from fulfillment save', PDO::PARAM_STR);
            $insertBooking->bindValue(':status', 'confirmed', PDO::PARAM_STR);
            $insertBooking->execute();
        }
    }

    // Update fulfillment status on the request line
    $quantityRequested = (int) $lineRow['QuantityRequested'];
    $quantityFulfilled = count($cleanLines);
    $fulfillmentStatus = 'pending';
    if ($quantityFulfilled >= $quantityRequested) {
        $fulfillmentStatus = 'fulfilled';
    } elseif ($quantityFulfilled > 0) {
        $fulfillmentStatus = 'partial';
    }

    $updateLineStatus = $db->prepare('UPDATE request_lines SET FulfillmentStatus = :status WHERE RequestLineID = :id');
    $updateLineStatus->execute([':status' => $fulfillmentStatus, ':id' => $requestLineId]);

    // Add a more descriptive audit log
    $staffId = (int) $_SESSION['staff_id'];
    $reason = sprintf(
        'บันทึกการจ่ายของให้รายการ #%d จำนวน %d หน่วย (จากที่ขอ %d). สถานะใหม่: %s.',
        $requestLineId,
        $quantityFulfilled,
        $quantityRequested,
        $fulfillmentStatus
    );
    recordAuditEvent($db, 'request', (int) $lineRow['RequestID'], 'UPDATE', $staffId, $reason);

    $db->commit();

    echo json_encode(['data' => ['request_fulfillment_id' => (int) $fulfillmentId]], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    if ($db && $db->inTransaction()) {
        $db->rollBack();
    }
    error_log('request_fulfillment_save failed: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'server_error', 'message' => 'ไม่สามารถบันทึกข้อมูลการจ่ายได้']);
}
