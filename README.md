# PALLETS // FMCG AI Predictive Inventory System for Retail
### Integrated with SNS Agent Workbench (`agents.snsihub.ai`)

> **Executive-grade front-end web application dashboard for "Pallets", designed with high-end SaaS minimalism, clean data tables, dual Bézier spline & donut charts, and automated procurement workflows connected to your SNS Agent Workbench.**

---

## ✦ SNS Agent Workbench Integration Overview

The front end is wired to connect directly to your **SNS Agent Workbench**:
- **Target Webhook URL**: `https://api.agents.snsihub.ai/webhook/cc0a6272-8aba-45b2-916a-b44905b2386a`
- **Workflow ID**: `cc0a6272-8aba-45b2-916a-b44905b2386a`

### What the Front End Sends to Your Workflow:
1. **Procurement Approval Event (`action: "PROCUREMENT_APPROVAL"`)**:
   - Triggered when the user clicks **"Approve & Transmit to Webhook"** in the PO Approval Modal.
   - Payload: SKU ID, Product Name, Vendor, Destination Dark Store, Quantity, Total Cost in ₹, and Neural AI Rationale.
   - Purpose: Allows your SNS Agent workflow to trigger downstream actions (e.g., ERP order creation, warehouse logistics alerts, supplier PO email dispatch).
2. **Interactive AI Copilot Chat (`action: "COPILOT_QUERY"`)**:
   - Integrated floating Copilot drawer in the bottom-right corner.
   - Operators can converse directly with your workflow LLM agent to inspect buffer deficits, simulate demand spikes, or request reorder recommendations.
3. **Health Check Ping (`action: "HEALTH_CHECK"`)**:
   - Triggered by clicking "Ping Webhook" inside the Live Telemetry Modal or clicking the webhook status pill in the top bar.

---

## ✦ Building Your Workflow in `snsihub.ai` (Step-by-Step)

In your open workflow:

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  1. TRIGGERS     │     │ 2. LOGIC & FLOW  │     │   3. AI / LLM    │     │ 4. INPUT/OUTPUT  │
│  Webhook (POST)  │ ──> │   Router/Switch  │ ──> │    LLM Node      │ ──> │ Response Return  │
│  Listen for JSON │     │  Action Router   │     │ (System Prompt)  │     │  Status: 200 OK  │
└──────────────────┘     └──────────────────┘     └──────────────────┘     └──────────────────┘
```

1. **Step 1: Webhook Trigger**:
   - Method: `POST`
   - URL: `https://api.agents.snsihub.ai/webhook/cc0a6272-8aba-45b2-916a-b44905b2386a`
2. **Step 2: AI / LLM Node**:
   - Prompt:
     ```
     You are the Pallets FMCG Predictive Inventory AI Agent. 
     You monitor high-velocity FMCG SKUs across regional dark stores.
     Analyze buffer depletion, weather volatility, and flash-sale surges, and recommend optimal procurement orders.
     ```
3. **Step 3: Response Return Node**:
   - Returns JSON status 200 with confirmation payload.

---

## ✦ Quick Launch Instructions

### Method A: Local Static Server (Recommended)
```powershell
powershell -ExecutionPolicy Bypass -File .\serve.ps1
```
Then visit: `http://localhost:8080/`

### Method B: Direct Browser Launch
Double-click `index.html` in any web browser.
