(function () {
    const form = document.getElementById('locationForm');
    const messageBox = document.getElementById('locationMessage');
    const heading = document.getElementById('locationHeading');
    const codeField = document.getElementById('locationCode');
    const backButton = document.getElementById('locationBack');
    const saveButton = document.getElementById('locationSave');
    const breadcrumbLink = document.querySelector('.breadcrumb a');

    const fields = {
        location_name: document.getElementById('locationName'),
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
        return Object.fromEntries(
            Object.entries(fields).map(([key, input]) => [key, input?.value.trim() || ''])
        );
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
        for (const [key, input] of Object.entries(fields)) {
            if (!input) continue;
            input.value = data[key] || '';
        }
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
            currentLocationId = String(payload.data.location_id);
            isCreateMode = false;
            if (heading) {
                heading.textContent = payload.data.location_name || `สถานที่ #${currentLocationId}`;
            }
            if (codeField) {
                codeField.value = currentLocationId;
            }
            populateForm(payload.data);
        } catch (error) {
            showMessage('ไม่สามารถโหลดข้อมูลสถานที่ได้', 'error');
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
        if (saveButton) {
            saveButton.disabled = true;
        }
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
            setDirty(false);
            showMessage(isCreateMode ? 'สร้างสถานที่เรียบร้อยแล้ว' : 'บันทึกข้อมูลสถานที่เรียบร้อยแล้ว', 'success');
            if (isCreateMode) {
                params.set('location_id', currentLocationId);
                params.delete('mode');
                const newQuery = params.toString();
                const newUrl = newQuery ? `${window.location.pathname}?${newQuery}` : window.location.pathname;
                window.history.replaceState({}, '', newUrl);
                isCreateMode = false;
            }
        } catch (error) {
            setDirty(true);
            showMessage('ไม่สามารถบันทึกข้อมูลสถานที่ได้ โปรดลองอีกครั้ง', 'error');
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
            loadLocation(currentLocationId);
        }
    };

    if (typeof window.onAppReady === 'function') {
        window.onAppReady(boot);
    }
})();