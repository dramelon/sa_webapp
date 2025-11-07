(function () {
    const searchInput = document.getElementById('locationSearch');
    const clearButton = document.getElementById('btnLocationClear');
    const tableBody = document.getElementById('locationTableBody');
    const emptyState = document.getElementById('locationEmpty');
    const summaryWrap = document.getElementById('locationSummary');
    const prevButton = document.getElementById('locationPrev');
    const nextButton = document.getElementById('locationNext');
    const pageIndicator = document.getElementById('locationPage');
    const sortButtons = document.querySelectorAll('.location-table thead .sort-button');
    const newLocationBtn = document.getElementById('btnNewLocation');

    let locations = [];
    let totalCount = 0;
    let currentPage = 1;
    let hasNext = false;
    let hasPrev = false;
    let sortKey = 'location_name';
    let sortDirection = 'asc';
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

    function renderSummary() {
        if (!summaryWrap) return;
        summaryWrap.innerHTML = '';
        const card = document.createElement('div');
        card.className = 'summary-card all active';
        card.innerHTML = `
            <header>
                <span class="i stack"></span>
                <p>สถานที่ทั้งหมด</p>
            </header>
            <strong>${totalCount}</strong>
        `;
        summaryWrap.append(card);
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
            tr.innerHTML = `
                <td>${row.location_id ?? '—'}</td>
                <td>${row.location_name ? escapeHtml(row.location_name) : '—'}</td>
                <td>${row.district ? escapeHtml(row.district) : '—'}</td>
                <td>${row.province ? escapeHtml(row.province) : '—'}</td>
                <td>${row.country ? escapeHtml(row.country) : '—'}</td>
                <td class="actions">
                    <a class="ghost" href="./location_detail.html?location_id=${row.location_id}">รายละเอียด</a>
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

    function updateSortIndicators() {
        sortButtons.forEach((button) => {
            const key = button.dataset.sortKey;
            const th = button.closest('th');
            if (!key || !th) return;
            if (key === sortKey) {
                th.setAttribute('aria-sort', sortDirection === 'asc' ? 'ascending' : 'descending');
            } else {
                th.setAttribute('aria-sort', 'none');
            }
        });
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

    async function fetchLocations() {
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
            totalCount = Number(payload?.counts?.all) || 0;
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
            totalCount = 0;
            hasNext = false;
            hasPrev = currentPage > 1;
            renderSummary();
            renderTable(locations);
            updatePagination();
            updateSortIndicators();
            if (tableBody) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="6" class="loading">ไม่สามารถโหลดข้อมูลสถานที่ได้</td>
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

    if (searchInput) {
        searchInput.addEventListener('input', handleSearchInput);
    }

    if (clearButton) {
        clearButton.addEventListener('click', () => {
            if (searchInput) {
                searchInput.value = '';
            }
            currentPage = 1;
            fetchLocations();
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
                sortDirection = key === 'location_id' ? 'asc' : 'asc';
            }
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

    if (typeof window.onAppReady === 'function') {
        window.onAppReady(boot);
    }
})();