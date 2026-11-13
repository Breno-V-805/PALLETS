/**
 * PALLETS V3 // Top Navigation Bar (Breadcrumbs, Global Search, Ctrl+K, Hub Selector, Alerts, Profile)
 */
(function (global) {
  'use strict';

  function renderTopbar(container, state) {
    if (!container) return;
    const F = global.PalletsFormatters;
    const Perms = global.PalletsPermissions;
    const Router = global.PalletsRouter;
    const Calc = global.PalletsCalculations;
    const user = state.user;
    if (!user) {
      container.innerHTML = '';
      return;
    }

    const meta = Router.ROUTE_META[state.currentRoute] || Router.ROUTE_META['command-center'];
    const unreadCount = state.notifications.length;
    const isStaff = Perms.isStaff(user);
    const hubs = Calc.HUBS;

    const hubSelectHtml = isStaff
      ? `<div class="hub-locked-pill" title="Assigned dark store hub">
           ${F.icon('lock', 13)}
           <span class="mono">${F.escapeHtml(user.storeAccess)}</span>
         </div>`
      : `<div class="hub-select-wrap">
           ${F.icon('building', 14)}
           <select id="topbar-hub-select" class="topbar-select" aria-label="Active Dark Store Hub">
             <option value="ALL" ${state.activeHubFilter === 'ALL' ? 'selected' : ''}>All Network Hubs (4)</option>
             ${hubs
               .map(
                 (h) =>
                   `<option value="${F.escapeHtml(h.id)}" ${state.activeHubFilter === h.id ? 'selected' : ''}>${F.escapeHtml(h.code)} // ${F.escapeHtml(h.name)}</option>`
               )
               .join('')}
           </select>
         </div>`;

    container.innerHTML = `
      <div class="topbar-left">
        <button type="button" class="icon-btn mobile-menu-btn" id="btn-mobile-menu" aria-label="Open menu">
          ${F.icon('menu', 18)}
        </button>
        <nav class="breadcrumb" aria-label="Breadcrumb">
          <span class="crumb-section">${F.escapeHtml(meta.section)}</span>
          <span class="crumb-sep">${F.icon('chevron-right', 13)}</span>
          <span class="crumb-title">${F.escapeHtml(meta.title)}</span>
        </nav>
      </div>

      <div class="topbar-center">
        <div class="global-search-wrap">
          <span class="search-icon">${F.icon('search', 14)}</span>
          <input type="search"
            id="topbar-global-search"
            class="global-search-input"
            placeholder="Filter SKU, product, supplier..."
            value="${F.escapeHtml(state.globalSearch || '')}"
            aria-label="Global inventory search" />
          <button type="button" class="cmdk-trigger-btn" id="btn-open-cmdk" title="Command Palette (Ctrl+K)">
            <kbd>Ctrl+K</kbd>
          </button>
        </div>
      </div>

      <div class="topbar-right">
        ${hubSelectHtml}

        <button type="button" class="icon-btn notification-btn" id="btn-toggle-notifications" aria-label="Notifications">
          ${F.icon('bell', 16)}
          ${unreadCount > 0 ? `<span class="notif-badge mono">${unreadCount > 9 ? '9+' : unreadCount}</span>` : ''}
        </button>

        <div class="profile-menu-wrap">
          <button type="button" class="profile-pill-btn" id="btn-profile-menu">
            <span class="profile-dot ${user.role === 'Admin' ? 'purple' : user.role === 'Inventory Manager' ? 'blue' : 'teal'}"></span>
            <span class="profile-name">${F.escapeHtml(user.name)}</span>
            <span class="profile-chevron">${F.icon('chevron-down', 13)}</span>
          </button>
          <div class="profile-dropdown hidden" id="profile-dropdown-menu">
            <div class="dropdown-header">
              <div class="dropdown-name">${F.escapeHtml(user.name)}</div>
              <div class="dropdown-email mono">${F.escapeHtml(user.email)}</div>
              <div class="dropdown-badges">
                <span class="badge ${Perms.roleBadgeClass(user.role)}">${F.escapeHtml(user.role)}</span>
                <span class="badge badge-neutral mono">${F.escapeHtml(user.storeAccess)}</span>
              </div>
            </div>
            ${Perms.isAdmin(user) ? `<button type="button" class="dropdown-item" id="dd-open-admin">${F.icon('shield', 14)} System Administration</button>` : ''}
            <button type="button" class="dropdown-item danger" id="dd-logout">${F.icon('log-out', 14)} Sign Out</button>
          </div>
        </div>
      </div>
    `;

    const mobileBtn = container.querySelector('#btn-mobile-menu');
    if (mobileBtn) {
      mobileBtn.addEventListener('click', () => {
        document.body.classList.toggle('mobile-nav-open');
      });
    }

    const searchInput = container.querySelector('#topbar-global-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const val = e.target.value;
        const pos = e.target.selectionStart;
        global.PalletsState.setState({ globalSearch: val });
        const freshInput = document.querySelector('#topbar-global-search');
        if (freshInput) {
          freshInput.focus();
          try { freshInput.setSelectionRange(pos, pos); } catch (_) {}
        }
      });
    }

    const cmdkBtn = container.querySelector('#btn-open-cmdk');
    if (cmdkBtn) {
      cmdkBtn.addEventListener('click', () => global.PalletsCommandPalette.open());
    }

    const hubSelect = container.querySelector('#topbar-hub-select');
    if (hubSelect) {
      hubSelect.addEventListener('change', (e) => {
        global.PalletsState.setState({ activeHubFilter: e.target.value });
      });
    }

    const notifBtn = container.querySelector('#btn-toggle-notifications');
    if (notifBtn) {
      notifBtn.addEventListener('click', () => {
        global.PalletsNotifications.togglePanel();
      });
    }

    const profileBtn = container.querySelector('#btn-profile-menu');
    const dd = container.querySelector('#profile-dropdown-menu');
    if (profileBtn && dd) {
      profileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dd.classList.toggle('hidden');
      });
    }
    const adminBtn = container.querySelector('#dd-open-admin');
    if (adminBtn) {
      adminBtn.addEventListener('click', () => global.PalletsRouter.navigate('administration'));
    }
    const logoutBtn = container.querySelector('#dd-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => global.PalletsEvents.emit('auth:logout'));
    }
  }

  document.addEventListener('click', () => {
    const dd = document.getElementById('profile-dropdown-menu');
    if (dd && !dd.classList.contains('hidden')) dd.classList.add('hidden');
  });

  global.PalletsTopbar = { render: renderTopbar };
})(typeof window !== 'undefined' ? window : globalThis);

