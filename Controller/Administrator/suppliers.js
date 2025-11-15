(function () {
    const statusOrder = ['all', 'active', 'inactive'];
    const statusMeta = {
        all: { label: 'ทั้งหมด', icon: 'stack' },
        active: { label: 'เปิดใช้งาน', icon: 'check' },
        inactive: { label: 'ปิดใช้งาน', icon: 'x' },
    };

    const searchInput = document.getElementById('searchInput');
    const statusFilter = document.getElementById('statusFilter');
    const tableBody = document.getElementById('supplierTableBody');
    const emptyState = document.getElementById('emptyState');
    const summaryWrap = document.getElementById('summaryCards');
    const prevPageBtn = document.getElementById('prevPage');
    const nextPageBtn = document.getElementById('nextPage');
    const pageIndicator = document.getElementById('pageIndicator');
    const tableHeaders = document.querySelectorAll('.event-table thead th[data-sort-key]');
    const sortButtons = document.querySelectorAll('.event-table thead .sort-button');
    const clearBtn = document.getElementById('btnClearFilters');
    const exportBtn = document.getElementById('btnExport');
    const newSupplierBtn = document.getElementById('btnNewSupplier');

    let suppliers = [];
    let summaryCounts = normalizeCounts();
    let currentPage = 1;
    let hasNextPage = false;
    let hasPrevPage = false;
    let searchDebounceHandle = null;
    let lastRequestToken = 0;
    const defaultSort = Object.freeze({ key: 'supplier_id', direction: 'desc' });
    let sortKey = defaultSort.key;
    let sortDirection = defaultSort.direction;
    let modelRoot = '';

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
        const normalized = { all: 0, active: 0, inactive: 0 };
        let total = 0;
        for (const key of ['active', 'inactive']) {
            const value = Number(source[key]);
            const count = Number.isFinite(value) ? value : 0;
            normalized[key] = count;
            total += count;
        }
        const overall = Number(source.all);
        normalized.all = Number.isFinite(overall) ? overall : total;
        return normalized;
    }

    function renderSummary() {
        if (!summaryWrap) {
            return;
        }
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
        <strong>${summaryCounts[key] ?? 0}</strong>
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

    function setStatusFilter(value) {
        if (!statusMeta[value]) {
            value = 'all';
        }
        if (statusFilter) {
            statusFilter.value = value;
        }
        updateActiveSummary();
        currentPage = 1;
        fetchSuppliers();
    }

    function showLoadingRow() {
        if (!tableBody) return;
        tableBody.innerHTML = `
      <tr>
        <td colspan="7" class="loading">กำลังโหลด...</td>
      </tr>
    `;
        if (emptyState) {
            emptyState.classList.remove('show');
            emptyState.setAttribute('aria-hidden', 'true');
        }
    }

    async function fetchSuppliers() {
        if (!modelRoot || !tableBody) {
            return;
        }

        const token = ++lastRequestToken;
        showLoadingRow();

        const params = new URLSearchParams();
        params.set('page', currentPage);
        const status = statusFilter?.value || 'all';
        params.set('status', status);
        const term = searchInput?.value.trim();
        if (term) {
            params.set('search', term);
        }
        params.set('sort_key', sortKey);
        params.set('sort_direction', sortDirection);

        try {
            const response = await fetch(`${modelRoot}/suppliers_list.php?${params.toString()}`, {
                credentials: 'same-origin',
            });
            if (!response.ok) throw new Error('network');
            const payload = await response.json();
            if (token !== lastRequestToken) {
                return;
            }
            suppliers = Array.isArray(payload.data) ? payload.data : [];
            summaryCounts = normalizeCounts(payload.counts);
            hasNextPage = Boolean(payload.has_next);
            hasPrevPage = Boolean(payload.has_prev);
            renderSummary();
            renderTable(suppliers);
            updatePagination();
            updateSortIndicators();
        } catch (err) {
            if (token !== lastRequestToken) {
                return;
            }
            suppliers = [];
            summaryCounts = normalizeCounts();
            hasNextPage = false;
            hasPrevPage = currentPage > 1;
            if (tableBody) {
                tableBody.innerHTML = `
        <tr>
          <td colspan="7" class="error">ไม่สามารถโหลดข้อมูลได้</td>
        </tr>
      `;
            }
            if (emptyState) {
                emptyState.classList.remove('show');
                emptyState.setAttribute('aria-hidden', 'true');
            }
            updateSortIndicators();
            updatePagination();
        }
    }

    function renderTable(list) {
        if (!tableBody) return;
        const rows = Array.isArray(list) ? list : [];
        tableBody.innerHTML = '';
        const hasRows = rows.length > 0;
        if (emptyState) {
            emptyState.classList.toggle('show', !hasRows);
            emptyState.setAttribute('aria-hidden', hasRows ? 'true' : 'false');
        }
        if (!hasRows) {
            return;
        }

        for (const supplier of rows) {
            const tr = document.createElement('tr');
            const statusKey = (supplier.status || '').toLowerCase();
            const statusInfo = statusMeta[statusKey] ?? { label: 'ไม่ระบุ', icon: '' };
            const baseSupplierId = formatId(supplier.supplier_id);
            const refSupplierId = supplier.ref_supplier_id ? escapeHtml(supplier.ref_supplier_id) : null;
            const idCellTitle = refSupplierId || baseSupplierId;
            const idCellSub = refSupplierId ? `<span class="cell-sub">${baseSupplierId}</span>` : '';
            const orgSub = supplier.org_name ? `<span class="cell-sub">${escapeHtml(supplier.org_name)}</span>` : '';
            const contactPerson = supplier.contact_person ? escapeHtml(supplier.contact_person) : '—';
            const contactDetail = formatContactMeta(supplier.email, supplier.phone);
            const locationDisplay = supplier.location_name ? escapeHtml(supplier.location_name) : 'ไม่ระบุสถานที่';
            tr.innerHTML = `
        <td data-label="รหัสซัพพลายเออร์">
          <div class="cell-title">${idCellTitle}</div>
          ${idCellSub}
        </td>
        <td data-label="ชื่อ / องค์กร">
          <div class="cell-title">${escapeHtml(supplier.supplier_name)}</div>
          ${orgSub}
        </td>
        <td data-label="ผู้ติดต่อ">${contactPerson}</td>
        <td data-label="ช่องทางการติดต่อ">${contactDetail}</td>
        <td data-label="สถานที่">${locationDisplay}</td>
        <td data-label="สถานะ">
          <span class="status-badge ${statusKey}"><span class="dot"></span>${statusInfo.label}</span>
        </td>
        <td class="col-actions">
          <button class="action-btn" data-action="open" data-id="${escapeHtml(supplier.supplier_id ?? '')}"><span class="i list"></span>รายละเอียด</button>
        </td>
      `;
            tableBody.append(tr);
        }
    }

    function escapeHtml(value) {
        const s = value == null ? '' : String(value);
        return s.replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
    }

    function formatId(value) {
        if (value === null || value === undefined) {
            return '—';
        }
        const text = String(value);
        return text === '' ? '—' : escapeHtml(text);
    }

    function formatContactMeta(email, phone) {
        const emailText = email ? escapeHtml(email) : '';
        const phoneText = phone ? escapeHtml(phone) : '';
        if (emailText && phoneText) {
            return `<div class="cell-title">${emailText}</div><span class="cell-sub">${phoneText}</span>`;
        }
        if (emailText) {
            return emailText;
        }
        if (phoneText) {
            return phoneText;
        }
        return '—';
    }

    function updatePagination() {
        if (pageIndicator) {
            pageIndicator.textContent = `หน้า ${currentPage}`;
        }
        if (prevPageBtn) {
            prevPageBtn.disabled = !hasPrevPage;
        }
        if (nextPageBtn) {
            nextPageBtn.disabled = !hasNextPage;
        }
    }

    function handleSearchInput() {
        if (searchDebounceHandle) {
            clearTimeout(searchDebounceHandle);
        }
        searchDebounceHandle = setTimeout(() => {
            currentPage = 1;
            fetchSuppliers();
        }, 300);
    }

    function resetSort() {
        sortKey = defaultSort.key;
        sortDirection = defaultSort.direction;
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

    if (searchInput) {
        searchInput.addEventListener('input', handleSearchInput);
    }

    if (statusFilter) {
        statusFilter.addEventListener('change', () => {
            setStatusFilter(statusFilter.value);
        });
    }

    if (summaryWrap) {
        summaryWrap.addEventListener('click', (event) => {
            const card = event.target.closest('.summary-card');
            if (!card) return;
            setStatusFilter(card.dataset.status);
        });
    }

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (searchDebounceHandle) {
                clearTimeout(searchDebounceHandle);
                searchDebounceHandle = null;
            }
            if (searchInput) {
                searchInput.value = '';
            }
            resetSort();
            updateSortIndicators();
            currentPage = 1;
            setStatusFilter('all');
        });
    }

    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            alert('ฟังก์ชันส่งออกจะพร้อมใช้งานเร็ว ๆ นี้');
        });
    }

    if (newSupplierBtn) {
        newSupplierBtn.addEventListener('click', () => {
            const target = newSupplierBtn.dataset.target || './supplier_detail.html?mode=create';
            window.location.href = target;
        });
    }

    if (prevPageBtn) {
        prevPageBtn.addEventListener('click', () => {
            if (!hasPrevPage) return;
            currentPage = Math.max(1, currentPage - 1);
            fetchSuppliers();
        });
    }

    if (nextPageBtn) {
        nextPageBtn.addEventListener('click', () => {
            if (!hasNextPage) return;
            currentPage += 1;
            fetchSuppliers();
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
            fetchSuppliers();
        });
    });

    if (tableBody) {
        tableBody.addEventListener('click', (event) => {
            const actionBtn = event.target.closest('button[data-action="open"]');
            if (!actionBtn) {
                return;
            }
            const supplierId = actionBtn.dataset.id;
            if (!supplierId) {
                return;
            }
            const params = new URLSearchParams({ supplier_id: supplierId });
            window.location.href = `./supplier_detail.html?${params.toString()}`;
        });
    }

    const boot = ({ root }) => {
        modelRoot = `${root}/Model`;
        updateThaiDate();
        setInterval(updateThaiDate, 1000);
        renderSummary();
        updateSortIndicators();
        fetchSuppliers();
    };

    window.addEventListener('pageshow', (event) => {
        const needsRefresh = sessionStorage.getItem('suppliers:refresh') === '1';
        const shouldReload = (event.persisted || needsRefresh) && modelRoot;
        if (shouldReload) {
            if (needsRefresh) {
                sessionStorage.removeItem('suppliers:refresh');
            }
            fetchSuppliers();
        } else if (needsRefresh) {
            sessionStorage.removeItem('suppliers:refresh');
        }
    });

    if (typeof window.onAppReady === 'function') {
        window.onAppReady(boot);
    }
})();