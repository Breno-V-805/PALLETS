/**
 * PALLETS // Frontend Supabase Persistence & Synchronization Engine
 * Routes all reads & writes for all 10 tables through a single SNS Workbench
 * workflow (WF-SUPABASE-SYNC -> PostgreSQL pallets_gateway RPC).
 * Zero Netlify proxy or browser DB keys required.
 */
(function (global) {
  'use strict';

  function defaultAvatarForRole(role) {
    const r = String(role || '').toLowerCase();
    if (r.includes('admin')) {
      return 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=120&q=80';
    }
    if (r.includes('manager')) {
      return 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80';
    }
    return 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80';
  }

  function defaultPermissionsForRole(role) {
    const r = String(role || '').toLowerCase();
    if (r.includes('admin')) return ['ALL'];
    if (r.includes('manager')) return ['VIEW_ALL', 'APPROVE_PO', 'RUN_FORECAST', 'INGEST_DATA', 'ADJUST_STOCK'];
    return ['VIEW_STORE', 'STOCK_COUNT'];
  }

  function formatTimestampLabel(isoStr) {
    if (!isoStr) return 'Saved';
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return String(isoStr);
      return d.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return String(isoStr);
    }
  }

  function unwrapGatewayResponse(raw) {
    let cur = raw;
    for (let step = 0; step < 5; step++) {
      if (Array.isArray(cur)) {
        cur = cur.length > 0 ? cur[0] : {};
        continue;
      }
      if (typeof cur === 'string') {
        try {
          cur = JSON.parse(cur);
          continue;
        } catch (e) {
          break;
        }
      }
      if (cur && typeof cur === 'object') {
        if (cur.json && typeof cur.json === 'object') {
          cur = cur.json;
          continue;
        }
        if (cur.pallets_gateway && typeof cur.pallets_gateway === 'object') {
          cur = cur.pallets_gateway;
          continue;
        }
        if (cur.result && typeof cur.result === 'object') {
          cur = cur.result;
          continue;
        }
        if (cur.body && (typeof cur.body === 'object' || typeof cur.body === 'string')) {
          cur = cur.body;
          continue;
        }
        if (cur.data && !Array.isArray(cur.data) && typeof cur.data === 'object' && (cur.data.ok !== undefined || cur.data.schemaReady !== undefined || Array.isArray(cur.data.data))) {
          cur = cur.data;
          continue;
        }
      }
      break;
    }
    return (cur && typeof cur === 'object') ? cur : { ok: false, error: 'Invalid response envelope' };
  }

  class PalletsSupabaseClient {
    constructor(options = {}) {
      this.getWebhookUrl = typeof options.getWebhookUrl === 'function'
        ? options.getWebhookUrl
        : () => (options.webhookUrl || '');
      this.onStatusChange = typeof options.onStatusChange === 'function' ? options.onStatusChange : null;
      this.status = {
        configured: false,
        reachable: false,
        schemaReady: false,
        synced: false,
        lastSyncAt: null,
        lastError: null,
        mode: 'WORKFLOW_PENDING'
      };
    }

    _setStatus(patch) {
      this.status = { ...this.status, ...patch };
      if (this.onStatusChange) {
        try {
          this.onStatusChange({ ...this.status });
        } catch (e) {}
      }
    }

    getConfiguredWebhookUrl() {
      try {
        const raw = String(this.getWebhookUrl() || '').trim();
        if (raw && /^https?:\/\//i.test(raw)) {
          return raw;
        }
      } catch (e) {}
      return '';
    }

    async request(payload) {
      const webhookUrl = this.getConfiguredWebhookUrl();
      if (!webhookUrl || typeof fetch !== 'function') {
        this._setStatus({ configured: false, reachable: false, schemaReady: false, mode: 'WORKFLOW_PENDING' });
        return { ok: false, configured: false, data: null };
      }

      try {
        const controller = typeof AbortController === 'function' ? new AbortController() : null;
        const timeoutId = controller ? setTimeout(() => controller.abort(), 35000) : null;

        const res = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json'
          },
          body: JSON.stringify(payload),
          signal: controller ? controller.signal : undefined
        });

        if (timeoutId) clearTimeout(timeoutId);

        const rawJson = await res.json().catch(() => null);
        const unwrapped = unwrapGatewayResponse(rawJson);

        if (!res.ok) {
          const errMsg = unwrapped.error || unwrapped.message || `HTTP ${res.status}`;
          this._setStatus({ lastError: errMsg });
          return { ok: false, configured: true, status: res.status, error: errMsg, data: null };
        }

        return unwrapped;
      } catch (err) {
        this._setStatus({ lastError: err.message });
        return { ok: false, configured: true, error: err.message, data: null };
      }
    }

    async checkHealth() {
      const webhookUrl = this.getConfiguredWebhookUrl();
      if (!webhookUrl) {
        this._setStatus({ configured: false, reachable: false, schemaReady: false, synced: false, mode: 'WORKFLOW_PENDING' });
        return { ok: false, configured: false, reachable: false, schemaReady: false };
      }

      const json = await this.request({ action: 'health' });
      const schemaReady = Boolean(json && (json.schemaReady || json.ok));
      const reachable = Boolean(json && (json.reachable || json.ok || json.schemaReady !== undefined));

      this._setStatus({
        configured: true,
        reachable,
        schemaReady,
        lastError: json && json.error ? json.error : null,
        mode: schemaReady ? 'SUPABASE_LIVE' : (reachable ? 'SCHEMA_PENDING' : 'OFFLINE_RETRY')
      });
      return {
        ok: schemaReady,
        configured: true,
        reachable,
        schemaReady,
        ...(json || {})
      };
    }

    async select(table, options = {}) {
      return this.request({
        action: 'select',
        table,
        select: options.select || '*',
        filters: options.filters || null,
        order: options.order || null,
        limit: options.limit || 2000
      });
    }

    async upsert(table, rows, onConflict = null) {
      const rowList = Array.isArray(rows) ? rows : (rows ? [rows] : []);
      if (rowList.length === 0) {
        return { ok: true, configured: true, table, count: 0, data: [] };
      }

      const conflictCol = onConflict || 'id';
      const deduped = [];
      const seen = new Set();
      for (let i = rowList.length - 1; i >= 0; i--) {
        const r = rowList[i];
        const key = r && r[conflictCol] !== undefined ? String(r[conflictCol]) : `__idx_${i}`;
        if (!seen.has(key)) {
          seen.add(key);
          deduped.unshift(r);
        }
      }

      const chunkSize = 250;
      const saved = [];
      for (let i = 0; i < deduped.length; i += chunkSize) {
        const chunk = deduped.slice(i, i + chunkSize);
        const res = await this.request({
          action: 'upsert',
          table,
          rows: chunk,
          onConflict: conflictCol
        });
        if (!res || !res.ok) {
          return res || { ok: false, configured: true, table, error: 'Upsert failed' };
        }
        if (Array.isArray(res.data)) {
          saved.push(...res.data);
        }
      }

      return { ok: true, configured: true, table, count: saved.length, data: saved };
    }

    async insert(table, rows) {
      const rowList = Array.isArray(rows) ? rows : (rows ? [rows] : []);
      if (rowList.length === 0) {
        return { ok: true, configured: true, table, count: 0, data: [] };
      }
      return this.request({
        action: 'insert',
        table,
        rows: rowList
      });
    }

    async remove(table, match) {
      return this.request({
        action: 'delete',
        table,
        match
      });
    }

    // -----------------------------------------------------------------------
    // SCHEMA ROW MAPPERS
    // -----------------------------------------------------------------------

    toUserRow(u) {
      const now = new Date().toISOString();
      return {
        id: u.id,
        name: u.name,
        email: String(u.email || '').trim().toLowerCase(),
        role: u.role || 'Staff (Dark Store Associate)',
        store_hub: u.storeAccess || u.store_hub || 'BLR_NORTH_DC',
        permissions: Array.isArray(u.permissions) ? u.permissions : defaultPermissionsForRole(u.role),
        avatar: u.avatar || defaultAvatarForRole(u.role),
        password_hash_placeholder: '[SECURE_ARGON2_HASH]',
        created_at: u.createdAt || now,
        updated_at: now
      };
    }

    fromUserRow(r) {
      return {
        id: r.id,
        name: r.name,
        email: r.email,
        role: r.role || 'Staff (Dark Store Associate)',
        storeAccess: r.store_hub || 'BLR_NORTH_DC',
        avatar: r.avatar || defaultAvatarForRole(r.role),
        permissions: Array.isArray(r.permissions) ? r.permissions : defaultPermissionsForRole(r.role),
        createdAt: r.created_at
      };
    }

    toSupplierRow(s) {
      return {
        id: s.id,
        name: s.name,
        category: s.category || 'FMCG Wholesale Partner',
        lead_time_days: Number(s.leadTimeDays ?? 2),
        reliability_score: Number(s.reliabilityScore ?? 97),
        defect_rate: Number(s.defectRate ?? 0.2),
        on_time_delivery_pct: Number(s.onTimeDelivery ?? 96),
        moq: parseInt(s.defaultMoq ?? 100, 10),
        contact_email: s.contact || '',
        updated_at: new Date().toISOString()
      };
    }

    fromSupplierRow(r) {
      return {
        id: r.id,
        name: r.name,
        category: r.category || 'FMCG Wholesale Partner',
        leadTimeDays: Number(r.lead_time_days ?? 2),
        reliabilityScore: Number(r.reliability_score ?? 97),
        defectRate: Number(r.defect_rate ?? 0.2),
        onTimeDelivery: Number(r.on_time_delivery_pct ?? 96),
        defaultMoq: parseInt(r.moq ?? 100, 10),
        contact: r.contact_email || ''
      };
    }

    toProductRow(p) {
      return {
        id: p.sku,
        sku: p.sku,
        name: p.name,
        brand: p.brand || 'General FMCG',
        category: p.category || 'General',
        supplier_id: p.supplierId || null,
        supplier_name: p.supplier || 'Verified Distributor',
        store_hub: p.hub || 'BLR_NORTH_DC',
        on_hand: parseInt(p.onHand ?? 0, 10),
        on_order: parseInt(p.onOrder ?? 0, 10),
        reserved: parseInt(p.reserved ?? 0, 10),
        avg_daily_demand: Number(p.dailyDemand ?? 10),
        lead_time_days: Number(p.leadTimeDays ?? 2),
        safety_stock: parseInt(p.safetyStock ?? 50, 10),
        target_stock: parseInt(p.targetStock ?? 200, 10),
        moq: parseInt(p.moq ?? 50, 10),
        cost_price: Number(p.costPrice ?? 0),
        selling_price: Number(p.unitPrice ?? 0),
        status_note: p.status || 'OPTIMAL',
        updated_at: new Date().toISOString()
      };
    }

    toSalesRows(product) {
      if (!product || !Array.isArray(product.salesHistory)) return [];
      const unitPrice = Number(product.unitPrice || 0);
      return product.salesHistory
        .filter(h => h && h.date)
        .map(h => ({
          id: `${product.sku}__${h.date}`,
          sku: product.sku,
          store_hub: product.hub || 'BLR_NORTH_DC',
          sale_date: h.date,
          units_sold: Number(h.quantity ?? h.units_sold ?? 0),
          revenue: Math.round(Number(h.quantity ?? h.units_sold ?? 0) * unitPrice),
          source: 'POS_STREAM'
        }));
    }

    toMovementRow(sku, productName, storeHub, mov, suffix = '') {
      const refPart = mov.ref || mov.type || 'ADJ';
      const id = mov.id || `MOV-${sku}-${refPart}-${Date.now()}${suffix}`;
      return {
        id: String(id).replace(/[^a-zA-Z0-9_-]/g, '_'),
        sku,
        product_name: productName || sku,
        store_hub: storeHub || 'BLR_NORTH_DC',
        movement_type: mov.type || 'STOCK_ADJUSTMENT',
        quantity_delta: parseInt(mov.qty ?? 0, 10),
        previous_on_hand: mov.previousOnHand !== undefined ? parseInt(mov.previousOnHand, 10) : null,
        new_on_hand: mov.newOnHand !== undefined ? parseInt(mov.newOnHand, 10) : null,
        reason: [mov.ref, mov.date].filter(Boolean).join(' · '),
        actor_name: mov.user || 'System',
        created_at: mov.createdAt || new Date().toISOString()
      };
    }

    fromMovementRow(r) {
      const reasonParts = String(r.reason || '').split(' · ');
      return {
        id: r.id,
        date: reasonParts[1] || formatTimestampLabel(r.created_at),
        type: r.movement_type || 'STOCK_ADJUSTMENT',
        qty: parseInt(r.quantity_delta ?? 0, 10),
        ref: reasonParts[0] || r.id,
        user: r.actor_name || 'System'
      };
    }

    fromProductRow(r, salesBySku, movementsBySku, fallbackHistoryGenerator) {
      const histRows = salesBySku[r.sku] || [];
      const dailyDemand = Number(r.avg_daily_demand ?? 10);
      const salesHistory = histRows.length > 0
        ? histRows
            .sort((a, b) => String(a.sale_date).localeCompare(String(b.sale_date)))
            .map(h => ({ date: String(h.sale_date).slice(0, 10), quantity: Number(h.units_sold || 0) }))
        : (typeof fallbackHistoryGenerator === 'function' ? fallbackHistoryGenerator(dailyDemand) : []);

      return {
        sku: r.sku,
        name: r.name,
        category: r.category || 'General',
        brand: r.brand || 'General FMCG',
        hub: r.store_hub || 'BLR_NORTH_DC',
        unitPrice: Number(r.selling_price ?? 0),
        costPrice: Number(r.cost_price ?? 0),
        onHand: parseInt(r.on_hand ?? 0, 10),
        reserved: parseInt(r.reserved ?? 0, 10),
        onOrder: parseInt(r.on_order ?? 0, 10),
        leadTimeDays: Number(r.lead_time_days ?? 2),
        safetyStock: parseInt(r.safety_stock ?? 50, 10),
        targetStock: parseInt(r.target_stock ?? 200, 10),
        moq: parseInt(r.moq ?? 50, 10),
        dailyDemand,
        supplier: r.supplier_name || 'Verified Distributor',
        status: r.status_note || 'OPTIMAL',
        salesHistory,
        movements: movementsBySku[r.sku] || []
      };
    }

    toIngestionLogRow(log, ingestedBy = 'System') {
      return {
        id: log.batchId,
        batch_id: log.batchId,
        source_name: log.fileName,
        records_parsed: parseInt(log.imported ?? 0, 10),
        duplicates_skipped: parseInt(log.duplicates ?? 0, 10),
        validation_status: log.status || 'COMPLETED',
        summary_note: `Total rows parsed: ${parseInt(log.totalRecords ?? log.imported ?? 0, 10)} (${log.timestamp || 'Recent'})`,
        ingested_by: ingestedBy,
        ingested_at: log.ingestedAt || new Date().toISOString()
      };
    }

    fromIngestionLogRow(r) {
      const imported = parseInt(r.records_parsed ?? 0, 10);
      const duplicates = parseInt(r.duplicates_skipped ?? 0, 10);
      return {
        batchId: r.batch_id || r.id,
        fileName: r.source_name || 'unknown_batch.csv',
        totalRecords: imported + duplicates,
        imported,
        duplicates,
        status: r.validation_status || 'COMPLETED',
        timestamp: formatTimestampLabel(r.ingested_at)
      };
    }

    toPurchaseOrderRow(po) {
      return {
        id: po.poNumber,
        po_number: po.poNumber,
        sku: po.sku,
        product_name: po.productName,
        supplier_name: po.vendor,
        store_hub: po.hub,
        order_qty: parseInt(po.units ?? 0, 10),
        unit_cost: Number(po.unitCost ?? 0),
        total_cost: Number(po.totalCost ?? 0),
        status: po.status || 'DISPATCHED',
        rationale: po.rationale || '',
        approved_by: po.approvedBy || 'Operator',
        expected_arrival_at: po.expectedArrivalAt || null,
        created_at: po.createdAt || new Date().toISOString()
      };
    }

    toForecastRunRow({ sku, productName, horizon, promoBoost, result, runBy }) {
      const win = (result.modelComparison || []).find(m => m.id === result.selectedModel) || {};
      const timeline = (result.timeline || []).slice(0, 14);
      const projectedTotal = timeline.reduce((sum, pt) => sum + Number(pt.forecastDemand || 0), 0);
      return {
        id: `FC-${sku}-${horizon}D`,
        sku,
        product_name: productName,
        horizon_days: parseInt(horizon || 14, 10),
        promo_boost_pct: Math.round(Number(promoBoost || 0) * 100),
        winning_model: result.selectedModelName || result.selectedModel || 'AUTO',
        mae: Number(win.mae ?? 0),
        rmse: Number(win.rmse ?? 0),
        wape_pct: Math.round(Number(win.wape ?? 0) * 1000) / 10,
        projected_total_units: Math.round(projectedTotal),
        model_comparison: result.modelComparison || [],
        forecast_timeline: timeline,
        run_by: runBy || 'System',
        created_at: new Date().toISOString()
      };
    }

    toAprioriRuleRow(rule, minSupport = 0.05, minConfidence = 0.35) {
      const id = `APR-${rule.antecedent}-${rule.consequent}`.replace(/[^a-zA-Z0-9_-]/g, '_');
      return {
        id,
        antecedent: `${rule.antecedentName} (${rule.antecedent})`,
        consequent: `${rule.consequentName} (${rule.consequent})`,
        support_pct: Number(rule.support ?? 0),
        confidence_pct: Number(rule.confidence ?? 0),
        lift: Number(rule.lift ?? 1),
        bundle_strength: rule.strength || 'MODERATE',
        recommendation: `${rule.coPurchases || 0} co-purchases detected`,
        min_support_threshold: Number(minSupport),
        min_confidence_threshold: Number(minConfidence),
        updated_at: new Date().toISOString()
      };
    }

    // -----------------------------------------------------------------------
    // FULL HYDRATION + AUTO-SEED ON FIRST CONNECTION
    // -----------------------------------------------------------------------

    async bootstrapState(seed = {}) {
      const health = await this.checkHealth();
      if (!health || !health.configured || !health.schemaReady) {
        return {
          synced: false,
          reason: health && health.configured ? 'schema_missing' : 'not_configured',
          health
        };
      }

      const [
        usersRes,
        suppliersRes,
        productsRes,
        salesRes,
        movementsRes,
        ingestionRes,
        poRes,
        aprioriRes
      ] = await Promise.all([
        this.select('pallets_users', { order: 'created_at.asc', limit: 500 }),
        this.select('pallets_suppliers', { order: 'id.asc', limit: 200 }),
        this.select('pallets_products', { order: 'sku.asc', limit: 500 }),
        this.select('pallets_sales_history', { order: 'sale_date.asc', limit: 5000 }),
        this.select('pallets_inventory_movements', { order: 'created_at.desc', limit: 1000 }),
        this.select('pallets_ingestion_logs', { order: 'ingested_at.desc', limit: 200 }),
        this.select('pallets_purchase_orders', { order: 'created_at.desc', limit: 200 }),
        this.select('pallets_apriori_rules', { order: 'lift.desc', limit: 100 })
      ]);

      const seededTables = [];

      // 1. Seed Suppliers if empty
      let supplierRows = suppliersRes.ok ? suppliersRes.data : [];
      if (suppliersRes.ok && supplierRows.length === 0 && Array.isArray(seed.suppliers) && seed.suppliers.length > 0) {
        const up = await this.upsert('pallets_suppliers', seed.suppliers.map(s => this.toSupplierRow(s)), 'id');
        if (up.ok && Array.isArray(up.data)) {
          supplierRows = up.data;
          seededTables.push('pallets_suppliers');
        }
      }

      // 2. Seed Users if empty
      let userRows = usersRes.ok ? usersRes.data : [];
      if (usersRes.ok && userRows.length === 0 && Array.isArray(seed.users) && seed.users.length > 0) {
        const up = await this.upsert('pallets_users', seed.users.map(u => this.toUserRow(u)), 'email');
        if (up.ok && Array.isArray(up.data)) {
          userRows = up.data;
          seededTables.push('pallets_users');
        }
      }

      // 3. Seed Products if empty
      let productRows = productsRes.ok ? productsRes.data : [];
      if (productsRes.ok && productRows.length === 0 && Array.isArray(seed.products) && seed.products.length > 0) {
        const up = await this.upsert('pallets_products', seed.products.map(p => this.toProductRow(p)), 'sku');
        if (up.ok && Array.isArray(up.data)) {
          productRows = up.data;
          seededTables.push('pallets_products');
        }
      }

      // 4. Seed Sales History if empty
      let salesRows = salesRes.ok ? salesRes.data : [];
      if (salesRes.ok && salesRows.length === 0 && Array.isArray(seed.products) && seed.products.length > 0) {
        const allSales = [];
        seed.products.forEach(p => { allSales.push(...this.toSalesRows(p)); });
        if (allSales.length > 0) {
          const up = await this.upsert('pallets_sales_history', allSales, 'id');
          if (up.ok && Array.isArray(up.data)) {
            salesRows = up.data;
            seededTables.push('pallets_sales_history');
          }
        }
      }

      // 5. Seed Movements if empty
      let movementRows = movementsRes.ok ? movementsRes.data : [];
      if (movementsRes.ok && movementRows.length === 0 && Array.isArray(seed.products) && seed.products.length > 0) {
        const allMovs = [];
        seed.products.forEach((p, pIdx) => {
          (p.movements || []).forEach((m, mIdx) => {
            allMovs.push(this.toMovementRow(p.sku, p.name, p.hub, m, `-${pIdx}-${mIdx}`));
          });
        });
        if (allMovs.length > 0) {
          const up = await this.upsert('pallets_inventory_movements', allMovs, 'id');
          if (up.ok && Array.isArray(up.data)) {
            movementRows = up.data;
            seededTables.push('pallets_inventory_movements');
          }
        }
      }

      // 6. Seed Ingestion Logs if empty
      let ingestionRows = ingestionRes.ok ? ingestionRes.data : [];
      if (ingestionRes.ok && ingestionRows.length === 0 && Array.isArray(seed.ingestionLogs) && seed.ingestionLogs.length > 0) {
        const up = await this.upsert(
          'pallets_ingestion_logs',
          seed.ingestionLogs.map(l => this.toIngestionLogRow(l, 'Initial Benchmark')),
          'id'
        );
        if (up.ok && Array.isArray(up.data)) {
          ingestionRows = up.data;
          seededTables.push('pallets_ingestion_logs');
        }
      }

      // 7. Seed Apriori Rules if provided and empty
      let aprioriRows = aprioriRes.ok ? aprioriRes.data : [];
      if (aprioriRes.ok && aprioriRows.length === 0 && Array.isArray(seed.aprioriRules) && seed.aprioriRules.length > 0) {
        const up = await this.upsert(
          'pallets_apriori_rules',
          seed.aprioriRules.map(r => this.toAprioriRuleRow(r)),
          'id'
        );
        if (up.ok && Array.isArray(up.data)) {
          aprioriRows = up.data;
          seededTables.push('pallets_apriori_rules');
        }
      }

      // Group sales and movements by SKU
      const salesBySku = {};
      salesRows.forEach(s => {
        if (!salesBySku[s.sku]) salesBySku[s.sku] = [];
        salesBySku[s.sku].push(s);
      });

      const movementsBySku = {};
      movementRows.forEach(m => {
        if (!movementsBySku[m.sku]) movementsBySku[m.sku] = [];
        movementsBySku[m.sku].push(this.fromMovementRow(m));
      });

      this._setStatus({
        synced: true,
        lastSyncAt: new Date().toISOString(),
        lastError: null,
        mode: 'SUPABASE_LIVE'
      });

      return {
        synced: true,
        seededTables,
        users: userRows.map(r => this.fromUserRow(r)),
        suppliers: supplierRows.map(r => this.fromSupplierRow(r)),
        products: productRows.map(r => this.fromProductRow(r, salesBySku, movementsBySku, seed.generateSalesHistory)),
        ingestionLogs: ingestionRows.map(r => this.fromIngestionLogRow(r)),
        purchaseOrders: poRes.ok ? poRes.data : [],
        aprioriRules: aprioriRows
      };
    }

    // -----------------------------------------------------------------------
    // TARGETED PERSISTENCE HELPERS FOR UI MUTATIONS
    // -----------------------------------------------------------------------

    async saveProduct(product, includeSales = false) {
      if (!this.status.schemaReady || !product) return null;
      const res = await this.upsert('pallets_products', [this.toProductRow(product)], 'sku');
      if (includeSales && Array.isArray(product.salesHistory) && product.salesHistory.length > 0) {
        await this.upsert('pallets_sales_history', this.toSalesRows(product), 'id');
      }
      this._touchSync(res);
      return res;
    }

    async deleteProductBySku(sku) {
      if (!this.status.schemaReady || !sku) return null;
      await this.remove('pallets_sales_history', { sku });
      await this.remove('pallets_inventory_movements', { sku });
      const res = await this.remove('pallets_products', { sku });
      this._touchSync(res);
      return res;
    }

    async saveMovement(sku, productName, storeHub, mov) {
      if (!this.status.schemaReady || !sku || !mov) return null;
      const res = await this.upsert('pallets_inventory_movements', [this.toMovementRow(sku, productName, storeHub, mov)], 'id');
      this._touchSync(res);
      return res;
    }

    async savePurchaseOrder(po) {
      if (!this.status.schemaReady || !po) return null;
      const res = await this.upsert('pallets_purchase_orders', [this.toPurchaseOrderRow(po)], 'po_number');
      this._touchSync(res);
      return res;
    }

    async saveIngestionLog(log, ingestedBy) {
      if (!this.status.schemaReady || !log) return null;
      const res = await this.upsert('pallets_ingestion_logs', [this.toIngestionLogRow(log, ingestedBy)], 'id');
      this._touchSync(res);
      return res;
    }

    async saveForecastRun(payload) {
      if (!this.status.schemaReady || !payload || !payload.result) return null;
      const res = await this.upsert('pallets_forecast_runs', [this.toForecastRunRow(payload)], 'id');
      this._touchSync(res);
      return res;
    }

    async saveAprioriRules(rules, minSupport, minConfidence) {
      if (!this.status.schemaReady || !Array.isArray(rules) || rules.length === 0) return null;
      const res = await this.upsert(
        'pallets_apriori_rules',
        rules.map(r => this.toAprioriRuleRow(r, minSupport, minConfidence)),
        'id'
      );
      this._touchSync(res);
      return res;
    }

    async saveCopilotMessage(entry) {
      if (!this.status.schemaReady || !entry || !entry.prompt) return null;
      const row = {
        id: entry.id || `COP-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        session_id: entry.sessionId || 'SESSION-DEFAULT',
        user_name: entry.userName || 'Operator',
        user_role: entry.userRole || 'Staff',
        prompt: entry.prompt,
        response_text: String(entry.responseText || '').slice(0, 4000),
        source: entry.source || 'COPILOT_ENGINE',
        latency_ms: parseInt(entry.latencyMs ?? 0, 10),
        created_at: new Date().toISOString()
      };
      const res = await this.insert('pallets_copilot_logs', [row]);
      this._touchSync(res);
      return res;
    }

    async saveUser(user) {
      if (!this.status.schemaReady || !user || !user.email) return null;
      const res = await this.upsert('pallets_users', [this.toUserRow(user)], 'email');
      this._touchSync(res);
      return res;
    }

    async findUserByEmail(email) {
      if (!this.status.schemaReady || !email) return null;
      const res = await this.select('pallets_users', {
        filters: { email: String(email).trim().toLowerCase() },
        limit: 1
      });
      if (res.ok && Array.isArray(res.data) && res.data.length > 0) {
        return this.fromUserRow(res.data[0]);
      }
      return null;
    }

    _touchSync(res) {
      if (res && res.ok) {
        this._setStatus({ lastSyncAt: new Date().toISOString(), lastError: null });
      } else if (res && res.error) {
        this._setStatus({ lastError: res.error });
      }
    }
  }

  global.PalletsSupabaseClient = PalletsSupabaseClient;
})(typeof window !== 'undefined' ? window : globalThis);

