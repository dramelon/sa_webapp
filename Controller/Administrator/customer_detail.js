(function () {
    const form = document.getElementById('customerForm');
    const messageBox = document.getElementById('formMessage');
    const heading = document.getElementById('customerHeading');
    const codeField = document.getElementById('customerCode');
    const nameField = document.getElementById('customerName');
    const orgField = document.getElementById('customerOrg');
    const emailField = document.getElementById('customerEmail');
    const phoneField = document.getElementById('customerPhone');
    const taxField = document.getElementById('customerTax');
    const statusField = document.getElementById('customerStatus');
    const locationField = document.getElementById('customerLocation');
    const notesField = document.getElementById('customerNotes');
    const backButton = document.getElementById('btnBack');
    const saveButton = document.getElementById('btnSave');
    const breadcrumbLink = document.querySelector('.breadcrumb a');

    const params = new URLSearchParams(window.location.search);
    const customerIdParam = params.get('customer_id');
    const isCreateRequested = params.get('mode') === 'create';
    let currentCustomerId = customerIdParam ? String(customerIdParam) : null;
    let isCreateMode = !currentCustomerId || isCreateRequested;
    let modelRoot = '';
    let isDirty = false;
    let initialSnapshot = null;
    let isSaving = false;

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

    function showMessage(message, variant = 'info') {
        if (!messageBox) return;
        if (!message) {
            messageBox.hidden = true;
            messageBox.textContent = '';
            messageBox.className = 'form-alert';
            return;
        }
        messageBox.textContent = message;
        messageBox.hidden = false;
        messageBox.className = `form-alert ${variant}`;
    }

    function serializeForm() {
        return {
            customer_name: nameField?.value.trim() || '',
            org_name: orgField?.value.trim() || '',
            email: emailField?.value.trim() || '',
            phone: phoneField?.value.trim() || '',
            tax_id: taxField?.value.trim() || '',
            status: statusField?.value || 'active',
            location_id: locationField?.value || '',
            notes: notesField?.value.trim() || '',
        };
    }

    function setDirty(next) {
        if (isDirty === next) {
            return;
        }
        isDirty = next;
        if (saveButton) {
            saveButton.disabled = isSaving || !isDirty;
        }
    }

    function populateForm(data) {
        const snapshot = {
            customer_name: data.customer_name || '',
            org_name: data.organization || '',
            email: data.email || '',
            phone: data.phone || '',
            tax_id: data.tax_id || '',
            status: data.status || 'active',
            location_id: data.location_id != null ? String(data.location_id) : '',
            notes: data.notes || '',
        };
        nameField.value = snapshot.customer_name;
        orgField.value = snapshot.org_name;
        emailField.value = snapshot.email;
        phoneField.value = snapshot.phone;
        taxField.value = snapshot.tax_id;
        statusField.value = snapshot.status;
        locationField.value = snapshot.location_id;
        notesField.value = snapshot.notes;
        initialSnapshot = serializeForm();
        setDirty(false);
    }

    function prepareCreateMode() {
        isCreateMode = true;
        currentCustomerId = null;
        if (heading) {
            heading.textContent = 'สร้างลูกค้าใหม่';
        }
        if (codeField) {
            codeField.value = 'ใหม่';
        }
        form?.reset();
        if (statusField) {
            statusField.value = 'active';
        }
        initialSnapshot = serializeForm();
        setDirty(false);
        showMessage('');
    }

    async function loadCustomer(id) {
        if (!modelRoot || !id) {
            prepareCreateMode();
            return;
        }
        try {
            const response = await fetch(`${modelRoot}/customer_detail.php?id=${encodeURIComponent(id)}`, {
                credentials: 'same-origin',
            });
            if (!response.ok) {
                if (response.status === 404) {
                    showMessage('ไม่พบข้อมูลลูกค้า', 'error');
                    prepareCreateMode();
                    return;
                }
                throw new Error('network');
            }
            const payload = await response.json();
            if (!payload || !payload.data) {
                throw new Error('invalid');
            }
            const data = payload.data;
            currentCustomerId = String(data.customer_id);
            isCreateMode = false;
            heading.textContent = data.customer_name || `ลูกค้า #${currentCustomerId}`;
            codeField.value = currentCustomerId;
            populateForm(data);
        } catch (error) {
            showMessage('ไม่สามารถโหลดข้อมูลลูกค้าได้', 'error');
        }
    }

    function getPayload() {
        const snapshot = serializeForm();
        const result = { ...snapshot };
        if (!snapshot.location_id) {
            delete result.location_id;
        }
        return result;
    }

    async function createCustomer(payload) {
        const response = await fetch(`${modelRoot}/customer_create.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify(payload),
        });
        if (!response.ok) {
            throw new Error('network');
        }
        const result = await response.json();
        if (!result || !result.success || !result.data) {
            throw new Error(result?.error || 'unknown');
        }
        return result.data;
    }

    async function updateCustomer(payload) {
        const response = await fetch(`${modelRoot}/customer_update.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ customer_id: currentCustomerId, ...payload }),
        });
        if (!response.ok) {
            throw new Error('network');
        }
        const result = await response.json();
        if (!result || !result.success || !result.data) {
            throw new Error(result?.error || 'unknown');
        }
        return result.data;
    }

    async function handleSubmit(event) {
        event.preventDefault();
        if (!form || !modelRoot) return;
        const nameValue = nameField.value.trim();
        if (!nameValue) {
            showMessage('กรุณากรอกชื่อลูกค้า', 'error');
            nameField.focus();
            return;
        }
        const statusValue = statusField.value;
        if (!['active', 'inactive'].includes(statusValue)) {
            showMessage('สถานะไม่ถูกต้อง', 'error');
            return;
        }
        const payload = getPayload();
        payload.status = statusValue;
        isSaving = true;
        setDirty(false);
        if (saveButton) {
            saveButton.disabled = true;
        }
        showMessage('กำลังบันทึก...', 'info');
        try {
            const data = isCreateMode ? await createCustomer(payload) : await updateCustomer(payload);
            currentCustomerId = String(data.customer_id);
            if (codeField) {
                codeField.value = currentCustomerId;
            }
            if (heading) {
                heading.textContent = data.customer_name || `ลูกค้า #${currentCustomerId}`;
            }
            populateForm(data);
            setDirty(false);
            showMessage(isCreateMode ? 'สร้างลูกค้าเรียบร้อยแล้ว' : 'บันทึกข้อมูลลูกค้าเรียบร้อยแล้ว', 'success');
            if (isCreateMode) {
                params.set('customer_id', currentCustomerId);
                params.delete('mode');
                const newQuery = params.toString();
                const newUrl = newQuery ? `${window.location.pathname}?${newQuery}` : window.location.pathname;
                window.history.replaceState({}, '', newUrl);
                isCreateMode = false;
            }
        } catch (error) {
            setDirty(true);
            showMessage('ไม่สามารถบันทึกข้อมูลลูกค้าได้ โปรดลองอีกครั้ง', 'error');
        } finally {
            isSaving = false;
            if (saveButton) {
                saveButton.disabled = !isDirty;
            }
        }
    }

    function requestNavigation(action) {
        if (!isDirty) {
            action();
            return;
        }
        const confirmLeave = window.confirm('มีการเปลี่ยนแปลงที่ยังไม่บันทึก ต้องการออกจากหน้านี้หรือไม่?');
        if (confirmLeave) {
            action();
        }
    }

    if (form) {
        form.addEventListener('submit', handleSubmit);
        form.addEventListener('input', () => {
            if (!initialSnapshot) return;
            const snapshot = serializeForm();
            const keys = Object.keys(snapshot);
            const dirty = keys.some((key) => snapshot[key] !== initialSnapshot[key]);
            setDirty(dirty);
        });
    }

    if (backButton) {
        backButton.addEventListener('click', () => {
            requestNavigation(() => {
                window.history.length > 1 ? window.history.back() : (window.location.href = './customers.html');
            });
        });
    }

    if (breadcrumbLink) {
        breadcrumbLink.addEventListener('click', (event) => {
            event.preventDefault();
            const href = breadcrumbLink.getAttribute('href') || './customers.html';
            requestNavigation(() => {
                window.location.href = href;
            });
        });
    }

    window.addEventListener('beforeunload', (event) => {
        if (!isDirty) return;
        event.preventDefault();
        event.returnValue = '';
    });

    const boot = ({ root }) => {
        modelRoot = `${root}/Model`;
        updateThaiDate();
        setInterval(updateThaiDate, 1000);
        if (isCreateMode) {
            prepareCreateMode();
        } else {
            loadCustomer(currentCustomerId);
        }
    };

    if (typeof window.onAppReady === 'function') {
        window.onAppReady(boot);
    }
})();