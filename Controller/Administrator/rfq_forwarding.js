(function () {
    const params = new URLSearchParams(window.location.search);
    const rfqId = params.get('rfq_id') ? String(params.get('rfq_id')) : '';
    const eventId = params.get('event_id') ? String(params.get('event_id')) : '';

    const backLink = document.getElementById('forwardBackLink');
    const pageDate = document.getElementById('pageDate');
    const pageTitle = document.getElementById('forwardTitle');
    const rfqNameDisplay = document.getElementById('rfqName');
    const rfqCodeDisplay = document.getElementById('rfqCode');
    const rfqEventDisplay = document.getElementById('rfqEventLabel');
    const statusChip = document.getElementById('rfqForwardStatusChip');
    const statusText = document.getElementById('rfqForwardStatusText');
    const updatedAtDisplay = document.getElementById('rfqForwardUpdatedAt');
    const searchInput = document.getElementById('supplierSearch');
    const tableBody = document.getElementById('forwardSupplierTableBody');
    const emptyState = document.getElementById('forwardEmptyState');
    const forwardMessage = document.getElementById('forwardMessage');

    let modelRoot = '';
    let suppliers = [];
    let rfqStatus = 'draft';
    let searchHandle = null;

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

    function setMessage(text, tone = 'info') {
        if (!forwardMessage) return;
        if (!text) {
            forwardMessage.hidden = true;
            forwardMessage.textContent = '';
            return;
        }
        forwardMessage.hidden = false;
        forwardMessage.textContent = text;
        forwardMessage.className = `form-alert ${tone}`;
    }

    function normalizeStatus(status) {
        const normalized = typeof status === 'string' ? status.trim().toLowerCase() : 'draft';
        const synonyms = { approved: 'completed', complete: 'completed', confirmed: 'completed' };
        const mapped = synonyms[normalized] ?? normalized;
        const allowed = ['draft', 'completed', 'cancelled'];
        return allowed.includes(mapped) ? mapped : 'draft';
    }

    function setStatusChip(status) {
        const normalized = normalizeStatus(status);
        rfqStatus = normalized;
        if (statusChip) {
            statusChip.dataset.status = normalized;
        }
        if (statusText) {
            const label =
                normalized === 'completed' ? 'ยืนยันแล้ว' : normalized === 'cancelled' ? 'ยกเลิก' : 'ร่าง';
            statusText.textContent = `สถานะ: ${label}`;
        }
    }

    function formatDateTime(dateLike) {
        if (!dateLike) return '—';
        const date = new Date(dateLike);
        if (Number.isNaN(date.getTime())) return '—';
        return date.toLocaleString('th-TH', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    }

    function setBackLink() {
        if (!backLink) return;
        const url = new URL('./RFQ_detail.html', window.location.href);
        if (rfqId) {
            url.searchParams.set('rfq_id', rfqId);
        }
        if (eventId) {
            url.searchParams.set('event_id', eventId);
        }
        backLink.href = `${url.pathname}${url.search}`;
    }

    function renderSuppliers() {
        if (!tableBody || !emptyState) return;
        tableBody.innerHTML = '';
        const list = Array.isArray(suppliers) ? suppliers : [];
        const hasRows = list.length > 0;
        emptyState.hidden = hasRows;
        emptyState.setAttribute('aria-hidden', hasRows ? 'true' : 'false');

        const readyToSend = rfqStatus === 'completed';

        list.forEach((supplier) => {
            const row = document.createElement('tr');

            const idCell = document.createElement('td');
            idCell.textContent = supplier.supplier_id ?? '—';
            row.appendChild(idCell);

            const nameCell = document.createElement('td');
            const nameParts = [supplier.supplier_name, supplier.org_name].filter((part) => part && part.trim() !== '');
            nameCell.textContent = nameParts.join(' • ') || '—';
            row.appendChild(nameCell);

            const contactPersonCell = document.createElement('td');
            contactPersonCell.textContent = supplier.contact_person || '—';
            row.appendChild(contactPersonCell);

            const contactMetaCell = document.createElement('td');
            contactMetaCell.textContent = supplier.contact_meta || '—';
            row.appendChild(contactMetaCell);

            const statusCell = document.createElement('td');
            statusCell.textContent = supplier.status === 'active' ? 'เปิดใช้งาน' : 'ปิดใช้งาน';
            row.appendChild(statusCell);

            const actionCell = document.createElement('td');
            actionCell.className = 'col-actions';
            const button = document.createElement('button');
            button.type = 'button';
            button.className = supplier.has_forwarded ? 'btn btn-ghost forward-action-btn' : 'btn btn-secondary forward-action-btn';
            button.dataset.supplierId = supplier.supplier_id;
            button.dataset.forwarded = supplier.has_forwarded ? 'true' : 'false';
            if (supplier.has_forwarded) {
                button.textContent = 'ส่งแล้ว';
                button.disabled = true;
            } else {
                button.textContent = readyToSend ? 'ส่ง RFQ' : 'ต้องยืนยัน RFQ ก่อนส่ง';
                button.disabled = !readyToSend;
                button.addEventListener('click', async () => {
                    await handleForward(supplier.supplier_id, button);
                });
            }
            actionCell.appendChild(button);
            row.appendChild(actionCell);

            tableBody.appendChild(row);
        });
    }

    async function fetchSuppliers(searchTerm = '') {
        if (!rfqId) return;
        const query = new URLSearchParams({ rfq_id: rfqId });
        if (searchTerm.trim() !== '') {
            query.set('search', searchTerm.trim());
        }
        try {
            const response = await fetch(`${modelRoot}/supplier_rfq_forwarding.php?${query.toString()}`, {
                credentials: 'same-origin',
            });
            if (!response.ok) {
                throw new Error('failed_to_load_suppliers');
            }
            const data = await response.json();
            suppliers = Array.isArray(data?.data) ? data.data : [];
            if (data?.rfq_status) {
                setStatusChip(data.rfq_status);
            }
            renderSuppliers();
        } catch (error) {
            setMessage('ไม่สามารถโหลดรายชื่อซัพพลายเออร์ได้', 'error');
        }
    }

    async function handleForward(supplierId, button) {
        if (!rfqId || !supplierId) return;
        const originalText = button.textContent;
        button.disabled = true;
        button.textContent = 'กำลังส่ง...';
        setMessage('');
        try {
            const response = await fetch(`${modelRoot}/supplier_rfq_forwarding.php`, {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ rfq_id: rfqId, supplier_id: supplierId }),
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                const code = errorData?.error;
                if (code === 'already_forwarded') {
                    setMessage('ได้ส่ง RFQ ให้ซัพพลายเออร์รายนี้แล้ว', 'warning');
                } else if (code === 'rfq_not_confirmed') {
                    setMessage('ต้องยืนยันและบันทึก RFQ ก่อนส่ง', 'warning');
                } else if (code === 'supplier_inactive') {
                    setMessage('ไม่สามารถส่งให้ซัพพลายเออร์ที่ไม่เปิดใช้งานได้', 'warning');
                } else {
                    setMessage('ส่ง RFQ ไม่สำเร็จ กรุณาลองใหม่', 'error');
                }
                button.disabled = false;
                button.textContent = originalText;
                return;
            }
            suppliers = suppliers.map((supplier) =>
                Number(supplier.supplier_id) === Number(supplierId)
                    ? { ...supplier, has_forwarded: true }
                    : supplier
            );
            setMessage('ส่ง RFQ ไปยังซัพพลายเออร์เรียบร้อย', 'success');
            renderSuppliers();
        } catch (error) {
            setMessage('ส่ง RFQ ไม่สำเร็จ กรุณาลองใหม่', 'error');
            button.disabled = false;
            button.textContent = originalText;
        }
    }

    async function fetchRfqInfo() {
        if (!rfqId) {
            setMessage('ไม่พบรหัส RFQ ที่ต้องการส่งต่อ', 'error');
            return;
        }
        try {
            const response = await fetch(`${modelRoot}/supplier_rfq_detail.php?rfq_id=${encodeURIComponent(rfqId)}`, {
                credentials: 'same-origin',
            });
            if (!response.ok) {
                throw new Error('rfq_not_found');
            }
            const data = await response.json();
            const info = data?.data;
            if (!info) {
                throw new Error('rfq_not_found');
            }
            rfqNameDisplay.textContent = info.title || '—';
            rfqCodeDisplay.textContent = `รหัส RFQ: ${info.supplier_rfq_id || rfqId}`;
            const eventName = info?.event?.event_name || info?.event?.event_code;
            rfqEventDisplay.textContent = eventName ? `อีเว้น: ${eventName}` : 'อีเว้น: —';
            if (updatedAtDisplay) {
                updatedAtDisplay.textContent = formatDateTime(info.updated_at || info.created_at);
            }
            setStatusChip(info.status);
            if (pageTitle) {
                pageTitle.textContent = `ส่ง RFQ: ${info.title || info.supplier_rfq_id || rfqId}`;
            }
            if (rfqStatus !== 'completed') {
                setMessage('ต้องยืนยันและบันทึก RFQ ก่อนจึงจะส่งให้ซัพพลายเออร์ได้', 'warning');
            } else {
                setMessage('');
            }
        } catch (error) {
            setMessage('ไม่สามารถโหลดข้อมูล RFQ ได้', 'error');
        }
    }

    function bindEvents() {
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                const value = searchInput.value || '';
                if (searchHandle) {
                    clearTimeout(searchHandle);
                }
                searchHandle = setTimeout(() => {
                    fetchSuppliers(value);
                }, 350);
            });
        }
    }

    async function boot({ root }) {
        modelRoot = `${root}/Model`;
        tickClock();
        setInterval(tickClock, 1000);
        setBackLink();
        await fetchRfqInfo();
        await fetchSuppliers(searchInput?.value || '');
        bindEvents();
    }

    if (typeof window.onAppReady === 'function') {
        window.onAppReady(boot);
    }
})();
