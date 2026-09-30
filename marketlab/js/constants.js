// Shared constants and formatting helpers.

export const DISCLAIMER =
  'SIMULATION ONLY. All money, companies, prices, and news are fictional. No real trades occur. ' +
  'Virtual funds have no monetary value and cannot be withdrawn. This is not investment advice.';
export const NOT_PREDICTIVE = 'Simulated success does not predict real investment returns.';
export const MODEL_NOTE =
  'MarketLab uses a simplified model of a market. It does not predict real markets, and no strategy in it is a guaranteed way to win.';

export const SAVE_KEY = 'marketlab:save:v1'; // key kept so older saves are found and migrated
export const SAVE_VERSION = 2;
export const STARTING_CASH_CENTS = 1_000_000; // $10,000 virtual
export const YEAR_DAYS = 252; // trading days in a simulated year
export const QUARTER_DAYS = 63; // trading days between quarterly reports
export const PREHISTORY_DAYS = 126; // price history shown before Day 0
export const BURN_IN_QUARTERS = 8; // quarters of reported results generated before Day 0
export const MAX_QTY = 1_000_000;
export const MAX_NEWS = 500;

const moneyFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export function formatCents(cents) {
  return moneyFmt.format(cents / 100);
}
export function formatSignedCents(cents) {
  if (Math.round(cents) === 0) return formatCents(0);
  return (cents > 0 ? '+' : '−') + formatCents(Math.abs(cents));
}
export function formatPct(ratio, digits = 2) {
  if (!Number.isFinite(ratio)) return '—';
  const v = ratio * 100;
  if (Math.abs(v) < 0.5 * 10 ** -digits) return (0).toFixed(digits) + '%';
  return (v > 0 ? '+' : '−') + Math.abs(v).toFixed(digits) + '%';
}
/** Millions of virtual dollars → "$1.2B" / "$640M". */
export function formatMillions(m) {
  if (!Number.isFinite(m)) return '—';
  const sign = m < 0 ? '−' : '';
  const a = Math.abs(m);
  if (a >= 1000) return `${sign}$${(a / 1000).toFixed(a >= 10000 ? 1 : 2)}B`;
  return `${sign}$${a.toFixed(a >= 100 ? 0 : 1)}M`;
}
export function formatVolume(v) {
  if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M';
  if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K';
  return String(Math.round(v));
}
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
