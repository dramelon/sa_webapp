// Drawer toggle and scrim
const drawer = document.getElementById('drawer');
const scrim = document.getElementById('scrim');
const btnMenu = document.getElementById('btnMenu');

function openDrawer() {
    drawer.classList.add('open');
    scrim.hidden = false;
}

function closeDrawer() {
    drawer.classList.remove('open');
    scrim.hidden = true;
}

btnMenu.addEventListener('click', () => {
    if (drawer.classList.contains('open')) {
        closeDrawer();
    } else {
        openDrawer();
    }
});
scrim.addEventListener('click', closeDrawer);

window.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
        closeDrawer();
    }
});

// Populate profile pill
(async () => {
    try {
        const response = await fetch('../Model/session_user.php', { credentials: 'same-origin' });
        if (!response.ok) {
            throw new Error('unauth');
        }
        const payload = await response.json();
        document.getElementById('fullName').textContent = payload.full_name || 'ผู้ใช้งาน';
        const avatar = document.getElementById('avatar');
        if (payload.avatar) {
            avatar.src = payload.avatar;
        } else {
            avatar.removeAttribute('src');
        }
    } catch (error) {
        location.href = '../View/login.html?error=unauth';
    }
})();

// Date header
function updateThaiDate() {
    const now = new Date();
    const days = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
    const months = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
        'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
    const day = days[now.getDay()];
    const date = now.getDate();
    const month = months[now.getMonth()];
    const year = now.getFullYear() + 543;
    const time = now.toLocaleTimeString('th-TH', { hour12: false });
    const text = `วัน${day}ที่ ${date} ${month} ${year} เวลา ${time}`;
    const el = document.getElementById('pageDate');
    if (el) {
        el.textContent = text;
    }
}
updateThaiDate();
setInterval(updateThaiDate, 1000);

const eventForm = document.getElementById('eventForm');
const formMessage = document.getElementById('formMessage');
const eventHeading = document.getElementById('eventHeading');
const eventIdDisplay = document.getElementById('eventIdDisplay');
const eventLocation = document.getElementById('eventLocation');
const statusBadge = document.getElementById('statusBadge');
const statusText = document.getElementById('statusText');
const lastUpdated = document.getElementById('lastUpdated');
const createdAt = document.getElementById('createdAt');
const btnBack = document.getElementById('btnBack');
const btnSave = document.getElementById('btnSave');

const statusMeta = {
    draft: { label: 'ร่าง', className: 'draft' },
    planning: { label: 'วางแผน', className: 'planning' },
    waiting: { label: 'รอดำเนินการ', className: 'waiting' },
    processing: { label: 'กำลังดำเนินการ', className: 'processing' },
    billing: { label: 'เรียกเก็บเงิน', className: 'billing' },
    completed: { label: 'เสร็จสิ้น', className: 'completed' },
    cancelled: { label: 'ยกเลิก', className: 'cancelled' }
};

const params = new URLSearchParams(location.search);
const eventId = params.get('event_id');

if (!eventId) {
    lockForm('ไม่พบรหัสอีเว้นที่ต้องการเปิด');
}

btnBack.addEventListener('click', () => {
    if (window.history.length > 1) {
        window.history.back();
    } else {
        window.location.href = './events.html';
    }
});

function lockForm(message) {
    eventForm.querySelectorAll('input, textarea, select, button').forEach(el => {
        el.disabled = true;
    });
    btnSave.disabled = true;
    eventHeading.textContent = 'ไม่พบข้อมูลอีเว้น';
    showMessage(message, 'error');
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
    if (meta) {
        statusBadge.dataset.status = normalized;
        statusText.textContent = `สถานะ: ${meta.label}`;
    } else {
        statusBadge.dataset.status = 'draft';
        statusText.textContent = `สถานะ: ${statusKey || 'ไม่ระบุ'}`;
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
        hour12: false
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
    const pad = num => String(num).padStart(2, '0');
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    return `${year}-${month}-${day}T${hours}:${minutes}`;
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
            if (value === '') {
                this.hidden.value = '';
            }
        });

        this.input.addEventListener('focus', () => {
            const value = this.input.value.trim();
            this.fetch(value);
        });

        document.addEventListener('click', event => {
            if (!this.root.contains(event.target)) {
                this.closeList();
            }
        });
    }

    setValue(id, label) {
        this.hidden.value = id == null ? '' : id;
        this.input.value = label || '';
    }

    async fetch(query) {
        const token = ++this.activeRequest;
        try {
            const params = new URLSearchParams({ type: this.type });
            if (query) {
                params.set('q', query);
            }
            const response = await fetch(`../Model/lookup_search.php?${params.toString()}`, { credentials: 'same-origin' });
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

const typeaheadFields = Array.from(document.querySelectorAll('.typeahead')).map(root => new TypeaheadField(root));

function findTypeaheadByType(type) {
    return typeaheadFields.find(field => field.type === type) || null;
}

async function loadEvent() {
    if (!eventId) {
        return;
    }
    try {
        const response = await fetch(`../Model/event_detail.php?id=${encodeURIComponent(eventId)}`, { credentials: 'same-origin' });
        if (!response.ok) {
            throw new Error('network');
        }
        const payload = await response.json();
        if (!payload || !payload.data) {
            throw new Error('notfound');
        }
        populateForm(payload.data);
    } catch (error) {
        lockForm('ไม่สามารถโหลดข้อมูลอีเว้นได้');
    }
}

function populateForm(data) {
    eventHeading.textContent = data.event_name || 'ไม่พบข้อมูลอีเว้น';
    eventIdDisplay.textContent = data.event_id != null ? `EV-${data.event_id}` : '—';
    document.getElementById('eventName').value = data.event_name || '';
    document.getElementById('eventStatus').value = data.status || 'draft';
    document.getElementById('startDate').value = toDateInputValue(data.start_date || '');
    document.getElementById('endDate').value = toDateInputValue(data.end_date || '');
    document.getElementById('description').value = data.description || '';
    document.getElementById('notes').value = data.notes || '';
    document.getElementById('picturePath').value = data.picture_path || '';
    document.getElementById('filePath').value = data.file_path || '';

    setStatus(data.status);

    const customerField = findTypeaheadByType('customer');
    if (customerField) {
        customerField.setValue(data.customer_id ?? '', data.customer_label || '');
    }
    const staffField = findTypeaheadByType('staff');
    if (staffField) {
        staffField.setValue(data.staff_id ?? '', data.staff_label || '');
    }
    const locationField = findTypeaheadByType('location');
    if (locationField) {
        locationField.setValue(data.location_id ?? '', data.location_label || '');
    }

    const locationText = data.location_label ? data.location_label.split(' - ').slice(1).join(' - ').trim() : '';
    eventLocation.textContent = `สถานที่: ${locationText || 'ไม่ระบุ'}`;
    lastUpdated.textContent = `อัปเดตล่าสุด: ${formatDisplayDate(data.updated_at)}`;
    createdAt.textContent = `สร้างเมื่อ: ${formatDisplayDate(data.created_at)}`;
}

eventForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (!eventId) {
        return;
    }
    btnSave.disabled = true;
    showMessage('กำลังบันทึก...', 'info');

    const payload = {
        event_id: eventId,
        event_name: document.getElementById('eventName').value.trim(),
        status: document.getElementById('eventStatus').value,
        customer_id: normalizeId(document.getElementById('customerId').value),
        staff_id: normalizeId(document.getElementById('staffId').value),
        location_id: normalizeId(document.getElementById('locationId').value),
        start_date: document.getElementById('startDate').value,
        end_date: document.getElementById('endDate').value,
        description: document.getElementById('description').value.trim(),
        notes: document.getElementById('notes').value.trim(),
        picture_path: document.getElementById('picturePath').value.trim(),
        file_path: document.getElementById('filePath').value.trim()
    };

    try {
        const response = await fetch('../Model/event_update.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            throw new Error('network');
        }
        const result = await response.json();
        if (!result.success) {
            throw new Error(result.error || 'unknown');
        }
        showMessage('บันทึกการเปลี่ยนแปลงเรียบร้อยแล้ว', 'success');
        const latestName = document.getElementById('eventName').value.trim();
        if (latestName) {
            eventHeading.textContent = latestName;
        }
        setStatus(result.status || payload.status);
        lastUpdated.textContent = `อัปเดตล่าสุด: ${formatDisplayDate(result.updated_at || '')}`;
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
            const locationLabel = result.location_label || '';
            const locationText = locationLabel ? locationLabel.split(' - ').slice(1).join(' - ').trim() : '';
            eventLocation.textContent = `สถานที่: ${locationText || 'ไม่ระบุ'}`;
        }
    } catch (error) {
        showMessage('เกิดข้อผิดพลาดในการบันทึกข้อมูล โปรดลองใหม่อีกครั้ง', 'error');
    } finally {
        btnSave.disabled = false;
    }
});

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

loadEvent();