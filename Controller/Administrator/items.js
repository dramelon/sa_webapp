(function () {
    const summaryOrder = ['all', 'อุปกร', 'วัสดุ', 'บริการ'];
    const summaryMeta = {
        all: { label: 'ทั้งหมด', icon: 'stack', slug: 'all' },
        อุปกร: { label: 'อุปกรณ์', icon: 'box', slug: 'equipment' },
        วัสดุ: { label: 'วัสดุ', icon: 'stack', slug: 'material' },
        บริการ: { label: 'บริการ', icon: 'check', slug: 'service' },
    };

    const searchInput = document.getElementById('searchInput');
    const typeFilter = document.getElementById('typeFilter');
    const categoryFilter = document.getElementById('categoryFilter');
    const clearFiltersBtn = document.getElementById('btnClearFilters');
    const newItemBtn = document.getElementById('btnNewItem');
    const tableBody = document.getElementById('itemTableBody');
    const emptyState = document.getElementById('emptyState');
    const summaryWrap = document.getElementById('summaryCards');
    const prevPageBtn = document.getElementById('prevPage');
    const nextPageBtn = document.getElementById('nextPage');
    const pageIndicator = document.getElementById('pageIndicator');
    const tableHeaders = document.querySelectorAll('.item-table thead th[data-sort-key]');
    const sortButtons = document.querySelectorAll('.item-table thead .sort-button');

    const defaultSort = Object.freeze({ key: 'item_id', direction: 'desc' });

    let items = [];
    let counts = normalizeCounts();
    let baselineCounts = null;
    let currentPage = 1;
    let hasNext = false;
    let hasPrev = false;
    let sortKey = defaultSort.key;
    let sortDirection = defaultSort.direction;
    let modelRoot = '';
    let lastRequestToken = 0;
    let searchDebounce = null;
    let categoriesLoaded = false;

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
        const next = { all: 0, อุปกร: 0, วัสดุ: 0, บริการ: 0 };
        const providedAll = Number(source.all);
        if (Number.isFinite(providedAll)) {
            next.all = providedAll;
        }
        for (const key of ['อุปกร', 'วัสดุ', 'บริการ']) {
            const value = Number(source[key]);
            next[key] = Number.isFinite(value) ? value : 0;
            if (!Number.isFinite(providedAll)) {
                next.all += next[key];
            }
        }
        return next;
    }

    function hasActiveFilters() {
        const term = searchInput?.value.trim();
        const typeValue = typeFilter?.value || 'all';
        const categoryValue = categoryFilter?.value || 'all';
        return Boolean(term) || typeValue !== 'all' || categoryValue !== 'all';
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
            card.dataset.type = key;
            if (meta.slug) {
                card.dataset.summary = meta.slug;
            }
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
        const current = typeFilter?.value || 'all';
        summaryWrap.querySelectorAll('.summary-card').forEach((card) => {
            const { type } = card.dataset;
            const isActive = type === current;
            card.classList.toggle('active', isActive);
        });
    }

    function renderCategoriesOptions(options) {
        if (!categoryFilter || !Array.isArray(options)) {
            return;
        }
        const currentValue = categoryFilter.value;
        categoryFilter.innerHTML = '<option value="all">หมวดหมู่ทั้งหมด</option>';
        for (const row of options) {
            const option = document.createElement('option');
            option.value = String(row.id);
            const name = (row.name || '').trim();
            option.textContent = name !== '' ? name : `หมวดหมู่ #${row.id}`;
            categoryFilter.append(option);
        }
        if (currentValue && Array.from(categoryFilter.options).some((opt) => opt.value === currentValue)) {
            categoryFilter.value = currentValue;
        }
    }

    async function fetchCategories() {
        if (!modelRoot || categoriesLoaded) {
            return;
        }
        try {
            const response = await fetch(`${modelRoot}/item_categories_option.php`, { credentials: 'same-origin' });
            if (!response.ok) return;
            const payload = await response.json();
            if (payload && Array.isArray(payload.data)) {
                renderCategoriesOptions(payload.data);
                categoriesLoaded = true;
            }
        } catch (err) {
            // ignore silently
        }
    }

    function showLoadingRow() {
        if (!tableBody) return;
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="loading">กำลังโหลด...</td>
            </tr>
        `;
        emptyState?.classList.remove('show');
        emptyState?.setAttribute('aria-hidden', 'true');
    }

    async function fetchItems() {
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
        const typeValue = typeFilter?.value || 'all';
        params.set('type', typeValue);
        const categoryValue = categoryFilter?.value || 'all';
        if (categoryValue !== 'all') {
            params.set('category_id', categoryValue);
        }

        try {
            const response = await fetch(`${modelRoot}/items_list.php?${params.toString()}`, {
                credentials: 'same-origin',
            });
            if (!response.ok) throw new Error('network');
            const payload = await response.json();
            if (token !== lastRequestToken) {
                return;
            }
            items = Array.isArray(payload.data) ? payload.data : [];
            const normalizedCounts = normalizeCounts(payload.counts);
            if (!baselineCounts || !hasActiveFilters()) {
                baselineCounts = normalizedCounts;
            }
            counts = baselineCounts || normalizedCounts;
            hasNext = Boolean(payload.has_next);
            hasPrev = Boolean(payload.has_prev);
            renderSummary();
            renderTable(items);
            updatePagination();
            updateSortIndicators();
        } catch (err) {
            if (token !== lastRequestToken) {
                return;
            }
            items = [];
            const fallbackCounts = baselineCounts || normalizeCounts();
            counts = fallbackCounts;
            hasNext = false;
            hasPrev = false;
            renderSummary();
            renderTable(items);
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
                <td>${formatItemIdentifier(row.ref_item_id, row.item_id)}</td>
                <td>${formatItemName(row.item_name, row.brand, row.model)}</td>
                <td>${formatTypeBadge(row.item_type)}</td>
                <td>${row.category_name ? escapeHtml(row.category_name) : '—'}</td>
                <td>${formatUnit(row.uom)}</td>
                <td class="col-actions">
                    <button class="action-btn" type="button" data-action="open" data-id="${escapeHtml(String(row.item_id ?? ''))}">
                        <span class="i pencil"></span>จัดการ
                    </button>
                </td>
            `;
            tableBody.append(tr);
        }
    }

    function normalizeText(value) {
        if (value === null || value === undefined) {
            return '';
        }
        const text = typeof value === 'string' ? value : String(value);
        return text.trim();
    }

    function formatItemIdentifier(refId, itemId) {
        const reference = normalizeText(refId);
        const current = normalizeText(itemId);
        if (!reference && !current) {
            return '—';
        }
        const pieces = [];
        if (reference) {
            pieces.push(`<span class="cell-primary">${escapeHtml(reference)}</span>`);
        }
        if (current) {
            const className = reference ? 'cell-secondary' : 'cell-primary';
            pieces.push(`<span class="${className}">${escapeHtml(current)}</span>`);
        }
        return `<div class="cell-stack">${pieces.join('')}</div>`;
    }

    function formatItemName(name, brand, model) {
        const main = normalizeText(name);
        const brandLine = formatBrandLine(brand, model);
        if (!main && !brandLine) {
            return '—';
        }
        const parts = [];
        if (main) {
            parts.push(`<span class="cell-primary">${escapeHtml(main)}</span>`);
        }
        if (brandLine) {
            parts.push(`<span class="cell-secondary">${brandLine}</span>`);
        }
        return `<div class="cell-stack">${parts.join('')}</div>`;
    }

    function formatBrandLine(brand, model) {
        const b = normalizeText(brand);
        const m = normalizeText(model);
        if (b && m) return `${escapeHtml(b)} / ${escapeHtml(m)}`;
        if (b) return escapeHtml(b);
        if (m) return escapeHtml(m);
        return '';
    }

    function formatTypeBadge(type) {
        const normalized = typeof type === 'string' ? type.trim() : '';
        if (!normalized) {
            return '—';
        }
        const meta = getTypeMeta(normalized);
        const label = escapeHtml(meta.label);
        const dataAttr = meta.slug ? ` data-summary="${meta.slug}"` : '';
        return `<span class="type-badge"${dataAttr}><span class="dot"></span>${label}</span>`;
    }

    function getTypeMeta(type) {
        switch (type) {
            case 'อุปกร':
            case 'อุปกรณ์':
                return { label: 'อุปกรณ์', slug: 'equipment' };
            case 'วัสดุ':
                return { label: 'วัสดุ', slug: 'material' };
            case 'บริการ':
                return { label: 'บริการ', slug: 'service' };
            default:
                return { label: type, slug: '' };
        }
    }

    function formatUnit(value) {
        const text = (value || '').trim();
        return text ? escapeHtml(text) : '—';
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
            if (searchDebounce) {
                clearTimeout(searchDebounce);
            }
            searchDebounce = setTimeout(() => {
                currentPage = 1;
                fetchItems();
            }, 250);
        });
    }

    if (typeFilter) {
        typeFilter.addEventListener('change', () => {
            currentPage = 1;
            updateActiveSummary();
            fetchItems();
        });
    }

    if (categoryFilter) {
        categoryFilter.addEventListener('change', () => {
            currentPage = 1;
            fetchItems();
        });
    }

    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            if (typeFilter) typeFilter.value = 'all';
            if (categoryFilter) categoryFilter.value = 'all';
            updateActiveSummary();
            currentPage = 1;
            fetchItems();
        });
    }

    if (newItemBtn) {
        newItemBtn.addEventListener('click', () => {
            const target = newItemBtn.dataset.target || './item_manage.html?mode=create';
            window.location.href = target;
        });
    }

    if (summaryWrap) {
        summaryWrap.addEventListener('click', (event) => {
            const card = event.target.closest('.summary-card');
            if (!card) return;
            const value = card.dataset.type;
            if (!value) return;
            if (typeFilter) {
                typeFilter.value = value;
            }
            currentPage = 1;
            updateActiveSummary();
            fetchItems();
        });
    }

    if (prevPageBtn) {
        prevPageBtn.addEventListener('click', () => {
            if (!hasPrev) return;
            currentPage = Math.max(1, currentPage - 1);
            fetchItems();
        });
    }

    if (nextPageBtn) {
        nextPageBtn.addEventListener('click', () => {
            if (!hasNext) return;
            currentPage += 1;
            fetchItems();
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
            fetchItems();
        });
    });

    if (tableBody) {
        tableBody.addEventListener('click', (event) => {
            const btn = event.target.closest('button[data-action="open"]');
            if (!btn) return;
            const id = btn.dataset.id;
            if (!id) return;
            const params = new URLSearchParams({ item_id: id });
            window.location.href = `./item_manage.html?${params.toString()}`;
        });
    }

    window.addEventListener('pageshow', (event) => {
        const needsRefresh = sessionStorage.getItem('items:refresh') === '1';
        const shouldReload = (event.persisted || needsRefresh) && modelRoot;
        if (shouldReload) {
            if (needsRefresh) {
                sessionStorage.removeItem('items:refresh');
            }
            fetchItems();
        } else if (needsRefresh) {
            sessionStorage.removeItem('items:refresh');
        }
    });

    const boot = ({ root }) => {
        modelRoot = `${root}/Model`;
        updateThaiDate();
        setInterval(updateThaiDate, 1000);
        renderSummary();
        updateSortIndicators();
        fetchCategories();
        fetchItems();
    };

    if (typeof window.onAppReady === 'function') {
        window.onAppReady(boot);
    }
})();