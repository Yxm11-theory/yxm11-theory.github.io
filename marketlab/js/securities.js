// Lookups shared by every module: securities, prices, and simple statistics.
import { COMPANY_MAP, FUND_MAP, COMPANIES, FUNDS } from './catalog.js';

export const companyById = (id) => COMPANY_MAP[id] || null;
export const fundById = (id) => FUND_MAP[id] || null;
export const securityById = (id) => COMPANY_MAP[id] || FUND_MAP[id] || null;
export const isFund = (id) => Boolean(FUND_MAP[id]);
export const ALL_SECURITY_IDS = [...COMPANIES.map((c) => c.id), ...FUNDS.map((f) => f.id)];

export function listedIds(state) {
  return ALL_SECURITY_IDS.filter((id) => state.prices[id]);
}
export function isTradable(state, id) {
  if (!state.prices[id]) return false;
  if (isFund(id)) return true;
  return state.companies[id]?.status === 'active';
}
export function currentPrice(state, id) {
  const arr = state.prices[id];
  return arr[arr.length - 1];
}
export function previousPrice(state, id) {
  const arr = state.prices[id];
  return arr[Math.max(0, arr.length - 2)];
}
export function dayChange(state, id) {
  const prev = previousPrice(state, id);
  return prev ? currentPrice(state, id) / prev - 1 : 0;
}
/** Price series as [{day, value}] ending on the current day. */
export function priceSeries(state, id) {
  const arr = state.prices[id];
  const first = state.day - (arr.length - 1);
  return arr.map((value, i) => ({ day: first + i, value }));
}
/** Standard deviation of daily log returns over the last `days` days. */
export function realizedVolatility(state, id, days = 30) {
  const arr = state.prices[id].slice(-(days + 1));
  if (arr.length < 3) return 0;
  const rets = [];
  for (let i = 1; i < arr.length; i++) if (arr[i] > 0 && arr[i - 1] > 0) rets.push(Math.log(arr[i] / arr[i - 1]));
  if (rets.length < 2) return 0;
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  return Math.sqrt(rets.reduce((a, r) => a + (r - mean) ** 2, 0) / (rets.length - 1));
}
export function volatilityLabel(vol) {
  if (vol < 0.012) return 'Low';
  if (vol < 0.02) return 'Moderate';
  if (vol < 0.032) return 'High';
  return 'Very high';
}
export function averageVolume(state, id, days = 20) {
  const v = state.volumes[id]?.slice(-days) || [];
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
}
