/**
 * PALLETS V3 // Workspace 4: Sales Ingestion
 * Supports CSV/JSON upload, column mapping, explicit invalid-row inspection, duplicate dedupe,
 * benchmark sample loading, idempotent persistence, and live WF-INGEST telemetry.
 */
(function (global) {
  'use strict';

  const localState = {
    fileName: '',
    rawHeaders: [],
    rawRows: [],
    mapping: { sku: 'sku', qty: 'qty', orderId: 'order_id', date: 'date' },
    parsedResult: null,
    submitting: false
  };

  function parseCsvText(text) {
    const lines = String(text || '').split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) return { headers: [], rows: [] };
    const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
    const rows = lines.slice(1).map((line, i) => {
      const cells = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
      const obj = { __lineNo: i + 2 };
      headers.forEach((h, idx) => {
        obj[h] = cells[idx] ?? '';
      });
      return obj;
    });
    return { headers, rows };
  }

  function autoDetectMapping(headers) {
    const find = (candidates) => headers.find((h) => candidates.includes(h.toLowerCase())) || headers[0] || '';
    return {
      sku: find(['sku', 'sku_code', 'product_sku', 'item_code']),
      qty: find(['qty', 'quantity', 'units', 'units_sold']),
      orderId: find(['order_id', 'order_ref', 'ref', 'transaction_id']),
      date: find(['date', 'sale_date', 'timestamp', 'day'])
    };
  }

  function validateRows() {
    const seenOrders = new Set();
    const valid = [];
    const invalid = [];
    const duplicates = [];

    localState.rawRows.forEach((row) => {
      const sku = String(row[localState.mapping.sku] || '').trim().toUpperCase();
      const qtyRaw = row[localState.mapping.qty];
      const qty = Number(qtyRaw);
      const orderId = String(row[localState.mapping.orderId] || '').trim();
      const date = String(row[localState.mapping.date] || new Date().toISOString().slice(0, 10)).trim();

      if (!sku) {
        invalid.push({ lineNo: row.__lineNo, reason: 'Missing SKU identifier', raw: JSON.stringify(row) });
        return;
      }
      if (!Number.isFinite(qty) || qty <= 0) {
        invalid.push({ lineNo: row.__lineNo, reason: `Invalid quantity "${qtyRaw}" (must be > 0)`, raw: `${sku} / qty=${qtyRaw}` });
        return;
      }
      if (orderId) {
        const dedupeKey = `${orderId}:${sku}`;
        if (seenOrders.has(dedupeKey)) {
          duplicates.push({ lineNo: row.__lineNo, reason: `Duplicate order reference "${orderId}" for ${sku}`, raw: `${orderId} / ${sku}` });
          return;
        }
        seenOrders.add(dedupeKey);
      }
      valid.push({ lineNo: row.__lineNo, sku, qty: Math.round(qty), orderId: orderId || `ROW-${row.__lineNo}`, date });
    });

    localState.parsedResult = { valid, invalid, duplicates };
  }

  function renderIngestion(container, state) {
    const F = global.PalletsFormatters;
    const Table = global.PalletsDataTable;

    const preview = localState.parsedResult;

    container.innerHTML = `
      <div class="workspace-header">
        <div>
          <h1 class="page-title">Sales Data Ingestion</h1>
          <p class="page-subtitle">Upload POS transaction feeds (CSV / JSON), map columns, inspect validation issues, and dispatch to WF-INGEST.</p>
        </div>
        <div class="workspace-actions">
          <button type="button" class="btn btn-ghost" id="ing-load-sample">${F.icon('database', 14)} Load Sample POS Batch (with Validation Cases)</button>
        </div>
      </div>

      <div class="command-grid-equal">
        <div class="panel">
          <div class="panel-header">
            <div>
              <div class="section-heading">1. Upload & Parse POS Feed</div>
              <div class="section-subheading">Supports CSV headers or JSON array feeds</div>
            </div>
          </div>
          <div class="panel-body" style="display:flex;flex-direction:column;gap:14px">
            <div class="dropzone" id="ing-dropzone" tabindex="0">
              <div style="margin-bottom:8px;color:var(--accent-blue)">${F.icon('upload', 28)}</div>
              <div style="font-weight:600">Drop CSV or JSON transaction file here, or click to browse</div>
              <div class="text-muted" style="font-size:12px;margin-top:4px">${localState.fileName ? `Loaded: ${F.escapeHtml(localState.fileName)} (${localState.rawRows.length} rows)` : 'Zero silent discards — invalid & duplicate rows are surfaced below'}</div>
              <input type="file" id="ing-file-input" accept=".csv,.json" class="hidden" />
            </div>

            ${localState.rawHeaders.length > 0 ? `
              <div class="panel" style="background:var(--bg-input)">
                <div class="panel-header"><div class="section-heading">2. Column Mapping</div></div>
                <div class="panel-body">
                  <div class="form-grid">
                    ${['sku', 'qty', 'orderId', 'date'].map((field) => `
                      <div class="form-field">
                        <label class="form-label" for="map-${field}">Map "${field.toUpperCase()}"</label>
                        <select id="map-${field}" class="select" data-map-field="${field}">
                          ${localState.rawHeaders.map((h) => `<option value="${F.escapeHtml(h)}" ${localState.mapping[field] === h ? 'selected' : ''}>${F.escapeHtml(h)}</option>`).join('')}
                        </select>
                      </div>
                    `).join('')}
                  </div>
                </div>
              </div>
            ` : ''}
          </div>
        </div>

        <div class="panel">
          <div class="panel-header">
            <div>
              <div class="section-heading">3. Pre-Ingestion Validation Summary</div>
              <div class="section-subheading">Inspect valid vs duplicate vs rejected rows before commit</div>
            </div>
            ${preview ? `<button type="button" class="btn btn-primary" id="ing-commit-btn" ${preview.valid.length === 0 || localState.submitting ? 'disabled' : ''}>Ingest ${preview.valid.length} Valid Rows</button>` : ''}
          </div>
          <div class="panel-body">
            ${!preview ? `
              <div class="empty-state">
                <div class="empty-title">No file staged for ingestion</div>
                <div class="empty-sub">Upload a CSV/JSON file or load the sample POS feed to preview validation metrics.</div>
              </div>
            ` : `
              <div class="kv-grid" style="margin-bottom:14px">
                <div class="kv-cell"><div class="kv-label">Valid Clean Rows</div><div class="kv-value mono text-teal">${preview.valid.length}</div></div>
                <div class="kv-cell"><div class="kv-label">Duplicate Orders</div><div class="kv-value mono text-amber">${preview.duplicates.length}</div></div>
                <div class="kv-cell"><div class="kv-label">Invalid / Rejected Rows</div><div class="kv-value mono text-red">${preview.invalid.length}</div></div>
                <div class="kv-cell"><div class="kv-label">Total File Records</div><div class="kv-value mono">${localState.rawRows.length}</div></div>
              </div>

              ${(preview.invalid.length > 0 || preview.duplicates.length > 0) ? `
                <div class="section-heading" style="margin-bottom:8px">Rejected & Duplicate Row Inspector</div>
                <div class="table-scroll" style="max-height:210px;border:1px solid var(--border-subtle);border-radius:var(--radius-sm)">
                  <table class="industrial-table">
                    <thead><tr><th>Line #</th><th>Status</th><th>Reason</th><th>Raw Detail</th></tr></thead>
                    <tbody>
                      ${preview.invalid.map((inv) => `<tr><td class="mono">${inv.lineNo}</td><td><span class="badge badge-critical">INVALID</span></td><td>${F.escapeHtml(inv.reason)}</td><td class="mono text-muted">${F.escapeHtml(inv.raw)}</td></tr>`).join('')}
                      ${preview.duplicates.map((dup) => `<tr><td class="mono">${dup.lineNo}</td><td><span class="badge badge-warning">DUPLICATE</span></td><td>${F.escapeHtml(dup.reason)}</td><td class="mono text-muted">${F.escapeHtml(dup.raw)}</td></tr>`).join('')}
                    </tbody>
                  </table>
                </div>
              ` : '<div class="form-success">Zero validation warnings. All staged rows are clean and ready.</div>'}
            `}
          </div>
        </div>
      </div>

      <div class="panel" style="margin-top:16px">
        <div class="panel-header">
          <div>
            <div class="section-heading">Ingestion Batch History</div>
            <div class="section-subheading">Audited POS uploads & WF-INGEST synchronization runs</div>
          </div>
        </div>
        ${Table.render({
          rows: state.ingestionLogs || [],
          pageSize: 8,
          columns: [
            { label: 'Batch ID', key: 'batchId', render: (r) => `<span class="mono">${F.escapeHtml(r.batchId)}</span>` },
            { label: 'Source File', key: 'fileName' },
            { label: 'Imported', key: 'imported', align: 'right', render: (r) => `<span class="mono text-teal">${r.imported}</span>` },
            { label: 'Duplicates', key: 'duplicates', align: 'right', render: (r) => `<span class="mono text-amber">${r.duplicates}</span>` },
            { label: 'Invalid', key: 'invalidRows', align: 'right', render: (r) => `<span class="mono text-red">${r.invalidRows || 0}</span>` },
            { label: 'Status', key: 'status', render: (r) => `<span class="badge ${r.status === 'COMPLETED' ? 'badge-optimal' : 'badge-warning'}">${F.escapeHtml(r.status)}</span>` },
            { label: 'Timestamp', key: 'timestamp', render: (r) => `<span class="mono text-secondary">${F.escapeHtml(r.timestamp)}</span>` }
          ]
        })}
      </div>
    `;

    const dropzone = container.querySelector('#ing-dropzone');
    const fileInput = container.querySelector('#ing-file-input');

    const handleFile = async (file) => {
      if (!file) return;
      const txt = await file.text();
      localState.fileName = file.name;
      if (file.name.toLowerCase().endsWith('.json')) {
        const arr = JSON.parse(txt);
        const list = Array.isArray(arr) ? arr : (arr.rows || []);
        localState.rawHeaders = list.length > 0 ? Object.keys(list[0]) : [];
        localState.rawRows = list.map((r, i) => ({ ...r, __lineNo: i + 1 }));
      } else {
        const parsed = parseCsvText(txt);
        localState.rawHeaders = parsed.headers;
        localState.rawRows = parsed.rows;
      }
      localState.mapping = autoDetectMapping(localState.rawHeaders);
      validateRows();
      renderIngestion(container, global.PalletsState.state);
    };

    dropzone?.addEventListener('click', () => fileInput?.click());
    dropzone?.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
    dropzone?.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
    dropzone?.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      handleFile(e.dataTransfer.files[0]);
    });
    fileInput?.addEventListener('change', (e) => handleFile(e.target.files[0]));

    container.querySelectorAll('[data-map-field]').forEach((sel) => {
      sel.addEventListener('change', (e) => {
        localState.mapping[sel.getAttribute('data-map-field')] = e.target.value;
        validateRows();
        renderIngestion(container, global.PalletsState.state);
      });
    });

    container.querySelector('#ing-load-sample')?.addEventListener('click', () => {
      const sampleCsv = [
        'order_id,sku,qty,date',
        'ORD-99101,SKU-9921-OAT,45,2026-11-12',
        'ORD-99102,SKU-5520-YOGU,32,2026-11-12',
        'ORD-99102,SKU-5520-YOGU,32,2026-11-12',
        'ORD-99103,,15,2026-11-12',
        'ORD-99104,SKU-8842-COLD,-5,2026-11-12',
        'ORD-99105,SKU-4412-CHIP,28,2026-11-12'
      ].join('\n');
      const parsed = parseCsvText(sampleCsv);
      localState.fileName = 'sample_pos_validation_batch.csv';
      localState.rawHeaders = parsed.headers;
      localState.rawRows = parsed.rows;
      localState.mapping = autoDetectMapping(parsed.headers);
      validateRows();
      renderIngestion(container, global.PalletsState.state);
    });

    container.querySelector('#ing-commit-btn')?.addEventListener('click', async () => {
      if (!localState.parsedResult || localState.parsedResult.valid.length === 0) return;
      localState.submitting = true;
      renderIngestion(container, global.PalletsState.state);
      try {
        const res = await global.PalletsDataAdapter.ingestBatch({
          fileName: localState.fileName,
          validRows: localState.parsedResult.valid,
          invalidRows: localState.parsedResult.invalid.length,
          duplicates: localState.parsedResult.duplicates.length
        });
        const wfRes = await global.PalletsWorkflowAdapter.trigger('SALES_INGESTION_BATCH', {
          batchId: res.batch.batchId,
          imported: res.batch.imported,
          invalidRows: res.batch.invalidRows,
          duplicates: res.batch.duplicates
        }, 'ingestion');
        global.PalletsEvents.emit('toast', {
          type: wfRes.success ? 'success' : 'warning',
          title: `Batch ${res.batch.batchId} Persisted`,
          message: `Imported ${res.batch.imported} rows | WF-INGEST: ${wfRes.outcome}`
        });
        localState.parsedResult = null;
        localState.rawRows = [];
        localState.rawHeaders = [];
        localState.fileName = '';
      } catch (err) {
        global.PalletsEvents.emit('toast', { type: 'error', title: 'Ingestion Failed', message: err.message });
      } finally {
        localState.submitting = false;
        renderIngestion(container, global.PalletsState.state);
      }
    });
  }

  global.PalletsIngestionPage = { render: renderIngestion };
})(typeof window !== 'undefined' ? window : globalThis);

