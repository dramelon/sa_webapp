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

// Event dataset (mock)
const events = [
    {
        id: 'EV-2024-001',
        name: 'งานเปิดตัวอาคารเรียนรู้ใหม่',
        organization: 'มหาวิทยาลัยเกษตรศาสตร์',
        coordinator: 'คุณศิริพร วัฒนกิจ',
        eventDate: '2024-11-08',
        budget: 340000,
        status: 'draft'
    },
    {
        id: 'EV-2024-002',
        name: 'เทศกาลอาหารนานาชาติ',
        organization: 'สมาคมการท่องเที่ยวกรุงเทพ',
        coordinator: 'คุณชยุต เลิศศักดิ์',
        eventDate: '2024-10-22',
        budget: 580000,
        status: 'planning'
    },
    {
        id: 'EV-2024-003',
        name: 'ประชุมวิชาการเกษตรยั่งยืน',
        organization: 'กรมส่งเสริมการเกษตร',
        coordinator: 'ดร.ธนพร พิพัฒน์สกุล',
        eventDate: '2024-09-15',
        budget: 265000,
        status: 'waiting'
    },
    {
        id: 'EV-2024-004',
        name: 'สัมมนาเทคโนโลยีการศึกษา',
        organization: 'กระทรวงศึกษาธิการ',
        coordinator: 'คุณกันตพร อนันต์รุ่งเรือง',
        eventDate: '2024-12-01',
        budget: 410000,
        status: 'processing'
    },
    {
        id: 'EV-2024-005',
        name: 'กีฬาสีองค์กรประจำปี',
        organization: 'บริษัท เพาเวอร์ซิสเต็ม จำกัด',
        coordinator: 'คุณณัฐพล กิจไพบูลย์',
        eventDate: '2024-08-12',
        budget: 180000,
        status: 'billing'
    },
    {
        id: 'EV-2024-006',
        name: 'งานเลี้ยงขอบคุณลูกค้า',
        organization: 'บริษัท สไมล์ฟู้ดส์',
        coordinator: 'คุณอภิชาติ ภิรมย์',
        eventDate: '2024-07-30',
        budget: 220000,
        status: 'completed'
    },
    {
        id: 'EV-2024-007',
        name: 'โครงการจิตอาสาพัฒนาชุมชน',
        organization: 'เทศบาลเมืองศรีราชา',
        coordinator: 'คุณอรุณี เกื้อหนุน',
        eventDate: '2024-09-02',
        budget: 95000,
        status: 'cancelled'
    },
    {
        id: 'EV-2024-008',
        name: 'คอนเสิร์ตการกุศลเพื่อการศึกษา',
        organization: 'มูลนิธิเพื่ออนาคตเยาวชน',
        coordinator: 'คุณช่อผกา นิลพฤกษ์',
        eventDate: '2024-10-05',
        budget: 305000,
        status: 'waiting'
    }
];

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

function computeStatusCounts() {
    const counts = {};
    statusOrder.forEach(key => {
        counts[key] = 0;
    });

    for (const ev of events) {
        counts.all += 1;
        if (counts[ev.status] !== undefined) {
            counts[ev.status] += 1;
        }
    }

    return counts;
}

function renderSummary() {
    const counts = computeStatusCounts();
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
            <strong>${counts[key] ?? 0}</strong>
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
    applyFilters();
}

function renderTable(list) {
    tableBody.innerHTML = '';
    const hasRows = list.length > 0;
    emptyState.classList.toggle('show', !hasRows);
    emptyState.setAttribute('aria-hidden', hasRows ? 'true' : 'false');
    if (!hasRows) {
        return;
    }

    for (const ev of list) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td data-label="รหัส">${ev.id}</td>
            <td data-label="ชื่องาน">
                <div class="cell-title">${escapeHtml(ev.name)}</div>
                <span class="cell-sub">${escapeHtml(ev.organization)}</span>
            </td>
            <td data-label="หน่วยงาน">${escapeHtml(ev.organization)}</td>
            <td data-label="ผู้ประสานงาน">${escapeHtml(ev.coordinator)}</td>
            <td data-label="วันที่จัด">${formatDate(ev.eventDate)}</td>
            <td data-label="งบประมาณ">${formatCurrency(ev.budget)}</td>
            <td data-label="สถานะ">
                <span class="status-badge ${ev.status}">${statusMeta[ev.status]?.label ?? 'ไม่ระบุ'}</span>
            </td>
            <td class="col-actions">
                <button class="action-btn" data-action="open" data-id="${ev.id}"><span class="i list"></span>รายละเอียด</button>
            </td>
        `;
        tableBody.append(tr);
    }
}

function escapeHtml(s = '') {
    return s.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

function formatDate(value) {
    const d = new Date(value);
    const opts = { year: 'numeric', month: 'long', day: 'numeric' };
    return d.toLocaleDateString('th-TH', opts);
}

function formatCurrency(value) {
    return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 }).format(value);
}

function applyFilters() {
    const term = searchInput.value.trim().toLowerCase();
    const status = statusFilter.value;

    const filtered = events.filter(ev => {
        const matchesStatus = status === 'all' ? true : ev.status === status;
        if (!matchesStatus) return false;
        if (!term) return true;
        return [ev.id, ev.name, ev.organization, ev.coordinator]
            .some(field => field.toLowerCase().includes(term));
    });

    renderTable(filtered);
}

searchInput.addEventListener('input', applyFilters);
statusFilter.addEventListener('change', () => {
    updateActiveSummary();
    applyFilters();
});

summaryWrap.addEventListener('click', event => {
    const card = event.target.closest('.summary-card');
    if (!card) return;
    setStatusFilter(card.dataset.status);
});

document.getElementById('btnClearFilters').addEventListener('click', () => {
    searchInput.value = '';
    setStatusFilter('all');
});

document.getElementById('btnExport').addEventListener('click', () => {
    alert('ฟังก์ชันส่งออกจะพร้อมใช้งานเร็ว ๆ นี้');
});

document.getElementById('btnNewEvent').addEventListener('click', () => {
    alert('ฟอร์มสร้างอีเว้นกำลังพัฒนา');
});

renderSummary();
applyFilters();