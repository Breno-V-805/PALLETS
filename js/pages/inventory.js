/**
 * PALLETS V3 // Workspace 3: Inventory Control
 * Contextual tabs: Overview | Stock Levels | Movements | Adjustments
 */
(function (global) {
  'use strict';

  function renderInventory(container, state) {
    const F = global.PalletsFormatters;
    const Calc = global.PalletsCalculations;
    const Perms = global.PalletsPermissions;
    const Table = global.PalletsDataTable;
    const Metric = global.PalletsMetricCard;

    const tab = state.routeTabs.inventory || 'overview';
    const products = global.PalletsState.getScopedProducts();
    const canTransfer = Perms.isManagerOrAdmin(state.user);

    const lowStock = products.filter((p) => ['CRITICAL', 'HIGH'].includes(Calc.evaluateRiskStatus(p)));
    const overStock = products.filter((p) => Calc.evaluateRiskStatus(p) === 'OVERSTOCK');
    const totalOnHand = products.reduce((a, b) => a + Number(b.onHand || 0), 0);
    const totalOnOrder = products.reduce((a, b) => a + Number(b.onOrder || 0), 0);

    const allMovements = [];
    products.forEach((p) => {
      (p.movements || []).forEach((m) => {
        allMovements.push({ ...m, sku: p.sku, productName: p.name, hub: p.hub });
      });
    });
    allMovements.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    let bodyHtml = '';
    if (tab === 'overview') {
      bodyHtml = `
        <div class="kpi-strip" style="grid-template-columns:repeat(4,minmax(0,1fr))">
          ${Metric.render({ label: 'Total Units On-Hand', value: F.formatNumber(totalOnHand), meta: 'Physical warehouse stock', tone: 'blue', iconName: 'boxes' })}
          ${Metric.render({ label: 'Units In Transit (On-Order)', value: F.formatNumber(totalOnOrder), meta: 'Inbound PO pipeline', tone: 'teal', iconName: 'truck' })}
          ${Metric.render({ label: 'ROP Breach / Low Stock', value: String(lowStock.length), meta: 'Immediate cycle watch', tone: lowStock.length > 0 ? 'red' : 'teal', iconName: 'alert-triangle' })}
          ${Metric.render({ label: 'Overstock Buffers', value: String(overStock.length), meta: '>= 35 days holding bleed', tone: 'purple', iconName: 'package' })}
        </div>

        <div class="command-grid-equal">
          <div class="panel">
            <div class="panel-header"><div class="section-heading">Dark Store Facility Utilization</div></div>
            <div class="panel-body tight">
              <div class="activity-list">
                ${(state.hubs || Calc.HUBS).map((h) => {
                  const hubUnits = products.reduce((s, p) => s + Number(p.hubStocks?.[h.id] ?? (p.hub === h.id ? p.onHand : 0)), 0);
                  const hubVal = products.reduce((s, p) => s + Number(p.hubStocks?.[h.id] ?? (p.hub === h.id ? p.onHand : 0)) * Number(p.costPrice || 0), 0);
                  return `
                    <div class="activity-item">
                      <div>
                        <div class="activity-title">${F.escapeHtml(h.name)}</div>
                        <div class="activity-detail mono">${F.escapeHtml(h.id)} • Region: ${F.escapeHtml(h.region)}</div>
                      </div>
                      <div style="text-align:right">
                        <div class="mono" style="font-weight:600">${F.formatNumber(hubUnits)}u</div>
                        <div class="mono text-secondary" style="font-size:11px">${F.formatCompactINR(hubVal)}</div>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          </div>

          <div class="panel">
            <div class="panel-header"><div class="section-heading">Reorder Point Watchlist</div></div>
            <div class="panel-body tight">
              ${Table.render({
                rows: lowStock,
                pageSize: 5,
                emptyTitle: 'No low stock breaches',
                emptySubtitle: 'All SKUs currently exceed high-risk thresholds.',
                columns: [
                  { label: 'SKU', key: 'sku', render: (r) => `<span class="mono">${F.escapeHtml(r.sku)}</span>` },
                  { label: 'On-Hand', key: 'onHand', align: 'right', render: (r) => `<span class="mono">${r.onHand}</span>` },
                  { label: 'ROP', sortable: false, align: 'right', render: (r) => `<span class="mono">${Calc.calculateROP(r)}</span>` },
                  { label: 'Risk', sortable: false, render: (r) => F.riskBadge(Calc.evaluateRiskStatus(r)) }
                ]
              })}
            </div>
          </div>
        </div>
      `;
    } else if (tab === 'levels') {
      bodyHtml = `
        <div class="panel">
          <div class="panel-header">
            <div>
              <div class="section-heading">Real-Time Inventory Position & Multi-Hub Levels</div>
              <div class="section-subheading">IP = On-Hand + On-Order − Reserved • ROP = (Daily Demand × Lead Time) + Safety Stock</div>
            </div>
          </div>
          ${Table.render({
            rows: products,
            pageSize: 12,
            columns: [
              { label: 'SKU / Item', key: 'name', render: (r) => `<div style="font-weight:600">${F.escapeHtml(r.name)}</div><div class="mono text-muted" style="font-size:11px">${F.escapeHtml(r.sku)} • ${F.escapeHtml(r.hub)}</div>` },
              { label: 'On-Hand', key: 'onHand', align: 'right', render: (r) => `<span class="mono">${r.onHand}</span>` },
              { label: 'Reserved', key: 'reserved', align: 'right', render: (r) => `<span class="mono">${r.reserved}</span>` },
              { label: 'On-Order', key: 'onOrder', align: 'right', render: (r) => `<span class="mono text-blue">${r.onOrder}</span>` },
              { label: 'IP', sortable: false, align: 'right', render: (r) => `<span class="mono">${Calc.calculateIP(r)}</span>` },
              { label: 'ROP', sortable: false, align: 'right', render: (r) => `<span class="mono">${Calc.calculateROP(r)}</span>` },
              { label: 'Runway', sortable: false, align: 'right', render: (r) => `<span class="mono">${Calc.calculateRunwayDays(r)}d</span>` },
              { label: 'Status', sortable: false, render: (r) => F.riskBadge(Calc.evaluateRiskStatus(r)) }
            ]
          })}
        </div>
      `;
    } else if (tab === 'movements') {
      bodyHtml = `
        <div class="panel">
          <div class="panel-header">
            <div>
              <div class="section-heading">Immutable Movement Audit Ledger</div>
              <div class="section-subheading">Every receipt, POS sale, transfer, and physical stock count</div>
            </div>
          </div>
          ${Table.render({
            rows: allMovements,
            pageSize: 12,
            columns: [
              { label: 'Movement ID', key: 'id', render: (r) => `<span class="mono">${F.escapeHtml(r.id)}</span>` },
              { label: 'SKU / Hub', key: 'sku', render: (r) => `<div class="mono">${F.escapeHtml(r.sku)}</div><div class="text-muted" style="font-size:11px">${F.escapeHtml(r.hub)}</div>` },
              { label: 'Type', key: 'type', render: (r) => `<span class="badge badge-neutral">${F.escapeHtml(r.type)}</span>` },
              { label: 'Delta Qty', key: 'qty', align: 'right', render: (r) => `<span class="mono ${r.qty >= 0 ? 'text-teal' : 'text-red'}">${r.qty > 0 ? '+' : ''}${r.qty}</span>` },
              { label: 'Reference', key: 'ref' },
              { label: 'Operator', key: 'user' },
              { label: 'Recorded', key: 'date', render: (r) => `<span class="mono text-secondary">${F.escapeHtml(r.date)}</span>` }
            ]
          })}
        </div>
      `;
    } else {
      bodyHtml = `
        <div class="command-grid-equal">
          <div class="panel">
            <div class="panel-header">
              <div>
                <div class="section-heading">Physical Stock Adjustment / Cycle Count</div>
                <div class="section-subheading">${canTransfer ? 'Record physical count variance or shrinkage across any hub' : `Scoped to your assigned facility: ${state.user.storeAccess}`}</div>
              </div>
            </div>
            <form id="inv-adj-form" class="panel-body" style="display:flex;flex-direction:column;gap:12px">
              <div id="adj-err" class="form-error hidden"></div>
              <div class="form-field">
                <label class="form-label" for="adj-sku">Target SKU</label>
                <select id="adj-sku" class="select">
                  ${products.map((p) => `<option value="${F.escapeHtml(p.sku)}">${F.escapeHtml(p.sku)} — ${F.escapeHtml(p.name)} (${p.onHand}u @ ${p.hub})</option>`).join('')}
                </select>
              </div>
              <div class="form-grid">
                <div class="form-field">
                  <label class="form-label" for="adj-delta">Quantity Delta (+/- integers)</label>
                  <input type="number" id="adj-delta" class="input mono" placeholder="-12 or +25" required />
                </div>
                <div class="form-field">
                  <label class="form-label" for="adj-reason">Adjustment Reason</label>
                  <select id="adj-reason" class="select">
                    <option value="STOCK_COUNT">Cycle Count Variance</option>
                    <option value="DAMAGED_EXPIRED">Damaged / Spoilage Write-Off</option>
                    <option value="RETURN_RESTOCK">Customer Return Restock</option>
                    <option value="INBOUND_MANUAL">Manual Receipt Correction</option>
                  </select>
                </div>
              </div>
              <div class="form-field">
                <label class="form-label" for="adj-notes">Audit Notes / Slip Ref</label>
                <input type="text" id="adj-notes" class="input" placeholder="e.g. Bay A3 evening audit" />
              </div>
              <button type="submit" id="adj-submit-btn" class="btn btn-primary">Commit Idempotent Adjustment</button>
            </form>
          </div>

          <div class="panel">
            <div class="panel-header">
              <div>
                <div class="section-heading">Inter-Hub Stock Transfer</div>
                <div class="section-subheading">Rebalance stock between dark store facilities</div>
              </div>
              ${!canTransfer ? '<span class="badge badge-warning">Manager / Admin Only</span>' : ''}
            </div>
            ${canTransfer ? `
              <form id="inv-trf-form" class="panel-body" style="display:flex;flex-direction:column;gap:12px">
                <div id="trf-err" class="form-error hidden"></div>
                <div class="form-field">
                  <label class="form-label" for="trf-sku">SKU to Transfer</label>
                  <select id="trf-sku" class="select">
                    ${products.map((p) => `<option value="${F.escapeHtml(p.sku)}">${F.escapeHtml(p.sku)} — ${F.escapeHtml(p.name)}</option>`).join('')}
                  </select>
                </div>
                <div class="form-grid">
                  <div class="form-field">
                    <label class="form-label" for="trf-from">Source Hub</label>
                    <select id="trf-from" class="select">
                      ${Calc.HUBS.map((h) => `<option value="${F.escapeHtml(h.id)}">${F.escapeHtml(h.code)} — ${F.escapeHtml(h.name)}</option>`).join('')}
                    </select>
                  </div>
                  <div class="form-field">
                    <label class="form-label" for="trf-to">Destination Hub</label>
                    <select id="trf-to" class="select">
                      ${Calc.HUBS.map((h, i) => `<option value="${F.escapeHtml(h.id)}" ${i === 1 ? 'selected' : ''}>${F.escapeHtml(h.code)} — ${F.escapeHtml(h.name)}</option>`).join('')}
                    </select>
                  </div>
                </div>
                <div class="form-field">
                  <label class="form-label" for="trf-qty">Transfer Quantity</label>
                  <input type="number" id="trf-qty" class="input mono" min="1" value="25" required />
                </div>
                <button type="submit" id="trf-submit-btn" class="btn btn-teal">${F.icon('arrow-right-left', 14)} Execute Inter-Hub Transfer</button>
              </form>
            ` : `
              <div class="panel-body">
                <div class="empty-state">
                  <div class="empty-title">Role Restriction Active</div>
                  <div class="empty-sub">Inter-hub stock transfers require Inventory Manager or Administrator clearance.</div>
                </div>
              </div>
            `}
          </div>
        </div>
      `;
    }

    container.innerHTML = `
      <div class="workspace-header">
        <div>
          <h1 class="page-title">Inventory Control</h1>
          <p class="page-subtitle">Real-time dark store stock positions, movement audit logs, physical cycle counts, and rebalancing.</p>
        </div>
      </div>

      <div class="context-tabs">
        <button type="button" class="context-tab ${tab === 'overview' ? 'active' : ''}" data-itab="overview">Overview</button>
        <button type="button" class="context-tab ${tab === 'levels' ? 'active' : ''}" data-itab="levels">Stock Levels</button>
        <button type="button" class="context-tab ${tab === 'movements' ? 'active' : ''}" data-itab="movements">Movements</button>
        <button type="button" class="context-tab ${tab === 'adjustments' ? 'active' : ''}" data-itab="adjustments">Adjustments</button>
      </div>

      ${bodyHtml}
    `;

    container.querySelectorAll('[data-itab]').forEach((b) => {
      b.addEventListener('click', () => global.PalletsRouter.setContextualTab('inventory', b.getAttribute('data-itab')));
    });

    const adjForm = container.querySelector('#inv-adj-form');
    if (adjForm) {
      adjForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const errBox = container.querySelector('#adj-err');
        const btn = container.querySelector('#adj-submit-btn');
        errBox.classList.add('hidden');
        btn.disabled = true;
        try {
          const sku = container.querySelector('#adj-sku').value;
          const delta = Number(container.querySelector('#adj-delta').value);
          const reason = container.querySelector('#adj-reason').value;
          const notes = container.querySelector('#adj-notes').value.trim();
          await global.PalletsDataAdapter.adjustStock({ sku, delta, reason, notes });
          global.PalletsEvents.emit('toast', { type: 'success', title: 'Stock Adjusted', message: `${sku} updated by ${delta > 0 ? '+' : ''}${delta}u.` });
        } catch (err) {
          errBox.textContent = err.message;
          errBox.classList.remove('hidden');
          btn.disabled = false;
        }
      });
    }

    const trfForm = container.querySelector('#inv-trf-form');
    if (trfForm) {
      trfForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const errBox = container.querySelector('#trf-err');
        const btn = container.querySelector('#trf-submit-btn');
        errBox.classList.add('hidden');
        btn.disabled = true;
        try {
          const sku = container.querySelector('#trf-sku').value;
          const fromHub = container.querySelector('#trf-from').value;
          const toHub = container.querySelector('#trf-to').value;
          const qty = Number(container.querySelector('#trf-qty').value);
          await global.PalletsDataAdapter.transferStock({ sku, fromHub, toHub, qty });
          global.PalletsEvents.emit('toast', { type: 'success', title: 'Transfer Completed', message: `${qty}u of ${sku} moved ${fromHub} -> ${toHub}.` });
        } catch (err) {
          errBox.textContent = err.message;
          errBox.classList.remove('hidden');
          btn.disabled = false;
        }
      });
    }
  }

  global.PalletsInventoryPage = { render: renderInventory };
})(typeof window !== 'undefined' ? window : globalThis);

