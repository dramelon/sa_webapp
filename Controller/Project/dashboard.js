(function () {
    const cardsContainer = document.getElementById('projectCards');
    const tableBody = document.querySelector('#projectTable tbody');
    const dateLabel = document.querySelector('.news-head .date');

    const statusLabels = {
        draft: 'ร่าง',
        planning: 'วางแผน',
        waiting: 'รอดำเนินการ',
        processing: 'กำลังดำเนินการ',
        billing: 'เรียกเก็บเงิน',
        completed: 'เสร็จสิ้น',
        cancelled: 'ยกเลิก',
    };

    const updateThaiDate = () => {
        const now = new Date();
        const days = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
        const months = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
        const day = days[now.getDay()];
        const date = now.getDate();
        const month = months[now.getMonth()];
        const year = now.getFullYear() + 543;
        const time = now.toLocaleTimeString('th-TH', { hour12: false });
        if (dateLabel) {
            dateLabel.textContent = `วัน${day}ที่ ${date} ${month} ${year} เวลา ${time}`;
        }
    };

    const escapeHtml = (value) =>
        (value == null ? '' : String(value)).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

    const renderCards = (counts = {}) => {
        if (!cardsContainer) return;
        cardsContainer.innerHTML = '';
        const focusStatuses = ['planning', 'waiting', 'processing'];
        for (const key of focusStatuses) {
            const value = Number(counts[key]) || 0;
            const card = document.createElement('article');
            card.className = 'card';
            card.innerHTML = `
        <header class="card-head"><span class="i progress"></span><h3>${statusLabels[key] || key}</h3></header>
        <div class="card-divider"></div>
        <p class="card-body">งานในสถานะนี้จำนวน ${value} งาน</p>
      `;
            cardsContainer.append(card);
        }
    };

    const renderTable = (rows = []) => {
        if (!tableBody) return;
        tableBody.innerHTML = '';
        if (!rows.length) {
            const tr = document.createElement('tr');
            tr.innerHTML = '<td colspan="4" class="empty">ไม่พบงานที่รับผิดชอบ</td>';
            tableBody.append(tr);
            return;
        }
        for (const item of rows.slice(0, 6)) {
            const tr = document.createElement('tr');
            const statusKey = (item.status || '').toLowerCase();
            tr.innerHTML = `
        <td>EV-${escapeHtml(item.event_id)}</td>
        <td>${escapeHtml(item.event_name)}</td>
        <td>${escapeHtml(statusLabels[statusKey] || item.status || 'ไม่ระบุ')}</td>
        <td>${formatDate(item.start_date)}</td>
      `;
            tableBody.append(tr);
        }
    };

    const formatDate = (value) => {
        if (!value) return '—';
        const normalized = String(value).replace(' ', 'T');
        const date = new Date(normalized);
        if (Number.isNaN(date.getTime())) return '—';
        return date.toLocaleString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    const fetchOverview = async (modelRoot) => {
        try {
            const params = new URLSearchParams({ page: 1, status: 'all' });
            const response = await fetch(`${modelRoot}/events_list.php?${params.toString()}`, {
                credentials: 'same-origin',
            });
            if (!response.ok) {
                throw new Error('network');
            }
            const payload = await response.json();
            renderCards(payload.counts || {});
            renderTable(Array.isArray(payload.data) ? payload.data : []);
        } catch (error) {
            renderCards();
            renderTable();
        }
    };

    const boot = ({ root }) => {
        const modelRoot = `${root}/Model`;
        updateThaiDate();
        setInterval(updateThaiDate, 1000);
        fetchOverview(modelRoot);
    };

    if (typeof window.onAppReady === 'function') {
        window.onAppReady(boot);
    }
})();