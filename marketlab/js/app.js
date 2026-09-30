// MarketLab UI: routing, rendering, trading controls, autoplay, persistence, and exports.
import * as E from './engine.js';
import { lineChart, sparkline, disposeCharts } from './chart.js';
import { drawShareCard, shareText } from './share.js';

const $ = (sel, root = document) => root.querySelector(sel);
const view = $('#view');
const appRoot = $('#app');

let state = null;
const ui = {
  route: null,
  autoplay: false,
  speed: 1000,
  timer: null,
  range: 90,
  qty: {},
  tradeMsg: null,
  newsFilter: 'all',
  txFilter: 'all',
  flash: null, // previous prices, set for the render right after a new day
  freshNews: new Set(),
  showShare: false,
  storageOk: true,
};

const SECTOR_COLORS = {
  technology: '#7c9cff',
  energy: '#f5b942',
  healthcare: '#c38bff',
  retail: '#fb923c',
  aerospace: '#38bdf8',
  cash: '#64748b',
};

// ---------- Helpers ----------

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
const money = E.formatCents;
const tone = (v) => (v > 0 ? 'pos' : v < 0 ? 'neg' : 'flat');
const plural = (n, word) => `${n.toLocaleString('en-US')} ${word}${n === 1 ? '' : 's'}`;

function chg(ratio) {
  const t = Math.abs(ratio) < 0.00005 ? 'flat' : tone(ratio);
  const arrow = t === 'pos' ? '▲' : t === 'neg' ? '▼' : '■';
  return `<span class="chg ${t}"><span aria-hidden="true">${arrow}</span> ${E.formatPct(ratio)}</span>`;
}
const gain = (cents) => `<span class="${tone(cents)}">${E.formatSignedCents(cents)}</span>`;
const mark = (c, cls = '') => `<span class="co-mark ${cls}" style="background:${c.color}" aria-hidden="true">${esc(c.mark)}</span>`;
const dayChange = (id) => {
  const prev = E.previousPrice(state, id);
  return prev ? (E.currentPrice(state, id) - prev) / prev : 0;
};
const axisPrice = (v) => '$' + (v / 100).toLocaleString('en-US', { maximumFractionDigits: v < 10000 ? 2 : 0 });
const axisValue = (v) => '$' + (v / 100000).toFixed(1) + 'k';

function flashClass(id) {
  if (!ui.flash) return '';
  const before = ui.flash[id];
  const now = E.currentPrice(state, id);
  return now > before ? 'flash-up' : now < before ? 'flash-down' : '';
}

function announce(msg) {
  const el = $('#sr-status');
  el.textContent = '';
  setTimeout(() => (el.textContent = msg), 40);
}

function toast(title, body = '', type = 'info', ms = 4200) {
  const box = $('#toasts');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<strong>${esc(title)}</strong>${body ? `<span>${esc(body)}</span>` : ''}`;
  box.appendChild(t);
  while (box.children.length > 4) box.firstElementChild.remove();
  setTimeout(() => {
    t.classList.add('leaving');
    setTimeout(() => t.remove(), 260);
  }, ms);
}

function download(filename, content, mime) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  }
}

// ---------- Persistence ----------

function load() {
  try {
    const raw = localStorage.getItem(E.SAVE_KEY);
    return raw ? E.deserialize(raw) : null;
  } catch {
    ui.storageOk = false;
    return null;
  }
}

function save() {
  const status = $('#save-status');
  try {
    localStorage.setItem(E.SAVE_KEY, E.serialize(state));
    ui.storageOk = true;
    status.textContent = `Progress saved automatically (Day ${state.day}).`;
    status.classList.remove('error');
  } catch {
    ui.storageOk = false;
    status.textContent = 'Saving is unavailable in this browser (private mode or storage full). Progress will be lost when you leave.';
    status.classList.add('error');
  }
}

// ---------- Market actions ----------

function nextDay({ auto = false } = {}) {
  if (!state) return;
  ui.flash = Object.fromEntries(E.COMPANIES.map((c) => [c.id, E.currentPrice(state, c.id)]));
  const before = E.portfolioSummary(state).total;
  const { news, completed } = E.advanceDay(state);
  ui.freshNews = new Set(news.map((n) => n.id));
  save();
  render();
  ui.flash = null;
  updateHeader();

  for (const ch of completed) toast(`Challenge complete: ${ch.title}`, ch.description, 'award', 5500);
  const held = new Set(Object.keys(state.holdings));
  const notable = news.filter(
    (n) => n.type === 'recession' || n.type === 'economy' || n.companyIds.some((id) => held.has(id) || state.watchlist.includes(id)),
  );
  for (const n of notable.slice(0, 2)) toast('Fictional market event', n.headline, n.tone === 'negative' ? 'error' : n.tone === 'positive' ? 'success' : 'info');

  if (!auto) {
    const after = E.portfolioSummary(state).total;
    announce(
      `Day ${state.day}. ${news.length ? plural(news.length, 'fictional market event') + '.' : 'No major fictional events.'} ` +
        `Total virtual value ${money(after)}, ${E.formatSignedCents(after - before)} today.`,
    );
  }
}

function setAutoplay(on) {
  ui.autoplay = on;
  clearTimeout(ui.timer);
  const btn = $('#autoplay');
  btn.setAttribute('aria-pressed', String(on));
  $('.autoplay-label', btn).textContent = on ? 'Pause' : 'Autoplay';
  $('.autoplay-icon', btn).textContent = on ? '❚❚' : '▶';
  if (on) {
    const tick = () => {
      ui.timer = setTimeout(() => {
        if (!ui.autoplay) return;
        nextDay({ auto: true });
        tick();
      }, ui.speed);
    };
    tick();
    announce('Autoplay started. The fictional market advances automatically.');
  } else if (state) {
    announce(`Autoplay paused on Day ${state.day}.`);
  }
}

function doTrade(kind, id) {
  const input = $('#qty-input');
  const raw = input ? input.value : ui.qty[id];
  const res = kind === 'buy' ? E.buy(state, id, raw) : E.sell(state, id, raw);
  const c = E.companyById(id);
  if (!res.ok) {
    ui.tradeMsg = { id, type: 'error', text: res.error };
    render();
    announce(res.error);
    $('#qty-input')?.focus();
    return;
  }
  save();
  const text =
    kind === 'buy'
      ? `Simulated buy complete: ${plural(res.qty, 'share')} of ${c.ticker} at ${money(res.price)} for ${money(res.total)} in virtual cash.`
      : `Simulated sell complete: ${plural(res.qty, 'share')} of ${c.ticker} at ${money(res.price)} for ${money(res.total)}. Realized simulated gain: ${E.formatSignedCents(res.realized)}.`;
  ui.tradeMsg = { id, type: 'success', text };
  render();
  announce(text);
  for (const ch of res.completed) toast(`Challenge complete: ${ch.title}`, ch.description, 'award', 5500);
}

function toggleWatch(id) {
  const i = state.watchlist.indexOf(id);
  const c = E.companyById(id);
  if (i >= 0) state.watchlist.splice(i, 1);
  else state.watchlist.push(id);
  save();
  render();
  announce(`${c.name} ${i >= 0 ? 'removed from' : 'added to'} your watchlist.`);
}

// ---------- Header ----------

function updateHeader() {
  const phase = state ? state.economy.phase : 'expansion';
  $('#day-display').innerHTML = `<span class="day-num">Day ${state ? state.day : 0}</span>
    <span class="phase-badge phase-${phase}" title="Fictional economic phase">${esc(E.PHASES[phase].label)} · ${state ? state.economy.rate.toFixed(2) : '3.25'}% rate</span>`;
}

// ---------- Shared fragments ----------

function watchButton(c) {
  const on = state.watchlist.includes(c.id);
  return `<button type="button" class="icon-btn" data-action="watch" data-id="${c.id}" aria-pressed="${on}"
    aria-label="${on ? 'Remove' : 'Add'} ${esc(c.name)} ${on ? 'from' : 'to'} watchlist" title="${on ? 'Remove from' : 'Add to'} watchlist">${on ? '★' : '☆'}</button>`;
}

function companyRow(c) {
  const series = state.prices[c.id].slice(-30);
  return `<li class="co-row">
    ${mark(c)}
    <div style="min-width:0">
      <a class="co-name" href="#/company/${c.id}">${esc(c.name)}</a>
      <div class="co-meta"><span class="ticker">${c.ticker}</span><span class="sector-chip">${E.SECTORS[c.sector].label}</span><span class="badge-fict">Fictional</span></div>
    </div>
    ${sparkline(series)}
    <div class="co-price ${flashClass(c.id)}"><span class="price">${money(E.currentPrice(state, c.id))}</span><br>${chg(dayChange(c.id))}</div>
    ${watchButton(c)}
  </li>`;
}

function newsItem(n, { compact = false } = {}) {
  const cos = n.companyIds.map((id) => E.companyById(id)).filter(Boolean);
  return `<li class="news-item tone-${n.tone} ${ui.freshNews.has(n.id) ? 'is-new' : ''}">
    <div class="news-meta"><span class="news-label">Fictional market event</span><span class="news-type">${esc(E.NEWS_TYPES[n.type] || 'Market')}</span><span>Day ${n.day}</span>
      ${n.impact ? `<span class="${tone(n.impact)}">Est. impact ${E.formatPct(n.impact, 1)}</span>` : ''}</div>
    <h3>${esc(n.headline)}</h3>
    ${compact ? '' : `<p>${esc(n.body)}</p>`}
    ${cos.length ? `<div class="news-links">${cos.map((c) => `<a href="#/company/${c.id}">${esc(c.ticker)}</a>`).join('')}</div>` : ''}
  </li>`;
}

function emptyState(icon, title, text, action = '') {
  return `<div class="empty"><span class="empty-icon" aria-hidden="true">${icon}</span><strong>${esc(title)}</strong><p>${text}</p>${action}</div>`;
}

const nextDayBtn = `<button type="button" class="btn btn-primary" data-action="next-day">Next Day</button>`;

function statTile(label, value, sub = '', t = '') {
  return `<div class="card stat ${t ? `tone-${t}` : ''}">
    <div class="stat-label">${label}</div>
    <div class="stat-value">${value}</div>
    ${sub ? `<div class="stat-sub">${sub}</div>` : ''}
  </div>`;
}
const virtualTag = '<span class="tag-virtual">Virtual</span>';

function summaryStats(sum) {
  const dayGain = state.valueHistory.length > 1 ? sum.total - state.valueHistory[state.valueHistory.length - 2].value : 0;
  return `<section class="grid stats" aria-label="Account summary">
    ${statTile(`Virtual cash ${virtualTag}`, money(sum.cash), 'Available to simulate buys')}
    ${statTile(`Portfolio value ${virtualTag}`, money(sum.total), `Holdings ${money(sum.holdingsValue)} + cash`)}
    ${statTile('Simulated gains (total)', gain(sum.gain), `${E.formatPct(sum.gainPct)} vs. $10,000 start`, tone(sum.gain))}
    ${statTile('Simulated gains (today)', gain(dayGain), `Realized ${E.formatSignedCents(sum.realized)} · Unrealized ${E.formatSignedCents(sum.unrealized)}`, tone(dayGain))}
  </section>`;
}

// ---------- Views ----------

const charts = [];

function viewDashboard() {
  const sum = E.portfolioSummary(state);
  const watched = E.COMPANIES.filter((c) => state.watchlist.includes(c.id));
  const latest = state.news.slice(-4).reverse();
  const upcoming = E.CHALLENGES.filter((c) => !state.challenges[c.id])
    .map((c) => ({ c, r: Math.min(1, c.progress(state) / c.target) }))
    .sort((a, b) => b.r - a.r)
    .slice(0, 3);
  const eco = state.economy;
  const tips = [
    ['Diversification', 'Owning companies in different sectors means one bad fictional headline hurts less of your portfolio.'],
    ['Volatility', 'Stocks with big daily swings can rise fast but also fall fast. Skyforge and Verdant Helix are the most volatile here.'],
    ['Realized vs. unrealized', 'A gain is only “realized” when you sell. Until then it is “unrealized” and can still shrink or grow.'],
  ];
  const tip = tips[state.day % tips.length];

  charts.push({
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

  return `
  <div class="page-head">
    <div><h1 tabindex="-1">Dashboard</h1><p>Day ${state.day} of your fictional market session. Prices and companies are invented.</p></div>
  </div>
  ${summaryStats(sum)}
  <div class="grid two-col section-gap">
    <div class="stack">
      <section class="card" aria-labelledby="value-h">
        <div class="card-head"><h2 id="value-h">Virtual portfolio value</h2><span class="sub">Dashed line = $10,000 starting virtual cash</span></div>
        <div id="value-chart"></div>
      </section>
      <section class="card" aria-labelledby="market-h">
        <div class="card-head"><h2 id="market-h">Fictional market</h2><span class="sub">Tap a company to view its chart and trade</span></div>
        <ul class="co-list">${E.COMPANIES.map(companyRow).join('')}</ul>
      </section>
    </div>
    <div class="stack">
      <section class="card" aria-labelledby="watch-h">
        <div class="card-head"><h2 id="watch-h">Watchlist</h2><span class="sub">${plural(watched.length, 'company')}</span></div>
        ${
          watched.length
            ? `<ul class="co-list compact">${watched.map(companyRow).join('')}</ul>`
            : emptyState('☆', 'Your watchlist is empty', 'Tap the ☆ star next to any fictional company to follow it here.')
        }
      </section>
      <section class="card" aria-labelledby="econ-h">
        <div class="card-head"><h2 id="econ-h">Fictional economy</h2><span class="phase-badge phase-${eco.phase}">${E.PHASES[eco.phase].label}</span></div>
        <div class="econ-row"><span class="muted small">Aurelia Reserve Board rate</span><strong class="num">${eco.rate.toFixed(2)}%</strong></div>
        <div class="econ-row"><span class="muted small">Next rate decision</span><span class="num small">Day ${Math.floor(state.day / 10) * 10 + 10}</span></div>
        <h3 class="small muted" style="margin:10px 0 4px">Sector conditions</h3>
        ${Object.entries(E.SECTORS)
          .map(([k, s]) => {
            const v = state.sectors[k].condition;
            const w = Math.abs(v) * 50;
            const label = v > 0.15 ? 'Tailwind' : v < -0.15 ? 'Headwind' : 'Neutral';
            return `<div class="econ-row"><span class="econ-label">${s.label}</span>
              <span class="meter" role="img" aria-label="${s.label}: ${label}"><span class="${v >= 0 ? 'pos' : 'neg'}" style="${v >= 0 ? `left:50%;width:${w}%` : `right:50%;width:${w}%`}"></span></span>
              <span class="econ-val ${v > 0.15 ? 'pos' : v < -0.15 ? 'neg' : 'muted'}">${label}</span></div>`;
          })
          .join('')}
      </section>
      <section class="card" aria-labelledby="news-h">
        <div class="card-head"><h2 id="news-h">Latest fictional news</h2><a href="#/news" class="small">All news</a></div>
        ${latest.length ? `<ul class="news-list">${latest.map((n) => newsItem(n, { compact: true })).join('')}</ul>` : emptyState('📰', 'No fictional market events yet', 'Click Next Day to open the market and generate news.', nextDayBtn)}
      </section>
      <section class="card" aria-labelledby="goals-h">
        <div class="card-head"><h2 id="goals-h">Next challenges</h2><a href="#/challenges" class="small">All challenges</a></div>
        ${
          upcoming.length
            ? upcoming
                .map(
                  ({ c, r }) => `<div style="margin-bottom:12px"><div class="econ-row" style="padding:0 0 4px"><strong class="small">${esc(c.title)}</strong><span class="small muted num">${Math.round(r * 100)}%</span></div>
                  <div class="progress" role="progressbar" aria-label="${esc(c.title)} progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(r * 100)}"><span style="width:${r * 100}%"></span></div>
                  <div class="small muted" style="margin-top:4px">${esc(c.description)}</div></div>`,
                )
                .join('')
            : '<p class="muted">Every challenge is complete. Nice work — remember, it was all fictional!</p>'
        }
      </section>
      <section class="card tip-card" aria-labelledby="tip-h">
        <h2 id="tip-h"><span aria-hidden="true">💡</span> ${tip[0]}</h2>
        <p class="small" style="margin-top:6px">${tip[1]}</p>
        <a href="#/learn" class="small">Learn more</a>
      </section>
    </div>
  </div>`;
}

function viewCompany(id) {
  const c = E.companyById(id);
  if (!c) return viewNotFound();
  const price = E.currentPrice(state, id);
  const series = E.priceSeries(state, id);
  const shown = ui.range === 0 ? series : series.slice(-ui.range);
  const vol = E.realizedVolatility(state, id, 30);
  const p30 = state.prices[id].slice(-31)[0];
  const h = state.holdings[id];
  const owned = h?.shares || 0;
  const avg = owned ? h.costCents / owned : 0;
  const value = owned * price;
  const unreal = owned ? value - h.costCents : 0;
  const maxBuy = E.maxAffordable(state, id);
  const qtyVal = ui.qty[id] ?? '1';
  const coNews = state.news.filter((n) => n.companyIds.includes(id)).slice(-8).reverse();
  const msg = ui.tradeMsg && ui.tradeMsg.id === id ? ui.tradeMsg : null;
  const firstDay = shown[0].day;
  const markers = state.news
    .filter((n) => n.day >= firstDay && n.companyIds.includes(id))
    .map((n) => ({ day: n.day, tone: n.tone, text: n.headline }));

  charts.push({
    sel: '#price-chart',
    opts: { points: shown, label: `${c.name} (${c.ticker}) fictional price`, formatValue: money, formatAxis: axisPrice, markers },
  });

  const ranges = [
    [30, '1M'],
    [90, '3M'],
    [180, '6M'],
    [0, 'All'],
  ];

  return `
  <a class="breadcrumb" href="#/">← Back to dashboard</a>
  <section class="card co-hero" aria-label="${esc(c.name)} overview">
    ${mark(c, 'lg')}
    <div style="min-width:0">
      <h1 tabindex="-1">${esc(c.name)} <span class="badge-fict">Fictional company</span></h1>
      <div class="co-meta" style="margin-top:6px"><span class="ticker">${c.ticker}</span><span class="sector-chip">${E.SECTORS[c.sector].label}</span><span>${esc(c.tagline)}</span></div>
    </div>
    <div class="co-hero-price">
      <div class="muted small">Current fictional price</div>
      <div class="big-price ${flashClass(id)}">${money(price)}</div>
      <div>${chg(dayChange(id))} <span class="muted small">today</span> ${watchButton(c)}</div>
    </div>
  </section>

  <div class="grid co-layout section-gap">
      <section class="card" aria-labelledby="chart-h">
        <div class="card-head">
          <h2 id="chart-h">Fictional price history</h2>
          <div class="range-group" role="group" aria-label="Chart range">
            ${ranges.map(([r, l]) => `<button type="button" data-action="range" data-range="${r}" aria-pressed="${ui.range === r}">${l}</button>`).join('')}
          </div>
        </div>
        <div id="price-chart"></div>
        <div class="chart-legend"><span><i style="background:var(--pos)"></i>Good news</span><span><i style="background:var(--neg)"></i>Bad news</span><span><i style="background:#fcd34d"></i>Mixed / in line</span><span>Hover, tap, or focus the chart and use ← → keys to inspect days.</span></div>
      </section>

    <section class="card trade-card" aria-labelledby="trade-h">
      <h2 id="trade-h" style="margin-bottom:12px">Simulate a trade</h2>
      <div class="position-box" aria-label="Your simulated position">
        <div><div class="k">Shares owned</div><div class="v">${owned.toLocaleString('en-US')}</div></div>
        <div><div class="k">Avg purchase price</div><div class="v">${owned ? money(Math.round(avg)) : '—'}</div></div>
        <div><div class="k">Current value</div><div class="v">${money(value)}</div></div>
        <div><div class="k">Unrealized simulated gain</div><div class="v">${owned ? gain(unreal) : '—'}</div></div>
      </div>
      <form class="trade-form" id="trade-form" data-id="${id}" novalidate style="margin-top:14px">
        <div>
          <label class="field-label" for="qty-input">Number of whole shares</label>
          <div class="qty-row">
            <button type="button" class="btn qty-step" data-action="qty-step" data-delta="-1" aria-label="Decrease quantity by 1">−</button>
            <input id="qty-input" name="qty" type="text" inputmode="numeric" autocomplete="off" value="${esc(qtyVal)}"
              aria-describedby="qty-hint trade-msg" ${msg?.type === 'error' ? 'aria-invalid="true"' : ''}>
            <button type="button" class="btn qty-step" data-action="qty-step" data-delta="1" aria-label="Increase quantity by 1">+</button>
          </div>
          <p class="hint" id="qty-hint" style="margin:6px 0 0">Whole shares only. Trades fill instantly at the current fictional price, with no fees.</p>
        </div>
        <div class="quick-qty" role="group" aria-label="Quick quantities">
          <button type="button" class="btn btn-sm" data-action="qty-set" data-value="1">1</button>
          <button type="button" class="btn btn-sm" data-action="qty-set" data-value="10">10</button>
          <button type="button" class="btn btn-sm" data-action="qty-set" data-value="${maxBuy}" ${maxBuy ? '' : 'disabled'}>Max buy (${maxBuy.toLocaleString('en-US')})</button>
          <button type="button" class="btn btn-sm" data-action="qty-set" data-value="${owned}" ${owned ? '' : 'disabled'}>All owned (${owned.toLocaleString('en-US')})</button>
        </div>
        <div class="estimate" id="trade-estimate">${estimateHtml(id, qtyVal)}</div>
        <div class="form-msg ${msg ? msg.type : ''}" id="trade-msg">${msg ? esc(msg.text) : ''}</div>
        <div class="trade-buttons">
          <button type="submit" class="btn btn-buy" value="buy">Simulate buy</button>
          <button type="submit" class="btn btn-sell" value="sell">Simulate sell</button>
        </div>
      </form>
    </section>

      <section class="card" aria-labelledby="about-h">
        <h2 id="about-h" style="margin-bottom:8px">About ${esc(c.name)}</h2>
        <p class="muted small" style="margin-bottom:8px">Invented company for educational play. Any resemblance to real businesses is coincidental.</p>
        <p>${esc(c.description)}</p>
        <dl class="facts">
          <div><dt>Sector</dt><dd>${E.SECTORS[c.sector].label}</dd></div>
          <div><dt>Headquarters (fictional)</dt><dd>${esc(c.hq)}</dd></div>
          <div><dt>Founded (fictional)</dt><dd>${c.founded}</dd></div>
          <div><dt>Main business lines</dt><dd>${c.drivers.map(esc).join(', ')}</dd></div>
          <div><dt>30-day change</dt><dd>${chg((price - p30) / p30)}</dd></div>
          <div><dt>30-day volatility <a href="#/learn" class="small">(?)</a></dt><dd>${(vol * 100).toFixed(2)}% per day · ${E.volatilityLabel(vol)}</dd></div>
          <div><dt>Next earnings report</dt><dd>Day ${nextEarningsDay(c)}</dd></div>
          <div><dt>Sector conditions</dt><dd>${sectorWord(state.sectors[c.sector].condition)}</dd></div>
        </dl>
      </section>

      <section class="card" aria-labelledby="co-news-h">
        <h2 id="co-news-h" style="margin-bottom:12px">${esc(c.name)} in the fictional news</h2>
        ${coNews.length ? `<ul class="news-list">${coNews.map((n) => newsItem(n)).join('')}</ul>` : emptyState('📰', 'No company news yet', `Earnings, inventions, and setbacks for ${esc(c.ticker)} will appear here as days pass.`)}
      </section>
  </div>`;
}

function nextEarningsDay(c) {
  for (let d = state.day + 1; d <= state.day + 20; d++) if ((d + c.earningsOffset) % 20 === 0) return d;
  return '—';
}
function sectorWord(v) {
  return v > 0.15 ? '<span class="pos">Tailwind</span>' : v < -0.15 ? '<span class="neg">Headwind</span>' : 'Neutral';
}

function estimateHtml(id, raw) {
  const price = E.currentPrice(state, id);
  const parsed = E.parseQuantity(raw);
  const qty = parsed.ok ? parsed.qty : 0;
  const total = price * qty;
  const owned = E.sharesOwned(state, id);
  const rows = [
    ['Fictional price per share', money(price)],
    ['Estimated total', parsed.ok ? money(total) : '—'],
    ['Virtual cash available', money(state.cash)],
    ['Virtual cash after buy', parsed.ok ? (total <= state.cash ? money(state.cash - total) : '<span class="neg">Not enough virtual cash</span>') : '—'],
    ['Shares after sell', parsed.ok ? (qty <= owned ? (owned - qty).toLocaleString('en-US') : '<span class="neg">More than you own</span>') : '—'],
  ];
  return rows.map(([k, v]) => `<div class="row"><span>${k}</span><span>${v}</span></div>`).join('');
}

function viewPortfolio() {
  const sum = E.portfolioSummary(state);
  const bySector = {};
  for (const p of sum.positions) bySector[p.company.sector] = (bySector[p.company.sector] || 0) + p.valueCents;
  const segments = [...Object.entries(bySector), ['cash', sum.cash]].filter(([, v]) => v > 0);
  const nSectors = Object.keys(bySector).length;
  const biggest = sum.positions.reduce((m, p) => (p.weight > (m?.weight || 0) ? p : m), null);
  let divNote;
  if (nSectors === 0) divNote = 'You hold only virtual cash: no market risk, but no chance of growth either.';
  else if (nSectors === 1) divNote = 'Concentrated: every holding is in one sector, so a single sector-wide fictional event affects everything you own.';
  else if (nSectors === 2) divNote = 'Partly diversified across 2 sectors. Adding a third can soften sector-specific shocks.';
  else divNote = `Spread across ${nSectors} sectors. Diversification softens company and sector shocks, but economy-wide events like recessions still move most stocks together.`;
  if (biggest && biggest.weight > 0.5) divNote += ` Note: ${biggest.company.ticker} is ${(biggest.weight * 100).toFixed(0)}% of your total virtual value.`;

  const rows = sum.positions
    .map(
      (p) => `<tr>
      <td class="cell-first"><div class="cell-co">${mark(p.company)}<div style="min-width:0"><a class="co-name" href="#/company/${p.company.id}">${esc(p.company.name)}</a><span class="ticker">${p.company.ticker}</span> <span class="badge-fict">Fictional</span></div></div></td>
      <td class="r" data-label="Shares owned">${p.shares.toLocaleString('en-US')}</td>
      <td class="r" data-label="Avg purchase price">${money(Math.round(p.avgCents))}</td>
      <td class="r" data-label="Current price"><span class="${flashClass(p.company.id)}">${money(p.priceCents)}</span></td>
      <td class="r" data-label="Current value">${money(p.valueCents)}</td>
      <td class="r" data-label="Unrealized simulated gain">${gain(p.unrealizedCents)}<br><span class="small ${tone(p.unrealizedCents)}">${E.formatPct(p.unrealizedPct)}</span></td>
      <td class="r" data-label="Share of portfolio">${(p.weight * 100).toFixed(1)}%</td>
    </tr>`,
    )
    .join('');

  return `
  <div class="page-head"><div><h1 tabindex="-1">Portfolio</h1><p>Your simulated positions in fictional companies. Values update each simulated day.</p></div></div>
  <section class="grid stats" aria-label="Portfolio summary">
    ${statTile(`Virtual cash ${virtualTag}`, money(sum.cash))}
    ${statTile(`Holdings value ${virtualTag}`, money(sum.holdingsValue), plural(sum.positions.length, 'position'))}
    ${statTile('Unrealized simulated gains', gain(sum.unrealized), 'On shares you still hold', tone(sum.unrealized))}
    ${statTile('Realized simulated gains', gain(sum.realized), 'Locked in by selling', tone(sum.realized))}
  </section>
  <section class="card section-gap" aria-labelledby="pos-h">
    <div class="card-head"><h2 id="pos-h">Positions</h2><span class="sub">Total virtual value ${money(sum.total)} · Simulated gains ${E.formatSignedCents(sum.gain)}</span></div>
    ${
      sum.positions.length
        ? `<div class="table-wrap"><table class="data stackable">
            <caption class="sr-only">Simulated positions in fictional companies</caption>
            <thead><tr><th scope="col">Company</th><th scope="col" class="r">Shares owned</th><th scope="col" class="r">Avg purchase price</th><th scope="col" class="r">Current price</th><th scope="col" class="r">Current value</th><th scope="col" class="r">Unrealized simulated gain</th><th scope="col" class="r">Share of portfolio</th></tr></thead>
            <tbody>${rows}</tbody>
            <tfoot><tr><td class="cell-first">Total holdings</td><td class="r" data-label="Shares owned">${sum.positions.reduce((a, p) => a + p.shares, 0).toLocaleString('en-US')}</td><td class="r" data-label="Avg purchase price">—</td><td class="r" data-label="Current price">—</td><td class="r" data-label="Current value">${money(sum.holdingsValue)}</td><td class="r" data-label="Unrealized simulated gain">${gain(sum.unrealized)}</td><td class="r" data-label="Share of portfolio">${sum.total ? ((sum.holdingsValue / sum.total) * 100).toFixed(1) : '0.0'}%</td></tr></tfoot>
          </table></div>`
        : emptyState('📊', "You don't own any shares yet", 'Pick a fictional company, then use <strong>Simulate buy</strong> to open your first position. You have ' + money(sum.cash) + ' in virtual cash.', `<a class="btn btn-primary" href="#/company/${E.COMPANIES[0].id}">Explore ${esc(E.COMPANIES[0].name)}</a>`)
    }
  </section>
  <div class="grid two-col section-gap">
    <section class="card" aria-labelledby="alloc-h">
      <h2 id="alloc-h" style="margin-bottom:12px">Diversification by sector</h2>
      <div class="alloc-bar" role="img" aria-label="Allocation: ${segments.map(([k, v]) => `${k === 'cash' ? 'Virtual cash' : E.SECTORS[k].label} ${((v / sum.total) * 100).toFixed(0)}%`).join(', ')}">
        ${segments.map(([k, v]) => `<span style="width:${(v / sum.total) * 100}%;background:${SECTOR_COLORS[k]}"></span>`).join('')}
      </div>
      <div class="alloc-legend">${segments.map(([k, v]) => `<span><i style="background:${SECTOR_COLORS[k]}"></i>${k === 'cash' ? 'Virtual cash' : E.SECTORS[k].label} ${((v / sum.total) * 100).toFixed(1)}%</span>`).join('')}</div>
      <p class="small" style="margin-top:12px;color:var(--text-2)">${esc(divNote)}</p>
      <a class="small" href="#/learn">What is diversification?</a>
    </section>
    <section class="card" aria-labelledby="ru-h">
      <h2 id="ru-h" style="margin-bottom:8px">Realized vs. unrealized</h2>
      <p class="small" style="color:var(--text-2)"><strong>Unrealized</strong> simulated gains (${E.formatSignedCents(sum.unrealized)}) are “on paper”: they change every day with fictional prices until you sell.</p>
      <p class="small" style="color:var(--text-2)"><strong>Realized</strong> simulated gains (${E.formatSignedCents(sum.realized)}) were locked in when you sold shares for more or less than your average purchase price.</p>
      <p class="small muted">Realized + unrealized = your total simulated gains (${E.formatSignedCents(sum.gain)}).</p>
    </section>
  </div>`;
}

function viewHistory() {
  const all = state.transactions.slice().reverse();
  const list = ui.txFilter === 'all' ? all : all.filter((t) => t.type === ui.txFilter);
  const filters = [
    ['all', 'All'],
    ['buy', 'Simulated buys'],
    ['sell', 'Simulated sells'],
  ];
  const rows = list
    .map((t) => {
      const c = E.companyById(t.companyId);
      return `<tr>
        <td data-label="Day" class="num">${t.day}</td>
        <td data-label="Action"><span class="type-pill ${t.type}">${t.type === 'buy' ? 'Simulated buy' : 'Simulated sell'}</span></td>
        <td data-label="Company"><a href="#/company/${c.id}">${esc(c.name)}</a> <span class="ticker">${c.ticker}</span></td>
        <td data-label="Shares" class="r">${t.shares.toLocaleString('en-US')}</td>
        <td data-label="Price" class="r">${money(t.priceCents)}</td>
        <td data-label="Total" class="r">${money(t.totalCents)}</td>
        <td data-label="Realized simulated gain" class="r">${t.type === 'sell' ? gain(t.realizedCents) : '<span class="muted">—</span>'}</td>
      </tr>`;
    })
    .join('');
  return `
  <div class="page-head">
    <div><h1 tabindex="-1">Transaction history</h1><p>Every simulated trade you have made. No real orders were placed.</p></div>
    <button type="button" class="btn" data-action="export-csv" ${all.length ? '' : 'disabled'}>Download CSV</button>
  </div>
  <section class="card" aria-labelledby="tx-h">
    <div class="card-head"><h2 id="tx-h">${plural(list.length, 'simulated trade')}</h2>
      <div class="filters" role="group" aria-label="Filter trades">${filters.map(([k, l]) => `<button type="button" data-action="tx-filter" data-filter="${k}" aria-pressed="${ui.txFilter === k}">${l}</button>`).join('')}</div>
    </div>
    ${
      list.length
        ? `<div class="table-wrap"><table class="data stackable"><caption class="sr-only">Simulated transactions, newest first</caption>
          <thead><tr><th scope="col">Day</th><th scope="col">Action</th><th scope="col">Company</th><th scope="col" class="r">Shares</th><th scope="col" class="r">Price</th><th scope="col" class="r">Total</th><th scope="col" class="r">Realized simulated gain</th></tr></thead>
          <tbody>${rows}</tbody></table></div>`
        : all.length
          ? emptyState('🔎', 'No trades match this filter', 'Try another filter to see the rest of your simulated trades.')
          : emptyState('🧾', 'No simulated trades yet', 'Open a company page and use Simulate buy or Simulate sell. Each trade will be recorded here.', `<a class="btn btn-primary" href="#/">Browse fictional companies</a>`)
    }
  </section>`;
}

function viewNews() {
  const filters = [
    ['all', 'All'],
    ['earnings', 'Earnings'],
    ['invention', 'Inventions'],
    ['setback', 'Setbacks'],
    ['sector', 'Sectors'],
    ['rates', 'Interest rates'],
    ['economy', 'Economy & recessions'],
  ];
  const match = (n) => ui.newsFilter === 'all' || n.type === ui.newsFilter || (ui.newsFilter === 'economy' && n.type === 'recession');
  const list = state.news.filter(match).reverse();
  return `
  <div class="page-head"><div><h1 tabindex="-1">Fictional news feed</h1><p>Invented events that explain moves in the simulated market. None of this is real news.</p></div></div>
  <div class="filters" role="group" aria-label="Filter news" style="margin-bottom:14px">${filters.map(([k, l]) => `<button type="button" data-action="news-filter" data-filter="${k}" aria-pressed="${ui.newsFilter === k}">${l}</button>`).join('')}</div>
  ${
    list.length
      ? `<ul class="news-list">${list.map((n) => newsItem(n)).join('')}</ul>`
      : state.news.length
        ? emptyState('🔎', 'No events of this type yet', 'Keep advancing days — this kind of fictional event will show up eventually.')
        : emptyState('📰', 'No fictional market events yet', 'The market opens when you click Next Day. Earnings surprises, inventions, recessions, and interest-rate changes will be reported here.', nextDayBtn)
  }`;
}

function viewChallenges() {
  const done = E.CHALLENGES.filter((c) => state.challenges[c.id]).length;
  const items = E.CHALLENGES.map((c) => {
    const d = state.challenges[c.id];
    const cur = d ? c.target : Math.min(c.target, c.progress(state));
    const r = cur / c.target;
    const fmt = (v) => (c.money ? money(v) : v.toLocaleString('en-US'));
    return `<li class="ch ${d ? 'done' : ''}">
      <span class="ch-icon" aria-hidden="true">${d ? '✓' : '🏁'}</span>
      <div>
        <h3>${esc(c.title)} ${d ? '<span class="sr-only">(completed)</span>' : ''}</h3>
        <p>${esc(c.description)}</p>
        <div class="progress" role="progressbar" aria-label="${esc(c.title)} progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(r * 100)}"><span style="width:${r * 100}%"></span></div>
        <div class="ch-foot"><span>${d ? `Completed on Day ${d.day}` : `${fmt(cur)} / ${fmt(c.target)}`}</span><span>${Math.round(r * 100)}%</span></div>
      </div>
    </li>`;
  }).join('');
  let shareImg = '';
  if (ui.showShare) {
    const canvas = drawShareCard(state);
    shareImg = `<img class="share-preview" src="${canvas.toDataURL('image/png')}" alt="MarketLab share card for Day ${state.day}. ${esc(E.DISCLAIMER)}">`;
  }
  return `
  <div class="page-head"><div><h1 tabindex="-1">Challenges</h1><p>${done} of ${E.CHALLENGES.length} completed. Challenges are just for learning and fun — there are no prizes, cash, or rewards.</p></div></div>
  <ul class="ch-list">${items}</ul>
  <section class="card section-gap" aria-labelledby="results-h">
    <h2 id="results-h" style="margin-bottom:6px">Export &amp; share your results</h2>
    <p class="small muted">Every export and share card includes the full simulation notice: ${esc(E.DISCLAIMER)} ${esc(E.NOT_PREDICTIVE)}</p>
    <div class="btn-row" style="margin-top:10px">
      <button type="button" class="btn" data-action="export-txt">Download results (.txt)</button>
      <button type="button" class="btn" data-action="export-json">Download results (.json)</button>
      <button type="button" class="btn" data-action="share-card" aria-expanded="${ui.showShare}">${ui.showShare ? 'Hide share card' : 'Create share card'}</button>
      <button type="button" class="btn" data-action="copy-share">Copy share text</button>
    </div>
    ${ui.showShare ? `${shareImg}<div class="btn-row" style="margin-top:10px"><button type="button" class="btn btn-primary" data-action="download-card">Download share card (.png)</button></div>` : ''}
  </section>`;
}

function viewLearn() {
  return `
  <div class="learn">
  <div class="page-head"><div><h1 tabindex="-1">Learn the basics</h1><p>Short explanations of the ideas MarketLab is designed to teach.</p></div></div>
  <div class="stack">
    <section class="card" aria-labelledby="l-div">
      <h2 id="l-div">Diversification</h2>
      <p>Diversification means spreading money across different investments so one bad outcome doesn’t sink everything. In MarketLab each company is in a different sector, so owning several of them means a single fictional setback — a failed test flight or a snack recall — hits only part of your portfolio.</p>
      <div class="example"><strong>Example:</strong> Put all $10,000 in Skyforge and a −12% setback costs you $1,200. Split evenly across five companies and the same event costs about $240.</div>
      <p>Diversification has limits: economy-wide events like recessions or interest-rate hikes tend to move most stocks in the same direction at once.</p>
    </section>
    <section class="card" aria-labelledby="l-vol">
      <h2 id="l-vol">Volatility</h2>
      <p>Volatility measures how much a price typically swings from day to day. MarketLab shows each company’s 30-day volatility on its page. High volatility means larger potential gains <em>and</em> larger potential losses — it is a measure of uncertainty, not of quality.</p>
      <div class="example"><strong>Example:</strong> A stock with 1.5% daily volatility commonly moves about ±$1.50 on a $100 price. One with 3.5% volatility commonly moves ±$3.50, and occasionally much more.</div>
      <p>In recessions, MarketLab’s volatility rises for every company — just as uncertainty tends to rise in real downturns.</p>
    </section>
    <section class="card" aria-labelledby="l-gain">
      <h2 id="l-gain">Realized vs. unrealized gains</h2>
      <p>An <strong>unrealized</strong> gain (or loss) is the difference between what your shares are worth now and what you paid. It exists only on paper and changes every day.</p>
      <p>A <strong>realized</strong> gain (or loss) happens when you sell. MarketLab uses your <em>average purchase price</em> to calculate it.</p>
      <div class="example"><strong>Example:</strong> Buy 10 shares at $50 and 10 more at $70. Your average price is $60. Sell 5 at $80: you realize (80 − 60) × 5 = <span class="pos">+$100</span>. The other 15 shares still carry an unrealized gain of (80 − 60) × 15 = $300 until you sell them or the price changes.</div>
    </section>
    <section class="card" aria-labelledby="l-how">
      <h2 id="l-how">How the fictional market works</h2>
      <ul>
        <li><strong>Company trends</strong> — each company has a slowly shifting momentum that nobody can see directly.</li>
        <li><strong>Sector conditions</strong> — tailwinds and headwinds affect every company in a sector together.</li>
        <li><strong>The economy</strong> — expansions, slowdowns, recessions, and recoveries shift the whole market; the fictional Aurelia Reserve Board changes interest rates every 10 days.</li>
        <li><strong>Events</strong> — earnings surprises every 20 days per company, plus random inventions and setbacks.</li>
        <li><strong>Randomness</strong> — daily noise means outcomes are uncertain. Prices never drop below $0.50.</li>
      </ul>
    </section>
    <section class="card" aria-labelledby="l-not" style="border-color:var(--warn-border)">
      <h2 id="l-not">Remember: it’s a simulation</h2>
      <p>${esc(E.DISCLAIMER)}</p>
      <p>${esc(E.NOT_PREDICTIVE)} Real markets involve fees, taxes, real companies, and risks this game leaves out. Talk to a qualified, licensed professional before making real financial decisions.</p>
    </section>
  </div>
  </div>`;
}

function viewNotFound() {
  return `<div class="page-head"><div><h1 tabindex="-1">Page not found</h1></div></div>${emptyState('🧭', 'That page does not exist', 'It may have been a link to a company that isn’t part of this fictional market.', '<a class="btn btn-primary" href="#/">Go to dashboard</a>')}`;
}

// ---------- Router & render ----------

const TITLES = { dashboard: 'Dashboard', portfolio: 'Portfolio', history: 'Transactions', news: 'Fictional news', challenges: 'Challenges', learn: 'Learn' };

function parseRoute() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const name = parts[0] || 'dashboard';
  return { name, arg: parts[1] || null, key: parts.join('/') || 'dashboard' };
}

function render() {
  if (!state) return;
  const route = parseRoute();
  const routeChanged = ui.route !== route.key;
  if (routeChanged) {
    ui.tradeMsg = null;
    ui.showShare = false;
  }

  // Remember focus so re-renders (e.g. during autoplay) don't steal it.
  const active = document.activeElement;
  const activeId = active && view.contains(active) ? active.id : null;
  const activeAction = active && view.contains(active) && !activeId && active.dataset?.action ? `[data-action="${active.dataset.action}"]${active.dataset.id ? `[data-id="${active.dataset.id}"]` : ''}${active.dataset.range != null ? `[data-range="${active.dataset.range}"]` : ''}${active.dataset.filter ? `[data-filter="${active.dataset.filter}"]` : ''}` : null;
  const activeChart = active && active.classList?.contains('chart-svg') ? active.closest('[id]')?.id : null;
  const sel = activeId === 'qty-input' ? [active.selectionStart, active.selectionEnd] : null;

  disposeCharts();
  charts.length = 0;
  let html;
  switch (route.name) {
    case 'dashboard':
      html = viewDashboard();
      break;
    case 'company':
      html = viewCompany(route.arg);
      break;
    case 'portfolio':
      html = viewPortfolio();
      break;
    case 'history':
      html = viewHistory();
      break;
    case 'news':
      html = viewNews();
      break;
    case 'challenges':
      html = viewChallenges();
      break;
    case 'learn':
      html = viewLearn();
      break;
    default:
      html = viewNotFound();
  }
  view.innerHTML = html;
  view.classList.toggle('view-enter', routeChanged);
  for (const { sel: s, opts } of charts) {
    const el = $(s, view);
    if (el) lineChart(el, opts);
  }

  document.querySelectorAll('.tabs a').forEach((a) => {
    const on = a.dataset.route === route.name;
    if (on) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  const co = route.name === 'company' ? E.companyById(route.arg) : null;
  document.title = `${co ? `${co.name} (fictional)` : TITLES[route.name] || 'Not found'} · MarketLab simulator`;

  if (routeChanged) {
    ui.route = route.key;
    window.scrollTo(0, 0);
    $('h1', view)?.focus({ preventScroll: true });
  } else if (activeId) {
    const el = document.getElementById(activeId);
    if (el) {
      el.focus({ preventScroll: true });
      if (sel && el.setSelectionRange) el.setSelectionRange(sel[0], sel[1]);
    }
  } else if (activeAction) {
    $(activeAction, view)?.focus({ preventScroll: true });
  } else if (activeChart) {
    $(`#${activeChart} .chart-svg`, view)?.focus({ preventScroll: true });
  }
}

// ---------- Events ----------

view.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el || !state) return;
  const a = el.dataset.action;
  const input = $('#qty-input');
  const coId = $('#trade-form')?.dataset.id;
  switch (a) {
    case 'next-day':
      nextDay();
      break;
    case 'watch':
      toggleWatch(el.dataset.id);
      break;
    case 'range':
      ui.range = Number(el.dataset.range);
      render();
      break;
    case 'qty-step': {
      const cur = E.parseQuantity(input.value);
      const next = Math.max(1, (cur.ok ? cur.qty : 0) + Number(el.dataset.delta));
      input.value = String(next);
      onQtyInput(coId, input.value);
      break;
    }
    case 'qty-set':
      input.value = el.dataset.value;
      onQtyInput(coId, input.value);
      break;
    case 'news-filter':
      ui.newsFilter = el.dataset.filter;
      render();
      break;
    case 'tx-filter':
      ui.txFilter = el.dataset.filter;
      render();
      break;
    case 'export-csv':
      download(`marketlab-simulated-transactions-day${state.day}.csv`, E.transactionsCsv(state), 'text/csv');
      toast('Downloaded simulated transactions', 'The file includes the simulation notice.', 'success');
      break;
    case 'export-txt':
      download(`marketlab-simulated-results-day${state.day}.txt`, E.resultsText(state), 'text/plain');
      toast('Downloaded simulated results', 'The file includes the simulation notice.', 'success');
      break;
    case 'export-json':
      download(`marketlab-simulated-results-day${state.day}.json`, JSON.stringify(E.resultsSummary(state), null, 2), 'application/json');
      toast('Downloaded simulated results', 'The file includes the simulation notice.', 'success');
      break;
    case 'share-card':
      ui.showShare = !ui.showShare;
      render();
      break;
    case 'download-card':
      drawShareCard(state).toBlob((blob) => {
        if (blob) download(`marketlab-share-card-day${state.day}.png`, blob, 'image/png');
      }, 'image/png');
      break;
    case 'copy-share':
      copyText(shareText(state)).then((ok) =>
        ok ? toast('Share text copied', 'It includes the full simulation notice.', 'success') : toast('Could not copy', 'Your browser blocked clipboard access.', 'error'),
      );
      break;
  }
});

function onQtyInput(id, value) {
  ui.qty[id] = value;
  const est = $('#trade-estimate');
  if (est) est.innerHTML = estimateHtml(id, value);
  if (ui.tradeMsg) {
    ui.tradeMsg = null;
    const m = $('#trade-msg');
    m.textContent = '';
    m.className = 'form-msg';
    $('#qty-input').removeAttribute('aria-invalid');
  }
}

view.addEventListener('input', (e) => {
  if (e.target.id === 'qty-input') onQtyInput($('#trade-form').dataset.id, e.target.value);
});

view.addEventListener('submit', (e) => {
  if (e.target.id !== 'trade-form') return;
  e.preventDefault();
  const kind = e.submitter?.value === 'sell' ? 'sell' : 'buy';
  doTrade(kind, e.target.dataset.id);
});

$('#next-day').addEventListener('click', () => nextDay());
$('#autoplay').addEventListener('click', () => setAutoplay(!ui.autoplay));
$('#speed').addEventListener('change', (e) => {
  ui.speed = Number(e.target.value);
  if (ui.autoplay) setAutoplay(true);
});
window.addEventListener('hashchange', render);

// Reset
const resetDialog = $('#reset-dialog');
$('#reset-btn').addEventListener('click', () => {
  setAutoplay(false);
  resetDialog.returnValue = '';
  resetDialog.showModal();
});
resetDialog.addEventListener('close', () => {
  if (resetDialog.returnValue !== 'confirm') return;
  try {
    localStorage.removeItem(E.SAVE_KEY);
  } catch {
    /* storage unavailable; nothing to clear */
  }
  state = null;
  ui.route = null;
  ui.qty = {};
  view.innerHTML = '';
  if (location.hash && location.hash !== '#/') history.replaceState(null, '', '#/');
  updateHeader();
  showIntro();
  toast('Simulation reset', 'All simulated progress was erased.', 'info');
});

// Intro
function showIntro() {
  const intro = $('#intro');
  intro.hidden = false;
  intro.scrollTop = 0;
  appRoot.inert = true;
  $('#start-btn').focus({ preventScroll: true });
}
$('#start-btn').addEventListener('click', () => {
  state = E.createGame();
  save();
  $('#intro').hidden = true;
  appRoot.inert = false;
  updateHeader();
  render();
  announce('Simulation started with $10,000 in virtual cash. Remember: everything here is fictional.');
});

// ---------- Boot ----------

state = load();
updateHeader();
if (state) {
  render();
  $('#save-status').textContent = `Progress restored from this browser (Day ${state.day}).`;
} else {
  showIntro();
  if (!ui.storageOk) {
    const s = $('#save-status');
    s.textContent = 'Saving is unavailable in this browser. Progress will be lost when you leave.';
    s.classList.add('error');
  }
}
