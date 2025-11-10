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

    const fieldRefs = {
        code: document.getElementById('itemCode'),
        ref: document.getElementById('refItemId'),
        name: document.getElementById('itemName'),
        type: document.getElementById('itemType'),
        category: document.getElementById('itemCategory'),
        brand: document.getElementById('itemBrand'),
        model: document.getElementById('itemModel'),
        uom: document.getElementById('itemUom'),
        rate: document.getElementById('itemRate'),
        period: document.getElementById('itemPeriod'),
    };

    const params = new URLSearchParams(window.location.search);
    const itemIdParam = params.get('item_id');
    const isCreateRequested = params.get('mode') === 'create';
    let currentItemId = itemIdParam ? String(itemIdParam) : null;
    let isCreateMode = !currentItemId || isCreateRequested;
    let modelRoot = '';
    let isDirty = false;
    let isSaving = false;
    let initialSnapshot = null;
    let categoriesLoaded = false;

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
            ref_item_id: fieldRefs.ref?.value.trim() || '',
            item_name: fieldRefs.name?.value.trim() || '',
            item_type: fieldRefs.type?.value || 'อุปกร',
            item_category_id: fieldRefs.category?.value || '',
            brand: fieldRefs.brand?.value.trim() || '',
            model: fieldRefs.model?.value.trim() || '',
            uom: fieldRefs.uom?.value.trim() || '',
            rate: fieldRefs.rate?.value.trim() || '',
            period: fieldRefs.period?.value.trim() || '',
        };
    }

    function setDirty(next) {
        if (isDirty === next) {
            return;
        }
        isDirty = next;
        if (btnSave) {
            btnSave.disabled = isSaving || !isDirty;
        }
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
            period: data?.period || 'day',
        };
        if (fieldRefs.ref) fieldRefs.ref.value = snapshot.ref_item_id;
        if (fieldRefs.name) fieldRefs.name.value = snapshot.item_name;
        if (fieldRefs.type) fieldRefs.type.value = snapshot.item_type;
        if (fieldRefs.category) fieldRefs.category.value = snapshot.item_category_id;
        if (fieldRefs.brand) fieldRefs.brand.value = snapshot.brand;
        if (fieldRefs.model) fieldRefs.model.value = snapshot.model;
        if (fieldRefs.uom) fieldRefs.uom.value = snapshot.uom;
        if (fieldRefs.rate) fieldRefs.rate.value = snapshot.rate;
        if (fieldRefs.period) fieldRefs.period.value = snapshot.period;
        updateMeta(data);
        initialSnapshot = serializeForm();
        setDirty(false);
    }

    function prepareCreateMode() {
        isCreateMode = true;
        currentItemId = null;
        if (itemHeading) {
            itemHeading.textContent = 'สร้างสินค้าใหม่';
        }
        if (fieldRefs.code) {
            fieldRefs.code.value = 'ใหม่';
        }
        form?.reset();
        if (fieldRefs.type) fieldRefs.type.value = 'อุปกร';
        if (fieldRefs.uom) fieldRefs.uom.value = 'unit';
        if (fieldRefs.period) fieldRefs.period.value = 'day';
        updateMeta({});
        initialSnapshot = serializeForm();
        setDirty(false);
        showMessage('');
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

    async function fetchCategories() {
        if (!modelRoot || categoriesLoaded) {
            return;
        }
        try {
            const response = await fetch(`${modelRoot}/item_categories_options.php`, {
                credentials: 'same-origin',
            });
            if (!response.ok) return;
            const payload = await response.json();
            const options = Array.isArray(payload.data) ? payload.data : [];
            populateCategoryOptions(options);
            categoriesLoaded = true;
        } catch (err) {
            // ignore
        }
    }

    function populateCategoryOptions(options) {
        const select = fieldRefs.category;
        if (!select) return;
        const currentValue = select.value;
        select.innerHTML = '<option value="">— เลือกหมวดหมู่ —</option>';
        for (const row of options) {
            const option = document.createElement('option');
            option.value = String(row.id);
            option.textContent = (row.name || '').trim() || `หมวดหมู่ #${row.id}`;
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
        if (!payload.item_name) {
            showMessage('กรุณากรอกชื่อสินค้า', 'error');
            return;
        }
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
        setDirty(false);
        if (btnSave) btnSave.disabled = true;
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
        } catch (error) {
            const message = translateError(error);
            showMessage(message, 'error');
            setDirty(true);
        } finally {
            isSaving = false;
            if (btnSave) btnSave.disabled = !isDirty;
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

    function attachFieldListeners() {
        if (!form) return;
        form.addEventListener('input', () => {
            if (isSaving) return;
            const current = serializeForm();
            const dirty = JSON.stringify(current) !== JSON.stringify(initialSnapshot);
            setDirty(dirty);
        });
        form.addEventListener('change', () => {
            if (isSaving) return;
            const current = serializeForm();
            const dirty = JSON.stringify(current) !== JSON.stringify(initialSnapshot);
            setDirty(dirty);
        });
        form.addEventListener('submit', handleSubmit);
    }

    if (btnBack) {
        btnBack.addEventListener('click', (event) => {
            if (isDirty) {
                const confirmLeave = window.confirm('มีการเปลี่ยนแปลงที่ยังไม่บันทึก ต้องการออกจากหน้านี้หรือไม่?');
                if (!confirmLeave) {
                    event.preventDefault();
                    return;
                }
            }
            window.history.back();
        });
    }

    if (breadcrumbLink) {
        breadcrumbLink.addEventListener('click', (event) => {
            if (isDirty) {
                const confirmLeave = window.confirm('มีการเปลี่ยนแปลงที่ยังไม่บันทึก ต้องการออกจากหน้านี้หรือไม่?');
                if (!confirmLeave) {
                    event.preventDefault();
                }
            }
        });
    }

    window.addEventListener('beforeunload', (event) => {
        if (!isDirty) return;
        event.preventDefault();
        event.returnValue = '';
    });

    async function boot(context) {
        modelRoot = `${context.root}/Model`;
        updateThaiDate();
        setInterval(updateThaiDate, 1000);
        attachFieldListeners();
        await fetchCategories();
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