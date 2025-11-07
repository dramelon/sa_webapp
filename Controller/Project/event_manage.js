(function () {
    const eventForm = document.getElementById('eventForm');
    const formMessage = document.getElementById('formMessage');
    const eventHeading = document.getElementById('eventHeading');
    const eventIdDisplay = document.getElementById('eventIdDisplay');
    const eventLocation = document.getElementById('eventLocation');
    const eventCustomer = document.getElementById('eventCustomer');
    const statusBadge = document.getElementById('statusBadge');
    const statusText = document.getElementById('statusText');
    const statusDisplay = document.getElementById('statusDisplay');
    const statusValue = document.getElementById('statusValue');
    const lastUpdated = document.getElementById('lastUpdated');
    const updatedBy = document.getElementById('updatedBy');
    const createdAt = document.getElementById('createdAt');
    const createdBy = document.getElementById('createdBy');
    const btnBack = document.getElementById('btnBack');
    const btnSave = document.getElementById('btnSave');
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');
    const allDayToggle = document.getElementById('allDayToggle');
    const eventCodeField = document.getElementById('eventCode');
    const refEventField = document.getElementById('refEventCode');
    const locationInput = document.getElementById('locationInput');
    const customerHidden = document.getElementById('customerId');
    const customerInputField = document.getElementById('customerInput');

    const params = new URLSearchParams(window.location.search);
    const eventIdParam = params.get('event_id');
    const isCreateRequested = params.get('mode') === 'create';
    let currentEventId = eventIdParam && !isCreateRequested ? eventIdParam : null;

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
    let currentStatus = 'draft';
    let currentUser = null;

    const updateThaiDate = () => {
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
        const el = document.getElementById('pageDate');
        if (el) {
            el.textContent = `วัน${day}ที่ ${date} ${month} ${year} เวลา ${time}`;
        }
    };

    function formatBaseEventCode(eventId) {
        if (eventId === null || eventId === undefined) {
            return '—';
        }
        const text = String(eventId).trim();
        if (!text) {
            return '—';
        }
        return `EV-${text}`;
    }

    function formatEventDisplay(refEventId, eventId) {
        const baseCode = formatBaseEventCode(eventId);
        if (refEventId) {
            return `${refEventId} (${baseCode})`;
        }
        return baseCode;
    }

    function normalizeContactValue(value) {
        return typeof value === 'string' ? value.trim() : '';
    }

    function buildCustomerMeta(name, phone, email) {
        return {
            name: normalizeContactValue(name),
            phone: normalizeContactValue(phone),
            email: normalizeContactValue(email),
        };
    }

    function formatCustomerMeta(name, phone, email) {
        const baseName = normalizeContactValue(name) || 'ไม่ระบุ';
        const phoneText = normalizeContactValue(phone);
        const emailText = normalizeContactValue(email);
        const details = [];
        if (phoneText) {
            details.push(phoneText);
        }
        if (emailText) {
            details.push(`< ${emailText} >`);
        }
        const suffix = details.length ? `, ${details.join(' ')}` : '';
        return `ลูกค้า : ${baseName}${suffix}`;
    }

    function readCustomerMetaFromHidden() {
        if (!customerHidden) {
            return buildCustomerMeta('', '', '');
        }
        return buildCustomerMeta(
            customerHidden.dataset.customerName || '',
            customerHidden.dataset.customerPhone || '',
            customerHidden.dataset.customerEmail || ''
        );
    }

    function syncCustomerDisplayFromForm(metaOverride = null) {
        if (!eventCustomer) {
            return;
        }
        const idValue = customerHidden?.value?.trim() || '';
        if (!idValue) {
            eventCustomer.textContent = 'ลูกค้า : —';
            return;
        }
        const meta = metaOverride
            ? buildCustomerMeta(metaOverride.name, metaOverride.phone, metaOverride.email)
            : readCustomerMetaFromHidden();
        eventCustomer.textContent = formatCustomerMeta(meta.name, meta.phone, meta.email);
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
        const normalized = typeof statusKey === 'string' ? statusKey.toLowerCase() : 'draft';
        const meta = statusMeta[normalized] || statusMeta.draft;
        currentStatus = normalized;
        statusValue.value = normalized;
        statusBadge.dataset.status = normalized;
        statusText.textContent = `สถานะ: ${meta.label}`;
        statusDisplay.value = meta.label;
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

    function toDateOnlyValue(value) {
        if (!value) {
            return '';
        }
        const normalized = String(value).replace('T', ' ').trim();
        const [datePart] = normalized.split(' ');
        return datePart || '';
    }

    function extractTimePortion(value) {
        if (!value) {
            return '';
        }
        const normalized = String(value).replace(' ', 'T');
        const parts = normalized.split('T');
        if (parts.length < 2) {
            return '';
        }
        return parts[1].slice(0, 5);
    }

    function detectAllDayRange(startValue, endValue) {
        if (!startValue || !endValue) {
            return false;
        }
        const startTime = extractTimePortion(startValue);
        const endTime = extractTimePortion(endValue);
        if (!startTime || !endTime) {
            return false;
        }
        return startTime === '00:00' && endTime === '23:59';
    }

    const dateState = {
        savedStart: '',
        savedEnd: '',
    };

    function updateCachedDateTimesFromCurrentDates() {
        if (!allDayToggle || !allDayToggle.checked) {
            return;
        }
        const startValue = startDateInput?.value || '';
        const endValue = endDateInput?.value || '';
        const startTime = extractTimePortion(dateState.savedStart) || '00:00';
        const endTime = extractTimePortion(dateState.savedEnd) || '23:59';
        if (startValue) {
            dateState.savedStart = `${startValue}T${startTime}`;
        }
        if (endValue) {
            dateState.savedEnd = `${endValue}T${endTime}`;
        }
    }

    function updateEndDateMinimum() {
        if (!startDateInput || !endDateInput) {
            return;
        }
        const value = startDateInput.value;
        if (value) {
            endDateInput.min = value;
        } else {
            endDateInput.removeAttribute('min');
        }
    }

    function applyDateMode(allDayEnabled, options = {}) {
        if (!startDateInput || !endDateInput) {
            return;
        }
        const { startValue = null, endValue = null, cacheValues = true } = options;
        if (allDayEnabled) {
            if (cacheValues) {
                if (startDateInput.type === 'datetime-local' && startDateInput.value) {
                    dateState.savedStart = startDateInput.value;
                }
                if (endDateInput.type === 'datetime-local' && endDateInput.value) {
                    dateState.savedEnd = endDateInput.value;
                }
            }
            startDateInput.type = 'date';
            endDateInput.type = 'date';
            const resolvedStart =
                startValue !== null
                    ? startValue
                    : toDateOnlyValue(startDateInput.value || dateState.savedStart);
            const fallbackStart = toDateOnlyValue(dateState.savedStart);
            const startToSet = resolvedStart || fallbackStart || '';
            const resolvedEnd =
                endValue !== null ? endValue : toDateOnlyValue(endDateInput.value || dateState.savedEnd);
            const fallbackEnd = toDateOnlyValue(dateState.savedEnd);
            const endToSet = resolvedEnd || fallbackEnd || startToSet;
            startDateInput.value = startToSet;
            endDateInput.value = endToSet;
            updateCachedDateTimesFromCurrentDates();
        } else {
            startDateInput.type = 'datetime-local';
            endDateInput.type = 'datetime-local';
            let startToSet = startValue !== null ? startValue : startDateInput.value;
            let endToSet = endValue !== null ? endValue : endDateInput.value;
            if (cacheValues) {
                if (dateState.savedStart) {
                    startToSet = dateState.savedStart;
                }
                if (dateState.savedEnd) {
                    endToSet = dateState.savedEnd;
                }
            } else {
                dateState.savedStart = '';
                dateState.savedEnd = '';
            }
            if (startToSet && startToSet.length === 10) {
                startToSet = `${startToSet}T00:00`;
            }
            if (endToSet && endToSet.length === 10) {
                endToSet = `${endToSet}T23:59`;
            }
            startDateInput.value = startToSet || '';
            endDateInput.value = endToSet || '';
        }
        updateEndDateMinimum();
    }

    function getDatePayloadValues() {
        const allDay = Boolean(allDayToggle?.checked);
        if (!startDateInput || !endDateInput) {
            return { allDay, start: '', end: '' };
        }
        const startRaw = startDateInput.value;
        const endRaw = endDateInput.value;
        if (allDay) {
            const startDate = startRaw ? `${startRaw}T00:00` : '';
            const resolvedEnd = endRaw || startRaw;
            const endDate = resolvedEnd ? `${resolvedEnd}T23:59` : '';
            return { allDay: true, start: startDate, end: endDate };
        }
        return { allDay: false, start: startRaw, end: endRaw };
    }

    function syncLocationDisplayFromForm() {
        if (!eventLocation) {
            return;
        }
        const value = locationInput?.value.trim() || '';
        if (value) {
            eventLocation.textContent = `สถานที่: ${value}`;
        } else {
            eventLocation.textContent = 'สถานที่: —';
        }
    }

    class TypeaheadField {
        constructor(root) {
            this.root = root;
            this.type = root.dataset.type;
            this.input = root.querySelector('input[type="text"]');
            this.hidden = root.querySelector('input[type="hidden"]');
            this.list = root.querySelector('.typeahead-list');
            this.items = [];
            this.activeRequest = 0;
            this.debounceHandle = null;
            this.init();
        }

        init() {
            this.input?.addEventListener('input', () => {
                if (this.hidden) {
                    this.hidden.value = '';
                    if (this.type === 'customer') {
                        this.hidden.dataset.customerName = '';
                        this.hidden.dataset.customerPhone = '';
                        this.hidden.dataset.customerEmail = '';
                        syncCustomerDisplayFromForm();
                    }
                }
                if (this.type === 'location') {
                    syncLocationDisplayFromForm();
                }
                this.scheduleFetch();
            });
            this.input?.addEventListener('focus', () => {
                if (!this.input.value) {
                    this.scheduleFetch();
                } else {
                    this.openList();
                }
            });
            document.addEventListener('click', (event) => {
                if (!this.root.contains(event.target)) {
                    this.closeList();
                }
            });
        }

        scheduleFetch() {
            if (!modelRoot || !this.type) return;
            if (this.debounceHandle) {
                clearTimeout(this.debounceHandle);
            }
            this.debounceHandle = setTimeout(() => {
                this.fetchItems();
            }, 200);
        }

        async fetchItems() {
            if (!modelRoot || !this.type) return;
            const token = ++this.activeRequest;
            const query = this.input.value.trim();
            const params = new URLSearchParams({ type: this.type });
            if (query) {
                params.set('q', query);
            }
            try {
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
            if (!this.list) return;
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
                    const meta = this.type === 'customer'
                        ? {
                              name: item.name ?? '',
                              phone: item.phone ?? '',
                              email: item.email ?? '',
                          }
                        : null;
                    this.setValue(item.id ?? '', item.label || '', meta);
                    this.closeList();
                });
                this.list.append(option);
            }
        }

        openList() {
            if (this.items.length) {
                this.list.hidden = false;
            }
        }

        closeList() {
            if (!this.list) return;
            this.list.hidden = true;
            this.list.innerHTML = '';
            this.items = [];
        }

        setValue(id, label, meta = null) {
            if (this.hidden) {
                this.hidden.value = id ?? '';
                if (this.type === 'customer') {
                    const normalizedMeta = meta && typeof meta === 'object' ? meta : { name: '', phone: '', email: '' };
                    this.hidden.dataset.customerName = normalizeContactValue(normalizedMeta.name);
                    this.hidden.dataset.customerPhone = normalizeContactValue(normalizedMeta.phone);
                    this.hidden.dataset.customerEmail = normalizeContactValue(normalizedMeta.email);
                    syncCustomerDisplayFromForm(normalizedMeta);
                }
            }
            if (this.input) {
                this.input.value = label || '';
            }
            if (this.type === 'location') {
                syncLocationDisplayFromForm();
            }
        }
    }

    function initTypeahead() {
        typeaheadFields = Array.from(document.querySelectorAll('.typeahead')).map((root) => new TypeaheadField(root));
    }

    function findTypeaheadByType(type) {
        return typeaheadFields.find((field) => field.type === type) || null;
    }

    function resetMetaForCreate() {
        if (eventForm) {
            eventForm.reset();
        }
        eventHeading.textContent = 'สร้างอีเว้นแบบร่าง';
        eventIdDisplay.textContent = 'ใหม่';
        if (eventCodeField) {
            eventCodeField.value = 'ใหม่';
        }
        if (refEventField) {
            refEventField.value = '';
        }
        if (allDayToggle) {
            allDayToggle.checked = false;
        }
        applyDateMode(false, { startValue: '', endValue: '', cacheValues: false });
        dateState.savedStart = '';
        dateState.savedEnd = '';
        eventLocation.textContent = 'สถานที่: —';
        lastUpdated.textContent = 'อัปเดตล่าสุด: —';
        if (eventCustomer) {
            eventCustomer.textContent = 'ลูกค้า : —';
        }
        updatedBy.textContent = 'ปรับปรุงโดย: —';
        createdAt.textContent = 'สร้างเมื่อ: —';
        createdBy.textContent = 'สร้างโดย: —';
        setStatus('draft');
        const inputsToClear = ['customerId', 'staffId', 'locationId'];
        inputsToClear.forEach((id) => {
            const el = document.getElementById(id);
            if (el) {
                el.value = '';
            }
        });
        const textAreas = ['customerInput', 'staffInput', 'locationInput', 'description', 'notes'];
        textAreas.forEach((id) => {
            const el = document.getElementById(id);
            if (el) {
                el.value = '';
            }
        });
        typeaheadFields.forEach((field) => field.setValue('', ''));
        if (customerHidden) {
            customerHidden.dataset.customerName = '';
            customerHidden.dataset.customerPhone = '';
            customerHidden.dataset.customerEmail = '';
        }
        updateEndDateMinimum();
        syncCustomerDisplayFromForm();
    }

    function populateForm(data) {
        eventHeading.textContent = data.event_name || `อีเว้น #${data.event_id}`;
        const displayCode = formatEventDisplay(data.ref_event_id, data.event_id);
        eventIdDisplay.textContent = displayCode;
        if (eventCodeField) {
            eventCodeField.value = formatBaseEventCode(data.event_id);
        }
        if (refEventField) {
            refEventField.value = data.ref_event_id || '';
        }
        const nameField = document.getElementById('eventName');
        if (nameField) {
            nameField.value = data.event_name || '';
        }
        const descriptionField = document.getElementById('description');
        if (descriptionField) {
            descriptionField.value = data.description || '';
        }
        const notesField = document.getElementById('notes');
        if (notesField) {
            notesField.value = data.notes || '';
        }
        const startSource = data.start_date || '';
        const endSource = data.end_date || '';
        const isAllDay = detectAllDayRange(startSource, endSource);
        if (allDayToggle) {
            allDayToggle.checked = isAllDay;
        }
        if (isAllDay) {
            dateState.savedStart = toDateInputValue(startSource) || '';
            dateState.savedEnd = toDateInputValue(endSource) || '';
            applyDateMode(true, {
                startValue: toDateOnlyValue(startSource),
                endValue: toDateOnlyValue(endSource),
            });
            updateCachedDateTimesFromCurrentDates();
        } else {
            applyDateMode(false, {
                startValue: toDateInputValue(startSource),
                endValue: toDateInputValue(endSource),
                cacheValues: false,
            });
        }
        setStatus(data.status || 'draft');
        syncLocationDisplayFromForm();
        lastUpdated.textContent = `อัปเดตล่าสุด: ${formatDisplayDate(data.updated_at)}`;
        updatedBy.textContent = `ปรับปรุงโดย: ${extractLabelName(data.updated_by_label) || 'ไม่ระบุ'}`;
        createdAt.textContent = `สร้างเมื่อ: ${formatDisplayDate(data.created_at)}`;
        createdBy.textContent = `สร้างโดย: ${extractLabelName(data.created_by_label) || 'ไม่ระบุ'}`;

        const customerField = findTypeaheadByType('customer');
        const customerMeta = {
            name: data.customer_name || '',
            phone: data.customer_phone || '',
            email: data.customer_email || '',
        };
        customerField?.setValue(data.customer_id ?? '', data.customer_label || '', customerMeta);
        const staffField = findTypeaheadByType('staff');
        staffField?.setValue(data.staff_id ?? '', data.staff_label || '');
        const locationField = findTypeaheadByType('location');
        locationField?.setValue(data.location_id ?? '', data.location_label || '');
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

    async function loadEvent() {
        if (!currentEventId) {
            resetMetaForCreate();
            ensureDefaultAssignee();
            return;
        }
        if (!modelRoot) {
            return;
        }
        try {
            const response = await fetch(`${modelRoot}/event_detail.php?id=${encodeURIComponent(currentEventId)}`, {
                credentials: 'same-origin',
            });
            if (!response.ok) {
                throw new Error('network');
            }
            const payload = await response.json();
            if (!payload?.data) {
                throw new Error('notfound');
            }
            populateForm(payload.data);
            syncLocationDisplayFromForm();
            syncCustomerDisplayFromForm();
        } catch (error) {
            showMessage('ไม่สามารถโหลดข้อมูลอีเว้นได้', 'error');
            lockForm();
        }
    }

    function lockForm() {
        if (!eventForm) return;
        eventForm.querySelectorAll('input, textarea, button').forEach((el) => {
            el.disabled = true;
        });
        btnSave.disabled = true;
        eventHeading.textContent = 'ไม่พบข้อมูลอีเว้น';
    }

    function collectPayload() {
        const datePayload = getDatePayloadValues();
        return {
            event_name: document.getElementById('eventName').value.trim(),
            customer_id: normalizeId(customerHidden?.value),
            staff_id: normalizeId(document.getElementById('staffId').value),
            location_id: normalizeId(document.getElementById('locationId').value),
            start_date: datePayload.start,
            end_date: datePayload.end,
            description: document.getElementById('description').value.trim(),
            notes: document.getElementById('notes').value.trim(),
            ref_event_id: refEventField ? refEventField.value.trim() : '',
            is_all_day: datePayload.allDay ? '1' : '0',
        };
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

    function ensureDefaultAssignee() {
        const staffField = findTypeaheadByType('staff');
        if (!staffField || !currentUser) {
            return;
        }
        const hasValue = Boolean(document.getElementById('staffId').value);
        if (!hasValue && currentUser.staff_id) {
            const rolePrefix = currentUser.role_key ? currentUser.role_key.charAt(0).toUpperCase() : 'S';
            const label = currentUser.full_name
                ? `${rolePrefix}${currentUser.staff_id} - ${currentUser.full_name}`
                : String(currentUser.staff_id); staffField.setValue(currentUser.staff_id, label);
            staffField.setValue(currentUser.staff_id, label);
        }
    }

    if (btnBack) {
        btnBack.addEventListener('click', () => {
            if (window.history.length > 1) {
                window.history.back();
            } else {
                window.location.href = './events.html';
            }
        });
    }

    if (allDayToggle) {
        allDayToggle.addEventListener('change', () => {
            applyDateMode(allDayToggle.checked);
            if (allDayToggle.checked) {
                if (startDateInput && endDateInput && !endDateInput.value && startDateInput.value) {
                    endDateInput.value = startDateInput.value;
                }
                updateCachedDateTimesFromCurrentDates();
            }
        });
    }

    if (startDateInput) {
        startDateInput.addEventListener('change', () => {
            if (allDayToggle?.checked && endDateInput && startDateInput.value) {
                if (!endDateInput.value || endDateInput.value < startDateInput.value) {
                    endDateInput.value = startDateInput.value;
                }
                updateCachedDateTimesFromCurrentDates();
            }
            updateEndDateMinimum();
        });
    }

    if (endDateInput) {
        endDateInput.addEventListener('change', () => {
            if (allDayToggle?.checked && startDateInput && endDateInput.value < startDateInput.value) {
                endDateInput.value = startDateInput.value;
            }
            if (allDayToggle?.checked) {
                updateCachedDateTimesFromCurrentDates();
            }
        });
    }

    eventForm?.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!modelRoot) {
            return;
        }
        const payload = collectPayload();
        if (!payload.event_name) {
            showMessage('กรุณากรอกชื่องาน', 'error');
            return;
        }
        if (!payload.staff_id && currentUser?.staff_id) {
            payload.staff_id = String(currentUser.staff_id);
            ensureDefaultAssignee();
        }
        if (!payload.staff_id) {
            showMessage('กรุณาเลือกผู้รับผิดชอบ', 'error');
            return;
        }
        if (!payload.customer_id) {
            showMessage('กรุณาเลือกลูกค้า', 'error');
            return;
        }
        if (!payload.location_id) {
            showMessage('กรุณาเลือกสถานที่จัดงาน', 'error');
            return;
        }
        if (!payload.start_date) {
            showMessage('กรุณาระบุวันเริ่มต้น', 'error');
            return;
        }
        if (!payload.end_date) {
            showMessage('กรุณาระบุวันสิ้นสุด', 'error');
            return;
        }
        const startDateObject = payload.start_date ? new Date(payload.start_date) : null;
        const endDateObject = payload.end_date ? new Date(payload.end_date) : null;
        if (startDateObject && endDateObject && startDateObject.getTime() > endDateObject.getTime()) {
            showMessage('วันสิ้นสุดต้องไม่ก่อนวันเริ่มต้น', 'error');
            return;
        }
        btnSave.disabled = true;
        showMessage('กำลังบันทึก...', 'info');

        try {
            if (!currentEventId) {
                await createEvent(payload);
            } else {
                await updateEvent(payload);
            }
        } catch (error) {
            showMessage('เกิดข้อผิดพลาดในการบันทึกข้อมูล โปรดลองอีกครั้ง', 'error');
        } finally {
            btnSave.disabled = false;
        }
    });

    async function createEvent(payload) {
        const requestBody = {
            ...payload,
        };
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
        showMessage('สร้างอีเว้นแบบร่างเรียบร้อยแล้ว', 'success');
        currentEventId = String(result.event_id);
        const baseCode = formatBaseEventCode(currentEventId);
        const displayCode = formatEventDisplay(result.ref_event_id, currentEventId);
        eventIdDisplay.textContent = displayCode;
        if (eventCodeField) {
            eventCodeField.value = baseCode;
        }
        if (refEventField) {
            refEventField.value = result.ref_event_id || '';
        }
        params.delete('mode');
        params.set('event_id', currentEventId);
        const newUrl = `${window.location.pathname}?${params.toString()}`;
        window.history.replaceState({}, '', newUrl);
        await loadEvent();
    }

    async function updateEvent(payload) {
        const requestBody = {
            event_id: currentEventId,
            status: currentStatus,
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
        showMessage('บันทึกข้อมูลเรียบร้อยแล้ว', 'success');
        if (Object.prototype.hasOwnProperty.call(result, 'status')) {
            setStatus(result.status);
        }
        if (Object.prototype.hasOwnProperty.call(result, 'updated_at')) {
            lastUpdated.textContent = `อัปเดตล่าสุด: ${formatDisplayDate(result.updated_at)}`;
        }
        if (Object.prototype.hasOwnProperty.call(result, 'updated_by_label')) {
            updatedBy.textContent = `ปรับปรุงโดย: ${extractLabelName(result.updated_by_label) || 'ไม่ระบุ'}`;
        }
        if (Object.prototype.hasOwnProperty.call(result, 'customer_label')) {
            const customerField = findTypeaheadByType('customer');
            const customerIdValue =
                Object.prototype.hasOwnProperty.call(result, 'customer_id') && result.customer_id != null
                    ? result.customer_id
                    : payload.customer_id;
            const hasCustomerMeta =
                Object.prototype.hasOwnProperty.call(result, 'customer_name') ||
                Object.prototype.hasOwnProperty.call(result, 'customer_phone') ||
                Object.prototype.hasOwnProperty.call(result, 'customer_email');
            const customerMeta = hasCustomerMeta
                ? {
                      name: result.customer_name ?? '',
                      phone: result.customer_phone ?? '',
                      email: result.customer_email ?? '',
                  }
                : null;
            customerField?.setValue(customerIdValue ?? '', result.customer_label || '', customerMeta);
        }
        if (Object.prototype.hasOwnProperty.call(result, 'staff_label')) {
            findTypeaheadByType('staff')?.setValue(result.staff_id ?? payload.staff_id ?? '', result.staff_label || '');
        }
        if (Object.prototype.hasOwnProperty.call(result, 'location_label')) {
            findTypeaheadByType('location')?.setValue(result.location_id ?? payload.location_id ?? '', result.location_label || '');
        }
        if (Object.prototype.hasOwnProperty.call(result, 'ref_event_id')) {
            if (refEventField) {
                refEventField.value = result.ref_event_id || '';
            }
            eventIdDisplay.textContent = formatEventDisplay(result.ref_event_id, currentEventId);
        }
        if (eventCodeField) {
            eventCodeField.value = formatBaseEventCode(currentEventId);
        }
        syncLocationDisplayFromForm();
        syncCustomerDisplayFromForm();
    }

    const boot = ({ root, user }) => {
        modelRoot = `${root}/Model`;
        currentUser = user;
        updateThaiDate();
        setInterval(updateThaiDate, 1000);
        initTypeahead();
        if (!currentEventId && !isCreateRequested && eventIdParam) {
            currentEventId = eventIdParam;
        }
        if (!currentEventId && eventIdParam && isCreateRequested) {
            currentEventId = null;
        }
        loadEvent();
        ensureDefaultAssignee();
    };

    if (typeof window.onAppReady === 'function') {
        window.onAppReady(boot);
    }
})();