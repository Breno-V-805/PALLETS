/**
 * PALLETS V3 // AI Demand Forecasting Engine (Preserved V2 Core)
 * Evaluates Moving Average (7d, 14d), Holt's Linear, and Holt-Winters Weekly Seasonality.
 * Calculates MAE, RMSE, WAPE (0-100 scale), and 80%/95% Confidence Prediction Intervals.
 */
class PalletsForecastingEngine {
  /**
   * Run full model tournament and generate forecast
   */
  static runForecast(historyDaily, options = {}) {
    const { horizonDays = 30, promoBoost = 0.0, preferredModel = 'AUTO' } = options;

    if (!Array.isArray(historyDaily) || historyDaily.length < 14) {
      throw new Error('At least 14 days of historical daily sales are required for forecasting.');
    }

    const series = historyDaily.map(d => (typeof d === 'number' ? d : parseFloat(d.quantity || d.qty || 0)));
    const dates = historyDaily.map(d => (d.date || d.sale_date || ''));

    // Train/Test Split (80% Train, 20% Holdout Validation)
    const splitIndex = Math.floor(series.length * 0.8);
    const trainSeries = series.slice(0, splitIndex);
    const testSeries = series.slice(splitIndex);

    // Candidates (Preserved parameters verbatim)
    const candidates = [
      {
        id: 'MOVING_AVERAGE_7D',
        name: 'Moving Average (7-Day)',
        fn: (tr, h) => this.predictMovingAverage(tr, h, 7)
      },
      {
        id: 'MOVING_AVERAGE_14D',
        name: 'Moving Average (14-Day)',
        fn: (tr, h) => this.predictMovingAverage(tr, h, 14)
      },
      {
        id: 'EXPONENTIAL_SMOOTHING_HOLT',
        name: "Double Exponential Smoothing (Holt's Linear)",
        fn: (tr, h) => this.predictHoltsLinear(tr, h, 0.3, 0.1)
      },
      {
        id: 'HOLT_WINTERS_WEEKLY',
        name: 'Triple Exponential Smoothing (Holt-Winters Weekly)',
        fn: (tr, h) => this.predictHoltWintersWeekly(tr, h, 7, 0.2, 0.1, 0.3)
      }
    ];

    const evaluation = candidates.map(c => {
      const preds = c.fn(trainSeries, testSeries.length);
      const metrics = this.calculateMetrics(testSeries, preds);
      return {
        id: c.id,
        name: c.name,
        mae: metrics.mae,
        rmse: metrics.rmse,
        wape: metrics.wape,
        testPredictions: preds
      };
    });

    // Sort by lowest WAPE, then lowest RMSE
    evaluation.sort((a, b) => a.wape - b.wape || a.rmse - b.rmse);

    let selectedModel = evaluation[0];
    if (preferredModel !== 'AUTO') {
      const found = evaluation.find(e => e.id === preferredModel);
      if (found) selectedModel = found;
    }

    // Generate forecast using full series
    const bestCandidate = candidates.find(c => c.id === selectedModel.id) || candidates[0];
    let pointForecasts = bestCandidate.fn(series, horizonDays);

    // Apply promotional boost
    if (promoBoost > 0) {
      pointForecasts = pointForecasts.map(v => v * (1 + promoBoost));
    }

    // Generate timeline with 80% and 95% confidence intervals
    const stdErr = Math.max(1.0, selectedModel.rmse || 2.5);
    const lastDate = dates[dates.length - 1] ? new Date(dates[dates.length - 1]) : new Date();

    const timeline = pointForecasts.map((val, idx) => {
      const dayOffset = idx + 1;
      const forecastDateObj = new Date(lastDate.getTime() + dayOffset * 24 * 60 * 60 * 1000);
      const forecastDateStr = forecastDateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' });
      const roundedVal = Math.max(0, Math.round(val * 10) / 10);

      const dynamicErr = stdErr * Math.sqrt(dayOffset / 7);
      const lower80 = Math.max(0, Math.round((roundedVal - 1.28 * dynamicErr) * 10) / 10);
      const upper80 = Math.round((roundedVal + 1.28 * dynamicErr) * 10) / 10;
      const lower95 = Math.max(0, Math.round((roundedVal - 1.96 * dynamicErr) * 10) / 10);
      const upper95 = Math.round((roundedVal + 1.96 * dynamicErr) * 10) / 10;

      return {
        day: dayOffset,
        dateLabel: forecastDateStr,
        isoDate: forecastDateObj.toISOString().slice(0, 10),
        forecastDemand: roundedVal,
        lower80,
        upper80,
        lower95,
        upper95
      };
    });

    // Aggregates
    const sumDemand = (days) => {
      const slice = timeline.slice(0, days);
      return Math.round(slice.reduce((acc, curr) => acc + curr.forecastDemand, 0));
    };

    return {
      selectedModel: selectedModel.id,
      selectedModelName: selectedModel.name,
      isAutoSelected: preferredModel === 'AUTO',
      autoWinnerId: evaluation[0].id,
      metrics: {
        mae: selectedModel.mae,
        rmse: selectedModel.rmse,
        wape: selectedModel.wape
      },
      modelComparison: evaluation,
      totals: {
        next7Days: sumDemand(7),
        next30Days: sumDemand(30),
        next90Days: sumDemand(Math.min(90, timeline.length)),
        avgDaily: Math.round((sumDemand(Math.min(30, timeline.length)) / Math.min(30, timeline.length)) * 10) / 10
      },
      timeline
    };
  }

  static predictMovingAverage(series, horizon, windowSize = 7) {
    const k = Math.min(windowSize, series.length);
    const windowSlice = series.slice(-k);
    const avg = windowSlice.reduce((sum, v) => sum + v, 0) / k;
    return new Array(horizon).fill(avg);
  }

  static predictHoltsLinear(series, horizon, alpha = 0.3, beta = 0.1) {
    if (series.length < 2) return new Array(horizon).fill(series[0] || 0);

    let level = series[0];
    let trend = series[1] - series[0];

    for (let t = 1; t < series.length; t++) {
      const prevLevel = level;
      level = alpha * series[t] + (1 - alpha) * (prevLevel + trend);
      trend = beta * (level - prevLevel) + (1 - beta) * trend;
    }

    const predictions = [];
    for (let h = 1; h <= horizon; h++) {
      predictions.push(Math.max(0, level + h * trend));
    }
    return predictions;
  }

  static predictHoltWintersWeekly(series, horizon, seasonLength = 7, alpha = 0.2, beta = 0.1, gamma = 0.3) {
    if (series.length < seasonLength * 2) {
      return this.predictHoltsLinear(series, horizon, alpha, beta);
    }

    let level = 0;
    for (let i = 0; i < seasonLength; i++) level += series[i];
    level /= seasonLength;

    let trend = 0;
    for (let i = 0; i < seasonLength; i++) {
      trend += (series[seasonLength + i] - series[i]) / seasonLength;
    }
    trend /= seasonLength;

    const seasonals = new Array(seasonLength);
    for (let i = 0; i < seasonLength; i++) {
      seasonals[i] = series[i] / (level || 1);
    }

    for (let t = seasonLength; t < series.length; t++) {
      const val = series[t];
      const sIdx = t % seasonLength;
      const prevLevel = level;
      level = alpha * (val / (seasonals[sIdx] || 1)) + (1 - alpha) * (prevLevel + trend);
      trend = beta * (level - prevLevel) + (1 - beta) * trend;
      seasonals[sIdx] = gamma * (val / (level || 1)) + (1 - gamma) * seasonals[sIdx];
    }

    const predictions = [];
    for (let h = 1; h <= horizon; h++) {
      const sIdx = (series.length + h - 1) % seasonLength;
      const pred = (level + h * trend) * (seasonals[sIdx] || 1);
      predictions.push(Math.max(0, pred));
    }
    return predictions;
  }

  static calculateMetrics(actual, predicted) {
    const n = Math.min(actual.length, predicted.length);
    if (n === 0) return { mae: 0, rmse: 0, wape: 0 };

    let sumAbsError = 0;
    let sumSqError = 0;
    let sumActual = 0;

    for (let i = 0; i < n; i++) {
      const diff = actual[i] - predicted[i];
      sumAbsError += Math.abs(diff);
      sumSqError += diff * diff;
      sumActual += actual[i];
    }

    const mae = Math.round((sumAbsError / n) * 100) / 100;
    const rmse = Math.round(Math.sqrt(sumSqError / n) * 100) / 100;
    const wape = sumActual > 0 ? Math.round((sumAbsError / sumActual) * 10000) / 100 : 0;

    return { mae, rmse, wape };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PalletsForecastingEngine;
}
if (typeof window !== 'undefined') {
  window.PalletsForecastingEngine = PalletsForecastingEngine;
} else if (typeof globalThis !== 'undefined') {
  globalThis.PalletsForecastingEngine = PalletsForecastingEngine;
}

