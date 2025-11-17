(function () {
    const body = document.body;
    if (!body || body.dataset.appShell !== 'admin') {
        return;
    }

    const templatePath = body.dataset.shellTemplate || './admin_shell.html';

    const setActiveNavItem = (root, pageId) => {
        if (!pageId) {
            return;
        }

        root.querySelectorAll('[data-page]').forEach((link) => {
            if (link.dataset.page === pageId) {
                link.classList.add('active');
                link.setAttribute('aria-current', 'page');
            } else {
                link.classList.remove('active');
                link.removeAttribute('aria-current');
            }
        });
    };

    const applyShellTitle = (root) => {
        const title = body.dataset.shellTitle;
        if (!title) {
            return;
        }

        const titleEl = root.querySelector('[data-shell-title]');
        if (titleEl) {
            titleEl.textContent = title;
        }
    };

    fetch(templatePath)
        .then((response) => {
            if (!response.ok) {
                throw new Error(`Unable to load admin shell template: ${response.status}`);
            }
            return response.text();
        })
        .then((markup) => {
            const wrapper = document.createElement('div');
            wrapper.innerHTML = markup.trim();
            const template = wrapper.querySelector('#admin-shell-template');

            if (!template) {
                throw new Error('Admin shell template element not found.');
            }

            setActiveNavItem(template.content, body.dataset.page);
            applyShellTitle(template.content);

            const fragment = template.content.cloneNode(true);
            body.insertBefore(fragment, body.firstChild);
            document.dispatchEvent(new CustomEvent('app:shell-ready'));
        })
        .catch((error) => {
            console.error(error);
        });
})();