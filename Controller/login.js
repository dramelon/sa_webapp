(function () {
    const form = document.querySelector('form.form');
    const box = document.getElementById('formMsg');

    if (!form || !box) {
        return;
    }

    // --- Helper Functions ---

    const showMessage = (message, isSuccess = false) => {
        box.textContent = message;
        box.hidden = false;
        if (isSuccess) {
            box.classList.add('ok');
        } else {
            box.classList.remove('ok');
        }
    };

    const handleLoginSuccess = (role) => {
        const homeRoutes = {
            administrator: '../View/Administrator/home.html',
            project: '../View/Project/dashboard.html',
            procurement: '../View/Procurement/dashboard.html',
            accounting: '../View/Accounting/dashboard.html',
            staff: '../View/Project/dashboard.html', // Default for staff
        };
        window.location.href = homeRoutes[role] || '../View/login.html';
    };

    // --- Event Listeners ---

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        box.hidden = true;

        const formData = new FormData(form);
        const username = formData.get('username');
        const password = formData.get('password');

        try {
            const response = await fetch('../Model/login.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({ username, password }),
            });

            const result = await response.json();

            if (response.ok && result.success) {
                handleLoginSuccess(result.role);
            } else {
                const defaultMessage = 'ไม่สามารถเข้าสู่ระบบได้ กรุณาลองใหม่อีกครั้ง';
                showMessage(result.message || defaultMessage);
            }
        } catch (error) {
            console.error('Login request failed:', error);
            showMessage('เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์');
        }
    });

    // --- Initial Page Load Logic ---

    // This part handles messages passed via URL, like after account creation.
    const params = new URLSearchParams(location.search);
    const created = params.get('created');
    const error = params.get('error'); // For old redirects, e.g., from session timeout
    
    if (created) {
        showMessage('สร้างบัญชีใหม่เรียบร้อยแล้ว กรุณาเข้าสู่ระบบ', true);
    } else if (error === 'unauth') {
        showMessage('เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง');
    }

    if (error || created) {
        try {
            history.replaceState(null, '', location.pathname);
        } catch (_) {
            // History API may not be available in all contexts
        }
    }
})();
