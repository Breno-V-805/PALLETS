/**
 * PALLETS V3 // Ctrl+K Command Palette
 */
(function (global) {
  'use strict';

  let rootEl = null;
  let boundKeydown = false;

  function ensureRoot() {
    if (!rootEl) {
      rootEl = document.createElement('div');
      rootEl.id = 'cmdk-overlay';
      rootEl.className = 'cmdk-overlay hidden';
      document.body.appendChild(rootEl);
    }
    return rootEl;
  }

  function buildCommands(query) {
    const Store = global.PalletsState.state;
    const Perms = global.PalletsPermissions;
    const Router = global.PalletsRouter;
    const user = Store.user;
    if (!user) return [];

    const items = [];
    Object.keys(Router.ROUTE_META).forEach((routeId) => {
      if (Perms.canAccessRoute(user, routeId)) {
        const meta = Router.ROUTE_META[routeId];
        items.push({
          group: 'Workspaces',
          label: meta.title,
          hint: meta.section,
          icon: 'layout-dashboard',
          action: () => Router.navigate(routeId)
        });
      }
    });

    Store.products.slice(0, 30).forEach((p) => {
      items.push({
        group: 'Catalog SKUs',
        label: `${p.sku} — ${p.name}`,
        hint: `${p.onHand}u @ ${p.hub}`,
        icon: 'package',
        action: () => {
          global.PalletsState.setState({ selectedProductSku: p.sku });
          Router.navigate('products', 'details');
        }
      });
    });

    const q = String(query || '').trim().toLowerCase();
    if (!q) return items.slice(0, 12);
    return items
      .filter((it) => it.label.toLowerCase().includes(q) || it.hint.toLowerCase().includes(q) || it.group.toLowerCase().includes(q))
      .slice(0, 12);
  }

  function renderPalette(query = '') {
    const F = global.PalletsFormatters;
    const el = ensureRoot();
    const results = buildCommands(query);

    el.innerHTML = `
      <div class="cmdk-dialog" role="dialog" aria-modal="true" aria-label="Command Palette">
        <div class="cmdk-header">
          ${F.icon('search', 16)}
          <input type="text" id="cmdk-input" class="cmdk-input" placeholder="Jump to workspace, SKU code, or product..." value="${F.escapeHtml(query)}" autocomplete="off" />
          <button type="button" class="icon-btn" id="cmdk-close" aria-label="Close">
            <kbd>Esc</kbd>
          </button>
        </div>
        <div class="cmdk-list">
          ${results.length === 0
            ? '<div class="cmdk-empty">No matching workspaces or SKUs found.</div>'
            : results
                .map(
                  (it, idx) => `
                  <button type="button" class="cmdk-item" data-cmdk-idx="${idx}">
                    <span class="cmdk-item-left">
                      ${F.icon(it.icon, 15)}
                      <span>${F.escapeHtml(it.label)}</span>
                    </span>
                    <span class="cmdk-item-hint mono">${F.escapeHtml(it.hint)}</span>
                  </button>
                `
                )
                .join('')}
        </div>
      </div>
    `;

    const input = el.querySelector('#cmdk-input');
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);

    input.addEventListener('input', (e) => renderPalette(e.target.value));
    el.querySelector('#cmdk-close').addEventListener('click', close);
    el.querySelectorAll('[data-cmdk-idx]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.getAttribute('data-cmdk-idx'));
        const item = results[idx];
        close();
        if (item && item.action) item.action();
      });
    });
  }

  function open() {
    if (!global.PalletsState.state.user) return;
    const el = ensureRoot();
    el.classList.remove('hidden');
    renderPalette('');
  }

  function close() {
    if (rootEl) rootEl.classList.add('hidden');
  }

  function init() {
    if (boundKeydown) return;
    boundKeydown = true;
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (rootEl && !rootEl.classList.contains('hidden')) close();
        else open();
      } else if (e.key === 'Escape' && rootEl && !rootEl.classList.contains('hidden')) {
        close();
      }
    });
    document.addEventListener('click', (e) => {
      if (rootEl && e.target === rootEl) close();
    });
  }

  global.PalletsCommandPalette = { init, open, close };
})(typeof window !== 'undefined' ? window : globalThis);

