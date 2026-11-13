/**
 * PALLETS V3 // Collapsible Enterprise Sidebar Navigation
 */
(function (global) {
  'use strict';

  const NAV_GROUPS = [
    {
      label: 'Overview',
      items: [
        { id: 'command-center', label: 'Command Center', icon: 'layout-dashboard' }
      ]
    },
    {
      label: 'Operations',
      items: [
        { id: 'products', label: 'Product Intelligence', icon: 'package' },
        { id: 'inventory', label: 'Inventory Control', icon: 'boxes' },
        { id: 'ingestion', label: 'Sales Ingestion', icon: 'upload' },
        { id: 'replenishment', label: 'Replenishment Center', icon: 'refresh-cw' },
        { id: 'suppliers', label: 'Supplier Intelligence', icon: 'truck' }
      ]
    },
    {
      label: 'Intelligence',
      items: [
        { id: 'forecasting', label: 'Demand Intelligence', icon: 'trending-up' },
        { id: 'analytics', label: 'Customer Intelligence', icon: 'shopping-basket' },
        { id: 'copilot', label: 'PALLETS Copilot', icon: 'bot' }
      ]
    },
    {
      label: 'System',
      items: [
        { id: 'administration', label: 'Administration', icon: 'shield' }
      ]
    }
  ];

  function renderSidebar(container, state) {
    if (!container) return;
    const F = global.PalletsFormatters;
    const Perms = global.PalletsPermissions;
    const user = state.user;
    if (!user) {
      container.innerHTML = '';
      return;
    }

    const collapsed = Boolean(state.sidebarCollapsed);
    const groupsHtml = NAV_GROUPS.map((group) => {
      const visibleItems = group.items.filter((it) => Perms.canAccessRoute(user, it.id));
      if (visibleItems.length === 0) return '';
      const linksHtml = visibleItems
        .map((it) => {
          const active = state.currentRoute === it.id;
          let badgeHtml = '';
          if (it.id === 'replenishment') {
            const pendingCount = state.purchaseOrders.filter((po) => po.status === 'PENDING').length;
            if (pendingCount > 0) {
              badgeHtml = `<span class="nav-count">${pendingCount}</span>`;
            }
          }
          return `
            <button type="button"
              class="nav-item ${active ? 'active' : ''}"
              data-route="${F.escapeHtml(it.id)}"
              title="${F.escapeHtml(it.label)}">
              <span class="nav-icon">${F.icon(it.icon, 16)}</span>
              <span class="nav-label">${F.escapeHtml(it.label)}</span>
              ${badgeHtml}
            </button>
          `;
        })
        .join('');

      return `
        <div class="nav-group">
          <div class="nav-group-title">${F.escapeHtml(group.label)}</div>
          <div class="nav-group-list">${linksHtml}</div>
        </div>
      `;
    }).join('');

    const initials = user.name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0].toUpperCase())
      .join('') || 'OP';

    container.className = `app-sidebar ${collapsed ? 'collapsed' : ''}`;
    container.innerHTML = `
      <div class="sidebar-brand">
        <div class="brand-lockup" data-route="command-center">
          <img src="/assets/logo/pallets-logo.png" alt="PALLETS Logo" class="brand-logo-img" />
          <div class="brand-text">
            <div class="brand-wordmark">PALLETS <span class="brand-v3">V3</span></div>
            <div class="brand-sub">FMCG CONTROL PLANE</div>
          </div>
        </div>
        <button type="button" class="icon-btn sidebar-collapse-btn" id="btn-toggle-sidebar" title="${collapsed ? 'Expand sidebar' : 'Collapse sidebar'}" aria-label="Toggle sidebar">
          ${F.icon('panel-left', 16)}
        </button>
      </div>

      <nav class="sidebar-nav" aria-label="Primary Workspace Navigation">
        ${groupsHtml}
      </nav>

      <div class="sidebar-footer">
        <div class="sidebar-user">
          <div class="user-avatar">${F.escapeHtml(initials)}</div>
          <div class="user-meta">
            <div class="user-name" title="${F.escapeHtml(user.name)}">${F.escapeHtml(user.name)}</div>
            <div class="user-role-row">
              <span class="badge ${Perms.roleBadgeClass(user.role)}">${F.escapeHtml(user.role)}</span>
            </div>
          </div>
        </div>
        <div class="sidebar-footer-actions">
          ${Perms.isAdmin(user) ? `
            <button type="button" class="footer-action-btn" data-route="administration" title="Administration & Settings">
              ${F.icon('sliders', 15)}
              <span>Settings</span>
            </button>
          ` : ''}
          <button type="button" class="footer-action-btn danger" id="btn-sidebar-logout" title="Sign Out">
            ${F.icon('log-out', 15)}
            <span>Logout</span>
          </button>
        </div>
      </div>
    `;

    container.querySelectorAll('[data-route]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const route = btn.getAttribute('data-route');
        global.PalletsRouter.navigate(route);
        document.body.classList.remove('mobile-nav-open');
      });
    });

    const toggleBtn = container.querySelector('#btn-toggle-sidebar');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        global.PalletsState.setState({ sidebarCollapsed: !global.PalletsState.state.sidebarCollapsed });
      });
    }

    const logoutBtn = container.querySelector('#btn-sidebar-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        global.PalletsEvents.emit('auth:logout');
      });
    }
  }

  global.PalletsSidebar = { render: renderSidebar, NAV_GROUPS };
})(typeof window !== 'undefined' ? window : globalThis);

