/**
 * Pallets // Zero-Dependency Canvas Charting Engine
 * Matches exact SaaS design of uploaded dashboard (Dual Bézier Spline & Donut Ring).
 */
class PalletsCharts {
  /**
   * Render Multi-Line Smooth Bézier Spline Chart
   */
  static renderSplineChart(canvas, config = {}) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;

    const padLeft = 40;
    const padRight = 20;
    const padTop = 25;
    const padBottom = 40;

    const chartW = width - padLeft - padRight;
    const chartH = height - padTop - padBottom;

    ctx.clearRect(0, 0, width, height);

    const labels = config.labels || ['03 Wed', '04 Thu', '05 Fri', '06 Sat', '07 Sun', '08 Mon', '09 Tue', '10 Wed'];
    const series1 = config.series1 || [20, 14, 5, 27, 30, 14, 34, 39, 28, 33, 26, 38, 43, 31, 35, 53]; // Blue curve
    const series2 = config.series2 || [42, 34, 33, 38, 37, 24, 37, 34, 31, 26, 17, 23, 24, 26, 17, 7]; // Grey curve

    const maxVal = Math.max(60, ...series1, ...series2);
    const minVal = 0;

    // 1. Draw subtle horizontal gridlines & Y-axis labels
    const gridSteps = 6;
    ctx.font = '500 11px "Inter", sans-serif';
    ctx.fillStyle = '#94A3B8';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    for (let i = 0; i <= gridSteps; i++) {
      const val = Math.round((maxVal / gridSteps) * i);
      const y = padTop + chartH - (i / gridSteps) * chartH;

      ctx.strokeStyle = '#F1F5F9';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(width - padRight, y);
      ctx.stroke();

      ctx.fillText(val.toString(), padLeft - 10, y);
    }

    // Function to calculate points
    const getPoints = (data) => {
      return data.map((v, i) => {
        const x = padLeft + (i / (data.length - 1)) * chartW;
        const y = padTop + chartH - ((v - minVal) / (maxVal - minVal)) * chartH;
        return { x, y, value: v };
      });
    };

    // Helper to draw smooth Bézier curve through points
    const drawCurve = (points, strokeColor, fillColor = null) => {
      if (points.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);

      for (let i = 0; i < points.length - 1; i++) {
        const p0 = (i > 0) ? points[i - 1] : points[0];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = (i != points.length - 2) ? points[i + 2] : p2;

        const cp1x = p1.x + (p2.x - p0.x) / 6;
        const cp1y = p1.y + (p2.y - p0.y) / 6;
        const cp2x = p2.x - (p3.x - p1.x) / 6;
        const cp2y = p2.y - (p3.y - p1.y) / 6;

        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
      }

      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      if (fillColor) {
        ctx.lineTo(points[points.length - 1].x, padTop + chartH);
        ctx.lineTo(points[0].x, padTop + chartH);
        ctx.closePath();
        ctx.fillStyle = fillColor;
        ctx.fill();
      }
    };

    const ptsGrey = getPoints(series2);
    const ptsBlue = getPoints(series1);

    // 2. Draw Soft Grey Curve (Costs / Historical)
    drawCurve(ptsGrey, '#CBD5E1');

    // 3. Draw Vibrant Royal Blue Curve with subtle gradient glow
    const blueGradient = ctx.createLinearGradient(0, padTop, 0, padTop + chartH);
    blueGradient.addColorStop(0, 'rgba(11, 87, 208, 0.12)');
    blueGradient.addColorStop(1, 'rgba(11, 87, 208, 0.00)');
    drawCurve(ptsBlue, '#0B57D0', blueGradient);

    // 4. Draw interactive marker dots on the blue curve
    ptsBlue.forEach((pt, idx) => {
      if (idx % 2 === 0 || idx === ptsBlue.length - 1) {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
        ctx.strokeStyle = '#0B57D0';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });

    // 5. Draw X-axis Labels
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#64748B';

    labels.forEach((lbl, i) => {
      const x = padLeft + (i / (labels.length - 1)) * chartW;
      ctx.fillText(lbl, x, padTop + chartH + 12);
    });
  }

  /**
   * Render Donut Ring Chart with Center Totals
   */
  static renderDonutChart(canvas, config = {}) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    ctx.clearRect(0, 0, width, height);

    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.38;
    const strokeWidth = 18;

    const segments = config.segments || [
      { label: 'Dairy & Chilled', value: 42, color: '#0B57D0' },
      { label: 'Beverages', value: 28, color: '#8B5CF6' },
      { label: 'Snacks', value: 18, color: '#A3E635' },
      { label: 'Staples', value: 12, color: '#F59E0B' }
    ];

    const total = segments.reduce((sum, s) => sum + s.value, 0) || 1;
    let startAngle = -Math.PI / 2;
    const gapAngle = 0.08; // gap between segments for modern donut look

    segments.forEach(seg => {
      const sliceAngle = (seg.value / total) * (Math.PI * 2);
      const endAngle = startAngle + sliceAngle - gapAngle;

      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, startAngle, endAngle, false);
      ctx.strokeStyle = seg.color;
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = 'round';
      ctx.stroke();

      startAngle += sliceAngle;
    });

    // Center Text
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.font = '700 24px "Inter", sans-serif';
    ctx.fillStyle = '#0F172A';
    ctx.fillText(config.centerVal || '$6.2', centerX, centerY - 8);

    ctx.font = '500 12px "Inter", sans-serif';
    ctx.fillStyle = '#64748B';
    ctx.fillText(config.centerSub || 'Totals', centerX, centerY + 14);
  }

  /**
   * Render AI Forecast Projection Chart with Shaded Confidence Intervals
   */
  static renderForecastChart(canvas, config = {}) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;

    const padLeft = 45;
    const padRight = 30;
    const padTop = 25;
    const padBottom = 35;

    const chartW = width - padLeft - padRight;
    const chartH = height - padTop - padBottom;

    ctx.clearRect(0, 0, width, height);

    const history = config.history || [28, 32, 29, 35, 41, 38, 45, 42, 50, 48, 52, 55, 49, 58];
    const timeline = config.timeline || []; // Array of { day, dateLabel, forecastDemand, lower80, upper80, lower95, upper95 }

    const totalPoints = history.length + timeline.length;
    if (totalPoints < 2) return;

    // Determine scale
    let maxVal = Math.max(
      ...history,
      ...timeline.map(t => t.upper95 || t.forecastDemand || 0)
    ) * 1.15;
    if (maxVal <= 0) maxVal = 100;
    const minVal = 0;

    // 1. Grid lines
    const gridSteps = 5;
    ctx.font = '500 11px "Inter", sans-serif';
    ctx.fillStyle = '#94A3B8';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    for (let i = 0; i <= gridSteps; i++) {
      const val = Math.round((maxVal / gridSteps) * i);
      const y = padTop + chartH - (i / gridSteps) * chartH;

      ctx.strokeStyle = '#F1F5F9';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(width - padRight, y);
      ctx.stroke();

      ctx.fillText(val.toString(), padLeft - 10, y);
    }

    const getX = (idx) => padLeft + (idx / (totalPoints - 1)) * chartW;
    const getY = (val) => padTop + chartH - ((val - minVal) / (maxVal - minVal)) * chartH;

    // 2. Draw 95% Confidence Interval Band (Light Blue Shade)
    if (timeline.length > 0) {
      const startHistIdx = history.length - 1;
      const lastHistVal = history[startHistIdx];

      ctx.beginPath();
      ctx.moveTo(getX(startHistIdx), getY(lastHistVal));

      timeline.forEach((pt, i) => {
        const idx = history.length + i;
        ctx.lineTo(getX(idx), getY(pt.upper95));
      });

      for (let i = timeline.length - 1; i >= 0; i--) {
        const idx = history.length + i;
        ctx.lineTo(getX(idx), getY(timeline[i].lower95));
      }

      ctx.closePath();
      ctx.fillStyle = 'rgba(11, 87, 208, 0.08)';
      ctx.fill();

      // 3. Draw 80% Confidence Interval Band (Slightly Darker Tint)
      ctx.beginPath();
      ctx.moveTo(getX(startHistIdx), getY(lastHistVal));

      timeline.forEach((pt, i) => {
        const idx = history.length + i;
        ctx.lineTo(getX(idx), getY(pt.upper80));
      });

      for (let i = timeline.length - 1; i >= 0; i--) {
        const idx = history.length + i;
        ctx.lineTo(getX(idx), getY(timeline[i].lower80));
      }

      ctx.closePath();
      ctx.fillStyle = 'rgba(11, 87, 208, 0.14)';
      ctx.fill();
    }

    // 4. Draw Historical Curve
    ctx.beginPath();
    history.forEach((val, i) => {
      const x = getX(i);
      const y = getY(val);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#64748B';
    ctx.lineWidth = 2.2;
    ctx.stroke();

    // 5. Vertical Forecast Dividing Line
    if (timeline.length > 0) {
      const divX = getX(history.length - 1);
      ctx.beginPath();
      ctx.setLineDash([4, 4]);
      ctx.moveTo(divX, padTop);
      ctx.lineTo(divX, padTop + chartH);
      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.font = '600 10px "Inter", sans-serif';
      ctx.fillStyle = '#0B57D0';
      ctx.textAlign = 'center';
      ctx.fillText('FORECAST', divX, padTop - 10);
    }

    // 6. Draw Forecast Point Curve
    if (timeline.length > 0) {
      ctx.beginPath();
      const startX = getX(history.length - 1);
      const startY = getY(history[history.length - 1]);
      ctx.moveTo(startX, startY);

      timeline.forEach((pt, i) => {
        const idx = history.length + i;
        ctx.lineTo(getX(idx), getY(pt.forecastDemand));
      });

      ctx.strokeStyle = '#0B57D0';
      ctx.lineWidth = 2.8;
      ctx.stroke();

      // Forecast Dots
      timeline.forEach((pt, i) => {
        if (i % 2 === 0 || i === timeline.length - 1) {
          const idx = history.length + i;
          const x = getX(idx);
          const y = getY(pt.forecastDemand);

          ctx.beginPath();
          ctx.arc(x, y, 4, 0, Math.PI * 2);
          ctx.fillStyle = '#FFFFFF';
          ctx.fill();
          ctx.strokeStyle = '#0B57D0';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      });
    }

    // 7. X-Axis Labels (Sampled)
    ctx.fillStyle = '#64748B';
    ctx.font = '500 11px "Inter", sans-serif';
    ctx.textBaseline = 'top';

    const step = Math.max(1, Math.floor(totalPoints / 6));
    for (let i = 0; i < totalPoints; i += step) {
      let label = `D-${history.length - i}`;
      if (i >= history.length) {
        const tIdx = i - history.length;
        label = timeline[tIdx]?.dateLabel || `+${tIdx + 1}d`;
      }
      ctx.textAlign = 'center';
      ctx.fillText(label, getX(i), padTop + chartH + 10);
    }
  }
}

if (typeof window !== 'undefined') {
  window.PalletsCharts = PalletsCharts;
} else if (typeof globalThis !== 'undefined') {
  globalThis.PalletsCharts = PalletsCharts;
}
