// Result exports. Every export carries the full simulation disclaimer.
import { SCENARIOS } from './catalog.js';
import { DISCLAIMER, NOT_PREDICTIVE, MODEL_NOTE, formatCents, formatSignedCents, formatPct } from './constants.js';
import { securityById } from './securities.js';
import { portfolioSummary, CHALLENGES, maxDrawdown } from './portfolio.js';

export const TX_LABELS = {
  buy: 'Simulated buy',
  sell: 'Simulated sell',
  dividend: 'Dividend (virtual)',
  split: 'Stock split',
  bankruptcy: 'Bankruptcy write-off',
  order: 'Order update',
};

export function resultsSummary(state) {
  const sum = portfolioSummary(state);
  const done = CHALLENGES.filter((c) => state.challenges[c.id]);
  return {
    disclaimer: DISCLAIMER,
    notPredictive: NOT_PREDICTIVE,
    modelNote: MODEL_NOTE,
    simulator: 'MarketLab — fictional educational stock market simulator',
    scenario: SCENARIOS[state.scenario]?.label || state.scenario,
    seed: state.seed,
    exportedAt: new Date().toISOString(),
    tradingDay: state.day,
    virtualCash: formatCents(sum.cash),
    virtualHoldingsValue: formatCents(sum.holdingsValue),
    totalVirtualValue: formatCents(sum.total),
    simulatedGains: formatSignedCents(sum.gain),
    simulatedTotalReturn: formatPct(sum.gainPct),
    realizedSimulatedGains: formatSignedCents(sum.realized),
    unrealizedSimulatedGains: formatSignedCents(sum.unrealized),
    virtualDividendsReceived: formatCents(sum.dividends),
    executionCostsPaid: formatCents(sum.execCosts),
    maxDrawdown: formatPct(-maxDrawdown(state.valueHistory.map((v) => v.value))),
    trades: state.stats.trades,
    challengesCompleted: done.map((c) => c.title),
    positions: sum.positions.map((p) => ({
      security: `${p.spec.name} (${p.spec.ticker}, fictional)`,
      shares: p.shares,
      averagePrice: formatCents(Math.round(p.avgCents)),
      currentValue: formatCents(p.valueCents),
      unrealizedSimulatedGain: formatSignedCents(p.unrealizedCents),
    })),
  };
}

export function resultsText(state) {
  const r = resultsSummary(state);
  return [
    r.disclaimer,
    r.notPredictive,
    r.modelNote,
    '',
    r.simulator,
    `Scenario: ${r.scenario} · Seed: ${r.seed}`,
    `Trading day: ${r.tradingDay}`,
    `Virtual cash: ${r.virtualCash}`,
    `Virtual holdings value: ${r.virtualHoldingsValue}`,
    `Total virtual value: ${r.totalVirtualValue}`,
    `Simulated gains: ${r.simulatedGains} (total return ${r.simulatedTotalReturn}, including virtual dividends)`,
    `  Realized: ${r.realizedSimulatedGains}  |  Unrealized: ${r.unrealizedSimulatedGains}  |  Dividends: ${r.virtualDividendsReceived}`,
    `Execution costs paid (spreads and slippage): ${r.executionCostsPaid}`,
    `Maximum drawdown: ${r.maxDrawdown}`,
    `Simulated trades: ${r.trades}`,
    `Challenges completed (${r.challengesCompleted.length}/${CHALLENGES.length}): ${r.challengesCompleted.join(', ') || 'none yet'}`,
    '',
    'Positions (fictional securities):',
    ...(r.positions.length
      ? r.positions.map((p) => `  ${p.security}: ${p.shares} shares, avg ${p.averagePrice}, value ${p.currentValue}, ${p.unrealizedSimulatedGain}`)
      : ['  none']),
    '',
    r.disclaimer,
  ].join('\n');
}

export function transactionRow(t) {
  const spec = securityById(t.secId);
  return {
    day: t.day,
    action: TX_LABELS[t.type] || t.type,
    orderType: t.orderType || '',
    name: spec?.name ?? t.secId,
    ticker: spec?.ticker ?? '',
    shares: t.shares ?? '',
    price: t.priceCents != null ? (t.priceCents / 100).toFixed(2) : '',
    total: t.totalCents != null ? (t.totalCents / 100).toFixed(2) : '',
    costs: t.costCents ? (t.costCents / 100).toFixed(2) : '',
    realized: t.type === 'sell' || t.type === 'bankruptcy' ? ((t.realizedCents || 0) / 100).toFixed(2) : '',
    note: t.note || '',
  };
}

export function transactionsCsv(state, list = state.transactions) {
  const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const rows = [
    [DISCLAIMER],
    [MODEL_NOTE],
    ['Day', 'Action', 'Order type', 'Security (fictional)', 'Ticker', 'Shares', 'Price (virtual $)', 'Total (virtual $)', 'Execution costs (virtual $)', 'Realized simulated gain (virtual $)', 'Note'],
    ...list.map((t) => Object.values(transactionRow(t))),
  ];
  return rows.map((r) => r.map(esc).join(',')).join('\n');
}
