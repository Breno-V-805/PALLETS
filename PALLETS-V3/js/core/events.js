/**
 * PALLETS V3 // Lightweight Typed Pub/Sub Event Bus
 */
(function (global) {
  'use strict';

  const listeners = new Map();

  const Events = {
    on(eventName, fn) {
      if (!listeners.has(eventName)) listeners.set(eventName, new Set());
      listeners.get(eventName).add(fn);
      return () => Events.off(eventName, fn);
    },
    off(eventName, fn) {
      const set = listeners.get(eventName);
      if (set) set.delete(fn);
    },
    emit(eventName, detail) {
      const set = listeners.get(eventName);
      if (!set) return;
      set.forEach((fn) => {
        try {
          fn(detail);
        } catch (err) {
          console.error(`[PalletsEvents] Listener failed for ${eventName}:`, err);
        }
      });
    }
  };

  global.PalletsEvents = Events;
})(typeof window !== 'undefined' ? window : globalThis);

