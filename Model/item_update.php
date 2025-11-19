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
    echo json_encode(['error' => 'invalid_payload']);
    exit;
}

$itemId = parseNullableInt($input['item_id'] ?? null);
if ($itemId === null || $itemId <= 0) {
    http_response_code(400);
    echo json_encode(['error' => 'invalid_id']);
    exit;
}

$itemName = trim((string) ($input['item_name'] ?? ''));
if ($itemName === '') {
    http_response_code(400);
    echo json_encode(['error' => 'missing_name']);
    exit;
}

$allowedTypes = ['อุปกร', 'วัสดุ', 'บริการ', ''];
$itemType = $input['item_type'] ?? 'อุปกร';
if (!in_array($itemType, $allowedTypes, true)) {
    $itemType = 'อุปกร';
}

$refItemId = trimNullable($input['ref_item_id'] ?? null);
$note = trimNullable($input['note'] ?? null);
$categoryId = parseNullableInt($input['item_category_id'] ?? null);
$brand = trimNullable($input['brand'] ?? null);
$model = trimNullable($input['model'] ?? null);
$uom = trim((string) ($input['uom'] ?? 'unit'));
if ($uom === '') {
    $uom = 'unit';
}
$allowedPeriods = ['ต่อชั่วโมง', 'ต่อวัน', 'ต่ออีเว้น'];
$period = $input['period'] ?? 'ต่อวัน';
if (!in_array($period, $allowedPeriods, true)) {
    $period = 'ต่อวัน';
}
$rate = null;
if (isset($input['rate']) && $input['rate'] !== '') {
    $rateValue = filter_var($input['rate'], FILTER_VALIDATE_FLOAT);
    if ($rateValue !== false) {
        $rate = $rateValue;
    }
}

$staffId = (int) $_SESSION['staff_id'];

try {
    $db = DatabaseConnector::getConnection();

    $checkItem = $db->prepare('SELECT ItemID FROM items WHERE ItemID = :id LIMIT 1');
    $checkItem->bindValue(':id', $itemId, PDO::PARAM_INT);
    $checkItem->execute();
    if (!$checkItem->fetch(PDO::FETCH_ASSOC)) {
        http_response_code(404);
        echo json_encode(['error' => 'not_found']);
        exit;
    }

    if ($categoryId !== null) {
        $checkCategory = $db->prepare('SELECT ItemCategoryID FROM itemcategorys WHERE ItemCategoryID = :id LIMIT 1');
        $checkCategory->bindValue(':id', $categoryId, PDO::PARAM_INT);
        $checkCategory->execute();
        if (!$checkCategory->fetch(PDO::FETCH_ASSOC)) {
            $categoryId = null;
        }
    }

    $sql = "
        UPDATE items
        SET
            RefItemID = :ref_item_id,
            ItemName = :item_name,
            ItemType = :item_type,
            ItemCategoryID = :category_id,
            Brand = :brand,
            Model = :model,
            UOM = :uom,
            Rate = :rate,
            Period = :period,
            Note = :note
        WHERE ItemID = :item_id
    ";

    $stmt = $db->prepare($sql);
    bindNullableString($stmt, ':ref_item_id', $refItemId);
    $stmt->bindValue(':item_name', $itemName, PDO::PARAM_STR);
    $stmt->bindValue(':item_type', $itemType, PDO::PARAM_STR);
    bindNullableInt($stmt, ':category_id', $categoryId);
    bindNullableString($stmt, ':brand', $brand);
    bindNullableString($stmt, ':model', $model);
    $stmt->bindValue(':uom', $uom, PDO::PARAM_STR);
    bindNullableFloat($stmt, ':rate', $rate);
    $stmt->bindValue(':period', $period, PDO::PARAM_STR);
    bindNullableString($stmt, ':note', $note);
    $stmt->bindValue(':item_id', $itemId, PDO::PARAM_INT);
    $stmt->execute();

    recordAuditEvent($db, 'item', $itemId, 'UPDATE', $staffId);

    $detail = fetchItemDetail($db, $itemId);
    echo json_encode(['success' => true, 'data' => $detail], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'server']);
}

function trimNullable($value): ?string
{
    if ($value === null) {
        return null;
    }
    $text = trim((string) $value);
    return $text === '' ? null : $text;
}

function parseNullableInt($value): ?int
{
    if ($value === null || $value === '') {
        return null;
    }
    if (ctype_digit((string) $value)) {
        return (int) $value;
    }
    return null;
}

function bindNullableString(PDOStatement $stmt, string $param, ?string $value): void
{
    if ($value === null) {
        $stmt->bindValue($param, null, PDO::PARAM_NULL);
    } else {
        $stmt->bindValue($param, $value, PDO::PARAM_STR);
    }
}

function bindNullableInt(PDOStatement $stmt, string $param, ?int $value): void
{
    if ($value === null) {
        $stmt->bindValue($param, null, PDO::PARAM_NULL);
    } else {
        $stmt->bindValue($param, $value, PDO::PARAM_INT);
    }
}

function bindNullableFloat(PDOStatement $stmt, string $param, ?float $value): void
{
    if ($value === null) {
        $stmt->bindValue($param, null, PDO::PARAM_NULL);
    } else {
        $stmt->bindValue($param, $value);
    }
}

function fetchItemDetail(PDO $db, int $itemId): array
{
    $sql = "
        SELECT
            i.ItemID AS item_id,
            i.RefItemID AS ref_item_id,
            i.ItemName AS item_name,
            i.ItemType AS item_type,
            i.ItemCategoryID AS item_category_id,
            i.Brand AS brand,
            i.Model AS model,
            i.UOM AS uom,
            i.Rate AS rate,
            i.Period AS period,
            i.Note AS note,
            c.Name AS category_name
        FROM items i
        LEFT JOIN itemcategorys c ON c.ItemCategoryID = i.ItemCategoryID
        WHERE i.ItemID = :item_id
        LIMIT 1
    ";

    $stmt = $db->prepare($sql);
    $stmt->bindValue(':item_id', $itemId, PDO::PARAM_INT);
    $stmt->execute();
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$result) return [];

    $audit = fetchAuditMetadataForEntity($db, 'item', $itemId);
    $result['created_at'] = $audit['created_at'];
    $result['updated_at'] = $audit['updated_at'];
    $result['created_by_name'] = $audit['created_by_name'];
    $result['updated_by_name'] = $audit['updated_by_name'];
    $result['created_by'] = $audit['created_by_id'];
    $result['updated_by'] = $audit['updated_by_id'];

    return $result;
}