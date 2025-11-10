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

$itemName = trim((string) ($input['item_name'] ?? ''));
if ($itemName === '') {
    http_response_code(400);
    echo json_encode(['error' => 'missing_name']);
    exit;
}

$allowedTypes = ['อุปกร', 'วัสดุ', 'บริการ'];
$itemType = $input['item_type'] ?? 'อุปกร';
if (!in_array($itemType, $allowedTypes, true)) {
    $itemType = 'อุปกร';
}

$refItemId = trimNullable($input['ref_item_id'] ?? null);
$categoryId = parseNullableInt($input['item_category_id'] ?? null);
$brand = trimNullable($input['brand'] ?? null);
$model = trimNullable($input['model'] ?? null);
$uom = trim((string) ($input['uom'] ?? 'unit'));
if ($uom === '') {
    $uom = 'unit';
}
$period = trim((string) ($input['period'] ?? 'day'));
if ($period === '') {
    $period = 'day';
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
    $db = new PDO(
        'mysql:host=localhost;dbname=sa_webapp;charset=utf8mb4',
        'dramelon',
        'dramelon',
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );

    if ($categoryId !== null) {
        $checkCategory = $db->prepare('SELECT ItemCategoryID FROM itemcategory WHERE ItemCategoryID = :id LIMIT 1');
        $checkCategory->bindValue(':id', $categoryId, PDO::PARAM_INT);
        $checkCategory->execute();
        if (!$checkCategory->fetch(PDO::FETCH_ASSOC)) {
            $categoryId = null;
        }
    }

    $sql = "
        INSERT INTO items (
            RefItemID,
            ItemName,
            ItemType,
            ItemCategoryID,
            Brand,
            Model,
            UOM,
            Rate,
            Period,
            CreatedBy,
            UpdatedBy
        ) VALUES (
            :ref_item_id,
            :item_name,
            :item_type,
            :category_id,
            :brand,
            :model,
            :uom,
            :rate,
            :period,
            :created_by,
            :updated_by
        )
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
    bindNullableInt($stmt, ':created_by', $staffId ?: null);
    bindNullableInt($stmt, ':updated_by', $staffId ?: null);
    $stmt->execute();

    $itemId = (int) $db->lastInsertId();
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
            i.CreatedAt AS created_at,
            i.CreatedBy AS created_by,
            i.UpdatedAt AS updated_at,
            i.UpdatedBy AS updated_by,
            c.Name AS category_name,
            cb.FullName AS created_by_name,
            ub.FullName AS updated_by_name
        FROM items i
        LEFT JOIN itemcategory c ON c.ItemCategoryID = i.ItemCategoryID
        LEFT JOIN staffs cb ON cb.StaffID = i.CreatedBy
        LEFT JOIN staffs ub ON ub.StaffID = i.UpdatedBy
        WHERE i.ItemID = :item_id
        LIMIT 1
    ";

    $stmt = $db->prepare($sql);
    $stmt->bindValue(':item_id', $itemId, PDO::PARAM_INT);
    $stmt->execute();
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    return $result ?: [];
}