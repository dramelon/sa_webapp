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