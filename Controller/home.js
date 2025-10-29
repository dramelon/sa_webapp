// Drawer toggle and scrim
const drawer = document.getElementById('drawer');
const scrim = document.getElementById('scrim');
const btn = document.getElementById('btnMenu');

function openDrawer() {
    drawer.classList.add('open');
    scrim.hidden = false;
}

function closeDrawer() {
    drawer.classList.remove('open');
    scrim.hidden = true;
}

btn.addEventListener('click', () => {
    const open = drawer.classList.contains('open');
    open ? closeDrawer() : openDrawer();
});
scrim.addEventListener('click', closeDrawer);

window.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeDrawer();
});


// Populate profile pill
(async () => {
    try {
        const r = await fetch('../Model/session_user.php', { credentials: 'same-origin' });
        if (!r.ok) throw 0;
        const u = await r.json();
        document.getElementById('fullName').textContent = u.full_name || 'ผู้ใช้งาน';
        const av = document.getElementById('avatar');
        if (u.avatar) av.src = u.avatar; else av.removeAttribute('src'); // keeps colored circle bg
    } catch {
        // Not logged in → send to login
        location.href = '../View/login.html?error=unauth';
    }
})();


// Date and Time
function updateThaiDate() {
  const now = new Date();
  const days = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'];
  const months = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
                  'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  const day = days[now.getDay()];
  const date = now.getDate();
  const month = months[now.getMonth()];
  const year = now.getFullYear() + 543; // Buddhist Era
  const time = now.toLocaleTimeString('th-TH', {hour12:false});
  const text = `วัน${day}ที่ ${date} ${month} ${year} เวลา ${time}`;
  const el = document.querySelector('.news-head .date');
  if (el) el.textContent = text;
}
// call once and keep updating every second
updateThaiDate();
setInterval(updateThaiDate, 1000);



// News
async function loadNews() {
    try {
        const r = await fetch('../Model/announcements_list.php', { credentials: 'same-origin' });
        if (!r.ok) throw 0;
        const list = await r.json();
        const wrap = document.getElementById('newsCards');
        wrap.innerHTML = '';

        for (const a of list) {
            const card = document.createElement('article');
            card.className = 'card';

            const head = document.createElement('header');
            head.className = 'card-head';
            head.innerHTML = `<span class="i bubble"></span><h3>${escapeHtml(a.Topic)}</h3>`;

            const divider = document.createElement('div');
            divider.className = 'card-divider';

            const body = document.createElement('p');
            body.className = 'card-body';
            body.textContent = a.Description;

            const foot = document.createElement('footer');
            foot.className = 'card-foot';
            const d = new Date(a.AnnounceDate.replace(' ', 'T'));
            foot.innerHTML = `<span class="i clock"></span><span>ประกาศเมื่อ: ${fmtDate(d)} | ${escapeHtml(a.AnnouncerName)}</span>`;

            card.append(head, divider, body, foot);
            wrap.append(card);
        }
    } catch { /* optional: show empty state */ }
}

function fmtDate(d) {
    const opts = { year: 'numeric', month: 'long', day: 'numeric' };
    return d.toLocaleDateString('th-TH', opts);
}
function escapeHtml(s) {
    return (s || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

loadNews();