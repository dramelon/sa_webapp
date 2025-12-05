(function () {
    const params = new URLSearchParams(window.location.search);
    const rfqId = params.get('rfq_id');

    if (!rfqId) {
        alert('ไม่พบรหัส RFQ');
        return;
    }

    const els = {
        rfqId: document.getElementById('rfqId'),
        rfqDate: document.getElementById('rfqDate'),
        rfqDueDate: document.getElementById('rfqDueDate'),
        contactPerson: document.getElementById('contactPerson'),
        eventName: document.getElementById('eventName'),
        deliverTo: document.getElementById('deliverTo'),
        deliveryDate: document.getElementById('deliveryDate'),
        itemsBody: document.getElementById('itemsBody'),
        paymentTerm: document.getElementById('paymentTerm'),
        validityDays: document.getElementById('validityDays'),
        note: document.getElementById('note'),
        creatorName: document.getElementById('creatorName'),
    };

    function formatDate(dateString) {
        if (!dateString) return '—';
        const date = new Date(dateString);
        if (Number.isNaN(date.getTime())) return '—';
        return date.toLocaleDateString('th-TH', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    }

    function renderItems(lines) {
        if (!els.itemsBody) return;
        els.itemsBody.innerHTML = '';

        if (!lines || lines.length === 0) {
            els.itemsBody.innerHTML = '<tr><td colspan="5" style="text-align: center;">ไม่มีรายการสินค้า</td></tr>';
            return;
        }

        lines.forEach((line, index) => {
            const row = document.createElement('tr');

            const noCell = document.createElement('td');
            noCell.className = 'col-num';
            noCell.textContent = index + 1;

            const itemCell = document.createElement('td');
            const title = document.createElement('div');
            title.style.fontWeight = 'bold';
            title.textContent = line.item_name || line.item_desc || '—';
            itemCell.appendChild(title);

            if (line.item_spec) {
                const spec = document.createElement('div');
                spec.style.fontSize = '0.9em';
                spec.style.color = '#555';
                spec.textContent = line.item_spec;
                itemCell.appendChild(spec);
            }

            const qtyCell = document.createElement('td');
            qtyCell.className = 'col-qty';
            qtyCell.textContent = line.quantity_required ? Number(line.quantity_required).toLocaleString() : '0';

            const unitCell = document.createElement('td');
            unitCell.className = 'col-unit';
            unitCell.textContent = line.uom || 'หน่วย';

            const noteCell = document.createElement('td');
            noteCell.textContent = line.note || '';

            row.append(noCell, itemCell, qtyCell, unitCell, noteCell);
            els.itemsBody.appendChild(row);
        });
    }

    async function fetchData() {
        try {
            // Reusing the existing detail endpoint
            const response = await fetch(`../../Model/supplier_rfq_detail.php?rfq_id=${rfqId}`);
            if (!response.ok) throw new Error('Failed to fetch data');

            const json = await response.json();
            if (!json.data) throw new Error(json.error || 'Unknown error');

            const data = json.data;

            // Populate fields
            if (els.rfqId) els.rfqId.textContent = data.ref_supplier_rfq_id || `RFQ-${data.supplier_rfq_id}`;
            if (els.rfqDate) els.rfqDate.textContent = formatDate(data.request_date || data.created_at);
            if (els.rfqDueDate) els.rfqDueDate.textContent = formatDate(data.due_date);
            if (els.contactPerson) els.contactPerson.textContent = data.contact_person || '—';

            if (els.eventName) els.eventName.textContent = data.event?.event_name || '—';
            if (els.deliverTo) els.deliverTo.textContent = data.deliver_to || '—';
            if (els.deliveryDate) els.deliveryDate.textContent = formatDate(data.order_deadline);

            if (els.paymentTerm) els.paymentTerm.textContent = data.payment_term || '—';
            if (els.validityDays) els.validityDays.textContent = data.bid_validity_days ? `${data.bid_validity_days} วัน` : '—';
            if (els.note) els.note.textContent = data.note || '—';

            if (els.creatorName) els.creatorName.textContent = `(${data.created_by_label || '_______________________'})`;

            renderItems(data.lines);

            // Auto print after a short delay to ensure rendering
            setTimeout(() => {
                window.print();
            }, 1000);

        } catch (error) {
            console.error('Error:', error);
            alert('เกิดข้อผิดพลาดในการโหลดข้อมูล: ' + error.message);
        }
    }

    fetchData();
})();
