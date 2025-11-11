(function () {
    const form = document.getElementById('itemUnitForm');
    const messageBox = document.getElementById('formMessage');
    const heading = document.getElementById('itemUnitHeading');
    const itemUnitIdDisplay = document.getElementById('itemUnitIdDisplay');
    const itemUnitItemName = document.getElementById('itemUnitItemName');
    const itemUnitStatus = document.getElementById('itemUnitStatus');
    const itemUnitUpdatedAt = document.getElementById('itemUnitUpdatedAt');
    const itemUnitUpdatedBy = document.getElementById('itemUnitUpdatedBy');
    const itemUnitCreatedAt = document.getElementById('itemUnitCreatedAt');
    const itemUnitCreatedBy = document.getElementById('itemUnitCreatedBy');
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

    const fieldRefs = {
        item: document.getElementById('unitItemId'),
        warehouse: document.getElementById('unitWarehouseId'),
        supplier: document.getElementById('unitSupplierId'),
        serial: document.getElementById('unitSerial'),
        ownership: document.getElementById('unitOwnership'),
        conditionIn: document.getElementById('unitConditionIn'),
        conditionOut: document.getElementById('unitConditionOut'),
        status: document.getElementById('unitStatus'),
        expectedReturn: document.getElementById('unitExpectedReturn'),
        returnAt: document.getElementById('unitReturnAt'),
    };

    const params = new URLSearchParams(window.location.search);
    const unitIdParam = params.get('item_unit_id');
    const isCreateRequested = params.get('mode') === 'create';
    let currentUnitId = unitIdParam ? String(unitIdParam) : null;
    let isCreateMode = !currentUnitId || isCreateRequested;
    let modelRoot = '';
    let isDirty = false;
    let isSaving = false;
    let initialSnapshot = null;
    let itemOptionsLoaded = false;
    let pendingNavigationAction = null;
    let isPopulating = false;

    if (unsavedModal) {
        unsavedModal.setAttribute('aria-hidden', unsavedModal.hidden ? 'true' : 'false');
    }

    updateSaveButtonState();

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
        messageBox.hidden = false;
        messageBox.textContent = message;
        messageBox.className = `form-alert ${variant}`;
    }

    function serializeForm() {
        return {
            item_id: fieldRefs.item?.value || '',
            warehouse_id: fieldRefs.warehouse?.value.trim() || '',
            supplier_id: fieldRefs.supplier?.value.trim() || '',
            serial_number: fieldRefs.serial?.value.trim() || '',
            ownership: fieldRefs.ownership?.value || 'company',
            condition_in: fieldRefs.conditionIn?.value || 'good',
            condition_out: fieldRefs.conditionOut?.value || 'good',
            status: fieldRefs.status?.value || 'useable',
            expected_return_at: fieldRefs.expectedReturn?.value || '',
            return_at: fieldRefs.returnAt?.value || '',
        };
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

    function updateMeta(data) {
        const id = data?.item_unit_id != null ? String(data.item_unit_id) : '—';
        if (itemUnitIdDisplay) itemUnitIdDisplay.textContent = id;
        if (itemUnitItemName) itemUnitItemName.textContent = `สินค้า: ${data?.item_name || '—'}`;
        if (itemUnitStatus) itemUnitStatus.textContent = `สถานะ: ${formatStatusLabel(data?.status)}`;
        if (itemUnitUpdatedAt) itemUnitUpdatedAt.textContent = `อัปเดตล่าสุด: ${formatDateTime(data?.updated_at)}`;
        if (itemUnitUpdatedBy) itemUnitUpdatedBy.textContent = `ปรับปรุงโดย: ${data?.updated_by_name || '—'}`;
        if (itemUnitCreatedAt) itemUnitCreatedAt.textContent = `สร้างเมื่อ: ${formatDateTime(data?.created_at)}`;
        if (itemUnitCreatedBy) itemUnitCreatedBy.textContent = `สร้างโดย: ${data?.created_by_name || '—'}`;
    }

    function populateForm(data) {
        const snapshot = {
            item_id: data?.item_id != null ? String(data.item_id) : '',
            warehouse_id: data?.warehouse_id != null ? String(data.warehouse_id) : '',
            supplier_id: data?.supplier_id != null ? String(data.supplier_id) : '',
            serial_number: data?.serial_number || '',
            ownership: data?.ownership || 'company',
            condition_in: data?.condition_in || 'good',
            condition_out: data?.condition_out || 'good',
            status: data?.status || 'useable',
            expected_return_at: formatDateTimeLocal(data?.expected_return_at),
            return_at: formatDateTimeLocal(data?.return_at),
        };
        runWithPopulation(() => {
            if (fieldRefs.item) fieldRefs.item.value = snapshot.item_id;
            if (fieldRefs.warehouse) fieldRefs.warehouse.value = snapshot.warehouse_id;
            if (fieldRefs.supplier) fieldRefs.supplier.value = snapshot.supplier_id;
            if (fieldRefs.serial) fieldRefs.serial.value = snapshot.serial_number;
            if (fieldRefs.ownership) fieldRefs.ownership.value = snapshot.ownership;
            if (fieldRefs.conditionIn) fieldRefs.conditionIn.value = snapshot.condition_in;
            if (fieldRefs.conditionOut) fieldRefs.conditionOut.value = snapshot.condition_out;
            if (fieldRefs.status) fieldRefs.status.value = snapshot.status;
            if (fieldRefs.expectedReturn) fieldRefs.expectedReturn.value = snapshot.expected_return_at;
            if (fieldRefs.returnAt) fieldRefs.returnAt.value = snapshot.return_at;
        });
        updateMeta(data);
        initialSnapshot = serializeForm();
        setDirtyState(false);
    }

    function restoreSnapshot(snapshot) {
        if (!snapshot) {
            return;
        }
        runWithPopulation(() => {
            if (fieldRefs.item) fieldRefs.item.value = snapshot.item_id || '';
            if (fieldRefs.warehouse) fieldRefs.warehouse.value = snapshot.warehouse_id || '';
            if (fieldRefs.supplier) fieldRefs.supplier.value = snapshot.supplier_id || '';
            if (fieldRefs.serial) fieldRefs.serial.value = snapshot.serial_number || '';
            if (fieldRefs.ownership) fieldRefs.ownership.value = snapshot.ownership || 'company';
            if (fieldRefs.conditionIn) fieldRefs.conditionIn.value = snapshot.condition_in || 'good';
            if (fieldRefs.conditionOut) fieldRefs.conditionOut.value = snapshot.condition_out || 'good';
            if (fieldRefs.status) fieldRefs.status.value = snapshot.status || 'useable';
            if (fieldRefs.expectedReturn) fieldRefs.expectedReturn.value = snapshot.expected_return_at || '';
            if (fieldRefs.returnAt) fieldRefs.returnAt.value = snapshot.return_at || '';
        });
        setDirtyState(false);
    }

    function prepareCreateMode() {
        isCreateMode = true;
        currentUnitId = null;
        if (heading) heading.textContent = 'สร้างหน่วยสินค้าใหม่';
        runWithPopulation(() => {
            form?.reset();
            if (fieldRefs.ownership) fieldRefs.ownership.value = 'company';
            if (fieldRefs.conditionIn) fieldRefs.conditionIn.value = 'good';
            if (fieldRefs.conditionOut) fieldRefs.conditionOut.value = 'good';
            if (fieldRefs.status) fieldRefs.status.value = 'useable';
        });
        updateMeta({});
        initialSnapshot = serializeForm();
        setDirtyState(false);
        showMessage('');
    }

    function formatStatusLabel(status) {
        if (!status) return '—';
        switch (status) {
            case 'useable':
                return 'พร้อมใช้งาน';
            case 'in use':
                return 'กำลังใช้งาน';
            case 'pending booking':
                return 'รอการจอง';
            case 'booked':
                return 'ถูกจอง';
            case 'damaged':
                return 'ชำรุด';
            case 'reparing':
                return 'กำลังซ่อม';
            case 'delivering':
                return 'กำลังขนส่ง';
            case 'returned':
                return 'ส่งคืนแล้ว';
            case 'depreciated':
                return 'ตัดจำหน่าย';
            default:
                return status;
        }
    }

    function formatDateTime(value) {
        if (!value) return '—';
        const date = new Date(String(value).replace(' ', 'T'));
        if (Number.isNaN(date.getTime())) {
            return String(value);
        }
        return date.toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
    }

    function formatDateTimeLocal(value) {
        if (!value) return '';
        const date = new Date(String(value).replace(' ', 'T'));
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

    async function fetchItemUnitDetail(unitId) {
        const response = await fetch(`${modelRoot}/item_unit_detail.php?id=${encodeURIComponent(unitId)}`, {
            credentials: 'same-origin',
        });
        if (!response.ok) {
            let code = mapStatusToError(response.status);
            try {
                const payload = await response.json();
                if (payload && payload.error) {
                    code = payload.error;
                }
            } catch (err) {
                // ignore parse errors
            }
            throw new RequestError(code);
        }
        return response.json();
    }

    async function fetchItemOptions() {
        if (!modelRoot || itemOptionsLoaded) return;
        try {
            const response = await fetch(`${modelRoot}/items_options.php`, {
                credentials: 'same-origin',
            });
            if (!response.ok) return;
            const payload = await response.json();
            const options = Array.isArray(payload.data) ? payload.data : [];
            populateItemOptions(options);
            itemOptionsLoaded = true;
        } catch (err) {
            // ignore
        }
    }

    function populateItemOptions(options) {
        const select = fieldRefs.item;
        if (!select) return;
        const currentValue = select.value;
        select.innerHTML = '<option value="">— เลือกสินค้า —</option>';
        for (const row of options) {
            const option = document.createElement('option');
            option.value = String(row.id);
            const parts = [];
            if (row.name) parts.push(row.name);
            if (row.ref_id) parts.push(`(${row.ref_id})`);
            if (row.category_name) parts.push(`[${row.category_name}]`);
            option.textContent = parts.join(' ');
            select.append(option);
        }
        if (currentValue && Array.from(select.options).some((opt) => opt.value === currentValue)) {
            select.value = currentValue;
        }
    }

    async function handleSubmit(event) {
        event.preventDefault();
        if (!form || isSaving) return;
        const payload = serializeForm();
        if (!payload.item_id) {
            showMessage('กรุณาเลือกสินค้า', 'error');
            return;
        }
        const url = isCreateMode ? `${modelRoot}/item_unit_create.php` : `${modelRoot}/item_unit_update.php`;
        const body = { ...payload };
        if (!isCreateMode) {
            body.item_unit_id = currentUnitId;
        }

        isSaving = true;
        setDirtyState(false);
        updateSaveButtonState();
        showMessage('กำลังบันทึก...', 'info');

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify(body),
            });
            const result = await safeJson(response);
            const hasError = !response.ok || !result || result.error;
            if (hasError) {
                const code = result?.error || mapStatusToError(response.status);
                throw new RequestError(code);
            }
            const detail = result.data || {};
            currentUnitId = detail.item_unit_id != null ? String(detail.item_unit_id) : currentUnitId;
            isCreateMode = false;
            if (currentUnitId) {
                history.replaceState({}, '', `./item_unit_manage.html?item_unit_id=${encodeURIComponent(currentUnitId)}`);
            }
            populateForm(detail);
            if (heading) {
                heading.textContent = detail.item_unit_id ? `แก้ไขหน่วยสินค้า #${detail.item_unit_id}` : 'แก้ไขหน่วยสินค้า';
            }
            sessionStorage.setItem('item-units:refresh', '1');
            showMessage('บันทึกหน่วยสินค้าเรียบร้อยแล้ว', 'success');
            closeUnsavedModal();
            if (typeof pendingNavigationAction === 'function') {
                const action = pendingNavigationAction;
                pendingNavigationAction = null;
                action();
            }
        } catch (error) {
            showMessage(translateError(error), 'error');
            setDirtyState(true);
        } finally {
            isSaving = false;
            updateSaveButtonState();
        }
    }

    function translateError(error) {
        if (error instanceof RequestError) {
            switch (error.code) {
                case 'missing_item':
                case 'item_not_found':
                    return 'กรุณาเลือกสินค้าที่ถูกต้อง';
                case 'invalid_id':
                case 'not_found':
                    return 'ไม่พบข้อมูลหน่วยสินค้าที่ต้องการแก้ไข';
                case 'unauthorized':
                    return 'สิทธิ์การใช้งานหมดอายุ กรุณาเข้าสู่ระบบใหม่';
                default:
                    return 'ไม่สามารถบันทึกหน่วยสินค้าได้ โปรดลองใหม่อีกครั้ง';
            }
        }
        if (error instanceof TypeError) {
            return 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้ โปรดลองใหม่อีกครั้ง';
        }
        return 'ไม่สามารถบันทึกหน่วยสินค้าได้ โปรดลองใหม่อีกครั้ง';
    }

    class RequestError extends Error {
        constructor(code, message) {
            super(message || code);
            this.name = 'RequestError';
            this.code = code || 'unknown';
        }
    }

    function mapStatusToError(status) {
        switch (status) {
            case 401:
                return 'unauthorized';
            case 403:
                return 'forbidden';
            case 404:
                return 'not_found';
            default:
                return 'server';
        }
    }

    async function safeJson(response) {
        try {
            return await response.json();
        } catch (err) {
            return null;
        }
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

    function attachFieldListeners() {
        if (!form) return;
        form.addEventListener('input', handleFieldMutated);
        form.addEventListener('change', handleFieldMutated);
        form.addEventListener('submit', handleSubmit);
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
                    window.location.href = './item_units.html';
                }
            });
        });
    }

    if (breadcrumbLink) {
        breadcrumbLink.addEventListener('click', (event) => {
            event.preventDefault();
            const href = breadcrumbLink.getAttribute('href') || './item_units.html';
            requestNavigation(() => {
                window.location.href = href;
            });
        });
    }

    window.addEventListener('beforeunload', handleBeforeUnload);

    async function boot(context) {
        modelRoot = `${context.root}/Model`;
        updateThaiDate();
        setInterval(updateThaiDate, 1000);
        attachFieldListeners();
        await fetchItemOptions();
        if (isCreateMode) {
            prepareCreateMode();
            return;
        }
        try {
            const detail = await fetchItemUnitDetail(currentUnitId);
            if (heading) heading.textContent = detail.item_unit_id ? `แก้ไขหน่วยสินค้า #${detail.item_unit_id}` : 'แก้ไขหน่วยสินค้า';
            populateForm(detail);
        } catch (err) {
            prepareCreateMode();
            const message = err instanceof RequestError && err.code === 'unauthorized'
                ? 'สิทธิ์การใช้งานหมดอายุ กรุณาเข้าสู่ระบบใหม่'
                : 'ไม่พบข้อมูลหน่วยสินค้า กรุณาสร้างใหม่';
            showMessage(message, 'error');
        }
    }

    if (typeof window.onAppReady === 'function') {
        window.onAppReady(boot);
    }
})();