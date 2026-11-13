/**
 * PALLETS V3 // Frontend Role & Permission Helper
 * Mirrors server.js RBAC rules for honest UI gating (server.js remains authoritative).
 */
(function (global) {
  'use strict';

  const ROUTE_ACCESS = {
    'command-center': ['Admin', 'Inventory Manager', 'Staff'],
    products: ['Admin', 'Inventory Manager', 'Staff'],
    inventory: ['Admin', 'Inventory Manager', 'Staff'],
    ingestion: ['Admin', 'Inventory Manager'],
    forecasting: ['Admin', 'Inventory Manager'],
    replenishment: ['Admin', 'Inventory Manager'],
    suppliers: ['Admin', 'Inventory Manager'],
    analytics: ['Admin', 'Inventory Manager'],
    copilot: ['Admin', 'Inventory Manager', 'Staff'],
    administration: ['Admin']
  };

  function canAccessRoute(user, routeId) {
    if (!user) return false;
    const allowed = ROUTE_ACCESS[routeId];
    return Array.isArray(allowed) ? allowed.includes(user.role) : false;
  }

  function isAdmin(user) {
    return Boolean(user && user.role === 'Admin');
  }

  function isManagerOrAdmin(user) {
    return Boolean(user && (user.role === 'Admin' || user.role === 'Inventory Manager'));
  }

  function isStaff(user) {
    return Boolean(user && user.role === 'Staff');
  }

  function roleBadgeClass(role) {
    if (role === 'Admin') return 'badge-purple';
    if (role === 'Inventory Manager') return 'badge-info';
    return 'badge-neutral';
  }

  global.PalletsPermissions = {
    ROUTE_ACCESS,
    canAccessRoute,
    isAdmin,
    isManagerOrAdmin,
    isStaff,
    roleBadgeClass
  };
})(typeof window !== 'undefined' ? window : globalThis);

