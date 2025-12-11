(function () {
    const params = new URLSearchParams(window.location.search);
    const rfqId = params.get('rfq_id') || params.get('supplier_rfq_id');
    const eventId = params.get('event_id');
    const returnTo = params.get('return_to');

    const backLink = document.getElementById('reviewBackLink');
    const backButton = document.getElementById('reviewBtnBack');
    const rfqLink = document.getElementById('reviewRfqLink');
    const titleDisplay = document.getElementById('reviewTitle');
    const dateDisplay = document.getElementById('reviewDate');
    const rfqNameDisplay = document.getElementById('reviewRfqName');
    const rfqRefDisplay = document.getElementById('reviewRfqRef');
    const eventMetaDisplay = document.getElementById('reviewEventMeta');
    const lineCountDisplay = document.getElementById('reviewLineCount');
    const lineWithPriceDisplay = document.getElementById('reviewLineWithPrice');
    const awardValueDisplay = document.getElementById('reviewAwardValue');
    const quotationList = document.getElementById('reviewQuotationList');
    const linesContainer = document.getElementById('reviewLinesContainer');
    const messageBox = document.getElementById('reviewGlobalMessage');

    let modelRoot = '';
    let summaryPayload = null;

    function tickClock() {
        if (!dateDisplay) return;
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
        dateDisplay.textContent = `วัน${day}ที่ ${date} ${month} ${year} เวลา ${time}`;
    }

    function setMessage(text, tone = 'info') {
        if (!messageBox) return;
        const normalized = typeof text === 'string' ? text.trim() : '';
        messageBox.classList.remove('success', 'error', 'info');
        if (!normalized) {
            messageBox.hidden = true;
            messageBox.textContent = '';
            return;
        }
        messageBox.hidden = false;
        messageBox.textContent = normalized;
        messageBox.classList.add(tone);
    }

    function formatCurrency(value) {
        if (value === null || value === undefined || Number.isNaN(Number(value))) {
            return '—';
        }
        return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(Number(value));
    }

    function formatNumber(value) {
        const numeric = Number(value);
        if (Number.isNaN(numeric)) return '0';
        return numeric.toLocaleString('th-TH');
    }

    function formatDateTime(value) {
        if (!value) return '—';
        const dt = new Date(value);
        if (Number.isNaN(dt.getTime())) return '—';
        const day = dt.getDate().toString().padStart(2, '0');
        const month = (dt.getMonth() + 1).toString().padStart(2, '0');
        const year = dt.getFullYear() + 543;
        const time = dt.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false });
        return `${day}/${month}/${year} • ${time}`;
    }

    function getVatRate() {
        const rate = Number(summaryPayload?.summary?.vat_rate);
        if (Number.isFinite(rate) && rate >= 0) {
            return rate;
        }
        return 0.07;
    }

    function formatVatNote(taxInclude) {
        const vatPercent = Math.round(getVatRate() * 100);
        return taxInclude
            ? 'ผู้ขายแจ้งว่าราคารวม VAT แล้ว'
            : `ราคานี้คำนวณรวม VAT ${vatPercent}% เพื่อเปรียบเทียบ`; 
    }

    function setBackNavigation() {
        const defaultUrl = eventId
            ? `./event_document_manage.html?event_id=${encodeURIComponent(eventId)}&category=quotation`
            : './event_document_manage.html';
        const target = returnTo ? decodeURIComponent(returnTo) : defaultUrl;
        if (backLink) backLink.href = target;
        if (backButton) {
            backButton.addEventListener('click', () => {
                window.location.href = target;
            });
        }
    }

    function setRfqLink(rfq) {
        if (!rfqLink || !rfq) return;
        const url = new URL('./RFQ_detail.html', window.location.href);
        url.searchParams.set('rfq_id', rfq.supplier_rfq_id);
        if (eventId) url.searchParams.set('event_id', eventId);
        const returnUrl = encodeURIComponent(window.location.href);
        url.searchParams.set('return_to', returnUrl);
        rfqLink.href = url.toString();
    }

    function renderQuotationCard(quotation) {
        const card = document.createElement('article');
        card.className = 'summary-card';
        const title = document.createElement('h4');
        title.textContent = quotation.title || quotation.ref_supplier_quotation_id || `ใบเสนอราคา #${quotation.supplier_quotation_id}`;
        const supplier = document.createElement('p');
        supplier.className = 'meta-sub';
        supplier.textContent = quotation.supplier_name || '—';
        const details = document.createElement('p');
        details.className = 'meta-sub';
        details.textContent = `สถานะ: ${quotation.status || '—'} • ส่งเมื่อ ${formatDateTime(quotation.quotation_date)}`;
        const action = document.createElement('a');
        action.className = 'btn btn-ghost btn-small';
        const returnUrl = encodeURIComponent(window.location.href);
        action.href = `./quotation_detail.html?supplier_quotation_id=${quotation.supplier_quotation_id}&return_to=${returnUrl}`;
        action.textContent = 'เปิดใบเสนอราคา';
        card.append(title, supplier, details, action);
        return card;
    }

    function renderQuotations() {
        if (!quotationList) return;
        const quotations = Array.isArray(summaryPayload?.quotations) ? summaryPayload.quotations : [];
        if (!quotations.length) {
            quotationList.innerHTML = `
                <div class="empty-state">
                    <span class="i inbox"></span>
                    <p>ยังไม่มีใบเสนอราคาที่ส่งตอบกลับ</p>
                </div>
            `;
            return;
        }
        quotationList.innerHTML = '';
        quotations.forEach((quotation) => {
            quotationList.appendChild(renderQuotationCard(quotation));
        });
    }

    function createOfferList(offers, bestOffer) {
        if (!offers || !offers.length) return null;
        const table = document.createElement('table');
        table.className = 'rfq-line-offer-table';
        const thead = document.createElement('thead');
        thead.innerHTML = `
            <tr>
                <th scope="col">ผู้ขาย</th>
                <th scope="col">ราคาต่อหน่วย (รวม VAT)</th>
                <th scope="col">ยอดรวม (รวม VAT)</th>
                <th scope="col">จำนวน</th>
            </tr>
        `;
        const tbody = document.createElement('tbody');
        offers.forEach((offer) => {
            const row = document.createElement('tr');
            if (bestOffer && offer.quotation_line_id === bestOffer.quotation_line_id) {
                row.classList.add('is-best');
            }
            const qtyLabel = `${formatNumber(offer.offered_quantity || 0)} ${offer.uom || ''}`.trim();
            const vatNote = formatVatNote(Boolean(offer.tax_include));
            const unitBeforeVat = offer.effective_unit_price_before_vat ?? offer.unit_price ?? offer.effective_unit_price;
            const totalBeforeVat = offer.total_price_before_vat ?? offer.total_price;
            row.innerHTML = `
                <td>
                    ${offer.supplier_name || '—'}
                    <p class="meta-sub">${offer.quotation_label || ''}</p>
                    <p class="meta-sub">${vatNote}</p>
                </td>
                <td>
                    ${formatCurrency(offer.effective_unit_price)}
                    <p class="meta-sub">ก่อน VAT ${formatCurrency(unitBeforeVat)}</p>
                </td>
                <td>
                    ${formatCurrency(offer.total_price)}
                    <p class="meta-sub">ก่อน VAT ${formatCurrency(totalBeforeVat)}</p>
                </td>
                <td>${qtyLabel}</td>
            `;
            tbody.appendChild(row);
        });
        table.append(thead, tbody);
        return table;
    }

    function renderLineCard(line) {
        const card = document.createElement('article');
        card.className = 'detail-card rfq-line-card';

        const header = document.createElement('header');
        header.className = 'detail-card-head';
        const titleWrap = document.createElement('div');
        const heading = document.createElement('h4');
        heading.textContent = line.item_name || line.item_desc || `สินค้า #${line.item_id || line.rfq_line_id}`;
        const meta = document.createElement('p');
        meta.className = 'meta-sub';
        const metaParts = [];
        if (line.item_reference) metaParts.push(`รหัส: ${line.item_reference}`);
        if (line.item_desc) metaParts.push(line.item_desc);
        meta.textContent = metaParts.join(' • ') || '—';
        titleWrap.append(heading, meta);
        header.appendChild(titleWrap);
        card.appendChild(header);

        const body = document.createElement('div');
        body.className = 'detail-card-body';

        const infoRow = document.createElement('div');
        infoRow.className = 'line-info-row';
        infoRow.innerHTML = `
            <div>
                <p class="meta-label">จำนวนที่ขอ</p>
                <strong>${formatNumber(line.quantity_requested)} ${line.uom || ''}</strong>
            </div>
        `;
        body.appendChild(infoRow);

        const bestOffer = line.best_offer || null;
        const bestBox = document.createElement('div');
        bestBox.className = 'best-offer-box';
        if (bestOffer) {
            const qtyLabel = `${formatNumber(bestOffer.offered_quantity || 0)} ${bestOffer.uom || line.uom || ''}`.trim();
            const unitBeforeVat = bestOffer.effective_unit_price_before_vat ?? bestOffer.unit_price ?? bestOffer.effective_unit_price;
            const totalBeforeVat = bestOffer.total_price_before_vat ?? bestOffer.total_price;
            const vatNote = formatVatNote(Boolean(bestOffer.tax_include));
            bestBox.innerHTML = `
                <p class="meta-label">ราคาที่ดีที่สุด (รวม VAT)</p>
                <h5>${bestOffer.supplier_name || '—'}</h5>
                <p class="meta-sub">${bestOffer.quotation_label || ''}</p>
                <p><strong>${formatCurrency(bestOffer.effective_unit_price)}</strong> / ${bestOffer.uom || line.uom || ''}</p>
                <p class="meta-sub">ก่อน VAT ${formatCurrency(unitBeforeVat)}</p>
                <p class="meta-sub">${vatNote}</p>
                <p class="meta-sub">รวม ${formatCurrency(bestOffer.total_price)} (ก่อน VAT ${formatCurrency(totalBeforeVat)}) สำหรับ ${qtyLabel || '—'}</p>
            `;
        } else {
            bestBox.innerHTML = `
                <p class="meta-label">ราคาที่ดีที่สุด</p>
                <p>ยังไม่มีใบเสนอราคาที่มากกว่า 0</p>
            `;
        }
        body.appendChild(bestBox);

        if (line.note) {
            const note = document.createElement('p');
            note.className = 'meta-sub';
            note.textContent = `หมายเหตุ: ${line.note}`;
            body.appendChild(note);
        }

        const offerTable = createOfferList(line.offers || [], bestOffer);
        if (offerTable) {
            body.appendChild(offerTable);
        }

        card.appendChild(body);
        return card;
    }

    function renderLines() {
        if (!linesContainer) return;
        const lines = Array.isArray(summaryPayload?.lines) ? summaryPayload.lines : [];
        if (!lines.length) {
            linesContainer.innerHTML = `
                <div class="empty-state">
                    <span class="i inbox"></span>
                    <p>ยังไม่มีรายการสินค้าใน RFQ นี้</p>
                </div>
            `;
            return;
        }
        linesContainer.innerHTML = '';
        lines.forEach((line) => {
            linesContainer.appendChild(renderLineCard(line));
        });

        const unmatched = Array.isArray(summaryPayload?.unmatched_offers)
            ? summaryPayload.unmatched_offers
            : [];
        if (unmatched.length) {
            const notice = document.createElement('div');
            notice.className = 'form-alert info';
            notice.textContent = `มี ${formatNumber(unmatched.length)} รายการใบเสนอราคาที่ไม่ได้เชื่อมกับสินค้าใน RFQ (ผู้ขายเพิ่มเองในใบเสนอราคา)`;
            linesContainer.appendChild(notice);
        }
    }

    function renderSummary() {
        const rfq = summaryPayload?.rfq || {};
        const summary = summaryPayload?.summary || {};
        if (titleDisplay) {
            titleDisplay.textContent = `ตรวจสอบใบเสนอราคา - ${rfq.title || `RFQ #${rfq.supplier_rfq_id || ''}`}`;
        }
        if (rfqNameDisplay) {
            rfqNameDisplay.textContent = rfq.title || `RFQ #${rfq.supplier_rfq_id || ''}`;
        }
        if (rfqRefDisplay) {
            rfqRefDisplay.textContent = `รหัสอ้างอิง: ${rfq.ref_supplier_rfq_id || '—'}`;
        }
        if (eventMetaDisplay) {
            const eventLabel = [rfq.event_name, rfq.event_code ? `(${rfq.event_code})` : ''].filter(Boolean).join(' ');
            eventMetaDisplay.textContent = `อีเว้น: ${eventLabel || '—'}`;
        }
        if (lineCountDisplay) {
            lineCountDisplay.textContent = formatNumber(summary.line_count || 0);
        }
        const vatPercent = Math.round(getVatRate() * 100);
        if (lineWithPriceDisplay) {
            const withoutPrice = typeof summary.lines_without_price === 'number'
                ? summary.lines_without_price
                : Math.max((summary.line_count || 0) - (summary.lines_with_price || 0), 0);
            lineWithPriceDisplay.textContent = `${formatNumber(summary.lines_with_price || 0)} รายการ (ไม่มี ${formatNumber(withoutPrice)})`;
            lineWithPriceDisplay.title = `คำนวณเปรียบเทียบโดยรวม VAT ${vatPercent}%`;
        }
        if (awardValueDisplay) {
            awardValueDisplay.textContent = `${formatCurrency(summary.total_awarded_value || 0)} (รวม VAT ${vatPercent}%)`;
        }
        setRfqLink(rfq);
    }

    async function fetchSummary() {
        if (!rfqId) {
            setMessage('ไม่พบรหัส RFQ ที่ต้องการตรวจสอบ', 'error');
            return;
        }
        setMessage('กำลังโหลดข้อมูลตรวจสอบราคา...');
        try {
            const response = await fetch(
                `${modelRoot}/supplier_quotation_summary.php?supplier_rfq_id=${encodeURIComponent(rfqId)}`
            );
            const payload = await response.json().catch(() => null);
            if (!response.ok || !payload?.success) {
                throw new Error(payload?.message || 'summary_failed');
            }
            summaryPayload = payload.data;
            renderSummary();
            renderQuotations();
            renderLines();
            setMessage('');
        } catch (error) {
            console.error('Failed to load quotation summary', error);
            setMessage('ไม่สามารถโหลดข้อมูลใบเสนอราคาได้', 'error');
        }
    }

    function boot() {
        const root = document.documentElement.dataset.root || '../..';
        modelRoot = `${root}/Model`;
        tickClock();
        setInterval(tickClock, 60000);
        setBackNavigation();
        fetchSummary();
    }

    if (typeof window.onAppReady === 'function') {
        window.onAppReady(boot);
    } else {
        boot();
    }
})();
