// Company page: price chart, fundamentals, earnings, dividends, news, and the trade panel.
import * as E from '../../engine.js';
import {
  esc, money, chg, gain, mark, axisPrice, flashClass, emptyState, newsItem, plural, dollars2, fictionalTag, tone, announce, toast, $,
} from '../util.js';

const RANGES = [
  [30, '1M'],
  [90, '3M'],
  [126, '6M'],
  [0, 'All'],
];

export function title(ctx, id) {
  const s = E.securityById(id);
  return s ? `${s.name} (fictional)` : 'Not found';
}

function watchButton(ctx, spec) {
  const list = ctx.state.watchlists.find((w) => w.id === ctx.state.activeWatchlist) || ctx.state.watchlists[0];
  const on = list.ids.includes(spec.id);
  return `<button type="button" class="icon-btn" data-action="watch" data-id="${spec.id}" aria-pressed="${on}"
    aria-label="${on ? 'Remove' : 'Add'} ${esc(spec.name)} ${on ? 'from' : 'to'} ${esc(list.name)}" title="${on ? 'Remove from' : 'Add to'} ${esc(list.name)}">${on ? '★' : '☆'}</button>`;
}
export { watchButton };

function fundamentalsCard(ctx, spec) {
  const { state } = ctx;
  const cs = state.companies[spec.id];
  const price = E.currentPrice(state, spec.id);
  const m = E.companyMetrics(cs, spec, price);
  const vol = E.realizedVolatility(state, spec.id, 30);
  const row = (k, v, hint = '') => `<div><dt>${k}${hint ? ` <span class="hint-inline">${hint}</span>` : ''}</dt><dd>${v}</dd></div>`;
  const pct = (v) => (v == null ? '—' : `${(v * 100).toFixed(1)}%`);
  return `<section class="card" aria-labelledby="fund-h">
    <div class="card-head"><h2 id="fund-h">Fundamentals</h2><span class="sub">From the latest fictional quarterly reports</span></div>
    <dl class="facts facts-3">
      ${row('Market value', E.formatMillions(m.marketCap))}
      ${row('Revenue (last 4 quarters)', E.formatMillions(m.revenueTTM))}
      ${row('Revenue growth (1 year)', `<span class="${tone(m.revenueGrowth)}">${E.formatPct(m.revenueGrowth, 1)}</span>`)}
      ${row('Net income (last 4 quarters)', `<span class="${tone(m.netIncomeTTM)}">${E.formatMillions(m.netIncomeTTM)}</span>`)}
      ${row('Net profit margin', pct(m.netMargin))}
      ${row('Earnings per share', m.epsTTM == null ? '—' : dollars2(m.epsTTM * 100))}
      ${row('Price / earnings (P/E)', m.pe == null ? '<span class="muted">n/a (loss)</span>' : m.pe.toFixed(1))}
      ${row('Debt', E.formatMillions(m.debt))}
      ${row('Cash', E.formatMillions(m.cash))}
      ${row('Net debt', E.formatMillions(m.netDebt))}
      ${row('Dividend (yearly)', m.annualDividend > 0 ? `${dollars2(m.annualDividend * 100)} · ${pct(m.dividendYield)} yield` : 'None')}
      ${row('Payout ratio', m.payoutRatio == null ? '—' : pct(m.payoutRatio))}
      ${row('Beta (market sensitivity)', spec.beta.toFixed(2))}
      ${row('30-day volatility', `${(vol * 100).toFixed(2)}% / day · ${E.volatilityLabel(vol)}`)}
      ${row('Avg. volume (20 days)', `${E.formatVolume(E.averageVolume(state, spec.id))} shares`)}
    </dl>
    <p class="hint" style="margin-top:12px">Fundamentals are invented and simplified. They influence prices over time in this model, but never guarantee where a price goes.</p>
  </section>`;
}

function earningsCard(ctx, spec) {
  const cs = ctx.state.companies[spec.id];
  const qs = cs.quarters.slice(-8).reverse();
  const next = cs.status === 'active' ? `Day ${cs.nextEarnings} (in ${plural(cs.nextEarnings - ctx.state.day, 'day')})` : '—';
  return `<section class="card" aria-labelledby="earn-h">
    <div class="card-head"><h2 id="earn-h">Quarterly earnings</h2><a class="small" href="#/calendar">Earnings calendar</a></div>
    <div class="kv-row"><span class="muted">Next report</span><strong>${next}</strong></div>
    <div class="kv-row"><span class="muted">Consensus estimate (EPS)</span><strong>${cs.est == null ? '—' : dollars2(cs.est)}</strong></div>
    <p class="hint">Prices react to how results compare with the estimate, not to whether profits are positive.</p>
    <div class="table-wrap"><table class="data compact-table stackable">
      <caption class="sr-only">Last eight fictional quarterly results</caption>
      <thead><tr><th scope="col">Quarter</th><th scope="col" class="r">Revenue</th><th scope="col" class="r">EPS</th><th scope="col" class="r">Estimate</th><th scope="col" class="r">Surprise</th></tr></thead>
      <tbody>${qs
        .map(
          (q) => `<tr>
          <td class="cell-first"><strong>${esc(q.label)}</strong> <span class="muted small">Day ${q.day}</span></td>
          <td class="r" data-label="Revenue">${E.formatMillions(q.revenue)}</td>
          <td class="r" data-label="EPS"><span class="${tone(q.eps)}">${dollars2(q.eps)}</span></td>
          <td class="r" data-label="Estimate">${q.est == null ? '—' : dollars2(q.est)}</td>
          <td class="r" data-label="Surprise">${q.est == null ? '—' : chg(q.surprisePct)}</td>
        </tr>`,
        )
        .join('')}</tbody>
    </table></div>
  </section>`;
}

function dividendCard(ctx, spec) {
  const cs = ctx.state.companies[spec.id];
  const hist = cs.dividends.slice(-8).reverse();
  let policy;
  if (spec.payout === 0) policy = `${esc(spec.name)} does not pay a dividend; it reinvests profits in growth.`;
  else policy = `${esc(spec.name)} aims to pay about ${Math.round(spec.payout * 100)}% of earnings as dividends, raising them gradually and cutting them if earnings collapse.`;
  return `<section class="card" aria-labelledby="div-h">
    <h2 id="div-h" style="margin-bottom:8px">Dividends</h2>
    <p class="small" style="color:var(--text-2)">${policy}</p>
    <div class="kv-row"><span class="muted">Current quarterly dividend</span><strong>${cs.dps > 0 ? dollars2(cs.dps) + ' per share' : 'None'}</strong></div>
    <div class="kv-row"><span class="muted">Next ex-dividend day</span><strong>${cs.exDay && cs.exDay > ctx.state.day ? `Day ${cs.exDay}` : '—'}</strong></div>
    ${
      hist.length
        ? `<div class="table-wrap"><table class="data compact-table"><caption class="sr-only">Dividend history</caption>
          <thead><tr><th scope="col">Ex-dividend day</th><th scope="col" class="r">Per share</th></tr></thead>
          <tbody>${hist.map((d) => `<tr><td>Day ${d.day}</td><td class="r">${dollars2(d.dps)}</td></tr>`).join('')}</tbody></table></div>
          <p class="hint">History is adjusted for stock splits.</p>`
        : `<p class="hint">No dividends have been paid ${spec.payout > 0 ? 'yet' : ''}.</p>`
    }
  </section>`;
}

function tradeCard(ctx, spec) {
  const { state, ui } = ctx;
  const id = spec.id;
  const price = E.currentPrice(state, id);
  const h = state.holdings[id];
  const owned = h?.shares || 0;
  const avg = owned ? h.costCents / owned : 0;
  const value = owned * price;
  const tradable = E.isTradable(state, id);
  const maxBuy = tradable ? E.maxAffordable(state, id) : 0;
  const qtyVal = ui.qty[id] ?? '1';
  const msg = ui.tradeMsg && ui.tradeMsg.id === id ? ui.tradeMsg : null;
  return `<section class="card trade-card" aria-labelledby="trade-h">
    <h2 id="trade-h" style="margin-bottom:12px">Simulate a trade</h2>
    <div class="position-box" aria-label="Your simulated position">
      <div><div class="k">Shares owned</div><div class="v">${owned.toLocaleString('en-US')}</div></div>
      <div><div class="k">Avg purchase price</div><div class="v">${owned ? money(Math.round(avg)) : '—'}</div></div>
      <div><div class="k">Current value</div><div class="v">${money(value)}</div></div>
      <div><div class="k">Unrealized simulated gain</div><div class="v">${owned ? gain(value - h.costCents) : '—'}</div></div>
    </div>
    ${
      tradable
        ? `<form class="trade-form" id="trade-form" data-id="${id}" novalidate style="margin-top:14px">
      <div>
        <label class="field-label" for="qty-input">Number of whole shares</label>
        <div class="qty-row">
          <button type="button" class="btn qty-step" data-action="qty-step" data-delta="-1" aria-label="Decrease quantity by 1">−</button>
          <input id="qty-input" name="qty" type="text" inputmode="numeric" autocomplete="off" value="${esc(qtyVal)}"
            aria-describedby="qty-hint trade-msg" ${msg?.type === 'error' ? 'aria-invalid="true"' : ''}>
          <button type="button" class="btn qty-step" data-action="qty-step" data-delta="1" aria-label="Increase quantity by 1">+</button>
        </div>
        <p class="hint" id="qty-hint" style="margin:6px 0 0">Whole shares only. Market orders fill immediately at the latest fictional price.</p>
      </div>
      <div class="quick-qty" role="group" aria-label="Quick quantities">
        <button type="button" class="btn btn-sm" data-action="qty-set" data-value="1">1</button>
        <button type="button" class="btn btn-sm" data-action="qty-set" data-value="10">10</button>
        <button type="button" class="btn btn-sm" data-action="qty-set" data-value="${maxBuy}" ${maxBuy ? '' : 'disabled'}>Max buy (${maxBuy.toLocaleString('en-US')})</button>
        <button type="button" class="btn btn-sm" data-action="qty-set" data-value="${owned}" ${owned ? '' : 'disabled'}>All owned (${owned.toLocaleString('en-US')})</button>
      </div>
      <div class="estimate" id="trade-estimate">${estimateHtml(ctx, id, qtyVal)}</div>
      <div class="form-msg ${msg ? msg.type : ''}" id="trade-msg">${msg ? esc(msg.text) : ''}</div>
      <div class="trade-buttons">
        <button type="submit" class="btn btn-buy" value="buy">Simulate buy</button>
        <button type="submit" class="btn btn-sell" value="sell">Simulate sell</button>
      </div>
    </form>`
        : `<div class="notice-box" style="margin-top:14px">${esc(spec.ticker)} is delisted, so it can no longer be traded in this simulation.</div>`
    }
  </section>`;
}

export function estimateHtml(ctx, id, raw) {
  const { state } = ctx;
  const price = E.currentPrice(state, id);
  const parsed = E.parseQuantity(raw);
  const qty = parsed.ok ? parsed.qty : 0;
  const total = price * qty;
  const owned = E.sharesOwned(state, id);
  const cash = E.availableCash(state);
  const rows = [
    ['Fictional price per share', money(price)],
    ['Estimated total', parsed.ok ? money(total) : '—'],
    ['Virtual cash available', money(cash)],
    ['Virtual cash after buy', parsed.ok ? (total <= cash ? money(cash - total) : '<span class="neg">Not enough virtual cash</span>') : '—'],
    ['Shares after sell', parsed.ok ? (qty <= owned ? (owned - qty).toLocaleString('en-US') : '<span class="neg">More than you own</span>') : '—'],
  ];
  return rows.map(([k, v]) => `<div class="row"><span>${k}</span><span>${v}</span></div>`).join('');
}

export function render(ctx, id) {
  const { state, ui } = ctx;
  const spec = E.companyById(id);
  if (!spec) return null;
  const cs = state.companies[id];
  const price = E.currentPrice(state, id);
  const series = E.priceSeries(state, id);
  const shown = ui.range === 0 ? series : series.slice(-ui.range);
  const firstDay = shown[0].day;
  const volumes = state.volumes[id].slice(-shown.length).map((value, i) => ({ day: shown[i].day, value }));
  const markers = state.news
    .filter((n) => n.day >= firstDay && n.companyIds.includes(id))
    .map((n) => ({ day: n.day, tone: n.tone, text: n.headline }));
  const coNews = state.news.filter((n) => n.companyIds.includes(id) || (n.sector === spec.sector && !n.companyIds.length)).slice(-8).reverse();
  const delisted = cs.status !== 'active';

  ctx.charts.push({
    sel: '#price-chart',
    opts: { points: shown, label: `${spec.name} (${spec.ticker}) fictional price`, formatValue: money, formatAxis: axisPrice, markers, volumes },
  });

  return `
  <a class="breadcrumb" href="#/markets">← All companies</a>
  ${delisted ? `<div class="notice-box danger" role="note"><strong>Delisted.</strong> ${esc(spec.name)} went bankrupt on Day ${cs.bankruptDay ?? '—'} in this simulation. Its shares were written off and it can no longer be traded.</div>` : ''}
  <section class="card co-hero" aria-label="${esc(spec.name)} overview">
    ${mark(spec, 'lg')}
    <div style="min-width:0">
      <h1 tabindex="-1">${esc(spec.name)} <span class="badge-fict">Fictional company</span></h1>
      <div class="co-meta" style="margin-top:6px"><span class="ticker">${spec.ticker}</span><span class="sector-chip">${E.SECTORS[spec.sector].label}</span><span>${esc(spec.tagline)}</span></div>
    </div>
    <div class="co-hero-price">
      <div class="muted small">${delisted ? 'Final fictional price' : 'Current fictional price'}</div>
      <div class="big-price ${flashClass(ctx, id)}">${money(price)}</div>
      <div>${chg(E.dayChange(state, id))} <span class="muted small">today</span> ${watchButton(ctx, spec)}</div>
    </div>
  </section>

  <div class="grid co-layout section-gap">
    <section class="card" aria-labelledby="chart-h">
      <div class="card-head">
        <h2 id="chart-h">Fictional price &amp; volume</h2>
        <div class="range-group" role="group" aria-label="Chart range">
          ${RANGES.map(([r, l]) => `<button type="button" data-action="range" data-range="${r}" aria-pressed="${ui.range === r}">${l}</button>`).join('')}
        </div>
      </div>
      <div id="price-chart"></div>
      <div class="chart-legend"><span><i style="background:var(--pos)"></i>Good news</span><span><i style="background:var(--neg)"></i>Bad news</span><span><i style="background:#fcd34d"></i>Mixed / in line</span><span>Bars show daily trading volume. Hover, tap, or focus the chart and use ← → keys.</span></div>
    </section>
    ${tradeCard(ctx, spec)}
    ${fundamentalsCard(ctx, spec)}
    ${earningsCard(ctx, spec)}
    ${dividendCard(ctx, spec)}
    <section class="card" aria-labelledby="about-h">
      <h2 id="about-h" style="margin-bottom:8px">About ${esc(spec.name)}</h2>
      <p class="muted small" style="margin-bottom:8px">Invented company for educational play. Any resemblance to real businesses is coincidental.</p>
      <p>${esc(spec.description)}</p>
      <dl class="facts">
        <div><dt>Sector</dt><dd>${E.SECTORS[spec.sector].label}</dd></div>
        <div><dt>Headquarters (fictional)</dt><dd>${esc(spec.hq)}, Aurelia</dd></div>
        <div><dt>Founded (fictional)</dt><dd>${spec.founded}</dd></div>
        <div><dt>Best-known product</dt><dd>${esc(spec.product)}</dd></div>
      </dl>
    </section>
    <section class="card" aria-labelledby="co-news-h">
      <h2 id="co-news-h" style="margin-bottom:12px">In the fictional news</h2>
      ${coNews.length ? `<ul class="news-list">${coNews.map((n) => newsItem(ctx, n)).join('')}</ul>` : emptyState('📰', 'No news yet', `Earnings reports and other events for ${esc(spec.ticker)} will appear here as days pass.`)}
    </section>
  </div>`;
}

// ---------- Actions ----------

function doTrade(ctx, kind, id) {
  const { state, ui, app } = ctx;
  const raw = $('#qty-input')?.value ?? ui.qty[id];
  const res = kind === 'buy' ? E.buy(state, id, raw) : E.sell(state, id, raw);
  const spec = E.securityById(id);
  if (!res.ok) {
    ui.tradeMsg = { id, type: 'error', text: res.error };
    app.render();
    announce(res.error);
    $('#qty-input')?.focus();
    return;
  }
  app.save();
  const text =
    kind === 'buy'
      ? `Simulated buy complete: ${plural(res.qty, 'share')} of ${spec.ticker} at ${money(res.price)} for ${money(res.total)} in virtual cash.`
      : `Simulated sell complete: ${plural(res.qty, 'share')} of ${spec.ticker} at ${money(res.price)} for ${money(res.total)}. Realized simulated gain: ${E.formatSignedCents(res.realized)}.`;
  ui.tradeMsg = { id, type: 'success', text };
  app.render();
  announce(text);
  for (const ch of res.completed) toast(`Challenge complete: ${ch.title}`, ch.description, 'award', 5500);
}

export function onQtyInput(ctx, id, value) {
  ctx.ui.qty[id] = value;
  const est = $('#trade-estimate');
  if (est) est.innerHTML = estimateHtml(ctx, id, value);
  if (ctx.ui.tradeMsg) {
    ctx.ui.tradeMsg = null;
    const m = $('#trade-msg');
    if (m) {
      m.textContent = '';
      m.className = 'form-msg';
    }
    $('#qty-input')?.removeAttribute('aria-invalid');
  }
}

export const actions = {
  range(ctx, el) {
    ctx.ui.range = Number(el.dataset.range);
    ctx.app.render();
  },
  'qty-step'(ctx, el) {
    const input = $('#qty-input');
    const cur = E.parseQuantity(input.value);
    input.value = String(Math.max(1, (cur.ok ? cur.qty : 0) + Number(el.dataset.delta)));
    onQtyInput(ctx, $('#trade-form').dataset.id, input.value);
  },
  'qty-set'(ctx, el) {
    const input = $('#qty-input');
    input.value = el.dataset.value;
    onQtyInput(ctx, $('#trade-form').dataset.id, input.value);
  },
};

export function onSubmit(ctx, form, submitter) {
  if (form.id !== 'trade-form') return false;
  doTrade(ctx, submitter?.value === 'sell' ? 'sell' : 'buy', form.dataset.id);
  return true;
}
