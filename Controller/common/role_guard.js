(function () {
  const doc = document.documentElement;
  const root = doc.dataset.root || '..';
  const allowedAttr = doc.dataset.allowed || '';
  const allowedRoles = allowedAttr
    .split(',')
    .map((role) => role.trim().toLowerCase())
    .filter(Boolean);
  const loginUrl = `${root}/View/login.html`;

  const normalizePath = (base, relative) => {
    if (!relative) return base;
    if (/^https?:/i.test(relative) || relative.startsWith('/')) {
      return relative;
    }
    const trimmedBase = base.replace(/\/+$/, '');
    return `${trimmedBase}/${relative}`;
  };

  const dispatchReady = (context) => {
    window.appContext = context;
    const event = new CustomEvent('app:user-ready', { detail: context });
    document.dispatchEvent(event);
  };

  window.onAppReady = function onAppReady(callback) {
    if (window.appContext) {
      callback(window.appContext);
      return;
    }
    const handler = (event) => {
      callback(event.detail);
    };
    document.addEventListener('app:user-ready', handler, { once: true });
  };

  const ensureAccess = async () => {
    try {
      const response = await fetch(`${root}/Model/session_user.php`, {
        credentials: 'same-origin',
      });

      if (!response.ok) {
        throw new Error('unauthorized');
      }

      const payload = await response.json();
      if (payload.error) {
        throw new Error('unauthorized');
      }

      const roleKey = (payload.role_key || '').toLowerCase();
      const isAdmin = roleKey === 'administrator';

      if (
        allowedRoles.length > 0 &&
        !isAdmin &&
        !allowedRoles.includes(roleKey)
      ) {
        const target = normalizePath(root, payload.home_path || 'View/login.html');
        window.location.replace(target);
        return;
      }

      dispatchReady({ user: payload, root, allowedRoles });
    } catch (err) {
      const redirect = loginUrl.includes('?')
        ? `${loginUrl}&error=unauth`
        : `${loginUrl}?error=unauth`;
      window.location.replace(redirect);
    }
  };

  if (window.appContext?.user) {
    const roleKey = (window.appContext.user.role_key || '').toLowerCase();
    const isAdmin = roleKey === 'administrator';
    if (
      allowedRoles.length > 0 &&
      !isAdmin &&
      !allowedRoles.includes(roleKey)
    ) {
      const target = normalizePath(root, window.appContext.user.home_path);
      window.location.replace(target);
      return;
    }
    dispatchReady(window.appContext);
    return;
  }

  ensureAccess();
})();