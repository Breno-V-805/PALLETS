# PALLETS — Master Project Overview & Pitch Dossier

> **Purpose:** Complete technical, product, mathematical, architectural, and business dossier for **PALLETS**, structured for direct handoff to an AI assistant to explain the system, write documentation, or generate a pitch deck and demo script.

---

## 1. Executive Identity & Elevator Pitch

- **Product Name:** **PALLETS** — FMCG AI Predictive Inventory & Replenishment Orchestration Platform (`pallets-fmcg-platform`, v`2.0.0`)
- **Team:** **TALOS** *(Team member names left blank / to be filled in)*
- **Team Members:**
  - `___________________________`
  - `___________________________`
  - `___________________________`
  - `___________________________`
- **One-Line Pitch:** An enterprise B2B SaaS inventory intelligence and automated replenishment platform built for quick-commerce and FMCG dark-store networks—combining real-time AI demand forecasting, mathematical stockout protection, market-basket analytics, an actionable AI Copilot, multi-workflow automation, and full cloud persistence in one zero-dependency workspace.
- **Target Domain & Currency:** Retail & Quick-Commerce FMCG operating across `4` regional Indian dark-store hubs (`BLR_NORTH_DC`, `MUM_BANDRA_HUB`, `DEL_GURGAON_CORE`, `HYD_HITEC_STORE`), modeled in Indian Rupees (`₹`).

---

## 2. The Problem vs. The PALLETS Solution

### Problem Statement
FMCG dark stores operate on tight inventory runways, short shelf lives, supplier Minimum Order Quantities (`MOQ`), and sharp weekend demand volatility (`1.2x`–`1.6x` weekend lift). Retail operations teams regularly run into four structural bottlenecks:
1. **Spreadsheet & Static-Average Blindness:** Fixed trailing averages miss weekly seasonality and trend shifts, hiding impending stockouts until revenue is already lost (`₹`).
2. **Working Capital Trapped in Overstock:** Slow-moving items exceed `35+` days of stock runway without automated rebalance alerts.
3. **Manual Replenishment Error:** Planners compute Reorder Points (`ROP`), Inventory Positions (`IP`), and supplier `MOQ` rounding manually across disconnected sheets.
4. **Fragmented State Across Tools:** POS sales batches, demand forecasts, purchase orders (`PO`s), stock movements, and AI copilot conversations sit outside a shared cloud database.

### How PALLETS Solves It
- **Automated Model Tournament (`WAPE` Selection):** Evaluates `4` time-series models per SKU on an `80%` train / `20%` holdout split and automatically picks the lowest-error winner.
- **Autonomous Risk & Lost-Revenue Radar:** Classifies SKUs continuously into `CRITICAL` (`<= 3.0d`), `HIGH` (`<= 7.0d`), `OVERSTOCK` (`>= 35.0d`), and `OPTIMAL` tiers with stockout ETA dates and daily `₹` revenue exposure.
- **Exact Smart Replenishment Engine:** Computes `ROP`, `IP`, and MOQ-rounded order quantities (`Q`) dynamically and dispatches approved POs in 1 click.
- **Customer Basket Intelligence (Apriori):** Mines frequent co-purchase bundles (`Support %`, `Confidence %`, `Lift`) so merchandising and ops teams coordinate joint safety stock and cross-sell campaigns.
- **Conversational AI Inventory Copilot:** Answers natural-language operational questions and surfaces interactive 1-click PO approval and view navigation shortcuts.
- **Workflow Orchestration + Cloud Persistence:** Orchestrates `9` webhook slots in **SNS Agent Workbench** (`agents.snsihub.ai`) and stores **all `10` visible datasets** in **Supabase PostgreSQL** through a unified Base64 RPC gateway workflow (`WF-SUPABASE-SYNC`).

---

## 3. Role-Based Personas (RBAC) & Dark-Store Network

### Quick-Launch Roles (`OPERATOR_USERS` in `./app.js`)
| Persona | Role | Email | Store Scope | Permissions & UI Behavior |
|---|---|---|---|---|
| **Elena Vance** | `Admin (Supply Chain VP)` | `e.vance@pallets-fmcg.internal` | `ALL` | `['ALL']` — Multi-hub oversight, SNS Workflow Manager (`modal-workflow-manager`), Live SNS Telemetry (`modal-telemetry`), product CRUD, PO approvals. |
| **Devid Franks** | `Inventory Manager` | `d.franks@pallets-fmcg.internal` | `ALL` | `['VIEW_ALL', 'APPROVE_PO', 'RUN_FORECAST', 'INGEST_DATA', 'ADJUST_STOCK']` — Operations, forecasting, POS ingestion, PO approvals; admin SNS infrastructure hidden. |
| **Rahul Sharma** | `Staff (Dark Store Associate)` | `r.sharma@pallets-fmcg.internal` | `BLR_NORTH_DC` | `['VIEW_STORE', 'STOCK_COUNT']` — Strictly scoped to Bangalore North DC (`BLR_NORTH_DC`); blocked from deleting products (`deleteProduct`); `.admin-only` elements hidden and `.normal-only` operational status badge displayed. |

Custom operator registration is also supported through the landing screen / auth modal, synced via `pallets_users` in Supabase and `WF-AUTH-SUPABASE`.

### Regional Dark-Store Hubs (`4` Fulfillment Nodes)
1. `BLR_NORTH_DC` — Bangalore North DC
2. `MUM_BANDRA_HUB` — Mumbai Bandra Hub
3. `DEL_GURGAON_CORE` — Delhi-NCR Core Hub
4. `HYD_HITEC_STORE` — Hyderabad Hitec Store

---

## 4. Architecture & Zero-Dependency Technology Stack

- **Architectural Pattern (see `./SAD.md`):** Client-Orchestrated Serverless Workflow Architecture. Deterministic computations (`ROP`, `IP`, `Q`, `4`-model forecasting tournament, Apriori mining, HTML5 Canvas 2D charting) run in-browser for zero-latency responsiveness, while mutations, multi-step automations, and persistence flow asynchronously over HTTPS JSON to SNS Agent Workbench and Supabase PostgreSQL.
- **Frontend UI:** Pure HTML5 (`./index.html` — `1,498` lines), CSS3 (`./styles.css` — `2,003` lines), Vanilla ES6+ JS (`./app.js` — `2,648` lines). Zero npm dependencies in `package.json` and zero external charting CDNs (only `Inter` and `JetBrains Mono` Google Fonts stylesheet links in `index.html`).
- **Visualization Engine (`./charts.js` — `389` lines):** Custom hardware-DPI HTML5 Canvas 2D engine rendering:
  - `renderSplineChart`: Smooth Bézier spline curves (`14`-day Sales Earnings vs. Baseline Cost).
  - `renderDonutChart`: Segmented donut ring with rounded caps and category holding valuation center label.
  - `renderForecastChart`: Historical vs. forecasted demand plot with shaded `80%` and `95%` prediction intervals.
- **Application Server (`./server.js` — `233` lines):** Zero-dependency Node.js (`>=18.0.0`) HTTP server providing:
  - `gzip` compression and `Cache-Control` optimization (`no-cache` for `index.html`, 1-day cache for static files).
  - Directory traversal protection (`!safePath.startsWith(ROOT_DIR)` -> `HTTP 403`).
  - API & health endpoints: `GET /health` & `GET /api/health`, `GET`/`POST /api/workflows/config`, `POST /api/sns-proxy` (CORS proxy using `X-Target-Webhook`).
- **Deployment Targets:** Ready for **Netlify** (`./netlify.toml`, `./netlify/functions/sns-proxy.js`, `./netlify/functions/workflows-config.js`), **Docker** (`./Dockerfile`), **Render** (`./render.yaml`), **Vercel** (`./vercel.json`), or local PowerShell static serving (`./serve.ps1`).

---

## 5. Mathematical Formulas & AI/ML Engines

### A. Risk & Replenishment Formulas (`./app.js`)
- **Reorder Point (`ROP`):** `ROP = Math.round((dailyDemand * leadTimeDays) + safetyStock)`
- **Inventory Position (`IP`):** `IP = (onHand + onOrder) - reserved`
- **MOQ-Rounded Order Quantity (`Q`):** `Q = Math.ceil(Math.max(0, targetStock - IP) / moq) * moq`
- **Total PO Cost:** `Q * costPrice`
- **Stock Runway (Days):** `onHand / dailyDemand` (`999` if `dailyDemand <= 0`, rounded to 1 decimal place)
- **Lead-Time Lost Revenue Risk:** `Math.round(Math.max(1, leadTimeDays - Math.floor(runway)) * dailyDemand * unitPrice)` when `runway < leadTimeDays` (otherwise `0`)
- **Risk Status Classification (`evaluateRiskStatus`):**
  - `CRITICAL`: `runway <= 3.0` days
  - `HIGH`: `3.0 < runway <= 7.0` days
  - `OVERSTOCK`: `runway >= 35.0` days (exposes `40%` rebalance stock transfer)
  - `OPTIMAL`: `7.0 < runway < 35.0` days

### B. 4-Model Demand Forecasting Tournament (`PalletsForecastingEngine` in `./forecasting-engine.js` — `223` lines)
- **Validation Strategy:** Requires `>= 14` days of daily demand history (`90` days seeded per SKU). Applies a chronological **`80%` Training / `20%` Holdout Test** split.
- **Candidate Models:**
  1. `MOVING_AVERAGE_7D` (7-day trailing average)
  2. `MOVING_AVERAGE_14D` (14-day trailing average)
  3. `EXPONENTIAL_SMOOTHING_HOLT` (Holt's Linear double exponential smoothing: `alpha = 0.3`, `beta = 0.1`)
  4. `HOLT_WINTERS_WEEKLY` (Holt-Winters triple exponential smoothing: `seasonLength = 7`, `alpha = 0.2`, `beta = 0.1`, `gamma = 0.3`)
- **Selection Criterion:** Computes **MAE**, **RMSE**, and **WAPE** on the holdout window; selects the winning model minimizing **WAPE** (tie-breaking on **RMSE**).
- **Forward Projection:** Generates `7`-day, `30`-day, or `90`-day trajectories scaled by an interactive `promoBoost` slider and draws **`80%` (`1.28 * sigma`)** and **`95%` (`1.96 * sigma`)** uncertainty bands.

### C. Market Basket Analytics (`PalletsAprioriEngine` in `./apriori-engine.js` — `120` lines)
- `runApriori` mines multi-item customer transactions using `minSupport` (default `0.05`) and `minConfidence` (default `0.35`).
- Extracts frequent 1-itemsets and 2-itemsets to evaluate **Support %**, **Confidence %**, and **Lift**, ranking rules by Lift: `VERY_STRONG` (`lift >= 2.0`), `STRONG` (`lift >= 1.2`), or `MODERATE`.

---

## 6. UI Workspace Modules & Master Benchmark Dataset

### Navigation Structure (`./index.html`)
- **Sidebar Navigation (`8` items):** `Overview` (`Summary` & `Risk Radar` sub-items), `Products`, `Inventory`, `Sales Ingestion`, `Smart Replenishment`, `Suppliers`, `Customer Basket (Apriori)`, `AI Demand Forecasting`.
- **Content Panels (`8` panels):** `panel-overview`, `panel-products`, `panel-ingestion`, `panel-forecasting`, `panel-risks`, `panel-replenishment`, `panel-analytics`, `panel-suppliers`.
- **Interactive Overlays:** `modal-add-product`, `modal-approve-po`, `modal-workflow-manager` (Admin), `modal-telemetry` (Admin), `modal-auth`, and the floating AI Copilot drawer (`copilot-drawer`).
- **Benchmark Ingestion Loader:** One-click synthetic POS benchmark loader simulates `18,450` orders across all `4` regional dark stores (`90` days x `12` SKUs = `1,080` daily sales rows).

### Seeded Master Catalog (`12` FMCG SKUs in `./app.js`)
| SKU | Product Name | Category | Hub | Retail / Cost (`₹`) | On Hand / Reserved / On Order | Daily Demand / Lead / Safety / Target / MOQ |
|---|---|---|---|---|---|---|
| `SKU-9921-OAT` | Oatly Barista Oat Milk 1L | Dairy & Chilled | `BLR_NORTH_DC` | ₹280 / ₹195 | `142` / `40` / `500` | `310` / `2d` / `300` / `2000` / `500` |
| `SKU-8842-COLD` | Blue Tokai Cold Brew Can 250ml | Beverages & Cold Brew | `MUM_BANDRA_HUB` | ₹160 / ₹110 | `86` / `20` / `0` | `195` / `3d` / `250` / `1500` / `300` |
| `SKU-7714-PODS` | Ariel Matic 3-in-1 Pods 32x | Home Care | `DEL_GURGAON_CORE` | ₹850 / ₹590 | `6400` / `120` / `0` | `110` / `7d` / `350` / `1400` / `200` |
| `SKU-6631-RICE` | Daawat Biryani Basmati 5kg | Staples & Grains | `HYD_HITEC_STORE` | ₹620 / ₹440 | `19` / `10` / `0` | `85` / `4d` / `200` / `800` / `150` |
| `SKU-5520-YOGU` | Epigamia Greek Yogurt 400g | Dairy & Chilled | `BLR_NORTH_DC` | ₹140 / ₹95 | `38` / `15` / `0` | `140` / `1d` / `180` / `700` / `200` |
| `SKU-4412-CHIP` | Doritos Nacho Cheese 150g | Snacks & Confectionery | `MUM_BANDRA_HUB` | ₹90 / ₹62 | `9200` / `200` / `0` | `260` / `5d` / `600` / `2500` / `500` |
| `SKU-3389-SALT` | Tata Salt Immuno Lite 1kg | Staples & Grains | `DEL_GURGAON_CORE` | ₹32 / ₹22 | `4800` / `150` / `2000` | `420` / `3d` / `1200` / `4500` / `1000` |
| `SKU-2290-BODY` | Dove Deep Moisture 800ml | Personal Care | `DEL_GURGAON_CORE` | ₹499 / ₹340 | `14` / `8` / `0` | `65` / `2d` / `100` / `450` / `100` |
| `SKU-1108-CHIL` | Sichuan Chilli Crisp Oil 210g | Condiments & Sauces | `BLR_NORTH_DC` | ₹390 / ₹260 | `1850` / `25` / `0` | `18` / `14d` / `80` / `300` / `200` |
| `SKU-7750-ATTA` | Aashirvaad Select Sharbati 10kg | Staples & Grains | `MUM_BANDRA_HUB` | ₹580 / ₹410 | `2200` / `180` / `1500` | `380` / `3d` / `800` / `2600` / `500` |
| `SKU-9021-ENERGY` | Red Bull Energy 250ml 4-Pack | Beverages & Cold Brew | `DEL_GURGAON_CORE` | ₹450 / ₹315 | `24` / `12` / `0` | `110` / `2d` / `150` / `600` / `100` |
| `SKU-8819-CHOCO` | Ferrero Rocher T16 200g | Snacks & Confectionery | `HYD_HITEC_STORE` | ₹595 / ₹410 | `3400` / `80` / `0` | `72` / `4d` / `250` / `900` / `200` |

### Verified Suppliers Directory (`6` Vendors in `./app.js`)
| ID | Supplier Name | Lead Time | Reliability | Defect Rate | On-Time Delivery | Default MOQ |
|---|---|---|---|---|---|---|
| `SUP-01` | Oatly Indo-Pacific Logistics Pvt Ltd | `2d` | `99.1%` | `0.12%` | `98.4%` | `500` |
| `SUP-02` | Blue Tokai Roasters Direct | `3d` | `97.8%` | `0.28%` | `96.2%` | `300` |
| `SUP-03` | Drums Food International (Epigamia) | `1d` | `98.9%` | `0.08%` | `99.1%` | `200` |
| `SUP-04` | LT Foods Ltd National Supply (Daawat) | `4d` | `96.5%` | `0.45%` | `94.8%` | `150` |
| `SUP-05` | Hindustan Unilever Ltd (Dove) | `2d` | `99.4%` | `0.05%` | `99.0%` | `100` |
| `SUP-06` | PepsiCo India Holdings (Doritos) | `5d` | `95.2%` | `0.62%` | `93.5%` | `500` |

---

## 7. SNS Agent Workbench & Unified 10-Table Supabase Gateway

### Multi-Workflow Webhooks (`./webhooks-config.json` & `./sns-webhook.js`)
| Registry Key | Workflow ID | Configured Webhook URL | Primary Function & Chaining |
|---|---|---|---|
| `master` | `WF-MASTER` | `https://api.agents.snsihub.ai/webhook/cc0a6272-8aba-45b2-916a-b44905b2386a` | Central gateway & fallback event router |
| `supabaseSync` | `WF-SUPABASE-SYNC` | `""` *(Pending URL after SNS workflow publish)* | Single 4-node Base64-RPC CRUD bridge for all `10` Supabase tables |
| `authSupabase` | `WF-AUTH-SUPABASE` | `https://api.agents.snsihub.ai/webhook/40832378-4e7b-4a82-824f-963709fb5119` | User registration sync |
| `ingestion` | `WF-INGEST` | `https://api.agents.snsihub.ai/webhook/6793b021-48d8-468c-bc57-26a1853e7542` | POS normalization & deduplication -> chains to `WF-FORECAST` |
| `forecasting` | `WF-FORECAST` | `https://api.agents.snsihub.ai/webhook/4798f7a4-a61f-43dc-a773-fa7d36475b2f` | Model tournament metrics -> chains to `WF-RISK` |
| `risks` | `WF-RISK` | `https://api.agents.snsihub.ai/webhook/fed236f4-1544-42da-8520-d66fa14cce44` | Stockout deficit radar -> chains to `WF-REPLENISH` |
| `replenishment` | `WF-REPLENISH` | `https://api.agents.snsihub.ai/webhook/2efb1af6-df78-48d1-b03a-896ec79a82b9` | PO validation (`ROP`/`IP`/`Q`/`MOQ`) -> chains to `WF-SUPPLIER` |
| `suppliers` | `WF-SUPPLIER` | `https://api.agents.snsihub.ai/webhook/3c2f7abd-1599-4a00-b40b-f31e4019cd21` | SLA lead-time & arrival confirmation |
| `copilot` | `WF-COPILOT` | `https://api.agents.snsihub.ai/webhook/a1e7b69a-093a-47fe-8fd8-d10139ed707a` | Federated conversational AI Copilot |

### Unified Supabase Persistence (`10` Tables & `public.pallets_gateway` in `./supabase-schema.sql`)
Every dataset rendered in the dashboard maps to one relational schema in Supabase (`441` lines SQL) and synchronizes via `PalletsSupabaseClient` (`./supabase-client.js` — `777` lines) through the single `WF-SUPABASE-SYNC` workflow (`Webhook` -> UTF-8 Base64 `Code` -> Supabase PostgREST RPC `HTTP Request` -> `Webhook Response`):

1. `pallets_users` — Operator profiles, roles, assigned hub, JSONB permissions.
2. `pallets_suppliers` — Supplier directory and SLA scorecards.
3. `pallets_products` — Live SKU inventory parameters, pricing, and thresholds.
4. `pallets_sales_history` — Daily SKU unit sales and revenue (`id = <sku>__<date>`).
5. `pallets_inventory_movements` — Full audit ledger (`STOCK_ADJUSTMENT`, `DC_REBALANCE`, `INBOUND_PO`, `SKU_CREATED`).
6. `pallets_ingestion_logs` — Batch validation logs (parsed rows vs. duplicates skipped).
7. `pallets_purchase_orders` — Dispatched replenishment POs (`po_number`, `order_qty`, `total_cost`, `rationale`).
8. `pallets_forecast_runs` — Stored tournament results (`winning_model`, `mae`, `rmse`, `wape_pct`, JSONB comparison & timeline).
9. `pallets_apriori_rules` — Association rules (`antecedent`, `consequent`, `support_pct`, `confidence_pct`, `lift`, `bundle_strength`).
10. `pallets_copilot_logs` — Prompt, formatted response, latency (`latency_ms`), and interactive action chips.

**Key Persistence Engineering Details:**
- **Safe UTF-8 Transport:** Pure-JS UTF-8 Base64 encoding prevents low-code JSON parsing errors caused by `₹`, quotes, or newlines before Postgres decodes via `decode(p_b64, 'base64')`.
- **Auto-Seeding & Chunked Upserts:** On initial connection to empty tables, `bootstrapState` seeds baseline data automatically, deduplicates conflict keys, and chunks `1,080` sales history rows into `250`-row batches.
- **Database Security:** Service Role credentials stay solely inside SNS Agent Workbench HTTP headers; `public.pallets_gateway` enforces an explicit 10-table allowlist, validates columns via `information_schema.columns`, and blocks unfiltered `UPDATE`/`DELETE` calls.

---

## 8. File Map, Technical Status & Known Limitations

### Active Runtime & Documentation Files
- **UI & Styling:** `./index.html` (`1,498` lines), `./styles.css` (`2,003` lines), `./pallets-logo.png`
- **Client Modules:** `./app.js` (`2,648` lines), `./supabase-client.js` (`777` lines), `./sns-webhook.js` (`421` lines), `./charts.js` (`389` lines), `./forecasting-engine.js` (`223` lines), `./apriori-engine.js` (`120` lines)
- **Server, Proxy & Database:** `./server.js` (`233` lines), `./supabase-schema.sql` (`441` lines), `./webhooks-config.json`, `./package.json`, `./netlify.toml`, `./netlify/functions/sns-proxy.js`, `./netlify/functions/workflows-config.js`
- **Docs & Deployment:** `./SAD.md` (`362` lines), `./PRD.md` (`276` lines), `./SNS_NODE_BUILDING_MANUAL.md`, `./SNS_WORKFLOWS_GUIDE.md`, `./DEPLOYMENT.md`, `./README.md`, `./GEMINI.md`, `./Dockerfile`, `./render.yaml`, `./vercel.json`, `./serve.ps1`
- **Legacy / Unloaded Files in Folder:** `./landing-canvas.js`, `./pallets-3d.js`, `./pallets-audio.js`, `./three.min.js`, `./sns-agent-client.js`, and empty folder `./PalletsV2/` exist in the workspace but are **not** loaded by `./index.html`.

### Current Readiness & Known Scope Boundaries
- **JS Syntax Check:** `node --check` passes cleanly on all `9` active JS modules (`app.js`, `apriori-engine.js`, `charts.js`, `forecasting-engine.js`, `sns-webhook.js`, `supabase-client.js`, `server.js`, `netlify/functions/sns-proxy.js`, `netlify/functions/workflows-config.js`).
- **Pending Live Connection Step:** `supabaseSync` in `./webhooks-config.json` is set to `""` until the user pastes the live `WF-SUPABASE-SYNC` webhook URL from SNS Agent Workbench (when unconfigured or offline, the app falls back smoothly to local browser cache/state).
- **Auth Prototype Boundary:** Current authentication uses email/role lookup with `[SECURE_ARGON2_HASH]` placeholders in `pallets_users` rather than cryptographic password verification / Supabase Auth JWT + multi-tenant PostgreSQL RLS.
- **Scale & Execution Boundary:** Analytics execute inside the browser tab for fast dark-store responsiveness rather than multi-million-row distributed ETL workers.

---

## 9. Core Pitch Angles & Roadmap Hooks

1. **Zero-Blindspot Dark-Store Economics:** Unifies daily `₹` sales velocity, `₹` inventory holding valuation, imminent stockout revenue exposure (`₹`), and surplus holding bleed (`>= 35d` runway) in one executive command center.
2. **Self-Calibrating Time-Series AI:** Eliminates one-size-fits-all averages by running a `4`-model holdout tournament per SKU (`WAPE` / `RMSE`), modeling weekly FMCG spikes (`Holt-Winters m=7`), and visualizing `80%`/`95%` risk bands.
3. **1-Click Mathematical Execution:** Connects forecasting directly to exact `ROP`/`IP`/`MOQ` calculations, conversational Copilot recommendations, and live SNS Workbench PO dispatch.
4. **Lean, Zero-Bloat Architecture:** Zero npm packages or third-party charting bloat, clean RBAC separation (`Admin`, `Manager`, hub-scoped `Staff`), and full 10-table Supabase persistence secured behind one PostgreSQL RPC gateway.
5. **Clear Enterprise Expansion Path:** Supabase Auth JWTs & multi-tenant SaaS tiers, scheduled nightly autonomous forecast-to-PO crons, lot-level `FEFO` perishable expiry markdowns, live POS/ERP Goods Receipt Note webhooks, and freight-minimizing multi-hub transfer optimization.

