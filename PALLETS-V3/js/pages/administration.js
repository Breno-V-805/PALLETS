/**
 * PALLETS V3 // Workspace 10: System Administration (Strict Admin Only)
 * Contextual tabs: Overview | Users & Roles | Webhooks & Workflows | Audit & Telemetry
 */
(function (global) {
  'use strict';

  const localState = {
    users: [],
    auditLogs: [],
    urls: {},
    loadingAdminData: false,
    loadedOnce: false
  };

  async function refreshAdminCollections(container) {
    if (localState.loadingAdminData) return;
    localState.loadingAdminData = true;
    try {
      const [usersRes, auditRes, cfgRes] = await Promise.all([
        global.PalletsAuthAdapter.listUsers(),
        global.PalletsAuthAdapter.listAuditLogs(),
        fetch('/api/workflows/config', { credentials: 'include' }).then((r) => (r.ok ? r.json() : { urls: {} }))
      ]);
      localState.users = usersRes.users || [];
      localState.auditLogs = auditRes.logs || [];
      localState.urls = cfgRes.urls || {};
      localState.loadedOnce = true;
    } catch (err) {
      global.PalletsEvents.emit('toast', { type: 'error', title: 'Admin Load Failed', message: err.message });
    } finally {
      localState.loadingAdminData = false;
      renderAdministration(container, global.PalletsState.state);
    }
  }

  function openCreateUserModal(container) {
    const F = global.PalletsFormatters;
    const Calc = global.PalletsCalculations;

    global.PalletsModal.open({
      title: 'Create Enterprise Operator Account',
      subtitle: 'Only authenticated Administrators may provision Manager or Admin roles.',
      size: 'sm',
      bodyHtml: `
        <form id="adm-user-create-form" style="display:flex;flex-direction:column;gap:12px">
          <div id="adm-uc-err" class="form-error hidden"></div>
          <div class="form-field"><label class="form-label">Full Name</label><input id="au-name" class="input" required /></div>
          <div class="form-field"><label class="form-label">Work Email</label><input id="au-email" type="email" class="input" required /></div>
          <div class="form-field">
            <label class="form-label">Role Assignment</label>
            <select id="au-role" class="select">
              <option value="Staff">Staff (Store Associate)</option>
              <option value="Inventory Manager">Inventory Manager</option>
              <option value="Admin">Admin (Full Control)</option>
            </select>
          </div>
          <div class="form-field">
            <label class="form-label">Assigned Dark Store Hub</label>
            <select id="au-hub" class="select">
              <option value="ALL">ALL Facilities (Admin / Manager)</option>
              ${Calc.HUBS.map((h) => `<option value="${F.escapeHtml(h.id)}">${F.escapeHtml(h.name)}</option>`).join('')}
            </select>
          </div>
          <div class="form-field"><label class="form-label">Initial Password (min 8 chars, letter + number)</label><input id="au-pw" type="password" class="input" required /></div>
        </form>
      `,
      footerHtml: `
        <button type="button" class="btn btn-ghost" id="au-cancel">Cancel</button>
        <button type="submit" form="adm-user-create-form" class="btn btn-primary" id="au-submit">Create User</button>
      `,
      onMount: (el) => {
        el.querySelector('#au-cancel').addEventListener('click', global.PalletsModal.close);
        el.querySelector('#adm-user-create-form').addEventListener('submit', async (e) => {
          e.preventDefault();
          const errBox = el.querySelector('#adm-uc-err');
          const role = el.querySelector('#au-role').value;
          let storeAccess = el.querySelector('#au-hub').value;
          if (role === 'Staff' && storeAccess === 'ALL') storeAccess = 'BLR_NORTH_DC';
          try {
            const res = await global.PalletsAuthAdapter.createUser({
              name: el.querySelector('#au-name').value.trim(),
              email: el.querySelector('#au-email').value.trim(),
              role,
              storeAccess,
              password: el.querySelector('#au-pw').value
            });
            global.PalletsModal.close();
            const syncOutcome = (res.supabaseSync && res.supabaseSync.outcome) || res.authWebhookOutcome;
            const syncOk = !syncOutcome || syncOutcome === 'CONFIRMED_SUCCESS';
            global.PalletsEvents.emit('toast', {
              type: syncOk ? 'success' : 'warning',
              title: syncOk ? 'Operator Created & Synced' : `Operator Created (Sync: ${syncOutcome})`,
              message: syncOk
                ? `${role} account provisioned and persisted to Supabase.`
                : ((res.supabaseSync && res.supabaseSync.error) || `${role} saved locally, but Supabase sync did not confirm.`)
            });
            refreshAdminCollections(container);
          } catch (err) {
            errBox.textContent = err.message;
            errBox.classList.remove('hidden');
          }
        });
      }
    });
  }

  function openEditUserModal(userObj, container) {
    const F = global.PalletsFormatters;
    const Calc = global.PalletsCalculations;

    global.PalletsModal.open({
      title: `Modify Operator: ${userObj.name}`,
      subtitle: userObj.email,
      size: 'sm',
      bodyHtml: `
        <form id="adm-user-edit-form" style="display:flex;flex-direction:column;gap:12px">
          <div id="adm-ue-err" class="form-error hidden"></div>
          <div class="form-field">
            <label class="form-label">Role</label>
            <select id="eu-role" class="select">
              <option value="Staff" ${userObj.role === 'Staff' ? 'selected' : ''}>Staff</option>
              <option value="Inventory Manager" ${userObj.role === 'Inventory Manager' ? 'selected' : ''}>Inventory Manager</option>
              <option value="Admin" ${userObj.role === 'Admin' ? 'selected' : ''}>Admin</option>
            </select>
          </div>
          <div class="form-field">
            <label class="form-label">Hub Scope</label>
            <select id="eu-hub" class="select">
              <option value="ALL" ${userObj.storeAccess === 'ALL' ? 'selected' : ''}>ALL Facilities</option>
              ${Calc.HUBS.map((h) => `<option value="${F.escapeHtml(h.id)}" ${userObj.storeAccess === h.id ? 'selected' : ''}>${F.escapeHtml(h.name)}</option>`).join('')}
            </select>
          </div>
          <div class="form-field">
            <label class="form-label">Account Status</label>
            <select id="eu-status" class="select">
              <option value="ACTIVE" ${userObj.status === 'ACTIVE' ? 'selected' : ''}>ACTIVE</option>
              <option value="DISABLED" ${userObj.status === 'DISABLED' ? 'selected' : ''}>DISABLED (Revoke Session)</option>
            </select>
          </div>
        </form>
      `,
      footerHtml: `
        <button type="button" class="btn btn-ghost" id="eu-cancel">Cancel</button>
        <button type="submit" form="adm-user-edit-form" class="btn btn-primary" id="eu-save">Save Changes</button>
      `,
      onMount: (el) => {
        el.querySelector('#eu-cancel').addEventListener('click', global.PalletsModal.close);
        el.querySelector('#adm-user-edit-form').addEventListener('submit', async (e) => {
          e.preventDefault();
          const errBox = el.querySelector('#adm-ue-err');
          const role = el.querySelector('#eu-role').value;
          let storeAccess = el.querySelector('#eu-hub').value;
          if (role === 'Staff' && storeAccess === 'ALL') storeAccess = 'BLR_NORTH_DC';
          try {
            const res = await global.PalletsAuthAdapter.updateUser(userObj.id, {
              role,
              storeAccess,
              status: el.querySelector('#eu-status').value
            });
            global.PalletsModal.close();
            const syncOutcome = (res.supabaseSync && res.supabaseSync.outcome) || res.authWebhookOutcome;
            const syncOk = !syncOutcome || syncOutcome === 'CONFIRMED_SUCCESS';
            global.PalletsEvents.emit('toast', {
              type: syncOk ? 'success' : 'warning',
              title: syncOk ? 'Permissions Updated & Synced' : `Permissions Updated (Sync: ${syncOutcome})`,
              message: syncOk
                ? `${userObj.email} updated and persisted to Supabase.`
                : ((res.supabaseSync && res.supabaseSync.error) || `${userObj.email} updated locally, but Supabase sync did not confirm.`)
            });
            refreshAdminCollections(container);
          } catch (err) {
            errBox.textContent = err.message;
            errBox.classList.remove('hidden');
          }
        });
      }
    });
  }

  function renderAdministration(container, state) {
    const F = global.PalletsFormatters;
    const Perms = global.PalletsPermissions;
    const Table = global.PalletsDataTable;
    const Metric = global.PalletsMetricCard;

    if (!localState.loadedOnce && !localState.loadingAdminData) {
      refreshAdminCollections(container);
    }

    const tab = state.routeTabs.administration || 'overview';
    const sb = state.supabaseStatus || {};
    const wfList = Object.entries(state.workflows || {});

    let bodyHtml = '';
    if (tab === 'overview') {
      bodyHtml = `
        <div class="kpi-strip" style="grid-template-columns:repeat(4,minmax(0,1fr))">
          ${Metric.render({ label: 'Active Operators', value: String(localState.users.filter((u) => u.status === 'ACTIVE').length), meta: `${localState.users.filter((u) => u.role === 'Admin').length} Admin(s)`, tone: 'purple', iconName: 'shield' })}
          ${Metric.render({ label: 'Supabase Sync Gateway', value: sb.mode || 'UNCONFIGURED', meta: sb.configured ? `Reachable: ${Boolean(sb.reachable)}` : 'Configure WF-SUPABASE-SYNC to connect', tone: sb.schemaReady ? 'teal' : 'amber', iconName: 'database' })}
          ${Metric.render({ label: 'SNS Preserved Endpoints', value: `${wfList.filter(([, w]) => w.configured).length}/${wfList.length || 9}`, meta: 'All URLs routed via /api/sns-proxy', tone: 'blue', iconName: 'activity' })}
          ${Metric.render({ label: 'Security Audit Events', value: String(localState.auditLogs.length), meta: 'scrypt + HMAC-SHA256 HttpOnly', tone: 'teal', iconName: 'lock' })}
        </div>

        <div class="command-grid-equal">
          <div class="panel">
            <div class="panel-header">
              <div>
                <div class="section-heading">Supabase Gateway Control (WF-SUPABASE-SYNC)</div>
                <div class="section-subheading">Honest connection &amp; PostgreSQL 10-table persistence control</div>
              </div>
              <div style="display:flex;gap:8px;flex-wrap:wrap">
                <button type="button" class="btn btn-sm btn-ghost" id="adm-sb-sync-all">${F.icon('database', 13)} Sync All 10 Tables</button>
                <button type="button" class="btn btn-sm btn-primary" id="adm-sb-health">Check Sync Status</button>
              </div>
            </div>
            <div class="panel-body">
              <div class="kv-grid">
                <div class="kv-cell"><div class="kv-label">Endpoint Configured</div><div class="kv-value mono">${sb.configured ? 'YES' : 'NO (EMPTY)'}</div></div>
                <div class="kv-cell"><div class="kv-label">Current Mode</div><div class="kv-value mono">${F.escapeHtml(sb.mode || 'UNCONFIGURED')}</div></div>
                <div class="kv-cell"><div class="kv-label">Schema Ready (pallets_gateway)</div><div class="kv-value mono">${sb.schemaReady ? 'READY' : 'NOT VERIFIED'}</div></div>
                <div class="kv-cell"><div class="kv-label">Last Error / Note</div><div class="kv-value" style="font-size:12px">${F.escapeHtml(sb.lastError || (sb.configured ? 'None' : 'Canonical state safely persisted in local .data/state.json.'))}</div></div>
              </div>
            </div>
          </div>

          <div class="panel">
            <div class="panel-header">
              <div>
                <div class="section-heading">V3 Security Posture Summary</div>
                <div class="section-subheading">Hardened against privilege escalation &amp; duplicate races</div>
              </div>
            </div>
            <div class="panel-body">
              <div class="activity-list">
                <div class="activity-item"><div><div class="activity-title">Password Hashing</div><div class="activity-detail">Per-user 16-byte random salt + Node.js crypto.scryptSync</div></div><span class="badge badge-optimal">ACTIVE</span></div>
                <div class="activity-item"><div><div class="activity-title">Session Transport</div><div class="activity-detail">HMAC-SHA256 signed HttpOnly; SameSite=Lax cookies + revocation</div></div><span class="badge badge-optimal">ACTIVE</span></div>
                <div class="activity-item"><div><div class="activity-title">Public Signup Policy</div><div class="activity-detail">Forced Staff role, hub-scoped, duplicate &amp; concurrency locked</div></div><span class="badge badge-optimal">LOCKED</span></div>
              </div>
            </div>
          </div>
        </div>
      `;
    } else if (tab === 'users') {
      bodyHtml = `
        <div class="toolbar-row">
          <div class="section-subheading">Manage enterprise operators, role clearance, facility assignments, and Supabase cloud sync status.</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button type="button" class="btn btn-ghost" id="adm-sync-users-btn">${F.icon('database', 14)} Sync All Users to Supabase</button>
            <button type="button" class="btn btn-primary" id="adm-add-user-btn">${F.icon('plus', 14)} Add Operator</button>
          </div>
        </div>
        <div class="panel">
          ${Table.render({
            rows: localState.users,
            pageSize: 12,
            columns: [
              { label: 'ID', key: 'id', render: (r) => `<span class="mono">${F.escapeHtml(r.id)}</span>` },
              { label: 'Operator', key: 'name', render: (r) => `<div style="font-weight:600">${F.escapeHtml(r.name)}</div><div class="mono text-muted" style="font-size:11px">${F.escapeHtml(r.email)}</div>` },
              { label: 'Role', key: 'role', render: (r) => `<span class="badge ${Perms.roleBadgeClass(r.role)}">${F.escapeHtml(r.role)}</span>` },
              { label: 'Hub Access', key: 'storeAccess', render: (r) => `<span class="mono">${F.escapeHtml(r.storeAccess)}</span>` },
              { label: 'Status', key: 'status', render: (r) => `<span class="badge ${r.status === 'ACTIVE' ? 'badge-optimal' : 'badge-critical'}">${F.escapeHtml(r.status)}</span>` },
              {
                label: 'Supabase Sync',
                key: 'lastSupabaseSync',
                sortable: false,
                render: (r) => {
                  const s = r.lastSupabaseSync;
                  if (!s) return '<span class="badge badge-info">NOT SYNCED YET</span>';
                  const titleAttr = F.escapeHtml(s.error || (s.httpStatus ? `HTTP ${s.httpStatus} at ${s.syncedAt}` : s.syncedAt || ''));
                  return `<span title="${titleAttr}">${F.outcomeBadge(s.outcome)}</span>`;
                }
              },
              { label: 'Last Login', key: 'lastLoginAt', render: (r) => `<span class="mono text-secondary">${F.formatDateTime(r.lastLoginAt)}</span>` },
              {
                label: 'Manage',
                sortable: false,
                align: 'right',
                render: (r) => `<button type="button" class="btn btn-sm btn-ghost" data-adm-edit-user="${F.escapeHtml(r.id)}">Edit Role / Status</button>`
              }
            ]
          })}
        </div>
      `;
    } else if (tab === 'webhooks') {
      bodyHtml = `
        <div class="panel">
          <div class="panel-header">
            <div>
              <div class="section-heading">Preserved SNS Agent Workbench Multi-Workflow Registry</div>
              <div class="section-subheading">All 9 endpoint URLs are preserved verbatim. Test pings report genuine HTTP/timeout outcomes.</div>
            </div>
            <button type="button" class="btn btn-primary" id="adm-save-webhooks-btn">Save Webhook URLs</button>
          </div>
          <div class="panel-body">
            <div style="display:flex;flex-direction:column;gap:12px">
              ${wfList.map(([key, wf]) => `
                <div class="kv-cell" style="padding:14px">
                  <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px">
                    <div>
                      <span class="mono" style="font-weight:700;color:var(--accent-blue)">${F.escapeHtml(wf.id)}</span>
                      <span style="font-weight:600;margin-left:8px">${F.escapeHtml(wf.name)}</span>
                    </div>
                    <div style="display:flex;gap:8px;align-items:center">
                      ${F.outcomeBadge(wf.healthStatus)}
                      ${wf.lastLatencyMs ? `<span class="mono text-muted" style="font-size:11px">${wf.lastLatencyMs}ms</span>` : ''}
                      <button type="button" class="btn btn-sm btn-ghost" data-ping-wf="${F.escapeHtml(key)}">Test Ping</button>
                    </div>
                  </div>
                  <div class="text-secondary" style="font-size:12px;margin-bottom:8px">${F.escapeHtml(wf.description)}</div>
                  <input type="url" class="input mono wf-url-input" data-wf-key="${F.escapeHtml(key)}" value="${F.escapeHtml(localState.urls[key] !== undefined ? localState.urls[key] : (wf.url || ''))}" placeholder="Unconfigured (enter HTTPS webhook URL if activating)" />
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      `;
    } else {
      bodyHtml = `
        <div class="command-grid-equal">
          <div class="panel">
            <div class="panel-header"><div class="section-heading">Server Security Audit Log (${localState.auditLogs.length})</div></div>
            ${Table.render({
              rows: localState.auditLogs,
              pageSize: 10,
              columns: [
                { label: 'Event', key: 'event', render: (r) => `<span class="badge ${r.event.includes('BLOCKED') || r.event.includes('DENIED') || r.event.includes('FAILED') ? 'badge-critical' : 'badge-info'}">${F.escapeHtml(r.event)}</span>` },
                { label: 'Actor / Email', key: 'actorEmail', render: (r) => `<span class="mono">${F.escapeHtml(r.actorEmail || r.email || '—')}</span>` },
                { label: 'Detail', key: 'detail' },
                { label: 'Timestamp', key: 'timestamp', render: (r) => `<span class="mono text-muted">${F.formatDateTime(r.timestamp)}</span>` }
              ]
            })}
          </div>

          <div class="panel">
            <div class="panel-header"><div class="section-heading">Live SNS Webhook Telemetry Stream (${state.telemetryLogs.length})</div></div>
            <div class="panel-body tight">
              <div class="activity-list">
                ${(state.telemetryLogs || []).slice(0, 12).map((t) => `
                  <div class="activity-item">
                    <div>
                      <div class="activity-title"><span class="mono">${F.escapeHtml(t.workflowId)}</span> • ${F.escapeHtml(t.type)}</div>
                      <div class="activity-detail">${t.errorDetail ? F.escapeHtml(t.errorDetail) : `HTTP ${t.httpStatus} (${t.latencyMs}ms)`}</div>
                    </div>
                    ${F.outcomeBadge(t.outcome)}
                  </div>
                `).join('') || '<div class="empty-state">No webhook calls dispatched yet in this session.</div>'}
              </div>
            </div>
          </div>
        </div>
      `;
    }

    container.innerHTML = `
      <div class="workspace-header">
        <div>
          <h1 class="page-title">System Administration</h1>
          <p class="page-subtitle">Role-based access management, preserved SNS Agent Workbench configuration, and live security audit trails.</p>
        </div>
        <div class="workspace-actions">
          <button type="button" class="btn btn-ghost" id="adm-refresh-btn">${F.icon('refresh-cw', 14)} Refresh Admin Data</button>
        </div>
      </div>

      <div class="context-tabs">
        <button type="button" class="context-tab ${tab === 'overview' ? 'active' : ''}" data-atab="overview">Overview</button>
        <button type="button" class="context-tab ${tab === 'users' ? 'active' : ''}" data-atab="users">Users &amp; Roles</button>
        <button type="button" class="context-tab ${tab === 'webhooks' ? 'active' : ''}" data-atab="webhooks">Webhooks &amp; Workflows</button>
        <button type="button" class="context-tab ${tab === 'logs' ? 'active' : ''}" data-atab="logs">Audit &amp; Telemetry</button>
      </div>

      ${bodyHtml}
    `;

    container.querySelectorAll('[data-atab]').forEach((b) => {
      b.addEventListener('click', () => global.PalletsRouter.setContextualTab('administration', b.getAttribute('data-atab')));
    });
    container.querySelector('#adm-refresh-btn')?.addEventListener('click', () => refreshAdminCollections(container));
    container.querySelector('#adm-add-user-btn')?.addEventListener('click', () => openCreateUserModal(container));
    container.querySelector('#adm-sync-users-btn')?.addEventListener('click', async () => {
      const btn = container.querySelector('#adm-sync-users-btn');
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Syncing...';
      }
      try {
        const res = await global.PalletsAuthAdapter.syncUsersToSupabase();
        if (Array.isArray(res.users)) {
          localState.users = res.users;
        }
        const firstErr = (res.results || []).find((r) => r.error)?.error;
        global.PalletsEvents.emit('toast', {
          type: res.ok ? 'success' : 'warning',
          title: `Supabase User Sync: ${res.confirmedCount}/${res.total} Confirmed`,
          message: res.ok
            ? 'All operator profiles dispatched cleanly to WF-AUTH-SUPABASE / Supabase.'
            : (firstErr || `${res.failedCount} user(s) did not return a confirmed 200 OK from WF-AUTH-SUPABASE.`)
        });
        renderAdministration(container, global.PalletsState.state);
      } catch (err) {
        global.PalletsEvents.emit('toast', { type: 'error', title: 'Sync Error', message: err.message });
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = `${F.icon('database', 14)} Sync All Users to Supabase`;
        }
      }
    });

    container.querySelectorAll('[data-adm-edit-user]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const u = localState.users.find((x) => x.id === btn.getAttribute('data-adm-edit-user'));
        if (u) openEditUserModal(u, container);
      });
    });

    container.querySelector('#adm-sb-health')?.addEventListener('click', async () => {
      const res = await global.PalletsWorkflowAdapter.getSupabaseClient().checkHealth();
      global.PalletsEvents.emit('toast', {
        type: res.ok ? 'success' : 'warning',
        title: `Supabase Gateway: ${res.outcome || (res.configured ? 'CHECKED' : 'UNCONFIGURED')}`,
        message: res.error || (res.schemaReady ? 'All 10 tables verified.' : 'Local persistent storage active.')
      });
      renderAdministration(container, global.PalletsState.state);
    });

    container.querySelector('#adm-sb-sync-all')?.addEventListener('click', async () => {
      const btn = container.querySelector('#adm-sb-sync-all');
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Syncing All Tables...';
      }
      try {
        const res = await global.PalletsAuthAdapter.syncAllTablesToSupabase();
        const failed = (res.tableResults || []).filter((t) => t.outcome !== 'CONFIRMED_SUCCESS');
        global.PalletsEvents.emit('toast', {
          type: res.ok ? 'success' : 'warning',
          title: res.ok
            ? `Supabase Sync Complete (${res.totalRowsSynced} rows)`
            : `Supabase Sync Partial (${failed.length} table issue${failed.length === 1 ? '' : 's'})`,
          message: res.ok
            ? 'All operational & master tables persisted to Supabase via WF-SUPABASE-SYNC.'
            : (failed[0]?.error || 'One or more tables did not return 200 OK.')
        });
        await global.PalletsWorkflowAdapter.getSupabaseClient().checkHealth();
        refreshAdminCollections(container);
      } catch (err) {
        global.PalletsEvents.emit('toast', { type: 'error', title: 'Full Sync Error', message: err.message });
        renderAdministration(container, global.PalletsState.state);
      }
    });

    container.querySelectorAll('[data-ping-wf]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const key = btn.getAttribute('data-ping-wf');
        btn.disabled = true;
        btn.textContent = 'Pinging...';
        const res = await global.PalletsWorkflowAdapter.pingWorkflow(key);
        global.PalletsEvents.emit('toast', {
          type: res.success ? 'success' : 'warning',
          title: `${res.workflowId}: ${res.outcome}`,
          message: res.error || `HTTP ${res.status} in ${res.latencyMs}ms`
        });
        renderAdministration(container, global.PalletsState.state);
      });
    });

    container.querySelector('#adm-save-webhooks-btn')?.addEventListener('click', async () => {
      const map = {};
      container.querySelectorAll('.wf-url-input').forEach((inp) => {
        map[inp.getAttribute('data-wf-key')] = inp.value.trim();
      });
      try {
        const res = await global.PalletsWorkflowAdapter.updateWebhookConfig(map);
        localState.urls = res.urls || map;
        global.PalletsEvents.emit('toast', { type: 'success', title: 'Workflows Updated', message: 'Preserved registry updated on server.' });
        renderAdministration(container, global.PalletsState.state);
      } catch (err) {
        global.PalletsEvents.emit('toast', { type: 'error', title: 'Validation Error', message: err.message });
      }
    });
  }

  global.PalletsAdministrationPage = { render: renderAdministration };
})(typeof window !== 'undefined' ? window : globalThis);

