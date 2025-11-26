(function () {
    const params = new URLSearchParams(window.location.search);
    const requestLineId = params.get('request_line_id');
    const lineId = params.get('line_id');
    const returnTo = params.get('return_to');

    const fulfillmentTitle = document.getElementById('fulfillmentTitle');
    const fulfillmentDate = document.getElementById('fulfillmentDate');
    const fulfillmentBackLink = document.getElementById('fulfillmentBackLink');
    const fulfillmentMessage = document.getElementById('fulfillmentMessage');
    const fulfillmentLineIdentifier = document.getElementById('fulfillmentLineIdentifier');
    const fulfillmentLineDetail = document.getElementById('fulfillmentLineDetail');

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

    function updateThaiNow() {
        if (!fulfillmentDate) {
            return;
        }
        const now = new Date();
        const thaiYear = now.getFullYear() + 543;
        const formatted = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1)
            .toString()
            .padStart(2, '0')}/${thaiYear}`;
        fulfillmentDate.textContent = `วันที่ ${formatted}`;
    }

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
            fulfillmentBackLink.href = './request_review.html'; // Fallback
        }
    }

    function boot() {
        updateThaiNow();
        setInterval(updateThaiNow, 60_000);
        applyIdentifiers();
        syncBackLink();
    }

    if (typeof window.onAppReady === 'function') {
        window.onAppReady(boot);
    }
})();
