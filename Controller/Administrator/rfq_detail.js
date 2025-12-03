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
    const statusDescription = document.getElementById('rfqStatusDescription');
    const statusSelect = document.getElementById('rfqStatusSelect');
    const statusActions = document.getElementById('rfqStatusActions');
    const confirmRfqButton = document.getElementById('confirmRfqButton');
    const returnDraftButton = document.getElementById('rfqReturnDraftButton');
    const cancelRfqButton = document.getElementById('cancelRfqButton');
    const updatedAtDisplay = document.getElementById('rfqUpdatedAt');
    const updatedByDisplay = document.getElementById('rfqUpdatedBy');
    const createdAtDisplay = document.getElementById('rfqCreatedAt');
    const createdByDisplay = document.getElementById('rfqCreatedBy');
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
    const rfqIdInput = document.getElementById('rfqSupplierRfqId');
    const rfqAuditList = document.getElementById('rfqAuditList');
    const rfqAuditEmpty = document.getElementById('rfqAuditEmpty');
    const rfqAuditLink = document.getElementById('rfqAuditLink');

    const unsavedBanner = document.getElementById('unsavedBanner');
    const unsavedModal = document.getElementById('unsavedModal');
    const btnDiscardChanges = document.getElementById('btnDiscardChanges');
    const btnSaveInline = document.getElementById('btnSaveInline');
    const btnModalStay = document.getElementById('btnModalStay');
    const btnModalDiscard = document.getElementById('btnModalDiscard');
    const btnModalSave = document.getElementById('btnModalSave');

    let modelRoot = '';
    let requestId = initialRequestId ? String(initialRequestId) : '';
    let eventId = initialEventId ? String(initialEventId) : '';
    let rfqId = params.get('rfq_id') ? String(params.get('rfq_id')) : '';
    let requestInfo = null;
    let rfqInfo = null;
    let eventInfo = null;
    let staffInfo = null;
    let isHydrating = false;
    let isDirty = false;
    let isSaving = false;
    let initialSnapshot = null;
    let pendingNavigationAction = null;

    if (unsavedModal) {
        unsavedModal.setAttribute('aria-hidden', unsavedModal.hidden ? 'true' : 'false');
    }

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

    function updateSaveButtonState() {
        const disable = isSaving || !isDirty;
        if (saveButton) {
            saveButton.disabled = disable;
        }
        if (btnSaveInline) {
            btnSaveInline.disabled = disable;
        }
    }

    function setDirty(next) {
        const nextState = Boolean(next);
        if (isDirty === nextState) {
            updateSaveButtonState();
            return;
        }
        isDirty = nextState;
        if (unsavedBanner) {
            if (isDirty) {
                unsavedBanner.hidden = false;
                requestAnimationFrame(() => {
                    unsavedBanner.classList.add('is-active');
                });
            } else {
                if (!unsavedBanner.classList.contains('is-active')) {
                    unsavedBanner.hidden = true;
                } else {
                    unsavedBanner.classList.remove('is-active');
                    const handleTransitionEnd = (event) => {
                        if (event.propertyName === 'transform') {
                            unsavedBanner.hidden = true;
                            unsavedBanner.removeEventListener('transitionend', handleTransitionEnd);
                        }
                    };
                    unsavedBanner.addEventListener('transitionend', handleTransitionEnd);
                }
            }
        }
        updateSaveButtonState();
    }

    function openUnsavedModal() {
        if (!unsavedModal) return;
        unsavedModal.hidden = false;
        unsavedModal.setAttribute('aria-hidden', 'false');
    }

    function closeUnsavedModal() {
        if (!unsavedModal) return;
        unsavedModal.hidden = true;
        unsavedModal.setAttribute('aria-hidden', 'true');
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

    function captureFormSnapshot() {
        return {
            title: (titleInput?.value || '').trim(),
            ref_id: (refIdInput?.value || '').trim(),
            staff_id: staffIdInput?.value || '',
            contact_person: contactPersonInput?.value || '',
            deliver_to: deliverToInput?.value || '',
            request_date: requestDateInput?.value || '',
            validity_days: validityDaysInput?.value || '',
            due_date: dueDateInput?.value || '',
            order_date: orderDateInput?.value || '',
            order_deadline: orderDeadlineInput?.value || '',
            expected_arrival: expectedArrivalInput?.value || '',
            payment_term: paymentTermSelect?.value || '',
            payment_method: paymentMethodSelect?.value || '',
            note: (noteInput?.value || '').trim(),
            status: normalizeStatus(statusSelect?.value),
        };
    }

    function restoreSnapshot(snapshot) {
        if (!snapshot) return;
        isHydrating = true;
        if (titleInput) titleInput.value = snapshot.title || '';
        if (refIdInput) refIdInput.value = snapshot.ref_id || '';
        if (staffIdInput) staffIdInput.value = snapshot.staff_id || '';
        if (contactPersonInput) contactPersonInput.value = snapshot.contact_person || '';
        if (deliverToInput) deliverToInput.value = snapshot.deliver_to || '';
        if (requestDateInput) requestDateInput.value = snapshot.request_date || '';
        if (validityDaysInput) validityDaysInput.value = snapshot.validity_days || '';
        if (dueDateInput) dueDateInput.value = snapshot.due_date || '';
        if (orderDateInput) orderDateInput.value = snapshot.order_date || '';
        if (orderDeadlineInput) orderDeadlineInput.value = snapshot.order_deadline || '';
        if (expectedArrivalInput) expectedArrivalInput.value = snapshot.expected_arrival || '';
        if (paymentTermSelect) paymentTermSelect.value = snapshot.payment_term || '30D';
        if (paymentMethodSelect) paymentMethodSelect.value = snapshot.payment_method || 'bank';
        if (noteInput) noteInput.value = snapshot.note || '';
        setStatusChip(snapshot.status || 'draft');
        isHydrating = false;
        setDirty(false);
    }

    function refreshSnapshot() {
        initialSnapshot = captureFormSnapshot();
        setDirty(false);
    }

    function markDirtyIfReady() {
        if (isHydrating) return;
        setDirty(true);
    }

    function requestNavigation(action) {
        if (!isDirty) {
            action();
            return;
        }
        pendingNavigationAction = action;
        openUnsavedModal();
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
        const linesFromRfq = Array.isArray(rfqInfo?.lines)
            ? rfqInfo.lines.map((line) => ({
                  item_id: line.item_id ?? line.rfq_line_id ?? null,
                  item_name: line.item_name || line.item_desc || '',
                  item_reference: line.item_reference || line.item_desc || '',
                  item_uom: line.uom || '',
                  requested_quantity: line.quantity_requested ?? line.quantity ?? 0,
                  fulfilled_quantity: 0,
                  missing_quantity: line.quantity_requested ?? line.quantity ?? 0,
              }))
            : [];
        if (linesFromRfq.length > 0) {
            return linesFromRfq;
        }

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

    function formatAuditAction(action) {
        const normalized = typeof action === 'string' ? action.trim().toUpperCase() : '';
        const mapping = {
            CREATE: 'สร้าง RFQ',
            UPDATE: 'ปรับปรุง RFQ',
            ARCHIVE: 'เก็บเอกสาร',
            UNARCHIVED: 'นำกลับมาใช้',
            DELETE: 'ลบเอกสาร',
        };
        return mapping[normalized] || normalized || 'ไม่ระบุการทำรายการ';
    }

    function resolveAuditActorLabel(log) {
        if (log?.action_by_label && typeof log.action_by_label === 'string' && log.action_by_label.trim()) {
            return log.action_by_label.trim();
        }
        if (log?.action_by_name && typeof log.action_by_name === 'string' && log.action_by_name.trim()) {
            return log.action_by_name.trim();
        }
        if (log?.action_by_id !== undefined && log.action_by_id !== null) {
            const id = Number.parseInt(log.action_by_id, 10);
            if (Number.isFinite(id)) {
                return `Staff#${id}`;
            }
        }
        return 'ไม่ระบุผู้ปฏิบัติ';
    }

    function sortAuditLogs(logs = []) {
        return logs
            .filter((log) => log && typeof log === 'object')
            .slice()
            .sort((a, b) => {
                const dateA = new Date(a?.action_at || 0).getTime();
                const dateB = new Date(b?.action_at || 0).getTime();
                if (Number.isNaN(dateA) && Number.isNaN(dateB)) return 0;
                if (Number.isNaN(dateA)) return 1;
                if (Number.isNaN(dateB)) return -1;
                return dateB - dateA;
            });
    }

    function formatAuditSummary(log) {
        const parts = [];
        parts.push(formatAuditAction(log?.action));
        parts.push(resolveAuditActorLabel(log));
        const timestamp = formatDateTime(log?.action_at);
        if (timestamp && timestamp !== '—') {
            parts.push(timestamp);
        }
        if (log?.reason) {
            parts.push(log.reason);
        }
        return parts.join(' • ');
    }

    function renderAuditLogs(logs) {
        if (!rfqAuditList || !rfqAuditEmpty) return;
        rfqAuditList.innerHTML = '';
        const [latest] = sortAuditLogs(Array.isArray(logs) ? logs : []);
        const hasEntry = Boolean(latest);
        rfqAuditList.hidden = !hasEntry;
        rfqAuditEmpty.hidden = hasEntry;
        if (!hasEntry) return;
        const entry = document.createElement('p');
        entry.className = 'request-audit-entry';
        entry.textContent = formatAuditSummary(latest);
        rfqAuditList.appendChild(entry);
    }

    function updateAuditLink() {
        if (!rfqAuditLink) return;
        if (!rfqId) {
            rfqAuditLink.hidden = true;
            rfqAuditLink.setAttribute('aria-hidden', 'true');
            rfqAuditLink.removeAttribute('href');
            return;
        }
        const url = new URL('./audit_log.html', window.location.href);
        url.searchParams.set('entity_type', 'rfq');
        url.searchParams.set('entity_id', rfqId);
        if (eventId) {
            url.searchParams.set('event_id', eventId);
        }
        const returnUrl = new URL(window.location.href);
        url.searchParams.set('return_to', `${returnUrl.pathname}${returnUrl.search}`);

        rfqAuditLink.hidden = false;
        rfqAuditLink.removeAttribute('aria-hidden');
        rfqAuditLink.href = `${url.pathname}${url.search}`;
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

    function applyAuditInfo(info) {
        if (!info) return;
        if (createdAtDisplay) {
            createdAtDisplay.textContent = formatDateTime(info.created_at);
        }
        if (updatedAtDisplay) {
            updatedAtDisplay.textContent = formatDateTime(info.updated_at || info.created_at);
        }
        if (createdByDisplay) {
            createdByDisplay.textContent = info.created_by_label || '—';
        }
        if (updatedByDisplay) {
            updatedByDisplay.textContent = info.updated_by_label || '—';
        }
    }

    function applyRfqInfo(payload) {
        rfqInfo = payload || null;
        if (!rfqInfo) return;
        isHydrating = true;
        if (rfqInfo.supplier_rfq_id) {
            rfqId = String(rfqInfo.supplier_rfq_id);
            if (rfqIdInput) {
                rfqIdInput.value = rfqId;
            }
        }
        if (refIdInput && rfqInfo.ref_supplier_rfq_id) {
            refIdInput.value = rfqInfo.ref_supplier_rfq_id;
        }
        setStatusChip(rfqInfo.status || 'draft');
        setPageTitle(rfqInfo.title || rfqInfo.event?.event_name);
        if (titleInput && rfqInfo.title) {
            titleInput.value = rfqInfo.title;
        }
        if (staffIdInput && rfqInfo.staff_id) {
            staffIdInput.value = String(rfqInfo.staff_id);
        }
        if (contactPersonInput && rfqInfo.contact_person) {
            contactPersonInput.value = String(rfqInfo.contact_person);
        }
        if (deliverToInput && rfqInfo.deliver_to) {
            deliverToInput.value = String(rfqInfo.deliver_to);
        }
        if (noteInput && rfqInfo.note) {
            noteInput.value = rfqInfo.note;
        }
        if (paymentTermSelect && rfqInfo.payment_term) {
            paymentTermSelect.value = rfqInfo.payment_term;
        }
        if (paymentMethodSelect && rfqInfo.payment_method) {
            paymentMethodSelect.value = rfqInfo.payment_method;
        }
        setDateTimeInputValue(requestDateInput, rfqInfo.rfq_request_date);
        setDateTimeInputValue(dueDateInput, rfqInfo.rfq_due_date);
        setDateTimeInputValue(orderDateInput, rfqInfo.order_date);
        setDateTimeInputValue(orderDeadlineInput, rfqInfo.order_deadline);
        setDateTimeInputValue(expectedArrivalInput, rfqInfo.order_expected_arrival);
        if (validityDaysInput && Number.isFinite(Number(rfqInfo.rfq_validity_days))) {
            validityDaysInput.value = String(rfqInfo.rfq_validity_days);
        }
        isHydrating = false;
        applyAuditInfo(rfqInfo);
        applyEventInfo(rfqInfo.event);
        setRequestReference(rfqInfo.ref_supplier_rfq_id || rfqInfo.request_reference || '—');
        renderMissingLines();
        renderAuditLogs(rfqInfo.audit_logs || []);
        updateAuditLink();
        refreshSnapshot();
    }

    function applyRequestInfo(payload) {
        requestInfo = payload || null;
        if (!requestInfo) {
            return;
        }
        isHydrating = true;
        if (requestInfo.request_id) {
            requestId = String(requestInfo.request_id);
        }
        setPageTitle(requestInfo.request_name);
        if (titleInput && !titleInput.value && requestInfo.request_name) {
            titleInput.value = `RFQ สำหรับ ${requestInfo.request_name}`;
        }
        isHydrating = false;
        setRequestReference(requestInfo.reference);
        applyEventInfo(requestInfo.event);
        renderMissingLines();
        refreshSnapshot();
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

    async function loadRfqDetail() {
        if (!rfqId) return;
        try {
            const response = await fetch(`${modelRoot}/supplier_rfq_detail.php?rfq_id=${encodeURIComponent(rfqId)}`, {
                credentials: 'same-origin',
            });
            if (!response.ok) {
                throw new Error('ไม่สามารถโหลดข้อมูล RFQ ได้');
            }
            const data = await response.json();
            applyRfqInfo(data?.data);
        } catch (error) {
            setGlobalMessage('โหลดข้อมูล RFQ ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง', 'error');
        }
    }

    function buildSavePayload() {
        const missing = buildMissingLines();
        return {
            supplier_rfq_id: rfqId ? Number(rfqId) : null,
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
            status: normalizeStatus(statusSelect?.value),
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
        if (!payload.event_id) {
            setGlobalMessage('ไม่พบข้อมูลอ้างอิงอีเว้น', 'error');
            return false;
        }
        if (!rfqId && !payload.request_id) {
            setGlobalMessage('ไม่พบข้อมูลคำขอที่เกี่ยวข้อง', 'error');
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

    function normalizeStatus(status) {
        const normalized = typeof status === 'string' && status.trim() !== '' ? status.trim().toLowerCase() : 'draft';
        const synonyms = {
            approved: 'completed',
            complete: 'completed',
            confirmed: 'completed',
        };
        const mapped = synonyms[normalized] || normalized;
        const allowed = ['draft', 'completed', 'cancelled'];
        return allowed.includes(mapped) ? mapped : 'draft';
    }

    function updateStatusDescription(status) {
        if (!statusDescription) return;
        const normalized = normalizeStatus(status);
        const message =
            normalized === 'completed'
                ? 'RFQ นี้ถูกยืนยันแล้ว สามารถย้อนกลับเป็นร่างหรือยกเลิกได้'
                : normalized === 'cancelled'
                ? 'RFQ นี้ถูกยกเลิกแล้ว'
                : 'ปรับสถานะ RFQ เพื่อดำเนินการต่อ';
        statusDescription.textContent = message;
    }

    function updateStatusControls(status = 'draft') {
        const normalized = normalizeStatus(status);
        const isDraft = normalized === 'draft';
        const isCompleted = normalized === 'completed';
        const isCancelled = normalized === 'cancelled';

        if (statusSelect) {
            statusSelect.value = normalized;
        }
        if (statusActions) {
            statusActions.hidden = isCancelled;
        }
        if (confirmRfqButton) {
            confirmRfqButton.hidden = !isDraft;
            confirmRfqButton.setAttribute('aria-hidden', confirmRfqButton.hidden ? 'true' : 'false');
        }
        if (returnDraftButton) {
            returnDraftButton.hidden = !isCompleted;
            returnDraftButton.setAttribute('aria-hidden', returnDraftButton.hidden ? 'true' : 'false');
        }
        if (cancelRfqButton) {
            cancelRfqButton.hidden = isCancelled;
            cancelRfqButton.setAttribute('aria-hidden', cancelRfqButton.hidden ? 'true' : 'false');
        }
        updateStatusDescription(normalized);
    }

    function setStatusChip(status = 'draft') {
        const normalized = normalizeStatus(status);
        updateStatusControls(normalized);
        if (statusBadge) {
            statusBadge.dataset.status = normalized;
        }
        if (statusText) {
            const displayLabel =
                normalized === 'completed' ? 'ยืนยันแล้ว' : normalized === 'cancelled' ? 'ยกเลิก' : 'ร่าง';
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
            return false;
        }
        isSaving = true;
        updateSaveButtonState();
        try {
            const endpoint = rfqId ? 'supplier_rfq_update.php' : 'supplier_rfq_create.php';
            const response = await fetch(`${modelRoot}/${endpoint}`, {
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
                rfqId = String(data.data.supplier_rfq_id);
                if (rfqIdInput) {
                    rfqIdInput.value = rfqId;
                }
                const savedStatus = normalizeStatus(data?.data?.status || payload.status);
                setStatusChip(savedStatus);
                if (updatedAtDisplay) {
                    updatedAtDisplay.textContent = formatDateTime(new Date());
                }
                updateAuditLink();
            }
            setGlobalMessage('บันทึกคำขอใบเสนอราคาเรียบร้อย', 'success');
            refreshSnapshot();
            return true;
        } catch (error) {
            setGlobalMessage('บันทึก RFQ ไม่สำเร็จ กรุณาลองใหม่', 'error');
            return false;
        } finally {
            isSaving = false;
            updateSaveButtonState();
        }
    }

    function bindEvents() {
        if (backButton) {
            backButton.addEventListener('click', () => {
                requestNavigation(() => {
                    const targetUrl = backLink?.href || './event_document_manage.html';
                    window.location.href = targetUrl;
                });
            });
        }
        if (backLink) {
            backLink.addEventListener('click', (event) => {
                const targetHref = backLink.getAttribute('href');
                if (!targetHref || !isDirty) return;
                event.preventDefault();
                requestNavigation(() => {
                    window.location.href = targetHref;
                });
            });
        }
        if (statusSelect) {
            statusSelect.addEventListener('change', () => {
                setStatusChip(statusSelect.value);
                markDirtyIfReady();
            });
        }
        if (confirmRfqButton) {
            confirmRfqButton.addEventListener('click', () => {
                setStatusChip('completed');
                markDirtyIfReady();
            });
        }
        if (returnDraftButton) {
            returnDraftButton.addEventListener('click', () => {
                setStatusChip('draft');
                markDirtyIfReady();
            });
        }
        if (cancelRfqButton) {
            cancelRfqButton.addEventListener('click', () => {
                setStatusChip('cancelled');
                markDirtyIfReady();
            });
        }
        if (saveButton) {
            saveButton.addEventListener('click', async () => {
                await handleSave();
            });
        }
        if (btnSaveInline) {
            btnSaveInline.addEventListener('click', async () => {
                await handleSave();
            });
        }
        if (btnDiscardChanges) {
            btnDiscardChanges.addEventListener('click', () => {
                restoreSnapshot(initialSnapshot);
            });
        }
        if (btnModalStay) {
            btnModalStay.addEventListener('click', () => {
                pendingNavigationAction = null;
                closeUnsavedModal();
            });
        }
        if (btnModalDiscard) {
            btnModalDiscard.addEventListener('click', () => {
                restoreSnapshot(initialSnapshot);
                closeUnsavedModal();
                const action = pendingNavigationAction;
                pendingNavigationAction = null;
                if (action) action();
            });
        }
        if (btnModalSave) {
            btnModalSave.addEventListener('click', async () => {
                const saved = await handleSave();
                if (!saved) return;
                closeUnsavedModal();
                const action = pendingNavigationAction;
                pendingNavigationAction = null;
                if (action) action();
            });
        }
        const form = document.getElementById('rfqForm');
        if (form) {
            const controls = form.querySelectorAll('input, select, textarea');
            controls.forEach((control) => {
                control.addEventListener('input', markDirtyIfReady);
                control.addEventListener('change', markDirtyIfReady);
            });
        }
        window.addEventListener('beforeunload', (event) => {
            if (!isDirty) return;
            event.preventDefault();
            event.returnValue = '';
        });
    }

    function initializeStaticFields() {
        isHydrating = true;
        const now = new Date();
        if (requestDateInput && !requestDateInput.value) {
            setDateTimeInputValue(requestDateInput, now);
        }
        if (validityDaysInput && !validityDaysInput.value) {
            validityDaysInput.value = '30';
        }
        isHydrating = false;
        refreshSnapshot();
    }

    async function boot({ root }) {
        modelRoot = `${root}/Model`;
        setStatusChip('draft');
        updateSaveButtonState();
        updateBackLink();
        tickClock();
        setInterval(tickClock, 1000);
        bindEvents();
        initializeStaticFields();
        await fetchSessionUser();
        if (rfqId) {
            await loadRfqDetail();
        } else {
            await loadRequestDetail();
        }
    }

    if (typeof window.onAppReady === 'function') {
        window.onAppReady(boot);
    }
})();
