/**
 * PALLETS V3 // Slide-Over Detail Drawer
 */
(function (global) {
  'use strict';

  let rootEl = null;

  function ensureRoot() {
    if (!rootEl) {
      rootEl = document.createElement('div');
      rootEl.id = 'drawer-overlay';
      rootEl.className = 'drawer-overlay hidden';
      document.body.appendChild(rootEl);

      rootEl.addEventListener('click', (e) => {
        if (e.target === rootEl) close();
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && rootEl && !rootEl.classList.contains('hidden')) close();
      });
    }
    return rootEl;
  }

  function open({ title, subtitle = '', bodyHtml = '', footerHtml = '', onMount = null }) {
    const F = global.PalletsFormatters;
    const el = ensureRoot();
    el.innerHTML = `
      <aside class="drawer-panel" role="dialog" aria-modal="true" aria-label="${F.escapeHtml(title)}">
        <div class="drawer-header">
          <div>
            <h2 class="drawer-title">${F.escapeHtml(title)}</h2>
            ${subtitle ? `<div class="drawer-subtitle mono">${F.escapeHtml(subtitle)}</div>` : ''}
          </div>
          <button type="button" class="icon-btn" id="drawer-close-btn" aria-label="Close drawer">${F.icon('x', 18)}</button>
        </div>
        <div class="drawer-body">${bodyHtml}</div>
        ${footerHtml ? `<div class="drawer-footer">${footerHtml}</div>` : ''}
      </aside>
    `;
    el.classList.remove('hidden');
    el.querySelector('#drawer-close-btn').addEventListener('click', close);
    if (typeof onMount === 'function') onMount(el);
  }

  function close() {
    if (rootEl) {
      rootEl.classList.add('hidden');
      rootEl.innerHTML = '';
    }
  }

  global.PalletsDrawer = { open, close };
})(typeof window !== 'undefined' ? window : globalThis);

