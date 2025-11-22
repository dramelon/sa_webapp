(function () {
    const params = new URLSearchParams(window.location.search);
    const entityType = params.get('entity_type') || '';
    const entityId = params.get('entity_id') || '';
    const entityNameDisplay = document.getElementById('auditEntityName');
    const listContainer = document.getElementById('auditLogList');
    const emptyState = document.getElementById('auditLogEmpty');
    const errorBox = document.getElementById('auditLogError');
    const loading = document.getElementById('auditLogLoading');

    function setError(message) {
        if (!errorBox) return;
        errorBox.textContent = message;
        errorBox.hidden = !message;
    }

    function formatLine(log, index, total) {
        const reason = log.reason && log.reason.trim() ? log.reason.trim() : '—';
        const action = (log.action || '').toUpperCase();
        const actor = log.action_by_label || (log.action_by_id ? `Staff#${log.action_by_id}` : 'ไม่ระบุผู้ดำเนินการ');
        const timestamp = log.action_at || '—';
        const displayIndex = total - index;
        return `${displayIndex}. ${reason} ${action} - ${actor} ${timestamp}`;
    }

    async function loadLogs() {
        if (!entityType || !entityId) {
            setError('พารามิเตอร์ไม่ครบถ้วน');
            return;
        }
        try {
            const root = document.documentElement.getAttribute('data-root') || '..';
            const response = await fetch(`${root}/Model/audit_log_list.php?entity_type=${encodeURIComponent(entityType)}&entity_id=${encodeURIComponent(entityId)}`, { credentials: 'same-origin' });
            if (!response.ok) {
                throw new Error('ไม่สามารถโหลดประวัติได้');
            }
            const payload = await response.json();
            const data = payload?.data;
            if (!data) {
                throw new Error('ข้อมูลไม่ถูกต้อง');
            }
            if (entityNameDisplay) {
                const label = data.entity_label || '';
                entityNameDisplay.textContent = label ? `${label} (ID: ${data.entity_id})` : `ID: ${data.entity_id}`;
            }
            const logs = Array.isArray(data.logs) ? data.logs : [];
            if (!listContainer || !emptyState) {
                return;
            }
            listContainer.innerHTML = '';
            if (logs.length === 0) {
                emptyState.hidden = false;
                listContainer.hidden = true;
                return;
            }
            emptyState.hidden = true;
            listContainer.hidden = false;
            logs.forEach((log, index) => {
                const line = document.createElement('li');
                line.textContent = formatLine(log, index, logs.length);
                listContainer.appendChild(line);
            });
        } catch (error) {
            console.error(error);
            setError(error?.message || 'ไม่สามารถโหลดประวัติได้');
        } finally {
            if (loading) {
                loading.hidden = true;
            }
        }
    }

    loadLogs();
})();