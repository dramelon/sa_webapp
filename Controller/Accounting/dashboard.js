(function () {
    const cardsContainer = document.getElementById('accountingCards');
    const tableBody = document.querySelector('#accountingTable tbody');
    const dateLabel = document.querySelector('.news-head .date');

    const updateThaiDate = () => {
        const now = new Date();
        const days = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
        const months = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
        const day = days[now.getDay()];
        const date = now.getDate();
        const month = months[now.getMonth()];
        const year = now.getFullYear() + 543;
        const time = now.toLocaleTimeString('th-TH', { hour12: false });
        if (dateLabel) {
            dateLabel.textContent = `วัน${day}ที่ ${date} ${month} ${year} เวลา ${time}`;
        }
    };

    const buildCards = () => {
        if (!cardsContainer) return;
        const cards = [
            { icon: 'wallet', title: 'ยอดเรียกเก็บวันนี้', detail: '85,000 บาท' },
            { icon: 'check', title: 'การชำระเงิน', detail: 'เสร็จสิ้น 5 รายการ' },
            { icon: 'warning', title: 'ค้างชำระ', detail: 'ค้าง 2 รายการ' },
        ];
        cardsContainer.innerHTML = '';
        for (const card of cards) {
            const article = document.createElement('article');
            article.className = 'card';
            article.innerHTML = `
        <header class="card-head"><span class="i ${card.icon}"></span><h3>${card.title}</h3></header>
        <div class="card-divider"></div>
        <p class="card-body">${card.detail}</p>
      `;
            cardsContainer.append(article);
        }
    };

    const buildTable = () => {
        if (!tableBody) return;
        const rows = [
            { id: 'INV-1023', customer: 'บริษัท เอ จำกัด', amount: 18000, status: 'รอชำระ' },
            { id: 'INV-1022', customer: 'คุณศิริพร', amount: 12000, status: 'ชำระแล้ว' },
            { id: 'INV-1021', customer: 'Event Hub', amount: 24000, status: 'รอชำระ' },
        ];
        tableBody.innerHTML = '';
        for (const row of rows) {
            const tr = document.createElement('tr');
            tr.innerHTML = `
        <td>${row.id}</td>
        <td>${row.customer}</td>
        <td>${row.amount.toLocaleString('th-TH', { style: 'currency', currency: 'THB' })}</td>
        <td>${row.status}</td>
      `;
            tableBody.append(tr);
        }
    };

    const boot = () => {
        updateThaiDate();
        setInterval(updateThaiDate, 1000);
        buildCards();
        buildTable();
    };

    if (typeof window.onAppReady === 'function') {
        window.onAppReady(boot);
    } else {
        boot();
    }
})();