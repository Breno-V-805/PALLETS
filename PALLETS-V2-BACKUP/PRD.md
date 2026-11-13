# PRODUCT REQUIREMENTS DOCUMENT

**PALLETS**  
**FMCG AI Predictive Inventory & Replenishment Orchestration Platform**

**TEAM NAME:**  
TALOS

**PREPARED BY:**  
- ___________________________  
- ___________________________  
- ___________________________  
- ___________________________  

**DOCUMENT VERSION:**  
Version 1.0  
November 2026  

---

## 1. Product Overview

### Product / Project Name
PALLETS — FMCG AI Predictive Inventory & Replenishment Orchestration Platform

### Team Name
TALOS

### Team Members
- ___________________________  
- ___________________________  
- ___________________________  
- ___________________________  

### Problem Being Solved
Fast-moving consumer goods (FMCG) dark stores and regional distribution hubs operate on tight inventory runways, volatile weekend demand spikes, strict shelf-life constraints, and minimum order quantities (MOQs). Inventory planners frequently struggle with manual spreadsheets, fragmented POS exports, delayed stockout detection, capital trapped in overstocked SKUs, and manual purchase order calculations.

PALLETS resolves these bottlenecks by uniting demand forecasting, autonomous risk radar monitoring, exact replenishment math (`ROP`, `IP`, `Q`, `MOQ` rounding), supplier SLA tracking, market-basket association mining, an AI Inventory Copilot, and full cloud persistence in one unified B2B workspace.

### Short Description of the Product
PALLETS is an enterprise inventory intelligence and automated replenishment platform tailored for quick-commerce and FMCG dark-store networks. It transforms raw sales history and current stock positions into accurate time-series demand projections, actionable stockout risk alerts, ready-to-approve purchase orders, cross-sell bundle insights, and conversational inventory guidance synced with Supabase and orchestrated via SNS Agent Workbench.

### Target Users
- **Supply Chain VPs & System Administrators** overseeing multi-hub KPIs, automation workflows, and catalog governance.
- **Inventory Operations Managers** managing stock replenishment, supplier POs, sales ingestion, and demand forecasting.
- **Dark Store Associates (Store Staff)** auditing physical stock counts and monitoring urgent local buffer deficits.

---

## 2. Problem Statement

### What Problem Does the Product Solve?
Traditional FMCG replenishment workflows break down when store velocity fluctuates faster than manual spreadsheet cycles:
- Inventory teams cannot easily predict which model (moving average vs. trend vs. weekly seasonality) best fits each SKU.
- Planners calculate Reorder Points (`ROP`), Inventory Position (`IP`), and supplier Minimum Order Quantities (`MOQ`) manually—causing either costly stockouts or surplus holding bleed.
- Stock counts, POS batches, PO approvals, and forecast insights sit in disconnected files, leading to stale numbers across shifts and devices.

### Who Faces This Problem?
- Retail supply chain leaders and VPs.
- Inventory operations and procurement managers.
- Dark store fulfillment associates across metropolitan hubs (`BLR_NORTH_DC`, `MUM_BANDRA_HUB`, `DEL_GURGAON_CORE`, `HYD_HITEC_STORE`).
- Procurement and merchandising teams planning bundle promotions.

### Existing Difficulty / Gap
- Static historical averages miss weekend FMCG demand surges (`1.2x`–`1.6x` weekend lift).
- Lack of automated lead-time lost-revenue quantification hides which low-stock SKU is costing the most today.
- Disconnected analytics tools require technical expertise or external BI licenses and fail to store decisions alongside live inventory state.

---

## 3. Product Objective

### Main Objective
Enable FMCG operations teams to eliminate preventable dark-store stockouts, free trapped overstock capital, and standardize replenishment approvals through automated AI forecasting, mathematical ordering formulas, and persistent multi-user cloud state.

### What Should the Product Achieve?
- Automatically select the highest-accuracy forecasting model per SKU using holdout validation (`WAPE` & `RMSE`).
- Compute real-time runway days, stockout ETAs, and daily revenue risk (`₹`) across every SKU and hub.
- Calculate exact, MOQ-rounded replenishment quantities (`Q = ceil(max(0, Target Stock - IP) / MOQ) × MOQ`) and dispatch POs in one workflow.
- Support self-service POS CSV/JSON ingestion alongside a 90-day benchmark batch loader.
- Reveal profitable co-purchase product bundles via Apriori market-basket analytics (`Support`, `Confidence`, `Lift`).
- Provide an interactive AI Inventory Copilot capable of explaining root causes and launching PO approval modals directly.
- Store **every visible dataset** persistently in Supabase via one unified workflow (`WF-SUPABASE-SYNC`) with zero manual database seeding.
- Enforce clean role-based access control so store staff see only operational controls while admins retain workflow & telemetry governance.

---

## 4. Target Users

### 4.1 Admin (Supply Chain VP)
Responsible for network-wide supply continuity and platform orchestration. Admins can:
- View aggregated and store-filtered KPIs across all 4 regional hubs.
- Configure and test SNS Agent Workbench webhook endpoints (`WF-MASTER`, `WF-SUPABASE-SYNC`, `WF-AUTH-SUPABASE`, `WF-INGEST`, `WF-FORECAST`, `WF-RISK`, `WF-REPLENISH`, `WF-SUPPLIER`, `WF-COPILOT`).
- Inspect live webhook execution latency and JSON payloads in the Telemetry Terminal.
- Add, adjust, rebalance, export, and delete SKU records.
- Approve Purchase Orders and run AI forecasts.

### 4.2 Inventory Operations Manager
Responsible for day-to-day forecasting, replenishment planning, and supplier execution. Managers can:
- Monitor stockout deficits, overstock surplus capital, and category holding valuations.
- Ingest daily POS CSV/JSON batches and inspect batch parsing quality.
- Run demand forecast tournaments (`7d`, `30d`, `90d`) with promotional uplift sliders.
- Review supplier SLA scores (`reliability`, `defect rate`, `on-time delivery %`).
- Approve and dispatch replenishment POs and adjust/rebalance stock.

### 4.3 Store Staff (Dark Store Associate)
Responsible for ground-level dark-store inventory accuracy. Staff users can:
- Authenticate into their assigned regional hub (e.g., `BLR_NORTH_DC`) with scoped product visibility.
- Monitor urgent stockout watch items for their hub.
- Record physical audit stock adjustments (`promptAdjustStock`).
- Query operational insights in the AI Copilot drawer without seeing internal workflow or admin telemetry infrastructure.

---

## 5. Key Features

### 5.1 Role-Based Access Control (RBAC) & Onboarding
- **What it does:** Supports instant demo operator switching, landing-screen/modal login, and new account signup (`Admin`, `Inventory Manager`, `Staff` + dark-store assignment) synced with Supabase `pallets_users` and `WF-AUTH-SUPABASE`.
- **Why it is required:** Protects sensitive configuration controls (e.g., product deletion, workflow URLs, SNS telemetry) and scopes hub inventory cleanly per store associate.

### 5.2 Dynamic Executive Overview & Canvas Visualizations
- **What it does:** Displays 4 real-time KPI cards (Total Daily Sales `₹` + 7d week-over-week trend, Inventory Valuation `₹` + avg lead time, Critical Deficits `₹` exposure + SKU count, Network/Webhook latency) plus a live 14-day Sales Performance spline chart and Top Categories holding valuation donut & legend.
- **Why it is required:** Gives leadership an immediate, data-driven pulse calculated directly from persisted products and 90-day sales history.

### 5.3 Product Catalog & Inventory Movement Ledger
- **What it does:** Manages SKU master attributes (price, cost, on-hand, reserved, on-order, safety stock, target stock, MOQ, daily demand, vendor, hub), supports adding SKUs (`modal-add-product`), stock count corrections, inter-DC transfers, CSV export, and persists every stock change into `pallets_inventory_movements`.
- **Why it is required:** Ensures an auditable single source of truth for inventory counts and financial valuation.

### 5.4 Sales Data Ingestion Pipeline
- **What it does:** Enables drag-and-drop CSV/JSON POS file uploads and a 1-click 90-day synthetic benchmark batch loader (`18,450` orders across 4 dark stores), deduplicating repeated transactions, reporting validation outcomes, logging batches to `pallets_ingestion_logs`, and notifying `WF-INGEST`.
- **Why it is required:** Standardizes raw store transaction exports before feeding velocity and forecast calculations.

### 5.5 AI Demand Forecasting Studio
- **What it does:** Executes an automated 4-model tournament (`Moving Average 7d`, `Moving Average 14d`, `Holt's Linear`, `Holt-Winters Weekly`) on an 80%/20% train/holdout split, picks the winning model by lowest `WAPE`/`RMSE`, applies an interactive promotional boost (`0%`–`50%+`), charts 80% & 95% confidence bands, displays a 14-day schedule table, and saves results to `pallets_forecast_runs`.
- **Why it is required:** Captures weekly FMCG seasonality and demand trends with transparent error benchmarking instead of guesswork.

### 5.6 Inventory Risk Detection Radar
- **What it does:** Ranks every SKU by remaining stock runway days, displays stockout ETA date/time, highlights lead-time revenue loss risk (`CRITICAL <= 3d`, `HIGH <= 7d`), flags overstock working-capital lockup (`>= 35d`), and provides 1-click PO or Rebalance actions.
- **Why it is required:** Prioritizes planner attention strictly toward highest-urgency deficits and trapped capital.

### 5.7 Smart Replenishment Engine & PO Approval Modal
- **What it does:** Calculates `ROP`, `IP`, and MOQ-rounded `Q` automatically, opens an approval modal showing cost breakdown & editable AI rationale, dispatches the PO payload to `WF-REPLENISH`, increments `onOrder`, and logs the PO into `pallets_purchase_orders`.
- **Why it is required:** Turns mathematical replenishment theory into repeatable, single-click procurement execution.

### 5.8 Customer Basket Analytics (Apriori)
- **What it does:** Runs association rule mining across multi-item FMCG baskets to surface `Support %`, `Confidence %`, `Lift`, co-purchase counts, and bundle strength ratings (`VERY STRONG`, `STRONG`, `MODERATE`), stored in `pallets_apriori_rules`.
- **Why it is required:** Helps merchandising and store ops coordinate joint safety stock and cross-sell promotions (e.g., Oat Milk + Cold Brew).

### 5.9 Supplier Performance Directory
- **What it does:** Tracks verified FMCG vendors (`pallets_suppliers`) alongside contracted lead times, reliability scores (`95%`–`99.4%`), defect rates, on-time delivery %, default MOQs, and procurement contact emails.
- **Why it is required:** Grounds replenishment lead-time assumptions in measurable vendor reliability metrics.

### 5.10 Conversational AI Inventory Copilot
- **What it does:** Provides an expandable chat drawer responding to questions about upcoming stockouts, SKU root causes, exact reorder math, overstock surplus, and inventory valuation—complete with deep-link buttons to approve POs or switch views—while persisting chat logs to `pallets_copilot_logs` and pinging `WF-COPILOT`.
- **Why it is required:** Lets managers interrogate inventory state in plain English and execute fixes immediately without hunting through tables.

### 5.11 Unified 10-Table Supabase Cloud Persistence (`WF-SUPABASE-SYNC`)
- **What it does:** Synchronizes users, suppliers, products, 90-day daily sales history, movements, ingestion batches, POs, forecast runs, Apriori rules, and Copilot logs automatically via one SNS Workbench workflow (`WF-SUPABASE-SYNC`) calling `public.pallets_gateway` in Supabase—auto-seeding empty tables on initial connection and updating a live Cloud DB status badge.
- **Why it is required:** Guarantees zero data loss on refresh and cross-device collaboration without exposing database keys in the browser.

---

## 6. User Flow / Use Cases

### 6.1 Onboarding & Cloud Bootstrap Flow
`User Opens PALLETS → Login / Sign Up (or Session Restore) → Cross-Device User Sync (pallets_users) → Hydrate 10 Datasets from Supabase via WF-SUPABASE-SYNC (Auto-Seed if Empty) → Render Role-Scoped Workspace & Live Charts`

### 6.2 Sales Ingestion & Forecast Tournament Flow
`Navigate to Ingestion → Upload CSV/JSON or Load 90-Day Benchmark Batch → Batch Logged (pallets_ingestion_logs) + WF-INGEST → Navigate to Forecasting Studio → Choose SKU, Horizon (7/30/90d) & Promo Boost → Run Model Tournament → Inspect Winner (Lowest WAPE) & 80%/95% Bands → Run Persisted to pallets_forecast_runs`

### 6.3 Risk Detection to Replenishment PO Flow
`Review Risk Radar / Overview Watch → Identify CRITICAL SKU (Runway <= 3d) → Click Approve PO → Inspect MOQ-Rounded Quantity (Q) & Cost → Confirm Dispatch → PO Transmitted via WF-REPLENISH → Saved in pallets_purchase_orders + onOrder Updated in pallets_products + Movement Recorded`

### 6.4 Overstock Rebalance & Stock Audit Flow
`Filter Overstocked SKU (Runway >= 35d) → Trigger Rebalance Stock (or Physical Adjust Stock) → On-Hand Updated → Movement Logged (DC_REBALANCE / STOCK_ADJUSTMENT) → Overview KPIs & Category Donut Recalculate Immediately`

### 6.5 AI Copilot Investigation Flow
`Open Copilot Drawer → Ask "Which products will run out next week?" → WF-COPILOT Queried → View Risk Summary + Interactive Action Button → Open PO Approval or Switch View → Conversation Saved to pallets_copilot_logs`

---

## 7. Functional Requirements

The PALLETS system must:

**Authentication, RBAC & Multi-Hub Scoping**
- Require authentication via the landing auth screen or auth modal before exposing the main operational workspace.
- Restrict Staff users cleanly to their assigned dark store hub, block Staff product deletion, and hide all Admin workflow/SNS telemetry badges, menus, and toasts from non-admin accounts.
- Persist registered user accounts locally and in `pallets_users` for cross-device email login lookup.

**Inventory & Product Operations**
- Maintain live inventory fields (`onHand`, `reserved`, `onOrder`, `dailyDemand`, `leadTimeDays`, `safetyStock`, `targetStock`, `moq`, `costPrice`, `unitPrice`) per SKU.
- Support instant multi-attribute search (`SKU`, `name`, `brand`, `category`, `supplier`) and regional hub filtering across all Overview KPIs, charts, tables, and Risk/Replenishment queues.
- Support creating products, adjusting physical stock counts, rebalancing surplus stock (`40%` hub transfer), deleting SKUs (non-Staff), and exporting the master catalog as CSV.

**Forecasting, Risk & Replenishment Analytics**
- Require at least 14 daily history points to run the 4-model demand forecast tournament, split 80%/20% chronologically, compute MAE/RMSE/WAPE, apply promo boost multipliers, and generate 80% and 95% intervals.
- Compute `ROP`, `IP`, MOQ-rounded `Q`, `Runway Days`, `Stockout ETA`, and `Lost Revenue` continuously from live product parameters.
- Mine frequent co-purchase association rules via Apriori (`Support`, `Confidence`, `Lift`).

**Data Ingestion, Copilot & Cloud Sync**
- Parse CSV/JSON uploads, track parsed vs. duplicate counts, and record ingestion history logs.
- Answer operational queries in the AI Copilot drawer with interactive action buttons.
- Synchronize all 10 datasets with Supabase through the single `WF-SUPABASE-SYNC` workflow, auto-seeding initial datasets cleanly on first connect and chunking large sales batches (`250` rows/request).
- Allow Admins to edit, ping, save, and monitor workflow webhook URLs and inspect live telemetry payloads.

---

## 8. Non-Functional Requirements

| Category | Requirement |
|---|---|
| Performance | UI views, KPI recalculations, Canvas charts, and mathematical tournaments execute locally with near-instant responsiveness; initial Supabase sync chunks large payloads (`250` rows) cleanly. |
| Security | Server-side Supabase RPC (`public.pallets_gateway`) enforces a strict 10-table allowlist and column validation against `information_schema.columns`; browser code never exposes database service keys; RBAC hides admin tools from Staff. |
| Scalability | Supports adding new dark-store hubs, SKUs, suppliers, ingestion batches, and 90-day velocity series without modifying core table schemas or client rendering logic. |
| Reliability | When `WF-SUPABASE-SYNC` or network connectivity is unavailable, the application degrades gracefully to local cache/memory without crashing charts or blocking operational views. |
| Availability | Runs identically as a zero-dependency Node.js server (`server.js`), static Netlify deployment, or offline browser client. |
| Usability | Clean B2B SaaS layout inspired by enterprise dashboards (`otoxa` style), clear status badges (`CRITICAL`, `HIGH`, `OVERSTOCK`, `OPTIMAL`), and actionable 1-click replenishment triggers. |
| Maintainability | Modular single-purpose files (`app.js`, `forecasting-engine.js`, `apriori-engine.js`, `charts.js`, `sns-webhook.js`, `supabase-client.js`) with zero third-party npm or CDN build dependencies. |
| Data Consistency | Every KPI card, chart legend, Risk table, Replenishment queue, and 10-table Supabase store refreshes coherently from the same canonical in-memory & persisted dataset. |

---

## 9. Scope

### In Scope
The current version of PALLETS includes:
- Role-based authentication & signup (`Admin`, `Inventory Manager`, `Staff`) synced with Supabase (`pallets_users`).
- Dynamic Overview KPIs & zero-dependency Canvas charts (Sales Performance spline & Top Categories donut).
- Multi-hub filtering (`4` regional dark stores) & instant multi-attribute search.
- Master product catalog CRUD (`Add`, `Adjust Stock`, `Rebalance`, `Delete`, `CSV Export`) + movement audit ledger.
- CSV/JSON POS data ingestion + 90-day benchmark batch loader (`18,450` orders).
- 4-model AI forecasting studio (`MA 7d`, `MA 14d`, `Holt's Linear`, `Holt-Winters Weekly`) with promo boost & 80%/95% CI intervals.
- Autonomous risk radar (`CRITICAL`, `HIGH`, `OVERSTOCK`, `OPTIMAL`) with runway ETA and revenue loss exposure.
- Smart replenishment engine (`ROP`, `IP`, `Q`, `MOQ` rounding) and PO approval modal.
- Apriori customer basket rule analytics & Supplier SLA performance directory.
- Interactive AI Inventory Copilot drawer & Admin Multi-Workflow Telemetry console.
- Full 10-table Supabase persistence orchestrated through the single `WF-SUPABASE-SYNC` SNS Workbench workflow.

### Out of Scope
The following are outside the scope of the current version:
- Direct password cryptographic verification / enterprise SSO (SAML / Google OAuth) integration.
- Automated autonomous PO placement without human operator approval.
- Live third-party logistics GPS fleet tracking or warehouse barcode scanner hardware drivers.
- Financial general-ledger accounting, GST tax invoicing, or payroll ERP modules.
- Automated email/WhatsApp dispatch without external notification workflow extensions.

---

## 10. Future Enhancements

### 10.1 Cryptographic Authentication & Multi-Organization SaaS Tiers
Integrate Supabase Auth JWT sessions with tenant-scoped RLS policies and organization plans (Starter, Growth, Enterprise dark-store tiers).

### 10.2 Automated Scheduled Forecast & Replenishment Agents
Schedule nightly autonomous workflow runs (`WF-INGEST` → `WF-FORECAST` → `WF-RISK`) that pre-stage draft POs and notify category managers via email/Slack/WhatsApp before morning store openings.

### 10.3 Lot-Level Expiry (FEFO) & Markdown Optimization
Expand SKU records with manufacturing/expiry batch tracking for ultra-short-shelf-life dairy and fresh produce, triggering automated dynamic discount rules before spoilage loss occurs.

### 10.4 Live POS & ERP Bi-Directional Sync
Stream real-time POS checkout webhook events and pull inbound Goods Receipt Notes (GRNs) directly from retail ERP systems to close the loop when `onOrder` stock arrives at a dark store.

### 10.5 Network-Wide Inter-DC Transfer Cost Solver
Enhance stock rebalancing beyond single-hub surplus transfers to compute multi-hub transfer routes minimizing freight cost vs. stockout recovery value.

---

## Product Success Criteria

PALLETS is successful when an FMCG operations team can complete the entire end-to-end inventory intelligence lifecycle seamlessly across sessions and devices:

`Operator Authenticates → 10 Datasets Hydrate from Supabase → POS Batch Ingested → Forecast Tournament Selects Lowest-WAPE Model → Risk Radar Highlights CRITICAL Deficit → Operator Approves MOQ-Rounded PO (Q) → PO & Movement Persist in Supabase → Overview KPIs & Charts Reflect Updated Stock Position`

Successfully executing this loop empowers dark-store operators and supply chain managers to prevent stockout revenue losses, curb overstock holding bleed, standardize replenishment math, and retain complete operational visibility in a single enterprise interface.

