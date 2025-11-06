(function () {
    const msgEl = document.getElementById('formMsg');
    if (!msgEl) return;

    const params = new URLSearchParams(window.location.search);
    const error = params.get('error');
    const created = params.get('created');

    if (created) {
        msgEl.textContent = 'สร้างบัญชีผู้ใช้ใหม่เรียบร้อยแล้ว';
        msgEl.classList.add('ok');
        msgEl.hidden = false;
    } else if (error) {
        const content = error === 'missing'
            ? 'กรุณากรอกข้อมูลให้ครบถ้วน'
            : error === 'exists'
                ? 'ชื่อผู้ใช้หรืออีเมลถูกใช้งานแล้ว'
                : 'ไม่สามารถดำเนินการได้ กรุณาลองใหม่ภายหลัง';
        msgEl.textContent = content;
        msgEl.classList.remove('ok');
        msgEl.hidden = false;
    }

    if (error || created) {
        try {
            history.replaceState(null, '', window.location.pathname);
        } catch (err) {
            /* noop */
        }
    }
})();