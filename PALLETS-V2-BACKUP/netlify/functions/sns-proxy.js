/**
 * Netlify Serverless Function: SNS Webhook Server-Side Proxy
 * Path: /.netlify/functions/sns-proxy (routed from /api/sns-proxy)
 * Bypasses any browser CORS or network restrictions directly from Netlify's cloud infrastructure.
 */

const https = require('https');
const url = require('url');

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Target-Webhook',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  const targetWebhook = event.headers['x-target-webhook'] || 'https://api.agents.snsihub.ai/webhook/cc0a6272-8aba-45b2-916a-b44905b2386a';
  const postBody = event.body || '{}';

  return new Promise((resolve) => {
    const targetUrl = url.parse(targetWebhook);
    const req = https.request({
      hostname: targetUrl.hostname,
      port: targetUrl.port || 443,
      path: targetUrl.path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postBody)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode || 200,
          headers,
          body: data || JSON.stringify({ status: 'completed', success: true })
        });
      });
    });

    req.on('error', (err) => {
      resolve({
        statusCode: 502,
        headers,
        body: JSON.stringify({ error: 'Gateway Error to SNS Webhook', message: err.message })
      });
    });

    req.write(postBody);
    req.end();
  });
};

