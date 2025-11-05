// Drawer toggle and scrim
const drawer = document.getElementById('drawer');
const scrim = document.getElementById('scrim');
const btn = document.getElementById('btnMenu');

function openDrawer() {
    drawer.classList.add('open');
    scrim.hidden = false;
}

function closeDrawer() {
    drawer.classList.remove('open');
    scrim.hidden = true;
}

btn.addEventListener('click', () => {
    const open = drawer.classList.contains('open');
    open ? closeDrawer() : openDrawer();
});
scrim.addEventListener('click', closeDrawer);

window.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeDrawer();
});

// Populate profile pill
(async () => {
    try {
        const r = await fetch('../Model/session_user.php', { credentials: 'same-origin' });
        if (!r.ok) throw 0;
        const u = await r.json();
        document.getElementById('fullName').textContent = u.full_name || 'ผู้ใช้งาน';
        const av = document.getElementById('avatar');
        if (u.avatar) av.src = u.avatar; else av.removeAttribute('src');
    } catch {
        location.href = '../View/login.html?error=unauth';
    }
})();

// Date header
function updateThaiDate() {
    const now = new Date();
    const days = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'];
    const months = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
        'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
    const day = days[now.getDay()];
    const date = now.getDate();
    const month = months[now.getMonth()];
    const year = now.getFullYear() + 543;
    const time = now.toLocaleTimeString('th-TH', { hour12: false });
    const text = `วัน${day}ที่ ${date} ${month} ${year} เวลา ${time}`;
    const el = document.getElementById('pageDate');
    if (el) el.textContent = text;
}
updateThaiDate();
setInterval(updateThaiDate, 1000);

const statusOrder = ['all', 'draft', 'planning', 'waiting', 'processing', 'billing', 'completed', 'cancelled'];

const statusMeta = {
    all: { label: 'ทั้งหมด', icon: 'stack' },
    draft: { label: 'ร่าง', icon: 'draft' },
    planning: { label: 'วางแผน', icon: 'calendar' },
    waiting: { label: 'รอดำเนินการ', icon: 'clock' },
    processing: { label: 'กำลังดำเนินการ', icon: 'progress' },
    billing: { label: 'เรียกเก็บเงิน', icon: 'wallet' },
    completed: { label: 'เสร็จสิ้น', icon: 'check' },
    cancelled: { label: 'ยกเลิก', icon: 'x' }
};

const searchInput = document.getElementById('searchInput');
const statusFilter = document.getElementById('statusFilter');
const tableBody = document.getElementById('eventTableBody');
const emptyState = document.getElementById('emptyState');
const summaryWrap = document.getElementById('summaryCards');
const prevPageBtn = document.getElementById('prevPage');
const nextPageBtn = document.getElementById('nextPage');
const pageIndicator = document.getElementById('pageIndicator');
const tableHeaders = document.querySelectorAll('.event-table thead th[data-sort-key]');
const sortButtons = document.querySelectorAll('.event-table thead .sort-button');

let events = [];
let summaryCounts = normalizeCounts();
let currentPage = 1;
let hasNextPage = false;
let hasPrevPage = false;
let searchDebounceHandle = null;
let lastRequestToken = 0;
const defaultSort = Object.freeze({ key: 'event_id', direction: 'desc' });
let sortKey = defaultSort.key;
let sortDirection = defaultSort.direction;

function normalizeCounts(source = {}) {
    const normalized = { all: 0 };
    let computedTotal = 0;
    for (const key of statusOrder) {
        if (key === 'all') continue;
        const value = Number(source[key]);
        const total = Number.isFinite(value) ? value : 0;
        normalized[key] = total;
        computedTotal += total;
    }
    const overall = Number(source.all);
    normalized.all = Number.isFinite(overall) ? overall : computedTotal;
    return normalized;
}

function renderSummary() {
    summaryWrap.innerHTML = '';

    for (const key of statusOrder) {
        const meta = statusMeta[key];
        if (!meta) continue;
        const card = document.createElement('button');
        card.type = 'button';
        card.className = `summary-card ${key}`;
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
    const current = statusFilter.value || 'all';
    summaryWrap.querySelectorAll('.summary-card').forEach(card => {
        card.classList.toggle('active', card.dataset.status === current);
    });
}

function setStatusFilter(value) {
    if (!statusMeta[value]) {
        value = 'all';
    }
    statusFilter.value = value;
    updateActiveSummary();
    currentPage = 1;
    fetchEvents();
}

function showLoadingRow() {
    tableBody.innerHTML = `
        <tr>
            <td colspan="7" class="loading">กำลังโหลด...</td>
        </tr>
    `;
    emptyState.classList.remove('show');
    emptyState.setAttribute('aria-hidden', 'true');
}

async function fetchEvents() {
    const token = ++lastRequestToken;
    showLoadingRow();

    const params = new URLSearchParams();
    params.set('page', currentPage);
    const status = statusFilter.value || 'all';
    params.set('status', status);
    const term = searchInput.value.trim();
    if (term) {
        params.set('search', term);
    }
    params.set('sort_key', sortKey);
    params.set('sort_direction', sortDirection);

    try {
        const response = await fetch(`../Model/events_list.php?${params.toString()}`, { credentials: 'same-origin' });
        if (!response.ok) throw new Error('network');
        const payload = await response.json();
        if (token !== lastRequestToken) {
            return;
        }
        events = Array.isArray(payload.data) ? payload.data : [];
        summaryCounts = normalizeCounts(payload.counts);
        hasNextPage = Boolean(payload.has_next);
        hasPrevPage = Boolean(payload.has_prev);
        renderSummary();
        renderTable(events);
        updatePagination();
        updateSortIndicators();
    } catch (err) {
        if (token !== lastRequestToken) {
            return;
        }
        events = [];
        summaryCounts = normalizeCounts();
        hasNextPage = false;
        hasPrevPage = currentPage > 1;
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="error">ไม่สามารถโหลดข้อมูลได้</td>
            </tr>
        `;
        emptyState.classList.remove('show');
        emptyState.setAttribute('aria-hidden', 'true');
        updateSortIndicators();
        updatePagination();
    }
}

function renderTable(list) {
    const rows = Array.isArray(list) ? list : [];
    tableBody.innerHTML = '';
    const hasRows = rows.length > 0;
    emptyState.classList.toggle('show', !hasRows);
    emptyState.setAttribute('aria-hidden', hasRows ? 'true' : 'false');
    if (!hasRows) {
        return;
    }

    for (const ev of rows) {
        const tr = document.createElement('tr');
        const statusKey = (ev.status || '').toLowerCase();
        const statusInfo = statusMeta[statusKey] ?? { label: 'ไม่ระบุ', icon: '' };
        tr.innerHTML = `
            <td data-label="รหัสอีเว้น">${escapeHtml(ev.event_id)}</td>
            <td data-label="ชื่องาน / สถานที่">
                <div class="cell-title">${escapeHtml(ev.event_name)}</div>
                <span class="cell-sub">${ev.location_name ? escapeHtml(ev.location_name) : 'ไม่ระบุสถานที่'}</span>
            </td>
            <td data-label="ลูกค้า">${ev.customer_name ? escapeHtml(ev.customer_name) : '—'}</td>
            <td data-label="ผู้รับผิดชอบ">${ev.staff_name ? escapeHtml(ev.staff_name) : '—'}</td>
            <td data-label="วันและเวลาเริ่ม">${formatDateTime(ev.start_date)}</td>
            <td data-label="สถานะ">
                <span class="status-badge ${statusKey}">${statusInfo.label}</span>
            </td>
            <td class="col-actions">
                <button class="action-btn" data-action="open" data-id="${escapeHtml(ev.event_id ?? '')}"><span class="i list"></span>รายละเอียด</button>
            </td>
        `;
        tableBody.append(tr);
    }
}

function escapeHtml(value) {
    const s = value == null ? '' : String(value);
    return s.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

function formatDateTime(value) {
    if (!value) {
        return '—';
    }
    const normalized = String(value).replace(' ', 'T');
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) {
        return '—';
    }
    return date.toLocaleString('th-TH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
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
        fetchEvents();
    }, 300);
}

function resetSort() {
    sortKey = defaultSort.key;
    sortDirection = defaultSort.direction;
}

function updateSortIndicators() {
    tableHeaders.forEach(th => {
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

searchInput.addEventListener('input', handleSearchInput);
statusFilter.addEventListener('change', () => {
    setStatusFilter(statusFilter.value);
});

summaryWrap.addEventListener('click', event => {
    const card = event.target.closest('.summary-card');
    if (!card) return;
    setStatusFilter(card.dataset.status);
});

document.getElementById('btnClearFilters').addEventListener('click', () => {
    if (searchDebounceHandle) {
        clearTimeout(searchDebounceHandle);
        searchDebounceHandle = null;
    }
    searchInput.value = '';
    resetSort();
    updateSortIndicators();
    currentPage = 1;
    setStatusFilter('all');
});

document.getElementById('btnExport').addEventListener('click', () => {
    alert('ฟังก์ชันส่งออกจะพร้อมใช้งานเร็ว ๆ นี้');
});

document.getElementById('btnNewEvent').addEventListener('click', () => {
    alert('ฟอร์มสร้างอีเว้นกำลังพัฒนา');
});

if (prevPageBtn) {
    prevPageBtn.addEventListener('click', () => {
        if (!hasPrevPage) return;
        currentPage = Math.max(1, currentPage - 1);
        fetchEvents();
    });
}

if (nextPageBtn) {
    nextPageBtn.addEventListener('click', () => {
        if (!hasNextPage) return;
        currentPage += 1;
        fetchEvents();
    });
}

sortButtons.forEach(button => {
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
        fetchEvents();
    });
});

renderSummary();
updateSortIndicators();
fetchEvents();