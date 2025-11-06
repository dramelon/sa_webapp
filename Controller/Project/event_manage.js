(function () {
    const eventForm = document.getElementById('eventForm');
    const formMessage = document.getElementById('formMessage');
    const eventHeading = document.getElementById('eventHeading');
    const eventIdDisplay = document.getElementById('eventIdDisplay');
    const eventLocation = document.getElementById('eventLocation');
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

    function syncLocationDisplayFromForm() {
        if (!eventLocation) {
            return;
        }
        const value = document.getElementById('locationInput').value.trim();
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
                    this.hidden.value = item.id ?? '';
                    this.input.value = item.label || '';
                    this.closeList();
                    if (this.type === 'location') {
                        syncLocationDisplayFromForm();
                    }
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

        setValue(id, label) {
            if (this.hidden) {
                this.hidden.value = id ?? '';
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
        eventHeading.textContent = 'สร้างอีเว้นแบบร่าง';
        eventIdDisplay.textContent = 'ใหม่';
        eventLocation.textContent = 'สถานที่: —';
        lastUpdated.textContent = 'อัปเดตล่าสุด: —';
        updatedBy.textContent = 'ปรับปรุงโดย: —';
        createdAt.textContent = 'สร้างเมื่อ: —';
        createdBy.textContent = 'สร้างโดย: —';
        setStatus('draft');
    }

    function populateForm(data) {
        eventHeading.textContent = data.event_name || `อีเว้น #${data.event_id}`;
        eventIdDisplay.textContent = data.event_id ? `EV-${data.event_id}` : '—';
        document.getElementById('eventName').value = data.event_name || '';
        document.getElementById('description').value = data.description || '';
        document.getElementById('notes').value = data.notes || '';
        document.getElementById('startDate').value = toDateInputValue(data.start_date || '');
        document.getElementById('endDate').value = toDateInputValue(data.end_date || '');
        setStatus(data.status || 'draft');
        syncLocationDisplayFromForm();
        lastUpdated.textContent = `อัปเดตล่าสุด: ${formatDisplayDate(data.updated_at)}`;
        updatedBy.textContent = `ปรับปรุงโดย: ${extractLabelName(data.updated_by_label) || 'ไม่ระบุ'}`;
        createdAt.textContent = `สร้างเมื่อ: ${formatDisplayDate(data.created_at)}`;
        createdBy.textContent = `สร้างโดย: ${extractLabelName(data.created_by_label) || 'ไม่ระบุ'}`;

        const customerField = findTypeaheadByType('customer');
        customerField?.setValue(data.customer_id ?? '', data.customer_label || '');
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
        return {
            event_name: document.getElementById('eventName').value.trim(),
            customer_id: normalizeId(document.getElementById('customerId').value),
            staff_id: normalizeId(document.getElementById('staffId').value),
            location_id: normalizeId(document.getElementById('locationId').value),
            start_date: document.getElementById('startDate').value,
            end_date: document.getElementById('endDate').value,
            description: document.getElementById('description').value.trim(),
            notes: document.getElementById('notes').value.trim(),
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
            const label = currentUser.full_name ? `${currentUser.role_key ? currentUser.role_key.charAt(0).toUpperCase() : 'S'}${currentUser.staff_id} - ${currentUser.full_name}` : String(currentUser.staff_id);
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
            findTypeaheadByType('customer')?.setValue(result.customer_id ?? payload.customer_id ?? '', result.customer_label || '');
        }
        if (Object.prototype.hasOwnProperty.call(result, 'staff_label')) {
            findTypeaheadByType('staff')?.setValue(result.staff_id ?? payload.staff_id ?? '', result.staff_label || '');
        }
        if (Object.prototype.hasOwnProperty.call(result, 'location_label')) {
            findTypeaheadByType('location')?.setValue(result.location_id ?? payload.location_id ?? '', result.location_label || '');
        }
        syncLocationDisplayFromForm();
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