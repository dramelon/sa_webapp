<?php
require_once __DIR__ . '/database_connector.php';

session_start();
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'method_not_allowed']);
    exit;
}

$eventId = isset($_GET['event_id']) ? (int) $_GET['event_id'] : 0;
if ($eventId <= 0) {
    http_response_code(400);
    echo json_encode(['error' => 'invalid_event_id']);
    exit;
}

try {
    $db = DatabaseConnector::getConnection();

    // Fetch Event Info
    $eventStmt = $db->prepare('SELECT EventID, EventName, RefEventID FROM events WHERE EventID = :id LIMIT 1');
    $eventStmt->bindValue(':id', $eventId, PDO::PARAM_INT);
    $eventStmt->execute();
    $event = $eventStmt->fetch(PDO::FETCH_ASSOC);

    if (!$event) {
        http_response_code(404);
        echo json_encode(['error' => 'event_not_found']);
        exit;
    }

    $eventData = [
        'event_id' => (int) $event['EventID'],
        'event_name' => $event['EventName'],
        'event_code' => $event['RefEventID'],
    ];

    // Fetch Quotations for this Event
    // Quotations are linked to RFQs, which are linked to Events.
    $sql = "
        SELECT 
            q.SupplierQuotationID,
            q.RefSupplierQuotationID,
            q.Title,
            q.QuotationDate,
            q.Status,
            q.SupplierID,
            s.SupplierName,
            r.SupplierRFQID,
            r.Title AS RfqTitle,
            (
                SELECT SUM(
                    GREATEST(
                        (
                            (l.QuantityOffered * l.UnitPrice)
                            - IFNULL(l.DiscountAmount, 0)
                            - (IFNULL(l.DiscountPercent, 0) / 100 * (l.QuantityOffered * l.UnitPrice))
                        ) * CASE WHEN l.TaxInclude = 1 THEN 1 ELSE 1.07 END,
                        0
                    )
                )
                FROM supplier_quotation_line l
                WHERE l.SupplierQuotationID = q.SupplierQuotationID
            ) AS TotalAmount
        FROM supplier_quotation q
        JOIN supplier_rfq r ON q.SupplierRFQID = r.SupplierRFQID
        LEFT JOIN suppliers s ON q.SupplierID = s.SupplierID
        WHERE r.EventID = :event_id
        ORDER BY q.QuotationDate DESC
    ";

    $stmt = $db->prepare($sql);
    $stmt->bindValue(':event_id', $eventId, PDO::PARAM_INT);
    $stmt->execute();

    $quotations = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $quotations[] = [
            'supplier_quotation_id' => (int) $row['SupplierQuotationID'],
            'ref_supplier_quotation_id' => $row['RefSupplierQuotationID'],
            'title' => $row['Title'],
            'quotation_date' => $row['QuotationDate'],
            'status' => strtolower($row['Status']),
            'supplier_id' => (int) $row['SupplierID'],
            'supplier_name' => $row['SupplierName'],
            'supplier_rfq_id' => (int) $row['SupplierRFQID'],
            'rfq_title' => $row['RfqTitle'],
            'total_amount' => (float) $row['TotalAmount'],
        ];
    }

    echo json_encode([
        'success' => true,
        'data' => [
            'event' => $eventData,
            'quotations' => $quotations,
        ],
    ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'server_error', 'message' => $e->getMessage()]);
}
