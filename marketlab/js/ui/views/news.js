// Fictional news feed.
import { emptyState, newsItem, nextDayBtn, filterChips } from '../util.js';

export const title = () => 'Fictional news';

const FILTERS = [
  ['all', 'All'],
  ['earnings', 'Earnings'],
  ['company', 'Company news'],
  ['dividend', 'Dividends & splits'],
  ['sector', 'Sectors'],
  ['macro', 'Economy & rates'],
  ['market', 'Market'],
  ['distress', 'Distress & bankruptcy'],
];
const GROUPS = {
  dividend: ['dividend', 'split'],
  macro: ['economy', 'rates'],
  distress: ['distress', 'bankruptcy'],
};

export function render(ctx) {
  const { state, ui } = ctx;
  const f = ui.newsFilter;
  const match = (n) => f === 'all' || n.type === f || (GROUPS[f] || []).includes(n.type);
  const list = state.news.filter(match).reverse().slice(0, 200);
  return `
  <div class="page-head"><div><h1 tabindex="-1">Fictional news feed</h1><p>Invented events explaining moves in the simulated market. Each story is published on the same simulated day as the price move, so there is no way to trade ahead of it.</p></div></div>
  <div style="margin-bottom:14px">${filterChips('news-filter', FILTERS, f, 'Filter news')}</div>
  ${
    list.length
      ? `<ul class="news-list">${list.map((n) => newsItem(ctx, n)).join('')}</ul>`
      : state.news.length
        ? emptyState('🔎', 'No events of this type yet', 'Keep advancing days — this kind of fictional event may show up eventually.')
        : emptyState('📰', 'No fictional market events yet', 'The market opens when you click Next Day. Earnings reports, company events, and economic news will be reported here.', nextDayBtn)
  }`;
}

export const actions = {
  'news-filter'(ctx, el) {
    ctx.ui.newsFilter = el.dataset.filter;
    ctx.app.render();
  },
};
