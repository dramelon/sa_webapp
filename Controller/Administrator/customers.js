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
    const newCustomerBtn = document.getElementById('btnNewCustomer');
    const tableBody = document.getElementById('customerTableBody');
    const emptyState = document.getElementById('emptyState');
    const summaryWrap = document.getElementById('summaryCards');
    const prevPageBtn = document.getElementById('prevPage');
    const nextPageBtn = document.getElementById('nextPage');
    const pageIndicator = document.getElementById('pageIndicator');
    const tableHeaders = document.querySelectorAll('.customer-table thead th[data-sort-key]');
    const sortButtons = document.querySelectorAll('.customer-table thead .sort-button');

    let customers = [];
    let counts = { all: 0, active: 0, inactive: 0 };
    let currentPage = 1;
    let hasNext = false;
    let hasPrev = false;
    const defaultSort = Object.freeze({ key: 'customer_id', direction: 'desc' });
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
        const next = { all: 0, active: 0, inactive: 0 };
        for (const key of Object.keys(next)) {
            if (key === 'all') {
                continue;
            }
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
        if (!summaryWrap) {
            return;
        }
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

    function buildContact(row) {
        const email = (row.email || '').trim();
        const phone = (row.phone || '').trim();
        if (email && phone) {
            return `${phone} / ${email}`;
        }
        if (phone) {
            return phone;
        }
        if (email) {
            return email;
        }
        return '—';
    }

    function formatStatus(status) {
        const normalized = typeof status === 'string' ? status.toLowerCase() : 'active';
        if (normalized === 'inactive') {
            return '<span class="status-badge cancelled"><span class="dot"></span>ปิดใช้งาน</span>';
        }
        return '<span class="status-badge completed"><span class="dot"></span>ใช้งาน</span>';
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
            const locationName = (row.location_name || '').trim();
            tr.innerHTML = `
                <td>${row.customer_id ?? '—'}</td>
                <td>${row.customer_name ? escapeHtml(row.customer_name) : '—'}</td>
                <td>${row.organization ? escapeHtml(row.organization) : '—'}</td>
                <td>${escapeHtml(buildContact(row))}</td>
                <td>${formatStatus(row.status)}</td>
                <td>${locationName ? escapeHtml(locationName) : '—'}</td>
                <td class="col-actions">
                    <button class="action-btn" type="button" data-action="open" data-id="${escapeHtml(String(row.customer_id ?? ''))}">
                        <span class="i list"></span>รายละเอียด
                    </button>
                </td>
            `;
            tableBody.append(tr);
        }
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
                let symbol = '↕';
                if (ariaState === 'ascending') symbol = '▲';
                if (ariaState === 'descending') symbol = '▼';
                indicator.textContent = symbol;
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

    async function fetchCustomers() {
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
            const response = await fetch(`${modelRoot}/customers_list.php?${params.toString()}`, {
                credentials: 'same-origin',
            });
            if (!response.ok) throw new Error('network');
            const payload = await response.json();
            if (token !== lastRequestToken) {
                return;
            }
            customers = Array.isArray(payload.data) ? payload.data : [];
            counts = normalizeCounts(payload.counts);
            hasNext = Boolean(payload.has_next);
            hasPrev = Boolean(payload.has_prev);
            renderSummary();
            renderTable(customers);
            updatePagination();
            updateSortIndicators();
        } catch (error) {
            if (token !== lastRequestToken) {
                return;
            }
            customers = [];
            counts = normalizeCounts();
            hasNext = false;
            hasPrev = currentPage > 1;
            renderSummary();
            renderTable(customers);
            updatePagination();
            updateSortIndicators();
            if (tableBody) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="7" class="loading">ไม่สามารถโหลดข้อมูลลูกค้าได้</td>
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
        fetchCustomers();
    }

    function handleSearchChange() {
        if (searchDebounce) {
            clearTimeout(searchDebounce);
        }
        searchDebounce = setTimeout(() => {
            currentPage = 1;
            fetchCustomers();
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
            fetchCustomers();
        });
    }

    if (nextPageBtn) {
        nextPageBtn.addEventListener('click', () => {
            if (!hasNext) return;
            currentPage += 1;
            fetchCustomers();
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
            fetchCustomers();
        });
    });

    if (newCustomerBtn) {
        newCustomerBtn.addEventListener('click', () => {
            const target = newCustomerBtn.dataset.target;
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
            const customerId = actionBtn.dataset.id;
            if (!customerId) {
                return;
            }
            const params = new URLSearchParams({ customer_id: customerId });
            window.location.href = `./customer_detail.html?${params.toString()}`;
        });
    }
    
    const boot = ({ root }) => {
        modelRoot = `${root}/Model`;
        updateThaiDate();
        setInterval(updateThaiDate, 1000);
        fetchCustomers();
    };

    if (typeof window.onAppReady === 'function') {
        window.onAppReady(boot);
    }
})();