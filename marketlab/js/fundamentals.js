// Company fundamentals: a simplified business model per fictional company.
//
// Each company has "true" fundamentals that evolve daily (revenue run-rate, margins, cash, debt)
// and "reported" fundamentals that only update at quarterly earnings. Analysts' consensus estimates
// are formed from reported information, so earnings surprises are genuinely uncertain.
import { SECTORS } from './catalog.js';
import { QUARTER_DAYS, YEAR_DAYS, clamp } from './constants.js';
import { gaussian } from './rng.js';

const BASE_SPREAD = 1.5; // credit spread over the policy rate, percentage points

export function creditSpread(cs) {
  return BASE_SPREAD + 10 * (cs.distress || 0);
}

/** Interest cost per year in millions at the given rate. */
export function interestCost(cs, rate) {
  return (cs.debt * (rate + creditSpread(cs))) / 100;
}

/** Operating margin after the current economy's effects (growth, inflation, rates). */
export function effectiveMargin(cs, spec, macro) {
  const s = SECTORS[spec.sector];
  return (
    cs.opMargin +
    (s.marginCyc * (macro.growth - 2)) / 100 +
    (s.inflMargin * (macro.inflation - 2.5)) / 100 +
    (s.rateMargin * (macro.rate - 3.25)) / 100
  );
}

/** Annual revenue growth implied by the company trend and the current economy. */
export function revenueGrowth(cs, spec, macro) {
  const s = SECTORS[spec.sector];
  return cs.trend + cs.gShock + (s.cyc * (macro.growth - 2) * 1.5) / 100 + (s.inflRev * (macro.inflation - 2.5)) / 100;
}

export function initCompanyState(spec, macro, index) {
  const interest = (spec.debt * (macro.rate + BASE_SPREAD)) / 100;
  const opMargin = spec.margin + interest / spec.revenue;
  return {
    status: 'active',
    shares: 100, // millions; sized to the price hint when the game is created
    revRate: spec.revenue,
    opMargin,
    targetOp: spec.targetMargin + interest / spec.revenue,
    trend: spec.growth,
    gShock: 0,
    debt: spec.debt,
    debtRatio: spec.debt / spec.revenue,
    cash: spec.cash,
    distress: 0,
    accum: { rev: 0, ni: 0, days: 0 },
    quarters: [],
    rep: { rev: spec.revenue, opMargin, yoy: spec.growth, growthAtReport: macro.growth, inflAtReport: macro.inflation, rateAtReport: macro.rate },
    est: null,
    nextEarnings: ((index * 17) % QUARTER_DAYS) + 1, // staggered reporting calendar (relative to start)
    dps: 0,
    exDay: null,
    lastExDay: null,
    dividends: [],
    splits: [],
    quarterNo: 0,
  };
}

/** One trading day of business activity (hidden from the market until reported). */
export function dailyFundamentals(state, cs, spec, macro) {
  if (cs.status !== 'active') return;
  const g = revenueGrowth(cs, spec, macro);
  cs.revRate *= Math.exp(g / YEAR_DAYS + 0.004 * gaussian(state));
  cs.opMargin = clamp(cs.opMargin + (cs.targetOp - cs.opMargin) / 300 + 0.0012 * gaussian(state), -1.5, 0.7);
  cs.gShock *= 0.998;
  cs.trend += (0.035 - cs.trend) / 2000;
  const m = effectiveMargin(cs, spec, macro);
  cs.accum.rev += cs.revRate / YEAR_DAYS;
  cs.accum.ni += (cs.revRate * m - interestCost(cs, macro.rate)) / YEAR_DAYS;
  cs.accum.days += 1;
}

export function ttm(cs, key, offset = 0) {
  const qs = cs.quarters.slice(Math.max(0, cs.quarters.length - 4 - offset), cs.quarters.length - offset);
  if (qs.length < 4) return null;
  return qs.reduce((a, q) => a + q[key], 0);
}

/** Consensus estimate (cents per share) for the next quarter, from reported information only. */
function consensus(state, cs, spec, macro) {
  const s = SECTORS[spec.sector];
  const growth = clamp(0.5 * cs.trend + 0.5 * cs.rep.yoy + (s.cyc * (macro.growth - 2) * 1.5) / 100, -0.3, 0.6);
  // Analysts extrapolate from the latest quarter (not the lagging 12-month average).
  const revNext = cs.rep.lastRev * Math.pow(1 + growth, 0.25);
  const marginNext =
    cs.rep.lastOpMargin +
    (cs.targetOp - cs.rep.lastOpMargin) * (1 - Math.pow(1 - 1 / 300, QUARTER_DAYS)) +
    (s.marginCyc * (macro.growth - 2) + s.inflMargin * (macro.inflation - 2.5) + s.rateMargin * (macro.rate - 3.25)) / 100 -
    (s.marginCyc * (cs.rep.growthAtReport - 2) + s.inflMargin * (cs.rep.inflAtReport - 2.5) + s.rateMargin * (cs.rep.rateAtReport - 3.25)) / 100;
  const niNext = revNext * marginNext - interestCost(cs, macro.rate) / 4;
  const est = (niNext / cs.shares) * 100;
  return est + gaussian(state) * (0.03 * Math.abs(est) + 0.3); // analysts disagree a little
}

export function quarterLabel(cs) {
  const n = cs.quarterNo;
  return `Q${((n - 1) % 4) + 1} FY${Math.floor((n - 1) / 4) + 1}`;
}

/**
 * Publish quarterly results. Returns details used for news, pricing, and dividends.
 * `funding` is 'ok', 'borrowed', 'equity', or 'crunch' (cash ran out and could not be raised).
 */
export function reportEarnings(state, cs, spec, macro, priceCents) {
  // A partial first quarter (from the start of the simulation) is scaled to a full quarter.
  const scale = cs.accum.days > 0 && cs.accum.days < QUARTER_DAYS ? QUARTER_DAYS / cs.accum.days : 1;
  const revQ = cs.accum.rev * scale;
  const niQ = cs.accum.ni * scale;
  const eps = (niQ / cs.shares) * 100;
  const est = cs.est;
  cs.quarterNo += 1;
  const q = {
    day: state.day,
    label: quarterLabel(cs),
    revenue: revQ,
    netIncome: niQ,
    eps,
    est,
    surprise: est == null ? 0 : eps - est,
    surprisePct: est == null ? 0 : clamp((eps - est) / Math.max(Math.abs(est), 1), -2, 2),
  };
  cs.quarters.push(q);
  if (cs.quarters.length > 24) cs.quarters.shift();

  // Reported fundamentals used by analysts and the valuation model.
  const revTTM = ttm(cs, 'revenue') ?? revQ * 4;
  const niTTM = ttm(cs, 'netIncome') ?? niQ * 4;
  const prevRev = ttm(cs, 'revenue', 4);
  cs.rep = {
    rev: revTTM,
    opMargin: (niTTM + interestCost(cs, macro.rate)) / revTTM,
    yoy: prevRev ? clamp(revTTM / prevRev - 1, -0.5, 1) : cs.trend,
    lastRev: revQ,
    lastOpMargin: (niQ + interestCost(cs, macro.rate) / 4) / revQ,
    growthAtReport: macro.growth,
    inflAtReport: macro.inflation,
    rateAtReport: macro.rate,
  };

  // Cash flow: part of profit is reinvested; losses burn cash in full; dividends are paid out.
  const divPaid = (cs.dps * cs.shares) / 100;
  cs.cash += (niQ > 0 ? niQ * 0.75 : niQ) - divPaid;
  let funding = 'ok';
  let raised = 0;
  const minCash = 0.03 * cs.revRate;
  if (cs.cash < minCash) {
    const need = minCash * 1.5 - cs.cash;
    const ebit = cs.revRate * Math.max(cs.opMargin, 0);
    const capacity = Math.max(0, 5 * ebit + 0.25 * cs.revRate) - cs.debt;
    const mcap = (priceCents / 100) * cs.shares;
    if (capacity >= need) {
      cs.debt += need;
      cs.cash += need;
      funding = 'borrowed';
      raised = need;
    } else if (priceCents >= 100 && mcap > need * 4) {
      cs.shares += need / (priceCents / 100); // sell new shares (dilution)
      cs.cash += need;
      funding = 'equity';
      raised = need;
    } else {
      funding = 'crunch';
    }
  } else if (cs.cash > 0.2 * cs.revRate && cs.debt > cs.debtRatio * cs.revRate * 1.1) {
    // Only pay down debt above the company's own preferred leverage.
    const pay = Math.min(cs.debt - cs.debtRatio * cs.revRate, (cs.cash - 0.2 * cs.revRate) * 0.5);
    cs.debt -= pay;
    cs.cash -= pay;
  }

  // Dividend policy: aim for payout × trailing earnings, raise gradually, cut when earnings collapse.
  let dividendChange = null;
  const epsTTM = ttm(cs, 'eps') ?? eps * 4;
  if (spec.payout > 0 && funding !== 'crunch') {
    const target = Math.max(0, (spec.payout * epsTTM) / 4);
    const old = cs.dps;
    if (old === 0 && target >= 1) {
      cs.dps = Math.round(target);
      dividendChange = 'initiated';
    } else if (old > 0 && (target < old * 0.5 || funding === 'equity')) {
      cs.dps = target >= 1 && funding !== 'equity' ? Math.round(target) : 0;
      dividendChange = cs.dps === 0 ? 'suspended' : 'cut';
    } else if (old > 0 && target > old * 1.03) {
      cs.dps = Math.max(old + 1, Math.round(Math.min(target, old * 1.1)));
      dividendChange = 'raised';
    }
  } else if (cs.dps > 0 && funding === 'crunch') {
    cs.dps = 0;
    dividendChange = 'suspended';
  }
  cs.exDay = cs.dps > 0 ? state.day + 12 : null;

  cs.est = consensus(state, cs, spec, macro);
  cs.nextEarnings = state.day + QUARTER_DAYS;
  cs.accum = { rev: 0, ni: 0, days: 0 };
  return { quarter: q, funding, raised, dividendChange };
}

/**
 * Fair value per share (virtual dollars) from fundamentals and the economy.
 * source 'reported' uses the latest quarterly report; 'true' uses today's hidden business state.
 */
export function fairValue(cs, spec, macro, source = 'reported') {
  const s = SECTORS[spec.sector];
  const rev = source === 'true' ? cs.revRate : cs.rep.rev;
  const baseMargin = source === 'true' ? cs.opMargin : cs.rep.opMargin;
  const growth = clamp(
    0.5 * cs.trend + 0.5 * (source === 'true' ? cs.trend + cs.gShock : cs.rep.yoy) + (s.cyc * (macro.growth - 2) * 1.5) / 100,
    -0.2,
    0.5,
  );
  const margin =
    baseMargin +
    (s.marginCyc * (macro.growth - 2)) / 100 / 2 +
    (s.inflMargin * (macro.inflation - 2.5)) / 100 / 2 +
    (s.rateMargin * (macro.rExp - 3.25)) / 100;
  const w = clamp(0.4 + 2 * growth, 0.4, 0.9); // fast growers are valued on long-run margins
  const normMargin = (1 - w) * margin + w * cs.targetOp;
  const fwd = rev * (1 + growth) * normMargin - (cs.debt * (macro.rExp + creditSpread(cs))) / 100;
  const pe = s.pe * clamp(Math.exp(4 * (growth - 0.05)), 0.5, 2.5) * Math.exp(-s.duration * (macro.rExp - 3.25) * 0.08);
  const equity = Math.max(fwd > 0 ? fwd * pe : 0, rev * 0.2);
  return equity / cs.shares;
}

/** Distress score 0–1 from losses, cash runway, and leverage (public information). */
export function distressScore(cs, macro) {
  const ebit = cs.revRate * cs.opMargin;
  const ni = ebit - interestCost(cs, macro.rate);
  const runway = ni < 0 ? cs.cash / -ni : Infinity;
  const lev = cs.debt / Math.max(ebit, 0.01 * cs.revRate);
  return clamp(Math.max((1.25 - runway) / 1.25, (lev - 8) / 12), 0, 0.97);
}

/** Display metrics from reported results. */
export function companyMetrics(cs, spec, priceCents) {
  const price = priceCents / 100;
  const epsTTM = ttm(cs, 'eps');
  const revTTM = ttm(cs, 'revenue');
  const niTTM = ttm(cs, 'netIncome');
  const mcap = price * cs.shares;
  const annualDiv = (cs.dps * 4) / 100;
  return {
    marketCap: mcap,
    revenueTTM: revTTM,
    netIncomeTTM: niTTM,
    epsTTM: epsTTM == null ? null : epsTTM / 100,
    pe: epsTTM && epsTTM > 0 ? price / (epsTTM / 100) : null,
    netMargin: revTTM ? niTTM / revTTM : null,
    revenueGrowth: cs.rep.yoy,
    debt: cs.debt,
    cash: cs.cash,
    netDebt: cs.debt - cs.cash,
    annualDividend: annualDiv,
    dividendYield: price > 0 ? annualDiv / price : 0,
    payoutRatio: epsTTM && epsTTM > 0 ? (cs.dps * 4) / epsTTM : null,
    growthTrend: cs.trend,
  };
}

/**
 * Multiply the share count by `factor` and divide every per-share figure by it.
 * Used for stock splits (factor = split ratio) and for unit rescaling during save migration.
 */
export function scalePerShare(cs, factor) {
  cs.shares *= factor;
  for (const q of cs.quarters) {
    q.eps /= factor;
    if (q.est != null) q.est /= factor;
  }
  if (cs.est != null) cs.est /= factor;
  cs.dps /= factor;
  for (const d of cs.dividends) d.dps /= factor;
}
