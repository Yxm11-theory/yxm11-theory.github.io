// Company fundamentals: a simplified business model per fictional company.
//
// Each company has "true" fundamentals that evolve daily (revenue run-rate, margins, cash, debt)
// and "reported" fundamentals that only update at quarterly earnings. Analysts' consensus estimates
// are formed from reported information, so earnings surprises are genuinely uncertain.
import { SECTORS } from './catalog.js';
import { QUARTER_DAYS, YEAR_DAYS, clamp } from './constants.js';
import { gaussian, random } from './rng.js';

const BASE_SPREAD = 1.5; // credit spread over the policy rate, percentage points

export function creditSpread(cs) {
  return BASE_SPREAD + 10 * (cs.distress || 0);
}

/**
 * Interest cost per year in millions. Company debt is mostly long-term, so its effective rate
 * (debtRate) follows the policy rate slowly; `rate` overrides it when given.
 */
export function interestCost(cs, rate = cs.debtRate) {
  return (cs.debt * ((rate ?? 3.25) + creditSpread(cs))) / 100;
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
  return expectedRevenueGrowth(cs, spec, macro) + cs.gShock;
}
/** What investors and analysts expect revenue to grow at: the same drivers, minus unannounced shocks. */
export function expectedRevenueGrowth(cs, spec, macro) {
  const s = SECTORS[spec.sector];
  return cs.trend + (s.cyc * (macro.growth - 2) * 1.5) / 100 + (s.inflRev * (macro.inflation - 2.5)) / 100;
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
    targetBelief: spec.targetMargin + interest / spec.revenue, // what investors believe the long-run margin is
    trend: spec.growth,
    gShock: 0,
    debt: spec.debt,
    debtRatio: spec.debt / spec.revenue,
    lev0: Math.max(4, spec.debt / Math.max(spec.revenue * opMargin, 0.01 * spec.revenue)),
    debtRate: macro.rate,
    cash: spec.cash,
    distress: 0,
    accum: { rev: 0, ni: 0, int: 0, days: 0 },
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
  cs.revRate *= Math.exp(g / YEAR_DAYS + 0.003 * gaussian(state));
  // Margins drift toward the long-run target (or a temporary anchor during the pre-game burn-in).
  const anchor = cs.marginAnchor ?? cs.targetOp;
  cs.opMargin = clamp(cs.opMargin + (anchor - cs.opMargin) / 300 + 0.0008 * gaussian(state), -1.5, 0.7);
  cs.gShock *= 0.998;
  cs.trend += (0.035 - cs.trend) / (cs.trend > 0.08 ? 600 : 2000); // very fast growth fades
  cs.debtRate += (macro.rate - cs.debtRate) / 500; // debt is refinanced gradually
  const m = effectiveMargin(cs, spec, macro);
  const interest = interestCost(cs) / YEAR_DAYS;
  cs.accum.rev += cs.revRate / YEAR_DAYS;
  cs.accum.ni += (cs.revRate * m) / YEAR_DAYS - interest;
  cs.accum.int = (cs.accum.int || 0) + interest;
  cs.accum.days += 1;
}

export function ttm(cs, key, offset = 0) {
  const qs = cs.quarters.slice(Math.max(0, cs.quarters.length - 4 - offset), cs.quarters.length - offset);
  if (qs.length < 4) return null;
  return qs.reduce((a, q) => a + q[key], 0);
}

/** Consensus estimate (cents per share) for the next quarter, from reported information only. */
export function consensus(state, cs, spec, macro) {
  const s = SECTORS[spec.sector];
  const growth = clamp(expectedRevenueGrowth(cs, spec, macro), -0.3, 0.6);
  // Analysts extrapolate from the latest quarter (not the lagging 12-month average).
  const revNext = cs.rep.lastRev * Math.pow(1 + growth, 0.25);
  const marginNext =
    cs.rep.lastOpMargin +
    ((cs.targetBelief ?? cs.targetOp) - cs.rep.lastOpMargin) * (1 - Math.pow(1 - 1 / 300, QUARTER_DAYS)) +
    (s.marginCyc * (macro.growth - 2) + s.inflMargin * (macro.inflation - 2.5) + s.rateMargin * (macro.rate - 3.25)) / 100 -
    (s.marginCyc * (cs.rep.growthAtReport - 2) + s.inflMargin * (cs.rep.inflAtReport - 2.5) + s.rateMargin * (cs.rep.rateAtReport - 3.25)) / 100;
  const niNext = revNext * marginNext - interestCost(cs) / 4;
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
  const intQ = (cs.accum.int || 0) * scale; // interest actually paid this quarter
  const eps = (niQ / cs.shares) * 100;
  const est = cs.est;
  cs.quarterNo += 1;
  const q = {
    day: state.day,
    label: quarterLabel(cs),
    revenue: revQ,
    netIncome: niQ,
    interest: intQ,
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
    opMargin: (niTTM + (ttm(cs, 'interest') ?? intQ * 4)) / revTTM,
    yoy: prevRev ? clamp(revTTM / prevRev - 1, -0.5, 1) : cs.trend,
    day: state.day,
    lastRev: revQ,
    lastOpMargin: (niQ + intQ) / revQ,
    growthAtReport: macro.growth,
    inflAtReport: macro.inflation,
    rateAtReport: macro.rate,
  };

  // Cash flow: faster-growing companies reinvest more of their profit; losses burn cash in full.
  const divPaid = (cs.dps * cs.shares) / 100;
  const reinvest = clamp(0.05 + 1.5 * Math.max(cs.trend, 0), 0.05, 0.6);
  cs.cash += (niQ > 0 ? niQ * (1 - reinvest) : niQ) - divPaid;
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
    } else if (priceCents >= 50 && mcap > need * 1.5 && random(state) < fundingAppetite(cs)) {
      // Investors grow reluctant to fund companies that look close to failing.
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

  // Each report teaches investors a little more about the company's true long-run margin.
  if (cs.targetBelief != null) cs.targetBelief += 0.25 * (cs.targetOp - cs.targetBelief);
  cs.est = consensus(state, cs, spec, macro);
  cs.nextEarnings = state.day + QUARTER_DAYS;
  cs.accum = { rev: 0, ni: 0, int: 0, days: 0 };
  return { quarter: q, funding, raised, dividendChange };
}

/**
 * Fair value per share (virtual dollars) from fundamentals and the economy.
 * source 'reported' uses the latest quarterly report; 'true' uses today's hidden business state.
 */
export function fairValue(cs, spec, macro, source = 'reported', elapsedDays = 0) {
  const s = SECTORS[spec.sector];
  const rep = cs.rep;
  const t = Math.max(0, elapsedDays);
  // Long-term growth expectations come from the company's growth trend and the economy (investors
  // look partly through the business cycle). Unannounced business shocks only show up in 'true'.
  const growth = clamp(
    cs.trend + (source === 'true' ? 0.4 * cs.gShock : 0) + (s.cyc * (macro.growth - 2) * 0.75) / 100,
    -0.2,
    0.5,
  );
  let rev;
  let baseMargin;
  if (source === 'true') {
    rev = cs.revRate;
    baseMargin = cs.opMargin;
  } else {
    // Reported figures come from the latest quarter. Between reports investors extrapolate them at the
    // expected growth and margin trend, so a report moves the price only by how much results differ
    // from those expectations (the surprise), not by predictable growth.
    rev = (rep.lastRev ?? rep.rev / 4) * 4 * Math.exp((clamp(expectedRevenueGrowth(cs, spec, macro), -0.3, 0.6) * t) / YEAR_DAYS);
    const m0 = rep.lastOpMargin ?? rep.opMargin;
    baseMargin = m0 + ((cs.targetBelief ?? cs.targetOp) - m0) * (1 - Math.pow(1 - 1 / 300, t));
  }
  const target = source === 'true' ? cs.targetOp : cs.targetBelief ?? cs.targetOp;
  const margin =
    baseMargin +
    (s.marginCyc * (macro.growth - 2)) / 100 / 2 +
    (s.inflMargin * (macro.inflation - 2.5)) / 100 / 2 +
    (s.rateMargin * (macro.rExp - 3.25)) / 100;
  const w = clamp(0.4 + 2 * growth, 0.4, 0.9); // fast growers are valued on long-run margins
  const normMargin = (1 - w) * margin + w * target;
  const debtRate = cs.debtRate + 0.3 * (macro.rExp - cs.debtRate); // expected refinancing cost
  const fwd = rev * (1 + growth) * normMargin - interestCost(cs, debtRate);
  const pe = s.pe * clamp(Math.exp(4 * (growth - 0.05)), 0.5, 2.5) * Math.exp(-s.duration * (macro.rExp - 3.25) * 0.06);
  const equity = Math.max(fwd > 0 ? fwd * pe : 0, rev * 0.2);
  return equity / cs.shares;
}

/** Chance that investors agree to buy new shares from a company that has run short of cash. */
function fundingAppetite(cs) {
  const d = distressScore(cs);
  return d < 0.5 ? 1 : d < 0.9 ? 0.8 : 0.55;
}

/** Distress score 0–1 from losses, cash runway, and leverage (public information). */
export function distressScore(cs) {
  if (cs.status && cs.status !== 'active') return 0;
  const ebit = cs.revRate * cs.opMargin;
  const ni = ebit - interestCost(cs);
  const runway = ni < 0 ? cs.cash / -ni : Infinity;
  // Leverage is judged against the company's own normal level (utilities and landlords run high debt).
  const lev = cs.debt / Math.max(ebit, 0.01 * cs.revRate);
  return clamp(Math.max((1.25 - runway) / 1.25, (lev / (cs.lev0 || 8) - 1.4) / 1.2), 0, 0.97);
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
