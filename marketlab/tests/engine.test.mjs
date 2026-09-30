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
