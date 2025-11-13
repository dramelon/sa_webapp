(function () {
    const summaryContainer = document.getElementById('documentSummaryCards');
    const categoryList = document.getElementById('docCategoryList');
    const searchInput = document.getElementById('docSearchInput');
    const statusFilter = document.getElementById('docStatusFilter');
    const resetFiltersBtn = document.getElementById('docResetFilters');
    const tableBody = document.getElementById('documentTableBody');
    const emptyState = document.getElementById('docEmptyState');
    const eventTitle = document.getElementById('eventTitle');
    const eventBackLink = document.getElementById('eventBackLink');
    const backButton = document.getElementById('btnBackToEvent');
    const pageDate = document.getElementById('pageDate');

    const params = new URLSearchParams(window.location.search);
    const eventId = params.get('event_id');

    const documentCategories = [
        { id: 'all', label: 'เอกสารทั้งหมด', description: 'รวมเอกสารทุกประเภทของอีเว้นนี้' },
        { id: 'event', label: 'Event Documents', description: 'บันทึกทั่วไป ไทม์ไลน์ และไฟล์แนบอื่น ๆ' },
        { id: 'item-request', label: 'Item Requests', description: 'คำขอเบิกอุปกรณ์และวัสดุจากคลัง' },
        { id: 'rfq', label: 'RFQs', description: 'คำขอใบเสนอราคาเพื่อจัดหาสินค้าหรือบริการ' },
        { id: 'quotation', label: 'Quotations', description: 'ใบเสนอราคาที่ได้รับจากผู้ขาย' },
        { id: 'po', label: 'Purchase Orders', description: 'ใบสั่งซื้อที่อนุมัติแล้ว' },
        { id: 'other', label: 'Other Attachments', description: 'ไฟล์อื่น ๆ ที่เกี่ยวข้อง เช่น รูปภาพหรือบันทึก' },
    ];

    const statusLabels = {
        draft: 'ร่าง',
        waiting: 'รอดำเนินการ',
        approved: 'อนุมัติแล้ว',
        rejected: 'ถูกปฏิเสธ',
    };

    const documentRows = [
        {
            id: 'DOC-2405-001',
            title: 'เอกสารสรุปขอบเขตงาน',
            reference: 'EV-DOC-001',
            category: 'event',
            typeLabel: 'Event Document',
            status: 'approved',
            owner: 'ศิริพร คงสุข',
            updatedAt: '2024-05-21T09:45:00+07:00',
        },
        {
            id: 'REQ-2405-014',
            title: 'ใบขอรายการอุปกรณ์เวที',
            reference: 'IR-2405-014',
            category: 'item-request',
            typeLabel: 'Item Request',
            status: 'waiting',
            owner: 'ปกรณ์ วัฒนชัย',
            updatedAt: '2024-05-22T14:20:00+07:00',
        },
        {
            id: 'REQ-2405-018',
            title: 'ใบขอวัสดุงานแสงและเสียง',
            reference: 'IR-2405-018',
            category: 'item-request',
            typeLabel: 'Item Request',
            status: 'draft',
            owner: 'ฐปนีย์ พงศ์ธนา',
            updatedAt: '2024-05-23T08:10:00+07:00',
        },
        {
            id: 'RFQ-2405-004',
            title: 'RFQ ระบบไฟส่องเวที',
            reference: 'RFQ-2405-004',
            category: 'rfq',
            typeLabel: 'Request for Quotation',
            status: 'waiting',
            owner: 'สุธีร์ เจริญกิจ',
            updatedAt: '2024-05-20T16:00:00+07:00',
        },
        {
            id: 'QUO-2405-002',
            title: 'ใบเสนอราคาจาก Bangkok AV',
            reference: 'QUO-2405-002',
            category: 'quotation',
            typeLabel: 'Quotation',
            status: 'approved',
            owner: 'สำนักจัดซื้อ',
            updatedAt: '2024-05-22T11:35:00+07:00',
        },
        {
            id: 'PO-2405-001',
            title: 'ใบสั่งซื้อระบบเสียง',
            reference: 'PO-2405-001',
            category: 'po',
            typeLabel: 'Purchase Order',
            status: 'approved',
            owner: 'สำนักจัดซื้อ',
            updatedAt: '2024-05-24T10:05:00+07:00',
        },
        {
            id: 'DOC-2405-002',
            title: 'บันทึกข้อตกลงกับลูกค้า',
            reference: 'EV-DOC-002',
            category: 'event',
            typeLabel: 'Event Document',
            status: 'waiting',
            owner: 'วรรษมน โชติอนันต์',
            updatedAt: '2024-05-23T17:20:00+07:00',
        },
        {
            id: 'ATT-2405-009',
            title: 'แบบแปลนพื้นที่จัดงาน (PDF)',
            reference: 'ATT-2405-009',
            category: 'other',
            typeLabel: 'Attachment',
            status: 'approved',
            owner: 'ทีมออกแบบสถานที่',
            updatedAt: '2024-05-19T13:15:00+07:00',
        },
    ];

    let activeCategory = 'all';
    let activeStatus = 'all';
    let searchTerm = '';

    function formatEventCode(value) {
        if (value === null || value === undefined) {
            return null;
        }
        const text = String(value).trim();
        if (!text) {
            return null;
        }
        return text.startsWith('EV-') ? text : `EV-${text}`;
    }

    function updateThaiDate() {
        if (!pageDate) {
            return;
        }
        const now = new Date();
        const days = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
        const months = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
        const day = days[now.getDay()];
        const date = now.getDate();
        const month = months[now.getMonth()];
        const year = now.getFullYear() + 543;
        const time = now.toLocaleTimeString('th-TH', { hour12: false });
        pageDate.textContent = `วัน${day}ที่ ${date} ${month} ${year} เวลา ${time}`;
    }

    function formatDateTime(value) {
        if (!value) {
            return '—';
        }
        const dt = new Date(value);
        if (Number.isNaN(dt.getTime())) {
            return value;
        }
        const day = dt.getDate();
        const monthNames = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
        const month = monthNames[dt.getMonth()];
        const year = dt.getFullYear() + 543;
        const time = dt.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false });
        return `${day} ${month} ${year} • ${time}`;
    }

    function resolveEventHeading() {
        if (!eventTitle) {
            return;
        }
        if (eventId) {
            const formatted = formatEventCode(eventId) || String(eventId).trim();
            eventTitle.textContent = `เอกสารของอีเว้น ${formatted}`;
        } else {
            eventTitle.textContent = 'เอกสารของอีเว้น';
        }
    }

    function resolveBackLinks() {
        const fallback = './events.html';
        const target = eventId ? `./event_manage.html?event_id=${encodeURIComponent(eventId)}` : fallback;
        if (eventBackLink) {
            eventBackLink.href = target;
        }
        if (backButton) {
            backButton.addEventListener('click', () => {
                window.location.href = target;
            });
        }
    }

    function computeCategoryCount(categoryId) {
        if (categoryId === 'all') {
            return documentRows.length;
        }
        return documentRows.filter((doc) => doc.category === categoryId).length;
    }

    function renderCategories() {
        if (!categoryList) {
            return;
        }
        categoryList.innerHTML = '';
        documentCategories.forEach((category) => {
            const item = document.createElement('li');
            item.className = 'doc-category-item';

            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'doc-category';
            button.dataset.category = category.id;
            button.setAttribute('aria-pressed', category.id === activeCategory ? 'true' : 'false');
            if (category.id === activeCategory) {
                button.classList.add('active');
            }

            const label = document.createElement('span');
            label.className = 'doc-category-label';
            label.textContent = category.label;

            const count = document.createElement('span');
            count.className = 'doc-category-count';
            count.textContent = computeCategoryCount(category.id);

            const headerWrap = document.createElement('span');
            headerWrap.className = 'doc-category-header';
            headerWrap.append(label, count);

            const description = document.createElement('span');
            description.className = 'doc-category-description';
            description.textContent = category.description;

            button.append(headerWrap, description);
            button.addEventListener('click', () => {
                if (activeCategory === category.id) {
                    return;
                }
                activeCategory = category.id;
                renderCategories();
                renderDocuments();
            });

            item.appendChild(button);
            categoryList.appendChild(item);
        });
    }

    function computeSummaryMetrics() {
        const total = documentRows.length;
        const pending = documentRows.filter((doc) => doc.status === 'waiting').length;
        const approved = documentRows.filter((doc) => doc.status === 'approved').length;
        return [
            { id: 'total', label: 'เอกสารทั้งหมด', value: total },
            { id: 'pending', label: 'รอดำเนินการ', value: pending },
            { id: 'approved', label: 'อนุมัติแล้ว', value: approved },
        ];
    }

    function renderSummaryCards() {
        if (!summaryContainer) {
            return;
        }
        const metrics = computeSummaryMetrics();
        summaryContainer.innerHTML = '';
        metrics.forEach((metric) => {
            const card = document.createElement('article');
            card.className = 'summary-card doc-summary-card';
            card.setAttribute('data-metric', metric.id);

            const header = document.createElement('header');
            header.textContent = metric.label;

            const value = document.createElement('strong');
            value.textContent = metric.value.toLocaleString('th-TH');

            card.append(header, value);
            summaryContainer.appendChild(card);
        });
    }

    function matchesSearch(doc, keyword) {
        if (!keyword) {
            return true;
        }
        const safeKeyword = keyword.trim().toLowerCase();
        if (!safeKeyword) {
            return true;
        }
        const fields = [doc.title, doc.reference, doc.owner, doc.typeLabel];
        return fields.some((field) => String(field || '').toLowerCase().includes(safeKeyword));
    }

    function matchesCategory(doc) {
        if (activeCategory === 'all') {
            return true;
        }
        return doc.category === activeCategory;
    }

    function matchesStatus(doc) {
        if (activeStatus === 'all') {
            return true;
        }
        return doc.status === activeStatus;
    }

    function renderDocuments() {
        if (!tableBody || !emptyState) {
            return;
        }
        const filtered = documentRows.filter((doc) => matchesCategory(doc) && matchesStatus(doc) && matchesSearch(doc, searchTerm));
        tableBody.innerHTML = '';
        if (!filtered.length) {
            emptyState.hidden = false;
            return;
        }
        emptyState.hidden = true;
        filtered.forEach((doc) => {
            const row = document.createElement('tr');

            const documentCell = document.createElement('td');
            documentCell.className = 'doc-table-title-cell';
            const title = document.createElement('p');
            title.className = 'doc-table-title';
            title.textContent = doc.title;
            const meta = document.createElement('p');
            meta.className = 'doc-table-meta';
            meta.textContent = `รหัส: ${doc.reference} • ผู้รับผิดชอบ: ${doc.owner}`;
            documentCell.append(title, meta);

            const typeCell = document.createElement('td');
            typeCell.textContent = doc.typeLabel;

            const statusCell = document.createElement('td');
            const status = document.createElement('span');
            status.className = 'status-chip doc-status';
            status.dataset.status = doc.status;
            status.textContent = statusLabels[doc.status] || doc.status;
            statusCell.appendChild(status);

            const updatedCell = document.createElement('td');
            updatedCell.textContent = formatDateTime(doc.updatedAt);

            const actionCell = document.createElement('td');
            actionCell.className = 'col-actions';
            const actionButton = document.createElement('button');
            actionButton.type = 'button';
            actionButton.className = 'ghost doc-action';
            actionButton.textContent = 'เปิดดู';
            actionButton.addEventListener('click', () => {
                const message = `ตัวอย่างเอกสาร: ${doc.title}\nรหัสเอกสาร: ${doc.reference}`;
                alert(message);
            });
            actionCell.appendChild(actionButton);

            row.append(documentCell, typeCell, statusCell, updatedCell, actionCell);
            tableBody.appendChild(row);
        });
    }

    function bindFilters() {
        if (searchInput) {
            searchInput.addEventListener('input', (event) => {
                searchTerm = event.target.value || '';
                renderDocuments();
            });
        }
        if (statusFilter) {
            statusFilter.addEventListener('change', (event) => {
                activeStatus = event.target.value || 'all';
                renderDocuments();
            });
        }
        if (resetFiltersBtn) {
            resetFiltersBtn.addEventListener('click', () => {
                activeCategory = 'all';
                activeStatus = 'all';
                searchTerm = '';
                if (searchInput) {
                    searchInput.value = '';
                }
                if (statusFilter) {
                    statusFilter.value = 'all';
                }
                renderCategories();
                renderDocuments();
            });
        }
    }

    function init() {
        updateThaiDate();
        setInterval(updateThaiDate, 60_000);
        resolveEventHeading();
        resolveBackLinks();
        renderSummaryCards();
        renderCategories();
        renderDocuments();
        bindFilters();
    }

    init();
})();
