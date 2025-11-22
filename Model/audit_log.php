<?php
require_once __DIR__ . '/database_connector.php';

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

function fetchAuditMetadataForEntity(PDO $db, string $entityType, int $entityId): array
{
    $metadata = fetchAuditMetadataForEntities($db, $entityType, [$entityId]);
    return $metadata[$entityId] ?? buildEmptyAuditMetadata();
}

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