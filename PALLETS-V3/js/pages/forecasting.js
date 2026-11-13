/**
 * PALLETS V3 // Workspace 7: Demand Intelligence (AI Forecasting Studio)
 * Model Tournament: MA-7, MA-14, Holt Exponential Smoothing, Holt-Winters Weekly (80/20 holdout)
 * Preserves corrected WAPE (0-100%, fixing V2 double multiplication).
 */
(function (global) {
  'use strict';

  const localState = {
    sku: null,
    horizonDays: 30,
    promoBoost: 0,
    preferredModel: 'AUTO',
    lastResult: null,
    dispatching: false
  };

  function computeForecastForProduct(product) {
    if (!product || !global.PalletsForecastingEngine) return null;
    localState.lastResult = global.PalletsForecastingEngine.runForecast(product.salesHistory || [], {
      horizonDays: localState.horizonDays,
      promoBoost: localState.promoBoost,
      preferredModel: localState.preferredModel
    });
    return localState.lastResult;
  }

  function renderForecasting(container, state) {
    const F = global.PalletsFormatters;
    const Charts = global.PalletsCharts;
    const Metric = global.PalletsMetricCard;
    const Table = global.PalletsDataTable;

    const products = global.PalletsState.getScopedProducts();
    if (!localState.sku || !products.some((p) => p.sku === localState.sku)) {
      localState.sku = products[0] ? products[0].sku : null;
    }
    const product = products.find((p) => p.sku === localState.sku) || null;
    const result = product ? computeForecastForProduct(product) : null;

    container.innerHTML = `
      <div class="workspace-header">
        <div>
          <h1 class="page-title">Demand Intelligence Studio</h1>
          <p class="page-subtitle">Time-series forecasting tournament (MA-7, MA-14, Holt, Holt-Winters Weekly) on 20% validation holdout.</p>
        </div>
        <div class="workspace-actions">
          <button type="button" class="btn btn-primary" id="fc-run-save-btn" ${!product || localState.dispatching ? 'disabled' : ''}>
            ${F.icon('trending-up', 14)} Run &amp; Dispatch WF-FORECAST
          </button>
        </div>
      </div>

      <div class="panel" style="margin-bottom:16px">
        <div class="panel-body">
          <div class="form-grid" style="grid-template-columns:2fr 1fr 1.5fr 1.5fr">
            <div class="form-field">
              <label class="form-label" for="fc-sku">Target SKU</label>
              <select id="fc-sku" class="select">
                ${products.map((p) => `<option value="${F.escapeHtml(p.sku)}" ${p.sku === localState.sku ? 'selected' : ''}>${F.escapeHtml(p.sku)} — ${F.escapeHtml(p.name)}</option>`).join('')}
              </select>
            </div>
            <div class="form-field">
              <label class="form-label" for="fc-horizon">Projection Horizon</label>
              <select id="fc-horizon" class="select">
                <option value="7" ${localState.horizonDays === 7 ? 'selected' : ''}>7 Days</option>
                <option value="30" ${localState.horizonDays === 30 ? 'selected' : ''}>30 Days</option>
                <option value="90" ${localState.horizonDays === 90 ? 'selected' : ''}>90 Days</option>
              </select>
            </div>
            <div class="form-field">
              <label class="form-label" for="fc-model">Tournament Algorithm</label>
              <select id="fc-model" class="select">
                <option value="AUTO" ${localState.preferredModel === 'AUTO' ? 'selected' : ''}>Auto Winner (Lowest WAPE)</option>
                <option value="HOLT_WINTERS_WEEKLY" ${localState.preferredModel === 'HOLT_WINTERS_WEEKLY' ? 'selected' : ''}>Holt-Winters Weekly (m=7)</option>
                <option value="EXPONENTIAL_SMOOTHING_HOLT" ${localState.preferredModel === 'EXPONENTIAL_SMOOTHING_HOLT' ? 'selected' : ''}>Holt Linear Trend</option>
                <option value="MOVING_AVERAGE_7D" ${localState.preferredModel === 'MOVING_AVERAGE_7D' ? 'selected' : ''}>Moving Average (7d)</option>
                <option value="MOVING_AVERAGE_14D" ${localState.preferredModel === 'MOVING_AVERAGE_14D' ? 'selected' : ''}>Moving Average (14d)</option>
              </select>
            </div>
            <div class="form-field">
              <label class="form-label" for="fc-promo">Promotional Lift Uplift: <span class="mono text-purple">${localState.promoBoost >= 0 ? '+' : ''}${Math.round(localState.promoBoost * 100)}%</span></label>
              <input type="range" id="fc-promo" min="-30" max="100" step="5" value="${Math.round(localState.promoBoost * 100)}" style="margin-top:8px" />
            </div>
          </div>
        </div>
      </div>

      ${result ? `
        <div class="kpi-strip" style="grid-template-columns:repeat(4,minmax(0,1fr))">
          ${Metric.render({ label: 'Active Champion Model', value: result.selectedModelName, meta: `MAE: ${result.metrics.mae} | RMSE: ${result.metrics.rmse}`, tone: 'purple', iconName: 'trending-up' })}
          ${Metric.render({ label: 'Validation WAPE', value: `${result.metrics.wape}%`, meta: '20% holdout error rate', tone: result.metrics.wape <= 15 ? 'teal' : 'amber', iconName: 'activity' })}
          ${Metric.render({ label: `Projected ${localState.horizonDays}d Demand`, value: F.formatNumber(localState.horizonDays === 7 ? result.totals.next7Days : localState.horizonDays === 90 ? result.totals.next90Days : result.totals.next30Days) + 'u', meta: `Avg ${result.totals.avgDaily} units/day`, tone: 'blue', iconName: 'boxes' })}
          ${Metric.render({ label: '90-Day Cumulative Projection', value: F.formatNumber(result.totals.next90Days) + 'u', meta: `Revenue Est: ${F.formatCompactINR(result.totals.next90Days * product.unitPrice)}`, tone: 'teal', iconName: 'package' })}
        </div>

        <div class="panel" style="margin-bottom:16px">
          <div class="panel-header">
            <div>
              <div class="section-heading">Demand Trajectory & Confidence Intervals (${F.escapeHtml(product.name)})</div>
              <div class="section-subheading">Trailing 21d actuals + ${localState.horizonDays}d probabilistic bands (80% &amp; 95%)</div>
            </div>
            <div class="chart-legend-row">
              <span class="chart-legend-item"><span class="tip-dot" style="background:#4F8CFF"></span>Historical Actuals</span>
              <span class="chart-legend-item"><span class="tip-dot" style="background:#A78BFA"></span>Forecast Trajectory</span>
              <span class="chart-legend-item"><span class="tip-dot" style="background:rgba(167,139,250,0.45)"></span>80% / 95% Uncertainty</span>
            </div>
          </div>
          <div class="panel-body">
            <div class="chart-wrap"><canvas id="fc-trajectory-canvas" data-height="290"></canvas></div>
          </div>
        </div>

        <div class="panel">
          <div class="panel-header">
            <div>
              <div class="section-heading">Algorithmic Tournament Leaderboard</div>
              <div class="section-subheading">Benchmarked on 20% out-of-sample chronological holdout window</div>
            </div>
          </div>
          ${Table.render({
            rows: result.modelComparison,
            pageSize: 6,
            columns: [
              { label: 'Model', key: 'name', render: (r) => `<span style="font-weight:600">${F.escapeHtml(r.name)}</span>` },
              { label: 'Selection', sortable: false, render: (r) => r.id === result.selectedModel ? '<span class="badge badge-purple">ACTIVE</span>' : (r.id === result.autoWinnerId ? '<span class="badge badge-optimal">AUTO WINNER</span>' : '<span class="badge badge-neutral">CANDIDATE</span>') },
              { label: 'WAPE %', key: 'wape', align: 'right', render: (r) => `<span class="mono">${r.wape}%</span>` },
              { label: 'MAE (units)', key: 'mae', align: 'right', render: (r) => `<span class="mono">${r.mae}</span>` },
              { label: 'RMSE (units)', key: 'rmse', align: 'right', render: (r) => `<span class="mono">${r.rmse}</span>` }
            ]
          })}
        </div>
      ` : '<div class="panel panel-body"><div class="empty-state">No products available for forecasting.</div></div>'}
    `;

    if (result) {
      Charts.drawForecastChart(container.querySelector('#fc-trajectory-canvas'), result.timeline);
    }

    container.querySelector('#fc-sku')?.addEventListener('change', (e) => { localState.sku = e.target.value; renderForecasting(container, global.PalletsState.state); });
    container.querySelector('#fc-horizon')?.addEventListener('change', (e) => { localState.horizonDays = Number(e.target.value); renderForecasting(container, global.PalletsState.state); });
    container.querySelector('#fc-model')?.addEventListener('change', (e) => { localState.preferredModel = e.target.value; renderForecasting(container, global.PalletsState.state); });
    container.querySelector('#fc-promo')?.addEventListener('input', (e) => { localState.promoBoost = Number(e.target.value) / 100; renderForecasting(container, global.PalletsState.state); });

    container.querySelector('#fc-run-save-btn')?.addEventListener('click', async () => {
      if (!product || !result) return;
      localState.dispatching = true;
      renderForecasting(container, global.PalletsState.state);
      try {
        await global.PalletsDataAdapter.recordForecastRun({
          sku: product.sku,
          selectedModel: result.selectedModel,
          selectedModelName: result.selectedModelName,
          horizonDays: localState.horizonDays,
          promoBoost: localState.promoBoost,
          wape: result.metrics.wape,
          mae: result.metrics.mae,
          rmse: result.metrics.rmse,
          projected30d: result.totals.next30Days
        });
        const wfRes = await global.PalletsWorkflowAdapter.trigger('FORECAST_EXECUTION', {
          sku: product.sku,
          selectedModel: result.selectedModel,
          wapePct: result.metrics.wape,
          horizonDays: localState.horizonDays,
          projected30d: result.totals.next30Days
        }, 'forecasting');
        global.PalletsEvents.emit('toast', {
          type: wfRes.success ? 'success' : 'warning',
          title: 'Forecast Recorded',
          message: `WAPE ${result.metrics.wape}% | WF-FORECAST: ${wfRes.outcome}`
        });
      } catch (err) {
        global.PalletsEvents.emit('toast', { type: 'error', title: 'Forecast Save Error', message: err.message });
      } finally {
        localState.dispatching = false;
        renderForecasting(container, global.PalletsState.state);
      }
    });
  }

  global.PalletsForecastingPage = { render: renderForecasting };
})(typeof window !== 'undefined' ? window : globalThis);

