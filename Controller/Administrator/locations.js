(function () {
    const statusOrder = ['all', 'active', 'inactive'];
    const statusMeta = {
        all: { label: 'ทั้งหมด', icon: 'stack' },
        active: { label: 'เปิดใช้งาน', icon: 'check' },
        inactive: { label: 'ปิดใช้งาน', icon: 'x' },
    };

    const searchInput = document.getElementById('locationSearch');
    const statusFilter = document.getElementById('locationStatusFilter');
    const clearButton = document.getElementById('btnLocationClear');
    const tableBody = document.getElementById('locationTableBody');
    const emptyState = document.getElementById('locationEmpty');
    const summaryWrap = document.getElementById('locationSummary');
    const prevButton = document.getElementById('locationPrev');
    const nextButton = document.getElementById('locationNext');
    const pageIndicator = document.getElementById('locationPage');
    const tableHeaders = document.querySelectorAll('.location-table thead th[data-sort-key]');
    const sortButtons = document.querySelectorAll('.location-table thead .sort-button');
    const newLocationBtn = document.getElementById('btnNewLocation');

    let locations = [];
    let counts = { all: 0, active: 0, inactive: 0 };
    let currentPage = 1;
    let hasNext = false;
    let hasPrev = false;
    const defaultSort = Object.freeze({ key: 'location_id', direction: 'desc' });
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
        const result = { all: 0, active: 0, inactive: 0 };
        for (const key of Object.keys(result)) {
            if (key === 'all') {
                continue;
            }
            const value = Number(source[key]);
            result[key] = Number.isFinite(value) ? value : 0;
            result.all += result[key];
        }
        if (source.all != null && Number.isFinite(Number(source.all))) {
            result.all = Number(source.all);
        }
        return result;
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
            card.classList.toggle('active', card.dataset.status === current);
        });
    }

    function formatStatus(status) {
        const normalized = typeof status === 'string' ? status.toLowerCase() : 'active';
        if (normalized === 'inactive') {
            return '<span class="status-badge cancelled"><span class="dot"></span>ปิดใช้งาน</span>';
        }
        return '<span class="status-badge completed"><span class="dot"></span>เปิดใช้งาน</span>';
    }

    function escapeHtml(text) {
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
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
            const locationId = row.location_id ?? '';
            tr.innerHTML = `
                <td>${locationId || '—'}</td>
                <td>${row.location_name ? escapeHtml(row.location_name) : '—'}</td>
                <td>${row.district ? escapeHtml(row.district) : '—'}</td>
                <td>${row.province ? escapeHtml(row.province) : '—'}</td>
                <td>${row.country ? escapeHtml(row.country) : '—'}</td>
                <td>${formatStatus(row.status)}</td>
                <td class="col-actions">
                    <button class="action-btn" type="button" data-action="open" data-id="${escapeHtml(String(locationId))}">
                        <span class="i list"></span>รายละเอียด
                    </button>
                </td>
            `;
            tableBody.append(tr);
        }
    }

    function updatePagination() {
        if (prevButton) {
            prevButton.disabled = !hasPrev;
        }
        if (nextButton) {
            nextButton.disabled = !hasNext;
        }
        if (pageIndicator) {
            pageIndicator.textContent = `หน้า ${currentPage}`;
        }
    }

    if (tableBody) {
        tableBody.addEventListener('click', (event) => {
            const actionBtn = event.target.closest('button[data-action="open"]');
            if (!actionBtn || !tableBody.contains(actionBtn)) {
                return;
            }
            const locationId = actionBtn.dataset.id;
            if (!locationId) {
                return;
            }
            const params = new URLSearchParams({ location_id: locationId });
            window.location.href = `./location_detail.html?${params.toString()}`;
        });
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

    async function fetchLocations() {
        if (!modelRoot) return;
        const token = ++lastRequestToken;
        showLoadingRow();
        const params = new URLSearchParams();
        params.set('page', currentPage);
        params.set('sort_key', sortKey);
        params.set('sort_direction', sortDirection);
        const statusValue = statusFilter?.value || 'all';
        params.set('status', statusValue);
        const term = searchInput?.value.trim();
        if (term) {
            params.set('search', term);
        }
        try {
            const response = await fetch(`${modelRoot}/locations_list.php?${params.toString()}`, {
                credentials: 'same-origin',
            });
            if (!response.ok) throw new Error('network');
            const payload = await response.json();
            if (token !== lastRequestToken) {
                return;
            }
            locations = Array.isArray(payload.data) ? payload.data : [];
            counts = normalizeCounts(payload.counts);
            hasNext = Boolean(payload.has_next);
            hasPrev = Boolean(payload.has_prev);
            renderSummary();
            renderTable(locations);
            updatePagination();
            updateSortIndicators();
        } catch (error) {
            if (token !== lastRequestToken) {
                return;
            }
            locations = [];
            counts = normalizeCounts();
            hasNext = false;
            hasPrev = currentPage > 1;
            renderSummary();
            renderTable(locations);
            updatePagination();
            updateSortIndicators();
            if (tableBody) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="7" class="loading">ไม่สามารถโหลดข้อมูลสถานที่ได้</td>
                    </tr>
                `;
            }
        }
    }

    function handleSearchInput() {
        if (searchDebounce) {
            clearTimeout(searchDebounce);
        }
        searchDebounce = setTimeout(() => {
            currentPage = 1;
            fetchLocations();
        }, 250);
    }

    function setStatusFilter(value) {
        if (!statusMeta[value]) {
            value = 'all';
        }
        if (statusFilter) {
            statusFilter.value = value;
        }
        currentPage = 1;
        updateActiveSummary();
        fetchLocations();
    }

    if (searchInput) {
        searchInput.addEventListener('input', handleSearchInput);
    }

    if (clearButton) {
        clearButton.addEventListener('click', () => {
            if (searchInput) {
                searchInput.value = '';
            }
            if (searchDebounce) {
                clearTimeout(searchDebounce);
                searchDebounce = null;
            }
            setStatusFilter('all');
        });
    }

    if (statusFilter) {
        statusFilter.addEventListener('change', () => {
            setStatusFilter(statusFilter.value || 'all');
        });
    }

    if (summaryWrap) {
        summaryWrap.addEventListener('click', (event) => {
            const card = event.target.closest('.summary-card');
            if (!card) {
                return;
            }
            setStatusFilter(card.dataset.status || 'all');
        });
    }

    if (prevButton) {
        prevButton.addEventListener('click', () => {
            if (!hasPrev) return;
            currentPage = Math.max(1, currentPage - 1);
            fetchLocations();
        });
    }

    if (nextButton) {
        nextButton.addEventListener('click', () => {
            if (!hasNext) return;
            currentPage += 1;
            fetchLocations();
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
            fetchLocations();
        });
    });

    if (newLocationBtn) {
        newLocationBtn.addEventListener('click', () => {
            const target = newLocationBtn.dataset.target;
            if (target) {
                window.location.href = target;
            }
        });
    }

    const boot = ({ root }) => {
        modelRoot = `${root}/Model`;
        updateThaiDate();
        setInterval(updateThaiDate, 1000);
        fetchLocations();
    };

    window.addEventListener('pageshow', (event) => {
        const needsRefresh = sessionStorage.getItem('locations:refresh') === '1';
        const shouldReload = (event.persisted || needsRefresh) && modelRoot;
        if (shouldReload) {
            if (needsRefresh) {
                sessionStorage.removeItem('locations:refresh');
            }
            fetchLocations();
        } else if (needsRefresh) {
            sessionStorage.removeItem('locations:refresh');
        }
    });
    
    if (typeof window.onAppReady === 'function') {
        window.onAppReady(boot);
    }
})();