(function () {
    const groupsContainer = document.getElementById('quotationGroups');
    const emptyState = document.getElementById('emptyState');
    const eventBackLink = document.getElementById('eventBackLink');
    const pageTitle = document.getElementById('pageTitle');
    const pageDate = document.getElementById('pageDate');

    const params = new URLSearchParams(window.location.search);
    const eventId = params.get('event_id');
    const returnTo = params.get('return_to');

    let quotations = [];
    let modelRoot = '';
    let eventInfo = null;

    const updateThaiDate = () => {
        if (!pageDate) return;
        const now = new Date();
        const days = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
        const months = [
            'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
            'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
        ];
        const day = days[now.getDay()];
        const date = now.getDate();
        const month = months[now.getMonth()];
        const year = now.getFullYear() + 543;
        const time = now.toLocaleTimeString('th-TH', { hour12: false });
        pageDate.textContent = `วัน${day}ที่ ${date} ${month} ${year} เวลา ${time}`;
    };

    function formatDateTime(value) {
        if (!value) return '—';
        const dt = new Date(value);
        if (Number.isNaN(dt.getTime())) return '—';
        const day = dt.getDate();
        const monthNames = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
        const month = monthNames[dt.getMonth()];
        const year = dt.getFullYear() + 543;
        const time = dt.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false });
        return `${day} ${month} ${year} • ${time}`;
    }

    function formatCurrency(amount) {
        if (amount === null || amount === undefined) return '—';
        return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(amount);
    }

    function renderQuotations() {
        if (!groupsContainer) return;
        groupsContainer.innerHTML = '';

        if (quotations.length === 0) {
            emptyState.hidden = false;
            return;
        }

        emptyState.hidden = true;

        // Group by RFQ
        const groups = {};
        quotations.forEach(q => {
            const rfqId = q.supplier_rfq_id;
            if (!groups[rfqId]) {
                groups[rfqId] = {
                    rfq_id: rfqId,
                    rfq_title: q.rfq_title,
                    items: []
                };
            }
            groups[rfqId].items.push(q);
        });

        // Render Groups
        Object.values(groups).forEach(group => {
            const section = document.createElement('section');
            section.className = 'list-panel';
            section.style.marginBottom = '2rem';

            // Header
            const header = document.createElement('header');
            header.className = 'list-toolbar';
            header.style.justifyContent = 'space-between';

            const titleGroup = document.createElement('div');
            titleGroup.style.display = 'flex';
            titleGroup.style.alignItems = 'center';
            titleGroup.style.gap = '1rem';

            const title = document.createElement('h3');
            title.style.margin = '0';
            title.textContent = group.rfq_title || `RFQ #${group.rfq_id}`;

            const rfqLink = document.createElement('a');
            rfqLink.className = 'btn btn-ghost btn-small';
            rfqLink.href = `./RFQ_detail.html?rfq_id=${group.rfq_id}`;
            rfqLink.innerHTML = '<span class="i link"></span> ไปที่ RFQ';

            titleGroup.append(title, rfqLink);
            header.appendChild(titleGroup);

            const actionsGroup = document.createElement('div');
            actionsGroup.className = 'toolbar-group';
            const reviewLink = document.createElement('a');
            reviewLink.className = 'btn btn-secondary btn-small';
            const params = new URLSearchParams();
            params.set('rfq_id', group.rfq_id);
            if (eventId) params.set('event_id', eventId);
            const returnUrl = encodeURIComponent(window.location.href);
            params.set('return_to', returnUrl);
            reviewLink.href = `./quotation_review.html?${params.toString()}`;
            reviewLink.innerHTML = '<span class="i chart"></span> ตรวจสอบราคา';
            actionsGroup.appendChild(reviewLink);
            header.appendChild(actionsGroup);
            section.appendChild(header);

            // Table
            const tableWrap = document.createElement('div');
            tableWrap.className = 'table-wrap';

            const table = document.createElement('table');
            table.className = 'event-table';

            const thead = document.createElement('thead');
            thead.innerHTML = `
                <tr>
                    <th scope="col">ใบเสนอราคา</th>
                    <th scope="col">ผู้ขาย</th>
                    <th scope="col">ยอดรวม (รวม VAT)</th>
                    <th scope="col">วันที่เสนอราคา</th>
                    <th scope="col">สถานะ</th>
                    <th scope="col" class="col-actions">การจัดการ</th>
                </tr>
            `;
            table.appendChild(thead);

            const tbody = document.createElement('tbody');
            group.items.forEach(q => {
                const row = document.createElement('tr');

                // Quotation Column
                const quoteCell = document.createElement('td');
                const quoteTitle = document.createElement('div');
                quoteTitle.style.fontWeight = '500';
                quoteTitle.textContent = q.title || 'ไม่มีชื่อ';
                const quoteRef = document.createElement('div');
                quoteRef.style.fontSize = '0.85em';
                quoteRef.style.color = 'var(--text-secondary)';
                quoteRef.textContent = q.ref_supplier_quotation_id || `ID: ${q.supplier_quotation_id}`;
                quoteCell.append(quoteTitle, quoteRef);

                // Supplier Column
                const supplierCell = document.createElement('td');
                supplierCell.textContent = q.supplier_name || '—';

                // Amount Column
                const amountCell = document.createElement('td');
                amountCell.textContent = formatCurrency(q.total_amount);

                // Date Column
                const dateCell = document.createElement('td');
                dateCell.textContent = formatDateTime(q.quotation_date);

                // Status Column
                const statusCell = document.createElement('td');
                const statusChip = document.createElement('span');
                statusChip.className = 'status-chip';
                statusChip.dataset.status = q.status;

                const statusMap = {
                    'submitted': 'ส่งคำขอ',
                    'pending': 'รออนุมัติ',
                    'approved': 'อนุมัติแล้ว',
                    'cancelled': 'ยกเลิก',
                    'closed': 'ปิดคำขอ'
                };
                statusChip.textContent = statusMap[q.status] || q.status;
                statusCell.appendChild(statusChip);

                // Actions Column
                const actionCell = document.createElement('td');
                actionCell.className = 'col-actions';
                const viewBtn = document.createElement('a');
                viewBtn.className = 'btn btn-ghost btn-small';
                const currentUrl = encodeURIComponent(window.location.href);
                viewBtn.href = `./quotation_detail.html?supplier_quotation_id=${q.supplier_quotation_id}&return_to=${currentUrl}`;
                viewBtn.textContent = 'เปิดดู';
                actionCell.appendChild(viewBtn);

                row.append(quoteCell, supplierCell, amountCell, dateCell, statusCell, actionCell);
                tbody.appendChild(row);
            });

            table.appendChild(tbody);
            tableWrap.appendChild(table);
            section.appendChild(tableWrap);

            groupsContainer.appendChild(section);
        });
    }

    async function fetchQuotations() {
        if (!eventId) return;

        try {
            const response = await fetch(`${modelRoot}/supplier_quotation_list.php?event_id=${eventId}`);
            if (!response.ok) throw new Error('Failed to fetch quotations');
            const data = await response.json();

            if (data.success) {
                quotations = data.data.quotations;
                eventInfo = data.data.event;

                if (eventInfo) {
                    pageTitle.textContent = `สรุปใบเสนอราคา - ${eventInfo.event_name}`;
                    if (eventBackLink) {
                        if (returnTo) {
                            eventBackLink.href = decodeURIComponent(returnTo);
                        } else {
                            eventBackLink.href = `./event_document_manage.html?event_id=${eventId}&category=quotation`;
                        }
                    }
                }

                renderQuotations();
            }
        } catch (error) {
            console.error('Error fetching quotations:', error);
        }
    }

    function init() {
        const root = document.documentElement.dataset.root || '../..';
        modelRoot = `${root}/Model`;

        updateThaiDate();
        setInterval(updateThaiDate, 60000);

        fetchQuotations();
    }

    init();
})();
