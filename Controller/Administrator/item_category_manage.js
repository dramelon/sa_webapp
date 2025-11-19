(function () {
    const form = document.getElementById('itemCategoryForm');
    const messageBox = document.getElementById('formMessage');
    const heading = document.getElementById('categoryHeading');
    const categoryIdDisplay = document.getElementById('categoryIdDisplay');
    const categoryItemCount = document.getElementById('categoryItemCount');
    const categoryUnitCount = document.getElementById('categoryUnitCount');
    const categoryUpdatedAt = document.getElementById('itemCategoryUpdatedAt');
    const categoryUpdatedBy = document.getElementById('itemCategoryUpdatedBy');
    const categoryCreatedAt = document.getElementById('itemCategoryCreatedAt');
    const categoryCreatedBy = document.getElementById('itemCategoryCreatedBy');
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
        name: document.getElementById('categoryName'),
        note: document.getElementById('categoryNote'),
    };

    const params = new URLSearchParams(window.location.search);
    const categoryIdParam = params.get('item_category_id');
    const isCreateRequested = params.get('mode') === 'create';

    let currentCategoryId = categoryIdParam ? String(categoryIdParam) : null;
    let isCreateMode = !currentCategoryId || isCreateRequested;
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

    function updateSaveButtonState() {
        const disable = isSaving || !isDirty;
        if (btnSave) {
            btnSave.disabled = disable;
        }
        if (btnSaveInline) {
            btnSaveInline.disabled = disable;
        }
    }

    function normalizeSnapshot(data) {
        return {
            name: (data.name || '').trim(),
            note: (data.note || '').replace(/\r\n/g, '\n').trim(),
        };
    }

    function serializeForm() {
        const nameValue = fieldRefs.name ? fieldRefs.name.value : '';
        const noteValue = fieldRefs.note ? fieldRefs.note.value : '';
        return normalizeSnapshot({ name: nameValue, note: noteValue });
    }

    function restoreSnapshot(snapshot) {
        if (!snapshot) {
            return;
        }
        if (fieldRefs.name) {
            fieldRefs.name.value = snapshot.name || '';
        }
        if (fieldRefs.note) {
            fieldRefs.note.value = snapshot.note || '';
        }
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

    function updateMeta(data) {
        const id = data?.item_category_id != null ? String(data.item_category_id) : '—';
        if (categoryIdDisplay) categoryIdDisplay.textContent = id;

        const countValue = Number(data?.item_count);
        const count = Number.isFinite(countValue) ? countValue : null;
        if (categoryItemCount) {
            categoryItemCount.textContent = count != null
                ? `จำนวนสินค้าที่ใช้งาน: ${count.toLocaleString('th-TH')} รายการ`
                : 'จำนวนสินค้าที่ใช้งาน: —';
        }

        const unitValue = Number(data?.item_unit_count);
        const unitCount = Number.isFinite(unitValue) ? unitValue : null;
        if (categoryUnitCount) {
            categoryUnitCount.textContent = unitCount != null
                ? `จำนวนหน่วยสินค้าที่ใช้งาน: ${unitCount.toLocaleString('th-TH')} หน่วย`
                : 'จำนวนหน่วยสินค้าที่ใช้งาน: —';
        }

        if (categoryUpdatedAt) categoryUpdatedAt.textContent = `อัปเดตล่าสุด: ${formatDateTime(data?.updated_at)}`;
        if (categoryUpdatedBy) categoryUpdatedBy.textContent = `โดย: ${data?.updated_by_label || '—'}`;
        if (categoryCreatedAt) categoryCreatedAt.textContent = `สร้างเมื่อ: ${formatDateTime(data?.created_at)}`;
        if (categoryCreatedBy) categoryCreatedBy.textContent = `โดย: ${data?.created_by_label || '—'}`;
    }

    function populateForm(data) {
        const snapshot = {
            name: data?.name || '',
            note: data?.note || '',
        };
        if (fieldRefs.name) fieldRefs.name.value = snapshot.name;
        if (fieldRefs.note) fieldRefs.note.value = snapshot.note;
        updateMeta(data);
        initialSnapshot = serializeForm();
        setDirty(false);
    }

    function prepareCreateMode() {
        isCreateMode = true;
        currentCategoryId = null;
        if (heading) heading.textContent = 'สร้างหมวดหมู่สินค้าใหม่';
        if (categoryIdDisplay) categoryIdDisplay.textContent = 'ใหม่';
        if (form) form.reset();
        updateMeta({ item_count: 0, item_unit_count: 0 });
        initialSnapshot = serializeForm();
        setDirty(false);
        showMessage('');
    }

    function formatDateTime(value) {
        if (!value) return '—';
        const date = new Date(String(value).replace(' ', 'T'));
        if (Number.isNaN(date.getTime())) {
            return String(value);
        }
        return date.toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
    }

    async function fetchCategoryDetail(categoryId) {
        const response = await fetch(`${modelRoot}/item_category_detail.php?id=${encodeURIComponent(categoryId)}`, {
            credentials: 'same-origin',
        });
        if (!response.ok) {
            let code = 'not_found';
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
        let detail;
        const payload = serializeForm();
        if (!payload.name) {
            showMessage('กรุณากรอกชื่อหมวดหมู่', 'error');
            return;
        }

        const url = isCreateMode ? `${modelRoot}/item_category_create.php` : `${modelRoot}/item_category_update.php`;
        const body = { ...payload };
        if (!isCreateMode) {
            body.item_category_id = currentCategoryId;
        }

        isSaving = true;
        setDirty(false);
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
            detail = result.data || {};
            currentCategoryId = detail.item_category_id != null ? String(detail.item_category_id) : currentCategoryId;
            isCreateMode = false;
            if (currentCategoryId) {
                history.replaceState({}, '', `./item_category_manage.html?item_category_id=${encodeURIComponent(currentCategoryId)}`);
            }
            populateForm(detail);
            if (heading) {
                heading.textContent = detail.name ? `แก้ไขหมวดหมู่: ${detail.name}` : 'แก้ไขหมวดหมู่สินค้า';
            }
            sessionStorage.setItem('item-categories:refresh', '1');
            showMessage('บันทึกหมวดหมู่สินค้าเรียบร้อยแล้ว', 'success');
            closeUnsavedModal();
            if (typeof pendingNavigationAction === 'function') {
                const action = pendingNavigationAction;
                pendingNavigationAction = null;
                action();
            }
        } catch (error) {
            showMessage(translateError(error), 'error');
            setDirty(true);
        } finally {
            isSaving = false;
            updateSaveButtonState();
            updateMeta(detail);
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

    function translateError(error) {
        if (error instanceof RequestError) {
            switch (error.code) {
                case 'missing_name':
                    return 'กรุณากรอกชื่อหมวดหมู่';
                case 'not_found':
                case 'invalid_id':
                    return 'ไม่พบข้อมูลหมวดหมู่ที่ต้องการแก้ไข';
                case 'unauthorized':
                    return 'สิทธิ์การใช้งานหมดอายุ กรุณาเข้าสู่ระบบใหม่';
                default:
                    return 'ไม่สามารถบันทึกหมวดหมู่สินค้าได้ โปรดลองใหม่อีกครั้ง';
            }
        }
        if (error instanceof TypeError) {
            return 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้ โปรดลองใหม่อีกครั้ง';
        }
        return 'ไม่สามารถบันทึกหมวดหมู่สินค้าได้ โปรดลองใหม่อีกครั้ง';
    }

    class RequestError extends Error {
        constructor(code, message) {
            super(message || code);
            this.name = 'RequestError';
            this.code = code || 'unknown';
        }
    }

    async function safeJson(response) {
        try {
            return await response.json();
        } catch (err) {
            return null;
        }
    }

    function attachFieldListeners() {
        if (!form) return;
        const updateDirtyState = () => {
            if (isSaving) return;
            const current = serializeForm();
            const dirty = JSON.stringify(current) !== JSON.stringify(initialSnapshot);
            setDirty(dirty);
        };
        preventEnterSubmit(form);
        form.addEventListener('input', updateDirtyState);
        form.addEventListener('change', updateDirtyState);
        form.addEventListener('submit', handleSubmit);
    }

    if (btnBack) {
        btnBack.addEventListener('click', () => {
            requestNavigation(() => {
                if (window.history.length > 1) {
                    window.history.back();
                } else {
                    window.location.href = './item_categorys.html';
                }
            });
        });
    }

    if (breadcrumbLink) {
        breadcrumbLink.addEventListener('click', (event) => {
            event.preventDefault();
            const href = breadcrumbLink.getAttribute('href') || './item_categorys.html';
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
            const detail = await fetchCategoryDetail(currentCategoryId);
            populateForm(detail);
            if (heading) {
                heading.textContent = detail.name ? `แก้ไขหมวดหมู่: ${detail.name}` : 'แก้ไขหมวดหมู่สินค้า';
            }
        } catch (error) {
            prepareCreateMode();
            const message = error instanceof RequestError && error.code === 'unauthorized'
                ? 'สิทธิ์การใช้งานหมดอายุ กรุณาเข้าสู่ระบบใหม่'
                : 'ไม่พบข้อมูลหมวดหมู่ กรุณาสร้างใหม่';
            showMessage(message, 'error');
        }
    }

    if (typeof window.onAppReady === 'function') {
        window.onAppReady(boot);
    }
})();