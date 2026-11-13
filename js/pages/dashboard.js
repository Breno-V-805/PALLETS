/**
 * PALLETS V3 // Workspace 1: Command Center
 */
(function (global) {
  'use strict';

  function renderDashboard(container, state) {
    const F = global.PalletsFormatters;
    const Calc = global.PalletsCalculations;
    const Perms = global.PalletsPermissions;
    const Charts = global.PalletsCharts;
    const Metric = global.PalletsMetricCard;
    const Table = global.PalletsDataTable;

    const metrics = global.PalletsState.computeDashboardMetrics();
    const products = global.PalletsState.getScopedProducts();
    const canManageOps = Perms.isManagerOrAdmin(state.user);

    const kpiHtml = `
      <div class="kpi-strip">
        ${Metric.render({
          label: 'Total Inventory Valuation',
          value: F.formatCompactINR(metrics.totalValuation),
          meta: `${metrics.totalSkus} monitored SKUs`,
          tone: 'blue',
          iconName: 'boxes'
        })}
        ${Metric.render({
          label: 'Critical Stock Items',
          value: String(metrics.criticalCount),
          meta: `Runway <= 3.0d | Risk ${F.formatCompactINR(metrics.stockoutRiskValue)}`,
          tone: metrics.criticalCount > 0 ? 'red' : 'teal',
          iconName: 'alert-triangle'
        })}
        ${Metric.render({
          label: 'High-Risk Stock Items',
          value: String(metrics.highRiskCount),
          meta: 'Runway 3.1d – 7.0d',
          tone: metrics.highRiskCount > 0 ? 'amber' : 'teal',
          iconName: 'activity'
        })}
        ${Metric.render({
          label: 'Overstock Items',
          value: String(metrics.overstockCount),
          meta: 'Runway >= 35.0d buffer bleed',
          tone: 'purple',
          iconName: 'package'
        })}
        ${Metric.render({
          label: 'Pending Purchase Orders',
          value: String(metrics.pendingPOs),
          meta: 'Awaiting dispatch approval',
          tone: metrics.pendingPOs > 0 ? 'amber' : 'default',
          iconName: 'refresh-cw'
        })}
        ${Metric.render({
          label: 'Daily Demand Velocity',
          value: `${F.formatNumber(metrics.totalDailyDemand)} u/d`,
          meta: 'Aggregated network burn',
          tone: 'teal',
          iconName: 'trending-up'
        })}
      </div>
    `;

    const total = Math.max(1, metrics.totalSkus);
    const pctCrit = Math.round((metrics.criticalCount / total) * 100);
    const pctHigh = Math.round((metrics.highRiskCount / total) * 100);
    const pctOpt = Math.round((metrics.optimalCount / total) * 100);
    const pctOver = Math.max(0, 100 - pctCrit - pctHigh - pctOpt);

    const rankedRisk = [...products]
      .map((p) => ({
        ...p,
        runway: Calc.calculateRunwayDays(p),
        rop: Calc.calculateROP(p),
        suggestedQ: Calc.calculateRecommendedOrderQuantity(p),
        risk: Calc.evaluateRiskStatus(p)
      }))
      .sort((a, b) => a.runway - b.runway);

    const wfEntries = Object.entries(state.workflows || {});
    const onlineCount = wfEntries.filter(([, w]) => w.configured && (w.healthStatus === 'ONLINE' || w.healthStatus === 'READY')).length;

    container.innerHTML = `
      <div class="workspace-header">
        <div>
          <h1 class="page-title">Operational Command Center</h1>
          <p class="page-subtitle">Real-time dark store valuation, stockout exposure, replenishment priority queue, and SNS Agent telemetry.</p>
        </div>
        <div class="workspace-actions">
          <button type="button" class="btn btn-ghost" id="cc-refresh-btn">${F.icon('refresh-cw', 14)} Refresh State</button>
          ${canManageOps ? `<button type="button" class="btn btn-primary" id="cc-open-replenish">${F.icon('truck', 14)} Review Replenishments</button>` : ''}
        </div>
      </div>

      ${kpiHtml}

      <div class="panel" style="margin-bottom: 16px;">
        <div class="panel-header">
          <div>
            <div class="section-heading">Network Inventory Health Distribution</div>
            <div class="section-subheading">Exact runway thresholds: Critical (&lt;=3d) • High (&lt;=7d) • Optimal (7–35d) • Overstock (&gt;=35d)</div>
          </div>
          <span class="badge ${metrics.criticalCount > 0 ? 'badge-critical' : 'badge-optimal'} mono">${metrics.totalSkus} SKUs Tracked</span>
        </div>
        <div class="panel-body">
          <div class="health-bar-track" aria-label="Inventory health breakdown">
            <div class="health-seg-critical" style="width:${(metrics.criticalCount / total) * 100}%"></div>
            <div class="health-seg-high" style="width:${(metrics.highRiskCount / total) * 100}%"></div>
            <div class="health-seg-optimal" style="width:${(metrics.optimalCount / total) * 100}%"></div>
            <div class="health-seg-overstock" style="width:${(metrics.overstockCount / total) * 100}%"></div>
          </div>
          <div class="health-legend-grid">
            <div class="health-legend-item">
              <div class="health-legend-head"><span class="legend-dot" style="background:var(--accent-red)"></span>Critical</div>
              <div class="health-legend-val mono">${metrics.criticalCount} <span class="text-muted" style="font-size:12px">(${pctCrit}%)</span></div>
            </div>
            <div class="health-legend-item">
              <div class="health-legend-head"><span class="legend-dot" style="background:var(--accent-amber)"></span>High Risk</div>
              <div class="health-legend-val mono">${metrics.highRiskCount} <span class="text-muted" style="font-size:12px">(${pctHigh}%)</span></div>
            </div>
            <div class="health-legend-item">
              <div class="health-legend-head"><span class="legend-dot" style="background:var(--accent-teal)"></span>Optimal</div>
              <div class="health-legend-val mono">${metrics.optimalCount} <span class="text-muted" style="font-size:12px">(${pctOpt}%)</span></div>
            </div>
            <div class="health-legend-item">
              <div class="health-legend-head"><span class="legend-dot" style="background:var(--accent-blue)"></span>Overstock</div>
              <div class="health-legend-val mono">${metrics.overstockCount} <span class="text-muted" style="font-size:12px">(${pctOver}%)</span></div>
            </div>
          </div>
        </div>
      </div>

      <div class="command-grid-2">
        <div class="panel">
          <div class="panel-header">
            <div>
              <div class="section-heading">30-Day Network Demand & Replenishment Trend</div>
              <div class="section-subheading">Aggregated daily unit burn vs safety target trajectory</div>
            </div>
            <div class="chart-legend-row">
              <span class="chart-legend-item"><span class="tip-dot" style="background:#4F8CFF"></span>Daily Units Sold</span>
              <span class="chart-legend-item"><span class="tip-dot" style="background:#21C7A8"></span>Replenished Baseline</span>
            </div>
          </div>
          <div class="panel-body">
            <div class="chart-wrap">
              <canvas id="cc-spline-canvas" data-height="250"></canvas>
            </div>
          </div>
        </div>

        <div class="panel">
          <div class="panel-header">
            <div>
              <div class="section-heading">Stock Health Allocation</div>
              <div class="section-subheading">Active SKU buffer posture</div>
            </div>
          </div>
          <div class="panel-body">
            <div class="chart-wrap">
              <canvas id="cc-donut-canvas" data-height="250"></canvas>
            </div>
          </div>
        </div>
      </div>

      <div class="command-grid-equal">
        <div class="panel">
          <div class="panel-header">
            <div>
              <div class="section-heading">Hub-Wise Holding Valuation</div>
              <div class="section-subheading">Capital distribution across regional dark stores</div>
            </div>
          </div>
          <div class="panel-body">
            <div class="chart-wrap">
              <canvas id="cc-hub-bar-canvas" data-height="240"></canvas>
            </div>
          </div>
        </div>

        <div class="panel">
          <div class="panel-header">
            <div>
              <div class="section-heading">Operational Activity & SNS Pipeline</div>
              <div class="section-subheading">${onlineCount}/${wfEntries.length || 9} preserved SNS workflows ready/online</div>
            </div>
            ${Perms.isAdmin(state.user) ? '<button type="button" class="btn btn-sm btn-ghost" id="cc-open-admin">Workflow Config</button>' : ''}
          </div>
          <div class="panel-body tight">
            <div class="activity-list">
              ${(state.activityLogs || []).slice(0, 6).map((act) => `
                <div class="activity-item">
                  <div>
                    <div class="activity-title">${F.escapeHtml(act.title)}</div>
                    <div class="activity-detail">${F.escapeHtml(act.detail)}</div>
                  </div>
                  <div class="activity-meta mono">${F.formatDateTime(act.timestamp)}</div>
                </div>
              `).join('') || '<div class="empty-state">No recent activity logged.</div>'}
            </div>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <div>
            <div class="section-heading">Stockout Risk Leaderboard</div>
            <div class="section-subheading">Sorted by fewest runway days remaining</div>
          </div>
        </div>
        <div class="panel-body tight" id="cc-risk-table-host">
          ${Table.render({
            rows: rankedRisk.slice(0, 8),
            pageSize: 8,
            columns: [
              { label: 'SKU / Product', key: 'name', render: (r) => `<div style="font-weight:600">${F.escapeHtml(r.name)}</div><div class="mono text-muted" style="font-size:11px">${F.escapeHtml(r.sku)} • ${F.escapeHtml(r.hub)}</div>` },
              { label: 'Risk', key: 'risk', render: (r) => F.riskBadge(r.risk) },
              { label: 'On-Hand', key: 'onHand', align: 'right', render: (r) => `<span class="mono">${F.formatNumber(r.onHand)}</span>` },
              { label: 'Daily Demand', key: 'dailyDemand', align: 'right', render: (r) => `<span class="mono">${F.formatNumber(r.dailyDemand)}/d</span>` },
              { label: 'Runway', key: 'runway', align: 'right', render: (r) => `<span class="mono ${r.runway <= 3 ? 'text-red' : r.runway <= 7 ? 'text-amber' : ''}">${r.runway}d</span>` },
              { label: 'ROP', key: 'rop', align: 'right', render: (r) => `<span class="mono">${F.formatNumber(r.rop)}</span>` },
              { label: 'Suggested Q', key: 'suggestedQ', align: 'right', render: (r) => `<span class="mono text-blue">${F.formatNumber(r.suggestedQ)}</span>` },
              {
                label: 'Action',
                sortable: false,
                align: 'right',
                render: (r) => `<button type="button" class="btn btn-sm btn-ghost" data-inspect-sku="${F.escapeHtml(r.sku)}">Inspect</button>`
              }
            ]
          })}
        </div>
      </div>
    `;

    // Render Canvas charts after DOM attach
    const splineCanvas = container.querySelector('#cc-spline-canvas');
    const labels = [];
    const primary = [];
    const secondary = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      labels.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
      let daySum = 0;
      products.forEach((p) => {
        const hist = p.salesHistory || [];
        const idx = hist.length - 1 - i;
        daySum += idx >= 0 ? Number(hist[idx] || 0) : Number(p.dailyDemand || 0);
      });
      primary.push(Math.round(daySum));
      secondary.push(Math.round(metrics.totalDailyDemand * 0.96));
    }
    Charts.drawSplineChart(splineCanvas, labels, primary, secondary, {
      primaryLabel: 'Actual Sales Units',
      secondaryLabel: 'Baseline Daily Burn'
    });

    Charts.drawDonutChart(
      container.querySelector('#cc-donut-canvas'),
      [
        { label: 'Critical', value: metrics.criticalCount, color: '#F06B73' },
        { label: 'High Risk', value: metrics.highRiskCount, color: '#E7AD52' },
        { label: 'Optimal', value: metrics.optimalCount, color: '#21C7A8' },
        { label: 'Overstock', value: metrics.overstockCount, color: '#4F8CFF' }
      ],
      `${metrics.totalSkus}`,
      'Active SKUs'
    );

    const hubLabels = Calc.HUBS.map((h) => h.code);
    const hubVals = Calc.HUBS.map((h) =>
      Math.round(
        products.reduce((sum, p) => {
          const qty = p.hubStocks && p.hubStocks[h.id] !== undefined
            ? p.hubStocks[h.id]
            : (p.hub === h.id ? p.onHand : 0);
          return sum + qty * Number(p.costPrice || 0);
        }, 0)
      )
    );
    Charts.drawBarChart(container.querySelector('#cc-hub-bar-canvas'), hubLabels, hubVals, {
      currency: '₹',
      colors: ['#4F8CFF', '#21C7A8', '#A78BFA', '#E7AD52']
    });

    container.querySelector('#cc-refresh-btn')?.addEventListener('click', () => {
      global.PalletsDataAdapter.loadOperationalState();
    });
    container.querySelector('#cc-open-replenish')?.addEventListener('click', () => {
      global.PalletsRouter.navigate('replenishment');
    });
    container.querySelector('#cc-open-admin')?.addEventListener('click', () => {
      global.PalletsRouter.navigate('administration');
    });
    container.querySelectorAll('[data-inspect-sku]').forEach((btn) => {
      btn.addEventListener('click', () => {
        global.PalletsState.setState({ selectedProductSku: btn.getAttribute('data-inspect-sku') });
        global.PalletsRouter.navigate('products', 'details');
      });
    });
  }

  global.PalletsDashboardPage = { render: renderDashboard };
})(typeof window !== 'undefined' ? window : globalThis);

