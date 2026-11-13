/**
 * PALLETS V3 // Dark Industrial HTML5 Canvas Chart Engine
 * Zero external chart dependencies. Uses Dark Industrial tokens and interactive hover tooltips.
 */
(function (global) {
  'use strict';

  const COLORS = {
    bg: '#151E2B',
    bgElevated: '#1C2838',
    grid: '#263345',
    borderHover: '#3B506B',
    textPrimary: '#F1F5F9',
    textSecondary: '#94A3B8',
    textMuted: '#64748B',
    blue: '#4F8CFF',
    teal: '#21C7A8',
    red: '#F06B73',
    amber: '#E7AD52',
    purple: '#A78BFA'
  };

  function getOrCreateTooltip(canvas) {
    const parent = canvas.parentElement;
    if (!parent) return null;
    if (getComputedStyle(parent).position === 'static') {
      parent.style.position = 'relative';
    }
    let tip = parent.querySelector('.chart-hover-tooltip');
    if (!tip) {
      tip = document.createElement('div');
      tip.className = 'chart-hover-tooltip';
      tip.setAttribute('aria-hidden', 'true');
      parent.appendChild(tip);
    }
    return tip;
  }

  function setupHiDpiCanvas(canvas) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const parent = canvas.parentElement;
    const width = (parent ? parent.clientWidth : canvas.clientWidth) || 640;
    const height = Number(canvas.getAttribute('data-height') || canvas.clientHeight || 280);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    return { ctx, width, height };
  }

  function drawSmoothLine(ctx, pts, color, fillGradientBottomY) {
    if (!pts || pts.length < 2) return;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i === 0 ? 0 : i - 1];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] || p2;
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
    }

    if (fillGradientBottomY !== undefined) {
      ctx.save();
      ctx.lineTo(pts[pts.length - 1].x, fillGradientBottomY);
      ctx.lineTo(pts[0].x, fillGradientBottomY);
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, 0, 0, fillGradientBottomY);
      grad.addColorStop(0, `${color}33`);
      grad.addColorStop(1, `${color}02`);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.restore();
    }

    ctx.strokeStyle = color;
    ctx.lineWidth = 2.25;
    ctx.stroke();
    ctx.restore();
  }

  function formatCompactValue(v, currency = '') {
    const num = Number(v || 0);
    const abs = Math.abs(num);
    if (abs >= 10000000) return `${currency}${(num / 10000000).toFixed(1)}Cr`;
    if (abs >= 100000) return `${currency}${(num / 100000).toFixed(1)}L`;
    if (abs >= 1000) return `${currency}${(num / 1000).toFixed(1)}k`;
    return `${currency}${Math.round(num)}`;
  }

  const Charts = {
    /**
     * Multi-series smooth spline chart (Demand / Revenue / Valuation vs Baseline)
     */
    drawSplineChart(canvas, labels, primaryData, secondaryData, options = {}) {
      if (!canvas) return;
      const currency = options.currency ?? '';
      const primaryLabel = options.primaryLabel || 'Actual / Demand';
      const secondaryLabel = options.secondaryLabel || 'Baseline / Forecast';
      const primaryColor = options.primaryColor || COLORS.blue;
      const secondaryColor = options.secondaryColor || COLORS.teal;

      const { ctx, width, height } = setupHiDpiCanvas(canvas);
      const pad = { top: 20, right: 20, bottom: 32, left: 56 };
      const plotW = Math.max(40, width - pad.left - pad.right);
      const plotH = Math.max(40, height - pad.top - pad.bottom);

      const allVals = [...(primaryData || []), ...(secondaryData || []), 10];
      const maxVal = Math.max(...allVals) * 1.15 || 100;
      const minVal = 0;

      ctx.strokeStyle = COLORS.grid;
      ctx.lineWidth = 1;
      ctx.font = '500 11px "JetBrains Mono", monospace';
      ctx.fillStyle = COLORS.textMuted;
      ctx.textAlign = 'right';

      const steps = 4;
      for (let i = 0; i <= steps; i++) {
        const y = pad.top + (plotH / steps) * i;
        ctx.beginPath();
        ctx.moveTo(pad.left, y);
        ctx.lineTo(width - pad.right, y);
        ctx.stroke();
        const val = maxVal - ((maxVal - minVal) / steps) * i;
        ctx.fillText(formatCompactValue(val, currency), pad.left - 8, y + 4);
      }

      const len = Math.max(1, (labels || []).length - 1);
      const toPts = (arr) =>
        (arr || []).map((v, i) => ({
          x: pad.left + (i / len) * plotW,
          y: pad.top + plotH - ((v - minVal) / (maxVal - minVal)) * plotH,
          val: v,
          label: labels[i]
        }));

      const pPts = toPts(primaryData);
      const sPts = toPts(secondaryData);

      ctx.textAlign = 'center';
      ctx.fillStyle = COLORS.textMuted;
      ctx.font = '500 11px "Inter", sans-serif';
      const labelStep = Math.max(1, Math.ceil((labels || []).length / 7));
      (labels || []).forEach((lbl, i) => {
        if (i % labelStep === 0 || i === labels.length - 1) {
          const x = pad.left + (i / len) * plotW;
          ctx.fillText(lbl, x, height - 10);
        }
      });

      if (sPts.length > 1) drawSmoothLine(ctx, sPts, secondaryColor);
      if (pPts.length > 1) drawSmoothLine(ctx, pPts, primaryColor, pad.top + plotH);

      pPts.forEach((pt) => {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = primaryColor;
        ctx.fill();
      });

      const tip = getOrCreateTooltip(canvas);
      canvas.onmousemove = (e) => {
        if (!tip || !pPts.length) return;
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        let closest = 0;
        let minDist = Infinity;
        pPts.forEach((pt, idx) => {
          const d = Math.abs(pt.x - mx);
          if (d < minDist) {
            minDist = d;
            closest = idx;
          }
        });
        const pt = pPts[closest];
        const sPt = sPts[closest];
        tip.innerHTML = `
          <div class="tip-title">${pt.label}</div>
          <div class="tip-row"><span class="tip-dot" style="background:${primaryColor}"></span>${primaryLabel}: <strong>${currency}${Number(pt.val).toLocaleString('en-IN')}</strong></div>
          ${sPt ? `<div class="tip-row"><span class="tip-dot" style="background:${secondaryColor}"></span>${secondaryLabel}: <strong>${currency}${Number(sPt.val).toLocaleString('en-IN')}</strong></div>` : ''}
        `;
        tip.style.opacity = '1';
        tip.style.left = `${Math.min(width - 175, Math.max(8, pt.x + 12))}px`;
        tip.style.top = `${Math.max(8, pt.y - 36)}px`;
      };
      canvas.onmouseleave = () => {
        if (tip) tip.style.opacity = '0';
      };
    },

    /**
     * Segmented Donut Chart for Stock Health / Category Valuation
     */
    drawDonutChart(canvas, segments, centerText, subText) {
      if (!canvas) return;
      const { ctx, width, height } = setupHiDpiCanvas(canvas);
      const cx = width / 2;
      const cy = height / 2;
      const radius = Math.max(36, Math.min(cx, cy) - 18);
      const lineWidth = Math.max(14, Math.round(radius * 0.28));

      const total = Math.max(1, segments.reduce((acc, s) => acc + Math.max(0, Number(s.value || 0)), 0));
      let angle = -Math.PI / 2;
      const arcs = [];

      segments.forEach((seg) => {
        const val = Math.max(0, Number(seg.value || 0));
        if (val <= 0) return;
        const slice = (val / total) * (Math.PI * 2);
        const startA = angle;
        const endA = angle + slice;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, startA + 0.02, endA - 0.02);
        ctx.strokeStyle = seg.color || COLORS.blue;
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'butt';
        ctx.stroke();
        arcs.push({ ...seg, startA, endA, pct: Math.round((val / total) * 100) });
        angle = endA;
      });

      if (arcs.length === 0) {
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.strokeStyle = COLORS.grid;
        ctx.lineWidth = lineWidth;
        ctx.stroke();
      }

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = COLORS.textPrimary;
      ctx.font = '700 18px "JetBrains Mono", monospace';
      ctx.fillText(centerText || '', cx, cy - 8);
      ctx.fillStyle = COLORS.textMuted;
      ctx.font = '500 11px "Inter", sans-serif';
      ctx.fillText(subText || '', cx, cy + 12);

      const tip = getOrCreateTooltip(canvas);
      canvas.onmousemove = (e) => {
        if (!tip || !arcs.length) return;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left - cx;
        const y = e.clientY - rect.top - cy;
        const dist = Math.hypot(x, y);
        if (dist < radius - lineWidth || dist > radius + lineWidth) {
          tip.style.opacity = '0';
          return;
        }
        let theta = Math.atan2(y, x);
        if (theta < -Math.PI / 2) theta += Math.PI * 2;
        const hit = arcs.find((a) => theta >= a.startA && theta <= a.endA);
        if (!hit) {
          tip.style.opacity = '0';
          return;
        }
        tip.innerHTML = `
          <div class="tip-title">${hit.label}</div>
          <div class="tip-row"><span class="tip-dot" style="background:${hit.color}"></span><strong>${hit.value.toLocaleString('en-IN')}</strong> (${hit.pct}%)</div>
        `;
        tip.style.opacity = '1';
        tip.style.left = `${Math.min(width - 150, e.clientX - rect.left + 12)}px`;
        tip.style.top = `${Math.max(8, e.clientY - rect.top - 28)}px`;
      };
      canvas.onmouseleave = () => {
        if (tip) tip.style.opacity = '0';
      };
    },

    /**
     * AI Demand Trajectory Chart with Historical Actuals + 80%/95% Confidence Bands
     */
    drawForecastChart(canvas, timeline) {
      if (!canvas || !Array.isArray(timeline) || timeline.length === 0) return;
      const { ctx, width, height } = setupHiDpiCanvas(canvas);
      const pad = { top: 24, right: 20, bottom: 32, left: 52 };
      const plotW = Math.max(40, width - pad.left - pad.right);
      const plotH = Math.max(40, height - pad.top - pad.bottom);

      let maxVal = 10;
      timeline.forEach((pt) => {
        maxVal = Math.max(maxVal, pt.actual || 0, pt.upper95 || 0, pt.predicted || 0);
      });
      maxVal *= 1.12;

      const xFor = (i) => pad.left + (i / Math.max(1, timeline.length - 1)) * plotW;
      const yFor = (val) => pad.top + plotH - (val / maxVal) * plotH;

      ctx.strokeStyle = COLORS.grid;
      ctx.lineWidth = 1;
      ctx.font = '500 11px "JetBrains Mono", monospace';
      ctx.fillStyle = COLORS.textMuted;
      ctx.textAlign = 'right';
      for (let i = 0; i <= 4; i++) {
        const y = pad.top + (plotH / 4) * i;
        ctx.beginPath();
        ctx.moveTo(pad.left, y);
        ctx.lineTo(width - pad.right, y);
        ctx.stroke();
        ctx.fillText(String(Math.round(maxVal - (maxVal / 4) * i)), pad.left - 8, y + 4);
      }

      const forecastPts = timeline.map((pt, idx) => ({ ...pt, idx })).filter((pt) => pt.type === 'FORECAST');
      if (forecastPts.length > 0) {
        const splitX = xFor(forecastPts[0].idx);
        ctx.save();
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = COLORS.borderHover;
        ctx.beginPath();
        ctx.moveTo(splitX, pad.top);
        ctx.lineTo(splitX, pad.top + plotH);
        ctx.stroke();
        ctx.restore();

        // 95% confidence band
        ctx.beginPath();
        forecastPts.forEach((pt, k) => {
          const x = xFor(pt.idx);
          const y = yFor(pt.upper95);
          if (k === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        for (let k = forecastPts.length - 1; k >= 0; k--) {
          ctx.lineTo(xFor(forecastPts[k].idx), yFor(forecastPts[k].lower95));
        }
        ctx.closePath();
        ctx.fillStyle = 'rgba(167, 139, 250, 0.14)';
        ctx.fill();

        // 80% confidence band
        ctx.beginPath();
        forecastPts.forEach((pt, k) => {
          const x = xFor(pt.idx);
          const y = yFor(pt.upper80);
          if (k === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        for (let k = forecastPts.length - 1; k >= 0; k--) {
          ctx.lineTo(xFor(forecastPts[k].idx), yFor(forecastPts[k].lower80));
        }
        ctx.closePath();
        ctx.fillStyle = 'rgba(167, 139, 250, 0.24)';
        ctx.fill();
      }

      // Historical actual line
      const actualPts = timeline.map((pt, idx) => ({ ...pt, idx })).filter((pt) => pt.actual !== null);
      if (actualPts.length > 1) {
        ctx.beginPath();
        actualPts.forEach((pt, k) => {
          const x = xFor(pt.idx);
          const y = yFor(pt.actual);
          if (k === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.strokeStyle = COLORS.blue;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Forecast prediction line
      if (forecastPts.length > 0) {
        ctx.beginPath();
        const anchor = actualPts[actualPts.length - 1];
        if (anchor) ctx.moveTo(xFor(anchor.idx), yFor(anchor.actual));
        forecastPts.forEach((pt, k) => {
          const x = xFor(pt.idx);
          const y = yFor(pt.predicted);
          if (!anchor && k === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.strokeStyle = COLORS.purple;
        ctx.lineWidth = 2.4;
        ctx.stroke();
      }

      // Axis ticks
      ctx.fillStyle = COLORS.textMuted;
      ctx.font = '500 10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      const step = Math.max(1, Math.ceil(timeline.length / 8));
      timeline.forEach((pt, idx) => {
        if (idx % step === 0 || idx === timeline.length - 1) {
          ctx.fillText(pt.dayLabel, xFor(idx), height - 10);
        }
      });

      const tip = getOrCreateTooltip(canvas);
      canvas.onmousemove = (e) => {
        if (!tip) return;
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const idx = Math.max(0, Math.min(timeline.length - 1, Math.round(((mx - pad.left) / plotW) * (timeline.length - 1))));
        const pt = timeline[idx];
        const px = xFor(idx);
        const py = yFor(pt.actual !== null ? pt.actual : pt.predicted);
        tip.innerHTML = pt.type === 'ACTUAL'
          ? `<div class="tip-title">${pt.dayLabel} (Actual)</div><div class="tip-row"><span class="tip-dot" style="background:${COLORS.blue}"></span>Units Sold: <strong>${pt.actual}u</strong></div>`
          : `<div class="tip-title">${pt.dayLabel} (Forecast)</div>
             <div class="tip-row"><span class="tip-dot" style="background:${COLORS.purple}"></span>Predicted: <strong>${pt.predicted}u</strong></div>
             <div class="tip-row">80% Band: ${pt.lower80}–${pt.upper80}u</div>
             <div class="tip-row">95% Band: ${pt.lower95}–${pt.upper95}u</div>`;
        tip.style.opacity = '1';
        tip.style.left = `${Math.min(width - 170, Math.max(8, px + 10))}px`;
        tip.style.top = `${Math.max(8, py - 42)}px`;
      };
      canvas.onmouseleave = () => {
        if (tip) tip.style.opacity = '0';
      };
    },

    /**
     * Vertical grouped / single Bar Chart (Hub Comparison, Supplier KPIs, Apriori Lift)
     */
    drawBarChart(canvas, labels, values, options = {}) {
      if (!canvas) return;
      const { ctx, width, height } = setupHiDpiCanvas(canvas);
      const color = options.color || COLORS.blue;
      const unit = options.unit || '';
      const currency = options.currency || '';
      const barColors = options.colors || null;
      const pad = { top: 18, right: 16, bottom: 38, left: 52 };
      const plotW = Math.max(40, width - pad.left - pad.right);
      const plotH = Math.max(40, height - pad.top - pad.bottom);
      const maxVal = Math.max(10, ...(values || []), 1) * 1.15;

      ctx.strokeStyle = COLORS.grid;
      ctx.lineWidth = 1;
      ctx.font = '500 10px "JetBrains Mono", monospace';
      ctx.fillStyle = COLORS.textMuted;
      ctx.textAlign = 'right';
      for (let i = 0; i <= 4; i++) {
        const y = pad.top + (plotH / 4) * i;
        ctx.beginPath();
        ctx.moveTo(pad.left, y);
        ctx.lineTo(width - pad.right, y);
        ctx.stroke();
        ctx.fillText(formatCompactValue(maxVal - (maxVal / 4) * i, currency) + unit, pad.left - 8, y + 4);
      }

      const count = Math.max(1, (labels || []).length);
      const slotW = plotW / count;
      const barW = Math.min(44, Math.max(14, slotW * 0.56));
      const bars = [];

      labels.forEach((lbl, i) => {
        const val = Number(values[i] || 0);
        const h = Math.max(2, (val / maxVal) * plotH);
        const x = pad.left + slotW * i + (slotW - barW) / 2;
        const y = pad.top + plotH - h;
        const fill = (barColors && barColors[i]) || color;
        ctx.fillStyle = fill;
        ctx.fillRect(x, y, barW, h);

        ctx.fillStyle = COLORS.textSecondary;
        ctx.font = '500 10px "Inter", sans-serif';
        ctx.textAlign = 'center';
        const shortLabel = lbl.length > 14 ? lbl.slice(0, 13) + '…' : lbl;
        ctx.fillText(shortLabel, x + barW / 2, height - 14);
        bars.push({ x, y, w: barW, h, label: lbl, val, color: fill });
      });

      const tip = getOrCreateTooltip(canvas);
      canvas.onmousemove = (e) => {
        if (!tip) return;
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const hit = bars.find((b) => mx >= b.x - 6 && mx <= b.x + b.w + 6);
        if (!hit) {
          tip.style.opacity = '0';
          return;
        }
        tip.innerHTML = `<div class="tip-title">${hit.label}</div><div class="tip-row"><span class="tip-dot" style="background:${hit.color}"></span><strong>${currency}${hit.val.toLocaleString('en-IN')}${unit}</strong></div>`;
        tip.style.opacity = '1';
        tip.style.left = `${Math.min(width - 155, Math.max(8, hit.x + hit.w / 2))}px`;
        tip.style.top = `${Math.max(8, hit.y - 34)}px`;
      };
      canvas.onmouseleave = () => {
        if (tip) tip.style.opacity = '0';
      };
    }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Charts;
  }
  global.PalletsCharts = Charts;
})(typeof window !== 'undefined' ? window : globalThis);

