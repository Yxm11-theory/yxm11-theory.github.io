// Portfolio: positions, allocation, and gains.
import * as E from '../../engine.js';
import { esc, money, gain, mark, flashClass, emptyState, statTile, virtualTag, plural, tone, sectorColor, secLink } from '../util.js';

export const title = () => 'Portfolio';

export function allocation(sum) {
  const groups = {};
  for (const p of sum.positions) {
    const key = p.spec.kind === 'fund' ? 'funds' : p.spec.sector;
    groups[key] = (groups[key] || 0) + p.valueCents;
  }
  const label = (k) => (k === 'cash' ? 'Virtual cash' : k === 'funds' ? 'Diversified funds' : E.SECTORS[k].label);
  const segments = [...Object.entries(groups).sort((a, b) => b[1] - a[1]), ['cash', sum.cash]].filter(([, v]) => v > 0).map(([k, v]) => ({ key: k, label: label(k), value: v, share: sum.total ? v / sum.total : 0 }));
  return { segments, sectors: Object.keys(groups).filter((k) => k !== 'funds').length, hasFunds: Boolean(groups.funds) };
}

export function allocationBar(segments) {
  return `<div class="alloc-bar" role="img" aria-label="Allocation: ${segments.map((s) => `${s.label} ${(s.share * 100).toFixed(0)}%`).join(', ')}">
      ${segments.map((s) => `<span style="width:${s.share * 100}%;background:${sectorColor(s.key)}"></span>`).join('')}
    </div>
    <div class="alloc-legend">${segments.map((s) => `<span><i style="background:${sectorColor(s.key)}"></i>${s.label} ${(s.share * 100).toFixed(1)}%</span>`).join('')}</div>`;
}

export function render(ctx) {
  const { state } = ctx;
  const sum = E.portfolioSummary(state);
  const alloc = allocation(sum);
  const biggest = sum.positions[0];
  let divNote;
  if (!sum.positions.length) divNote = 'You hold only virtual cash: no market risk, but no chance of growth either.';
  else if (alloc.hasFunds && alloc.sectors <= 1) divNote = 'Your diversified fund spreads money across many companies at once.';
  else if (alloc.sectors === 1) divNote = 'Concentrated: every holding is in one sector, so a single sector-wide fictional event affects everything you own.';
  else if (alloc.sectors === 2) divNote = 'Partly diversified across 2 sectors. Adding more sectors can soften sector-specific shocks.';
  else divNote = `Spread across ${alloc.sectors} sectors. Diversification softens company and sector shocks, but economy-wide events still move most stocks together.`;
  if (biggest && biggest.weight > 0.4) divNote += ` Note: ${biggest.spec.ticker} is ${(biggest.weight * 100).toFixed(0)}% of your total virtual value.`;

  const rows = sum.positions
    .map(
      (p) => `<tr>
      <td class="cell-first"><div class="cell-co">${mark(p.spec)}<div style="min-width:0">${secLink(p.spec)}<span class="ticker">${p.spec.ticker}</span> <span class="badge-fict">Fictional</span>${E.isTradable(state, p.id) ? '' : ' <span class="badge-danger">Delisted</span>'}</div></div></td>
      <td class="r" data-label="Shares owned">${p.shares.toLocaleString('en-US')}</td>
      <td class="r" data-label="Avg purchase price">${money(Math.round(p.avgCents))}</td>
      <td class="r" data-label="Current price"><span class="${flashClass(ctx, p.id)}">${money(p.priceCents)}</span></td>
      <td class="r" data-label="Current value">${money(p.valueCents)}</td>
      <td class="r" data-label="Unrealized simulated gain">${gain(p.unrealizedCents)}<br><span class="small ${tone(p.unrealizedCents)}">${E.formatPct(p.unrealizedPct)}</span></td>
      <td class="r" data-label="Share of portfolio">${(p.weight * 100).toFixed(1)}%</td>
    </tr>`,
    )
    .join('');

  return `
  <div class="page-head"><div><h1 tabindex="-1">Portfolio</h1><p>Your simulated positions in fictional securities. Values update each simulated day.</p></div></div>
  <section class="grid stats" aria-label="Portfolio summary">
    ${statTile(`Virtual cash ${virtualTag}`, money(sum.cash))}
    ${statTile(`Holdings value ${virtualTag}`, money(sum.holdingsValue), plural(sum.positions.length, 'position'))}
    ${statTile('Unrealized simulated gains', gain(sum.unrealized), 'On shares you still hold', tone(sum.unrealized))}
    ${statTile('Realized simulated gains', gain(sum.realized), 'Locked in by selling', tone(sum.realized))}
  </section>
  <section class="card section-gap" aria-labelledby="pos-h">
    <div class="card-head"><h2 id="pos-h">Positions</h2><span class="sub">Total virtual value ${money(sum.total)} · Simulated gains ${E.formatSignedCents(sum.gain)}</span></div>
    ${
      sum.positions.length
        ? `<div class="table-wrap"><table class="data stackable">
            <caption class="sr-only">Simulated positions in fictional securities</caption>
            <thead><tr><th scope="col">Security</th><th scope="col" class="r">Shares owned</th><th scope="col" class="r">Avg purchase price</th><th scope="col" class="r">Current price</th><th scope="col" class="r">Current value</th><th scope="col" class="r">Unrealized simulated gain</th><th scope="col" class="r">Share of portfolio</th></tr></thead>
            <tbody>${rows}</tbody>
            <tfoot><tr><td class="cell-first">Total holdings</td><td class="r" data-label="Shares owned">${sum.positions.reduce((a, p) => a + p.shares, 0).toLocaleString('en-US')}</td><td class="r" data-label="Avg purchase price">—</td><td class="r" data-label="Current price">—</td><td class="r" data-label="Current value">${money(sum.holdingsValue)}</td><td class="r" data-label="Unrealized simulated gain">${gain(sum.unrealized)}</td><td class="r" data-label="Share of portfolio">${sum.total ? ((sum.holdingsValue / sum.total) * 100).toFixed(1) : '0.0'}%</td></tr></tfoot>
          </table></div>`
        : emptyState('📊', "You don't own any shares yet", `Pick a fictional company on the Markets page, then use <strong>Simulate buy</strong>. You have ${money(sum.cash)} in virtual cash.`, '<a class="btn btn-primary" href="#/markets">Browse companies</a>')
    }
  </section>
  <div class="grid two-col section-gap">
    <section class="card" aria-labelledby="alloc-h">
      <h2 id="alloc-h" style="margin-bottom:12px">Allocation</h2>
      ${allocationBar(alloc.segments)}
      <p class="small" style="margin-top:12px;color:var(--text-2)">${esc(divNote)}</p>
      <a class="small" href="#/learn">What is diversification?</a>
    </section>
    <section class="card" aria-labelledby="ru-h">
      <h2 id="ru-h" style="margin-bottom:8px">Realized vs. unrealized</h2>
      <p class="small" style="color:var(--text-2)"><strong>Unrealized</strong> simulated gains (${E.formatSignedCents(sum.unrealized)}) are “on paper”: they change every day with fictional prices until you sell.</p>
      <p class="small" style="color:var(--text-2)"><strong>Realized</strong> simulated gains (${E.formatSignedCents(sum.realized)}) were locked in when you sold shares for more or less than your average purchase price.</p>
      <p class="small" style="color:var(--text-2)"><strong>Dividends</strong> received so far: ${money(sum.dividends)} in virtual cash.</p>
      <div class="kv-row"><span class="muted">Realized + unrealized + dividends</span><strong>${E.formatSignedCents(sum.realized + sum.unrealized + sum.dividends)}</strong></div>
      <div class="kv-row"><span class="muted">Total simulated gains</span><strong>${E.formatSignedCents(sum.gain)}</strong></div>
      <p class="hint">Execution costs paid so far (${money(sum.execCosts)} in spreads and slippage) are already included in these numbers, because they are part of each trade’s price.</p>
    </section>
  </div>`;
}
