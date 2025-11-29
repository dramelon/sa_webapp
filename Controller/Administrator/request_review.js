(function () {
    const params = new URLSearchParams(window.location.search);
    const requestId = params.get('request_id');
    const returnTo = params.get('return_to');

    const reviewTitle = document.getElementById('reviewTitle');
    const pageDate = document.getElementById('pageDate');
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
    const reviewPendingList = document.getElementById('reviewPendingList');
    const reviewPendingEmpty = document.getElementById('reviewPendingEmpty');
    const reviewCompleteList = document.getElementById('reviewCompleteList');
    const reviewCompleteEmpty = document.getElementById('reviewCompleteEmpty');

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

    const updateThaiDate = () => {
        if (!pageDate) {
            return; // Exit if pageDate element is not found
        }
        const now = new Date();
        const days = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
        const months = [
            'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
            'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
        ];
        const day = days[now.getDay()];
        const date = now.getDate();
        const month = months[now.getMonth()];
        const thaiYear = now.getFullYear() + 543;
        const time = now.toLocaleTimeString('th-TH', { hour12: false });
        pageDate.textContent = `วัน${day}ที่ ${date} ${month} ${thaiYear} เวลา ${time}`; // Update the text content
    };

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
        if (reviewBackLink) {
            if (returnTo) {
                reviewBackLink.href = returnTo;
            } else {
                const target = eventId ? `./event_document_manage.html?event_id=${encodeURIComponent(eventId)}` : './event_document_manage.html';
                reviewBackLink.href = target;
            }
        }
    }

    function normalizeProgress(value) {
        const num = Number(value);
        return Number.isFinite(num) && num >= 0 ? num : 0;
    }

    function formatLineTitle(line) {
        const idLabel = line.line_no || line.request_line_id || line.item_id;
        const titleLabel = line.item_name || `สินค้า #${line.item_id}`;
        return idLabel ? `${titleLabel} (#${idLabel})` : titleLabel;
    }

    function buildReviewCard(line) {
        const wrapper = document.createElement('article');
        wrapper.className = 'review-line-card';
        wrapper.setAttribute('role', 'listitem');

        const leftSide = document.createElement('div');
        leftSide.className = 'review-line-left';

        const header = document.createElement('div');
        header.className = 'review-line-head';
        const title = document.createElement('h4');
        title.textContent = formatLineTitle(line);
        header.appendChild(title);

        const content = document.createElement('div');
        content.className = 'review-line-body';

        const reference = document.createElement('p');
        reference.className = 'review-line-ref';
        reference.textContent = line.item_reference ? `รหัสอ้างอิง: ${line.item_reference}` : 'ไม่มีรหัสอ้างอิง';

        const reviewedCount = normalizeProgress(line.fulfilled_quantity ?? line.quantity_fulfilled);
        const total = normalizeProgress(line.quantity);
        const progress = document.createElement('p');
        progress.className = 'review-line-progress';
        progress.textContent = `${reviewedCount}/${total} item fulfill`;

        content.appendChild(reference);
        content.appendChild(progress);

        leftSide.appendChild(header);
        leftSide.appendChild(content);

        const rightSide = document.createElement('div');
        rightSide.className = 'review-line-right';

        const action = document.createElement('a');
        action.className = 'btn btn-ghost';
        const lineId = line.line_no || line.item_id || line.request_line_id;
        const requestLineParam = encodeURIComponent(line.request_line_id);
        const lineParam = lineId !== undefined && lineId !== null ? `&line_id=${encodeURIComponent(lineId)}` : '';
        const returnToParam = `&return_to=${encodeURIComponent(window.location.pathname + window.location.search)}`;
        action.href = `./request_review_fulfillment.html?request_line_id=${requestLineParam}${lineParam}${returnToParam}`;
        action.textContent = 'ดำเนินการตรวจสอบ';
        action.setAttribute('aria-label', `ตรวจสอบ ${formatLineTitle(line)}`);
        rightSide.appendChild(action);

        wrapper.appendChild(leftSide);
        wrapper.appendChild(rightSide);
        return wrapper;
    }

    function renderReviewList(lines, listEl, emptyEl) {
        if (!listEl || !emptyEl) {
            return;
        }
        listEl.innerHTML = '';
        const hasItems = Array.isArray(lines) && lines.length > 0;
        if (hasItems) {
            lines.forEach((line) => {
                const card = buildReviewCard(line);
                listEl.appendChild(card);
            });
        }
        listEl.hidden = !hasItems;
        emptyEl.hidden = hasItems;
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

    function renderReviewGroups(lines) {
        const pending = [];
        const reviewed = [];
        lines.forEach((line) => {
            const status = typeof line.fulfillment_status === 'string' ? line.fulfillment_status.toLowerCase() : '';
            if (status && status !== 'pending') {
                reviewed.push(line);
            } else {
                pending.push(line);
            }
        });
        renderReviewList(pending, reviewPendingList, reviewPendingEmpty);
        renderReviewList(reviewed, reviewCompleteList, reviewCompleteEmpty);
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
        updateThaiDate(); // Initial call
        setInterval(updateThaiDate, 1000);
        try {
            const data = await fetchRequestDetail();
            applyRequestInfo(data);
            const lines = Array.isArray(data?.lines) ? data.lines : [];
            renderReviewGroups(lines);
        } catch (error) {
            console.error(error);
            setMessage(error?.message || 'ไม่สามารถโหลดข้อมูลเพื่อตรวจสอบได้', 'error');
        }
    }

    if (typeof window.onAppReady === 'function') {
        window.onAppReady(boot);
    }
})();