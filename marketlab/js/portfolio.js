// Portfolio valuation, analytics, and challenges.
import { STARTING_CASH_CENTS } from './constants.js';
import { securityById, currentPrice, isFund } from './securities.js';

export function portfolioSummary(state) {
  const positions = [];
  let holdingsValue = 0;
  let unrealized = 0;
  for (const [id, h] of Object.entries(state.holdings)) {
    if (!h || h.shares <= 0) continue;
    const spec = securityById(id);
    const price = currentPrice(state, id);
    const value = price * h.shares;
    const gain = value - h.costCents;
    holdingsValue += value;
    unrealized += gain;
    positions.push({
      id,
      spec,
      shares: h.shares,
      costCents: h.costCents,
      avgCents: h.costCents / h.shares,
      priceCents: price,
      valueCents: value,
      unrealizedCents: gain,
      unrealizedPct: h.costCents > 0 ? gain / h.costCents : 0,
    });
  }
  positions.sort((a, b) => b.valueCents - a.valueCents);
  const total = state.cash + holdingsValue;
  for (const p of positions) p.weight = total > 0 ? p.valueCents / total : 0;
  return {
    cash: state.cash,
    holdingsValue,
    total,
    gain: total - STARTING_CASH_CENTS,
    gainPct: (total - STARTING_CASH_CENTS) / STARTING_CASH_CENTS,
    unrealized,
    realized: state.stats.realized,
    dividends: state.stats.dividends,
    execCosts: state.stats.execCosts,
    positions,
  };
}

export function sectorsHeld(state) {
  const set = new Set();
  for (const [id, h] of Object.entries(state.holdings)) {
    if (h.shares > 0 && !isFund(id)) set.add(securityById(id)?.sector);
  }
  return set.size;
}

/** Largest peak-to-trough fall of a value series, as a positive fraction. */
export function maxDrawdown(values) {
  let peak = -Infinity;
  let worst = 0;
  for (const v of values) {
    if (v > peak) peak = v;
    if (peak > 0) worst = Math.max(worst, (peak - v) / peak);
  }
  return worst;
}

export const CHALLENGES = [
  { id: 'first-trade', title: 'Opening move', description: 'Complete your first simulated trade.', target: 1, progress: (s) => s.stats.trades },
  { id: 'diversify', title: 'Spread the risk', description: 'Hold shares in at least 3 different sectors at the same time.', target: 3, progress: (s) => sectorsHeld(s) },
  { id: 'realized-gain', title: 'Lock it in', description: 'Sell shares for more than you paid (a realized simulated gain).', target: 1, progress: (s) => s.stats.profitableSales },
  { id: 'dividend', title: 'Paid to wait', description: 'Receive your first simulated dividend.', target: 1, progress: (s) => (s.stats.dividends > 0 ? 1 : 0) },
  { id: 'value-12k', title: 'Growth spurt', description: 'Reach $12,000 in total virtual value.', target: 1_200_000, money: true, progress: (s) => s.stats.peakValue },
  { id: 'days-30', title: 'Thirty-day run', description: 'Complete 30 trading days.', target: 30, progress: (s) => s.day },
  { id: 'limit-fill', title: 'Patient buyer', description: 'Have a limit order filled.', target: 1, progress: (s) => s.stats.limitFills },
  { id: 'storm', title: 'Storm watcher', description: 'Hold shares through a day of simulated recession (negative economic growth).', target: 1, progress: (s) => s.stats.recessionDaysHeld },
  { id: 'all-five', title: 'Five sectors', description: 'Hold shares in five different sectors at once.', target: 5, progress: (s) => sectorsHeld(s) },
  { id: 'trades-25', title: 'Active trader', description: 'Complete 25 simulated trades.', target: 25, progress: (s) => s.stats.trades },
  { id: 'value-20k', title: 'Double up', description: 'Reach $20,000 in total virtual value.', target: 2_000_000, money: true, progress: (s) => s.stats.peakValue },
  { id: 'days-100', title: 'The long haul', description: 'Complete 100 trading days.', target: 100, progress: (s) => s.day },
  { id: 'days-252', title: 'A full simulated year', description: 'Complete 252 trading days.', target: 252, progress: (s) => s.day },
];

export function checkChallenges(state) {
  const completed = [];
  for (const ch of CHALLENGES) {
    if (state.challenges[ch.id]) continue;
    if (ch.progress(state) >= ch.target) {
      state.challenges[ch.id] = { day: state.day };
      completed.push(ch);
    }
  }
  return completed;
}
