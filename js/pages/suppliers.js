/**
 * PALLETS V3 // Workspace 6: Supplier Intelligence
 */
(function (global) {
  'use strict';

  function openSupplierDrawer(sup, state) {
    const F = global.PalletsFormatters;
    const suppliedSkus = state.products.filter((p) => p.supplier === sup.name);
    const supPOs = state.purchaseOrders.filter((po) => po.supplier === sup.name);

    global.PalletsDrawer.open({
      title: sup.name,
      subtitle: `${sup.id} • ${sup.category}`,
      bodyHtml: `
        <div class="kv-grid" style="margin-bottom:16px">
          <div class="kv-cell"><div class="kv-label">Reliability Score</div><div class="kv-value mono text-teal">${sup.reliabilityScore}%</div></div>
          <div class="kv-cell"><div class="kv-label">On-Time Delivery</div><div class="kv-value mono">${sup.onTimeDelivery ?? sup.onTimeDeliveryPct}%</div></div>
          <div class="kv-cell"><div class="kv-label">Lead Time / Default MOQ</div><div class="kv-value mono">${sup.leadTimeDays}d / ${sup.defaultMoq ?? sup.defaultMOQ}u</div></div>
          <div class="kv-cell"><div class="kv-label">Defect Rate</div><div class="kv-value mono ${sup.defectRate > 1 ? 'text-amber' : 'text-teal'}">${sup.defectRate}%</div></div>
        </div>
        <div class="kv-cell" style="margin-bottom:16px">
          <div class="kv-label">Procurement Contact</div>
          <div class="kv-value mono">${F.escapeHtml(sup.contact || sup.contactEmail || 'procurement@partner.in')}</div>
        </div>

        <div class="section-heading" style="margin-bottom:8px">Supplied Catalog SKUs (${suppliedSkus.length})</div>
        <div class="activity-list" style="border:1px solid var(--border-subtle);border-radius:var(--radius-sm);margin-bottom:16px">
          ${suppliedSkus.map((p) => `
            <div class="activity-item">
              <div>
                <div class="activity-title">${F.escapeHtml(p.name)}</div>
                <div class="activity-detail mono">${F.escapeHtml(p.sku)} • On-hand ${p.onHand}u</div>
              </div>
              <span class="mono">${F.formatINR(p.costPrice)}</span>
            </div>
          `).join('') || '<div class="empty-state">No active SKUs mapped to this supplier.</div>'}
        </div>

        <div class="section-heading" style="margin-bottom:8px">Purchase Order History (${supPOs.length})</div>
        <div class="activity-list" style="border:1px solid var(--border-subtle);border-radius:var(--radius-sm)">
          ${supPOs.map((po) => `
            <div class="activity-item">
              <div>
                <div class="activity-title mono">${F.escapeHtml(po.id)} (${po.qty}u)</div>
                <div class="activity-detail">${F.escapeHtml(po.status)} • ${F.formatINR(po.totalCost)}</div>
              </div>
              ${F.outcomeBadge(po.dispatchOutcome)}
            </div>
          `).join('') || '<div class="empty-state">No purchase orders placed yet.</div>'}
        </div>
      `,
      footerHtml: `
        <button type="button" class="btn btn-primary" id="sup-sync-sla-btn">Ping WF-SUPPLIER SLA Check</button>
      `,
      onMount: (el) => {
        el.querySelector('#sup-sync-sla-btn')?.addEventListener('click', async () => {
          const res = await global.PalletsWorkflowAdapter.trigger('SUPPLIER_SLA_CHECK', {
            supplierId: sup.id,
            supplierName: sup.name,
            reliabilityScore: sup.reliabilityScore,
            leadTimeDays: sup.leadTimeDays
          }, 'suppliers');
          global.PalletsEvents.emit('toast', {
            type: res.success ? 'success' : 'warning',
            title: `WF-SUPPLIER: ${res.outcome}`,
            message: `${sup.name} latency ${res.latencyMs}ms`
          });
        });
      }
    });
  }

  function openAddSupplierModal() {
    global.PalletsModal.open({
      title: 'Onboard New FMCG Supplier',
      size: 'sm',
      bodyHtml: `
        <form id="sup-create-form" style="display:flex;flex-direction:column;gap:12px">
          <div id="sup-form-err" class="form-error hidden"></div>
          <div class="form-field"><label class="form-label">Supplier Legal Name</label><input id="sf-name" class="input" required /></div>
          <div class="form-field"><label class="form-label">Category Specialization</label><input id="sf-cat" class="input" value="Multi-Category FMCG" /></div>
          <div class="form-grid">
            <div class="form-field"><label class="form-label">Lead Time (days)</label><input id="sf-lt" type="number" min="1" class="input mono" value="3" /></div>
            <div class="form-field"><label class="form-label">Default MOQ</label><input id="sf-moq" type="number" min="1" class="input mono" value="100" /></div>
          </div>
          <div class="form-field"><label class="form-label">Order Contact Email</label><input id="sf-email" type="email" class="input" placeholder="orders@vendor.in" /></div>
        </form>
      `,
      footerHtml: `
        <button type="button" class="btn btn-ghost" id="sf-cancel">Cancel</button>
        <button type="submit" form="sup-create-form" class="btn btn-primary" id="sf-save">Add Supplier</button>
      `,
      onMount: (el) => {
        el.querySelector('#sf-cancel').addEventListener('click', global.PalletsModal.close);
        el.querySelector('#sup-create-form').addEventListener('submit', async (e) => {
          e.preventDefault();
          const errBox = el.querySelector('#sup-form-err');
          try {
            await global.PalletsDataAdapter.createSupplier({
              name: el.querySelector('#sf-name').value.trim(),
              category: el.querySelector('#sf-cat').value.trim(),
              leadTimeDays: Number(el.querySelector('#sf-lt').value),
              defaultMoq: Number(el.querySelector('#sf-moq').value),
              contact: el.querySelector('#sf-email').value.trim()
            });
            global.PalletsModal.close();
            global.PalletsEvents.emit('toast', { type: 'success', title: 'Supplier Onboarded', message: 'Vendor added to directory.' });
          } catch (err) {
            errBox.textContent = err.message;
            errBox.classList.remove('hidden');
          }
        });
      }
    });
  }

  function renderSuppliers(container, state) {
    const F = global.PalletsFormatters;
    const Table = global.PalletsDataTable;
    const Charts = global.PalletsCharts;

    const suppliers = state.suppliers || [];
    const getOtd = (x) => Number(x.onTimeDelivery ?? x.onTimeDeliveryPct ?? 0);
    const getMoq = (x) => Number(x.defaultMoq ?? x.defaultMOQ ?? 100);
    const avgOtd = suppliers.length > 0
      ? Math.round((suppliers.reduce((s, x) => s + getOtd(x), 0) / suppliers.length) * 10) / 10
      : 0;

    container.innerHTML = `
      <div class="workspace-header">
        <div>
          <h1 class="page-title">Supplier Intelligence</h1>
          <p class="page-subtitle">Vendor SLA scorecards, defect tolerances, MOQ terms, and active fulfillment pipelines (${avgOtd}% avg OTD).</p>
        </div>
        <div class="workspace-actions">
          <button type="button" class="btn btn-primary" id="sup-add-btn">${F.icon('plus', 14)} Onboard Supplier</button>
        </div>
      </div>

      <div class="panel" style="margin-bottom:16px">
        <div class="panel-header">
          <div>
            <div class="section-heading">On-Time Delivery Reliability Across Vendors (%)</div>
            <div class="section-subheading">Click any table row below to inspect full vendor SLA &amp; SKU details</div>
          </div>
        </div>
        <div class="panel-body">
          <div class="chart-wrap"><canvas id="sup-otd-chart" data-height="220"></canvas></div>
        </div>
      </div>

      <div class="panel">
        ${Table.render({
          rows: suppliers,
          pageSize: 10,
          onRowClickAttr: (r) => `data-sup-id="${F.escapeHtml(r.id)}"`,
          rowClassFn: () => 'clickable-row',
          columns: [
            { label: 'ID', key: 'id', render: (r) => `<span class="mono">${F.escapeHtml(r.id)}</span>` },
            { label: 'Supplier Name', key: 'name', render: (r) => `<div style="font-weight:600">${F.escapeHtml(r.name)}</div><div class="text-muted" style="font-size:11px">${F.escapeHtml(r.category)}</div>` },
            { label: 'Lead Time', key: 'leadTimeDays', align: 'right', render: (r) => `<span class="mono">${r.leadTimeDays}d</span>` },
            { label: 'On-Time %', key: 'onTimeDelivery', align: 'right', render: (r) => `<span class="mono ${getOtd(r) >= 95 ? 'text-teal' : 'text-amber'}">${getOtd(r)}%</span>` },
            { label: 'Defect Rate', key: 'defectRate', align: 'right', render: (r) => `<span class="mono">${r.defectRate}%</span>` },
            { label: 'Reliability', key: 'reliabilityScore', align: 'right', render: (r) => `<span class="badge ${r.reliabilityScore >= 97 ? 'badge-optimal' : 'badge-info'} mono">${r.reliabilityScore}/100</span>` },
            { label: 'Default MOQ', key: 'defaultMoq', align: 'right', render: (r) => `<span class="mono">${getMoq(r)}u</span>` },
            {
              label: 'Inspect',
              sortable: false,
              align: 'right',
              render: (r) => `<button type="button" class="btn btn-sm btn-ghost" data-sup-btn="${F.escapeHtml(r.id)}">Profile</button>`
            }
          ]
        })}
      </div>
    `;

    Charts.drawBarChart(
      container.querySelector('#sup-otd-chart'),
      suppliers.map((s) => s.id),
      suppliers.map((s) => getOtd(s)),
      { unit: '%', color: '#21C7A8' }
    );

    container.querySelector('#sup-add-btn')?.addEventListener('click', openAddSupplierModal);
    container.querySelectorAll('[data-sup-id], [data-sup-btn]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = el.getAttribute('data-sup-btn') || el.getAttribute('data-sup-id');
        const sup = suppliers.find((s) => s.id === id);
        if (sup) openSupplierDrawer(sup, state);
      });
    });
  }

  global.PalletsSuppliersPage = { render: renderSuppliers };
})(typeof window !== 'undefined' ? window : globalThis);
