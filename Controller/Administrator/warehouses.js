(function () {
    const summaryOrder = ['all', 'active', 'inactive'];
    const summaryMeta = {
        all: { label: 'ทั้งหมด', icon: 'stack' },
        active: { label: 'ใช้งาน', icon: 'check' },
        inactive: { label: 'ปิดใช้งาน', icon: 'x' },
    };

    const searchInput = document.getElementById('searchInput');
    const statusFilter = document.getElementById('statusFilter');
    const clearFiltersBtn = document.getElementById('btnClearFilters');
    const newWarehouseBtn = document.getElementById('btnNewWarehouse');
    const tableBody = document.getElementById('warehouseTableBody');
    const emptyState = document.getElementById('emptyState');
    const summaryWrap = document.getElementById('summaryCards');
    const prevPageBtn = document.getElementById('prevPage');
    const nextPageBtn = document.getElementById('nextPage');
    const pageIndicator = document.getElementById('pageIndicator');
    const tableHeaders = document.querySelectorAll('.warehouse-table thead th[data-sort-key]');
    const sortButtons = document.querySelectorAll('.warehouse-table thead .sort-button');

    let warehouses = [];
    let counts = { all: 0, active: 0, inactive: 0 };
    let currentPage = 1;
    let hasNext = false;
    let hasPrev = false;
    let modelRoot = '';
    let lastRequestToken = 0;
    let searchDebounce = null;
    const defaultSort = Object.freeze({ key: 'warehouse_id', direction: 'desc' });
    let sortKey = defaultSort.key;
    let sortDirection = defaultSort.direction;

    const updateThaiDate = () => {
        const now = new Date();
        const days = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
        const months = [
            'มกราคม',
            'กุมภาพันธ์',
            'มีนาคม',
            'เมษายน',
            'พฤษภาคม',
            'มิถุนายน',
            'กรกฎาคม',
            'สิงหาคม',
            'กันยายน',
            'ตุลาคม',
            'พฤศจิกายน',
            'ธันวาคม',
        ];
        const day = days[now.getDay()];
        const date = now.getDate();
        const month = months[now.getMonth()];
        const year = now.getFullYear() + 543;
        const time = now.toLocaleTimeString('th-TH', { hour12: false });
        const el = document.getElementById('pageDate');
        if (el) {
            el.textContent = `วัน${day}ที่ ${date} ${month} ${year} เวลา ${time}`;
        }
    };

    function normalizeCounts(source = {}) {
        const next = { all: 0, active: 0, inactive: 0 };
        for (const key of ['active', 'inactive']) {
            const value = Number(source[key]);
            next[key] = Number.isFinite(value) ? value : 0;
            next.all += next[key];
        }
        if (source.all != null && Number.isFinite(Number(source.all))) {
            next.all = Number(source.all);
        }
        return next;
    }

    function renderSummary() {
        if (!summaryWrap) return;
        summaryWrap.innerHTML = '';
        for (const key of summaryOrder) {
            const meta = summaryMeta[key];
            if (!meta) continue;
            const card = document.createElement('button');
            card.type = 'button';
            card.className = 'summary-card';
            card.dataset.status = key;
            card.innerHTML = `
                <header>
                    <span class="i ${meta.icon}"></span>
                    <p>${meta.label}</p>
                </header>
                <strong>${counts[key] ?? 0}</strong>
            `;
            summaryWrap.append(card);
        }
        updateActiveSummary();
    }

    function updateActiveSummary() {
        if (!summaryWrap) return;
        const current = statusFilter?.value || 'all';
        summaryWrap.querySelectorAll('.summary-card').forEach((card) => {
            card.classList.toggle('active', card.dataset.status === current);
        });
    }

    function escapeHtml(text) {
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function formatStatus(status) {
        const normalized = typeof status === 'string' ? status.toLowerCase() : 'active';
        if (normalized === 'inactive') {
            return '<span class="status-badge cancelled"><span class="dot"></span>ปิดใช้งาน</span>';
        }
        return '<span class="status-badge planning"><span class="dot"></span>ใช้งาน</span>';
    }

    function formatDateTime(value) {
        if (!value) return '—';
        const date = new Date(String(value).replace(' ', 'T'));
        if (Number.isNaN(date.getTime())) {
            return escapeHtml(value);
        }
        return date.toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
    }

    function renderTable(items) {
        if (!tableBody) return;
        tableBody.innerHTML = '';
        if (!items.length) {
            emptyState?.classList.add('show');
            emptyState?.setAttribute('aria-hidden', 'false');
            return;
        }
        emptyState?.classList.remove('show');
        emptyState?.setAttribute('aria-hidden', 'true');
        for (const row of items) {
            const tr = document.createElement('tr');
            const warehouseId = row.warehouse_id != null ? String(row.warehouse_id) : '—';
            const locationName = row.location_name ? escapeHtml(row.location_name) : '—';
            const sn = row.warehouse_sn ? escapeHtml(row.warehouse_sn) : '—';
            tr.innerHTML = `
                <td>${warehouseId}</td>
                <td>
                    <div class="cell-title">${row.warehouse_name ? escapeHtml(row.warehouse_name) : '—'}</div>
                    <p class="cell-sub">${row.note ? escapeHtml(row.note) : ''}</p>
                </td>
                <td>${locationName}</td>
                <td>${sn}</td>
                <td>${formatStatus(row.status)}</td>
                <td>${formatDateTime(row.updated_at)}</td>
                <td class="col-actions">
                    <button class="action-btn" type="button" data-action="open" data-id="${escapeHtml(
                        String(row.warehouse_id ?? ''),
                    )}">
                        <span class="i list"></span>รายละเอียด
                    </button>
                </td>
            `;
            tableBody.append(tr);
        }
    }

    function updatePagination() {
        if (prevPageBtn) {
            prevPageBtn.disabled = !hasPrev;
        }
        if (nextPageBtn) {
            nextPageBtn.disabled = !hasNext;
        }
        if (pageIndicator) {
            pageIndicator.textContent = `หน้า ${currentPage}`;
        }
    }

    function updateSortIndicators() {
        tableHeaders.forEach((th) => {
            const key = th.dataset.sortKey;
            const isActive = key === sortKey;
            const ariaState = isActive ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none';
            th.setAttribute('aria-sort', ariaState);
            const indicator = th.querySelector('.sort-indicator');
            if (indicator) {
                indicator.textContent = ariaState === 'ascending' ? '▲' : ariaState === 'descending' ? '▼' : '↕';
            }
            const button = th.querySelector('.sort-button');
            if (button) {
                const label = button.dataset.label || button.textContent.trim();
                if (ariaState === 'ascending') {
                    button.setAttribute('aria-label', `จัดเรียงตาม${label} (น้อยไปมาก)`);
                } else if (ariaState === 'descending') {
                    button.setAttribute('aria-label', `จัดเรียงตาม${label} (มากไปน้อย)`);
                } else {
                    button.setAttribute('aria-label', `จัดเรียงตาม${label}`);
                }
            }
        });
    }

    function showLoadingRow() {
        if (!tableBody) return;
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="loading">กำลังโหลด...</td>
            </tr>
        `;
        emptyState?.classList.remove('show');
        emptyState?.setAttribute('aria-hidden', 'true');
    }

    async function fetchWarehouses() {
        if (!modelRoot) return;
        const token = ++lastRequestToken;
        showLoadingRow();
        const params = new URLSearchParams();
        params.set('page', currentPage);
        params.set('sort_key', sortKey);
        params.set('sort_direction', sortDirection);
        const status = statusFilter?.value || 'all';
        params.set('status', status);
        const term = searchInput?.value.trim();
        if (term) {
            params.set('search', term);
        }
        try {
            // const response = await fetch(`${modelRoot}/warehouses_list.php?${params.toString()}`, {
            const response = await fetch(`${modelRoot}/warehouses_list.php`, {
                credentials: 'same-origin',
            });
            if (!response.ok) throw new Error('network');
            const payload = await response.json();
            if (token !== lastRequestToken) {
                return;
            }
            warehouses = Array.isArray(payload.data) ? payload.data : [];
            counts = normalizeCounts(payload.counts);
            hasNext = Boolean(payload.has_next);
            hasPrev = Boolean(payload.has_prev);
            renderSummary();
            renderTable(warehouses);
            updatePagination();
            updateSortIndicators();
        } catch (error) {
            if (token !== lastRequestToken) {
                return;
            }
            warehouses = [];
            counts = normalizeCounts();
            hasNext = false;
            hasPrev = currentPage > 1;
            renderSummary();
            renderTable(warehouses);
            updatePagination();
            updateSortIndicators();
            if (tableBody) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="7" class="loading">ไม่สามารถโหลดข้อมูลคลังสินค้าได้</td>
                    </tr>
                `;
            }
        }
    }

    function setStatusFilter(value) {
        if (!summaryMeta[value]) {
            value = 'all';
        }
        if (statusFilter) {
            statusFilter.value = value;
        }
        currentPage = 1;
        updateActiveSummary();
        fetchWarehouses();
    }

    function handleSearchChange() {
        if (searchDebounce) {
            clearTimeout(searchDebounce);
        }
        searchDebounce = setTimeout(() => {
            currentPage = 1;
            fetchWarehouses();
        }, 250);
    }

    if (searchInput) {
        searchInput.addEventListener('input', handleSearchChange);
    }

    if (statusFilter) {
        statusFilter.addEventListener('change', () => {
            setStatusFilter(statusFilter.value || 'all');
        });
    }

    if (summaryWrap) {
        summaryWrap.addEventListener('click', (event) => {
            const card = event.target.closest('.summary-card');
            if (!card) return;
            setStatusFilter(card.dataset.status || 'all');
        });
    }

    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', () => {
            if (searchInput) {
                searchInput.value = '';
            }
            setStatusFilter('all');
        });
    }

    if (prevPageBtn) {
        prevPageBtn.addEventListener('click', () => {
            if (!hasPrev) return;
            currentPage = Math.max(1, currentPage - 1);
            fetchWarehouses();
        });
    }

    if (nextPageBtn) {
        nextPageBtn.addEventListener('click', () => {
            if (!hasNext) return;
            currentPage += 1;
            fetchWarehouses();
        });
    }

    sortButtons.forEach((button) => {
        button.addEventListener('click', () => {
            const key = button.dataset.sortKey;
            if (!key) return;
            if (sortKey === key) {
                sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                sortKey = key;
                sortDirection = key === defaultSort.key ? defaultSort.direction : 'asc';
            }
            updateSortIndicators();
            currentPage = 1;
            fetchWarehouses();
        });
    });

    if (newWarehouseBtn) {
        newWarehouseBtn.addEventListener('click', () => {
            const target = newWarehouseBtn.dataset.target;
            if (target) {
                window.location.href = target;
            }
        });
    }

    if (tableBody) {
        tableBody.addEventListener('click', (event) => {
            const actionBtn = event.target.closest('button[data-action="open"]');
            if (!actionBtn || !tableBody.contains(actionBtn)) {
                return;
            }
            const warehouseId = actionBtn.dataset.id;
            if (!warehouseId) {
                return;
            }
            const params = new URLSearchParams({ warehouse_id: warehouseId });
            window.location.href = `./warehouse_detail.html?${params.toString()}`;
        });
    }

    const boot = ({ root }) => {
        modelRoot = `${root}/Model`;
        updateThaiDate();
        setInterval(updateThaiDate, 1000);
        fetchWarehouses();
    };

    if (typeof window.onAppReady === 'function') {
        window.onAppReady(boot);
    }
})();