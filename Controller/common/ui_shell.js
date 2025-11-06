(function () {
  const drawer = document.getElementById('drawer');
  const scrim = document.getElementById('scrim');
  const menuButton = document.getElementById('btnMenu');

  if (drawer && scrim && menuButton) {
    const openDrawer = () => {
      drawer.classList.add('open');
      scrim.hidden = false;
    };

    const closeDrawer = () => {
      drawer.classList.remove('open');
      scrim.hidden = true;
    };

    menuButton.addEventListener('click', () => {
      if (drawer.classList.contains('open')) {
        closeDrawer();
      } else {
        openDrawer();
      }
    });

    scrim.addEventListener('click', closeDrawer);

    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeDrawer();
      }
    });
  }

  const renderUser = ({ user }) => {
    const fullNameEl = document.getElementById('fullName');
    const avatarEl = document.getElementById('avatar');
    const roleEl = document.getElementById('roleLabel');

    if (fullNameEl) {
      fullNameEl.textContent = user.full_name || 'ผู้ใช้งาน';
    }

    if (avatarEl) {
      if (user.avatar) {
        avatarEl.src = user.avatar;
      } else {
        avatarEl.removeAttribute('src');
      }
      avatarEl.alt = user.full_name || 'avatar';
    }

    if (roleEl) {
      roleEl.textContent = user.role || '';
    }
  };

  if (typeof window.onAppReady === 'function') {
    window.onAppReady(renderUser);
  } else {
    document.addEventListener('app:user-ready', (event) => renderUser(event.detail), {
      once: true,
    });
  }
})();