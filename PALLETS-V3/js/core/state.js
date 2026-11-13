/**
 * PALLETS V3 // Reactive Enterprise Store & Derived Selectors
 */
(function (global) {
  'use strict';

  const subscribers = new Set();

  const state = {
    authChecked: false,
    user: null,
    needsAdminBootstrap: false,
    currentRoute: 'command-center',
    routeTabs: {
      products: 'catalogue',
      inventory: 'overview',
      ingestion: 'upload',
      forecasting: 'studio',
      replenishment: 'recommendations',
      suppliers: 'directory',
      analytics: 'rules',
      administration: 'overview'
    },
    activeHubFilter: 'ALL',
    globalSearch: '',
    sidebarCollapsed: false,
    loadingState: false,
    stateError: null,
    hubs: [],
    products: [],
    suppliers: [],
    purchaseOrders: [],
    ingestionLogs: [],
    forecastRuns: [],
    activityLogs: [],
    selectedProductSku: null,
    aprioriConfig: { minSupport: 0.02, minConfidence: 0.25 },
    aprioriResult: null,
    copilotMessages: [
      {
        id: 'COP-WELCOME',
        sender: 'bot',
        text: 'PALLETS AI Copilot ready. Federated across WF-RISK, WF-REPLENISH, and WF-FORECAST. Select a prompt or ask about stockouts, Epigamia velocity, PO recommendations, overstock bleed, or warehouse valuation.',
        timestamp: new Date().toISOString(),
        sourceBadge: 'WF-COPILOT Ready'
      }
    ],
    notifications: [],
    workflows: {},
    supabaseStatus: {
      configured: false,
      reachable: false,
      schemaReady: false,
      outcome: 'UNCONFIGURED',
      mode: 'UNCONFIGURED_LOCAL_FALLBACK'
    },
    telemetryLogs: []
  };

  function recomputeApriori() {
    if (!global.PalletsAprioriEngine || !global.PalletsSeedData) return;
    const baskets = global.PalletsSeedData.buildSampleBasketsForApriori();
    const productMap = {};
    state.products.forEach((p) => {
      productMap[p.sku] = p;
    });
    state.aprioriResult = global.PalletsAprioriEngine.runApriori(baskets, {
      minSupport: state.aprioriConfig.minSupport,
      minConfidence: state.aprioriConfig.minConfidence,
      productMap
    });
  }

  function recomputeNotifications() {
    const Calc = global.PalletsCalculations;
    if (!Calc) return;
    const list = [];
    state.products.forEach((p) => {
      const risk = Calc.evaluateRiskStatus(p);
      if (risk === 'CRITICAL') {
        list.push({
          id: `ALR-${p.sku}`,
          severity: 'CRITICAL',
          title: `Critical deficit: ${p.name}`,
          detail: `${p.onHand}u left (${Calc.calculateRunwayDays(p)}d runway) at ${p.hub}`,
          route: 'replenishment',
          read: false
        });
      }
    });
    state.purchaseOrders
      .filter((po) => po.status === 'PENDING')
      .slice(0, 4)
      .forEach((po) => {
        list.push({
          id: `PO-${po.id}`,
          severity: 'WARNING',
          title: `Pending approval: ${po.id}`,
          detail: `${po.qty}u ${po.sku} (${po.supplier})`,
          route: 'replenishment',
          read: false
        });
      });
    state.notifications = list;
  }

  function setState(patch) {
    Object.assign(state, patch);
    if (patch.products || patch.aprioriConfig) {
      recomputeApriori();
    }
    if (patch.products || patch.purchaseOrders) {
      recomputeNotifications();
    }
    notify();
  }

  function notify() {
    subscribers.forEach((fn) => {
      try {
        fn(state);
      } catch (e) {
        console.error('[PalletsState] subscriber error:', e);
      }
    });
  }

  function subscribe(fn) {
    subscribers.add(fn);
    return () => subscribers.delete(fn);
  }

  function getScopedProducts() {
    const q = state.globalSearch.trim().toLowerCase();
    const hub = state.user && state.user.role === 'Staff'
      ? state.user.storeAccess
      : state.activeHubFilter;

    return state.products.filter((p) => {
      if (hub && hub !== 'ALL' && p.hub !== hub) return false;
      if (!q) return true;
      return (
        p.sku.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        (p.brand || '').toLowerCase().includes(q) ||
        (p.supplier || '').toLowerCase().includes(q)
      );
    });
  }

  function computeDashboardMetrics() {
    const Calc = global.PalletsCalculations;
    const products = getScopedProducts();
    let totalValuation = 0;
    let criticalCount = 0;
    let highRiskCount = 0;
    let optimalCount = 0;
    let overstockCount = 0;
    let totalDailyDemand = 0;
    let stockoutRiskValue = 0;

    products.forEach((p) => {
      totalValuation += Calc.calculateHoldingValuation(p);
      totalDailyDemand += Number(p.dailyDemand || 0);
      stockoutRiskValue += Calc.calculateLostRevenue(p);
      const r = Calc.evaluateRiskStatus(p);
      if (r === 'CRITICAL') criticalCount += 1;
      else if (r === 'HIGH') highRiskCount += 1;
      else if (r === 'OVERSTOCK') overstockCount += 1;
      else optimalCount += 1;
    });

    const pendingPOs = state.purchaseOrders.filter((po) => {
      if (po.status !== 'PENDING') return false;
      if (state.user && state.user.role === 'Staff') return po.hub === state.user.storeAccess;
      if (state.activeHubFilter && state.activeHubFilter !== 'ALL') return po.hub === state.activeHubFilter;
      return true;
    }).length;

    return {
      totalValuation,
      criticalCount,
      highRiskCount,
      optimalCount,
      overstockCount,
      pendingPOs,
      totalDailyDemand,
      stockoutRiskValue,
      totalSkus: products.length
    };
  }

  global.PalletsState = {
    state,
    setState,
    notify,
    subscribe,
    recomputeApriori,
    getScopedProducts,
    computeDashboardMetrics
  };
})(typeof window !== 'undefined' ? window : globalThis);

