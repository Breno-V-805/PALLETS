/**
 * PALLETS V3 // Preserved Business Logic & Mathematical Formulas
 * Preserves all V2 inventory, replenishment, risk, and valuation formulas verbatim.
 */
(function (global) {
  'use strict';

  const HUBS = [
    { id: 'BLR_NORTH_DC', name: 'Bangalore North DC', region: 'South', code: 'BLR-01' },
    { id: 'MUM_BANDRA_HUB', name: 'Mumbai Bandra Hub', region: 'West', code: 'MUM-02' },
    { id: 'DEL_GURGAON_CORE', name: 'Delhi-NCR Core Hub', region: 'North', code: 'DEL-03' },
    { id: 'HYD_HITEC_STORE', name: 'Hyderabad Hitec Store', region: 'South', code: 'HYD-04' }
  ];

  const HUB_MAP = HUBS.reduce((acc, h) => {
    acc[h.id] = h;
    return acc;
  }, {});

  /**
   * Reorder Point: ROP = (Daily Demand × Lead Time) + Safety Stock
   */
  function calculateROP(product) {
    const dailyDemand = Number(product?.dailyDemand ?? 0);
    const leadTimeDays = Number(product?.leadTimeDays ?? 0);
    const safetyStock = Number(product?.safetyStock ?? 0);
    return Math.round((dailyDemand * leadTimeDays) + safetyStock);
  }

  /**
   * Inventory Position: IP = (On-hand + On-order) - Reserved
   */
  function calculateIP(product) {
    const onHand = Number(product?.onHand ?? 0);
    const onOrder = Number(product?.onOrder ?? 0);
    const reserved = Number(product?.reserved ?? 0);
    return (onHand + onOrder) - reserved;
  }

  /**
   * Recommended Order Quantity: Q = ceil(max(0, Target Stock - IP) / MOQ) × MOQ
   */
  function calculateRecommendedOrderQuantity(product) {
    const ip = calculateIP(product);
    const targetStock = Number(product?.targetStock ?? 0);
    const rawQ = Math.max(0, targetStock - ip);
    if (rawQ === 0) return 0;
    const moq = Math.max(1, Number(product?.moq || 100));
    return Math.ceil(rawQ / moq) * moq;
  }

  /**
   * Days of Inventory Remaining (Runway): Runway = On-hand / Daily Demand
   */
  function calculateRunwayDays(product) {
    const dailyDemand = Number(product?.dailyDemand ?? 0);
    const onHand = Number(product?.onHand ?? 0);
    if (dailyDemand <= 0) return 999;
    return Math.round((onHand / dailyDemand) * 10) / 10;
  }

  /**
   * Stockout ETA formatted string
   */
  function calculateStockoutETA(product) {
    const runway = calculateRunwayDays(product);
    if (runway >= 99) return 'Healthy Runway (>90d)';
    const now = new Date();
    const etaDate = new Date(now.getTime() + runway * 24 * 60 * 60 * 1000);
    if (runway < 1) {
      return `Today, ${etaDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    if (runway < 2) {
      return `Tomorrow, ${etaDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    return etaDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  /**
   * Estimated Revenue Lost during Lead-Time Deficit
   */
  function calculateLostRevenue(product) {
    const runway = calculateRunwayDays(product);
    const leadTimeDays = Number(product?.leadTimeDays ?? 0);
    if (runway >= leadTimeDays) return 0;
    const stockoutDays = Math.max(1, leadTimeDays - Math.floor(runway));
    return Math.round(stockoutDays * Number(product?.dailyDemand ?? 0) * Number(product?.unitPrice ?? 0));
  }

  /**
   * Risk Status Thresholds (Preserved Verbatim):
   * - CRITICAL: <= 3.0 days
   * - HIGH: > 3.0 and <= 7.0 days
   * - OPTIMAL: > 7.0 and < 35.0 days
   * - OVERSTOCK: >= 35.0 days
   */
  function evaluateRiskStatus(product) {
    const runway = calculateRunwayDays(product);
    if (runway <= 3.0) return 'CRITICAL';
    if (runway <= 7.0) return 'HIGH';
    if (runway >= 35.0) return 'OVERSTOCK';
    return 'OPTIMAL';
  }

  function calculateHoldingValuation(product) {
    return Number(product?.onHand ?? 0) * Number(product?.costPrice ?? 0);
  }

  const api = {
    HUBS,
    HUB_MAP,
    calculateROP,
    calculateIP,
    calculateRecommendedOrderQuantity,
    calculateRunwayDays,
    calculateStockoutETA,
    calculateLostRevenue,
    evaluateRiskStatus,
    calculateHoldingValuation
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  global.PalletsCalculations = api;
})(typeof window !== 'undefined' ? window : globalThis);

