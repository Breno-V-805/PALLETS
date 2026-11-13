# PALLETS V3 // Vercel Deployment & Production Orchestration Guide

This guide details how to deploy **PALLETS V3** (Dark Industrial FMCG Predictive Inventory Control Plane) to **Vercel** with full zero-npm serverless execution, automated Admin provisioning, cross-instance session synchronization, and seamless SNS Agent Workbench integration.

---

## 1. Architecture on Vercel Serverless

PALLETS V3 runs on Vercel with **zero external npm runtime dependencies**, leveraging Node.js native standard libraries:

| Layer | Local Execution | Vercel Serverless Execution |
|---|---|---|
| **Static Assets** | Served by `server.js` | Served directly by Vercel Global Edge CDN (`/index.html`, `/styles/**`, `/js/**`, `/assets/**`) |
| **API Backend** | `http.createServer()` on port 3001 | Serverless Function at `api/index.js` + catch-all `api/[...all].js` |
| **Routing** | URL path resolution | `vercel.json` rewrites `/api/(.*)` to `/api/index.js?__pallets_path=/$1` |
| **Filesystem** | Local `.data/` and `.secrets/` | Read-only detection with auto-fallback to `/tmp/pallets_v3/` |
| **Admin Provisioning** | Console one-time bootstrap token | Environment variables (`PALLETS_ADMIN_EMAIL` & `PALLETS_ADMIN_PASSWORD`) auto-provisioned across all serverless instances |
| **Sessions** | Local secret key in `.secrets/` | `PALLETS_SESSION_SECRET` environment variable ensures seamless session verification across cold starts |
| **CORS & Preflight** | Built-in | Full support for `OPTIONS 204` preflight and dynamic `Access-Control-Allow-Origin` |

---

## 2. Step-by-Step Deployment Methods

### Option A: Deploy via GitHub (Recommended)

1. **Push your code to GitHub**:
   - Ensure the `PALLETS-V3` directory is included in your repository.
2. **Go to Vercel**:
   - Open [https://vercel.com/new](https://vercel.com/new) and log in.
   - Click **Import** next to your GitHub repository.
3. **Configure Project Settings**:
   - **Project Name**: `pallets-v3` (or any name you prefer).
   - **Root Directory**:
     - If the whole repository is `metreecs-fmcg-dashboard`, click **Edit** and choose `PALLETS-V3`.
     - If you pushed *only* the contents of `PALLETS-V3` to its own repository, leave Root Directory as `./`.
   - **Framework Preset**: Select **Other**.
   - **Build Command**: Leave empty / toggle OFF (no compilation step needed).
   - **Output Directory**: Leave empty / toggle OFF.
4. **Configure Environment Variables** (Critical for Serverless Persistence):
   In the **Environment Variables** section, add the following key-value pairs:

   | Variable Name | Example Value | Description |
   |---|---|---|
   | `PALLETS_SESSION_SECRET` | `4f8a9e2c6b1d7e3a5f0c8b2d4e6a8f0c2e4a6b8d0e2f4a6c8e0b2d4f6a8c0e2a` | 64-character hex secret for signing session cookies across cold starts. |
   | `PALLETS_ADMIN_EMAIL` | `admin@pallets.enterprise` | Primary Administrator email (auto-created on startup). |
   | `PALLETS_ADMIN_PASSWORD` | `PalletsAdmin2026!` | Primary Administrator password (min 8 chars, letter + number). |
   | `PALLETS_ADMIN_NAME` | `Elena Vance` | Administrator display name. |
   | `NODE_ENV` | `production` | Production environment flag. |

5. **Deploy**:
   - Click **Deploy**.
   - Vercel will build and assign a production URL (e.g., `https://pallets-v3.vercel.app`).
   - Open the URL in your browser: you can immediately sign in with `admin@pallets.enterprise` and your password!

---

### Option B: Deploy via Vercel CLI (Fast Terminal Deploy)

If you have Node.js installed locally, you can deploy directly from your terminal:

```powershell
# Navigate into the PALLETS-V3 directory
cd d:\metreecs-fmcg-dashboard\PALLETS-V3

# Run Vercel CLI (downloads and runs via npx without global install)
npx vercel
```

1. Log in via your browser when prompted.
2. Confirm the project path (`./`).
3. Set project name (`pallets-v3`).
4. When asked "Want to modify settings?", select `No`.
5. Add your environment variables:
```powershell
npx vercel env add PALLETS_SESSION_SECRET production
npx vercel env add PALLETS_ADMIN_EMAIL production
npx vercel env add PALLETS_ADMIN_PASSWORD production
npx vercel env add PALLETS_ADMIN_NAME production
```
6. Deploy to production:
```powershell
npx vercel --prod
```

---

## 3. Resolving the Errors Shown in Screenshots

### Issue 1: "Failed to fetch" on Admin Bootstrap

![Admin Bootstrap Error](file:///C:/Users/breno/.gemini/antigravity/brain/5b4fb5af-4afb-4542-a696-f76143fdf94b/.user_uploaded/media_1794463742371_d7e47093.jpg)

**Why this happened:**
1. **Accidental Server Termination (PowerShell Ctrl+C)**: In Windows PowerShell, pressing `Ctrl+C` while selecting or copying the one-time bootstrap token sends a `SIGINT` signal that **terminates the Node.js server**. When you returned to the browser and clicked "Initialize System Administrator", the server was no longer listening, causing the browser to throw `Failed to fetch`.
2. **Opening as `file:///`**: If `index.html` is opened directly via File Explorer (`file:///...`), browser security policies block relative `fetch('/api/...')` requests.
3. **Cross-Origin / Preflight**: Without CORS headers, any cross-port or cross-origin requests are blocked with `Failed to fetch`.

**How it is fixed in PALLETS V3:**
- **On Local PC**: Use **Right-Click** or **Ctrl+Shift+C** to copy the token in PowerShell so the server stays active. Or simply run `.\start-v3.ps1` and open `http://localhost:3001`.
- **On Vercel**: You do **not** need to manually bootstrap! Setting `PALLETS_ADMIN_EMAIL` and `PALLETS_ADMIN_PASSWORD` in Vercel environment variables automatically provisions the Admin on cold start. Simply click the **Sign In** tab and enter your credentials.
- **Built-in CORS & OPTIONS**: Full preflight handling (`OPTIONS 204`) and dynamic origin headers are now active on all `/api/*` endpoints.

---

### Issue 2: Supabase `duplicate key value violates unique constraint "pallets_users_email_key1"`

![Supabase Duplicate Key Error](file:///C:/Users/breno/.gemini/antigravity/brain/5b4fb5af-4afb-4542-a696-f76143fdf94b/.user_uploaded/media_1794464981691_7676aadc.png)

**Why this happened:**
- In SNS Agent Workbench, the Supabase node was configured with **Operation: `Create row`**.
- In PostgreSQL/Supabase, the `pallets_users` table specifies `email TEXT UNIQUE NOT NULL`.
- `Create row` performs an `INSERT`. When a user with that email already exists (from a previous test, staff signup, or admin sync), PostgreSQL rejects the insert with `pallets_users_email_key1` duplicate key error.

**How to configure in SNS Agent Workbench:**
1. In your SNS Agent Workbench canvas for `WF-SUPABASE-SYNC`:
2. Click the Supabase node (**Create row Row**).
3. Change the **Operation** parameter dropdown from **`Create row`** to **`Upsert row`** (or **`Upsert`**).
4. Set matching column / conflict target to **`email`**.
5. PALLETS V3 already dispatches payload with:
   ```json
   {
     "operation": "upsert",
     "table": "pallets_users",
     "onConflict": "email",
     "records": [...]
   }
   ```
6. Click **Execute Step** — it will now succeed idempotently whether the user is new or already exists!

---

## 4. Webhook Registry Verification

All 9 SNS Agent Workbench webhooks are active and preserved verbatim in `webhooks-config.json`:

```json
{
  "master": "https://api.agents.snsihub.ai/webhook/cc0a6272-8aba-45b2-916a-b44905b2386a",
  "supabaseSync": "https://api.agents.snsihub.ai/webhook/339f3866-bb32-40ba-9849-c83dcc1df790",
  "authSupabase": "https://api.agents.snsihub.ai/webhook/40832378-4e7b-4a82-824f-963709fb5119",
  "ingestion": "https://api.agents.snsihub.ai/webhook/6793b021-48d8-468c-bc57-26a1853e7542",
  "forecasting": "https://api.agents.snsihub.ai/webhook/4798f7a4-a61f-43dc-a773-fa7d36475b2f",
  "risks": "https://api.agents.snsihub.ai/webhook/fed236f4-1544-42da-8520-d66fa14cce44",
  "replenishment": "https://api.agents.snsihub.ai/webhook/2efb1af6-df78-48d1-b03a-896ec79a82b9",
  "suppliers": "https://api.agents.snsihub.ai/webhook/3c2f7abd-1599-4a00-b40b-f31e4019cd21",
  "copilot": "https://api.agents.snsihub.ai/webhook/a1e7b69a-093a-47fe-8fd8-d10139ed707a"
}
```

---

## 5. Automated Verification Checklist

To re-run the 12-suite automated verification locally at any time:

```powershell
cd d:\metreecs-fmcg-dashboard\PALLETS-V3
npm test
```

Expected output:
```
ALL 12 VERIFICATION SUITES PASSED.
```

