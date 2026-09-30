// Multi-seed market diagnostics. Run: node marketlab/tests/sim-report.mjs [seeds] [years]
// Prints distributions for returns, crashes, runaway growth, bankruptcies, correlations, and more.
// This is a diagnostic of the simplified model, not a calibration target: outcomes are not tuned
// to make any particular share of players win or lose.
import * as E from '../js/engine.js';

const SEEDS = Number(process.argv[2] || 40);
const YEARS = Number(process.argv[3] || 5);
const DAYS = YEARS * E.YEAR_DAYS;
const q = (arr, p) => {
  const a = [...arr].sort((x, y) => x - y);
  return a[Math.min(a.length - 1, Math.floor(p * a.length))];
};
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const corr = (a, b) => {
  const ma = mean(a);
  const mb = mean(b);
  let s = 0;
  let sa = 0;
  let sb = 0;
  for (let i = 0; i < a.length; i++) {
    s += (a[i] - ma) * (b[i] - mb);
    sa += (a[i] - ma) ** 2;
    sb += (b[i] - mb) ** 2;
  }
  return s / Math.sqrt(sa * sb);
};
const pct = (v) => (v * 100).toFixed(1) + '%';
const ranks = (a) => {
  const idx = a.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]);
  const r = new Array(a.length);
  idx.forEach(([, i], k) => (r[i] = k));
  return r;
};
const spearman = (a, b) => corr(ranks(a), ranks(b));

export function runSeed(seed, scenario = 'standard', days = DAYS) {
  const s = E.createGame({ seed: `sim-${seed}`, scenario });
  const start = s.prices.nmbw.length - 1;
  const idx = [1];
  const tr = [1];
  const rExp = [s.macro.rExp];
  const earn = [];
  for (let d = 0; d < days; d++) {
    const prevCaps = {};
    let prevTotal = 0;
    for (const c of E.COMPANIES) {
      if (s.companies[c.id].status !== 'active') continue;
      prevCaps[c.id] = E.currentPrice(s, c.id) * s.companies[c.id].shares;
      prevTotal += prevCaps[c.id];
    }
    const prevPrices = Object.fromEntries(E.COMPANIES.map((c) => [c.id, E.currentPrice(s, c.id)]));
    const sharesBefore = Object.fromEntries(E.COMPANIES.map((c) => [c.id, s.companies[c.id].shares]));
    const { news } = E.advanceDay(s);
    let r = 0;
    let rTR = 0;
    for (const id of Object.keys(prevCaps)) {
      const ratio = s.companies[id].shares / sharesBefore[id]; // split
      const p1 = E.currentPrice(s, id) * ratio;
      const div = s.companies[id].dividends.at(-1)?.day === s.day ? s.companies[id].dividends.at(-1).dps * ratio : 0;
      r += (prevCaps[id] / prevTotal) * (p1 / prevPrices[id] - 1);
      rTR += (prevCaps[id] / prevTotal) * ((p1 + div) / prevPrices[id] - 1);
    }
    idx.push(idx.at(-1) * (1 + r));
    tr.push(tr.at(-1) * (1 + rTR));
    rExp.push(s.macro.rExp);
    for (const n of news) if (n.type === 'earnings') earn.push({ id: n.companyIds[0], day: s.day, impact: n.impact, sp: s.companies[n.companyIds[0]].quarters.at(-1).surprisePct });
  }
  return { s, start, idx, tr, rExp, earn };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const annual = [];
  const annualTR = [];
  const worstDD = [];
  const vols = [];
  const bankrupt = [];
  const splits = [];
  const extremes = { up20: 0, down95: 0, total: 0 };
  const within = [];
  const across = [];
  const volClust = [];
  const earnCorr = [];
  const rateBeta = { utilities: [], realestate: [], finance: [], technology: [] };
  const recessionDays = [];
  const t0 = Date.now();
  for (let seed = 1; seed <= SEEDS; seed++) {
    const { s, start, idx, tr, rExp, earn } = runSeed(seed);
    const rets = idx.slice(1).map((v, i) => v / idx[i] - 1);
    for (let y = 0; y < YEARS; y++) {
      annual.push(idx[(y + 1) * E.YEAR_DAYS] / idx[y * E.YEAR_DAYS] - 1);
      annualTR.push(tr[(y + 1) * E.YEAR_DAYS] / tr[y * E.YEAR_DAYS] - 1);
    }
    let peak = 0;
    let dd = 0;
    for (const v of idx) {
      peak = Math.max(peak, v);
      dd = Math.max(dd, 1 - v / peak);
    }
    worstDD.push(dd);
    vols.push(Math.sqrt(mean(rets.map((r) => r * r)) * E.YEAR_DAYS));
    bankrupt.push(E.COMPANIES.filter((c) => s.companies[c.id].status !== 'active').length);
    splits.push(E.COMPANIES.reduce((a, c) => a + s.companies[c.id].splits.length, 0));
    // Company outcomes (split-adjusted prices).
    for (const c of E.COMPANIES) {
      const arr = s.prices[c.id];
      const g = arr.at(-1) / arr[start];
      extremes.total += 1;
      if (g > 20) extremes.up20 += 1;
      if (g < 0.05) extremes.down95 += 1;
    }
    // Correlations of daily returns (last 500 days, active companies).
    const act = E.COMPANIES.filter((c) => s.companies[c.id].status === 'active');
    const R = Object.fromEntries(act.map((c) => [c.id, s.prices[c.id].slice(-501).map((p, i, a) => (i ? Math.log(p / a[i - 1]) : 0)).slice(1)]));
    for (let i = 0; i < act.length; i++)
      for (let j = i + 1; j < act.length; j++) (act[i].sector === act[j].sector ? within : across).push(corr(R[act[i].id], R[act[j].id]));
    const abs = rets.map(Math.abs);
    volClust.push(corr(abs.slice(1), abs.slice(0, -1)));
    earnCorr.push(spearman(earn.map((e) => e.sp), earn.map((e) => e.impact)));
    // Rate sensitivity: regress 21-day sector returns on 21-day expected-rate changes.
    for (const k of Object.keys(rateBeta)) {
      const ids = E.COMPANIES.filter((c) => c.sector === k).map((c) => c.id);
      const xs = [];
      const ys = [];
      for (let t = 21; t < DAYS; t += 21) {
        xs.push(rExp[t] - rExp[t - 21]);
        ys.push(mean(ids.map((id) => Math.log(s.prices[id][start + t] / s.prices[id][start + t - 21]))) - Math.log(idx[t] / idx[t - 21]));
      }
      rateBeta[k].push(corr(xs, ys));
    }
    recessionDays.push(s.valueHistory.length ? 0 : 0);
  }
  console.log(`MarketLab simulated market diagnostics — ${SEEDS} seeds × ${YEARS} years (${((Date.now() - t0) / 1000).toFixed(1)}s)\n`);
  console.log(`Composite index annual price return: p5 ${pct(q(annual, 0.05))}, p25 ${pct(q(annual, 0.25))}, median ${pct(q(annual, 0.5))}, p75 ${pct(q(annual, 0.75))}, p95 ${pct(q(annual, 0.95))}, min ${pct(q(annual, 0))}, max ${pct(q(annual, 1))}`);
  console.log(`Composite total return incl. dividends: median ${pct(q(annualTR, 0.5))}, mean ${pct(mean(annualTR))}`);
  console.log(`Share of years with a loss: ${pct(annual.filter((a) => a < 0).length / annual.length)}`);
  console.log(`Annualized index volatility: median ${pct(q(vols, 0.5))} (range ${pct(q(vols, 0))}–${pct(q(vols, 1))})`);
  console.log(`Worst peak-to-trough drawdown per ${YEARS}-year run: median ${pct(q(worstDD, 0.5))}, p95 ${pct(q(worstDD, 0.95))}, max ${pct(q(worstDD, 1))}`);
  console.log(`Companies >20× over ${YEARS} years: ${pct(extremes.up20 / extremes.total)}; fell >95%: ${pct(extremes.down95 / extremes.total)}`);
  console.log(`Bankruptcies per run: mean ${mean(bankrupt).toFixed(2)}, max ${Math.max(...bankrupt)}; splits per run: mean ${mean(splits).toFixed(2)}`);
  console.log(`Daily return correlation: same sector ${mean(within).toFixed(2)}, different sectors ${mean(across).toFixed(2)}`);
  console.log(`Volatility clustering (autocorrelation of |index returns|): ${mean(volClust).toFixed(2)}`);
  console.log(`Rank correlation of earnings surprise with same-day price reaction: ${mean(earnCorr).toFixed(2)}`);
  console.log(`Correlation of sector excess return with expected-rate changes: ${Object.entries(rateBeta).map(([k, v]) => `${k} ${mean(v).toFixed(2)}`).join(', ')}`);
}
