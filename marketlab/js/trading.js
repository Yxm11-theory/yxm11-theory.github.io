// Trading: quotes, execution costs, whole-share market orders, and corporate actions on the account.
//
// Execution model (simplified):
//  • Every security has a bid and an ask around its latest price (the "mid"). The spread is wider for
//    small, volatile companies. Buyers pay the ask; sellers receive the bid.
//  • Larger orders move the price against you (slippage), growing with the square root of the order's
//    share of typical daily volume. Orders above 10% of typical daily volume are refused.
//  • There are no commissions. Execution costs (spread + slippage) are included in your cost basis.
import { MAX_QTY, formatCents } from './constants.js';
import { securityById, currentPrice, isTradable, isFund, averageVolume } from './securities.js';
import { checkChallenges } from './portfolio.js';

export const MAX_PARTICIPATION = 0.1;
const IMPACT_COEF = 0.3;

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

/** Cash not reserved by open buy orders. */
export function availableCash(state) {
  return state.cash - reservedCash(state);
}
export function reservedCash(state) {
  return (state.orders || []).filter((o) => o.side === 'buy').reduce((a, o) => a + o.reserve, 0);
}
/** Shares not already promised to open sell orders. */
export function availableShares(state, id) {
  const pending = (state.orders || []).filter((o) => o.side === 'sell' && o.secId === id).reduce((a, o) => a + o.qty, 0);
  return sharesOwned(state, id) - pending;
}

export function spreadBps(state, id) {
  if (isFund(id)) return 2;
  return state.companies[id]?.spreadBps ?? 10;
}
export function dailyVol(state, id) {
  if (isFund(id)) return state.fundState?.[id]?.sigmaD ?? 0.008;
  return state.companies[id]?.sigmaD ?? 0.02;
}
export function typicalVolume(state, id) {
  return Math.max(1, averageVolume(state, id, 20));
}

/** Bid/ask quote around a mid price (defaults to the latest close). */
export function quote(state, id, mid = currentPrice(state, id)) {
  const half = (mid * spreadBps(state, id)) / 20000;
  const bid = Math.max(1, Math.floor(mid - half));
  let ask = Math.ceil(mid + half);
  if (ask <= bid) ask = bid + 1;
  return { mid, bid, ask, spreadBps: spreadBps(state, id) };
}

/** Price impact (fraction) of trading `qty` shares. Funds track their holdings closely and have none. */
export function impact(state, id, qty) {
  if (isFund(id)) return 0;
  return IMPACT_COEF * dailyVol(state, id) * Math.sqrt(qty / typicalVolume(state, id));
}

/** Estimated fill for a market order at the given mid price, with a cost breakdown in cents. */
export function estimateMarketFill(state, id, side, qty, mid) {
  const q = quote(state, id, mid);
  const imp = impact(state, id, qty);
  const fill = side === 'buy' ? Math.ceil(q.ask * (1 + imp)) : Math.max(1, Math.floor(q.bid * (1 - imp)));
  const touch = side === 'buy' ? q.ask : q.bid;
  const spreadCost = Math.abs(touch - q.mid) * qty;
  const slippage = Math.abs(fill - touch) * qty;
  return { ...q, impact: imp, fill, total: fill * qty, spreadCost, slippage, costs: spreadCost + slippage };
}

export function participationError(state, id, qty) {
  if (isFund(id)) return null;
  const adv = typicalVolume(state, id);
  if (qty > MAX_PARTICIPATION * adv) {
    return `That order is too large for this simulated market: ${qty.toLocaleString('en-US')} shares is more than 10% of typical daily volume (${Math.round(adv).toLocaleString('en-US')} shares). Try a smaller order.`;
  }
  return null;
}

export function maxAffordable(state, id) {
  const cash = availableCash(state);
  let qty = Math.floor(cash / quote(state, id).ask);
  while (qty > 0 && estimateMarketFill(state, id, 'buy', qty).total > cash) qty -= Math.max(1, Math.ceil(qty * 0.002));
  return Math.max(0, qty);
}

function recordTx(state, tx) {
  const full = { id: state.nextId++, day: state.day, realizedCents: 0, ...tx };
  state.transactions.push(full);
  return full;
}

/** Add bought shares to a holding. `total` includes execution costs (they are part of cost basis). */
export function addShares(state, id, qty, total) {
  const h = (state.holdings[id] ||= { shares: 0, costCents: 0 });
  h.shares += qty;
  h.costCents += total;
}
/** Remove sold shares using the average-cost method; returns the realized gain. */
export function removeShares(state, id, qty, proceeds) {
  const h = state.holdings[id];
  const costRemoved = qty === h.shares ? h.costCents : Math.round((h.costCents * qty) / h.shares);
  h.shares -= qty;
  h.costCents -= costRemoved;
  if (h.shares === 0) delete state.holdings[id];
  const realized = proceeds - costRemoved;
  state.stats.realized += realized;
  if (realized > 0) state.stats.profitableSales += 1;
  return realized;
}

export function validateOrder(state, id, side, input) {
  const spec = securityById(id);
  if (!spec) return { ok: false, error: 'Unknown security.' };
  const parsed = parseQuantity(input);
  if (!parsed.ok) return parsed;
  const qty = parsed.qty;
  if (side === 'sell') {
    const owned = sharesOwned(state, id);
    if (owned === 0) return { ok: false, error: `You don't own any ${spec.ticker} shares to sell.` };
    const avail = availableShares(state, id);
    if (qty > avail) {
      return {
        ok: false,
        error: avail < owned
          ? `You can only sell ${avail.toLocaleString('en-US')} ${spec.ticker} shares; the rest are already reserved by your open sell orders.`
          : `You only own ${owned.toLocaleString('en-US')} ${spec.ticker} share${owned === 1 ? '' : 's'}, so you can't sell ${qty.toLocaleString('en-US')}.`,
      };
    }
  }
  if (!isTradable(state, id)) return { ok: false, error: `${spec.ticker} is no longer listed and cannot be traded.` };
  const big = participationError(state, id, qty);
  if (big) return { ok: false, error: big };
  return { ok: true, qty, spec };
}

/** Execute a market order immediately at the current quote. */
export function marketOrder(state, id, side, input) {
  const v = validateOrder(state, id, side, input);
  if (!v.ok) return v;
  const { qty, spec } = v;
  const est = estimateMarketFill(state, id, side, qty);
  if (side === 'buy' && est.total > availableCash(state)) {
    const max = maxAffordable(state, id);
    return {
      ok: false,
      error:
        `Not enough virtual cash: ${qty.toLocaleString('en-US')} shares cost about ${formatCents(est.total)} including execution costs, but you have ${formatCents(availableCash(state))} available. ` +
        (max > 0 ? `You can afford up to ${max.toLocaleString('en-US')} shares.` : 'You cannot afford a single share right now.'),
    };
  }
  return executeFill(state, { secId: id, side, qty, price: est.fill, costs: est.costs, orderType: 'market', spec, quoteNote: `bid ${formatCents(est.bid)} / ask ${formatCents(est.ask)}` });
}

/** Book a fill to the account. Used for market orders and for triggered limit/stop orders. */
export function executeFill(state, { secId, side, qty, price, costs, orderType, spec, quoteNote = '', orderId = null }) {
  const total = price * qty;
  let realized = 0;
  if (side === 'buy') {
    state.cash -= total;
    addShares(state, secId, qty, total);
  } else {
    state.cash += total;
    realized = removeShares(state, secId, qty, total);
  }
  state.stats.trades += 1;
  state.stats.execCosts += costs;
  if (orderType === 'limit') state.stats.limitFills += 1;
  const tx = recordTx(state, {
    type: side, secId, shares: qty, priceCents: price, totalCents: total, costCents: costs, realizedCents: realized, orderType, orderId,
    note: quoteNote,
  });
  return { ok: true, qty, price, total, costs, realized, tx, spec: spec || securityById(secId), completed: checkChallenges(state) };
}

export const buy = (state, id, input) => marketOrder(state, id, 'buy', input);
export const sell = (state, id, input) => marketOrder(state, id, 'sell', input);

/**
 * Apply the day's corporate actions to the account, before any order can trade:
 * splits multiply shares (cost basis unchanged), dividends pay cash for shares held at the previous
 * close, and bankruptcies write holdings off. Returns messages for the player.
 */
export function applyCorporateActions(state, events) {
  const msgs = [];
  const order = { split: 0, exdiv: 1, bankruptcy: 2 };
  for (const e of [...events].filter((x) => x.type in order).sort((a, b) => order[a.type] - order[b.type])) {
    const spec = securityById(e.id);
    const h = state.holdings[e.id];
    if (e.type === 'split') {
      for (const o of state.orders || []) {
        if (o.secId !== e.id) continue;
        o.qty *= e.ratio;
        if (o.limit) o.limit = Math.max(1, Math.round(o.limit / e.ratio));
        if (o.stop) o.stop = Math.max(1, Math.round(o.stop / e.ratio));
        if (o.side === 'buy') o.reserve = o.reserve; // same money reserved
      }
      for (const a of state.alerts || []) if (a.secId === e.id && !a.triggeredDay) a.price = Math.max(1, Math.round(a.price / e.ratio));
      if (h && h.shares > 0) {
        const before = h.shares;
        h.shares *= e.ratio;
        recordTx(state, { type: 'split', secId: e.id, shares: h.shares, note: `${e.ratio}-for-1 split: ${before.toLocaleString('en-US')} → ${h.shares.toLocaleString('en-US')} shares. Cost basis unchanged.` });
        msgs.push({ title: `${spec.ticker} split ${e.ratio}-for-1`, body: `You now own ${h.shares.toLocaleString('en-US')} shares at 1/${e.ratio} of the price. Your total value is unchanged.`, type: 'info' });
      }
    } else if (e.type === 'exdiv' && h && h.shares > 0) {
      const amount = Math.round(h.shares * e.dps);
      if (amount > 0) {
        state.cash += amount;
        state.stats.dividends += amount;
        recordTx(state, { type: 'dividend', secId: e.id, shares: h.shares, priceCents: Math.round(e.dps), totalCents: amount, note: `${(e.dps / 100).toFixed(2)} per share` });
        msgs.push({ title: `Dividend received: ${formatCents(amount)}`, body: `${spec.name} paid ${formatCents(Math.round(e.dps))} per share on your ${h.shares.toLocaleString('en-US')} shares (virtual cash).`, type: 'success' });
      }
    } else if (e.type === 'bankruptcy') {
      state.orders = (state.orders || []).filter((o) => {
        if (o.secId !== e.id) return true;
        recordTx(state, { type: 'order', secId: e.id, shares: o.qty, orderType: o.type, orderId: o.id, note: `${o.side === 'buy' ? 'Buy' : 'Sell'} ${o.type} order canceled: company went bankrupt.` });
        return false;
      });
      if (h && h.shares > 0) {
        const shares = h.shares;
        const cost = h.costCents;
        delete state.holdings[e.id];
        state.stats.realized -= cost;
        recordTx(state, { type: 'bankruptcy', secId: e.id, shares, priceCents: 0, totalCents: 0, realizedCents: -cost, note: 'Shares written off after bankruptcy.' });
        msgs.push({ title: `${spec.ticker} went bankrupt`, body: `Your ${shares.toLocaleString('en-US')} shares were written off: a realized simulated loss of ${formatCents(cost)}.`, type: 'error' });
      }
    }
  }
  return msgs;
}
