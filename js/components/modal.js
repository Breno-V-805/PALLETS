/**
 * PALLETS V3 // Accessible Enterprise Modal Dialog
 */
(function (global) {
  'use strict';

  let rootEl = null;

  function ensureRoot() {
    if (!rootEl) {
      rootEl = document.createElement('div');
      rootEl.id = 'modal-overlay';
      rootEl.className = 'modal-overlay hidden';
      document.body.appendChild(rootEl);

      rootEl.addEventListener('click', (e) => {
        if (e.target === rootEl) close();
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && rootEl && !rootEl.classList.contains('hidden')) {
          close();
        }
      });
    }
    return rootEl;
  }

  function open({ title, subtitle = '', bodyHtml = '', footerHtml = '', size = 'md', onMount = null }) {
    const F = global.PalletsFormatters;
    const el = ensureRoot();
    el.innerHTML = `
      <div class="modal-dialog modal-${F.escapeHtml(size)}" role="dialog" aria-modal="true" aria-labelledby="modal-title-text">
        <div class="modal-header">
          <div>
            <h2 class="modal-title" id="modal-title-text">${F.escapeHtml(title)}</h2>
            ${subtitle ? `<p class="modal-subtitle">${F.escapeHtml(subtitle)}</p>` : ''}
          </div>
          <button type="button" class="icon-btn" id="modal-close-btn" aria-label="Close modal">${F.icon('x', 18)}</button>
        </div>
        <div class="modal-body">${bodyHtml}</div>
        ${footerHtml ? `<div class="modal-footer">${footerHtml}</div>` : ''}
      </div>
    `;
    el.classList.remove('hidden');
    el.querySelector('#modal-close-btn').addEventListener('click', close);
    if (typeof onMount === 'function') onMount(el);
    const firstInput = el.querySelector('input, select, textarea');
    if (firstInput) firstInput.focus();
  }

  function close() {
    if (rootEl) {
      rootEl.classList.add('hidden');
      rootEl.innerHTML = '';
    }
  }

  function confirm({ title, message, confirmLabel = 'Confirm', danger = false, onConfirm }) {
    const F = global.PalletsFormatters;
    open({
      title,
      size: 'sm',
      bodyHtml: `<p class="confirm-message">${F.escapeHtml(message)}</p><div id="modal-confirm-err" class="form-error hidden"></div>`,
      footerHtml: `
        <button type="button" class="btn btn-ghost" id="modal-cancel-btn">Cancel</button>
        <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="modal-confirm-btn">${F.escapeHtml(confirmLabel)}</button>
      `,
      onMount: (el) => {
        el.querySelector('#modal-cancel-btn').addEventListener('click', close);
        const btn = el.querySelector('#modal-confirm-btn');
        btn.addEventListener('click', async () => {
          btn.disabled = true;
          const orig = btn.textContent;
          btn.textContent = 'Processing...';
          try {
            await onConfirm();
            close();
          } catch (err) {
            const errBox = el.querySelector('#modal-confirm-err');
            if (errBox) {
              errBox.textContent = err.message || 'Action failed.';
              errBox.classList.remove('hidden');
            }
            btn.disabled = false;
            btn.textContent = orig;
          }
        });
      }
    });
  }

  global.PalletsModal = { open, close, confirm };
})(typeof window !== 'undefined' ? window : globalThis);

