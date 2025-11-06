(function () {
  const updateThaiDate = () => {
    const now = new Date();
    const days = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
    const months = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
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

  updateThaiDate();
  setInterval(updateThaiDate, 1000);
})();
