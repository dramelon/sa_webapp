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

    const emptyStateMessageEl = emptyState ? emptyState.querySelector('p') : null;
    const defaultEmptyStateText = emptyStateMessageEl ? emptyStateMessageEl.textContent : '';

    const DEFAULT_STATUS_OPTIONS = [
        { id: 'draft', label: 'ร่าง' },
        { id: 'submitted', label: 'ส่งคำขอ' },
        { id: 'approved', label: 'อนุมัติแล้ว' },
        { id: 'closed', label: 'ปิดคำขอ' },
        { id: 'cancelled', label: 'ยกเลิก' },
    ];

    let modelRoot = '';
    let eventInfo = null;
    let documents = [];
    let categories = [];
    let summaryData = { total: 0, by_status: {} };
    let statusOptions = [...DEFAULT_STATUS_OPTIONS];
    let statusLabels = buildStatusLabels(statusOptions);

    let activeCategory = 'all';
    let activeStatus = 'all';
    let searchTerm = '';
    let hasLoadError = false;
    let loadErrorMessage = '';

    function buildStatusLabels(options) {
        const map = {};
        options.forEach((option) => {
            if (!option) {
                return;
            }
            const key = typeof option.id === 'string' ? option.id.toLowerCase() : String(option.id || '').toLowerCase();
            if (!key) {
                return;
            }
            const label = option.label || option.name || option.title || option.id || key;
            map[key] = label;
        });
        return map;
    }

    function setStatusOptions(options) {
        const combined = Array.isArray(options) ? options : [];
        const map = new Map();
        [...DEFAULT_STATUS_OPTIONS, ...statusOptions, ...combined].forEach((option) => {
            if (!option) {
                return;
            }
            const rawId = option.id !== undefined ? option.id : option.value;
            const id = typeof rawId === 'string' ? rawId.toLowerCase() : String(rawId || '').toLowerCase();
            if (!id) {
                return;
            }
            const label = option.label || option.name || option.title || option.id || id;
            if (map.has(id)) {
                const current = map.get(id);
                if (!current.label && label) {
                    current.label = label;
                }
                map.set(id, current);
                return;
            }
            map.set(id, { id, label });
        });
        statusOptions = Array.from(map.values());
        statusLabels = buildStatusLabels(statusOptions);
        renderStatusFilter();
    }

    function normalizeDocuments(list) {
        if (!Array.isArray(list)) {
            return { documents: [], additionalStatuses: [] };
        }
        const additionalStatuses = [];
        const normalized = list
            .map((item) => {
                const statusKey = typeof item.status === 'string' ? item.status.toLowerCase() : String(item.status || '').toLowerCase();
                const statusLabel = item.status_label || statusLabels[statusKey] || item.status || statusKey;
                if (statusKey && !statusLabels[statusKey]) {
                    additionalStatuses.push({ id: statusKey, label: statusLabel || statusKey });
                }
                const id = item.id || item.document_id || `request:${Math.random().toString(16).slice(2)}`;
                const title = item.title || item.request_name || item.reference || `คำขอ #${item.document_id || ''}`;
                const reference = item.reference || '';
                const ownerName = item.owner_name || item.owner_label || '';
                const lineCount = typeof item.line_count === 'number'
                    ? item.line_count
                    : Array.isArray(item.lines)
                        ? item.lines.length
                        : 0;
                const totalQuantity = typeof item.total_quantity === 'number'
                    ? item.total_quantity
                    : Number.isFinite(Number.parseFloat(item.total_quantity))
                        ? Number.parseFloat(item.total_quantity)
                        : 0;
                return {
                    id,
                    document_id: item.document_id || item.id || id,
                    category: (item.category || 'item-request').toLowerCase(),
                    type: (item.type || 'item-request').toLowerCase(),
                    type_label: item.type_label || 'คำขอเบิกอุปกรณ์',
                    title,
                    reference,
                    status: statusKey,
                    status_label: statusLabel || statusKey || '—',
                    owner_id: item.owner_id ?? null,
                    owner_name: ownerName,
                    owner_label: item.owner_label || ownerName,
                    created_at: item.created_at || item.createdAt || null,
                    updated_at: item.updated_at || item.updatedAt || null,
                    updated_by_id: item.updated_by_id ?? null,
                    updated_by_name: item.updated_by_name || '',
                    updated_by_label: item.updated_by_label || item.updated_by_name || '',
                    line_count: lineCount,
                    total_quantity: totalQuantity,
                    lines: Array.isArray(item.lines) ? item.lines : [],
                };
            })
            .sort((a, b) => {
                const aDate = parseTimestamp(a.updated_at || a.created_at);
                const bDate = parseTimestamp(b.updated_at || b.created_at);
                return bDate - aDate;
            });

        return { documents: normalized, additionalStatuses };
    }

    function parseTimestamp(value) {
        if (!value) {
            return 0;
        }
        const time = new Date(value).getTime();
        if (Number.isNaN(time)) {
            return 0;
        }
        return time;
    }

    function buildCategories(list, docs) {
        const dataset = Array.isArray(list) ? list : [];
        const seen = new Set();
        const result = [];

        dataset.forEach((category) => {
            if (!category) {
                return;
            }
            const rawId = category.id !== undefined ? category.id : category.category;
            const id = typeof rawId === 'string' ? rawId.toLowerCase() : String(rawId || '').toLowerCase();
            if (!id || seen.has(id)) {
                return;
            }
            const label = category.label || category.name || id;
            const description = category.description || '';
            let total = Number.isFinite(category.total) ? Number(category.total) : null;
            if (total === null) {
                total = id === 'all'
                    ? docs.length
                    : docs.filter((doc) => doc.category === id).length;
            }
            result.push({ id, label, description, total });
            seen.add(id);
        });

        if (!seen.has('all')) {
            result.unshift({
                id: 'all',
                label: 'เอกสารทั้งหมด',
                description: 'รวมเอกสารทุกประเภทของอีเว้นนี้',
                total: docs.length,
            });
        } else {
            result.forEach((category) => {
                if (category.id === 'all') {
                    category.total = docs.length;
                }
            });
        }

        if (!seen.has('item-request') && docs.some((doc) => doc.category === 'item-request')) {
            result.push({
                id: 'item-request',
                label: 'คำขอเบิกอุปกรณ์',
                description: 'รายการคำขอเบิกอุปกรณ์และวัสดุสำหรับอีเว้นนี้',
                total: docs.filter((doc) => doc.category === 'item-request').length,
            });
        }

        return result;
    }

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

    function updateEventHeading() {
        if (!eventTitle) {
            return;
        }
        if (eventInfo) {
            const code = formatEventCode(eventInfo.event_code || eventInfo.event_id);
            const name = (eventInfo.event_name || '').trim();
            if (name && code) {
                eventTitle.textContent = `เอกสารของอีเว้น ${name} (${code})`;
                return;
            }
            if (name) {
                eventTitle.textContent = `เอกสารของอีเว้น ${name}`;
                return;
            }
            if (code) {
                eventTitle.textContent = `เอกสารของอีเว้น ${code}`;
                return;
            }
        }
        if (eventId) {
            const formatted = formatEventCode(eventId) || String(eventId).trim();
            eventTitle.textContent = formatted ? `เอกสารของอีเว้น ${formatted}` : 'เอกสารของอีเว้น';
            return;
        }
        eventTitle.textContent = 'เอกสารของอีเว้น';
    }

    function updateThaiDate() {
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
            return '—';
        }
        const day = dt.getDate();
        const monthNames = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
        const month = monthNames[dt.getMonth()];
        const year = dt.getFullYear() + 543;
        const time = dt.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false });
        return `${day} ${month} ${year} • ${time}`;
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
            return documents.length;
        }
        return documents.filter((doc) => doc.category === categoryId).length;
    }

    function computeSummaryMetrics() {
        const metrics = [];
        const total = typeof summaryData.total === 'number' ? summaryData.total : documents.length;
        metrics.push({ id: 'total', label: 'เอกสารทั้งหมด', value: total });
        statusOptions.forEach((status) => {
            const value = summaryData.by_status && Object.prototype.hasOwnProperty.call(summaryData.by_status, status.id)
                ? summaryData.by_status[status.id]
                : documents.filter((doc) => doc.status === status.id).length;
            metrics.push({ id: `status-${status.id}`, label: status.label, value });
        });
        return metrics;
    }

    function renderSummaryCards() {
        if (!summaryContainer) {
            return;
        }
        summaryContainer.innerHTML = '';
        if (hasLoadError) {
            const message = document.createElement('p');
            message.className = 'doc-summary-error';
            message.textContent = loadErrorMessage || 'ไม่สามารถโหลดข้อมูลสรุปได้';
            summaryContainer.appendChild(message);
            return;
        }
        const metrics = computeSummaryMetrics();
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

    function renderStatusFilter() {
        if (!statusFilter) {
            return;
        }
        const previous = statusFilter.value || activeStatus || 'all';
        statusFilter.innerHTML = '';
        const allOption = document.createElement('option');
        allOption.value = 'all';
        allOption.textContent = 'สถานะทั้งหมด';
        statusFilter.appendChild(allOption);
        statusOptions.forEach((status) => {
            const option = document.createElement('option');
            option.value = status.id;
            option.textContent = status.label;
            statusFilter.appendChild(option);
        });
        const values = Array.from(statusFilter.options).map((option) => option.value);
        if (values.includes(previous)) {
            statusFilter.value = previous;
            activeStatus = previous;
        } else {
            statusFilter.value = 'all';
            activeStatus = 'all';
        }
    }

    function renderCategories() {
        if (!categoryList) {
            return;
        }
        categoryList.innerHTML = '';
        if (!categories.length) {
            const emptyItem = document.createElement('li');
            emptyItem.className = 'doc-category-empty';
            emptyItem.textContent = hasLoadError
                ? 'ไม่สามารถโหลดหมวดหมู่เอกสารได้'
                : 'ไม่มีหมวดหมู่เอกสาร';
            categoryList.appendChild(emptyItem);
            return;
        }
        categories.forEach((category) => {
            const categoryId = typeof category.id === 'string' ? category.id.toLowerCase() : String(category.id || '').toLowerCase();
            const item = document.createElement('li');
            item.className = 'doc-category-item';

            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'doc-category';
            button.dataset.category = categoryId;
            const isActive = categoryId === activeCategory;
            button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
            if (isActive) {
                button.classList.add('active');
            }

            const headerWrap = document.createElement('span');
            headerWrap.className = 'doc-category-header';

            const label = document.createElement('span');
            label.className = 'doc-category-label';
            label.textContent = category.label || categoryId;

            const count = document.createElement('span');
            count.className = 'doc-category-count';
            count.textContent = computeCategoryCount(categoryId).toLocaleString('th-TH');

            headerWrap.append(label, count);

            const description = document.createElement('span');
            description.className = 'doc-category-description';
            description.textContent = category.description || '';

            button.append(headerWrap, description);
            button.addEventListener('click', () => {
                if (activeCategory === categoryId) {
                    return;
                }
                activeCategory = categoryId;
                renderCategories();
                renderDocuments();
            });

            item.appendChild(button);
            categoryList.appendChild(item);
        });
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

    function matchesSearch(doc) {
        if (!searchTerm) {
            return true;
        }
        const keyword = searchTerm.trim().toLowerCase();
        if (!keyword) {
            return true;
        }
        const fields = [
            doc.title,
            doc.reference,
            doc.owner_name,
            doc.owner_label,
            doc.type_label,
            doc.updated_by_name,
            doc.updated_by_label,
        ];
        if (Array.isArray(doc.lines)) {
            doc.lines.forEach((line) => {
                fields.push(line.item_name, line.item_reference);
            });
        }
        return fields.some((field) => String(field || '').toLowerCase().includes(keyword));
    }

    function hideEmptyState() {
        if (!emptyState) {
            return;
        }
        emptyState.hidden = true;
        resetEmptyStateMessage();
    }

    function showEmptyState(message) {
        if (!emptyState) {
            return;
        }
        if (emptyStateMessageEl) {
            emptyStateMessageEl.textContent = message || defaultEmptyStateText;
        }
        emptyState.hidden = false;
    }

    function resetEmptyStateMessage() {
        if (emptyStateMessageEl) {
            emptyStateMessageEl.textContent = defaultEmptyStateText;
        }
    }

    function showDefaultEmptyState() {
        resetEmptyStateMessage();
        showEmptyState();
    }

    function renderDocuments() {
        if (!tableBody || !emptyState) {
            return;
        }
        if (hasLoadError) {
            showEmptyState(loadErrorMessage || 'ไม่สามารถโหลดข้อมูลเอกสารได้');
            return;
        }
        tableBody.innerHTML = '';
        const filtered = documents.filter((doc) => matchesCategory(doc) && matchesStatus(doc) && matchesSearch(doc));
        if (!filtered.length) {
            showDefaultEmptyState();
            return;
        }
        hideEmptyState();
        filtered.forEach((doc) => {
            const row = document.createElement('tr');

            const documentCell = document.createElement('td');
            documentCell.className = 'doc-table-title-cell';
            const title = document.createElement('p');
            title.className = 'doc-table-title';
            title.textContent = doc.title || doc.reference || `คำขอ #${doc.document_id}`;
            const meta = document.createElement('p');
            meta.className = 'doc-table-meta';
            const metaParts = [];
            if (doc.reference) {
                metaParts.push(`รหัส: ${doc.reference}`);
            }
            const ownerDisplay = doc.owner_name || doc.owner_label;
            if (ownerDisplay) {
                metaParts.push(`ผู้สร้าง: ${ownerDisplay}`);
            }
            const lineCountText = typeof doc.line_count === 'number'
                ? doc.line_count.toLocaleString('th-TH')
                : String(doc.line_count || '0');
            metaParts.push(`จำนวนรายการ: ${lineCountText}`);
            if (typeof doc.total_quantity === 'number' && doc.total_quantity > 0) {
                metaParts.push(`จำนวนรวม: ${doc.total_quantity.toLocaleString('th-TH')}`);
            }
            meta.textContent = metaParts.join(' • ');
            documentCell.append(title, meta);

            const typeCell = document.createElement('td');
            typeCell.textContent = doc.type_label || 'เอกสาร';

            const statusCell = document.createElement('td');
            const status = document.createElement('span');
            status.className = 'status-chip doc-status';
            status.dataset.status = doc.status;
            status.textContent = statusLabels[doc.status] || doc.status_label || doc.status || '—';
            statusCell.appendChild(status);

            const updatedCell = document.createElement('td');
            const updatedSource = doc.updated_at || doc.created_at;
            updatedCell.textContent = formatDateTime(updatedSource);

            const actionCell = document.createElement('td');
            actionCell.className = 'col-actions';
            const actionButton = document.createElement('button');
            actionButton.type = 'button';
            actionButton.className = 'ghost doc-action';
            actionButton.textContent = 'เปิดดู';
            actionButton.addEventListener('click', () => {
                openDocument(doc);
            });
            actionCell.appendChild(actionButton);

            row.append(documentCell, typeCell, statusCell, updatedCell, actionCell);
            tableBody.appendChild(row);
        });
    }

    function openDocument(doc) {
        if (!doc) {
            return;
        }
        const statusLabel = statusLabels[doc.status] || doc.status_label || doc.status || '';
        const lines = Array.isArray(doc.lines) ? doc.lines : [];
        const lineTexts = lines.length
            ? lines
                  .map((line) => {
                      const itemName = line.item_name || `สินค้า #${line.item_id}`;
                      const reference = line.item_reference ? ` (${line.item_reference})` : '';
                      const quantityValue = typeof line.quantity_requested === 'number'
                          ? line.quantity_requested
                          : Number.parseFloat(line.quantity_requested);
                      const quantityText = Number.isFinite(quantityValue)
                          ? quantityValue.toLocaleString('th-TH')
                          : String(line.quantity_requested ?? '');
                      const unit = line.uom ? ` ${line.uom}` : '';
                      return `• ${itemName}${reference}: ${quantityText}${unit}`;
                  })
                  .join('\n')
            : '• ไม่มีรายการสินค้า';
        const totalQuantityText = typeof doc.total_quantity === 'number'
            ? doc.total_quantity.toLocaleString('th-TH')
            : String(doc.total_quantity || '0');
        const messageParts = [
            `คำขอ: ${doc.title || doc.reference || doc.document_id}`,
            doc.reference ? `รหัสคำขอ: ${doc.reference}` : null,
            statusLabel ? `สถานะ: ${statusLabel}` : null,
            `จำนวนรายการ: ${typeof doc.line_count === 'number' ? doc.line_count.toLocaleString('th-TH') : doc.line_count}`,
            `จำนวนรวม: ${totalQuantityText}`,
            '',
            'รายละเอียดสินค้า:',
            lineTexts,
        ].filter(Boolean);
        alert(messageParts.join('\n'));
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
                searchTerm = '';
                activeStatus = 'all';
                activeCategory = categories.some((category) => category.id === 'all') ? 'all' : categories[0]?.id || 'all';
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

    function showLoading() {
        if (tableBody) {
            tableBody.innerHTML = '';
        }
        showEmptyState('กำลังโหลดข้อมูล...');
    }

    function setLoadError(message) {
        hasLoadError = true;
        loadErrorMessage = message;
        if (tableBody) {
            tableBody.innerHTML = '';
        }
        showEmptyState(message);
        summaryData = { total: 0, by_status: {} };
        documents = [];
        categories = [];
        renderSummaryCards();
        renderCategories();
    }

    function clearLoadError() {
        hasLoadError = false;
        loadErrorMessage = '';
        resetEmptyStateMessage();
    }

    function normalizeSummary(summary, docs) {
        const normalized = { total: docs.length, by_status: {} };
        if (summary && typeof summary === 'object') {
            if (typeof summary.total === 'number') {
                normalized.total = summary.total;
            }
            if (summary.by_status && typeof summary.by_status === 'object') {
                normalized.by_status = { ...summary.by_status };
            }
        }
        if (!Object.keys(normalized.by_status).length) {
            docs.forEach((doc) => {
                if (!doc.status) {
                    return;
                }
                normalized.by_status[doc.status] = (normalized.by_status[doc.status] || 0) + 1;
            });
        } else {
            docs.forEach((doc) => {
                if (!doc.status) {
                    return;
                }
                if (!Object.prototype.hasOwnProperty.call(normalized.by_status, doc.status)) {
                    normalized.by_status[doc.status] = 0;
                }
            });
        }
        return normalized;
    }

    function applyDataset(payload) {
        eventInfo = payload?.event || null;
        updateEventHeading();

        const payloadStatuses = Array.isArray(payload?.statuses) ? payload.statuses : [];
        setStatusOptions(payloadStatuses.length ? payloadStatuses : statusOptions);

        const normalizedDocs = normalizeDocuments(Array.isArray(payload?.documents) ? payload.documents : []);
        if (normalizedDocs.additionalStatuses.length) {
            setStatusOptions([...statusOptions, ...normalizedDocs.additionalStatuses]);
        }
        documents = normalizedDocs.documents;

        summaryData = normalizeSummary(payload?.summary, documents);
        categories = buildCategories(payload?.categories, documents);
        if (!categories.some((category) => category.id === activeCategory)) {
            activeCategory = categories[0]?.id || 'all';
        }

        renderSummaryCards();
        renderCategories();
        renderDocuments();
    }

    async function loadDocuments() {
        if (!modelRoot) {
            return;
        }
        if (!eventId) {
            setLoadError('ไม่พบอีเว้นที่ต้องการดูเอกสาร');
            return;
        }
        showLoading();
        try {
            const response = await fetch(`${modelRoot}/event_documents.php?event_id=${encodeURIComponent(eventId)}`, {
                credentials: 'same-origin',
            });
            if (!response.ok) {
                let message = 'ไม่สามารถโหลดข้อมูลเอกสารของอีเว้นนี้ได้';
                try {
                    const payload = await response.json();
                    if (payload?.message) {
                        message = payload.message;
                    }
                } catch (error) {
                    // ignore
                }
                throw new Error(message);
            }
            const payload = await response.json();
            clearLoadError();
            applyDataset(payload);
        } catch (error) {
            console.error(error);
            setLoadError(error?.message || 'ไม่สามารถโหลดข้อมูลเอกสารของอีเว้นนี้ได้');
        }
    }

    function boot({ root }) {
        modelRoot = `${root}/Model`;
        updateThaiDate();
        setInterval(updateThaiDate, 60_000);
        resolveBackLinks();
        updateEventHeading();
        bindFilters();
        renderStatusFilter();
        if (eventId) {
            loadDocuments();
        } else {
            setLoadError('ไม่พบอีเว้นที่ต้องการดูเอกสาร');
        }
    }

    if (typeof window.onAppReady === 'function') {
        window.onAppReady(boot);
    }
})();