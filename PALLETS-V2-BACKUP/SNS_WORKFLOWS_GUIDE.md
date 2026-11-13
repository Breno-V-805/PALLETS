# PALLETS // SNS Agent Workbench Multi-Workflow Architecture Guide
## Designing, Connecting & Chaining Interacting Workflows for FMCG Retail Intelligence

This specification details how to build and connect separate, specialized workflows in **SNS Agent Workbench** (`agents.snsihub.ai` / `api.agents.snsihub.ai`) for each module of the Pallets FMCG application, and how these workflows communicate bi-directionally with each other.

---

## 1. High-Level Multi-Workflow Interactivity Map

```
               ┌────────────────────────────────────────────────────────┐
               │         WF-MASTER: Master Gateway & Event Router       │
               │   https://api.agents.snsihub.ai/webhook/cc0a6272...    │
               └──────────────────────────┬─────────────────────────────┘
                                          │
       ┌──────────────────┬───────────────┴───────────────┬──────────────────┐
       │                  │                               │                  │
       ▼                  ▼                               ▼                  ▼
┌──────────────┐   ┌──────────────┐                ┌──────────────┐   ┌──────────────┐
│  WF-INGEST   │──>│ WF-FORECAST  │───────────────>│   WF-RISK    │──>│ WF-REPLENISH │
│  (Sales POS) │   │ (Tournament) │                │ (Runway/Loss)│   │ (ROP/IP/Qty) │
└──────────────┘   └──────────────┘                └──────────────┘   └──────┬───────┘
                                                          ▲                  │
                                                          │                  │ Approved PO
                                                          │                  ▼
┌──────────────┐   ┌──────────────┐                       │           ┌──────────────┐
│  WF-APRIORI  │──>│  WF-COPILOT  │<──────────────────────┘           │ WF-SUPPLIER  │
│(Basket Lift) │   │ (Federated)  │                                   │(SLA/Dispatch)│
└──────────────┘   └──────────────┘                                   └──────────────┘
```

---

## 2. The 8 Dedicated Workflows: Node-by-Node Setup

---

### Workflow 1: `WF-INGEST` — Sales Data Ingestion & Anomaly Normalizer
- **Purpose**: Ingests POS transactions, drops duplicates, normalizes date & SKU formats, and computes rolling velocities.
- **Trigger**: Webhook Node (`POST`)
  - Endpoint: `https://api.agents.snsihub.ai/webhook/<wf-ingest-id>`
- **Workflow Nodes**:
  1. **Webhook Trigger**: Receives CSV/JSON sales batch payload.
  2. **Code / Function Node (Normalize & Deduplicate)**:
     - Drops duplicate `order_id`s.
     - Aggregates daily velocity per SKU.
     - Flags 3-sigma demand spikes (z-score > 2.5).
  3. **Router / Switch Node**:
     - *Condition 1 (Clean Batch)*: Chains to `WF-FORECAST`.
     - *Condition 2 (Anomaly Detected)*: Also chains to `WF-RISK`.
  4. **HTTP Request Node (Chain to WF-FORECAST)**:
     - Method: `POST`
     - URL: `https://api.agents.snsihub.ai/webhook/<wf-forecast-id>`
     - Payload:
       ```json
       {
         "event": "SALES_BATCH_UPDATED",
         "sourceWorkflow": "WF-INGEST",
         "sku": "SKU-9921-OAT",
         "rollingVelocity": 310,
         "updatedHistory": [...]
       }
       ```
  5. **Webhook Response Node**: Returns status 200 with `{ "status": "INGESTED", "records": 1412 }`.

---

### Workflow 2: `WF-FORECAST` — AI Demand Forecasting Tournament
- **Purpose**: Evaluates time-series forecasting models on an 80/20 train/holdout split, selects the lowest WAPE model, and generates 7, 30, and 90-day trajectories.
- **Trigger**: Webhook Node (`POST`)
  - Endpoint: `https://api.agents.snsihub.ai/webhook/<wf-forecast-id>`
- **Workflow Nodes**:
  1. **Webhook Trigger**: Receives historical sales data from the front end or `WF-INGEST`.
  2. **Code Node (Model Tournament)**:
     - Evaluates Moving Average (7d & 14d), Holt's Linear Smoothing, and Holt-Winters Seasonality.
     - Computes MAE, RMSE, and WAPE.
     - Selects the champion model.
  3. **Code Node (Interval Projection)**:
     - Computes 80% (\(\pm 1.28 \sigma\)) and 95% (\(\pm 1.96 \sigma\)) prediction intervals.
     - Applies promotional boost multiplier (e.g. +15%).
  4. **HTTP Request Node (Chain to WF-RISK)**:
     - Method: `POST`
     - URL: `https://api.agents.snsihub.ai/webhook/<wf-risk-id>`
     - Payload:
       ```json
       {
         "event": "FORECAST_TRAJECTORY_UPDATED",
         "sourceWorkflow": "WF-FORECAST",
         "sku": "SKU-9921-OAT",
         "expectedDailyDemand": 310,
         "predictedNext7Days": 2170,
         "upper95Demand": 2420
       }
       ```
  5. **Webhook Response Node**: Returns forecast schedule and model tournament rankings.

---

### Workflow 3: `WF-RISK` — Autonomous Inventory Risk Radar
- **Purpose**: Compares forecasted demand against on-hand dark store stock to predict stockouts and calculate runway.
- **Trigger**: Webhook Node (`POST`)
  - Endpoint: `https://api.agents.snsihub.ai/webhook/<wf-risk-id>`
- **Workflow Nodes**:
  1. **Webhook Trigger**: Receives inventory levels and forecast trajectory.
  2. **Code Node (Risk Calculation)**:
     - Runway Days = \(On\ Hand / Daily\ Demand\)
     - Stockout ETA Date
     - Revenue at Risk = \(Daily\ Demand \times Price \times \max(1, Lead\ Time - Runway)\)
     - Risk Level: `CRITICAL` (\(\le 3\) days), `HIGH` (3-7 days), `OVERSTOCK` (> 35 days).
  3. **Router / Switch Node**:
     - *If Risk == "CRITICAL"*: Trigger emergency replenishment in `WF-REPLENISH`.
  4. **HTTP Request Node (Chain to WF-REPLENISH)**:
     - Method: `POST`
     - URL: `https://api.agents.snsihub.ai/webhook/<wf-replenish-id>`
     - Payload:
       ```json
       {
         "event": "CRITICAL_DEFICIT_TRIGGER",
         "sourceWorkflow": "WF-RISK",
         "sku": "SKU-9921-OAT",
         "runwayDays": 1.4,
         "urgency": "CRITICAL"
       }
       ```
  5. **Webhook Response Node**: Returns risk radar assessment table data.

---

### Workflow 4: `WF-REPLENISH` — Smart Replenishment & PO Engine
- **Purpose**: Computes mathematical reorder parameters and stages purchase order requisitions.
- **Trigger**: Webhook Node (`POST`)
  - Endpoint: `https://api.agents.snsihub.ai/webhook/<wf-replenish-id>`
- **Workflow Nodes**:
  1. **Webhook Trigger**: Receives replenishment evaluation or manager PO approval.
  2. **Code Node (Replenishment Formulas)**:
     - \(ROP = (Average\ Daily\ Demand \times Lead\ Time) + Safety\ Stock\)
     - \(IP = On\ Hand + On\ Order - Reserved\)
     - \(Q = \max(0, Target\ Stock - IP)\)
     - MOQ round-up: \(\lceil Q / MOQ \rceil \times MOQ\)
     - Total Cost: \(Q \times Cost\ Price\)
  3. **Router / Switch Node**:
     - *Action == "PROCUREMENT_APPROVAL"*: Manager has approved the PO \(\rightarrow\) Chain to `WF-SUPPLIER`.
  4. **HTTP Request Node (Chain to WF-SUPPLIER)**:
     - Method: `POST`
     - URL: `https://api.agents.snsihub.ai/webhook/<wf-supplier-id>`
     - Payload:
       ```json
       {
         "event": "DISPATCH_PURCHASE_ORDER",
         "sourceWorkflow": "WF-REPLENISH",
         "poNumber": "PO-98421",
         "sku": "SKU-9921-OAT",
         "vendor": "Oatly Indo-Pacific Logistics Pvt Ltd",
         "units": 2000,
         "totalCost": 390000,
         "hub": "BLR_NORTH_DC",
         "approvedBy": "Devid Franks (Inventory Manager)"
       }
       ```
  5. **Webhook Response Node**: Returns confirmed PO details and updated inventory position.

---

### Workflow 5: `WF-SUPPLIER` — Supplier Directory & Order Dispatch
- **Purpose**: Tracks vendor delivery SLAs, calculates reliability scores, and handles EDI/email PO dispatches.
- **Trigger**: Webhook Node (`POST`)
  - Endpoint: `https://api.agents.snsihub.ai/webhook/<wf-supplier-id>`
- **Workflow Nodes**:
  1. **Webhook Trigger**: Receives approved PO from `WF-REPLENISH`.
  2. **Code Node (Vendor SLA Check)**:
     - Verifies vendor lead time, defect rate, and on-time delivery metric.
  3. **Email / Slack / Webhook Dispatch Node**:
     - Sends dispatch notification to vendor logistics contact.
  4. **Webhook Response Node**: Returns delivery confirmation and estimated arrival date.

---

### Workflow 6: `WF-APRIORI` — Market Basket Customer Behavior Analytics
- **Purpose**: Discovers frequently co-purchased bundles and calculates Support %, Confidence %, and Lift.
- **Trigger**: Webhook Node (`POST`)
  - Endpoint: `https://api.agents.snsihub.ai/webhook/<wf-apriori-id>`
- **Workflow Nodes**:
  1. **Webhook Trigger**: Receives transaction basket arrays.
  2. **Code Node (Apriori Rule Mining)**:
     - Calculates 1-itemset Support and 2-itemset co-occurrence.
     - Derives Confidence and Lift multipliers.
  3. **HTTP Request Node (Chain to WF-FORECAST)**:
     - Passes high-lift cross-sell bundles to `WF-FORECAST` to apply bundle uplift adjustments.
  4. **Webhook Response Node**: Returns association rules table.

---

### Workflow 7: `WF-COPILOT` — Conversational AI Copilot (Federated Master Hub)
- **Purpose**: Natural Language query engine that federates questions across `WF-RISK`, `WF-REPLENISH`, and `WF-FORECAST`.
- **Trigger**: Webhook Node (`POST`)
  - Endpoint: `https://api.agents.snsihub.ai/webhook/<wf-copilot-id>`
- **Workflow Nodes**:
  1. **Webhook Trigger**: Receives user chat query.
  2. **LLM Node (Query Intent Classifier)**:
     - Determines query category: `STOCKOUT_INQUIRY`, `REORDER_CALCULATION`, `OVERSTOCK_AUDIT`, or `VALUATION`.
  3. **Router / Switch Node**:
     - Routes to `WF-RISK` for stockout questions.
     - Routes to `WF-REPLENISH` for reorder calculations.
     - Routes to `WF-FORECAST` for demand projections.
  4. **LLM Synthesis Node**:
     - Synthesizes sub-workflow responses into an executive markdown reply with clickable PO action buttons.
  5. **Webhook Response Node**: Returns structured chat message.

---

### Workflow 8: `WF-MASTER` — Central Orchestrator Gateway
- **Target URL**: `https://api.agents.snsihub.ai/webhook/cc0a6272-8aba-45b2-916a-b44905b2386a`
- **Workflow ID**: `cc0a6272-8aba-45b2-916a-b44905b2386a`
- **Purpose**: Acts as the Master Dispatcher. If the front end has not yet assigned a dedicated URL for a feature, `WF-MASTER` inspects `input.event` or `input.workflowId` using a Router node and chains execution to the target sub-workflow.

---

## 3. Configuring Workflows in the Web App

You can manage all 8 feature workflows directly inside the running application:

1. Click **Settings** in the bottom-left sidebar of the app (or click the gear icon).
2. The **SNS Multi-Workflow Orchestration Manager** modal opens:
   - Displays all 8 feature workflows with their inter-workflow interaction paths.
   - Shows connection status: `● Dedicated` (if you entered a custom URL) or `● Master Gateway` (routed via `cc0a6272...`).
3. For each workflow:
   - Paste the dedicated webhook URL you created in `agents.snsihub.ai`.
   - Click the **Ping** button to perform an immediate health check and measure round-trip latency.
4. Click **Save Workflow Endpoints** to persist the configuration across browser sessions.
5. Click **View Telemetry Stream** to see live inter-workflow payloads, timestamps, and status codes.

---

## 4. User Registration, Role-Based Access Control (RBAC), & Supabase Sync

The platform implements strict Role-Based Access Control (RBAC) separating **Administrators** from **Normal Users (Store Staff & Associates)**:

### RBAC Privacy & Security Rules
1. **Zero Visibility of SNS to Normal Users**:
   - Normal users have **zero visual evidence** of SNS Agent Workbench.
   - The sidebar buttons for "SNS Webhook Log" and "SNS Workflows" are hidden (`display: none !important`).
   - The top header webhook badge is replaced with an operational store status badge (`"Network: Operational (Regional DCs Synced)"`).
   - Metric Card 4 switches from `"SNS Webhook | 200 OK"` to `"Store Network Health | 4 Regional DCs | 99.8%"`.
   - The AI Copilot button and chat header switch from `"SNS Agent Copilot"` to `"Pallets AI Copilot"`.
   - Any attempt to open the Workflow Manager or Telemetry Stream modal is programmatically blocked (`"Access Denied: SNS Workbench settings require Administrator privileges."`).
2. **Full Visibility to System Admins**:
   - Admins (`Elena Vance`) have full access to configure workflows, inspect live telemetry streams, and ping endpoints.

### Supabase Cloud Database Table Schema
In your Supabase project SQL Editor, run the following SQL command to create the user directory table:

```sql
CREATE TABLE pallets_users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'Staff',
  store_hub TEXT,
  password_hash_placeholder TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### SNS Workbench Native Supabase Node Flow
When a user creates an account in the web app, [`sns-webhook.js`](file:///./sns-webhook.js) dispatches this `USER_REGISTRATION` envelope to the SNS Master Gateway webhook:

```json
{
  "event": "USER_REGISTRATION",
  "workflowId": "WF-MASTER",
  "source": "PALLETS_ENTERPRISE_WEBAPP",
  "data": {
    "targetDatabase": "SUPABASE",
    "table": "pallets_users",
    "action": "INSERT",
    "user": {
      "id": "USR-4819",
      "name": "Alex Morgan",
      "email": "alex@company.com",
      "role": "Staff (Dark Store Associate)",
      "store_hub": "BLR_NORTH_DC",
      "password_hash_placeholder": "[SECURE_ARGON2_HASH]",
      "created_at": "2026-11-10T12:00:00.000Z"
    }
  }
}
```

In **SNS Agent Workbench**, connect the following nodes:
1. **Webhook Trigger Node**: Receives incoming `USER_REGISTRATION` payload.
2. **Switch / Filter Node**: Check `{{ $json.body?.event || $json.event }}` Equal to `USER_REGISTRATION`.
3. **Code Node (`Code - Sanitize User`)**: Extracts `data.user` and outputs flat columns (`id`, `name`, `email`, `role`, `store_hub`, `password_hash_placeholder`, `created_at`).
4. **Native Supabase Node (`Create Row`)**:
   - **Supabase Credential**: Connect via Host URL + Service Role Secret / API Key.
   - **Resource**: `Row`
   - **Operation**: `Create row` (or change `Update Row` ➔ `Operation` to `Create row`).
   - **Table Name or ID**: `pallets_users`
   - **Data to Send**: `Auto-Map Input Data to Columns` (or `Define Below for Each Column` mapping `id`, `name`, `email`, `role`, `store_hub`, `password_hash_placeholder`, `created_at`).
5. **Webhook Response Node**: Returns HTTP 200 with `{ "success": true, "status": 200, "message": "User stored in Supabase" }`.

