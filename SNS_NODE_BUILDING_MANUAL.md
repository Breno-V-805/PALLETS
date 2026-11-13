# SNS Agent Workbench // Complete Node Construction Manual
## Step-by-Step Guide to Building Every Node Across Interacting Workflows

This manual provides the exact configuration, code, and wiring instructions for every node in **SNS Agent Workbench** (`agents.snsihub.ai`).

---

## The 5 Essential Node Types in SNS Workbench

| Node Type | Category in Palette | What It Does |
|---|---|---|
| **Webhook Trigger** | `Triggers` | The starting entry point that receives JSON requests from the frontend or an upstream workflow. |
| **Code / JavaScript** | `Logic & Flow Control` | Executes custom JavaScript for data normalization, mathematical formulas, and algorithms. |
| **Router / Switch** | `Logic & Flow Control` | Evaluates conditions (e.g., `is Critical`, `is Approved`) and splits execution paths. |
| **HTTP Request** | `Integrations / Actions` | Calls another workflow's webhook URL to pass data (inter-workflow chaining). |
| **Webhook Response** | `Input / Output` | Sends a JSON response with status code `200` back to the calling system. |
| **LLM / AI Node** | `AI / LLM` | Prompts an AI model (GPT-4o, Claude 3.5, or Gemini) to classify or synthesize responses. |

---

## Workflow 1: `WF-INGEST` (Sales Data Ingestion)

### Node 1: Webhook Trigger (Entry Point)
- **Node Name**: `Webhook - Ingest Sales`
- **Method**: `POST`
- **Path**: `ingest-sales` (or generated UUID)
- **Respond**: `Using 'Respond to Webhook' Node`

---

### Node 2: Code Node (Deduplication & Anomaly Normalizer)
- **Node Name**: `Code - Clean & Validate POS`
- **Language**: `JavaScript`
- **Execution Mode**: `Run Once for All Items` *(default)*
- **Paste this exact code**:
```javascript
const inputItems = $input.all();
const firstJson = (inputItems[0] && inputItems[0].json) ? inputItems[0].json : {};
const raw = (firstJson.body && typeof firstJson.body === 'object') ? firstJson.body : firstJson;
const payload = (raw.data && typeof raw.data === 'object') ? raw.data : raw;

const records = Array.isArray(payload.records) ? payload.records : [];
const seenOrders = new Set();
const cleanRecords = [];
let duplicatesCount = 0;

for (const row of records) {
  if (!row || typeof row !== 'object') continue;
  const orderId = row.order_id || row.orderId;
  if (orderId && seenOrders.has(orderId)) {
    duplicatesCount++;
    continue;
  }
  if (orderId) seenOrders.add(orderId);

  const parsedDate = new Date(row.sale_date || Date.now());
  const saleDate = isNaN(parsedDate.getTime())
    ? new Date().toISOString().split('T')[0]
    : parsedDate.toISOString().split('T')[0];

  cleanRecords.push({
    orderId: orderId || ('ORD-' + (cleanRecords.length + 1)),
    sku: String(row.sku || row.product_id || 'UNKNOWN').toUpperCase().trim(),
    hub: row.store_id || 'BLR_NORTH_DC',
    quantity: Math.max(1, parseInt(row.quantity || 1, 10)),
    unitPrice: parseFloat(row.unit_price || 0),
    saleDate
  });
}

// Compute aggregate daily velocity
const velocityMap = {};
cleanRecords.forEach(r => {
  velocityMap[r.sku] = (velocityMap[r.sku] || 0) + r.quantity;
});

// Check for 3-sigma demand spikes (> 400 units/SKU)
const hasAnomaly = Object.values(velocityMap).some(v => v > 400);

return [
  {
    json: {
      status: 'INGESTED_SUCCESS',
      batchId: payload.batchId || 'BATCH-LIVE',
      totalRecords: records.length,
      imported: cleanRecords.length,
      duplicatesDropped: duplicatesCount,
      hasAnomaly,
      velocities: velocityMap,
      cleanRecords: cleanRecords.slice(0, 50)
    }
  }
];
```

---

### Node 3: Router / Switch Node (Check for Anomaly)
- **Node Name**: `Switch - Anomaly Routing`
- **Rule 1 (Normal Stream - No Spike)**:
  - Value 1: `{{$json.hasAnomaly}}`
  - Condition: `Equal to`
  - Value 2: `false`
  - **Connect Output 1 to**: `Node 4: HTTP - Trigger WF-FORECAST`
- **Rule 2 (Spike Detected - Urgent Demand Surge)**:
  - Value 1: `{{$json.hasAnomaly}}`
  - Condition: `Equal to`
  - Value 2: `true`
  - **Connect Output 2 to**: `Node 4B: HTTP - Alert WF-RISK` (optional alert branch), OR simply connect **Output 2 directly to Node 4: HTTP - Trigger WF-FORECAST** as well!

> **Visual Wiring Flow:**
> ```
> [Node 2: Code] ──> [Node 3: Switch]
>                         │
>      Output 1 (Normal)  ├────────────> [Node 4: HTTP to WF-FORECAST] ──> [Node 5: Response]
>                         │                               ▲
>      Output 2 (Spike)   └──> [Node 4B: Alert WF-RISK] ──┘
> ```

---

### Node 4: HTTP Request Node (Call WF-FORECAST)
- **Node Name**: `HTTP - Trigger WF-FORECAST`
- **Method**: `POST`
- **URL**: `https://api.agents.snsihub.ai/webhook/<your-wf-forecast-id>`
- **Headers**:
  - `Content-Type`: `application/json`
- **Body Content Type**: `JSON`
- **Body** *(do **NOT** put `=` or quotes `"` around object/number/boolean pills like `velocities`, `imported`, or `hasAnomaly`)*:
```json
{
  "event": "SERIES_UPDATED",
  "sourceWorkflow": "WF-INGEST",
  "data": {
    "velocities": {{$json.velocities}},
    "totalImported": {{$json.imported}},
    "hasAnomaly": {{$json.hasAnomaly}}
  }
}
```

---

### Node 4B (Optional Branch): HTTP Request Node (Alert WF-RISK)
- **Node Name**: `HTTP - Alert WF-RISK`
- **Method**: `POST`
- **URL**: `https://api.agents.snsihub.ai/webhook/<your-wf-risk-id>`
- **Body**:
```json
{
  "event": "DEMAND_SPIKE_DETECTED",
  "sourceWorkflow": "WF-INGEST",
  "data": {
    "message": "Sudden volume spike detected in sales stream",
    "velocities": {{$json.velocities}}
  }
}
```
*After Node 4B executes, drag its output line into Node 4 (HTTP - Trigger WF-FORECAST).*

---

### Node 5: Webhook Response Node (Return to Web App)
- **Node Name**: `Response - Ingestion Done`
- **Respond With**: `JSON`
- **Response Code**: `200`
- **Response Body** *(drag `output` from previous step — do **NOT** put an `=` in front)*:
```json
{{$json}}
```

---

## Workflow 2: `WF-FORECAST` (AI Demand Forecasting Tournament)

### Node 1: Webhook Trigger
- **Node Name**: `Webhook - Forecast Request`
- **Method**: `POST`

---

### Node 2: Code Node (Model Tournament Math)
- **Node Name**: `Code - Model Tournament (MA, Holt, Holt-Winters)`
- **Language**: `JavaScript`
- **Execution Mode**: `Run Once for All Items` *(default)*
- **Paste this exact code**:
```javascript
const inputItems = $input.all();
const firstJson = (inputItems[0] && inputItems[0].json) ? inputItems[0].json : {};
const raw = (firstJson.body && typeof firstJson.body === 'object') ? firstJson.body : firstJson;
const input = (raw.data && typeof raw.data === 'object') ? raw.data : raw;

const defaultSeries = [280, 295, 310, 305, 330, 315, 340, 320, 350, 345, 360, 355, 370, 390];
const series = (Array.isArray(input.history) && input.history.length >= 2)
  ? input.history.map(v => parseFloat(v) || 0)
  : defaultSeries;
const horizon = parseInt(input.horizon !== undefined && input.horizon !== null ? input.horizon : 30, 10);
const promoBoost = parseFloat(input.promoBoost !== undefined && input.promoBoost !== null ? input.promoBoost : 0.15);

// 1. Moving Average (7d)
const win = Math.min(7, series.length);
const ma7 = series.slice(-win).reduce((a, b) => a + b, 0) / win;

// 2. Double Exponential Smoothing (Holt's Linear)
let level = series[0];
let trend = series[1] - series[0];
const alpha = 0.3;
const beta = 0.1;
for (let i = 1; i < series.length; i++) {
  const lastLevel = level;
  level = alpha * series[i] + (1 - alpha) * (lastLevel + trend);
  trend = beta * (level - lastLevel) + (1 - beta) * trend;
}
const holtPred = Math.max(0, level + trend * (horizon / 2));

// Calculate tournament metrics (WAPE %)
const actualSum = Math.max(1, series.slice(-win).reduce((a, b) => a + b, 0));
const wapeMA = Math.round((Math.abs(actualSum - ma7 * win) / actualSum) * 1000) / 10;
const wapeHolt = Math.round((Math.abs(actualSum - holtPred * win) / actualSum) * 1000) / 10;

// Champion model selection
const bestModel = wapeHolt < wapeMA ? "Holt's Linear Smoothing" : "Moving Average (7-Day)";
const championWape = Math.min(wapeMA, wapeHolt);

// Point forecast with promo boost
const baseDaily = Math.round((wapeHolt < wapeMA ? holtPred : ma7) * (1 + promoBoost));
const next7Days = baseDaily * 7;
const next30Days = baseDaily * 30;

return [
  {
    json: {
      status: 'TOURNAMENT_COMPLETE',
      sku: input.sku || 'SKU-9921-OAT',
      championModel: bestModel,
      wape: championWape,
      projectedDailyDemand: baseDaily,
      next7DaysDemand: next7Days,
      next30DaysDemand: next30Days,
      upper95Daily: Math.round(baseDaily * 1.18),
      lower95Daily: Math.round(baseDaily * 0.82)
    }
  }
];
```

---

### Node 3: HTTP Request Node (Chain to WF-RISK)
- **Node Name**: `HTTP - Pass Demand to WF-RISK`
- **Method**: `POST`
- **URL**: `https://api.agents.snsihub.ai/webhook/<your-wf-risk-id>`
- **Body** *(string fields keep quotes `""` without `=`; numbers omit both quotes and `=`)*:
```json
{
  "event": "DEMAND_TRAJECTORY_UPDATED",
  "sourceWorkflow": "WF-FORECAST",
  "data": {
    "sku": "{{$json.sku}}",
    "projectedDailyDemand": {{$json.projectedDailyDemand}},
    "upper95Daily": {{$json.upper95Daily}}
  }
}
```

---

### Node 4: Webhook Response Node
- **Node Name**: `Response - Forecast Done`
- **Respond With**: `JSON`
- **Response Code**: `200`
- **Response Body** *(drag `output` pill — delete any `=` before it!)*: `{{$json}}`

---

## Workflow 3: `WF-RISK` (Autonomous Risk Radar)

### Node 1: Webhook Trigger
- **Node Name**: `Webhook - Risk Check`
- **Method**: `POST`

---

### Node 2: Code Node (Runway & Stockout Calculation)
- **Node Name**: `Code - Stockout & Deficit Math`
- **Language**: `JavaScript`
- **Execution Mode**: `Run Once for All Items` *(default)*
- **Paste this exact code**:
```javascript
const inputItems = $input.all();
const firstJson = (inputItems[0] && inputItems[0].json) ? inputItems[0].json : {};
const raw = (firstJson.body && typeof firstJson.body === 'object') ? firstJson.body : firstJson;
const input = (raw.data && typeof raw.data === 'object') ? raw.data : raw;

const onHand = parseInt(input.onHand !== undefined && input.onHand !== null ? input.onHand : 142, 10);
const dailyDemand = Math.max(1, parseInt(input.projectedDailyDemand || input.dailyDemand || 310, 10));
const leadTimeDays = parseInt(input.leadTimeDays !== undefined && input.leadTimeDays !== null ? input.leadTimeDays : 2, 10);
const unitPrice = parseFloat(input.unitPrice !== undefined && input.unitPrice !== null ? input.unitPrice : 280);

// Calculate Runway Days
const runwayDays = Math.round((onHand / dailyDemand) * 10) / 10;

// Determine Risk Category
let urgency = 'OPTIMAL';
if (runwayDays <= 3.0) urgency = 'CRITICAL';
else if (runwayDays <= 7.0) urgency = 'HIGH';
else if (runwayDays >= 35.0) urgency = 'OVERSTOCK';

// Estimate Revenue Lost
let revenueLoss = 0;
if (runwayDays < leadTimeDays) {
  const stockoutDays = Math.max(1, leadTimeDays - Math.floor(runwayDays));
  revenueLoss = Math.round(stockoutDays * dailyDemand * unitPrice);
}

return [
  {
    json: {
      sku: input.sku || 'SKU-9921-OAT',
      onHand,
      dailyDemand,
      leadTimeDays,
      runwayDays,
      urgency,
      estimatedRevenueLoss: revenueLoss,
      requiresEmergencyReplenishment: urgency === 'CRITICAL' || urgency === 'HIGH'
    }
  }
];
```

---

### Node 3: Router / Switch Node (Check If Reorder Trigger Needed)
- **Node Name**: `Switch - Reorder Urgency`
- **Rule 1**:
  - Value 1: `{{$json.requiresEmergencyReplenishment}}`
  - Condition: `Equal to`
  - Value 2: `true`
  - **Connect Output 1 to**: `Node 4 (HTTP - Call WF-REPLENISH)`
- **Rule 2**:
  - Fallback / Healthy buffer \(\rightarrow\) Connect to `Node 5 (Response)`

---

### Node 4: HTTP Request Node (Chain to WF-REPLENISH)
- **Node Name**: `HTTP - Trigger Replenishment Queue`
- **Method**: `POST`
- **URL**: `https://api.agents.snsihub.ai/webhook/<your-wf-replenish-id>`
- **Body** *(strings keep quotes without `=`; numbers omit quotes and `=`)*:
```json
{
  "event": "CRITICAL_DEFICIT_TRIGGER",
  "sourceWorkflow": "WF-RISK",
  "data": {
    "sku": "{{$json.sku}}",
    "onHand": {{$json.onHand}},
    "dailyDemand": {{$json.dailyDemand}},
    "leadTimeDays": {{$json.leadTimeDays}},
    "runwayDays": {{$json.runwayDays}},
    "urgency": "{{$json.urgency}}"
  }
}
```

---

### Node 5: Webhook Response Node
- **Node Name**: `Response - Risk Analysis Done`
- **Respond With**: `JSON`
- **Response Code**: `200`
- **Response Body** *(drag `output` pill — delete any `=` before it!)*: `{{$json}}`

---

## Workflow 4: `WF-REPLENISH` (Smart Replenishment Engine)

### Node 1: Webhook Trigger
- **Node Name**: `Webhook - Replenishment Event`
- **Method**: `POST`

---

### Node 2: Code Node (Mathematical ROP & Q Formula)
- **Node Name**: `Code - ROP, IP, Q, MOQ Formulas`
- **Language**: `JavaScript`
- **Execution Mode**: `Run Once for All Items` *(default)*
- **Paste this exact code**:
```javascript
const inputItems = $input.all();
const firstJson = (inputItems[0] && inputItems[0].json) ? inputItems[0].json : {};
const raw = (firstJson.body && typeof firstJson.body === 'object') ? firstJson.body : firstJson;
const input = (raw.data && typeof raw.data === 'object') ? raw.data : raw;
const eventType = raw.event || input.eventType || firstJson.event || 'EVALUATE';

const onHand = parseInt(input.onHand !== undefined && input.onHand !== null ? input.onHand : 142, 10);
const onOrder = parseInt(input.onOrder !== undefined && input.onOrder !== null ? input.onOrder : 0, 10);
const reserved = parseInt(input.reserved !== undefined && input.reserved !== null ? input.reserved : 40, 10);
const dailyDemand = parseInt(input.dailyDemand !== undefined && input.dailyDemand !== null ? input.dailyDemand : 310, 10);
const leadTime = parseInt(input.leadTimeDays !== undefined && input.leadTimeDays !== null ? input.leadTimeDays : 2, 10);
const safetyStock = parseInt(input.safetyStock !== undefined && input.safetyStock !== null ? input.safetyStock : 300, 10);
const targetStock = parseInt(input.targetStock !== undefined && input.targetStock !== null ? input.targetStock : 2000, 10);
const moq = Math.max(1, parseInt(input.moq !== undefined && input.moq !== null ? input.moq : 500, 10));
const costPrice = parseFloat(input.costPrice !== undefined && input.costPrice !== null ? input.costPrice : 195);

// Formula 1: Reorder Point (ROP) = (Demand * Lead Time) + Safety Stock
const rop = Math.round((dailyDemand * leadTime) + safetyStock);

// Formula 2: Inventory Position (IP) = On Hand + On Order - Reserved
const ip = onHand + onOrder - reserved;

// Formula 3: Recommended Order Quantity Q = max(0, Target - IP)
const rawQ = Math.max(0, targetStock - ip);

// Formula 4: MOQ Round-up
const orderQty = rawQ > 0 ? Math.ceil(rawQ / moq) * moq : 0;
const totalCost = orderQty * costPrice;
const poNumber = input.poNumber || ('PO-' + Math.floor(10000 + Math.random() * 90000));

return [
  {
    json: {
      eventType,
      poNumber,
      sku: input.sku || 'SKU-9921-OAT',
      productName: input.productName || 'Oatly Barista Oat Milk 1L',
      vendor: input.vendor || 'Oatly Indo-Pacific Logistics Pvt Ltd',
      hub: input.hub || 'BLR_NORTH_DC',
      calculatedRop: rop,
      inventoryPosition: ip,
      recommendedQty: orderQty,
      totalCost,
      isApproved: eventType === 'PROCUREMENT_APPROVAL'
    }
  }
];
```

---

### Node 3: Router / Switch Node (Check If PO Approved)
- **Node Name**: `Switch - Check Approval`
- **Rule 1 (PO is Approved by Manager)**:
  - Value 1: `{{$json.isApproved}}`
  - Condition: `Equal to`
  - Value 2: `true`
  - **Connect Output 1 to**: `Node 4 (HTTP - Call WF-SUPPLIER)`
- **Rule 2 (Draft Requisition)**:
  - Value 1: `{{$json.isApproved}}`
  - Condition: `Equal to`
  - Value 2: `false`
  - **Connect Output 2 to**: `Node 5 (Webhook Response)`

---

### Node 4: HTTP Request Node (Chain to WF-SUPPLIER)
- **Node Name**: `HTTP - Dispatch PO to Supplier`
- **Method**: `POST`
- **URL**: `https://api.agents.snsihub.ai/webhook/<your-wf-supplier-id>`
- **Body** *(strings keep quotes without `=`; numbers omit quotes and `=`)*:
```json
{
  "event": "DISPATCH_PURCHASE_ORDER",
  "sourceWorkflow": "WF-REPLENISH",
  "data": {
    "poNumber": "{{$json.poNumber}}",
    "sku": "{{$json.sku}}",
    "productName": "{{$json.productName}}",
    "vendor": "{{$json.vendor}}",
    "units": {{$json.recommendedQty}},
    "totalCost": {{$json.totalCost}},
    "destinationHub": "{{$json.hub}}"
  }
}
```
*(Note: When testing `WF-REPLENISH` without `"event": "PROCUREMENT_APPROVAL"`, `isApproved` is `false`, so Switch routes to Node 5 and `HTTP - Dispatch PO to Supplier` shows `NO DATA ITEMS FOUND`. Send a `PROCUREMENT_APPROVAL` payload to trigger Output 1.)*

---

### Node 5: Webhook Response Node
- **Node Name**: `Response - Replenishment Staged`
- **Respond With**: `JSON`
- **Response Code**: `200`
- **Response Body** *(drag `output` pill — delete any `=` before it!)*: `{{$json}}`

---

## Workflow 5: `WF-SUPPLIER` (Supplier Performance & Dispatch)

### Node 1: Webhook Trigger
- **Node Name**: `Webhook - Supplier Inbound`
- **Method**: `POST`

---

### Node 2: Code Node (Vendor SLA Check)
- **Node Name**: `Code - SLA & Arrival Validation`
- **Language**: `JavaScript`
- **Execution Mode**: `Run Once for All Items` *(default)*
- **Paste this exact code**:
```javascript
const inputItems = $input.all();
const firstJson = (inputItems[0] && inputItems[0].json) ? inputItems[0].json : {};
const raw = (firstJson.body && typeof firstJson.body === 'object') ? firstJson.body : firstJson;
const input = (raw.data && typeof raw.data === 'object') ? raw.data : raw;

const now = new Date();
const leadTimeDays = parseInt(input.leadTimeDays || 2, 10);
const expectedArrival = new Date(now.getTime() + leadTimeDays * 24 * 60 * 60 * 1000);

return [
  {
    json: {
      status: 'PURCHASE_ORDER_EXECUTED',
      poNumber: input.poNumber || 'PO-98421',
      sku: input.sku || 'SKU-9921-OAT',
      vendor: input.vendor || 'Oatly Indo-Pacific Logistics Pvt Ltd',
      units: input.units || 2000,
      totalCost: input.totalCost || 390000,
      destinationHub: input.destinationHub || 'BLR_NORTH_DC',
      dispatchedAt: now.toISOString(),
      expectedDelivery: expectedArrival.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      supplierSlaConfirmed: true
    }
  }
];
```

---

### Node 3: Webhook Response Node
- **Node Name**: `Response - PO Confirmation`
- **Respond With**: `JSON`
- **Response Code**: `200`
- **Response Body** *(drag `output` pill — delete any `=` before it!)*: `{{$json}}`

---

## Workflow 6: `WF-COPILOT` (AI Inventory Copilot - Federated Hub)

### Node 1: Webhook Trigger
- **Node Name**: `Webhook - Copilot Query`
- **Method**: `POST`

---

### Node 2: LLM Node (Query Intent Classifier)
- **Node Name**: `LLM - Intent Classifier`
- **Provider**: `OpenAI / Anthropic / Gemini`
- **System Prompt**:
```
You are the query routing agent for Pallets FMCG Retail Inventory.
Classify the user's inquiry into exactly one of these categories:
- STOCKOUT_INQUIRY: User asking what runs out next week, buffer shortages, or critical deficits.
- REORDER_INQUIRY: User asking how much to reorder, PO calculations, or milk/item quantities.
- OVERSTOCK_INQUIRY: User asking about surplus capital, slow moving items, or excess stock.
- VALUATION_INQUIRY: User asking about total inventory value or holding costs.
- GENERAL_INQUIRY: Any other greeting or question.

Output strictly JSON:
{ "intent": "CATEGORY_NAME", "targetSku": "SKU_CODE_IF_MENTIONED" }
```

---

### Node 3: Router / Switch Node (Route to Sub-Workflow)
- **Node Name**: `Switch - Route by Intent`
- **Rule 1 (Stockouts)**: `{{$json.intent}} == 'STOCKOUT_INQUIRY'` \(\rightarrow\) Connect to `HTTP Call to WF-RISK`
- **Rule 2 (Reorder)**: `{{$json.intent}} == 'REORDER_INQUIRY'` \(\rightarrow\) Connect to `HTTP Call to WF-REPLENISH`
- **Rule 3 (Default)**: Connect directly to `Node 5 (LLM Synthesis)`

---

### Node 4: LLM Synthesis Node
- **Node Name**: `LLM - Response Formatter`
- **System Prompt**:
```
You are the Pallets FMCG Predictive Copilot for dark stores.
Format your answer clearly with:
- Clear bold highlights for numbers, units, and dates
- Bullet points for multiple SKUs
- Exact calculations of runway days and reorder quantities (Q)
- Actionable advice for the dark store inventory manager
Keep the response professional, concise, and without emojis.
```

---

### Node 5: Webhook Response Node
- **Node Name**: `Response - Copilot Answer`
- **Respond With**: `JSON`
- **Response Code**: `200`
- **Response Data**:
```json
{
  "success": true,
  "reply": "={{$json.text || $json.reply}}",
  "status": "completed"
}
```

---

---

## Workflow 7: `WF-AUTH-SUPABASE` (Native Supabase Node — User Registration & Storage)

- **Workflow Name**: `WF-AUTH-SUPABASE` *(or a Switch branch inside `WF-MASTER`)*
- **Purpose**: Receives `USER_REGISTRATION` events from the Pallets Login/Signup Landing Page, cleans the payload, and inserts the operator record directly into your Supabase `pallets_users` table using SNS Workbench's **built-in Supabase Node**.
- **Important Tool Note**: In the `Workflow Tools` sidebar (when searching `supa`):
  - Use the **Supabase Row** nodes (`Create Row`, `Get Row`, `Get Many Rows`, `Update Row`). Scroll up slightly above `Get Many Rows` to find `Create Row`, OR drag `Update Row` and change the **Operation** dropdown to **`Create row`**.
  - Do **NOT** use **`Supabase Memory`** — that node is only for AI Agent chat memory, not database tables.

```
┌────────────────────────┐      ┌────────────────────────┐      ┌────────────────────────┐
│  Node 1: Webhook       │ ───> │  Node 2: Filter/Switch │ ───> │  Node 3: Code Node     │
│  (USER_REGISTRATION)   │      │  (Check event name)    │      │  (Extract & Flatten)   │
└────────────────────────┘      └────────────────────────┘      └────────────────────────┘
                                                                             │
                                ┌────────────────────────┐                   ▼
                                │  Node 5: Respond to    │ <─── ┌────────────────────────┐
                                │  Webhook (200 OK JSON) │      │  Node 4: Supabase Node │
                                └────────────────────────┘      │  (Row -> Create Row)   │
                                                                └────────────────────────┘
```

---

### Step 0: Create the Table & Copy Credentials in Supabase

1. Open your **Supabase Dashboard** (`supabase.com`) ➔ **SQL Editor** ➔ **New Query**, and run:

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

-- Enable Row Level Security (RLS)
ALTER TABLE pallets_users ENABLE ROW LEVEL SECURITY;

-- Allow API inserts and reads (or use your Service Role Key in SNS Workbench)
CREATE POLICY "Allow API insert" ON pallets_users FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow API read" ON pallets_users FOR SELECT USING (true);
```

2. Go to **Project Settings** (gear icon) ➔ **API** and keep these two values ready:
   - **Project URL** (`https://<your-project-ref>.supabase.co`)
   - **service_role secret key** (recommended for SNS Workbench backend nodes) or **anon public key**.

---

### Node 1: Webhook Trigger (Entry Point)
- **Node Type**: `Webhook` (`Triggers`)
- **HTTP Method**: `POST`
- **Respond**: `Using 'Respond to Webhook' Node`
- *(Note: If building this inside your Master Gateway workflow `cc0a6272-8aba-45b2-916a-b44905b2386a`, reuse your existing Webhook Trigger and branch from your Router/Switch node!)*

---

### Node 2: Switch Node (Route `USER_REGISTRATION` / `SUPABASE`)
Look at the **Previous Steps ➔ Schema** panel on the left inside `Switch`: Webhook payloads in SNS Workbench are nested inside **`body.*`**. Do **not** type plain `eventType` (which evaluates to `undefined`).

- **Node Type**: `Switch` (`Logic & Flow Control`)
- **Output 0 (`Route 0`)**:
  - Drag **`body.data.targetDatabase`** from the left **Schema** list into the Condition input *(or drag **`body.event`** if filtering by event name)*.
  - **Operator**: `Is Equal To`
  - **Value**: `SUPABASE` *(or `USER_REGISTRATION` if checking `body.event`)*
- *(Remove any unnecessary `Output 1: Is Not Equal To` rule, or leave Fallback unconnected.)*
- **Execute Step ▶** on `Switch` and confirm **Output Preview** displays **`Output-0 Branch (1 item)`**.
- **Connect `Route 0` (`Output 0`) to**: `Node 3 (Code - Sanitize User)`

---

### Node 3: Code Node (Extract & Flatten Columns for Supabase)
This script unwraps both direct Webhook `body` payloads and `Switch` output wrappers, extracting `user` safely and outputting flat column names matching `pallets_users` 1-to-1.

- **Node Type**: `Code` (`Logic & Flow Control`)
- **Node Name**: `Code - Sanitize User`
- **Language**: `JavaScript`
- **Execution Mode**: `Run Once for All Items` *(leave as default)*
- **Paste this exact code** *(sandbox-safe pure data transformation)*:

```javascript
const inputItems = $input.all();
const cleaned = [];

function extractUser(obj) {
  if (!obj || typeof obj !== 'object') return null;
  if (obj.user && typeof obj.user === 'object') return obj.user;
  if (obj.data) return extractUser(obj.data);
  if (obj.body) return extractUser(obj.body);
  if (obj.json) return extractUser(obj.json);
  if (Array.isArray(obj.items) && obj.items.length > 0) return extractUser(obj.items[0]);
  if (obj.email || obj.name) return obj;
  return null;
}

for (const item of inputItems) {
  const root = (item && item.json) ? item.json : item;
  const user = extractUser(root);
  if (!user) continue;

  const name = String(user.name || '').trim();
  const email = String(user.email || '').trim().toLowerCase();
  if (!name || !email) continue;

  cleaned.push({
    json: {
      id: user.id || ('USR-' + Math.floor(1000 + Math.random() * 9000)),
      name: name,
      email: email,
      role: String(user.role || 'Staff (Dark Store Associate)'),
      store_hub: String(user.store_hub || user.storeAccess || 'BLR_NORTH_DC'),
      password_hash_placeholder: String(user.password_hash_placeholder || '[SECURE_ARGON2_HASH]'),
      created_at: user.created_at || new Date().toISOString()
    }
  });
}

return cleaned;
```
- **Connect Output to**: `Node 4 (Supabase - Create Row)`

---

### Node 4: Native Supabase Node (Insert Row into `pallets_users`)
Configure the built-in Supabase node fields shown in the Parameters panel:

1. **Supabase Credential \***:
   - Click the **`+`** icon next to `Select credential...`.
   - Paste your **Host / Supabase URL** (`https://<project-ref>.supabase.co`) and **Service Role Secret / API Key**.
   - Click **Save**, then select the credential from the dropdown.
2. **Use Custom Schema**:
   - Leave toggled **OFF** *(defaults to `public`)*.
3. **Resource \***:
   - Select **`Row`**.
4. **Operation \***:
   - Select **`Create row`** *(or **`Create a row`** / **`Insert`** — if you dragged `Update Row`, simply change this dropdown from `Update row` to `Create row`!)*.
5. **Table Name or ID \***:
   - Once your credential is selected, click this dropdown and choose **`pallets_users`**.
6. **Data to Send**:
   - **Important**: Select **`Define Below for Each Column`** *(do **NOT** use `Auto-Map Input Data to Columns`, as SNS Workbench sends an internal `$inputItem` metadata property that causes Supabase error `Could not find the '$inputItem' column`)*.
   - Under **Fields to Send / Columns**, remove any `$inputItem` entry if present, then click **Add Field** (or drag from `Code - Sanitize User` on the left) for each of the 7 real columns:
     - `id` ➔ `={{ $json.id }}`
     - `name` ➔ `={{ $json.name }}`
     - `email` ➔ `={{ $json.email }}`
     - `role` ➔ `={{ $json.role }}`
     - `store_hub` ➔ `={{ $json.store_hub }}`
     - `password_hash_placeholder` ➔ `={{ $json.password_hash_placeholder }}`
     - `created_at` ➔ `={{ $json.created_at }}`
- **Connect Output to**: `Node 5 (Respond to Webhook)`

*(Using **Update Row** instead? If you want to update an existing user's role or dark store hub later: keep **Operation** as `Update row`, set **Select Type** = `Build Manually`, **Must Match** = `All Select Conditions`, click **`+ Add Condition`** with Column `email` Equal `={{ $json.email }}`, and map `role` / `store_hub` under **Data to Send**.)*

---

### Node 5: Webhook Response Node
- **Node Type**: `Respond to Webhook` (`Input / Output`)
- **Node Name**: `Response - User Saved`
- **Respond With**: `JSON`
- **Response Code**: `200` *(under **Options**)*
- **Response Body** *(do **NOT** put quotes `"` or `=` around an object pill like `output` — since `output` expands to `{...}`, wrapping it in quotes breaks `JSON.parse`)*:
```json
{
  "success": true,
  "status": 200,
  "message": "User successfully stored in Supabase",
  "record": {{ $json }}
}
```
*(Drag `output` from `Create row Row` directly after `"record": ` with **no `"` quotes** and **no `=`** around the blue chip. If the editor prefers flat strings instead of an object chip, remove `"record"` or drag `id` / `email` inside quotes without `=`.)*

---

### Testing Your Supabase Workflow

In SNS Workbench, test **Node 1** / **Execute Step** with the exact payload structure sent by the Pallets web app:

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
      "id": "USR-9999",
      "name": "Sarah Connor",
      "email": "sarah.connor@pallets-fmcg.internal",
      "role": "Staff (Dark Store Associate)",
      "store_hub": "BLR_NORTH_DC",
      "password_hash_placeholder": "[SECURE_ARGON2_HASH]",
      "created_at": "2026-11-11T03:12:00.000Z"
    }
  }
}
```

**Verify**:
- The **Output Preview** on the Supabase node displays the newly inserted row from Supabase.
- In Supabase Dashboard ➔ **Table Editor** ➔ `pallets_users`, `Sarah Connor` appears immediately.

---

---

## Workflow 7: `WF-SUPABASE-SYNC` (Single Gateway Workflow for All 10 Supabase Tables)

Instead of building 10 separate Supabase workflows or Netlify proxies, this **4-node workflow** handles `health`, `select`, `upsert`, `insert`, `update`, and `delete` across **every table** in `supabase-schema.sql` using Supabase's native PostgREST RPC endpoint (`/rest/v1/rpc/pallets_gateway`).

> **Prerequisite**: Run the updated [`supabase-schema.sql`](file:///./supabase-schema.sql) once in **Supabase Dashboard ➔ SQL Editor** so all 10 `pallets_*` tables and `public.pallets_gateway(p_b64 text)` exist.

---

### Node 1: Webhook Trigger
- **Node Name**: `Webhook - Supabase Gateway`
- **Method**: `POST`
- **Respond**: `Using 'Respond to Webhook' Node`

---

### Node 2: Code Node (Base64-Encode JSON Payload Safely)
- **Node Name**: `Code - Encode Gateway Payload`
- **Language**: `JavaScript`
- **Execution Mode**: `Run Once for All Items` *(default)*
- **Paste this exact code**:
```javascript
const inputItems = $input.all();
const firstJson = (inputItems[0] && inputItems[0].json) ? inputItems[0].json : {};
const raw = (firstJson.body && typeof firstJson.body === 'object') ? firstJson.body : firstJson;
const reqPayload = (raw.data && typeof raw.data === 'object') ? raw.data : raw;

const jsonStr = JSON.stringify(reqPayload || { action: 'health' });

// Pure JS UTF-8 to Base64 encoder (safe for ₹ Rupee symbols, quotes & newlines)
const utf8Bytes = [];
for (let i = 0; i < jsonStr.length; i++) {
  let c = jsonStr.charCodeAt(i);
  if (c < 0x80) {
    utf8Bytes.push(c);
  } else if (c < 0x800) {
    utf8Bytes.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
  } else if (c < 0xd800 || c >= 0xe000) {
    utf8Bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
  } else {
    i++;
    c = 0x10000 + (((c & 0x3ff) << 10) | (jsonStr.charCodeAt(i) & 0x3ff));
    utf8Bytes.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 0x3f), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
  }
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
let b64 = '';
for (let i = 0; i < utf8Bytes.length; i += 3) {
  const a = utf8Bytes[i];
  const b = i + 1 < utf8Bytes.length ? utf8Bytes[i + 1] : 0;
  const c = i + 2 < utf8Bytes.length ? utf8Bytes[i + 2] : 0;
  const trip = (a << 16) | (b << 8) | c;
  b64 += B64[(trip >> 18) & 63];
  b64 += B64[(trip >> 12) & 63];
  b64 += i + 1 < utf8Bytes.length ? B64[(trip >> 6) & 63] : '=';
  b64 += i + 2 < utf8Bytes.length ? B64[trip & 63] : '=';
}

return [
  {
    json: {
      p_b64: b64,
      action: reqPayload.action || 'health',
      table: reqPayload.table || ''
    }
  }
];
```
- **Connect Output to**: `Node 3 (HTTP Request)`

---

### Node 3: HTTP Request Node (Call `pallets_gateway` RPC in Supabase)
- **Node Name**: `HTTP - Supabase Gateway RPC`
- **Method**: `POST`
- **URL**: `https://<YOUR_PROJECT_REF>.supabase.co/rest/v1/rpc/pallets_gateway`
- **Authentication Type**: `None`
- **Headers** *(click **Add Header** 3 times)*:
  - `apikey` ➔ `<YOUR_SUPABASE_SERVICE_ROLE_KEY>`
  - `Authorization` ➔ `Bearer <YOUR_SUPABASE_SERVICE_ROLE_KEY>`
  - `Content-Type` ➔ `application/json`
- **Body** *(JSON)*:
```json
{
  "p_b64": "{{ $json.p_b64 }}"
}
```
*(In the UI, type `{"p_b64": ""}` and drag the `p_b64` string chip inside the quotes with **no `=` prefix**. Because Base64 contains only ASCII letters/numbers/`+`/`/`/`=`, it will never cause `JSON.parse` syntax errors.)*
- **Connect Output to**: `Node 4 (Webhook Response)`

---

### Node 4: Webhook Response Node
- **Node Name**: `Response - Supabase Gateway`
- **Respond With**: `JSON`
- **Response Code**: `200`
- **Response Body**:
```json
{
  "result": {{ $json }}
}
```
*(Drag `output` from `HTTP - Supabase Gateway RPC` directly after `"result": ` with **no `"` quotes** and **no `=`** before the chip.)*

---

### Testing `WF-SUPABASE-SYNC` in SNS Workbench
Test **Node 1** with this exact JSON body:
```json
{
  "action": "health"
}
```
**Expected Output**: `{ "result": { "ok": true, "configured": true, "reachable": true, "schemaReady": true, "tableCount": 10, "mode": "SNS_WORKBENCH_SUPABASE" } }`.

Then copy the live webhook URL of `WF-SUPABASE-SYNC`, open your Pallets dashboard as **Admin**, click the **`Cloud DB: Connect WF-SUPABASE-SYNC`** badge (or **Settings ➔ `WF-SUPABASE-SYNC`**), paste the URL, and click **Save Workflow Endpoints** (or share the URL to hardcode it into `webhooks-config.json`).

---

## Testing & Connecting in the Web App

Once you build and deploy a workflow in SNS Workbench:

1. Copy its Webhook URL:
   `https://api.agents.snsihub.ai/webhook/<workflow-id>`
2. Open the Pallets dashboard, click **Settings** (gear icon in sidebar).
3. Paste the URL into the corresponding workflow row (e.g. `WF-FORECAST` or `WF-REPLENISH`).
4. Click **Ping** to verify the connection and observe the live sub-second latency.
5. Click **Save Workflow Endpoints**.

