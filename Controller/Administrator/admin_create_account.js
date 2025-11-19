(function () {
    const form = document.querySelector('form.form');
    const box = document.getElementById('formMsg');

    if (!form || !box) {
        console.error('Required form elements not found.');
        return;
    }

    const showMessage = (message, isSuccess = false) => {
        box.textContent = message;
        box.hidden = false;
        if (isSuccess) {
            box.classList.add('ok');
        } else {
            box.classList.remove('ok');
        }
    };

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        box.hidden = true;

        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        // Ensure role is included, defaulting to 'staff' if not present
        if (!data.role) {
            data.role = 'staff';
        }

        try {
            const response = await fetch('../../Model/admin_create_account.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify(data),
            });

            const result = await response.json();

            if (response.ok && result.success) {
                showMessage('Account created successfully!', true);
                form.reset();
                // Redirect to login page after a short delay
                setTimeout(() => {
                    window.location.href = './admin_management.html?created=' + result.staff_id;
                }, 2000);
            } else {
                const defaultMessage = 'Could not create account. Please try again.';
                showMessage(result.message || defaultMessage);
            }
        } catch (error) {
            console.error('Account creation request failed:', error);
            showMessage('A network error occurred. Please check your connection.');
        }
    });

    // --- Initial Page Load Logic ---
    const params = new URLSearchParams(location.search);
    const error = params.get('error');

    if (error) {
        const errorMessages = {
            exists: 'This username or email already exists.',
            missing: 'Please fill in all required fields.',
        };
        showMessage(errorMessages[error] || 'An unknown error occurred.');
    }

    if (error) {
        try {
            history.replaceState(null, '', location.pathname);
        } catch (_) { /* History API may not be available */ }
    }
})();