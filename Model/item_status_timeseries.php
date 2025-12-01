<?php
require_once __DIR__ . '/database_connector.php';

session_start();
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'method_not_allowed']);
    exit;
}

$itemId = isset($_GET['item_id']) ? (int) $_GET['item_id'] : 0;
if ($itemId <= 0) {
    http_response_code(400);
    echo json_encode(['error' => 'invalid_item_id']);
    exit;
}

$monthParam = isset($_GET['month']) ? trim((string) $_GET['month']) : '';
$month = new DateTimeImmutable('first day of this month 00:00:00');
if ($monthParam !== '' && preg_match('/^(\d{4})-(\d{2})$/', $monthParam, $matches)) {
    [$all, $year, $monthNum] = $matches;
    if (checkdate((int) $monthNum, 1, (int) $year)) {
        $month = new DateTimeImmutable(sprintf('%04d-%02d-01 00:00:00', $year, $monthNum));
    }
}

function tableExists(PDO $db, string $tableName): bool
{
    $stmt = $db->prepare(
        'SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = :table LIMIT 1'
    );
    $stmt->bindValue(':table', $tableName, PDO::PARAM_STR);
    $stmt->execute();

    return (bool) $stmt->fetchColumn();
}

function categorizeStatus(?string $status): ?string
{
    switch ($status) {
        case 'in use':
        case 'pending booking':
        case 'booked':
        case 'delivering':
            return 'in_use';
        case 'reparing':
        case 'damaged':
        case 'archived':
        case 'depreciated':
            return 'maintenance';
        default:
            return null;
    }
}

$maintenanceScheduleTypes = [
    'maintenance_repair',
    'maintenance_preventive',
    'inspection_test',
    'cleaning',
];

try {
    $db = DatabaseConnector::getConnection();

    $rangeStart = $month;
    $rangeEnd = $month->modify('first day of next month');
    $daysInMonth = (int) $rangeStart->format('t');

    $unitStmt = $db->prepare('SELECT ItemUnitID, Status FROM item_units WHERE ItemID = :item_id');
    $unitStmt->bindValue(':item_id', $itemId, PDO::PARAM_INT);
    $unitStmt->execute();
    $units = $unitStmt->fetchAll(PDO::FETCH_ASSOC);

    $totalUnits = count($units);
    $dailyStates = array_fill(0, $daysInMonth, ['in_use' => [], 'maintenance' => []]);

    foreach ($units as $unit) {
        $unitId = (int) $unit['ItemUnitID'];
        $statusCategory = categorizeStatus($unit['Status'] ?? null);
        if ($statusCategory) {
            foreach ($dailyStates as $index => $day) {
                $dailyStates[$index][$statusCategory][$unitId] = true;
            }
        }
    }

    if (tableExists($db, 'booking')) {
        $bookingSql = "
            SELECT b.ItemUnitID, b.StartTime, b.EndTime, b.ScheduleStatus
            FROM booking b
            INNER JOIN item_units iu ON iu.ItemUnitID = b.ItemUnitID
            WHERE iu.ItemID = :item_id
                AND b.StartTime < :range_end
                AND b.EndTime >= :range_start
        ";
        $bookingStmt = $db->prepare($bookingSql);
        $bookingStmt->bindValue(':item_id', $itemId, PDO::PARAM_INT);
        $bookingStmt->bindValue(':range_start', $rangeStart->format('Y-m-d H:i:s'), PDO::PARAM_STR);
        $bookingStmt->bindValue(':range_end', $rangeEnd->format('Y-m-d H:i:s'), PDO::PARAM_STR);
        $bookingStmt->execute();
        $bookings = $bookingStmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($bookings as $booking) {
            $unitId = (int) $booking['ItemUnitID'];
            $isMaintenance = in_array($booking['ScheduleStatus'], $maintenanceScheduleTypes, true);
            $bookingStart = new DateTimeImmutable($booking['StartTime']);
            $bookingEnd = new DateTimeImmutable($booking['EndTime']);

            $cursor = $rangeStart;
            for ($i = 0; $i < $daysInMonth; $i++) {
                $dayStart = $cursor;
                $dayEnd = $cursor->modify('+1 day');
                if ($bookingStart < $dayEnd && $bookingEnd >= $dayStart) {
                    $key = $isMaintenance ? 'maintenance' : 'in_use';
                    $dailyStates[$i][$key][$unitId] = true;
                }
                $cursor = $dayEnd;
            }
        }
    }

    $days = [];
    $cursor = $rangeStart;
    for ($i = 0; $i < $daysInMonth; $i++) {
        $inUse = count($dailyStates[$i]['in_use']);
        $maintenance = count($dailyStates[$i]['maintenance']);
        $available = max($totalUnits - $inUse - $maintenance, 0);
        $days[] = [
            'date' => $cursor->format('Y-m-d'),
            'available' => $available,
            'in_use' => $inUse,
            'maintenance' => $maintenance,
            'total' => $totalUnits,
        ];
        $cursor = $cursor->modify('+1 day');
    }

    $payload = [
        'month' => $rangeStart->format('Y-m'),
        'start_date' => $rangeStart->format('Y-m-d'),
        'end_date' => $rangeEnd->modify('-1 day')->format('Y-m-d'),
        'days' => $days,
    ];

    echo json_encode(['data' => $payload], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(500);
    error_log('Error in item_status_timeseries.php: ' . $e->getMessage());
    echo json_encode(['error' => 'server']);
}
