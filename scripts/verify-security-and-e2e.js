/**
 * PALLETS V3 // Comprehensive Security, RBAC, Idempotency & Business Math Verification Suite
 * Starts an isolated instance of PALLETS V3 server.js against a temporary .data/.secrets dir.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const assert = require('assert');

const TEMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'pallets-v3-test-'));
process.env.PALLETS_DATA_DIR = path.join(TEMP_ROOT, '.data');
process.env.PALLETS_SECRETS_DIR = path.join(TEMP_ROOT, '.secrets');
process.env.PALLETS_BOOTSTRAP_TOKEN = 'TEST_ONE_TIME_BOOTSTRAP_SECRET_991';

const { createServerInstance } = require('../server/server.js');
const Calculations = require('../js/core/calculations.js');
const SeedData = require('../js/core/seed-data.js');
const ForecastingEngine = require('../js/existing/forecasting-engine.js');
const AprioriEngine = require('../js/existing/apriori-engine.js');
const { unwrapGatewayResponse } = require('../js/existing/supabase-client.js');

const EXPECTED_PRESERVED_URLS = {
  master: 'https://api.agents.snsihub.ai/webhook/cc0a6272-8aba-45b2-916a-b44905b2386a',
  supabaseSync: 'https://api.agents.snsihub.ai/webhook/339f3866-bb32-40ba-9849-c83dcc1df790',
  authSupabase: 'https://api.agents.snsihub.ai/webhook/40832378-4e7b-4a82-824f-963709fb5119',
  ingestion: 'https://api.agents.snsihub.ai/webhook/6793b021-48d8-468c-bc57-26a1853e7542',
  forecasting: 'https://api.agents.snsihub.ai/webhook/4798f7a4-a61f-43dc-a773-fa7d36475b2f',
  risks: 'https://api.agents.snsihub.ai/webhook/fed236f4-1544-42da-8520-d66fa14cce44',
  replenishment: 'https://api.agents.snsihub.ai/webhook/2efb1af6-df78-48d1-b03a-896ec79a82b9',
  suppliers: 'https://api.agents.snsihub.ai/webhook/3c2f7abd-1599-4a00-b40b-f31e4019cd21',
  copilot: 'https://api.agents.snsihub.ai/webhook/a1e7b69a-093a-47fe-8fd8-d10139ed707a'
};

function extractSessionCookie(res) {
  const raw = res.headers.get('set-cookie');
  if (!raw) return null;
  const match = raw.match(/pallets_v3_sid=([^;]+)/);
  return match ? `pallets_v3_sid=${match[1]}` : null;
}

async function api(baseUrl, pathname, { method = 'GET', cookie = null, body = null, headers = {} } = {}) {
  const reqHeaders = { Accept: 'application/json', ...headers };
  if (cookie) reqHeaders.Cookie = cookie;
  if (body !== null) reqHeaders['Content-Type'] = 'application/json';
  const res = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: reqHeaders,
    body: body !== null ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch (e) {}
  return { status: res.status, headers: res.headers, json, text, cookie: extractSessionCookie(res) };
}

async function runTests() {
  // Isolate authSupabase & supabaseSync in test .data before launching test server so synthetic
  // test users never pollute the user's real production Supabase tables.
  const capturedCalls = [];
  const mockWebhookServer = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const rawBody = Buffer.concat(chunks).toString('utf8');
      let parsed = null;
      try {
        parsed = JSON.parse(rawBody);
      } catch (e) {}
      capturedCalls.push({ url: req.url, body: parsed, rawBody });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        result: {
          statusCode: 200,
          body: { ok: true, synced: true, count: 1 }
        }
      }));
    });
  });
  await new Promise((resolve) => mockWebhookServer.listen(0, '127.0.0.1', resolve));
  const mockPort = mockWebhookServer.address().port;

  fs.mkdirSync(process.env.PALLETS_DATA_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(process.env.PALLETS_DATA_DIR, 'webhooks-config.json'),
    JSON.stringify({
      ...EXPECTED_PRESERVED_URLS,
      authSupabase: `http://127.0.0.1:${mockPort}/auth-supabase`,
      supabaseSync: `http://127.0.0.1:${mockPort}/supabase-sync`
    }, null, 2),
    'utf8'
  );

  const server = createServerInstance();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  let passed = 0;

  function step(name) {
    passed += 1;
    console.log(`[PASS ${String(passed).padStart(2, '0')}] ${name}`);
  }

  try {
    // 1. Static sensitivity & unauthenticated API blocking
    const rStaticSecret = await api(baseUrl, '/webhooks-config.json');
    assert.strictEqual(rStaticSecret.status, 403, 'webhooks-config.json must be blocked from public static HTTP');
    const rUnauthOps = await api(baseUrl, '/api/ops/state');
    assert.strictEqual(rUnauthOps.status, 401, 'Unauthenticated /api/ops/state must return 401');
    const rUnauthAdmin = await api(baseUrl, '/api/admin/users');
    assert.strictEqual(rUnauthAdmin.status, 401, 'Unauthenticated /api/admin/users must return 401');
    step('Unauthenticated operational/admin routes and sensitive files strictly rejected (401/403)');

    // 2. Initial Admin Bootstrap lock
    const bStatus1 = await api(baseUrl, '/api/auth/bootstrap-status');
    assert.strictEqual(bStatus1.json.needsAdminBootstrap, true);
    const bBad = await api(baseUrl, '/api/auth/bootstrap-admin', {
      method: 'POST',
      body: { bootstrapToken: 'WRONG_TOKEN', name: 'Admin', email: 'admin@pallets.io', password: 'Password123' }
    });
    assert.strictEqual(bBad.status, 403);

    const bOk = await api(baseUrl, '/api/auth/bootstrap-admin', {
      method: 'POST',
      body: { bootstrapToken: process.env.PALLETS_BOOTSTRAP_TOKEN, name: 'Elena Vance', email: 'admin@pallets.io', password: 'AdminPassword1' }
    });
    assert.strictEqual(bOk.status, 201);
    assert.strictEqual(bOk.json.user.role, 'Admin');
    const adminCookie = bOk.cookie;
    assert.ok(adminCookie, 'Bootstrap Admin must issue HttpOnly session cookie');

    const bLocked = await api(baseUrl, '/api/auth/bootstrap-admin', {
      method: 'POST',
      body: { bootstrapToken: process.env.PALLETS_BOOTSTRAP_TOKEN, name: 'Second', email: 'admin2@pallets.io', password: 'AdminPassword2' }
    });
    assert.strictEqual(bLocked.status, 403, 'Bootstrap must permanently lock once 1 Admin exists');
    step('One-time Admin bootstrap verified and permanently locked after first Admin');

    // 3. Public signup validation + privilege escalation blocking
    const rBadEmail = await api(baseUrl, '/api/auth/register', {
      method: 'POST',
      body: { name: 'Bad', email: 'not-an-email', password: 'Password123', storeAccess: 'BLR_NORTH_DC' }
    });
    assert.strictEqual(rBadEmail.status, 400);

    const rEscAdmin = await api(baseUrl, '/api/auth/register', {
      method: 'POST',
      body: { name: 'Attacker', email: 'att@pallets.io', password: 'Password123', role: 'Admin', storeAccess: 'BLR_NORTH_DC' }
    });
    assert.strictEqual(rEscAdmin.status, 403);

    const rEscPerms = await api(baseUrl, '/api/auth/register', {
      method: 'POST',
      body: { name: 'Attacker2', email: 'att2@pallets.io', password: 'Password123', permissions: ['ALL'], storeAccess: 'BLR_NORTH_DC' }
    });
    assert.strictEqual(rEscPerms.status, 403);

    const rBadHub = await api(baseUrl, '/api/auth/register', {
      method: 'POST',
      body: { name: 'Attacker3', email: 'att3@pallets.io', password: 'Password123', storeAccess: 'ALL' }
    });
    assert.strictEqual(rBadHub.status, 400);
    step('Public registration rejects invalid inputs and blocks role/permission escalation (403/400)');

    // 4. Normal Staff registration + Duplicate & Concurrent race protection
    const rStaff1 = await api(baseUrl, '/api/auth/register', {
      method: 'POST',
      body: { name: 'Rahul Sharma', email: 'rahul@pallets.io', password: 'StaffPassword1', storeAccess: 'BLR_NORTH_DC' }
    });
    assert.strictEqual(rStaff1.status, 201);
    assert.strictEqual(rStaff1.json.user.role, 'Staff');
    assert.strictEqual(rStaff1.json.user.storeAccess, 'BLR_NORTH_DC');
    const staffCookie = rStaff1.cookie;

    const rDup = await api(baseUrl, '/api/auth/register', {
      method: 'POST',
      body: { name: 'Rahul Clone', email: 'RAHUL@pallets.io', password: 'StaffPassword1', storeAccess: 'BLR_NORTH_DC' }
    });
    assert.strictEqual(rDup.status, 409, 'Case-insensitive duplicate email must be rejected with 409');

    const [raceA, raceB] = await Promise.all([
      api(baseUrl, '/api/auth/register', {
        method: 'POST',
        body: { name: 'Race A', email: 'race@pallets.io', password: 'Password123', storeAccess: 'BLR_NORTH_DC' }
      }),
      api(baseUrl, '/api/auth/register', {
        method: 'POST',
        body: { name: 'Race B', email: 'race@pallets.io', password: 'Password123', storeAccess: 'BLR_NORTH_DC' }
      })
    ]);
    const raceStatuses = [raceA.status, raceB.status].sort();
    assert.deepStrictEqual(raceStatuses, [201, 409], 'Concurrent duplicate signup must produce strictly one 201 and one 409');
    step('Staff registration duplicate & concurrent race conditions cleanly prevented (409 Conflict)');

    // 5. Staff RBAC & Hub Scoping Boundaries
    const rStaffAdmin = await api(baseUrl, '/api/admin/users', { cookie: staffCookie });
    assert.strictEqual(rStaffAdmin.status, 403);
    const rStaffSwitch = await api(baseUrl, '/api/auth/switch-role', { method: 'POST', cookie: staffCookie, body: { role: 'Admin' } });
    assert.strictEqual(rStaffSwitch.status, 403);
    const rStaffWfCfg = await api(baseUrl, '/api/workflows/config', { cookie: staffCookie });
    assert.strictEqual(rStaffWfCfg.status, 403);
    const rStaffWfStatus = await api(baseUrl, '/api/workflows/status', { cookie: staffCookie });
    assert.strictEqual(rStaffWfStatus.status, 200);
    assert.strictEqual(rStaffWfStatus.json.workflows.master.url, undefined, 'Non-Admin must not receive raw webhook URLs');

    const rStaffDel = await api(baseUrl, '/api/ops/products/SKU-9921-OAT', { method: 'DELETE', cookie: staffCookie });
    assert.strictEqual(rStaffDel.status, 403);
    const rStaffPo = await api(baseUrl, '/api/ops/purchase-orders', { method: 'POST', cookie: staffCookie, body: { sku: 'SKU-9921-OAT', qty: 100 } });
    assert.strictEqual(rStaffPo.status, 403);
    const rStaffOtherHubAdj = await api(baseUrl, '/api/ops/adjustments', {
      method: 'POST',
      cookie: staffCookie,
      body: { sku: 'SKU-8842-COLD', delta: -5, reason: 'STOCK_COUNT' } // MUM_BANDRA_HUB != BLR_NORTH_DC
    });
    assert.strictEqual(rStaffOtherHubAdj.status, 403, 'Staff must be blocked from adjusting SKUs at other hubs');

    const adjIdemKey = 'TEST-ADJ-KEY-1';
    const rStaffOwnAdj1 = await api(baseUrl, '/api/ops/adjustments', {
      method: 'POST',
      cookie: staffCookie,
      headers: { 'X-Idempotency-Key': adjIdemKey },
      body: { sku: 'SKU-9921-OAT', delta: 5, reason: 'STOCK_COUNT' }
    });
    assert.strictEqual(rStaffOwnAdj1.status, 200);
    assert.strictEqual(rStaffOwnAdj1.json.product.onHand, 147);
    const rStaffOwnAdj2 = await api(baseUrl, '/api/ops/adjustments', {
      method: 'POST',
      cookie: staffCookie,
      headers: { 'X-Idempotency-Key': adjIdemKey },
      body: { sku: 'SKU-9921-OAT', delta: 5, reason: 'STOCK_COUNT' }
    });
    assert.strictEqual(rStaffOwnAdj2.status, 200);
    assert.strictEqual(rStaffOwnAdj2.json.idempotentReplay, true);
    assert.strictEqual(rStaffOwnAdj2.json.product.onHand, 147, 'Idempotent replay must not apply adjustment twice');
    step('Staff RBAC, hub scoping, URL masking, and idempotent adjustment verified');

    // 6. Logout revocation + Invalid credentials rejection
    const rLogout = await api(baseUrl, '/api/auth/logout', { method: 'POST', cookie: staffCookie });
    assert.strictEqual(rLogout.status, 200);
    const rPostLogout = await api(baseUrl, '/api/ops/state', { cookie: staffCookie });
    assert.strictEqual(rPostLogout.status, 401, 'Old cookie must be immediately rejected after logout');
    const rBadLogin = await api(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: { email: 'rahul@pallets.io', password: 'WrongPassword9' }
    });
    assert.strictEqual(rBadLogin.status, 401);
    step('Post-logout token revocation and invalid password rejection verified');

    // 7. Default Workflow Config Preservation & PO Idempotency
    const diskWebhooks = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'webhooks-config.json'), 'utf8'));
    assert.deepStrictEqual(diskWebhooks, EXPECTED_PRESERVED_URLS, 'All 9 preserved SNS webhook URLs in webhooks-config.json must match verbatim');
    const rAdmCfg = await api(baseUrl, '/api/workflows/config', { cookie: adminCookie });
    assert.strictEqual(rAdmCfg.status, 200);
    assert.strictEqual(rAdmCfg.json.urls.master, EXPECTED_PRESERVED_URLS.master);

    const stBeforePo = await api(baseUrl, '/api/ops/state', { cookie: adminCookie });
    const yoguBefore = stBeforePo.json.products.find((p) => p.sku === 'SKU-5520-YOGU');

    const poIdem = 'TEST-PO-KEY-1';
    const rPo1 = await api(baseUrl, '/api/ops/purchase-orders', {
      method: 'POST',
      cookie: adminCookie,
      headers: { 'X-Idempotency-Key': poIdem },
      body: { items: [{ sku: 'SKU-5520-YOGU', qty: 200 }], approveImmediately: true }
    });
    assert.strictEqual(rPo1.status, 201);
    const rPo2 = await api(baseUrl, '/api/ops/purchase-orders', {
      method: 'POST',
      cookie: adminCookie,
      headers: { 'X-Idempotency-Key': poIdem },
      body: { items: [{ sku: 'SKU-5520-YOGU', qty: 200 }], approveImmediately: true }
    });
    assert.strictEqual(rPo2.status, 201);
    assert.strictEqual(rPo2.json.idempotentReplay, true);
    const stAfterPo = await api(baseUrl, '/api/ops/state', { cookie: adminCookie });
    const yogu = stAfterPo.json.products.find((p) => p.sku === 'SKU-5520-YOGU');
    assert.strictEqual(yogu.onOrder, yoguBefore.onOrder + 200, 'Approved idempotent PO must only add 200 to onOrder once');
    step('Preserved SNS webhook URLs verified verbatim & PO idempotency confirmed');

    // 8. Account disable immediately blocks login
    const admUsers = await api(baseUrl, '/api/admin/users', { cookie: adminCookie });
    const rahul = admUsers.json.users.find((u) => u.email === 'rahul@pallets.io');
    const rDisable = await api(baseUrl, `/api/admin/users/${rahul.id}`, {
      method: 'PATCH',
      cookie: adminCookie,
      body: { status: 'DISABLED' }
    });
    assert.strictEqual(rDisable.status, 200);
    const rDisabledLogin = await api(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: { email: 'rahul@pallets.io', password: 'StaffPassword1' }
    });
    assert.strictEqual(rDisabledLogin.status, 403);
    step('Admin user status disabling enforces immediate login denial (403)');

    // 9. Preserved Business Math & Forecasting WAPE Fix Verification
    const sampleOat = { dailyDemand: 142, leadTimeDays: 3, safetyStock: 350, onHand: 185, onOrder: 0, reserved: 20, targetStock: 850, moq: 200 };
    assert.strictEqual(Calculations.calculateROP(sampleOat), 776);
    assert.strictEqual(Calculations.calculateIP(sampleOat), 165);
    assert.strictEqual(Calculations.calculateRecommendedOrderQuantity(sampleOat), 800);
    assert.strictEqual(Calculations.calculateRunwayDays(sampleOat), 1.3);
    assert.strictEqual(Calculations.evaluateRiskStatus(sampleOat), 'CRITICAL');

    const seedProducts = SeedData.createInitialProducts();
    const fcResult = ForecastingEngine.runForecast(seedProducts[0].salesHistory, { horizonDays: 30 });
    assert.ok(fcResult.metrics.wape >= 0 && fcResult.metrics.wape <= 100, `Expected WAPE in 0..100, got ${fcResult.metrics.wape}`);

    const baskets = SeedData.buildSampleBasketsForApriori();
    const apResult = AprioriEngine.runApriori(baskets, { minSupport: 0.02, minConfidence: 0.25 });
    assert.ok(apResult.frequentRulesCount >= 3, 'Expected >= 3 Apriori association rules from seed baskets');
    step('Business formulas (ROP/IP/Q/Runway), WAPE 0..100 fix, and Apriori engine verified');

    // 10. Non-destructive SNS HEALTH_CHECK & WF-SUPABASE-SYNC gateway health pings + unwrap check
    const sampleGatewayEnvelope = {
      ok: true,
      outcome: 'CONFIRMED_SUCCESS',
      workflowId: 'WF-SUPABASE-SYNC',
      data: {
        result: {
          statusCode: 200,
          body: { ok: true, mode: 'SNS_WORKBENCH_SUPABASE', reachable: true, configured: true, tableCount: 10, schemaReady: true }
        }
      }
    };
    const deterministicUnwrap = unwrapGatewayResponse(sampleGatewayEnvelope);
    assert.strictEqual(deterministicUnwrap.ok, true);
    assert.strictEqual(deterministicUnwrap.schemaReady, true);
    assert.strictEqual(deterministicUnwrap.tableCount, 10);

    const cfgRestoreSb = await api(baseUrl, '/api/workflows/config', {
      method: 'POST',
      cookie: adminCookie,
      body: { supabaseSync: EXPECTED_PRESERVED_URLS.supabaseSync }
    });
    assert.strictEqual(cfgRestoreSb.status, 200);

    const pingRes = await api(baseUrl, '/api/sns-proxy', {
      method: 'POST',
      cookie: adminCookie,
      body: {
        featureKey: 'master',
        payload: {
          event: 'HEALTH_CHECK',
          workflowId: 'WF-MASTER',
          source: 'PALLETS_V3_VERIFICATION_SUITE',
          timestamp: new Date().toISOString(),
          data: { checkOnly: true }
        }
      }
    });
    assert.ok(['CONFIRMED_SUCCESS', 'CONFIRMED_FAILURE', 'UNKNOWN_TIMEOUT'].includes(pingRes.json.outcome), 'SNS proxy must return explicit honest outcome');

    const sbHealthRes = await api(baseUrl, '/api/sns-proxy', {
      method: 'POST',
      cookie: adminCookie,
      body: {
        featureKey: 'supabaseSync',
        isRawBody: true,
        payload: { action: 'health' }
      }
    });
    assert.ok(['CONFIRMED_SUCCESS', 'CONFIRMED_FAILURE', 'UNKNOWN_TIMEOUT'].includes(sbHealthRes.json.outcome), 'Live WF-SUPABASE-SYNC proxy must return explicit honest outcome');
    const unwrappedHealth = sbHealthRes.json.outcome === 'CONFIRMED_SUCCESS' ? unwrapGatewayResponse(sbHealthRes.json) : null;
    if (sbHealthRes.json.outcome === 'CONFIRMED_SUCCESS') {
      assert.strictEqual(unwrappedHealth.ok, true);
      assert.strictEqual(unwrappedHealth.schemaReady, true);
      assert.strictEqual(unwrappedHealth.tableCount, 10);
    }
    step(`Gateway unwrap + live SNS checks (master=${pingRes.json.outcome}, supabaseSync=${sbHealthRes.json.outcome}${sbHealthRes.json.outcome === 'CONFIRMED_SUCCESS' ? `, tables=${unwrappedHealth.tableCount}` : `, http=${sbHealthRes.json.httpStatus}, err=${sbHealthRes.json.error}`})`);

    // 11. User lifecycle Supabase sync payload & zero secret-leak verification
    const cfgSave = await api(baseUrl, '/api/workflows/config', {
      method: 'POST',
      cookie: adminCookie,
      body: {
        authSupabase: `http://127.0.0.1:${mockPort}/auth-supabase`,
        supabaseSync: `http://127.0.0.1:${mockPort}/supabase-sync`
      }
    });
    assert.strictEqual(cfgSave.status, 200);

    // 11a. Admin bulk resync uses WF-SUPABASE-SYNC upsert without triggering insert-only auth webhook
    capturedCalls.length = 0;
    const rBulkSync = await api(baseUrl, '/api/admin/users/sync-supabase', {
      method: 'POST',
      cookie: adminCookie
    });
    assert.strictEqual(rBulkSync.status, 200);
    assert.strictEqual(rBulkSync.json.ok, true);
    assert.ok(rBulkSync.json.confirmedCount >= 2, 'Expected bootstrapped Admin & Staff user confirmed in bulk sync');
    assert.ok(capturedCalls.every((c) => c.url === '/supabase-sync' && c.body.action === 'upsert' && c.body.onConflict === 'email'));

    // 11b. Admin create user dispatches V2 data.user envelope + WF-SUPABASE-SYNC upsert on email
    capturedCalls.length = 0;
    const rAdminCreate = await api(baseUrl, '/api/admin/users', {
      method: 'POST',
      cookie: adminCookie,
      body: {
        name: 'Meera Nair',
        email: 'meera@pallets.io',
        role: 'Inventory Manager',
        storeAccess: 'ALL',
        password: 'ManagerPassword9'
      }
    });
    assert.strictEqual(rAdminCreate.status, 201);
    assert.strictEqual(rAdminCreate.json.supabaseSync.outcome, 'CONFIRMED_SUCCESS');
    const authCreateCall = capturedCalls.find((c) => c.url === '/auth-supabase');
    const syncCreateCall = capturedCalls.find((c) => c.url === '/supabase-sync');
    assert.ok(authCreateCall && syncCreateCall, 'Both WF-AUTH-SUPABASE and WF-SUPABASE-SYNC must fire on user creation');
    assert.strictEqual(authCreateCall.body.event, 'USER_REGISTRATION');
    assert.strictEqual(authCreateCall.body.data.targetDatabase, 'SUPABASE');
    assert.strictEqual(authCreateCall.body.data.table, 'pallets_users');
    assert.strictEqual(authCreateCall.body.data.action, 'INSERT');
    assert.strictEqual(authCreateCall.body.data.user.email, 'meera@pallets.io');
    assert.strictEqual(authCreateCall.body.data.user.store_hub, 'ALL');
    assert.strictEqual(authCreateCall.body.data.user.password_hash_placeholder, '[SCRYPT_SERVER_SIDE]');
    assert.ok(authCreateCall.body.data.user.id.startsWith('USR-'));
    assert.ok(!authCreateCall.rawBody.includes('ManagerPassword9'), 'Raw password must NEVER leak to webhook');
    assert.ok(!authCreateCall.rawBody.includes('scrypt:'), 'Password hash must NEVER leak to webhook');
    assert.strictEqual(syncCreateCall.body.action, 'upsert');
    assert.strictEqual(syncCreateCall.body.onConflict, 'email');
    assert.strictEqual(syncCreateCall.body.table, 'pallets_users');
    assert.strictEqual(syncCreateCall.body.rows[0].store_hub, 'ALL');
    assert.strictEqual(syncCreateCall.body.rows[0].password_hash_placeholder, '[SCRYPT_SERVER_SIDE]');

    // 11c. Admin update user delegates upsert to WF-SUPABASE-SYNC without hitting insert-only auth webhook
    capturedCalls.length = 0;
    const rAdminPatch = await api(baseUrl, `/api/admin/users/${rAdminCreate.json.user.id}`, {
      method: 'PATCH',
      cookie: adminCookie,
      body: { role: 'Staff', storeAccess: 'MUM_BANDRA_HUB', status: 'ACTIVE' }
    });
    assert.strictEqual(rAdminPatch.status, 200);
    assert.strictEqual(rAdminPatch.json.supabaseSync.outcome, 'CONFIRMED_SUCCESS');
    assert.strictEqual(rAdminPatch.json.authWebhookOutcome, 'DELEGATED_TO_GATEWAY');
    const authUpdateCall = capturedCalls.find((c) => c.url === '/auth-supabase');
    const syncUpdateCall = capturedCalls.find((c) => c.url === '/supabase-sync');
    assert.strictEqual(authUpdateCall, undefined, 'Update should delegate to gateway upsert so insert-only Create Row is not hit');
    assert.strictEqual(syncUpdateCall.body.action, 'upsert');
    assert.strictEqual(syncUpdateCall.body.onConflict, 'email');
    assert.strictEqual(syncUpdateCall.body.rows[0].store_hub, 'MUM_BANDRA_HUB');

    // 11d. Public Staff signup dispatches V2 data.user envelope + WF-SUPABASE-SYNC upsert
    capturedCalls.length = 0;
    const rStaffSignup = await api(baseUrl, '/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Vikram Singh',
        email: 'vikram@pallets.io',
        password: 'StaffPassword7',
        storeAccess: 'HYD_HITEC_STORE'
      }
    });
    assert.strictEqual(rStaffSignup.status, 201);
    assert.strictEqual(rStaffSignup.json.supabaseSync.outcome, 'CONFIRMED_SUCCESS');
    const authSignupCall = capturedCalls.find((c) => c.url === '/auth-supabase');
    const selectSignupCall = capturedCalls.find((c) => c.url === '/supabase-sync' && c.body && c.body.action === 'select');
    const syncSignupCall = capturedCalls.find((c) => c.url === '/supabase-sync' && c.body && c.body.action === 'upsert');
    assert.ok(selectSignupCall, 'Public signup must pre-check duplicate email against WF-SUPABASE-SYNC');
    assert.strictEqual(authSignupCall.body.data.action, 'INSERT');
    assert.strictEqual(authSignupCall.body.data.user.store_hub, 'HYD_HITEC_STORE');
    assert.ok(syncSignupCall, 'Public signup must upsert user to WF-SUPABASE-SYNC');
    assert.strictEqual(syncSignupCall.body.action, 'upsert');
    assert.strictEqual(syncSignupCall.body.onConflict, 'email');
    assert.ok(!authSignupCall.rawBody.includes('StaffPassword7'), 'Raw password must NEVER leak on signup');

    step('User lifecycle Supabase sync (bulk resync, Admin create/update, Staff signup) & zero secret-leak verified');

    // 12. Operational table sync (sync-all, products, suppliers, ingestion)
    capturedCalls.length = 0;
    const rSyncAll = await api(baseUrl, '/api/admin/supabase/sync-all', {
      method: 'POST',
      cookie: adminCookie
    });
    assert.strictEqual(rSyncAll.status, 200);
    assert.strictEqual(rSyncAll.json.ok, true);
    const syncedTables = new Set(capturedCalls.filter((c) => c.url === '/supabase-sync').map((c) => c.body.table));
    ['pallets_users', 'pallets_suppliers', 'pallets_products', 'pallets_sales_history', 'pallets_inventory_movements', 'pallets_purchase_orders', 'pallets_apriori_rules'].forEach((t) => {
      assert.ok(syncedTables.has(t), `sync-all must dispatch table ${t}`);
    });

    capturedCalls.length = 0;
    const rNewProd = await api(baseUrl, '/api/ops/products', {
      method: 'POST',
      cookie: adminCookie,
      body: {
        sku: 'SKU-7777-TEST',
        name: 'Test Kombucha 330ml',
        category: 'Beverages',
        hub: 'BLR_NORTH_DC',
        unitPrice: 150,
        costPrice: 80,
        onHand: 120
      }
    });
    assert.strictEqual(rNewProd.status, 201);
    assert.ok(capturedCalls.some((c) => c.body.table === 'pallets_products' && c.body.rows[0].sku === 'SKU-7777-TEST'));
    assert.ok(capturedCalls.some((c) => c.body.table === 'pallets_inventory_movements'));

    capturedCalls.length = 0;
    const rIngest = await api(baseUrl, '/api/ops/ingestion', {
      method: 'POST',
      cookie: adminCookie,
      body: {
        fileName: 'test_batch.csv',
        validRows: [{ sku: 'SKU-7777-TEST', qty: 15 }],
        invalidRows: 0,
        duplicates: 0
      }
    });
    assert.strictEqual(rIngest.status, 201);
    assert.ok(capturedCalls.some((c) => c.body.table === 'pallets_ingestion_logs'));
    assert.ok(capturedCalls.some((c) => c.body.table === 'pallets_sales_history'));
    step('Operational 9-dataset sync-all & CRUD mutations (products, POs, ingestion, movements) dispatch to WF-SUPABASE-SYNC');

    console.log(`\nALL ${passed} VERIFICATION SUITES PASSED.`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await new Promise((resolve) => mockWebhookServer.close(resolve));
    fs.rmSync(TEMP_ROOT, { recursive: true, force: true });
  }
}

runTests().catch((err) => {
  console.error('\nVERIFICATION FAILED:', err);
  process.exit(1);
});
