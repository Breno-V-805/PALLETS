# PALLETS // FMCG AI Predictive Inventory & Replenishment Orchestration
## Enterprise Workspace Architecture & System Specification

This workspace delivers a production-grade, highly sophisticated B2B SaaS web application for FMCG retail inventory intelligence, dark store replenishment, and demand forecasting.

---

### 1. Visual Design System
- **Enterprise SaaS Style**: Replicated from authentic B2B SaaS reference (`otoxa` design system).
- **Sidebar**: Deep midnight navy (`#0A1F38`), clean active pill highlights (`#173A66`), crisp SVG iconography, sub-item navigation, and role-switcher operator button.
- **Top Header**: Elongated global search bar with instant multi-attribute filtering (SKU, brand, category, supplier), notification bell with unread badge, and user profile pill (`Devid Franks`).
- **Dashboard Metric Cards**: 4 responsive stat cards:
  - Card 1: Solid royal blue card (`#0B57D0`) with white briefcase icon, total sales amount, and positive trend pill.
  - Card 2: Crisp white card with inventory valuation and average lead time.
  - Card 3: Crisp white card with critical deficits and stockout revenue risk.
  - Card 4: Crisp white card with SNS Webhook status (200 OK, sub-second latency).
- **Data Visualizations**: Zero external CDN dependencies.
  - Smooth Bézier spline multi-line chart (`charts.js`) with gradient fill for sales earnings vs baseline costs.
  - Segmented donut ring chart (`charts.js`) with rounded caps and center valuation text.
  - Demand Trajectory & 95% Confidence Bounds chart (`charts.js`) with shaded 80% and 95% uncertainty bands.

---

### 2. SNS Agent Workbench Multi-Workflow Backend Integration
- **Target Webhook URL**: `https://api.agents.snsihub.ai/webhook/cc0a6272-8aba-45b2-916a-b44905b2386a`
- **Workflow ID**: `cc0a6272-8aba-45b2-916a-b44905b2386a`
- **Webhook Bridge Class**: [`sns-webhook.js`](file:///./sns-webhook.js) (`SnsWebhookClient`)
- **Multi-Workflow Registry & Inter-Workflow Chaining**:
  - `WF-MASTER`: Central event router & gateway (`cc0a6272-8aba-45b2-916a-b44905b2386a`).
  - `WF-INGEST`: Sales POS ingestion & anomaly normalizer ➔ chains to `WF-FORECAST`.
  - `WF-FORECAST`: AI demand forecasting tournament (MAE/RMSE/WAPE) ➔ chains to `WF-RISK`.
  - `WF-RISK`: Autonomous risk radar ➔ chains to `WF-REPLENISH` on critical deficit.
  - `WF-REPLENISH`: Smart replenishment (ROP/IP/Q) ➔ chains to `WF-SUPPLIER` on PO approval.
  - `WF-SUPPLIER`: Supplier directory & SLA dispatch.
  - `WF-APRIORI`: Customer basket association rule mining ➔ feeds `WF-FORECAST` & `WF-COPILOT`.
  - `WF-COPILOT`: Conversational AI copilot federating across `WF-RISK`, `WF-REPLENISH`, `WF-FORECAST`.
- **Detailed Step-by-Step Guide**: See [`SNS_WORKFLOWS_GUIDE.md`](file:///./SNS_WORKFLOWS_GUIDE.md).
- **Handled Events**:
  - `PROCUREMENT_APPROVAL`: Automated purchase order dispatch with units, vendor, hub, total cost, and neural rationale.
  - `COPILOT_QUERY`: Natural language inventory queries sent directly to webhook with latency logging.
  - `HEALTH_CHECK`: Ping test validating webhook responsiveness.
  - `STOCKOUT_ALERT_TRIGGER`: Alerts generated when buffer drops below ROP.

---

### 3. Core Modules Implemented
1. **User Authentication & Role-Based Access Control**:
   - Operator switcher: `Devid Franks` (Inventory Manager), `Elena Vance` (Admin / Supply Chain VP), and `Rahul Sharma` (Store Staff).
   - Store-level access filtering across 4 regional dark stores (`BLR_NORTH_DC`, `MUM_BANDRA_HUB`, `DEL_GURGAON_CORE`, `HYD_HITEC_STORE`).
2. **Product & Inventory Management**:
   - Master dataset of 12 high-velocity FMCG SKUs (Oatly, Blue Tokai, Ariel Pods, Daawat Basmati, Epigamia Yogurt, Doritos, Tata Salt, Dove, Chilli Crisp, Aashirvaad Atta, Red Bull, Ferrero Rocher).
   - Real-time stock gauges relative to target stock levels, ROP calculation, physical stock adjustments, product deletion, and Add Product modal.
3. **Sales Data Ingestion**:
   - Drag-and-drop CSV/JSON upload with validation for missing fields and duplicate orders.
   - 90-day benchmark sample batch loader aggregating daily velocity and maintaining batch logs.
4. **AI Demand Forecasting Studio**:
   - Model tournament evaluating: Moving Average (7d & 14d), Holt's Linear Exponential Smoothing, and Holt-Winters Weekly Seasonality.
   - Validation on 20% holdout test window calculating MAE, RMSE, and WAPE.
   - 7, 30, and 90-day demand trajectories with promotional boost slider and 80%/95% confidence bands.
5. **Inventory Risk Detection Radar**:
   - Computes stock runway days, stockout ETA dates, and estimated lost revenue.
   - Detects surplus holding bleed on overstocked SKUs (> 35 days runway) and flags velocity spikes.
6. **Smart Replenishment Engine**:
   - Exact mathematical formulas:
     - \(ROP = (Average\ Daily\ Demand \times Lead\ Time) + Safety\ Stock\)
     - \(IP = On\ Hand + On\ Order - Reserved\)
     - \(Q = \max(0, Target\ Stock - IP)\)
     - MOQ round-up: \(\lceil Q / MOQ \rceil \times MOQ\)
     - Total Cost: \(Q \times Cost\ Price\)
   - PO approval modal with direct dispatch to SNS Webhook.
7. **Customer Basket Analytics (Apriori)**:
   - Market Basket Analysis engine evaluating Support %, Confidence %, Lift multiplier, and Bundle Strength.
   - Identifies co-purchased bundles and cross-selling recommendations.
8. **Supplier Performance Directory**:
   - Supplier directory tracking lead times, reliability scores (95-99%), defect rates, on-time delivery %, default MOQ, and contact info.
9. **AI Inventory Copilot**:
   - Expandable chat drawer handling deep FMCG inventory queries with live webhook dispatch and interactive PO action buttons.
10. **Telemetry & Reporting**:
    - Live Webhook Telemetry Terminal modal displaying real-time payloads, timestamps, status codes, and latencies.
    - Automated CSV export of product inventory master.

---

### 4. File Structure
- [`index.html`](file:///./index.html): Full semantic UI layout matching the uploaded SaaS screenshot.
- [`styles.css`](file:///./styles.css): Enterprise design tokens, sidebar navigation, metric cards, tables, modal sheets, and copilot drawer.
- [`app.js`](file:///./app.js): Central orchestrator managing state, filters, PO approvals, copilot responses, and view routing.
- [`sns-webhook.js`](file:///./sns-webhook.js): Resilient client communicating with SNS Agent Workbench webhook.
- [`forecasting-engine.js`](file:///./forecasting-engine.js): Time-series forecasting algorithms, evaluation metrics (MAE, RMSE, WAPE), and prediction intervals.
- [`apriori-engine.js`](file:///./apriori-engine.js): Apriori association rule mining for customer basket combinations.
- [`charts.js`](file:///./charts.js): HTML5 Canvas renderers for Bézier spline charts, donut charts, and forecast projection canvases.

---

### 5. Running the Application
Double-click [`index.html`](file:///./index.html) in any modern browser, or run a local static server:
```powershell
./serve.ps1
```
