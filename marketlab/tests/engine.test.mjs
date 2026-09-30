// Run with: node --test marketlab/tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../js/engine.js';

const fresh = () => E.createGame(12345);
const setPrice = (s, id, cents) => {
  s.prices[id][s.prices[id].length - 1] = cents;
};

test('new game starts with $10,000 virtual cash, five companies, and price history', () => {
  const s = fresh();
  assert.equal(s.cash, 1_000_000);
  assert.equal(s.day, 0);
  assert.equal(E.COMPANIES.length, 5);
  assert.deepEqual(new Set(E.COMPANIES.map((c) => c.sector)), new Set(['technology', 'energy', 'healthcare', 'retail', 'aerospace']));
  for (const c of E.COMPANIES) assert.equal(s.prices[c.id].length, E.PREHISTORY_DAYS);
  assert.equal(E.priceSeries(s, 'nmbw').at(-1).day, 0);
  assert.equal(E.priceSeries(s, 'nmbw')[0].day, -(E.PREHISTORY_DAYS - 1));
});

test('quantity validation rejects invalid input', () => {
  for (const bad of ['', '  ', '0', '-3', '2.5', '1e3', 'abc', '10abc', '+4', null, undefined, '1000001']) {
    assert.equal(E.parseQuantity(bad).ok, false, `expected ${JSON.stringify(bad)} to be rejected`);
  }
  assert.deepEqual(E.parseQuantity(' 7 '), { ok: true, qty: 7 });
  assert.deepEqual(E.parseQuantity(12), { ok: true, qty: 12 });
});

test('buying deducts exact cost and tracks cost basis', () => {
  const s = fresh();
  setPrice(s, 'nmbw', 12_345); // $123.45
  const r = E.buy(s, 'nmbw', '10');
  assert.equal(r.ok, true);
  assert.equal(s.cash, 1_000_000 - 123_450);
  assert.deepEqual(s.holdings.nmbw, { shares: 10, costCents: 123_450 });
  setPrice(s, 'nmbw', 10_000);
  E.buy(s, 'nmbw', 5);
  assert.deepEqual(s.holdings.nmbw, { shares: 15, costCents: 173_450 });
  const pos = E.portfolioSummary(s).positions[0];
  assert.equal(Math.round(pos.avgCents), 11_563); // $115.63 average
  assert.equal(pos.valueCents, 150_000);
  assert.equal(pos.unrealizedCents, 150_000 - 173_450);
});

test('cannot buy without sufficient virtual cash', () => {
  const s = fresh();
  setPrice(s, 'skyf', 20_000);
  const r = E.buy(s, 'skyf', 51); // $10,200 > $10,000
  assert.equal(r.ok, false);
  assert.match(r.error, /Not enough virtual cash/);
  assert.match(r.error, /up to 50 shares/);
  assert.equal(s.cash, 1_000_000);
  assert.equal(s.holdings.skyf, undefined);
  assert.equal(E.buy(s, 'skyf', 50).ok, true); // exactly all cash is allowed
  assert.equal(s.cash, 0);
});

test('cannot sell shares not owned or more than owned', () => {
  const s = fresh();
  const r1 = E.sell(s, 'pblc', 1);
  assert.equal(r1.ok, false);
  assert.match(r1.error, /don't own any/);
  E.buy(s, 'pblc', 3);
  const r2 = E.sell(s, 'pblc', 4);
  assert.equal(r2.ok, false);
  assert.match(r2.error, /only own 3/);
  assert.equal(s.holdings.pblc.shares, 3);
  assert.equal(E.sell(s, 'pblc', '1.5').ok, false);
  assert.equal(E.sell(s, 'nope', 1).ok, false);
});

test('selling realizes gains with average cost and keeps totals consistent', () => {
  const s = fresh();
  setPrice(s, 'solq', 5_000);
  E.buy(s, 'solq', 10); // cost $500
  setPrice(s, 'solq', 7_000);
  E.buy(s, 'solq', 10); // cost $700 → basis $1,200 for 20 shares, avg $60
  setPrice(s, 'solq', 8_000);
  const r = E.sell(s, 'solq', 5); // proceeds $400, cost removed $300
  assert.equal(r.ok, true);
  assert.equal(r.realized, 10_000);
  assert.deepEqual(s.holdings.solq, { shares: 15, costCents: 90_000 });
  assert.equal(s.stats.realized, 10_000);
  const sum = E.portfolioSummary(s);
  assert.equal(sum.unrealized, 15 * 8_000 - 90_000);
  // With no fees, total gain = realized + unrealized exactly.
  assert.equal(sum.gain, sum.realized + sum.unrealized);
  // Selling the rest removes the position completely.
  const r2 = E.sell(s, 'solq', 15);
  assert.equal(r2.realized, 15 * 8_000 - 90_000);
  assert.equal(s.holdings.solq, undefined);
  assert.equal(s.cash, 1_000_000 + 10_000 + 30_000);
  assert.equal(s.transactions.length, 4);
  assert.ok(s.challenges['first-trade']);
  assert.ok(s.challenges['realized-gain']);
});

test('gain invariant holds across a long random trading session', () => {
  const s = E.createGame(99);
  for (let d = 0; d < 300; d++) {
    const c = E.COMPANIES[d % 5];
    if (d % 3 === 0) E.buy(s, c.id, 1 + (d % 7));
    if (d % 5 === 0) E.sell(s, c.id, 1 + (d % 4));
    E.advanceDay(s);
    const sum = E.portfolioSummary(s);
    assert.equal(sum.gain, sum.realized + sum.unrealized);
    assert.ok(s.cash >= 0);
  }
});

test('prices stay positive and outcomes vary by seed', () => {
  const finals = [];
  for (let seed = 1; seed <= 20; seed++) {
    const s = E.createGame(seed);
    for (let d = 0; d < 500; d++) E.advanceDay(s);
    for (const c of E.COMPANIES) {
      assert.ok(s.prices[c.id].every((p) => Number.isInteger(p) && p >= E.MIN_PRICE_CENTS));
    }
    finals.push(E.currentPrice(s, 'nmbw'));
  }
  assert.ok(new Set(finals).size > 15, 'different seeds should produce different outcomes');
  const ups = finals.filter((p) => p > 14_250).length;
  assert.ok(ups > 0 && ups < 20, 'outcomes should be uncertain (some up, some down)');
});

test('market produces all kinds of fictional news', () => {
  const s = E.createGame(7);
  for (let d = 0; d < 400; d++) E.advanceDay(s);
  const types = new Set(s.news.map((n) => n.type));
  for (const t of ['earnings', 'invention', 'setback', 'sector', 'rates', 'recession']) assert.ok(types.has(t), `missing ${t}`);
  assert.ok(s.news.every((n) => n.headline && n.body && Number.isInteger(n.day)));
});

test('day challenges complete and value history grows', () => {
  const s = fresh();
  for (let d = 0; d < 30; d++) E.advanceDay(s);
  assert.equal(s.day, 30);
  assert.equal(s.challenges['days-30'].day, 30);
  assert.equal(s.valueHistory.length, 31);
});

test('reaching $20,000 completes the Double up challenge', () => {
  const s = fresh();
  setPrice(s, 'vhlx', 10_000);
  E.buy(s, 'vhlx', 100); // all $10,000 in
  setPrice(s, 'vhlx', 30_000); // even a worst-case daily drop leaves > $20,000
  E.advanceDay(s);
  assert.ok(E.portfolioSummary(s).total >= 2_000_000);
  assert.equal(s.challenges['value-20k'].day, 1);
  assert.ok(s.challenges['value-12k']);
});

test('save round-trips through serialize/deserialize and resumes identically', () => {
  const a = fresh();
  E.buy(a, 'nmbw', 4);
  for (let d = 0; d < 12; d++) E.advanceDay(a);
  E.sell(a, 'nmbw', 2);
  const b = E.deserialize(E.serialize(a));
  assert.deepEqual(b, a);
  E.advanceDay(a);
  E.advanceDay(b);
  assert.deepEqual(b.prices, a.prices, 'seeded RNG resumes deterministically');
});

test('corrupt or incompatible saves are rejected', () => {
  assert.equal(E.deserialize('not json'), null);
  assert.equal(E.deserialize('{}'), null);
  const s = fresh();
  assert.equal(E.deserialize(JSON.stringify({ ...s, version: 999 })), null);
  assert.equal(E.deserialize(JSON.stringify({ ...s, cash: -5 })), null);
  const bad = structuredClone(s);
  bad.prices.nmbw[3] = -1;
  assert.equal(E.deserialize(JSON.stringify(bad)), null);
});

test('exports always include the disclaimer', () => {
  const s = fresh();
  E.buy(s, 'skyf', 2);
  assert.ok(E.resultsText(s).startsWith(E.DISCLAIMER));
  assert.ok(E.resultsText(s).includes(E.NOT_PREDICTIVE));
  assert.equal(E.resultsSummary(s).disclaimer, E.DISCLAIMER);
  assert.ok(E.transactionsCsv(s).includes('SIMULATION ONLY'));
});

test('money formatting', () => {
  assert.equal(E.formatCents(123_456), '$1,234.56');
  assert.equal(E.formatSignedCents(-250), '−$2.50');
  assert.equal(E.formatSignedCents(250), '+$2.50');
  assert.equal(E.formatPct(0.1234), '+12.34%');
});
