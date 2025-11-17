<?php
require_once __DIR__ . '/database_connector.php';

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

$categoryId = parseNullableInt($input['item_category_id'] ?? null);
if ($categoryId === null || $categoryId <= 0) {
    http_response_code(400);
    echo json_encode(['error' => 'invalid_id']);
    exit;
}

$name = trim((string) ($input['name'] ?? ''));
if ($name === '') {
    http_response_code(400);
    echo json_encode(['error' => 'missing_name']);
    exit;
}

$note = trimNullable($input['note'] ?? null);

try {
    $db = DatabaseConnector::getConnection();

    $check = $db->prepare('SELECT ItemCategoryID FROM itemcategory WHERE ItemCategoryID = :id LIMIT 1');
    $check->bindValue(':id', $categoryId, PDO::PARAM_INT);
    $check->execute();
    if (!$check->fetch(PDO::FETCH_ASSOC)) {
        http_response_code(404);
        echo json_encode(['error' => 'not_found']);
        exit;
    }

    $sql = 'UPDATE itemcategory SET Name = :name, Note = :note WHERE ItemCategoryID = :id';
    $stmt = $db->prepare($sql);
    $stmt->bindValue(':name', $name, PDO::PARAM_STR);
    bindNullableString($stmt, ':note', $note);
    $stmt->bindValue(':id', $categoryId, PDO::PARAM_INT);
    $stmt->execute();

    $detail = fetchCategoryDetail($db, $categoryId);
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

function fetchCategoryDetail(PDO $db, int $categoryId): array
{
    $sql = "
        SELECT
            ic.ItemCategoryID AS item_category_id,
            ic.Name AS name,
            ic.Note AS note,
            COUNT(DISTINCT i.ItemID) AS item_count,
            COUNT(DISTINCT iu.ItemUnitID) AS item_unit_count
        FROM itemcategory ic
        LEFT JOIN items i ON i.ItemCategoryID = ic.ItemCategoryID
        LEFT JOIN item_unit iu ON iu.ItemID = i.ItemID
        WHERE ic.ItemCategoryID = :id
        GROUP BY ic.ItemCategoryID
        LIMIT 1
    ";
    $stmt = $db->prepare($sql);
    $stmt->bindValue(':id', $categoryId, PDO::PARAM_INT);
    $stmt->execute();
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row) {
        return [];
    }
    $row['updated_at'] = null;
    $row['updated_by'] = null;
    $row['updated_by_name'] = null;
    return $row;
}