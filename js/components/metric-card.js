/**
 * PALLETS V3 // Dark Industrial KPI Readout Component
 */
(function (global) {
  'use strict';

  function renderMetricCard({ label, value, meta = '', tone = 'default', iconName = 'activity' }) {
    const F = global.PalletsFormatters;
    return `
      <div class="kpi-tile tone-${F.escapeHtml(tone)}">
        <div class="kpi-top">
          <span class="kpi-label">${F.escapeHtml(label)}</span>
          <span class="kpi-icon">${F.icon(iconName, 15)}</span>
        </div>
        <div class="kpi-value mono">${F.escapeHtml(value)}</div>
        ${meta ? `<div class="kpi-meta">${F.escapeHtml(meta)}</div>` : ''}
      </div>
    `;
  }

  global.PalletsMetricCard = { render: renderMetricCard };
})(typeof window !== 'undefined' ? window : globalThis);

