(function () {
    const params = new URLSearchParams(window.location.search);
    const entityTypeParam = params.get('entity_type') || '';
    const entityIdParam = params.get('entity_id') || '';
    const eventIdParam = params.get('event_id') || '';
    const returnToParam = params.get('return_to') || '';

    const entityNameDisplay = document.getElementById('auditEntityName');
    const listContainer = document.getElementById('auditLogTableBody');
    const emptyState = document.getElementById('auditLogEmpty');
    const errorBox = document.getElementById('auditLogError');
    const loading = document.getElementById('auditLogLoading');
    const auditTable = document.getElementById('auditLogTable');
    const pagination = document.getElementById('auditPagination');
    const pageInfo = document.getElementById('auditPageInfo');
    const prevPageButton = document.getElementById('auditPrevPage');
    const nextPageButton = document.getElementById('auditNextPage');
    const actionFilterSelect = document.getElementById('auditActionFilter');
    const entityTypeFilterSelect = document.getElementById('auditEntityTypeFilter');
    const actionByInput = document.getElementById('auditActionByFilter');
    const applyFiltersButton = document.getElementById('auditApplyFilters');
    const resetFiltersButton = document.getElementById('auditResetFilters');
    const subtitle = document.getElementById('auditLogSubtitle');
    const pageTitle = document.getElementById('auditPageTitle');
    const backLink = document.getElementById('auditBackLink');

    const PAGE_SIZE = 100;
    const actionLabels = {
        CREATE: 'Create',
        UPDATE: 'Update',
        ARCHIVE: 'Archive',
        UNARCHIVED: 'Unarchive',
        DELETE: 'Delete',
    };

    function setError(message) {
        if (!errorBox) return;
        errorBox.textContent = message || '';
        errorBox.hidden = !message;
    }

    function formatAction(action) {
        const normalized = typeof action === 'string' ? action.trim().toUpperCase() : '';
        return actionLabels[normalized] || (normalized || 'ไม่ระบุการทำรายการ');
    }

    function formatStaffLabel(log) {
        if (log?.action_by_label && log.action_by_label.trim()) {
            return log.action_by_label.trim();
        }
        if (log?.action_by_id) {
            return `Staff#${log.action_by_id}`;
        }
        return 'ไม่ระบุผู้ดำเนินการ';
    }

    function formatEntity(log) {
        const type = log?.entity_type || '';
        const id = log?.entity_id;
        const label = log?.entity_label || '';
        const base = type ? `${type}${id ? `#${id}` : ''}` : `ID ${id ?? '—'}`;
        if (label) {
            return `${label} (${base})`;
        }
        return base;
    }

    function formatTimestamp(value) {
        if (!value) return '—';
        const dt = new Date(value);
        if (Number.isNaN(dt.getTime())) return '—';
        return dt.toLocaleString('th-TH', { hour12: false });
    }

    function formatReason(text) {
        const normalized = typeof text === 'string' ? text.trim() : '';
        return normalized || '—';
    }

    function normalizeActionFilter(value) {
        const normalized = typeof value === 'string' ? value.trim().toUpperCase() : '';
        return actionLabels[normalized] ? normalized : '';
    }

    function normalizeEntityType(value) {
        const allowed = [
            'staff',
            'location',
            'customer',
            'supplier',
            'warehouse',
            'item',
            'item_unit',
            'item_category',
            'event',
            'request',
            'rfq',
            'quotation',
            'po',
            'deliveryin',
            'deliveryout',
            'receipt',
            'otherdocs',
            'announcement',
        ];
        const normalized = typeof value === 'string' ? value.trim() : '';
        return allowed.includes(normalized) ? normalized : '';
    }

    function parseFilters() {
        return {
            action: normalizeActionFilter(params.get('action')),
            entityType: normalizeEntityType(params.get('entity_type')),
            actionBy: (() => {
                const raw = params.get('action_by');
                if (!raw) return '';
                const numeric = Number.parseInt(raw, 10);
                return Number.isFinite(numeric) && numeric > 0 ? String(numeric) : '';
            })(),
            page: (() => {
                const numeric = Number.parseInt(params.get('page') || '1', 10);
                return Number.isFinite(numeric) && numeric > 0 ? numeric : 1;
            })(),
        };
    }

    function syncFilterControls(filters) {
        if (actionFilterSelect) {
            actionFilterSelect.value = filters.action || '';
        }
        if (entityTypeFilterSelect) {
            entityTypeFilterSelect.value = filters.entityType || '';
            if (entityTypeParam && entityIdParam) {
                entityTypeFilterSelect.value = entityTypeParam;
                entityTypeFilterSelect.disabled = true;
            }
        }
        if (actionByInput) {
            actionByInput.value = filters.actionBy || '';
        }
    }

    function buildQueryParams(filters) {
        const qp = new URLSearchParams();
        if (entityTypeParam && entityIdParam) {
            qp.set('entity_type', entityTypeParam);
            qp.set('entity_id', entityIdParam);
            if (eventIdParam) {
                qp.set('event_id', eventIdParam);
            }
            if (returnToParam) {
                qp.set('return_to', returnToParam);
            }
        } else if (filters.entityType) {
            qp.set('entity_type', filters.entityType);
        }
        if (filters.action) qp.set('action', filters.action);
        if (filters.actionBy) qp.set('action_by', filters.actionBy);
        qp.set('page', filters.page || 1);
        qp.set('page_size', PAGE_SIZE);
        return qp;
    }

    function updateUrl(filters) {
        const qp = buildQueryParams(filters);
        const nextUrl = `${window.location.pathname}?${qp.toString()}`;
        window.history.replaceState({}, '', nextUrl);
    }

    function setPageTitle(entityLabel) {
        if (pageTitle) {
            pageTitle.textContent = entityTypeParam && entityIdParam ? 'ประวัติการดำเนินการ' : 'บันทึกการดำเนินการทั้งหมด';
        }
        if (subtitle) {
            if (entityTypeParam && entityIdParam) {
                subtitle.textContent = 'แสดงการสร้าง ปรับปรุง หรือการจัดการทั้งหมดของข้อมูลนี้';
            } else {
                subtitle.textContent = 'ประวัติการดำเนินการล่าสุด เรียงจากใหม่ไปเก่า (100 รายการต่อหน้า)';
            }
        }
        if (entityNameDisplay && (entityTypeParam && entityIdParam)) {
            const baseLabel = entityLabel || '';
            const idDisplay = entityIdParam ? `ID: ${entityIdParam}` : '';
            entityNameDisplay.textContent = baseLabel ? `${baseLabel} (${idDisplay})` : idDisplay || '—';
        } else if (entityNameDisplay) {
            entityNameDisplay.textContent = 'กิจกรรมทั้งหมดในระบบ';
        }
    }

    function setBackLink() {
        if (!backLink) return;
        let target = returnToParam || '';
        if (!target && entityTypeParam === 'request' && eventIdParam) {
            target = `./event_document_manage.html?event_id=${encodeURIComponent(eventIdParam)}`;
        }
        if (!target) {
            target = './event_document_manage.html';
        }
        backLink.href = target;
    }

    function renderRows(logs) {
        if (!listContainer || !auditTable || !emptyState) return;
        listContainer.innerHTML = '';
        const hasLogs = Array.isArray(logs) && logs.length > 0;
        auditTable.hidden = !hasLogs;
        emptyState.hidden = hasLogs;
        if (!hasLogs) return;
        logs.forEach((log) => {
            const row = document.createElement('tr');

            const actionCell = document.createElement('td');
            actionCell.textContent = formatAction(log?.action);
            row.appendChild(actionCell);

            const entityCell = document.createElement('td');
            entityCell.textContent = formatEntity(log);
            row.appendChild(entityCell);

            const reasonCell = document.createElement('td');
            reasonCell.textContent = formatReason(log?.reason);
            row.appendChild(reasonCell);

            const actorCell = document.createElement('td');
            actorCell.textContent = formatStaffLabel(log);
            row.appendChild(actorCell);

            const timeCell = document.createElement('td');
            timeCell.textContent = formatTimestamp(log?.action_at);
            row.appendChild(timeCell);

            listContainer.appendChild(row);
        });
    }

    function renderPagination(currentPage, total, pageSize) {
        if (!pagination || !pageInfo || !prevPageButton || !nextPageButton) return;
        const totalPages = Math.max(1, Math.ceil(total / pageSize));
        pagination.hidden = totalPages <= 1;
        pageInfo.textContent = `หน้า ${currentPage} / ${totalPages}`;
        prevPageButton.disabled = currentPage <= 1;
        nextPageButton.disabled = currentPage >= totalPages;
    }

    async function loadLogs(filters) {
        if (!entityTypeParam && entityIdParam) {
            setError('พารามิเตอร์ไม่ครบถ้วน');
            return;
        }
        try {
            const root = document.documentElement.getAttribute('data-root') || '..';
            const qp = buildQueryParams(filters);
            const response = await fetch(`${root}/Model/audit_log_list.php?${qp.toString()}`, { credentials: 'same-origin' });
            if (!response.ok) {
                throw new Error('ไม่สามารถโหลดประวัติได้');
            }
            const payload = await response.json();
            const data = payload?.data;
            if (!data) {
                throw new Error('ข้อมูลไม่ถูกต้อง');
            }

            if (entityTypeParam && entityIdParam) {
                setPageTitle(data.entity_label || '');
            } else {
                setPageTitle('');
            }

            const logs = Array.isArray(data.logs) ? data.logs : [];
            renderRows(logs);

            const currentPage = data.page || filters.page || 1;
            const total = data.total || logs.length;
            renderPagination(currentPage, total, data.page_size || PAGE_SIZE);
        } catch (error) {
            console.error(error);
            setError(error?.message || 'ไม่สามารถโหลดประวัติได้');
        } finally {
            if (loading) {
                loading.hidden = true;
            }
        }
    }

    function applyFilters(nextPage = 1) {
        const filters = parseFilters();
        filters.page = nextPage;
        if (actionFilterSelect) {
            filters.action = normalizeActionFilter(actionFilterSelect.value);
        }
        if (!entityTypeParam || !entityIdParam) {
            filters.entityType = normalizeEntityType(entityTypeFilterSelect?.value || '');
        } else {
            filters.entityType = entityTypeParam;
        }
        const actionByValue = actionByInput?.value ? Number.parseInt(actionByInput.value, 10) : Number.NaN;
        filters.actionBy = Number.isFinite(actionByValue) && actionByValue > 0 ? String(actionByValue) : '';

        updateUrl(filters);
        loadLogs(filters);
    }

    function resetFilters() {
        const filters = { action: '', entityType: entityTypeParam || '', actionBy: '', page: 1 };
        syncFilterControls(filters);
        updateUrl(filters);
        loadLogs(filters);
    }

    function bindEvents() {
        if (applyFiltersButton) {
            applyFiltersButton.addEventListener('click', () => applyFilters(1));
        }
        if (resetFiltersButton) {
            resetFiltersButton.addEventListener('click', () => resetFilters());
        }
        if (prevPageButton) {
            prevPageButton.addEventListener('click', () => {
                const filters = parseFilters();
                const prevPage = Math.max(1, (filters.page || 1) - 1);
                applyFilters(prevPage);
            });
        }
        if (nextPageButton) {
            nextPageButton.addEventListener('click', () => {
                const filters = parseFilters();
                const nextPage = (filters.page || 1) + 1;
                applyFilters(nextPage);
            });
        }
    }

    function init() {
        const filters = parseFilters();
        syncFilterControls(filters);
        setBackLink();
        setPageTitle('');
        bindEvents();
        loadLogs(filters);
    }

    init();
})();
