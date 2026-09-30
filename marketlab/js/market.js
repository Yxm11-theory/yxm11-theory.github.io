// Market price formation — a SIMPLIFIED MODEL for an educational game, not a forecast of real markets.
//
// Each stock's log price is built from:
//   fair value      from reported fundamentals, partly anticipating unreported true results (PSI)
//   market factor   β × (permanent random walk M + slowly mean-reverting sentiment S), GARCH volatility, rare jumps
//   sector factor   shared by every company in a sector
//   company news    permanent company-specific shocks (with occasional jumps and headlines)
//   transitory      small, short-lived deviations that fade
//   distress        a discount when a company may run out of cash
// plus the dividend accrued since the last ex-dividend day.
// News and price moves are produced together inside the same simulated day.
import { COMPANIES, COMPANY_MAP, SECTORS, SECTOR_KEYS, EVENT_TEMPLATES, SECTOR_NEWS } from './catalog.js';
import { YEAR_DAYS, QUARTER_DAYS, clamp } from './constants.js';
import { random, gaussian, chance, pick, between } from './rng.js';
import { fairValue, distressScore, scalePerShare } from './fundamentals.js';
import { makeNews } from './news.js';

export const PSI = 0.4; // share of not-yet-reported business changes already reflected in prices
const SIGMA0 = 0.0062; // normal daily market volatility
export const POLICY_EVERY = 42; // trading days between central-bank meetings
const RELEASE_EVERY = 21; // trading days between economic data releases

export const REGIMES = {
  expansion: { g: 2.4, pi: 2.4, s: 0.03, vol: 1.0 },
  overheating: { g: 3.0, pi: 4.3, s: 0.04, vol: 1.1 },
  contraction: { g: -2.2, pi: 1.6, s: -0.1, vol: 1.5 },
  recovery: { g: 3.2, pi: 2.0, s: 0.0, vol: 1.25 },
};

export function initMacro() {
  return { growth: 2.3, inflation: 2.4, rate: 3.25, rStar: 3.25, rExp: 3.25, dev: 0, regime: 'expansion', regimeDays: 200, lastLabel: 'expansion' };
}

export function initMarket(state) {
  state.market = { h: SIGMA0 * SIGMA0, M: 0, S: 0.03 };
  state.sectorF = Object.fromEntries(SECTOR_KEYS.map((k) => [k, 0]));
  state.bars = {};
}

export function initCompanyMarketState(spec, cs) {
  Object.assign(cs, { base: 0, n: 0, x: 0, lv: 0, sigmaD: spec.vol / Math.sqrt(YEAR_DAYS), spreadBps: 10, lastExDay: null, _repJump: 0 });
}

/** Economic label everyone can observe (the underlying regime stays hidden). */
export function economyLabel(macro) {
  if (macro.growth < 0) return { key: 'recession', label: 'Recession' };
  if (macro.inflation > 4.5) return { key: 'inflation', label: 'High inflation' };
  if (macro.growth < 1) return { key: 'slowdown', label: 'Slowdown' };
  if (macro.growth > 3.2) return { key: 'boom', label: 'Strong growth' };
  return { key: 'expansion', label: 'Expansion' };
}

/** Market mood from index levels: bull, bear, correction, or steady. */
export function marketMood(levels) {
  if (!levels || levels.length < 20) return { key: 'steady', label: 'Steady', detail: '' };
  const window = levels.slice(-YEAR_DAYS);
  const now = window[window.length - 1];
  const hi = Math.max(...window);
  const lo = Math.min(...window);
  const dd = now / hi - 1;
  if (dd <= -0.2) return { key: 'bear', label: 'Bear market', detail: `${(dd * 100).toFixed(0)}% below its high` };
  if (dd <= -0.1) return { key: 'correction', label: 'Correction', detail: `${(dd * 100).toFixed(0)}% below its high` };
  if (now / lo - 1 >= 0.2) return { key: 'bull', label: 'Bull market', detail: `+${((now / lo - 1) * 100).toFixed(0)}% from its low` };
  return { key: 'steady', label: 'Steady', detail: `${(dd * 100).toFixed(1)}% from its high` };
}

// ---------- Scenarios (they nudge the economy; outcomes stay random) ----------

function scenarioEffects(state) {
  const d = state.day;
  const e = { lockRegime: null, piTarget: null, sectorDrift: {}, growthBoost: {} };
  if (d < 1) return e;
  switch (state.scenario) {
    case 'recession':
      if (d >= 12 && d < 25) e.lockRegime = 'overheating';
      else if (d >= 25 && d < 175) e.lockRegime = 'contraction';
      break;
    case 'inflation':
      if (d >= 8 && d < 170) {
        e.lockRegime = 'overheating';
        e.piTarget = 8;
      }
      if (d >= 8 && d < 70) e.sectorDrift.energy = 0.0012;
      break;
    case 'techboom':
      if (d >= 5 && d < 130) {
        e.sectorDrift.technology = 0.0022;
        e.growthBoost.technology = 0.0003;
      }
      break;
    default:
  }
  return e;
}

// ---------- Macro ----------

/**
 * Average interest rate investors expect over the next few years: halfway between normal (3.25%) and
 * the rate the central bank's rule points to, plus any recent surprise. It moves smoothly with growth
 * and inflation, so predictable policy decisions cause no predictable price jumps.
 */
function expectedRate(m) {
  return 3.25 + 0.5 * (m.rStar - 3.25) + m.dev;
}

const REGIME_EXITS = {
  expansion: { min: 120, to: [['overheating', 1 / 500], ['contraction', 1 / 1400]] },
  overheating: { min: 60, to: [['contraction', 1 / 250], ['expansion', 1 / 300]] },
  contraction: { min: 90, to: [['recovery', 1 / 120]] },
  recovery: { min: 80, to: [['expansion', 1 / 150]] },
};

export function stepMacro(state, ctx, quiet) {
  const m = state.macro;
  const eff = scenarioEffects(state);
  ctx.effects = eff;
  m.regimeDays += 1;
  let next = null;
  if (eff.lockRegime) {
    if (m.regime !== eff.lockRegime) next = eff.lockRegime;
  } else {
    const ex = REGIME_EXITS[m.regime];
    if (m.regimeDays > ex.min) for (const [to, p] of ex.to) if (!next && chance(state, p)) next = to;
  }
  if (next) {
    m.regime = next;
    m.regimeDays = 0;
    // Markets partly anticipate a changing economy: sentiment moves halfway at once.
    const jump = (REGIMES[next].s - state.market.S) * 0.5;
    state.market.S += jump;
    ctx.regimeJump = jump;
  }
  const R = REGIMES[m.regime];
  const piT = eff.piTarget ?? R.pi;
  m.growth += (R.g - m.growth) * 0.012 + 0.04 * gaussian(state);
  m.inflation += (piT - m.inflation) * 0.008 + 0.03 * gaussian(state);
  m.rStar = clamp(1.0 + m.inflation + 0.5 * (m.inflation - 2) + 0.5 * (m.growth - 2), 0.25, 12);
  m.dev *= 0.99;
  m.rExp = expectedRate(m); // markets price the expected policy path, not the next meeting

  if (((state.day % POLICY_EVERY) + POLICY_EVERY) % POLICY_EVERY === 0) policyMeeting(state, ctx, quiet);
  if (!quiet && state.day > 0 && state.day % RELEASE_EVERY === 0) dataRelease(state, ctx);
}

function policyMeeting(state, ctx, quiet) {
  const m = state.macro;
  let step = clamp(Math.round(((m.rStar - m.rate) * 0.5) / 0.25) * 0.25, -0.75, 0.75);
  let surprise = 0;
  if (chance(state, 0.12)) surprise = random(state) < 0.5 ? -0.25 : 0.25; // discretionary surprise
  step += surprise;
  const old = m.rate;
  m.rate = clamp(Math.round((m.rate + step) * 100) / 100, 0.25, 12);
  const delta = Math.round((m.rate - old) * 100) / 100;
  m.dev += surprise * 0.8;
  m.rExp = expectedRate(m);
  if (quiet) return;
  const rate = m.rate.toFixed(2) + '%';
  const tone = delta > 0 ? 'negative' : delta < 0 ? 'positive' : 'neutral';
  const headline =
    delta === 0 ? `Aurelia Reserve Board holds interest rates at ${rate}` : `Aurelia Reserve Board ${delta > 0 ? 'raises' : 'cuts'} interest rates to ${rate}`;
  let body =
    delta === 0
      ? 'No change at this meeting. '
      : `Rates moved by ${delta > 0 ? '+' : ''}${delta.toFixed(2)} points with inflation at ${m.inflation.toFixed(1)}% and growth at ${m.growth.toFixed(1)}%. `;
  body += surprise
    ? 'The decision surprised investors, so rate-sensitive stocks reacted today.'
    : 'Investors had largely expected this, so it was already reflected in prices. Higher expected rates weigh most on utilities, real estate, and fast-growing companies; banks tend to benefit.';
  ctx.news.push(makeNews(state, { type: 'rates', tone: surprise ? tone : 'neutral', headline, body }));
}

function dataRelease(state, ctx) {
  const m = state.macro;
  const g = m.growth + 0.1 * gaussian(state);
  const pi = m.inflation + 0.08 * gaussian(state);
  const lbl = economyLabel(m);
  let headline = `Economic report: growth ${g.toFixed(1)}%, inflation ${pi.toFixed(1)}%`;
  let tone = 'neutral';
  let body = 'Monthly fictional data from the Aurelian statistics office. Prices already reflect what investors expected, so these numbers mostly confirm trends.';
  if (lbl.key !== m.lastLabel) {
    const msgs = {
      recession: ['Recession: the Aurelian economy is shrinking', 'negative', 'Output is falling. Cyclical sectors and indebted companies usually suffer most, while defensive sectors hold up better.'],
      inflation: ['Inflation surges above 4.5%', 'negative', 'Rising prices squeeze many profit margins and push interest rates up. Energy producers often benefit.'],
      slowdown: ['Economy slows to a crawl', 'negative', 'Growth has weakened. Investors are watching for signs of a recession.'],
      boom: ['Economy grows strongly', 'positive', 'Strong demand is lifting sales, especially for cyclical companies.'],
      expansion: ['Economy settles into steady growth', 'positive', 'Growth and inflation are back near normal levels.'],
    }[lbl.key];
    headline = `${msgs[0]} (growth ${g.toFixed(1)}%, inflation ${pi.toFixed(1)}%)`;
    tone = msgs[1];
    body = msgs[2] + ' Economic changes arrive gradually in this model.';
    m.lastLabel = lbl.key;
  }
  ctx.news.push(makeNews(state, { type: 'economy', tone, headline, body }));
}

// ---------- Prices ----------

export function logFair(cs, spec, macro, day) {
  const vr = fairValue(cs, spec, macro, 'reported', day - (cs.rep.day ?? day));
  const vt = fairValue(cs, spec, macro, 'true');
  return (1 - PSI) * Math.log(Math.max(vr, 1e-6)) + PSI * Math.log(Math.max(vt, 1e-6));
}

function accrued(state, cs) {
  if (cs.dps <= 0) return 0;
  const since = state.day - (cs.lastExDay ?? state.day - (QUARTER_DAYS - 12));
  return cs.dps * clamp(since / QUARTER_DAYS, 0, 1);
}

/** Model price in cents (before rounding) from the current state of every component. */
export function modelPrice(state, spec) {
  const cs = state.companies[spec.id];
  const mk = state.market;
  const lnP =
    logFair(cs, spec, state.macro, state.day) + spec.beta * (mk.M + mk.S) + state.sectorF[spec.sector] + (cs.base || 0) + cs.n + cs.x + Math.log(1 - 0.85 * cs.distress);
  return Math.exp(lnP) * 100 + accrued(state, cs);
}

/**
 * Make today's model price equal `price` by adjusting a permanent, non-reverting offset (`base`).
 * Used when bookkeeping changes at game start and during save migration. Because the offset never
 * fades, the alignment creates no predictable drift that a player could exploit.
 */
export function syncModelToPrice(state, id, price = state.prices[id][state.prices[id].length - 1]) {
  const spec = COMPANY_MAP[id];
  const cs = state.companies[id];
  const acc = accrued(state, cs);
  const model = modelPrice(state, spec) - acc;
  cs.base = (cs.base || 0) + Math.log(Math.max(1, price - acc) / Math.max(1e-6, model));
}

/** Draw today's open, high, and low consistently with the previous and new close. */
function drawBar(state, prev, close, sigma, gapShare) {
  const r = Math.log(close / prev);
  // Overnight part: news jumps happen before the open, plus a share of the ordinary move.
  const rest = r - gapShare;
  const open = prev * Math.exp(gapShare + 0.3 * rest + 0.27 * sigma * gaussian(state));
  // Intraday Brownian bridge from open to close: exact distribution of its maximum and minimum.
  const x = Math.log(close / open);
  const v = 0.7 * sigma * sigma;
  const u1 = Math.max(1e-12, random(state));
  const u2 = Math.max(1e-12, random(state));
  const hi = (x + Math.sqrt(x * x - 2 * v * Math.log(u1))) / 2;
  const lo = (x - Math.sqrt(x * x - 2 * v * Math.log(u2))) / 2;
  const o = Math.max(1, Math.round(open));
  return {
    open: o,
    high: Math.max(o, close, Math.round(open * Math.exp(hi))),
    low: Math.max(1, Math.min(o, close, Math.round(open * Math.exp(lo)))),
    close,
  };
}

export function stepPrices(state, ctx, quiet) {
  const mk = state.market;
  const eff = ctx.effects || {};
  const R = REGIMES[state.macro.regime];

  // Market factor: GJR-GARCH volatility (bigger after drops) plus rare jumps.
  const sigmaLR = SIGMA0 * R.vol;
  const omega = sigmaLR * sigmaLR * (1 - 0.965);
  let eps = Math.sqrt(mk.h) * gaussian(state);
  let mJump = 0;
  if (chance(state, 0.004)) mJump = -between(state, 0.025, 0.06);
  else if (chance(state, 0.0015)) mJump = between(state, 0.015, 0.035);
  eps += mJump;
  mk.h = Math.min(omega + 0.05 * eps * eps + (eps < 0 ? 0.08 * eps * eps : 0) + 0.875 * mk.h, (SIGMA0 * 6) ** 2);
  mk.M += 0.75 * eps;
  mk.S += 0.25 * eps + (R.s - mk.S) / 250;
  const volMkt = Math.sqrt(mk.h) / SIGMA0;
  const mktGap = mJump + (ctx.regimeJump || 0);
  if (!quiet && mJump) {
    const down = mJump < 0;
    ctx.news.push(
      makeNews(state, {
        type: 'market',
        tone: down ? 'negative' : 'positive',
        headline: down ? 'Broad sell-off: fear sweeps the fictional market' : 'Relief rally lifts nearly every stock',
        body: down
          ? 'A sudden wave of selling hit almost every company at once. Crashes like this are rare, and volatility often stays high for a while afterward. Diversifying across companies does not protect against market-wide drops.'
          : 'Investors rushed back into stocks after recent worries eased. Market-wide moves like this affect diversified portfolios too.',
        impact: mJump,
      }),
    );
  }
  if (!quiet && ctx.regimeJump && Math.abs(ctx.regimeJump) > 0.01) {
    const down = ctx.regimeJump < 0;
    ctx.news.push(
      makeNews(state, {
        type: 'market',
        tone: down ? 'negative' : 'positive',
        headline: down ? 'Stocks slide as investors grow worried about the economy' : 'Stocks climb as investors grow more confident about the economy',
        body: 'Prices often move before economic data confirms a change, because investors act on expectations. In this model the economy itself changes gradually.',
        impact: ctx.regimeJump,
      }),
    );
  }

  // Sector factors: shared moves with occasional unusually large days (and headlines).
  for (const k of SECTOR_KEYS) {
    const z = gaussian(state);
    const mv = 1.4 * SECTORS[k].secVol * Math.sqrt(0.5 + 0.5 * volMkt * volMkt) * z + (eff.sectorDrift?.[k] || 0);
    state.sectorF[k] += mv - state.sectorF[k] / 750;
    if (!quiet && Math.abs(z) > 2.7) {
      const up = z > 0;
      ctx.news.push(
        makeNews(state, {
          type: 'sector',
          tone: up ? 'positive' : 'negative',
          headline: SECTOR_NEWS[k][up ? 'up' : 'down'],
          body: `Every ${SECTORS[k].label.toLowerCase()} company is affected at once — one reason to spread holdings across sectors.`,
          sector: k,
          companyIds: COMPANIES.filter((c) => c.sector === k && state.companies[c.id].status === 'active').map((c) => c.id),
          impact: mv,
        }),
      );
    }
  }

  for (const spec of COMPANIES) {
    const cs = state.companies[spec.id];
    const arr = state.prices[spec.id];
    const prev = arr[arr.length - 1];
    if (cs.status !== 'active') {
      // On the day of a bankruptcy the shares collapse to pennies; afterwards the price is frozen.
      const p = cs.bankruptDay === state.day ? bankruptcyPrice(state, spec.id) : prev;
      arr.push(p);
      state.volumes[spec.id].push(cs.bankruptDay === state.day ? Math.round(cs.shares * 1e6 * spec.turnover * 6) : 0);
      state.bars[spec.id] = { open: p, high: prev, low: p, close: p };
      continue;
    }
    if (eff.growthBoost?.[spec.sector]) cs.gShock += eff.growthBoost[spec.sector];
    // Company volatility changes over time and rises when the whole market is stressed.
    cs.lv = 0.97 * cs.lv + 0.06 * gaussian(state);
    const sigmaD = (spec.vol / Math.sqrt(YEAR_DAYS)) * Math.exp(cs.lv) * Math.sqrt(0.6 + 0.4 * volMkt * volMkt);
    cs.sigmaD = sigmaD;
    let jump = 0;
    if (chance(state, 0.0015)) {
      jump = gaussian(state) * 0.08 * Math.max(0.6, spec.vol / 0.3);
      cs.gShock += Math.sign(jump) * 0.02; // real business news also changes the business
      if (!quiet) {
        const up = jump > 0;
        const tpl = pick(state, EVENT_TEMPLATES[spec.sector][up ? 'up' : 'down']);
        ctx.news.push(
          makeNews(state, {
            type: 'company',
            tone: up ? 'positive' : 'negative',
            headline: tpl.replace('{name}', spec.name).replace('{product}', spec.product),
            body: up
              ? 'Investors expect the news to lift future results. Company-specific surprises like this move one stock sharply while the rest of the market barely reacts.'
              : 'The setback raises doubts about future results. Company-specific risk like this is exactly what diversification helps soften.',
            companyIds: [spec.id],
            sector: spec.sector,
          }),
        );
      }
    }
    cs.n += 0.7 * sigmaD * gaussian(state) - cs.n / 1000 + jump;
    cs.x += 0.3 * sigmaD * gaussian(state) - cs.x / 30;

    // Financial distress (from public information: losses, cash runway, leverage).
    const oldD = cs.distress;
    cs.distress += (distressScore(cs) - cs.distress) * 0.1;
    if (!quiet) distressNews(state, ctx, spec, oldD, cs.distress);

    // Ex-dividend: the accrued dividend leaves the price and is paid to shareholders of record.
    if (cs.exDay === state.day && cs.dps > 0) {
      cs.lastExDay = state.day;
      cs.dividends.push({ day: state.day, dps: cs.dps });
      if (cs.dividends.length > 40) cs.dividends.shift();
      ctx.events.push({ type: 'exdiv', id: spec.id, dps: cs.dps });
    }

    let close = Math.max(1, Math.round(modelPrice(state, spec)));

    // Occasional stock split when the price gets very high (never near an ex-dividend day).
    if (close > 40000 && !(cs.exDay && Math.abs(cs.exDay - state.day) < 6) && chance(state, 1 / 60)) {
      const ratio = [2, 3, 4, 5].reduce((best, r) => (Math.abs(close / r - 15000) < Math.abs(close / best - 15000) ? r : best), 2);
      scalePerShare(cs, ratio);
      state.prices[spec.id] = arr.map((p) => Math.max(1, Math.round(p / ratio)));
      state.volumes[spec.id] = state.volumes[spec.id].map((v) => v * ratio);
      cs.splits.push({ day: state.day, ratio });
      close = Math.max(1, Math.round(modelPrice(state, spec)));
      ctx.events.push({ type: 'split', id: spec.id, ratio });
      if (!quiet) {
        ctx.news.push(
          makeNews(state, {
            type: 'split',
            tone: 'neutral',
            headline: `${spec.name} completes a ${ratio}-for-1 stock split`,
            body: `Each share became ${ratio} shares worth 1/${ratio} of the price, effective today. A split does not change the company’s value — shareholders own the same slice in smaller pieces. Past prices are adjusted so charts stay comparable.`,
            companyIds: [spec.id],
            sector: spec.sector,
          }),
        );
      }
    }
    const series = state.prices[spec.id];
    const prevAdj = series[series.length - 1];
    series.push(close);
    const totalSigma = Math.sqrt((spec.beta * Math.sqrt(mk.h)) ** 2 + (1.4 * SECTORS[spec.sector].secVol * volMkt) ** 2 + sigmaD * sigmaD);
    state.bars[spec.id] = drawBar(state, prevAdj, close, totalSigma, spec.beta * mktGap + jump + (cs._repJump || 0));
    const r = Math.log(close / prevAdj);
    const newsDay = jump !== 0 || cs._repJump !== 0;
    const adv = cs.shares * 1e6 * spec.turnover;
    state.volumes[spec.id].push(Math.round(adv * Math.exp(0.3 * gaussian(state)) * (1 + (1.5 * Math.abs(r)) / totalSigma) * (newsDay ? 2 : 1) * Math.sqrt(R.vol)));
    const mcapB = ((close / 100) * cs.shares) / 1000;
    cs.spreadBps = clamp((3 + 25 / Math.sqrt(Math.max(0.05, mcapB))) * Math.sqrt(sigmaD / (spec.vol / Math.sqrt(YEAR_DAYS))), 2, 150);
    cs._repJump = 0;
  }
}

function distressNews(state, ctx, spec, before, after) {
  const cross = (t) => before < t && after >= t;
  let msg = null;
  if (cross(0.35)) msg = [`${spec.name} warns that cash is running low`, 'Continuing losses and a shrinking cash cushion raise the risk that the company must borrow at high rates, sell new shares, or worse.'];
  else if (cross(0.7)) msg = [`Doubts grow over whether ${spec.name} can survive`, 'Analysts warn the company could fail without new funding. Stocks of distressed companies can swing wildly and may lose all their value.'];
  if (msg) ctx.news.push(makeNews(state, { type: 'distress', tone: 'negative', headline: msg[0], body: msg[1], companyIds: [spec.id], sector: spec.sector }));
}

/** Mark a company bankrupt; its shares become worthless and it is delisted. */
export function declareBankruptcy(state, ctx, spec, quiet) {
  const cs = state.companies[spec.id];
  cs.status = 'bankrupt';
  cs.bankruptDay = state.day;
  cs.dps = 0;
  cs.exDay = null;
  ctx.events.push({ type: 'bankruptcy', id: spec.id });
  if (!quiet) {
    ctx.news.push(
      makeNews(state, {
        type: 'bankruptcy',
        tone: 'negative',
        headline: `${spec.name} files for bankruptcy; shares delisted`,
        body: 'The company ran out of cash and could not borrow or raise more. Lenders are first in line and shareholders are usually wiped out, so its shares are written off in every simulated portfolio. Bankruptcies are rare in this model, but they are why concentrated bets can lose everything.',
        companyIds: [spec.id],
        sector: spec.sector,
        impact: -0.97,
      }),
    );
  }
}

/** Final price of a bankrupt company's shares (nearly zero). */
export function bankruptcyPrice(state, id) {
  const arr = state.prices[id];
  return Math.max(1, Math.round(arr[arr.length - 1] * 0.03));
}
