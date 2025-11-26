(function () {
    const params = new URLSearchParams(window.location.search);
    const requestId = params.get('request_id');

    const reviewTitle = document.getElementById('reviewTitle');
    const reviewDate = document.getElementById('reviewDate');
    const reviewBackLink = document.getElementById('reviewBackLink');
    const reviewMessage = document.getElementById('reviewMessage');
    const reviewReference = document.getElementById('reviewReference');
    const reviewRequestName = document.getElementById('reviewRequestName');
    const reviewEventName = document.getElementById('reviewEventName');
    const reviewEventCode = document.getElementById('reviewEventCode');
    const reviewEventDates = document.getElementById('reviewEventDates');
    const reviewUpdatedAt = document.getElementById('reviewUpdatedAt');
    const reviewUpdatedBy = document.getElementById('reviewUpdatedBy');
    const reviewStatusBadge = document.getElementById('reviewStatusBadge');
    const reviewStatusText = document.getElementById('reviewStatusText');
    const reviewAllocations = document.getElementById('reviewAllocations');
    const reviewAllocationsEmpty = document.getElementById('reviewAllocationsEmpty');
    const reviewShortages = document.getElementById('reviewShortages');
    const reviewShortagesEmpty = document.getElementById('reviewShortagesEmpty');

    let modelRoot = '';

    const statusLabels = {
        draft: 'สถานะ: ร่าง',
        submitted: 'สถานะ: ส่งคำขอ',
        pending: 'สถานะ: รอตรวจสอบ',
        approved: 'สถานะ: อนุมัติแล้ว',
        closed: 'สถานะ: ปิดคำขอ',
        cancelled: 'สถานะ: ยกเลิก',
    };

    function setMessage(message, tone = 'info') {
        if (!reviewMessage) {
            return;
        }
        if (!message) {
            reviewMessage.hidden = true;
            reviewMessage.textContent = '';
            reviewMessage.className = 'form-alert';
            return;
        }
        reviewMessage.hidden = false;
        reviewMessage.textContent = message;
        reviewMessage.className = `form-alert ${tone === 'error' ? 'error' : tone === 'success' ? 'success' : ''}`;
    }

    function formatThaiDate(dateInput) {
        const date = dateInput ? new Date(dateInput) : null;
        if (!date || Number.isNaN(date.getTime())) {
            return '—';
        }
        const thaiYear = date.getFullYear() + 543;
        return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1)
            .toString()
            .padStart(2, '0')}/${thaiYear}`;
    }

    function formatDateRange(start, end) {
        const startText = formatThaiDate(start);
        const endText = formatThaiDate(end);
        if (startText === '—' && endText === '—') {
            return '—';
        }
        if (startText !== '—' && endText !== '—') {
            return `${startText} - ${endText}`;
        }
        return startText !== '—' ? startText : endText;
    }

    function updateThaiNow() {
        if (!reviewDate) {
            return;
        }
        const now = new Date();
        const thaiYear = now.getFullYear() + 543;
        const formatted = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1)
            .toString()
            .padStart(2, '0')}/${thaiYear}`;
        reviewDate.textContent = `วันที่ ${formatted}`;
    }

    function normalizeStatus(status) {
        const value = typeof status === 'string' ? status.trim().toLowerCase() : '';
        if (!value) {
            return 'draft';
        }
        return statusLabels[value] ? value : 'draft';
    }

    function updateStatus(status) {
        const normalized = normalizeStatus(status);
        if (reviewStatusBadge) {
            reviewStatusBadge.dataset.status = normalized;
        }
        if (reviewStatusText) {
            reviewStatusText.textContent = statusLabels[normalized] || `สถานะ: ${normalized}`;
        }
    }

    function syncBackLink(eventId) {
        const target = eventId ? `./event_document_manage.html?event_id=${encodeURIComponent(eventId)}` : './event_document_manage.html';
        if (reviewBackLink) {
            reviewBackLink.href = target;
        }
    }

    function renderAllocation(line, units) {
        const wrapper = document.createElement('article');
        wrapper.className = 'allocation-card';
        wrapper.setAttribute('role', 'listitem');

        const header = document.createElement('div');
        header.className = 'allocation-head';
        const title = document.createElement('h4');
        title.textContent = `${line.item_name || 'สินค้า #' + line.item_id}`;
        const meta = document.createElement('p');
        meta.className = 'allocation-meta';
        meta.textContent = `ขอ ${line.quantity} หน่วย`; 
        header.appendChild(title);
        header.appendChild(meta);

        const list = document.createElement('ul');
        list.className = 'allocation-unit-list';

        units.forEach((unit) => {
            const item = document.createElement('li');
            item.className = 'allocation-unit';
            const titleSpan = document.createElement('span');
            titleSpan.className = 'unit-label';
            titleSpan.textContent = `ยูนิต #${unit.item_unit_id}`;
            const detailSpan = document.createElement('span');
            detailSpan.className = 'unit-detail';
            const location = unit.warehouse_name ? ` - ${unit.warehouse_name}` : '';
            detailSpan.textContent = `${unit.serial_number || 'ไม่มี Serial'} (${unit.status || '—'})${location}`;
            item.appendChild(titleSpan);
            item.appendChild(detailSpan);
            list.appendChild(item);
        });

        wrapper.appendChild(header);
        wrapper.appendChild(list);
        return wrapper;
    }

    function renderShortage(line, missingQty, availableCount) {
        const wrapper = document.createElement('article');
        wrapper.className = 'shortage-card';
        wrapper.setAttribute('role', 'listitem');

        const title = document.createElement('h4');
        title.textContent = `${line.item_name || 'สินค้า #' + line.item_id}`;
        const meta = document.createElement('p');
        meta.className = 'shortage-meta';
        meta.textContent = `ต้องการ ${line.quantity} หน่วย - จัดสรรได้ ${availableCount} หน่วย`; 
        const missing = document.createElement('p');
        missing.className = 'shortage-missing';
        missing.textContent = `ยังขาด ${missingQty} หน่วย`; 

        wrapper.appendChild(title);
        wrapper.appendChild(meta);
        wrapper.appendChild(missing);
        return wrapper;
    }

    function renderAllocations(linesWithUnits) {
        if (!reviewAllocations || !reviewAllocationsEmpty) {
            return;
        }
        reviewAllocations.innerHTML = '';
        let any = false;
        linesWithUnits.forEach(({ line, units }) => {
            if (units.length) {
                const card = renderAllocation(line, units);
                reviewAllocations.appendChild(card);
                any = true;
            }
        });
        reviewAllocations.hidden = !any;
        reviewAllocationsEmpty.hidden = any;
    }

    function renderShortages(linesWithUnits) {
        if (!reviewShortages || !reviewShortagesEmpty) {
            return;
        }
        reviewShortages.innerHTML = '';
        let any = false;
        linesWithUnits.forEach(({ line, units }) => {
            const missingQty = Math.max(0, (line.quantity || 0) - units.length);
            if (missingQty > 0) {
                const card = renderShortage(line, missingQty, units.length);
                reviewShortages.appendChild(card);
                any = true;
            }
        });
        reviewShortages.hidden = !any;
        reviewShortagesEmpty.hidden = any;
    }

    async function fetchRequestDetail() {
        const response = await fetch(`${modelRoot}/request_detail.php?request_id=${encodeURIComponent(requestId)}`, {
            credentials: 'same-origin',
        });
        if (!response.ok) {
            throw new Error('ไม่สามารถโหลดข้อมูลคำขอได้');
        }
        const payload = await response.json();
        return payload?.data || null;
    }

    async function fetchUnitsByItem(itemId) {
        const response = await fetch(`${modelRoot}/item_units_by_item.php?item_id=${encodeURIComponent(itemId)}`, {
            credentials: 'same-origin',
        });
        if (!response.ok) {
            throw new Error(`โหลดข้อมูลหน่วยสินค้าไม่สำเร็จ: ${response.status} ${response.statusText}`);
        }
        const payload = await response.json();
        return Array.isArray(payload?.data) ? payload.data : [];
    }

    async function loadAllocations(lines) {
        const results = [];
        for (const line of lines) {
            const units = await fetchUnitsByItem(line.item_id);
            const availableUnits = Array.isArray(units) ? units.slice(0, Math.max(0, line.quantity || 0)) : [];
            results.push({ line, units: availableUnits });
        }
        renderAllocations(results);
        renderShortages(results);
    }

    function applyRequestInfo(data) {
        if (!data) {
            setMessage('ไม่พบข้อมูลคำขอ', 'error');
            return;
        }
        const status = normalizeStatus(data.status);
        const reference = data.reference ? `รหัสคำขอ: ${data.reference}` : 'รหัสคำขอ: —';
        const titleText = data.request_name || reference;
        if (reviewTitle) {
            reviewTitle.textContent = titleText;
        }
        if (reviewReference) {
            reviewReference.textContent = reference;
        }
        if (reviewRequestName) {
            reviewRequestName.textContent = data.request_name || '—';
        }
        if (reviewEventName) {
            reviewEventName.textContent = data.event?.event_name || '—';
        }
        if (reviewEventCode) {
            reviewEventCode.textContent = `รหัสอีเว้น: ${data.event?.event_code || '—'}`;
        }
        if (reviewEventDates) {
            reviewEventDates.textContent = `ช่วงเวลา: ${formatDateRange(data.event?.start_date, data.event?.end_date)}`;
        }
        if (reviewUpdatedAt) {
            reviewUpdatedAt.textContent = `อัปเดตล่าสุด: ${formatThaiDate(data.updated_at)}`;
        }
        if (reviewUpdatedBy) {
            reviewUpdatedBy.textContent = `โดย: ${data.updated_by_label || '—'}`;
        }
        updateStatus(status);
        syncBackLink(data.event?.event_id);
    }

    async function boot({ root }) {
        if (!requestId) {
            setMessage('ไม่พบรหัสคำขอในลิงก์', 'error');
            return;
        }
        modelRoot = `${root}/Model`;
        updateThaiNow();
        setInterval(updateThaiNow, 60_000);
        try {
            const data = await fetchRequestDetail();
            applyRequestInfo(data);
            const lines = Array.isArray(data?.lines) ? data.lines : [];
            await loadAllocations(lines);
        } catch (error) {
            console.error(error);
            setMessage(error?.message || 'ไม่สามารถโหลดข้อมูลเพื่อตรวจสอบได้', 'error');
        }
    }

    if (typeof window.onAppReady === 'function') {
        window.onAppReady(boot);
    }
})();