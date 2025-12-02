<?php
require_once __DIR__ . '/database_connector.php';
require_once __DIR__ . '/audit_log.php';

session_start();
header('Content-Type: application/json; charset=utf-8');

try {
    if (!isset($_GET['event_id']) || $_GET['event_id'] === '') {
        throw new InvalidArgumentException('missing_event');
    }

    $eventIdParam = $_GET['event_id'];
    if (!ctype_digit((string) $eventIdParam)) {
        throw new InvalidArgumentException('invalid_event');
    }

    $eventId = (int) $eventIdParam;
    if ($eventId <= 0) {
        throw new InvalidArgumentException('invalid_event');
    }

    $db = DatabaseConnector::getConnection();

    $eventStmt = $db->prepare(
        'SELECT EventID, RefEventID, EventName, StartDate, EndDate, Status FROM events WHERE EventID = :id LIMIT 1'
    );
    $eventStmt->execute([':id' => $eventId]);
    $eventRow = $eventStmt->fetch(PDO::FETCH_ASSOC);

    if (!$eventRow) {
        http_response_code(404);
        echo json_encode([
            'error' => 'event_not_found',
            'message' => 'ไม่พบข้อมูลอีเว้นที่ต้องการ',
        ]);
        return;
    }

    $requestSql = <<<SQL
        SELECT
            r.RequestID,
            r.EventID,
            r.RequestName,
            r.RequestSeqNo,
            r.Status
        FROM requests r
        WHERE r.EventID = :event_id
        ORDER BY r.RequestID DESC
    SQL;

    $requestStmt = $db->prepare($requestSql);
    $requestStmt->execute([':event_id' => $eventId]);
    $requestRows = $requestStmt->fetchAll(PDO::FETCH_ASSOC);

    $requestLineGroups = [];
    $requestIds = [];
    if ($requestRows) {
        foreach ($requestRows as $row) {
            $requestIds[] = (int) $row['RequestID'];
        }
        $placeholders = implode(',', array_fill(0, count($requestIds), '?'));
        $lineSql = <<<SQL
            SELECT
                rl.RequestLineID,
                rl.RequestID,
                rl.LineNo,
                rl.ItemID,
                rl.QuantityRequested,
                rl.StartTime,
                rl.EndTime,
                rl.FulfillmentStatus,
                rl.Note,
                rl.Status,
                i.RefItemID,
                i.ItemName,
                i.UOM
            FROM request_lines rl
            LEFT JOIN items i ON i.ItemID = rl.ItemID
            WHERE rl.RequestID IN ($placeholders)
            ORDER BY rl.RequestID, rl.LineNo
        SQL;

        $lineStmt = $db->prepare($lineSql);
        foreach ($requestIds as $index => $requestId) {
            $lineStmt->bindValue($index + 1, (int) $requestId, PDO::PARAM_INT);
        }
        $lineStmt->execute();

        while ($line = $lineStmt->fetch(PDO::FETCH_ASSOC)) {
            $requestId = (int) $line['RequestID'];
            if (!isset($requestLineGroups[$requestId])) {
                $requestLineGroups[$requestId] = [];
            }
            $requestLineGroups[$requestId][] = [
                'request_line_id' => (int) $line['RequestLineID'],
                'line_no' => (int) $line['LineNo'],
                'item_id' => (int) $line['ItemID'],
                'item_reference' => $line['RefItemID'] ?? '',
                'item_name' => $line['ItemName'] ?? '',
                'uom' => $line['UOM'] ?? '',
                'quantity_requested' => (int) $line['QuantityRequested'],
                'start_time' => $line['StartTime'],
                'end_time' => $line['EndTime'],
                'fulfillment_status' => strtolower((string) $line['FulfillmentStatus']),
                'note' => $line['Note'] ?? '',
                'status' => strtolower((string) $line['Status']),
            ];
        }
    }

    $requestAuditMeta = fetchAuditMetadataForEntities($db, 'request', $requestIds);

    $rfqSql = <<<SQL
        SELECT
            s.SupplierRFQID,
            s.RefSupplierRFQID,
            s.EventID,
            s.StaffID,
            s.Title,
            s.Status
        FROM supplier_rfq s
        WHERE s.EventID = :event_id
        ORDER BY s.SupplierRFQID DESC
    SQL;

    $rfqStmt = $db->prepare($rfqSql);
    $rfqStmt->execute([':event_id' => $eventId]);
    $rfqRows = $rfqStmt->fetchAll(PDO::FETCH_ASSOC);

    $rfqIds = [];
    $rfqLineStats = [];
    if ($rfqRows) {
        foreach ($rfqRows as $row) {
            $rfqIds[] = (int) $row['SupplierRFQID'];
        }
        $rfqPlaceholder = implode(',', array_fill(0, count($rfqIds), '?'));
        $rfqLineSql = <<<SQL
            SELECT
                l.SupplierRFQID,
                COUNT(*) AS line_count,
                COALESCE(SUM(l.QuantityRequested), 0) AS total_quantity
            FROM supplier_rfq_line l
            WHERE l.SupplierRFQID IN ($rfqPlaceholder)
            GROUP BY l.SupplierRFQID
        SQL;
        $rfqLineStmt = $db->prepare($rfqLineSql);
        foreach ($rfqIds as $index => $rfqId) {
            $rfqLineStmt->bindValue($index + 1, (int) $rfqId, PDO::PARAM_INT);
        }
        $rfqLineStmt->execute();
        while ($line = $rfqLineStmt->fetch(PDO::FETCH_ASSOC)) {
            $rfqLineStats[(int) $line['SupplierRFQID']] = [
                'line_count' => (int) $line['line_count'],
                'total_quantity' => (int) $line['total_quantity'],
            ];
        }
    }

    $rfqAuditMeta = fetchAuditMetadataForEntities($db, 'supplier_rfq', $rfqIds);

    $statusMeta = [
        'draft' => 'ร่าง',
        'submitted' => 'ส่งคำขอ',
        'approved' => 'อนุมัติแล้ว',
        'closed' => 'ปิดคำขอ',
        'cancelled' => 'ยกเลิก',
        'completed' => 'เสร็จสิ้น',
    ];

    $documents = [];
    $statusCounts = [];
    $categoryCounts = [
        'item-request' => 0,
        'rfq' => 0,
    ];

    foreach ($requestRows as $row) {
        $requestId = (int) $row['RequestID'];
        $statusKey = strtolower((string) $row['Status']);
        if (!isset($statusMeta[$statusKey])) {
            $statusMeta[$statusKey] = $statusKey !== '' ? ucfirst($statusKey) : 'อื่น ๆ';
        }
        if (!isset($statusCounts[$statusKey])) {
            $statusCounts[$statusKey] = 0;
        }
        $statusCounts[$statusKey] += 1;
        $categoryCounts['item-request'] += 1;

        $audit = $requestAuditMeta[$requestId] ?? buildEmptyAuditMetadata();
        $lines = $requestLineGroups[$requestId] ?? [];
        $totalQuantity = 0;
        foreach ($lines as $line) {
            if (($line['status'] ?? '') !== 'deleted') {
                $totalQuantity += (int) $line['quantity_requested'];
            }
        }

        $documents[] = [
            'id' => sprintf('request:%d', $requestId),
            'document_id' => $requestId,
            'category' => 'item-request',
            'type' => 'item-request',
            'type_label' => 'คำขอเบิกอุปกรณ์',
            'title' => $row['RequestName'],
            'reference' => formatRequestReference($row['RequestSeqNo'], $requestId),
            'status' => $statusKey,
            'status_label' => $statusMeta[$statusKey] ?? $row['Status'],
            'owner_id' => $audit['created_by_id'],
            'owner_name' => $audit['created_by_name'],
            'owner_label' => formatStaffLabel($audit['created_by_id'], $audit['created_by_name'], $audit['created_by_role']),
            'created_at' => $audit['created_at'],
            'updated_at' => $audit['updated_at'],
            'updated_by_id' => $audit['updated_by_id'],
            'updated_by_name' => $audit['updated_by_name'],
            'updated_by_label' => formatStaffLabel($audit['updated_by_id'], $audit['updated_by_name'], $audit['updated_by_role']),
            'line_count' => count($lines),
            'total_quantity' => $totalQuantity,
            'lines' => $lines,
        ];
    }

    foreach ($rfqRows as $row) {
        $rfqId = (int) $row['SupplierRFQID'];
        $statusKey = strtolower((string) $row['Status']);
        if (!isset($statusMeta[$statusKey])) {
            $statusMeta[$statusKey] = $statusKey !== '' ? ucfirst($statusKey) : 'อื่น ๆ';
        }
        if (!isset($statusCounts[$statusKey])) {
            $statusCounts[$statusKey] = 0;
        }
        $statusCounts[$statusKey] += 1;
        $categoryCounts['rfq'] += 1;

        $audit = $rfqAuditMeta[$rfqId] ?? buildEmptyAuditMetadata();
        $ownerId = $audit['created_by_id'] ?? ($row['StaffID'] ?? null);
        $ownerName = $audit['created_by_name'] ?? '';
        $ownerRole = $audit['created_by_role'] ?? '';
        $lineStat = $rfqLineStats[$rfqId] ?? ['line_count' => 0, 'total_quantity' => 0];

        $documents[] = [
            'id' => sprintf('rfq:%d', $rfqId),
            'document_id' => $rfqId,
            'category' => 'rfq',
            'type' => 'rfq',
            'type_label' => 'คำขอใบเสนอราคา',
            'title' => $row['Title'] ?? sprintf('RFQ #%d', $rfqId),
            'reference' => $row['RefSupplierRFQID'] ?? sprintf('RFQ#%d', $rfqId),
            'status' => $statusKey,
            'status_label' => $statusMeta[$statusKey] ?? $row['Status'],
            'owner_id' => $ownerId,
            'owner_name' => $ownerName,
            'owner_label' => formatStaffLabel($ownerId, $ownerName, $ownerRole),
            'created_at' => $audit['created_at'],
            'updated_at' => $audit['updated_at'],
            'updated_by_id' => $audit['updated_by_id'],
            'updated_by_name' => $audit['updated_by_name'],
            'updated_by_label' => formatStaffLabel($audit['updated_by_id'], $audit['updated_by_name'], $audit['updated_by_role']),
            'line_count' => $lineStat['line_count'],
            'total_quantity' => $lineStat['total_quantity'],
            'lines' => [],
        ];
    }

    ksort($statusMeta);
    ksort($statusCounts);

    $statusList = [];
    foreach ($statusMeta as $key => $label) {
        $statusList[] = [
            'id' => $key,
            'label' => $label,
            'total' => $statusCounts[$key] ?? 0,
        ];
    }

    $totalDocuments = count($documents);
    $categories = [
        [
            'id' => 'all',
            'label' => 'เอกสารทั้งหมด',
            'description' => 'รวมเอกสารทุกประเภทของอีเว้นนี้',
            'total' => $totalDocuments,
        ],
        [
            'id' => 'item-request',
            'label' => 'คำขอเบิกอุปกรณ์',
            'description' => 'รายการคำขอเบิกอุปกรณ์และวัสดุสำหรับอีเว้นนี้',
            'total' => $categoryCounts['item-request'],
        ],
        [
            'id' => 'rfq',
            'label' => 'คำขอใบเสนอราคา (RFQ)',
            'description' => 'ติดตามคำขอใบเสนอราคาที่ส่งให้ผู้ขาย',
            'total' => $categoryCounts['rfq'],
        ],
    ];

    $eventPayload = [
        'event_id' => (int) $eventRow['EventID'],
        'event_name' => $eventRow['EventName'] ?? '',
        'event_code' => $eventRow['RefEventID'] ?? '',
        'status' => $eventRow['Status'] ?? '',
        'start_date' => $eventRow['StartDate'] ?? null,
        'end_date' => $eventRow['EndDate'] ?? null,
    ];

    echo json_encode([
        'event' => $eventPayload,
        'categories' => $categories,
        'statuses' => $statusList,
        'summary' => [
            'total' => $totalDocuments,
            'by_status' => $statusCounts,
            'by_category' => [
                'item-request' => $categoryCounts['item-request'],
                'rfq' => $categoryCounts['rfq'],
            ],
        ],
        'documents' => $documents,
    ]);
} catch (InvalidArgumentException $ex) {
    http_response_code(400);
    echo json_encode([
        'error' => 'invalid_event',
        'message' => 'กรุณาระบุอีเว้นที่ต้องการดูเอกสาร',
    ]);
} catch (PDOException $ex) {
    http_response_code(500);
    echo json_encode([
        'error' => 'database_error',
        'message' => 'ไม่สามารถดึงข้อมูลได้ในขณะนี้',
    ]);
} catch (Throwable $ex) {
    http_response_code(500);
    echo json_encode([
        'error' => 'server_error',
        'message' => 'ระบบไม่สามารถดึงข้อมูลได้',
    ]);
}

function formatRequestReference($seqNo, $id)
{
    if ($seqNo !== null) {
        return sprintf('REQ-%05d', (int) $seqNo);
    }
    return sprintf('REQ#%d', (int) $id);
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