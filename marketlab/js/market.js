// Market price formation. STAGE 1 (interim): a calm economy and correlated random price moves,
// with earnings reactions driven by the surprise versus consensus. Replaced in stage 2.
import { COMPANIES, SECTORS, SECTOR_KEYS } from './catalog.js';
import { YEAR_DAYS, clamp } from './constants.js';
import { gaussian } from './rng.js';
import { fairValue } from './fundamentals.js';

export function initMacro() {
  return { growth: 2.2, inflation: 2.5, rate: 3.25, rExp: 3.25, regime: 'expansion', regimeDays: 0 };
}
export function initMarket(state) {
  state.market = { factor: 0 };
  state.sectorF = Object.fromEntries(SECTOR_KEYS.map((k) => [k, 0]));
}

export function stepMacro(state) {
  const m = state.macro;
  m.growth += (2.2 - m.growth) * 0.01 + 0.03 * gaussian(state);
  m.inflation += (2.5 - m.inflation) * 0.01 + 0.02 * gaussian(state);
  m.regimeDays += 1;
}

/** Compute today's closing prices. `ctx.events` may contain earnings results. */
export function stepPrices(state, ctx) {
  const mkt = 0.0003 + 0.009 * gaussian(state);
  const sec = Object.fromEntries(SECTOR_KEYS.map((k) => [k, SECTORS[k].secVol * gaussian(state)]));
  const reaction = {};
  for (const e of ctx.events) if (e.type === 'earnings') reaction[e.id] = clamp(0.35 * e.result.quarter.surprisePct, -0.2, 0.2);
  for (const spec of COMPANIES) {
    const cs = state.companies[spec.id];
    const arr = state.prices[spec.id];
    const last = arr[arr.length - 1];
    const r = spec.beta * mkt + sec[spec.sector] + (spec.vol / Math.sqrt(YEAR_DAYS)) * gaussian(state) + (reaction[spec.id] || 0);
    const close = Math.max(1, Math.round(last * Math.exp(clamp(r, -0.5, 0.5))));
    arr.push(close);
    const vol = state.volumes[spec.id];
    vol.push(Math.round(cs.shares * 1e6 * spec.turnover * Math.exp(0.3 * gaussian(state)) * (reaction[spec.id] ? 2.5 : 1)));
  }
}

/** Align the price model with an externally set current price (used by save migration). */
export function syncModelToPrice() {
  // Stage 1: prices are a random walk from the latest close, so nothing to align.
}

/** After the burn-in, line each company's price history up with its fundamental fair value. */
export function finishBurnIn(state) {
  for (const spec of COMPANIES) {
    const cs = state.companies[spec.id];
    const arr = state.prices[spec.id];
    const factor = (fairValue(cs, spec, state.macro) * 100) / arr[arr.length - 1];
    state.prices[spec.id] = arr.map((p) => Math.max(1, Math.round(p * factor)));
  }
}

/** Plain-language label for the observable economy. */
export function economyLabel(macro) {
  if (macro.growth < 0) return { key: 'recession', label: 'Recession' };
  if (macro.inflation > 4.5) return { key: 'inflation', label: 'High inflation' };
  if (macro.growth < 1) return { key: 'slowdown', label: 'Slowdown' };
  if (macro.growth > 3.2) return { key: 'boom', label: 'Strong growth' };
  return { key: 'expansion', label: 'Expansion' };
}
