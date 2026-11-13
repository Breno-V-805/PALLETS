/**
 * PALLETS V3 // Preserved SNS Agent Workbench Client
 *
 * CRITICAL PRESERVATION:
 * All 9 workflow IDs and exact webhook URLs are preserved verbatim from V2.
 * All requests route securely through /api/sns-proxy on V3 server.js (RBAC protected),
 * and failures/timeouts NEVER fabricate fake "200 OK" success responses.
 */
(function (global) {
  'use strict';

  const PRESERVED_WORKFLOWS = {
    master: {
      id: 'WF-MASTER',
      name: 'Master Orchestrator / Gateway',
      url: 'https://api.agents.snsihub.ai/webhook/cc0a6272-8aba-45b2-916a-b44905b2386a',
      interactsWith: ['WF-SUPABASE-SYNC', 'WF-AUTH-SUPABASE', 'WF-INGEST', 'WF-FORECAST', 'WF-RISK', 'WF-REPLENISH', 'WF-SUPPLIER', 'WF-COPILOT'],
      description: 'Central event router and multi-workflow dispatcher.'
    },
    supabaseSync: {
      id: 'WF-SUPABASE-SYNC',
      name: 'Unified Supabase Database Sync (All 10 Tables)',
      url: 'https://api.agents.snsihub.ai/webhook/339f3866-bb32-40ba-9849-c83dcc1df790',
      interactsWith: ['Supabase PostgreSQL (pallets_gateway)'],
      description: 'Single SNS workflow reading and persisting all 10 Pallets tables in Supabase.'
    },
    authSupabase: {
      id: 'WF-AUTH-SUPABASE',
      name: 'User Auth & Supabase Storage',
      url: 'https://api.agents.snsihub.ai/webhook/40832378-4e7b-4a82-824f-963709fb5119',
      interactsWith: ['WF-MASTER'],
      description: 'Synchronizes new operator profiles into Supabase (pallets_users).'
    },
    ingestion: {
      id: 'WF-INGEST',
      name: 'Sales Ingestion & Anomaly Normalizer',
      url: 'https://api.agents.snsihub.ai/webhook/6793b021-48d8-468c-bc57-26a1853e7542',
      interactsWith: ['WF-FORECAST', 'WF-RISK'],
      description: 'Normalizes transactions, aggregates rolling velocity, and triggers forecasting.'
    },
    forecasting: {
      id: 'WF-FORECAST',
      name: 'AI Demand Forecasting Studio',
      url: 'https://api.agents.snsihub.ai/webhook/4798f7a4-a61f-43dc-a773-fa7d36475b2f',
      interactsWith: ['WF-RISK', 'WF-COPILOT'],
      description: 'Runs tournament (MA, Holt, Holt-Winters), selects lowest WAPE, and projects 7/30/90d demand.'
    },
    risks: {
      id: 'WF-RISK',
      name: 'Autonomous Inventory Risk Radar',
      url: 'https://api.agents.snsihub.ai/webhook/fed236f4-1544-42da-8520-d66fa14cce44',
      interactsWith: ['WF-REPLENISH', 'WF-COPILOT'],
      description: 'Computes runway days and lost revenue; triggers PO recommendations on critical deficit.'
    },
    replenishment: {
      id: 'WF-REPLENISH',
      name: 'Smart Replenishment & PO Engine',
      url: 'https://api.agents.snsihub.ai/webhook/2efb1af6-df78-48d1-b03a-896ec79a82b9',
      interactsWith: ['WF-SUPPLIER', 'WF-COPILOT'],
      description: 'Calculates ROP, IP, Q, and MOQ round-ups; submits approved orders to supplier dispatch.'
    },
    suppliers: {
      id: 'WF-SUPPLIER',
      name: 'Supplier Performance & Dispatch',
      url: 'https://api.agents.snsihub.ai/webhook/3c2f7abd-1599-4a00-b40b-f31e4019cd21',
      interactsWith: ['WF-REPLENISH'],
      description: 'Monitors vendor SLA reliability, lead times, and confirms PO execution.'
    },
    copilot: {
      id: 'WF-COPILOT',
      name: 'AI Inventory Copilot (Federated Hub)',
      url: 'https://api.agents.snsihub.ai/webhook/a1e7b69a-093a-47fe-8fd8-d10139ed707a',
      interactsWith: ['WF-RISK', 'WF-REPLENISH', 'WF-FORECAST'],
      description: 'Conversational agent federating queries across sub-workflows.'
    }
  };

  class SnsWebhookClient {
    constructor(options = {}) {
      this.masterWebhookUrl = PRESERVED_WORKFLOWS.master.url;
      this.masterWorkflowId = 'cc0a6272-8aba-45b2-916a-b44905b2386a';
      this.telemetryLogs = [];
      this.onTelemetryUpdate = options.onTelemetryUpdate || null;
      this.workflows = {};
      Object.keys(PRESERVED_WORKFLOWS).forEach((k) => {
        const wfDef = PRESERVED_WORKFLOWS[k];
        this.workflows[k] = {
          ...wfDef,
          configured: Boolean(wfDef.url),
          healthStatus: wfDef.url ? 'READY' : 'UNCONFIGURED',
          lastLatencyMs: null
        };
      });
    }

    async syncFromServer() {
      try {
        const res = await fetch('/api/workflows/status', { credentials: 'include' });
        if (!res.ok) return null;
        const data = await res.json();
        if (data && data.workflows) {
          Object.keys(data.workflows).forEach((k) => {
            if (this.workflows[k]) {
              const meta = data.workflows[k];
              this.workflows[k].configured = Boolean(meta.configured);
              this.workflows[k].healthStatus = meta.healthStatus || (meta.configured ? 'READY' : 'UNCONFIGURED');
              this.workflows[k].lastLatencyMs = meta.lastLatencyMs ?? this.workflows[k].lastLatencyMs;
              // Full URLs are only returned to authorized Admin callers
              if (meta.url !== undefined) {
                this.workflows[k].url = meta.url;
                if (k === 'master' && meta.url) this.masterWebhookUrl = meta.url;
              }
            }
          });
        }
        return data;
      } catch (e) {
        return null;
      }
    }

    async persistWorkflowUrlsToServer(urlMap) {
      const res = await fetch('/api/workflows/config', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(urlMap)
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error || `HTTP ${res.status}`);
      }
      await this.syncFromServer();
      return json;
    }

    logTelemetry(entryDetails) {
      const entry = {
        id: 'TEL-' + Date.now().toString(36).toUpperCase(),
        timestamp: new Date().toLocaleTimeString('en-IN', { hour12: false }),
        iso: new Date().toISOString(),
        ...entryDetails
      };
      this.telemetryLogs.unshift(entry);
      if (this.telemetryLogs.length > 100) this.telemetryLogs.pop();
      if (typeof this.onTelemetryUpdate === 'function') {
        this.onTelemetryUpdate(entry, this.telemetryLogs);
      }
      return entry;
    }

    /**
     * Dispatch a preserved payload envelope via the authenticated server SNS proxy.
     * Returns explicit outcome: CONFIRMED_SUCCESS | CONFIRMED_FAILURE | UNKNOWN_TIMEOUT | UNCONFIGURED
     */
    async triggerWebhook(eventType, payloadData = {}, featureKey = 'master', options = {}) {
      const wf = this.workflows[featureKey] || this.workflows.master;
      const startTime = performance.now();

      // Preserved V2 envelope verbatim
      const envelope = {
        event: eventType,
        workflowId: wf.id,
        workflowName: wf.name,
        routedViaMaster: false,
        source: 'PALLETS_ENTERPRISE_WEBAPP',
        timestamp: new Date().toISOString(),
        interactsWith: wf.interactsWith,
        data: payloadData
      };

      const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
      if (options.idempotencyKey) {
        headers['X-Idempotency-Key'] = options.idempotencyKey;
      }

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 35000);

        const res = await fetch('/api/sns-proxy', {
          method: 'POST',
          credentials: 'include',
          headers,
          body: JSON.stringify({
            featureKey,
            payload: envelope,
            isRawBody: Boolean(options.isRawBody)
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);
        const latencyMs = Math.max(1, Math.round(performance.now() - startTime));
        const body = await res.json().catch(() => null);

        if (body && body.outcome) {
          wf.healthStatus = body.outcome === 'CONFIRMED_SUCCESS' ? 'ONLINE' : body.outcome;
          wf.lastLatencyMs = body.latencyMs || latencyMs;

          const log = this.logTelemetry({
            type: eventType,
            workflowId: wf.id,
            workflowName: wf.name,
            outcome: body.outcome,
            httpStatus: body.httpStatus || res.status,
            latencyMs: wf.lastLatencyMs,
            errorDetail: body.error || null,
            interactChain: wf.interactsWith.join(' -> '),
            payload: envelope,
            response: body.data || body
          });

          return {
            success: body.outcome === 'CONFIRMED_SUCCESS',
            outcome: body.outcome,
            status: body.httpStatus || res.status,
            latencyMs: wf.lastLatencyMs,
            workflowId: wf.id,
            data: body.data || null,
            error: body.error || null,
            log
          };
        }

        const outcome = res.ok ? 'CONFIRMED_SUCCESS' : 'CONFIRMED_FAILURE';
        wf.healthStatus = outcome;
        wf.lastLatencyMs = latencyMs;
        const errText = body?.error || `HTTP ${res.status}`;

        const log = this.logTelemetry({
          type: eventType,
          workflowId: wf.id,
          workflowName: wf.name,
          outcome,
          httpStatus: res.status,
          latencyMs,
          errorDetail: res.ok ? null : errText,
          interactChain: wf.interactsWith.join(' -> '),
          payload: envelope,
          response: body
        });

        return {
          success: res.ok,
          outcome,
          status: res.status,
          latencyMs,
          workflowId: wf.id,
          data: body,
          error: res.ok ? null : errText,
          log
        };
      } catch (err) {
        const latencyMs = Math.max(1, Math.round(performance.now() - startTime));
        const isTimeout = err && err.name === 'AbortError';
        const outcome = isTimeout ? 'UNKNOWN_TIMEOUT' : 'CONFIRMED_FAILURE';
        const errMsg = isTimeout
          ? 'Request timed out after 35s; remote SNS execution outcome is unknown.'
          : (err?.message || 'Network failure calling SNS proxy.');

        wf.healthStatus = outcome;
        wf.lastLatencyMs = latencyMs;

        const log = this.logTelemetry({
          type: eventType,
          workflowId: wf.id,
          workflowName: wf.name,
          outcome,
          httpStatus: 0,
          latencyMs,
          errorDetail: errMsg,
          interactChain: wf.interactsWith.join(' -> '),
          payload: envelope,
          response: null
        });

        return {
          success: false,
          outcome,
          status: 0,
          latencyMs,
          workflowId: wf.id,
          data: null,
          error: errMsg,
          log
        };
      }
    }

    async pingWorkflow(featureKey = 'master') {
      const wf = this.workflows[featureKey] || this.workflows.master;
      if (featureKey === 'supabaseSync') {
        return this.triggerWebhook('SUPABASE_GATEWAY', {
          action: 'health',
          pingTarget: wf.id,
          pingTime: new Date().toISOString()
        }, 'supabaseSync', { isRawBody: true });
      }
      return this.triggerWebhook('HEALTH_CHECK', {
        pingTarget: wf.id,
        pingTime: new Date().toISOString()
      }, featureKey);
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SnsWebhookClient, PRESERVED_WORKFLOWS };
  }
  global.PRESERVED_SNS_WORKFLOWS = PRESERVED_WORKFLOWS;
  global.SnsWebhookClient = SnsWebhookClient;
})(typeof window !== 'undefined' ? window : globalThis);

