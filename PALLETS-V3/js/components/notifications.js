/**
 * PALLETS V3 // Non-blocking Toast Alerts & Notification Centre Drawer/Popover
 */
(function (global) {
  'use strict';

  let toastContainer = null;
  let panelEl = null;

  function ensureToastRoot() {
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'toast-stack';
      toastContainer.className = 'toast-stack';
      toastContainer.setAttribute('aria-live', 'polite');
      document.body.appendChild(toastContainer);
    }
    return toastContainer;
  }

  function showToast({ type = 'info', title, message = '', duration = 4200 }) {
    const F = global.PalletsFormatters;
    const stack = ensureToastRoot();
    const iconName = type === 'success'
      ? 'check-circle'
      : type === 'error'
        ? 'x-circle'
        : type === 'warning'
          ? 'alert-triangle'
          : 'activity';

    const card = document.createElement('div');
    card.className = `toast-card toast-${type}`;
    card.innerHTML = `
      <div class="toast-icon">${F.icon(iconName, 16)}</div>
      <div class="toast-content">
        <div class="toast-title">${F.escapeHtml(title)}</div>
        ${message ? `<div class="toast-message">${F.escapeHtml(message)}</div>` : ''}
      </div>
      <button type="button" class="icon-btn toast-close" aria-label="Dismiss">${F.icon('x', 14)}</button>
    `;
    stack.appendChild(card);

    const dismiss = () => {
      card.classList.add('leaving');
      setTimeout(() => card.remove(), 180);
    };
    card.querySelector('.toast-close').addEventListener('click', dismiss);
    setTimeout(dismiss, duration);
  }

  function togglePanel() {
    const F = global.PalletsFormatters;
    const list = global.PalletsState.state.notifications || [];
    if (!panelEl) {
      panelEl = document.createElement('div');
      panelEl.id = 'notif-panel';
      panelEl.className = 'notif-panel hidden';
      document.body.appendChild(panelEl);
    }

    if (!panelEl.classList.contains('hidden')) {
      panelEl.classList.add('hidden');
      return;
    }

    panelEl.innerHTML = `
      <div class="notif-panel-header">
        <span class="notif-panel-title">Operational Alerts (${list.length})</span>
        <button type="button" class="icon-btn" id="notif-close-btn">${F.icon('x', 15)}</button>
      </div>
      <div class="notif-panel-body">
        ${list.length === 0
          ? '<div class="notif-empty">All monitored dark store buffers above safety stock.</div>'
          : list
              .map(
                (n) => `
                  <button type="button" class="notif-item" data-notif-route="${F.escapeHtml(n.route || 'command-center')}">
                    <span class="notif-dot ${n.severity === 'CRITICAL' ? 'critical' : 'warning'}"></span>
                    <div class="notif-text">
                      <div class="notif-title">${F.escapeHtml(n.title)}</div>
                      <div class="notif-sub">${F.escapeHtml(n.detail)}</div>
                    </div>
                  </button>
                `
              )
              .join('')}
      </div>
    `;

    panelEl.classList.remove('hidden');
    panelEl.querySelector('#notif-close-btn').addEventListener('click', () => panelEl.classList.add('hidden'));
    panelEl.querySelectorAll('[data-notif-route]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const route = btn.getAttribute('data-notif-route');
        panelEl.classList.add('hidden');
        global.PalletsRouter.navigate(route);
      });
    });
  }

  function init() {
    global.PalletsEvents.on('toast', (detail) => showToast(detail));
  }

  global.PalletsNotifications = { init, showToast, togglePanel };
})(typeof window !== 'undefined' ? window : globalThis);

