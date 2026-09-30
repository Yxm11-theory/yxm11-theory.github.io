// Trading: whole-share market orders against the latest close.
import { MAX_QTY, formatCents } from './constants.js';
import { securityById, currentPrice, isTradable } from './securities.js';
import { checkChallenges } from './portfolio.js';

export function parseQuantity(input) {
  const s = String(input ?? '').trim();
  if (s === '') return { ok: false, error: 'Enter how many shares to trade.' };
  if (!/^\d+$/.test(s)) return { ok: false, error: 'Use a whole number of shares — no decimals, letters, or negative numbers.' };
  const qty = Number(s);
  if (qty < 1) return { ok: false, error: 'Quantity must be at least 1 share.' };
  if (qty > MAX_QTY) return { ok: false, error: `Quantity can be at most ${MAX_QTY.toLocaleString('en-US')} shares per order.` };
  return { ok: true, qty };
}

export function sharesOwned(state, id) {
  return state.holdings[id]?.shares || 0;
}
export function availableCash(state) {
  return state.cash;
}
export function maxAffordable(state, id) {
  return Math.floor(availableCash(state) / currentPrice(state, id));
}

function recordTx(state, tx) {
  const full = { id: state.nextId++, day: state.day, realizedCents: 0, ...tx };
  state.transactions.push(full);
  return full;
}

export function buy(state, id, input) {
  const spec = securityById(id);
  if (!spec) return { ok: false, error: 'Unknown security.' };
  if (!isTradable(state, id)) return { ok: false, error: `${spec.ticker} is no longer listed and cannot be traded.` };
  const parsed = parseQuantity(input);
  if (!parsed.ok) return parsed;
  const qty = parsed.qty;
  const price = currentPrice(state, id);
  const total = price * qty;
  if (total > availableCash(state)) {
    const max = maxAffordable(state, id);
    return {
      ok: false,
      error: `Not enough virtual cash: ${qty.toLocaleString('en-US')} shares cost about ${formatCents(total)} but you have ${formatCents(availableCash(state))}. ` +
        (max > 0 ? `You can afford up to ${max.toLocaleString('en-US')} shares.` : 'You cannot afford a single share right now.'),
    };
  }
  state.cash -= total;
  const h = (state.holdings[id] ||= { shares: 0, costCents: 0 });
  h.shares += qty;
  h.costCents += total;
  state.stats.trades += 1;
  const tx = recordTx(state, { type: 'buy', secId: id, shares: qty, priceCents: price, totalCents: total, orderType: 'market' });
  return { ok: true, qty, price, total, tx, completed: checkChallenges(state) };
}

export function sell(state, id, input) {
  const spec = securityById(id);
  if (!spec) return { ok: false, error: 'Unknown security.' };
  const parsed = parseQuantity(input);
  if (!parsed.ok) return parsed;
  const qty = parsed.qty;
  const h = state.holdings[id];
  const owned = h?.shares || 0;
  if (owned === 0) return { ok: false, error: `You don't own any ${spec.ticker} shares to sell.` };
  if (qty > owned) return { ok: false, error: `You only own ${owned.toLocaleString('en-US')} ${spec.ticker} share${owned === 1 ? '' : 's'}, so you can't sell ${qty.toLocaleString('en-US')}.` };
  if (!isTradable(state, id)) return { ok: false, error: `${spec.ticker} is no longer listed and cannot be traded.` };
  const price = currentPrice(state, id);
  const total = price * qty;
  const costRemoved = qty === owned ? h.costCents : Math.round((h.costCents * qty) / owned); // average-cost method
  const realized = total - costRemoved;
  h.shares -= qty;
  h.costCents -= costRemoved;
  if (h.shares === 0) delete state.holdings[id];
  state.cash += total;
  state.stats.realized += realized;
  if (realized > 0) state.stats.profitableSales += 1;
  state.stats.trades += 1;
  const tx = recordTx(state, { type: 'sell', secId: id, shares: qty, priceCents: price, totalCents: total, realizedCents: realized, orderType: 'market' });
  return { ok: true, qty, price, total, realized, tx, completed: checkChallenges(state) };
}
