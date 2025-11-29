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

$requestLineId = isset($_GET['request_line_id']) ? (int) $_GET['request_line_id'] : 0;
if ($requestLineId <= 0) {
    http_response_code(400);
    echo json_encode(['error' => 'invalid_request_line_id', 'message' => 'รหัสบรรทัดคำขอไม่ถูกต้อง']);
    exit;
}

try {
    $db = DatabaseConnector::getConnection();

    $sql = "
        SELECT
            rl.RequestLineID,
            rl.RequestID,
            rl.LineNo,
            rl.ItemID,
            rl.QuantityRequested,
            rl.FulfillmentStatus,
            rl.Note AS line_note,
            r.EventID,
            e.EventName,
            e.RefEventID,
            e.StartDate,
            e.EndDate,
            i.ItemName,
            i.RefItemID,
            i.Rate,
            i.Period,
            i.UOM,
            i.Brand,
            i.Model,
            c.Name AS category_name
        FROM request_lines rl
        INNER JOIN requests r ON r.RequestID = rl.RequestID
        INNER JOIN events e ON e.EventID = r.EventID
        LEFT JOIN items i ON i.ItemID = rl.ItemID
        LEFT JOIN itemcategorys c ON c.ItemCategoryID = i.ItemCategoryID
        WHERE rl.RequestLineID = :request_line_id
            AND rl.Status <> 'deleted'
        LIMIT 1
    ";

    $stmt = $db->prepare($sql);
    $stmt->bindValue(':request_line_id', $requestLineId, PDO::PARAM_INT);
    $stmt->execute();
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$row) {
        http_response_code(404);
        echo json_encode(['error' => 'not_found', 'message' => 'ไม่พบบรรทัดคำขอที่ระบุ']);
        exit;
    }

    $fulfillmentStmt = $db->prepare('SELECT RequestFulfillmentID, Note FROM request_fulfillment WHERE RequestLineID = :request_line_id LIMIT 1');
    $fulfillmentStmt->bindValue(':request_line_id', $requestLineId, PDO::PARAM_INT);
    $fulfillmentStmt->execute();
    $fulfillmentRow = $fulfillmentStmt->fetch(PDO::FETCH_ASSOC);

    $fulfillmentId = $fulfillmentRow['RequestFulfillmentID'] ?? null;
    $fulfillmentNote = $fulfillmentRow['Note'] ?? null;
    $fulfillmentLines = [];

    if ($fulfillmentId) {
        $lineStmt = $db->prepare(
            'SELECT
                rfl.RequestFulfillmentLineID,
                rfl.ItemUnitID,
                rfl.SourceType,
                rfl.Note,
                rfl.ReturnCustomerFlag,
                rfl.PaidExcludedFlag,
                iu.ItemID,
                iu.SerialNumber,
                iu.Status,
                iu.WarehouseID,
                w.WarehouseName
            FROM request_fulfillment_line rfl
            LEFT JOIN item_units iu ON iu.ItemUnitID = rfl.ItemUnitID
            LEFT JOIN warehouse w ON w.WarehouseID = iu.WarehouseID
            WHERE rfl.RequestFulfillmentID = :fulfillment_id
            ORDER BY rfl.RequestFulfillmentLineID ASC'
        );
        $lineStmt->bindValue(':fulfillment_id', $fulfillmentId, PDO::PARAM_INT);
        $lineStmt->execute();
        while ($line = $lineStmt->fetch(PDO::FETCH_ASSOC)) {
            $fulfillmentLines[] = [
                'request_fulfillment_line_id' => (int) $line['RequestFulfillmentLineID'],
                'item_unit_id' => $line['ItemUnitID'] !== null ? (int) $line['ItemUnitID'] : null,
                'source_type' => $line['SourceType'],
                'note' => $line['Note'],
                'return_customer_flag' => (bool) $line['ReturnCustomerFlag'],
                'paid_excluded_flag' => (bool) $line['PaidExcludedFlag'],
                'item_id' => $line['ItemID'] !== null ? (int) $line['ItemID'] : null,
                'serial_number' => $line['SerialNumber'],
                'status' => $line['Status'],
                'warehouse_id' => $line['WarehouseID'] !== null ? (int) $line['WarehouseID'] : null,
                'warehouse_name' => $line['WarehouseName'],
            ];
        }
    }

    $bookings = [];
    if (tableExists($db, 'booking')) {
        $bookingStmt = $db->prepare(
            'SELECT BookingID, ItemUnitID, StartTime, EndTime, Status FROM booking WHERE RequestAllocationID = :request_line_id'
        );
        $bookingStmt->bindValue(':request_line_id', $requestLineId, PDO::PARAM_INT);
        $bookingStmt->execute();
        $bookings = $bookingStmt->fetchAll(PDO::FETCH_ASSOC);
    }

    $payload = [
        'request_line_id' => (int) $row['RequestLineID'],
        'request_id' => (int) $row['RequestID'],
        'line_no' => $row['LineNo'] !== null ? (int) $row['LineNo'] : null,
        'item_id' => $row['ItemID'] !== null ? (int) $row['ItemID'] : null,
        'item_name' => $row['ItemName'],
        'item_reference' => $row['RefItemID'],
        'quantity' => $row['QuantityRequested'] !== null ? (int) $row['QuantityRequested'] : null,
        'fulfillment_status' => strtolower((string) $row['FulfillmentStatus']),
        'note' => $row['line_note'],
        'uom' => $row['UOM'],
        'rate' => $row['Rate'],
        'period' => $row['Period'],
        'category_name' => $row['category_name'],
        'brand' => $row['Brand'],
        'model' => $row['Model'],
        'event' => [
            'event_id' => (int) $row['EventID'],
            'event_name' => $row['EventName'],
            'event_code' => $row['RefEventID'],
            'start_date' => $row['StartDate'],
            'end_date' => $row['EndDate'],
        ],
        'fulfillment' => [
            'request_fulfillment_id' => $fulfillmentId ? (int) $fulfillmentId : null,
            'note' => $fulfillmentNote,
            'lines' => $fulfillmentLines,
        ],
        'bookings' => array_map(
            function ($booking) {
                return [
                    'booking_id' => (int) $booking['BookingID'],
                    'item_unit_id' => (int) $booking['ItemUnitID'],
                    'start_time' => $booking['StartTime'],
                    'end_time' => $booking['EndTime'],
                    'status' => $booking['Status'],
                ];
            },
            $bookings
        ),
    ];

    echo json_encode(['data' => $payload], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    error_log('request_fulfillment_detail failed: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'server_error', 'message' => 'ไม่สามารถโหลดข้อมูลบรรทัดคำขอได้']);
}
