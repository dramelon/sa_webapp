(function () {
    const form = document.getElementById('itemUnitForm');
    const messageBox = document.getElementById('formMessage');
    const heading = document.getElementById('itemUnitHeading');
    const itemUnitIdDisplay = document.getElementById('itemUnitIdDisplay');
    const itemUnitItemName = document.getElementById('itemUnitItemName');
    const itemUnitOwnership = document.getElementById('itemUnitOwnership');
    const itemUnitStatusChip = document.getElementById('itemUnitStatusChip');
    const itemUnitStatusText = document.getElementById('itemUnitStatusText');
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

    const lookupRoots = {
        item: document.querySelector('.typeahead[data-type="item"]'),
        warehouse: document.querySelector('.typeahead[data-type="warehouse"]'),
    };

    const itemModal = document.getElementById('itemModal');
    const itemModalForm = document.getElementById('itemModalForm');
    const itemModalMessage = document.getElementById('itemModalMessage');
    const itemModalTitle = document.getElementById('itemModalTitle');
    const itemModalSave = document.getElementById('itemModalSave');
    const itemModalFields = {
        id: document.getElementById('itemModalItemId'),
        name: document.getElementById('itemModalName'),
        ref: document.getElementById('itemModalRef'),
        type: document.getElementById('itemModalType'),
        category: document.getElementById('itemModalCategory'),
        brand: document.getElementById('itemModalBrand'),
        model: document.getElementById('itemModalModel'),
        uom: document.getElementById('itemModalUom'),
        rate: document.getElementById('itemModalRate'),
        period: document.getElementById('itemModalPeriod'),
    };

    const warehouseModal = document.getElementById('warehouseModal');
    const warehouseModalForm = document.getElementById('warehouseModalForm');
    const warehouseModalMessage = document.getElementById('warehouseModalMessage');
    const warehouseModalTitle = document.getElementById('warehouseModalTitle');
    const warehouseModalSave = document.getElementById('warehouseModalSave');
    const warehouseModalFields = {
        id: document.getElementById('warehouseModalId'),
        name: document.getElementById('warehouseModalName'),
        short: document.getElementById('warehouseModalShort'),
        status: document.getElementById('warehouseModalStatus'),
        location: document.getElementById('warehouseModalLocation'),
        note: document.getElementById('warehouseModalNote'),
    };

    const ownershipDependentBlocks = {
        expectedReturn: document.getElementById('fieldExpectedReturn'),
        returnAt: document.getElementById('fieldReturnAt'),
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
    let pendingNavigationAction = null;
    let isPopulating = false;
    let lookupFields = {};
    let lookupContext = null;
    let initialLookupState = { itemLabel: '', warehouseLabel: '' };
    let activeModal = null;
    let pendingLookupFocus = null;

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

    function serializeForm() {
        return {
            item_id: (fieldRefs.item?.value || '').trim(),
            warehouse_id: (fieldRefs.warehouse?.value || '').trim(),
            supplier_id: (fieldRefs.supplier?.value || '').trim(),
            serial_number: (fieldRefs.serial?.value || '').trim(),
            ownership: fieldRefs.ownership?.value || 'company',
            condition_in: fieldRefs.conditionIn?.value || 'good',
            condition_out: fieldRefs.conditionOut?.value || 'good',
            status: fieldRefs.status?.value || 'useable',
            expected_return_at: fieldRefs.expectedReturn?.value || '',
            return_at: fieldRefs.returnAt?.value || '',
        };
    }

    function captureLookupLabels() {
        return {
            itemLabel: getLookupLabel('item'),
            warehouseLabel: getLookupLabel('warehouse'),
        };
    }

    function recordInitialState() {
        initialSnapshot = serializeForm();
        initialLookupState = captureLookupLabels();
        setDirtyState(false);
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
        if (itemUnitOwnership) {
            itemUnitOwnership.textContent = `ความเป็นเจ้าของ: ${formatOwnershipLabel(data?.ownership)}`;
        }
        applyStatusChip(data?.status);
        if (itemUnitUpdatedAt) itemUnitUpdatedAt.textContent = `อัปเดตล่าสุด: ${formatDateTime(data?.updated_at)}`;
        if (itemUnitUpdatedBy) itemUnitUpdatedBy.textContent = `ปรับปรุงโดย: ${data?.updated_by_name || '—'}`;
        if (itemUnitCreatedAt) itemUnitCreatedAt.textContent = `สร้างเมื่อ: ${formatDateTime(data?.created_at)}`;
        if (itemUnitCreatedBy) itemUnitCreatedBy.textContent = `สร้างโดย: ${data?.created_by_name || '—'}`;
    }

    function syncMetaFromForm() {
        if (itemUnitItemName) {
            const label = getLookupLabel('item');
            itemUnitItemName.textContent = `สินค้า: ${label || '—'}`;
        }
        if (itemUnitOwnership && fieldRefs.ownership) {
            itemUnitOwnership.textContent = `ความเป็นเจ้าของ: ${formatOwnershipLabel(fieldRefs.ownership.value)}`;
        }
        if (fieldRefs.status) {
            applyStatusChip(fieldRefs.status.value);
        }
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
        const itemLabel = formatItemLookupLabel(data);
        const warehouseLabel = formatWarehouseLookupLabel(data);
        setLookupFieldValue('item', snapshot.item_id, itemLabel, { silent: true, skipDirty: true });
        setLookupFieldValue('warehouse', snapshot.warehouse_id, warehouseLabel, { silent: true, skipDirty: true });
        updateOwnershipDependentFields();
        updateMeta(data);
        syncMetaFromForm();
        recordInitialState();
    }

    function restoreSnapshot(snapshot, lookupState = initialLookupState) {
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
        setLookupFieldValue('item', snapshot.item_id || '', lookupState?.itemLabel || '', { silent: true, skipDirty: true });
        setLookupFieldValue('warehouse', snapshot.warehouse_id || '', lookupState?.warehouseLabel || '', { silent: true, skipDirty: true });
        updateOwnershipDependentFields();
        syncMetaFromForm();
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
        setLookupFieldValue('item', '', '', { silent: true, skipDirty: true });
        setLookupFieldValue('warehouse', '', '', { silent: true, skipDirty: true });
        updateOwnershipDependentFields();
        updateMeta({});
        syncMetaFromForm();
        recordInitialState();
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

    function formatOwnershipLabel(value) {
        if (!value) return '—';
        switch (value) {
            case 'company':
                return 'ของบริษัท';
            case 'rented':
                return 'เช่า';
            default:
                return value;
        }
    }

    function applyStatusChip(status) {
        if (!itemUnitStatusChip || !itemUnitStatusText) {
            return;
        }
        const normalized = typeof status === 'string' ? status.toLowerCase() : '';
        itemUnitStatusText.textContent = `สถานะ: ${formatStatusLabel(normalized)}`;
        if (normalized) {
            itemUnitStatusChip.dataset.status = normalized.replace(/\s+/g, '-');
        } else {
            itemUnitStatusChip.removeAttribute('data-status');
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

    async function fetchItemDetail(itemId) {
        const response = await fetch(`${modelRoot}/item_detail.php?id=${encodeURIComponent(itemId)}`, {
            credentials: 'same-origin',
        });
        const payload = await safeJson(response);
        const hasError = !response.ok || !payload || payload.error;
        if (hasError) {
            const code = payload?.error || mapStatusToError(response.status);
            throw new RequestError(code);
        }
        return payload;
    }

    async function fetchWarehouseDetail(warehouseId) {
        const response = await fetch(`${modelRoot}/warehouse_detail.php?id=${encodeURIComponent(warehouseId)}`, {
            credentials: 'same-origin',
        });
        const payload = await safeJson(response);
        const hasError = !response.ok || !payload || payload.error;
        if (hasError) {
            const code = payload?.error || mapStatusToError(response.status);
            throw new RequestError(code);
        }
        return payload.data || payload;
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

    function updateOwnershipDependentFields() {
        const isRented = fieldRefs.ownership?.value === 'rented';
        const wrappers = [
            ownershipDependentBlocks.expectedReturn,
            ownershipDependentBlocks.returnAt,
        ];
        for (const wrapper of wrappers) {
            if (!wrapper) continue;
            wrapper.style.display = isRented ? '' : 'none';
            wrapper.setAttribute('aria-hidden', isRented ? 'false' : 'true');
        }
    }

    class LookupField {
        constructor(root) {
            this.root = root;
            this.type = root?.dataset.type || '';
            this.input = root?.querySelector('input[type="text"]') || null;
            this.hidden = root?.querySelector('input[type="hidden"]') || null;
            this.list = root?.querySelector('.typeahead-list') || null;
            this.action = root?.querySelector('.typeahead-action') || null;
            this.items = [];
            this.debounceHandle = null;
            this.activeRequest = 0;
            this.currentLabel = this.hidden?.dataset.label || '';
            this.bindEvents();
            this.updateActionState();
        }

        bindEvents() {
            if (this.input) {
                this.input.addEventListener('input', () => {
                    const value = this.input.value.trim();
                    if (this.debounceHandle) {
                        clearTimeout(this.debounceHandle);
                    }
                    this.debounceHandle = setTimeout(() => {
                        this.fetch(value);
                    }, 200);
                    if (this.hidden) {
                        this.hidden.value = '';
                        this.hidden.dataset.label = '';
                    }
                    this.currentLabel = '';
                    this.updateActionState();
                    handleFieldMutated();
                });
                this.input.addEventListener('focus', () => {
                    this.fetch(this.input.value.trim());
                });
            }

            document.addEventListener('click', (event) => {
                if (!this.root?.contains(event.target)) {
                    this.closeList();
                }
            });

            if (this.action) {
                this.action.addEventListener('click', (event) => {
                    event.preventDefault();
                    if (!this.hidden?.value) {
                        return;
                    }
                    beginLookupEdit(this);
                });
            }
        }

        normalizeQuery(query) {
            const value = typeof query === 'string' ? query.trim() : '';
            if (!value) {
                return '';
            }
            const hyphenIndex = value.indexOf('-');
            if (hyphenIndex > 0) {
                const before = value.slice(0, hyphenIndex).trim();
                const after = value.slice(hyphenIndex + 1).trim();
                const digits = before.replace(/\D+/g, '');
                if (digits) {
                    return digits;
                }
                return before || after || value;
            }
            return value;
        }

        async fetch(query) {
            if (!modelRoot || !this.list) {
                return;
            }
            const token = ++this.activeRequest;
            try {
                const params = new URLSearchParams({ type: this.type });
                const normalized = this.normalizeQuery(query);
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
            const fragment = document.createDocumentFragment();
            fragment.append(this.buildInstantCreateOption());
            if (this.items.length > 0) {
                const sorted = [...this.items].sort((a, b) => {
                    const aId = Number(a.id);
                    const bId = Number(b.id);
                    if (Number.isFinite(aId) && Number.isFinite(bId)) {
                        return bId - aId;
                    }
                    return String(b.id ?? '').localeCompare(String(a.id ?? ''));
                });
                for (const item of sorted) {
                    const option = document.createElement('button');
                    option.type = 'button';
                    option.className = 'typeahead-option';
                    option.textContent = item.label;
                    option.addEventListener('click', () => {
                        const id = item.id != null ? String(item.id) : '';
                        this.setValue(id, item.label || '');
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

        buildInstantCreateOption() {
            const option = document.createElement('button');
            option.type = 'button';
            option.className = 'typeahead-option typeahead-option-create';
            option.textContent = this.type === 'item' ? '➕ สร้างสินค้าใหม่' : '➕ สร้างคลังสินค้าใหม่';
            option.addEventListener('click', (event) => {
                event.preventDefault();
                this.closeList();
                const seed = this.input?.value.trim() || '';
                beginLookupCreate(this, seed);
            });
            return option;
        }

        closeList() {
            if (!this.list) return;
            this.list.hidden = true;
            this.list.innerHTML = '';
            this.items = [];
        }

        setValue(id, label, options = {}) {
            const normalizedId = id != null ? String(id).trim() : '';
            const normalizedLabel = typeof label === 'string' ? label.trim() : '';
            if (this.hidden) {
                const previous = this.hidden.value;
                this.hidden.value = normalizedId;
                this.hidden.dataset.label = normalizedLabel;
                if (!options.silent && previous !== normalizedId) {
                    this.hidden.dispatchEvent(new Event('input', { bubbles: true }));
                    this.hidden.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
            if (this.input) {
                this.input.value = normalizedLabel;
            }
            this.currentLabel = normalizedLabel;
            this.updateActionState();
            if (!options.skipDirty) {
                handleFieldMutated();
            }
        }

        getLabel() {
            return this.currentLabel || '';
        }

        focusInput() {
            this.input?.focus();
        }

        updateActionState() {
            if (!this.action) {
                return;
            }
            const hasId = Boolean(this.hidden?.value?.trim());
            this.action.disabled = !hasId;
            this.action.setAttribute('aria-disabled', hasId ? 'false' : 'true');
        }
    }

    function initLookupFields() {
        lookupFields = {};
        Object.entries(lookupRoots).forEach(([type, root]) => {
            if (root) {
                lookupFields[type] = new LookupField(root);
            }
        });
    }

    function getLookupField(type) {
        return lookupFields[type] || null;
    }

    function getLookupLabel(type) {
        const field = getLookupField(type);
        if (field) {
            return field.getLabel();
        }
        const fallback = type === 'item' ? fieldRefs.item : fieldRefs.warehouse;
        return fallback?.dataset?.label || fallback?.value || '';
    }

    function setLookupFieldValue(type, id, label, options = {}) {
        const field = getLookupField(type);
        if (field) {
            field.setValue(id, label, options);
            return;
        }
        const hidden = type === 'item' ? fieldRefs.item : fieldRefs.warehouse;
        if (hidden) {
            hidden.value = id || '';
            hidden.dataset.label = label || '';
        }
        const input = type === 'item' ? document.getElementById('itemInput') : document.getElementById('warehouseInput');
        if (input) {
            input.value = label || '';
        }
    }

    function formatItemLookupLabel(detail) {
        if (!detail) {
            return '';
        }
        const id = detail.item_id ?? detail.id ?? '';
        const name = detail.item_name ?? detail.name ?? '';
        const refId = detail.ref_item_id ?? detail.ref_id ?? '';
        const category = detail.category_name ?? detail.category ?? '';
        const baseName = name || (id ? `สินค้า #${id}` : 'ไม่ทราบชื่อสินค้า');
        const idPart = id ? `${id} - ` : '';
        const refPart = refId ? ` (${refId})` : '';
        const categoryPart = category ? ` [${category}]` : '';
        return `${idPart}${baseName}${refPart}${categoryPart}`.trim();
    }

    function formatWarehouseLookupLabel(detail) {
        if (!detail) {
            return '';
        }
        const id = detail.warehouse_id ?? detail.id ?? '';
        const name = detail.warehouse_name ?? detail.name ?? '';
        const short = detail.warehouse_sn ?? detail.short_name ?? '';
        const status = detail.status ?? '';
        const baseName = name || (id ? `คลัง #${id}` : 'ไม่ทราบชื่อคลัง');
        const idPart = id ? `${id} - ` : '';
        const shortPart = short ? ` (${short})` : '';
        const statusPart = status === 'inactive' ? ' • ปิดใช้งาน' : status === 'active' ? ' • ใช้งาน' : '';
        return `${idPart}${baseName}${shortPart}${statusPart}`.trim();
    }

    function beginLookupCreate(field, seedName = '') {
        lookupContext = { type: field?.type, field, mode: 'create' };
        pendingLookupFocus = field;
        if (field?.type === 'item') {
            openItemModalCreator(seedName);
        } else if (field?.type === 'warehouse') {
            openWarehouseModalCreator(seedName);
        }
    }

    function beginLookupEdit(field) {
        const id = field?.hidden?.value;
        if (!id) {
            return;
        }
        lookupContext = { type: field?.type, field, mode: 'edit', id };
        pendingLookupFocus = field;
        if (field?.type === 'item') {
            openItemModalEditor(id);
        } else if (field?.type === 'warehouse') {
            openWarehouseModalEditor(id);
        }
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
        const focusTarget = modal.querySelector('[data-autofocus]') || modal.querySelector('input, textarea, select, button');
        focusTarget?.focus();
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
        if ((modal === itemModal || modal === warehouseModal) && pendingLookupFocus) {
            pendingLookupFocus.focusInput();
            pendingLookupFocus = null;
            lookupContext = null;
        }
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

    function toggleModalLoading(targetForm, submitButton, isLoading) {
        if (targetForm) {
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
        if (submitButton) {
            submitButton.disabled = Boolean(isLoading);
        }
    }

    function resetItemModalFields(seedName = '') {
        if (itemModalFields.id) itemModalFields.id.value = '';
        if (itemModalFields.name) itemModalFields.name.value = seedName || '';
        if (itemModalFields.ref) itemModalFields.ref.value = '';
        if (itemModalFields.type) itemModalFields.type.value = 'อุปกร';
        if (itemModalFields.category) itemModalFields.category.value = '';
        if (itemModalFields.brand) itemModalFields.brand.value = '';
        if (itemModalFields.model) itemModalFields.model.value = '';
        if (itemModalFields.uom) itemModalFields.uom.value = 'unit';
        if (itemModalFields.rate) itemModalFields.rate.value = '';
        if (itemModalFields.period) itemModalFields.period.value = 'day';
    }

    function fillItemModalFields(detail) {
        if (!detail) {
            resetItemModalFields();
            return;
        }
        if (itemModalFields.id) itemModalFields.id.value = detail.item_id != null ? String(detail.item_id) : '';
        if (itemModalFields.name) itemModalFields.name.value = detail.item_name || '';
        if (itemModalFields.ref) itemModalFields.ref.value = detail.ref_item_id || '';
        if (itemModalFields.type) itemModalFields.type.value = detail.item_type || 'อุปกร';
        if (itemModalFields.category) itemModalFields.category.value = detail.item_category_id != null ? String(detail.item_category_id) : '';
        if (itemModalFields.brand) itemModalFields.brand.value = detail.brand || '';
        if (itemModalFields.model) itemModalFields.model.value = detail.model || '';
        if (itemModalFields.uom) itemModalFields.uom.value = detail.uom || 'unit';
        if (itemModalFields.rate) itemModalFields.rate.value = detail.rate != null ? String(detail.rate) : '';
        if (itemModalFields.period) itemModalFields.period.value = detail.period || 'day';
    }

    function openItemModalCreator(seedName = '') {
        if (!itemModal) return;
        itemModal.dataset.mode = 'create';
        if (itemModalTitle) itemModalTitle.textContent = 'สร้างสินค้าใหม่';
        showInlineMessage(itemModalMessage, '');
        resetItemModalFields(seedName);
        toggleModalLoading(itemModalForm, itemModalSave, false);
        openModal(itemModal);
    }

    async function openItemModalEditor(itemId) {
        if (!itemModal || !itemId) return;
        itemModal.dataset.mode = 'edit';
        if (itemModalTitle) itemModalTitle.textContent = `แก้ไขสินค้า #${itemId}`;
        resetItemModalFields();
        openModal(itemModal);
        showInlineMessage(itemModalMessage, 'กำลังโหลดข้อมูลสินค้า...', 'info');
        toggleModalLoading(itemModalForm, itemModalSave, true);
        try {
            const detail = await fetchItemDetail(itemId);
            fillItemModalFields(detail);
            showInlineMessage(itemModalMessage, '');
        } catch (error) {
            showInlineMessage(itemModalMessage, translateItemModalError(error), 'error');
        } finally {
            toggleModalLoading(itemModalForm, itemModalSave, false);
        }
    }

    function normalizeCategoryId(value) {
        if (value == null || value === '') {
            return null;
        }
        const parsed = Number(value);
        return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
    }

    function normalizeRate(value) {
        if (value == null || value === '') {
            return null;
        }
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }

    async function submitItemModal(event) {
        event.preventDefault();
        if (!itemModalForm || !itemModal) return;
        const mode = itemModal.dataset.mode === 'edit' ? 'edit' : 'create';
        const name = itemModalFields.name?.value.trim() || '';
        const uom = itemModalFields.uom?.value.trim() || '';
        if (!name) {
            showInlineMessage(itemModalMessage, 'กรุณากรอกชื่อสินค้า', 'error');
            return;
        }
        if (!uom) {
            showInlineMessage(itemModalMessage, 'กรุณาระบุหน่วยนับ', 'error');
            return;
        }
        const payload = {
            item_name: name,
            ref_item_id: itemModalFields.ref?.value.trim() || '',
            item_type: itemModalFields.type?.value || 'อุปกร',
            item_category_id: normalizeCategoryId(itemModalFields.category?.value),
            brand: itemModalFields.brand?.value.trim() || '',
            model: itemModalFields.model?.value.trim() || '',
            uom,
            rate: normalizeRate(itemModalFields.rate?.value),
            period: itemModalFields.period?.value || 'day',
        };
        const body = { ...payload };
        if (body.rate === null) {
            delete body.rate;
        }
        if (body.item_category_id === null) {
            delete body.item_category_id;
        }
        const itemId = itemModalFields.id?.value.trim();
        if (mode === 'edit' && itemId) {
            body.item_id = itemId;
        }
        const url = mode === 'edit' ? `${modelRoot}/item_update.php` : `${modelRoot}/item_create.php`;
        toggleModalLoading(itemModalForm, itemModalSave, true);
        showInlineMessage(itemModalMessage, 'กำลังบันทึกสินค้า...', 'info');
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
            const label = formatItemLookupLabel(detail);
            const targetField = lookupContext?.type === 'item' ? lookupContext.field : getLookupField('item');
            targetField?.setValue(detail.item_id != null ? String(detail.item_id) : '', label);
            showInlineMessage(itemModalMessage, 'บันทึกสินค้าเรียบร้อยแล้ว', 'success');
            closeModal(itemModal);
        } catch (error) {
            showInlineMessage(itemModalMessage, translateItemModalError(error), 'error');
        } finally {
            toggleModalLoading(itemModalForm, itemModalSave, false);
        }
    }

    function translateItemModalError(error) {
        if (error instanceof RequestError) {
            switch (error.code) {
                case 'missing_name':
                    return 'กรุณากรอกชื่อสินค้า';
                case 'missing_id':
                case 'invalid_id':
                    return 'ไม่พบสินค้าที่ต้องการแก้ไข';
                case 'unauthorized':
                    return 'สิทธิ์หมดอายุ กรุณาเข้าสู่ระบบใหม่';
                default:
                    return 'ไม่สามารถบันทึกสินค้าได้ โปรดลองอีกครั้ง';
            }
        }
        return 'ไม่สามารถบันทึกสินค้าได้ โปรดลองอีกครั้ง';
    }

    function resetWarehouseModalFields(seedName = '') {
        if (warehouseModalFields.id) warehouseModalFields.id.value = '';
        if (warehouseModalFields.name) warehouseModalFields.name.value = seedName || '';
        if (warehouseModalFields.short) warehouseModalFields.short.value = '';
        if (warehouseModalFields.status) warehouseModalFields.status.value = 'active';
        if (warehouseModalFields.location) warehouseModalFields.location.value = '';
        if (warehouseModalFields.note) warehouseModalFields.note.value = '';
    }

    function fillWarehouseModalFields(detail) {
        if (!detail) {
            resetWarehouseModalFields();
            return;
        }
        if (warehouseModalFields.id) warehouseModalFields.id.value = detail.warehouse_id != null ? String(detail.warehouse_id) : '';
        if (warehouseModalFields.name) warehouseModalFields.name.value = detail.warehouse_name || '';
        if (warehouseModalFields.short) warehouseModalFields.short.value = detail.warehouse_sn || '';
        if (warehouseModalFields.status) warehouseModalFields.status.value = detail.status || 'active';
        if (warehouseModalFields.location) warehouseModalFields.location.value = detail.location_id != null ? String(detail.location_id) : '';
        if (warehouseModalFields.note) warehouseModalFields.note.value = detail.note || '';
    }

    function openWarehouseModalCreator(seedName = '') {
        if (!warehouseModal) return;
        warehouseModal.dataset.mode = 'create';
        if (warehouseModalTitle) warehouseModalTitle.textContent = 'สร้างคลังใหม่';
        showInlineMessage(warehouseModalMessage, '');
        resetWarehouseModalFields(seedName);
        toggleModalLoading(warehouseModalForm, warehouseModalSave, false);
        openModal(warehouseModal);
    }

    async function openWarehouseModalEditor(warehouseId) {
        if (!warehouseModal || !warehouseId) return;
        warehouseModal.dataset.mode = 'edit';
        if (warehouseModalTitle) warehouseModalTitle.textContent = `แก้ไขคลัง #${warehouseId}`;
        resetWarehouseModalFields();
        openModal(warehouseModal);
        showInlineMessage(warehouseModalMessage, 'กำลังโหลดข้อมูลคลัง...', 'info');
        toggleModalLoading(warehouseModalForm, warehouseModalSave, true);
        try {
            const detail = await fetchWarehouseDetail(warehouseId);
            fillWarehouseModalFields(detail);
            showInlineMessage(warehouseModalMessage, '');
        } catch (error) {
            showInlineMessage(warehouseModalMessage, translateWarehouseModalError(error), 'error');
        } finally {
            toggleModalLoading(warehouseModalForm, warehouseModalSave, false);
        }
    }

    function normalizeLocationId(value) {
        if (value == null || value === '') {
            return null;
        }
        const parsed = Number(value);
        return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
    }

    async function submitWarehouseModal(event) {
        event.preventDefault();
        if (!warehouseModalForm || !warehouseModal) return;
        const mode = warehouseModal.dataset.mode === 'edit' ? 'edit' : 'create';
        const name = warehouseModalFields.name?.value.trim() || '';
        if (!name) {
            showInlineMessage(warehouseModalMessage, 'กรุณากรอกชื่อคลัง', 'error');
            return;
        }
        const payload = {
            warehouse_name: name,
            warehouse_sn: warehouseModalFields.short?.value.trim() || '',
            status: warehouseModalFields.status?.value || 'active',
            note: warehouseModalFields.note?.value.trim() || '',
            location_id: normalizeLocationId(warehouseModalFields.location?.value),
        };
        const body = { ...payload };
        if (body.location_id === null) {
            delete body.location_id;
        }
        const warehouseId = warehouseModalFields.id?.value.trim();
        if (mode === 'edit' && warehouseId) {
            body.warehouse_id = warehouseId;
        }
        const url = mode === 'edit' ? `${modelRoot}/warehouse_update.php` : `${modelRoot}/warehouse_create.php`;
        toggleModalLoading(warehouseModalForm, warehouseModalSave, true);
        showInlineMessage(warehouseModalMessage, 'กำลังบันทึกคลัง...', 'info');
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
            const label = formatWarehouseLookupLabel(detail);
            const targetField = lookupContext?.type === 'warehouse' ? lookupContext.field : getLookupField('warehouse');
            targetField?.setValue(detail.warehouse_id != null ? String(detail.warehouse_id) : '', label);
            showInlineMessage(warehouseModalMessage, 'บันทึกคลังเรียบร้อยแล้ว', 'success');
            closeModal(warehouseModal);
        } catch (error) {
            showInlineMessage(warehouseModalMessage, translateWarehouseModalError(error), 'error');
        } finally {
            toggleModalLoading(warehouseModalForm, warehouseModalSave, false);
        }
    }

    function translateWarehouseModalError(error) {
        if (error instanceof RequestError) {
            switch (error.code) {
                case 'missing_name':
                    return 'กรุณากรอกชื่อคลัง';
                case 'warehouse_sn_exists':
                    return 'ชื่อย่อซ้ำกับข้อมูลที่มีอยู่';
                case 'invalid_id':
                case 'not_found':
                    return 'ไม่พบคลังที่ต้องการแก้ไข';
                case 'unauthorized':
                    return 'สิทธิ์หมดอายุ กรุณาเข้าสู่ระบบใหม่';
                default:
                    return 'ไม่สามารถบันทึกข้อมูลคลังได้ โปรดลองอีกครั้ง';
            }
        }
        return 'ไม่สามารถบันทึกข้อมูลคลังได้ โปรดลองอีกครั้ง';
    }

    function handleFieldMutated() {
        syncMetaFromForm();
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
        preventEnterSubmit(form);
        form.addEventListener('input', handleFieldMutated);
        form.addEventListener('change', handleFieldMutated);
        form.addEventListener('submit', handleSubmit);
        if (fieldRefs.ownership) {
            fieldRefs.ownership.addEventListener('change', updateOwnershipDependentFields);
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

    if (itemModalForm) {
        preventEnterSubmit(itemModalForm);
        itemModalForm.addEventListener('submit', submitItemModal);
    }

    if (warehouseModalForm) {
        preventEnterSubmit(warehouseModalForm);
        warehouseModalForm.addEventListener('submit', submitWarehouseModal);
    }

    document.querySelectorAll('[data-modal-dismiss]').forEach((element) => {
        element.addEventListener('click', () => {
            const modal = element.closest('.modal');
            closeModal(modal);
        });
    });

    updateOwnershipDependentFields();
    window.addEventListener('beforeunload', handleBeforeUnload);

    async function boot(context) {
        modelRoot = `${context.root}/Model`;
        updateThaiDate();
        setInterval(updateThaiDate, 1000);
        initLookupFields();
        attachFieldListeners();
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
                : 'ไม่พบข้อมูลหน่วยสินค้า';
            showMessage(message, 'error');
        }
    }

    if (typeof window.onAppReady === 'function') {
        window.onAppReady(boot);
    }
})();