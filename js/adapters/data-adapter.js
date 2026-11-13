/**
 * PALLETS V3 // Enterprise Operational State & Idempotent Mutation Adapter
 */
(function (global) {
  'use strict';

  function makeIdempotencyKey(prefix) {
    const rand = Math.random().toString(36).slice(2, 10).toUpperCase();
    return `${prefix}-${Date.now()}-${rand}`;
  }

  async function apiJson(url, options = {}) {
    let res;
    try {
      res = await fetch(url, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(options.headers || {})
        },
        ...options
      });
    } catch (networkErr) {
      throw new Error(
        `Connection to PALLETS V3 server (${global.location.origin}) lost. Verify "node server.js" is running in your terminal.`
      );
    }
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(body.error || `HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return body;
  }

  const DataAdapter = {
    makeIdempotencyKey,

    async loadOperationalState() {
      const Store = global.PalletsState;
      Store.setState({ loadingState: true, stateError: null });
      try {
        const data = await apiJson('/api/ops/state', { method: 'GET' });
        const staffHub = data.user && data.user.role === 'Staff' ? data.user.storeAccess : Store.state.activeHubFilter;
        Store.setState({
          loadingState: false,
          user: data.user,
          activeHubFilter: staffHub,
          hubs: data.hubs || [],
          products: data.products || [],
          suppliers: data.suppliers || [],
          purchaseOrders: data.purchaseOrders || [],
          ingestionLogs: data.ingestionLogs || [],
          forecastRuns: data.forecastRuns || [],
          activityLogs: data.activityLogs || []
        });
        return data;
      } catch (err) {
        Store.setState({ loadingState: false, stateError: err.message });
        throw err;
      }
    },

    async createProduct(payload) {
      const res = await apiJson('/api/ops/products', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      await this.loadOperationalState();
      return res;
    },

    async updateProduct(sku, payload) {
      const res = await apiJson(`/api/ops/products/${encodeURIComponent(sku)}`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });
      await this.loadOperationalState();
      return res;
    },

    async deleteProduct(sku) {
      const res = await apiJson(`/api/ops/products/${encodeURIComponent(sku)}`, {
        method: 'DELETE'
      });
      await this.loadOperationalState();
      return res;
    },

    async adjustStock({ sku, delta, reason, notes }, idemKey = makeIdempotencyKey('ADJ')) {
      const res = await apiJson('/api/ops/adjustments', {
        method: 'POST',
        headers: { 'X-Idempotency-Key': idemKey },
        body: JSON.stringify({ sku, delta, reason, notes })
      });
      await this.loadOperationalState();
      return res;
    },

    async transferStock({ sku, fromHub, toHub, qty }, idemKey = makeIdempotencyKey('TRF')) {
      const res = await apiJson('/api/ops/transfers', {
        method: 'POST',
        headers: { 'X-Idempotency-Key': idemKey },
        body: JSON.stringify({ sku, fromHub, toHub, qty })
      });
      await this.loadOperationalState();
      return res;
    },

    async createPurchaseOrders(items, approveImmediately = true, idemKey = makeIdempotencyKey('PO')) {
      const res = await apiJson('/api/ops/purchase-orders', {
        method: 'POST',
        headers: { 'X-Idempotency-Key': idemKey },
        body: JSON.stringify({ items, approveImmediately })
      });
      await this.loadOperationalState();
      return res;
    },

    async updatePurchaseOrder(id, patch) {
      const res = await apiJson(`/api/ops/purchase-orders/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(patch)
      });
      await this.loadOperationalState();
      return res;
    },

    async ingestBatch(payload, idemKey = makeIdempotencyKey('ING')) {
      const res = await apiJson('/api/ops/ingestion', {
        method: 'POST',
        headers: { 'X-Idempotency-Key': idemKey },
        body: JSON.stringify(payload)
      });
      await this.loadOperationalState();
      return res;
    },

    async recordForecastRun(payload) {
      const res = await apiJson('/api/ops/forecasts', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      await this.loadOperationalState();
      return res;
    },

    async createSupplier(payload) {
      const res = await apiJson('/api/ops/suppliers', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      await this.loadOperationalState();
      return res;
    }
  };

  global.PalletsDataAdapter = DataAdapter;
})(typeof window !== 'undefined' ? window : globalThis);

