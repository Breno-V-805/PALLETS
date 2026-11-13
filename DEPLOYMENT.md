# PALLETS // Server Deployment Guide

The Pallets FMCG platform is pre-configured for **Netlify** with automatic SSL, zero build steps, and serverless functions for persistent memory and webhook proxying.

---

## ✦ Deploying to Netlify (3 Simple Ways)

### Method A: Drag & Drop (Fastest — 20 Seconds, Zero Commands)
1. Go to **[app.netlify.com/drop](https://app.netlify.com/drop)** in your web browser.
2. Sign in to your Netlify account (free).
3. Drag and drop this workspace folder (`d:\metreecs-fmcg-dashboard`) into the dashed box on the page.
4. Netlify will instantly upload, build the functions, and give you a permanent live HTTPS link like:
   `https://pallets-fmcg.netlify.app`

---

### Method B: Netlify CLI (Deploy from Terminal)
In your workspace terminal:
```bash
npx netlify deploy --prod
```
1. It will ask: *"Create & configure a new site?"* ➔ Select **Yes**.
2. Select your Netlify team.
3. When prompted for *Publish directory*, press Enter (defaults to `.`).
4. In ~15 seconds, your site is live!

---

### Method C: GitHub Continuous Deployment (Auto-Update on Every Git Push)
1. Push this project to your GitHub repository:
   ```bash
   git init
   git add .
   git commit -m "Initial commit of Pallets FMCG Platform"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-repo-name>.git
   git push -u origin main
   ```
2. In Netlify Dashboard, click **Add new site** ➔ **Import an existing project** ➔ select **GitHub**.
3. Choose your repository. Netlify automatically detects [`netlify.toml`](file:///./netlify.toml) and deploys immediately.
4. Every time you push changes to GitHub, Netlify redeploys automatically.

---

## ✦ Built-In Netlify Serverless Functions

Your project includes two serverless backend functions:
1. **`/.netlify/functions/workflows-config`** (routed from `/api/workflows/config`):
   - Keeps your SNS Agent Workbench webhook URLs stored in memory in the cloud so you never have to re-type them.
2. **`/.netlify/functions/sns-proxy`** (routed from `/api/sns-proxy`):
   - Handles server-side communication to `https://api.agents.snsihub.ai/webhook/...` from Netlify's high-speed edge network.

---

## Option 2: Linux / Cloud VPS (AWS EC2, DigitalOcean, Hetzner, Linode)

1. **Copy or clone files to your server**:
   ```bash
   git clone <your-repo> /var/www/pallets
   cd /var/www/pallets
   ```

2. **Run with Node.js**:
   ```bash
   node server.js
   ```

3. **Run 24/7 in Background with PM2**:
   ```bash
   npm install -g pm2
   pm2 start server.js --name "pallets"
   pm2 save
   pm2 startup
   ```

4. **(Optional) Nginx Reverse Proxy with SSL (Port 80/443)**:
   ```nginx
   server {
       listen 80;
       server_name inventory.yourcompany.com;

       location / {
           proxy_pass http://127.0.0.1:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

---

## Option 3: Docker Container

Build and run anywhere with Docker:
```bash
docker build -t pallets-fmcg .
docker run -d -p 80:8080 --name pallets-app pallets-fmcg
```

---

## Option 4: Instant Public Tunnel (Share with Teammates Right Now)

To share a live public HTTPS link from your current machine without deploying:
```bash
npm run tunnel
```
Or with Cloudflare Tunnel:
```bash
npx cloudflared tunnel --url http://localhost:3000
```



---

## Supabase Persistence Setup (Single SNS Workbench Workflow — Zero Netlify Env Vars)

Pallets stores all 10 application datasets (`pallets_users`, `pallets_suppliers`, `pallets_products`, `pallets_sales_history`, `pallets_inventory_movements`, `pallets_ingestion_logs`, `pallets_purchase_orders`, `pallets_forecast_runs`, `pallets_apriori_rules`, `pallets_copilot_logs`) in PostgreSQL via a single SNS Workbench workflow (`WF-SUPABASE-SYNC`) calling `public.pallets_gateway(p_b64)`.

### 1. Create Tables & RPC Gateway in Supabase
1. Open your **Supabase Dashboard -> SQL Editor -> New Query**.
2. Paste the entire contents of `supabase-schema.sql` (which creates all 10 tables plus the `public.pallets_gateway` RPC function) and click **Run**.

### 2. Build the Single `WF-SUPABASE-SYNC` Workflow in SNS Workbench
Follow the exact 4-node recipe (`Webhook` -> `Code` -> `HTTP Request` -> `Webhook Response`) in `SNS_NODE_BUILDING_MANUAL.md` under **Workflow 7: `WF-SUPABASE-SYNC`**. Copy its live Webhook URL (`https://api.agents.snsihub.ai/webhook/<id>`).

### 3. Connect in Dashboard (or Save to `webhooks-config.json`)
1. Sign in as **Admin** (`Elena Vance`), click **Settings** (or the yellow **`Cloud DB: Connect WF-SUPABASE-SYNC`** badge in the header), paste the URL into **`WF-SUPABASE-SYNC`**, and click **Save Workflow Endpoints** (or add it to `"supabaseSync"` in `webhooks-config.json`).
2. The dashboard immediately verifies `schemaReady`, auto-seeds any empty tables, and updates the badge to **`Cloud DB: Supabase Live (10 Tables)`**.
