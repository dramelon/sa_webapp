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
    const globalMessage = document.getElementById('docGlobalMessage');
    const createRequestContainer = document.getElementById('docCreateRequestContainer');
    const createRequestButton = document.getElementById('btnCreateRequest');
    const requestModal = document.getElementById('requestModal');
    const requestForm = document.getElementById('requestForm');
    const requestNameInput = document.getElementById('requestNameInput');
    const requestEventName = document.getElementById('requestEventName');
    const requestEventCode = document.getElementById('requestEventCode');
    const requestFormMessage = document.getElementById('requestFormMessage');
    const requestLinesBody = document.getElementById('requestLinesBody');
    const requestLinesEmpty = document.getElementById('requestLinesEmpty');
    const addRequestLineButton = document.getElementById('addRequestLine');
    const requestSubmitButton = document.getElementById('requestSubmitButton');

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
    let isDatasetLoaded = false;
    let requestLineCounter = 0;
    let isRequestSubmitting = false;
    const itemSearchCache = new Map();

    let canCreateRequest = false;

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
        const target = eventId
            ? `./event_manage.html?event_id=${encodeURIComponent(eventId)}&from=document`
            : fallback;
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
                syncCreateRequestButtonState();
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
        syncCreateRequestButtonState();
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
        if (!doc || !doc.document_id) {
            return;
        }
        const params = new URLSearchParams();
        params.set('request_id', doc.document_id);
        if (eventId) {
            params.set('event_id', eventId);
        }
        window.location.href = `./item_request_detail.html?${params.toString()}`;
    }

    function setGlobalMessage(message, variant = 'info') {
        if (!globalMessage) {
            return;
        }
        const normalized = typeof message === 'string' ? message.trim() : '';
        globalMessage.classList.remove('success', 'error');
        if (!normalized) {
            globalMessage.hidden = true;
            globalMessage.textContent = '';
            return;
        }
        globalMessage.hidden = false;
        globalMessage.textContent = normalized;
        if (variant === 'success') {
            globalMessage.classList.add('success');
        } else if (variant === 'error') {
            globalMessage.classList.add('error');
        }
    }

    function clearGlobalMessage() {
        setGlobalMessage('');
    }

    function setCreateRequestEnabled(enabled) {
        canCreateRequest = Boolean(enabled);
        syncCreateRequestButtonState();
    }

    function syncCreateRequestButtonState() {
        const shouldShow = activeCategory === 'item-request' && !hasLoadError;
        if (createRequestContainer) {
            createRequestContainer.hidden = !shouldShow;
        }
        if (!createRequestButton) {
            return;
        }
        const isEnabled = shouldShow && canCreateRequest;
        createRequestButton.disabled = !isEnabled;
        if (isEnabled) {
            createRequestButton.removeAttribute('aria-disabled');
        } else {
            createRequestButton.setAttribute('aria-disabled', 'true');
        }
    }

    function syncRequestEventDetails() {
        if (requestEventName) {
            requestEventName.value = eventInfo?.event_name ? String(eventInfo.event_name) : '';
        }
        if (requestEventCode) {
            const parts = [];
            if (eventInfo?.event_code) {
                parts.push(String(eventInfo.event_code));
            }
            if (eventInfo?.event_id) {
                parts.push(`EV-${eventInfo.event_id}`);
            }
            requestEventCode.value = parts.length ? parts.join(' / ') : '';
        }
    }

    function formatItemDisplay(item) {
        if (!item) {
            return '';
        }
        const parts = [];
        if (item.ref_id) {
            parts.push(String(item.ref_id));
        }
        if (item.name) {
            parts.push(String(item.name));
        } else if (item.id) {
            parts.push(`สินค้า #${item.id}`);
        }
        const base = parts.length ? parts.join(' - ') : `สินค้า #${item.id ?? ''}`;
        return item.id ? `${base} (#${item.id})` : base;
    }

    async function searchItems(query) {
        const term = typeof query === 'string' ? query.trim() : '';
        if (!term) {
            return [];
        }
        const cacheKey = term.toLowerCase();
        if (itemSearchCache.has(cacheKey)) {
            return itemSearchCache.get(cacheKey);
        }
        if (!modelRoot) {
            return [];
        }
        try {
            const response = await fetch(`${modelRoot}/items_options.php?q=${encodeURIComponent(term)}`, {
                credentials: 'same-origin',
            });
            if (!response.ok) {
                throw new Error('search_failed');
            }
            const payload = await response.json();
            const results = Array.isArray(payload?.data) ? payload.data : [];
            itemSearchCache.set(cacheKey, results);
            return results;
        } catch (error) {
            console.error(error);
            itemSearchCache.set(cacheKey, []);
            return [];
        }
    }

    function openInstantItemCreate() {
        const targetUrl = './item_manage.html?mode=create';
        const newWindow = window.open(targetUrl, '_blank', 'noopener');
        if (newWindow) {
            newWindow.focus();
            setGlobalMessage('เปิดหน้าสร้างสินค้าใหม่ในแท็บใหม่แล้ว', 'info');
        } else {
            setGlobalMessage('กำลังเปลี่ยนไปหน้าสร้างสินค้าใหม่', 'info');
            window.location.href = targetUrl;
        }
    }

    function formatItemOptionMeta(item) {
        if (!item) {
            return '';
        }
        const parts = [];
        if (item.ref_id) {
            parts.push(`รหัส: ${item.ref_id}`);
        }
        if (item.category_name) {
            parts.push(`หมวด: ${item.category_name}`);
        }
        if (item.uom) {
            parts.push(`หน่วย: ${item.uom}`);
        }
        const rateText = formatItemRateDisplay(item);
        if (rateText) {
            parts.push(rateText);
        }
        return parts.join(' • ');
    }

    function formatRequestLineMeta(item) {
        if (!item) {
            return '';
        }
        const parts = [];
        if (item.ref_id) {
            parts.push(`รหัสสินค้า: ${item.ref_id}`);
        } else if (item.id) {
            parts.push(`รหัสสินค้า: #${item.id}`);
        }
        if (item.category_name) {
            parts.push(`หมวด: ${item.category_name}`);
        }
        return parts.join(' • ');
    }

    function formatItemRateDisplay(item) {
        if (!item) {
            return '';
        }
        const rateValue = item.rate != null ? Number.parseFloat(item.rate) : Number.NaN;
        const hasRate = Number.isFinite(rateValue);
        const period = typeof item.period === 'string' ? item.period.trim() : '';
        if (hasRate) {
            const formatted = rateValue.toLocaleString('th-TH', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            });
            return period ? `${formatted} / ${period}` : formatted;
        }
        return period || '';
    }

    function formatItemRateMeta(item) {
        if (!item) {
            return '';
        }
        const parts = [];
        if (item.uom) {
            parts.push(`หน่วย: ${item.uom}`);
        }
        if (item.brand) {
            parts.push(item.brand);
        }
        if (item.model) {
            parts.push(item.model);
        }
        return parts.join(' • ');
    }

    function createRequestItemTypeahead({ initialItem = null, onSelect, onClear } = {}) {
        const root = document.createElement('div');
        root.className = 'typeahead typeahead-inline request-item-typeahead';
        root.dataset.type = 'item';

        const inputWrap = document.createElement('div');
        inputWrap.className = 'typeahead-input';

        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'ค้นหาด้วยชื่อหรือรหัสสินค้า';
        input.autocomplete = 'off';
        input.className = 'request-line-input';
        inputWrap.appendChild(input);

        const list = document.createElement('div');
        list.className = 'typeahead-list';
        list.hidden = true;

        const hiddenInput = document.createElement('input');
        hiddenInput.type = 'hidden';
        hiddenInput.className = 'request-line-item-id';

        root.append(inputWrap, list, hiddenInput);

        let selectedItem = null;
        let fetchToken = 0;

        function closeList() {
            list.hidden = true;
            list.innerHTML = '';
        }

        function notifySelect(item) {
            if (typeof onSelect === 'function') {
                onSelect(item);
            }
        }

        function notifyClear() {
            if (typeof onClear === 'function') {
                onClear();
            }
        }

        function applySelection(item) {
            selectedItem = item && item.id ? item : null;
            if (selectedItem) {
                hiddenInput.value = String(selectedItem.id);
                input.value = formatItemDisplay(selectedItem);
                notifySelect(selectedItem);
            } else {
                hiddenInput.value = '';
                notifyClear();
            }
        }

        function buildOption(item) {
            const option = document.createElement('button');
            option.type = 'button';
            option.className = 'typeahead-option';
            const title = document.createElement('span');
            title.className = 'typeahead-option-title';
            title.textContent = formatItemDisplay(item);
            const meta = document.createElement('span');
            meta.className = 'typeahead-option-meta';
            meta.textContent = formatItemOptionMeta(item);
            option.append(title, meta);
            option.addEventListener('click', () => {
                applySelection(item);
                closeList();
            });
            return option;
        }

        function renderList(items) {
            list.innerHTML = '';
            const fragment = document.createDocumentFragment();
            items.forEach((item) => {
                fragment.append(buildOption(item));
            });
            const createOption = document.createElement('button');
            createOption.type = 'button';
            createOption.className = 'typeahead-option typeahead-option-create';
            createOption.textContent = '➕ สร้างสินค้าใหม่';
            createOption.addEventListener('click', () => {
                closeList();
                openInstantItemCreate();
            });
            fragment.append(createOption);
            list.append(fragment);
            list.hidden = list.children.length === 0;
        }

        input.addEventListener('input', (event) => {
            const term = event.target.value.trim();
            if (term.length < 1) {
                applySelection(null);
                closeList();
                return;
            }
            applySelection(null);
            const currentToken = ++fetchToken;
            searchItems(term).then((results) => {
                if (currentToken !== fetchToken) {
                    return;
                }
                renderList(results);
                if (list.children.length) {
                    list.hidden = false;
                }
            });
        });

        input.addEventListener('focus', () => {
            if (list.children.length) {
                list.hidden = false;
            }
        });

        input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                if (!list.hidden) {
                    const firstOption = list.querySelector('.typeahead-option');
                    if (firstOption) {
                        event.preventDefault();
                        firstOption.click();
                    }
                }
            } else if (event.key === 'Escape') {
                closeList();
            }
        });

        root.addEventListener('focusout', (event) => {
            if (!root.contains(event.relatedTarget)) {
                closeList();
            }
        });

        function getSelectedItem() {
            return selectedItem;
        }

        if (initialItem) {
            applySelection(initialItem);
        } else {
            notifyClear();
        }

        return {
            root,
            input,
            hiddenInput,
            closeList,
            getSelectedItem,
        };
    }

    function setRequestFormMessage(message, variant = 'error') {
        if (!requestFormMessage) {
            return;
        }
        const normalized = typeof message === 'string' ? message.trim() : '';
        requestFormMessage.classList.remove('success', 'error');
        if (!normalized) {
            requestFormMessage.hidden = true;
            requestFormMessage.textContent = '';
            return;
        }
        requestFormMessage.hidden = false;
        requestFormMessage.textContent = normalized;
        if (variant === 'success') {
            requestFormMessage.classList.add('success');
        } else if (variant === 'error') {
            requestFormMessage.classList.add('error');
        }
    }

    function setRequestFormBusy(busy) {
        if (requestSubmitButton) {
            const isBusy = Boolean(busy);
            requestSubmitButton.disabled = isBusy;
            if (isBusy) {
                requestSubmitButton.setAttribute('aria-disabled', 'true');
            } else {
                requestSubmitButton.removeAttribute('aria-disabled');
            }
        }
        if (addRequestLineButton) {
            addRequestLineButton.disabled = Boolean(busy);
        }
    }

    function updateRequestLinesEmpty() {
        if (!requestLinesEmpty) {
            return;
        }
        const hasRows = requestLinesBody && requestLinesBody.children.length > 0;
        requestLinesEmpty.hidden = hasRows;
    }

    function addRequestLine(initial = null) {
        if (!requestLinesBody) {
            return null;
        }
        requestLineCounter += 1;
        const row = document.createElement('tr');
        row.className = 'request-line-row';
        row.dataset.lineId = String(requestLineCounter);

        const rateValue = document.createElement('span');
        rateValue.className = 'request-line-rate';
        rateValue.textContent = '—';

        const rateExtra = document.createElement('span');
        rateExtra.className = 'request-line-rate-meta';
        rateExtra.hidden = true;

        const itemMeta = document.createElement('p');
        itemMeta.className = 'request-line-meta';
        itemMeta.hidden = true;

        const initialItem =
            initial && initial.item_id
                ? {
                      id: initial.item_id,
                      name: initial.item_name || '',
                      ref_id: initial.item_reference || '',
                      rate: initial.rate ?? initial.item_rate ?? null,
                      period: initial.period ?? initial.item_period ?? '',
                      uom: initial.uom ?? initial.item_uom ?? '',
                      category_name: initial.category_name || initial.item_category || '',
                      brand: initial.brand || initial.item_brand || '',
                      model: initial.model || initial.item_model || '',
                  }
                : null;

        function updateItemMeta(item) {
            if (item && item.id) {
                const metaText = formatRequestLineMeta(item);
                if (metaText) {
                    itemMeta.textContent = metaText;
                    itemMeta.hidden = false;
                } else {
                    itemMeta.textContent = '';
                    itemMeta.hidden = true;
                }
                const rateText = formatItemRateDisplay(item);
                rateValue.textContent = rateText || '—';
                const rateMetaText = formatItemRateMeta(item);
                if (rateMetaText) {
                    rateExtra.textContent = rateMetaText;
                    rateExtra.hidden = false;
                } else {
                    rateExtra.textContent = '';
                    rateExtra.hidden = true;
                }
            } else {
                itemMeta.textContent = '';
                itemMeta.hidden = true;
                rateValue.textContent = '—';
                rateExtra.textContent = '';
                rateExtra.hidden = true;
            }
        }

        const itemCell = document.createElement('td');
        itemCell.className = 'request-line-cell request-line-item';
        const itemField = document.createElement('div');
        itemField.className = 'request-line-field';

        const typeahead = createRequestItemTypeahead({
            initialItem,
            onSelect: (item) => {
                updateItemMeta(item);
            },
            onClear: () => {
                updateItemMeta(null);
            },
        });

        itemField.append(typeahead.root, itemMeta);
        itemCell.append(itemField);

        const quantityCell = document.createElement('td');
        quantityCell.className = 'request-line-cell request-line-qty';
        const quantityInput = document.createElement('input');
        quantityInput.type = 'number';
        quantityInput.min = '1';
        quantityInput.step = '1';
        quantityInput.placeholder = 'จำนวน';
        quantityInput.className = 'request-line-quantity';
        if (Number.isFinite(initial?.quantity) && initial.quantity > 0) {
            quantityInput.value = String(initial.quantity);
        }
        if (!quantityInput.value) {
            quantityInput.value = '1';
        }
        quantityCell.appendChild(quantityInput);

        const rateCell = document.createElement('td');
        rateCell.className = 'request-line-cell request-line-rate-cell';
        rateCell.append(rateValue, rateExtra);

        const noteCell = document.createElement('td');
        noteCell.className = 'request-line-cell request-line-note-cell';
        const noteInput = document.createElement('input');
        noteInput.type = 'text';
        noteInput.maxLength = 500;
        noteInput.placeholder = 'หมายเหตุ (ถ้ามี)';
        noteInput.className = 'request-line-note';
        if (initial?.note) {
            noteInput.value = String(initial.note);
        }
        noteCell.appendChild(noteInput);

        const actionCell = document.createElement('td');
        actionCell.className = 'col-actions request-line-actions';
        const removeButton = document.createElement('button');
        removeButton.type = 'button';
        removeButton.className = 'ghost request-line-remove';
        removeButton.textContent = 'ลบ';
        removeButton.addEventListener('click', () => {
            if (requestLinesBody && row.parentElement === requestLinesBody) {
                requestLinesBody.removeChild(row);
                updateRequestLinesEmpty();
            }
        });
        actionCell.appendChild(removeButton);

        row.append(itemCell, quantityCell, rateCell, noteCell, actionCell);
        requestLinesBody.appendChild(row);
        updateRequestLinesEmpty();

        const handleAutoAdd = (event) => {
            if (event.key !== 'Enter' || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) {
                return;
            }
            if (!isLastRequestLineRow(row) || !isRowReadyForAutoAdd(row)) {
                return;
            }
            event.preventDefault();
            const nextRow = addRequestLine();
            if (nextRow) {
                const nextInput = nextRow.querySelector('.request-line-input');
                if (nextInput) {
                    nextInput.focus();
                }
            }
        };

        quantityInput.addEventListener('keydown', handleAutoAdd);
        noteInput.addEventListener('keydown', handleAutoAdd);

        updateItemMeta(initialItem);

        return row;
    }

    function isLastRequestLineRow(row) {
        if (!row || !requestLinesBody) {
            return false;
        }
        return row.parentElement === requestLinesBody && !row.nextElementSibling;
    }

    function isRowReadyForAutoAdd(row) {
        if (!row) {
            return false;
        }
        const itemIdInput = row.querySelector('.request-line-item-id');
        const quantityInput = row.querySelector('.request-line-quantity');
        const itemIdValue = itemIdInput ? Number.parseInt(itemIdInput.value, 10) : Number.NaN;
        const quantityValue = quantityInput ? Number.parseInt(quantityInput.value, 10) : Number.NaN;
        return Number.isFinite(itemIdValue) && itemIdValue > 0 && Number.isFinite(quantityValue) && quantityValue > 0;
    }

    function resetRequestForm() {
        if (requestForm) {
            requestForm.reset();
        }
        if (requestLinesBody) {
            requestLinesBody.innerHTML = '';
        }
        requestLineCounter = 0;
        setRequestFormMessage('');
        setRequestFormBusy(false);
        syncRequestEventDetails();
        if (requestLinesBody) {
            addRequestLine();
        }
    }

    function openRequestModal() {
        if (!requestModal) {
            return;
        }
        requestModal.hidden = false;
        requestModal.setAttribute('aria-hidden', 'false');
        const focusTarget = requestNameInput || requestModal.querySelector('input, button, select, textarea');
        if (focusTarget) {
            setTimeout(() => {
                focusTarget.focus();
            }, 20);
        }
    }

    function closeRequestModal() {
        if (!requestModal) {
            return;
        }
        requestModal.hidden = true;
        requestModal.setAttribute('aria-hidden', 'true');
        isRequestSubmitting = false;
        setRequestFormBusy(false);
        setRequestFormMessage('');
        resetRequestForm();
    }

    function collectRequestPayload() {
        if (!eventId) {
            setRequestFormMessage('ไม่พบอีเว้นที่ต้องการสร้างคำขอ', 'error');
            return null;
        }
        const eventNumericId = Number.parseInt(eventId, 10);
        if (!Number.isFinite(eventNumericId) || eventNumericId <= 0) {
            setRequestFormMessage('ไม่พบอีเว้นที่ต้องการสร้างคำขอ', 'error');
            return null;
        }
        const name = requestNameInput ? requestNameInput.value.trim() : '';
        if (!name) {
            setRequestFormMessage('กรุณาระบุชื่อคำขอ', 'error');
            if (requestNameInput) {
                requestNameInput.focus();
            }
            return null;
        }
        if (!requestLinesBody) {
            setRequestFormMessage('กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ', 'error');
            return null;
        }
        const rows = Array.from(requestLinesBody.querySelectorAll('tr'));
        if (!rows.length) {
            setRequestFormMessage('กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ', 'error');
            return null;
        }
        const lines = [];
        for (let index = 0; index < rows.length; index += 1) {
            const row = rows[index];
            const itemIdInput = row.querySelector('.request-line-item-id');
            const quantityInput = row.querySelector('.request-line-quantity');
            const noteInput = row.querySelector('.request-line-note');
            const noteValue = noteInput ? noteInput.value.trim() : '';
            const itemIdValue = itemIdInput ? Number.parseInt(itemIdInput.value, 10) : Number.NaN;
            const quantityValue = quantityInput ? Number.parseInt(quantityInput.value, 10) : Number.NaN;
            const hasAnyValue = Boolean(itemIdInput?.value?.trim()) || Boolean(quantityInput?.value?.trim()) || noteValue !== '';
            if (!hasAnyValue) {
                continue;
            }
            if (!Number.isFinite(itemIdValue) || itemIdValue <= 0) {
                setRequestFormMessage(`กรุณาเลือกสินค้าในรายการที่ ${index + 1}`, 'error');
                const focusTarget = row.querySelector('.request-line-input');
                if (focusTarget) {
                    focusTarget.focus();
                }
                return null;
            }
            if (!Number.isFinite(quantityValue) || quantityValue <= 0) {
                setRequestFormMessage(`กรุณากรอกจำนวนที่ถูกต้องในรายการที่ ${index + 1}`, 'error');
                if (quantityInput) {
                    quantityInput.focus();
                }
                return null;
            }
            lines.push({
                item_id: itemIdValue,
                quantity: quantityValue,
                note: noteValue || null,
            });
        }
        if (!lines.length) {
            setRequestFormMessage('กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ', 'error');
            return null;
        }
        return {
            event_id: eventNumericId,
            request_name: name,
            lines,
        };
    }

    async function requestCreate(payload) {
        if (!modelRoot) {
            throw new Error('ไม่พบปลายทางสำหรับบันทึกคำขอ');
        }
        const response = await fetch(`${modelRoot}/request_create.php`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'same-origin',
            body: JSON.stringify(payload),
        });
        if (!response.ok) {
            let message = 'ไม่สามารถบันทึกคำขอได้';
            try {
                const data = await response.json();
                if (data?.message) {
                    message = data.message;
                }
            } catch (error) {
                // ignore
            }
            throw new Error(message);
        }
        return response.json();
    }

    async function submitRequestForm() {
        if (isRequestSubmitting) {
            return;
        }
        const payload = collectRequestPayload();
        if (!payload) {
            return;
        }
        isRequestSubmitting = true;
        setRequestFormBusy(true);
        setRequestFormMessage('');
        try {
            await requestCreate(payload);
            closeRequestModal();
            setGlobalMessage('สร้างคำขอเบิกอุปกรณ์เรียบร้อยแล้ว', 'success');
            await loadDocuments();
        } catch (error) {
            setRequestFormMessage(error?.message || 'ไม่สามารถบันทึกคำขอได้', 'error');
        } finally {
            isRequestSubmitting = false;
            setRequestFormBusy(false);
        }
    }

    function initializeRequestActions() {
        setCreateRequestEnabled(false);
        if (createRequestButton) {
            createRequestButton.addEventListener('click', () => {
                if (!eventId) {
                    setGlobalMessage('ไม่พบอีเว้นที่ต้องการสร้างคำขอ', 'error');
                    return;
                }
                if (!isDatasetLoaded) {
                    setGlobalMessage('กำลังโหลดข้อมูลอีเว้น โปรดลองอีกครั้ง', 'error');
                    return;
                }
                clearGlobalMessage();
                const params = new URLSearchParams();
                params.set('event_id', eventId);
                window.location.href = `./item_request_detail.html?${params.toString()}`;
            });
        }
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
                syncCreateRequestButtonState();
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
        isDatasetLoaded = false;
        setCreateRequestEnabled(false);
    }

    function clearLoadError() {
        hasLoadError = false;
        loadErrorMessage = '';
        resetEmptyStateMessage();
        syncCreateRequestButtonState();
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
        syncRequestEventDetails();
        isDatasetLoaded = true;

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
        setCreateRequestEnabled(true);
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
        setCreateRequestEnabled(false);
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
        syncRequestEventDetails();
        initializeRequestActions();
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