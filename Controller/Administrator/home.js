(function () {
  const updateThaiDate = () => {
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
    const el = document.querySelector('.news-head .date');
    if (el) {
      el.textContent = `วัน${day}ที่ ${date} ${month} ${year} เวลา ${time}`;
    }
  };

  const fmtDate = (date) => {
    const opts = { year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('th-TH', opts);
  };

  const escapeHtml = (value) =>
    (value || '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

  const renderAnnouncements = async (modelRoot) => {
    try {
      const response = await fetch(`${modelRoot}/announcements_list.php`, {
        credentials: 'same-origin',
      });
      if (!response.ok) {
        throw new Error('network');
      }

      const list = await response.json();
      const container = document.getElementById('newsCards');
      if (!container) return;

      container.innerHTML = '';

      for (const item of list) {
        const card = document.createElement('article');
        card.className = 'card';

        const head = document.createElement('header');
        head.className = 'card-head';
        head.innerHTML = `<span class="i bubble"></span><h3>${escapeHtml(item.Topic)}</h3>`;

        const divider = document.createElement('div');
        divider.className = 'card-divider';

        const body = document.createElement('p');
        body.className = 'card-body';
        body.textContent = item.Description;

        const footer = document.createElement('footer');
        footer.className = 'card-foot';
        const announced = new Date((item.AnnounceDate || '').replace(' ', 'T'));
        footer.innerHTML = `<span class="i clock"></span><span>ประกาศเมื่อ: ${fmtDate(announced)} | ${escapeHtml(
          item.AnnouncerName
        )}</span>`;

        card.append(head, divider, body, footer);
        container.append(card);
      }
    } catch (error) {
      // optional: show empty state
    }
  };

  const boot = ({ root }) => {
    const modelRoot = `${root}/Model`;
    updateThaiDate();
    setInterval(updateThaiDate, 1000);
    renderAnnouncements(modelRoot);
  };

  if (typeof window.onAppReady === 'function') {
    window.onAppReady(boot);
  }
})();