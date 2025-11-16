(function () {
    const form = document.getElementById('customerForm');
    const messageBox = document.getElementById('formMessage');
    const heading = document.getElementById('customerHeading');
    const codeField = document.getElementById('customerCode');
    const refField = document.getElementById('customerRefCode');
    const nameField = document.getElementById('customerName');
    const orgField = document.getElementById('customerOrg');
    const contactField = document.getElementById('customerContact');
    const emailField = document.getElementById('customerEmail');
    const phoneField = document.getElementById('customerPhone');
    const taxField = document.getElementById('customerTax');
    const statusField = document.getElementById('customerStatus');
    const notesField = document.getElementById('customerNotes');
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
    const locationEditBtn = document.getElementById('locationEditBtn');
    const metaRefs = {
        id: document.getElementById('customerIdDisplay'),
        ref: document.getElementById('customerRef'),
        statusMeta: document.getElementById('customerStatusMeta'),
        statusBadge: document.getElementById('customerStatusBadge'),
        statusText: document.getElementById('customerStatusText'),
        createdAt: document.getElementById('customerCreatedAt'),
        createdBy: document.getElementById('customerCreatedBy'),
        updatedAt: document.getElementById('customerUpdatedAt'),
        updatedBy: document.getElementById('customerUpdatedBy'),
    };
    const locationModal = document.getElementById('locationModal');
    const locationModalForm = document.getElementById('locationModalForm');
    const locationModalMessage = document.getElementById('locationModalMessage');
    const locationModalSave = document.getElementById('locationModalSave');
    const locationModalTitle = document.getElementById('locationModalTitle');
    const locationModalFields = {
        name: document.getElementById('locationModalName'),
        house: document.getElementById('locationModalHouse'),
        village: document.getElementById('locationModalVillage'),
        building: document.getElementById('locationModalBuilding'),
        floor: document.getElementById('locationModalFloor'),
        room: document.getElementById('locationModalRoom'),
        street: document.getElementById('locationModalStreet'),
        subdistrict: document.getElementById('locationModalSubdistrict'),
        district: document.getElementById('locationModalDistrict'),
        province: document.getElementById('locationModalProvince'),
        postal: document.getElementById('locationModalPostal'),
        country: document.getElementById('locationModalCountry'),
        notes: document.getElementById('locationModalNotes'),
    };

    const params = new URLSearchParams(window.location.search);
    const customerIdParam = params.get('customer_id');
    const isCreateRequested = params.get('mode') === 'create';
    let currentCustomerId = customerIdParam ? String(customerIdParam) : null;
    let isCreateMode = !currentCustomerId || isCreateRequested;
    let modelRoot = '';
    let isDirty = false;
    let isSaving = false;
    let initialSnapshot = null;
    let pendingNavigationAction = null;
    let isPopulating = false;
    let locationLookup = null;
    let activeModal = null;
    let instantCreatePending = false;

    if (unsavedModal) {
        unsavedModal.setAttribute('aria-hidden', unsavedModal.hidden ? 'true' : 'false');
    }

    updateSaveButtonState();

    function updateThaiDate() {
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
    }

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

    function preventEnterSubmit(targetForm) {
        if (!targetForm) return;
        targetForm.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter') return;
            const target = event.target;
            if (!target || !target.tagName) return;
            const tagName = target.tagName.toUpperCase();
            if (tagName === 'TEXTAREA' || tagName === 'BUTTON') return;
            const type = target.type ? String(target.type).toLowerCase() : '';
            if (type === 'submit') return;
            event.preventDefault();
        });
    }

    function updateSaveButtonState() {
        const disable = isSaving || !isDirty;
        if (btnSave) btnSave.disabled = disable;
        if (btnSaveInline) btnSaveInline.disabled = disable;
    }

    function setDirtyState(next) {
        if (isDirty === next) {
            updateSaveButtonState();
            return;
        }
        isDirty = next;
        if (unsavedBanner) {
            unsavedBanner.hidden = !isDirty;
        }
        updateSaveButtonState();
    }

    function runWithPopulation(callback) {
        const prev = isPopulating;
        isPopulating = true;
        try {
            callback();
        } finally {
            isPopulating = prev;
        }
    }

    function serializeForm() {
        return {
            ref_customer_id: refField?.value.trim() || '',
            customer_name: nameField?.value.trim() || '',
            org_name: orgField?.value.trim() || '',
            contact_person: contactField?.value.trim() || '',
            email: emailField?.value.trim() || '',
            phone: phoneField?.value.trim() || '',
            tax_id: taxField?.value.trim() || '',
            status: statusField?.value || 'active',
            location_id: locationHidden?.value || '',
            location_label: locationInput?.value || '',
            notes: notesField?.value.trim() || '',
        };
    }

    function handleFieldMutated() {
        if (isSaving || isPopulating || !initialSnapshot) {
            updateSaveButtonState();
            return;
        }
        const current = serializeForm();
        const dirty = JSON.stringify(current) !== JSON.stringify(initialSnapshot);
        setDirtyState(dirty);
    }

    function formatDateTime(value) {
        if (!value) return '—';
        const date = new Date(String(value).replace(' ', 'T'));
        if (Number.isNaN(date.getTime())) {
            return String(value);
        }
        return date.toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
    }

    function applyStatusChip(status) {
        if (!metaRefs.statusBadge || !metaRefs.statusText) return;
        const normalized = typeof status === 'string' ? status.toLowerCase() : '';
        let displayText = '—';
        if (normalized === 'active') displayText = 'ใช้งาน';
        if (normalized === 'inactive') displayText = 'ปิดใช้งาน';
        metaRefs.statusText.textContent = `สถานะ: ${displayText}`;
        if (normalized === 'active' || normalized === 'inactive') {
            metaRefs.statusBadge.dataset.status = normalized;
        } else {
            delete metaRefs.statusBadge.dataset.status;
        }
    }

    function updateMeta(data) {
        if (metaRefs.id) {
            metaRefs.id.textContent = data?.customer_id != null ? String(data.customer_id) : '—';
        }
        if (metaRefs.ref) {
            const refText = data?.ref_customer_id ? data.ref_customer_id : '—';
            metaRefs.ref.textContent = `รหัสอ้างอิง: ${refText}`;
        }
        if (metaRefs.statusMeta) {
            const label = data?.status === 'active' ? 'ใช้งาน' : data?.status === 'inactive' ? 'ปิดใช้งาน' : '—';
            metaRefs.statusMeta.textContent = `สถานะ: ${label}`;
        }
        applyStatusChip(data?.status);
        if (metaRefs.createdAt) {
            metaRefs.createdAt.textContent = `สร้างเมื่อ: ${formatDateTime(data?.created_at)}`;
        }
        if (metaRefs.createdBy) {
            metaRefs.createdBy.textContent = `สร้างโดย: ${data?.created_by_label || '—'}`;
        }
        if (metaRefs.updatedAt) {
            metaRefs.updatedAt.textContent = `อัปเดตล่าสุด: ${formatDateTime(data?.updated_at)}`;
        }
        if (metaRefs.updatedBy) {
            metaRefs.updatedBy.textContent = `ปรับปรุงโดย: ${data?.updated_by_label || '—'}`;
        }
    }

    function formatLocationLabel(id, name) {
        if (!id) {
            return '';
        }
        const numeric = Number(id);
        const idText = Number.isFinite(numeric) ? numeric : String(id);
        const displayName = (name || '').trim() || 'ไม่ระบุสถานที่';
        return `${idText} - ${displayName}`;
    }

    function applyLocationSelection(idValue, label) {
        runWithPopulation(() => {
            if (locationLookup) {
                locationLookup.setValue(idValue, label);
            } else {
                if (locationHidden) locationHidden.value = idValue || '';
                if (locationInput) locationInput.value = label || '';
                updateLocationActionState();
            }
        });
        handleFieldMutated();
    }

    function populateForm(data) {
        const snapshot = {
            ref_customer_id: data?.ref_customer_id || '',
            customer_name: data?.customer_name || '',
            org_name: data?.organization || '',
            contact_person: data?.contact_person || '',
            email: data?.email || '',
            phone: data?.phone || '',
            tax_id: data?.tax_id || '',
            status: data?.status || 'active',
            notes: data?.notes || '',
            location_id: data?.location_id != null ? String(data.location_id) : '',
            location_label:
                data?.location_id != null
                    ? formatLocationLabel(data.location_id, data?.location_name || '')
                    : '',
        };

        runWithPopulation(() => {
            if (refField) refField.value = snapshot.ref_customer_id;
            if (nameField) nameField.value = snapshot.customer_name;
            if (orgField) orgField.value = snapshot.org_name;
            if (contactField) contactField.value = snapshot.contact_person;
            if (emailField) emailField.value = snapshot.email;
            if (phoneField) phoneField.value = snapshot.phone;
            if (taxField) taxField.value = snapshot.tax_id;
            if (statusField) statusField.value = snapshot.status;
            if (notesField) notesField.value = snapshot.notes;
            if (locationLookup) {
                locationLookup.setValue(snapshot.location_id, snapshot.location_label);
            } else {
                if (locationHidden) locationHidden.value = snapshot.location_id;
                if (locationInput) locationInput.value = snapshot.location_label;
                updateLocationActionState();
            }
        });

        updateMeta(data);
        if (heading) {
            heading.textContent = data?.customer_name || (data?.customer_id ? `ลูกค้า #${data.customer_id}` : 'รายละเอียดลูกค้า');
        }
        if (codeField) {
            codeField.value = data?.customer_id != null ? String(data.customer_id) : 'ใหม่';
        }
        initialSnapshot = serializeForm();
        setDirtyState(false);
        showMessage('');
    }

    function restoreSnapshot(snapshot) {
        if (!snapshot) {
            return;
        }
        runWithPopulation(() => {
            if (refField) refField.value = snapshot.ref_customer_id || '';
            if (nameField) nameField.value = snapshot.customer_name || '';
            if (orgField) orgField.value = snapshot.org_name || '';
            if (contactField) contactField.value = snapshot.contact_person || '';
            if (emailField) emailField.value = snapshot.email || '';
            if (phoneField) phoneField.value = snapshot.phone || '';
            if (taxField) taxField.value = snapshot.tax_id || '';
            if (statusField) statusField.value = snapshot.status || 'active';
            if (notesField) notesField.value = snapshot.notes || '';
            if (locationLookup) {
                locationLookup.setValue(snapshot.location_id || '', snapshot.location_label || '');
            } else {
                if (locationHidden) locationHidden.value = snapshot.location_id || '';
                if (locationInput) locationInput.value = snapshot.location_label || '';
                updateLocationActionState();
            }
        });
        setDirtyState(false);
    }

    function prepareCreateMode() {
        isCreateMode = true;
        currentCustomerId = null;
        if (heading) {
            heading.textContent = 'สร้างลูกค้าใหม่';
        }
        runWithPopulation(() => {
            form?.reset();
            if (codeField) {
                codeField.value = 'ใหม่';
            }
            if (statusField) {
                statusField.value = 'active';
            }
            if (locationLookup) {
                locationLookup.setValue('', '');
            } else {
                if (locationHidden) locationHidden.value = '';
                if (locationInput) locationInput.value = '';
                updateLocationActionState();
            }
        });
        updateMeta({});
        initialSnapshot = serializeForm();
        setDirtyState(false);
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
            populateForm(data);
        } catch (error) {
            showMessage('ไม่สามารถโหลดข้อมูลลูกค้าได้', 'error');
            prepareCreateMode();
        }
    }

    function getPayload() {
        const snapshot = serializeForm();
        const payload = { ...snapshot };
        if (!payload.location_id) {
            delete payload.location_id;
        }
        delete payload.location_label;
        return payload;
    }

    async function createCustomer(payload) {
        const response = await fetch(`${modelRoot}/customer_create.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify(payload),
        });
        if (!response.ok) {
            if (response.status === 409) {
                throw new Error('ref_customer_exists');
            }
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
            if (response.status === 409) {
                throw new Error('ref_customer_exists');
            }
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
        const nameValue = nameField?.value.trim() || '';
        if (!nameValue) {
            showMessage('กรุณากรอกชื่อลูกค้า', 'error');
            nameField?.focus();
            return;
        }
        const payload = getPayload();
        isSaving = true;
        setDirtyState(false);
        updateSaveButtonState();
        showMessage('กำลังบันทึก...', 'info');
        try {
            const wasCreate = isCreateMode;
            const data = wasCreate ? await createCustomer(payload) : await updateCustomer(payload);
            currentCustomerId = String(data.customer_id);
            isCreateMode = false;
            params.set('customer_id', currentCustomerId);
            params.delete('mode');
            const newQuery = params.toString();
            const newUrl = newQuery ? `${window.location.pathname}?${newQuery}` : window.location.pathname;
            window.history.replaceState({}, '', newUrl);
            populateForm(data);
            showMessage(wasCreate ? 'สร้างลูกค้าเรียบร้อยแล้ว' : 'บันทึกข้อมูลลูกค้าเรียบร้อยแล้ว', 'success');
            try {
                sessionStorage.setItem('customers:refresh', '1');
            } catch (storageError) {
                // ignore storage errors
            }
            closeUnsavedModal();
            if (typeof pendingNavigationAction === 'function') {
                const action = pendingNavigationAction;
                pendingNavigationAction = null;
                action();
            }
        } catch (error) {
            setDirtyState(true);
            if (error.message === 'ref_customer_exists') {
                showMessage('รหัสอ้างอิงนี้ถูกใช้แล้ว กรุณาเลือกใหม่', 'error');
            } else if (error.message === 'network') {
                showMessage('ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้ โปรดลองอีกครั้ง', 'error');
            } else {
                showMessage('ไม่สามารถบันทึกข้อมูลลูกค้าได้ โปรดลองอีกครั้ง', 'error');
            }
        } finally {
            isSaving = false;
            updateSaveButtonState();
        }
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
        if (!form || isSaving) {
            return;
        }
        if (typeof form.requestSubmit === 'function') {
            form.requestSubmit(btnSave);
        } else if (btnSave) {
            btnSave.click();
        }
    }

    function requestNavigation(action) {
        if (!isDirty) {
            action();
            return;
        }
        pendingNavigationAction = action;
        openUnsavedModal();
    }

    function handleBeforeUnload(event) {
        if (!isDirty) {
            return;
        }
        event.preventDefault();
        event.returnValue = '';
    }

    function updateLocationActionState() {
        if (!locationEditBtn) {
            return;
        }
        const hasId = Boolean(locationHidden?.value?.trim());
        locationEditBtn.disabled = !hasId;
        locationEditBtn.setAttribute('aria-disabled', hasId ? 'false' : 'true');
    }

    function showInlineMessage(element, message, variant = 'info') {
        if (!element) return;
        if (!message) {
            element.hidden = true;
            element.textContent = '';
            element.className = 'form-alert';
            return;
        }
        element.hidden = false;
        element.textContent = message;
        element.className = `form-alert ${variant}`;
    }

    function toggleFormLoading(targetForm, isLoading) {
        if (!targetForm) return;
        targetForm.querySelectorAll('input, textarea, select, button').forEach((element) => {
            if (element.closest('[data-modal-dismiss]')) {
                return;
            }
            if (isLoading) {
                element.dataset.prevDisabled = element.disabled ? '1' : '0';
                element.disabled = true;
            } else if (element.dataset.prevDisabled !== '1') {
                element.disabled = false;
                delete element.dataset.prevDisabled;
            } else {
                delete element.dataset.prevDisabled;
            }
        });
    }

    function anyModalVisible() {
        return Boolean(document.querySelector('.modal:not([hidden])'));
    }

    function openModal(modal) {
        if (!modal) return;
        modal.hidden = false;
        modal.setAttribute('aria-hidden', 'false');
        activeModal = modal;
        document.body.classList.add('modal-open');
        const focusTarget = modal.querySelector('[data-autofocus]') || modal.querySelector('input, button, textarea, select');
        if (focusTarget) {
            focusTarget.focus();
        }
    }

    function closeModal(modal) {
        if (!modal) return;
        modal.hidden = true;
        modal.setAttribute('aria-hidden', 'true');
        if (activeModal === modal) {
            activeModal = null;
        }
        if (!anyModalVisible()) {
            document.body.classList.remove('modal-open');
        }
        if (instantCreatePending && modal === locationModal) {
            instantCreatePending = false;
            if (locationInput && typeof locationInput.focus === 'function') {
                locationInput.focus();
            }
        }
    }

    function resetLocationModalFields() {
        if (locationModalForm) {
            locationModalForm.reset();
        }
        if (locationModalFields.name) locationModalFields.name.value = '';
        if (locationModalFields.house) locationModalFields.house.value = '';
        if (locationModalFields.village) locationModalFields.village.value = '';
        if (locationModalFields.building) locationModalFields.building.value = '';
        if (locationModalFields.floor) locationModalFields.floor.value = '';
        if (locationModalFields.room) locationModalFields.room.value = '';
        if (locationModalFields.street) locationModalFields.street.value = '';
        if (locationModalFields.subdistrict) locationModalFields.subdistrict.value = '';
        if (locationModalFields.district) locationModalFields.district.value = '';
        if (locationModalFields.province) locationModalFields.province.value = '';
        if (locationModalFields.postal) locationModalFields.postal.value = '';
        if (locationModalFields.country) locationModalFields.country.value = '';
        if (locationModalFields.notes) locationModalFields.notes.value = '';
    }

    function fillLocationModal(detail) {
        if (!detail) {
            resetLocationModalFields();
            return;
        }
        if (locationModalFields.name) locationModalFields.name.value = detail.location_name || '';
        if (locationModalFields.house) locationModalFields.house.value = detail.house_number || '';
        if (locationModalFields.village) locationModalFields.village.value = detail.village || '';
        if (locationModalFields.building) locationModalFields.building.value = detail.building_name || '';
        if (locationModalFields.floor) locationModalFields.floor.value = detail.floor || '';
        if (locationModalFields.room) locationModalFields.room.value = detail.room || '';
        if (locationModalFields.street) locationModalFields.street.value = detail.street || '';
        if (locationModalFields.subdistrict) locationModalFields.subdistrict.value = detail.subdistrict || '';
        if (locationModalFields.district) locationModalFields.district.value = detail.district || '';
        if (locationModalFields.province) locationModalFields.province.value = detail.province || '';
        if (locationModalFields.postal) locationModalFields.postal.value = detail.postal_code || '';
        if (locationModalFields.country) locationModalFields.country.value = detail.country || '';
        if (locationModalFields.notes) locationModalFields.notes.value = detail.notes || '';
    }

    function collectLocationPayload() {
        return {
            location_name: locationModalFields.name?.value.trim() || '',
            house_number: locationModalFields.house?.value.trim() || '',
            village: locationModalFields.village?.value.trim() || '',
            building_name: locationModalFields.building?.value.trim() || '',
            floor: locationModalFields.floor?.value.trim() || '',
            room: locationModalFields.room?.value.trim() || '',
            street: locationModalFields.street?.value.trim() || '',
            subdistrict: locationModalFields.subdistrict?.value.trim() || '',
            district: locationModalFields.district?.value.trim() || '',
            province: locationModalFields.province?.value.trim() || '',
            postal_code: locationModalFields.postal?.value.trim() || '',
            country: locationModalFields.country?.value.trim() || '',
            notes: locationModalFields.notes?.value.trim() || '',
        };
    }

    function translateLocationError(code, status) {
        switch (code) {
            case 'missing_name':
                return 'กรุณากรอกชื่อสถานที่';
            case 'invalid_id':
                return 'ไม่พบสถานที่ที่ต้องการแก้ไข';
            case 'invalid_payload':
                return 'รูปแบบข้อมูลไม่ถูกต้อง กรุณาลองอีกครั้ง';
            case 'unauthorized':
                return 'คุณไม่มีสิทธิ์ในการแก้ไขข้อมูลสถานที่';
            case 'method_not_allowed':
                return 'ไม่รองรับวิธีการที่ใช้ในการบันทึก';
            case 'ref_location_exists':
                return 'รหัสอ้างอิงสถานที่นี้ถูกใช้แล้ว';
            case 'server':
                return 'ระบบไม่สามารถบันทึกข้อมูลสถานที่ได้ในขณะนี้';
            default:
                if (status === 404) {
                    return 'ไม่พบข้อมูลสถานที่ที่ต้องการแก้ไข';
                }
                if (status === 401) {
                    return 'คุณไม่มีสิทธิ์ในการแก้ไขข้อมูลสถานที่';
                }
                return 'ไม่สามารถบันทึกข้อมูลสถานที่ได้ โปรดลองใหม่อีกครั้ง';
        }
    }

    function openLocationModalCreator() {
        if (!locationModal) {
            return;
        }
        instantCreatePending = true;
        locationModal.dataset.mode = 'create';
        delete locationModal.dataset.locationId;
        if (locationModalTitle) {
            locationModalTitle.textContent = 'สร้างสถานที่ใหม่';
        }
        resetLocationModalFields();
        showInlineMessage(locationModalMessage, '');
        toggleFormLoading(locationModalForm, false);
        if (locationModalSave) {
            locationModalSave.disabled = false;
        }
        openModal(locationModal);
    }

    async function openLocationModalEditor() {
        if (!locationHidden || !locationModal || !modelRoot) {
            return;
        }
        const idValue = locationHidden.value.trim();
        if (!idValue) {
            return;
        }
        locationModal.dataset.mode = 'edit';
        locationModal.dataset.locationId = idValue;
        instantCreatePending = true;
        if (locationModalTitle) {
            locationModalTitle.textContent = 'แก้ไขข้อมูลสถานที่';
        }
        showInlineMessage(locationModalMessage, 'กำลังโหลดข้อมูลสถานที่...', 'info');
        toggleFormLoading(locationModalForm, true);
        if (locationModalSave) {
            locationModalSave.disabled = true;
        }
        openModal(locationModal);
        try {
            const response = await fetch(`${modelRoot}/location_detail.php?id=${encodeURIComponent(idValue)}`, {
                credentials: 'same-origin',
            });
            if (!response.ok) {
                const message = translateLocationError('invalid_id', response.status);
                showInlineMessage(locationModalMessage, message, 'error');
                toggleFormLoading(locationModalForm, false);
                if (locationModalSave) {
                    locationModalSave.disabled = true;
                }
                return;
            }
            const payload = await response.json();
            fillLocationModal(payload?.data || {});
            showInlineMessage(locationModalMessage, '');
            toggleFormLoading(locationModalForm, false);
            if (locationModalSave) {
                locationModalSave.disabled = false;
            }
        } catch (error) {
            const message = translateLocationError('server');
            showInlineMessage(locationModalMessage, message, 'error');
            toggleFormLoading(locationModalForm, false);
            if (locationModalSave) {
                locationModalSave.disabled = true;
            }
        }
    }

    async function submitLocationModal(event) {
        event.preventDefault();
        if (!modelRoot || !locationModal) {
            return;
        }
        const mode = locationModal.dataset.mode === 'edit' ? 'edit' : 'create';
        const payload = collectLocationPayload();
        if (!payload.location_name) {
            showInlineMessage(locationModalMessage, 'กรุณากรอกชื่อสถานที่', 'error');
            return;
        }
        const url = mode === 'create' ? `${modelRoot}/location_create.php` : `${modelRoot}/location_update.php`;
        const body = mode === 'create'
            ? payload
            : { location_id: locationModal.dataset.locationId, ...payload };

        showInlineMessage(locationModalMessage, 'กำลังบันทึก...', 'info');
        toggleFormLoading(locationModalForm, true);
        if (locationModalSave) {
            locationModalSave.disabled = true;
        }

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify(body),
            });
            const result = await response.json().catch(() => null);
            if (!response.ok || !result || !result.success) {
                const code = result?.error || 'server';
                const message = translateLocationError(code, response.status);
                showInlineMessage(locationModalMessage, message, 'error');
                toggleFormLoading(locationModalForm, false);
                if (locationModalSave) {
                    locationModalSave.disabled = false;
                }
                return;
            }
            const detail = result.data || {};
            const label = detail.location_label || formatLocationLabel(detail.location_id, detail.location_name);
            applyLocationSelection(detail.location_id != null ? String(detail.location_id) : '', label);
            showInlineMessage(locationModalMessage, 'บันทึกข้อมูลสถานที่เรียบร้อยแล้ว', 'success');
            toggleFormLoading(locationModalForm, false);
            closeModal(locationModal);
            showMessage('บันทึกข้อมูลสถานที่เรียบร้อยแล้ว', 'success');
        } catch (error) {
            const message = translateLocationError('server');
            showInlineMessage(locationModalMessage, message, 'error');
            toggleFormLoading(locationModalForm, false);
            if (locationModalSave) {
                locationModalSave.disabled = false;
            }
        }
    }

    class LocationLookup {
        constructor(root) {
            this.root = root;
            this.input = root.querySelector('input[type="text"]');
            this.hidden = root.querySelector('input[type="hidden"]');
            this.list = root.querySelector('.typeahead-list');
            this.items = [];
            this.debounceHandle = null;
            this.activeRequest = 0;
            this.bindEvents();
        }

        bindEvents() {
            if (!this.input) {
                return;
            }
            this.input.addEventListener('input', () => {
                const value = this.input.value.trim();
                if (this.debounceHandle) {
                    clearTimeout(this.debounceHandle);
                }
                this.debounceHandle = setTimeout(() => {
                    this.fetch(value);
                }, 250);
                if (this.hidden) {
                    this.hidden.value = '';
                }
                updateLocationActionState();
                handleFieldMutated();
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
            if (this.hidden) {
                this.hidden.value = id || '';
            }
            if (this.input) {
                this.input.value = label || '';
            }
            updateLocationActionState();
            handleFieldMutated();
        }

        async fetch(query) {
            if (!modelRoot || !this.list) {
                return;
            }
            const token = ++this.activeRequest;
            try {
                const params = new URLSearchParams({ type: 'location' });
                const normalized = typeof query === 'string' ? query.trim() : '';
                if (normalized) {
                    params.set('q', normalized);
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
            if (!this.list) return;
            this.list.innerHTML = '';
            const hasItems = Array.isArray(this.items) && this.items.length > 0;

            const fragment = document.createDocumentFragment();
            fragment.append(this.buildInstantCreateOption());

            if (hasItems) {
                const sortedItems = [...this.items].sort((a, b) => {
                    const aId = Number(a.id);
                    const bId = Number(b.id);
                    if (Number.isFinite(aId) && Number.isFinite(bId)) {
                        return bId - aId;
                    }
                    return String(b.id ?? '').localeCompare(String(a.id ?? ''));
                });
                for (const item of sortedItems) {
                    const option = document.createElement('button');
                    option.type = 'button';
                    option.className = 'typeahead-option';
                    option.textContent = item.label;
                    option.addEventListener('click', () => {
                        this.setValue(item.id != null ? String(item.id) : '', item.label || '');
                        this.closeList();
                    });
                    fragment.append(option);
                }
            } else if (emptyText) {
                const empty = document.createElement('div');
                empty.className = 'typeahead-empty';
                empty.textContent = emptyText;
                fragment.append(empty);
            }

            this.list.append(fragment);
            this.list.hidden = this.list.children.length === 0;
        }

        closeList() {
            if (!this.list) return;
            this.list.hidden = true;
            this.list.innerHTML = '';
            this.items = [];
        }

        buildInstantCreateOption() {
            const option = document.createElement('button');
            option.type = 'button';
            option.className = 'typeahead-option typeahead-option-create';
            option.textContent = '➕ สร้างสถานที่ใหม่';
            option.addEventListener('click', () => {
                this.closeList();
                instantCreatePending = true;
                openLocationModalCreator();
            });
            return option;
        }
    }

    function attachEventListeners() {
        if (form) {
            preventEnterSubmit(form);
            form.addEventListener('submit', handleSubmit);
            form.addEventListener('input', handleFieldMutated);
            form.addEventListener('change', handleFieldMutated);
        }

        if (btnDiscardChanges) {
            btnDiscardChanges.addEventListener('click', () => {
                pendingNavigationAction = null;
                restoreSnapshot(initialSnapshot);
                showMessage('ยกเลิกการแก้ไขแล้ว', 'info');
            });
        }

        if (btnSaveInline) {
            btnSaveInline.addEventListener('click', triggerSave);
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
                        window.location.href = './customers.html';
                    }
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

        if (locationEditBtn) {
            locationEditBtn.addEventListener('click', () => {
                if (!locationHidden?.value) {
                    openLocationModalCreator();
                    return;
                }
                openLocationModalEditor();
            });
        }

        if (locationModalForm) {
            preventEnterSubmit(locationModalForm);
            locationModalForm.addEventListener('submit', submitLocationModal);
        }

        document.querySelectorAll('[data-modal-dismiss]').forEach((element) => {
            element.addEventListener('click', () => {
                const modal = element.closest('.modal');
                closeModal(modal);
            });
        });

        window.addEventListener('beforeunload', handleBeforeUnload);
    }

    function initLocationLookup() {
        const root = document.querySelector('.typeahead[data-type="location"]');
        if (!root) {
            updateLocationActionState();
            return;
        }
        locationLookup = new LocationLookup(root);
        updateLocationActionState();
    }

    const boot = ({ root }) => {
        modelRoot = `${root}/Model`;
        updateThaiDate();
        setInterval(updateThaiDate, 1000);
        initLocationLookup();
        attachEventListeners();
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