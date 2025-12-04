(function () {
    const params = new URLSearchParams(window.location.search);
    const quotationId = params.get('supplier_quotation_id');
    const eventId = params.get('event_id');

    const pageDate = document.getElementById('quotationPageDate');
    const backLink = document.getElementById('quotationBackLink');
    const backButton = document.getElementById('quotationBtnBack');
    const saveButton = document.getElementById('quotationBtnSave');
    const globalMessage = document.getElementById('quotationGlobalMessage');

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
    const referenceMeta = document.getElementById('quotationReferenceMeta');
    const titleDisplay = document.getElementById('quotationTitle');

    let modelRoot = '';
    let quotation = null;
    let lines = [];

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
        const url = new URL('./event_document_manage.html', window.location.href);
        if (eventId) {
            url.searchParams.set('event_id', eventId);
        }
        const target = `${url.pathname}${url.search}`;
        if (backLink) backLink.href = target;
        if (backButton) backButton.addEventListener('click', () => {
            window.location.href = target;
        });
    }

    function setStatusBadge(status) {
        const normalized = typeof status === 'string' ? status.toLowerCase() : 'submitted';
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
        setStatusBadge(payload.status);
    }

    function buildLineRow(line) {
        const row = document.createElement('tr');
        row.dataset.lineId = line.supplier_quotation_line_id || '';

        const itemCell = document.createElement('td');
        const itemIdInput = document.createElement('input');
        itemIdInput.type = 'number';
        itemIdInput.min = '1';
        itemIdInput.value = line.item_id || '';
        const itemName = document.createElement('div');
        itemName.className = 'meta-sub';
        itemName.textContent = line.item_desc || line.item_name || '';
        itemIdInput.addEventListener('input', () => {
            line.item_id = Number(itemIdInput.value || 0);
        });
        itemCell.append(itemIdInput, itemName);

        const descCell = document.createElement('td');
        const descInput = document.createElement('textarea');
        descInput.value = line.item_desc || '';
        descInput.rows = 2;
        descInput.addEventListener('input', () => {
            line.item_desc = descInput.value;
        });
        const specInput = document.createElement('textarea');
        specInput.placeholder = 'สเปค (ถ้ามี)';
        specInput.rows = 2;
        specInput.value = line.item_spec || '';
        specInput.addEventListener('input', () => {
            line.item_spec = specInput.value;
        });
        const noteInput = document.createElement('textarea');
        noteInput.placeholder = 'หมายเหตุ';
        noteInput.rows = 2;
        noteInput.value = line.item_note || '';
        noteInput.addEventListener('input', () => {
            line.item_note = noteInput.value;
        });
        descCell.append(descInput, specInput, noteInput);

        const qtyCell = document.createElement('td');
        const qtyInput = document.createElement('input');
        qtyInput.type = 'number';
        qtyInput.min = '0';
        qtyInput.value = line.quantity_offered ?? 0;
        qtyInput.addEventListener('input', () => {
            line.quantity_offered = Number(qtyInput.value || 0);
        });
        const uomInput = document.createElement('input');
        uomInput.type = 'text';
        uomInput.placeholder = 'UOM';
        uomInput.value = line.uom || 'unit';
        uomInput.addEventListener('input', () => {
            line.uom = uomInput.value || 'unit';
        });
        qtyCell.append(qtyInput, uomInput);

        const priceCell = document.createElement('td');
        const priceInput = document.createElement('input');
        priceInput.type = 'number';
        priceInput.step = '0.01';
        priceInput.min = '0';
        priceInput.value = line.unit_price ?? 0;
        priceInput.addEventListener('input', () => {
            line.unit_price = Number(priceInput.value || 0);
        });
        priceCell.appendChild(priceInput);

        const discountPercentCell = document.createElement('td');
        const discountPercentInput = document.createElement('input');
        discountPercentInput.type = 'number';
        discountPercentInput.step = '0.01';
        discountPercentInput.min = '0';
        discountPercentInput.value = line.discount_percent ?? '';
        discountPercentInput.addEventListener('input', () => {
            line.discount_percent = discountPercentInput.value === '' ? null : Number(discountPercentInput.value || 0);
        });
        discountPercentCell.appendChild(discountPercentInput);

        const discountAmountCell = document.createElement('td');
        const discountAmountInput = document.createElement('input');
        discountAmountInput.type = 'number';
        discountAmountInput.step = '0.01';
        discountAmountInput.min = '0';
        discountAmountInput.value = line.discount_amount ?? '';
        discountAmountInput.addEventListener('input', () => {
            line.discount_amount = discountAmountInput.value === '' ? null : Number(discountAmountInput.value || 0);
        });
        discountAmountCell.appendChild(discountAmountInput);

        const taxCell = document.createElement('td');
        const taxToggle = document.createElement('input');
        taxToggle.type = 'checkbox';
        taxToggle.checked = Boolean(line.tax_include);
        taxToggle.addEventListener('change', () => {
            line.tax_include = taxToggle.checked;
        });
        taxCell.appendChild(taxToggle);

        const actionsCell = document.createElement('td');
        actionsCell.className = 'col-actions';
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'btn btn-ghost';
        removeBtn.textContent = 'ลบ';
        removeBtn.addEventListener('click', () => {
            lines = lines.filter((item) => item !== line);
            renderLines();
        });
        actionsCell.appendChild(removeBtn);

        row.append(itemCell, descCell, qtyCell, priceCell, discountPercentCell, discountAmountCell, taxCell, actionsCell);
        return row;
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
        lines.push({
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
        });
        renderLines();
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
            syncMeta(quotation);
            renderLines();
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
            status: formRefs.statusSelect?.value || 'submitted',
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
        const payload = collectFormData();
        saveButton.disabled = true;
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
            setStatusBadge(data?.data?.status || payload.status);
            syncMeta({ ...quotation, ...payload, ...data.data });
            renderLines();
            setMessage('บันทึกใบเสนอราคาเรียบร้อย', 'success');
        } catch (error) {
            setMessage('ไม่สามารถบันทึกใบเสนอราคาได้', 'error');
        } finally {
            saveButton.disabled = false;
        }
    }

    function bindEvents() {
        if (addLineButton) {
            addLineButton.addEventListener('click', addEmptyLine);
        }
        if (saveButton) {
            saveButton.addEventListener('click', saveQuotation);
        }
    }

    async function boot({ root }) {
        modelRoot = `${root}/Model`;
        tickClock();
        setInterval(tickClock, 1000);
        setBackLinks();
        await fetchQuotation();
        bindEvents();
    }

    if (typeof window.onAppReady === 'function') {
        window.onAppReady(boot);
    }
})();
