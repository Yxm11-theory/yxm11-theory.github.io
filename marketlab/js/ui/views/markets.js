// Markets: every fictional company with sector filters, search, and sorting.
import * as E from '../../engine.js';
import { sparkline } from '../../chart.js';
import { esc, money, chg, mark, flashClass, emptyState, filterChips, SECTOR_OPTIONS, secLink } from '../util.js';
import { watchButton } from './security.js';

export const title = () => 'Markets';

const SORTS = [
  ['name', 'Name (A–Z)'],
  ['change', 'Today’s change'],
  ['cap', 'Market value'],
  ['pe', 'P/E ratio'],
  ['yield', 'Dividend yield'],
  ['growth', 'Revenue growth'],
  ['vol', 'Volatility'],
];

export function companyRows(ctx) {
  const { state } = ctx;
  return E.COMPANIES.map((spec) => {
    const cs = state.companies[spec.id];
    const price = E.currentPrice(state, spec.id);
    const m = E.companyMetrics(cs, spec, price);
    return { spec, cs, price, m, change: E.dayChange(state, spec.id), vol: E.realizedVolatility(state, spec.id, 30) };
  });
}

function sortRows(rows, key) {
  const by = {
    name: (a, b) => a.spec.name.localeCompare(b.spec.name),
    change: (a, b) => b.change - a.change,
    cap: (a, b) => b.m.marketCap - a.m.marketCap,
    pe: (a, b) => (a.m.pe ?? Infinity) - (b.m.pe ?? Infinity),
    yield: (a, b) => b.m.dividendYield - a.m.dividendYield,
    growth: (a, b) => b.m.revenueGrowth - a.m.revenueGrowth,
    vol: (a, b) => b.vol - a.vol,
  }[key];
  return rows.sort(by);
}

export function render(ctx) {
  const { state, ui } = ctx;
  const q = ui.marketSearch.trim().toLowerCase();
  let rows = companyRows(ctx).filter((r) => ui.sector === 'all' || r.spec.sector === ui.sector);
  if (q) rows = rows.filter((r) => `${r.spec.name} ${r.spec.ticker} ${r.spec.tagline} ${E.SECTORS[r.spec.sector].label}`.toLowerCase().includes(q));
  rows = sortRows(rows, ui.marketSort);

  const body = rows
    .map((r) => {
      const { spec, cs, price, m } = r;
      const delisted = cs.status !== 'active';
      return `<tr class="${delisted ? 'is-delisted' : ''}">
        <td class="cell-first"><div class="cell-co">${mark(spec)}<div style="min-width:0">${secLink(spec)}
          <div class="co-meta"><span class="ticker">${spec.ticker}</span><span class="sector-chip">${E.SECTORS[spec.sector].label}</span>${delisted ? '<span class="badge-danger">Delisted</span>' : ''}</div></div></div></td>
        <td class="r" data-label="Price"><span class="price ${flashClass(ctx, spec.id)}">${money(price)}</span></td>
        <td class="r" data-label="Today">${chg(r.change)}</td>
        <td class="r hide-sm" data-label="30 days">${sparkline(state.prices[spec.id].slice(-30), { width: 80, height: 26 })}</td>
        <td class="r" data-label="Market value">${E.formatMillions(m.marketCap)}</td>
        <td class="r" data-label="P/E">${m.pe == null ? '<span class="muted">n/a</span>' : m.pe.toFixed(1)}</td>
        <td class="r" data-label="Dividend yield">${m.dividendYield > 0 ? (m.dividendYield * 100).toFixed(1) + '%' : '<span class="muted">—</span>'}</td>
        <td class="r" data-label="Next earnings">${delisted ? '—' : `Day ${cs.nextEarnings}`}</td>
        <td class="r" data-label="Watch">${watchButton(ctx, spec)}</td>
      </tr>`;
    })
    .join('');

  return `
  <div class="page-head"><div><h1 tabindex="-1">Markets</h1><p>${E.COMPANIES.length} invented companies in ${E.SECTOR_KEYS.length} sectors. Every price and number is fictional.</p></div></div>
  <section class="card" aria-labelledby="mk-h">
    <h2 id="mk-h" class="sr-only">Companies</h2>
    <div class="toolbar">
      <label class="search"><span class="sr-only">Search companies</span>
        <input type="search" id="markets-search" placeholder="Search name, ticker, or sector" value="${esc(ui.marketSearch)}" autocomplete="off"></label>
      <label class="sort"><span class="muted small">Sort by</span>
        <select id="markets-sort">${SORTS.map(([k, l]) => `<option value="${k}" ${ui.marketSort === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    </div>
    ${filterChips('sector', SECTOR_OPTIONS, ui.sector, 'Filter by sector')}
    <p class="small muted" id="markets-count" aria-live="polite" style="margin:10px 0 0">Showing ${rows.length} of ${E.COMPANIES.length} companies</p>
    ${
      rows.length
        ? `<div class="table-wrap"><table class="data stackable markets-table">
            <caption class="sr-only">Fictional companies and key numbers</caption>
            <thead><tr><th scope="col">Company</th><th scope="col" class="r">Price</th><th scope="col" class="r">Today</th><th scope="col" class="r hide-sm">30 days</th><th scope="col" class="r">Market value</th><th scope="col" class="r">P/E</th><th scope="col" class="r">Div. yield</th><th scope="col" class="r">Next earnings</th><th scope="col" class="r"><span class="sr-only">Watchlist</span></th></tr></thead>
            <tbody>${body}</tbody></table></div>`
        : emptyState('🔎', 'No companies match', 'Try a different search or choose “All sectors”.')
    }
  </section>`;
}

export const actions = {
  sector(ctx, el) {
    ctx.ui.sector = el.dataset.filter;
    ctx.app.render();
  },
};

export function onInput(ctx, target) {
  if (target.id === 'markets-search') {
    ctx.ui.marketSearch = target.value;
    ctx.app.render();
    return true;
  }
  return false;
}
export function onChange(ctx, target) {
  if (target.id === 'markets-sort') {
    ctx.ui.marketSort = target.value;
    ctx.app.render();
    return true;
  }
  return false;
}
