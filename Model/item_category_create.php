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

$name = trim((string) ($input['name'] ?? ''));
if ($name === '') {
    http_response_code(400);
    echo json_encode(['error' => 'missing_name']);
    exit;
}

$note = trimNullable($input['note'] ?? null);
$staffId = (int) $_SESSION['staff_id'];

try {
    $db = DatabaseConnector::getConnection();

    $sql = 'INSERT INTO itemcategorys (Name, Note) VALUES (:name, :note)';
    $stmt = $db->prepare($sql);
    $stmt->bindValue(':name', $name, PDO::PARAM_STR);
    bindNullableString($stmt, ':note', $note);
    $stmt->execute();

    $categoryId = (int) $db->lastInsertId();

    recordAuditEvent($db, 'item_category', $categoryId, 'CREATE', $staffId);

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
            COUNT(DISTINCT i.ItemID) AS item_count,
            COUNT(DISTINCT iu.ItemUnitID) AS item_unit_count
        FROM itemcategorys ic
        LEFT JOIN items i ON i.ItemCategoryID = ic.ItemCategoryID
        LEFT JOIN item_units iu ON iu.ItemID = i.ItemID
        WHERE ic.ItemCategoryID = :id
        GROUP BY ic.ItemCategoryID
        LIMIT 1
    ";
    $stmt = $db->prepare($sql);
    $stmt->bindValue(':id', $categoryId, PDO::PARAM_INT);
    $stmt->execute();
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row) return [];

    $audit = fetchAuditMetadataForEntity($db, 'item_category', $categoryId);

    return array_merge($row, [
        'updated_at' => $audit['updated_at'],
        'updated_by_id' => $audit['updated_by_id'],
        'updated_by_label' => formatStaffLabel(
            $audit['updated_by_id'],
            $audit['updated_by_name'],
            $audit['updated_by_role']
        ),
    ]);
}

function formatStaffLabel($id, $name, $role) { return ''; }