(function () {
    const form = document.getElementById('locationForm');
    const messageBox = document.getElementById('locationMessage');
    const heading = document.getElementById('locationHeading');
    const codeField = document.getElementById('locationCode');
    const backButton = document.getElementById('locationBack');
    const saveButton = document.getElementById('locationSave');
    const breadcrumbLink = document.querySelector('.breadcrumb a');
    const unsavedBanner = document.getElementById('unsavedBanner');
    const btnDiscardChanges = document.getElementById('btnDiscardChanges');
    const btnSaveInline = document.getElementById('btnSaveInline');
    const unsavedModal = document.getElementById('unsavedModal');
    const btnModalStay = document.getElementById('btnModalStay');
    const btnModalDiscard = document.getElementById('btnModalDiscard');
    const btnModalSave = document.getElementById('btnModalSave');

    const meta = {
        id: document.getElementById('locationIdDisplay'),
        ref: document.getElementById('locationRef'),
        statusMeta: document.getElementById('locationStatusMeta'),
        statusBadge: document.getElementById('locationStatusBadge'),
        statusText: document.getElementById('locationStatusText'),
        createdAt: document.getElementById('locationCreatedAt'),
        createdBy: document.getElementById('locationCreatedBy'),
        updatedAt: document.getElementById('locationUpdatedAt'),
        updatedBy: document.getElementById('locationUpdatedBy'),
    };

    const fields = {
        ref_location_id: document.getElementById('locationRefCode'),
        location_name: document.getElementById('locationName'),
        email: document.getElementById('locationEmail'),
        phone: document.getElementById('locationPhone'),
        house_number: document.getElementById('locationHouse'),
        village: document.getElementById('locationVillage'),
        building_name: document.getElementById('locationBuilding'),
        floor: document.getElementById('locationFloor'),
        room: document.getElementById('locationRoom'),
        street: document.getElementById('locationStreet'),
        subdistrict: document.getElementById('locationSubdistrict'),
        district: document.getElementById('locationDistrict'),
        province: document.getElementById('locationProvince'),
        postal_code: document.getElementById('locationPostal'),
        country: document.getElementById('locationCountry'),
        status: document.getElementById('locationStatus'),
        notes: document.getElementById('locationNotes'),
    };

    const params = new URLSearchParams(window.location.search);
    const locationIdParam = params.get('location_id');
    const isCreateRequested = params.get('mode') === 'create';
    let currentLocationId = locationIdParam ? String(locationIdParam) : null;
    let isCreateMode = !currentLocationId || isCreateRequested;
    let modelRoot = '';
    let isDirty = false;
    let isSaving = false;
    let initialSnapshot = null;
    let pendingNavigationAction = null;

    if (unsavedModal) {
        unsavedModal.setAttribute('aria-hidden', unsavedModal.hidden ? 'true' : 'false');
    }
    updateSaveButtonState();

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
        if (saveButton) {
            saveButton.disabled = disable;
        }
        if (btnSaveInline) {
            btnSaveInline.disabled = disable;
        }
    }

    function serializeForm() {
        const snapshot = {};
        Object.entries(fields).forEach(([key, input]) => {
            if (!input) return;
            if (key === 'status') {
                snapshot[key] = input.value || 'active';
            } else {
                snapshot[key] = input.value.trim();
            }
        });
        return snapshot;
    }

    function restoreSnapshot(snapshot) {
        if (!snapshot) {
            return;
        }
        Object.entries(fields).forEach(([key, input]) => {
            if (!input) return;
            const nextValue = snapshot[key];
            if (key === 'status') {
                input.value = nextValue || 'active';
            } else {
                input.value = (nextValue ?? '').trim();
            }
        });
        setDirty(false);
    }

    function setDirty(next) {
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
            form.requestSubmit(saveButton);
        } else if (saveButton) {
            saveButton.click();
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

    function formatDateTime(value) {
        if (!value) {
            return '—';
        }
        const date = new Date(value.replace(' ', 'T'));
        if (Number.isNaN(date.getTime())) {
            return value;
        }
        return date.toLocaleString('th-TH', {
            dateStyle: 'medium',
            timeStyle: 'short',
        });
    }

    function applyStatusChip(status) {
        if (!meta.statusBadge || !meta.statusText) return;
        const normalized = typeof status === 'string' ? status.toLowerCase() : '';
        let displayText = '—';
        if (normalized === 'active') displayText = 'เปิดใช้งาน';
        if (normalized === 'inactive') displayText = 'ปิดใช้งาน';
        meta.statusText.textContent = `สถานะ: ${displayText}`;
        if (normalized === 'active' || normalized === 'inactive') {
            meta.statusBadge.dataset.status = normalized;
        } else {
            delete meta.statusBadge.dataset.status;
        }
    }

    function updateMeta(data) {
        if (meta.id) {
            meta.id.textContent = data?.location_id != null ? String(data.location_id) : '—';
        }
        if (meta.ref) {
            const refText = data?.ref_location_id ? data.ref_location_id : '—';
            meta.ref.textContent = `รหัสอ้างอิง: ${refText}`;
        }
        if (meta.statusMeta) {
            const label = data?.status === 'active' ? 'เปิดใช้งาน' : data?.status === 'inactive' ? 'ปิดใช้งาน' : '—';
            meta.statusMeta.textContent = `สถานะ: ${label}`;
        }
        applyStatusChip(data?.status);
        if (meta.createdAt) {
            meta.createdAt.textContent = `สร้างเมื่อ: ${formatDateTime(data?.created_at)}`;
        }
        if (meta.createdBy) {
            meta.createdBy.textContent = `สร้างโดย: ${data?.created_by_label || '—'}`;
        }
        if (meta.updatedAt) {
            meta.updatedAt.textContent = `อัปเดตล่าสุด: ${formatDateTime(data?.updated_at)}`;
        }
        if (meta.updatedBy) {
            meta.updatedBy.textContent = `ปรับปรุงโดย: ${data?.updated_by_label || '—'}`;
        }
    }

    function resetMeta() {
        updateMeta({});
    }

    function populateForm(data) {
        Object.entries(fields).forEach(([key, input]) => {
            if (!input) return;
            const value = data?.[key];
            if (key === 'status') {
                input.value = value || 'active';
            } else {
                input.value = value || '';
            }
        });
        updateMeta(data);
        initialSnapshot = serializeForm();
        setDirty(false);
    }

    function prepareCreateMode() {
        isCreateMode = true;
        currentLocationId = null;
        if (heading) {
            heading.textContent = 'สร้างสถานที่ใหม่';
        }
        if (codeField) {
            codeField.value = 'ใหม่';
        }
        form?.reset();
        if (fields.status) {
            fields.status.value = 'active';
        }
        resetMeta();
        initialSnapshot = serializeForm();
        setDirty(false);
        showMessage('');
    }

    async function loadLocation(id) {
        if (!modelRoot || !id) {
            prepareCreateMode();
            return;
        }
        try {
            const response = await fetch(`${modelRoot}/location_detail.php?id=${encodeURIComponent(id)}`, {
                credentials: 'same-origin',
            });
            if (!response.ok) {
                if (response.status === 404) {
                    showMessage('ไม่พบข้อมูลสถานที่', 'error');
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
            currentLocationId = String(data.location_id);
            isCreateMode = false;
            if (heading) {
                heading.textContent = data.location_name || `สถานที่ #${currentLocationId}`;
            }
            if (codeField) {
                codeField.value = currentLocationId;
            }
            populateForm(data);
        } catch (error) {
            showMessage('ไม่สามารถโหลดข้อมูลสถานที่ได้', 'error');
            prepareCreateMode();
        }
    }

    function getPayload() {
        return serializeForm();
    }

    async function createLocation(payload) {
        const response = await fetch(`${modelRoot}/location_create.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify(payload),
        });
        if (!response.ok) {
            if (response.status === 409) {
                throw new Error('ref_location_exists');
            }
            throw new Error('network');
        }
        const result = await response.json();
        if (!result || !result.success || !result.data) {
            throw new Error(result?.error || 'unknown');
        }
        return result.data;
    }

    async function updateLocation(payload) {
        const response = await fetch(`${modelRoot}/location_update.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ location_id: currentLocationId, ...payload }),
        });
        if (!response.ok) {
            if (response.status === 409) {
                throw new Error('ref_location_exists');
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
        const nameValue = fields.location_name?.value.trim();
        if (!nameValue) {
            showMessage('กรุณากรอกชื่อสถานที่', 'error');
            fields.location_name?.focus();
            return;
        }
        const payload = getPayload();
        isSaving = true;
        setDirty(false);
        updateSaveButtonState();
        showMessage('กำลังบันทึก...', 'info');
        try {
            const data = isCreateMode ? await createLocation(payload) : await updateLocation(payload);
            currentLocationId = String(data.location_id);
            if (heading) {
                heading.textContent = data.location_name || `สถานที่ #${currentLocationId}`;
            }
            if (codeField) {
                codeField.value = currentLocationId;
            }
            populateForm(data);
            showMessage(isCreateMode ? 'สร้างสถานที่เรียบร้อยแล้ว' : 'บันทึกข้อมูลสถานที่เรียบร้อยแล้ว', 'success');
            try {
                sessionStorage.setItem('locations:refresh', '1');
            } catch (storageError) {
                // ignore storage errors
            }
            if (isCreateMode) {
                params.set('location_id', currentLocationId);
                params.delete('mode');
                const newQuery = params.toString();
                const newUrl = newQuery ? `${window.location.pathname}?${newQuery}` : window.location.pathname;
                window.history.replaceState({}, '', newUrl);
                isCreateMode = false;
            }
            closeUnsavedModal();
            if (typeof pendingNavigationAction === 'function') {
                const action = pendingNavigationAction;
                pendingNavigationAction = null;
                action();
            }
        } catch (error) {
            setDirty(true);
            if (error.message === 'ref_location_exists') {
                showMessage('รหัสอ้างอิงนี้ถูกใช้แล้ว กรุณาใช้รหัสอื่น', 'error');
            } else {
                showMessage('ไม่สามารถบันทึกข้อมูลสถานที่ได้ โปรดลองอีกครั้ง', 'error');
            }
        } finally {
            isSaving = false;
            updateSaveButtonState();
        }
    }

    if (form) {
        preventEnterSubmit(form);
        form.addEventListener('submit', handleSubmit);
        form.addEventListener('input', () => {
            if (!initialSnapshot) return;
            const snapshot = serializeForm();
            const dirty = Object.keys(snapshot).some((key) => snapshot[key] !== initialSnapshot[key]);
            setDirty(dirty);
        });
    }

    if (backButton) {
        backButton.addEventListener('click', () => {
            requestNavigation(() => {
                window.history.length > 1 ? window.history.back() : (window.location.href = './locations.html');
            });
        });
    }

    if (breadcrumbLink) {
        breadcrumbLink.addEventListener('click', (event) => {
            event.preventDefault();
            const href = breadcrumbLink.getAttribute('href') || './locations.html';
            requestNavigation(() => {
                window.location.href = href;
            });
        });
    }

    if (btnDiscardChanges) {
        btnDiscardChanges.addEventListener('click', () => {
            pendingNavigationAction = null;
            restoreSnapshot(initialSnapshot);
            showMessage('ยกเลิกการแก้ไขแล้ว', 'info');
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
            setDirty(false);
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

    window.addEventListener('beforeunload', handleBeforeUnload);

    const boot = ({ root }) => {
        modelRoot = `${root}/Model`;
        updateThaiDate();
        setInterval(updateThaiDate, 1000);
        if (isCreateMode) {
            prepareCreateMode();
        } else {
            loadLocation(currentLocationId);
        }
    };

    if (typeof window.onAppReady === 'function') {
        window.onAppReady(boot);
    }
})();