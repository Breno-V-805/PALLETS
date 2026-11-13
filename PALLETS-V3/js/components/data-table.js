/**
 * PALLETS V3 // Reusable Enterprise Data Table Builder
 * Supports column sorting, pagination, row selection, empty/error states.
 */
(function (global) {
  'use strict';

  function renderTable({
    rows = [],
    columns = [],
    sortKey = null,
    sortDir = 'asc',
    page = 1,
    pageSize = 10,
    emptyTitle = 'No records match current filters',
    emptySubtitle = 'Adjust search or hub filters to view records.',
    rowClassFn = null,
    onRowClickAttr = null
  }) {
    const F = global.PalletsFormatters;
    let working = [...rows];
    if (sortKey) {
      working.sort((a, b) => {
        const va = typeof a[sortKey] === 'function' ? a[sortKey]() : a[sortKey];
        const vb = typeof b[sortKey] === 'function' ? b[sortKey]() : b[sortKey];
        if (typeof va === 'number' && typeof vb === 'number') {
          return sortDir === 'asc' ? va - vb : vb - va;
        }
        return sortDir === 'asc'
          ? String(va ?? '').localeCompare(String(vb ?? ''))
          : String(vb ?? '').localeCompare(String(va ?? ''));
      });
    }

    const total = working.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const startIdx = (safePage - 1) * pageSize;
    const slice = working.slice(startIdx, startIdx + pageSize);

    if (total === 0) {
      return `
        <div class="empty-state">
          <div class="empty-icon">${F.icon('boxes', 24)}</div>
          <div class="empty-title">${F.escapeHtml(emptyTitle)}</div>
          <div class="empty-sub">${F.escapeHtml(emptySubtitle)}</div>
        </div>
      `;
    }

    const ths = columns
      .map((col) => {
        const sortable = col.sortable !== false && col.key;
        const active = sortKey === col.key;
        const align = col.align === 'right' ? 'text-right' : '';
        return `
          <th class="${align} ${sortable ? 'sortable-th' : ''} ${active ? 'sorted' : ''}"
              ${sortable ? `data-sort-key="${F.escapeHtml(col.key)}"` : ''}>
            <span>${F.escapeHtml(col.label)}</span>
            ${sortable && active ? `<span class="sort-indicator">${sortDir === 'asc' ? '▲' : '▼'}</span>` : ''}
          </th>
        `;
      })
      .join('');

    const trs = slice
      .map((row, idx) => {
        const extraCls = rowClassFn ? rowClassFn(row) : '';
        const clickAttr = onRowClickAttr ? onRowClickAttr(row) : '';
        const tds = columns
          .map((col) => {
            const align = col.align === 'right' ? 'text-right' : '';
            const val = col.render ? col.render(row, startIdx + idx) : F.escapeHtml(row[col.key]);
            return `<td class="${align} ${col.cellClass || ''}">${val}</td>`;
          })
          .join('');
        return `<tr class="${extraCls}" ${clickAttr}>${tds}</tr>`;
      })
      .join('');

    const paginationHtml = totalPages > 1
      ? `
        <div class="table-pagination">
          <div class="pagination-info mono">Showing ${startIdx + 1}–${Math.min(startIdx + pageSize, total)} of ${total}</div>
          <div class="pagination-controls">
            <button type="button" class="btn btn-sm btn-ghost" data-page="${safePage - 1}" ${safePage <= 1 ? 'disabled' : ''}>Prev</button>
            <span class="pagination-page mono">${safePage} / ${totalPages}</span>
            <button type="button" class="btn btn-sm btn-ghost" data-page="${safePage + 1}" ${safePage >= totalPages ? 'disabled' : ''}>Next</button>
          </div>
        </div>
      `
      : `<div class="table-pagination"><div class="pagination-info mono">${total} total record${total === 1 ? '' : 's'}</div></div>`;

    return `
      <div class="table-scroll">
        <table class="industrial-table">
          <thead><tr>${ths}</tr></thead>
          <tbody>${trs}</tbody>
        </table>
      </div>
      ${paginationHtml}
    `;
  }

  global.PalletsDataTable = { render: renderTable };
})(typeof window !== 'undefined' ? window : globalThis);

