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

$name = trim((string) ($input['name'] ?? ''));
if ($name === '') {
    http_response_code(400);
    echo json_encode(['error' => 'missing_name']);
    exit;
}

$note = trimNullable($input['note'] ?? null);

try {
    $db = new PDO(
        'mysql:host=localhost;dbname=sa_webapp;charset=utf8mb4',
        'dramelon',
        'dramelon',
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );

    $sql = 'INSERT INTO itemcategory (Name, Note) VALUES (:name, :note)';
    $stmt = $db->prepare($sql);
    $stmt->bindValue(':name', $name, PDO::PARAM_STR);
    bindNullableString($stmt, ':note', $note);
    $stmt->execute();

    $categoryId = (int) $db->lastInsertId();
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
            COUNT(i.ItemID) AS item_count
        FROM itemcategory ic
        LEFT JOIN items i ON i.ItemCategoryID = ic.ItemCategoryID
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