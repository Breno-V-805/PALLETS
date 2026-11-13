/**
 * Netlify Serverless Function: Persistent Webhooks Configuration
 * Path: /.netlify/functions/workflows-config (routed from /api/workflows/config)
 */

let memoryStore = {
  master: "https://api.agents.snsihub.ai/webhook/cc0a6272-8aba-45b2-916a-b44905b2386a",
  supabaseSync: "",
  authSupabase: "https://api.agents.snsihub.ai/webhook/40832378-4e7b-4a82-824f-963709fb5119",
  ingestion: "https://api.agents.snsihub.ai/webhook/6793b021-48d8-468c-bc57-26a1853e7542",
  forecasting: "https://api.agents.snsihub.ai/webhook/4798f7a4-a61f-43dc-a773-fa7d36475b2f",
  risks: "https://api.agents.snsihub.ai/webhook/fed236f4-1544-42da-8520-d66fa14cce44",
  replenishment: "https://api.agents.snsihub.ai/webhook/2efb1af6-df78-48d1-b03a-896ec79a82b9",
  suppliers: "https://api.agents.snsihub.ai/webhook/3c2f7abd-1599-4a00-b40b-f31e4019cd21",
  copilot: "https://api.agents.snsihub.ai/webhook/a1e7b69a-093a-47fe-8fd8-d10139ed707a"
};

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod === 'GET') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(memoryStore)
    };
  }

  if (event.httpMethod === 'POST') {
    try {
      const body = JSON.parse(event.body || '{}');
      memoryStore = { ...memoryStore, ...body };
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Saved to Netlify Serverless Memory',
          config: memoryStore
        })
      };
    } catch (err) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid JSON payload' })
      };
    }
  }

  return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
};

