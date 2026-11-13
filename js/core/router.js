/**
 * PALLETS V3 // Workspace Router & Contextual Tab Coordinator
 */
(function (global) {
  'use strict';

  const ROUTE_META = {
    'command-center': { section: 'Overview', title: 'Command Center' },
    products: { section: 'Operations', title: 'Product Intelligence' },
    inventory: { section: 'Operations', title: 'Inventory Control' },
    ingestion: { section: 'Operations', title: 'Sales Ingestion' },
    replenishment: { section: 'Operations', title: 'Replenishment Center' },
    suppliers: { section: 'Operations', title: 'Supplier Intelligence' },
    forecasting: { section: 'Intelligence', title: 'Demand Intelligence' },
    analytics: { section: 'Intelligence', title: 'Customer Intelligence' },
    copilot: { section: 'Intelligence', title: 'PALLETS Copilot' },
    administration: { section: 'System', title: 'Administration' }
  };

  function resolveRouteFromHash() {
    const raw = (global.location.hash || '').replace(/^#\/?/, '').trim();
    const route = raw.split('?')[0].split('/')[0];
    return ROUTE_META[route] ? route : 'command-center';
  }

  function navigate(routeId, tabId = null) {
    const Perms = global.PalletsPermissions;
    const Store = global.PalletsState;
    const target = ROUTE_META[routeId] ? routeId : 'command-center';
    if (Store.state.user && Perms && !Perms.canAccessRoute(Store.state.user, target)) {
      global.PalletsEvents.emit('toast', {
        type: 'warning',
        title: 'Access Restricted',
        message: `Role "${Store.state.user.role}" is not permitted to open ${ROUTE_META[target].title}.`
      });
      return navigate('command-center');
    }
    if (tabId && Store.state.routeTabs[target] !== undefined) {
      Store.state.routeTabs[target] = tabId;
    }
    if (global.location.hash !== `#${target}`) {
      global.location.hash = `#${target}`;
    }
    Store.setState({ currentRoute: target });
  }

  function setContextualTab(routeId, tabId) {
    const Store = global.PalletsState;
    Store.state.routeTabs = { ...Store.state.routeTabs, [routeId]: tabId };
    Store.notify();
  }

  function initRouter() {
    global.addEventListener('hashchange', () => {
      const target = resolveRouteFromHash();
      const Store = global.PalletsState;
      const Perms = global.PalletsPermissions;
      if (Store.state.user && Perms && !Perms.canAccessRoute(Store.state.user, target)) {
        global.location.hash = '#command-center';
        Store.setState({ currentRoute: 'command-center' });
        return;
      }
      Store.setState({ currentRoute: target });
    });
  }

  global.PalletsRouter = {
    ROUTE_META,
    resolveRouteFromHash,
    navigate,
    setContextualTab,
    initRouter
  };
})(typeof window !== 'undefined' ? window : globalThis);

