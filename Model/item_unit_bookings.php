<?php
require_once __DIR__ . '/database_connector.php';

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

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'method_not_allowed']);
    exit;
}

$itemUnitId = isset($_GET['item_unit_id']) ? (int) $_GET['item_unit_id'] : 0;
if ($itemUnitId <= 0) {
    http_response_code(400);
    echo json_encode(['error' => 'invalid_item_unit_id']);
    exit;
}

$monthParam = isset($_GET['month']) ? trim($_GET['month']) : '';
$month = new DateTimeImmutable('first day of this month 00:00:00');

if ($monthParam !== '' && preg_match('/^(\d{4})-(\d{2})$/', $monthParam, $matches)) {
    [$all, $year, $monthNum] = $matches;
    if (checkdate((int) $monthNum, 1, (int) $year)) {
        $month = new DateTimeImmutable(sprintf('%04d-%02d-01 00:00:00', $year, $monthNum));
    }
}

try {
    $db = DatabaseConnector::getConnection();

    if (!tableExists($db, 'booking')) {
        http_response_code(503);
        echo json_encode(['error' => 'booking_table_missing']);
        exit;
    }

    $rangeStart = $month;
    $rangeEnd = $month->modify('first day of next month');

    $sql = "
        SELECT
            b.BookingID,
            b.RequestAllocationID,
            b.ItemUnitID,
            b.StartTime,
            b.EndTime,
            b.Note,
            b.ScheduleStatus,
            b.Status,
            e.EventID,
            e.EventName,
            e.RefEventID
        FROM booking b
        LEFT JOIN request_lines rl ON rl.RequestLineID = b.RequestAllocationID
        LEFT JOIN requests r ON r.RequestID = rl.RequestID
        LEFT JOIN events e ON e.EventID = r.EventID
        WHERE b.ItemUnitID = :item_unit_id
            AND b.StartTime < :range_end
            AND b.EndTime >= :range_start
        ORDER BY b.StartTime ASC
    ";

    $stmt = $db->prepare($sql);
    $stmt->bindValue(':item_unit_id', $itemUnitId, PDO::PARAM_INT);
    $stmt->bindValue(':range_start', $rangeStart->format('Y-m-d H:i:s'), PDO::PARAM_STR);
    $stmt->bindValue(':range_end', $rangeEnd->format('Y-m-d H:i:s'), PDO::PARAM_STR);
    $stmt->execute();

    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $bookings = array_map(
        function ($row) {
            return [
                'booking_id' => (int) $row['BookingID'],
                'request_allocation_id' => (int) $row['RequestAllocationID'],
                'item_unit_id' => (int) $row['ItemUnitID'],
                'start_time' => $row['StartTime'],
                'end_time' => $row['EndTime'],
                'note' => $row['Note'],
                'schedule_status' => $row['ScheduleStatus'] ?? null,
                'status' => $row['Status'],
                'event_id' => isset($row['EventID']) ? (int) $row['EventID'] : null,
                'event_name' => $row['EventName'] ?? null,
                'event_code' => $row['RefEventID'] ?? null,
            ];
        },
        $rows
    );

    $payload = [
        'month' => $rangeStart->format('Y-m'),
        'start_date' => $rangeStart->format('Y-m-d'),
        'end_date' => $rangeEnd->modify('-1 day')->format('Y-m-d'),
        'bookings' => $bookings,
    ];

    echo json_encode(['data' => $payload], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'server']);
}
