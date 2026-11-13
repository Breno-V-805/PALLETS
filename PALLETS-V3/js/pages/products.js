/**
 * PALLETS V3 // Workspace 2: Product Intelligence
 * Contextual tabs: Catalogue | Product Details | Performance
 */
(function (global) {
  'use strict';

  const localState = {
    category: 'ALL',
    supplier: 'ALL',
    risk: 'ALL',
    viewMode: 'table',
    sortKey: 'name',
    sortDir: 'asc',
    page: 1
  };

  function openProductModal(product = null) {
    const F = global.PalletsFormatters;
    const Calc = global.PalletsCalculations;
    const Store = global.PalletsState.state;
    const isEdit = Boolean(product);
    const categories = ['Plant-Based Beverages', 'Ready-to-Drink Coffee', 'Home Care & Laundry', 'Staples & Grains', 'Dairy & Probiotics', 'Snacks & Confectionery', 'Condiments & Sauces', 'Beverages & Energy'];

    global.PalletsModal.open({
      title: isEdit ? `Edit Product: ${product.sku}` : 'Add New Catalog SKU',
      subtitle: 'All cost, safety stock, target stock, and MOQ thresholds drive automated ROP calculations.',
      size: 'md',
      bodyHtml: `
        <form id="product-form" class="form-grid">
          <div id="prod-form-err" class="form-error hidden form-field full"></div>
          <div class="form-field">
            <label class="form-label" for="pf-sku">SKU Code</label>
            <input type="text" id="pf-sku" class="input mono" value="${F.escapeHtml(product?.sku || '')}" ${isEdit ? 'disabled' : ''} placeholder="SKU-1042-NEW" required />
          </div>
          <div class="form-field">
            <label class="form-label" for="pf-name">Product Name</label>
            <input type="text" id="pf-name" class="input" value="${F.escapeHtml(product?.name || '')}" required />
          </div>
          <div class="form-field">
            <label class="form-label" for="pf-cat">Category</label>
            <select id="pf-cat" class="select">
              ${categories.map((c) => `<option value="${F.escapeHtml(c)}" ${product?.category === c ? 'selected' : ''}>${F.escapeHtml(c)}</option>`).join('')}
            </select>
          </div>
          <div class="form-field">
            <label class="form-label" for="pf-brand">Brand</label>
            <input type="text" id="pf-brand" class="input" value="${F.escapeHtml(product?.brand || '')}" required />
          </div>
          <div class="form-field">
            <label class="form-label" for="pf-hub">Primary Dark Store Hub</label>
            <select id="pf-hub" class="select">
              ${Calc.HUBS.map((h) => `<option value="${F.escapeHtml(h.id)}" ${product?.hub === h.id ? 'selected' : ''}>${F.escapeHtml(h.name)}</option>`).join('')}
            </select>
          </div>
          <div class="form-field">
            <label class="form-label" for="pf-sup">Primary Supplier</label>
            <select id="pf-sup" class="select">
              ${Store.suppliers.map((s) => `<option value="${F.escapeHtml(s.name)}" ${product?.supplier === s.name ? 'selected' : ''}>${F.escapeHtml(s.name)}</option>`).join('')}
            </select>
          </div>
          <div class="form-field">
            <label class="form-label" for="pf-price">Selling Price (INR)</label>
            <input type="number" id="pf-price" class="input mono" min="1" value="${product?.unitPrice ?? 250}" required />
          </div>
          <div class="form-field">
            <label class="form-label" for="pf-cost">Unit Cost (INR)</label>
            <input type="number" id="pf-cost" class="input mono" min="1" value="${product?.costPrice ?? 180}" required />
          </div>
          ${!isEdit ? `
            <div class="form-field">
              <label class="form-label" for="pf-onhand">Initial On-Hand Stock</label>
              <input type="number" id="pf-onhand" class="input mono" min="0" value="300" required />
            </div>
          ` : ''}
          <div class="form-field">
            <label class="form-label" for="pf-demand">Daily Demand (units/day)</label>
            <input type="number" id="pf-demand" class="input mono" min="1" value="${product?.dailyDemand ?? 45}" required />
          </div>
          <div class="form-field">
            <label class="form-label" for="pf-lead">Lead Time (Days)</label>
            <input type="number" id="pf-lead" class="input mono" min="1" value="${product?.leadTimeDays ?? 3}" required />
          </div>
          <div class="form-field">
            <label class="form-label" for="pf-safety">Safety Stock</label>
            <input type="number" id="pf-safety" class="input mono" min="0" value="${product?.safetyStock ?? 120}" required />
          </div>
          <div class="form-field">
            <label class="form-label" for="pf-target">Target Stock</label>
            <input type="number" id="pf-target" class="input mono" min="1" value="${product?.targetStock ?? 600}" required />
          </div>
          <div class="form-field">
            <label class="form-label" for="pf-moq">MOQ</label>
            <input type="number" id="pf-moq" class="input mono" min="1" value="${product?.moq ?? 100}" required />
          </div>
        </form>
      `,
      footerHtml: `
        <button type="button" class="btn btn-ghost" id="pf-cancel">Cancel</button>
        <button type="submit" form="product-form" class="btn btn-primary" id="pf-save">${isEdit ? 'Save Changes' : 'Create Product'}</button>
      `,
      onMount: (el) => {
        el.querySelector('#pf-cancel').addEventListener('click', global.PalletsModal.close);
        el.querySelector('#product-form').addEventListener('submit', async (e) => {
          e.preventDefault();
          const btn = el.querySelector('#pf-save');
          const errBox = el.querySelector('#prod-form-err');
          btn.disabled = true;
          try {
            const payload = {
              sku: el.querySelector('#pf-sku').value.trim(),
              name: el.querySelector('#pf-name').value.trim(),
              category: el.querySelector('#pf-cat').value,
              brand: el.querySelector('#pf-brand').value.trim(),
              hub: el.querySelector('#pf-hub').value,
              supplier: el.querySelector('#pf-sup').value,
              unitPrice: Number(el.querySelector('#pf-price').value),
              costPrice: Number(el.querySelector('#pf-cost').value),
              dailyDemand: Number(el.querySelector('#pf-demand').value),
              leadTimeDays: Number(el.querySelector('#pf-lead').value),
              safetyStock: Number(el.querySelector('#pf-safety').value),
              targetStock: Number(el.querySelector('#pf-target').value),
              moq: Number(el.querySelector('#pf-moq').value)
            };
            if (!isEdit) payload.onHand = Number(el.querySelector('#pf-onhand').value);

            if (isEdit) {
              await global.PalletsDataAdapter.updateProduct(product.sku, payload);
              global.PalletsEvents.emit('toast', { type: 'success', title: 'Product Updated', message: `${product.sku} saved.` });
            } else {
              await global.PalletsDataAdapter.createProduct(payload);
              global.PalletsEvents.emit('toast', { type: 'success', title: 'Product Created', message: `${payload.sku} added to catalog.` });
            }
            global.PalletsModal.close();
          } catch (err) {
            errBox.textContent = err.message;
            errBox.classList.remove('hidden');
            btn.disabled = false;
          }
        });
      }
    });
  }

  function exportCatalogCsv(products) {
    const Calc = global.PalletsCalculations;
    const headers = ['SKU', 'Name', 'Category', 'Brand', 'Hub', 'Supplier', 'OnHand', 'DailyDemand', 'ROP', 'IP', 'RunwayDays', 'Risk', 'CostPrice', 'UnitPrice'];
    const lines = [headers.join(',')];
    products.forEach((p) => {
      lines.push([
        p.sku,
        `"${String(p.name).replace(/"/g, '""')}"`,
        `"${p.category}"`,
        `"${p.brand || ''}"`,
        p.hub,
        `"${p.supplier}"`,
        p.onHand,
        p.dailyDemand,
        Calc.calculateROP(p),
        Calc.calculateIP(p),
        Calc.calculateRunwayDays(p),
        Calc.evaluateRiskStatus(p),
        p.costPrice,
        p.unitPrice
      ].join(','));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pallets-v3-catalog-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function renderProducts(container, state) {
    const F = global.PalletsFormatters;
    const Calc = global.PalletsCalculations;
    const Perms = global.PalletsPermissions;
    const Table = global.PalletsDataTable;
    const Charts = global.PalletsCharts;

    const canManage = Perms.isManagerOrAdmin(state.user);
    const allScoped = global.PalletsState.getScopedProducts().map((p) => ({
      ...p,
      runway: Calc.calculateRunwayDays(p),
      rop: Calc.calculateROP(p),
      ip: Calc.calculateIP(p),
      risk: Calc.evaluateRiskStatus(p),
      valuation: Calc.calculateHoldingValuation(p)
    }));

    const categories = ['ALL', ...Array.from(new Set(allScoped.map((p) => p.category)))];
    const suppliers = ['ALL', ...Array.from(new Set(allScoped.map((p) => p.supplier)))];

    const filtered = allScoped.filter((p) => {
      if (localState.category !== 'ALL' && p.category !== localState.category) return false;
      if (localState.supplier !== 'ALL' && p.supplier !== localState.supplier) return false;
      if (localState.risk !== 'ALL' && p.risk !== localState.risk) return false;
      return true;
    });

    const tab = state.routeTabs.products || 'catalogue';
    const selectedSku = state.selectedProductSku && allScoped.some((p) => p.sku === state.selectedProductSku)
      ? state.selectedProductSku
      : (allScoped[0] ? allScoped[0].sku : null);
    const detailProduct = allScoped.find((p) => p.sku === selectedSku) || null;

    let bodyHtml = '';
    if (tab === 'catalogue') {
      const contentArea = localState.viewMode === 'table'
        ? Table.render({
            rows: filtered,
            sortKey: localState.sortKey,
            sortDir: localState.sortDir,
            page: localState.page,
            pageSize: 8,
            columns: [
              {
                label: 'SKU / Product',
                key: 'name',
                render: (r) => `<div style="font-weight:600">${F.escapeHtml(r.name)}</div><div class="mono text-muted" style="font-size:11px">${F.escapeHtml(r.sku)} • ${F.escapeHtml(r.brand || '')}</div>`
              },
              { label: 'Category', key: 'category', render: (r) => `<span class="text-secondary">${F.escapeHtml(r.category)}</span>` },
              { label: 'Hub', key: 'hub', render: (r) => `<span class="mono">${F.escapeHtml(r.hub)}</span>` },
              { label: 'On-Hand', key: 'onHand', align: 'right', render: (r) => `<span class="mono">${F.formatNumber(r.onHand)}</span>` },
              { label: 'Runway', key: 'runway', align: 'right', render: (r) => `<span class="mono">${r.runway}d</span>` },
              { label: 'Risk', key: 'risk', render: (r) => F.riskBadge(r.risk) },
              { label: 'Valuation', key: 'valuation', align: 'right', render: (r) => `<span class="mono">${F.formatINR(r.valuation)}</span>` },
              {
                label: 'Actions',
                sortable: false,
                align: 'right',
                render: (r) => `
                  <div style="display:inline-flex;gap:6px">
                    <button type="button" class="btn btn-sm btn-ghost" data-view-sku="${F.escapeHtml(r.sku)}">Details</button>
                    ${canManage ? `
                      <button type="button" class="btn btn-sm btn-ghost" data-edit-sku="${F.escapeHtml(r.sku)}" aria-label="Edit ${F.escapeHtml(r.sku)}">${F.icon('edit', 13)}</button>
                      <button type="button" class="btn btn-sm btn-danger" data-del-sku="${F.escapeHtml(r.sku)}" aria-label="Delete ${F.escapeHtml(r.sku)}">${F.icon('trash', 13)}</button>
                    ` : ''}
                  </div>
                `
              }
            ]
          })
        : `<div class="product-card-grid">
            ${filtered.map((p) => {
              const fillPct = Math.min(100, Math.round((p.onHand / Math.max(1, p.targetStock)) * 100));
              const fillColor = p.risk === 'CRITICAL' ? 'var(--accent-red)' : p.risk === 'HIGH' ? 'var(--accent-amber)' : p.risk === 'OVERSTOCK' ? 'var(--accent-blue)' : 'var(--accent-teal)';
              return `
                <div class="product-card">
                  <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start">
                    <div>
                      <div class="mono text-muted" style="font-size:11px">${F.escapeHtml(p.sku)}</div>
                      <div style="font-weight:600;margin-top:2px">${F.escapeHtml(p.name)}</div>
                    </div>
                    ${F.riskBadge(p.risk)}
                  </div>
                  <div class="stock-gauge-track"><div class="stock-gauge-fill" style="width:${fillPct}%;background:${fillColor}"></div></div>
                  <div class="kv-grid">
                    <div class="kv-cell"><div class="kv-label">On-Hand / Target</div><div class="kv-value mono">${p.onHand} / ${p.targetStock}</div></div>
                    <div class="kv-cell"><div class="kv-label">Runway / Demand</div><div class="kv-value mono">${p.runway}d (${p.dailyDemand}/d)</div></div>
                  </div>
                  <div style="display:flex;justify-content:space-between;align-items:center">
                    <span class="mono text-secondary" style="font-size:11px">${F.escapeHtml(p.supplier)}</span>
                    <button type="button" class="btn btn-sm btn-ghost" data-view-sku="${F.escapeHtml(p.sku)}">Inspect</button>
                  </div>
                </div>
              `;
            }).join('') || '<div class="empty-state">No products match active filters.</div>'}
          </div>`;

      bodyHtml = `
        <div class="toolbar-row">
          <div class="toolbar-filters">
            <select id="prod-filter-cat" class="select">
              ${categories.map((c) => `<option value="${F.escapeHtml(c)}" ${localState.category === c ? 'selected' : ''}>${c === 'ALL' ? 'All Categories' : F.escapeHtml(c)}</option>`).join('')}
            </select>
            <select id="prod-filter-sup" class="select">
              ${suppliers.map((s) => `<option value="${F.escapeHtml(s)}" ${localState.supplier === s ? 'selected' : ''}>${s === 'ALL' ? 'All Suppliers' : F.escapeHtml(s)}</option>`).join('')}
            </select>
            <select id="prod-filter-risk" class="select">
              <option value="ALL" ${localState.risk === 'ALL' ? 'selected' : ''}>All Risk Tiers</option>
              <option value="CRITICAL" ${localState.risk === 'CRITICAL' ? 'selected' : ''}>Critical (&lt;=3d)</option>
              <option value="HIGH" ${localState.risk === 'HIGH' ? 'selected' : ''}>High Risk (&lt;=7d)</option>
              <option value="OPTIMAL" ${localState.risk === 'OPTIMAL' ? 'selected' : ''}>Optimal</option>
              <option value="OVERSTOCK" ${localState.risk === 'OVERSTOCK' ? 'selected' : ''}>Overstock (&gt;=35d)</option>
            </select>
          </div>
          <div style="display:flex;gap:6px">
            <button type="button" class="btn btn-sm ${localState.viewMode === 'table' ? 'btn-primary' : 'btn-ghost'}" data-view-mode="table">${F.icon('list', 14)} Table</button>
            <button type="button" class="btn btn-sm ${localState.viewMode === 'grid' ? 'btn-primary' : 'btn-ghost'}" data-view-mode="grid">${F.icon('grid-2x2', 14)} Grid</button>
          </div>
        </div>
        <div class="panel">${localState.viewMode === 'grid' ? `<div class="panel-body">${contentArea}</div>` : contentArea}</div>
      `;
    } else if (tab === 'details') {
      const supObj = detailProduct ? state.suppliers.find((s) => s.name === detailProduct.supplier) : null;
      bodyHtml = detailProduct
        ? `
          <div class="toolbar-row">
            <div class="toolbar-filters">
              <select id="prod-detail-select" class="select" style="min-width:290px">
                ${allScoped.map((p) => `<option value="${F.escapeHtml(p.sku)}" ${p.sku === detailProduct.sku ? 'selected' : ''}>${F.escapeHtml(p.sku)} — ${F.escapeHtml(p.name)}</option>`).join('')}
              </select>
            </div>
            ${canManage ? `<button type="button" class="btn btn-ghost" id="pd-edit-btn">${F.icon('edit', 14)} Edit SKU Specs</button>` : ''}
          </div>
          <div class="command-grid-equal">
            <div class="panel">
              <div class="panel-header">
                <div>
                  <div class="section-heading">${F.escapeHtml(detailProduct.name)}</div>
                  <div class="section-subheading mono">${F.escapeHtml(detailProduct.sku)} • ${F.escapeHtml(detailProduct.category)} • Brand: ${F.escapeHtml(detailProduct.brand || '—')}</div>
                </div>
                ${F.riskBadge(detailProduct.risk)}
              </div>
              <div class="panel-body">
                <div class="kv-grid">
                  <div class="kv-cell"><div class="kv-label">On-Hand / Reserved / On-Order</div><div class="kv-value mono">${detailProduct.onHand} / ${detailProduct.reserved} / ${detailProduct.onOrder}</div></div>
                  <div class="kv-cell"><div class="kv-label">Inventory Position (IP) &amp; ROP</div><div class="kv-value mono">${detailProduct.ip}u / ROP ${detailProduct.rop}u</div></div>
                  <div class="kv-cell"><div class="kv-label">Daily Burn &amp; Runway</div><div class="kv-value mono">${detailProduct.dailyDemand}u/d • ${detailProduct.runway} days</div></div>
                  <div class="kv-cell"><div class="kv-label">Recommended Order (MOQ ${detailProduct.moq})</div><div class="kv-value mono text-blue">${Calc.calculateRecommendedOrderQuantity(detailProduct)} units</div></div>
                  <div class="kv-cell"><div class="kv-label">Unit Price / Cost</div><div class="kv-value mono">${F.formatINR(detailProduct.unitPrice)} / ${F.formatINR(detailProduct.costPrice)}</div></div>
                  <div class="kv-cell"><div class="kv-label">Supplier SLA</div><div class="kv-value">${F.escapeHtml(detailProduct.supplier)} (${supObj ? `${supObj.onTimeDelivery ?? supObj.onTimeDeliveryPct}% OTD` : `${detailProduct.leadTimeDays}d LT`})</div></div>
                </div>
              </div>
            </div>

            <div class="panel">
              <div class="panel-header">
                <div>
                  <div class="section-heading">Inventory by Dark Store Hub</div>
                  <div class="section-subheading">Network stock distribution across hubs</div>
                </div>
              </div>
              <div class="panel-body">
                <div class="chart-wrap"><canvas id="pd-hub-chart" data-height="210"></canvas></div>
              </div>
            </div>
          </div>

          <div class="command-grid-equal">
            <div class="panel">
              <div class="panel-header"><div class="section-heading">90-Day Sales Demand History</div></div>
              <div class="panel-body"><div class="chart-wrap"><canvas id="pd-history-chart" data-height="230"></canvas></div></div>
            </div>
            <div class="panel">
              <div class="panel-header"><div class="section-heading">Recent Movement Audit Trail</div></div>
              <div class="panel-body tight">
                <div class="activity-list">
                  ${(detailProduct.movements || []).slice(0, 8).map((m) => `
                    <div class="activity-item">
                      <div>
                        <div class="activity-title"><span class="mono">${F.escapeHtml(m.type)}</span> (${m.qty > 0 ? '+' : ''}${m.qty}u)</div>
                        <div class="activity-detail">Ref: ${F.escapeHtml(m.ref)} • Actor: ${F.escapeHtml(m.user)}</div>
                      </div>
                      <div class="activity-meta mono">${F.escapeHtml(m.date)}</div>
                    </div>
                  `).join('') || '<div class="empty-state">No movement logs recorded.</div>'}
                </div>
              </div>
            </div>
          </div>
        `
        : '<div class="panel panel-body"><div class="empty-state">No SKUs available in scope.</div></div>';
    } else {
      const perfSorted = [...allScoped].sort((a, b) => (b.dailyDemand * b.unitPrice) - (a.dailyDemand * a.unitPrice));
      bodyHtml = `
        <div class="panel">
          <div class="panel-header">
            <div>
              <div class="section-heading">SKU Revenue Velocity & Margin Exposure</div>
              <div class="section-subheading">Ranked by daily gross revenue contribution</div>
            </div>
          </div>
          ${Table.render({
            rows: perfSorted,
            pageSize: 12,
            columns: [
              { label: 'SKU', key: 'sku', render: (r) => `<span class="mono">${F.escapeHtml(r.sku)}</span>` },
              { label: 'Product', key: 'name' },
              { label: 'Gross Margin %', sortable: false, align: 'right', render: (r) => `<span class="mono text-teal">${Math.round(((r.unitPrice - r.costPrice) / Math.max(1, r.unitPrice)) * 100)}%</span>` },
              { label: 'Daily Revenue Run-Rate', sortable: false, align: 'right', render: (r) => `<span class="mono">${F.formatINR(r.dailyDemand * r.unitPrice)}</span>` },
              { label: 'Stockout Lost Revenue Exposure', sortable: false, align: 'right', render: (r) => `<span class="mono text-red">${F.formatINR(Calc.calculateLostRevenue(r))}</span>` },
              { label: 'Risk Tier', key: 'risk', render: (r) => F.riskBadge(r.risk) }
            ]
          })}
        </div>
      `;
    }

    container.innerHTML = `
      <div class="workspace-header">
        <div>
          <h1 class="page-title">Product Intelligence</h1>
          <p class="page-subtitle">Master FMCG SKU repository with replenishment thresholds, hub allocation, and unit economics.</p>
        </div>
        <div class="workspace-actions">
          <button type="button" class="btn btn-ghost" id="prod-export-csv">${F.icon('download', 14)} Export CSV</button>
          ${canManage ? `<button type="button" class="btn btn-primary" id="prod-add-btn">${F.icon('plus', 14)} Add Product</button>` : ''}
        </div>
      </div>

      <div class="context-tabs">
        <button type="button" class="context-tab ${tab === 'catalogue' ? 'active' : ''}" data-ptab="catalogue">Catalogue</button>
        <button type="button" class="context-tab ${tab === 'details' ? 'active' : ''}" data-ptab="details">Product Details</button>
        <button type="button" class="context-tab ${tab === 'performance' ? 'active' : ''}" data-ptab="performance">Performance</button>
      </div>

      ${bodyHtml}
    `;

    container.querySelectorAll('[data-ptab]').forEach((b) => {
      b.addEventListener('click', () => global.PalletsRouter.setContextualTab('products', b.getAttribute('data-ptab')));
    });
    container.querySelector('#prod-export-csv')?.addEventListener('click', () => exportCatalogCsv(filtered));
    container.querySelector('#prod-add-btn')?.addEventListener('click', () => openProductModal(null));
    container.querySelector('#prod-filter-cat')?.addEventListener('change', (e) => { localState.category = e.target.value; localState.page = 1; renderProducts(container, global.PalletsState.state); });
    container.querySelector('#prod-filter-sup')?.addEventListener('change', (e) => { localState.supplier = e.target.value; localState.page = 1; renderProducts(container, global.PalletsState.state); });
    container.querySelector('#prod-filter-risk')?.addEventListener('change', (e) => { localState.risk = e.target.value; localState.page = 1; renderProducts(container, global.PalletsState.state); });
    container.querySelectorAll('[data-view-mode]').forEach((b) => {
      b.addEventListener('click', () => { localState.viewMode = b.getAttribute('data-view-mode'); renderProducts(container, global.PalletsState.state); });
    });

    container.querySelectorAll('[data-sort-key]').forEach((th) => {
      th.addEventListener('click', () => {
        const key = th.getAttribute('data-sort-key');
        localState.sortDir = localState.sortKey === key && localState.sortDir === 'asc' ? 'desc' : 'asc';
        localState.sortKey = key;
        renderProducts(container, global.PalletsState.state);
      });
    });
    container.querySelectorAll('[data-page]').forEach((btn) => {
      btn.addEventListener('click', () => { localState.page = Number(btn.getAttribute('data-page')); renderProducts(container, global.PalletsState.state); });
    });
    container.querySelectorAll('[data-view-sku]').forEach((btn) => {
      btn.addEventListener('click', () => {
        global.PalletsState.setState({ selectedProductSku: btn.getAttribute('data-view-sku') });
        global.PalletsRouter.setContextualTab('products', 'details');
      });
    });
    container.querySelectorAll('[data-edit-sku]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = state.products.find((p) => p.sku === btn.getAttribute('data-edit-sku'));
        if (target) openProductModal(target);
      });
    });
    container.querySelectorAll('[data-del-sku]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const sku = btn.getAttribute('data-del-sku');
        global.PalletsModal.confirm({
          title: `Delete SKU ${sku}`,
          message: `Permanently remove "${sku}" from active inventory management?`,
          confirmLabel: 'Delete SKU',
          danger: true,
          onConfirm: async () => {
            await global.PalletsDataAdapter.deleteProduct(sku);
            global.PalletsEvents.emit('toast', { type: 'success', title: 'Deleted', message: `${sku} removed.` });
          }
        });
      });
    });

    container.querySelector('#prod-detail-select')?.addEventListener('change', (e) => {
      global.PalletsState.setState({ selectedProductSku: e.target.value });
    });
    container.querySelector('#pd-edit-btn')?.addEventListener('click', () => {
      if (detailProduct) openProductModal(detailProduct);
    });

    if (tab === 'details' && detailProduct) {
      const hubLabels = Calc.HUBS.map((h) => h.code);
      const hubVals = Calc.HUBS.map((h) => Number(detailProduct.hubStocks?.[h.id] ?? (detailProduct.hub === h.id ? detailProduct.onHand : 0)));
      Charts.drawBarChart(container.querySelector('#pd-hub-chart'), hubLabels, hubVals, { unit: 'u', color: '#4F8CFF' });

      const tail = (detailProduct.salesHistory || []).slice(-21);
      const dLabels = tail.map((_, idx) => `D-${tail.length - idx}`);
      Charts.drawSplineChart(container.querySelector('#pd-history-chart'), dLabels, tail, tail.map(() => detailProduct.dailyDemand), {
        primaryLabel: 'Units Sold',
        secondaryLabel: 'Avg Daily Demand'
      });
    }
  }

  global.PalletsProductsPage = { render: renderProducts };
})(typeof window !== 'undefined' ? window : globalThis);
