// Transaction history.
import * as E from '../../engine.js';
import { esc, money, gain, emptyState, filterChips, plural } from '../util.js';

export const title = () => 'Transactions';

const TYPE_FILTERS = [
  ['all', 'All'],
  ['buy', 'Buys'],
  ['sell', 'Sells'],
  ['dividend', 'Dividends'],
  ['split', 'Splits'],
  ['bankruptcy', 'Bankruptcies'],
  ['order', 'Order updates'],
];

export function filteredTransactions(ctx) {
  const { state, ui } = ctx;
  return state.transactions.filter((t) => ui.txFilter === 'all' || t.type === ui.txFilter).reverse();
}

export function render(ctx) {
  const { state, ui } = ctx;
  const list = filteredTransactions(ctx);
  const rows = list
    .map((t) => {
      const spec = E.securityById(t.secId);
      return `<tr>
        <td data-label="Day" class="num">${t.day}</td>
        <td data-label="Action"><span class="type-pill ${t.type}">${esc(E.TX_LABELS[t.type] || t.type)}</span></td>
        <td data-label="Security"><a href="#/stock/${t.secId}">${esc(spec?.name ?? t.secId)}</a> <span class="ticker">${esc(spec?.ticker ?? '')}</span></td>
        <td data-label="Shares" class="r">${t.shares != null ? t.shares.toLocaleString('en-US') : '—'}</td>
        <td data-label="Price" class="r">${t.priceCents != null ? money(t.priceCents) : '—'}</td>
        <td data-label="Total" class="r">${t.totalCents != null ? money(t.totalCents) : '—'}</td>
        <td data-label="Execution costs" class="r">${t.costCents ? money(t.costCents) : '<span class="muted">—</span>'}</td>
        <td data-label="Realized simulated gain" class="r">${t.type === 'sell' || t.type === 'bankruptcy' ? gain(t.realizedCents) : '<span class="muted">—</span>'}</td>
      </tr>
      ${t.note && t.type !== 'buy' && t.type !== 'sell' ? `<tr class="note-row"><td colspan="8" data-label="Note">${esc(t.note)}</td></tr>` : ''}`;
    })
    .join('');
  return `
  <div class="page-head">
    <div><h1 tabindex="-1">Transaction history</h1><p>Every simulated trade, dividend, split, and write-off. No real orders were placed.</p></div>
    <button type="button" class="btn" data-action="export-csv" ${state.transactions.length ? '' : 'disabled'}>Download CSV</button>
  </div>
  <section class="card" aria-labelledby="tx-h">
    <div class="card-head"><h2 id="tx-h">${plural(list.length, 'record')}</h2>${filterChips('tx-filter', TYPE_FILTERS, ui.txFilter, 'Filter transactions')}</div>
    ${
      list.length
        ? `<div class="table-wrap"><table class="data stackable"><caption class="sr-only">Simulated transactions, newest first</caption>
          <thead><tr><th scope="col">Day</th><th scope="col">Action</th><th scope="col">Security</th><th scope="col" class="r">Shares</th><th scope="col" class="r">Price</th><th scope="col" class="r">Total</th><th scope="col" class="r">Costs</th><th scope="col" class="r">Realized simulated gain</th></tr></thead>
          <tbody>${rows}</tbody></table></div>`
        : state.transactions.length
          ? emptyState('🔎', 'No records match', 'Try another filter.')
          : emptyState('🧾', 'No simulated trades yet', 'Open a company page and use Simulate buy or Simulate sell. Each trade will be recorded here.', '<a class="btn btn-primary" href="#/markets">Browse companies</a>')
    }
  </section>`;
}

export const actions = {
  'tx-filter'(ctx, el) {
    ctx.ui.txFilter = el.dataset.filter;
    ctx.app.render();
  },
};
