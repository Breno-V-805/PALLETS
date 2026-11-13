/**
 * PALLETS V3 // Secure Authentication Gate
 * - Sign In (scrypt + HttpOnly session cookie)
 * - Public Staff Registration (never exposes Admin/Manager role selector)
 * - Conditional 1-Time Admin Bootstrap (only shown when server reports 0 Admins exist)
 */
(function (global) {
  'use strict';

  let activeTab = 'login';

  function passwordFieldHtml(id, label, placeholder) {
    const F = global.PalletsFormatters;
    return `
      <div class="form-field">
        <label class="form-label" for="${id}">${F.escapeHtml(label)}</label>
        <div class="input-password-wrap">
          <input type="password" id="${id}" class="input" placeholder="${F.escapeHtml(placeholder)}" required autocomplete="current-password" />
          <button type="button" class="pw-toggle-btn" data-toggle-pw="${id}" aria-label="Toggle password visibility">
            ${F.icon('eye', 15)}
          </button>
        </div>
      </div>
    `;
  }

  function renderAuth(container, state) {
    if (!container) return;
    const F = global.PalletsFormatters;
    const Calc = global.PalletsCalculations;
    const needsBootstrap = Boolean(state.needsAdminBootstrap);

    if (activeTab === 'bootstrap' && !needsBootstrap) {
      activeTab = 'login';
    }

    const tabsHtml = `
      <div class="auth-tabs" role="tablist">
        <button type="button" class="auth-tab-btn ${activeTab === 'login' ? 'active' : ''}" data-auth-tab="login">Sign In</button>
        <button type="button" class="auth-tab-btn ${activeTab === 'register' ? 'active' : ''}" data-auth-tab="register">Staff Sign Up</button>
        ${needsBootstrap ? `<button type="button" class="auth-tab-btn ${activeTab === 'bootstrap' ? 'active' : ''}" data-auth-tab="bootstrap">Admin Bootstrap</button>` : ''}
      </div>
    `;

    let formBody = '';
    if (activeTab === 'login') {
      formBody = `
        <form id="auth-login-form" class="auth-form-body">
          ${needsBootstrap ? `
            <div class="auth-notice warning">
              Zero administrators exist on this node. Use the <strong>Admin Bootstrap</strong> tab with the server console token to initialize your first Administrator.
            </div>
          ` : ''}
          <div id="auth-error-box" class="form-error hidden"></div>
          <div class="form-field">
            <label class="form-label" for="login-email">Work Email</label>
            <input type="email" id="login-email" class="input" placeholder="operator@pallets.enterprise" required autocomplete="email" />
          </div>
          ${passwordFieldHtml('login-password', 'Password', 'Enter your password')}
          <button type="submit" id="auth-submit-btn" class="btn btn-primary" style="width:100%">
            ${F.icon('lock', 15)}
            <span>Sign In to Control Plane</span>
          </button>
        </form>
      `;
    } else if (activeTab === 'register') {
      formBody = `
        <form id="auth-register-form" class="auth-form-body">
          <div class="auth-notice">
            Public registration creates a <strong>Staff (Dark Store Associate)</strong> account scoped to your assigned facility. Admin or Manager promotions require an existing Administrator.
          </div>
          <div id="auth-error-box" class="form-error hidden"></div>
          <div class="form-field">
            <label class="form-label" for="reg-name">Full Name</label>
            <input type="text" id="reg-name" class="input" placeholder="e.g. Rahul Sharma" required />
          </div>
          <div class="form-field">
            <label class="form-label" for="reg-email">Work Email</label>
            <input type="email" id="reg-email" class="input" placeholder="rahul@pallets.enterprise" required />
          </div>
          <div class="form-field">
            <label class="form-label" for="reg-hub">Assigned Dark Store Hub</label>
            <select id="reg-hub" class="select">
              ${Calc.HUBS.map((h) => `<option value="${F.escapeHtml(h.id)}">${F.escapeHtml(h.code)} // ${F.escapeHtml(h.name)}</option>`).join('')}
            </select>
          </div>
          ${passwordFieldHtml('reg-password', 'Password (min 8 chars, letters + numbers)', 'Create strong password')}
          ${passwordFieldHtml('reg-confirm', 'Confirm Password', 'Re-enter password')}
          <button type="submit" id="auth-submit-btn" class="btn btn-primary" style="width:100%">
            <span>Create Staff Account</span>
          </button>
        </form>
      `;
    } else if (activeTab === 'bootstrap' && needsBootstrap) {
      formBody = `
        <form id="auth-bootstrap-form" class="auth-form-body">
          <div class="auth-notice warning">
            Enter the one-time server bootstrap token printed in the PALLETS V3 Node.js console (or <code>PALLETS_BOOTSTRAP_TOKEN</code>). Locks permanently once the first Admin is created.
          </div>
          <div id="auth-error-box" class="form-error hidden"></div>
          <div class="form-field">
            <label class="form-label" for="boot-token">One-Time Server Bootstrap Token</label>
            <input type="text" id="boot-token" class="input mono" placeholder="Paste console bootstrap token" required autocomplete="off" />
          </div>
          <div class="form-field">
            <label class="form-label" for="boot-name">Administrator Name</label>
            <input type="text" id="boot-name" class="input" placeholder="Elena Vance" required />
          </div>
          <div class="form-field">
            <label class="form-label" for="boot-email">Administrator Email</label>
            <input type="email" id="boot-email" class="input" placeholder="admin@pallets.enterprise" required />
          </div>
          ${passwordFieldHtml('boot-password', 'Administrator Password (min 8 chars, letter + number)', 'Set strong password')}
          <button type="submit" id="auth-submit-btn" class="btn btn-teal" style="width:100%">
            ${F.icon('shield', 15)}
            <span>Initialize System Administrator</span>
          </button>
        </form>
      `;
    }

    container.innerHTML = `
      <div class="auth-shell">
        <div class="auth-card">
          <div class="auth-brand-bar">
            <div class="auth-logo-wrap">
              <img src="/assets/logo/pallets-logo.png" alt="PALLETS Logo" />
              <div>
                <div class="brand-wordmark">PALLETS <span class="brand-v3">V3</span></div>
                <div class="brand-sub">FMCG PREDICTIVE CONTROL PLANE</div>
              </div>
            </div>
            <span class="badge badge-info">HTTPS / SCRYPT</span>
          </div>
          ${tabsHtml}
          ${formBody}
        </div>
      </div>
    `;

    container.querySelectorAll('[data-auth-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeTab = btn.getAttribute('data-auth-tab');
        renderAuth(container, global.PalletsState.state);
      });
    });

    container.querySelectorAll('[data-toggle-pw]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-toggle-pw');
        const input = container.querySelector(`#${targetId}`);
        if (!input) return;
        const nextType = input.type === 'password' ? 'text' : 'password';
        input.type = nextType;
        btn.innerHTML = F.icon(nextType === 'text' ? 'eye-off' : 'eye', 15);
      });
    });

    const showErr = (msg) => {
      const box = container.querySelector('#auth-error-box');
      if (box) {
        box.textContent = msg;
        box.classList.remove('hidden');
      }
    };

    const loginForm = container.querySelector('#auth-login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = container.querySelector('#auth-submit-btn');
        btn.disabled = true;
        try {
          const email = container.querySelector('#login-email').value.trim();
          const password = container.querySelector('#login-password').value;
          const res = await global.PalletsAuthAdapter.login(email, password);
          global.PalletsEvents.emit('auth:authenticated', res.user);
        } catch (err) {
          showErr(err.message);
          btn.disabled = false;
        }
      });
    }

    const regForm = container.querySelector('#auth-register-form');
    if (regForm) {
      regForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = container.querySelector('#auth-submit-btn');
        const name = container.querySelector('#reg-name').value.trim();
        const email = container.querySelector('#reg-email').value.trim();
        const storeAccess = container.querySelector('#reg-hub').value;
        const password = container.querySelector('#reg-password').value;
        const confirm = container.querySelector('#reg-confirm').value;

        if (password !== confirm) {
          return showErr('Passwords do not match.');
        }
        btn.disabled = true;
        try {
          const res = await global.PalletsAuthAdapter.registerStaff({ name, email, password, storeAccess });
          global.PalletsEvents.emit('auth:authenticated', res.user);
          const syncOutcome = (res.supabaseSync && res.supabaseSync.outcome) || res.authWebhookOutcome;
          if (syncOutcome && syncOutcome !== 'CONFIRMED_SUCCESS') {
            global.PalletsEvents.emit('toast', {
              type: 'warning',
              title: `Supabase Sync: ${syncOutcome}`,
              message: (res.supabaseSync && res.supabaseSync.error) || 'Account created locally, but Supabase sync did not confirm cloud persistence.'
            });
          }
        } catch (err) {
          showErr(err.message);
          btn.disabled = false;
        }
      });
    }

    const bootForm = container.querySelector('#auth-bootstrap-form');
    if (bootForm) {
      bootForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = container.querySelector('#auth-submit-btn');
        btn.disabled = true;
        try {
          const bootstrapToken = container.querySelector('#boot-token').value.trim();
          const name = container.querySelector('#boot-name').value.trim();
          const email = container.querySelector('#boot-email').value.trim();
          const password = container.querySelector('#boot-password').value;
          const res = await global.PalletsAuthAdapter.bootstrapAdmin({ bootstrapToken, name, email, password });
          global.PalletsEvents.emit('auth:authenticated', res.user);
          const syncOutcome = (res.supabaseSync && res.supabaseSync.outcome) || res.authWebhookOutcome;
          if (syncOutcome && syncOutcome !== 'CONFIRMED_SUCCESS') {
            global.PalletsEvents.emit('toast', {
              type: 'warning',
              title: `Supabase Sync: ${syncOutcome}`,
              message: (res.supabaseSync && res.supabaseSync.error) || 'Admin bootstrapped locally, but Supabase sync did not confirm cloud persistence.'
            });
          }
        } catch (err) {
          showErr(err.message);
          btn.disabled = false;
        }
      });
    }
  }

  global.PalletsAuthPage = { render: renderAuth };
})(typeof window !== 'undefined' ? window : globalThis);

