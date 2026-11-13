# SOFTWARE ARCHITECTURE DOCUMENT

**PALLETS**  
**FMCG AI Predictive Inventory & Replenishment Orchestration Platform**

**Team Name:** TALOS  
**Team Members:**  
- ___________________________  
- ___________________________  
- ___________________________  
- ___________________________  

**Document Version:** Version 1.0  
**Date:** November 2026  

---

## 1. System Overview

### 1.1 Brief Description

PALLETS is an enterprise B2B SaaS web platform built for fast-moving consumer goods (FMCG) retail inventory intelligence, dark-store replenishment, demand forecasting, and market-basket analytics across regional fulfillment centers (`BLR_NORTH_DC`, `MUM_BANDRA_HUB`, `DEL_GURGAON_CORE`, `HYD_HITEC_STORE`).

- **Operational Inventory & Supply Chain Workspace:** Role-scoped interface supporting live KPI monitoring, regional dark-store filtering, SKU catalog management, stock adjustments, inter-hub rebalancing, POS CSV/JSON ingestion, supplier SLA tracking, AI demand forecast tournaments, autonomous risk detection, and purchase order (PO) approval dispatch.
- **Role-Based Access Control (RBAC):** Supports three distinct operational personas — **Admin (Supply Chain VP)** (`Elena Vance`), **Inventory Manager** (`Devid Franks`), and **Store Staff / Dark Store Associate** (`Rahul Sharma`) — plus custom user registration synced across sessions and devices.
- **Core Client Engines:** Zero-dependency vanilla HTML5, CSS3, ES6+ JavaScript UI and HTML5 Canvas 2D charting paired with deterministic client-side time-series forecasting (`PalletsForecastingEngine`) and association rule mining (`PalletsAprioriEngine`).
- **Workflow Orchestration & Cloud Persistence:** Integrates directly with **SNS Agent Workbench** multi-workflow webhooks (`WF-MASTER`, `WF-INGEST`, `WF-FORECAST`, `WF-RISK`, `WF-REPLENISH`, `WF-SUPPLIER`, `WF-COPILOT`, `WF-AUTH-SUPABASE`, and `WF-SUPABASE-SYNC`) alongside **Supabase PostgreSQL** (`10` relational tables accessed through a unified PostgreSQL RPC gateway function `public.pallets_gateway`).

### 1.2 Overall Architecture Approach

PALLETS follows a decoupled **Client-Orchestrated Serverless Workflow Architecture** paired with a zero-dependency local/production Node.js HTTP server (`server.js`) and optional static CDN hosting (`netlify.toml`).

Rather than burying business math behind slow database round-trips or heavy third-party frameworks, analytical engines and mathematical formulas (`ROP`, `IP`, `Q`, `MOQ` ceiling, 4-model forecasting tournament, Apriori basket mining, and Canvas visualizations) execute deterministically in browser memory for instant responsiveness, while mutations and workflow telemetry synchronize asynchronously over HTTPS JSON payloads with SNS Agent Workbench and Supabase PostgreSQL.

| Operational Request Flow |
|---|
| User (`Admin` / `Manager` / `Staff`) → Browser Web UI (`index.html` + `app.js`) → Client Compute (`forecasting-engine.js`, `apriori-engine.js`, `charts.js`) |
| Persistence Flow → `supabase-client.js` (`PalletsSupabaseClient`) → HTTPS `POST` → SNS Workbench (`WF-SUPABASE-SYNC`) → Supabase PostgREST RPC (`public.pallets_gateway`) → 10 PostgreSQL `pallets_*` Tables |
| Event Orchestration Flow → `sns-webhook.js` (`SnsWebhookClient`) → Multi-Workflow Webhooks (`WF-INGEST`, `WF-FORECAST`, `WF-RISK`, `WF-REPLENISH`, `WF-SUPPLIER`, `WF-COPILOT`, `WF-AUTH-SUPABASE`) → Telemetry Terminal |

---

## 2. Architecture Diagram

### 2.1 Component-Level Architecture

| Component Layer Pipeline |
|---|
| **Client Workspace Layer:** Landing Auth Screen & Enterprise Terminal UI (`index.html`, `styles.css`, `app.js`) |
| **Client Intelligence & Charting:** `PalletsForecastingEngine` (`forecasting-engine.js`) \| `PalletsAprioriEngine` (`apriori-engine.js`) \| `PalletsCharts` Canvas 2D (`charts.js`) |
| **Integration & Sync Adapters:** `SnsWebhookClient` (`sns-webhook.js`) \| `PalletsSupabaseClient` (`supabase-client.js`) |
| **Delivery & Config Tier:** Zero-Dependency Node.js Server (`server.js`) \| Netlify Static CDN & `/api/sns-proxy` + `/api/workflows/config` (`netlify/functions/`) |
| **SNS Agent Workbench Layer:** `WF-MASTER` \| `WF-INGEST` → `WF-FORECAST` → `WF-RISK` → `WF-REPLENISH` → `WF-SUPPLIER` \| `WF-COPILOT` \| `WF-AUTH-SUPABASE` \| `WF-SUPABASE-SYNC` |
| **Supabase Data Tier:** `public.pallets_gateway(p_b64 text)` RPC → 10 PostgreSQL `pallets_*` Tables (`pallets_users`, `pallets_suppliers`, `pallets_products`, `pallets_sales_history`, `pallets_inventory_movements`, `pallets_ingestion_logs`, `pallets_purchase_orders`, `pallets_forecast_runs`, `pallets_apriori_rules`, `pallets_copilot_logs`) |

### Architecture Responsibilities

| Component | Primary Responsibility |
|---|---|
| `index.html` & `styles.css` | Semantic single-page application shell, Enterprise SaaS design system, role-visibility classes (`.admin-only`, `.normal-only`), modals, and Copilot drawer. |
| `app.js` | Central state machine coordinating RBAC, filtering, KPIs, replenishment formulas, modals, CSV export, DOM rendering, and persistence triggers. |
| `forecasting-engine.js` | Runs 4-candidate time-series tournament with 80%/20% holdout validation, calculates MAE/RMSE/WAPE, and computes 80%/95% confidence bands. |
| `apriori-engine.js` | Mines frequent 1-itemsets and 2-itemsets from shopping baskets, calculating Support %, Confidence %, Lift multiplier, and bundle strength. |
| `charts.js` | Renders zero-dependency HTML5 Canvas 2D Bézier splines, segmented donuts, and shaded forecast uncertainty trajectories. |
| `sns-webhook.js` | Dispatches typed operational payloads across SNS Workbench workflows, persists endpoint config, and maintains live latency/status telemetry. |
| `supabase-client.js` | Maps domain models to relational rows, deduplicates conflict keys, chunks writes into 250-row batches, unwraps SNS responses, and auto-seeds empty Supabase tables. |
| `server.js` | Serves compressed static assets via Node.js HTTP/zlib with traversal protection, `/health`, `/api/workflows/config`, and `/api/sns-proxy`. |
| `WF-SUPABASE-SYNC` | Single 4-node SNS Workbench workflow (`Webhook` → UTF-8 Base64 `Code` → `HTTP Request` → `Webhook Response`) connecting securely to Supabase RPC. |
| `supabase-schema.sql` | Idempotent DDL defining all 10 `pallets_*` PostgreSQL tables, indexes, and the `SECURITY DEFINER` gateway function `public.pallets_gateway`. |

---

## 3. Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend UI | HTML5, CSS3, Vanilla JavaScript (ES6+) | Single-page B2B SaaS interface and application state machine with zero external CDN dependencies |
| Visualizations | HTML5 Canvas 2D (`charts.js`) | High-DPI Bézier spline charts, category valuation donut ring, and shaded confidence interval demand plots |
| Forecasting Engine | Custom JS Time-Series Engine (`forecasting-engine.js`) | Moving Average (7d/14d), Holt's Linear, Holt-Winters Weekly Seasonality, MAE/RMSE/WAPE scoring |
| Market Basket AI | Custom JS Apriori Engine (`apriori-engine.js`) | Association rule discovery (`Support`, `Confidence`, `Lift`) for FMCG co-purchase bundles |
| Data Exchange | JSON & Pure-JS UTF-8 Base64 | Structured telemetry payloads and safe RPC encoding for multi-byte strings (`₹`, quotes, newlines) |
| Local / App Server | Node.js >=18 (`server.js`, zero npm dependencies) | Static file server with gzip compression, disk-backed workflow configuration API, and CORS webhook proxy |
| Workflow Automation | SNS Agent Workbench (`agents.snsihub.ai`) | Multi-workflow event chaining (`8` functional & persistence workflows) |
| Database | Supabase PostgreSQL | Managed relational database storing all `10` visible datasets and `public.pallets_gateway` PL/pgSQL RPC |
| File Processing | Browser `FileReader` API (`handleSalesIngestion`) | Client-side parsing and deduplication of uploaded POS CSV/JSON sales logs |
| Hosting & Serverless | Netlify Static Hosting & Functions (`netlify.toml`, `sns-proxy.js`, `workflows-config.js`) | Frontend delivery, SPA routing, optional SNS proxy, and workflow config persistence |

---

## 4. Major Components / Modules

### 4.1 Role-Based Access Control (RBAC) & Authentication

- Manages operator identities in `OPERATOR_USERS` (`Elena Vance`, `Devid Franks`, `Rahul Sharma`), `localStorage`, and `pallets_users` in Supabase.
- Applies CSS classes (`role-admin` vs `role-normal`) on `document.body` inside `applyRolePermissions` so infrastructure views (`Settings`, `Telemetry`, `SNS Webhook` badges, and `WF-SUPABASE-SYNC` setup prompts) remain completely hidden from non-admin staff.
- Restricts `Rahul Sharma` / dark-store associates to their assigned `storeAccess` hub (`BLR_NORTH_DC`) and prevents product deletion by Staff roles.

### 4.2 Overview KPIs & Canvas Visualization Engine

- `updateHeaderKPIs()` dynamically derives Total Daily Sales Revenue (`₹`), Daily Unit Velocity, week-over-week 7-day revenue deltas (`salesHistory`), Total Inventory Holding Valuation (`onHand × costPrice`), average vendor lead time, active SKU counts, and daily stockout revenue exposure.
- `renderOverviewCharts()` aggregates the last 14 days of `salesHistory` into revenue vs. cost series (`PalletsCharts.renderSplineChart`) and groups live holding value by product category (`PalletsCharts.renderDonutChart` + `#overview-category-list`).

### 4.3 Product Master & Movement Audit Ledger

- Maintains the active SKU catalog (seeded initially with 12 core FMCG items across Dairy & Chilled, Beverages, Household Care, Staples, Snacks, Personal Care, Gourmet, and Confectionery).
- Supports adding new SKUs (`addNewProductFromModal`), physical stock audit adjustments (`promptAdjustStock`), inter-hub transfers (`rebalanceStock`), authorized deletions (`deleteProduct`), and CSV export (`exportInventoryCSV`).
- Every stock mutation records an audit trail entry pushed to `pallets_inventory_movements`.

### 4.4 Omnichannel Sales Data Ingestion Pipeline

| Sales Upload / Sample Batch → Browser Validation & Deduplication → Daily Velocity Update → `WF-INGEST` Webhook + `pallets_ingestion_logs` |
|---|

- Accepts `.csv` and `.json` files via drag-and-drop or file picker in `handleSalesIngestion`, drops duplicate transactions, logs ingestion metadata to `INGESTION_LOGS` and `pallets_ingestion_logs`, and supports triggering a 90-day benchmark load via `loadSampleSalesBatch` dispatching to `WF-INGEST`.

### 4.5 AI Demand Forecasting Studio

| 90d Daily Sales History → 80% Train / 20% Holdout Split → 4 Candidate Models → Lowest WAPE / RMSE Winner → Promo Boost + 80%/95% CI Projection |
|---|

- Evaluates **Moving Average (7-Day)**, **Moving Average (14-Day)**, **Double Exponential Smoothing (Holt's Linear)** (`α = 0.3, β = 0.1`), and **Triple Exponential Smoothing (Holt-Winters Weekly)** (`seasonLength = 7, α = 0.2, β = 0.1, γ = 0.3`).
- Automatically selects the winning model minimizing `WAPE` (tie-breaking on `RMSE`), scales horizon forecasts (`7`, `30`, or `90` days) by promotional uplift (`promoBoost`), generates `1.28 × σ` (80% CI) and `1.96 × σ` (95% CI) uncertainty bounds, renders the Canvas forecast plot, persists runs to `pallets_forecast_runs`, and notifies `WF-FORECAST`.

### 4.6 Autonomous Inventory Risk Radar

- Computes remaining runway in days (`calculateRunwayDays = onHand / dailyDemand`), estimated stockout timestamp (`calculateStockoutETA`), and estimated revenue exposure (`calculateLostRevenue` across deficit lead-time days).
- Classifies SKUs automatically in `evaluateRiskStatus`:
  - `CRITICAL`: `runway <= 3.0` days
  - `HIGH`: `3.0 < runway <= 7.0` days
  - `OVERSTOCK`: `runway >= 35.0` days
  - `OPTIMAL`: between `7.0` and `35.0` days

### 4.7 Smart Replenishment & PO Dispatch Engine

Uses exact inventory replenishment control equations:

- `ROP = (Average Daily Demand × Lead Time Days) + Safety Stock`
- `IP = On Hand + On Order - Reserved`
- `Q = ceil(max(0, Target Stock - IP) / MOQ) × MOQ`

Approving an order in `confirmPoDispatch` updates `onOrder`, records an `INBOUND_PO` movement, persists the PO to `pallets_purchase_orders`, and triggers `WF-REPLENISH` for supplier dispatch chaining.

### 4.8 Market Basket Analytics (Apriori Engine)

- `PalletsAprioriEngine.runApriori` computes frequent 1-itemsets (`minSupport = 0.05`) and 2-itemsets (`minConfidence = 0.35`), outputting paired Association Rules ranked by `Lift` (`VERY_STRONG` at `lift >= 2.0`, `STRONG` at `lift >= 1.2`, otherwise `MODERATE`), persisted in `pallets_apriori_rules`.

### 4.9 Supplier Performance Directory & AI Inventory Copilot

- Displays 6 verified FMCG suppliers (`SUPPLIERS_MASTER` ↔ `pallets_suppliers`) tracking lead times, reliability scores, defect rates, on-time delivery percentages, MOQ defaults, and contact emails.
- Interactive AI Copilot drawer (`handleCopilotQuery`) dispatches natural language prompts to `WF-COPILOT`, evaluates stockout risk, replenishment quantities, overstock working capital, and inventory valuation, injects clickable PO approval / queue navigation shortcuts, and archives chat turns into `pallets_copilot_logs`.

### 4.10 Unified Supabase Synchronization Client (`WF-SUPABASE-SYNC`)

- `PalletsSupabaseClient` connects all 10 tables via a single SNS Workbench workflow URL configured in `WF-SUPABASE-SYNC`.
- Bootstraps state cleanly on startup (`bootstrapState`), auto-seeds empty tables on initial connection, deduplicates batch conflict keys, chunks upserts in `250`-row batches, and gracefully degrades to in-memory/local cache (`WORKFLOW_PENDING`) if offline or unconfigured.

---

## 5. Data Flow

### 5.1 General Application & Initialization Flow

| Page Load → `webhookClient.syncFromServer()` → Session Auth Check → `hydrateAllDataFromSupabase()` → `checkHealth` (`WF-SUPABASE-SYNC`) → Auto-Seed Empty Tables or Hydrate Existing Rows → `updateAllViews()` + `renderOverviewCharts()` |
|---|

### 5.2 First-Load Bootstrap & 10-Table Hydration Flow

| `PalletsSupabaseClient.bootstrapState()` → Parallel `SELECT` across Users, Suppliers, Products, Sales History, Movements, Ingestion Logs, Purchase Orders, Apriori Rules → Seed Empty Tables (`250`-row Chunked Base64 `UPSERT`) → Restore Copilot Logs → Live Dashboard Render |
|---|

### 5.3 Sales Ingestion to Forecast & Risk Radar Flow

| CSV/JSON Upload (`handleSalesIngestion`) or Benchmark Batch (`loadSampleSalesBatch`) → Parse & Deduplicate Orders → Upsert `pallets_ingestion_logs` → Trigger `WF-INGEST` → Run `PalletsForecastingEngine` (`runForecastPipeline`) → Save `pallets_forecast_runs` → Trigger `WF-FORECAST` → Refresh Risk Radar |
|---|

### 5.4 Replenishment Approval & PO Dispatch Flow

| Operator Opens PO Modal (`openPoModalForSku`) → Confirm Dispatch (`confirmPoDispatch`) → Compute `Q` & Cost → Trigger `WF-REPLENISH` Webhook → Persist PO to `pallets_purchase_orders` → Update Product `onOrder` in `pallets_products` → Append Audit Row in `pallets_inventory_movements` → Refresh Views |
|---|

### 5.5 User Signup & Cross-Device Authentication Flow

| User Submits Signup/Login Form (`registerUserAccount` / `authenticateByEmail`) → Local Registry Update → Persist/Lookup in `pallets_users` via `WF-SUPABASE-SYNC` → Trigger `WF-AUTH-SUPABASE` → Authorize Role & Store Access (`authorizeUser`) |
|---|

### 5.6 AI Copilot Query & Logging Flow

| User Submits Copilot Prompt → Render Typing State → `POST` to `WF-COPILOT` → Generate Domain Analysis + Interactive PO Action Buttons → Render Agent Bubble → Archive Prompt, Response HTML & Latency (`latencyMs`) to `pallets_copilot_logs` |
|---|

---

## 6. Database Design

### 6.1 Database Architecture

PALLETS uses **Supabase PostgreSQL** as its unified relational data store for all authentication profiles, catalog items, time-series velocity, operational ledgers, ML outputs, and chat history. All database queries flow through a single PostgreSQL stored function `public.pallets_gateway(p_b64 text)` invoked via PostgREST RPC (`/rest/v1/rpc/pallets_gateway`) by the `WF-SUPABASE-SYNC` SNS workflow.

| Database Table Group | Tables Included |
|---|---|
| Identity & Partners | `pallets_users`, `pallets_suppliers` |
| Catalog & Stock Ledgers | `pallets_products`, `pallets_sales_history`, `pallets_inventory_movements` |
| Ingestion & Procurement | `pallets_ingestion_logs`, `pallets_purchase_orders` |
| Intelligence & AI Logs | `pallets_forecast_runs`, `pallets_apriori_rules`, `pallets_copilot_logs` |

### 6.2 Table Definitions & Key Attributes

| Table | Primary Key / Unique Keys | Core Attributes |
|---|---|---|
| `pallets_users` | `id` (PK), `email` (UNIQUE) | `name`, `role`, `store_hub`, `permissions` (`JSONB`), `avatar`, `password_hash_placeholder`, `created_at`, `updated_at` |
| `pallets_suppliers` | `id` (PK) | `name`, `category`, `lead_time_days`, `reliability_score`, `defect_rate`, `on_time_delivery_pct`, `moq`, `contact_email` |
| `pallets_products` | `id` (PK), `sku` (UNIQUE) | `name`, `brand`, `category`, `supplier_id`, `supplier_name`, `store_hub`, `on_hand`, `on_order`, `reserved`, `avg_daily_demand`, `lead_time_days`, `safety_stock`, `target_stock`, `moq`, `cost_price`, `selling_price`, `expiry_risk_days`, `velocity_spike_pct`, `status_note` |
| `pallets_sales_history` | `id` (`<sku>__<date>`) (PK) | `sku`, `store_hub`, `sale_date` (`DATE`), `units_sold`, `revenue`, `source` |
| `pallets_inventory_movements` | `id` (PK) | `sku`, `product_name`, `store_hub`, `movement_type`, `quantity_delta`, `previous_on_hand`, `new_on_hand`, `reason`, `actor_name`, `created_at` |
| `pallets_ingestion_logs` | `id` (PK) | `batch_id`, `source_name`, `records_parsed`, `duplicates_skipped`, `validation_status`, `summary_note`, `ingested_by`, `ingested_at` |
| `pallets_purchase_orders` | `id` (PK), `po_number` (UNIQUE) | `sku`, `product_name`, `supplier_id`, `supplier_name`, `store_hub`, `order_qty`, `unit_cost`, `total_cost`, `status`, `rationale`, `approved_by`, `expected_arrival_at` |
| `pallets_forecast_runs` | `id` (`FC-<sku>-<horizon>D`) (PK) | `sku`, `product_name`, `horizon_days`, `promo_boost_pct`, `winning_model`, `mae`, `rmse`, `wape_pct`, `projected_total_units`, `model_comparison` (`JSONB`), `forecast_timeline` (`JSONB`), `run_by` |
| `pallets_apriori_rules` | `id` (PK) | `antecedent`, `consequent`, `support_pct`, `confidence_pct`, `lift`, `bundle_strength`, `recommendation`, `min_support_threshold`, `min_confidence_threshold` |
| `pallets_copilot_logs` | `id` (PK) | `session_id`, `user_name`, `user_role`, `prompt`, `response_text`, `source`, `latency_ms`, `action_chips` (`JSONB`), `created_at` |

### 6.3 Database Indexing & Gateway Relationships

- Indexes on `(store_hub)`, `(sku)`, `(sku, sale_date)`, and `(sku, created_at DESC)` support filtered store queries and chronological history reconstruction.
- `pallets_gateway(p_b64 text)` dynamically validates every column against `information_schema.columns`, maps typed arrays using `jsonb_populate_recordset`, applies conflict-safe upserts (`ON CONFLICT (<conflict_col>) DO UPDATE`), and requires explicit filter matches before `UPDATE` or `DELETE`.

---

## 7. API & Webhook Integration Design

### 7.1 Local & Serverless Utility Endpoints

| Endpoint | Method | Hosted By | Purpose |
|---|---|---|---|
| `/health` & `/api/health` | `GET` | `server.js` | Reports service status, uptime, timestamp, and Node.js runtime version. |
| `/api/workflows/config` | `GET` / `POST` | `server.js` & Netlify Function (`workflows-config.js`) | Reads and saves multi-workflow endpoint URLs (`webhooks-config.json` on disk or Netlify memory store). |
| `/api/sns-proxy` | `POST` | `server.js` & Netlify Function (`sns-proxy.js`) | Server-side CORS/firewall relay forwarding JSON payloads to `X-Target-Webhook`. |

### 7.2 SNS Agent Workbench Webhook Endpoints

| Workflow ID | Registry Key | Primary Function & Inter-Workflow Flow |
|---|---|---|
| `WF-MASTER` | `master` | Central event router and default fallback gateway |
| `WF-SUPABASE-SYNC` | `supabaseSync` | Unified 4-node Base64-RPC bridge executing `health`, `select`, `upsert`, `insert`, `update`, and `delete` across all `10` Supabase tables |
| `WF-AUTH-SUPABASE` | `authSupabase` | Sanitizes and inserts newly registered operator profiles into `pallets_users` |
| `WF-INGEST` | `ingestion` | Deduplicates incoming POS records, computes SKU velocities, flags anomalies, chains to `WF-FORECAST` |
| `WF-FORECAST` | `forecasting` | Evaluates time-series model tournament metrics and chains demand spikes to `WF-RISK` |
| `WF-RISK` | `risks` | Calculates stockout runway and revenue at risk; chains critical deficits to `WF-REPLENISH` |
| `WF-REPLENISH` | `replenishment` | Validates `ROP`/`IP`/`Q`/`MOQ` replenishment math and chains approved POs to `WF-SUPPLIER` |
| `WF-SUPPLIER` | `suppliers` | Validates supplier SLA lead times and returns expected PO arrival confirmation |
| `WF-COPILOT` | `copilot` | Federated conversational copilot aggregating insights across risk, replenishment, and forecasting |

### 7.3 Unified `WF-SUPABASE-SYNC` Gateway Protocol

- **Transport:** `POST` to `WF-SUPABASE-SYNC` webhook → Node 2 Base64-encodes UTF-8 JSON → Node 3 `POST`s `{"p_b64": "..."}` to Supabase `/rest/v1/rpc/pallets_gateway` → Node 4 returns `{ "result": { "ok": true, ... } }`.
- **Supported Actions:** `health`, `select` (`filters`, `order`, `limit`), `upsert` (`rows`, `onConflict`), `insert` (`rows`), `update` (`values`, `match`), `delete` (`match`).

---

## 8. System Design Concepts Applied

| Concept | Applied in PALLETS | Rationale |
|---|---|---|
| Single-Page Application (SPA) State Machine | `app.js` view router toggling 8 panels & 4 modals | Eliminates page-reload latency while preserving live charts and Copilot state. |
| Workflow-as-Middleware Gateway | Single `WF-SUPABASE-SYNC` + PostgreSQL RPC `pallets_gateway` | Removes bespoke Netlify/backend DB secrets while supporting full CRUD across 10 tables. |
| Safe ASCII Transport Encoding | Pure-JS UTF-8 Base64 encoder feeding `decode(p_b64, 'base64')` | Prevents JSON parse failures inside low-code JSON body templates caused by `₹`, quotes, or newlines. |
| Holdout Cross-Validation Tournament | 80%/20% temporal train/test split evaluating 4 models by `WAPE` & `RMSE` | Selects best-fitting predictor per SKU demand pattern instead of a one-size-fits-all curve. |
| Batch Chunking & Deduplication | `250`-row `upsert` slicing & conflict-key deduplication | Prevents payload limits on `1,080` sales rows and avoids Postgres `ON CONFLICT` duplicate-key faults. |
| Role-Based View Isolation | Dual CSS (`.admin-only` / `.normal-only`) + JS guardrails | Keeps dark-store associates focused on operations without exposing workflow infrastructure. |
| Zero-Dependency Modularity | Pure HTML/CSS/JS modules + native Node.js built-ins | Zero `node_modules` supply-chain surface, instant browser startup even offline. |

---

## 9. Scalability & Performance

- **Zero External CDN Overhead:** All fonts fallback gracefully, charts draw directly on Hardware-DPI `<canvas>` (`charts.js`), and forecasting/Apriori math completes in milliseconds client-side.
- **Asset Delivery Optimization:** `server.js` applies `gzip` compression for HTML, CSS, JavaScript, and JSON assets plus 1-day `Cache-Control` headers for static scripts/stylesheets (`no-cache` for `index.html`).
- **Batched Cloud Sync:** Initial first-connect seeding (`1,080` daily sales history records + catalog/suppliers/movements) splits automatically into `250`-row chunks (`chunkSize = 250`) to maintain fast HTTP response times through SNS Workbench.
- **Database Indexing & Bounded Queries:** `pallets_gateway` enforces bounded `LIMIT` values (`1` to `5000`), and indexes on `sku`, `store_hub`, and `(sku, sale_date)` keep query scans fast as history grows.
- **Future Scaling:** Workload expansion can introduce dedicated ETL workers, background POS streaming queues, and server-side materialized KPI views without reworking the client UI contract.

---

## 10. Security Considerations

### 10.1 Role-Based Access Control (RBAC)

- Admin privileges (`Elena Vance`) unlock Multi-Workflow Settings, Live Telemetry inspection, and product deletion; Staff roles (`Rahul Sharma`) are scoped cleanly to assigned hub inventory and physical count adjustments (`deleteProduct` explicitly blocks Staff execution).

### 10.2 Credential Isolation

- Supabase Service Role credentials reside solely inside the SNS Agent Workbench HTTP node headers—never shipped inside `supabase-client.js`, `app.js`, or any browser-accessible config file.

### 10.3 SQL Injection Prevention (`pallets_gateway`)

- Strictly rejects any table outside the explicit 10-table `pallets_*` allowlist.
- Validates every filter, `ORDER BY`, `ON CONFLICT`, and update column against `information_schema.columns` before constructing parameterized dynamic SQL via `%I` (identifier quoting) and `%L` (literal quoting) alongside typed `jsonb_populate_recordset` casting.
- Blocks `UPDATE` and `DELETE` calls unless at least one match condition (`v_where_sql <> ''`) is provided.

### 10.4 Static Server Hardening

- `server.js` normalizes requested paths (`path.normalize`) and blocks directory traversal outside `ROOT_DIR` (`!safePath.startsWith(ROOT_DIR)` → `HTTP 403`).

### 10.5 Current Authentication Scope Notice

- The current version stores `[SECURE_ARGON2_HASH]` as a placeholder in `pallets_users` and performs email-based lookup plus role metadata matching rather than live password cryptographic verification or JWT verification. Full credential/session authentication (e.g., Supabase Auth JWTs with database RLS per tenant) is planned prior to multi-organization public release.

---

## 11. Limitations

- **Client-Side Auth Verification:** Login flows resolve operator profiles by email without enforcing real backend password hash verification or signed session JWTs yet.
- **External Workflow Dependency:** Persistent cloud storage and live workflow telemetry rely on SNS Agent Workbench webhook uptime, execution latency, and workspace credit availability; when offline or unconfigured, changes fall back gracefully to local browser storage/memory.
- **Browser-Side Analytics & Memory Scale:** Forecasting, Apriori mining, and CSV/JSON ingestion execute inside the browser tab, suited to dark-store/regional SKU catalogs (hundreds to low thousands of SKUs) rather than multi-million-row enterprise data warehouses.
- **Single-Tenant Shared Catalog:** The current `supabase-schema.sql` models a single retail organization across 4 dark-store hubs rather than isolated multi-tenant organizations with strict Row-Level Security (RLS) tenant claims.
- **Synthetic Benchmark Seeding:** On an empty Supabase database, `bootstrapState` seeds 12 benchmark FMCG products and 90-day generated sales velocity curves to make all modules operational immediately out of the box.

---

## 12. Future Architecture Improvements

### 12.1 Current vs. Future Architecture Evolution

| Evolution Path |
|---|
| **Current Architecture:** Browser SPA (`app.js` + ML Engines) → SNS Workbench (`8` Workflows + `WF-SUPABASE-SYNC`) → Supabase PostgreSQL (`10` Tables + `pallets_gateway`) |
| **Future Distributed Scale:** Web/Mobile Clients → Auth/JWT Gateway (Supabase Auth + RLS) → API & Job Queue Workers (Scheduled Forecast / POS Stream Workers) → Partitioned PostgreSQL + Object Storage + Materialized Analytics Views |

### 12.2 Key Planned Architectural Upgrades

1. **Supabase Auth & Cryptographic Sessions:** Replace placeholder password fields with Supabase Auth JWT validation and per-user/per-store PostgreSQL RLS policies.
2. **Server-Side POS Streaming Pipeline:** Move large bulk CSV/ERP uploads into background ingestion workers capable of parsing hundreds of thousands of receipts asynchronously.
3. **Scheduled Automated Replenishment Crons:** Trigger nightly `WF-FORECAST` → `WF-RISK` → `WF-REPLENISH` runs automatically to generate draft POs for manager morning review.
4. **Supplier EDI & Email Dispatch:** Upgrade `WF-SUPPLIER` to dispatch signed PDF Purchase Orders via SMTP/EDI directly to vendor procurement endpoints and ingest ASN delivery acknowledgments.
5. **Multi-Echelon Inventory & Expiry Tracking:** Extend `pallets_products` and movements with lot-level batch expiry (`FEFO`) and automated inter-DC transfer cost optimization.

---

## 13. End-to-End Architecture Summary

| End-to-End System Flow |
|---|
| Operator Sign-In (`authenticateByEmail` / `registerUserAccount`) → Syncs `pallets_users` via `WF-SUPABASE-SYNC` & `WF-AUTH-SUPABASE` |
| POS Ingestion (`handleSalesIngestion` / `loadSampleSalesBatch`) → Normalizes Orders → `WF-INGEST` + `pallets_ingestion_logs` |
| AI Forecast Studio (`PalletsForecastingEngine`) → 4-Model WAPE Tournament → `80%/95% CI` Plot → `WF-FORECAST` + `pallets_forecast_runs` |
| Risk Radar & Replenishment (`evaluateRiskStatus`, `calculateROP`, `calculateIP`, `calculateRecommendedOrderQuantity`) → `confirmPoDispatch` → `WF-REPLENISH` + `pallets_purchase_orders` + `pallets_inventory_movements` |
| Basket Mining (`PalletsAprioriEngine`) & Copilot Drawer (`handleCopilotQuery`) → `WF-COPILOT` + `pallets_apriori_rules` + `pallets_copilot_logs` |
| Overview KPIs & Canvas Visualizations (`updateHeaderKPIs`, `renderOverviewCharts`) → Real-time Aggregations across Supabase-Backed State |

### Current vs. Future Summary

| Dimension | Current Architecture | Future Direction |
|---|---|---|
| Client Runtime | Zero-dependency HTML/CSS/JS + Canvas 2D | Modular build + offline service worker sync |
| Database Access | Single `WF-SUPABASE-SYNC` SNS RPC gateway | Direct authenticated API + RLS + partitioned time-series tables |
| Authentication | Role-based metadata + email lookup | Full Supabase Auth JWT + MFA + organization isolation |
| Data Ingestion | Browser `FileReader` + benchmark batch loader | Automated ERP/POS webhook streams + async queues |
| Forecasting | In-browser 4-model WAPE tournament | Scheduled server workers + external event regressors |
| Alerts & POs | Interactive UI dispatch + telemetry log | Email/Slack/WhatsApp alerts + automated supplier EDI |

### Conclusion

PALLETS delivers a cohesive, mathematically grounded FMCG inventory and replenishment platform built around clean separation between deterministic client-side forecasting/Apriori analytics, multi-workflow automation in SNS Agent Workbench, and unified relational persistence in Supabase PostgreSQL. Routing all 10 persistent datasets through the single `WF-SUPABASE-SYNC` Base64 RPC workflow eliminates bespoke serverless credential management while preserving sub-second UI responsiveness, role-isolated visibility, and full data continuity across sessions.
