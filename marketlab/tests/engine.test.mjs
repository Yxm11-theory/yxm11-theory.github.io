// Run with: npm test   (node --test marketlab/tests/*.test.mjs)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as E from '../js/engine.js';

const fresh = (seed = 'test-1', scenario = 'standard') => E.createGame({ seed, scenario });
const setPrice = (s, id, cents) => {
  s.prices[id][s.prices[id].length - 1] = cents;
};
const V1_FIXTURE = fs.readFileSync(new URL('./fixtures/v1-save.json', import.meta.url), 'utf8');

// ---------- Stage 1: companies and fundamentals ----------

test('catalog has 30 original companies across 8 sectors with distinct fundamentals', () => {
  assert.equal(E.COMPANIES.length, 30);
  assert.deepEqual(new Set(E.COMPANIES.map((c) => c.sector)), new Set(['technology', 'healthcare', 'energy', 'finance', 'consumer', 'industrials', 'utilities', 'realestate']));
  for (const key of ['id', 'ticker', 'name', 'mark']) assert.equal(new Set(E.COMPANIES.map((c) => c[key])).size, 30, `${key} must be unique`);
  for (const c of E.COMPANIES) {
    assert.match(c.ticker, /^[A-Z]{4}\.SIM$/);
    for (const f of ['revenue', 'margin', 'targetMargin', 'growth', 'debt', 'cash', 'payout', 'vol', 'beta', 'turnover', 'price']) {
      assert.equal(typeof c[f], 'number', `${c.id}.${f}`);
    }
    assert.ok(c.description.length > 60);
  }
  // Fundamentals are genuinely varied, not copies.
  for (const f of ['revenue', 'growth', 'debt', 'vol', 'payout']) assert.ok(new Set(E.COMPANIES.map((c) => c[f])).size >= 10, `${f} should vary`);
  assert.ok(E.COMPANIES.some((c) => c.payout === 0) && E.COMPANIES.some((c) => c.payout >= 0.7), 'mix of dividend policies');
  assert.ok(E.COMPANIES.some((c) => c.margin < 0), 'some loss-making companies');
});

test('new game has price history, reported quarters, and an earnings calendar', () => {
  const s = fresh();
  assert.equal(s.day, 0);
  assert.equal(s.cash, 1_000_000);
  for (const c of E.COMPANIES) {
    const cs = s.companies[c.id];
    assert.equal(s.prices[c.id].length, E.PREHISTORY_DAYS);
    assert.equal(s.volumes[c.id].length, E.PREHISTORY_DAYS);
    assert.ok(cs.quarters.length >= 8, `${c.id} has 2 years of results`);
    assert.ok(cs.nextEarnings >= 1 && cs.nextEarnings <= E.QUARTER_DAYS, `${c.id} next earnings within a quarter`);
    assert.equal(typeof cs.est, 'number');
    const m = E.companyMetrics(cs, c, E.currentPrice(s, c.id));
    assert.ok(m.marketCap > 0 && m.revenueTTM > 0);
    // Near-breakeven companies can have huge P/Es; check established earners only.
    if (m.pe != null && m.netMargin > 0.03) assert.ok(m.pe > 3 && m.pe < 150, `${c.id} P/E ${m.pe}`);
    assert.ok(m.dividendYield < 0.15, `${c.id} yield ${m.dividendYield}`);
  }
  assert.equal(s.news.length, 0, 'burn-in produces no visible news');
});

test('same seed and scenario reproduce the same market; different seeds differ', () => {
  const a = fresh('repro');
  const b = fresh('repro');
  E.buy(a, 'nmbw', 5); // player actions must not change the market path
  for (let d = 0; d < 60; d++) {
    E.advanceDay(a);
    E.advanceDay(b);
  }
  assert.deepEqual(a.prices, b.prices);
  assert.deepEqual(a.news.map((n) => n.headline), b.news.map((n) => n.headline));
  const c = fresh('other');
  for (let d = 0; d < 60; d++) E.advanceDay(c);
  assert.notDeepEqual(a.prices, c.prices);
  assert.notEqual(fresh('x', 'standard').rng, fresh('x', 'recession').rng, 'scenario is part of the seed');
});

test('earnings are reported quarterly and consensus estimates are unbiased', () => {
  const surprises = [];
  for (let seed = 1; seed <= 6; seed++) {
    const s = fresh(`e${seed}`);
    const before = Object.fromEntries(E.COMPANIES.map((c) => [c.id, s.companies[c.id].quarters.length]));
    for (let d = 0; d < 2 * E.QUARTER_DAYS; d++) E.advanceDay(s);
    for (const c of E.COMPANIES) {
      const cs = s.companies[c.id];
      if (cs.status !== 'active') continue;
      assert.equal(cs.quarters.length - before[c.id], 2, `${c.id} reports twice in two quarters`);
      const q = cs.quarters.at(-1);
      assert.equal(cs.nextEarnings, q.day + E.QUARTER_DAYS);
      for (const x of cs.quarters.filter((x) => x.day > 0)) surprises.push(x.surprisePct);
    }
    assert.ok(s.news.some((n) => n.type === 'earnings' && /consensus estimate/.test(n.body)));
  }
  const mean = surprises.reduce((a, b) => a + b, 0) / surprises.length;
  assert.ok(Math.abs(mean) < 0.05, `mean surprise ${mean}`);
  assert.ok(surprises.some((x) => x > 0.02) && surprises.some((x) => x < -0.02), 'both beats and misses occur');
});

// ---------- Trading and accounting ----------

test('quantity validation rejects invalid input', () => {
  for (const bad of ['', '  ', '0', '-3', '2.5', '1e3', 'abc', '10abc', '+4', null, undefined, '1000001']) {
    assert.equal(E.parseQuantity(bad).ok, false, `expected ${JSON.stringify(bad)} to be rejected`);
  }
  assert.deepEqual(E.parseQuantity(' 7 '), { ok: true, qty: 7 });
});

test('cannot buy without enough cash or sell shares not owned', () => {
  const s = fresh();
  setPrice(s, 'skyf', 20_000);
  const r = E.buy(s, 'skyf', 51);
  assert.equal(r.ok, false);
  assert.match(r.error, /Not enough virtual cash/);
  assert.equal(s.cash, 1_000_000);
  assert.match(E.sell(s, 'pblc', 1).error, /don't own any/);
  E.buy(s, 'pblc', 3);
  assert.match(E.sell(s, 'pblc', 4).error, /only own 3/);
  assert.equal(E.sell(s, 'nope', 1).ok, false);
});

test('delisted companies cannot be bought', () => {
  const s = fresh();
  s.companies.vltc.status = 'bankrupt';
  assert.match(E.buy(s, 'vltc', 1).error, /no longer listed/);
});

// ---------- Save and migration ----------

test('v2 save round-trips and resumes deterministically', () => {
  const a = fresh();
  E.buy(a, 'nmbw', 4);
  for (let d = 0; d < 12; d++) E.advanceDay(a);
  const loaded = E.deserialize(E.serialize(a));
  assert.equal(loaded.migrated, false);
  const b = loaded.state;
  assert.deepEqual(b, a);
  E.advanceDay(a);
  E.advanceDay(b);
  assert.deepEqual(b.prices, a.prices);
});

test('corrupt or unsupported saves are rejected', () => {
  assert.equal(E.deserialize('not json'), null);
  assert.equal(E.deserialize('{}'), null);
  const s = fresh();
  assert.equal(E.deserialize(JSON.stringify({ ...s, version: 999 })), null);
  assert.equal(E.deserialize(JSON.stringify({ ...s, cash: -5 })), null);
  const bad = structuredClone(s);
  bad.prices.nmbw[3] = -1;
  assert.equal(E.deserialize(JSON.stringify(bad)), null);
  const v1 = JSON.parse(V1_FIXTURE);
  v1.holdings.nmbw.shares = 1.5;
  assert.equal(E.deserialize(JSON.stringify(v1)), null);
});

test('version 1 saves migrate with account, history, and challenges preserved', () => {
  const old = JSON.parse(V1_FIXTURE);
  const res = E.deserialize(V1_FIXTURE);
  assert.ok(res, 'migration succeeds');
  assert.equal(res.migrated, true);
  const s = res.state;
  assert.equal(s.version, E.SAVE_VERSION);
  assert.equal(s.day, old.day);
  assert.equal(s.cash, old.cash);
  assert.deepEqual(s.holdings, old.holdings);
  assert.deepEqual(Object.keys(s.challenges).sort(), Object.keys(old.challenges).sort());
  assert.equal(s.transactions.length, old.transactions.length);
  assert.equal(s.transactions[0].secId, old.transactions[0].companyId);
  assert.deepEqual(s.watchlists[0].ids, old.watchlist);
  assert.equal(s.news.length, old.news.length);
  // The original five companies keep the exact prices the player saw.
  for (const id of ['nmbw', 'solq', 'vhlx', 'pblc', 'skyf']) {
    assert.deepEqual(s.prices[id].slice(-old.prices[id].length), old.prices[id]);
  }
  // Every security has aligned, positive history.
  const len = s.prices.nmbw.length;
  for (const c of E.COMPANIES) {
    assert.equal(s.prices[c.id].length, len, `${c.id} aligned`);
    assert.ok(s.prices[c.id].every((p) => Number.isInteger(p) && p > 0));
  }
  // Portfolio value is unchanged by migration.
  const oldTotal = old.cash + Object.entries(old.holdings).reduce((a, [id, h]) => a + h.shares * old.prices[id].at(-1), 0);
  assert.equal(E.portfolioSummary(s).total, oldTotal);
  // The migrated game keeps working and saves as version 2.
  for (let d = 0; d < 70; d++) E.advanceDay(s);
  assert.equal(E.deserialize(E.serialize(s)).migrated, false);
  assert.ok(E.sell(s, 'pblc', 10).ok);
  assert.ok(s.migratedFrom.notice);
});

test('exports include the disclaimer, model note, and seed', () => {
  const s = fresh('share-me');
  E.buy(s, 'skyf', 2);
  const txt = E.resultsText(s);
  assert.ok(txt.startsWith(E.DISCLAIMER));
  assert.ok(txt.includes(E.NOT_PREDICTIVE) && txt.includes(E.MODEL_NOTE));
  assert.ok(txt.includes('Seed: share-me'));
  assert.equal(E.resultsSummary(s).disclaimer, E.DISCLAIMER);
  assert.ok(E.transactionsCsv(s).includes('SIMULATION ONLY'));
});

test('money formatting', () => {
  assert.equal(E.formatCents(123_456), '$1,234.56');
  assert.equal(E.formatSignedCents(-250), '−$2.50');
  assert.equal(E.formatPct(0.1234), '+12.34%');
  assert.equal(E.formatMillions(2500), '$2.50B');
  assert.equal(E.formatMillions(640), '$640M');
});

// ---------- Stage 2: market engine, costs, and corporate actions ----------

/** Advance until `pred(state)` is true (or a limit), returning the day's result. */
function advanceUntil(s, pred, limit = 400) {
  for (let i = 0; i < limit; i++) {
    const r = E.advanceDay(s);
    if (pred(s, r)) return r;
  }
  throw new Error('condition not reached');
}

test('market buys pay the ask plus slippage; sells receive the bid minus slippage', () => {
  const s = fresh();
  const id = 'glwr';
  const q = E.quote(s, id);
  assert.ok(q.bid < q.mid && q.ask > q.mid, 'bid < mid < ask');
  const est = E.estimateMarketFill(s, id, 'buy', 10);
  assert.ok(est.fill >= q.ask);
  assert.equal(est.costs, est.spreadCost + est.slippage);
  const cash0 = s.cash;
  const r = E.buy(s, id, 10);
  assert.equal(r.ok, true);
  assert.equal(r.price, est.fill);
  assert.equal(s.cash, cash0 - est.fill * 10);
  assert.equal(s.holdings[id].costCents, est.fill * 10, 'execution costs are part of cost basis');
  assert.equal(s.stats.execCosts, est.costs);
  const sellEst = E.estimateMarketFill(s, id, 'sell', 10);
  assert.ok(sellEst.fill <= q.bid);
  const r2 = E.sell(s, id, 10);
  assert.equal(r2.realized, sellEst.fill * 10 - est.fill * 10, 'an immediate round trip loses exactly the costs');
  assert.ok(r2.realized < 0);
});

test('slippage grows with order size and huge orders are refused', () => {
  const s = fresh();
  assert.ok(E.impact(s, 'vltc', 2000) > E.impact(s, 'vltc', 20));
  // Use the least-traded stock so 11% of its volume is under the per-order share limit.
  const id = E.COMPANIES.map((c) => c.id).sort((a, b) => E.typicalVolume(s, a) - E.typicalVolume(s, b))[0];
  const adv = E.typicalVolume(s, id);
  assert.ok(adv * 0.11 < E.MAX_QTY);
  s.cash = 1e12;
  const r = E.buy(s, id, Math.ceil(adv * 0.11));
  assert.equal(r.ok, false);
  assert.match(r.error, /10% of typical daily volume/);
  assert.equal(E.participationError(s, id, Math.floor(adv * 0.05)), null);
});

test('dividends are paid on the ex-dividend day for shares held, and the price drops', () => {
  const s = fresh('div-1');
  const id = E.COMPANIES.find((c) => c.payout >= 0.6).id; // a steady dividend payer
  E.buy(s, id, 50);
  const cs = s.companies[id];
  advanceUntil(s, (st) => st.companies[id].exDay && st.companies[id].exDay === st.day + 1);
  const shares = s.holdings[id].shares;
  const dps = cs.dps;
  const cash0 = s.cash;
  const r = E.advanceDay(s);
  const expected = Math.round(shares * dps);
  assert.equal(s.cash - cash0, expected, 'cash increases by shares × dividend');
  assert.equal(s.stats.dividends, expected);
  const tx = s.transactions.at(-1);
  assert.equal(tx.type, 'dividend');
  assert.equal(tx.totalCents, expected);
  assert.ok(r.account.some((m) => /Dividend received/.test(m.title)));
  assert.equal(cs.dividends.at(-1).day, s.day);
  assert.ok(s.challenges.dividend, 'dividend challenge completes');
});

test('dividend capture does not create free money: the price falls by about the dividend', () => {
  // Daily price noise is larger than a quarterly dividend, so use many seeds and remove market moves.
  const drops = [];
  for (let seed = 1; seed <= 24; seed++) {
    const s = fresh(`cap-${seed}`);
    for (let d = 0; d < 250; d++) {
      const before = Object.fromEntries(E.COMPANIES.map((c) => [c.id, [E.currentPrice(s, c.id), s.companies[c.id].exDay, s.companies[c.id].dps]]));
      E.advanceDay(s);
      const mkt = E.COMPANIES.reduce((a, c) => a + Math.log(E.currentPrice(s, c.id) / before[c.id][0]), 0) / E.COMPANIES.length;
      for (const c of E.COMPANIES) {
        const [p0, ex, dps] = before[c.id];
        if (ex === s.day && dps > 0 && s.companies[c.id].splits.at(-1)?.day !== s.day) drops.push((p0 * Math.exp(c.beta * mkt) - E.currentPrice(s, c.id)) / dps);
      }
    }
  }
  const avg = drops.reduce((a, b) => a + b, 0) / drops.length;
  assert.ok(drops.length > 1000);
  assert.ok(avg > 0.6 && avg < 1.4, `average ex-day drop is ${avg.toFixed(2)} × the dividend`);
});

test('stock splits multiply shares, keep cost basis and value, and adjust history', () => {
  const s = fresh('split-1');
  const id = 'skyf';
  E.buy(s, id, 7);
  const cost = s.holdings[id].costCents;
  // Force a very high price so a split becomes eligible, then advance until it happens.
  s.companies[id].base += Math.log(600 / (E.currentPrice(s, id) / 100));
  s.companies[id].exDay = null;
  const r = advanceUntil(s, (st) => st.companies[id].splits.length > 0, 600);
  const { ratio, day } = s.companies[id].splits.at(-1);
  assert.equal(day, s.day);
  assert.equal(s.holdings[id].shares, 7 * ratio);
  assert.equal(s.holdings[id].costCents, cost, 'cost basis unchanged');
  assert.ok(E.currentPrice(s, id) < 40000, 'post-split price is lower');
  const hist = s.prices[id];
  assert.ok(Math.abs(Math.log(hist.at(-1) / hist.at(-2))) < 0.3, 'history is split-adjusted (no artificial crash on the chart)');
  assert.ok(s.transactions.some((t) => t.type === 'split' && t.secId === id));
  assert.ok(r.account.some((m) => /split/.test(m.title)));
  assert.ok(s.news.some((n) => n.type === 'split' && n.companyIds[0] === id));
});

test('bankruptcy writes holdings off as a realized loss and delists the company', () => {
  const s = fresh('bk-1');
  const id = 'vltc';
  E.buy(s, id, 30);
  const cost = s.holdings[id].costCents;
  const realized0 = s.stats.realized;
  const total0 = E.portfolioSummary(s).total;
  // Drain the company's cash and make funding impossible, then advance to its next report.
  const cs = s.companies[id];
  cs.cash = -1e6;
  cs.debt = 1e7;
  s.companies[id].base -= 10; // price near zero, so no investor will buy new shares
  const r = advanceUntil(s, (st) => st.companies[id].status === 'bankrupt');
  assert.equal(s.holdings[id], undefined);
  assert.equal(s.stats.realized - realized0, -cost);
  assert.ok(s.transactions.some((t) => t.type === 'bankruptcy' && t.realizedCents === -cost));
  assert.ok(r.account.some((m) => /bankrupt/.test(m.title)));
  assert.equal(E.buy(s, id, 1).ok, false);
  const p = E.currentPrice(s, id);
  E.advanceDay(s);
  assert.equal(E.currentPrice(s, id), p, 'delisted price is frozen');
  const sum = E.portfolioSummary(s);
  assert.equal(sum.gain, sum.realized + sum.unrealized + sum.dividends - sum.execCosts * 0, 'accounting still balances');
  assert.ok(sum.total < total0);
});

test('gains reconcile: total gain = realized + unrealized + dividends over a long random session', () => {
  const s = fresh('recon');
  for (let d = 0; d < 400; d++) {
    const c = E.COMPANIES[(d * 7) % 30];
    if (d % 3 === 0) E.buy(s, c.id, 1 + (d % 9));
    if (d % 5 === 0 && s.holdings[c.id]) E.sell(s, c.id, Math.min(s.holdings[c.id].shares, 1 + (d % 4)));
    E.advanceDay(s);
    const sum = E.portfolioSummary(s);
    assert.equal(sum.gain, sum.realized + sum.unrealized + sum.dividends, `day ${s.day}`);
    assert.ok(s.cash >= 0);
    for (const h of Object.values(s.holdings)) assert.ok(Number.isInteger(h.shares) && h.shares > 0);
  }
});

test('prices stay positive and every kind of news appears across seeds', () => {
  const types = new Set();
  for (let seed = 1; seed <= 5; seed++) {
    const s = fresh(`news-${seed}`, ['standard', 'recession', 'inflation', 'techboom', 'standard'][seed - 1]);
    for (let d = 0; d < 500; d++) E.advanceDay(s);
    for (const c of E.COMPANIES) assert.ok(s.prices[c.id].every((p) => Number.isInteger(p) && p >= 1));
    for (const n of s.news) types.add(n.type);
  }
  for (const t of ['earnings', 'company', 'sector', 'rates', 'economy', 'market']) assert.ok(types.has(t), `missing ${t}`);
});

test('scenarios change the economy as described', () => {
  const recession = fresh('sc', 'recession');
  const inflation = fresh('sc', 'inflation');
  const boom = fresh('sc', 'techboom');
  const standard = fresh('sc', 'standard');
  let minGrowth = Infinity;
  let maxInfl = -Infinity;
  for (let d = 0; d < 150; d++) {
    E.advanceDay(recession);
    E.advanceDay(inflation);
    E.advanceDay(boom);
    E.advanceDay(standard);
    minGrowth = Math.min(minGrowth, recession.macro.growth);
    maxInfl = Math.max(maxInfl, inflation.macro.inflation);
  }
  assert.ok(minGrowth < 0, 'recession scenario reaches negative growth');
  assert.ok(maxInfl > 5, 'inflation scenario pushes inflation above 5%');
  assert.ok(inflation.macro.rate > 4, 'central bank raises rates in the inflation scenario');
  const techRet = (s) => E.COMPANIES.filter((c) => c.sector === 'technology').reduce((a, c) => a + Math.log(E.currentPrice(s, c.id) / s.prices[c.id][s.prices[c.id].length - 151]), 0);
  assert.ok(techRet(boom) > techRet(standard), 'technology does better in the tech boom than with the same seed otherwise');
});

test('news is published on the same day as the price move it explains', () => {
  const s = fresh('timing');
  for (let d = 0; d < 200; d++) {
    const before = Object.fromEntries(E.COMPANIES.map((c) => [c.id, E.currentPrice(s, c.id)]));
    const { news } = E.advanceDay(s);
    for (const n of news) {
      assert.equal(n.day, s.day);
      if (n.companyIds.length === 1 && n.impact != null) {
        const id = n.companyIds[0];
        const split = s.companies[id].splits.at(-1)?.day === s.day;
        if (!split) assert.ok(Math.abs(n.impact - (E.currentPrice(s, id) / before[id] - 1)) < 1e-9, 'impact equals today’s move');
      }
    }
  }
});
