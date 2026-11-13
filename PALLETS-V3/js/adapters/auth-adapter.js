/**
 * PALLETS V3 // Authentication & RBAC API Adapter
 */
(function (global) {
  'use strict';

  async function requestJson(url, options = {}) {
    let res;
    try {
      res = await fetch(url, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(options.headers || {})
        },
        ...options
      });
    } catch (networkErr) {
      throw new Error(
        `Cannot reach PALLETS V3 server at ${global.location.origin}. Ensure "node server.js" is still running in your PALLETS-V3 terminal (tip: pressing Ctrl+C in Windows PowerShell stops the server; use Right-Click or Ctrl+Shift+C to copy tokens).`
      );
    }
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(body.error || `HTTP ${res.status}`);
      err.status = res.status;
      err.body = body;
      throw err;
    }
    return body;
  }

  const AuthAdapter = {
    async checkSession() {
      return requestJson('/api/auth/session', { method: 'GET' });
    },
    async login(email, password) {
      return requestJson('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
    },
    async registerStaff({ name, email, password, storeAccess }) {
      return requestJson('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password, storeAccess })
      });
    },
    async bootstrapAdmin({ name, email, password, bootstrapToken }) {
      return requestJson('/api/auth/bootstrap-admin', {
        method: 'POST',
        body: JSON.stringify({ name, email, password, bootstrapToken })
      });
    },
    async logout() {
      return requestJson('/api/auth/logout', { method: 'POST' });
    },
    async listUsers() {
      return requestJson('/api/admin/users', { method: 'GET' });
    },
    async createUser(payload) {
      return requestJson('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    },
    async updateUser(id, payload) {
      return requestJson(`/api/admin/users/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });
    },
    async syncUsersToSupabase() {
      return requestJson('/api/admin/users/sync-supabase', { method: 'POST' });
    },
    async syncAllTablesToSupabase() {
      return requestJson('/api/admin/supabase/sync-all', { method: 'POST' });
    },
    async listAuditLogs() {
      return requestJson('/api/admin/audit-logs', { method: 'GET' });
    }
  };

  global.PalletsAuthAdapter = AuthAdapter;
})(typeof window !== 'undefined' ? window : globalThis);

