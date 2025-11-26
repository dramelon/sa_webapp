<?php
require_once __DIR__ . '/database_connector.php';

/**
 * Records a single audit event in the database.
 * @param PDO $db The database connection object.
 * @param string $entityType The type of the entity being audited (e.g., 'customer', 'item').
 * @param int $entityId The ID of the entity.
 * @param string $action The action performed (e.g., 'CREATE', 'UPDATE', 'DELETE').
 * @param int|null $staffId The ID of the staff member who performed the action.
 * @param string|null $reason An optional description or reason for the action.
 */
function recordAuditEvent(PDO $db, string $entityType, int $entityId, string $action, ?int $staffId = null, ?string $reason = null): void
{
    $stmt = $db->prepare('INSERT INTO audit (EntityType, EntityID, Action, Reason, ActionBy) VALUES (:entity_type, :entity_id, :action, :reason, :action_by)');
    $stmt->bindValue(':entity_type', $entityType, PDO::PARAM_STR);
    $stmt->bindValue(':entity_id', $entityId, PDO::PARAM_INT);
    $stmt->bindValue(':action', strtoupper($action), PDO::PARAM_STR);
    if ($reason === null) {
        $stmt->bindValue(':reason', null, PDO::PARAM_NULL);
    } else {
        $stmt->bindValue(':reason', $reason, PDO::PARAM_STR);
    }
    if ($staffId === null) {
        $stmt->bindValue(':action_by', null, PDO::PARAM_NULL);
    } else {
        $stmt->bindValue(':action_by', $staffId, PDO::PARAM_INT);
    }
    $stmt->execute();
}

/**
 * Creates a default, empty structure for audit metadata.
 * @return array An associative array with null values for all audit-related fields.
 */
function buildEmptyAuditMetadata(): array
{
    return [
        'created_at' => null,
        'created_by_id' => null,
        'created_by_name' => null,
        'created_by_role' => null,
        'updated_at' => null,
        'updated_by_id' => null,
        'updated_by_name' => null,
        'updated_by_role' => null,
    ];
}

/**
 * Fetches creation and last update metadata for multiple entities of the same type in a single query.
 * @param PDO $db The database connection object.
 * @param string $entityType The type of entities to fetch metadata for.
 * @param array $entityIds An array of entity IDs.
 * @return array An associative array where keys are entity IDs and values are their audit metadata.
 */
function fetchAuditMetadataForEntities(PDO $db, string $entityType, array $entityIds): array
{
    $entityIds = array_values(array_unique(array_map('intval', array_filter($entityIds, function ($value) {
        return $value !== null && $value !== '';
    }))));

    if (empty($entityIds)) {
        return [];
    }

    $placeholders = [];
    foreach ($entityIds as $index => $entityId) {
        $placeholders[":id{$index}"] = $entityId;
    }

    $sql = sprintf(
        'SELECT a.EntityID, a.Action, a.ActionAt, a.ActionBy, s.FullName AS staff_name, s.Role AS staff_role
         FROM audit a
         LEFT JOIN staffs s ON s.StaffID = a.ActionBy
         WHERE a.EntityType = :entity_type AND a.EntityID IN (%s) AND a.Action IN (\'CREATE\', \'UPDATE\')
         ORDER BY a.EntityID ASC, a.ActionAt ASC, a.AuditID ASC',
        implode(', ', array_keys($placeholders))
    );

    $stmt = $db->prepare($sql);
    $stmt->bindValue(':entity_type', $entityType, PDO::PARAM_STR);
    foreach ($placeholders as $placeholder => $value) {
        $stmt->bindValue($placeholder, $value, PDO::PARAM_INT);
    }
    $stmt->execute();

    $metadata = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $entityId = (int) $row['EntityID'];
        $action = strtoupper((string) $row['Action']);
        if (!isset($metadata[$entityId])) {
            $metadata[$entityId] = buildEmptyAuditMetadata();
        }

        if ($action === 'CREATE' && $metadata[$entityId]['created_at'] === null) {
            $metadata[$entityId]['created_at'] = $row['ActionAt'];
            $metadata[$entityId]['created_by_id'] = $row['ActionBy'] !== null ? (int) $row['ActionBy'] : null;
            $metadata[$entityId]['created_by_name'] = $row['staff_name'] ?? null;
            $metadata[$entityId]['created_by_role'] = $row['staff_role'] ?? null;
        }

        if ($action === 'UPDATE') {
            $metadata[$entityId]['updated_at'] = $row['ActionAt'];
            $metadata[$entityId]['updated_by_id'] = $row['ActionBy'] !== null ? (int) $row['ActionBy'] : null;
            $metadata[$entityId]['updated_by_name'] = $row['staff_name'] ?? null;
            $metadata[$entityId]['updated_by_role'] = $row['staff_role'] ?? null;
        }
    }

    return $metadata;
}

/**
 * A wrapper around fetchAuditMetadataForEntities to get metadata for a single entity.
 * @param PDO $db The database connection object.
 * @param string $entityType The type of the entity.
 * @param int $entityId The ID of the entity.
 * @return array An associative array containing the audit metadata for the specified entity.
 */
function fetchAuditMetadataForEntity(PDO $db, string $entityType, int $entityId): array
{
    $metadata = fetchAuditMetadataForEntities($db, $entityType, [$entityId]);
    return $metadata[$entityId] ?? buildEmptyAuditMetadata();
}

/**
 * Fetches the complete history of audit logs for a specific entity.
 * @param PDO $db The database connection object.
 * @param string $entityType The type of the entity.
 * @param int $entityId The ID of the entity.
 * @return array A list of all audit log records for the entity, ordered from newest to oldest.
 */
function fetchAuditLogsForEntity(PDO $db, string $entityType, int $entityId): array
{
    $stmt = $db->prepare(
        'SELECT a.AuditID, a.Action, a.Reason, a.ActionAt, a.ActionBy, s.FullName AS staff_name, s.Role AS staff_role
         FROM audit a
         LEFT JOIN staffs s ON s.StaffID = a.ActionBy
         WHERE a.EntityType = :entity_type AND a.EntityID = :entity_id
         ORDER BY a.ActionAt DESC, a.AuditID DESC'
    );
    $stmt->bindValue(':entity_type', $entityType, PDO::PARAM_STR);
    $stmt->bindValue(':entity_id', $entityId, PDO::PARAM_INT);
    $stmt->execute();

    $logs = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $logs[] = [
            'audit_id' => (int) $row['AuditID'],
            'action' => strtoupper((string) ($row['Action'] ?? '')),
            'reason' => $row['Reason'],
            'action_at' => $row['ActionAt'],
            'action_by_id' => $row['ActionBy'] !== null ? (int) $row['ActionBy'] : null,
            'action_by_name' => $row['staff_name'] ?? null,
            'action_by_role' => $row['staff_role'] ?? null,
        ];
    }

    return $logs;
}

if (!function_exists('formatStaffLabel')) {
    /**
     * Formats a standardized label for a staff member.
     * @param int|null $id The staff member's ID.
     * @param string|null $name The staff member's full name.
     * @param string|null $role The staff member's role.
     * @return string The formatted label (e.g., "A1 - John Doe") or an empty string if ID is null.
     */
    function formatStaffLabel($id, $name, $role)
    {
        if ($id === null) {
            return '';
        }

        $displayName = $name !== null && $name !== '' ? $name : 'ไม่ทราบชื่อผู้รับผิดชอบ';
        $roleInitial = $role !== null && $role !== '' ? mb_strtoupper(mb_substr($role, 0, 1, 'UTF-8'), 'UTF-8') : 'S';

        return sprintf('%s%d - %s', $roleInitial, $id, $displayName);
    }
}
?>
