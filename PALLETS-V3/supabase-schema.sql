-- ============================================================================
-- PALLETS // Enterprise FMCG Inventory & Replenishment Orchestration
-- Complete Idempotent Supabase PostgreSQL Schema (10 Persistent Datasets)
-- Run this script once inside your Supabase Dashboard -> SQL Editor
-- ============================================================================

-- 1. Users & Role-Based Operators
CREATE TABLE IF NOT EXISTS public.pallets_users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'Staff',
  store_hub TEXT DEFAULT 'BLR_NORTH_DC',
  permissions JSONB DEFAULT '["VIEW_STORE"]'::jsonb,
  avatar TEXT,
  password_hash_placeholder TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure forward compatibility if pallets_users was partially created earlier
ALTER TABLE public.pallets_users ADD COLUMN IF NOT EXISTS store_hub TEXT DEFAULT 'BLR_NORTH_DC';
ALTER TABLE public.pallets_users ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '["VIEW_STORE"]'::jsonb;
ALTER TABLE public.pallets_users ADD COLUMN IF NOT EXISTS avatar TEXT;
ALTER TABLE public.pallets_users ADD COLUMN IF NOT EXISTS password_hash_placeholder TEXT;
ALTER TABLE public.pallets_users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Suppliers Performance Directory
CREATE TABLE IF NOT EXISTS public.pallets_suppliers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  lead_time_days NUMERIC(6,2) NOT NULL DEFAULT 2,
  reliability_score NUMERIC(5,2) NOT NULL DEFAULT 97,
  defect_rate NUMERIC(5,2) NOT NULL DEFAULT 0.5,
  on_time_delivery_pct NUMERIC(5,2) NOT NULL DEFAULT 96,
  moq INTEGER NOT NULL DEFAULT 24,
  contact_email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Product Inventory Master & Replenishment Parameters
CREATE TABLE IF NOT EXISTS public.pallets_products (
  id TEXT PRIMARY KEY,
  sku TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  brand TEXT,
  category TEXT,
  supplier_id TEXT,
  supplier_name TEXT,
  store_hub TEXT NOT NULL DEFAULT 'BLR_NORTH_DC',
  on_hand INTEGER NOT NULL DEFAULT 0,
  on_order INTEGER NOT NULL DEFAULT 0,
  reserved INTEGER NOT NULL DEFAULT 0,
  avg_daily_demand NUMERIC(10,2) NOT NULL DEFAULT 10,
  lead_time_days NUMERIC(6,2) NOT NULL DEFAULT 2,
  safety_stock INTEGER NOT NULL DEFAULT 30,
  target_stock INTEGER NOT NULL DEFAULT 150,
  moq INTEGER NOT NULL DEFAULT 24,
  cost_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  selling_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  expiry_risk_days INTEGER DEFAULT 14,
  velocity_spike_pct NUMERIC(8,2) DEFAULT 0,
  status_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pallets_products_store ON public.pallets_products (store_hub);
CREATE INDEX IF NOT EXISTS idx_pallets_products_sku ON public.pallets_products (sku);

-- 4. 90-Day Daily Sales Velocity History
CREATE TABLE IF NOT EXISTS public.pallets_sales_history (
  id TEXT PRIMARY KEY,
  sku TEXT NOT NULL,
  store_hub TEXT,
  sale_date DATE NOT NULL,
  units_sold NUMERIC(10,2) NOT NULL DEFAULT 0,
  revenue NUMERIC(14,2) DEFAULT 0,
  source TEXT DEFAULT 'POS_STREAM',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pallets_sales_sku_date ON public.pallets_sales_history (sku, sale_date);

-- 5. Inventory Movements & Stock Audit Ledger
CREATE TABLE IF NOT EXISTS public.pallets_inventory_movements (
  id TEXT PRIMARY KEY,
  sku TEXT NOT NULL,
  product_name TEXT,
  store_hub TEXT,
  movement_type TEXT NOT NULL,
  quantity_delta INTEGER NOT NULL DEFAULT 0,
  previous_on_hand INTEGER,
  new_on_hand INTEGER,
  reason TEXT,
  actor_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pallets_movements_sku ON public.pallets_inventory_movements (sku, created_at DESC);

-- 6. Sales Data Ingestion Batch Logs
CREATE TABLE IF NOT EXISTS public.pallets_ingestion_logs (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  source_name TEXT,
  records_parsed INTEGER NOT NULL DEFAULT 0,
  duplicates_skipped INTEGER NOT NULL DEFAULT 0,
  validation_status TEXT NOT NULL DEFAULT 'PASSED',
  summary_note TEXT,
  ingested_by TEXT,
  ingested_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Purchase Orders & Dispatch Records
CREATE TABLE IF NOT EXISTS public.pallets_purchase_orders (
  id TEXT PRIMARY KEY,
  po_number TEXT UNIQUE NOT NULL,
  sku TEXT NOT NULL,
  product_name TEXT,
  supplier_id TEXT,
  supplier_name TEXT,
  store_hub TEXT,
  order_qty INTEGER NOT NULL DEFAULT 0,
  unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_cost NUMERIC(14,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'DISPATCHED',
  rationale TEXT,
  approved_by TEXT,
  expected_arrival_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pallets_po_sku ON public.pallets_purchase_orders (sku, created_at DESC);

-- 8. AI Demand Forecast Tournament Runs
CREATE TABLE IF NOT EXISTS public.pallets_forecast_runs (
  id TEXT PRIMARY KEY,
  sku TEXT NOT NULL,
  product_name TEXT,
  horizon_days INTEGER NOT NULL DEFAULT 14,
  promo_boost_pct NUMERIC(6,2) DEFAULT 0,
  winning_model TEXT,
  mae NUMERIC(10,3),
  rmse NUMERIC(10,3),
  wape_pct NUMERIC(8,2),
  projected_total_units NUMERIC(12,2),
  model_comparison JSONB,
  forecast_timeline JSONB,
  run_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pallets_forecast_sku ON public.pallets_forecast_runs (sku, created_at DESC);

-- 9. Apriori Customer Basket Association Rules
CREATE TABLE IF NOT EXISTS public.pallets_apriori_rules (
  id TEXT PRIMARY KEY,
  antecedent TEXT NOT NULL,
  consequent TEXT NOT NULL,
  support_pct NUMERIC(6,2) NOT NULL DEFAULT 0,
  confidence_pct NUMERIC(6,2) NOT NULL DEFAULT 0,
  lift NUMERIC(8,3) NOT NULL DEFAULT 1,
  bundle_strength TEXT,
  recommendation TEXT,
  min_support_threshold NUMERIC(6,4),
  min_confidence_threshold NUMERIC(6,4),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. AI Copilot Prompt & Response History
CREATE TABLE IF NOT EXISTS public.pallets_copilot_logs (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  user_name TEXT,
  user_role TEXT,
  prompt TEXT NOT NULL,
  response_text TEXT,
  source TEXT DEFAULT 'COPILOT_ENGINE',
  latency_ms INTEGER,
  action_chips JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================================
-- 11. Single Unified SNS Workbench RPC Gateway: public.pallets_gateway(p_b64)
-- Called once via POST https://<PROJECT>.supabase.co/rest/v1/rpc/pallets_gateway
-- from the single WF-SUPABASE-SYNC workflow in SNS Agent Workbench.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.pallets_gateway(p_b64 text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_req jsonb;
  v_action text;
  v_table text;
  v_rows_arr jsonb;
  v_filters jsonb;
  v_values jsonb;
  v_order text;
  v_order_col text;
  v_order_dir text;
  v_order_sql text := '';
  v_limit int;
  v_conflict_col text;
  v_where_sql text := '';
  v_cols_sql text := '';
  v_set_sql text := '';
  v_col record;
  v_kv record;
  v_present_cols text[];
  v_out jsonb;
  v_table_count int := 0;
BEGIN
  IF p_b64 IS NULL OR length(trim(p_b64)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'configured', true, 'error', 'Empty request payload');
  END IF;

  -- Accept either Base64-encoded JSON (from WF-SUPABASE-SYNC) or raw JSON text
  IF left(ltrim(p_b64), 1) = '{' THEN
    v_req := p_b64::jsonb;
  ELSE
    v_req := convert_from(decode(p_b64, 'base64'), 'UTF8')::jsonb;
  END IF;

  v_action := lower(trim(coalesce(v_req->>'action', 'select')));
  v_table := trim(coalesce(v_req->>'table', ''));

  IF v_action = 'health' THEN
    SELECT count(*) INTO v_table_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN (
        'pallets_users',
        'pallets_suppliers',
        'pallets_products',
        'pallets_sales_history',
        'pallets_inventory_movements',
        'pallets_ingestion_logs',
        'pallets_purchase_orders',
        'pallets_forecast_runs',
        'pallets_apriori_rules',
        'pallets_copilot_logs'
      );

    RETURN jsonb_build_object(
      'ok', v_table_count = 10,
      'configured', true,
      'reachable', true,
      'schemaReady', v_table_count = 10,
      'tableCount', v_table_count,
      'mode', 'SNS_WORKBENCH_SUPABASE',
      'error', CASE WHEN v_table_count < 10 THEN 'Expected 10 pallets_* tables, found ' || v_table_count ELSE NULL END
    );
  END IF;

  IF v_table NOT IN (
    'pallets_users',
    'pallets_suppliers',
    'pallets_products',
    'pallets_sales_history',
    'pallets_inventory_movements',
    'pallets_ingestion_logs',
    'pallets_purchase_orders',
    'pallets_forecast_runs',
    'pallets_apriori_rules',
    'pallets_copilot_logs'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'configured', true, 'error', 'Disallowed or unknown table: ' || coalesce(v_table, ''));
  END IF;

  -- Build parameterized equality WHERE clause from object match/filters
  v_filters := coalesce(v_req->'match', v_req->'filters', '{}'::jsonb);
  IF jsonb_typeof(v_filters) = 'object' THEN
    FOR v_kv IN SELECT key, value FROM jsonb_each_text(v_filters) LOOP
      SELECT data_type INTO v_col
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = v_table
        AND column_name = v_kv.key;

      IF FOUND THEN
        IF v_where_sql = '' THEN
          v_where_sql := ' WHERE ';
        ELSE
          v_where_sql := v_where_sql || ' AND ';
        END IF;

        IF v_col.data_type IN ('text', 'character varying') THEN
          v_where_sql := v_where_sql || format('%I.%I = %L', v_table, v_kv.key, v_kv.value);
        ELSE
          v_where_sql := v_where_sql || format('%I.%I::text = %L', v_table, v_kv.key, v_kv.value);
        END IF;
      END IF;
    END LOOP;
  END IF;

  IF v_action = 'select' THEN
    v_order := trim(coalesce(v_req->>'order', ''));
    IF v_order <> '' THEN
      v_order_col := split_part(v_order, '.', 1);
      v_order_dir := upper(coalesce(nullif(split_part(v_order, '.', 2), ''), 'ASC'));
      IF v_order_dir NOT IN ('ASC', 'DESC') THEN
        v_order_dir := 'ASC';
      END IF;
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = v_table AND column_name = v_order_col
      ) THEN
        v_order_sql := format(' ORDER BY %I %s', v_order_col, v_order_dir);
      END IF;
    END IF;

    v_limit := least(greatest(coalesce((v_req->>'limit')::int, 2000), 1), 5000);

    EXECUTE format(
      'SELECT COALESCE(jsonb_agg(row_to_json(t)), ''[]''::jsonb) FROM (SELECT * FROM public.%I%s%s LIMIT %s) t',
      v_table, v_where_sql, v_order_sql, v_limit
    ) INTO v_out;

    RETURN jsonb_build_object(
      'ok', true,
      'configured', true,
      'table', v_table,
      'data', coalesce(v_out, '[]'::jsonb)
    );
  END IF;

  IF v_action IN ('upsert', 'insert') THEN
    v_rows_arr := coalesce(
      CASE WHEN jsonb_typeof(v_req->'rows') = 'array' THEN v_req->'rows' END,
      CASE WHEN jsonb_typeof(v_req->'row') = 'object' THEN jsonb_build_array(v_req->'row') END,
      '[]'::jsonb
    );

    IF jsonb_array_length(v_rows_arr) = 0 THEN
      RETURN jsonb_build_object('ok', true, 'configured', true, 'table', v_table, 'count', 0, 'data', '[]'::jsonb);
    END IF;

    SELECT array_agg(c.column_name ORDER BY c.ordinal_position)
    INTO v_present_cols
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = v_table
      AND c.column_name IN (SELECT jsonb_object_keys(v_rows_arr->0));

    IF v_present_cols IS NULL OR array_length(v_present_cols, 1) IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'configured', true, 'error', 'No matching columns for ' || v_table);
    END IF;

    SELECT string_agg(format('%I', col_name), ', ') INTO v_cols_sql FROM unnest(v_present_cols) AS col_name;

    IF v_action = 'upsert' THEN
      v_conflict_col := trim(coalesce(nullif(v_req->>'onConflict', ''), 'id'));
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = v_table AND column_name = v_conflict_col
      ) THEN
        v_conflict_col := 'id';
      END IF;

      SELECT string_agg(format('%I = EXCLUDED.%I', col_name, col_name), ', ')
      INTO v_set_sql
      FROM unnest(v_present_cols) AS col_name
      WHERE col_name <> v_conflict_col AND col_name <> 'created_at' AND col_name <> 'id';

      IF coalesce(v_set_sql, '') <> '' THEN
        EXECUTE format(
          'WITH up AS (INSERT INTO public.%I (%s) SELECT %s FROM jsonb_populate_recordset(NULL::public.%I, $1) ON CONFLICT (%I) DO UPDATE SET %s RETURNING *) SELECT COALESCE(jsonb_agg(row_to_json(up)), ''[]''::jsonb) FROM up',
          v_table, v_cols_sql, v_cols_sql, v_table, v_conflict_col, v_set_sql
        ) USING v_rows_arr INTO v_out;
      ELSE
        EXECUTE format(
          'WITH up AS (INSERT INTO public.%I (%s) SELECT %s FROM jsonb_populate_recordset(NULL::public.%I, $1) ON CONFLICT (%I) DO NOTHING RETURNING *) SELECT COALESCE(jsonb_agg(row_to_json(up)), ''[]''::jsonb) FROM up',
          v_table, v_cols_sql, v_cols_sql, v_table, v_conflict_col
        ) USING v_rows_arr INTO v_out;
      END IF;
    ELSE
      EXECUTE format(
        'WITH ins AS (INSERT INTO public.%I (%s) SELECT %s FROM jsonb_populate_recordset(NULL::public.%I, $1) RETURNING *) SELECT COALESCE(jsonb_agg(row_to_json(ins)), ''[]''::jsonb) FROM ins',
        v_table, v_cols_sql, v_cols_sql, v_table
      ) USING v_rows_arr INTO v_out;
    END IF;

    RETURN jsonb_build_object(
      'ok', true,
      'configured', true,
      'table', v_table,
      'count', coalesce(jsonb_array_length(v_out), 0),
      'data', coalesce(v_out, '[]'::jsonb)
    );
  END IF;

  IF v_action = 'update' THEN
    IF v_where_sql = '' THEN
      RETURN jsonb_build_object('ok', false, 'configured', true, 'error', 'UPDATE requires at least one match filter');
    END IF;
    v_values := coalesce(v_req->'values', v_req->'row', '{}'::jsonb);

    SELECT string_agg(format('%I = rec.%I', c.column_name, c.column_name), ', ')
    INTO v_set_sql
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = v_table
      AND c.column_name IN (SELECT jsonb_object_keys(v_values));

    IF coalesce(v_set_sql, '') = '' THEN
      RETURN jsonb_build_object('ok', false, 'configured', true, 'error', 'No valid update columns provided');
    END IF;

    EXECUTE format(
      'WITH upd AS (UPDATE public.%I SET %s FROM (SELECT * FROM jsonb_populate_record(NULL::public.%I, $1)) AS rec%s RETURNING public.%I.*) SELECT COALESCE(jsonb_agg(row_to_json(upd)), ''[]''::jsonb) FROM upd',
      v_table, v_set_sql, v_table, v_where_sql, v_table
    ) USING v_values INTO v_out;

    RETURN jsonb_build_object('ok', true, 'configured', true, 'table', v_table, 'data', coalesce(v_out, '[]'::jsonb));
  END IF;

  IF v_action = 'delete' THEN
    IF v_where_sql = '' THEN
      RETURN jsonb_build_object('ok', false, 'configured', true, 'error', 'DELETE requires at least one match filter');
    END IF;

    EXECUTE format(
      'WITH del AS (DELETE FROM public.%I%s RETURNING *) SELECT COALESCE(jsonb_agg(row_to_json(del)), ''[]''::jsonb) FROM del',
      v_table, v_where_sql
    ) INTO v_out;

    RETURN jsonb_build_object('ok', true, 'configured', true, 'table', v_table, 'data', coalesce(v_out, '[]'::jsonb));
  END IF;

  RETURN jsonb_build_object('ok', false, 'configured', true, 'error', 'Unsupported action: ' || v_action);
END;
$$;

GRANT EXECUTE ON FUNCTION public.pallets_gateway(text) TO service_role, postgres;
NOTIFY pgrst, 'reload schema';
