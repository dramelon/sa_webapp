(function () {
    const params = new URLSearchParams(window.location.search);
    const quotationId = params.get('supplier_quotation_id');
    const eventId = params.get('event_id');

    const pageDate = document.getElementById('quotationPageDate');
    const backLink = document.getElementById('quotationBackLink');
    const backButton = document.getElementById('quotationBtnBack');
    const saveButton = document.getElementById('quotationBtnSave');
    const inlineSaveButton = document.getElementById('quotationBtnSaveInline');
    const discardButton = document.getElementById('quotationBtnDiscard');
    const unsavedBanner = document.getElementById('unsavedBanner');
    const globalMessage = document.getElementById('quotationGlobalMessage');
    const statusDescription = document.getElementById('quotationStatusDescription');
    const statusActions = document.getElementById('quotationStatusActions');
    const approveButton = document.getElementById('quotationApproveButton');
    const returnPendingButton = document.getElementById('quotationReturnPendingButton');
    const cancelButton = document.getElementById('quotationCancelButton');

    const meta = {
        eventName: document.getElementById('quotationEventName'),
        eventCode: document.getElementById('quotationEventCode'),
        eventDate: document.getElementById('quotationEventDate'),
        statusBadge: document.getElementById('quotationStatusBadge'),
        statusText: document.getElementById('quotationStatusText'),
        updatedAt: document.getElementById('quotationUpdatedAt'),
        updatedBy: document.getElementById('quotationUpdatedBy'),
        createdAt: document.getElementById('quotationCreatedAt'),
        createdBy: document.getElementById('quotationCreatedBy'),
    };

    const formRefs = {
        title: document.getElementById('quotationTitleInput'),
        id: document.getElementById('quotationId'),
        refId: document.getElementById('quotationRefId'),
        staff: document.getElementById('quotationStaffId'),
        contactPerson: document.getElementById('quotationContactPerson'),
        supplier: document.getElementById('quotationSupplier'),
        deliverTo: document.getElementById('quotationDeliverTo'),
        note: document.getElementById('quotationNote'),
        rfq: document.getElementById('quotationRfq'),
        paymentTerm: document.getElementById('quotationPaymentTerm'),
        paymentMethod: document.getElementById('quotationPaymentMethod'),
        bidValidity: document.getElementById('quotationBidValidity'),
        quotationDate: document.getElementById('quotationDate'),
        orderDate: document.getElementById('quotationOrderDate'),
        orderDeadline: document.getElementById('quotationOrderDeadline'),
        expectedArrival: document.getElementById('quotationExpectedArrival'),
        refVendorId: document.getElementById('quotationRefVendorId'),
        statusSelect: document.getElementById('quotationStatusSelect'),
        createdByMeta: document.getElementById('quotationCreatedBy'),
        updatedByMeta: document.getElementById('quotationUpdatedByMeta'),
    };

    const linesBody = document.getElementById('quotationLinesBody');
    const linesEmpty = document.getElementById('quotationLinesEmpty');
    const addLineButton = document.getElementById('addQuotationLine');
    const lineModal = document.getElementById('quotationLineModal');
    const lineForm = document.getElementById('quotationLineForm');
    const lineModalMessage = document.getElementById('quotationLineModalMessage');
    const lineSaveButton = document.getElementById('quotationLineSave');
    const lineFields = {
        itemName: document.getElementById('lineItemName'),
        itemId: document.getElementById('lineItemId'),
        quantity: document.getElementById('lineQuantity'),
        uom: document.getElementById('lineUom'),
        unitPrice: document.getElementById('lineUnitPrice'),
        discountPercent: document.getElementById('lineDiscountPercent'),
        discountAmount: document.getElementById('lineDiscountAmount'),
        taxInclude: document.getElementById('lineTaxInclude'),
        spec: document.getElementById('lineSpec'),
        itemNote: document.getElementById('lineItemNote'),
        note: document.getElementById('lineNote'),
    };
    const referenceMeta = document.getElementById('quotationReferenceMeta');
    const titleDisplay = document.getElementById('quotationTitle');

    let modelRoot = '';
    let quotation = null;
    let lines = [];
    let isDirty = false;
    let isSaving = false;
    let isPopulating = false;
    let isDatasetLoaded = false;
    let lastSnapshot = null;
    let activeLine = null;
    let currentStatus = 'submitted';
    let isReadOnly = false;

    function runWithPopulation(fn) {
        const prev = isPopulating;
        isPopulating = true;
        try {
            fn();
        } finally {
            isPopulating = prev;
        }
    }

    function tickClock() {
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
        if (pageDate) {
            pageDate.textContent = `วัน${day}ที่ ${date} ${month} ${year} เวลา ${time}`;
        }
    }

    function setBackLinks() {
        if (!backLink && !backButton) return;

        const returnTo = params.get('return_to');
        let target = '';

        if (returnTo) {
            target = decodeURIComponent(returnTo);
        } else {
            const url = new URL('./event_document_manage.html', window.location.href);
            if (eventId) {
                url.searchParams.set('event_id', eventId);
            }
            target = `${url.pathname}${url.search}`;
        }

        if (backLink) backLink.href = target;
        if (backButton) backButton.addEventListener('click', () => {
            window.location.href = target;
        });
    }

    function setStatusBadge(status) {
        const normalized = typeof status === 'string' ? status.toLowerCase() : 'submitted';
        currentStatus = normalized;
        if (meta.statusBadge) {
            meta.statusBadge.dataset.status = normalized;
        }
        if (meta.statusText) {
            const label =
                normalized === 'approved'
                    ? 'อนุมัติแล้ว'
                    : normalized === 'pending'
                        ? 'รออนุมัติ'
                        : normalized === 'cancelled'
                            ? 'ยกเลิก'
                            : normalized === 'closed'
                                ? 'ปิดใบเสนอราคา'
                                : 'ส่งแล้ว';
            meta.statusText.textContent = `สถานะ: ${label}`;
        }
    }

    function updateStatusDescription(status) {
        if (!statusDescription) return;
        const normalized = typeof status === 'string' ? status.toLowerCase() : 'submitted';
        let text = 'เลือกสถานะปัจจุบันของใบเสนอราคา';
        if (normalized === 'approved') {
            text = 'ใบเสนอราคานี้ได้รับการอนุมัติแล้วและไม่สามารถแก้ไขได้';
        } else if (normalized === 'pending') {
            text = 'รอการอนุมัติจากผู้มีสิทธิ์';
        } else if (normalized === 'closed') {
            text = 'ใบเสนอราคานี้ถูกปิดและแก้ไขไม่ได้';
        }
        statusDescription.textContent = text;
    }

    function updateStatusActions(status) {
        if (!statusActions) return;
        const normalized = typeof status === 'string' ? status.toLowerCase() : 'submitted';
        const isApproved = normalized === 'approved';
        const isClosed = normalized === 'closed';
        if (approveButton) {
            approveButton.hidden = isApproved || isClosed;
        }
        if (returnPendingButton) {
            returnPendingButton.hidden = !isApproved;
        }
        if (cancelButton) {
            cancelButton.hidden = !isApproved || isClosed;
        }
    }

    function setLineFormReadOnly(readOnly) {
        const inputs = [
            lineFields.itemName,
            lineFields.itemId,
            lineFields.quantity,
            lineFields.uom,
            lineFields.unitPrice,
            lineFields.discountPercent,
            lineFields.discountAmount,
            lineFields.taxInclude,
            lineFields.spec,
            lineFields.itemNote,
            lineFields.note,
        ].filter(Boolean);

        inputs.forEach((input) => {
            input.disabled = readOnly;
        });

        if (lineSaveButton) {
            lineSaveButton.disabled = readOnly;
        }
    }

    function setEditingLocked(locked) {
        isReadOnly = Boolean(locked);
        const editableFields = [
            formRefs.title,
            formRefs.refId,
            formRefs.staff,
            formRefs.contactPerson,
            formRefs.deliverTo,
            formRefs.note,
            formRefs.paymentTerm,
            formRefs.paymentMethod,
            formRefs.bidValidity,
            formRefs.quotationDate,
            formRefs.orderDate,
            formRefs.orderDeadline,
            formRefs.expectedArrival,
            formRefs.refVendorId,
        ].filter(Boolean);

        editableFields.forEach((field) => {
            field.disabled = isReadOnly;
        });

        if (addLineButton) {
            addLineButton.disabled = isReadOnly;
        }

        setLineFormReadOnly(isReadOnly);
        renderLines();
    }

    function applyStatus(status, { markDirty: shouldMark = false } = {}) {
        const normalized = typeof status === 'string' ? status.toLowerCase() : 'submitted';
        setStatusBadge(normalized);
        updateStatusDescription(normalized);
        updateStatusActions(normalized);
        if (formRefs.statusSelect) {
            runWithPopulation(() => {
                formRefs.statusSelect.value = normalized;
            });
        }
        setEditingLocked(normalized === 'approved' || normalized === 'closed' || normalized === 'cancelled');
        if (shouldMark) {
            markDirty();
        }
    }

    function cloneLine(line) {
        if (!line || typeof line !== 'object') return null;
        return {
            supplier_quotation_line_id: line.supplier_quotation_line_id ?? null,
            supplier_rfq_line_id: line.supplier_rfq_line_id ?? null,
            item_id: Number.isFinite(Number(line.item_id)) ? Number(line.item_id) : 0,
            item_desc: line.item_desc || '',
            item_spec: line.item_spec || '',
            item_note: line.item_note || '',
            uom: line.uom || '',
            quantity_offered: Number.isFinite(Number(line.quantity_offered)) ? Number(line.quantity_offered) : 0,
            unit_price: Number.isFinite(Number(line.unit_price)) ? Number(line.unit_price) : 0,
            discount_percent: line.discount_percent ?? null,
            discount_amount: line.discount_amount ?? null,
            tax_include: Boolean(line.tax_include),
            note: line.note || '',
        };
    }

    function createSnapshot(payload = {}) {
        const sourceLines = Array.isArray(payload.lines) ? payload.lines : lines;
        const lineCopies = sourceLines.map((line) => cloneLine(line)).filter(Boolean);
        return {
            title: payload.title ?? formRefs.title?.value ?? '',
            ref_supplier_quotation_id: payload.ref_supplier_quotation_id ?? formRefs.refId?.value ?? '',
            staff_id: payload.staff_id ?? formRefs.staff?.value ?? '',
            contact_person: payload.contact_person ?? formRefs.contactPerson?.value ?? '',
            deliver_to: payload.deliver_to ?? formRefs.deliverTo?.value ?? '',
            note: payload.note ?? formRefs.note?.value ?? '',
            payment_term: payload.payment_term ?? formRefs.paymentTerm?.value ?? '30D',
            payment_method: payload.payment_method ?? formRefs.paymentMethod?.value ?? 'bank',
            bid_validity_days: payload.bid_validity_days ?? formRefs.bidValidity?.value ?? '',
            quotation_date: payload.quotation_date ?? formRefs.quotationDate?.value ?? '',
            order_date: payload.order_date ?? formRefs.orderDate?.value ?? '',
            order_deadline: payload.order_deadline ?? formRefs.orderDeadline?.value ?? '',
            expected_arrival: payload.expected_arrival ?? formRefs.expectedArrival?.value ?? '',
            ref_vendor_id: payload.ref_vendor_id ?? formRefs.refVendorId?.value ?? '',
            status: payload.status ?? formRefs.statusSelect?.value ?? currentStatus ?? 'submitted',
            lines: lineCopies,
        };
    }

    function restoreSnapshot(snapshot) {
        if (!snapshot) return;
        runWithPopulation(() => {
            if (formRefs.title) formRefs.title.value = snapshot.title || '';
            if (formRefs.refId) formRefs.refId.value = snapshot.ref_supplier_quotation_id || '';
            if (formRefs.staff) formRefs.staff.value = snapshot.staff_id || '';
            if (formRefs.contactPerson) formRefs.contactPerson.value = snapshot.contact_person || '';
            if (formRefs.deliverTo) formRefs.deliverTo.value = snapshot.deliver_to || '';
            if (formRefs.note) formRefs.note.value = snapshot.note || '';
            if (formRefs.paymentTerm) formRefs.paymentTerm.value = snapshot.payment_term || '30D';
            if (formRefs.paymentMethod) formRefs.paymentMethod.value = snapshot.payment_method || 'bank';
            if (formRefs.bidValidity) formRefs.bidValidity.value = snapshot.bid_validity_days || '';
            if (formRefs.quotationDate) formRefs.quotationDate.value = snapshot.quotation_date || '';
            if (formRefs.orderDate) formRefs.orderDate.value = snapshot.order_date || '';
            if (formRefs.orderDeadline) formRefs.orderDeadline.value = snapshot.order_deadline || '';
            if (formRefs.expectedArrival) formRefs.expectedArrival.value = snapshot.expected_arrival || '';
            if (formRefs.refVendorId) formRefs.refVendorId.value = snapshot.ref_vendor_id || '';
            if (formRefs.statusSelect) formRefs.statusSelect.value = snapshot.status || 'submitted';
            lines = Array.isArray(snapshot.lines)
                ? snapshot.lines.map((line) => ({ ...cloneLine(line) })).filter(Boolean)
                : [];
            renderLines();
        });
        applyStatus(snapshot.status || 'submitted');
        setDirtyState(false);
    }

    function handleBeforeUnload(event) {
        if (!isDirty) return;
        event.preventDefault();
        event.returnValue = '';
    }

    function updateSaveButtonState() {
        const shouldDisable = isSaving || !isDirty;
        if (saveButton) {
            saveButton.disabled = shouldDisable;
            if (shouldDisable) {
                saveButton.setAttribute('aria-disabled', 'true');
            } else {
                saveButton.removeAttribute('aria-disabled');
            }
        }
        if (inlineSaveButton) {
            inlineSaveButton.disabled = shouldDisable;
            if (shouldDisable) {
                inlineSaveButton.setAttribute('aria-disabled', 'true');
            } else {
                inlineSaveButton.removeAttribute('aria-disabled');
            }
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
        if (!isDatasetLoaded || isPopulating) {
            return;
        }
        setDirtyState(true);
    }

    function formatDateTime(value) {
        if (!value) return '—';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '—';
        return date.toLocaleString('th-TH', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    }

    function formatNumber(value, fractionDigits = 2) {
        const number = Number(value);
        if (!Number.isFinite(number)) return '—';
        return new Intl.NumberFormat('th-TH', {
            minimumFractionDigits: fractionDigits,
            maximumFractionDigits: fractionDigits,
        }).format(number);
    }

    function formatPrice(value) {
        return formatNumber(value ?? 0, 2);
    }

    function formatQuantity(line) {
        const qty = Number(line?.quantity_offered ?? 0);
        const uom = (line?.uom || 'unit').trim();
        const qtyLabel = Number.isFinite(qty) ? formatNumber(qty, 0) : '0';
        return uom ? `${qtyLabel} ${uom}` : qtyLabel;
    }

    function describeDiscount(line) {
        const parts = [];
        if (line?.discount_percent !== null && line?.discount_percent !== undefined && line.discount_percent !== '') {
            parts.push(`ลด ${formatNumber(line.discount_percent, 2)}%`);
        }
        if (line?.discount_amount !== null && line?.discount_amount !== undefined && line.discount_amount !== '') {
            parts.push(`ลด ${formatNumber(line.discount_amount, 2)} บาท`);
        }
        parts.push(line?.tax_include ? 'รวม VAT' : 'ยังไม่รวม VAT');
        return parts.join(' • ');
    }

    function findLinesMissingPrices() {
        return lines.filter((line) => {
            const price = Number(line?.unit_price);
            return !Number.isFinite(price) || price <= 0;
        });
    }

    function setLineModalMessage(message, tone = 'info') {
        if (!lineModalMessage) return;
        const normalized = typeof message === 'string' ? message.trim() : '';
        lineModalMessage.classList.remove('success', 'error');
        if (!normalized) {
            lineModalMessage.hidden = true;
            lineModalMessage.textContent = '';
            return;
        }
        lineModalMessage.hidden = false;
        lineModalMessage.textContent = normalized;
        if (tone === 'success') {
            lineModalMessage.classList.add('success');
        } else if (tone === 'error') {
            lineModalMessage.classList.add('error');
        }
    }

    function populateLineForm(line) {
        if (!line) return;
        if (lineFields.itemName) lineFields.itemName.value = line.item_desc || line.item_name || '';
        if (lineFields.itemId) lineFields.itemId.value = line.item_id || '';
        if (lineFields.quantity) lineFields.quantity.value = line.quantity_offered ?? 0;
        if (lineFields.uom) lineFields.uom.value = line.uom || 'unit';
        if (lineFields.unitPrice) lineFields.unitPrice.value = line.unit_price ?? 0;
        if (lineFields.discountPercent)
            lineFields.discountPercent.value = line.discount_percent ?? '';
        if (lineFields.discountAmount)
            lineFields.discountAmount.value = line.discount_amount ?? '';
        if (lineFields.taxInclude) lineFields.taxInclude.checked = Boolean(line.tax_include);
        if (lineFields.spec) lineFields.spec.value = line.item_spec || '';
        if (lineFields.itemNote) lineFields.itemNote.value = line.item_note || '';
        if (lineFields.note) lineFields.note.value = line.note || '';
    }

    function openLineModal(line) {
        if (!lineModal || !line) return;
        activeLine = line;
        setLineModalMessage('');
        populateLineForm(line);
        setLineFormReadOnly(isReadOnly);
        lineModal.hidden = false;
        lineModal.setAttribute('aria-hidden', 'false');
        requestAnimationFrame(() => {
            const focusTarget = lineFields.itemName;
            if (focusTarget && !isReadOnly) {
                focusTarget.focus();
                focusTarget.select?.();
            }
        });
    }

    function closeLineModal() {
        if (!lineModal) return;
        lineModal.hidden = true;
        lineModal.setAttribute('aria-hidden', 'true');
        activeLine = null;
        setLineModalMessage('');
    }

    function setMessage(message, tone = 'info') {
        if (!globalMessage) return;
        const normalized = typeof message === 'string' ? message.trim() : '';
        globalMessage.classList.remove('success', 'error');
        if (!normalized) {
            globalMessage.hidden = true;
            globalMessage.textContent = '';
            return;
        }
        globalMessage.hidden = false;
        globalMessage.textContent = normalized;
        if (tone === 'success') {
            globalMessage.classList.add('success');
        } else if (tone === 'error') {
            globalMessage.classList.add('error');
        }
    }

    function syncMeta(payload) {
        if (!payload) return;
        if (formRefs.id) {
            formRefs.id.value = payload.supplier_quotation_id || payload.id || 'ใหม่';
        }
        if (formRefs.refId) {
            formRefs.refId.value = payload.ref_supplier_quotation_id || '';
        }
        if (referenceMeta) {
            const ref = payload.ref_supplier_quotation_id || `QTN#${payload.supplier_quotation_id}`;
            referenceMeta.textContent = `อ้างอิงใบเสนอราคา: ${ref}`;
        }
        if (titleDisplay) {
            const name = payload.title || payload.ref_supplier_quotation_id || payload.supplier_quotation_id;
            titleDisplay.textContent = name ? `ใบเสนอราคา: ${name}` : 'ใบเสนอราคา';
        }
        if (formRefs.title) {
            formRefs.title.value = payload.title || '';
        }
        if (formRefs.staff) {
            formRefs.staff.value = payload.staff_id || '';
        }
        if (formRefs.contactPerson) {
            formRefs.contactPerson.value = payload.contact_person || payload.staff_id || '';
        }
        if (formRefs.deliverTo) {
            formRefs.deliverTo.value = payload.deliver_to || '';
        }
        if (formRefs.note) {
            formRefs.note.value = payload.note || '';
        }
        if (formRefs.paymentTerm) {
            formRefs.paymentTerm.value = payload.payment_term || '30D';
        }
        if (formRefs.paymentMethod) {
            formRefs.paymentMethod.value = payload.payment_method || 'bank';
        }
        if (formRefs.bidValidity) {
            formRefs.bidValidity.value = payload.bid_validity_days ? payload.bid_validity_days.replace(' ', 'T') : '';
        }
        if (formRefs.quotationDate) {
            formRefs.quotationDate.value = payload.quotation_date ? payload.quotation_date.replace(' ', 'T') : '';
        }
        if (formRefs.orderDate) {
            formRefs.orderDate.value = payload.order_date ? payload.order_date.replace(' ', 'T') : '';
        }
        if (formRefs.orderDeadline) {
            formRefs.orderDeadline.value = payload.order_deadline ? payload.order_deadline.replace(' ', 'T') : '';
        }
        if (formRefs.expectedArrival) {
            formRefs.expectedArrival.value = payload.expected_arrival ? payload.expected_arrival.replace(' ', 'T') : '';
        }
        if (formRefs.refVendorId) {
            formRefs.refVendorId.value = payload.ref_vendor_id || '';
        }
        if (formRefs.statusSelect) {
            formRefs.statusSelect.value = payload.status || 'submitted';
        }
        if (formRefs.rfq) {
            const rfq = payload.rfq || {};
            const rfqLabel = rfq.ref_supplier_rfq_id || rfq.supplier_rfq_id || '—';
            formRefs.rfq.value = rfqLabel;
        }
        if (formRefs.supplier) {
            const supplier = payload.supplier || {};
            const nameParts = [supplier.supplier_name, supplier.org_name].filter((part) => part && part.trim() !== '');
            const label = nameParts.join(' • ') || supplier.ref_supplier_id || supplier.supplier_id || '—';
            formRefs.supplier.value = label;
        }
        if (meta.eventName) {
            meta.eventName.textContent = payload.event?.event_name || '—';
        }
        if (meta.eventCode) {
            meta.eventCode.textContent = `รหัสอีเว้น: ${payload.event?.event_code || '—'}`;
        }
        if (meta.eventDate) {
            const start = payload.event?.start_date ? formatDateTime(payload.event.start_date) : null;
            const end = payload.event?.end_date ? formatDateTime(payload.event.end_date) : null;
            meta.eventDate.textContent = start || end ? `ช่วงเวลา: ${start || '—'} - ${end || '—'}` : 'ช่วงเวลา: —';
        }
        if (meta.updatedAt) {
            meta.updatedAt.textContent = `อัปเดตล่าสุด: ${formatDateTime(payload.updated_at)}`;
        }
        if (meta.createdAt) {
            meta.createdAt.textContent = `สร้างเมื่อ: ${formatDateTime(payload.created_at)}`;
        }
        if (meta.updatedBy) {
            meta.updatedBy.textContent = `ปรับปรุงโดย: ${payload.updated_by_label || '—'}`;
        }
        if (meta.createdBy) {
            meta.createdBy.textContent = `สร้างโดย: ${payload.created_by_label || '—'}`;
        }
        if (formRefs.createdByMeta) {
            formRefs.createdByMeta.textContent = payload.created_by_label || '—';
        }
        if (formRefs.updatedByMeta) {
            formRefs.updatedByMeta.textContent = payload.updated_by_label || '—';
        }
        applyStatus(payload.status);
    }

    function buildLineRow(line) {
        const row = document.createElement('tr');
        row.dataset.lineId = line.supplier_quotation_line_id || '';

        const itemCell = document.createElement('td');
        const itemTitle = document.createElement('div');
        itemTitle.className = 'line-title';
        itemTitle.textContent = line.item_desc || line.item_name || '—';
        const itemMeta = document.createElement('p');
        itemMeta.className = 'meta-sub';
        const metaParts = [];
        if (line.item_id) metaParts.push(`ID: ${line.item_id}`);
        if (line.item_spec) metaParts.push(line.item_spec);
        if (line.item_note) metaParts.push(line.item_note);
        itemMeta.textContent = metaParts.join(' • ') || '—';
        itemCell.append(itemTitle, itemMeta);

        const qtyCell = document.createElement('td');
        const qtyValue = document.createElement('div');
        qtyValue.className = 'line-title';
        qtyValue.textContent = formatQuantity(line);
        const qtyMeta = document.createElement('p');
        qtyMeta.className = 'meta-sub';
        qtyMeta.textContent = line.note || ' ';
        qtyCell.append(qtyValue, qtyMeta);

        const priceCell = document.createElement('td');
        const priceValue = document.createElement('div');
        priceValue.className = 'line-title';
        priceValue.textContent = formatPrice(line.unit_price);
        const priceMeta = document.createElement('p');
        priceMeta.className = 'meta-sub';
        priceMeta.textContent = describeDiscount(line);
        priceCell.append(priceValue, priceMeta);

        const actionsCell = document.createElement('td');
        actionsCell.className = 'col-actions';
        const manageBtn = document.createElement('button');
        manageBtn.type = 'button';
        manageBtn.className = 'btn btn-ghost';
        manageBtn.innerHTML = '<span class="i pencil"></span> รายละเอียดสินค้า';
        manageBtn.addEventListener('click', () => {
            openLineModal(line);
        });

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'btn btn-ghost status-danger';
        removeBtn.innerHTML = '<span class="i trash"></span>';
        removeBtn.disabled = isReadOnly;
        removeBtn.addEventListener('click', () => {
            if (isReadOnly) return;
            lines = lines.filter((item) => item !== line);
            renderLines();
            markDirty();
        });
        actionsCell.append(manageBtn, removeBtn);

        row.append(itemCell, qtyCell, priceCell, actionsCell);
        return row;
    }

    function handleLineFormSubmit(event) {
        if (event) {
            event.preventDefault();
        }
        if (isReadOnly) {
            setLineModalMessage('ไม่สามารถแก้ไขได้เมื่อสถานะถูกล็อก', 'error');
            return;
        }
        if (!activeLine) {
            setLineModalMessage('ไม่พบรายการสินค้าที่ต้องการแก้ไข', 'error');
            return;
        }
        const itemName = lineFields.itemName?.value?.trim() || '';
        if (!itemName) {
            setLineModalMessage('กรุณากรอกชื่อสินค้า', 'error');
            lineFields.itemName?.focus();
            return;
        }
        activeLine.item_desc = itemName;
        activeLine.item_name = itemName;
        activeLine.item_id = lineFields.itemId?.value ? Number(lineFields.itemId.value) : 0;
        activeLine.quantity_offered = Number(lineFields.quantity?.value || 0);
        activeLine.uom = lineFields.uom?.value || 'unit';
        activeLine.unit_price = Number(lineFields.unitPrice?.value || 0);
        activeLine.discount_percent = lineFields.discountPercent?.value === ''
            ? null
            : Number(lineFields.discountPercent?.value || 0);
        activeLine.discount_amount = lineFields.discountAmount?.value === ''
            ? null
            : Number(lineFields.discountAmount?.value || 0);
        activeLine.tax_include = Boolean(lineFields.taxInclude?.checked);
        activeLine.item_spec = lineFields.spec?.value || '';
        activeLine.item_note = lineFields.itemNote?.value || '';
        activeLine.note = lineFields.note?.value || '';
        renderLines();
        markDirty();
        closeLineModal();
    }

    function renderLines() {
        if (!linesBody || !linesEmpty) return;
        linesBody.innerHTML = '';
        const hasLines = Array.isArray(lines) && lines.length > 0;
        linesEmpty.hidden = hasLines;
        linesEmpty.setAttribute('aria-hidden', hasLines ? 'true' : 'false');
        lines.forEach((line) => {
            const row = buildLineRow(line);
            linesBody.appendChild(row);
        });
    }

    function addEmptyLine() {
        if (isReadOnly) return;
        const newLine = {
            supplier_quotation_line_id: null,
            supplier_rfq_line_id: null,
            item_id: 0,
            item_desc: '',
            item_spec: '',
            item_note: '',
            uom: 'unit',
            quantity_offered: 0,
            unit_price: 0,
            discount_percent: null,
            discount_amount: null,
            tax_include: true,
            note: '',
        };
        lines.push(newLine);
        renderLines();
        markDirty();
        openLineModal(newLine);
    }

    function handleApproveAction() {
        if (!lines || lines.length === 0) {
            setMessage('กรุณาเพิ่มรายการสินค้าและระบุราคา', 'error');
            return;
        }
        const missingPrices = findLinesMissingPrices();
        if (missingPrices.length > 0) {
            const confirmProceed = window.confirm(
                'ยังมีสินค้าบางรายการที่ไม่มีราคาหรือมีราคา 0 ต้องการตั้งราคาเป็น 0 และอนุมัติเลยหรือไม่?'
            );
            if (!confirmProceed) {
                setMessage('กรุณากรอกข้อมูลราคาของสินค้าทั้งหมดก่อนอนุมัติ', 'error');
                return;
            }
            missingPrices.forEach((line) => {
                line.unit_price = 0;
            });
        }
        applyStatus('approved', { markDirty: true });
        renderLines();
        saveQuotation();
    }

    function handleReturnPending() {
        applyStatus('pending', { markDirty: true });
        renderLines();
        saveQuotation();
    }

    function handleCancelAction() {
        applyStatus('closed', { markDirty: true });
        renderLines();
        saveQuotation();
    }

    async function fetchQuotation() {
        if (!quotationId) {
            setMessage('ไม่พบรหัสใบเสนอราคา', 'error');
            return;
        }
        try {
            const response = await fetch(`${modelRoot}/supplier_quotation_detail.php?supplier_quotation_id=${encodeURIComponent(quotationId)}`, {
                credentials: 'same-origin',
            });
            if (!response.ok) {
                throw new Error('not_found');
            }
            const data = await response.json();
            quotation = data?.data || null;
            lines = Array.isArray(quotation?.lines) ? quotation.lines : [];
            runWithPopulation(() => {
                syncMeta(quotation);
                renderLines();
            });
            lastSnapshot = createSnapshot(quotation);
            setDirtyState(false);
            isDatasetLoaded = true;
            setMessage('');
        } catch (error) {
            setMessage('ไม่สามารถโหลดใบเสนอราคาได้', 'error');
        }
    }

    function collectFormData() {
        const payload = {
            supplier_quotation_id: quotation?.supplier_quotation_id || quotationId,
            event_id: quotation?.event?.event_id || eventId,
            title: formRefs.title?.value || '',
            ref_supplier_quotation_id: formRefs.refId?.value || null,
            staff_id: formRefs.staff?.value || null,
            contact_person: formRefs.contactPerson?.value || null,
            deliver_to: formRefs.deliverTo?.value || null,
            note: formRefs.note?.value || null,
            payment_term: formRefs.paymentTerm?.value || '30D',
            payment_method: formRefs.paymentMethod?.value || 'bank',
            bid_validity_days: formRefs.bidValidity?.value || null,
            quotation_date: formRefs.quotationDate?.value || null,
            order_date: formRefs.orderDate?.value || null,
            order_deadline: formRefs.orderDeadline?.value || null,
            expected_arrival: formRefs.expectedArrival?.value || null,
            ref_vendor_id: formRefs.refVendorId?.value || null,
            status: formRefs.statusSelect?.value || currentStatus || 'submitted',
            lines: lines.map((line) => ({
                supplier_quotation_line_id: line.supplier_quotation_line_id,
                supplier_rfq_line_id: line.supplier_rfq_line_id,
                item_id: line.item_id,
                item_desc: line.item_desc,
                item_spec: line.item_spec,
                item_note: line.item_note,
                uom: line.uom,
                quantity_offered: line.quantity_offered,
                unit_price: line.unit_price,
                discount_percent: line.discount_percent,
                discount_amount: line.discount_amount,
                tax_include: line.tax_include,
                note: line.note,
            })),
        };
        return payload;
    }

    async function saveQuotation() {
        if (!quotationId) {
            setMessage('ไม่พบใบเสนอราคาที่ต้องการบันทึก', 'error');
            return;
        }
        if (isSaving) return;
        const payload = collectFormData();
        isSaving = true;
        updateSaveButtonState();
        setMessage('กำลังบันทึกข้อมูล...');
        try {
            const response = await fetch(`${modelRoot}/supplier_quotation_update.php`, {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await response.json().catch(() => null);
            if (!response.ok) {
                const code = data?.error;
                if (code === 'duplicate_ref_id') {
                    setMessage('รหัสอ้างอิงใบเสนอราคาซ้ำ', 'error');
                } else if (code === 'missing_lines') {
                    setMessage('กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ', 'error');
                } else {
                    setMessage('บันทึกใบเสนอราคาไม่สำเร็จ', 'error');
                }
                return;
            }
            if (data?.data?.lines) {
                lines = data.data.lines;
            }
            applyStatus(data?.data?.status || payload.status);
            runWithPopulation(() => {
                syncMeta({ ...quotation, ...payload, ...data.data });
                renderLines();
            });
            lastSnapshot = createSnapshot({ ...quotation, ...payload, ...data.data });
            setDirtyState(false);
            setMessage('บันทึกใบเสนอราคาเรียบร้อย', 'success');
        } catch (error) {
            setMessage('ไม่สามารถบันทึกใบเสนอราคาได้', 'error');
        } finally {
            isSaving = false;
            updateSaveButtonState();
        }
    }

    function bindEvents() {
        const watchedFields = [
            'title',
            'refId',
            'staff',
            'contactPerson',
            'deliverTo',
            'note',
            'paymentTerm',
            'paymentMethod',
            'bidValidity',
            'quotationDate',
            'orderDate',
            'orderDeadline',
            'expectedArrival',
            'refVendorId',
        ];
        watchedFields.forEach((key) => {
            const el = formRefs[key];
            if (!el) return;
            const handler = () => markDirty();
            el.addEventListener('input', handler);
            if (el.tagName === 'SELECT') {
                el.addEventListener('change', handler);
            }
        });
        if (addLineButton) {
            addLineButton.addEventListener('click', addEmptyLine);
        }
        if (saveButton) {
            saveButton.addEventListener('click', saveQuotation);
        }
        if (inlineSaveButton) {
            inlineSaveButton.addEventListener('click', saveQuotation);
        }
        if (discardButton) {
            discardButton.addEventListener('click', () => restoreSnapshot(lastSnapshot));
        }
        if (lineForm) {
            lineForm.addEventListener('submit', handleLineFormSubmit);
        }
        if (formRefs.statusSelect) {
            formRefs.statusSelect.addEventListener('change', (event) => {
                applyStatus(event.target.value, { markDirty: true });
            });
        }
        if (approveButton) {
            approveButton.addEventListener('click', handleApproveAction);
        }
        if (returnPendingButton) {
            returnPendingButton.addEventListener('click', handleReturnPending);
        }
        if (cancelButton) {
            cancelButton.addEventListener('click', handleCancelAction);
        }
        if (lineModal) {
            lineModal.addEventListener('click', (event) => {
                const dismissTrigger = event.target.closest('[data-modal-dismiss]');
                if (dismissTrigger) {
                    event.preventDefault();
                    closeLineModal();
                }
            });
        }
        window.addEventListener('beforeunload', handleBeforeUnload);
    }

    async function boot({ root }) {
        modelRoot = `${root}/Model`;
        tickClock();
        setInterval(tickClock, 1000);
        setBackLinks();
        await fetchQuotation();
        bindEvents();
        updateSaveButtonState();
    }

    if (typeof window.onAppReady === 'function') {
        window.onAppReady(boot);
    }
})();
