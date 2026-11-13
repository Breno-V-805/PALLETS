# PALLETS V3 — Enterprise Dark Industrial FMCG Control Plane

Rebuilt B2B SaaS platform for dark-store predictive inventory intelligence, multi-model demand forecasting, MOQ-aligned replenishment, Apriori market-basket mining, and preserved SNS Agent Workbench orchestration.

---

## Quick Start

1. **Original V2 Safety**: All original V2 files in the parent folder remain completely untouched, with an additional full snapshot stored in `../PALLETS-V2-BACKUP/`.
2. **Start Server**:
   ```powershell
   .\start.ps1
   ```
   *(Or simply run `node server.js`)*
   Opens on `http://localhost:3001` (override port with `$env:PORT=3001`).

3. **Initial One-Time Admin Bootstrap**:
   - When zero Admin accounts exist in `.data/users.json`, the server generates a cryptographically random one-time bootstrap token (or reads `PALLETS_BOOTSTRAP_TOKEN`) and prints it strictly to server stdout.
   - Open the **Admin Bootstrap** tab on the login screen and submit the printed token to create your initial Administrator.
   - Once an Administrator exists, bootstrap permanently locks (`403 Forbidden`). No admin credentials or secrets are ever stored in frontend files.

4. **Public Staff Signup Policy**:
   - Public registration creates **Staff (Dark Store Associate)** accounts scoped exclusively to one facility (`BLR_NORTH_DC`, `MUM_BANDRA_HUB`, `DEL_GURGAON_CORE`, or `HYD_HITEC_STORE`).
   - Duplicate/concurrent email registrations are blocked server-side (`409 Conflict`), and any role/permission escalation attempts are rejected (`403 Forbidden`).

---

## Preserved SNS Agent Workbench Webhooks

All 9 webhook IDs and URLs from V2 are preserved verbatim in `webhooks-config.json` and routed server-side through `/api/sns-proxy` (authenticated + RBAC checked):

| Workflow ID | Key | Status | Purpose |
| :--- | :--- | :--- | :--- |
| `WF-MASTER` | `master` | Preserved URL | Central orchestrator gateway |
| `WF-SUPABASE-SYNC` | `supabaseSync` | Configurable in Admin | Unified 10-table PostgreSQL gateway (`pallets_gateway`) |
| `WF-AUTH-SUPABASE` | `authSupabase` | Preserved URL | User profile sync (`pallets_users`) |
| `WF-INGEST` | `ingestion` | Preserved URL | Sales POS batch normalization |
| `WF-FORECAST` | `forecasting` | Preserved URL | Multi-model demand tournament |
| `WF-RISK` | `risks` | Preserved URL | Runway & deficit alerts |
| `WF-REPLENISH` | `replenishment` | Preserved URL | Procurement & PO dispatch |
| `WF-SUPPLIER` | `suppliers` | Preserved URL | Vendor SLA & receipt checks |
| `WF-COPILOT` | `copilot` | Preserved URL | Federated conversational assistant |

Every dispatch reports its genuine execution outcome (`CONFIRMED_SUCCESS`, `CONFIRMED_FAILURE`, `UNKNOWN_TIMEOUT`, or `UNCONFIGURED`) without fabricating fake `200 OK` statuses.

---

## V2 Calculation & Logic Audit Notes

- **Fixed WAPE Double-Multiplication Bug**: In V2 (`app.js` / `supabase-client.js`), `PalletsForecastingEngine.runForecast` already returned WAPE on a `0–100` percentage scale, which V2 multiplied by `100` again (`wape * 1000 / 10`). V3 preserves the true `0–100` value directly.
- **Preserved Formulas**:
  - `ROP = (Daily Demand × Lead Time) + Safety Stock`
  - `IP = On-Hand + On-Order − Reserved`
  - `Q = ceil(max(0, Target Stock − IP) / MOQ) × MOQ`
  - `Runway = On-Hand / Daily Demand` (`<=3d` Critical, `<=7d` High, `>=35d` Overstock)

---

## Verification

Run syntax validation and full security/E2E suite:
```powershell
node scripts/verify-security-and-e2e.js
```

