// MarketLab simulation engine: pure game logic with no DOM access, so it can
// be unit-tested in Node. All money is stored as integer cents.

export const DISCLAIMER =
  'SIMULATION ONLY. All money, companies, prices, and news are fictional. No real trades occur. ' +
  'Virtual funds have no monetary value and cannot be withdrawn. This is not investment advice.';
export const NOT_PREDICTIVE =
  'Simulated success does not predict real investment returns.';

export const SAVE_KEY = 'marketlab:save:v1';
export const SAVE_VERSION = 1;
export const STARTING_CASH_CENTS = 1_000_000; // $10,000 virtual
export const PREHISTORY_DAYS = 60; // days of price history generated before Day 0
export const MAX_QTY = 1_000_000;
export const MIN_PRICE_CENTS = 50;
const MAX_NEWS = 400;

export const SECTORS = {
  technology: { label: 'Technology', rateSensitivity: 1.4, cyclical: 1.1 },
  energy: { label: 'Energy', rateSensitivity: 0.8, cyclical: 1.0 },
  healthcare: { label: 'Healthcare', rateSensitivity: 0.7, cyclical: 0.55 },
  retail: { label: 'Retail', rateSensitivity: 1.0, cyclical: 1.2 },
  aerospace: { label: 'Aerospace', rateSensitivity: 1.2, cyclical: 1.3 },
};

export const PHASES = {
  expansion: { label: 'Expansion', drift: 0.0002, vol: 1.0 },
  slowdown: { label: 'Slowdown', drift: -0.0002, vol: 1.15 },
  recession: { label: 'Recession', drift: -0.002, vol: 1.55 },
  recovery: { label: 'Recovery', drift: 0.0008, vol: 1.2 },
};

export const COMPANIES = [
  {
    id: 'nmbw',
    ticker: 'NMBW.SIM',
    name: 'Nimbusweave Systems',
    sector: 'technology',
    mark: 'NW',
    color: '#7c9cff',
    startCents: 14250,
    volatility: 0.026,
    baseTrend: 0.0003,
    earningsOffset: 3,
    hq: 'Port Calder, Aurelia',
    founded: 2009,
    tagline: 'Mesh cloud computing',
    description:
      'Nimbusweave builds "mesh cloud" software that stitches idle office and home computers into one shared supercomputer. ' +
      'Its flagship product, WeaveOS, lets small studios rent rendering and AI-training power by the minute. ' +
      'Fast growth makes it popular, but its price swings hard when expectations change.',
    drivers: ['WeaveOS subscriptions', 'Rendering marketplace', 'Enterprise mesh contracts'],
    inventions: [
      'unveils self-healing WeaveOS 5, cutting customer compute costs by 40%',
      'demonstrates a photonic chip prototype that runs three times cooler',
      'launches Loom, a translation assistant that works fully offline',
    ],
    setbacks: [
      'suffers a 14-hour WeaveOS outage affecting thousands of customers',
      'delays its photonic chip launch after manufacturing yield problems',
      'loses a major Aurelian government contract to a rival',
    ],
  },
  {
    id: 'solq',
    ticker: 'SOLQ.SIM',
    name: 'Solquarry Energy',
    sector: 'energy',
    mark: 'SQ',
    color: '#f5b942',
    startCents: 5820,
    volatility: 0.021,
    baseTrend: 0.0002,
    earningsOffset: 8,
    hq: 'Dunmere Flats, Aurelia',
    founded: 1996,
    tagline: 'Quarry solar & sunstone storage',
    description:
      'Solquarry operates solar farms on reclaimed stone quarries and stores the power in "sunstone" thermal batteries made from crushed rock. ' +
      'It sells electricity to cities and heavy industry, so its results rise and fall with weather, power demand, and energy prices.',
    drivers: ['Electricity sales', 'Sunstone battery storage', 'Industrial supply deals'],
    inventions: [
      'reports sunstone batteries held heat for nine days in a field test',
      'signs a 20-year deal to power the Harrowgate steelworks',
      'unveils a floating solar array designed for reservoirs',
    ],
    setbacks: [
      'reports hailstorm damage at two solar quarry sites',
      'shuts a thermal-battery pilot after an overheating fault',
      'has a new quarry permit paused by regulators',
    ],
  },
  {
    id: 'vhlx',
    ticker: 'VHLX.SIM',
    name: 'Verdant Helix Therapeutics',
    sector: 'healthcare',
    mark: 'VH',
    color: '#c38bff',
    startCents: 8740,
    volatility: 0.03,
    baseTrend: 0.00025,
    earningsOffset: 13,
    hq: 'Lindenmoor, Aurelia',
    founded: 2014,
    tagline: 'One-time gene therapies',
    description:
      'Verdant Helix develops one-time gene therapies for rare inherited conditions and runs a small network of specialist clinics. ' +
      'Healthcare demand is steady through recessions, but this company depends on clinical-trial results that can move the stock sharply in either direction.',
    drivers: ['Clinical-trial pipeline', 'Clinic network revenue', 'Therapy licensing'],
    inventions: [
      'announces its HX-12 therapy met every goal in a late-stage trial',
      'discovers an enzyme that doubles gene-delivery efficiency',
      'receives fast-track review for a sickle-cell therapy',
    ],
    setbacks: [
      'pauses its HX-7 trial for a safety review',
      'has its main plant fail a quality inspection',
      'faces a patent dispute over a key therapy',
    ],
  },
  {
    id: 'pblc',
    ticker: 'PBLC.SIM',
    name: 'Pebblecart Goods',
    sector: 'retail',
    mark: 'PC',
    color: '#fb923c',
    startCents: 3475,
    volatility: 0.017,
    baseTrend: 0.0002,
    earningsOffset: 17,
    hq: 'Ashbourne Quay, Aurelia',
    founded: 1988,
    tagline: 'Neighborhood stores & bike delivery',
    description:
      'Pebblecart runs about 1,800 small neighborhood stores and a same-hour delivery service by cargo bike, selling groceries, household basics, and popular own-brand snacks. ' +
      'Its sales track how confident shoppers feel, so it is sensitive to the economic cycle.',
    drivers: ['Store sales', 'Delivery orders', 'Own-brand products'],
    inventions: [
      'launches the Pebblecart Pass membership with two million sign-ups in a week',
      'rolls out robot-packed micro-warehouses in six cities',
      'sees its own-brand snack line become a surprise hit',
    ],
    setbacks: [
      'recalls a batch of own-brand snacks',
      'reports stalled contract talks with delivery riders',
      'is left with unsold seasonal stock after a warm winter',
    ],
  },
  {
    id: 'skyf',
    ticker: 'SKYF.SIM',
    name: 'Skyforge Orbital',
    sector: 'aerospace',
    mark: 'SF',
    color: '#38bdf8',
    startCents: 21130,
    volatility: 0.032,
    baseTrend: 0.0003,
    earningsOffset: 0,
    hq: 'Cindervale Spaceport, Aurelia',
    founded: 2011,
    tagline: 'Reusable cargo gliders to orbit',
    description:
      'Skyforge builds reusable cargo gliders that launch from high-altitude balloons and carry small satellites to orbit. ' +
      'It also sells satellite-internet terminals to ships and remote towns. Big contracts and test flights make it the most volatile stock in the market.',
    drivers: ['Launch contracts', 'Satellite terminals', 'Glider reuse'],
    inventions: [
      'celebrates its Kestrel-3 glider completing a 25th reuse flight',
      'wins a contract to deploy a weather-satellite constellation',
      'successfully tests a hydrogen-powered upper stage',
    ],
    setbacks: [
      'loses its Kestrel-2 glider during a test flight (no injuries)',
      'announces a three-month launch delay',
      'reports a terminal supply shortage that hurts sales',
    ],
  },
];

const COMPANY_MAP = Object.fromEntries(COMPANIES.map((c) => [c.id, c]));
export const companyById = (id) => COMPANY_MAP[id] || null;

const SECTOR_EVENTS = {
  technology: {
    up: [
      ['Chip shortage eases across the tech sector', 'Component supply is back to normal, letting technology firms ship more products.'],
      ['Businesses boost software budgets', 'A fictional survey shows companies plan to spend more on cloud tools this year.'],
    ],
    down: [
      ['New data-privacy rules raise costs for tech firms', 'Compliance work is expected to squeeze technology profits for several quarters.'],
      ['Tech spending cools as buyers delay upgrades', 'Customers are stretching old equipment instead of buying new systems.'],
    ],
  },
  energy: {
    up: [
      ['Cold snap lifts electricity demand', 'An early winter in the fictional north pushes power usage and prices higher.'],
      ['Power prices climb after a grid outage', 'A fictional transmission line failure tightens supply across the region.'],
    ],
    down: [
      ['Mild weather cuts power demand', 'Warm days mean less heating, lowering energy sales across the sector.'],
      ['Power prices slide as new supply comes online', 'Several new fictional plants have opened, adding capacity and pushing prices down.'],
    ],
  },
  healthcare: {
    up: [
      ['Aurelia expands public health coverage', 'More patients will be covered for specialist treatments, a boost for healthcare providers.'],
      ['Regulator speeds up approval timelines', 'Faster reviews could bring new treatments to patients sooner.'],
    ],
    down: [
      ['Drug-pricing reform proposal weighs on healthcare', 'Lawmakers in the fictional parliament propose caps on treatment prices.'],
      ['Clinical-trial costs climb sharply', 'Higher staffing and lab costs are making research more expensive.'],
    ],
  },
  retail: {
    up: [
      ['Holiday shopping beats forecasts', 'Fictional shoppers spent more than expected across stores and delivery apps.'],
      ['Consumer confidence hits a three-year high', 'Households say they feel secure about jobs and plan to spend more.'],
    ],
    down: [
      ['Shoppers tighten their budgets', 'A fictional survey shows households cutting back on non-essential purchases.'],
      ['Shipping costs spike for retailers', 'Higher freight prices are expected to eat into store profits.'],
    ],
  },
  aerospace: {
    up: [
      ['Aurelian Space Agency boosts its launch budget', 'More government missions mean more contracts for launch companies.'],
      ['Satellite demand surges', 'Fictional telecom firms are ordering record numbers of small satellites.'],
    ],
    down: [
      ['Launch-safety review grounds new flights', 'Regulators pause new launches while reviewing safety rules.'],
      ['Titanium prices soar', 'A key material for aircraft and spacecraft becomes much more expensive.'],
    ],
  },
};

export const NEWS_TYPES = {
  earnings: 'Earnings',
  invention: 'Invention',
  setback: 'Setback',
  sector: 'Sector',
  rates: 'Interest rates',
  recession: 'Recession',
  economy: 'Economy',
};

// ---------- Random numbers (seeded, stored in state so saves resume exactly) ----------

function random(state) {
  let t = (state.rng = (state.rng + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function gaussian(state) {
  let u = 0;
  while (u === 0) u = random(state);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random(state));
}
const between = (s, a, b) => a + (b - a) * random(s);
const pick = (s, arr) => arr[Math.floor(random(s) * arr.length)];
const chance = (s, p) => random(s) < p;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// ---------- Formatting helpers ----------

const moneyFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
export function formatCents(cents) {
  return moneyFmt.format(cents / 100);
}
export function formatSignedCents(cents) {
  if (cents === 0) return formatCents(0);
  return (cents > 0 ? '+' : '−') + formatCents(Math.abs(cents));
}
export function formatPct(ratio, digits = 2) {
  if (!Number.isFinite(ratio)) return '—';
  const v = ratio * 100;
  if (Math.abs(v) < 0.005) return (0).toFixed(digits) + '%';
  return (v > 0 ? '+' : '−') + Math.abs(v).toFixed(digits) + '%';
}

// ---------- Game creation ----------

export function createGame(seed = Math.floor(Math.random() * 2 ** 32)) {
  const state = {
    version: SAVE_VERSION,
    rng: seed >>> 0,
    day: 0,
    cash: STARTING_CASH_CENTS,
    holdings: {},
    prices: {},
    trends: {},
    sectors: {},
    economy: { phase: 'expansion', phaseDays: 25, rate: 3.25 },
    news: [],
    transactions: [],
    valueHistory: [],
    watchlist: ['nmbw', 'skyf'],
    challenges: {},
    stats: { trades: 0, realized: 0, profitableSales: 0, peakValue: STARTING_CASH_CENTS, recessionDaysHeld: 0 },
    nextId: 1,
    createdAt: Date.now(),
  };
  for (const c of COMPANIES) {
    state.prices[c.id] = [c.startCents];
    state.trends[c.id] = c.baseTrend;
  }
  for (const key of Object.keys(SECTORS)) state.sectors[key] = { condition: clamp(gaussian(state) * 0.2, -1, 1) };
  // Pre-generate history so charts have context on Day 0 (quiet: no news events).
  for (let i = 1; i < PREHISTORY_DAYS; i++) {
    state.day = i - (PREHISTORY_DAYS - 1);
    stepMarket(state, true);
  }
  state.day = 0;
  state.valueHistory.push({ day: 0, value: STARTING_CASH_CENTS });
  return state;
}

export function currentPrice(state, id) {
  const arr = state.prices[id];
  return arr[arr.length - 1];
}
export function previousPrice(state, id) {
  const arr = state.prices[id];
  return arr[Math.max(0, arr.length - 2)];
}
/** Price series as [{day, value}] ending at the current day. */
export function priceSeries(state, id) {
  const arr = state.prices[id];
  const firstDay = state.day - (arr.length - 1);
  return arr.map((value, i) => ({ day: firstDay + i, value }));
}
/** Standard deviation of daily returns over the last `days` days. */
export function realizedVolatility(state, id, days = 30) {
  const arr = state.prices[id].slice(-(days + 1));
  if (arr.length < 3) return 0;
  const rets = [];
  for (let i = 1; i < arr.length; i++) rets.push(Math.log(arr[i] / arr[i - 1]));
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const variance = rets.reduce((a, r) => a + (r - mean) ** 2, 0) / (rets.length - 1);
  return Math.sqrt(variance);
}
export function volatilityLabel(vol) {
  if (vol < 0.015) return 'Low';
  if (vol < 0.025) return 'Moderate';
  if (vol < 0.035) return 'High';
  return 'Very high';
}

// ---------- Market simulation ----------

function makeNews(state, item) {
  return { id: state.nextId++, day: state.day, companyIds: [], sector: null, impact: 0, ...item };
}

function stepMarket(state, quiet) {
  const news = [];
  const shocks = Object.fromEntries(COMPANIES.map((c) => [c.id, 0]));
  const eco = state.economy;

  if (!quiet) {
    eco.phaseDays += 1;
    shiftPhase(state, news, shocks);
    if (state.day > 0 && state.day % 10 === 0) rateDecision(state, news, shocks);
  }

  // Sector conditions drift slowly (mean-reverting) with occasional sector-wide events.
  for (const s of Object.values(state.sectors)) {
    s.condition = clamp(0.92 * s.condition + gaussian(state) * 0.09, -1, 1);
  }
  if (!quiet && chance(state, 0.035)) sectorEvent(state, news, shocks);

  for (const c of COMPANIES) {
    // Company trend wanders around its long-run base trend.
    state.trends[c.id] = clamp(
      state.trends[c.id] * 0.98 + c.baseTrend * 0.02 + gaussian(state) * 0.00025,
      -0.004,
      0.004,
    );
    if (!quiet) companyEvents(state, c, news, shocks);
  }

  const phase = PHASES[eco.phase];
  for (const c of COMPANIES) {
    const sector = SECTORS[c.sector];
    let r =
      phase.drift * sector.cyclical +
      state.sectors[c.sector].condition * 0.0035 +
      state.trends[c.id] +
      gaussian(state) * c.volatility * phase.vol +
      shocks[c.id];
    r = clamp(r, -0.35, 0.35);
    const arr = state.prices[c.id];
    const last = arr[arr.length - 1];
    arr.push(Math.max(MIN_PRICE_CENTS, Math.round(last * Math.exp(r))));
  }
  return news;
}

function shiftPhase(state, news, shocks) {
  const e = state.economy;
  let next = null;
  if (e.phase === 'expansion' && e.phaseDays > 20 && chance(state, 0.025)) next = 'slowdown';
  else if (e.phase === 'slowdown' && e.phaseDays > 8) {
    if (chance(state, 0.05)) next = 'recession';
    else if (chance(state, 0.035)) next = 'expansion';
  } else if (e.phase === 'recession' && e.phaseDays > 12 && chance(state, 0.06)) next = 'recovery';
  else if (e.phase === 'recovery' && e.phaseDays > 10 && chance(state, 0.07)) next = 'expansion';
  if (!next) return;

  e.phase = next;
  e.phaseDays = 0;
  const base = { slowdown: -0.012, recession: -0.035, recovery: 0.02, expansion: 0.01 }[next];
  for (const c of COMPANIES) shocks[c.id] += base * SECTORS[c.sector].cyclical;
  const copy = {
    slowdown: [
      'Aurelian economy shows signs of slowing',
      'Factory orders and hiring cooled for a second straight month. Cyclical sectors such as retail and aerospace usually feel a slowdown first.',
      'negative',
      'economy',
    ],
    recession: [
      'Recession declared in the Aurelian economy',
      'Output shrank for two quarters in a row. Recessions often push many stock prices down at the same time, a reminder that diversification cannot remove market-wide risk.',
      'negative',
      'recession',
    ],
    recovery: [
      'Recovery begins as the economy grows again',
      'Spending and hiring are picking up after the recession. Stocks that fell the most sometimes rebound the fastest, but nothing is guaranteed.',
      'positive',
      'economy',
    ],
    expansion: [
      'Economy settles into steady expansion',
      'Growth is back to a normal pace. Company-specific news tends to matter more than the economy in calm periods.',
      'positive',
      'economy',
    ],
  }[next];
  news.push(
    makeNews(state, { type: copy[3], tone: copy[2], headline: copy[0], body: copy[1], impact: base }),
  );
}

function rateDecision(state, news, shocks) {
  const e = state.economy;
  const r = random(state);
  let delta = 0;
  if (e.phase === 'expansion') delta = r < 0.45 ? 0.25 : r < 0.55 ? 0.5 : 0;
  else if (e.phase === 'slowdown') delta = r < 0.4 ? -0.25 : 0;
  else if (e.phase === 'recession') delta = r < 0.55 ? -0.5 : r < 0.85 ? -0.25 : 0;
  else delta = r < 0.3 ? -0.25 : r < 0.45 ? 0.25 : 0;
  const newRate = clamp(e.rate + delta, 0.25, 9);
  delta = Math.round((newRate - e.rate) * 100) / 100;
  e.rate = newRate;
  const rateText = newRate.toFixed(2) + '%';
  if (delta === 0) {
    news.push(
      makeNews(state, {
        type: 'rates',
        tone: 'neutral',
        headline: `Aurelia Reserve Board holds interest rates at ${rateText}`,
        body: 'No change at this meeting. Markets had largely expected the decision, so prices barely reacted.',
      }),
    );
    return;
  }
  for (const c of COMPANIES) shocks[c.id] += -delta * 0.035 * SECTORS[c.sector].rateSensitivity;
  const up = delta > 0;
  news.push(
    makeNews(state, {
      type: 'rates',
      tone: up ? 'negative' : 'positive',
      headline: `Aurelia Reserve Board ${up ? 'raises' : 'cuts'} interest rates to ${rateText}`,
      body: up
        ? `Rates rose by ${delta.toFixed(2)} points. Higher rates make borrowing more expensive and make future profits worth less today, so growth-focused sectors like technology and aerospace are usually hit hardest.`
        : `Rates fell by ${Math.abs(delta).toFixed(2)} points. Cheaper borrowing tends to support spending and company investment, which often lifts stock prices, especially in rate-sensitive sectors.`,
      impact: -delta * 0.035,
    }),
  );
}

function sectorEvent(state, news, shocks) {
  const key = pick(state, Object.keys(SECTORS));
  const s = state.sectors[key];
  const positive = chance(state, 0.5 + s.condition * 0.25);
  const mag = between(state, 0.02, 0.06) * (positive ? 1 : -1);
  s.condition = clamp(s.condition + (positive ? 0.35 : -0.35), -1, 1);
  const ids = [];
  for (const c of COMPANIES) {
    if (c.sector === key) {
      shocks[c.id] += mag;
      ids.push(c.id);
    }
  }
  const [headline, body] = pick(state, SECTOR_EVENTS[key][positive ? 'up' : 'down']);
  news.push(
    makeNews(state, {
      type: 'sector',
      tone: positive ? 'positive' : 'negative',
      headline,
      body: `${body} Every ${SECTORS[key].label.toLowerCase()} company is affected at once — one reason to spread holdings across sectors.`,
      sector: key,
      companyIds: ids,
      impact: mag,
    }),
  );
}

function companyEvents(state, c, news, shocks) {
  // Scheduled quarterly earnings (every 20 trading days, staggered per company).
  if (state.day > 0 && (state.day + c.earningsOffset) % 20 === 0) {
    const surprise = gaussian(state);
    const shock = clamp(surprise * 0.045, -0.12, 0.12);
    shocks[c.id] += shock;
    state.trends[c.id] = clamp(state.trends[c.id] + surprise * 0.0005, -0.004, 0.004);
    const pct = Math.abs(surprise * 6).toFixed(1);
    let headline, body, tone;
    if (surprise > 0.5) {
      tone = 'positive';
      headline = `${c.name} beats earnings expectations`;
      body = `Quarterly profit came in ${pct}% above analyst estimates, helped by strong ${c.drivers[0].toLowerCase()}. An earnings surprise happens when results differ from what investors expected.`;
    } else if (surprise < -0.5) {
      tone = 'negative';
      headline = `${c.name} misses earnings expectations`;
      body = `Quarterly profit came in ${pct}% below analyst estimates as ${c.drivers[1].toLowerCase()} disappointed. Prices often fall when results miss expectations, even if the company is still profitable.`;
    } else {
      tone = 'neutral';
      headline = `${c.name} reports earnings roughly in line with forecasts`;
      body = `Results were close to what analysts expected, so the price reaction was modest. Surprises, not results alone, tend to move prices.`;
    }
    news.push(makeNews(state, { type: 'earnings', tone, headline, body, companyIds: [c.id], sector: c.sector, impact: shock }));
    return;
  }
  if (chance(state, 0.009)) {
    const shock = between(state, 0.05, 0.14);
    shocks[c.id] += shock;
    state.trends[c.id] = clamp(state.trends[c.id] + 0.0012, -0.004, 0.004);
    news.push(
      makeNews(state, {
        type: 'invention',
        tone: 'positive',
        headline: `${c.name} ${pick(state, c.inventions)}`,
        body: `Investors are betting the breakthrough could lift future sales. Big announcements can move a single stock sharply while the rest of the market barely changes.`,
        companyIds: [c.id],
        sector: c.sector,
        impact: shock,
      }),
    );
  } else if (chance(state, 0.009)) {
    const shock = -between(state, 0.04, 0.12);
    shocks[c.id] += shock;
    state.trends[c.id] = clamp(state.trends[c.id] - 0.0008, -0.004, 0.004);
    news.push(
      makeNews(state, {
        type: 'setback',
        tone: 'negative',
        headline: `${c.name} ${pick(state, c.setbacks)}`,
        body: `The setback raises doubts about near-term results. Company-specific risk like this is exactly what diversification helps soften.`,
        companyIds: [c.id],
        sector: c.sector,
        impact: shock,
      }),
    );
  }
}

/** Advance the market one trading day. Returns the day's news and newly completed challenges. */
export function advanceDay(state) {
  state.day += 1;
  const news = stepMarket(state, false);
  state.news.push(...news);
  if (state.news.length > MAX_NEWS) state.news.splice(0, state.news.length - MAX_NEWS);
  const summary = portfolioSummary(state);
  state.valueHistory.push({ day: state.day, value: summary.total });
  if (summary.total > state.stats.peakValue) state.stats.peakValue = summary.total;
  if (state.economy.phase === 'recession' && summary.positions.length > 0) state.stats.recessionDaysHeld += 1;
  const completed = checkChallenges(state);
  return { news, completed };
}

// ---------- Trading ----------

export function parseQuantity(input) {
  const s = String(input ?? '').trim();
  if (s === '') return { ok: false, error: 'Enter how many shares to trade.' };
  if (!/^\d+$/.test(s)) {
    return { ok: false, error: 'Use a whole number of shares — no decimals, letters, or negative numbers.' };
  }
  const qty = Number(s);
  if (qty < 1) return { ok: false, error: 'Quantity must be at least 1 share.' };
  if (qty > MAX_QTY) return { ok: false, error: `Quantity can be at most ${MAX_QTY.toLocaleString('en-US')} shares per trade.` };
  return { ok: true, qty };
}

export function sharesOwned(state, id) {
  return state.holdings[id]?.shares || 0;
}
export function maxAffordable(state, id) {
  return Math.floor(state.cash / currentPrice(state, id));
}

function recordTrade(state, tx) {
  state.transactions.push({ id: state.nextId++, day: state.day, ...tx });
  state.stats.trades += 1;
}

export function buy(state, id, input) {
  const c = companyById(id);
  if (!c) return { ok: false, error: 'Unknown company.' };
  const parsed = parseQuantity(input);
  if (!parsed.ok) return parsed;
  const qty = parsed.qty;
  const price = currentPrice(state, id);
  const cost = price * qty;
  if (cost > state.cash) {
    const max = maxAffordable(state, id);
    return {
      ok: false,
      error:
        `Not enough virtual cash: ${qty.toLocaleString('en-US')} shares cost ${formatCents(cost)} but you have ${formatCents(state.cash)}. ` +
        (max > 0 ? `You can afford up to ${max.toLocaleString('en-US')} shares.` : 'You cannot afford a single share right now.'),
    };
  }
  state.cash -= cost;
  const h = (state.holdings[id] ||= { shares: 0, costCents: 0 });
  h.shares += qty;
  h.costCents += cost;
  recordTrade(state, { type: 'buy', companyId: id, shares: qty, priceCents: price, totalCents: cost, realizedCents: 0 });
  return { ok: true, qty, price, total: cost, completed: checkChallenges(state) };
}

export function sell(state, id, input) {
  const c = companyById(id);
  if (!c) return { ok: false, error: 'Unknown company.' };
  const parsed = parseQuantity(input);
  if (!parsed.ok) return parsed;
  const qty = parsed.qty;
  const h = state.holdings[id];
  const owned = h?.shares || 0;
  if (owned === 0) return { ok: false, error: `You don't own any ${c.ticker} shares to sell.` };
  if (qty > owned) {
    return { ok: false, error: `You only own ${owned.toLocaleString('en-US')} ${c.ticker} share${owned === 1 ? '' : 's'}, so you can't sell ${qty.toLocaleString('en-US')}.` };
  }
  const price = currentPrice(state, id);
  const proceeds = price * qty;
  // Average-cost method: remove a proportional slice of the cost basis.
  const costRemoved = qty === owned ? h.costCents : Math.round((h.costCents * qty) / owned);
  const realized = proceeds - costRemoved;
  h.shares -= qty;
  h.costCents -= costRemoved;
  if (h.shares === 0) delete state.holdings[id];
  state.cash += proceeds;
  state.stats.realized += realized;
  if (realized > 0) state.stats.profitableSales += 1;
  recordTrade(state, { type: 'sell', companyId: id, shares: qty, priceCents: price, totalCents: proceeds, realizedCents: realized });
  return { ok: true, qty, price, total: proceeds, realized, completed: checkChallenges(state) };
}

// ---------- Portfolio ----------

export function portfolioSummary(state) {
  const positions = [];
  let holdingsValue = 0;
  let unrealized = 0;
  for (const c of COMPANIES) {
    const h = state.holdings[c.id];
    if (!h || h.shares <= 0) continue;
    const price = currentPrice(state, c.id);
    const value = price * h.shares;
    const gain = value - h.costCents;
    holdingsValue += value;
    unrealized += gain;
    positions.push({
      company: c,
      shares: h.shares,
      costCents: h.costCents,
      avgCents: h.costCents / h.shares,
      priceCents: price,
      valueCents: value,
      unrealizedCents: gain,
      unrealizedPct: h.costCents > 0 ? gain / h.costCents : 0,
    });
  }
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
    positions,
  };
}

export function sectorsHeld(state) {
  const set = new Set();
  for (const [id, h] of Object.entries(state.holdings)) if (h.shares > 0) set.add(companyById(id)?.sector);
  return set.size;
}

// ---------- Challenges ----------

export const CHALLENGES = [
  { id: 'first-trade', title: 'Opening move', description: 'Complete your first simulated trade.', target: 1, progress: (s) => s.stats.trades },
  { id: 'diversify', title: 'Spread the risk', description: 'Hold shares in at least 3 different sectors at the same time.', target: 3, progress: (s) => sectorsHeld(s) },
  { id: 'realized-gain', title: 'Lock it in', description: 'Sell shares for more than you paid (a realized simulated gain).', target: 1, progress: (s) => s.stats.profitableSales },
  { id: 'value-12k', title: 'Growth spurt', description: 'Reach $12,000 in total virtual value.', target: 1_200_000, money: true, progress: (s) => s.stats.peakValue },
  { id: 'days-30', title: 'Thirty-day run', description: 'Complete 30 trading days.', target: 30, progress: (s) => s.day },
  { id: 'storm', title: 'Storm watcher', description: 'Hold shares through a day of simulated recession.', target: 1, progress: (s) => s.stats.recessionDaysHeld },
  { id: 'all-five', title: 'Full lineup', description: 'Own shares in all five fictional companies at once.', target: 5, progress: (s) => Object.values(s.holdings).filter((h) => h.shares > 0).length },
  { id: 'trades-25', title: 'Active trader', description: 'Complete 25 simulated trades.', target: 25, progress: (s) => s.stats.trades },
  { id: 'value-20k', title: 'Double up', description: 'Reach $20,000 in total virtual value.', target: 2_000_000, money: true, progress: (s) => s.stats.peakValue },
  { id: 'days-100', title: 'The long haul', description: 'Complete 100 trading days.', target: 100, progress: (s) => s.day },
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

// ---------- Save / load ----------

export function serialize(state) {
  return JSON.stringify(state);
}

/** Parse and validate a save. Returns the state, or null if missing/corrupt/incompatible. */
export function deserialize(raw) {
  let s;
  try {
    s = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!s || typeof s !== 'object' || s.version !== SAVE_VERSION) return null;
  if (!Number.isInteger(s.cash) || s.cash < 0 || !Number.isInteger(s.day)) return null;
  if (!s.prices || !s.holdings || !s.economy || !PHASES[s.economy.phase]) return null;
  for (const c of COMPANIES) {
    const arr = s.prices[c.id];
    if (!Array.isArray(arr) || arr.length === 0 || !arr.every((p) => Number.isInteger(p) && p > 0)) return null;
    if (typeof s.trends?.[c.id] !== 'number') return null;
  }
  for (const k of Object.keys(SECTORS)) if (typeof s.sectors?.[k]?.condition !== 'number') return null;
  for (const [id, h] of Object.entries(s.holdings)) {
    if (!companyById(id) || !Number.isInteger(h?.shares) || h.shares < 0 || !Number.isInteger(h.costCents)) return null;
  }
  s.news = Array.isArray(s.news) ? s.news : [];
  s.transactions = Array.isArray(s.transactions) ? s.transactions : [];
  s.valueHistory = Array.isArray(s.valueHistory) && s.valueHistory.length ? s.valueHistory : [{ day: s.day, value: s.cash }];
  s.watchlist = Array.isArray(s.watchlist) ? s.watchlist.filter((id) => companyById(id)) : [];
  s.challenges = s.challenges && typeof s.challenges === 'object' ? s.challenges : {};
  s.stats = { trades: 0, realized: 0, profitableSales: 0, peakValue: STARTING_CASH_CENTS, recessionDaysHeld: 0, ...s.stats };
  s.nextId = Number.isInteger(s.nextId) ? s.nextId : 1;
  s.rng = s.rng >>> 0;
  return s;
}

// ---------- Exports (always carry the disclaimer) ----------

export function resultsSummary(state) {
  const sum = portfolioSummary(state);
  const done = CHALLENGES.filter((c) => state.challenges[c.id]);
  return {
    disclaimer: DISCLAIMER,
    notPredictive: NOT_PREDICTIVE,
    simulator: 'MarketLab — fictional educational stock market simulator',
    exportedAt: new Date().toISOString(),
    tradingDay: state.day,
    virtualCash: formatCents(sum.cash),
    virtualHoldingsValue: formatCents(sum.holdingsValue),
    totalVirtualValue: formatCents(sum.total),
    simulatedGains: formatSignedCents(sum.gain),
    simulatedGainsPct: formatPct(sum.gainPct),
    realizedSimulatedGains: formatSignedCents(sum.realized),
    unrealizedSimulatedGains: formatSignedCents(sum.unrealized),
    trades: state.stats.trades,
    challengesCompleted: done.map((c) => c.title),
    positions: sum.positions.map((p) => ({
      company: `${p.company.name} (${p.company.ticker}, fictional)`,
      shares: p.shares,
      averagePrice: formatCents(Math.round(p.avgCents)),
      currentValue: formatCents(p.valueCents),
      unrealizedSimulatedGain: formatSignedCents(p.unrealizedCents),
    })),
  };
}

export function resultsText(state) {
  const r = resultsSummary(state);
  const lines = [
    r.disclaimer,
    r.notPredictive,
    '',
    r.simulator,
    `Trading day: ${r.tradingDay}`,
    `Virtual cash: ${r.virtualCash}`,
    `Virtual holdings value: ${r.virtualHoldingsValue}`,
    `Total virtual value: ${r.totalVirtualValue}`,
    `Simulated gains: ${r.simulatedGains} (${r.simulatedGainsPct})`,
    `  Realized: ${r.realizedSimulatedGains}  |  Unrealized: ${r.unrealizedSimulatedGains}`,
    `Simulated trades: ${r.trades}`,
    `Challenges completed (${r.challengesCompleted.length}/${CHALLENGES.length}): ${r.challengesCompleted.join(', ') || 'none yet'}`,
    '',
    'Positions (fictional companies):',
    ...(r.positions.length
      ? r.positions.map((p) => `  ${p.company}: ${p.shares} shares, avg ${p.averagePrice}, value ${p.currentValue}, ${p.unrealizedSimulatedGain}`)
      : ['  none']),
    '',
    r.disclaimer,
  ];
  return lines.join('\n');
}

export function transactionsCsv(state) {
  const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const rows = [
    [DISCLAIMER],
    ['Day', 'Action', 'Company (fictional)', 'Ticker', 'Shares', 'Price (virtual $)', 'Total (virtual $)', 'Realized simulated gain (virtual $)'],
    ...state.transactions.map((t) => {
      const c = companyById(t.companyId);
      return [
        t.day,
        t.type === 'buy' ? 'Simulated buy' : 'Simulated sell',
        c?.name ?? t.companyId,
        c?.ticker ?? '',
        t.shares,
        (t.priceCents / 100).toFixed(2),
        (t.totalCents / 100).toFixed(2),
        t.type === 'sell' ? (t.realizedCents / 100).toFixed(2) : '',
      ];
    }),
  ];
  return rows.map((r) => r.map(esc).join(',')).join('\n');
}
