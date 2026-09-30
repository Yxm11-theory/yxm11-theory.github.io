// Game creation and the daily loop.
import { COMPANIES, COMPANY_MAP, SCENARIOS } from './catalog.js';
import {
  SAVE_VERSION, STARTING_CASH_CENTS, PREHISTORY_DAYS, BURN_IN_QUARTERS, QUARTER_DAYS, MAX_NEWS,
} from './constants.js';
import { hashSeed } from './rng.js';
import { initCompanyState, dailyFundamentals, reportEarnings, fairValue } from './fundamentals.js';
import { initMacro, initMarket, stepMacro, stepPrices, finishBurnIn } from './market.js';
import { earningsNews } from './news.js';
import { currentPrice, previousPrice } from './securities.js';
import { portfolioSummary, checkChallenges } from './portfolio.js';

const BURN_START = -(BURN_IN_QUARTERS * QUARTER_DAYS + 5);

export function randomSeedText() {
  return Math.random().toString(36).slice(2, 8);
}

/**
 * Create a new game. The same scenario + seed always produces the same market.
 * options: { scenario: 'standard' | 'recession' | 'inflation' | 'techboom', seed: string }
 */
export function createGame(options = {}) {
  const scenario = SCENARIOS[options.scenario] ? options.scenario : 'standard';
  const seed = String(options.seed ?? SCENARIOS[scenario].defaultSeed ?? randomSeedText()).trim() || randomSeedText();
  const state = {
    version: SAVE_VERSION,
    scenario,
    seed,
    rng: hashSeed(`${scenario}:${seed}`),
    day: BURN_START,
    cash: STARTING_CASH_CENTS,
    holdings: {},
    companies: {},
    prices: {},
    volumes: {},
    macro: initMacro(),
    news: [],
    transactions: [],
    orders: [],
    alerts: [],
    watchlists: [{ id: 'w1', name: 'My watchlist', ids: ['nmbw', 'cstb', 'glwr'] }],
    activeWatchlist: 'w1',
    valueHistory: [],
    challenges: {},
    stats: { trades: 0, realized: 0, profitableSales: 0, peakValue: STARTING_CASH_CENTS, recessionDaysHeld: 0, dividends: 0, execCosts: 0, limitFills: 0 },
    startDay: 0,
    nextId: 1,
    createdAt: Date.now(),
  };
  initMarket(state);
  COMPANIES.forEach((spec, i) => {
    const cs = initCompanyState(spec, state.macro, i);
    cs.nextEarnings += BURN_START;
    cs.shares = 1;
    cs.shares = fairValue(cs, spec, state.macro) / spec.price; // size shares so the price hint is fair
    state.companies[spec.id] = cs;
    state.prices[spec.id] = [Math.round(spec.price * 100)];
    state.volumes[spec.id] = [Math.round(cs.shares * 1e6 * spec.turnover)];
  });

  // Burn-in: simulate two years of business history so every company has reported quarters.
  while (state.day < 0) {
    state.day += 1;
    simulateDay(state, true);
  }
  for (const id of Object.keys(state.prices)) {
    state.prices[id] = state.prices[id].slice(-PREHISTORY_DAYS);
    state.volumes[id] = state.volumes[id].slice(-PREHISTORY_DAYS);
  }
  finishBurnIn(state);
  state.valueHistory.push({ day: 0, value: STARTING_CASH_CENTS });
  return state;
}

/** Everything that happens in the market on one day. Returns the day's news. */
function simulateDay(state, quiet) {
  const ctx = { events: [], news: [] };
  stepMacro(state, ctx, quiet);
  for (const spec of COMPANIES) dailyFundamentals(state, state.companies[spec.id], spec, state.macro);
  for (const spec of COMPANIES) {
    const cs = state.companies[spec.id];
    if (cs.status === 'active' && state.day === cs.nextEarnings) {
      const result = reportEarnings(state, cs, spec, state.macro, currentPrice(state, spec.id));
      ctx.events.push({ type: 'earnings', id: spec.id, result });
    }
  }
  stepPrices(state, ctx, quiet);
  if (quiet) return [];
  for (const e of ctx.events) {
    if (e.type === 'earnings') ctx.news.push(earningsNews(state, COMPANY_MAP[e.id], e.result));
  }
  // Attach the same-day price reaction to company news.
  for (const n of ctx.news) {
    if (n.companyIds.length === 1 && n.impact == null) {
      const id = n.companyIds[0];
      n.impact = currentPrice(state, id) / previousPrice(state, id) - 1;
    }
  }
  return ctx.news;
}

/** Advance one trading day: market moves and news are published together, then the account updates. */
export function advanceDay(state) {
  state.day += 1;
  const news = simulateDay(state, false);
  state.news.push(...news);
  if (state.news.length > MAX_NEWS) state.news.splice(0, state.news.length - MAX_NEWS);

  const summary = portfolioSummary(state);
  state.valueHistory.push({ day: state.day, value: summary.total });
  if (summary.total > state.stats.peakValue) state.stats.peakValue = summary.total;
  if (state.macro.growth < 0 && summary.positions.length > 0) state.stats.recessionDaysHeld += 1;
  const completed = checkChallenges(state);
  return { news, completed, fills: [], alerts: [], account: [] };
}
