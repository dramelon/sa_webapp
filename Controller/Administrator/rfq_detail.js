(function () {
    const params = new URLSearchParams(window.location.search);
    const initialRequestId = params.get('request_id');
    const initialEventId = params.get('event_id');

    const backLink = document.getElementById('rfqBackLink');
    const pageTitle = document.getElementById('rfqTitle');
    const pageDate = document.getElementById('rfqPageDate');
    const backButton = document.getElementById('rfqBtnBack');
    const saveButton = document.getElementById('rfqBtnSave');
    const globalMessage = document.getElementById('rfqGlobalMessage');
    const eventNameDisplay = document.getElementById('rfqEventName');
    const eventCodeDisplay = document.getElementById('rfqEventCode');
    const eventDateDisplay = document.getElementById('rfqEventDate');
    const requestReferenceDisplay = document.getElementById('rfqRequestReference');
    const requestReferenceMeta = document.getElementById('rfqRequestReferenceMeta');
    const statusBadge = document.getElementById('rfqStatusBadge');
    const statusText = document.getElementById('rfqStatusText');
    const updatedAtDisplay = document.getElementById('rfqUpdatedAt');
    const missingLinesBody = document.getElementById('rfqMissingLinesBody');
    const titleInput = document.getElementById('rfqTitleInput');
    const dueDateInput = document.getElementById('rfqDueDateInput');
    const expectedArrivalInput = document.getElementById('rfqExpectedArrivalInput');
    const paymentTermSelect = document.getElementById('rfqPaymentTermSelect');
    const paymentMethodSelect = document.getElementById('rfqPaymentMethodSelect');
    const noteInput = document.getElementById('rfqNoteInput');
    const requestDateInput = document.getElementById('rfqRequestDateInput');
    const validityDaysInput = document.getElementById('rfqValidityDaysInput');
    const orderDateInput = document.getElementById('rfqOrderDateInput');
    const orderDeadlineInput = document.getElementById('rfqOrderDeadlineInput');
    const refIdInput = document.getElementById('rfqRefSupplierRfqId');
    const staffIdInput = document.getElementById('rfqStaffId');
    const contactPersonInput = document.getElementById('rfqContactPerson');
    const deliverToInput = document.getElementById('rfqDeliverTo');

    let modelRoot = '';
    let requestId = initialRequestId ? String(initialRequestId) : '';
    let eventId = initialEventId ? String(initialEventId) : '';
    let requestInfo = null;
    let eventInfo = null;
    let staffInfo = null;

    function formatDate(dateLike) {
        if (!dateLike) {
            return '—';
        }
        const date = new Date(dateLike);
        if (Number.isNaN(date.getTime())) {
            return '—';
        }
        return date.toLocaleDateString('th-TH', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    }

    function formatDateTime(dateLike) {
        if (!dateLike) {
            return '—';
        }
        const date = new Date(dateLike);
        if (Number.isNaN(date.getTime())) {
            return '—';
        }
        return date.toLocaleString('th-TH', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    }

    function toLocalInputDateTime(dateLike) {
        if (!dateLike) return '';
        const date = new Date(dateLike);
        if (Number.isNaN(date.getTime())) return '';
        const offsetMs = date.getTimezoneOffset() * 60000;
        const local = new Date(date.getTime() - offsetMs);
        return local.toISOString().slice(0, 16);
    }

    function setDateTimeInputValue(input, dateLike) {
        if (!input) return;
        const value = toLocalInputDateTime(dateLike);
        if (value) {
            input.value = value;
        }
    }

    function setGlobalMessage(text, tone = 'info') {
        if (!globalMessage) return;
        if (!text) {
            globalMessage.hidden = true;
            globalMessage.textContent = '';
            return;
        }
        globalMessage.textContent = text;
        globalMessage.hidden = false;
        globalMessage.className = `form-alert ${tone}`;
    }

    function updateBackLink() {
        if (!backLink) return;
        // Always point to event_document_manage.html.
        const url = new URL('./event_document_manage.html', window.location.href);
        if (eventId) {
            url.searchParams.set('event_id', eventId);
        }
        backLink.href = `${url.pathname}${url.search}`;
    }

    function setPageTitle(name) {
        const label = name && name.trim() !== '' ? name : 'คำขอใบเสนอราคาใหม่';
        pageTitle.textContent = `RFQ สำหรับ ${label}`;
    }

    function tickClock() {
        if (!pageDate) return;
        const now = new Date();
        pageDate.textContent = now.toLocaleString('th-TH', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    }

    function getFulfilledCountFromLine(line) {
        const candidates = [
            line?.fulfillment_line_count,
            line?.fulfilled_quantity,
            line?.quantity_fulfilled,
            line?.fulfillment?.quantity_fulfilled,
        ];
        for (const candidate of candidates) {
            const num = Number(candidate);
            if (Number.isFinite(num) && num > 0) {
                return num;
            }
        }
        return 0;
    }

    function getRequestedQuantityFromLine(line) {
        const quantity = Number(line?.quantity);
        return Number.isFinite(quantity) && quantity > 0 ? quantity : 0;
    }

    function buildMissingLines() {
        const lines = Array.isArray(requestInfo?.lines) ? requestInfo.lines : [];
        const missing = [];
        lines.forEach((line) => {
            const status = typeof line?.fulfillment_status === 'string' ? line.fulfillment_status.toLowerCase() : '';
            const requested = getRequestedQuantityFromLine(line);
            const fulfilled = getFulfilledCountFromLine(line);
            const remaining = Math.max(0, requested - fulfilled);
            if (status === 'cancelled' && requested > 0) {
                missing.push({ ...line, missing_quantity: requested, fulfilled_quantity: fulfilled, requested_quantity: requested });
                return;
            }
            if (remaining > 0) {
                missing.push({ ...line, missing_quantity: remaining, fulfilled_quantity: fulfilled, requested_quantity: requested });
            }
        });
        return missing;
    }

    function setRequestReference(value) {
        const text = value || '—';
        if (requestReferenceDisplay) {
            if (requestReferenceDisplay.tagName === 'INPUT') {
                requestReferenceDisplay.value = text;
            } else {
                requestReferenceDisplay.textContent = text;
            }
        }
        if (requestReferenceMeta) {
            requestReferenceMeta.textContent = `อ้างอิงคำขอ: ${text}`;
        }
    }

    function renderMissingLines() {
        if (!missingLinesBody) return;
        const missing = buildMissingLines();
        missingLinesBody.innerHTML = '';
        if (missing.length === 0) {
            const row = document.createElement('tr');
            row.className = 'empty-row';
            const cell = document.createElement('td');
            cell.colSpan = 6;
            cell.textContent = 'ไม่พบรายการที่ต้องจัดหาเพิ่ม';
            row.appendChild(cell);
            missingLinesBody.appendChild(row);
            return;
        }
        missing.forEach((line) => {
            const row = document.createElement('tr');
            const refCell = document.createElement('td');
            refCell.textContent = line.item_reference || '—';
            const nameCell = document.createElement('td');
            nameCell.textContent = line.item_name || 'ไม่ทราบชื่อสินค้า';
            const uomCell = document.createElement('td');
            uomCell.textContent = line.item_uom || '—';
            const requestedCell = document.createElement('td');
            requestedCell.textContent = String(line.requested_quantity ?? getRequestedQuantityFromLine(line));
            const fulfilledCell = document.createElement('td');
            fulfilledCell.textContent = String(line.fulfilled_quantity ?? getFulfilledCountFromLine(line));
            const missingCell = document.createElement('td');
            missingCell.textContent = String(line.missing_quantity ?? 0);

            row.append(refCell, nameCell, uomCell, requestedCell, fulfilledCell, missingCell);
            missingLinesBody.appendChild(row);
        });
    }

    function applyEventInfo(info) {
        eventInfo = info || null;
        if (!eventInfo) return;
        if (eventInfo.event_id) {
            eventId = String(eventInfo.event_id);
        }
        if (eventNameDisplay) {
            eventNameDisplay.textContent = eventInfo.event_name || '—';
        }
        if (eventCodeDisplay) {
            const code = eventInfo.event_code || eventInfo.event_id || '—';
            eventCodeDisplay.textContent = `รหัสอีเว้น: ${code}`;
        }
        if (eventDateDisplay) {
            eventDateDisplay.textContent = `ช่วงเวลา: ${formatDate(eventInfo.start_date)} - ${formatDate(eventInfo.end_date)}`;
        }
        if (dueDateInput && !dueDateInput.value && eventInfo.end_date) {
            setDateTimeInputValue(dueDateInput, eventInfo.end_date);
        }
        if (expectedArrivalInput && !expectedArrivalInput.value && eventInfo.end_date) {
            setDateTimeInputValue(expectedArrivalInput, eventInfo.end_date);
        }
        if (deliverToInput && !deliverToInput.value && eventInfo.event_id) {
            deliverToInput.value = String(eventInfo.event_id);
        }
        updateBackLink();
    }

    function applyRequestInfo(payload) {
        requestInfo = payload || null;
        if (!requestInfo) {
            return;
        }
        if (requestInfo.request_id) {
            requestId = String(requestInfo.request_id);
        }
        setPageTitle(requestInfo.request_name);
        if (titleInput && !titleInput.value && requestInfo.request_name) {
            titleInput.value = `RFQ สำหรับ ${requestInfo.request_name}`;
        }
        setRequestReference(requestInfo.reference);
        applyEventInfo(requestInfo.event);
        renderMissingLines();
        updateBackLink();
    }

    function applyStaffInfo(info) {
        if (!info) return;
        const staffIdValue = info.staff_id ? String(info.staff_id) : '';
        if (staffIdInput && !staffIdInput.value) {
            staffIdInput.value = staffIdValue;
        }
        if (contactPersonInput && !contactPersonInput.value) {
            contactPersonInput.value = staffIdValue;
        }
    }

    async function fetchSessionUser() {
        try {
            const response = await fetch(`${modelRoot}/session_user.php`, { credentials: 'same-origin' });
            if (!response.ok) return;
            const data = await response.json();
            staffInfo = data || null;
            applyStaffInfo(staffInfo);
        } catch (error) {
            // ignore
        }
    }

    async function loadRequestDetail() {
        if (!requestId) {
            setGlobalMessage('ไม่พบรหัสคำขอสำหรับสร้าง RFQ', 'error');
            return;
        }
        try {
            const response = await fetch(`${modelRoot}/request_detail.php?request_id=${encodeURIComponent(requestId)}`, {
                credentials: 'same-origin',
            });
            if (!response.ok) {
                throw new Error('ไม่สามารถโหลดข้อมูลคำขอได้');
            }
            const data = await response.json();
            applyRequestInfo(data?.data);
        } catch (error) {
            setGlobalMessage('โหลดข้อมูลคำขอเบิกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง', 'error');
        }
    }

    function buildSavePayload() {
        const missing = buildMissingLines();
        return {
            request_id: requestId ? Number(requestId) : null,
            event_id: eventId ? Number(eventId) : requestInfo?.event_id ?? null,
            title: (titleInput?.value || '').trim(),
            rfq_request_date: (requestDateInput?.value || '').trim() || null,
            rfq_validity_days: Number.isFinite(Number(validityDaysInput?.value))
                ? Number(validityDaysInput.value)
                : null,
            rfq_due_date: (dueDateInput?.value || '').trim() || null,
            order_date: (orderDateInput?.value || '').trim() || null,
            order_deadline: (orderDeadlineInput?.value || '').trim() || null,
            order_expected_arrival: (expectedArrivalInput?.value || '').trim() || null,
            payment_term: paymentTermSelect?.value || '30D',
            payment_method: paymentMethodSelect?.value || 'bank',
            note: (noteInput?.value || '').trim() || null,
            ref_supplier_rfq_id: (refIdInput?.value || '').trim() || null,
            contact_person: Number.isFinite(Number(contactPersonInput?.value))
                ? Number(contactPersonInput.value)
                : null,
            deliver_to: Number.isFinite(Number(deliverToInput?.value)) ? Number(deliverToInput.value) : null,
            missing_lines: missing.map((line) => ({
                item_id: line.item_id ?? line.id ?? null,
                item_desc: line.item_name || '',
                uom: line.item_uom || line.uom || '',
                quantity_requested: line.missing_quantity ?? 0,
                note: line.note || null,
            })),
        };
    }

    function validatePayload(payload) {
        if (!payload.request_id || !payload.event_id) {
            setGlobalMessage('ไม่พบข้อมูลอ้างอิงอีเว้นหรือคำขอ', 'error');
            return false;
        }
        if (!payload.title || payload.title.trim() === '') {
            setGlobalMessage('กรุณากรอกหัวข้อ RFQ', 'error');
            return false;
        }
        if (!Array.isArray(payload.missing_lines) || payload.missing_lines.length === 0) {
            setGlobalMessage('ไม่มีรายการที่ต้องขอใบเสนอราคาเพิ่มเติม', 'error');
            return false;
        }
        return true;
    }

    function setStatusChip(status = 'draft') {
        const normalized = typeof status === 'string' && status.trim() !== '' ? status.trim().toLowerCase() : 'draft';
        if (statusBadge) {
            statusBadge.dataset.status = normalized;
        }
        if (statusText) {
            const displayLabel =
                normalized === 'completed'
                    ? 'เสร็จสิ้น'
                    : normalized === 'cancelled'
                    ? 'ยกเลิก'
                    : 'ร่าง';
            statusText.textContent = `สถานะ: ${displayLabel}`;
        }
    }

    async function handleSave() {
        setGlobalMessage('');
        const payload = buildSavePayload();
        if (!payload.title && requestInfo?.request_name) {
            payload.title = `RFQ สำหรับ ${requestInfo.request_name}`;
        }
        if (!validatePayload(payload)) {
            return;
        }
        try {
            const response = await fetch(`${modelRoot}/supplier_rfq_create.php`, {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });
            if (!response.ok) {
                throw new Error('บันทึก RFQ ไม่สำเร็จ');
            }
            const data = await response.json();
            if (data?.data?.supplier_rfq_id) {
                setStatusChip('draft');
                updatedAtDisplay.textContent = formatDateTime(new Date());
            }
            setGlobalMessage('บันทึกคำขอใบเสนอราคาเรียบร้อย', 'success');
        } catch (error) {
            setGlobalMessage('บันทึก RFQ ไม่สำเร็จ กรุณาลองใหม่', 'error');
        }
    }

    function bindEvents() {
        if (backButton) {
            backButton.addEventListener('click', () => {
                const url = new URL('./event_document_manage.html', window.location.origin);
                if (eventId) {
                    url.searchParams.set('event_id', eventId);
                }
                if (requestId) {
                    url.searchParams.set('request_id', requestId);
                }
                window.location.href = `${url.pathname}${url.search}`;
            });
        }
        if (saveButton) {
            saveButton.addEventListener('click', () => {
                handleSave();
            });
        }
    }

    function initializeStaticFields() {
        const now = new Date();
        if (requestDateInput && !requestDateInput.value) {
            setDateTimeInputValue(requestDateInput, now);
        }
        if (validityDaysInput && !validityDaysInput.value) {
            validityDaysInput.value = '30';
        }
    }

    async function boot({ root }) {
        modelRoot = `${root}/Model`;
        setStatusChip('draft');
        updateBackLink();
        tickClock();
        setInterval(tickClock, 1000);
        bindEvents();
        initializeStaticFields();
        await fetchSessionUser();
        await loadRequestDetail();
    }

    if (typeof window.onAppReady === 'function') {
        window.onAppReady(boot);
    }
})();
