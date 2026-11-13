/**
 * PALLETS V3 // Application Orchestrator & Workspace Mount
 */
(function (global) {
  'use strict';

  let renderScheduled = false;
  let lastRoute = null;

  function renderCurrentWorkspace(state) {
    const contentEl = document.getElementById('app-content');
    if (!contentEl || !state.user) return;

    const Perms = global.PalletsPermissions;
    let route = state.currentRoute;
    if (!Perms.canAccessRoute(state.user, route)) {
      route = 'command-center';
      state.currentRoute = route;
    }

    const pages = {
      'command-center': global.PalletsDashboardPage,
      products: global.PalletsProductsPage,
      inventory: global.PalletsInventoryPage,
      ingestion: global.PalletsIngestionPage,
      forecasting: global.PalletsForecastingPage,
      replenishment: global.PalletsReplenishmentPage,
      suppliers: global.PalletsSuppliersPage,
      analytics: global.PalletsAnalyticsPage,
      copilot: global.PalletsCopilotPage,
      administration: global.PalletsAdministrationPage
    };

    const pageMod = pages[route] || global.PalletsDashboardPage;
    if (pageMod && typeof pageMod.render === 'function') {
      pageMod.render(contentEl, state);
    }

    if (lastRoute !== route) {
      lastRoute = route;
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }

  function renderApp() {
    const state = global.PalletsState.state;
    const authRoot = document.getElementById('auth-root');
    const shellEl = document.getElementById('app-shell');

    document.body.classList.toggle('sidebar-collapsed', Boolean(state.sidebarCollapsed));

    if (!state.authChecked) {
      authRoot.innerHTML = '<div class="auth-shell"><div class="panel panel-body mono">Verifying enterprise session...</div></div>';
      shellEl.classList.add('hidden');
      return;
    }

    if (!state.user) {
      shellEl.classList.add('hidden');
      authRoot.classList.remove('hidden');
      global.PalletsAuthPage.render(authRoot, state);
      return;
    }

    authRoot.classList.add('hidden');
    authRoot.innerHTML = '';
    shellEl.classList.remove('hidden');

    global.PalletsSidebar.render(document.getElementById('app-sidebar'), state);
    global.PalletsTopbar.render(document.getElementById('app-topbar'), state);
    renderCurrentWorkspace(state);
  }

  function scheduleRender() {
    if (renderScheduled) return;
    renderScheduled = true;
    requestAnimationFrame(() => {
      renderScheduled = false;
      renderApp();
    });
  }

  async function hydrateAuthenticatedSession(user) {
    const Store = global.PalletsState;
    Store.setState({ authChecked: true, user, needsAdminBootstrap: false });
    try {
      await Promise.all([
        global.PalletsDataAdapter.loadOperationalState(),
        global.PalletsWorkflowAdapter.refreshWorkflowStatus()
      ]);
      const targetRoute = global.PalletsRouter.resolveRouteFromHash();
      global.PalletsRouter.navigate(targetRoute);
    } catch (err) {
      global.PalletsEvents.emit('toast', {
        type: 'error',
        title: 'Operational Load Failed',
        message: err.message
      });
    }
  }

  async function bootstrapApp() {
    global.PalletsNotifications.init();
    global.PalletsCommandPalette.init();
    global.PalletsRouter.initRouter();
    global.PalletsWorkflowAdapter.init();

    global.PalletsState.subscribe(scheduleRender);

    const backdrop = document.getElementById('mobile-sidebar-backdrop');
    if (backdrop) {
      backdrop.addEventListener('click', () => document.body.classList.remove('mobile-nav-open'));
    }

    let resizeTimer = null;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (global.PalletsState.state.user) scheduleRender();
      }, 150);
    });

    global.PalletsEvents.on('auth:authenticated', (user) => {
      hydrateAuthenticatedSession(user);
    });

    global.PalletsEvents.on('auth:logout', async () => {
      try {
        await global.PalletsAuthAdapter.logout();
      } catch (_) {}
      const session = await global.PalletsAuthAdapter.checkSession().catch(() => ({ authenticated: false, user: null, needsAdminBootstrap: false }));
      global.PalletsState.setState({
        authChecked: true,
        user: null,
        needsAdminBootstrap: Boolean(session.needsAdminBootstrap),
        products: [],
        purchaseOrders: [],
        activityLogs: [],
        notifications: []
      });
    });

    try {
      const session = await global.PalletsAuthAdapter.checkSession();
      if (session.authenticated && session.user) {
        await hydrateAuthenticatedSession(session.user);
      } else {
        global.PalletsState.setState({
          authChecked: true,
          user: null,
          needsAdminBootstrap: Boolean(session.needsAdminBootstrap)
        });
      }
    } catch (err) {
      global.PalletsState.setState({
        authChecked: true,
        user: null,
        needsAdminBootstrap: false
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrapApp);
  } else {
    bootstrapApp();
  }
})(typeof window !== 'undefined' ? window : globalThis);

