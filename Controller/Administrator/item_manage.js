(function () {
    const form = document.getElementById('itemForm');
    const messageBox = document.getElementById('formMessage');
    const itemHeading = document.getElementById('itemHeading');
    const itemIdDisplay = document.getElementById('itemIdDisplay');
    const itemCategoryDisplay = document.getElementById('itemCategoryDisplay');
    const itemTypeDisplay = document.getElementById('itemTypeDisplay');
    const itemUpdatedAt = document.getElementById('itemUpdatedAt');
    const itemUpdatedBy = document.getElementById('itemUpdatedBy');
    const itemCreatedAt = document.getElementById('itemCreatedAt');
    const itemCreatedBy = document.getElementById('itemCreatedBy');
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
    const categoryInput = document.getElementById('categoryInput');
    const categoryHidden = document.getElementById('itemCategoryId');
    const categoryList = document.getElementById('categoryList');
    const categoryEditBtn = document.getElementById('categoryEditBtn');
    const categoryModal = document.getElementById('categoryModal');
    const categoryModalTitle = document.getElementById('categoryModalTitle');
    const categoryModalForm = document.getElementById('categoryModalForm');
    const categoryModalMessage = document.getElementById('categoryModalMessage');
    const categoryModalName = document.getElementById('categoryModalName');
    const categoryModalNote = document.getElementById('categoryModalNote');
    const categoryModalSave = document.getElementById('categoryModalSave');
    const unitSearchInput = document.getElementById('searchInput');
    const unitStatusFilter = document.getElementById('statusFilter');
    const unitOwnershipFilter = document.getElementById('ownershipFilter');
    const unitClearFiltersBtn = document.getElementById('btnClearFilters');
    const unitTableBody = document.getElementById('itemUnitTableBody');
    const unitEmptyState = document.getElementById('emptyState');
    const unitPrevPageBtn = document.getElementById('prevPage');
    const unitNextPageBtn = document.getElementById('nextPage');
    const unitPageIndicator = document.getElementById('pageIndicator');
    const unitSortButtons = document.querySelectorAll('#item-unit-panel .sort-button');
    const statusChart = document.getElementById('itemStatusChart');
    const statusChartMessage = document.getElementById('statusChartMessage');
    const statusMonthLabel = document.getElementById('statusMonthLabel');
    const statusPrevMonth = document.getElementById('statusPrevMonth');
    const statusNextMonth = document.getElementById('statusNextMonth');
    const statusCurrentMonth = document.getElementById('statusCurrentMonth');

    const fieldRefs = {
        code: document.getElementById('itemCode'),
        ref: document.getElementById('refItemId'),
        name: document.getElementById('itemName'),
        type: document.getElementById('itemType'),
        category: categoryHidden,
        brand: document.getElementById('itemBrand'),
        model: document.getElementById('itemModel'),
        uom: document.getElementById('itemUom'),
        rate: document.getElementById('itemRate'),
        period: document.getElementById('itemPeriod'),
    };

    const periodOptions = new Set(['hour', 'day', 'event']);
    
    const params = new URLSearchParams(window.location.search);
    const itemIdParam = params.get('item_id');
    const isCreateRequested = params.get('mode') === 'create';
    let currentItemId = itemIdParam ? String(itemIdParam) : null;
    let isCreateMode = !currentItemId || isCreateRequested;
    let modelRoot = '';
    let isDirty = false;
    let isSaving = false;
    let initialSnapshot = null;
    let pendingNavigationAction = null;
    let isPopulating = false;
    let categoryTypeahead = null;
    let snapshotCategoryLabel = '';
    let itemUnits = [];
    let filteredUnits = [];
    let unitPage = 1;
    let unitSortKey = 'item_unit_id';
    let unitSortDirection = 'desc';
    let statusMonth = new Date();
    statusMonth.setDate(1);

    const maintenanceScheduleTypes = new Set([
        'maintenance_repair',
        'maintenance_preventive',
        'inspection_test',
        'cleaning',
    ]);

    const detailStatusLabels = {
        useable: 'พร้อมใช้งาน',
        'in use': 'กำลังใช้งาน',
        booked: 'ถูกจอง',
        'pending booking': 'รอการจอง',
        returned: 'ส่งคืนแล้ว',
        delivering: 'กำลังขนส่ง',
        reparing: 'กำลังซ่อม',
        damaged: 'ชำรุด',
        depreciated: 'เก็บถาวร',
        archived: 'เก็บถาวร',
    };

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
        messageBox.textContent = message;
        messageBox.hidden = false;
        messageBox.className = `form-alert ${variant}`;
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

    function normalizePeriodValue(value) {
        if (!value) {
            return 'day';
        }
        return periodOptions.has(value) ? value : 'day';
    }

    function updateCategoryActionState() {
        if (!categoryEditBtn) {
            return;
        }
        const hasId = Boolean(categoryHidden?.value?.trim());
        categoryEditBtn.disabled = !hasId;
        categoryEditBtn.setAttribute('aria-disabled', hasId ? 'false' : 'true');
    }

    class CategoryTypeahead {
        constructor(input, hidden, list) {
            this.input = input;
            this.hidden = hidden;
            this.list = list;
            this.root = input?.closest('.typeahead') || null;
            this.debounceHandle = null;
            this.requestToken = 0;
            this.currentLabel = hidden?.dataset.categoryLabel || '';
            this.items = [];
            this.handleOutsideClick = (event) => {
                if (!this.root) return;
                if (this.root.contains(event.target)) return;
                if (this.list?.contains(event.target)) return;
                this.closeList();
            };
            this.bindEvents();
        }

        bindEvents() {
            if (this.input) {
                this.input.addEventListener('input', () => {
                    this.clearSelection();
                    this.scheduleFetch();
                });
                this.input.addEventListener('focus', () => {
                    this.fetch(this.input.value.trim());
                });
                this.input.addEventListener('keydown', (event) => {
                    if (event.key === 'Escape') {
                        this.closeList();
                    }
                });
            }
            document.addEventListener('click', this.handleOutsideClick);
        }

        scheduleFetch() {
            if (!this.input) return;
            if (this.debounceHandle) {
                clearTimeout(this.debounceHandle);
            }
            this.debounceHandle = setTimeout(() => {
                this.fetch(this.input.value.trim());
            }, 250);
        }

        clearSelection() {
            if (this.hidden) {
                const previous = this.hidden.value;
                this.hidden.value = '';
                this.hidden.dataset.categoryLabel = '';
                if (previous) {
                    this.hidden.dispatchEvent(new Event('input', { bubbles: true }));
                    this.hidden.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
            this.currentLabel = '';
            updateCategoryActionState();
            syncCategoryDisplayFromForm('');
        }

        async fetch(query) {
            if (!modelRoot || !this.list) {
                return;
            }
            const token = ++this.requestToken;
            try {
                const params = new URLSearchParams();
                if (query) params.set('q', query);
                const response = await fetch(`${modelRoot}/item_categories_option.php?${params.toString()}`, {
                    credentials: 'same-origin',
                });
                if (!response.ok) {
                    throw new Error('network');
                }
                const payload = await response.json();
                if (token !== this.requestToken) {
                    return;
                }
                const options = Array.isArray(payload.data) ? payload.data : [];
                this.items = options;
                this.renderList(options, query);
            } catch (err) {
                if (token !== this.requestToken) {
                    return;
                }
                this.renderList([], query);
            }
        }

        renderList(items, query) {
            if (!this.list) return;
            this.list.innerHTML = '';
            const fragment = document.createDocumentFragment();
            const normalizedQuery = typeof query === 'string' ? query.trim() : '';
            fragment.append(this.buildInstantCreateOption(normalizedQuery));
            if (items.length) {
                for (const item of items) {
                    const option = document.createElement('button');
                    option.type = 'button';
                    option.className = 'typeahead-option';
                    const label = (item.name || '').trim();
                    const displayLabel = label || 'หมวดหมู่ไม่มีชื่อ';
                    option.textContent = displayLabel;
                    option.addEventListener('click', () => {
                        const id = item.item_category_id != null ? String(item.item_category_id) : item.id != null ? String(item.id) : '';
                        this.setValue(id, displayLabel);
                        this.closeList();
                    });
                    fragment.append(option);
                }
            } else {
                const empty = document.createElement('div');
                empty.className = 'typeahead-empty';
                empty.textContent = 'ไม่พบหมวดหมู่ที่ตรงกับคำค้นหา';
                fragment.append(empty);
            }
            this.list.append(fragment);
            this.list.hidden = false;
        }

        buildInstantCreateOption(initialName) {
            const option = document.createElement('button');
            option.type = 'button';
            option.className = 'typeahead-option typeahead-option-create';
            const seed = typeof initialName === 'string' ? initialName.trim() : '';
            option.textContent = seed ? `➕ สร้างหมวดหมู่ใหม่ “${seed}”` : '➕ สร้างหมวดหมู่ใหม่';
            option.addEventListener('click', (event) => {
                event.preventDefault();
                this.closeList();
                const fallback = this.input?.value.trim() || '';
                openCategoryModalForCreate(seed || fallback);
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
            const nextId = id || '';
            const nextLabel = (label || '').trim();
            if (this.hidden) {
                const previous = this.hidden.value;
                this.hidden.value = nextId;
                this.hidden.dataset.categoryLabel = nextLabel;
                if (!options.silent && previous !== nextId) {
                    this.hidden.dispatchEvent(new Event('input', { bubbles: true }));
                    this.hidden.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
            if (this.input) {
                this.input.value = nextLabel;
            }
            this.currentLabel = nextLabel;
            updateCategoryActionState();
            syncCategoryDisplayFromForm(this.currentLabel);
        }

        getLabel() {
            return this.currentLabel;
        }
    }

    function openCategoryModalShell() {
        if (!categoryModal) return;
        categoryModal.hidden = false;
        categoryModal.setAttribute('aria-hidden', 'false');
        const autofocus = categoryModal.querySelector('[data-autofocus]');
        autofocus?.focus();
    }

    function closeCategoryModal() {
        if (!categoryModal) return;
        categoryModal.hidden = true;
        categoryModal.setAttribute('aria-hidden', 'true');
        delete categoryModal.dataset.mode;
        delete categoryModal.dataset.categoryId;
        resetCategoryModalFields();
        showInlineMessage(categoryModalMessage, '');
        toggleCategoryModalForm(false);
    }

    function resetCategoryModalFields(initialName = '') {
        if (categoryModalForm) {
            categoryModalForm.reset();
        }
        if (categoryModalName) {
            categoryModalName.value = initialName || '';
        }
        if (categoryModalNote) {
            categoryModalNote.value = '';
        }
        if (categoryModalSave) {
            categoryModalSave.disabled = false;
        }
    }

    function toggleCategoryModalForm(isLoading) {
        if (!categoryModalForm) return;
        const controls = categoryModalForm.querySelectorAll('input, textarea, button');
        controls.forEach((control) => {
            if (control.matches('[data-modal-dismiss]')) {
                return;
            }
            control.disabled = Boolean(isLoading);
        });
        if (categoryModalSave) {
            categoryModalSave.disabled = Boolean(isLoading);
        }
    }

    function openCategoryModalForCreate(initialName = '') {
        if (!categoryModal || !categoryModalForm) return;
        categoryModal.dataset.mode = 'create';
        resetCategoryModalFields(initialName);
        if (categoryModalTitle) {
            categoryModalTitle.textContent = 'สร้างหมวดหมู่สินค้าใหม่';
        }
        showInlineMessage(categoryModalMessage, '');
        toggleCategoryModalForm(false);
        openCategoryModalShell();
    }

    async function openCategoryModalForEdit() {
        if (!categoryModal || !categoryModalForm) return;
        const categoryId = categoryHidden?.value?.trim();
        if (!categoryId) return;
        categoryModal.dataset.mode = 'edit';
        categoryModal.dataset.categoryId = categoryId;
        if (categoryModalTitle) {
            categoryModalTitle.textContent = 'แก้ไขหมวดหมู่สินค้า';
        }
        showInlineMessage(categoryModalMessage, 'กำลังโหลดข้อมูลหมวดหมู่...', 'info');
        toggleCategoryModalForm(true);
        openCategoryModalShell();
        try {
            const detail = await fetchCategoryDetailForModal(categoryId);
            if (categoryModalName) categoryModalName.value = detail.name || '';
            if (categoryModalNote) categoryModalNote.value = detail.note || '';
            showInlineMessage(categoryModalMessage, '');
            toggleCategoryModalForm(false);
        } catch (error) {
            showInlineMessage(categoryModalMessage, translateCategoryModalError(error), 'error');
            toggleCategoryModalForm(false);
            if (categoryModalSave) {
                categoryModalSave.disabled = true;
            }
        }
    }

    async function submitCategoryModal(event) {
        event.preventDefault();
        if (!categoryModal || !categoryModalForm) {
            return;
        }
        const nameValue = categoryModalName?.value.trim() || '';
        const noteValue = categoryModalNote?.value.trim() || '';
        if (!nameValue) {
            showInlineMessage(categoryModalMessage, 'กรุณากรอกชื่อหมวดหมู่', 'error');
            categoryModalName?.focus();
            return;
        }
        const mode = categoryModal.dataset.mode === 'edit' ? 'edit' : 'create';
        const payload = { name: nameValue, note: noteValue };
        let url = `${modelRoot}/item_category_create.php`;
        if (mode === 'edit') {
            const categoryId = categoryModal.dataset.categoryId;
            payload.item_category_id = categoryId;
            url = `${modelRoot}/item_category_update.php`;
        }
        showInlineMessage(categoryModalMessage, 'กำลังบันทึก...', 'info');
        toggleCategoryModalForm(true);
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify(payload),
            });
            const result = await safeJson(response);
            const hasError = !response.ok || !result || result.error;
            if (hasError) {
                const code = result?.error || mapStatusToError(response.status);
                throw new RequestError(code);
            }
            const detail = result.data || {};
            const nextId = detail.item_category_id != null ? String(detail.item_category_id) : payload.item_category_id || '';
            const label = detail.name || nameValue;
            categoryTypeahead?.setValue(nextId, label);
            showInlineMessage(categoryModalMessage, 'บันทึกหมวดหมู่เรียบร้อยแล้ว', 'success');
            toggleCategoryModalForm(false);
            closeCategoryModal();
            try {
                sessionStorage.setItem('item-categories:refresh', '1');
            } catch (err) {
                // ignore storage errors
            }
            showMessage(mode === 'edit' ? 'แก้ไขหมวดหมู่เรียบร้อยแล้ว' : 'สร้างหมวดหมู่ใหม่เรียบร้อยแล้ว', 'success');
        } catch (error) {
            toggleCategoryModalForm(false);
            showInlineMessage(categoryModalMessage, translateCategoryModalError(error), 'error');
        }
    }

    async function fetchCategoryDetailForModal(categoryId) {
        const response = await fetch(`${modelRoot}/item_category_detail.php?id=${encodeURIComponent(categoryId)}`, {
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

    function translateCategoryModalError(error) {
        if (error instanceof RequestError) {
            switch (error.code) {
                case 'missing_name':
                    return 'กรุณากรอกชื่อหมวดหมู่';
                case 'not_found':
                case 'invalid_id':
                    return 'ไม่พบหมวดหมู่ที่ต้องการแก้ไข';
                case 'unauthorized':
                    return 'สิทธิ์การใช้งานหมดอายุ กรุณาเข้าสู่ระบบใหม่';
                default:
                    return 'ไม่สามารถบันทึกหมวดหมู่ได้ โปรดลองใหม่อีกครั้ง';
            }
        }
        if (error instanceof TypeError) {
            return 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้ โปรดลองใหม่อีกครั้ง';
        }
        return 'ไม่สามารถบันทึกหมวดหมู่ได้ โปรดลองใหม่อีกครั้ง';
    }

    function initializeCategoryField() {
        if (!categoryInput || !categoryHidden || !categoryList) {
            updateCategoryActionState();
            return;
        }
        categoryTypeahead = new CategoryTypeahead(categoryInput, categoryHidden, categoryList);
        updateCategoryActionState();
    }
    
    function serializeForm() {
        return {
            ref_item_id: fieldRefs.ref?.value.trim() || '',
            item_name: fieldRefs.name?.value.trim() || '',
            item_type: fieldRefs.type?.value || 'อุปกร',
            item_category_id: fieldRefs.category?.value || '',
            brand: fieldRefs.brand?.value.trim() || '',
            model: fieldRefs.model?.value.trim() || '',
            uom: fieldRefs.uom?.value.trim() || '',
            rate: fieldRefs.rate?.value.trim() || '',
            period: normalizePeriodValue(fieldRefs.period?.value),
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
        if (btnSave) {
            btnSave.disabled = disable;
        }
        if (btnSaveInline) {
            btnSaveInline.disabled = disable;
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
        if (isSaving || isPopulating || !initialSnapshot) {
            return;
        }
        setDirtyState(true);
    }

    function updateMeta(data) {
        const id = data?.item_id != null ? String(data.item_id) : '—';
        if (itemIdDisplay) itemIdDisplay.textContent = id;
        if (fieldRefs.code) fieldRefs.code.value = id;
        if (itemCategoryDisplay) {
            const label = data?.category_name ? data.category_name : '—';
            itemCategoryDisplay.textContent = `หมวดหมู่: ${label}`;
        }
        if (itemTypeDisplay) {
            itemTypeDisplay.textContent = `ประเภท: ${formatType(data?.item_type)}`;
        }
        if (itemUpdatedAt) itemUpdatedAt.textContent = `อัปเดตล่าสุด: ${formatDateTime(data?.updated_at)}`;
        if (itemUpdatedBy) itemUpdatedBy.textContent = `ปรับปรุงโดย: ${data?.updated_by_name || '—'}`;
        if (itemCreatedAt) itemCreatedAt.textContent = `สร้างเมื่อ: ${formatDateTime(data?.created_at)}`;
        if (itemCreatedBy) itemCreatedBy.textContent = `สร้างโดย: ${data?.created_by_name || '—'}`;
    }

    function syncCategoryDisplayFromForm(labelOverride = null) {
        if (!itemCategoryDisplay) {
            return;
        }
        const label = labelOverride != null
            ? labelOverride
            : categoryTypeahead?.getLabel() || categoryHidden?.dataset.categoryLabel || '';
        itemCategoryDisplay.textContent = `หมวดหมู่: ${label ? label : '—'}`;
    }

    function populateForm(data) {
        const snapshot = {
            ref_item_id: data?.ref_item_id || '',
            item_name: data?.item_name || '',
            item_type: data?.item_type || 'อุปกร',
            item_category_id: data?.item_category_id != null ? String(data.item_category_id) : '',
            brand: data?.brand || '',
            model: data?.model || '',
            uom: data?.uom || 'unit',
            rate: data?.rate != null ? String(data.rate) : '',
            period: normalizePeriodValue(data?.period),
        };
        runWithPopulation(() => {
            if (fieldRefs.ref) fieldRefs.ref.value = snapshot.ref_item_id;
            if (fieldRefs.name) fieldRefs.name.value = snapshot.item_name;
            if (fieldRefs.type) fieldRefs.type.value = snapshot.item_type;
            if (categoryTypeahead) {
                categoryTypeahead.setValue(snapshot.item_category_id, data?.category_name || '', { silent: true });
            } else if (fieldRefs.category) {
                fieldRefs.category.value = snapshot.item_category_id;
            }
            if (fieldRefs.brand) fieldRefs.brand.value = snapshot.brand;
            if (fieldRefs.model) fieldRefs.model.value = snapshot.model;
            if (fieldRefs.uom) fieldRefs.uom.value = snapshot.uom;
            if (fieldRefs.rate) fieldRefs.rate.value = snapshot.rate;
            if (fieldRefs.period) fieldRefs.period.value = snapshot.period;
        });
        snapshotCategoryLabel = categoryTypeahead?.getLabel() || data?.category_name || '';
        updateMeta(data);
        syncCategoryDisplayFromForm(data?.category_name || '');
        initialSnapshot = serializeForm();
        setDirtyState(false);
    }

    function restoreSnapshot(snapshot) {
        if (!snapshot) {
            return;
        }
        runWithPopulation(() => {
            if (fieldRefs.ref) fieldRefs.ref.value = snapshot.ref_item_id || '';
            if (fieldRefs.name) fieldRefs.name.value = snapshot.item_name || '';
            if (fieldRefs.type) fieldRefs.type.value = snapshot.item_type || 'อุปกร';
            if (categoryTypeahead) {
                categoryTypeahead.setValue(snapshot.item_category_id || '', snapshotCategoryLabel || '', { silent: true });
            } else if (fieldRefs.category) {
                fieldRefs.category.value = snapshot.item_category_id || '';
            }
            if (fieldRefs.brand) fieldRefs.brand.value = snapshot.brand || '';
            if (fieldRefs.model) fieldRefs.model.value = snapshot.model || '';
            if (fieldRefs.uom) fieldRefs.uom.value = snapshot.uom || '';
            if (fieldRefs.rate) fieldRefs.rate.value = snapshot.rate || '';
            if (fieldRefs.period) fieldRefs.period.value = snapshot.period || '';
        });
        syncCategoryDisplayFromForm();
        setDirtyState(false);
    }

    function prepareCreateMode() {
        isCreateMode = true;
        currentItemId = null;
        if (itemHeading) {
            itemHeading.textContent = 'สร้างสินค้าใหม่';
        }
        runWithPopulation(() => {
            form?.reset();
            if (fieldRefs.code) {
                fieldRefs.code.value = 'ใหม่';
            }
            if (fieldRefs.type) fieldRefs.type.value = 'อุปกร';
            if (fieldRefs.uom) fieldRefs.uom.value = 'unit';
            if (fieldRefs.period) fieldRefs.period.value = 'day';
        });
        if (categoryTypeahead) {
            categoryTypeahead.setValue('', '', { silent: true });
        } else if (fieldRefs.category) {
            fieldRefs.category.value = '';
        }
        updateMeta({});
        snapshotCategoryLabel = '';
        initialSnapshot = serializeForm();
        setDirtyState(false);
        showMessage('');
        resetUnitPanelState('บันทึกสินค้าเพื่อดูหน่วยสินค้า');
        showStatusChartMessage('บันทึกสินค้าก่อนเพื่อดูกราฟสถานะ');
        setStatusControlsEnabled(false);
    }

    function formatType(type) {
        if (!type) return '—';
        switch (type) {
            case 'อุปกร':
                return 'อุปกรณ์';
            case 'วัสดุ':
                return 'วัสดุ';
            case 'บริการ':
                return 'บริการ';
            default:
                return type;
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

    function formatStatus(status) {
        if (!status) return '—';
        return detailStatusLabels[status] || status;
    }

    function formatOwnership(value) {
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

    function formatUnitIdentifier(serial, fallback) {
        if (serial) {
            return `${String(serial)} (#${fallback})`;
        }
        return `#${fallback}`;
    }

    function updateUnitEmptyState(show) {
        if (!unitEmptyState) return;
        unitEmptyState.classList.toggle('show', show);
        unitEmptyState.setAttribute('aria-hidden', show ? 'false' : 'true');
    }

    function renderUnitTable(rows) {
        if (!unitTableBody) return;
        unitTableBody.innerHTML = '';
        if (!rows.length) {
            updateUnitEmptyState(true);
            return;
        }
        updateUnitEmptyState(false);
        const fragment = document.createDocumentFragment();
        for (const row of rows) {
            const returnToUrl = encodeURIComponent(`${window.location.pathname}${window.location.search}`);
            const manageUrl = `./item_unit_manage.html?item_unit_id=${encodeURIComponent(row.item_unit_id)}&return_to=${returnToUrl}`;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${formatUnitIdentifier(row.serial_number, row.item_unit_id)}</td>
                <td>${formatOwnership(row.ownership)}</td>
                <td>${formatStatus(row.status)}</td>
                <td>${formatDateTime(row.expected_return_at)}</td>
                <td class="col-actions">
                    <a class="action-btn" href="${manageUrl}" aria-label="เปิดหน่วยสินค้า ${row.item_unit_id}">
                    <span class="i pencil"></span>จัดการ
                    </a>
                </td>
            `;
            fragment.append(tr);
        }
        unitTableBody.append(fragment);
    }

    function updateUnitPagination() {
        if (!unitPageIndicator) return;
        const totalPages = Math.max(1, Math.ceil(filteredUnits.length / 10));
        if (unitPage > totalPages) unitPage = totalPages;
        unitPageIndicator.textContent = `หน้า ${unitPage} / ${totalPages}`;
        if (unitPrevPageBtn) {
            unitPrevPageBtn.disabled = unitPage <= 1;
        }
        if (unitNextPageBtn) {
            unitNextPageBtn.disabled = unitPage >= totalPages;
        }
    }

    function applyUnitFilters() {
        const term = unitSearchInput?.value.trim().toLowerCase() || '';
        const statusValue = unitStatusFilter?.value || 'all';
        const ownershipValue = unitOwnershipFilter?.value || 'all';

        filteredUnits = itemUnits.filter((row) => {
            const matchesSearch = term
                ? (`${row.item_unit_id}`.toLowerCase().includes(term)
                    || `${row.serial_number || ''}`.toLowerCase().includes(term))
                : true;
            const matchesStatus = statusValue === 'all' ? true : row.status === statusValue;
            const matchesOwnership = ownershipValue === 'all' ? true : row.ownership === ownershipValue;
            return matchesSearch && matchesStatus && matchesOwnership;
        });
        sortUnitRows();
        unitPage = 1;
        renderUnitPage();
    }

    function sortUnitRows() {
        const direction = unitSortDirection === 'asc' ? 1 : -1;
        filteredUnits.sort((a, b) => {
            const aVal = a[unitSortKey];
            const bVal = b[unitSortKey];
            if (aVal === bVal) return 0;
            if (aVal === undefined || aVal === null) return 1;
            if (bVal === undefined || bVal === null) return -1;
            if (typeof aVal === 'number' && typeof bVal === 'number') {
                return (aVal - bVal) * direction;
            }
            return String(aVal).localeCompare(String(bVal)) * direction;
        });
    }

    function renderUnitPage() {
        const start = (unitPage - 1) * 10;
        const pageRows = filteredUnits.slice(start, start + 10);
        renderUnitTable(pageRows);
        updateUnitPagination();
    }

    function updateUnitSortIndicators() {
        unitSortButtons?.forEach((button) => {
            const key = button.dataset.sortKey;
            const isActive = key === unitSortKey;
            button.parentElement?.setAttribute('aria-sort', isActive ? (unitSortDirection === 'asc' ? 'ascending' : 'descending') : 'none');
            button.classList.toggle('active', isActive);
            button.querySelector('.sort-indicator')?.classList.toggle('asc', isActive && unitSortDirection === 'asc');
            button.querySelector('.sort-indicator')?.classList.toggle('desc', isActive && unitSortDirection === 'desc');
        });
    }

    function resetUnitPanelState(message) {
        if (unitSearchInput) unitSearchInput.disabled = true;
        if (unitStatusFilter) unitStatusFilter.disabled = true;
        if (unitOwnershipFilter) unitOwnershipFilter.disabled = true;
        if (unitClearFiltersBtn) unitClearFiltersBtn.disabled = true;
        if (unitPrevPageBtn) unitPrevPageBtn.disabled = true;
        if (unitNextPageBtn) unitNextPageBtn.disabled = true;
        if (unitPageIndicator) unitPageIndicator.textContent = '—';
        if (unitTableBody) {
            unitTableBody.innerHTML = `<tr><td colspan="7" class="loading">${message}</td></tr>`;
        }
        updateUnitEmptyState(false);
    }

    function enableUnitPanel() {
        if (unitSearchInput) unitSearchInput.disabled = false;
        if (unitStatusFilter) unitStatusFilter.disabled = false;
        if (unitOwnershipFilter) unitOwnershipFilter.disabled = false;
        if (unitClearFiltersBtn) unitClearFiltersBtn.disabled = false;
    }

    function attachUnitPanelEvents() {
        unitSearchInput?.addEventListener('input', () => {
            applyUnitFilters();
        });
        unitStatusFilter?.addEventListener('change', () => {
            applyUnitFilters();
        });
        unitOwnershipFilter?.addEventListener('change', () => {
            applyUnitFilters();
        });
        unitClearFiltersBtn?.addEventListener('click', () => {
            if (unitSearchInput) unitSearchInput.value = '';
            if (unitStatusFilter) unitStatusFilter.value = 'all';
            if (unitOwnershipFilter) unitOwnershipFilter.value = 'all';
            applyUnitFilters();
        });
        unitPrevPageBtn?.addEventListener('click', () => {
            if (unitPage > 1) {
                unitPage -= 1;
                renderUnitPage();
            }
        });
        unitNextPageBtn?.addEventListener('click', () => {
            const totalPages = Math.max(1, Math.ceil(filteredUnits.length / 10));
            if (unitPage < totalPages) {
                unitPage += 1;
                renderUnitPage();
            }
        });
        unitSortButtons?.forEach((button) => {
            button.addEventListener('click', () => {
                const key = button.dataset.sortKey || 'item_unit_id';
                if (unitSortKey === key) {
                    unitSortDirection = unitSortDirection === 'asc' ? 'desc' : 'asc';
                } else {
                    unitSortKey = key;
                    unitSortDirection = 'asc';
                }
                sortUnitRows();
                updateUnitSortIndicators();
                renderUnitPage();
            });
        });
    }

    function mapItemUnitPayload(row) {
        return {
            item_unit_id: Number(row.item_unit_id) || 0,
            item_id: Number(row.item_id) || 0,
            item_name: row.item_name || '',
            serial_number: row.serial_number || '',
            status: row.status || '',
            ownership: row.ownership || '',
            expected_return_at: row.expected_return_at || '',
            return_at: row.return_at || '',
        };
    }

    async function fetchItemUnitsForItem(itemId) {
        const response = await fetch(
            `${modelRoot}/item_units_by_item.php?item_id=${encodeURIComponent(itemId)}&statuses=${encodeURIComponent('useable,returned,pending booking,booked,in use,delivering,reparing,damaged,depreciated')}`,
            { credentials: 'same-origin' }
        );
        if (!response.ok) {
            throw new Error('load_failed');
        }
        const payload = await response.json();
        return Array.isArray(payload.data) ? payload.data.map(mapItemUnitPayload) : [];
    }

    async function loadItemUnitsSection(itemId) {
        if (!unitTableBody) return;
        resetUnitPanelState('กำลังโหลดหน่วยสินค้า...');
        try {
            itemUnits = await fetchItemUnitsForItem(itemId);
            enableUnitPanel();
            applyUnitFilters();
            updateUnitSortIndicators();
        } catch (err) {
            resetUnitPanelState('ไม่สามารถโหลดหน่วยสินค้านี้ได้');
        }
    }

    function showStatusChartMessage(message) {
        if (statusChart) {
            statusChart.innerHTML = '';
        }
        if (statusChartMessage) {
            statusChartMessage.hidden = !message;
            statusChartMessage.textContent = message || '';
        }
    }

    function showStatusChartProgress(current, total, totalUnits) {
        if (!statusChartMessage) return;
        const totalLabel = total ? `${current}/${total} วัน` : '';
        const unitLabel = Number.isFinite(totalUnits) ? ` • ${totalUnits} หน่วย` : '';
        statusChartMessage.hidden = false;
        statusChartMessage.textContent = `กำลังประมวลผลกราฟ... ${totalLabel}${unitLabel}`.trim();
    }

    function hideStatusChartMessage() {
        if (!statusChartMessage) return;
        statusChartMessage.hidden = true;
        statusChartMessage.textContent = '';
    }

    function setStatusControlsEnabled(enabled) {
        [statusPrevMonth, statusNextMonth, statusCurrentMonth].forEach((btn) => {
            if (btn) {
                btn.disabled = !enabled;
            }
        });
    }

    function formatThaiMonth(date) {
        const months = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
        return `${months[date.getMonth()]} ${date.getFullYear() + 543}`;
    }

    function updateStatusMonthLabel() {
        if (!statusMonthLabel) return;
        statusMonthLabel.textContent = formatThaiMonth(statusMonth);
    }

    function buildLinePath(points, className) {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute(
            'd',
            points
                .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
                .join(' ')
        );
        path.setAttribute('class', className);
        return path;
    }

    function buildMarkers(points, className) {
        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        group.setAttribute('class', 'chart-markers');
        points.forEach((point) => {
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', point.x.toFixed(2));
            circle.setAttribute('cy', point.y.toFixed(2));
            circle.setAttribute('r', '3.5');
            circle.setAttribute('class', className);
            group.append(circle);
        });
        return group;
    }

    function renderStatusChart(data) {
        if (!statusChart) return;
        statusChart.innerHTML = '';
        if (!data || !Array.isArray(data.days) || !data.days.length) {
            showStatusChartMessage('ไม่มีข้อมูลแสดงผลในเดือนนี้');
            return;
        }

        const width = 860;
        const height = 360;
        const padding = { top: 28, right: 22, bottom: 38, left: 52 };
        const plotWidth = width - padding.left - padding.right;
        const plotHeight = height - padding.top - padding.bottom;
        const days = data.days;
        const maxDataValue = Math.max(...days.map((d) => Number(d.total) || 0));
        const yAxisCeiling = maxDataValue > 0 ? Math.ceil(maxDataValue / 5) * 5 : 5;
        const totalUnits = Number(days[0]?.total) || 0;
        const step = days.length > 1 ? plotWidth / (days.length - 1) : plotWidth;

        const grid = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        grid.setAttribute('class', 'chart-grid-lines');
        const numGridLines = 5;
        for (let i = 1; i <= numGridLines; i += 1) {
            const y = padding.top + plotHeight * (1 - i / numGridLines);
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', padding.left.toString());
            line.setAttribute('x2', (width - padding.right).toString());
            line.setAttribute('y1', y.toString());
            line.setAttribute('y2', y.toString());
            line.setAttribute('class', 'chart-grid-line');

            const labelValue = (yAxisCeiling / numGridLines) * i;
            const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            label.setAttribute('x', (padding.left - 8).toString());
            label.setAttribute('y', y.toString());
            label.setAttribute('dy', '0.35em');
            label.setAttribute('text-anchor', 'end');
            label.setAttribute('class', 'chart-y-axis-label');
            label.textContent = labelValue.toString();

            grid.append(line);
            grid.append(label);
        }
        const zeroLine = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        zeroLine.setAttribute('x', (padding.left - 8).toString());
        zeroLine.setAttribute('y', (height - padding.bottom).toString());
        zeroLine.setAttribute('dy', '0.35em');
        zeroLine.setAttribute('text-anchor', 'end');
        zeroLine.setAttribute('class', 'chart-y-axis-label');
        zeroLine.textContent = '0';
        grid.append(zeroLine);
        statusChart.append(grid);

        const axisGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        axisGroup.setAttribute('class', 'chart-axes');
        const xAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        xAxis.setAttribute('x1', padding.left.toString());
        xAxis.setAttribute('x2', (width - padding.right).toString());
        xAxis.setAttribute('y1', (height - padding.bottom).toString());
        xAxis.setAttribute('y2', (height - padding.bottom).toString());
        axisGroup.append(xAxis);

        const yAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        yAxis.setAttribute('x1', padding.left.toString());
        yAxis.setAttribute('x2', padding.left.toString());
        yAxis.setAttribute('y1', padding.top.toString());
        yAxis.setAttribute('y2', (height - padding.bottom).toString());
        axisGroup.append(yAxis);
        statusChart.append(axisGroup);

        const pointsAvailable = [];
        const pointsInUse = [];
        const pointsMaintenance = [];

        showStatusChartProgress(0, days.length, totalUnits);

        days.forEach((day, index) => {
            const available = Math.max(0, Number(day.available) || 0);
            const inUse = Math.max(0, Number(day.in_use) || 0);
            const maintenance = Math.max(0, Number(day.maintenance) || 0);
            const x = padding.left + (step * index);
            const yAvailable = padding.top + (1 - available / yAxisCeiling) * plotHeight;
            const yInUse = padding.top + (1 - inUse / yAxisCeiling) * plotHeight;
            const yMaintenance = padding.top + (1 - maintenance / yAxisCeiling) * plotHeight;

            pointsAvailable.push({ x, y: yAvailable });
            pointsInUse.push({ x, y: yInUse });
            pointsMaintenance.push({ x, y: yMaintenance });

            const dayLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            dayLabel.setAttribute('x', x.toString());
            dayLabel.setAttribute('y', (height - padding.bottom + 18).toString());
            dayLabel.setAttribute('text-anchor', 'middle');
            dayLabel.setAttribute('class', 'chart-day-label');
            dayLabel.textContent = String(new Date(day.date).getDate());
            statusChart.append(dayLabel);

            showStatusChartProgress(index + 1, days.length, totalUnits);
        });

        const linesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        linesGroup.append(buildLinePath(pointsAvailable, 'line available'));
        linesGroup.append(buildLinePath(pointsInUse, 'line in-use'));
        linesGroup.append(buildLinePath(pointsMaintenance, 'line maintenance'));
        linesGroup.append(buildMarkers(pointsAvailable, 'marker available'));
        linesGroup.append(buildMarkers(pointsInUse, 'marker in-use'));
        linesGroup.append(buildMarkers(pointsMaintenance, 'marker maintenance'));
        statusChart.append(linesGroup);

        hideStatusChartMessage();
    }

    async function fetchStatusTimeseries(itemId, monthDate) {
        const monthParam = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
        const response = await fetch(
            `${modelRoot}/item_status_timeseries.php?item_id=${encodeURIComponent(itemId)}&month=${encodeURIComponent(monthParam)}`,
            { credentials: 'same-origin' }
        );
        if (!response.ok) {
            throw new Error('load_failed');
        }
        const payload = await response.json();
        return payload.data;
    }

    async function loadStatusChart(itemId) {
        setStatusControlsEnabled(false);
        showStatusChartMessage('กำลังโหลดกราฟ...');
        updateStatusMonthLabel();
        try {
            const data = await fetchStatusTimeseries(itemId, statusMonth);
            setStatusControlsEnabled(true);
            renderStatusChart(data);
        } catch (err) {
            showStatusChartMessage('ไม่สามารถโหลดข้อมูลกราฟได้');
            setStatusControlsEnabled(true);
        }
    }

    async function fetchItemDetail(itemId) {
        const response = await fetch(`${modelRoot}/item_detail.php?id=${encodeURIComponent(itemId)}`, {
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


    async function handleSubmit(event) {
        event.preventDefault();
        if (!form || isSaving) return;
        const payload = serializeForm();
        if (!payload.item_name) {
            showMessage('กรุณากรอกชื่อสินค้า', 'error');
            return;
        }
        payload.period = normalizePeriodValue(payload.period);
        if (!payload.uom) {
            payload.uom = 'unit';
        }
        if (!payload.period) {
            payload.period = 'day';
        }
        if (!payload.rate) {
            payload.rate = '';
        }

        const url = isCreateMode ? `${modelRoot}/item_create.php` : `${modelRoot}/item_update.php`;
        const body = { ...payload };
        if (!isCreateMode) {
            body.item_id = currentItemId;
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
            currentItemId = detail.item_id != null ? String(detail.item_id) : currentItemId;
            isCreateMode = false;
            if (currentItemId) {
                history.replaceState({}, '', `./item_manage.html?item_id=${encodeURIComponent(currentItemId)}`);
            }
            populateForm(detail);
            if (itemHeading) {
                itemHeading.textContent = detail.item_name ? `แก้ไขสินค้า: ${detail.item_name}` : 'แก้ไขสินค้า';
            }
            sessionStorage.setItem('items:refresh', '1');
            showMessage('บันทึกข้อมูลสินค้าเรียบร้อยแล้ว', 'success');
            closeUnsavedModal();
            if (typeof pendingNavigationAction === 'function') {
                const action = pendingNavigationAction;
                pendingNavigationAction = null;
                action();
            }
        } catch (error) {
            const message = translateError(error);
            showMessage(message, 'error');
            setDirtyState(true);
        } finally {
            isSaving = false;
            updateSaveButtonState();
        }
    }

    function translateError(error) {
        if (error instanceof RequestError) {
            switch (error.code) {
                case 'missing_name':
                    return 'กรุณากรอกชื่อสินค้า';
                case 'missing_item':
                    return 'ต้องระบุสินค้าที่เกี่ยวข้อง';
                case 'item_not_found':
                    return 'ไม่พบข้อมูลสินค้าที่เลือก';
                case 'invalid_id':
                case 'not_found':
                    return 'ไม่พบสินค้าที่ต้องการแก้ไข';
                case 'unauthorized':
                    return 'สิทธิ์การใช้งานหมดอายุ กรุณาเข้าสู่ระบบใหม่';
                default:
                    return 'ไม่สามารถบันทึกข้อมูลสินค้าได้ โปรดลองใหม่อีกครั้ง';
            }
        }
        if (error instanceof TypeError) {
            return 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้ โปรดลองใหม่อีกครั้ง';
        }
        return 'ไม่สามารถบันทึกข้อมูลสินค้าได้ โปรดลองใหม่อีกครั้ง';
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
        markDirty();
    }

    function attachFieldListeners() {
        if (!form) return;
        preventEnterSubmit(form);
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

    initializeCategoryField();

    if (categoryModalForm) {
        preventEnterSubmit(categoryModalForm);
        categoryModalForm.addEventListener('submit', submitCategoryModal);
    }

    if (categoryModal) {
        categoryModal.querySelectorAll('[data-modal-dismiss]').forEach((btn) => {
            btn.addEventListener('click', () => {
                closeCategoryModal();
            });
        });
        categoryModal.addEventListener('click', (event) => {
            if (event.target === categoryModal) {
                closeCategoryModal();
            }
        });
    }

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && categoryModal && !categoryModal.hidden) {
            closeCategoryModal();
        }
    });

    if (categoryEditBtn) {
        categoryEditBtn.addEventListener('click', () => {
            openCategoryModalForEdit();
        });
    }

    attachUnitPanelEvents();

    if (statusPrevMonth) {
        statusPrevMonth.addEventListener('click', () => {
            statusMonth = new Date(statusMonth.getFullYear(), statusMonth.getMonth() - 1, 1);
            if (!isCreateMode && currentItemId) {
                loadStatusChart(currentItemId);
            }
        });
    }

    if (statusNextMonth) {
        statusNextMonth.addEventListener('click', () => {
            statusMonth = new Date(statusMonth.getFullYear(), statusMonth.getMonth() + 1, 1);
            if (!isCreateMode && currentItemId) {
                loadStatusChart(currentItemId);
            }
        });
    }

    if (statusCurrentMonth) {
        statusCurrentMonth.addEventListener('click', () => {
            statusMonth = new Date();
            statusMonth.setDate(1);
            if (!isCreateMode && currentItemId) {
                loadStatusChart(currentItemId);
            }
        });
    }

    if (btnDiscardChanges) {
        btnDiscardChanges.addEventListener('click', () => {
            pendingNavigationAction = null;
            restoreSnapshot(initialSnapshot);
            setDirtyState(false);
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
                    window.location.href = './items.html';
                }
            });
        });
    }

    if (breadcrumbLink) {
        breadcrumbLink.addEventListener('click', (event) => {
            event.preventDefault();
            const href = breadcrumbLink.getAttribute('href') || './items.html';
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
        if (isCreateMode) {
            prepareCreateMode();
            return;
        }
        try {
            const detail = await fetchItemDetail(currentItemId);
            if (itemHeading) {
                itemHeading.textContent = detail.item_name ? `แก้ไขสินค้า: ${detail.item_name}` : 'แก้ไขสินค้า';
            }
            populateForm(detail);
            loadItemUnitsSection(currentItemId);
            setStatusControlsEnabled(true);
            loadStatusChart(currentItemId);
        } catch (err) {
            prepareCreateMode();
            const message = err instanceof RequestError && err.code === 'unauthorized'
                ? 'สิทธิ์การใช้งานหมดอายุ กรุณาเข้าสู่ระบบใหม่'
                : 'ไม่พบข้อมูลสินค้าที่ต้องการ กรุณาสร้างใหม่';
            showMessage(message, 'error');
        }
    }

    if (typeof window.onAppReady === 'function') {
        window.onAppReady(boot);
    }
})();