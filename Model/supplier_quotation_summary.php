<?php
require_once __DIR__ . '/database_connector.php';

const VAT_RATE = 0.07;

session_start();
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'method_not_allowed']);
    exit;
}

$rfqId = isset($_GET['supplier_rfq_id'])
    ? (int) $_GET['supplier_rfq_id']
    : (isset($_GET['rfq_id']) ? (int) $_GET['rfq_id'] : 0);

if ($rfqId <= 0) {
    http_response_code(400);
    echo json_encode(['error' => 'invalid_rfq_id', 'message' => 'รหัส RFQ ไม่ถูกต้อง']);
    exit;
}

try {
    $db = DatabaseConnector::getConnection();

    $rfqStmt = $db->prepare('
        SELECT r.SupplierRFQID, r.RefSupplierRFQID, r.Title, r.EventID,
               e.EventName, e.RefEventID
        FROM supplier_rfq r
        LEFT JOIN events e ON e.EventID = r.EventID
        WHERE r.SupplierRFQID = :rfq_id
        LIMIT 1
    ');
    $rfqStmt->bindValue(':rfq_id', $rfqId, PDO::PARAM_INT);
    $rfqStmt->execute();
    $rfqRow = $rfqStmt->fetch(PDO::FETCH_ASSOC);

    if (!$rfqRow) {
        http_response_code(404);
        echo json_encode(['error' => 'rfq_not_found', 'message' => 'ไม่พบ RFQ ที่ระบุ']);
        exit;
    }

    $linesStmt = $db->prepare('
        SELECT l.SupplierRFQLineID, l.ItemID, l.ItemDesc, l.UOM, l.QuantityRequested, l.Note,
               i.ItemName, i.RefItemID
        FROM supplier_rfq_line l
        LEFT JOIN items i ON i.ItemID = l.ItemID
        WHERE l.SupplierRFQID = :rfq_id
        ORDER BY l.SupplierRFQLineID ASC
    ');
    $linesStmt->bindValue(':rfq_id', $rfqId, PDO::PARAM_INT);
    $linesStmt->execute();

    $rfqLines = [];
    while ($line = $linesStmt->fetch(PDO::FETCH_ASSOC)) {
        $rfqLines[] = [
            'rfq_line_id' => (int) $line['SupplierRFQLineID'],
            'item_id' => $line['ItemID'] !== null ? (int) $line['ItemID'] : null,
            'item_reference' => $line['RefItemID'] ?? '',
            'item_name' => $line['ItemName'] ?? '',
            'item_desc' => $line['ItemDesc'] ?? '',
            'uom' => $line['UOM'] ?? '',
            'quantity_requested' => (int) $line['QuantityRequested'],
            'note' => $line['Note'] ?? null,
        ];
    }

    $quotationStmt = $db->prepare('
        SELECT q.SupplierQuotationID, q.RefSupplierQuotationID, q.Title, q.Status,
               q.SupplierID, q.QuotationDate,
               s.SupplierName, s.OrgName
        FROM supplier_quotation q
        LEFT JOIN suppliers s ON s.SupplierID = q.SupplierID
        WHERE q.SupplierRFQID = :rfq_id
        ORDER BY q.QuotationDate ASC
    ');
    $quotationStmt->bindValue(':rfq_id', $rfqId, PDO::PARAM_INT);
    $quotationStmt->execute();

    $quotationMap = [];
    $quotationIds = [];
    while ($row = $quotationStmt->fetch(PDO::FETCH_ASSOC)) {
        $quotationId = (int) $row['SupplierQuotationID'];
        $quotationIds[] = $quotationId;
        $quotationMap[$quotationId] = [
            'supplier_quotation_id' => $quotationId,
            'ref_supplier_quotation_id' => $row['RefSupplierQuotationID'],
            'title' => $row['Title'] ?? '',
            'status' => strtolower((string) ($row['Status'] ?? 'submitted')),
            'supplier_id' => $row['SupplierID'] !== null ? (int) $row['SupplierID'] : null,
            'supplier_name' => buildSupplierName($row['SupplierName'] ?? '', $row['OrgName'] ?? ''),
            'quotation_date' => $row['QuotationDate'],
        ];
    }

    $offersByLine = [];
    $unmatchedOffers = [];
    if (!empty($quotationIds)) {
        $placeholders = implode(',', array_fill(0, count($quotationIds), '?'));
        $lineSql = "
            SELECT
                l.SupplierQuotationLineID,
                l.SupplierQuotationID,
                l.SupplierRFQLineID,
                l.ItemID,
                l.ItemDesc,
                l.ItemSpec,
                l.ItemNote,
                l.UOM,
                l.QuantityOffered,
                l.UnitPrice,
                l.DiscountPercent,
                l.DiscountAmount,
                l.TaxInclude,
                l.Note
            FROM supplier_quotation_line l
            WHERE l.SupplierQuotationID IN ($placeholders)
            ORDER BY l.SupplierRFQLineID IS NULL, l.SupplierRFQLineID, l.SupplierQuotationLineID
        ";
        $lineStmt = $db->prepare($lineSql);
        foreach ($quotationIds as $index => $quotationId) {
            $lineStmt->bindValue($index + 1, $quotationId, PDO::PARAM_INT);
        }
        $lineStmt->execute();

        while ($line = $lineStmt->fetch(PDO::FETCH_ASSOC)) {
            $quotationId = (int) $line['SupplierQuotationID'];
            $rfqLineId = $line['SupplierRFQLineID'] !== null ? (int) $line['SupplierRFQLineID'] : null;
            $quantity = max((int) $line['QuantityOffered'], 0);
            $unitPrice = max((float) $line['UnitPrice'], 0);
            $discountPercent = $line['DiscountPercent'] !== null ? (float) $line['DiscountPercent'] : null;
            $discountAmount = $line['DiscountAmount'] !== null ? (float) $line['DiscountAmount'] : null;
            $taxInclude = !empty($line['TaxInclude']);

            $grossTotal = max($unitPrice * $quantity, 0);
            $percentDiscount = $discountPercent !== null ? ($grossTotal * ($discountPercent / 100)) : 0;
            $netTotal = $grossTotal - $percentDiscount - ($discountAmount ?? 0);
            if ($netTotal < 0) {
                $netTotal = 0;
            }
            $netTotalWithVat = $taxInclude ? $netTotal : $netTotal * (1 + VAT_RATE);
            $effectiveUnitBeforeVat = $quantity > 0 ? $netTotal / $quantity : $unitPrice;
            $effectiveUnit = $quantity > 0
                ? $netTotalWithVat / $quantity
                : ($taxInclude ? $unitPrice : $unitPrice * (1 + VAT_RATE));

            $offer = [
                'quotation_line_id' => (int) $line['SupplierQuotationLineID'],
                'quotation_id' => $quotationId,
                'quotation_label' => buildQuotationLabel($quotationMap[$quotationId] ?? null),
                'supplier_id' => $quotationMap[$quotationId]['supplier_id'] ?? null,
                'supplier_name' => $quotationMap[$quotationId]['supplier_name'] ?? null,
                'status' => $quotationMap[$quotationId]['status'] ?? null,
                'offered_quantity' => $quantity,
                'uom' => $line['UOM'] ?? '',
                'unit_price' => round($unitPrice, 2),
                'discount_percent' => $discountPercent,
                'discount_amount' => $discountAmount,
                'tax_include' => $taxInclude,
                'total_price_before_vat' => round($netTotal, 2),
                'total_price' => round($netTotalWithVat, 2),
                'effective_unit_price_before_vat' => round($effectiveUnitBeforeVat, 2),
                'effective_unit_price' => round($effectiveUnit, 2),
                'vat_amount' => round($netTotalWithVat - $netTotal, 2),
                'note' => $line['Note'] ?? null,
                'item_desc' => $line['ItemDesc'] ?? '',
                'item_id' => $line['ItemID'] !== null ? (int) $line['ItemID'] : null,
                'item_spec' => $line['ItemSpec'] ?? null,
                'item_note' => $line['ItemNote'] ?? null,
            ];

            if ($rfqLineId !== null) {
                $offersByLine[$rfqLineId][] = $offer;
            } else {
                $unmatchedOffers[] = $offer;
            }
        }
    }

    $linesPayload = [];
    $linesWithPrice = 0;
    $awardedValue = 0;

    foreach ($rfqLines as $line) {
        $rfqLineId = $line['rfq_line_id'];
        $offers = $offersByLine[$rfqLineId] ?? [];
        if ($offers) {
            usort($offers, static function ($a, $b) {
                return $a['effective_unit_price'] <=> $b['effective_unit_price'];
            });
        }
        $bestOffer = null;
        foreach ($offers as $offer) {
            if ($offer['effective_unit_price'] > 0) {
                $bestOffer = $offer;
                break;
            }
        }
        if ($bestOffer) {
            $linesWithPrice += 1;
            $awardedValue += $bestOffer['total_price'];
        }

        $linesPayload[] = [
            'rfq_line_id' => $rfqLineId,
            'item_id' => $line['item_id'],
            'item_reference' => $line['item_reference'],
            'item_name' => $line['item_name'],
            'item_desc' => $line['item_desc'],
            'uom' => $line['uom'],
            'quantity_requested' => $line['quantity_requested'],
            'note' => $line['note'],
            'offers' => $offers,
            'best_offer' => $bestOffer,
        ];
    }

    $payload = [
        'rfq' => [
            'supplier_rfq_id' => (int) $rfqRow['SupplierRFQID'],
            'ref_supplier_rfq_id' => $rfqRow['RefSupplierRFQID'],
            'title' => $rfqRow['Title'] ?? '',
            'event_id' => $rfqRow['EventID'] !== null ? (int) $rfqRow['EventID'] : null,
            'event_name' => $rfqRow['EventName'] ?? '',
            'event_code' => $rfqRow['RefEventID'] ?? '',
        ],
        'summary' => [
            'line_count' => count($rfqLines),
            'lines_with_price' => $linesWithPrice,
            'lines_without_price' => max(count($rfqLines) - $linesWithPrice, 0),
            'total_awarded_value' => round($awardedValue, 2),
            'vat_rate' => VAT_RATE,
        ],
        'lines' => $linesPayload,
        'unmatched_offers' => $unmatchedOffers,
        'quotations' => array_values($quotationMap),
    ];

    echo json_encode(['success' => true, 'data' => $payload], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'server_error', 'message' => 'ไม่สามารถสรุปใบเสนอราคาได้']);
}

function buildSupplierName(string $name, string $org): string
{
    $parts = array_filter([$name, $org], static function ($value) {
        return $value !== null && trim($value) !== '';
    });
    if (empty($parts)) {
        return '';
    }
    return implode(' • ', $parts);
}

function buildQuotationLabel(?array $quotation): string
{
    if (!$quotation) {
        return '';
    }
    if (!empty($quotation['title'])) {
        return $quotation['title'];
    }
    if (!empty($quotation['ref_supplier_quotation_id'])) {
        return $quotation['ref_supplier_quotation_id'];
    }
    return sprintf('ใบเสนอราคา #%d', $quotation['supplier_quotation_id']);
}
