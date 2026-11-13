/**
 * PALLETS V3 // Preserved SNS Workflow & Supabase Synchronization Adapter
 */
(function (global) {
  'use strict';

  let snsClient = null;
  let supabaseClient = null;

  function ensureClients() {
    if (!snsClient) {
      snsClient = new global.SnsWebhookClient({
        onTelemetryUpdate: (_entry, allLogs) => {
          global.PalletsState.setState({
            telemetryLogs: [...allLogs],
            workflows: { ...snsClient.workflows }
          });
        }
      });
    }
    if (!supabaseClient) {
      supabaseClient = new global.PalletsSupabaseClient({
        isConfigured: () => Boolean(snsClient.workflows.supabaseSync && snsClient.workflows.supabaseSync.configured),
        onStatusChange: (status) => {
          global.PalletsState.setState({ supabaseStatus: { ...status } });
        }
      });
    }
  }

  const WorkflowAdapter = {
    init() {
      ensureClients();
      return { snsClient, supabaseClient };
    },
    getSnsClient() {
      ensureClients();
      return snsClient;
    },
    getSupabaseClient() {
      ensureClients();
      return supabaseClient;
    },
    async refreshWorkflowStatus() {
      ensureClients();
      const data = await snsClient.syncFromServer();
      global.PalletsState.setState({ workflows: { ...snsClient.workflows } });
      if (snsClient.workflows.supabaseSync && snsClient.workflows.supabaseSync.configured) {
        await supabaseClient.checkHealth();
      } else {
        global.PalletsState.setState({
          supabaseStatus: {
            configured: false,
            reachable: false,
            schemaReady: false,
            outcome: 'UNCONFIGURED',
            mode: 'UNCONFIGURED_LOCAL_FALLBACK'
          }
        });
      }
      return data;
    },
    async updateWebhookConfig(urlMap) {
      ensureClients();
      const res = await snsClient.persistWorkflowUrlsToServer(urlMap);
      global.PalletsState.setState({ workflows: { ...snsClient.workflows } });
      return res;
    },
    async pingWorkflow(featureKey) {
      ensureClients();
      const res = await snsClient.pingWorkflow(featureKey);
      global.PalletsState.setState({ workflows: { ...snsClient.workflows } });
      return res;
    },
    async trigger(eventType, data, featureKey = 'master', options = {}) {
      ensureClients();
      const res = await snsClient.triggerWebhook(eventType, data, featureKey, options);
      global.PalletsState.setState({ workflows: { ...snsClient.workflows } });
      return res;
    }
  };

  global.PalletsWorkflowAdapter = WorkflowAdapter;
})(typeof window !== 'undefined' ? window : globalThis);

