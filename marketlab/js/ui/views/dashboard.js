// Dashboard: account summary, value chart, market movers, watchlist, economy, calendar, news.
import * as E from '../../engine.js';
import { sparkline } from '../../chart.js';
import {
  esc, money, chg, gain, mark, axisValue, flashClass, emptyState, newsItem, plural, statTile, virtualTag, nextDayBtn, secLink, tone,
} from '../util.js';
import { watchButton } from './security.js';

export const title = () => 'Dashboard';

export function summaryStats(ctx, sum) {
  const { state } = ctx;
  const vh = state.valueHistory;
  const dayGain = vh.length > 1 ? sum.total - vh[vh.length - 2].value : 0;
  return `<section class="grid stats" aria-label="Account summary">
    ${statTile(`Virtual cash ${virtualTag}`, money(sum.cash), 'Available to simulate buys')}
    ${statTile(`Portfolio value ${virtualTag}`, money(sum.total), `Holdings ${money(sum.holdingsValue)} + cash`)}
    ${statTile('Simulated gains (total)', gain(sum.gain), `${E.formatPct(sum.gainPct)} total return vs. $10,000 start`, tone(sum.gain))}
    ${statTile('Simulated gains (today)', gain(dayGain), `Realized ${E.formatSignedCents(sum.realized)} · Unrealized ${E.formatSignedCents(sum.unrealized)}`, tone(dayGain))}
  </section>`;
}

function row(ctx, spec) {
  const { state } = ctx;
  return `<li class="co-row">
    ${mark(spec)}
    <div style="min-width:0">${secLink(spec)}
      <div class="co-meta"><span class="ticker">${spec.ticker}</span><span class="sector-chip">${spec.kind === 'fund' ? 'Fund' : E.SECTORS[spec.sector].label}</span></div>
    </div>
    ${sparkline(state.prices[spec.id].slice(-30))}
    <div class="co-price ${flashClass(ctx, spec.id)}"><span class="price">${money(E.currentPrice(state, spec.id))}</span><br>${chg(E.dayChange(state, spec.id))}</div>
    ${watchButton(ctx, spec)}
  </li>`;
}
export { row as companyRow };

export function econCard(ctx) {
  const m = ctx.state.macro;
  const lbl = E.economyLabel(m);
  return `<section class="card" aria-labelledby="econ-h">
    <div class="card-head"><h2 id="econ-h">Fictional economy</h2><span class="phase-badge phase-${lbl.key}">${lbl.label}</span></div>
    <div class="econ-row"><span class="muted small">Economic growth (yearly rate)</span><strong class="num ${tone(m.growth)}">${m.growth.toFixed(1)}%</strong></div>
    <div class="econ-row"><span class="muted small">Inflation (yearly rate)</span><strong class="num">${m.inflation.toFixed(1)}%</strong></div>
    <div class="econ-row"><span class="muted small">Aurelia Reserve Board rate</span><strong class="num">${m.rate.toFixed(2)}%</strong></div>
    <p class="hint" style="margin-top:8px">Growth, inflation, and interest rates affect each sector differently in this simplified model. <a href="#/learn">How?</a></p>
  </section>`;
}

export function render(ctx) {
  const { state } = ctx;
  const sum = E.portfolioSummary(state);
  const wl = state.watchlists.find((w) => w.id === state.activeWatchlist) || state.watchlists[0];
  const watched = wl.ids.map((id) => E.securityById(id)).filter(Boolean);
  const latest = state.news.slice(-4).reverse();
  const movers = E.COMPANIES.filter((c) => state.companies[c.id].status === 'active')
    .map((c) => ({ c, r: E.dayChange(state, c.id) }))
    .sort((a, b) => b.r - a.r);
  const gainers = movers.slice(0, 4);
  const losers = movers.slice(-4).reverse();
  const upcoming = E.COMPANIES.filter((c) => state.companies[c.id].status === 'active')
    .map((c) => ({ c, day: state.companies[c.id].nextEarnings }))
    .sort((a, b) => a.day - b.day)
    .slice(0, 5);
  const next = E.CHALLENGES.filter((c) => !state.challenges[c.id])
    .map((c) => ({ c, r: Math.min(1, c.progress(state) / c.target) }))
    .sort((a, b) => b.r - a.r)
    .slice(0, 3);

  ctx.charts.push({
    sel: '#value-chart',
    opts: {
      points: state.valueHistory,
      label: 'Total virtual portfolio value',
      formatValue: money,
      formatAxis: axisValue,
      baseline: E.STARTING_CASH_CENTS,
      emptyText: 'Your virtual value chart begins after you click Next Day.',
    },
  });

  const moverList = (list) =>
    `<ul class="mini-list">${list
      .map(({ c, r }) => `<li><span class="mini-name">${mark(c, 'sm')}${secLink(c, c.ticker)}</span><span class="num">${money(E.currentPrice(state, c.id))}</span>${chg(r)}</li>`)
      .join('')}</ul>`;

  return `
  <div class="page-head">
    <div><h1 tabindex="-1">Dashboard</h1><p>Day ${state.day} of your fictional market session. Prices, companies, and news are invented.</p></div>
  </div>
  ${summaryStats(ctx, sum)}
  <div class="grid two-col section-gap">
    <div class="stack">
      <section class="card" aria-labelledby="value-h">
        <div class="card-head"><h2 id="value-h">Virtual portfolio value</h2><span class="sub">Dashed line = $10,000 starting virtual cash</span></div>
        <div id="value-chart"></div>
      </section>
      <section class="card" aria-labelledby="movers-h">
        <div class="card-head"><h2 id="movers-h">Today’s biggest moves</h2><a class="small" href="#/markets">All ${E.COMPANIES.length} companies</a></div>
        ${state.day === 0 ? '<p class="muted small">Moves shown are from the last day of pre-game history.</p>' : ''}
        <div class="grid movers">
          <div><h3 class="small muted">Up the most</h3>${moverList(gainers)}</div>
          <div><h3 class="small muted">Down the most</h3>${moverList(losers)}</div>
        </div>
      </section>
      <section class="card" aria-labelledby="cal-h">
        <div class="card-head"><h2 id="cal-h">Upcoming earnings</h2><a class="small" href="#/calendar">Calendar</a></div>
        <ul class="mini-list">${upcoming
          .map(
            ({ c, day }) => `<li><span class="mini-name">${mark(c, 'sm')}${secLink(c, c.name)}</span><span class="muted small">Est. EPS $${(state.companies[c.id].est / 100).toFixed(2)}</span><strong class="num">${day === state.day + 1 ? 'Tomorrow' : `Day ${day}`}</strong></li>`,
          )
          .join('')}</ul>
      </section>
    </div>
    <div class="stack">
      <section class="card" aria-labelledby="watch-h">
        <div class="card-head"><h2 id="watch-h">${esc(wl.name)}</h2><span class="sub">${plural(watched.length, 'security', 'securities')}</span></div>
        ${
          watched.length
            ? `<ul class="co-list compact">${watched.map((s) => row(ctx, s)).join('')}</ul>`
            : emptyState('☆', 'This watchlist is empty', 'Tap the ☆ star next to any fictional company to follow it here.', '<a class="btn btn-sm" href="#/markets">Browse companies</a>')
        }
      </section>
      ${econCard(ctx)}
      <section class="card" aria-labelledby="news-h">
        <div class="card-head"><h2 id="news-h">Latest fictional news</h2><a href="#/news" class="small">All news</a></div>
        ${latest.length ? `<ul class="news-list">${latest.map((n) => newsItem(ctx, n, { compact: true })).join('')}</ul>` : emptyState('📰', 'No fictional market events yet', 'Click Next Day to open the market and generate news.', nextDayBtn)}
      </section>
      <section class="card" aria-labelledby="goals-h">
        <div class="card-head"><h2 id="goals-h">Next challenges</h2><a href="#/challenges" class="small">All challenges</a></div>
        ${
          next.length
            ? next
                .map(
                  ({ c, r }) => `<div style="margin-bottom:12px"><div class="econ-row" style="padding:0 0 4px"><strong class="small">${esc(c.title)}</strong><span class="small muted num">${Math.round(r * 100)}%</span></div>
                  <div class="progress" role="progressbar" aria-label="${esc(c.title)} progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(r * 100)}"><span style="width:${r * 100}%"></span></div>
                  <div class="small muted" style="margin-top:4px">${esc(c.description)}</div></div>`,
                )
                .join('')
            : '<p class="muted">Every challenge is complete — remember, it was all fictional!</p>'
        }
      </section>
    </div>
  </div>`;
}
