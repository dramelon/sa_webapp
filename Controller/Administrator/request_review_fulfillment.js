(function () {
    const params = new URLSearchParams(window.location.search);
    const requestLineId = params.get('request_line_id');
    const lineId = params.get('line_id');
    const returnTo = params.get('return_to');

    const fulfillmentTitle = document.getElementById('fulfillmentTitle');
    const pageDate = document.getElementById('pageDate');
    const fulfillmentBackLink = document.getElementById('fulfillmentBackLink');
    const fulfillmentMessage = document.getElementById('fulfillmentMessage');
    const fulfillmentLineIdentifier = document.getElementById('fulfillmentLineIdentifier');
    const fulfillmentLineDetail = document.getElementById('fulfillmentLineDetail');
    const fulfillmentNote = document.getElementById('fulfillmentNote');
    const selectedList = document.getElementById('selectedItemUnitList');
    const selectedEmpty = document.getElementById('selectedItemUnitEmpty');
    const selectedTemplate = document.getElementById('selectedItemUnitTemplate');
    const availableList = document.getElementById('availableItemUnitList');
    const availableEmpty = document.getElementById('availableItemUnitEmpty');
    const availableTemplate = document.getElementById('availableItemUnitTemplate');
    const saveButton = document.getElementById('saveFulfillmentButton');
    const unsavedBanner = document.getElementById('unsavedBanner');
    const inlineSaveButton = document.getElementById('btnSaveInline');
    const discardChangesButton = document.getElementById('btnDiscardChanges');

    let modelRoot = '';
    let requestLineDetail = null;
    let availableUnits = [];
    let selectedUnits = [];
    let isDirty = false;
    let isSaving = false;
    let isPopulating = false;
    let snapshot = null;

    function setMessage(message, tone = 'info') {
        if (!fulfillmentMessage) {
            return;
        }
        if (!message) {
            fulfillmentMessage.hidden = true;
            fulfillmentMessage.textContent = '';
            fulfillmentMessage.className = 'form-alert';
            return;
        }
        fulfillmentMessage.hidden = false;
        fulfillmentMessage.textContent = message;
        fulfillmentMessage.className = `form-alert ${tone === 'error' ? 'error' : tone === 'success' ? 'success' : ''}`;
    }

    const updateThaiDate = () => {
        if (!pageDate) {
            return;
        }
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
        const thaiYear = now.getFullYear() + 543;
        const time = now.toLocaleTimeString('th-TH', { hour12: false });
        pageDate.textContent = `วัน${day}ที่ ${date} ${month} ${thaiYear} เวลา ${time}`;
    };

    function applyIdentifiers() {
        if (!requestLineId) {
            setMessage('ไม่พบรหัสบรรทัดคำขอในลิงก์', 'error');
            if (fulfillmentTitle) {
                fulfillmentTitle.textContent = 'ไม่พบข้อมูลบรรทัดคำขอ';
            }
            return;
        }
        if (fulfillmentTitle) {
            const suffix = lineId ? `บรรทัด #${lineId}` : `Request Line #${requestLineId}`;
            fulfillmentTitle.textContent = `ตรวจสอบคำขอบรรทัด ${suffix}`;
        }
        if (fulfillmentLineIdentifier) {
            fulfillmentLineIdentifier.textContent = `รหัสบรรทัดคำขอ: ${requestLineId}`;
        }
        if (fulfillmentLineDetail) {
            fulfillmentLineDetail.textContent = lineId ? `หมายเลขบรรทัด: ${lineId}` : 'ไม่มีหมายเลขบรรทัดเพิ่มเติม';
        }
    }

    function syncBackLink() {
        if (!fulfillmentBackLink) {
            return;
        }
        if (returnTo) {
            fulfillmentBackLink.href = returnTo;
        } else if (window.history.length > 1) {
            fulfillmentBackLink.href = 'javascript:window.history.back();';
        } else {
            fulfillmentBackLink.href = './request_review.html';
        }
    }

    function setUnsavedVisible(show) {
        if (!unsavedBanner) return;
        unsavedBanner.hidden = !show;
        unsavedBanner.classList.toggle('is-active', show);
    }

    function updateSaveButtonState() {
        const shouldDisable = isSaving || !isDirty;
        if (saveButton) {
            saveButton.disabled = shouldDisable;
        }
        if (inlineSaveButton) {
            inlineSaveButton.disabled = shouldDisable;
        }
        if (discardChangesButton) {
            discardChangesButton.disabled = isSaving || !snapshot;
        }
    }

    function setDirty(nextValue = true) {
        if (isPopulating) return;
        isDirty = Boolean(nextValue);
        setUnsavedVisible(isDirty);
        updateSaveButtonState();
    }

    function captureSnapshot() {
        snapshot = {
            note: fulfillmentNote ? fulfillmentNote.value.trim() : '',
            selectedUnits: selectedUnits.map((unit) => ({ ...unit })),
        };
    }

    function restoreSnapshot() {
        if (!snapshot) return;
        isPopulating = true;
        selectedUnits = snapshot.selectedUnits.map((unit) => ({ ...unit }));
        if (fulfillmentNote) {
            fulfillmentNote.value = snapshot.note;
        }
        renderSelectedUnits();
        renderAvailableUnits(availableUnits);
        isPopulating = false;
        setDirty(false);
    }

    function formatUnitLabel(unit) {
        const serial = unit.serial_number ? `SN ${unit.serial_number}` : null;
        const idLabel = unit.item_unit_id != null ? `#${unit.item_unit_id}` : '—';
        return serial ? `${serial} (${idLabel})` : `Item Unit ${idLabel}`;
    }

    function formatUnitMeta(unit) {
        const status = unit.status ? `สถานะ: ${unit.status}` : '';
        const warehouse = unit.warehouse_name ? `คลัง: ${unit.warehouse_name}` : '';
        return [status, warehouse].filter(Boolean).join(' • ') || '—';
    }

    function isUnitSelected(itemUnitId) {
        return selectedUnits.some((unit) => unit.item_unit_id === itemUnitId);
    }

    function updateAvailableButtonState(itemUnitId, selected) {
        if (!availableList) return;
        const button = availableList.querySelector(`.add-item-unit[data-unit-id="${itemUnitId}"]`);
        if (!button) return;
        button.disabled = selected;
        button.textContent = selected ? 'เลือกแล้ว' : 'เพิ่ม';
    }

    function renderSelectedUnits() {
        if (!selectedList || !selectedTemplate || !selectedEmpty) {
            return;
        }
        selectedList.innerHTML = '';
        const hasSelected = selectedUnits.length > 0;
        selectedUnits.forEach((unit) => {
            const row = selectedTemplate.cloneNode(true);
            row.hidden = false;
            row.id = '';
            row.dataset.unitId = unit.item_unit_id;

            const title = row.querySelector('.line-title');
            const meta = row.querySelector('.meta-sub');
            if (title) {
                title.textContent = formatUnitLabel(unit);
            }
            if (meta) {
                meta.textContent = formatUnitMeta(unit);
            }

            const sourceInput = row.querySelector('.source-type-input');
            if (sourceInput) {
                sourceInput.value = unit.source_type || 'inventory';
                sourceInput.addEventListener('change', (event) => {
                    unit.source_type = event.target.value;
                    setDirty(true);
                });
            }

            const returnFlag = row.querySelector('.return-flag-input');
            if (returnFlag) {
                returnFlag.checked = Boolean(unit.return_customer_flag);
                returnFlag.addEventListener('change', (event) => {
                    unit.return_customer_flag = event.target.checked;
                    setDirty(true);
                });
            }

            const paidFlag = row.querySelector('.paid-excluded-input');
            if (paidFlag) {
                paidFlag.checked = Boolean(unit.paid_excluded_flag);
                paidFlag.addEventListener('change', (event) => {
                    unit.paid_excluded_flag = event.target.checked;
                    setDirty(true);
                });
            }

            const removeBtn = row.querySelector('.remove-selected');
            if (removeBtn) {
                removeBtn.addEventListener('click', () => {
                    selectedUnits = selectedUnits.filter((selected) => selected.item_unit_id !== unit.item_unit_id);
                    updateAvailableButtonState(unit.item_unit_id, false);
                    renderSelectedUnits();
                    setDirty(true);
                });
            }

            selectedList.appendChild(row);
        });

        selectedList.hidden = !hasSelected;
        selectedEmpty.hidden = hasSelected;
    }

    function renderAvailableUnits(units) {
        if (!availableList || !availableTemplate || !availableEmpty) {
            return;
        }

        availableList.innerHTML = '';
        const hasUnits = Array.isArray(units) && units.length > 0;
        if (hasUnits) {
            units.forEach((unit) => {
                const row = availableTemplate.cloneNode(true);
                row.hidden = false;
                row.id = '';
                row.dataset.unitId = unit.item_unit_id;

                const title = row.querySelector('.line-title');
                const meta = row.querySelector('.meta-sub');
                if (title) {
                    title.textContent = formatUnitLabel(unit);
                }
                if (meta) {
                    meta.textContent = formatUnitMeta(unit);
                }

                const metaLabel = row.querySelector('.meta-label');
                if (metaLabel) {
                    metaLabel.textContent = `ItemID ${unit.item_id ?? '—'}`;
                }

                const addBtn = row.querySelector('.add-item-unit');
                if (addBtn) {
                    addBtn.dataset.unitId = unit.item_unit_id;
                    addBtn.disabled = isUnitSelected(unit.item_unit_id);
                    addBtn.textContent = addBtn.disabled ? 'เลือกแล้ว' : 'เพิ่ม';
                    addBtn.addEventListener('click', () => {
                        if (isUnitSelected(unit.item_unit_id)) {
                            return;
                        }
                        selectedUnits.push({
                            ...unit,
                            source_type: 'inventory',
                            return_customer_flag: false,
                            paid_excluded_flag: false,
                        });
                        updateAvailableButtonState(unit.item_unit_id, true);
                        renderSelectedUnits();
                        setDirty(true);
                    });
                }

                availableList.appendChild(row);
            });
        }

        availableList.hidden = !hasUnits;
        availableEmpty.hidden = hasUnits;
    }

    async function fetchRequestLineDetail() {
        if (!modelRoot || !requestLineId) return null;
        const response = await fetch(
            `${modelRoot}/request_fulfillment_detail.php?request_line_id=${encodeURIComponent(requestLineId)}`,
            {
                credentials: 'same-origin',
            },
        );
        if (!response.ok) {
            throw new Error('ไม่สามารถโหลดข้อมูลบรรทัดคำขอได้');
        }
        const payload = await response.json();
        return payload?.data || null;
    }

    async function fetchItemUnits(itemId) {
        if (!modelRoot || !itemId) return [];
        const statuses = ['useable', 'returned', 'pending booking', 'booked'].join(',');
        const response = await fetch(
            `${modelRoot}/item_units_by_item.php?item_id=${encodeURIComponent(itemId)}&statuses=${statuses}`,
            {
                credentials: 'same-origin',
            },
        );
        if (!response.ok) {
            throw new Error('ไม่สามารถโหลด Item Unit ที่เกี่ยวข้องได้');
        }
        const payload = await response.json();
        return Array.isArray(payload?.data) ? payload.data : [];
    }

    async function handleSave() {
        if (!modelRoot || !requestLineId) {
            setMessage('ไม่สามารถบันทึกได้: ไม่พบบรรทัดคำขอ', 'error');
            return;
        }
        isSaving = true;
        updateSaveButtonState();
        setMessage('กำลังบันทึก...', 'info');

        const payload = {
            request_line_id: Number(requestLineId),
            note: fulfillmentNote ? fulfillmentNote.value.trim() : '',
            lines: selectedUnits.map((unit) => ({
                item_unit_id: unit.item_unit_id,
                source_type: unit.source_type || 'inventory',
                return_customer_flag: Boolean(unit.return_customer_flag),
                paid_excluded_flag: Boolean(unit.paid_excluded_flag),
            })),
        };

        try {
            const response = await fetch(`${modelRoot}/request_fulfillment_save.php`, {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                throw new Error('ไม่สามารถบันทึกการจ่ายได้');
            }

            const result = await response.json();
            if (result?.error) {
                throw new Error(result.message || 'ไม่สามารถบันทึกการจ่ายได้');
            }

            captureSnapshot();
            setDirty(false);
            setMessage('บันทึกการจ่ายสำเร็จ', 'success');
        } catch (error) {
            console.error(error);
            setMessage(error?.message || 'เกิดข้อผิดพลาดในการบันทึก', 'error');
        } finally {
            isSaving = false;
            updateSaveButtonState();
        }
    }

    function applyLineDetail(line) {
        if (!line) return;
        const { item_name: itemName, item_reference: itemRef, line_no: lineNo } = line;
        if (fulfillmentTitle && itemName) {
            fulfillmentTitle.textContent = `ตรวจสอบ ${itemName}`;
        }
        if (fulfillmentLineIdentifier && itemRef) {
            fulfillmentLineIdentifier.textContent = `รหัสอ้างอิงสินค้า: ${itemRef}`;
        }
        if (fulfillmentLineDetail) {
            const lineLabel = lineNo ? `บรรทัด #${lineNo}` : lineId ? `หมายเลขบรรทัด: ${lineId}` : '';
            fulfillmentLineDetail.textContent = lineLabel || fulfillmentLineDetail.textContent;
        }
    }

    async function boot() {
        const root = document.documentElement.getAttribute('data-root') || '..';
        modelRoot = `${root}/Model`;

        updateThaiDate();
        setInterval(updateThaiDate, 1000);
        applyIdentifiers();
        syncBackLink();
        updateSaveButtonState();

        try {
            const fulfillmentDetail = await fetchRequestLineDetail();
            if (!fulfillmentDetail) {
                setMessage('ไม่สามารถโหลดข้อมูลบรรทัดคำขอได้', 'error');
                return;
            }
            requestLineDetail = fulfillmentDetail;
            applyLineDetail(requestLineDetail);

            isPopulating = true;
            const fulfillmentNoteText = fulfillmentDetail?.fulfillment?.note || '';
            if (fulfillmentNote) {
                fulfillmentNote.value = fulfillmentNoteText;
            }

            selectedUnits = Array.isArray(fulfillmentDetail?.fulfillment?.lines)
                ? fulfillmentDetail.fulfillment.lines.map((line) => ({
                      item_unit_id: line.item_unit_id,
                      item_id: line.item_id,
                      serial_number: line.serial_number,
                      status: line.status,
                      warehouse_name: line.warehouse_name,
                      source_type: line.source_type || 'inventory',
                      return_customer_flag: Boolean(line.return_customer_flag),
                      paid_excluded_flag: Boolean(line.paid_excluded_flag),
                  }))
                : [];
            isPopulating = false;

            availableUnits = await fetchItemUnits(requestLineDetail.item_id);
            renderAvailableUnits(availableUnits);
            renderSelectedUnits();
            selectedUnits.forEach((unit) => updateAvailableButtonState(unit.item_unit_id, true));
            captureSnapshot();
            setDirty(false);
        } catch (error) {
            console.error(error);
            setMessage(error?.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล', 'error');
        }
    }

    function bindEvents() {
        if (fulfillmentNote) {
            fulfillmentNote.addEventListener('input', () => setDirty(true));
        }
        if (saveButton) {
            saveButton.addEventListener('click', handleSave);
        }
        if (inlineSaveButton) {
            inlineSaveButton.addEventListener('click', handleSave);
        }
        if (discardChangesButton) {
            discardChangesButton.addEventListener('click', restoreSnapshot);
        }
    }

    if (typeof window.onAppReady === 'function') {
        window.onAppReady(() => {
            bindEvents();
            boot();
        });
    }
})();
