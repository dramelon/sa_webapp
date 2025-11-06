(function () {
    const eventForm = document.getElementById('eventForm');
    const formMessage = document.getElementById('formMessage');
    const eventHeading = document.getElementById('eventHeading');
    const eventIdDisplay = document.getElementById('eventIdDisplay');
    const eventLocation = document.getElementById('eventLocation');
    const statusBadge = document.getElementById('statusBadge');
    const statusText = document.getElementById('statusText');
    const eventStatusField = document.getElementById('eventStatus');
    const lastUpdated = document.getElementById('lastUpdated');
    const updatedBy = document.getElementById('updatedBy');
    const createdAt = document.getElementById('createdAt');
    const createdBy = document.getElementById('createdBy');
    const btnBack = document.getElementById('btnBack');
    const btnSave = document.getElementById('btnSave');
    const breadcrumbLink = document.querySelector('.breadcrumb a');
    const unsavedBanner = document.getElementById('unsavedBanner');
    const btnDiscardChanges = document.getElementById('btnDiscardChanges');
    const btnSaveInline = document.getElementById('btnSaveInline');
    const unsavedModal = document.getElementById('unsavedModal');
    const btnModalStay = document.getElementById('btnModalStay');
    const btnModalDiscard = document.getElementById('btnModalDiscard');
    const btnModalSave = document.getElementById('btnModalSave');
    const locationInput = document.getElementById('locationInput');
    const locationHidden = document.getElementById('locationId');

    const params = new URLSearchParams(window.location.search);
    const eventIdParam = params.get('event_id');
    const isCreateRequested = params.get('mode') === 'create';
    let currentEventId = eventIdParam ? String(eventIdParam) : null;
    let isCreateMode = !currentEventId;
    if (isCreateRequested && !currentEventId) {
        isCreateMode = true;
    }

    const statusMeta = {
        draft: { label: 'ร่าง', className: 'draft' },
        planning: { label: 'วางแผน', className: 'planning' },
        waiting: { label: 'รอดำเนินการ', className: 'waiting' },
        processing: { label: 'กำลังดำเนินการ', className: 'processing' },
        billing: { label: 'เรียกเก็บเงิน', className: 'billing' },
        completed: { label: 'เสร็จสิ้น', className: 'completed' },
        cancelled: { label: 'ยกเลิก', className: 'cancelled' },
    };

    let modelRoot = '';
    let typeaheadFields = [];
    let initialSnapshot = null;
    let isDirty = false;
    let isPopulating = false;
    let pendingNavigationAction = null;

    if (unsavedModal) {
        unsavedModal.setAttribute('aria-hidden', unsavedModal.hidden ? 'true' : 'false');
    }

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

    function lockForm(message, heading = 'ไม่พบข้อมูลอีเว้น') {
        if (!eventForm) return;
        eventForm.querySelectorAll('input, textarea, select, button').forEach((el) => {
            el.disabled = true;
        });
        if (btnSave) {
            btnSave.disabled = true;
        }
        eventHeading.textContent = heading;
        showMessage(message, 'error');
        setDirtyState(false);
        closeUnsavedModal();
    }

    function showMessage(message, variant = 'info') {
        if (!formMessage) return;
        if (!message) {
            formMessage.hidden = true;
            formMessage.textContent = '';
            formMessage.className = 'form-alert';
            return;
        }
        formMessage.textContent = message;
        formMessage.hidden = false;
        formMessage.className = `form-alert ${variant}`;
    }

    function setStatus(statusKey) {
        const normalized = typeof statusKey === 'string' ? statusKey.toLowerCase() : '';
        const meta = statusMeta[normalized];
        const badgeStatus = meta ? normalized : 'draft';
        const label = meta ? meta.label : statusKey || 'ไม่ระบุ';
        statusBadge.dataset.status = badgeStatus;
        statusText.textContent = `สถานะ: ${label}`;
        if (eventStatusField && eventStatusField.value !== badgeStatus) {
            eventStatusField.value = badgeStatus;
        }
    }

    function formatDisplayDate(value) {
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
            hour12: false,
        });
    }

    function toDateInputValue(value) {
        if (!value) {
            return '';
        }
        const normalized = value.replace(' ', 'T');
        const date = new Date(normalized);
        if (Number.isNaN(date.getTime())) {
            return '';
        }
        const pad = (num) => String(num).padStart(2, '0');
        const year = date.getFullYear();
        const month = pad(date.getMonth() + 1);
        const day = pad(date.getDate());
        const hours = pad(date.getHours());
        const minutes = pad(date.getMinutes());
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    }

    function extractLabelName(label) {
        if (!label) {
            return '';
        }
        const parts = String(label).split(' - ');
        if (parts.length > 1) {
            return parts.slice(1).join(' - ').trim();
        }
        return String(label).trim();
    }

    function setMetaPerson(element, prefix, label) {
        if (!element) {
            return;
        }
        const name = extractLabelName(label);
        element.textContent = `${prefix}: ${name || 'ไม่ระบุ'}`;
    }

    function serializeForm() {
        return {
            event_name: document.getElementById('eventName').value || '',
            status: document.getElementById('eventStatus').value || '',
            customer_id: document.getElementById('customerId').value || '',
            customer_label: document.getElementById('customerInput').value || '',
            staff_id: document.getElementById('staffId').value || '',
            staff_label: document.getElementById('staffInput').value || '',
            location_id: document.getElementById('locationId').value || '',
            location_label: document.getElementById('locationInput').value || '',
            start_date: document.getElementById('startDate').value || '',
            end_date: document.getElementById('endDate').value || '',
            description: document.getElementById('description').value || '',
            notes: document.getElementById('notes').value || '',
        };
    }

    function snapshotsEqual(a, b) {
        if (!a || !b) {
            return false;
        }
        const keys = Object.keys(a);
        if (keys.length !== Object.keys(b).length) {
            return false;
        }
        for (const key of keys) {
            if (a[key] !== b[key]) {
                return false;
            }
        }
        return true;
    }

    function setDirtyState(next) {
        if (isDirty === next) {
            return;
        }
        isDirty = next;
        if (unsavedBanner) {
            unsavedBanner.hidden = !isDirty;
        }
    }

    function syncLocationDisplayFromForm() {
        if (!locationHidden || !eventLocation) {
            return;
        }
        const idValue = locationHidden.value.trim();
        if (!idValue) {
            eventLocation.textContent = 'สถานที่: ไม่ระบุ';
            return;
        }
        const label = locationInput?.value || '';
        const text = extractLabelName(label);
        eventLocation.textContent = `สถานที่: ${text || 'ไม่ระบุ'}`;
    }

    function handleFormMutated() {
        if (isPopulating || !initialSnapshot) {
            syncLocationDisplayFromForm();
            return;
        }
        syncLocationDisplayFromForm();
        const current = serializeForm();
        const dirty = !snapshotsEqual(current, initialSnapshot);
        setDirtyState(dirty);
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

    function restoreSnapshot(snapshot) {
        if (!snapshot) {
            return;
        }
        runWithPopulation(() => {
            document.getElementById('eventName').value = snapshot.event_name;
            document.getElementById('eventStatus').value = snapshot.status;
            document.getElementById('startDate').value = snapshot.start_date;
            document.getElementById('endDate').value = snapshot.end_date;
            document.getElementById('description').value = snapshot.description;
            document.getElementById('notes').value = snapshot.notes;
            const customerField = findTypeaheadByType('customer');
            customerField?.setValue(snapshot.customer_id, snapshot.customer_label);
            const staffField = findTypeaheadByType('staff');
            staffField?.setValue(snapshot.staff_id, snapshot.staff_label);
            const locationField = findTypeaheadByType('location');
            locationField?.setValue(snapshot.location_id, snapshot.location_label);
            setStatus(snapshot.status);
        });
        syncLocationDisplayFromForm();
        initialSnapshot = serializeForm();
        setDirtyState(false);
    }

    function requestNavigation(action) {
        if (!isDirty) {
            action();
            return;
        }
        pendingNavigationAction = action;
        openUnsavedModal();
    }

    function openUnsavedModal() {
        if (!unsavedModal) {
            return;
        }
        unsavedModal.hidden = false;
        unsavedModal.setAttribute('aria-hidden', 'false');
    }

    function closeUnsavedModal() {
        if (!unsavedModal) {
            return;
        }
        unsavedModal.hidden = true;
        unsavedModal.setAttribute('aria-hidden', 'true');
    }

    function triggerSave() {
        if (!eventForm || btnSave?.disabled) {
            return;
        }
        if (typeof eventForm.requestSubmit === 'function') {
            eventForm.requestSubmit(btnSave);
        } else {
            btnSave?.click();
        }
    }

    function handleBeforeUnload(event) {
        if (!isDirty) {
            return;
        }
        event.preventDefault();
        event.returnValue = '';
    }

    class TypeaheadField {
        constructor(root) {
            this.root = root;
            this.type = root.dataset.type;
            this.input = root.querySelector('input[type="text"]');
            this.hidden = root.querySelector('input[type="hidden"]');
            this.list = root.querySelector('.typeahead-list');
            this.items = [];
            this.debounceHandle = null;
            this.activeRequest = 0;
            this.bindEvents();
        }

        bindEvents() {
            this.input.addEventListener('input', () => {
                const value = this.input.value.trim();
                if (this.debounceHandle) {
                    clearTimeout(this.debounceHandle);
                }
                this.debounceHandle = setTimeout(() => {
                    this.fetch(value);
                }, 250);
                this.hidden.value = '';
                if (this.type === 'location') {
                    syncLocationDisplayFromForm();
                }
            });

            this.input.addEventListener('focus', () => {
                const value = this.input.value.trim();
                this.fetch(value);
            });

            document.addEventListener('click', (event) => {
                if (!this.root.contains(event.target)) {
                    this.closeList();
                }
            });
        }

        setValue(id, label) {
            this.hidden.value = id == null ? '' : id;
            this.input.value = label || '';
            if (this.type === 'location') {
                syncLocationDisplayFromForm();
            }
            handleFormMutated();
        }

        async fetch(query) {
            if (!modelRoot) {
                return;
            }
            const token = ++this.activeRequest;
            try {
                const params = new URLSearchParams({ type: this.type });
                if (query) {
                    params.set('q', query);
                }
                const response = await fetch(`${modelRoot}/lookup_search.php?${params.toString()}`, {
                    credentials: 'same-origin',
                });
                if (!response.ok) {
                    throw new Error('network');
                }
                const payload = await response.json();
                if (token !== this.activeRequest) {
                    return;
                }
                this.items = Array.isArray(payload.data) ? payload.data : [];
                this.renderList();
            } catch (error) {
                if (token !== this.activeRequest) {
                    return;
                }
                this.items = [];
                this.renderList('ไม่สามารถดึงข้อมูลได้');
            }
        }

        renderList(emptyText = 'ไม่พบข้อมูลที่เกี่ยวข้อง') {
            this.list.innerHTML = '';
            if (!this.items.length) {
                if (emptyText) {
                    const empty = document.createElement('div');
                    empty.className = 'typeahead-empty';
                    empty.textContent = emptyText;
                    this.list.append(empty);
                    this.list.hidden = false;
                } else {
                    this.list.hidden = true;
                }
                return;
            }
            this.list.hidden = false;
            for (const item of this.items) {
                const option = document.createElement('button');
                option.type = 'button';
                option.className = 'typeahead-option';
                option.textContent = item.label;
                option.dataset.value = item.id ?? '';
                option.addEventListener('click', () => {
                    this.hidden.value = item.id ?? '';
                    this.input.value = item.label || '';
                    this.closeList();
                    if (this.type === 'location') {
                        syncLocationDisplayFromForm();
                    }
                    handleFormMutated();
                });
                this.list.append(option);
            }
        }

        closeList() {
            this.list.hidden = true;
            this.list.innerHTML = '';
            this.items = [];
        }
    }

    function initTypeahead() {
        typeaheadFields = Array.from(document.querySelectorAll('.typeahead')).map((root) => new TypeaheadField(root));
    }

    function findTypeaheadByType(type) {
        return typeaheadFields.find((field) => field.type === type) || null;
    }

    if (btnDiscardChanges) {
        btnDiscardChanges.addEventListener('click', () => {
            pendingNavigationAction = null;
            restoreSnapshot(initialSnapshot);
        });
    }

    if (btnSaveInline) {
        btnSaveInline.addEventListener('click', () => {
            triggerSave();
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
            const action = pendingNavigationAction;
            pendingNavigationAction = null;
            setDirtyState(false);
            closeUnsavedModal();
            if (typeof action === 'function') {
                action();
            }
        });
    }

    if (btnModalSave) {
        btnModalSave.addEventListener('click', () => {
            closeUnsavedModal();
            triggerSave();
        });
    }

    if (btnBack) {
        btnBack.addEventListener('click', () => {
            requestNavigation(() => {
                if (window.history.length > 1) {
                    window.history.back();
                } else {
                    window.location.href = './events.html';
                }
            });
        });
    }

    if (breadcrumbLink) {
        breadcrumbLink.addEventListener('click', (event) => {
            event.preventDefault();
            const href = breadcrumbLink.getAttribute('href');
            requestNavigation(() => {
                window.location.href = href || './events.html';
            });
        });
    }

    if (eventForm) {
        eventForm.addEventListener('input', handleFormMutated);
        eventForm.addEventListener('change', handleFormMutated);
        eventForm.addEventListener('keydown', (event) => {
            const tagName = event.target?.tagName;
            if (event.key === 'Enter' && tagName && tagName !== 'TEXTAREA' && (tagName === 'INPUT' || tagName === 'SELECT')) {
                event.preventDefault();
            }
        });
    }
    
    if (eventStatusField) {
        eventStatusField.addEventListener('change', () => {
            setStatus(eventStatusField.value);
        });
    }

    if (locationInput) {
        locationInput.addEventListener('input', syncLocationDisplayFromForm);
        locationInput.addEventListener('change', syncLocationDisplayFromForm);
    }

    window.addEventListener('beforeunload', handleBeforeUnload);

   async function loadEvent(options = {}) {
        const { lockOnError = true, eventId = currentEventId } = options;
        if (!modelRoot) {
            return false;
        }
        const targetId = eventId ? String(eventId) : null;
        if (!targetId) {
            currentEventId = null;
            prepareCreateMode();
            return true;
        }
        try {
            const response = await fetch(`${modelRoot}/event_detail.php?id=${encodeURIComponent(targetId)}`, {
                credentials: 'same-origin',
            });
            if (!response.ok) {
                throw new Error('network');
            }
            const payload = await response.json();
            if (!payload || !payload.data) {
                throw new Error('notfound');
            }
            populateForm(payload.data);
            return true;
        } catch (error) {
            if (lockOnError) {
                if (error && error.message === 'notfound') {
                    lockForm('ไม่พบรหัสอีเว้นที่ต้องการเปิด');
                } else {
                    lockForm('ไม่สามารถโหลดข้อมูลอีเว้นได้');
                }
            } else {
                if (error && error.message === 'notfound') {
                    showMessage('ไม่พบรหัสอีเว้นที่ต้องการเปิด', 'error');
                } else {
                    showMessage('ไม่สามารถโหลดข้อมูลอีเว้นได้', 'error');
                }
            }
            return false;
        }
    }

    function populateForm(data) {
        runWithPopulation(() => {
            const eventIdValue = data.event_id != null ? String(data.event_id) : null;
            currentEventId = eventIdValue;
            isCreateMode = false;
            eventHeading.textContent = data.event_name || (eventIdValue ? `อีเว้น #${eventIdValue}` : 'ไม่พบข้อมูลอีเว้น');
            eventIdDisplay.textContent = eventIdValue ? `EV-${eventIdValue}` : '—';
            const nameField = document.getElementById('eventName');
            if (nameField) {
                nameField.value = data.event_name || '';
            }
            if (eventStatusField) {
                eventStatusField.value = data.status || 'draft';
            }
            document.getElementById('startDate').value = toDateInputValue(data.start_date || '');
            document.getElementById('endDate').value = toDateInputValue(data.end_date || '');
            document.getElementById('description').value = data.description || '';
            document.getElementById('notes').value = data.notes || '';

            setStatus(data.status || 'draft');

            const customerField = findTypeaheadByType('customer');
            customerField?.setValue(data.customer_id ?? '', data.customer_label || '');
            const staffField = findTypeaheadByType('staff');
            staffField?.setValue(data.staff_id ?? '', data.staff_label || '');
            const locationField = findTypeaheadByType('location');
            locationField?.setValue(data.location_id ?? '', data.location_label || '');

            lastUpdated.textContent = `อัปเดตล่าสุด: ${formatDisplayDate(data.updated_at)}`;
            setMetaPerson(updatedBy, 'ปรับปรุงโดย', data.updated_by_label);
            createdAt.textContent = `สร้างเมื่อ: ${formatDisplayDate(data.created_at)}`;
            setMetaPerson(createdBy, 'สร้างโดย', data.created_by_label);
        });
        syncLocationDisplayFromForm();
        initialSnapshot = serializeForm();
        setDirtyState(false);
    }

    function normalizeId(value) {
        if (value === null || value === undefined) {
            return null;
        }
        const trimmed = String(value).trim();
        if (trimmed === '') {
            return null;
        }
        return trimmed;
    }

    function prepareCreateMode() {
        if (!eventForm) {
            return;
        }
        currentEventId = null;
        isCreateMode = true;
        runWithPopulation(() => {
            eventForm.reset();
            const nameField = document.getElementById('eventName');
            if (nameField) {
                nameField.value = '';
            }
            if (eventStatusField) {
                eventStatusField.value = 'draft';
            }
            setStatus('draft');
            const ids = ['customerId', 'staffId', 'locationId'];
            const inputs = ['customerInput', 'staffInput', 'locationInput'];
            ids.forEach((id) => {
                const el = document.getElementById(id);
                if (el) {
                    el.value = '';
                }
            });
            inputs.forEach((id) => {
                const el = document.getElementById(id);
                if (el) {
                    el.value = '';
                }
            });
            const fieldsToClear = ['startDate', 'endDate', 'description', 'notes'];
            fieldsToClear.forEach((id) => {
                const el = document.getElementById(id);
                if (el) {
                    if (el.tagName === 'TEXTAREA') {
                        el.value = '';
                    } else {
                        el.value = '';
                    }
                }
            });
            typeaheadFields.forEach((field) => field.setValue('', ''));
        });
        eventHeading.textContent = 'สร้างอีเว้นใหม่';
        eventIdDisplay.textContent = 'ใหม่';
        eventLocation.textContent = 'สถานที่: —';
        lastUpdated.textContent = 'อัปเดตล่าสุด: —';
        updatedBy.textContent = 'ปรับปรุงโดย: —';
        createdAt.textContent = 'สร้างเมื่อ: —';
        createdBy.textContent = 'สร้างโดย: —';
        syncLocationDisplayFromForm();
        initialSnapshot = serializeForm();
        setDirtyState(false);
        showMessage('');
    }

    async function createEvent(payload) {
        const requestBody = { ...payload };
        const response = await fetch(`${modelRoot}/event_create.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify(requestBody),
        });
        if (!response.ok) {
            throw new Error('network');
        }
        const result = await response.json();
        if (!result.success || !result.event_id) {
            throw new Error(result.error || 'unknown');
        }
        const newEventId = String(result.event_id);
        const resolvedStatus = (result.status || payload.status || 'draft').toLowerCase();
        currentEventId = newEventId;
        isCreateMode = false;
        eventHeading.textContent = payload.event_name || `อีเว้น #${newEventId}`;
        eventIdDisplay.textContent = `EV-${newEventId}`;
        setStatus(resolvedStatus);
        params.set('event_id', newEventId);
        if (params.has('mode')) {
            params.delete('mode');
        }
        const newQuery = params.toString();
        const newUrl = newQuery ? `${window.location.pathname}?${newQuery}` : window.location.pathname;
        window.history.replaceState({}, '', newUrl);
        const loaded = await loadEvent({ lockOnError: false, eventId: newEventId });
        if (!loaded) {
            initialSnapshot = serializeForm();
            setDirtyState(false);
            closeUnsavedModal();
            showMessage('สร้างอีเว้นแล้ว แต่ไม่สามารถโหลดข้อมูลล่าสุดได้ โปรดลองรีเฟรชหน้า', 'error');
            return;
        }
        initialSnapshot = serializeForm();
        setDirtyState(false);
        closeUnsavedModal();
        showMessage('สร้างอีเว้นเรียบร้อยแล้ว', 'success');
        if (typeof pendingNavigationAction === 'function') {
            const action = pendingNavigationAction;
            pendingNavigationAction = null;
            action();
        }
    }

    async function updateExistingEvent(payload) {
        if (!currentEventId) {
            return;
        }
        const requestBody = {
            event_id: currentEventId,
            ...payload,
        };
        const response = await fetch(`${modelRoot}/event_update.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify(requestBody),
        });
        if (!response.ok) {
            throw new Error('network');
        }
        const result = await response.json();
        if (!result.success) {
            throw new Error(result.error || 'unknown');
        }
        runWithPopulation(() => {
            const latestName = payload.event_name;
            if (latestName) {
                eventHeading.textContent = latestName;
            }
            const resolvedStatus = (result.status || requestBody.status || 'draft').toLowerCase();
            setStatus(resolvedStatus);
            if (Object.prototype.hasOwnProperty.call(result, 'updated_at')) {
                lastUpdated.textContent = `อัปเดตล่าสุด: ${formatDisplayDate(result.updated_at)}`;
            }
            if (Object.prototype.hasOwnProperty.call(result, 'updated_by_label')) {
                setMetaPerson(updatedBy, 'ปรับปรุงโดย', result.updated_by_label);
            }
            if (Object.prototype.hasOwnProperty.call(result, 'customer_label')) {
                const customerField = findTypeaheadByType('customer');
                const customerIdValue = Object.prototype.hasOwnProperty.call(result, 'customer_id')
                    ? result.customer_id
                    : payload.customer_id;
                customerField?.setValue(customerIdValue ?? '', result.customer_label || '');
            }
            if (Object.prototype.hasOwnProperty.call(result, 'staff_label')) {
                const staffField = findTypeaheadByType('staff');
                const staffIdValue = Object.prototype.hasOwnProperty.call(result, 'staff_id')
                    ? result.staff_id
                    : payload.staff_id;
                staffField?.setValue(staffIdValue ?? '', result.staff_label || '');
            }
            if (Object.prototype.hasOwnProperty.call(result, 'location_label')) {
                const locationField = findTypeaheadByType('location');
                const locationIdValue = Object.prototype.hasOwnProperty.call(result, 'location_id')
                    ? result.location_id
                    : payload.location_id;
                locationField?.setValue(locationIdValue ?? '', result.location_label || '');
            }
        });
        syncLocationDisplayFromForm();
        initialSnapshot = serializeForm();
        setDirtyState(false);
        closeUnsavedModal();
        showMessage('บันทึกการเปลี่ยนแปลงเรียบร้อยแล้ว', 'success');
        if (typeof pendingNavigationAction === 'function') {
            const action = pendingNavigationAction;
            pendingNavigationAction = null;
            action();
        }
    }

    if (eventForm) {
        eventForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (!modelRoot) {
                return;
            }
            const nameField = document.getElementById('eventName');
            const eventNameValue = nameField?.value.trim() || '';
            if (!eventNameValue) {
                showMessage('กรุณากรอกชื่องาน', 'error');
                return;
            }
            const payload = {
                event_name: eventNameValue,
                status: (eventStatusField?.value || 'draft').toLowerCase(),
                status: document.getElementById('eventStatus').value,
                customer_id: normalizeId(document.getElementById('customerId').value),
                staff_id: normalizeId(document.getElementById('staffId').value),
                location_id: normalizeId(document.getElementById('locationId').value),
                start_date: document.getElementById('startDate').value,
                end_date: document.getElementById('endDate').value,
                description: document.getElementById('description').value.trim(),
                notes: document.getElementById('notes').value.trim(),
            };
            if (btnSave) {
                btnSave.disabled = true;
            }
            showMessage('กำลังบันทึก...', 'info');

            try {
                if (!currentEventId) {
                    await createEvent(payload);
                } else {
                    await updateExistingEvent(payload);
                }
            } catch (error) {
                showMessage('เกิดข้อผิดพลาดในการบันทึกข้อมูล โปรดลองใหม่อีกครั้ง', 'error');
            } finally {
                if (btnSave) {
                    btnSave.disabled = false;
                }
            }
        });
    }

    const boot = ({ root }) => {
        modelRoot = `${root}/Model`;
        updateThaiDate();
        setInterval(updateThaiDate, 1000);
        initTypeahead();
        loadEvent();
    };

    if (typeof window.onAppReady === 'function') {
        window.onAppReady(boot);
    }
})();