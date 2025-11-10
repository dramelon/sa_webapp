(function () {
    const statusOrder = ['all', 'useable', 'in use', 'pending booking', 'booked', 'delivering', 'reparing', 'damaged', 'returned', 'depreciated'];
    const statusMeta = {
        all: { label: 'ทั้งหมด', icon: 'stack' },
        useable: { label: 'พร้อมใช้งาน', icon: 'check' },
        'in use': { label: 'กำลังใช้งาน', icon: 'progress' },
        'pending booking': { label: 'รอการจอง', icon: 'calendar' },
        booked: { label: 'ถูกจอง', icon: 'clip' },
        delivering: { label: 'กำลังขนส่ง', icon: 'grid' },
        reparing: { label: 'กำลังซ่อม', icon: 'settings' },
        damaged: { label: 'ชำรุด', icon: 'x' },
        returned: { label: 'ส่งคืนแล้ว', icon: 'stack' },
        depreciated: { label: 'ตัดจำหน่าย', icon: 'wallet' },
    };

    const searchInput = document.getElementById('searchInput');
    const statusFilter = document.getElementById('statusFilter');
    const ownershipFilter = document.getElementById('ownershipFilter');
    const clearFiltersBtn = document.getElementById('btnClearFilters');
    const newUnitBtn = document.getElementById('btnNewItemUnit');
    const tableBody = document.getElementById('itemUnitTableBody');
    const emptyState = document.getElementById('emptyState');
    const summaryWrap = document.getElementById('summaryCards');
    const prevPageBtn = document.getElementById('prevPage');
    const nextPageBtn = document.getElementById('nextPage');
    const pageIndicator = document.getElementById('pageIndicator');
    const tableHeaders = document.querySelectorAll('.item-unit-table thead th[data-sort-key]');
    const sortButtons = document.querySelectorAll('.item-unit-table thead .sort-button');

    const defaultSort = Object.freeze({ key: 'item_unit_id', direction: 'desc' });

    let itemUnits = [];
    let counts = normalizeCounts();
    let currentPage = 1;
    let hasNext = false;
    let hasPrev = false;
    let sortKey = defaultSort.key;
    let sortDirection = defaultSort.direction;
    let modelRoot = '';
    let lastRequestToken = 0;
    let searchDebounce = null;

    const updateThaiDate = () => {
        const now = new Date();
        const days = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
        const months = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
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
        const next = { all: 0, useable: 0, 'in use': 0, 'pending booking': 0, booked: 0, delivering: 0, reparing: 0, damaged: 0, returned: 0, depreciated: 0 };
        const providedAll = Number(source.all);
        if (Number.isFinite(providedAll)) {
            next.all = providedAll;
        }
        for (const key of Object.keys(next)) {
            if (key === 'all') continue;
            const value = Number(source[key]);
            next[key] = Number.isFinite(value) ? value : 0;
            if (!Number.isFinite(providedAll)) {
                next.all += next[key];
            }
        }
        return next;
    }

    function renderSummary() {
        if (!summaryWrap) return;
        summaryWrap.innerHTML = '';
        for (const key of statusOrder) {
            const meta = statusMeta[key];
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
            const status = card.dataset.status;
            card.classList.toggle('active', status === current);
        });
    }

    function showLoadingRow() {
        if (!tableBody) return;
        tableBody.innerHTML = `
            <tr>
                <td colspan="9" class="loading">กำลังโหลด...</td>
            </tr>
        `;
        emptyState?.classList.remove('show');
        emptyState?.setAttribute('aria-hidden', 'true');
    }

    async function fetchItemUnits() {
        if (!modelRoot) return;
        const token = ++lastRequestToken;
        showLoadingRow();

        const params = new URLSearchParams();
        params.set('page', currentPage);
        params.set('sort_key', sortKey);
        params.set('sort_direction', sortDirection);
        const term = searchInput?.value.trim();
        if (term) {
            params.set('search', term);
        }
        const statusValue = statusFilter?.value || 'all';
        params.set('status', statusValue);
        const ownershipValue = ownershipFilter?.value || 'all';
        params.set('ownership', ownershipValue);

        try {
            const response = await fetch(`${modelRoot}/item_units_list.php?${params.toString()}`, {
                credentials: 'same-origin',
            });
            if (!response.ok) throw new Error('network');
            const payload = await response.json();
            if (token !== lastRequestToken) return;
            itemUnits = Array.isArray(payload.data) ? payload.data : [];
            counts = normalizeCounts(payload.counts);
            hasNext = Boolean(payload.has_next);
            hasPrev = Boolean(payload.has_prev);
            renderSummary();
            renderTable(itemUnits);
            updatePagination();
            updateSortIndicators();
        } catch (err) {
            if (token !== lastRequestToken) return;
            itemUnits = [];
            counts = normalizeCounts();
            hasNext = false;
            hasPrev = false;
            renderSummary();
            renderTable(itemUnits);
            updatePagination();
            updateSortIndicators();
        }
    }

    function renderTable(rows) {
        if (!tableBody) return;
        tableBody.innerHTML = '';
        if (!rows.length) {
            emptyState?.classList.add('show');
            emptyState?.setAttribute('aria-hidden', 'false');
            return;
        }
        emptyState?.classList.remove('show');
        emptyState?.setAttribute('aria-hidden', 'true');

        for (const row of rows) {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${escapeHtml(row.item_unit_id ?? '—')}</td>
                <td>${row.item_name ? escapeHtml(row.item_name) : '—'}</td>
                <td>${row.serial_number ? escapeHtml(row.serial_number) : '—'}</td>
                <td>${formatStatus(row.status)}</td>
                <td>${formatOwnership(row.ownership)}</td>
                <td>${formatDateTime(row.expected_return_at)}</td>
                <td>${formatDateTime(row.return_at)}</td>
                <td>${formatDateTime(row.updated_at)}</td>
                <td class="col-actions">
                    <button class="action-btn" type="button" data-action="open" data-id="${escapeHtml(String(row.item_unit_id ?? ''))}">
                        <span class="i pencil"></span>จัดการ
                    </button>
                </td>
            `;
            tableBody.append(tr);
        }
    }

    function formatStatus(status) {
        const normalized = typeof status === 'string' ? status.toLowerCase() : 'useable';
        const displayKey = normalized;
        const label = statusMeta[displayKey]?.label || status;
        const className = `status-badge ${slugifyStatus(displayKey)}`;
        return `<span class="${className}"><span class="dot"></span>${escapeHtml(label)}</span>`;
    }

    function slugifyStatus(key) {
        return String(key).replace(/\s+/g, '-').toLowerCase();
    }

    function formatOwnership(value) {
        if (!value) return '—';
        return value === 'company' ? 'ของบริษัท' : value === 'rented' ? 'เช่า' : escapeHtml(value);
    }

    function formatDateTime(value) {
        if (!value) return '—';
        const date = new Date(String(value).replace(' ', 'T'));
        if (Number.isNaN(date.getTime())) {
            return escapeHtml(String(value));
        }
        return date.toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
    }

    function escapeHtml(text) {
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function updatePagination() {
        if (prevPageBtn) prevPageBtn.disabled = !hasPrev;
        if (nextPageBtn) nextPageBtn.disabled = !hasNext;
        if (pageIndicator) pageIndicator.textContent = `หน้า ${currentPage}`;
    }

    function updateSortIndicators() {
        tableHeaders.forEach((th) => {
            const key = th.dataset.sortKey;
            const isActive = key === sortKey;
            const ariaState = isActive ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none';
            th.setAttribute('aria-sort', ariaState);
            const indicator = th.querySelector('.sort-indicator');
            if (indicator) {
                let symbol = '↕';
                if (ariaState === 'ascending') symbol = '▲';
                if (ariaState === 'descending') symbol = '▼';
                indicator.textContent = symbol;
            }
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', () => {
            if (searchDebounce) clearTimeout(searchDebounce);
            searchDebounce = setTimeout(() => {
                currentPage = 1;
                fetchItemUnits();
            }, 250);
        });
    }

    if (statusFilter) {
        statusFilter.addEventListener('change', () => {
            currentPage = 1;
            updateActiveSummary();
            fetchItemUnits();
        });
    }

    if (ownershipFilter) {
        ownershipFilter.addEventListener('change', () => {
            currentPage = 1;
            fetchItemUnits();
        });
    }

    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            if (statusFilter) statusFilter.value = 'all';
            if (ownershipFilter) ownershipFilter.value = 'all';
            updateActiveSummary();
            currentPage = 1;
            fetchItemUnits();
        });
    }

    if (summaryWrap) {
        summaryWrap.addEventListener('click', (event) => {
            const card = event.target.closest('.summary-card');
            if (!card) return;
            const status = card.dataset.status;
            if (!status) return;
            if (statusFilter) statusFilter.value = status;
            currentPage = 1;
            updateActiveSummary();
            fetchItemUnits();
        });
    }

    if (newUnitBtn) {
        newUnitBtn.addEventListener('click', () => {
            const target = newUnitBtn.dataset.target || './item_unit_manage.html?mode=create';
            window.location.href = target;
        });
    }

    if (prevPageBtn) {
        prevPageBtn.addEventListener('click', () => {
            if (!hasPrev) return;
            currentPage = Math.max(1, currentPage - 1);
            fetchItemUnits();
        });
    }

    if (nextPageBtn) {
        nextPageBtn.addEventListener('click', () => {
            if (!hasNext) return;
            currentPage += 1;
            fetchItemUnits();
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
            fetchItemUnits();
        });
    });

    if (tableBody) {
        tableBody.addEventListener('click', (event) => {
            const btn = event.target.closest('button[data-action="open"]');
            if (!btn) return;
            const id = btn.dataset.id;
            if (!id) return;
            const params = new URLSearchParams({ item_unit_id: id });
            window.location.href = `./item_unit_manage.html?${params.toString()}`;
        });
    }

    window.addEventListener('pageshow', (event) => {
        const needsRefresh = sessionStorage.getItem('item-units:refresh') === '1';
        const shouldReload = (event.persisted || needsRefresh) && modelRoot;
        if (shouldReload) {
            if (needsRefresh) {
                sessionStorage.removeItem('item-units:refresh');
            }
            fetchItemUnits();
        } else if (needsRefresh) {
            sessionStorage.removeItem('item-units:refresh');
        }
    });

    const boot = ({ root }) => {
        modelRoot = `${root}/Model`;
        updateThaiDate();
        setInterval(updateThaiDate, 1000);
        renderSummary();
        updateSortIndicators();
        fetchItemUnits();
    };

    if (typeof window.onAppReady === 'function') {
        window.onAppReady(boot);
    }
})();