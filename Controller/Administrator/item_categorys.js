(function () {
    const summaryOrder = ['all', 'with_items', 'empty'];
    const summaryMeta = {
        all: { label: 'หมวดหมู่ทั้งหมด', icon: 'stack' },
        with_items: { label: 'มีสินค้า', icon: 'check' },
        empty: { label: 'ยังไม่มีสินค้า', icon: 'inbox' },
    };

    const searchInput = document.getElementById('searchInput');
    const clearBtn = document.getElementById('btnClearFilters');
    const newCategoryBtn = document.getElementById('btnNewCategory');
    const tableBody = document.getElementById('categoryTableBody');
    const emptyState = document.getElementById('emptyState');
    const summaryWrap = document.getElementById('summaryCards');
    const prevPageBtn = document.getElementById('prevPage');
    const nextPageBtn = document.getElementById('nextPage');
    const pageIndicator = document.getElementById('pageIndicator');
    const tableHeaders = document.querySelectorAll('.item-category-table thead th[data-sort-key]');
    const sortButtons = document.querySelectorAll('.item-category-table thead .sort-button');

    const defaultSort = Object.freeze({ key: 'item_category_id', direction: 'desc' });

    let categories = [];
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
        const next = { all: 0, with_items: 0, empty: 0 };
        const allValue = Number(source.all);
        if (Number.isFinite(allValue)) next.all = allValue;
        const withItems = Number(source.with_items);
        if (Number.isFinite(withItems)) {
            next.with_items = withItems;
            if (!Number.isFinite(allValue)) next.all += withItems;
        }
        const emptyValue = Number(source.empty);
        if (Number.isFinite(emptyValue)) {
            next.empty = emptyValue;
            if (!Number.isFinite(allValue)) next.all += emptyValue;
        } else if (Number.isFinite(allValue)) {
            next.empty = Math.max(0, allValue - next.with_items);
        }
        return next;
    }

    function renderSummary() {
        if (!summaryWrap) return;
        summaryWrap.innerHTML = '';
        for (const key of summaryOrder) {
            const meta = summaryMeta[key];
            if (!meta) continue;
            const card = document.createElement('div');
            card.className = 'summary-card';
            card.innerHTML = `
                <header>
                    <span class="i ${meta.icon}"></span>
                    <p>${meta.label}</p>
                </header>
                <strong>${counts[key] ?? 0}</strong>
            `;
            summaryWrap.append(card);
        }
    }

    function showLoadingRow() {
        if (!tableBody) return;
        tableBody.innerHTML = `
            <tr>
                <td colspan="5" class="loading">กำลังโหลด...</td>
            </tr>
        `;
        emptyState?.classList.remove('show');
        emptyState?.setAttribute('aria-hidden', 'true');
    }

    async function fetchCategoriesList() {
        if (!modelRoot) return;
        const token = ++lastRequestToken;
        showLoadingRow();

        const params = new URLSearchParams();
        params.set('page', currentPage);
        params.set('sort_key', sortKey);
        params.set('sort_direction', sortDirection);
        const term = searchInput?.value.trim();
        if (term) params.set('search', term);

        try {
            const response = await fetch(`${modelRoot}/item_categories_list.php?${params.toString()}`, {
                credentials: 'same-origin',
            });
            if (!response.ok) throw new Error('network');
            const payload = await response.json();
            if (token !== lastRequestToken) return;
            categories = Array.isArray(payload.data) ? payload.data : [];
            counts = normalizeCounts(payload.counts);
            hasNext = Boolean(payload.has_next);
            hasPrev = Boolean(payload.has_prev);
            renderSummary();
            renderTable(categories);
            updatePagination();
            updateSortIndicators();
        } catch (err) {
            if (token !== lastRequestToken) return;
            categories = [];
            counts = normalizeCounts();
            hasNext = false;
            hasPrev = false;
            renderSummary();
            renderTable(categories);
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
                <td>${escapeHtml(row.item_category_id ?? '—')}</td>
                <td>${row.name ? escapeHtml(row.name) : '—'}</td>
                <td>${row.note ? escapeHtml(row.note) : '—'}</td>
                <td>${escapeHtml(row.item_count ?? 0)}</td>
                <td class="col-actions">
                    <button class="action-btn" type="button" data-action="open" data-id="${escapeHtml(String(row.item_category_id ?? ''))}">
                        <span class="i pencil"></span>จัดการ
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
                fetchCategoriesList();
            }, 250);
        });
    }

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            currentPage = 1;
            fetchCategoriesList();
        });
    }

    if (newCategoryBtn) {
        newCategoryBtn.addEventListener('click', () => {
            const target = newCategoryBtn.dataset.target || './item_category_manage.html?mode=create';
            window.location.href = target;
        });
    }

    if (prevPageBtn) {
        prevPageBtn.addEventListener('click', () => {
            if (!hasPrev) return;
            currentPage = Math.max(1, currentPage - 1);
            fetchCategoriesList();
        });
    }

    if (nextPageBtn) {
        nextPageBtn.addEventListener('click', () => {
            if (!hasNext) return;
            currentPage += 1;
            fetchCategoriesList();
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
            fetchCategoriesList();
        });
    });

    if (tableBody) {
        tableBody.addEventListener('click', (event) => {
            const btn = event.target.closest('button[data-action="open"]');
            if (!btn) return;
            const id = btn.dataset.id;
            if (!id) return;
            const params = new URLSearchParams({ item_category_id: id });
            window.location.href = `./item_category_manage.html?${params.toString()}`;
        });
    }

    window.addEventListener('pageshow', (event) => {
        const needsRefresh = sessionStorage.getItem('item-categories:refresh') === '1';
        const shouldReload = (event.persisted || needsRefresh) && modelRoot;
        if (shouldReload) {
            if (needsRefresh) sessionStorage.removeItem('item-categories:refresh');
            fetchCategoriesList();
        } else if (needsRefresh) {
            sessionStorage.removeItem('item-categories:refresh');
        }
    });

    const boot = ({ root }) => {
        modelRoot = `${root}/Model`;
        updateThaiDate();
        setInterval(updateThaiDate, 1000);
        renderSummary();
        updateSortIndicators();
        fetchCategoriesList();
    };

    if (typeof window.onAppReady === 'function') {
        window.onAppReady(boot);
    }
})();