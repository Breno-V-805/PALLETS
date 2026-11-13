/**
 * PALLETS V3 // Workspace 5: Replenishment Center
 * Exact Math: ROP = (Daily Demand * Lead Time) + Safety Stock | IP = On-Hand + On-Order - Reserved | Q = ceil(max(0, Target - IP)/MOQ)*MOQ
 * Supports individual & bulk PO creation, approval, rejection, receipt, idempotency, and honest WF-REPLENISH dispatch.
 */
(function (global) {
  'use strict';

  const localState = {
    selectedSkus: new Set()
  };

  async function dispatchReplenishmentWebhook(orders, idemKey) {
    for (const po of orders) {
      const wfRes = await global.PalletsWorkflowAdapter.trigger(
        'PROCUREMENT_APPROVAL',
        {
          poId: po.id,
          sku: po.sku,
          productName: po.productName,
          hub: po.hub,
          units: po.qty,
          supplier: po.supplier,
          totalCost: po.totalCost,
          rationale: po.rationale
        },
        'replenishment',
        { idempotencyKey: `${idemKey}-${po.id}` }
      );

      await global.PalletsDataAdapter.updatePurchaseOrder(po.id, {
        dispatchOutcome: wfRes.outcome,
        dispatchLatencyMs: wfRes.latencyMs,
        dispatchError: wfRes.error || null
      });
    }
  }

  function openSinglePOModal(rec) {
    const F = global.PalletsFormatters;
    const totalCost = rec.suggestedQ * rec.costPrice;

    global.PalletsModal.open({
      title: `Confirm Purchase Order: ${rec.sku}`,
      subtitle: `${rec.name} -> ${rec.supplier} (${rec.hub})`,
      size: 'md',
      bodyHtml: `
        <div class="kv-grid" style="margin-bottom:14px">
          <div class="kv-cell"><div class="kv-label">Inventory Position (IP) vs ROP</div><div class="kv-value mono">${rec.ip}u vs ROP ${rec.rop}u</div></div>
          <div class="kv-cell"><div class="kv-label">MOQ-Aligned Quantity</div><div class="kv-value mono text-blue">${rec.suggestedQ} units (MOQ ${rec.moq})</div></div>
          <div class="kv-cell"><div class="kv-label">Estimated Total PO Cost</div><div class="kv-value mono text-teal">${F.formatINR(totalCost)}</div></div>
          <div class="kv-cell"><div class="kv-label">Stock Runway Remaining</div><div class="kv-value mono text-red">${rec.runway} days</div></div>
        </div>
        <div class="form-field">
          <label class="form-label" for="po-custom-qty">Final Order Units (multiple of MOQ ${rec.moq} recommended)</label>
          <input type="number" id="po-custom-qty" class="input mono" min="1" value="${rec.suggestedQ}" />
        </div>
        <div class="form-field" style="margin-top:10px">
          <label class="form-label" for="po-rationale">Procurement Rationale</label>
          <input type="text" id="po-rationale" class="input" value="Deficit breach: Runway ${rec.runway}d <= Lead Time ${rec.leadTimeDays}d. ROP=${rec.rop}, IP=${rec.ip}." />
        </div>
        <div id="po-modal-err" class="form-error hidden" style="margin-top:10px"></div>
      `,
      footerHtml: `
        <button type="button" class="btn btn-ghost" id="po-cancel-btn">Cancel</button>
        <button type="button" class="btn btn-ghost" id="po-draft-btn">Save Pending PO</button>
        <button type="button" class="btn btn-primary" id="po-approve-btn">Approve &amp; Dispatch WF-REPLENISH</button>
      `,
      onMount: (el) => {
        el.querySelector('#po-cancel-btn').addEventListener('click', global.PalletsModal.close);

        const submitOrder = async (approveNow) => {
          const errBox = el.querySelector('#po-modal-err');
          const qty = Number(el.querySelector('#po-custom-qty').value);
          const rationale = el.querySelector('#po-rationale').value.trim();
          el.querySelector('#po-approve-btn').disabled = true;
          el.querySelector('#po-draft-btn').disabled = true;
          try {
            const idemKey = global.PalletsDataAdapter.makeIdempotencyKey('PO');
            const created = await global.PalletsDataAdapter.createPurchaseOrders([{ sku: rec.sku, qty, rationale }], approveNow, idemKey);
            if (approveNow) {
              await dispatchReplenishmentWebhook(created.orders, idemKey);
            }
            global.PalletsModal.close();
            global.PalletsEvents.emit('toast', {
              type: 'success',
              title: approveNow ? 'PO Approved & Dispatched' : 'Pending PO Saved',
              message: `${created.order.id} (${qty}u of ${rec.sku})`
            });
          } catch (err) {
            errBox.textContent = err.message;
            errBox.classList.remove('hidden');
            el.querySelector('#po-approve-btn').disabled = false;
            el.querySelector('#po-draft-btn').disabled = false;
          }
        };

        el.querySelector('#po-draft-btn').addEventListener('click', () => submitOrder(false));
        el.querySelector('#po-approve-btn').addEventListener('click', () => submitOrder(true));
      }
    });
  }

  function renderReplenishment(container, state) {
    const F = global.PalletsFormatters;
    const Calc = global.PalletsCalculations;
    const Table = global.PalletsDataTable;
    const Metric = global.PalletsMetricCard;

    const tab = state.routeTabs.replenishment || 'recommendations';
    const products = global.PalletsState.getScopedProducts();

    const recs = products
      .map((p) => {
        const ip = Calc.calculateIP(p);
        const rop = Calc.calculateROP(p);
        const suggestedQ = Calc.calculateRecommendedOrderQuantity(p);
        const runway = Calc.calculateRunwayDays(p);
        const risk = Calc.evaluateRiskStatus(p);
        return {
          ...p,
          ip,
          rop,
          suggestedQ,
          runway,
          risk,
          estCost: suggestedQ * Number(p.costPrice || 0),
          needsOrder: ip <= rop || suggestedQ > 0
        };
      })
      .filter((r) => r.suggestedQ > 0)
      .sort((a, b) => a.runway - b.runway);

    const pos = state.purchaseOrders || [];
    const pendingPOs = pos.filter((p) => p.status === 'PENDING');
    const approvedPOs = pos.filter((p) => p.status === 'APPROVED');

    const totalRecCost = recs.reduce((s, r) => s + r.estCost, 0);

    let bodyHtml = '';
    if (tab === 'recommendations') {
      const selectedCount = Array.from(localState.selectedSkus).filter((sku) => recs.some((r) => r.sku === sku)).length;
      bodyHtml = `
        <div class="toolbar-row">
          <div class="section-subheading">Select SKUs below ROP/Target Stock to raise Purchase Orders individually or in bulk.</div>
          <div style="display:flex;gap:8px;align-items:center">
            <button type="button" class="btn btn-sm btn-ghost" id="rep-select-critical">Select Critical/High (${recs.filter((r) => r.risk === 'CRITICAL' || r.risk === 'HIGH').length})</button>
            <button type="button" class="btn btn-primary" id="rep-bulk-approve" ${selectedCount === 0 ? 'disabled' : ''}>
              ${F.icon('send', 14)} Bulk Approve (${selectedCount}) &amp; Dispatch
            </button>
          </div>
        </div>

        <div class="panel">
          ${Table.render({
            rows: recs,
            pageSize: 12,
            emptyTitle: 'Zero replenishment deficits',
            emptySubtitle: 'All active SKUs meet or exceed target stock levels.',
            columns: [
              {
                label: 'Select',
                sortable: false,
                render: (r) => `<input type="checkbox" class="rep-chk" data-rep-sku="${F.escapeHtml(r.sku)}" ${localState.selectedSkus.has(r.sku) ? 'checked' : ''} aria-label="Select ${F.escapeHtml(r.sku)}" />`
              },
              { label: 'SKU / Product', key: 'name', render: (r) => `<div style="font-weight:600">${F.escapeHtml(r.name)}</div><div class="mono text-muted" style="font-size:11px">${F.escapeHtml(r.sku)} • ${F.escapeHtml(r.supplier)}</div>` },
              { label: 'Risk', key: 'risk', render: (r) => F.riskBadge(r.risk) },
              { label: 'IP / Target', sortable: false, align: 'right', render: (r) => `<span class="mono">${r.ip} / ${r.targetStock}</span>` },
              { label: 'ROP', key: 'rop', align: 'right', render: (r) => `<span class="mono">${r.rop}</span>` },
              { label: 'Order Qty (MOQ)', key: 'suggestedQ', align: 'right', render: (r) => `<span class="mono text-blue">${F.formatNumber(r.suggestedQ)} <span class="text-muted">(min ${r.moq})</span></span>` },
              { label: 'Est. PO Cost', key: 'estCost', align: 'right', render: (r) => `<span class="mono">${F.formatINR(r.estCost)}</span>` },
              {
                label: 'Action',
                sortable: false,
                align: 'right',
                render: (r) => `<button type="button" class="btn btn-sm btn-primary" data-create-po="${F.escapeHtml(r.sku)}">Review PO</button>`
              }
            ]
          })}
        </div>
      `;
    } else {
      bodyHtml = `
        <div class="panel">
          <div class="panel-header">
            <div>
              <div class="section-heading">Purchase Order Lifecycle &amp; Webhook Dispatch Ledger</div>
              <div class="section-subheading">Honest SNS Agent delivery verification (CONFIRMED_SUCCESS / CONFIRMED_FAILURE / UNKNOWN_TIMEOUT)</div>
            </div>
          </div>
          ${Table.render({
            rows: pos,
            pageSize: 12,
            emptyTitle: 'No purchase orders recorded',
            emptySubtitle: 'Raise a PO from AI Recommendations to track approval and dispatch status.',
            columns: [
              { label: 'PO ID', key: 'id', render: (r) => `<span class="mono" style="font-weight:600">${F.escapeHtml(r.id)}</span>` },
              { label: 'SKU / Product', key: 'sku', render: (r) => `<div style="font-weight:500">${F.escapeHtml(r.productName || r.sku)}</div><div class="mono text-muted" style="font-size:11px">${F.escapeHtml(r.sku)} • ${F.escapeHtml(r.hub)}</div>` },
              { label: 'Supplier', key: 'supplier' },
              { label: 'Units', key: 'qty', align: 'right', render: (r) => `<span class="mono">${F.formatNumber(r.qty)}</span>` },
              { label: 'Total Cost', key: 'totalCost', align: 'right', render: (r) => `<span class="mono">${F.formatINR(r.totalCost)}</span>` },
              {
                label: 'PO Status',
                key: 'status',
                render: (r) => {
                  const cls = r.status === 'APPROVED' ? 'badge-optimal' : r.status === 'RECEIVED' ? 'badge-info' : r.status === 'REJECTED' ? 'badge-critical' : 'badge-warning';
                  return `<span class="badge ${cls}">${F.escapeHtml(r.status)}</span>`;
                }
              },
              {
                label: 'SNS Dispatch Outcome',
                key: 'dispatchOutcome',
                render: (r) => `${F.outcomeBadge(r.dispatchOutcome)}${r.dispatchLatencyMs ? `<div class="mono text-muted" style="font-size:10px;margin-top:2px">${r.dispatchLatencyMs}ms</div>` : ''}`
              },
              {
                label: 'Actions',
                sortable: false,
                align: 'right',
                render: (r) => {
                  if (r.status === 'PENDING') {
                    return `
                      <div style="display:inline-flex;gap:6px">
                        <button type="button" class="btn btn-sm btn-primary" data-po-approve="${F.escapeHtml(r.id)}">Approve</button>
                        <button type="button" class="btn btn-sm btn-danger" data-po-reject="${F.escapeHtml(r.id)}">Reject</button>
                      </div>
                    `;
                  }
                  if (r.status === 'APPROVED') {
                    return `<button type="button" class="btn btn-sm btn-teal" data-po-receive="${F.escapeHtml(r.id)}">Mark Received</button>`;
                  }
                  return '<span class="text-muted mono" style="font-size:11px">Closed</span>';
                }
              }
            ]
          })}
        </div>
      `;
    }

    container.innerHTML = `
      <div class="workspace-header">
        <div>
          <h1 class="page-title">Replenishment Center</h1>
          <p class="page-subtitle">Automated ROP / IP / MOQ calculation engine with bulk PO dispatch to WF-REPLENISH.</p>
        </div>
      </div>

      <div class="kpi-strip" style="grid-template-columns:repeat(4,minmax(0,1fr))">
        ${Metric.render({ label: 'SKUs Needing Replenishment', value: String(recs.length), meta: 'IP below target stock', tone: recs.length > 0 ? 'amber' : 'teal', iconName: 'refresh-cw' })}
        ${Metric.render({ label: 'Recommended Order Budget', value: F.formatCompactINR(totalRecCost), meta: 'MOQ-rounded commitment', tone: 'blue', iconName: 'boxes' })}
        ${Metric.render({ label: 'Pending PO Approvals', value: String(pendingPOs.length), meta: 'Awaiting manager clearance', tone: pendingPOs.length > 0 ? 'amber' : 'default', iconName: 'alert-triangle' })}
        ${Metric.render({ label: 'Approved In-Flight POs', value: String(approvedPOs.length), meta: 'Inbound to dark stores', tone: 'teal', iconName: 'truck' })}
      </div>

      <div class="context-tabs">
        <button type="button" class="context-tab ${tab === 'recommendations' ? 'active' : ''}" data-rtab="recommendations">AI Recommendations (${recs.length})</button>
        <button type="button" class="context-tab ${tab === 'orders' ? 'active' : ''}" data-rtab="orders">Purchase Orders (${pos.length})</button>
      </div>

      ${bodyHtml}
    `;

    container.querySelectorAll('[data-rtab]').forEach((b) => {
      b.addEventListener('click', () => global.PalletsRouter.setContextualTab('replenishment', b.getAttribute('data-rtab')));
    });

    container.querySelectorAll('.rep-chk').forEach((chk) => {
      chk.addEventListener('change', (e) => {
        const sku = chk.getAttribute('data-rep-sku');
        if (e.target.checked) localState.selectedSkus.add(sku);
        else localState.selectedSkus.delete(sku);
        renderReplenishment(container, global.PalletsState.state);
      });
    });

    container.querySelector('#rep-select-critical')?.addEventListener('click', () => {
      recs.filter((r) => r.risk === 'CRITICAL' || r.risk === 'HIGH').forEach((r) => localState.selectedSkus.add(r.sku));
      renderReplenishment(container, global.PalletsState.state);
    });

    container.querySelectorAll('[data-create-po]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const rec = recs.find((r) => r.sku === btn.getAttribute('data-create-po'));
        if (rec) openSinglePOModal(rec);
      });
    });

    container.querySelector('#rep-bulk-approve')?.addEventListener('click', () => {
      const selectedRecs = recs.filter((r) => localState.selectedSkus.has(r.sku));
      if (selectedRecs.length === 0) return;
      const totalBulkCost = selectedRecs.reduce((s, r) => s + r.estCost, 0);
      global.PalletsModal.confirm({
        title: `Bulk Approve & Dispatch ${selectedRecs.length} POs`,
        message: `Create and dispatch ${selectedRecs.length} MOQ-aligned purchase orders totaling ${F.formatINR(totalBulkCost)} via WF-REPLENISH?`,
        confirmLabel: 'Approve All & Dispatch',
        onConfirm: async () => {
          const idemKey = global.PalletsDataAdapter.makeIdempotencyKey('BULKPO');
          const items = selectedRecs.map((r) => ({
            sku: r.sku,
            qty: r.suggestedQ,
            rationale: `Bulk replenishment: Runway ${r.runway}d, IP=${r.ip}, ROP=${r.rop}`
          }));
          const created = await global.PalletsDataAdapter.createPurchaseOrders(items, true, idemKey);
          localState.selectedSkus.clear();
          await dispatchReplenishmentWebhook(created.orders, idemKey);
          global.PalletsEvents.emit('toast', {
            type: 'success',
            title: 'Bulk POs Processed',
            message: `${created.orders.length} purchase orders saved and dispatched.`
          });
        }
      });
    });

    container.querySelectorAll('[data-po-approve]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const poId = btn.getAttribute('data-po-approve');
        const po = pos.find((p) => p.id === poId);
        global.PalletsModal.confirm({
          title: `Approve & Dispatch ${poId}`,
          message: `Approve ${po.qty} units of ${po.sku} (${F.formatINR(po.totalCost)}) to ${po.supplier} and dispatch WF-REPLENISH?`,
          confirmLabel: 'Approve & Dispatch',
          onConfirm: async () => {
            const res = await global.PalletsDataAdapter.updatePurchaseOrder(poId, { status: 'APPROVED' });
            await dispatchReplenishmentWebhook([res.order], global.PalletsDataAdapter.makeIdempotencyKey('POAPP'));
            global.PalletsEvents.emit('toast', { type: 'success', title: `${poId} Approved`, message: 'Dispatched via WF-REPLENISH.' });
          }
        });
      });
    });

    container.querySelectorAll('[data-po-reject]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const poId = btn.getAttribute('data-po-reject');
        global.PalletsModal.confirm({
          title: `Reject Purchase Order ${poId}`,
          message: `Mark ${poId} as REJECTED? No replenishment stock will be added to on-order pipeline.`,
          confirmLabel: 'Reject PO',
          danger: true,
          onConfirm: async () => {
            await global.PalletsDataAdapter.updatePurchaseOrder(poId, { status: 'REJECTED' });
            global.PalletsEvents.emit('toast', { type: 'info', title: `${poId} Rejected`, message: 'Order cancelled.' });
          }
        });
      });
    });

    container.querySelectorAll('[data-po-receive]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const poId = btn.getAttribute('data-po-receive');
        global.PalletsModal.confirm({
          title: `Confirm Inbound Receipt: ${poId}`,
          message: `Receive PO units into physical dark store on-hand stock and clear on-order commitment?`,
          confirmLabel: 'Confirm Receipt',
          onConfirm: async () => {
            await global.PalletsDataAdapter.updatePurchaseOrder(poId, { status: 'RECEIVED' });
            global.PalletsEvents.emit('toast', { type: 'success', title: `${poId} Received`, message: 'On-hand stock incremented.' });
          }
        });
      });
    });
  }

  global.PalletsReplenishmentPage = { render: renderReplenishment };
})(typeof window !== 'undefined' ? window : globalThis);

