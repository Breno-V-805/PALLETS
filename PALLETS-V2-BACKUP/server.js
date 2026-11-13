/**
 * PALLETS // Production Node.js Server
 * Zero external npm dependencies — runs anywhere Node.js is installed.
 * Supports Linux / Windows / Docker / AWS / DigitalOcean / Heroku / Render / Railway.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const zlib = require('zlib');
const https = require('https');

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';
const ROOT_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8'
};

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  let pathname = decodeURIComponent(parsedUrl.pathname);

  // Global CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check endpoint for cloud load balancers & monitoring
  if (pathname === '/health' || pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'UP',
      service: 'Pallets FMCG Platform',
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      nodeVersion: process.version
    }));
    return;
  }

  // Persistent Webhook Memory Endpoints (Saves to server disk permanently)
  const CONFIG_FILE = path.join(ROOT_DIR, 'webhooks-config.json');

  if (pathname === '/api/workflows/config') {
    if (req.method === 'GET') {
      fs.readFile(CONFIG_FILE, 'utf8', (err, data) => {
        if (err) {
          const defaultCfg = {
            master: 'https://api.agents.snsihub.ai/webhook/cc0a6272-8aba-45b2-916a-b44905b2386a',
            supabaseSync: '',
            authSupabase: 'https://api.agents.snsihub.ai/webhook/40832378-4e7b-4a82-824f-963709fb5119',
            ingestion: 'https://api.agents.snsihub.ai/webhook/6793b021-48d8-468c-bc57-26a1853e7542',
            forecasting: 'https://api.agents.snsihub.ai/webhook/4798f7a4-a61f-43dc-a773-fa7d36475b2f',
            risks: 'https://api.agents.snsihub.ai/webhook/fed236f4-1544-42da-8520-d66fa14cce44',
            replenishment: 'https://api.agents.snsihub.ai/webhook/2efb1af6-df78-48d1-b03a-896ec79a82b9',
            suppliers: 'https://api.agents.snsihub.ai/webhook/3c2f7abd-1599-4a00-b40b-f31e4019cd21',
            copilot: 'https://api.agents.snsihub.ai/webhook/a1e7b69a-093a-47fe-8fd8-d10139ed707a'
          };
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(defaultCfg));
        } else {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(data);
        }
      });
      return;
    }

    if (req.method === 'POST') {
      let bodyChunks = [];
      req.on('data', chunk => bodyChunks.push(chunk));
      req.on('end', () => {
        try {
          const newConfig = JSON.parse(Buffer.concat(bodyChunks).toString());
          fs.writeFile(CONFIG_FILE, JSON.stringify(newConfig, null, 2), 'utf8', (err) => {
            if (err) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Failed to write config file', message: err.message }));
            } else {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true, message: 'Webhook memory saved to server disk', config: newConfig }));
            }
          });
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
        }
      });
      return;
    }
  }

  // Server-side SNS Webhook Proxy (optional bypass for strict corporate firewalls)
  if (pathname === '/api/sns-proxy') {
    if (req.method !== 'POST') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Method Not Allowed' }));
      return;
    }

    let bodyChunks = [];
    req.on('data', chunk => bodyChunks.push(chunk));
    req.on('end', () => {
      const postBody = Buffer.concat(bodyChunks).toString();
      const targetWebhook = req.headers['x-target-webhook'] || 'https://api.agents.snsihub.ai/webhook/cc0a6272-8aba-45b2-916a-b44905b2386a';
      
      const targetUrl = url.parse(targetWebhook);
      const proxyReq = https.request({
        hostname: targetUrl.hostname,
        port: targetUrl.port || 443,
        path: targetUrl.path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postBody)
        }
      }, proxyRes => {
        res.writeHead(proxyRes.statusCode, { 'Content-Type': proxyRes.headers['content-type'] || 'application/json' });
        proxyRes.pipe(res);
      });

      proxyReq.on('error', err => {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Gateway Error to SNS Webhook', message: err.message }));
      });

      proxyReq.write(postBody);
      proxyReq.end();
    });
    return;
  }

  // Default to index.html
  if (pathname === '/' || pathname === '') {
    pathname = '/index.html';
  }

  // Prevent directory traversal attacks
  const safePath = path.normalize(path.join(ROOT_DIR, pathname));
  if (!safePath.startsWith(ROOT_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  fs.stat(safePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Fallback for Single Page App routing
      const fallbackIndex = path.join(ROOT_DIR, 'index.html');
      fs.readFile(fallbackIndex, (fbErr, fbContent) => {
        if (fbErr) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('404 Not Found');
        } else {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(fbContent);
        }
      });
      return;
    }

    const ext = path.extname(safePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const acceptEncoding = req.headers['accept-encoding'] || '';

    // Cache control
    if (ext === '.html') {
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day cache for assets
    }

    const rawStream = fs.createReadStream(safePath);

    // Gzip compression for text & code files
    if (/\bgzip\b/.test(acceptEncoding) && /text|javascript|json|xml/.test(contentType)) {
      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Encoding': 'gzip'
      });
      rawStream.pipe(zlib.createGzip()).pipe(res);
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      rawStream.pipe(res);
    }
  });
});

server.listen(PORT, HOST, () => {
  console.log('================================================================');
  console.log(` PALLETS // Production FMCG Platform Server`);
  console.log(` Status    : ACTIVE`);
  console.log(` Local     : http://localhost:${PORT}`);
  console.log(` Network   : http://${HOST}:${PORT}`);
  console.log(` Health    : http://localhost:${PORT}/health`);
  console.log(` SNS Proxy : http://localhost:${PORT}/api/sns-proxy`);
  console.log(` Mode      : Production (Zero-Dependency Node.js)`);
  console.log('================================================================');
});

// Graceful termination
const shutdown = () => {
  console.log('\nShutting down Pallets server gracefully...');
  server.close(() => {
    console.log('Server stopped.');
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

