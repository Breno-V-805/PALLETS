/**
 * PALLETS V3 // Workspace 9: PALLETS Copilot
 * Federated AI Operations Assistant calling preserved WF-COPILOT webhook
 * with grounded inventory synthesis and honest telemetry status badges.
 */
(function (global) {
  'use strict';

  const localState = {
    sending: false
  };

  function generateGroundedResponse(query, state) {
    const F = global.PalletsFormatters;
    const Calc = global.PalletsCalculations;
    const Perms = global.PalletsPermissions;
    const products = global.PalletsState.getScopedProducts();
    const metrics = global.PalletsState.computeDashboardMetrics();
    const q = String(query || '').toLowerCase();

    if (q.includes('stockout') || q.includes('run out') || q.includes('critical') || q.includes('risk')) {
      const critical = products
        .map((p) => ({ p, runway: Calc.calculateRunwayDays(p) }))
        .filter((x) => x.runway <= 7.0)
        .sort((a, b) => a.runway - b.runway);

      if (critical.length === 0) {
        return { text: 'All scoped SKUs currently exceed 7.0 days of safety runway. Zero immediate stockout risks detected.', actionRoute: null };
      }
      const lines = critical.slice(0, 5).map((x) => `• ${x.p.sku} (${x.p.name}): ${x.p.onHand}u remaining -> ${x.runway}d runway (ROP ${Calc.calculateROP(x.p)}u)`);
      return {
        text: `${critical.length} SKU(s) are inside Critical or High stockout risk:\n${lines.join('\n')}`,
        actionRoute: Perms.isManagerOrAdmin(state.user) ? { route: 'replenishment', label: 'Open Replenishment Center' } : null
      };
    }

    if (q.includes('epigamia') || q.includes('yogu') || q.includes('why')) {
      const target = products.find((p) => p.sku.includes('YOGU')) || products[0];
      if (!target) return { text: 'Epigamia SKU is not assigned to your active facility hub scope.', actionRoute: null };
      return {
        text: `${target.name} (${target.sku}) at ${target.hub} has ${target.onHand}u on hand against ${target.dailyDemand}u/day burn (${Calc.calculateRunwayDays(target)}d runway). Lead time is ${target.leadTimeDays}d and ROP is ${Calc.calculateROP(target)}u. Suggested replenishment: ${Calc.calculateRecommendedOrderQuantity(target)}u.`,
        actionRoute: Perms.isManagerOrAdmin(state.user) ? { route: 'forecasting', label: 'Inspect Demand Forecast' } : null
      };
    }

    if (q.includes('oatly') || q.includes('reorder') || q.includes('how much') || q.includes('po')) {
      const topRecs = products
        .map((p) => ({ p, q: Calc.calculateRecommendedOrderQuantity(p) }))
        .filter((x) => x.q > 0)
        .sort((a, b) => b.q - a.q);
      if (topRecs.length === 0) {
        return { text: 'No SKUs currently require replenishment orders (all Inventory Positions meet Target Stock).', actionRoute: null };
      }
      const top = topRecs[0];
      return {
        text: `Top replenishment need: ${top.p.name} (${top.p.sku}) requires ${top.q} units (MOQ ${top.p.moq}) totaling ${F.formatINR(top.q * top.p.costPrice)} from ${top.p.supplier}. Total queue: ${topRecs.length} SKU(s).`,
        actionRoute: Perms.isManagerOrAdmin(state.user) ? { route: 'replenishment', label: 'Review PO Recommendations' } : null
      };
    }

    if (q.includes('overstock') || q.includes('excess') || q.includes('surplus')) {
      const over = products.filter((p) => Calc.evaluateRiskStatus(p) === 'OVERSTOCK');
      if (over.length === 0) return { text: 'Zero SKUs exceed the 35-day overstock threshold in active scope.', actionRoute: null };
      const lines = over.map((p) => `• ${p.name} (${p.sku}): ${p.onHand}u -> ${Calc.calculateRunwayDays(p)}d runway (${F.formatINR(Calc.calculateHoldingValuation(p))})`);
      return {
        text: `${over.length} overstocked SKU(s) tying up working capital:\n${lines.join('\n')}`,
        actionRoute: { route: 'products', label: 'Inspect Catalog Tiers' }
      };
    }

    if (q.includes('value') || q.includes('valuation') || q.includes('worth')) {
      return {
        text: `Scoped holding valuation across ${metrics.totalSkus} SKUs is ${F.formatINR(metrics.totalValuation)}. Daily burn velocity is ${F.formatNumber(metrics.totalDailyDemand)} units/day, with ${F.formatINR(metrics.stockoutRiskValue)} revenue exposed to stockout deficits.`,
        actionRoute: { route: 'command-center', label: 'Return to Command Center' }
      };
    }

    return {
      text: `Scoped Snapshot: ${metrics.totalSkus} SKUs monitored, ${metrics.criticalCount} critical, ${metrics.highRiskCount} high risk, ${metrics.pendingPOs} pending POs, Valuation ${F.formatINR(metrics.totalValuation)}. Ask about "stockout risks", "Epigamia velocity", "reorder quantities", or "overstock bleed".`,
      actionRoute: null
    };
  }

  async function sendCopilotQuery(promptText, container) {
    const clean = String(promptText || '').trim();
    if (!clean || localState.sending) return;

    const Store = global.PalletsState;
    const msgs = [...Store.state.copilotMessages];
    msgs.push({
      id: 'COP-U-' + Date.now(),
      sender: 'user',
      text: clean,
      timestamp: new Date().toISOString()
    });
    localState.sending = true;
    Store.setState({ copilotMessages: msgs });

    const scoped = Store.getScopedProducts();
    const metrics = Store.computeDashboardMetrics();
    const fallback = generateGroundedResponse(clean, Store.state);

    const wfRes = await global.PalletsWorkflowAdapter.trigger(
      'COPILOT_QUERY',
      {
        query: clean,
        hubScope: Store.state.user.role === 'Staff' ? Store.state.user.storeAccess : Store.state.activeHubFilter,
        skusInScope: scoped.length,
        criticalCount: metrics.criticalCount,
        totalValuation: metrics.totalValuation
      },
      'copilot'
    );

    const remoteReply = wfRes.success && wfRes.data
      ? (wfRes.data.reply || wfRes.data.answer || wfRes.data.message || wfRes.data.output || null)
      : null;

    const botText = remoteReply
      ? String(remoteReply)
      : `${fallback.text}\n\n[Local Grounded Synthesis • WF-COPILOT=${wfRes.outcome}${wfRes.latencyMs ? ` (${wfRes.latencyMs}ms)` : ''}]`;

    const updatedMsgs = [...Store.state.copilotMessages];
    updatedMsgs.push({
      id: 'COP-B-' + Date.now(),
      sender: 'bot',
      text: botText,
      timestamp: new Date().toISOString(),
      outcome: wfRes.outcome,
      latencyMs: wfRes.latencyMs,
      actionRoute: fallback.actionRoute
    });
    localState.sending = false;
    Store.setState({ copilotMessages: updatedMsgs });

    const thread = container.querySelector('#cop-messages-list');
    if (thread) thread.scrollTop = thread.scrollHeight;
  }

  function renderCopilot(container, state) {
    const F = global.PalletsFormatters;
    const wf = state.workflows.copilot || { id: 'WF-COPILOT', healthStatus: 'READY' };
    const prompts = [
      'Which SKUs are at critical risk of stockout this week?',
      'Why is Epigamia Greek Yogurt flagged as critical?',
      'How much stock should we reorder for Oatly Barista Edition?',
      'Identify overstock SKUs tying up working capital.',
      'Summarize total inventory valuation and stockout exposure.'
    ];

    container.innerHTML = `
      <div class="workspace-header">
        <div>
          <h1 class="page-title">PALLETS AI Copilot</h1>
          <p class="page-subtitle">Federated inventory intelligence across WF-RISK, WF-REPLENISH, and WF-FORECAST.</p>
        </div>
        <div class="workspace-actions">
          ${F.outcomeBadge(wf.healthStatus)}
        </div>
      </div>

      <div class="copilot-layout">
        <div class="panel">
          <div class="panel-header"><div class="section-heading">Suggested Queries</div></div>
          <div class="panel-body" style="display:flex;flex-direction:column;gap:8px">
            <div class="kv-cell" style="margin-bottom:6px">
              <div class="kv-label">Active Hub Scope</div>
              <div class="kv-value mono">${F.escapeHtml(state.user.role === 'Staff' ? state.user.storeAccess : state.activeHubFilter)}</div>
            </div>
            ${prompts.map((p) => `<button type="button" class="prompt-chip-btn" data-cop-prompt="${F.escapeHtml(p)}">${F.escapeHtml(p)}</button>`).join('')}
          </div>
        </div>

        <div class="panel copilot-thread">
          <div class="panel-header">
            <div class="section-heading">Operations Thread (WF-COPILOT Gateway)</div>
            <span class="mono text-muted" style="font-size:11px">${state.copilotMessages.length} message(s)</span>
          </div>
          <div class="copilot-messages" id="cop-messages-list">
            ${state.copilotMessages.map((m) => `
              <div class="chat-bubble ${m.sender === 'user' ? 'user' : 'bot'}">
                <div style="white-space:pre-line">${F.escapeHtml(m.text)}</div>
                ${m.actionRoute ? `<div style="margin-top:8px"><button type="button" class="btn btn-sm btn-primary" data-cop-nav="${F.escapeHtml(m.actionRoute.route)}">${F.escapeHtml(m.actionRoute.label)}</button></div>` : ''}
                <div style="display:flex;gap:8px;align-items:center;margin-top:6px;font-size:10px" class="mono text-muted">
                  <span>${F.formatDateTime(m.timestamp)}</span>
                  ${m.outcome ? F.outcomeBadge(m.outcome) : ''}
                </div>
              </div>
            `).join('')}
          </div>
          <form id="cop-form" class="copilot-composer">
            <input type="text" id="cop-input" class="input" placeholder="Ask about stockouts, Epigamia burn, reorder quantities, or valuation..." ${localState.sending ? 'disabled' : ''} autocomplete="off" />
            <button type="submit" class="btn btn-primary" ${localState.sending ? 'disabled' : ''}>${F.icon('send', 14)} ${localState.sending ? 'Dispatching...' : 'Ask Copilot'}</button>
          </form>
        </div>
      </div>
    `;

    const list = container.querySelector('#cop-messages-list');
    if (list) list.scrollTop = list.scrollHeight;

    container.querySelector('#cop-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = container.querySelector('#cop-input');
      const val = input.value;
      input.value = '';
      sendCopilotQuery(val, container);
    });

    container.querySelectorAll('[data-cop-prompt]').forEach((btn) => {
      btn.addEventListener('click', () => sendCopilotQuery(btn.getAttribute('data-cop-prompt'), container));
    });

    container.querySelectorAll('[data-cop-nav]').forEach((btn) => {
      btn.addEventListener('click', () => global.PalletsRouter.navigate(btn.getAttribute('data-cop-nav')));
    });
  }

  global.PalletsCopilotPage = { render: renderCopilot };
})(typeof window !== 'undefined' ? window : globalThis);

