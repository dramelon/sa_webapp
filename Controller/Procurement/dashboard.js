(function () {
	const cardsContainer = document.getElementById('procurementCards');
	const tableBody = document.querySelector('#procurementTable tbody');
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
			{ icon: 'box', title: 'สินค้าคงคลัง', detail: 'รอตรวจนับ 8 รายการ' },
			{ icon: 'clip', title: 'คำขอซื้อ', detail: 'ใบคำขอใหม่ 3 รายการ' },
			{ icon: 'truck', title: 'การจัดส่ง', detail: 'สินค้ารอรับเข้า 2 รายการ' },
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
			{ id: 'PO-23015', type: 'ใบสั่งซื้อ', status: 'รออนุมัติ', created: '2024-02-05' },
			{ id: 'RQ-11890', type: 'ใบเบิก', status: 'จัดส่งแล้ว', created: '2024-02-03' },
			{ id: 'PO-23009', type: 'ใบสั่งซื้อ', status: 'รอรับสินค้า', created: '2024-02-01' },
		];
		tableBody.innerHTML = '';
		for (const row of rows) {
			const tr = document.createElement('tr');
			tr.innerHTML = `
        <td>${row.id}</td>
        <td>${row.type}</td>
        <td>${row.status}</td>
        <td>${formatDate(row.created)}</td>
      `;
			tableBody.append(tr);
		}
	};

	const formatDate = (value) => {
		if (!value) return '—';
		const normalized = String(value).replace(' ', 'T');
		const date = new Date(normalized);
		if (Number.isNaN(date.getTime())) return '—';
		return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
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