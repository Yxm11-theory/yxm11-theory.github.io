// Game creation and the daily loop.
import { COMPANIES, COMPANY_MAP, SCENARIOS } from './catalog.js';
import {
  SAVE_VERSION, STARTING_CASH_CENTS, PREHISTORY_DAYS, BURN_IN_QUARTERS, QUARTER_DAYS, MAX_NEWS, YEAR_DAYS,
} from './constants.js';
import { hashSeed, chance, gaussian } from './rng.js';
import { initCompanyState, dailyFundamentals, reportEarnings, fairValue, distressScore, consensus, interestCost } from './fundamentals.js';
import { initMacro, initMarket, initCompanyMarketState, stepMacro, stepPrices, declareBankruptcy, modelPrice, syncModelToPrice, PSI } from './market.js';
import { earningsNews } from './news.js';
import { currentPrice, previousPrice } from './securities.js';
import { portfolioSummary, checkChallenges } from './portfolio.js';
import { applyCorporateActions } from './trading.js';

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
    initCompanyMarketState(spec, cs);
    cs.nextEarnings += BURN_START;
    cs.shares = 1;
    cs.shares = fairValue(cs, spec, state.macro) / spec.price; // size shares so the price hint is fair
    // During the pre-game burn-in, margins hover around today's level so companies start Day 0 with
    // the profile described in the catalog (loss-making startups are still loss-making). Valuations
    // always use the true long-run target, so nothing jumps when the game starts.
    cs.marginAnchor = cs.opMargin;
    state.companies[spec.id] = cs;
    state.prices[spec.id] = [Math.max(1, Math.round(modelPrice(state, spec)))];
    state.volumes[spec.id] = [Math.round(cs.shares * 1e6 * spec.turnover)];
  });

  // Burn-in: simulate two years of business history so every company has reported quarters.
  while (state.day < 0) {
    state.day += 1;
    simulateDay(state, true);
  }
  for (const spec of COMPANIES) {
    const cs = state.companies[spec.id];
    delete cs.marginAnchor;
    // Loss-making companies have an uncertain path to profitability: their true long-run margin is
    // drawn around what investors believe (symmetrically, so there is no predictable direction).
    if (spec.margin < 0) cs.targetOp = cs.targetBelief + 0.12 * gaussian(state);
    // Start Day 0 with the catalog's balance sheet, scaled to the company's current size, and
    // re-align the price model so this bookkeeping causes no price jump on Day 1.
    const scale = cs.revRate / spec.revenue;
    cs.cash = spec.cash * scale;
    cs.debt = spec.debt * scale;
    cs.distress = distressScore(cs);
    // Restate the quarter in progress on the new balance sheet, then analysts update their estimate.
    // (only interest changes: operating results so far this quarter are kept as they happened).
    const newInt = (interestCost(cs) * cs.accum.days) / YEAR_DAYS;
    cs.accum.ni += (cs.accum.int || 0) - newInt;
    cs.accum.int = newInt;
    cs.est = consensus(state, cs, spec, state.macro);
    syncModelToPrice(state, spec.id);
  }
  for (const id of Object.keys(state.prices)) {
    state.prices[id] = state.prices[id].slice(-PREHISTORY_DAYS);
    state.volumes[id] = state.volumes[id].slice(-PREHISTORY_DAYS);
  }
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
    if (cs.status !== 'active') continue;
    if (state.day === cs.nextEarnings) {
      const before = fairValue(cs, spec, state.macro, 'reported', state.day - (cs.rep.day ?? state.day));
      const result = reportEarnings(state, cs, spec, state.macro, currentPrice(state, spec.id));
      cs._repJump = (1 - PSI) * Math.log(fairValue(cs, spec, state.macro, 'reported', 0) / before);
      ctx.events.push({ type: 'earnings', id: spec.id, result });
      // Margins start moving toward their long-run target two reports before the game starts,
      // so analysts' estimates (which assume that movement) stay unbiased from Day 1.
      if (state.day > -2 * QUARTER_DAYS) delete cs.marginAnchor;
      if (result.funding === 'crunch') failOrRescue(state, ctx, spec, quiet);
    } else if (cs.distress > 0.85 && chance(state, 0.003)) {
      failOrRescue(state, ctx, spec, quiet); // rare sudden failure of a deeply distressed company
    }
  }
  stepPrices(state, ctx, quiet);
  if (quiet) return { news: [], events: ctx.events };
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
  return { news: ctx.news, events: ctx.events };
}

/** A company that runs out of money fails during the game; during the pre-game burn-in it is rescued. */
function failOrRescue(state, ctx, spec, quiet) {
  const cs = state.companies[spec.id];
  if (quiet) {
    const injection = 0.3 * cs.revRate;
    cs.cash += injection;
    cs.debt = Math.max(0, cs.debt - injection);
    cs.distress *= 0.5;
    return;
  }
  declareBankruptcy(state, ctx, spec, quiet);
}

/** Advance one trading day: market moves and news are published together, then the account updates. */
export function advanceDay(state) {
  state.day += 1;
  const { news, events } = simulateDay(state, false);
  state.news.push(...news);
  // Corporate actions reach the account before any trading can happen today.
  const account = applyCorporateActions(state, events);
  if (state.news.length > MAX_NEWS) state.news.splice(0, state.news.length - MAX_NEWS);

  const summary = portfolioSummary(state);
  state.valueHistory.push({ day: state.day, value: summary.total });
  if (summary.total > state.stats.peakValue) state.stats.peakValue = summary.total;
  if (state.macro.growth < 0 && summary.positions.length > 0) state.stats.recessionDaysHeld += 1;
  const completed = checkChallenges(state);
  return { news, completed, fills: [], alerts: [], account };
}
