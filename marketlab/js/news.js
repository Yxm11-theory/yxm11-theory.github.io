// Fictional news text. News is always generated inside the same simulated day as the price move
// it explains, so players never see news before prices have reacted.
import { formatMillions, formatPct } from './constants.js';

export const NEWS_TYPES = {
  earnings: 'Earnings',
  dividend: 'Dividend',
  split: 'Stock split',
  company: 'Company news',
  distress: 'Financial distress',
  bankruptcy: 'Bankruptcy',
  sector: 'Sector',
  rates: 'Interest rates',
  economy: 'Economy',
  market: 'Market',
};

const dollars = (cents) => (cents < 0 ? '−' : '') + '$' + (Math.abs(cents) / 100).toFixed(2);

export function makeNews(state, item) {
  return { id: state.nextId++, day: state.day, companyIds: [], sector: null, impact: null, ...item };
}

export function earningsNews(state, spec, result) {
  const q = result.quarter;
  const sp = q.surprisePct;
  let tone = 'neutral';
  let headline = `${spec.name} reports ${q.label} results roughly in line with forecasts`;
  if (sp > 0.02) {
    tone = 'positive';
    headline = `${spec.name} beats ${q.label} earnings expectations`;
  } else if (sp < -0.02) {
    tone = 'negative';
    headline = `${spec.name} misses ${q.label} earnings expectations`;
  }
  const yoy = state.companies[spec.id].rep.yoy;
  let body =
    `Reported earnings of ${dollars(q.eps)} per share versus a consensus estimate of ${dollars(q.est)}` +
    ` (${formatPct(sp, 1)} surprise). Quarterly revenue was ${formatMillions(q.revenue)}, ${formatPct(yoy, 1)} over the past year. `;
  if (q.eps < 0 && sp > 0.02) body += 'The company still lost money, but less than expected — prices react to results versus expectations, not to profit alone.';
  else if (q.eps > 0 && sp < -0.02) body += 'Profits were positive but below what investors expected, and expectations are what the price already reflected.';
  else if (Math.abs(sp) <= 0.02) body += 'With few surprises, there was little new information for the price to absorb.';
  else body += tone === 'positive' ? 'Results beat what the price had already assumed.' : 'Results fell short of what the price had already assumed.';

  const d = result.dividendChange;
  const cs = state.companies[spec.id];
  if (d === 'raised') body += ` The quarterly dividend was raised to ${dollars(cs.dps)} per share.`;
  else if (d === 'initiated') body += ` The company declared its first quarterly dividend of ${dollars(cs.dps)} per share.`;
  else if (d === 'cut') body += ` The quarterly dividend was cut to ${dollars(cs.dps)} per share.`;
  else if (d === 'suspended') body += ' The dividend was suspended to preserve cash.';
  if (result.funding === 'borrowed') body += ` It also borrowed ${formatMillions(result.raised)} to rebuild its cash reserves.`;
  if (result.funding === 'equity') body += ` It sold new shares to raise ${formatMillions(result.raised)}, diluting existing shareholders.`;
  return makeNews(state, { type: 'earnings', tone, headline, body, companyIds: [spec.id], sector: spec.sector });
}
