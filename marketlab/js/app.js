// MarketLab UI shell: state, routing, rendering, global actions, autoplay, persistence.
import * as E from './engine.js';
import { lineChart, disposeCharts } from './chart.js';
import { drawShareCard, shareText } from './share.js';
import { $, esc, toast, announce, download, copyText, plural, emptyState } from './ui/util.js';
import * as dashboard from './ui/views/dashboard.js';
import * as markets from './ui/views/markets.js';
import * as security from './ui/views/security.js';
import * as portfolio from './ui/views/portfolio.js';
import * as historyView from './ui/views/history.js';
import * as news from './ui/views/news.js';
import * as calendar from './ui/views/calendar.js';
import * as challenges from './ui/views/challenges.js';
import * as learn from './ui/views/learn.js';

const VIEWS = { dashboard, markets, stock: security, portfolio, history: historyView, news, calendar, challenges, learn };
const view = $('#view');
const appRoot = $('#app');

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
  sector: 'all',
  calSector: 'all',
  marketSearch: '',
  marketSort: 'name',
  flash: null, // previous prices, set for the render right after a new day
  freshNews: new Set(),
  showShare: false,
  storageOk: true,
};
const ctx = { state: null, ui, charts: [], app: null };

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
    localStorage.setItem(E.SAVE_KEY, E.serialize(ctx.state));
    ui.storageOk = true;
    status.textContent = `Progress saved automatically (Day ${ctx.state.day}).`;
    status.classList.remove('error');
  } catch {
    ui.storageOk = false;
    status.textContent = 'Saving is unavailable in this browser (private mode or storage full). Progress will be lost when you leave.';
    status.classList.add('error');
  }
}

// ---------- Market actions ----------

function nextDay({ auto = false } = {}) {
  const state = ctx.state;
  if (!state) return;
  ui.flash = Object.fromEntries(E.listedIds(state).map((id) => [id, E.currentPrice(state, id)]));
  const before = E.portfolioSummary(state).total;
  const result = E.advanceDay(state);
  ui.freshNews = new Set(result.news.map((n) => n.id));
  save();
  render();
  ui.flash = null;
  updateHeader();

  for (const ch of result.completed) toast(`Challenge complete: ${ch.title}`, ch.description, 'award', 5500);
  for (const a of result.account) toast(a.title, a.body, a.type || 'info', 5500);
  const held = new Set(Object.keys(state.holdings));
  const watched = new Set(state.watchlists.flatMap((w) => w.ids));
  const notable = result.news.filter(
    (n) => ['economy', 'rates', 'market', 'bankruptcy'].includes(n.type) || n.companyIds.some((id) => held.has(id) || watched.has(id)),
  );
  for (const n of notable.slice(0, 2)) toast('Fictional market event', n.headline, n.tone === 'negative' ? 'error' : n.tone === 'positive' ? 'success' : 'info');

  if (!auto) {
    const after = E.portfolioSummary(state).total;
    announce(
      `Day ${state.day}. ${result.news.length ? plural(result.news.length, 'fictional market event') + '.' : 'No major fictional events.'} ` +
        `Total virtual value ${E.formatCents(after)}, ${E.formatSignedCents(after - before)} today.`,
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
  } else if (ctx.state) {
    announce(`Autoplay paused on Day ${ctx.state.day}.`);
  }
}

function toggleWatch(id) {
  const state = ctx.state;
  const list = state.watchlists.find((w) => w.id === state.activeWatchlist) || state.watchlists[0];
  const i = list.ids.indexOf(id);
  const spec = E.securityById(id);
  if (i >= 0) list.ids.splice(i, 1);
  else list.ids.push(id);
  save();
  render();
  announce(`${spec.name} ${i >= 0 ? 'removed from' : 'added to'} ${list.name}.`);
}

// ---------- Header ----------

function updateHeader() {
  const state = ctx.state;
  const m = state ? state.macro : null;
  const lbl = m ? E.economyLabel(m) : { key: 'expansion', label: 'Expansion' };
  $('#day-display').innerHTML = `<span class="day-num">Day ${state ? state.day : 0}</span>
    <span class="phase-badge phase-${lbl.key}" title="Fictional economy">${esc(lbl.label)} · ${m ? m.rate.toFixed(2) : '3.25'}% rate</span>`;
  const seedEl = $('#seed-info');
  if (seedEl) seedEl.textContent = state ? `Scenario: ${E.SCENARIOS[state.scenario]?.label || state.scenario} · Seed: ${state.seed}` : '';
}

// ---------- Router & render ----------

function parseRoute() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  let name = parts[0] || 'dashboard';
  if (name === 'company') name = 'stock'; // links from version 1
  return { name, arg: parts[1] || null, key: [name, ...parts.slice(1)].join('/') };
}

function notFound() {
  return `<div class="page-head"><div><h1 tabindex="-1">Page not found</h1></div></div>${emptyState('🧭', 'That page does not exist', 'It may have been a link to something that isn’t part of this fictional market.', '<a class="btn btn-primary" href="#/">Go to dashboard</a>')}`;
}

function render() {
  const state = ctx.state;
  if (!state) return;
  const route = parseRoute();
  const routeChanged = ui.route !== route.key;
  if (routeChanged) {
    ui.tradeMsg = null;
    ui.showShare = false;
  }

  // Remember focus so re-renders (e.g. during autoplay) don't steal it.
  const active = document.activeElement;
  const inView = active && view.contains(active);
  const activeId = inView ? active.id : null;
  const d = inView ? active.dataset || {} : {};
  const activeSel = inView && !activeId && d.action
    ? `[data-action="${d.action}"]${['id', 'range', 'filter', 'value'].map((k) => (d[k] != null ? `[data-${k}="${CSS.escape(d[k])}"]` : '')).join('')}`
    : null;
  const activeChart = active && active.classList?.contains('chart-svg') ? active.closest('[id]')?.id : null;
  const sel = activeId && active.setSelectionRange && typeof active.selectionStart === 'number' ? [active.selectionStart, active.selectionEnd] : null;

  disposeCharts();
  ctx.charts.length = 0;
  const mod = VIEWS[route.name];
  const html = (mod && mod.render(ctx, route.arg)) || notFound();
  view.innerHTML = html;
  view.classList.toggle('view-enter', routeChanged);
  for (const { sel: s, opts } of ctx.charts) {
    const el = $(s, view);
    if (el) lineChart(el, opts);
  }

  document.querySelectorAll('.tabs a').forEach((a) => {
    const on = a.dataset.route === route.name || (a.dataset.route === 'markets' && route.name === 'stock');
    if (on) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  document.title = `${mod ? mod.title(ctx, route.arg) : 'Not found'} · MarketLab simulator`;

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
  } else if (activeSel) {
    $(activeSel, view)?.focus({ preventScroll: true });
  } else if (activeChart) {
    $(`#${activeChart} .chart-svg`, view)?.focus({ preventScroll: true });
  }
}

ctx.app = { render, save, nextDay, toggleWatch };

// ---------- Global actions ----------

const GLOBAL_ACTIONS = {
  'next-day': () => nextDay(),
  watch: (c, el) => toggleWatch(el.dataset.id),
  'export-csv': () => {
    const list = historyView.filteredTransactions(ctx).slice().reverse();
    download(`marketlab-simulated-transactions-day${ctx.state.day}.csv`, E.transactionsCsv(ctx.state, list), 'text/csv');
    toast('Downloaded simulated transactions', 'The file includes the simulation notice.', 'success');
  },
  'export-txt': () => {
    download(`marketlab-simulated-results-day${ctx.state.day}.txt`, E.resultsText(ctx.state), 'text/plain');
    toast('Downloaded simulated results', 'The file includes the simulation notice.', 'success');
  },
  'export-json': () => {
    download(`marketlab-simulated-results-day${ctx.state.day}.json`, JSON.stringify(E.resultsSummary(ctx.state), null, 2), 'application/json');
    toast('Downloaded simulated results', 'The file includes the simulation notice.', 'success');
  },
  'share-card': () => {
    ui.showShare = !ui.showShare;
    render();
  },
  'download-card': () => {
    drawShareCard(ctx.state).toBlob((blob) => {
      if (blob) download(`marketlab-share-card-day${ctx.state.day}.png`, blob, 'image/png');
    }, 'image/png');
  },
  'copy-share': () =>
    copyText(shareText(ctx.state)).then((ok) =>
      ok ? toast('Share text copied', 'It includes the full simulation notice.', 'success') : toast('Could not copy', 'Your browser blocked clipboard access.', 'error'),
    ),
};
const ACTIONS = Object.assign({}, ...Object.values(VIEWS).map((v) => v.actions || {}), GLOBAL_ACTIONS);

view.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el || !ctx.state) return;
  const fn = ACTIONS[el.dataset.action];
  if (fn) fn(ctx, el, e);
});
view.addEventListener('input', (e) => {
  if (!ctx.state) return;
  if (e.target.id === 'qty-input') return security.onQtyInput(ctx, $('#trade-form').dataset.id, e.target.value);
  for (const v of Object.values(VIEWS)) if (v.onInput && v.onInput(ctx, e.target)) return;
});
view.addEventListener('change', (e) => {
  if (!ctx.state) return;
  for (const v of Object.values(VIEWS)) if (v.onChange && v.onChange(ctx, e.target)) return;
});
view.addEventListener('submit', (e) => {
  if (!ctx.state) return;
  e.preventDefault();
  for (const v of Object.values(VIEWS)) if (v.onSubmit && v.onSubmit(ctx, e.target, e.submitter)) return;
});

$('#next-day').addEventListener('click', () => nextDay());
$('#autoplay').addEventListener('click', () => setAutoplay(!ui.autoplay));
$('#speed').addEventListener('change', (e) => {
  ui.speed = Number(e.target.value);
  if (ui.autoplay) setAutoplay(true);
});
window.addEventListener('hashchange', render);

// ---------- Reset / new game ----------

const resetDialog = $('#reset-dialog');
function openReset() {
  setAutoplay(false);
  resetDialog.returnValue = '';
  resetDialog.showModal();
}
$('#reset-btn').addEventListener('click', openReset);
resetDialog.addEventListener('close', () => {
  if (resetDialog.returnValue !== 'confirm') return;
  try {
    localStorage.removeItem(E.SAVE_KEY);
  } catch {
    /* storage unavailable; nothing to clear */
  }
  ctx.state = null;
  ui.route = null;
  ui.qty = {};
  view.innerHTML = '';
  if (location.hash && location.hash !== '#/') history.replaceState(null, '', '#/');
  updateHeader();
  showIntro();
  toast('Simulation reset', 'All simulated progress was erased.', 'info');
});

// ---------- Migration notice ----------

const migrateDialog = $('#migrate-dialog');
function showMigrationNotice() {
  const m = ctx.state.migratedFrom;
  $('#migrate-day').textContent = String(m.day);
  migrateDialog.showModal();
}
migrateDialog.addEventListener('close', () => {
  if (!ctx.state) return;
  ctx.state.migratedFrom.notice = false;
  save();
  if (migrateDialog.returnValue === 'reset') openReset();
});

// ---------- Intro ----------

function showIntro() {
  const intro = $('#intro');
  intro.hidden = false;
  intro.scrollTop = 0;
  appRoot.inert = true;
  $('#start-btn').focus({ preventScroll: true });
}
$('#start-btn').addEventListener('click', () => {
  ctx.state = E.createGame({ scenario: 'standard' });
  save();
  $('#intro').hidden = true;
  appRoot.inert = false;
  updateHeader();
  render();
  announce('Simulation started with $10,000 in virtual cash. Remember: everything here is fictional.');
});

// ---------- Boot ----------

const loaded = load();
ctx.state = loaded ? loaded.state : null;
updateHeader();
if (ctx.state) {
  render();
  if (loaded.migrated) save();
  $('#save-status').textContent = `Progress restored from this browser (Day ${ctx.state.day}).`;
  if (ctx.state.migratedFrom?.notice) showMigrationNotice();
} else {
  showIntro();
  if (!ui.storageOk) {
    const s = $('#save-status');
    s.textContent = 'Saving is unavailable in this browser. Progress will be lost when you leave.';
    s.classList.add('error');
  }
}
