(function () {
    const params = new URLSearchParams(window.location.search);
    const initialEventId = params.get('event_id');
    const initialRequestId = params.get('request_id');

    const requestBackLink = document.getElementById('requestBackLink');
    const requestTitle = document.getElementById('requestTitle');
    const pageDate = document.getElementById('pageDate');
    const backButton = document.getElementById('btnBack');
    const saveButton = document.getElementById('btnSave');
    const globalMessage = document.getElementById('requestGlobalMessage');
    const eventDisplay = document.getElementById('eventDisplay');
    const eventCodeDisplay = document.getElementById('eventCodeDisplay');
    const eventDateDisplay = document.getElementById('eventDateDisplay');
    const statusBadge = document.getElementById('requestStatusBadge');
    const statusText = document.getElementById('requestStatusText');
    const updatedAtDisplay = document.getElementById('requestUpdatedAt');
    const updatedByDisplay = document.getElementById('requestUpdatedBy');
    const createdAtDisplay = document.getElementById('requestCreatedAt');
    const createdByDisplay = document.getElementById('requestCreatedBy');
    const requestForm = document.getElementById('requestForm');
    const requestNameInput = document.getElementById('requestNameInput');
    const requestStatusSelect = document.getElementById('requestStatusSelect');
    const submitRequestButton = document.getElementById('submitRequestButton');
    const resetDraftButton = document.getElementById('resetDraftButton');
    const cancelRequestButton = document.getElementById('cancelRequestButton');
    const reviewRequestButton = document.getElementById('reviewRequestButton');
    const requestStatusDescription = document.getElementById('requestStatusDescription');
    const requestFormMessage = document.getElementById('requestFormMessage');
    const requestInfoMessage = document.getElementById('requestInfoMessage');
    const requestReference = document.getElementById('requestReference');
    const requestLinesBody = document.getElementById('requestLinesBody');
    const requestLinesEmpty = document.getElementById('requestLinesEmpty');
    const requestLinesFilterEmpty = document.getElementById('requestLinesFilterEmpty');
    const requestLinesSearch = document.getElementById('requestLinesSearch');
    const addRequestLineButton = document.getElementById('addRequestLine');
    const unsavedBanner = document.getElementById('unsavedBanner');
    const inlineSaveButton = document.getElementById('btnSaveInline');
    const discardChangesButton = document.getElementById('btnDiscardChanges');
    const requestAuditList = document.getElementById('requestAuditList');
    const requestAuditEmpty = document.getElementById('requestAuditEmpty');
    const requestAuditLink = document.getElementById('requestAuditLink');

    let modelRoot = '';
    let eventId = initialEventId ? String(initialEventId) : '';
    let requestId = initialRequestId ? String(initialRequestId) : '';
    let eventInfo = null;
    let requestInfo = null;
    let isSaving = false;
    let isDatasetLoaded = false;
    let requestLineCounter = 0;
    const itemSearchCache = new Map();
    let backTarget = './event_document_manage.html';
    let isDirty = false;
    let isPopulating = false;
    let lastSnapshot = { request_name: '', status: 'draft', lines: [] };
    let hasValidationError = false;

    const allowedStatuses = ['draft', 'submitted', 'pending', 'approved', 'closed', 'cancelled'];

    function normalizeStatus(value) {
        const text = typeof value === 'string' ? value.trim().toLowerCase() : '';
        return allowedStatuses.includes(text) ? text : 'draft';
    }

    function cloneLine(line) {
        if (!line || typeof line !== 'object') {
            return null;
        }
        return {
            request_line_id: line.request_line_id ?? null,
            item_id: line.item_id ?? line.id ?? null,
            item_name: line.item_name ?? line.name ?? '',
            item_reference: line.item_reference ?? line.ref_id ?? '',
            item_rate: line.item_rate ?? line.rate ?? null,
            item_period: line.item_period ?? line.period ?? '',
            item_uom: line.item_uom ?? line.uom ?? '',
            category_name: line.category_name ?? '',
            brand: line.brand ?? '',
            model: line.model ?? '',
            quantity: Number.isFinite(Number(line.quantity)) ? Number(line.quantity) : 0,
            note: line.note ?? '',
        };
    }

    function createSnapshotFromPayload(payload = {}) {
        const status = normalizeStatus(payload.status);
        const lines = Array.isArray(payload.lines)
            ? payload.lines
                  .map((line) => cloneLine(line))
                  .filter((line) => line && Number.isFinite(line.item_id))
            : [];
        return {
            request_name: typeof payload.request_name === 'string' ? payload.request_name : '',
            status,
            lines,
        };
    }

    function runWithPopulation(fn) {
        const prev = isPopulating;
        isPopulating = true;
        try {
            fn();
        } finally {
            isPopulating = prev;
        }
    }

    function updateSaveButtonState() {
        const shouldDisable = isSaving || !isDirty || hasValidationError;
        if (saveButton) {
            saveButton.disabled = shouldDisable;
            if (shouldDisable) {
                saveButton.setAttribute('aria-disabled', 'true');
            } else {
                saveButton.removeAttribute('aria-disabled');
            }
        }
        if (inlineSaveButton) {
            inlineSaveButton.disabled = shouldDisable;
            if (shouldDisable) {
                inlineSaveButton.setAttribute('aria-disabled', 'true');
            } else {
                inlineSaveButton.removeAttribute('aria-disabled');
            }
        }
    }

    function setDirtyState(next) {
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

    function markDirty() {
        if (!isDatasetLoaded || isPopulating) {
            return;
        }
        setDirtyState(true);
    }

    function handleBeforeUnload(event) {
        if (!isDirty) {
            return;
        }
        event.preventDefault();
        event.returnValue = '';
    }

    function restoreSnapshot(snapshot) {
        if (!snapshot) {
            return;
        }
        runWithPopulation(() => {
            if (requestNameInput) {
                requestNameInput.value = snapshot.request_name || '';
            }
            const status = normalizeStatus(snapshot.status);
            syncStatusUI(status);
            resetRequestLines(snapshot.lines.map((line) => ({ ...line })));
        });
        updateTitle();
        setDirtyState(false);
    }

    function formatEventCode(value) {
        if (value === null || value === undefined) {
            return null;
        }
        const text = String(value).trim();
        if (!text) {
            return null;
        }
        return text.startsWith('EV-') ? text : `EV-${text}`;
    }

    function updateThaiDate() {
        if (!pageDate) {
            return; // Exit if pageDate element is not found
        }
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
        pageDate.textContent = `วัน${day}ที่ ${date} ${month} ${year} เวลา ${time}`; // Update the text content
    }

    function formatDateTime(value) {
        if (!value) {
            return '—';
        }
        const dt = new Date(value);
        if (Number.isNaN(dt.getTime())) {
            return '—';
        }
        const day = dt.getDate();
        const monthNames = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
        const month = monthNames[dt.getMonth()];
        const year = dt.getFullYear() + 543;
        const time = dt.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false });
        return `${day} ${month} ${year} • ${time}`;
    }

    function formatDateRange(start, end) {
        if (!start && !end) {
            return '—';
        }
        const startDate = start ? new Date(start) : null;
        const endDate = end ? new Date(end) : null;
        const monthNames = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
        if (startDate && !Number.isNaN(startDate.getTime()) && endDate && !Number.isNaN(endDate.getTime())) {
            const startText = `${startDate.getDate()} ${monthNames[startDate.getMonth()]} ${startDate.getFullYear() + 543}`;
            const endText = `${endDate.getDate()} ${monthNames[endDate.getMonth()]} ${endDate.getFullYear() + 543}`;
            return `${startText} - ${endText}`;
        }
        if (startDate && !Number.isNaN(startDate.getTime())) {
            return `${startDate.getDate()} ${monthNames[startDate.getMonth()]} ${startDate.getFullYear() + 543}`;
        }
        if (endDate && !Number.isNaN(endDate.getTime())) {
            return `${endDate.getDate()} ${monthNames[endDate.getMonth()]} ${endDate.getFullYear() + 543}`;
        }
        return '—';
    }

    function formatAuditAction(action) {
        const normalized = typeof action === 'string' ? action.trim().toUpperCase() : '';
        const actionMap = {
            CREATE: 'สร้างคำขอ',
            UPDATE: 'ปรับปรุงคำขอ',
            ARCHIVE: 'เก็บคำขอ',
            UNARCHIVED: 'นำคำขอกลับมาใช้',
            DELETE: 'ลบคำขอ',
        };
        return actionMap[normalized] || (normalized || 'ไม่ระบุการทำรายการ');
    }

    function resolveAuditActorLabel(log) {
        if (log?.action_by_label && typeof log.action_by_label === 'string') {
            const normalized = log.action_by_label.trim();
            if (normalized) {
                return normalized;
            }
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
        if (!requestAuditList || !requestAuditEmpty) {
            return;
        }
        requestAuditList.innerHTML = '';
        const [latest] = sortAuditLogs(Array.isArray(logs) ? logs : []);
        const hasEntry = Boolean(latest);
        requestAuditList.hidden = !hasEntry;
        requestAuditEmpty.hidden = hasEntry;
        if (!hasEntry) {
            return;
        }
        const entry = document.createElement('p');
        entry.className = 'request-audit-entry';
        entry.textContent = formatAuditSummary(latest);
        requestAuditList.appendChild(entry);
    }

    function updateAuditLink() {
        if (!requestAuditLink) {
            return;
        }
        if (!requestId) {
            requestAuditLink.hidden = true;
            requestAuditLink.setAttribute('aria-hidden', 'true');
            requestAuditLink.removeAttribute('href');
            return;
        }
        const url = new URL('./audit_log.html', window.location.href);
        url.searchParams.set('entity_type', 'request');
        url.searchParams.set('entity_id', requestId);
        if (eventId) {
            url.searchParams.set('event_id', eventId);
        }

        const returnUrl = new URL(window.location.href);
        url.searchParams.set('return_to', `${returnUrl.pathname}${returnUrl.search}`);

        requestAuditLink.hidden = false;
        requestAuditLink.removeAttribute('aria-hidden');
        requestAuditLink.href = `${url.pathname}${url.search}`;
    }

    function setGlobalMessage(message, variant = 'info') {
        if (!globalMessage) {
            return;
        }
        const normalized = typeof message === 'string' ? message.trim() : '';
        globalMessage.classList.remove('success', 'error', 'info');
        if (!normalized) {
            globalMessage.hidden = true;
            globalMessage.textContent = '';
            return;
        }
        globalMessage.hidden = false;
        globalMessage.textContent = normalized;
        if (variant === 'success') {
            globalMessage.classList.add('success');
        } else if (variant === 'error') {
            globalMessage.classList.add('error');
        } else {
            globalMessage.classList.add('info');
        }
    }

    function clearGlobalMessage() {
        setGlobalMessage('');
    }

    function setRequestInfoMessage(message, variant = 'info') {
        if (!requestInfoMessage) {
            return;
        }
        const normalized = typeof message === 'string' ? message.trim() : '';
        requestInfoMessage.classList.remove('success', 'error', 'info');
        if (!normalized) {
            requestInfoMessage.hidden = true;
            requestInfoMessage.textContent = '';
            return;
        }
        requestInfoMessage.hidden = false;
        requestInfoMessage.textContent = normalized;
        if (variant === 'success') {
            requestInfoMessage.classList.add('success');
        } else if (variant === 'error') {
            requestInfoMessage.classList.add('error');
        } else {
            requestInfoMessage.classList.add('info');
        }
    }

    function setFormMessage(message, variant = 'error') {
        if (!requestFormMessage) {
            return;
        }
        const normalized = typeof message === 'string' ? message.trim() : '';
        requestFormMessage.classList.remove('success', 'error');
        if (!normalized) {
            requestFormMessage.hidden = true;
            requestFormMessage.textContent = '';
            return;
        }
        requestFormMessage.hidden = false;
        requestFormMessage.textContent = normalized;
        if (variant === 'success') {
            requestFormMessage.classList.add('success');
        } else if (variant === 'error') {
            requestFormMessage.classList.add('error');
        }
    }

    function setSavingBusy(busy) {
        isSaving = Boolean(busy);
        if (addRequestLineButton) {
            addRequestLineButton.disabled = Boolean(busy);
        }
        updateSaveButtonState();
    }

    function resetFormMessages() {
        setFormMessage('');
        clearGlobalMessage();
    }

    function syncBackLink() {
        const targetEventId = eventInfo?.event_id || eventId;
        const fallback = './event_document_manage.html';
        backTarget = targetEventId
            ? `./event_document_manage.html?event_id=${encodeURIComponent(targetEventId)}`
            : fallback;
        if (requestBackLink) {
            requestBackLink.href = backTarget;
        }
    }

    function updateTitle() {
        if (!requestTitle) {
            return;
        }
        const name = requestNameInput?.value?.trim();
        const reference = requestInfo?.reference || requestInfo?.request_reference;
        if (name && reference) {
            requestTitle.textContent = `${name} (${reference})`;
            return;
        }
        if (name) {
            requestTitle.textContent = name;
            return;
        }
        if (reference) {
            requestTitle.textContent = `คำขอ ${reference}`;
            return;
        }
        requestTitle.textContent = requestId ? 'แก้ไขคำขอเบิกอุปกรณ์' : 'สร้างคำขอเบิกอุปกรณ์';
    }

    function updateStatusBadge(status) {
        const normalized = typeof status === 'string' ? status.toLowerCase() : '';
        if (statusBadge) {
            statusBadge.dataset.status = normalized || 'draft';
        }
        if (statusText) {
            const labels = {
                draft: 'สถานะ: ร่าง',
                submitted: 'สถานะ: ส่งคำขอ',
                pending: 'สถานะ: รอตรวจสอบ',
                approved: 'สถานะ: อนุมัติแล้ว',
                closed: 'สถานะ: ปิดคำขอ',
                cancelled: 'สถานะ: ยกเลิก',
            };
            statusText.textContent = labels[normalized] || `สถานะ: ${normalized || '—'}`;
        }
    }

    function updateStatusDescription(status) {
        const normalized = typeof status === 'string' ? status.toLowerCase() : '';
        if (!requestStatusDescription) {
            return;
        }
        const descriptions = {
            draft: 'ยังเป็นร่าง สามารถแก้ไขรายละเอียดหรือส่งคำขอได้',
            submitted: 'ส่งคำขอแล้ว รอการตรวจสอบหรือเลือกเปิดหน้าตรวจสอบ',
            pending: 'อยู่ระหว่างตรวจสอบ สามารถย้อนกลับเป็นร่างหรือยกเลิกได้',
            approved: 'คำขอได้รับการอนุมัติแล้ว',
            closed: 'คำขอปิดการดำเนินการแล้ว',
            cancelled: 'คำขอถูกยกเลิกและเก็บเป็นประวัติ',
        };
        requestStatusDescription.textContent = descriptions[normalized] || 'กำหนดสถานะคำขอเพื่อดำเนินการต่อ';
    }

    function updateStatusActions(status) {
        const normalized = normalizeStatus(status);
        const isDraft = normalized === 'draft';
        const isSubmitted = normalized === 'submitted';
        const isPending = normalized === 'pending';
        if (submitRequestButton) {
            submitRequestButton.hidden = !isDraft;
        }
        if (resetDraftButton) {
            resetDraftButton.hidden = !(isSubmitted || isPending);
        }
        if (reviewRequestButton) {
            reviewRequestButton.hidden = !isSubmitted;
        }
        if (cancelRequestButton) {
            cancelRequestButton.hidden = !(isDraft || isSubmitted || isPending);
        }
    }

    function syncStatusUI(status) {
        const normalized = normalizeStatus(status);
        if (requestStatusSelect) {
            requestStatusSelect.value = normalized;
        }
        updateStatusBadge(normalized);
        updateStatusDescription(normalized);
        updateStatusActions(normalized);
    }

    function formatItemDisplay(item) {
        if (!item) {
            return '';
        }
        const parts = [];
        if (item.ref_id) {
            parts.push(String(item.ref_id));
        }
        if (item.name) {
            parts.push(String(item.name));
        } else if (item.id) {
            parts.push(`สินค้า #${item.id}`);
        }
        const base = parts.length ? parts.join(' - ') : `สินค้า #${item.id ?? ''}`;
        return item.id ? `${base} (#${item.id})` : base;
    }

    async function searchItems(query) {
        const term = typeof query === 'string' ? query.trim() : '';
        if (!term) {
            return [];
        }
        const cacheKey = term.toLowerCase();
        if (itemSearchCache.has(cacheKey)) {
            return itemSearchCache.get(cacheKey);
        }
        if (!modelRoot) {
            return [];
        }
        try {
            const response = await fetch(`${modelRoot}/items_options.php?q=${encodeURIComponent(term)}`, {
                credentials: 'same-origin',
            });
            if (!response.ok) {
                throw new Error('search_failed');
            }
            const payload = await response.json();
            const results = Array.isArray(payload?.data) ? payload.data : [];
            itemSearchCache.set(cacheKey, results);
            return results;
        } catch (error) {
            console.error(error);
            return [];
        }
    }

    function collectSelectedItemIds(skipRow = null) {
        if (!requestLinesBody) {
            return new Set();
        }
        const ids = new Set();
        const rows = Array.from(requestLinesBody.querySelectorAll('.request-line-row'));
        rows.forEach((row) => {
            if (skipRow && row === skipRow) {
                return;
            }
            const input = row.querySelector('.request-line-item-id');
            const idValue = input ? Number.parseInt(input.value, 10) : Number.NaN;
            if (Number.isFinite(idValue) && idValue > 0) {
                ids.add(idValue);
            }
        });
        return ids;
    }

    function openInstantItemCreate() {
        const targetUrl = './item_manage.html?mode=create';
        const newWindow = window.open(targetUrl, '_blank', 'noopener');
        if (newWindow) {
            newWindow.focus();
            setGlobalMessage('เปิดหน้าสร้างสินค้าใหม่ในแท็บใหม่แล้ว', 'info');
        } else {
            setGlobalMessage('กำลังเปลี่ยนไปหน้าสร้างสินค้าใหม่', 'info');
            window.location.href = targetUrl;
        }
    }

    function formatItemOptionMeta(item) {
        if (!item) {
            return '';
        }
        const parts = [];
        if (item.category_name) {
            parts.push(item.category_name);
        }
        if (item.brand) {
            parts.push(item.brand);
        }
        if (item.model) {
            parts.push(item.model);
        }
        if (item.uom) {
            parts.push(`หน่วย: ${item.uom}`);
        }
        return parts.join(' • ');
    }

    function formatItemRateDisplay(item) {
        if (!item) {
            return '';
        }
        const rate = Number.parseFloat(item.rate);
        if (!Number.isFinite(rate) || rate <= 0) {
            return '';
        }
        return rate.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    }

    function formatItemRateMeta(item) {
        if (!item || !item.period) {
            return '';
        }
        return String(item.period);
    }

    function formatRequestLineMeta(item) {
        if (!item) {
            return '';
        }
        const parts = [];
        if (item.category_name) {
            parts.push(item.category_name);
        }
        if (item.brand) {
            parts.push(item.brand);
        }
        if (item.model) {
            parts.push(item.model);
        }
        return parts.join(' • ');
    }

    function createRequestItemTypeahead({ initialItem = null, onSelect = () => {}, onClear = () => {}, filterResults = null } = {}) {
        const root = document.createElement('div');
        root.className = 'typeahead';
        const input = document.createElement('input');
        input.type = 'search';
        input.placeholder = 'ค้นหาสินค้าหรือรหัสสินค้า';
        input.autocomplete = 'off';
        input.className = 'request-line-input';
        const hiddenInput = document.createElement('input');
        hiddenInput.type = 'hidden';
        hiddenInput.className = 'request-line-item-id';
        const list = document.createElement('div');
        list.className = 'typeahead-list';
        list.hidden = true;
        const inputWrap = document.createElement('div');
        inputWrap.className = 'typeahead-input request-line-typeahead';
        const icon = document.createElement('span');
        icon.className = 'request-line-typeahead-icon';
        inputWrap.append(icon, input);
        root.append(inputWrap, hiddenInput, list);

        let fetchToken = 0;
        let selectedItem = null;

        function closeList() {
            list.hidden = true;
        }

        function notifySelect(item) {
            selectedItem = item;
            if (typeof onSelect === 'function') {
                onSelect(item);
            }
        }

        function notifyClear() {
            selectedItem = null;
            if (typeof onClear === 'function') {
                onClear();
            }
        }

        function applySelection(item) {
            if (item) {
                hiddenInput.value = item.id ? String(item.id) : '';
                input.value = formatItemDisplay(item);
                notifySelect(item);
            } else {
                hiddenInput.value = '';
                notifyClear();
            }
        }

        function buildOption(item) {
            const option = document.createElement('button');
            option.type = 'button';
            option.className = 'typeahead-option';
            const title = document.createElement('span');
            title.className = 'typeahead-option-title';
            title.textContent = formatItemDisplay(item);
            const meta = document.createElement('span');
            meta.className = 'typeahead-option-meta';
            meta.textContent = formatItemOptionMeta(item);
            option.append(title, meta);
            option.addEventListener('click', () => {
                applySelection(item);
                closeList();
            });
            return option;
        }

        function renderList(items) {
            list.innerHTML = '';
            const fragment = document.createDocumentFragment();
            items.forEach((item) => {
                fragment.append(buildOption(item));
            });
            const createOption = document.createElement('button');
            createOption.type = 'button';
            createOption.className = 'typeahead-option typeahead-option-create';
            createOption.textContent = '➕ สร้างสินค้าใหม่';
            createOption.addEventListener('click', () => {
                closeList();
                openInstantItemCreate();
            });
            fragment.append(createOption);
            list.append(fragment);
            list.hidden = list.children.length === 0;
        }

        input.addEventListener('input', (event) => {
            const term = event.target.value.trim();
            if (term.length < 1) {
                applySelection(null);
                closeList();
                return;
            }
            applySelection(null);
            const currentToken = ++fetchToken;
            searchItems(term).then((results) => {
                if (currentToken !== fetchToken) {
                    return;
                }
                const filtered = typeof filterResults === 'function' ? filterResults(results) : results;
                renderList(filtered);
                if (list.children.length) {
                    list.hidden = false;
                }
            });
        });

        input.addEventListener('focus', () => {
            if (list.children.length) {
                list.hidden = false;
            }
        });

        input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                if (!list.hidden) {
                    const firstOption = list.querySelector('.typeahead-option');
                    if (firstOption) {
                        event.preventDefault();
                        firstOption.click();
                    }
                }
            } else if (event.key === 'Escape') {
                closeList();
            }
        });

        root.addEventListener('focusout', (event) => {
            if (!root.contains(event.relatedTarget)) {
                closeList();
            }
        });

        function getSelectedItem() {
            return selectedItem;
        }

        if (initialItem) {
            applySelection(initialItem);
        } else {
            notifyClear();
        }

        return {
            root,
            input,
            hiddenInput,
            closeList,
            getSelectedItem,
        };
    }

    function applyDuplicateValidation(row, itemCounts) {
        const itemIdInput = row.querySelector('.request-line-item-id');
        const itemIdValue = itemIdInput ? Number.parseInt(itemIdInput.value, 10) : Number.NaN;
        const isDuplicate = Number.isFinite(itemIdValue) && itemCounts.get(itemIdValue) > 1;
        const typeaheadField = row.querySelector('.request-line-typeahead');
        const duplicateHint = row.querySelector('.request-line-duplicate');
        if (typeaheadField) {
            typeaheadField.classList.toggle('has-error', isDuplicate);
            if (isDuplicate) {
                typeaheadField.setAttribute('aria-invalid', 'true');
            } else {
                typeaheadField.removeAttribute('aria-invalid');
            }
        }
        if (duplicateHint) {
            duplicateHint.hidden = !isDuplicate;
        }
        row.classList.toggle('has-duplicate', isDuplicate);
        return isDuplicate;
    }

    function applyQuantityValidation(row) {
        const quantityField = row.querySelector('.request-line-qty-field');
        const quantityInput = row.querySelector('.request-line-quantity');
        const quantityError = row.querySelector('.request-line-qty-error');
        const raw = quantityInput ? quantityInput.value.trim() : '';
        const numeric = raw === '' ? Number.NaN : Number(raw);
        const isLarge = Number.isFinite(numeric) && numeric > 1000;
        let hasError = false;
        let message = '';
        if (raw === '' || Number.isNaN(numeric)) {
            hasError = true;
            message = 'กรุณากรอกจำนวนเป็นตัวเลขจำนวนเต็ม';
        } else if (!Number.isInteger(numeric)) {
            hasError = true;
            message = 'จำนวนต้องเป็นจำนวนเต็มเท่านั้น';
        } else if (numeric < 0 || numeric > 1_000_000) {
            hasError = true;
            message = 'จำนวนต้องอยู่ระหว่าง 0 - 1,000,000';
        }

        if (quantityField) {
            quantityField.classList.toggle('has-error', hasError);
            quantityField.classList.toggle('is-large', isLarge);
        }
        if (quantityInput) {
            if (hasError) {
                quantityInput.setAttribute('aria-invalid', 'true');
            } else {
                quantityInput.removeAttribute('aria-invalid');
            }
        }
        if (quantityError) {
            quantityError.textContent = message;
            quantityError.hidden = !hasError;
        }
        return hasError;
    }

    function updateValidationState() {
        const rows = Array.from(requestLinesBody?.querySelectorAll('.request-line-row') || []);
        const itemCounts = new Map();
        rows.forEach((row) => {
            const itemIdInput = row.querySelector('.request-line-item-id');
            const itemIdValue = itemIdInput ? Number.parseInt(itemIdInput.value, 10) : Number.NaN;
            if (Number.isFinite(itemIdValue) && itemIdValue > 0) {
                itemCounts.set(itemIdValue, (itemCounts.get(itemIdValue) || 0) + 1);
            }
        });
        let hasError = false;
        rows.forEach((row) => {
            const qtyError = applyQuantityValidation(row);
            const duplicateError = applyDuplicateValidation(row, itemCounts);
            if (qtyError || duplicateError) {
                hasError = true;
            }
        });
        hasValidationError = hasError;
        updateSaveButtonState();
        return hasError;
    }

    function buildRowSearchText(row) {
        const parts = [];
        const itemIdInput = row.querySelector('.request-line-item-id');
        const itemInput = row.querySelector('.request-line-input');
        const meta = row.querySelector('.request-line-meta');
        const noteInput = row.querySelector('.request-line-note');
        if (itemIdInput?.value) {
            parts.push(itemIdInput.value);
        }
        if (itemInput?.value) {
            parts.push(itemInput.value);
        }
        if (meta && !meta.hidden && meta.textContent) {
            parts.push(meta.textContent);
        }
        if (noteInput?.value) {
            parts.push(noteInput.value);
        }
        return parts.join(' ').toLowerCase();
    }

    function applyRequestLinesFilter() {
        const rows = Array.from(requestLinesBody?.querySelectorAll('.request-line-row') || []);
        const term = requestLinesSearch?.value?.trim().toLowerCase() || '';
        let visibleCount = 0;
        rows.forEach((row) => {
            if (!term) {
                row.hidden = false;
                visibleCount += 1;
                return;
            }
            const haystack = buildRowSearchText(row);
            const matches = haystack.includes(term);
            row.hidden = !matches;
            if (matches) {
                visibleCount += 1;
            }
        });
        const hasAnyRow = rows.length > 0;
        if (requestLinesEmpty) {
            requestLinesEmpty.hidden = hasAnyRow;
        }
        if (requestLinesFilterEmpty) {
            requestLinesFilterEmpty.hidden = Boolean(!term || visibleCount > 0 || !hasAnyRow);
        }
    }

    function updateRequestLinesEmpty() {
        if (!requestLinesEmpty) {
            return;
        }
        const hasRows = requestLinesBody && requestLinesBody.children.length > 0;
        requestLinesEmpty.hidden = hasRows;
        if (hasRows) {
            applyRequestLinesFilter();
        } else if (requestLinesFilterEmpty) {
            requestLinesFilterEmpty.hidden = true;
        }
    }

    function isLastRequestLineRow(row) {
        if (!row || !requestLinesBody) {
            return false;
        }
        return row.parentElement === requestLinesBody && !row.nextElementSibling;
    }

    function isRowReadyForAutoAdd(row) {
        if (!row) {
            return false;
        }
        const itemIdInput = row.querySelector('.request-line-item-id');
        const quantityInput = row.querySelector('.request-line-quantity');
        const itemIdValue = itemIdInput ? Number.parseInt(itemIdInput.value, 10) : Number.NaN;
        const quantityValue = quantityInput ? Number.parseInt(quantityInput.value, 10) : Number.NaN;
        return Number.isFinite(itemIdValue) && itemIdValue > 0 && Number.isFinite(quantityValue) && quantityValue > 0;
    }

    function addRequestLine(initial = null) {
        if (!requestLinesBody) {
            return null;
        }
        requestLineCounter += 1;
        const row = document.createElement('tr');
        row.className = 'request-line-row';
        row.dataset.lineId = String(requestLineCounter);
        if (Number.isFinite(initial?.request_line_id) && initial.request_line_id > 0) {
            row.dataset.requestLineId = String(initial.request_line_id);
        }

        const rateValue = document.createElement('span');
        rateValue.className = 'request-line-rate';
        rateValue.textContent = '—';

        const rateExtra = document.createElement('span');
        rateExtra.className = 'request-line-rate-meta';
        rateExtra.hidden = true;

        const itemMeta = document.createElement('p');
        itemMeta.className = 'request-line-meta';
        itemMeta.hidden = true;

        const initialItem =
            initial && initial.item_id
                ? {
                      id: initial.item_id,
                      name: initial.item_name || '',
                      ref_id: initial.item_reference || '',
                      rate: initial.rate ?? initial.item_rate ?? null,
                      period: initial.period ?? initial.item_period ?? '',
                      uom: initial.uom ?? initial.item_uom ?? '',
                      category_name: initial.category_name || initial.item_category || '',
                      brand: initial.brand || initial.item_brand || '',
                      model: initial.model || initial.item_model || '',
                  }
                : null;

        function updateItemMeta(item) {
            if (item && item.id) {
                const metaText = formatRequestLineMeta(item);
                if (metaText) {
                    itemMeta.textContent = metaText;
                    itemMeta.hidden = false;
                } else {
                    itemMeta.textContent = '';
                    itemMeta.hidden = true;
                }
                const rateText = formatItemRateDisplay(item);
                rateValue.textContent = rateText || '—';
                const rateMetaText = formatItemRateMeta(item);
                if (rateMetaText) {
                    rateExtra.textContent = rateMetaText;
                    rateExtra.hidden = false;
                } else {
                    rateExtra.textContent = '';
                    rateExtra.hidden = true;
                }
            } else {
                itemMeta.textContent = '';
                itemMeta.hidden = true;
                rateValue.textContent = '—';
                rateExtra.textContent = '';
                rateExtra.hidden = true;
            }
        }

        const itemCell = document.createElement('td');
        itemCell.className = 'request-line-cell request-line-item';
        const itemField = document.createElement('div');
        itemField.className = 'request-line-field';

        const requestLineIdInput = document.createElement('input');
        requestLineIdInput.type = 'hidden';
        requestLineIdInput.className = 'request-line-id';
        requestLineIdInput.value = row.dataset.requestLineId || '';

        const typeahead = createRequestItemTypeahead({
            initialItem,
            onSelect: (item) => {
                updateItemMeta(item);
                if (!isPopulating) {
                    markDirty();
                }
                updateValidationState();
                applyRequestLinesFilter();
            },
            onClear: () => {
                updateItemMeta(null);
                if (!isPopulating) {
                    markDirty();
                }
                updateValidationState();
                applyRequestLinesFilter();
            },
            filterResults: (results) => {
                const blockedIds = collectSelectedItemIds(row);
                return results.filter((item) => !blockedIds.has(item.id));
            },
        });

        const duplicateHint = document.createElement('p');
        duplicateHint.className = 'request-line-error request-line-duplicate';
        duplicateHint.textContent = 'มีสินค้านี้อยู่ในคำขอแล้ว';
        duplicateHint.hidden = true;

        itemField.append(requestLineIdInput, typeahead.root, itemMeta, duplicateHint);
        itemCell.append(itemField);

        const quantityCell = document.createElement('td');
        quantityCell.className = 'request-line-cell request-line-qty';
        const quantityField = document.createElement('div');
        quantityField.className = 'request-line-qty-field';
        const quantityInput = document.createElement('input');
        quantityInput.type = 'number';
        quantityInput.min = '0';
        quantityInput.max = '1000000';
        quantityInput.step = '1';
        quantityInput.placeholder = 'จำนวน';
        quantityInput.className = 'request-line-quantity';
        if (Number.isFinite(initial?.quantity) && initial.quantity >= 0) {
            quantityInput.value = String(initial.quantity);
        }
        if (!quantityInput.value) {
            quantityInput.value = '1';
        }
        const quantityError = document.createElement('p');
        quantityError.className = 'request-line-error request-line-qty-error';
        quantityError.hidden = true;
        quantityField.append(quantityInput, quantityError);
        quantityCell.appendChild(quantityField);

        const rateCell = document.createElement('td');
        rateCell.className = 'request-line-cell request-line-rate-cell';
        rateCell.append(rateValue, rateExtra);

        const noteCell = document.createElement('td');
        noteCell.className = 'request-line-cell request-line-note-cell';
        const noteInput = document.createElement('input');
        noteInput.type = 'text';
        noteInput.maxLength = 500;
        noteInput.placeholder = 'หมายเหตุ (ถ้ามี)';
        noteInput.className = 'request-line-note';
        if (initial?.note) {
            noteInput.value = String(initial.note);
        }
        noteCell.appendChild(noteInput);

        const actionCell = document.createElement('td');
        actionCell.className = 'col-actions request-line-actions';
        const removeButton = document.createElement('button');
        removeButton.type = 'button';
        removeButton.className = 'ghost request-line-remove';
        removeButton.innerHTML = '<span class="i trash"></span>';
        removeButton.setAttribute('aria-label', 'ลบรายการ');
        removeButton.addEventListener('click', () => {
            if (requestLinesBody && row.parentElement === requestLinesBody) {
                requestLinesBody.removeChild(row);
                updateRequestLinesEmpty();
                updateValidationState();
                applyRequestLinesFilter();
                if (!isPopulating) {
                    markDirty();
                }
            }
        });
        actionCell.appendChild(removeButton);

        row.append(itemCell, quantityCell, rateCell, noteCell, actionCell);
        requestLinesBody.appendChild(row);
        updateRequestLinesEmpty();
        applyRequestLinesFilter();

        typeahead.input.addEventListener('input', () => {
            if (!isPopulating) {
                markDirty();
            }
            updateValidationState();
            applyRequestLinesFilter();
        });

        const handleQuantityChange = () => {
            applyQuantityValidation(row);
            if (!isPopulating) {
                markDirty();
            }
            updateValidationState();
        };

        quantityInput.addEventListener('input', handleQuantityChange);
        quantityInput.addEventListener('change', handleQuantityChange);
        quantityInput.addEventListener('blur', () => {
            applyQuantityValidation(row);
            updateValidationState();
        });

        const handleAutoAdd = (event) => {
            if (event.key !== 'Enter' || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) {
                return;
            }
            if (!isLastRequestLineRow(row) || !isRowReadyForAutoAdd(row)) {
                return;
            }
            event.preventDefault();
            const nextRow = addRequestLine();
            if (nextRow) {
                const nextInput = nextRow.querySelector('.request-line-input');
                if (nextInput) {
                    nextInput.focus();
                }
            }
        };

        quantityInput.addEventListener('keydown', handleAutoAdd);
        noteInput.addEventListener('keydown', handleAutoAdd);
        noteInput.addEventListener('input', () => {
            if (!isPopulating) {
                markDirty();
            }
            applyRequestLinesFilter();
        });

        updateItemMeta(initialItem);
        applyQuantityValidation(row);
        updateValidationState();

        if (!isPopulating) {
            markDirty();
        }

        return row;
    }

    function resetRequestLines(lines = []) {
        const prev = isPopulating;
        isPopulating = true;
        try {
            if (requestLinesBody) {
                requestLinesBody.innerHTML = '';
            }
            requestLineCounter = 0;
            if (Array.isArray(lines) && lines.length) {
                lines.forEach((line) => {
                    addRequestLine(line);
                });
            } else {
                addRequestLine();
            }
            updateRequestLinesEmpty();
        } finally {
            isPopulating = prev;
            updateValidationState();
        }
    }

    function collectPayload() {
        const eventNumericId = eventInfo?.event_id || (eventId ? Number.parseInt(eventId, 10) : Number.NaN);
        if (!Number.isFinite(eventNumericId) || eventNumericId <= 0) {
            setFormMessage('ไม่พบอีเว้นที่ต้องการบันทึกคำขอ', 'error');
            return null;
        }
        const name = requestNameInput ? requestNameInput.value.trim() : '';
        if (!name) {
            setFormMessage('กรุณาระบุชื่อคำขอ', 'error');
            if (requestNameInput) {
                requestNameInput.focus();
            }
            return null;
        }
        const status = normalizeStatus(requestStatusSelect ? requestStatusSelect.value : 'draft');
        if (!requestLinesBody) {
            setFormMessage('กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ', 'error');
            return null;
        }
        const rows = Array.from(requestLinesBody.querySelectorAll('tr'));
        if (!rows.length) {
            setFormMessage('กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ', 'error');
            return null;
        }
        updateValidationState();
        const lines = [];
        const itemCounts = new Map();
        rows.forEach((row) => {
            const itemIdInput = row.querySelector('.request-line-item-id');
            const itemIdValue = itemIdInput ? Number.parseInt(itemIdInput.value, 10) : Number.NaN;
            if (Number.isFinite(itemIdValue) && itemIdValue > 0) {
                itemCounts.set(itemIdValue, (itemCounts.get(itemIdValue) || 0) + 1);
            }
        });
        for (let index = 0; index < rows.length; index += 1) {
            const row = rows[index];
            const itemIdInput = row.querySelector('.request-line-item-id');
            const quantityInput = row.querySelector('.request-line-quantity');
            const noteInput = row.querySelector('.request-line-note');
            const requestLineIdInput = row.querySelector('.request-line-id');
            const noteValue = noteInput ? noteInput.value.trim() : '';
            const itemIdValue = itemIdInput ? Number.parseInt(itemIdInput.value, 10) : Number.NaN;
            const quantityRaw = quantityInput ? quantityInput.value.trim() : '';
            const quantityValue = quantityRaw === '' ? Number.NaN : Number(quantityRaw);
            const hasAnyValue = Boolean(itemIdInput?.value?.trim()) || Boolean(quantityInput?.value?.trim()) || noteValue !== '';
            if (!hasAnyValue) {
                continue;
            }
            if (!Number.isFinite(itemIdValue) || itemIdValue <= 0) {
                setFormMessage(`กรุณาเลือกสินค้าในรายการที่ ${index + 1}`, 'error');
                const focusTarget = row.querySelector('.request-line-input');
                if (focusTarget) {
                    focusTarget.focus();
                }
                return null;
            }
            if (itemCounts.get(itemIdValue) > 1) {
                setFormMessage(`ไม่สามารถเพิ่มสินค้าซ้ำกันได้ (รายการที่ ${index + 1})`, 'error');
                const focusTarget = row.querySelector('.request-line-input');
                if (focusTarget) {
                    focusTarget.focus();
                }
                return null;
            }
            if (!Number.isInteger(quantityValue)) {
                setFormMessage(`จำนวนในรายการที่ ${index + 1} ต้องเป็นจำนวนเต็ม`, 'error');
                if (quantityInput) {
                    quantityInput.focus();
                    quantityInput.dispatchEvent(new Event('input'));
                }
                return null;
            }
            if (!Number.isFinite(quantityValue) || quantityValue < 0 || quantityValue > 1_000_000) {
                setFormMessage(`กรุณากรอกจำนวนที่ถูกต้อง (0 - 1,000,000) ในรายการที่ ${index + 1}`, 'error');
                if (quantityInput) {
                    quantityInput.focus();
                    quantityInput.dispatchEvent(new Event('input'));
                }
                return null;
            }
            const requestLineIdValue = requestLineIdInput ? Number.parseInt(requestLineIdInput.value, 10) : Number.NaN;
            const linePayload = {
                item_id: itemIdValue,
                quantity: Number.parseInt(quantityValue, 10),
                note: noteValue || null,
            };
            if (Number.isFinite(requestLineIdValue) && requestLineIdValue > 0) {
                linePayload.request_line_id = requestLineIdValue;
            }
            lines.push(linePayload);
        }
        if (!lines.length) {
            setFormMessage('กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ', 'error');
            return null;
        }
        return {
            event_id: eventNumericId,
            request_name: name,
            status,
            lines,
        };
    }

    async function requestCreate(payload) {
        const response = await fetch(`${modelRoot}/request_create.php`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'same-origin',
            body: JSON.stringify(payload),
        });
        if (!response.ok) {
            let errorInfo = { message: 'ไม่สามารถบันทึกคำขอได้', code: response.status };
            try {
                const data = await response.json();
                errorInfo.message = data?.message || errorInfo.message;
                errorInfo.code = data?.error || errorInfo.code;
            } catch (error) {
                // ignore
            }
            const err = new Error(errorInfo.message);
            throw Object.assign(err, { code: errorInfo.code });
        }
        return response.json();
    }

    async function requestUpdate(payload) {
        const response = await fetch(`${modelRoot}/request_update.php`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'same-origin',
            body: JSON.stringify(payload),
        });
        if (!response.ok) {
            let errorInfo = { message: 'ไม่สามารถบันทึกคำขอได้', code: response.status };
            try {
                const data = await response.json();
                errorInfo.message = data?.message || errorInfo.message;
                errorInfo.code = data?.error || errorInfo.code;
            } catch (error) {
                // ignore
            }
            const err = new Error(errorInfo.message);
            throw Object.assign(err, { code: errorInfo.code });
        }
        return response.json();
    }

    async function handleSave() {
        if (isSaving) {
            return false;
        }
        resetFormMessages();
        const payload = collectPayload();
        if (!payload) {
            return false;
        }
        try {
            setSavingBusy(true);
            if (requestId) {
                payload.request_id = Number.parseInt(requestId, 10);
                const result = await requestUpdate(payload);
                setGlobalMessage('บันทึกคำขอเรียบร้อยแล้ว', 'success');
                if (result?.request_id) {
                    requestId = String(result.request_id);
                }
                await loadRequest();
            } else {
                const result = await requestCreate(payload);
                setGlobalMessage('สร้างคำขอเบิกอุปกรณ์เรียบร้อยแล้ว', 'success');
                if (result?.request_id) {
                    const newParams = new URLSearchParams();
                    const targetEventId = eventInfo?.event_id || payload.event_id;
                    if (targetEventId) {
                        newParams.set('event_id', targetEventId);
                    }
                    newParams.set('request_id', result.request_id);
                    window.location.href = `./item_request_detail.html?${newParams.toString()}`;
                    return true;
                }
                await loadRequest();
            }
            return true;
        } catch (error) {
            setFormMessage(error?.message || 'ไม่สามารถบันทึกคำขอได้', 'error');
            return false;
        } finally {
            setSavingBusy(false);
        }
    }

    async function moveToReviewPage() {
        const currentStatus = normalizeStatus(requestStatusSelect ? requestStatusSelect.value : 'draft');
        if (currentStatus !== 'pending') {
            syncStatusUI('pending');
            markDirty();
        }
        const saved = await handleSave();
        if (!saved) {
            setFormMessage('กรุณาแก้ไขข้อมูลให้ถูกต้องก่อนเปิดหน้าตรวจสอบคำขอ', 'error');
            return;
        }
        if (!requestId) {
            setFormMessage('ไม่พบรหัสคำขอสำหรับเปิดหน้าตรวจสอบ', 'error');
            return;
        }
        const params = new URLSearchParams();
        params.set('request_id', requestId);
        params.set('return_to', window.location.pathname + window.location.search);
        window.location.href = `./request_review.html?${params.toString()}`;
    }

    function applyEventInfo(info) {
        eventInfo = info || null;
        if (eventInfo?.event_id) {
            eventId = String(eventInfo.event_id);
        }
        const eventName = eventInfo?.event_name || '—';
        const eventCode = formatEventCode(eventInfo?.event_code || eventInfo?.event_id);
        if (eventDisplay) {
            eventDisplay.textContent = eventName;
        }
        if (eventCodeDisplay) {
            eventCodeDisplay.textContent = `รหัสอีเว้น: ${eventCode || '—'}`;
        }
        if (eventDateDisplay) {
            eventDateDisplay.textContent = `ช่วงเวลา: ${formatDateRange(eventInfo?.start_date, eventInfo?.end_date)}`;
        }
        syncBackLink();
    }

    function applyRequestInfo(payload) {
        itemSearchCache.clear();
        requestInfo = payload || null;
        const snapshot = createSnapshotFromPayload(payload || {});
        lastSnapshot = snapshot;
        if (payload?.request_id) {
            requestId = String(payload.request_id);
        }
        runWithPopulation(() => {
            if (requestNameInput) {
                requestNameInput.value = snapshot.request_name || '';
            }
            syncStatusUI(snapshot.status);
            resetRequestLines(snapshot.lines.map((line) => ({ ...line })));
        });
        if (requestReference) {
            requestReference.textContent = payload?.reference ? `รหัสคำขอ: ${payload.reference}` : 'รหัสคำขอ: —';
        }
        if (updatedAtDisplay) {
            updatedAtDisplay.textContent = `อัปเดตล่าสุด: ${formatDateTime(payload?.updated_at)}`;
        }
        if (updatedByDisplay) {
            updatedByDisplay.textContent = `ปรับปรุงโดย: ${payload?.updated_by_label || '—'}`;
        }
        if (createdAtDisplay) {
            createdAtDisplay.textContent = `สร้างเมื่อ: ${formatDateTime(payload?.created_at)}`;
        }
        if (createdByDisplay) {
            createdByDisplay.textContent = `สร้างโดย: ${payload?.created_by_label || '—'}`;
        }
        renderAuditLogs(payload?.audit_logs || []);
        if (!payload?.audit_logs || payload.audit_logs.length === 0) {
            setRequestInfoMessage('ยังไม่มีประวัติการดำเนินการสำหรับคำขอนี้', 'info');
        } else {
            setRequestInfoMessage('');
        }
        updateAuditLink();
        updateTitle();
        setDirtyState(false);
    }

    async function loadEventInfo() {
        if (!eventId || !modelRoot) {
            return;
        }
        try {
            const response = await fetch(`${modelRoot}/event_detail.php?id=${encodeURIComponent(eventId)}`, {
                credentials: 'same-origin',
            });
            if (!response.ok) {
                throw new Error('ไม่สามารถโหลดข้อมูลอีเว้นได้');
            }
            const data = await response.json();
            if (data?.data) {
                applyEventInfo({
                    event_id: data.data.event_id,
                    event_name: data.data.event_name,
                    event_code: data.data.ref_event_id,
                    start_date: data.data.start_date,
                    end_date: data.data.end_date,
                });
            }
        } catch (error) {
            console.error(error);
            setGlobalMessage(error?.message || 'ไม่สามารถโหลดข้อมูลอีเว้นได้', 'error');
        }
    }

    async function loadRequest() {
        if (!requestId || !modelRoot) {
            return;
        }
        try {
            const response = await fetch(`${modelRoot}/request_detail.php?request_id=${encodeURIComponent(requestId)}`, {
                credentials: 'same-origin',
            });
            if (!response.ok) {
                let message = 'ไม่สามารถโหลดข้อมูลคำขอได้';
                try {
                    const data = await response.json();
                    if (data?.message) {
                        message = data.message;
                    }
                } catch (error) {
                    // ignore
                }
                throw new Error(message);
            }
            const payload = await response.json();
            if (payload?.data) {
                requestId = String(payload.data.request_id);
                eventId = String(payload.data.event_id);
                applyEventInfo(payload.data.event);
                applyRequestInfo(payload.data);
                isDatasetLoaded = true;
                clearGlobalMessage();
            }
        } catch (error) {
            console.error(error);
            setGlobalMessage(error?.message || 'ไม่สามารถโหลดข้อมูลคำขอได้', 'error');
        }
    }

    function resolveInitialState() {
        if (requestId) {
            loadRequest();
            return;
        }
        if (eventId) {
            applyEventInfo(null);
            loadEventInfo()
                .catch(() => {})
                .finally(() => {
                    const snapshot = { request_name: '', status: 'draft', lines: [] };
                    lastSnapshot = snapshot;
                    runWithPopulation(() => {
                        if (requestNameInput) {
                            requestNameInput.value = '';
                        }
                        syncStatusUI('draft');
                        resetRequestLines([]);
                        renderAuditLogs([]);
                    });
                    setRequestInfoMessage('ยังไม่มีประวัติการดำเนินการสำหรับคำขอนี้', 'info');
                    isDatasetLoaded = true;
                    updateTitle();
                    setDirtyState(false);
                });
            return;
        }
        setGlobalMessage('ไม่พบข้อมูลอ้างอิงของคำขอ', 'error');
    }

    function bindEvents() {
        if (backButton) {
            backButton.addEventListener('click', () => {
                window.location.href = backTarget;
            });
        }
        if (saveButton) {
            saveButton.addEventListener('click', () => {
                handleSave();
            });
        }
        if (requestNameInput) {
            requestNameInput.addEventListener('input', () => {
                updateTitle();
                markDirty();
            });
        }
        if (requestStatusSelect) {
            requestStatusSelect.addEventListener('change', (event) => {
                const value = normalizeStatus(event.target.value);
                syncStatusUI(value);
                markDirty();
            });
        }
        if (submitRequestButton) {
            submitRequestButton.addEventListener('click', () => {
                syncStatusUI('submitted');
                markDirty();
            });
        }
        if (resetDraftButton) {
            resetDraftButton.addEventListener('click', () => {
                syncStatusUI('draft');
                markDirty();
            });
        }
        if (cancelRequestButton) {
            cancelRequestButton.addEventListener('click', () => {
                syncStatusUI('cancelled');
                markDirty();
            });
        }
        if (reviewRequestButton) {
            reviewRequestButton.addEventListener('click', () => {
                moveToReviewPage();
            });
        }
        if (addRequestLineButton) {
            addRequestLineButton.addEventListener('click', () => {
                addRequestLine();
            });
        }
        if (requestLinesSearch) {
            requestLinesSearch.addEventListener('input', () => {
                applyRequestLinesFilter();
            });
        }
        if (inlineSaveButton) {
            inlineSaveButton.addEventListener('click', () => {
                handleSave();
            });
        }
        if (discardChangesButton) {
            discardChangesButton.addEventListener('click', () => {
                restoreSnapshot(lastSnapshot);
                resetFormMessages();
            });
        }
        if (requestForm) {
            requestForm.addEventListener('submit', (event) => {
                event.preventDefault();
            });
            requestForm.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' && !event.target.closest('.typeahead-list')) {
                    const isButton = event.target.tagName === 'BUTTON';
                    const isTextarea = event.target.tagName === 'TEXTAREA';
                    if (!isButton && !isTextarea) {
                        event.preventDefault();
                    }
                }
            });
        }
        window.addEventListener('beforeunload', handleBeforeUnload);
    }

    function boot({ root }) {
        modelRoot = `${root}/Model`;
        updateThaiDate(); // Initial call
        setInterval(updateThaiDate, 1000);
        syncBackLink();
        bindEvents();
        syncStatusUI(requestStatusSelect ? requestStatusSelect.value : 'draft');
        updateSaveButtonState();
        resolveInitialState();
    }

    if (typeof window.onAppReady === 'function') {
        window.onAppReady(boot);
    }
})();