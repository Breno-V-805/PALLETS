/**
 * PALLETS V3 // Workspace 8: Customer Intelligence (Apriori Market Basket Analytics)
 */
(function (global) {
  'use strict';

  const localState = {
    selectedAnchorSku: 'SKU-9921-OAT'
  };

  function renderAnalytics(container, state) {
    const F = global.PalletsFormatters;
    const Charts = global.PalletsCharts;
    const Metric = global.PalletsMetricCard;
    const Table = global.PalletsDataTable;

    const ap = state.aprioriResult || { totalTransactions: 0, frequentItemsCount: 0, frequentRulesCount: 0, rules: [] };
    const cfg = state.aprioriConfig;
    const products = state.products || [];
    const crossSell = global.PalletsAprioriEngine
      ? global.PalletsAprioriEngine.getCrossSellRecommendations(localState.selectedAnchorSku, ap.rules)
      : [];

    container.innerHTML = `
      <div class="workspace-header">
        <div>
          <h1 class="page-title">Customer Intelligence (Market Basket Apriori)</h1>
          <p class="page-subtitle">Association rule mining over co-purchased dark store customer baskets for dark-store planogram bundling.</p>
        </div>
      </div>

      <div class="kpi-strip" style="grid-template-columns:repeat(4,minmax(0,1fr))">
        ${Metric.render({ label: 'Baskets Mined', value: F.formatNumber(ap.totalTransactions), meta: 'Verified dark store receipts', tone: 'blue', iconName: 'shopping-basket' })}
        ${Metric.render({ label: 'Frequent 1-Itemsets', value: String(ap.frequentItemsCount), meta: `Min Support >= ${(cfg.minSupport * 100).toFixed(1)}%`, tone: 'teal', iconName: 'boxes' })}
        ${Metric.render({ label: 'Association Rules Found', value: String(ap.frequentRulesCount), meta: `Min Confidence >= ${Math.round(cfg.minConfidence * 100)}%`, tone: 'purple', iconName: 'activity' })}
        ${Metric.render({ label: 'Strongest Bundle Lift', value: ap.rules[0] ? `${ap.rules[0].lift}x` : '—', meta: ap.rules[0] ? `${ap.rules[0].antecedentName} -> ${ap.rules[0].consequentName}` : 'Adjust thresholds', tone: 'amber', iconName: 'trending-up' })}
      </div>

      <div class="panel" style="margin-bottom:16px">
        <div class="panel-body">
          <div class="form-grid">
            <div class="form-field">
              <label class="form-label" for="ap-sup-slider">Minimum Support Threshold: <span class="mono text-blue">${(cfg.minSupport * 100).toFixed(1)}%</span></label>
              <input type="range" id="ap-sup-slider" min="1" max="20" step="0.5" value="${(cfg.minSupport * 100).toFixed(1)}" />
            </div>
            <div class="form-field">
              <label class="form-label" for="ap-conf-slider">Minimum Confidence Threshold: <span class="mono text-purple">${Math.round(cfg.minConfidence * 100)}%</span></label>
              <input type="range" id="ap-conf-slider" min="10" max="90" step="5" value="${Math.round(cfg.minConfidence * 100)}" />
            </div>
          </div>
        </div>
      </div>

      <div class="command-grid-equal">
        <div class="panel">
          <div class="panel-header">
            <div>
              <div class="section-heading">Top Association Rules by Lift Multiplier</div>
              <div class="section-subheading">Lift &gt; 1.0 indicates genuine positive affinity over random co-occurrence</div>
            </div>
          </div>
          <div class="panel-body">
            <div class="chart-wrap"><canvas id="ap-lift-chart" data-height="230"></canvas></div>
          </div>
        </div>

        <div class="panel">
          <div class="panel-header">
            <div>
              <div class="section-heading">SKU Co-Purchase Cross-Sell Explorer</div>
              <div class="section-subheading">Pick an anchor item to inspect dark-store shelf co-location picks</div>
            </div>
          </div>
          <div class="panel-body">
            <div class="form-field" style="margin-bottom:12px">
              <label class="form-label" for="ap-anchor-select">Anchor Product</label>
              <select id="ap-anchor-select" class="select">
                ${products.map((p) => `<option value="${F.escapeHtml(p.sku)}" ${p.sku === localState.selectedAnchorSku ? 'selected' : ''}>${F.escapeHtml(p.sku)} — ${F.escapeHtml(p.name)}</option>`).join('')}
              </select>
            </div>
            <div class="activity-list" style="border:1px solid var(--border-subtle);border-radius:var(--radius-sm)">
              ${crossSell.map((rule) => `
                <div class="activity-item">
                  <div>
                    <div class="activity-title">Pair with: ${F.escapeHtml(rule.consequentName)}</div>
                    <div class="activity-detail mono">Confidence ${rule.confidencePct}% • Support ${rule.supportPct}%</div>
                  </div>
                  <span class="badge badge-purple mono">${rule.lift}x Lift</span>
                </div>
              `).join('') || '<div class="empty-state">No qualifying rules for this SKU at current support/confidence sliders.</div>'}
            </div>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header"><div class="section-heading">Mined Association Rule Matrix</div></div>
        ${Table.render({
          rows: ap.rules || [],
          pageSize: 10,
          emptyTitle: 'No association rules satisfy current thresholds',
          emptySubtitle: 'Lower Minimum Support or Minimum Confidence sliders above.',
          columns: [
            { label: 'If Basket Contains', key: 'antecedentName', render: (r) => `<div style="font-weight:600">${F.escapeHtml(r.antecedentName)}</div><div class="mono text-muted" style="font-size:11px">${F.escapeHtml(r.antecedent)}</div>` },
            { label: 'Likely Also Buys', key: 'consequentName', render: (r) => `<div style="font-weight:600">${F.escapeHtml(r.consequentName)}</div><div class="mono text-muted" style="font-size:11px">${F.escapeHtml(r.consequent)}</div>` },
            { label: 'Support %', key: 'supportPct', align: 'right', render: (r) => `<span class="mono">${r.supportPct}%</span>` },
            { label: 'Confidence %', key: 'confidencePct', align: 'right', render: (r) => `<span class="mono text-teal">${r.confidencePct}%</span>` },
            { label: 'Lift', key: 'lift', align: 'right', render: (r) => `<span class="mono text-purple">${r.lift}x</span>` },
            { label: 'Bundle Strength', key: 'bundleStrength', render: (r) => `<span class="badge ${r.bundleStrength === 'STRONG' ? 'badge-optimal' : r.bundleStrength === 'MODERATE' ? 'badge-info' : 'badge-neutral'}">${F.escapeHtml(r.bundleStrength)}</span>` }
          ]
        })}
      </div>
    `;

    const topRules = (ap.rules || []).slice(0, 6);
    if (topRules.length > 0) {
      Charts.drawBarChart(
        container.querySelector('#ap-lift-chart'),
        topRules.map((r) => `${r.antecedent.split('-').pop()}→${r.consequent.split('-').pop()}`),
        topRules.map((r) => r.lift),
        { unit: 'x', color: '#A78BFA' }
      );
    }

    container.querySelector('#ap-sup-slider')?.addEventListener('input', (e) => {
      global.PalletsState.setState({ aprioriConfig: { ...cfg, minSupport: Number(e.target.value) / 100 } });
    });
    container.querySelector('#ap-conf-slider')?.addEventListener('input', (e) => {
      global.PalletsState.setState({ aprioriConfig: { ...cfg, minConfidence: Number(e.target.value) / 100 } });
    });
    container.querySelector('#ap-anchor-select')?.addEventListener('change', (e) => {
      localState.selectedAnchorSku = e.target.value;
      renderAnalytics(container, global.PalletsState.state);
    });
  }

  global.PalletsAnalyticsPage = { render: renderAnalytics };
})(typeof window !== 'undefined' ? window : globalThis);

