/**
 * PALLETS V3 // Enterprise Dark Industrial B2B SaaS Server
 * Zero external npm dependencies (Node.js built-ins only).
 *
 * Security & Architectural Guarantees:
 * - Passwords hashed per-user with crypto.scryptSync + random 16-byte salt; compared via timingSafeEqual.
 * - Sessions signed with HMAC-SHA256 using persistent .secrets/session.key + HttpOnly; SameSite=Lax cookies + revocation tracking.
 * - Initial Admin account uses a one-time bootstrap token printed only to server stdout (or PALLETS_BOOTSTRAP_TOKEN) when 0 Admins exist.
 * - Public signup (/api/auth/register) strictly creates Staff accounts, prevents duplicate/concurrent email races, and rejects role/permission spoofing (403).
 * - Strict server-side RBAC + store-hub scoping enforced on every /api/ops/*, /api/admin/*, /api/workflows/*, and /api/sns-proxy route.
 * - Preserves all 9 SNS Agent Workbench webhook URLs verbatim and reports honest execution outcomes (CONFIRMED_SUCCESS / CONFIRMED_FAILURE / UNKNOWN_TIMEOUT / UNCONFIGURED).
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const zlib = require('zlib');

const Calculations = require('../js/core/calculations.js');
const SeedData = require('../js/core/seed-data.js');
const AprioriEngine = require('../js/existing/apriori-engine.js');
const { PRESERVED_WORKFLOWS } = require('../js/existing/sns-webhook.js');

const BASE_DIR = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT) || 3001;
const IS_SERVERLESS = Boolean(
  process.env.VERCEL ||
  process.env.AWS_LAMBDA_FUNCTION_NAME ||
  process.env.LAMBDA_TASK_ROOT ||
  process.env.NETLIFY
);

function resolveWritableDir(envVar, folderName) {
  if (process.env[envVar] && process.env[envVar].trim()) {
    return path.resolve(process.env[envVar].trim());
  }
  if (IS_SERVERLESS) {
    return path.join(os.tmpdir(), 'pallets_v3', folderName);
  }
  return path.join(BASE_DIR, folderName);
}

let DATA_DIR = resolveWritableDir('PALLETS_DATA_DIR', '.data');
let SECRETS_DIR = resolveWritableDir('PALLETS_SECRETS_DIR', '.secrets');

function ensureDirWritable(targetPath, fallbackSubdir) {
  try {
    fs.mkdirSync(targetPath, { recursive: true });
    const probe = path.join(targetPath, `.probe_${process.pid}_${Date.now()}`);
    fs.writeFileSync(probe, 'ok');
    fs.unlinkSync(probe);
    return targetPath;
  } catch (err) {
    const fallback = path.join(os.tmpdir(), 'pallets_v3', fallbackSubdir);
    try {
      fs.mkdirSync(fallback, { recursive: true });
    } catch (_) {}
    return fallback;
  }
}

DATA_DIR = ensureDirWritable(DATA_DIR, '.data');
SECRETS_DIR = ensureDirWritable(SECRETS_DIR, '.secrets');

const USERS_FILE = path.join(DATA_DIR, 'users.json');
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const WEBHOOKS_FILE = path.join(DATA_DIR, 'webhooks-config.json');
const DEFAULT_WEBHOOKS_FILE = path.join(BASE_DIR, 'webhooks-config.json');
const AUDIT_FILE = path.join(DATA_DIR, 'audit.json');
const SESSION_KEY_FILE = path.join(SECRETS_DIR, 'session.key');

const SESSION_COOKIE_NAME = 'pallets_v3_sid';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const MAX_JSON_BODY_BYTES = 2 * 1024 * 1024;
const VALID_HUB_IDS = new Set(Calculations.HUBS.map((h) => h.id));
const VALID_ROLES = new Set(['Admin', 'Inventory Manager', 'Staff']);
const ROLE_PERMISSIONS = {
  Admin: ['ALL'],
  'Inventory Manager': ['OPS_READ', 'OPS_WRITE', 'REPLENISH_APPROVE', 'FORECAST_RUN', 'INGEST_RUN', 'SUPPLIER_WRITE', 'COPILOT_USE', 'ANALYTICS_VIEW'],
  Staff: ['OPS_READ', 'STOCK_COUNT', 'COPILOT_USE']
};

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

try {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(SECRETS_DIR, { recursive: true });
} catch (_) {}

const memoryStore = new Map();

function atomicWriteJson(filePath, obj) {
  memoryStore.set(filePath, JSON.parse(JSON.stringify(obj)));
  try {
    const parent = path.dirname(filePath);
    if (!fs.existsSync(parent)) {
      fs.mkdirSync(parent, { recursive: true });
    }
    const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(obj, null, 2), 'utf8');
    fs.renameSync(tmpPath, filePath);
  } catch (err) {
    // In-memory fallback prevents crashes on read-only serverless filesystems
  }
}

function readJsonSafe(filePath, fallback) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (err) {}
  if (memoryStore.has(filePath)) {
    return JSON.parse(JSON.stringify(memoryStore.get(filePath)));
  }
  return fallback;
}

function loadOrCreateSessionSecret() {
  const envSecret = String(process.env.PALLETS_SESSION_SECRET || process.env.SESSION_SECRET || '').trim();
  if (envSecret.length >= 32) return envSecret;
  if (fs.existsSync(SESSION_KEY_FILE)) {
    const existing = fs.readFileSync(SESSION_KEY_FILE, 'utf8').trim();
    if (existing.length >= 32) return existing;
  }
  const secret = crypto.randomBytes(32).toString('hex');
  try {
    fs.writeFileSync(SESSION_KEY_FILE, secret, { encoding: 'utf8', mode: 0o600 });
  } catch (err) {}
  return secret;
}

const SESSION_SECRET = loadOrCreateSessionSecret();
const revokedJtis = new Set();
const registrationInFlight = new Set();
const workflowHealthCache = {};

function sha256Hex(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

function verifyPassword(password, storedHash) {
  if (!storedHash || typeof storedHash !== 'string') return false;
  const parts = storedHash.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, hexDigest] = parts;
  try {
    const actual = crypto.scryptSync(String(password), salt, 64);
    const expected = Buffer.from(hexDigest, 'hex');
    if (actual.length !== expected.length) return false;
    return crypto.timingSafeEqual(actual, expected);
  } catch (err) {
    return false;
  }
}

function constantTimeEquals(a, b) {
  const bufA = Buffer.from(String(a || ''), 'utf8');
  const bufB = Buffer.from(String(b || ''), 'utf8');
  if (bufA.length !== bufB.length || bufA.length === 0) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function base64UrlEncode(input) {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str) {
  let b64 = String(str).replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  return Buffer.from(b64, 'base64').toString('utf8');
}

function signSessionToken(user) {
  const now = Date.now();
  const payload = {
    uid: user.id,
    email: user.email,
    role: user.role,
    tv: Number(user.tokenVersion || 1),
    jti: crypto.randomBytes(12).toString('hex'),
    iat: now,
    exp: now + SESSION_TTL_MS
  };
  const encoded = base64UrlEncode(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

function verifySessionToken(token) {
  if (!token || typeof token !== 'string') return null;
  const dotIdx = token.indexOf('.');
  if (dotIdx <= 0) return null;
  const encoded = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  if (!constantTimeEquals(sig, expectedSig)) return null;
  try {
    const payload = JSON.parse(base64UrlDecode(encoded));
    if (!payload || !payload.uid || !payload.exp || payload.exp < Date.now()) return null;
    if (revokedJtis.has(payload.jti)) return null;
    return { payload };
  } catch (err) {
    return null;
  }
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  const out = {};
  header.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx > 0) {
      const k = pair.slice(0, idx).trim();
      const v = pair.slice(idx + 1).trim();
      out[k] = decodeURIComponent(v);
    }
  });
  return out;
}

function sanitizeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    storeAccess: user.storeAccess,
    permissions: Array.isArray(user.permissions) ? user.permissions : (ROLE_PERMISSIONS[user.role] || []),
    status: user.status || 'ACTIVE',
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt || null,
    lastSupabaseSync: user.lastSupabaseSync || null
  };
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

function validatePasswordStrength(password) {
  const pw = String(password || '');
  if (pw.length < 8) return 'Password must be at least 8 characters long.';
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) {
    return 'Password must contain at least one letter and one number.';
  }
  return null;
}

function ensureEnvProvisionedAdmin(users) {
  const envEmail = (process.env.PALLETS_ADMIN_EMAIL || '').trim().toLowerCase();
  const envPassword = process.env.PALLETS_ADMIN_PASSWORD || '';
  if (!envEmail || !envPassword || envPassword.length < 8) return;
  if (users.some((u) => normalizeEmail(u.email) === envEmail)) return;
  const nowIso = new Date().toISOString();
  const envAdmin = {
    id: 'USR-' + crypto.randomBytes(5).toString('hex').toUpperCase(),
    name: process.env.PALLETS_ADMIN_NAME ? process.env.PALLETS_ADMIN_NAME.trim() : 'System Administrator',
    email: envEmail,
    passwordHash: hashPassword(envPassword),
    role: 'Admin',
    storeAccess: 'ALL',
    permissions: ROLE_PERMISSIONS.Admin,
    status: 'ACTIVE',
    tokenVersion: 1,
    createdAt: nowIso,
    lastLoginAt: nowIso
  };
  users.push(envAdmin);
  saveUsers(users);
}

function loadUsers() {
  const data = readJsonSafe(USERS_FILE, { users: [] });
  const users = Array.isArray(data.users) ? data.users : [];
  ensureEnvProvisionedAdmin(users);
  return users;
}

function saveUsers(users) {
  atomicWriteJson(USERS_FILE, { users });
}

function hasAnyAdmin(users = loadUsers()) {
  return users.some((u) => u.role === 'Admin' && u.status !== 'DISABLED');
}

function loadAuditLogs() {
  const data = readJsonSafe(AUDIT_FILE, { logs: [] });
  return Array.isArray(data.logs) ? data.logs : [];
}

function appendAuditLog(entry) {
  const logs = loadAuditLogs();
  logs.unshift({
    id: 'AUD-' + crypto.randomBytes(4).toString('hex').toUpperCase(),
    timestamp: new Date().toISOString(),
    ...entry
  });
  if (logs.length > 500) logs.length = 500;
  atomicWriteJson(AUDIT_FILE, { logs });
}

function loadWebhooksConfig() {
  const defaults = readJsonSafe(DEFAULT_WEBHOOKS_FILE, {});
  if (!fs.existsSync(WEBHOOKS_FILE)) {
    atomicWriteJson(WEBHOOKS_FILE, defaults);
    return { ...defaults };
  }
  const persisted = readJsonSafe(WEBHOOKS_FILE, defaults);
  const merged = { ...defaults, ...persisted };
  return merged;
}

function saveWebhooksConfig(nextConfig) {
  atomicWriteJson(WEBHOOKS_FILE, nextConfig);
}

function buildInitialHubStocks(product) {
  const hubs = Calculations.HUBS.map((h) => h.id);
  const weights = {};
  let sum = 0;
  hubs.forEach((h) => {
    const w = h === product.hub ? 0.52 : 0.16;
    weights[h] = w;
    sum += w;
  });
  const total = Math.max(0, Math.round(Number(product.onHand || 0)));
  const allocated = {};
  let running = 0;
  hubs.forEach((h, idx) => {
    if (idx === hubs.length - 1) {
      allocated[h] = Math.max(0, total - running);
    } else {
      const part = Math.round((total * weights[h]) / sum);
      allocated[h] = part;
      running += part;
    }
  });
  return allocated;
}

function loadOrInitState() {
  const existing = readJsonSafe(STATE_FILE, null);
  if (existing && Array.isArray(existing.products)) {
    if (!existing.idempotencyCache) existing.idempotencyCache = {};
    if (!Array.isArray(existing.forecastRuns)) existing.forecastRuns = [];
    if (!Array.isArray(existing.activityLogs)) existing.activityLogs = [];
    if (!Array.isArray(existing.purchaseOrders)) existing.purchaseOrders = [];
    return existing;
  }

  const rawProducts = SeedData.createInitialProducts().map((p) => ({
    ...p,
    hubStocks: buildInitialHubStocks(p)
  }));

  const initialPOs = [
    {
      id: 'PO-9841',
      sku: 'SKU-5520-YOGU',
      productName: 'Epigamia Greek Yogurt 400g',
      hub: 'BLR_NORTH_DC',
      qty: 200,
      unitCost: 82,
      totalCost: 16400,
      supplier: 'Drums Food ColdChain',
      status: 'PENDING',
      rationale: 'Velocity surge detected (+42% DoD). Runway below 1 day.',
      dispatchOutcome: 'PENDING_APPROVAL',
      createdBy: 'System Risk Radar',
      createdAt: new Date(Date.now() - 3600000).toISOString()
    },
    {
      id: 'PO-9840',
      sku: 'SKU-9921-OAT',
      productName: 'Oatly Barista Edition 1L',
      hub: 'BLR_NORTH_DC',
      qty: 600,
      unitCost: 235,
      totalCost: 141000,
      supplier: 'Nordic Beverage Imports',
      status: 'PENDING',
      rationale: 'Projected stockout in 1.3 days. Recommended MOQ replenish (600u).',
      dispatchOutcome: 'PENDING_APPROVAL',
      createdBy: 'System Risk Radar',
      createdAt: new Date(Date.now() - 5400000).toISOString()
    },
    {
      id: 'PO-9839',
      sku: 'SKU-8842-COLD',
      productName: 'Blue Tokai Cold Brew 250ml',
      hub: 'MUM_BANDRA_HUB',
      qty: 500,
      unitCost: 68,
      totalCost: 34000,
      supplier: 'Tokai Artisanal Roasters',
      status: 'APPROVED',
      rationale: 'Weekend demand peak approaching; lead time 2d.',
      dispatchOutcome: 'CONFIRMED_SUCCESS',
      createdBy: 'Operations Control',
      createdAt: new Date(Date.now() - 18000000).toISOString(),
      approvedAt: new Date(Date.now() - 17000000).toISOString()
    }
  ];

  const initialActivity = [
    {
      id: 'ACT-1004',
      type: 'STOCK_ALERT',
      hub: 'BLR_NORTH_DC',
      title: 'Critical runway alert: Epigamia Greek Yogurt 400g',
      detail: '65 units on hand (0.7 days runway vs 1d lead time).',
      actor: 'WF-RISK Radar',
      timestamp: new Date(Date.now() - 1800000).toISOString()
    },
    {
      id: 'ACT-1003',
      type: 'INGESTION',
      hub: 'BLR_NORTH_DC',
      title: 'POS Batch BATCH-ING-9842 normalized',
      detail: '1,412 rows imported, 8 duplicates deduplicated.',
      actor: 'WF-INGEST',
      timestamp: new Date(Date.now() - 7200000).toISOString()
    },
    {
      id: 'ACT-1002',
      type: 'PURCHASE_ORDER',
      hub: 'MUM_BANDRA_HUB',
      title: 'PO-9839 approved for Blue Tokai Cold Brew',
      detail: '500 units ordered via Tokai Artisanal Roasters.',
      actor: 'Operations Control',
      timestamp: new Date(Date.now() - 17000000).toISOString()
    },
    {
      id: 'ACT-1001',
      type: 'FORECAST',
      hub: 'DEL_GURGAON_CORE',
      title: 'Tournament selected Holt-Winters Weekly for top movers',
      detail: 'Evaluated 4 models across 20% validation holdout window.',
      actor: 'WF-FORECAST',
      timestamp: new Date(Date.now() - 28800000).toISOString()
    }
  ];

  const state = {
    products: rawProducts,
    suppliers: SeedData.SUPPLIERS_MASTER.map((s) => ({ ...s })),
    ingestionLogs: SeedData.createInitialIngestionLogs(),
    purchaseOrders: initialPOs,
    forecastRuns: [],
    activityLogs: initialActivity,
    idempotencyCache: {}
  };
  atomicWriteJson(STATE_FILE, state);
  return state;
}

function saveState(state) {
  atomicWriteJson(STATE_FILE, state);
}

// Initialize one-time Admin bootstrap token ONLY when zero Admins exist
let bootstrapTokenHash = null;
function ensureBootstrapStateLogged() {
  const users = loadUsers();
  if (hasAnyAdmin(users)) {
    bootstrapTokenHash = null;
    return;
  }
  const envToken = process.env.PALLETS_BOOTSTRAP_TOKEN && process.env.PALLETS_BOOTSTRAP_TOKEN.trim();
  const token = envToken || crypto.randomBytes(20).toString('hex');
  bootstrapTokenHash = sha256Hex(token);
  console.log('');
  console.log('======================================================================');
  console.log('[PALLETS V3 SECURITY] ZERO ADMIN USERS DETECTED.');
  console.log('[PALLETS V3 SECURITY] One-time Admin Bootstrap Token (use in UI or API):');
  console.log(`  TOKEN: ${token}`);
  console.log('  Once the initial Admin account is created, bootstrap locks forever.');
  console.log('  [TIP] Keep this server running! In Windows/PowerShell, use Right-Click');
  console.log('        or Ctrl+Shift+C to copy — pressing Ctrl+C stops the server.');
  console.log('======================================================================');
  console.log('');
}

loadOrInitState();
loadWebhooksConfig();
ensureBootstrapStateLogged();

function sendJson(res, statusCode, data, extraHeaders = {}) {
  const body = JSON.stringify(data);
  const req = res.req;
  const origin = (req && req.headers && req.headers.origin) ? req.headers.origin : '*';
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept, X-Requested-With',
    'Vary': 'Origin',
    ...extraHeaders
  });
  res.end(body);
}

function parseJsonBody(req) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'object') return Promise.resolve(req.body);
    if (typeof req.body === 'string') {
      const trimmed = req.body.trim();
      if (!trimmed) return Promise.resolve({});
      try {
        return Promise.resolve(JSON.parse(trimmed));
      } catch (err) {
        return Promise.reject(Object.assign(new Error('Malformed JSON payload.'), { statusCode: 400 }));
      }
    }
  }
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_JSON_BODY_BYTES) {
        reject(Object.assign(new Error('Request payload exceeds 2MB limit.'), { statusCode: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(Object.assign(new Error('Malformed JSON payload.'), { statusCode: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function buildSessionCookieHeader(token, req, maxAgeSeconds) {
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`
  ];
  const proto = req.headers['x-forwarded-proto'];
  if (proto === 'https' || req.socket.encrypted) {
    parts.push('Secure');
  }
  return parts.join('; ');
}

function authenticateRequest(req) {
  const cookies = parseCookies(req);
  const rawToken = cookies[SESSION_COOKIE_NAME];
  const verified = verifySessionToken(rawToken);
  if (!verified) return null;
  const users = loadUsers();
  const user = users.find((u) => u.id === verified.payload.uid);
  if (!user || user.status === 'DISABLED') return null;
  if (Number(user.tokenVersion || 1) !== Number(verified.payload.tv)) return null;
  return { user, tokenPayload: verified.payload };
}

function requireAuth(req, res) {
  const auth = authenticateRequest(req);
  if (!auth) {
    sendJson(res, 401, { error: 'Authentication required. Please sign in.' });
    return null;
  }
  return auth;
}

function requireRoles(req, res, allowedRoles) {
  const auth = requireAuth(req, res);
  if (!auth) return null;
  if (!allowedRoles.includes(auth.user.role)) {
    appendAuditLog({
      event: 'RBAC_DENIED',
      actorEmail: auth.user.email,
      actorRole: auth.user.role,
      path: req.url,
      method: req.method,
      detail: `Role ${auth.user.role} denied access (requires ${allowedRoles.join(' or ')}).`
    });
    sendJson(res, 403, { error: `Forbidden: ${allowedRoles.join(' or ')} clearance required.` });
    return null;
  }
  return auth;
}

async function forwardJsonPost(targetUrl, payloadObj, timeoutMs = 25000) {
  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const upstreamRes = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify(payloadObj || {}),
      signal: controller.signal
    });
    clearTimeout(timer);
    const latencyMs = Math.max(1, Date.now() - start);
    const text = await upstreamRes.text();
    let parsed = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch (e) {
      parsed = { raw: text };
    }
    if (upstreamRes.ok) {
      return {
        ok: true,
        outcome: 'CONFIRMED_SUCCESS',
        httpStatus: upstreamRes.status,
        latencyMs,
        data: parsed,
        error: null
      };
    }
    return {
      ok: false,
      outcome: 'CONFIRMED_FAILURE',
      httpStatus: upstreamRes.status,
      latencyMs,
      data: parsed,
      error: (parsed && (parsed.error || parsed.message)) || `Upstream webhook returned HTTP ${upstreamRes.status}`
    };
  } catch (err) {
    clearTimeout(timer);
    const latencyMs = Math.max(1, Date.now() - start);
    const isTimeout = err && err.name === 'AbortError';
    return {
      ok: false,
      outcome: isTimeout ? 'UNKNOWN_TIMEOUT' : 'CONFIRMED_FAILURE',
      httpStatus: 0,
      latencyMs,
      data: null,
      error: isTimeout
        ? `Remote workflow timed out after ${timeoutMs}ms; execution outcome is unknown.`
        : (err.message || 'Network failure contacting remote workflow.')
    };
  }
}

function unwrapGatewayPayload(raw) {
  let cur = raw;
  for (let step = 0; step < 6; step++) {
    if (Array.isArray(cur)) {
      cur = cur.length > 0 ? cur[0] : {};
      continue;
    }
    if (typeof cur === 'string') {
      try {
        cur = JSON.parse(cur);
        continue;
      } catch (e) {
        break;
      }
    }
    if (cur && typeof cur === 'object') {
      if (cur.json && typeof cur.json === 'object') {
        cur = cur.json;
        continue;
      }
      if (cur.pallets_gateway && typeof cur.pallets_gateway === 'object') {
        cur = cur.pallets_gateway;
        continue;
      }
      if (cur.result && typeof cur.result === 'object') {
        cur = cur.result;
        continue;
      }
      if (cur.body && (typeof cur.body === 'object' || typeof cur.body === 'string')) {
        cur = cur.body;
        continue;
      }
      if (
        cur.data &&
        !Array.isArray(cur.data) &&
        typeof cur.data === 'object' &&
        (
          cur.data.ok !== undefined ||
          cur.data.schemaReady !== undefined ||
          Array.isArray(cur.data.data) ||
          cur.data.outcome !== undefined ||
          cur.data.result !== undefined ||
          cur.data.body !== undefined
        )
      ) {
        cur = cur.data;
        continue;
      }
    }
    break;
  }
  return cur && typeof cur === 'object' ? cur : null;
}

async function callSupabaseGatewayIfConfigured(gatewayPayload) {
  const webhooks = loadWebhooksConfig();
  const url = String(webhooks.supabaseSync || '').trim();
  if (!url) return { configured: false, outcome: 'UNCONFIGURED' };
  const result = await forwardJsonPost(url, gatewayPayload, 15000);
  const unwrapped = unwrapGatewayPayload(result.data);
  if (result.ok && unwrapped && unwrapped.ok === false) {
    return {
      configured: true,
      ...result,
      ok: false,
      outcome: 'CONFIRMED_FAILURE',
      gatewayBody: unwrapped,
      error: unwrapped.error || unwrapped.message || 'Supabase gateway returned ok=false.'
    };
  }
  return { configured: true, ...result, gatewayBody: unwrapped };
}

/**
 * Synchronizes sanitized non-secret user metadata to Supabase via:
 * 1) WF-SUPABASE-SYNC (unified pallets_gateway RPC supporting idempotent upsert on email), and
 * 2) WF-AUTH-SUPABASE (preserved V2 USER_REGISTRATION envelope for initial user creation or gateway fallback).
 */
async function syncUserToSupabase(user, { mode = 'INSERT', reason = 'USER_LIFECYCLE' } = {}) {
  const webhooks = loadWebhooksConfig();
  const nowIso = new Date().toISOString();
  const permissions = Array.isArray(user.permissions) ? user.permissions : (ROLE_PERMISSIONS[user.role] || []);
  const hasGateway = Boolean(String(webhooks.supabaseSync || '').trim());
  const isCreateMode = mode === 'INSERT';

  let authWebhookOutcome = 'UNCONFIGURED';
  let authRes = null;
  // Invoke WF-AUTH-SUPABASE for initial creation (or as fallback if WF-SUPABASE-SYNC is unconfigured)
  // so insert-only Create Row nodes are not hit on updates/bulk resyncs when gateway upsert handles it.
  if (webhooks.authSupabase && (isCreateMode || !hasGateway)) {
    authRes = await forwardJsonPost(webhooks.authSupabase, {
      event: 'USER_REGISTRATION',
      workflowId: PRESERVED_WORKFLOWS.authSupabase.id,
      workflowName: PRESERVED_WORKFLOWS.authSupabase.name,
      routedViaMaster: false,
      source: 'PALLETS_ENTERPRISE_WEBAPP',
      timestamp: nowIso,
      interactsWith: PRESERVED_WORKFLOWS.authSupabase.interactsWith,
      data: {
        targetDatabase: 'SUPABASE',
        table: 'pallets_users',
        action: isCreateMode ? 'INSERT' : 'UPSERT',
        reason,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          store_hub: user.storeAccess,
          password_hash_placeholder: '[SCRYPT_SERVER_SIDE]',
          status: user.status || 'ACTIVE',
          created_at: user.createdAt || nowIso
        }
      }
    }, 12000);
    authWebhookOutcome = authRes.outcome;
  } else if (webhooks.authSupabase && !isCreateMode && hasGateway) {
    authWebhookOutcome = 'DELEGATED_TO_GATEWAY';
  }

  const gatewayPayload = {
    action: 'upsert',
    table: 'pallets_users',
    onConflict: 'email',
    rows: [
      {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        store_hub: user.storeAccess,
        permissions,
        password_hash_placeholder: '[SCRYPT_SERVER_SIDE]',
        created_at: user.createdAt || nowIso,
        updated_at: nowIso
      }
    ]
  };
  const gatewayRes = await callSupabaseGatewayIfConfigured(gatewayPayload);

  const gatewayConfirmed = gatewayRes.configured && gatewayRes.outcome === 'CONFIRMED_SUCCESS';
  const authConfirmed = authRes && authRes.outcome === 'CONFIRMED_SUCCESS';
  const primary = gatewayRes.configured
    ? (gatewayConfirmed || !authConfirmed ? gatewayRes : authRes)
    : authRes;

  return {
    outcome: (gatewayConfirmed || authConfirmed)
      ? 'CONFIRMED_SUCCESS'
      : (primary ? primary.outcome : 'UNCONFIGURED'),
    authWebhookOutcome,
    gatewayOutcome: gatewayRes.outcome || 'UNCONFIGURED',
    httpStatus: primary ? (primary.httpStatus || 0) : 0,
    latencyMs: primary ? (primary.latencyMs || 0) : 0,
    error: (gatewayConfirmed || authConfirmed)
      ? null
      : (primary ? (primary.error || null) : 'WF-AUTH-SUPABASE and WF-SUPABASE-SYNC are unconfigured.'),
    syncedAt: nowIso
  };
}

function toProductRow(p, nowIso = new Date().toISOString()) {
  return {
    id: p.sku,
    sku: p.sku,
    name: p.name,
    brand: p.brand || 'General FMCG',
    category: p.category || 'General',
    supplier_id: p.supplierId || null,
    supplier_name: p.supplier || 'Verified Distributor',
    store_hub: p.hub || 'BLR_NORTH_DC',
    on_hand: parseInt(p.onHand ?? 0, 10),
    on_order: parseInt(p.onOrder ?? 0, 10),
    reserved: parseInt(p.reserved ?? 0, 10),
    avg_daily_demand: Number(p.dailyDemand ?? 10),
    lead_time_days: Number(p.leadTimeDays ?? 2),
    safety_stock: parseInt(p.safetyStock ?? 30, 10),
    target_stock: parseInt(p.targetStock ?? 150, 10),
    moq: parseInt(p.moq ?? 24, 10),
    cost_price: Number(p.costPrice ?? 0),
    selling_price: Number(p.unitPrice ?? 0),
    status_note: Calculations.evaluateRiskStatus(p),
    updated_at: nowIso
  };
}

function toSupplierRow(s, nowIso = new Date().toISOString()) {
  return {
    id: s.id,
    name: s.name,
    category: s.category || 'Multi-Category FMCG',
    lead_time_days: Number(s.leadTimeDays ?? 2),
    reliability_score: Number(s.reliabilityScore ?? 97),
    defect_rate: Number(s.defectRate ?? 0.2),
    on_time_delivery_pct: Number(s.onTimeDelivery ?? 96),
    moq: parseInt(s.defaultMoq ?? 100, 10),
    contact_email: s.contact || '',
    updated_at: nowIso
  };
}

function toMovementRow(sku, productName, storeHub, mov, nowIso = new Date().toISOString()) {
  const rawId = mov.id || `MOV-${sku}-${Date.now()}`;
  return {
    id: String(rawId).replace(/[^a-zA-Z0-9_-]/g, '_'),
    sku,
    product_name: productName || sku,
    store_hub: storeHub || 'BLR_NORTH_DC',
    movement_type: mov.type || 'STOCK_ADJUSTMENT',
    quantity_delta: parseInt(mov.qty ?? 0, 10),
    reason: [mov.ref, mov.date].filter(Boolean).join(' · '),
    actor_name: mov.user || 'System',
    created_at: mov.createdAt || nowIso
  };
}

function toPurchaseOrderRow(po) {
  return {
    id: po.id,
    po_number: po.id,
    sku: po.sku,
    product_name: po.productName || po.sku,
    supplier_id: po.supplierId || null,
    supplier_name: po.supplier || 'Verified Distributor',
    store_hub: po.hub || 'BLR_NORTH_DC',
    order_qty: parseInt(po.qty ?? 0, 10),
    unit_cost: Number(po.unitCost ?? 0),
    total_cost: Number(po.totalCost ?? 0),
    status: po.status || 'APPROVED',
    rationale: po.rationale || '',
    approved_by: po.approvedBy || po.createdBy || 'Operator',
    expected_arrival_at: po.expectedArrivalAt || null,
    created_at: po.createdAt || new Date().toISOString()
  };
}

function toSalesRows(product) {
  if (!product || !Array.isArray(product.salesHistory)) return [];
  const unitPrice = Number(product.unitPrice || 0);
  return product.salesHistory
    .filter((h) => h && typeof h === 'object' && h.date)
    .map((h) => {
      const units = Number(h.quantity ?? h.units_sold ?? 0);
      return {
        id: `${product.sku}__${h.date}`,
        sku: product.sku,
        store_hub: product.hub || 'BLR_NORTH_DC',
        sale_date: h.date,
        units_sold: units,
        revenue: Math.round(units * unitPrice),
        source: 'POS_STREAM'
      };
    });
}

function toIngestionRow(batch, actorName = 'System') {
  return {
    id: batch.batchId,
    batch_id: batch.batchId,
    source_name: batch.fileName,
    records_parsed: parseInt(batch.imported ?? 0, 10),
    duplicates_skipped: parseInt(batch.duplicates ?? 0, 10),
    validation_status: batch.status || 'COMPLETED',
    summary_note: `Total rows: ${parseInt(batch.totalRecords ?? batch.imported ?? 0, 10)} · Invalid: ${parseInt(batch.invalidRows ?? 0, 10)}`,
    ingested_by: actorName,
    ingested_at: batch.ingestedAt || new Date().toISOString()
  };
}

function toForecastRow(run) {
  return {
    id: run.id,
    sku: run.sku,
    product_name: run.productName || run.sku,
    horizon_days: parseInt(run.horizonDays || 30, 10),
    promo_boost_pct: Math.round(Number(run.promoBoost || 0) * 100),
    winning_model: run.selectedModelName || run.selectedModel || 'AUTO',
    mae: Number(run.mae || 0),
    rmse: Number(run.rmse || 0),
    wape_pct: Number(run.wape || 0),
    projected_total_units: Math.round(Number(run.projected30d || 0)),
    run_by: run.runBy || 'Operator',
    created_at: run.createdAt || new Date().toISOString()
  };
}

async function upsertSupabaseRows(table, rows, onConflict = 'id') {
  const list = Array.isArray(rows) ? rows.filter(Boolean) : [];
  if (list.length === 0) return { configured: true, ok: true, outcome: 'CONFIRMED_SUCCESS', table, count: 0 };
  let totalCount = 0;
  let lastRes = null;
  for (let i = 0; i < list.length; i += 200) {
    const chunk = list.slice(i, i + 200);
    lastRes = await callSupabaseGatewayIfConfigured({
      action: 'upsert',
      table,
      onConflict,
      rows: chunk
    });
    if (!lastRes.configured || lastRes.outcome !== 'CONFIRMED_SUCCESS') {
      return { ...lastRes, table, count: totalCount };
    }
    const gBody = lastRes.gatewayBody;
    totalCount += gBody && typeof gBody.count === 'number' ? gBody.count : chunk.length;
  }
  return { configured: true, ok: true, outcome: 'CONFIRMED_SUCCESS', table, count: totalCount };
}

async function deleteSupabaseRows(table, match) {
  return callSupabaseGatewayIfConfigured({ action: 'delete', table, match });
}

async function syncAllOperationalTables(state, actorName = 'System') {
  const nowIso = new Date().toISOString();
  const apResult = AprioriEngine.runApriori(SeedData.buildSampleBasketsForApriori(), {
    minSupport: 0.02,
    minConfidence: 0.25
  });
  const aprioriRows = (apResult.rules || []).map((rule) => ({
    id: `APR-${rule.antecedent}-${rule.consequent}`.replace(/[^a-zA-Z0-9_-]/g, '_'),
    antecedent: `${rule.antecedentName} (${rule.antecedent})`,
    consequent: `${rule.consequentName} (${rule.consequent})`,
    support_pct: Number(rule.support ?? 0),
    confidence_pct: Number(rule.confidence ?? 0),
    lift: Number(rule.lift ?? 1),
    bundle_strength: rule.strength || 'MODERATE',
    recommendation: `${rule.coPurchases || 0} co-purchases detected`,
    min_support_threshold: 0.02,
    min_confidence_threshold: 0.25,
    updated_at: nowIso
  }));

  const movementRows = [];
  const salesRows = [];
  (state.products || []).forEach((p) => {
    (p.movements || []).forEach((m) => movementRows.push(toMovementRow(p.sku, p.name, p.hub, m, nowIso)));
    // Sync full sales history rows per SKU
    salesRows.push(...toSalesRows(p));
  });

  const userRows = loadUsers().map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    store_hub: u.storeAccess,
    permissions: Array.isArray(u.permissions) ? u.permissions : (ROLE_PERMISSIONS[u.role] || []),
    password_hash_placeholder: '[SCRYPT_SERVER_SIDE]',
    created_at: u.createdAt || nowIso,
    updated_at: nowIso
  }));

  const tasks = [
    ['pallets_users', userRows, 'email'],
    ['pallets_suppliers', (state.suppliers || []).map((s) => toSupplierRow(s, nowIso)), 'id'],
    ['pallets_products', (state.products || []).map((p) => toProductRow(p, nowIso)), 'sku'],
    ['pallets_sales_history', salesRows, 'id'],
    ['pallets_inventory_movements', movementRows, 'id'],
    ['pallets_ingestion_logs', (state.ingestionLogs || []).map((b) => toIngestionRow(b, actorName)), 'id'],
    ['pallets_purchase_orders', (state.purchaseOrders || []).map((po) => toPurchaseOrderRow(po)), 'po_number'],
    ['pallets_forecast_runs', (state.forecastRuns || []).map((r) => toForecastRow(r)), 'id'],
    ['pallets_apriori_rules', aprioriRows, 'id']
  ];

  const tableResults = [];
  for (const [table, rows, conflictCol] of tasks) {
    const res = await upsertSupabaseRows(table, rows, conflictCol);
    tableResults.push({
      table,
      rowsSent: rows.length,
      outcome: res.outcome || 'UNCONFIGURED',
      count: res.count ?? 0,
      error: res.error || null
    });
  }
  return tableResults;
}

function getClientIp(req) {
  return req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
}

function checkIdempotency(state, scopeKey, idemKey) {
  if (!idemKey) return null;
  const fullKey = `${scopeKey}:${idemKey}`;
  return state.idempotencyCache[fullKey] || null;
}

function recordIdempotency(state, scopeKey, idemKey, responseBody, statusCode) {
  if (!idemKey) return;
  const fullKey = `${scopeKey}:${idemKey}`;
  state.idempotencyCache[fullKey] = {
    statusCode,
    responseBody,
    recordedAt: new Date().toISOString()
  };
  const keys = Object.keys(state.idempotencyCache);
  if (keys.length > 500) {
    delete state.idempotencyCache[keys[0]];
  }
}

function projectStateForUser(state, user) {
  const isStaff = user.role === 'Staff';
  const assignedHub = user.storeAccess;
  const products = isStaff
    ? state.products
        .filter((p) => p.hub === assignedHub)
        .map((p) => ({ ...p }))
    : state.products.map((p) => ({ ...p }));

  const purchaseOrders = isStaff
    ? state.purchaseOrders.filter((po) => po.hub === assignedHub)
    : state.purchaseOrders;

  const activityLogs = isStaff
    ? state.activityLogs.filter((act) => act.hub === assignedHub)
    : state.activityLogs;

  const ingestionLogs = isStaff ? state.ingestionLogs.slice(0, 5) : state.ingestionLogs;
  const forecastRuns = isStaff ? [] : state.forecastRuns;

  return {
    hubs: isStaff ? Calculations.HUBS.filter((h) => h.id === assignedHub) : Calculations.HUBS,
    products,
    suppliers: state.suppliers,
    purchaseOrders,
    ingestionLogs,
    forecastRuns,
    activityLogs
  };
}

function isStaticPathBlocked(urlPath) {
  const normalized = urlPath.replace(/\\/g, '/').toLowerCase();
  if (
    normalized.includes('..') ||
    normalized.startsWith('/.') ||
    normalized.startsWith('/.data') ||
    normalized.startsWith('/.secrets') ||
    normalized.startsWith('/scripts') ||
    normalized === '/server.js' ||
    normalized === '/webhooks-config.json' ||
    normalized === '/package.json' ||
    normalized === '/supabase-schema.sql' ||
    normalized === '/readme.md'
  ) {
    return true;
  }
  return false;
}

function serveStaticFile(req, res, urlPath) {
  let cleanPath;
  try {
    cleanPath = decodeURIComponent(urlPath.split('?')[0]);
  } catch (err) {
    sendJson(res, 400, { error: 'Malformed request path.' });
    return;
  }
  if (cleanPath === '/') cleanPath = '/index.html';
  if (isStaticPathBlocked(cleanPath)) {
    sendJson(res, 403, { error: 'Access denied.' });
    return;
  }

  const targetPath = path.resolve(BASE_DIR, `.${cleanPath}`);
  if (!targetPath.startsWith(BASE_DIR + path.sep) && targetPath !== path.join(BASE_DIR, 'index.html')) {
    sendJson(res, 403, { error: 'Invalid path.' });
    return;
  }

  fs.stat(targetPath, (statErr, stats) => {
    if (statErr || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(targetPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const headers = {
      'Content-Type': contentType,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=300',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin'
    };

    const acceptEncoding = String(req.headers['accept-encoding'] || '');
    const compressible = ext === '.html' || ext === '.js' || ext === '.css' || ext === '.svg';

    fs.readFile(targetPath, (readErr, content) => {
      if (readErr) {
        res.writeHead(500);
        res.end('Internal Error');
        return;
      }
      if (compressible && acceptEncoding.includes('gzip')) {
        headers['Content-Encoding'] = 'gzip';
        res.writeHead(200, headers);
        zlib.gzip(content, (zErr, gz) => {
          if (zErr) res.end(content);
          else res.end(gz);
        });
      } else {
        res.writeHead(200, headers);
        res.end(content);
      }
    });
  });
}

async function handleApi(req, res, pathname) {
  if (req.method === 'OPTIONS') {
    const origin = (req.headers && req.headers.origin) ? req.headers.origin : '*';
    res.writeHead(204, {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept, X-Requested-With',
      'Access-Control-Max-Age': '86400',
      'Content-Length': '0'
    });
    return res.end();
  }

  if (req.method === 'GET' && pathname === '/api/health') {
    return sendJson(res, 200, { ok: true, service: 'pallets-v3', uptimeSec: Math.round(process.uptime()) });
  }

  // ---------------- AUTH ROUTES ----------------
  if (req.method === 'GET' && pathname === '/api/auth/bootstrap-status') {
    const users = loadUsers();
    return sendJson(res, 200, { needsAdminBootstrap: !hasAnyAdmin(users) });
  }

  if (req.method === 'GET' && pathname === '/api/auth/session') {
    const users = loadUsers();
    const needsAdminBootstrap = !hasAnyAdmin(users);
    const auth = authenticateRequest(req);
    if (!auth) {
      return sendJson(res, 200, { authenticated: false, user: null, needsAdminBootstrap });
    }
    return sendJson(res, 200, { authenticated: true, user: sanitizeUser(auth.user), needsAdminBootstrap });
  }

  if (req.method === 'POST' && pathname === '/api/auth/bootstrap-admin') {
    const users = loadUsers();
    if (hasAnyAdmin(users) || !bootstrapTokenHash) {
      return sendJson(res, 403, { error: 'Admin bootstrap is permanently locked because an Admin account already exists.' });
    }
    const body = await parseJsonBody(req);
    const bootstrapToken = String(body.bootstrapToken || '').trim();
    const incomingHash = sha256Hex(bootstrapToken);
    if (!bootstrapToken || !constantTimeEquals(incomingHash, bootstrapTokenHash)) {
      appendAuditLog({ event: 'ADMIN_BOOTSTRAP_DENIED', ip: getClientIp(req), detail: 'Invalid one-time bootstrap token.' });
      return sendJson(res, 403, { error: 'Invalid one-time server bootstrap token.' });
    }

    const name = String(body.name || '').trim();
    const email = normalizeEmail(body.email);
    const pwErr = validatePasswordStrength(body.password);
    if (name.length < 2) return sendJson(res, 400, { error: 'Full name is required (at least 2 characters).' });
    if (!isValidEmail(email)) return sendJson(res, 400, { error: 'Please provide a valid work email address.' });
    if (pwErr) return sendJson(res, 400, { error: pwErr });
    if (users.some((u) => normalizeEmail(u.email) === email)) {
      return sendJson(res, 409, { error: 'An account with this email already exists.' });
    }

    const nowIso = new Date().toISOString();
    const adminUser = {
      id: 'USR-' + crypto.randomBytes(5).toString('hex').toUpperCase(),
      name,
      email,
      passwordHash: hashPassword(body.password),
      role: 'Admin',
      storeAccess: 'ALL',
      permissions: ROLE_PERMISSIONS.Admin,
      status: 'ACTIVE',
      tokenVersion: 1,
      createdAt: nowIso,
      lastLoginAt: nowIso
    };
    users.push(adminUser);
    saveUsers(users);
    bootstrapTokenHash = null;

    const syncResult = await syncUserToSupabase(adminUser, {
      mode: 'INSERT',
      reason: 'ADMIN_BOOTSTRAP'
    });
    adminUser.lastSupabaseSync = syncResult;
    saveUsers(users);

    appendAuditLog({
      event: 'ADMIN_BOOTSTRAP_COMPLETED',
      actorEmail: email,
      actorRole: 'Admin',
      ip: getClientIp(req),
      detail: `Initial Admin bootstrapped and one-time token retired; WF-AUTH-SUPABASE=${syncResult.authWebhookOutcome}.`
    });

    const token = signSessionToken(adminUser);
    return sendJson(
      res,
      201,
      {
        ok: true,
        user: sanitizeUser(adminUser),
        needsAdminBootstrap: false,
        authWebhookOutcome: syncResult.authWebhookOutcome,
        supabaseSync: syncResult
      },
      { 'Set-Cookie': buildSessionCookieHeader(token, req, SESSION_TTL_MS / 1000) }
    );
  }

  if (req.method === 'POST' && pathname === '/api/auth/register') {
    const body = await parseJsonBody(req);

    // Block ANY attempt to spoof role, permissions, or store-wide admin access on public signup
    if (
      body.role !== undefined &&
      String(body.role).trim() !== '' &&
      String(body.role).trim() !== 'Staff'
    ) {
      appendAuditLog({
        event: 'PRIVILEGE_ESCALATION_BLOCKED',
        email: normalizeEmail(body.email),
        ip: getClientIp(req),
        detail: `Rejected public registration attempting role="${body.role}".`
      });
      return sendJson(res, 403, { error: 'Forbidden: public registration is restricted strictly to Staff accounts.' });
    }
    if (body.permissions !== undefined || body.isAdmin === true) {
      appendAuditLog({
        event: 'PRIVILEGE_ESCALATION_BLOCKED',
        email: normalizeEmail(body.email),
        ip: getClientIp(req),
        detail: 'Rejected public registration supplying permissions or isAdmin.'
      });
      return sendJson(res, 403, { error: 'Forbidden: permissions cannot be chosen during registration.' });
    }

    const name = String(body.name || '').trim();
    const email = normalizeEmail(body.email);
    const pwErr = validatePasswordStrength(body.password);
    const requestedHub = String(body.storeAccess || body.hub || 'BLR_NORTH_DC').trim();

    if (name.length < 2) return sendJson(res, 400, { error: 'Full name must be at least 2 characters.' });
    if (!isValidEmail(email)) return sendJson(res, 400, { error: 'Valid email address is required.' });
    if (pwErr) return sendJson(res, 400, { error: pwErr });
    if (requestedHub === 'ALL' || !VALID_HUB_IDS.has(requestedHub)) {
      return sendJson(res, 400, { error: 'Assigned dark store hub must be a valid facility ID.' });
    }

    if (registrationInFlight.has(email)) {
      return sendJson(res, 409, { error: 'Duplicate concurrent registration rejected for this email.' });
    }

    registrationInFlight.add(email);
    try {
      const existingUsers = loadUsers();
      if (existingUsers.some((u) => normalizeEmail(u.email) === email)) {
        return sendJson(res, 409, { error: 'An account with this email is already registered.' });
      }

      // Optional remote uniqueness check via preserved WF-SUPABASE-SYNC (if configured)
      const remoteCheck = await callSupabaseGatewayIfConfigured({
        action: 'select',
        table: 'pallets_users',
        select: 'email',
        filters: [{ col: 'email', op: 'eq', val: email }],
        limit: 1
      });
      const gatewayRows = remoteCheck.gatewayBody && Array.isArray(remoteCheck.gatewayBody.data)
        ? remoteCheck.gatewayBody.data
        : (remoteCheck.data && Array.isArray(remoteCheck.data.data) ? remoteCheck.data.data : []);
      if (remoteCheck.configured && remoteCheck.ok && gatewayRows.length > 0) {
        return sendJson(res, 409, { error: 'Email already exists in remote Supabase directory.' });
      }

      // Re-verify locally after async remote check
      const freshUsers = loadUsers();
      if (freshUsers.some((u) => normalizeEmail(u.email) === email)) {
        return sendJson(res, 409, { error: 'An account with this email is already registered.' });
      }

      const nowIso = new Date().toISOString();
      const newUser = {
        id: 'USR-' + crypto.randomBytes(5).toString('hex').toUpperCase(),
        name,
        email,
        passwordHash: hashPassword(body.password),
        role: 'Staff',
        storeAccess: requestedHub,
        permissions: ROLE_PERMISSIONS.Staff,
        status: 'ACTIVE',
        tokenVersion: 1,
        createdAt: nowIso,
        lastLoginAt: nowIso
      };

      freshUsers.push(newUser);
      saveUsers(freshUsers);

      // Sync sanitized non-secret operator profile to Supabase via WF-AUTH-SUPABASE / WF-SUPABASE-SYNC
      const syncResult = await syncUserToSupabase(newUser, {
        mode: 'INSERT',
        reason: 'PUBLIC_SELF_SIGNUP_V3'
      });
      const updatedUsers = loadUsers();
      const savedIdx = updatedUsers.findIndex((u) => u.id === newUser.id);
      if (savedIdx >= 0) {
        updatedUsers[savedIdx].lastSupabaseSync = syncResult;
        saveUsers(updatedUsers);
        newUser.lastSupabaseSync = syncResult;
      }

      appendAuditLog({
        event: 'USER_REGISTERED',
        actorEmail: newUser.email,
        actorRole: 'Staff',
        hub: newUser.storeAccess,
        ip: getClientIp(req),
        detail: `Public Staff registration (${newUser.storeAccess}); WF-AUTH-SUPABASE=${syncResult.authWebhookOutcome}`
      });

      const token = signSessionToken(newUser);
      return sendJson(
        res,
        201,
        {
          ok: true,
          user: sanitizeUser(newUser),
          authWebhookOutcome: syncResult.authWebhookOutcome,
          supabaseSync: syncResult
        },
        { 'Set-Cookie': buildSessionCookieHeader(token, req, SESSION_TTL_MS / 1000) }
      );
    } finally {
      registrationInFlight.delete(email);
    }
  }

  if (req.method === 'POST' && pathname === '/api/auth/login') {
    const body = await parseJsonBody(req);
    const email = normalizeEmail(body.email);
    const password = String(body.password || '');
    if (!email || !password) {
      return sendJson(res, 400, { error: 'Email and password are required.' });
    }
    const users = loadUsers();
    const user = users.find((u) => normalizeEmail(u.email) === email);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      appendAuditLog({
        event: 'LOGIN_FAILED',
        email,
        ip: getClientIp(req),
        detail: 'Invalid email or password.'
      });
      return sendJson(res, 401, { error: 'Invalid email or password.' });
    }
    if (user.status === 'DISABLED') {
      appendAuditLog({
        event: 'LOGIN_BLOCKED_DISABLED',
        actorEmail: user.email,
        ip: getClientIp(req),
        detail: 'Disabled account attempted login.'
      });
      return sendJson(res, 403, { error: 'This account has been disabled by an Administrator.' });
    }

    user.lastLoginAt = new Date().toISOString();
    saveUsers(users);
    appendAuditLog({
      event: 'LOGIN_SUCCESS',
      actorEmail: user.email,
      actorRole: user.role,
      ip: getClientIp(req),
      detail: 'Authenticated via scrypt + signed HttpOnly session cookie.'
    });

    const token = signSessionToken(user);
    return sendJson(
      res,
      200,
      { ok: true, user: sanitizeUser(user) },
      { 'Set-Cookie': buildSessionCookieHeader(token, req, SESSION_TTL_MS / 1000) }
    );
  }

  if (req.method === 'POST' && pathname === '/api/auth/logout') {
    const auth = authenticateRequest(req);
    if (auth && auth.tokenPayload && auth.tokenPayload.jti) {
      revokedJtis.add(auth.tokenPayload.jti);
      appendAuditLog({
        event: 'LOGOUT',
        actorEmail: auth.user.email,
        actorRole: auth.user.role,
        ip: getClientIp(req),
        detail: 'Session token revoked cleanly.'
      });
    }
    return sendJson(
      res,
      200,
      { ok: true },
      { 'Set-Cookie': buildSessionCookieHeader('', req, 0) }
    );
  }

  if (
    (req.method === 'POST' || req.method === 'PATCH') &&
    (pathname === '/api/auth/switch-role' || pathname === '/api/auth/role' || pathname === '/api/users/me/role')
  ) {
    const auth = authenticateRequest(req);
    appendAuditLog({
      event: 'SELF_ROLE_CHANGE_BLOCKED',
      actorEmail: auth ? auth.user.email : 'anonymous',
      ip: getClientIp(req),
      detail: `Blocked self role modification attempt at ${pathname}.`
    });
    return sendJson(res, 403, { error: 'Forbidden: users cannot modify their own role or permissions.' });
  }

  // ---------------- ADMIN ROUTES ----------------
  if (req.method === 'GET' && pathname === '/api/admin/users') {
    const auth = requireRoles(req, res, ['Admin']);
    if (!auth) return;
    return sendJson(res, 200, { users: loadUsers().map(sanitizeUser) });
  }

  if (req.method === 'POST' && pathname === '/api/admin/users') {
    const auth = requireRoles(req, res, ['Admin']);
    if (!auth) return;
    const body = await parseJsonBody(req);
    const name = String(body.name || '').trim();
    const email = normalizeEmail(body.email);
    const role = String(body.role || 'Staff').trim();
    const pwErr = validatePasswordStrength(body.password);
    const storeAccess = role === 'Admin'
      ? 'ALL'
      : String(body.storeAccess || (role === 'Inventory Manager' ? 'ALL' : 'BLR_NORTH_DC')).trim();

    if (name.length < 2) return sendJson(res, 400, { error: 'Name is required.' });
    if (!isValidEmail(email)) return sendJson(res, 400, { error: 'Valid email is required.' });
    if (!VALID_ROLES.has(role)) return sendJson(res, 400, { error: 'Invalid role.' });
    if (pwErr) return sendJson(res, 400, { error: pwErr });
    if (storeAccess !== 'ALL' && !VALID_HUB_IDS.has(storeAccess)) {
      return sendJson(res, 400, { error: 'Invalid hub assignment.' });
    }
    if (role === 'Staff' && storeAccess === 'ALL') {
      return sendJson(res, 400, { error: 'Staff must be assigned to a specific dark store hub.' });
    }

    const users = loadUsers();
    if (users.some((u) => normalizeEmail(u.email) === email)) {
      return sendJson(res, 409, { error: 'An account with this email already exists.' });
    }

    const created = {
      id: 'USR-' + crypto.randomBytes(5).toString('hex').toUpperCase(),
      name,
      email,
      passwordHash: hashPassword(body.password),
      role,
      storeAccess,
      permissions: ROLE_PERMISSIONS[role],
      status: 'ACTIVE',
      tokenVersion: 1,
      createdAt: new Date().toISOString(),
      lastLoginAt: null
    };
    users.push(created);
    saveUsers(users);

    const syncResult = await syncUserToSupabase(created, {
      mode: 'INSERT',
      reason: 'ADMIN_CREATED_USER'
    });
    created.lastSupabaseSync = syncResult;
    saveUsers(users);

    appendAuditLog({
      event: 'ADMIN_CREATED_USER',
      actorEmail: auth.user.email,
      targetEmail: created.email,
      detail: `Created ${role} (${storeAccess}); WF-AUTH-SUPABASE=${syncResult.authWebhookOutcome}.`
    });
    return sendJson(res, 201, {
      ok: true,
      user: sanitizeUser(created),
      authWebhookOutcome: syncResult.authWebhookOutcome,
      supabaseSync: syncResult
    });
  }

  if (req.method === 'POST' && pathname === '/api/admin/users/sync-supabase') {
    const auth = requireRoles(req, res, ['Admin']);
    if (!auth) return;
    const users = loadUsers();
    const results = [];
    for (const userObj of users) {
      const syncResult = await syncUserToSupabase(userObj, {
        mode: 'UPSERT',
        reason: 'ADMIN_MANUAL_BULK_SYNC'
      });
      userObj.lastSupabaseSync = syncResult;
      results.push({
        id: userObj.id,
        email: userObj.email,
        role: userObj.role,
        outcome: syncResult.outcome,
        authWebhookOutcome: syncResult.authWebhookOutcome,
        gatewayOutcome: syncResult.gatewayOutcome,
        httpStatus: syncResult.httpStatus,
        error: syncResult.error
      });
    }
    saveUsers(users);

    const confirmedCount = results.filter((r) => r.outcome === 'CONFIRMED_SUCCESS').length;
    const failedCount = results.filter((r) => r.outcome !== 'CONFIRMED_SUCCESS').length;

    appendAuditLog({
      event: 'ADMIN_BULK_USER_SUPABASE_SYNC',
      actorEmail: auth.user.email,
      detail: `Synced ${users.length} users -> confirmed=${confirmedCount}, nonConfirmed=${failedCount}.`
    });

    return sendJson(res, 200, {
      ok: failedCount === 0,
      total: users.length,
      confirmedCount,
      failedCount,
      results,
      users: users.map(sanitizeUser)
    });
  }

  if (req.method === 'POST' && pathname === '/api/admin/supabase/sync-all') {
    const auth = requireRoles(req, res, ['Admin']);
    if (!auth) return;
    const state = loadOrInitState();
    const tableResults = await syncAllOperationalTables(state, auth.user.name);
    const failedTables = tableResults.filter((t) => t.outcome !== 'CONFIRMED_SUCCESS');
    const totalRowsSynced = tableResults.reduce((acc, t) => acc + (t.outcome === 'CONFIRMED_SUCCESS' ? Number(t.count || t.rowsSent || 0) : 0), 0);

    appendAuditLog({
      event: 'ADMIN_FULL_SUPABASE_SYNC',
      actorEmail: auth.user.email,
      detail: `Full 9-dataset sync completed: okTables=${tableResults.length - failedTables.length}/${tableResults.length}, rows=${totalRowsSynced}.`
    });

    return sendJson(res, 200, {
      ok: failedTables.length === 0,
      totalRowsSynced,
      tableResults
    });
  }

  if (req.method === 'PATCH' && pathname.startsWith('/api/admin/users/')) {
    const auth = requireRoles(req, res, ['Admin']);
    if (!auth) return;
    const targetId = decodeURIComponent(pathname.slice('/api/admin/users/'.length));
    const body = await parseJsonBody(req);
    const users = loadUsers();
    const target = users.find((u) => u.id === targetId);
    if (!target) return sendJson(res, 404, { error: 'User not found.' });

    const nextRole = body.role !== undefined ? String(body.role).trim() : target.role;
    const nextStatus = body.status !== undefined ? String(body.status).trim() : target.status;
    if (!VALID_ROLES.has(nextRole)) return sendJson(res, 400, { error: 'Invalid role specified.' });
    if (!['ACTIVE', 'DISABLED'].includes(nextStatus)) return sendJson(res, 400, { error: 'Invalid status.' });

    const activeAdmins = users.filter((u) => u.role === 'Admin' && u.status !== 'DISABLED');
    const isDemotingOrDisablingLastAdmin =
      target.role === 'Admin' &&
      target.status !== 'DISABLED' &&
      activeAdmins.length <= 1 &&
      (nextRole !== 'Admin' || nextStatus === 'DISABLED');

    if (isDemotingOrDisablingLastAdmin) {
      return sendJson(res, 400, { error: 'Cannot demote or disable the last active Administrator.' });
    }

    const nextStore = body.storeAccess !== undefined ? String(body.storeAccess).trim() : target.storeAccess;
    if (nextRole === 'Staff' && !VALID_HUB_IDS.has(nextStore)) {
      return sendJson(res, 400, { error: 'Staff accounts must have a valid single dark store hub.' });
    }
    if (nextStore !== 'ALL' && !VALID_HUB_IDS.has(nextStore)) {
      return sendJson(res, 400, { error: 'Invalid dark store hub.' });
    }

    target.role = nextRole;
    target.permissions = ROLE_PERMISSIONS[nextRole];
    target.storeAccess = nextRole === 'Admin' ? 'ALL' : nextStore;
    target.status = nextStatus;
    if (body.name && String(body.name).trim().length >= 2) target.name = String(body.name).trim();
    target.tokenVersion = Number(target.tokenVersion || 1) + 1;

    saveUsers(users);
    const syncResult = await syncUserToSupabase(target, {
      mode: 'UPDATE',
      reason: 'ADMIN_UPDATED_USER'
    });
    target.lastSupabaseSync = syncResult;
    saveUsers(users);

    appendAuditLog({
      event: 'ADMIN_UPDATED_USER',
      actorEmail: auth.user.email,
      targetEmail: target.email,
      detail: `Updated user -> role=${target.role}, hub=${target.storeAccess}, status=${target.status}; WF-AUTH-SUPABASE=${syncResult.authWebhookOutcome}.`
    });
    return sendJson(res, 200, {
      ok: true,
      user: sanitizeUser(target),
      authWebhookOutcome: syncResult.authWebhookOutcome,
      supabaseSync: syncResult
    });
  }

  if (req.method === 'GET' && pathname === '/api/admin/audit-logs') {
    const auth = requireRoles(req, res, ['Admin']);
    if (!auth) return;
    return sendJson(res, 200, { logs: loadAuditLogs().slice(0, 200) });
  }

  if (req.method === 'GET' && pathname === '/api/workflows/config') {
    const auth = requireRoles(req, res, ['Admin']);
    if (!auth) return;
    return sendJson(res, 200, { urls: loadWebhooksConfig() });
  }

  if (req.method === 'POST' && pathname === '/api/workflows/config') {
    const auth = requireRoles(req, res, ['Admin']);
    if (!auth) return;
    const body = await parseJsonBody(req);
    const current = loadWebhooksConfig();
    const updated = { ...current };
    for (const key of Object.keys(PRESERVED_WORKFLOWS)) {
      if (body[key] !== undefined) {
        const val = String(body[key] || '').trim();
        if (val !== '') {
          let parsedUrl;
          try {
            parsedUrl = new URL(val);
          } catch (e) {
            return sendJson(res, 400, { error: `Invalid URL for workflow "${key}".` });
          }
          if (!['https:', 'http:'].includes(parsedUrl.protocol)) {
            return sendJson(res, 400, { error: `Workflow "${key}" must use HTTP or HTTPS.` });
          }
        }
        updated[key] = val;
      }
    }
    saveWebhooksConfig(updated);
    appendAuditLog({
      event: 'WORKFLOW_CONFIG_UPDATED',
      actorEmail: auth.user.email,
      detail: 'Updated SNS Workbench webhook configuration.'
    });
    return sendJson(res, 200, { ok: true, urls: updated });
  }

  // ---------------- WORKFLOW STATUS & SNS PROXY ----------------
  if (req.method === 'GET' && pathname === '/api/workflows/status') {
    const auth = requireAuth(req, res);
    if (!auth) return;
    const webhooks = loadWebhooksConfig();
    const isAdmin = auth.user.role === 'Admin';
    const workflows = {};
    Object.keys(PRESERVED_WORKFLOWS).forEach((k) => {
      const def = PRESERVED_WORKFLOWS[k];
      const url = String(webhooks[k] || '').trim();
      const cached = workflowHealthCache[k] || {};
      const entry = {
        id: def.id,
        name: def.name,
        description: def.description,
        interactsWith: def.interactsWith,
        configured: Boolean(url),
        healthStatus: url ? (cached.healthStatus || 'READY') : 'UNCONFIGURED',
        lastLatencyMs: cached.lastLatencyMs ?? null,
        lastCheckedAt: cached.lastCheckedAt || null
      };
      if (isAdmin) entry.url = url;
      workflows[k] = entry;
    });
    return sendJson(res, 200, { workflows });
  }

  if (req.method === 'POST' && pathname === '/api/sns-proxy') {
    const auth = requireAuth(req, res);
    if (!auth) return;
    const body = await parseJsonBody(req);
    const featureKey = String(body.featureKey || 'master').trim();
    if (!PRESERVED_WORKFLOWS[featureKey]) {
      return sendJson(res, 400, { error: `Unknown workflow featureKey "${featureKey}".` });
    }

    // Strict RBAC on webhook feature triggers
    if (auth.user.role === 'Staff') {
      const staffAllowed = new Set(['copilot', 'risks', 'supabaseSync']);
      if (!staffAllowed.has(featureKey)) {
        return sendJson(res, 403, { error: `Forbidden: Staff role cannot dispatch "${featureKey}" workflow.` });
      }
      if (featureKey === 'supabaseSync') {
        const inner = body.payload && body.payload.data ? body.payload.data : body.payload;
        const action = inner && inner.action;
        if (!['health', 'select'].includes(action)) {
          return sendJson(res, 403, { error: 'Forbidden: Staff cannot perform direct remote Supabase writes.' });
        }
      }
    }

    const webhooks = loadWebhooksConfig();
    const targetUrl = String(webhooks[featureKey] || '').trim();
    const wfMeta = PRESERVED_WORKFLOWS[featureKey];

    if (!targetUrl) {
      workflowHealthCache[featureKey] = {
        healthStatus: 'UNCONFIGURED',
        lastLatencyMs: 0,
        lastCheckedAt: new Date().toISOString()
      };
      return sendJson(res, 503, {
        ok: false,
        outcome: 'UNCONFIGURED',
        httpStatus: 0,
        latencyMs: 0,
        workflowId: wfMeta.id,
        data: null,
        error: `Workflow ${wfMeta.id} (${wfMeta.name}) endpoint URL is not configured.`
      });
    }

    let forwardBody = body.payload || {};
    if (body.isRawBody && forwardBody && forwardBody.source === 'PALLETS_ENTERPRISE_WEBAPP' && forwardBody.data) {
      forwardBody = forwardBody.data;
    }

    const result = await forwardJsonPost(targetUrl, forwardBody, 25000);
    workflowHealthCache[featureKey] = {
      healthStatus: result.outcome === 'CONFIRMED_SUCCESS' ? 'ONLINE' : result.outcome,
      lastLatencyMs: result.latencyMs,
      lastCheckedAt: new Date().toISOString()
    };

    const httpCode = result.outcome === 'CONFIRMED_SUCCESS'
      ? 200
      : (result.outcome === 'UNKNOWN_TIMEOUT' ? 504 : 502);

    return sendJson(res, httpCode, {
      ok: result.ok,
      outcome: result.outcome,
      httpStatus: result.httpStatus,
      latencyMs: result.latencyMs,
      workflowId: wfMeta.id,
      data: result.data,
      error: result.error
    });
  }

  // ---------------- OPERATIONAL STATE & ACTIONS ----------------
  if (req.method === 'GET' && pathname === '/api/ops/state') {
    const auth = requireAuth(req, res);
    if (!auth) return;
    const state = loadOrInitState();
    return sendJson(res, 200, {
      user: sanitizeUser(auth.user),
      ...projectStateForUser(state, auth.user)
    });
  }

  if (req.method === 'POST' && pathname === '/api/ops/products') {
    const auth = requireRoles(req, res, ['Admin', 'Inventory Manager']);
    if (!auth) return;
    const body = await parseJsonBody(req);
    const sku = String(body.sku || '').trim().toUpperCase();
    const name = String(body.name || '').trim();
    const category = String(body.category || '').trim();
    const brand = String(body.brand || 'Private Label').trim();
    const hub = String(body.hub || 'BLR_NORTH_DC').trim();
    const unitPrice = Number(body.unitPrice);
    const costPrice = Number(body.costPrice);
    const onHand = Math.max(0, Number(body.onHand || 0));
    const reserved = Math.max(0, Number(body.reserved || 0));
    const onOrder = Math.max(0, Number(body.onOrder || 0));
    const dailyDemand = Math.max(1, Number(body.dailyDemand || 10));
    const leadTimeDays = Math.max(1, Number(body.leadTimeDays || 3));
    const safetyStock = Math.max(0, Number(body.safetyStock || 50));
    const targetStock = Math.max(safetyStock, Number(body.targetStock || 300));
    const moq = Math.max(1, Number(body.moq || 50));
    const supplier = String(body.supplier || 'Metro FMCG Distributors').trim();

    if (!sku || !name || !category || !VALID_HUB_IDS.has(hub)) {
      return sendJson(res, 400, { error: 'SKU, name, category, and valid hub are required.' });
    }
    if (!Number.isFinite(unitPrice) || unitPrice <= 0 || !Number.isFinite(costPrice) || costPrice < 0) {
      return sendJson(res, 400, { error: 'Valid unitPrice (> 0) and costPrice (>= 0) are required.' });
    }

    const state = loadOrInitState();
    if (state.products.some((p) => p.sku.toUpperCase() === sku)) {
      return sendJson(res, 409, { error: `SKU "${sku}" already exists.` });
    }

    const newProduct = {
      sku,
      name,
      category,
      brand,
      hub,
      unitPrice,
      costPrice,
      onHand,
      reserved,
      onOrder,
      leadTimeDays,
      safetyStock,
      targetStock,
      moq,
      dailyDemand,
      supplier,
      salesHistory: SeedData.generateHistoricalDailySales(dailyDemand, 1.25, 0.14),
      movements: [
        {
          id: 'MOV-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
          date: 'Just Now',
          type: 'INITIAL_SETUP',
          qty: onHand,
          ref: 'CAT-CREATE',
          user: auth.user.name,
          createdAt: new Date().toISOString()
        }
      ]
    };
    newProduct.hubStocks = buildInitialHubStocks(newProduct);
    state.products.unshift(newProduct);
    state.activityLogs.unshift({
      id: 'ACT-' + crypto.randomBytes(4).toString('hex').toUpperCase(),
      type: 'CATALOG',
      hub,
      title: `Created SKU ${sku} (${name})`,
      detail: `Initial on-hand: ${onHand} units, MOQ: ${moq}`,
      actor: auth.user.name,
      timestamp: new Date().toISOString()
    });
    saveState(state);
    const sbProd = await upsertSupabaseRows('pallets_products', [toProductRow(newProduct)], 'sku');
    await upsertSupabaseRows('pallets_inventory_movements', [toMovementRow(newProduct.sku, newProduct.name, hub, newProduct.movements[0])], 'id');
    return sendJson(res, 201, { ok: true, product: newProduct, supabaseSync: sbProd });
  }

  if (req.method === 'PATCH' && pathname.startsWith('/api/ops/products/')) {
    const auth = requireRoles(req, res, ['Admin', 'Inventory Manager']);
    if (!auth) return;
    const sku = decodeURIComponent(pathname.slice('/api/ops/products/'.length)).toUpperCase();
    const body = await parseJsonBody(req);
    const state = loadOrInitState();
    const product = state.products.find((p) => p.sku.toUpperCase() === sku);
    if (!product) return sendJson(res, 404, { error: 'Product not found.' });

    const editableStrings = ['name', 'category', 'brand', 'supplier'];
    editableStrings.forEach((f) => {
      if (body[f] !== undefined && String(body[f]).trim()) product[f] = String(body[f]).trim();
    });
    if (body.hub !== undefined) {
      if (!VALID_HUB_IDS.has(body.hub)) return sendJson(res, 400, { error: 'Invalid hub ID.' });
      product.hub = body.hub;
    }
    const editableNumbers = ['unitPrice', 'costPrice', 'leadTimeDays', 'safetyStock', 'targetStock', 'moq', 'dailyDemand'];
    for (const f of editableNumbers) {
      if (body[f] !== undefined) {
        const val = Number(body[f]);
        if (!Number.isFinite(val) || val < 0) return sendJson(res, 400, { error: `Invalid numeric value for ${f}.` });
        product[f] = val;
      }
    }

    state.activityLogs.unshift({
      id: 'ACT-' + crypto.randomBytes(4).toString('hex').toUpperCase(),
      type: 'CATALOG',
      hub: product.hub,
      title: `Updated SKU ${product.sku}`,
      detail: `Parameters modified by ${auth.user.name}.`,
      actor: auth.user.name,
      timestamp: new Date().toISOString()
    });
    saveState(state);
    const sbProd = await upsertSupabaseRows('pallets_products', [toProductRow(product)], 'sku');
    return sendJson(res, 200, { ok: true, product, supabaseSync: sbProd });
  }

  if (req.method === 'DELETE' && pathname.startsWith('/api/ops/products/')) {
    const auth = requireRoles(req, res, ['Admin', 'Inventory Manager']);
    if (!auth) return;
    const sku = decodeURIComponent(pathname.slice('/api/ops/products/'.length)).toUpperCase();
    const state = loadOrInitState();
    const idx = state.products.findIndex((p) => p.sku.toUpperCase() === sku);
    if (idx === -1) return sendJson(res, 404, { error: 'Product not found.' });
    const removed = state.products.splice(idx, 1)[0];
    state.activityLogs.unshift({
      id: 'ACT-' + crypto.randomBytes(4).toString('hex').toUpperCase(),
      type: 'CATALOG',
      hub: removed.hub,
      title: `Deleted SKU ${removed.sku} (${removed.name})`,
      detail: 'Removed from active enterprise catalog.',
      actor: auth.user.name,
      timestamp: new Date().toISOString()
    });
    saveState(state);
    const sbDel = await deleteSupabaseRows('pallets_products', { sku: removed.sku });
    return sendJson(res, 200, { ok: true, sku: removed.sku, supabaseSync: sbDel });
  }

  if (req.method === 'POST' && pathname === '/api/ops/adjustments') {
    const auth = requireAuth(req, res);
    if (!auth) return;
    const body = await parseJsonBody(req);
    const idemKey = req.headers['x-idempotency-key'] || body.idempotencyKey;
    const state = loadOrInitState();
    const cached = checkIdempotency(state, `ADJ:${auth.user.id}`, idemKey);
    if (cached) {
      return sendJson(res, cached.statusCode, { ...cached.responseBody, idempotentReplay: true });
    }

    const sku = String(body.sku || '').trim().toUpperCase();
    const delta = Number(body.delta);
    const reason = String(body.reason || 'STOCK_COUNT').trim();
    const notes = String(body.notes || '').trim();
    const product = state.products.find((p) => p.sku.toUpperCase() === sku);
    if (!product) return sendJson(res, 404, { error: 'Product not found.' });

    if (auth.user.role === 'Staff' && product.hub !== auth.user.storeAccess) {
      return sendJson(res, 403, { error: `Forbidden: Staff assigned to ${auth.user.storeAccess} cannot adjust ${product.hub} inventory.` });
    }
    if (!Number.isFinite(delta) || delta === 0 || Math.round(delta) !== delta) {
      return sendJson(res, 400, { error: 'Adjustment delta must be a non-zero integer.' });
    }
    const nextOnHand = product.onHand + delta;
    if (nextOnHand < 0) {
      return sendJson(res, 400, { error: 'Resulting on-hand stock cannot be negative.' });
    }

    product.onHand = nextOnHand;
    if (!product.hubStocks) product.hubStocks = buildInitialHubStocks(product);
    product.hubStocks[product.hub] = Math.max(0, Number(product.hubStocks[product.hub] || 0) + delta);

    const mov = {
      id: 'MOV-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
      date: 'Just Now',
      type: reason,
      qty: delta,
      ref: notes || reason,
      user: auth.user.name,
      createdAt: new Date().toISOString()
    };
    product.movements = product.movements || [];
    product.movements.unshift(mov);

    state.activityLogs.unshift({
      id: 'ACT-' + crypto.randomBytes(4).toString('hex').toUpperCase(),
      type: 'STOCK_ADJUSTMENT',
      hub: product.hub,
      title: `${delta > 0 ? '+' : ''}${delta}u adjusted on ${product.sku}`,
      detail: `Reason: ${reason}${notes ? ` (${notes})` : ''} — New On-Hand: ${product.onHand}`,
      actor: auth.user.name,
      timestamp: mov.createdAt
    });

    const resp = { ok: true, product, movement: mov };
    recordIdempotency(state, `ADJ:${auth.user.id}`, idemKey, resp, 200);
    saveState(state);
    await upsertSupabaseRows('pallets_products', [toProductRow(product)], 'sku');
    await upsertSupabaseRows('pallets_inventory_movements', [toMovementRow(product.sku, product.name, product.hub, mov)], 'id');
    return sendJson(res, 200, resp);
  }

  if (req.method === 'POST' && pathname === '/api/ops/transfers') {
    const auth = requireRoles(req, res, ['Admin', 'Inventory Manager']);
    if (!auth) return;
    const body = await parseJsonBody(req);
    const idemKey = req.headers['x-idempotency-key'] || body.idempotencyKey;
    const state = loadOrInitState();
    const cached = checkIdempotency(state, `TRF:${auth.user.id}`, idemKey);
    if (cached) return sendJson(res, cached.statusCode, { ...cached.responseBody, idempotentReplay: true });

    const sku = String(body.sku || '').trim().toUpperCase();
    const fromHub = String(body.fromHub || '').trim();
    const toHub = String(body.toHub || '').trim();
    const qty = Number(body.qty);
    if (!VALID_HUB_IDS.has(fromHub) || !VALID_HUB_IDS.has(toHub) || fromHub === toHub) {
      return sendJson(res, 400, { error: 'Source and destination must be distinct valid dark store hubs.' });
    }
    if (!Number.isInteger(qty) || qty <= 0) {
      return sendJson(res, 400, { error: 'Transfer quantity must be a positive integer.' });
    }
    const product = state.products.find((p) => p.sku.toUpperCase() === sku);
    if (!product) return sendJson(res, 404, { error: 'Product not found.' });
    if (!product.hubStocks) product.hubStocks = buildInitialHubStocks(product);
    if (Number(product.hubStocks[fromHub] || 0) < qty) {
      return sendJson(res, 400, { error: `Insufficient stock in ${fromHub} (${product.hubStocks[fromHub] || 0} available).` });
    }

    product.hubStocks[fromHub] -= qty;
    product.hubStocks[toHub] = Number(product.hubStocks[toHub] || 0) + qty;

    const nowIso = new Date().toISOString();
    const mov = {
      id: 'TRF-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
      date: 'Just Now',
      type: 'INTER_HUB_TRANSFER',
      qty,
      ref: `${fromHub} -> ${toHub}`,
      user: auth.user.name,
      createdAt: nowIso
    };
    product.movements = product.movements || [];
    product.movements.unshift(mov);
    state.activityLogs.unshift({
      id: 'ACT-' + crypto.randomBytes(4).toString('hex').toUpperCase(),
      type: 'INTER_HUB_TRANSFER',
      hub: fromHub,
      title: `Transferred ${qty}u of ${product.sku}`,
      detail: `${fromHub} -> ${toHub} authorized by ${auth.user.name}.`,
      actor: auth.user.name,
      timestamp: nowIso
    });

    const resp = { ok: true, product, movement: mov };
    recordIdempotency(state, `TRF:${auth.user.id}`, idemKey, resp, 200);
    saveState(state);
    await upsertSupabaseRows('pallets_products', [toProductRow(product)], 'sku');
    await upsertSupabaseRows('pallets_inventory_movements', [toMovementRow(product.sku, product.name, fromHub, mov)], 'id');
    return sendJson(res, 200, resp);
  }

  if (req.method === 'POST' && pathname === '/api/ops/purchase-orders') {
    const auth = requireRoles(req, res, ['Admin', 'Inventory Manager']);
    if (!auth) return;
    const body = await parseJsonBody(req);
    const idemKey = req.headers['x-idempotency-key'] || body.idempotencyKey;
    const state = loadOrInitState();
    const cached = checkIdempotency(state, `PO:${auth.user.id}`, idemKey);
    if (cached) return sendJson(res, cached.statusCode, { ...cached.responseBody, idempotentReplay: true });

    const items = Array.isArray(body.items) ? body.items : [body];
    if (items.length === 0) return sendJson(res, 400, { error: 'At least one PO item is required.' });

    const createdOrders = [];
    const nowIso = new Date().toISOString();

    for (const item of items) {
      const sku = String(item.sku || '').trim().toUpperCase();
      const product = state.products.find((p) => p.sku.toUpperCase() === sku);
      if (!product) return sendJson(res, 404, { error: `Product ${sku} not found.` });

      const qty = item.qty !== undefined
        ? Number(item.qty)
        : Calculations.calculateRecommendedOrderQuantity(product);
      if (!Number.isInteger(qty) || qty <= 0) {
        return sendJson(res, 400, { error: `Invalid order quantity for ${sku}.` });
      }
      const status = body.approveImmediately ? 'APPROVED' : 'PENDING';
      const totalCost = Math.round(qty * Number(product.costPrice));
      const po = {
        id: 'PO-' + Math.floor(10000 + crypto.randomInt(89999)),
        sku: product.sku,
        productName: product.name,
        hub: product.hub,
        qty,
        unitCost: product.costPrice,
        totalCost,
        supplier: item.supplier || product.supplier,
        status,
        rationale: String(item.rationale || `Target=${product.targetStock}, IP=${Calculations.calculateIP(product)}, MOQ=${product.moq}`).trim(),
        dispatchOutcome: status === 'APPROVED' ? (item.dispatchOutcome || 'DISPATCH_PENDING') : 'PENDING_APPROVAL',
        createdBy: auth.user.name,
        createdAt: nowIso,
        approvedAt: status === 'APPROVED' ? nowIso : null
      };

      if (status === 'APPROVED') {
        product.onOrder = Number(product.onOrder || 0) + qty;
        product.movements = product.movements || [];
        product.movements.unshift({
          id: 'MOV-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
          date: 'Just Now',
          type: 'PO_DISPATCHED',
          qty,
          ref: po.id,
          user: auth.user.name,
          createdAt: nowIso
        });
      }

      state.purchaseOrders.unshift(po);
      createdOrders.push(po);
      state.activityLogs.unshift({
        id: 'ACT-' + crypto.randomBytes(4).toString('hex').toUpperCase(),
        type: 'PURCHASE_ORDER',
        hub: po.hub,
        title: `${po.id} (${po.status}): ${po.qty}u of ${po.sku}`,
        detail: `${po.supplier} — INR ${po.totalCost.toLocaleString('en-IN')}`,
        actor: auth.user.name,
        timestamp: nowIso
      });
    }

    const resp = {
      ok: true,
      orders: createdOrders,
      order: createdOrders[0]
    };
    recordIdempotency(state, `PO:${auth.user.id}`, idemKey, resp, 201);
    saveState(state);
    await upsertSupabaseRows('pallets_purchase_orders', createdOrders.map(toPurchaseOrderRow), 'po_number');
    const touchedProducts = createdOrders
      .map((o) => state.products.find((p) => p.sku === o.sku))
      .filter(Boolean);
    if (touchedProducts.length > 0) {
      await upsertSupabaseRows('pallets_products', touchedProducts.map((p) => toProductRow(p, nowIso)), 'sku');
      const poMovements = createdOrders
        .filter((o) => o.status === 'APPROVED')
        .map((o) => {
          const p = state.products.find((x) => x.sku === o.sku);
          const m = p && Array.isArray(p.movements) ? p.movements[0] : null;
          return m ? toMovementRow(o.sku, o.productName, o.hub, m, nowIso) : null;
        })
        .filter(Boolean);
      if (poMovements.length > 0) {
        await upsertSupabaseRows('pallets_inventory_movements', poMovements, 'id');
      }
    }
    return sendJson(res, 201, resp);
  }

  if (req.method === 'PATCH' && pathname.startsWith('/api/ops/purchase-orders/')) {
    const auth = requireRoles(req, res, ['Admin', 'Inventory Manager']);
    if (!auth) return;
    const poId = decodeURIComponent(pathname.slice('/api/ops/purchase-orders/'.length));
    const body = await parseJsonBody(req);
    const state = loadOrInitState();
    const po = state.purchaseOrders.find((p) => p.id === poId);
    if (!po) return sendJson(res, 404, { error: 'Purchase order not found.' });

    const nowIso = new Date().toISOString();
    if (body.status && body.status !== po.status) {
      if (po.status === 'PENDING' && body.status === 'APPROVED') {
        const product = state.products.find((p) => p.sku === po.sku);
        if (product) {
          product.onOrder = Number(product.onOrder || 0) + Number(po.qty);
          product.movements = product.movements || [];
          product.movements.unshift({
            id: 'MOV-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
            date: 'Just Now',
            type: 'PO_APPROVED',
            qty: po.qty,
            ref: po.id,
            user: auth.user.name,
            createdAt: nowIso
          });
        }
        po.status = 'APPROVED';
        po.approvedAt = nowIso;
        po.approvedBy = auth.user.name;
      } else if (po.status === 'PENDING' && body.status === 'REJECTED') {
        po.status = 'REJECTED';
        po.dispatchOutcome = 'CANCELLED';
        po.rejectedAt = nowIso;
        po.rejectedBy = auth.user.name;
      } else if (po.status === 'APPROVED' && body.status === 'RECEIVED') {
        const product = state.products.find((p) => p.sku === po.sku);
        if (product) {
          product.onOrder = Math.max(0, Number(product.onOrder || 0) - Number(po.qty));
          product.onHand = Number(product.onHand || 0) + Number(po.qty);
          if (!product.hubStocks) product.hubStocks = buildInitialHubStocks(product);
          product.hubStocks[product.hub] = Number(product.hubStocks[product.hub] || 0) + Number(po.qty);
          product.movements = product.movements || [];
          product.movements.unshift({
            id: 'MOV-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
            date: 'Just Now',
            type: 'INBOUND_PO',
            qty: po.qty,
            ref: po.id,
            user: auth.user.name,
            createdAt: nowIso
          });
        }
        po.status = 'RECEIVED';
        po.receivedAt = nowIso;
      } else {
        return sendJson(res, 409, { error: `Invalid PO status transition from ${po.status} to ${body.status}.` });
      }
    }

    if (body.dispatchOutcome) {
      po.dispatchOutcome = String(body.dispatchOutcome);
      po.dispatchLatencyMs = body.dispatchLatencyMs ?? po.dispatchLatencyMs ?? null;
      po.dispatchError = body.dispatchError ?? null;
    }

    state.activityLogs.unshift({
      id: 'ACT-' + crypto.randomBytes(4).toString('hex').toUpperCase(),
      type: 'PURCHASE_ORDER',
      hub: po.hub,
      title: `${po.id} -> ${po.status} (${po.dispatchOutcome})`,
      detail: `${po.qty}u of ${po.sku}`,
      actor: auth.user.name,
      timestamp: nowIso
    });
    saveState(state);
    await upsertSupabaseRows('pallets_purchase_orders', [toPurchaseOrderRow(po)], 'po_number');
    const touchedProd = state.products.find((p) => p.sku === po.sku);
    if (touchedProd) {
      await upsertSupabaseRows('pallets_products', [toProductRow(touchedProd, nowIso)], 'sku');
      if (['APPROVED', 'RECEIVED'].includes(po.status) && Array.isArray(touchedProd.movements) && touchedProd.movements[0]) {
        await upsertSupabaseRows('pallets_inventory_movements', [toMovementRow(touchedProd.sku, touchedProd.name, po.hub, touchedProd.movements[0], nowIso)], 'id');
      }
    }
    return sendJson(res, 200, { ok: true, order: po });
  }

  if (req.method === 'POST' && pathname === '/api/ops/ingestion') {
    const auth = requireRoles(req, res, ['Admin', 'Inventory Manager']);
    if (!auth) return;
    const body = await parseJsonBody(req);
    const idemKey = req.headers['x-idempotency-key'] || body.idempotencyKey;
    const state = loadOrInitState();
    const cached = checkIdempotency(state, `ING:${auth.user.id}`, idemKey);
    if (cached) return sendJson(res, cached.statusCode, { ...cached.responseBody, idempotentReplay: true });

    const validRows = Array.isArray(body.validRows) ? body.validRows : [];
    const invalidCount = Math.max(0, Number(body.invalidRows || 0));
    const duplicateCount = Math.max(0, Number(body.duplicates || 0));
    const fileName = String(body.fileName || 'manual_batch.csv').trim();

    if (validRows.length === 0 && invalidCount === 0) {
      return sendJson(res, 400, { error: 'No transaction rows supplied for ingestion.' });
    }

    const skuTotals = {};
    validRows.forEach((row) => {
      const s = String(row.sku || '').trim().toUpperCase();
      const q = Math.max(0, Number(row.qty || 0));
      if (s && q > 0) skuTotals[s] = (skuTotals[s] || 0) + q;
    });

    let matchedSkus = 0;
    const updatedProducts = [];
    Object.keys(skuTotals).forEach((sku) => {
      const prod = state.products.find((p) => p.sku.toUpperCase() === sku);
      if (prod) {
        matchedSkus += 1;
        const addedQty = skuTotals[sku];
        if (Array.isArray(prod.salesHistory) && prod.salesHistory.length > 0) {
          const lastEntry = prod.salesHistory[prod.salesHistory.length - 1];
          if (typeof lastEntry === 'object' && lastEntry !== null) {
            lastEntry.quantity = Number(lastEntry.quantity || 0) + addedQty;
          } else {
            prod.salesHistory[prod.salesHistory.length - 1] = Number(lastEntry || 0) + addedQty;
          }
          const tail7 = prod.salesHistory.slice(-7);
          const sum7 = tail7.reduce((a, b) => a + Number(typeof b === 'object' && b !== null ? b.quantity : b || 0), 0);
          prod.dailyDemand = Math.max(1, Math.round(sum7 / tail7.length));
        }
        updatedProducts.push(prod);
      }
    });

    const nowIso = new Date().toISOString();
    const batch = {
      batchId: 'BATCH-ING-' + Math.floor(1000 + crypto.randomInt(8999)),
      fileName,
      totalRecords: validRows.length + invalidCount + duplicateCount,
      imported: validRows.length,
      duplicates: duplicateCount,
      invalidRows: invalidCount,
      matchedSkus,
      status: invalidCount > 0 ? 'COMPLETED_WITH_WARNINGS' : 'COMPLETED',
      sourceType: body.sourceType || 'CSV_UPLOAD',
      timestamp: 'Just Now',
      ingestedAt: nowIso
    };
    state.ingestionLogs.unshift(batch);
    state.activityLogs.unshift({
      id: 'ACT-' + crypto.randomBytes(4).toString('hex').toUpperCase(),
      type: 'INGESTION',
      hub: 'BLR_NORTH_DC',
      title: `Ingested ${batch.batchId} (${batch.fileName})`,
      detail: `${batch.imported} imported, ${batch.duplicates} duplicates, ${batch.invalidRows} invalid rows.`,
      actor: auth.user.name,
      timestamp: nowIso
    });

    const resp = { ok: true, batch };
    recordIdempotency(state, `ING:${auth.user.id}`, idemKey, resp, 201);
    saveState(state);
    await upsertSupabaseRows('pallets_ingestion_logs', [toIngestionRow(batch, auth.user.name)], 'id');
    if (updatedProducts.length > 0) {
      await upsertSupabaseRows('pallets_products', updatedProducts.map((p) => toProductRow(p, nowIso)), 'sku');
      const latestSales = updatedProducts
        .map((p) => {
          const rows = toSalesRows(p);
          return rows.length > 0 ? rows[rows.length - 1] : null;
        })
        .filter(Boolean);
      if (latestSales.length > 0) {
        await upsertSupabaseRows('pallets_sales_history', latestSales, 'id');
      }
    }
    return sendJson(res, 201, resp);
  }

  if (req.method === 'POST' && pathname === '/api/ops/forecasts') {
    const auth = requireRoles(req, res, ['Admin', 'Inventory Manager']);
    if (!auth) return;
    const body = await parseJsonBody(req);
    const state = loadOrInitState();
    const run = {
      id: 'FCT-' + crypto.randomBytes(4).toString('hex').toUpperCase(),
      sku: String(body.sku || ''),
      selectedModel: String(body.selectedModel || 'AUTO'),
      selectedModelName: String(body.selectedModelName || ''),
      horizonDays: Number(body.horizonDays || 30),
      promoBoost: Number(body.promoBoost || 0),
      wape: Number(body.wape || 0),
      mae: Number(body.mae || 0),
      rmse: Number(body.rmse || 0),
      projected30d: Number(body.projected30d || 0),
      runBy: auth.user.name,
      createdAt: new Date().toISOString()
    };
    state.forecastRuns.unshift(run);
    if (state.forecastRuns.length > 50) state.forecastRuns.length = 50;
    state.activityLogs.unshift({
      id: 'ACT-' + crypto.randomBytes(4).toString('hex').toUpperCase(),
      type: 'FORECAST',
      hub: 'BLR_NORTH_DC',
      title: `Forecast run for ${run.sku} (${run.selectedModelName || run.selectedModel})`,
      detail: `WAPE ${run.wape}% | Horizon ${run.horizonDays}d (+${Math.round(run.promoBoost * 100)}% promo)`,
      actor: auth.user.name,
      timestamp: run.createdAt
    });
    saveState(state);
    const matchedProd = state.products.find((p) => p.sku === run.sku);
    const sbFct = await upsertSupabaseRows('pallets_forecast_runs', [
      toForecastRow({ ...run, productName: matchedProd ? matchedProd.name : run.sku })
    ], 'id');
    return sendJson(res, 201, { ok: true, run, supabaseSync: sbFct });
  }

  if (req.method === 'POST' && pathname === '/api/ops/suppliers') {
    const auth = requireRoles(req, res, ['Admin', 'Inventory Manager']);
    if (!auth) return;
    const body = await parseJsonBody(req);
    const name = String(body.name || '').trim();
    if (name.length < 2) return sendJson(res, 400, { error: 'Supplier name is required.' });
    const state = loadOrInitState();
    if (state.suppliers.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
      return sendJson(res, 409, { error: 'Supplier already exists.' });
    }
    const sup = {
      id: 'SUP-' + String(state.suppliers.length + 1).padStart(2, '0'),
      name,
      category: String(body.category || 'Multi-Category FMCG').trim(),
      leadTimeDays: Math.max(1, Number(body.leadTimeDays || 3)),
      reliabilityScore: Math.min(100, Math.max(0, Number(body.reliabilityScore || 95))),
      defectRate: Math.max(0, Number(body.defectRate || 0.8)),
      onTimeDelivery: Math.min(100, Math.max(0, Number(body.onTimeDelivery ?? body.onTimeDeliveryPct ?? 94))),
      defaultMoq: Math.max(1, Number(body.defaultMoq ?? body.defaultMOQ ?? 100)),
      activeOrders: 0,
      contact: String(body.contact ?? body.contactEmail ?? '').trim()
    };
    state.suppliers.push(sup);
    saveState(state);
    const sbSup = await upsertSupabaseRows('pallets_suppliers', [toSupplierRow(sup)], 'id');
    return sendJson(res, 201, { ok: true, supplier: sup, supabaseSync: sbSup });
  }

  return sendJson(res, 404, { error: `API endpoint not found: ${req.method} ${pathname}` });
}

function resolveRequestPathname(req) {
  if (req.query && req.query.__pallets_path) {
    const sub = String(req.query.__pallets_path);
    return sub.startsWith('/api') ? sub : `/api${sub.startsWith('/') ? '' : '/'}${sub}`;
  }
  if (req.query && req.query.all) {
    const sub = Array.isArray(req.query.all) ? req.query.all.join('/') : String(req.query.all);
    return `/api/${sub.replace(/^\//, '')}`;
  }
  let raw = req.url || '/';
  const vercelHeader = req.headers['x-vercel-matched-path'] ||
                       req.headers['x-matched-path'] ||
                       req.headers['x-forwarded-url'] ||
                       req.headers['x-original-url'] ||
                       req.headers['x-invoke-path'];
  if (vercelHeader && (raw.startsWith('/api/index') || raw.startsWith('/api/[...all]'))) {
    raw = vercelHeader;
  }
  const parsed = new URL(raw, `http://${req.headers.host || 'localhost'}`);
  let pathname = parsed.pathname;
  if (parsed.searchParams && parsed.searchParams.has('__pallets_path')) {
    const p = parsed.searchParams.get('__pallets_path');
    pathname = p.startsWith('/api') ? p : `/api${p.startsWith('/') ? '' : '/'}${p}`;
  }
  return pathname;
}

async function handleApiRequest(req, res) {
  try {
    const pathname = resolveRequestPathname(req);
    await handleApi(req, res, pathname);
  } catch (err) {
    const status = err.statusCode || 500;
    sendJson(res, status, { error: err.message || 'Internal server error.' });
  }
}

function createServerInstance() {
  return http.createServer(async (req, res) => {
    const pathname = resolveRequestPathname(req);

    if (pathname.startsWith('/api/')) {
      await handleApiRequest(req, res);
      return;
    }

    serveStaticFile(req, res, pathname);
  });
}

const defaultHandler = async (req, res) => {
  try {
    const pathname = resolveRequestPathname(req);
    if (pathname.startsWith('/api/')) {
      return await handleApiRequest(req, res);
    }
    return serveStaticFile(req, res, pathname);
  } catch (err) {
    const status = err.statusCode || 500;
    sendJson(res, status, { error: err.message || 'Internal server error.' });
  }
};

defaultHandler.createServerInstance = createServerInstance;
defaultHandler.handleApiRequest = handleApiRequest;
defaultHandler.handleApi = handleApi;
defaultHandler.default = defaultHandler;

if (require.main === module) {
  const server = createServerInstance();
  server.listen(PORT, () => {
    console.log(`[PALLETS V3] Dark Industrial Enterprise Server listening on http://localhost:${PORT}`);
    console.log(`[PALLETS V3] Data directory: ${DATA_DIR}`);
  });
}

module.exports = defaultHandler;
