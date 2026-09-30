// Save, load, and migration of older saves.
import { COMPANIES, COMPANY_MAP, SECTOR_KEYS } from './catalog.js';
import { SAVE_VERSION, STARTING_CASH_CENTS } from './constants.js';
import { createGame, advanceDay } from './game.js';
import { scalePerShare } from './fundamentals.js';
import { syncModelToPrice } from './market.js';

export function serialize(state) {
  return JSON.stringify(state);
}

/**
 * Parse a save. Returns { state, migrated } or null if the save is missing, corrupt, or unsupported.
 * Version 1 saves (five companies) are migrated to version 2.
 */
export function deserialize(raw) {
  let s;
  try {
    s = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!s || typeof s !== 'object') return null;
  if (s.version === 1) {
    const state = migrateV1(s);
    return state ? { state, migrated: true } : null;
  }
  if (s.version !== SAVE_VERSION) return null;
  return validateV2(s) ? { state: s, migrated: false } : null;
}

function validateV2(s) {
  if (!Number.isInteger(s.cash) || s.cash < 0 || !Number.isInteger(s.day)) return false;
  if (!s.companies || !s.prices || !s.volumes || !s.macro || !s.holdings) return false;
  for (const c of COMPANIES) {
    const arr = s.prices[c.id];
    if (!Array.isArray(arr) || arr.length === 0 || !arr.every((p) => Number.isInteger(p) && p > 0)) return false;
    if (!s.companies[c.id] || typeof s.companies[c.id].shares !== 'number') return false;
  }
  for (const [id, h] of Object.entries(s.holdings)) {
    if (!s.prices[id] || !Number.isInteger(h?.shares) || h.shares < 0 || !Number.isFinite(h.costCents)) return false;
  }
  for (const k of ['news', 'transactions', 'orders', 'alerts', 'valueHistory', 'watchlists']) if (!Array.isArray(s[k])) return false;
  if (!s.stats || !s.challenges) return false;
  s.rng >>>= 0;
  return true;
}

const V1_IDS = ['nmbw', 'solq', 'vhlx', 'pblc', 'skyf'];
const V1_NEWS_TYPES = { invention: 'company', setback: 'company', recession: 'economy', economy: 'economy', rates: 'rates', sector: 'sector', earnings: 'earnings' };
const V1_SECTORS = { retail: 'consumer', aerospace: 'industrials' };

function validV1(s) {
  if (!Number.isInteger(s.cash) || s.cash < 0 || !Number.isInteger(s.day) || s.day < 0) return false;
  if (!s.prices || !s.holdings) return false;
  for (const id of V1_IDS) {
    const arr = s.prices[id];
    if (!Array.isArray(arr) || arr.length < 2 || !arr.every((p) => Number.isInteger(p) && p > 0)) return false;
  }
  for (const [id, h] of Object.entries(s.holdings)) {
    if (!V1_IDS.includes(id) || !Number.isInteger(h?.shares) || h.shares < 0 || !Number.isInteger(h.costCents)) return false;
  }
  return true;
}

/**
 * Migrate a version-1 save: keep the player's account and the five original companies' price
 * history, and generate the 25 new companies and the new economy with a seed derived from the save.
 */
export function migrateV1(old) {
  if (!validV1(old)) return null;
  const state = createGame({ scenario: 'standard', seed: `v1-${old.rng >>> 0}` });
  for (let d = 0; d < old.day; d++) advanceDay(state);

  // Replace the original five companies' history with what the player actually saw.
  for (const id of V1_IDS) {
    const oldArr = old.prices[id];
    const newArr = state.prices[id];
    const modelNow = newArr[newArr.length - 1];
    const legacyNow = oldArr[oldArr.length - 1];
    const extra = newArr.length - oldArr.length; // older generated days to keep before the v1 history
    const joinScale = oldArr[0] / newArr[Math.max(0, extra)];
    const prefix = extra > 0 ? newArr.slice(0, extra).map((p) => Math.max(1, Math.round(p * joinScale))) : [];
    state.prices[id] = [...prefix, ...oldArr.slice(Math.max(0, -extra))];
    // Keep valuation ratios sensible by rescaling per-share figures to the legacy price.
    scalePerShare(state.companies[id], modelNow / legacyNow);
    syncModelToPrice(state, id);
  }

  state.cash = old.cash;
  state.holdings = {};
  for (const [id, h] of Object.entries(old.holdings)) if (h.shares > 0) state.holdings[id] = { shares: h.shares, costCents: h.costCents };
  state.transactions = (old.transactions || []).map((t) => ({
    id: t.id, day: t.day, type: t.type, secId: t.companyId, shares: t.shares, priceCents: t.priceCents,
    totalCents: t.totalCents, realizedCents: t.realizedCents || 0, orderType: 'market',
  }));
  state.news = (old.news || []).map((n) => ({
    id: n.id, day: n.day, type: V1_NEWS_TYPES[n.type] || 'market', tone: n.tone || 'neutral', headline: n.headline, body: n.body,
    companyIds: (n.companyIds || []).filter((id) => COMPANY_MAP[id]), sector: V1_SECTORS[n.sector] || (SECTOR_KEYS.includes(n.sector) ? n.sector : null),
    impact: typeof n.impact === 'number' ? n.impact : null,
  }));
  state.valueHistory = Array.isArray(old.valueHistory) && old.valueHistory.length ? old.valueHistory : [{ day: old.day, value: old.cash }];
  state.challenges = old.challenges && typeof old.challenges === 'object' ? { ...old.challenges } : {};
  const os = old.stats || {};
  state.stats = {
    ...state.stats,
    trades: os.trades || 0,
    realized: os.realized || 0,
    profitableSales: os.profitableSales || 0,
    peakValue: Math.max(os.peakValue || STARTING_CASH_CENTS, STARTING_CASH_CENTS),
    recessionDaysHeld: os.recessionDaysHeld || 0,
  };
  const ids = (old.watchlist || []).filter((id) => COMPANY_MAP[id]);
  state.watchlists = [{ id: 'w1', name: 'My watchlist', ids }];
  state.activeWatchlist = 'w1';
  state.nextId = Math.max(old.nextId || 1, state.nextId) + 1;
  state.migratedFrom = { version: 1, day: old.day, notice: true };
  state.createdAt = old.createdAt || state.createdAt;
  return state;
}
