// Calendar: upcoming earnings reports (with consensus estimates) and recent results.
import * as E from '../../engine.js';
import { chg, mark, emptyState, filterChips, SECTOR_OPTIONS, secLink, dollars2, plural } from '../util.js';

export const title = () => 'Calendar';

export function upcomingEvents(state, horizon = E.QUARTER_DAYS) {
  const events = [];
  for (const c of E.COMPANIES) {
    const cs = state.companies[c.id];
    if (cs.status !== 'active') continue;
    if (cs.nextEarnings <= state.day + horizon) events.push({ day: cs.nextEarnings, kind: 'earnings', spec: c, est: cs.est });
    if (cs.exDay && cs.exDay > state.day && cs.exDay <= state.day + horizon) events.push({ day: cs.exDay, kind: 'dividend', spec: c, dps: cs.dps });
  }
  return events.sort((a, b) => a.day - b.day || a.spec.name.localeCompare(b.spec.name));
}

export function render(ctx) {
  const { state, ui } = ctx;
  const inSector = (spec) => ui.calSector === 'all' || spec.sector === ui.calSector;
  const events = upcomingEvents(state).filter((e) => inSector(e.spec));
  const byDay = new Map();
  for (const e of events) {
    if (!byDay.has(e.day)) byDay.set(e.day, []);
    byDay.get(e.day).push(e);
  }
  const recent = [];
  for (const c of E.COMPANIES) {
    if (!inSector(c)) continue;
    for (const q of state.companies[c.id].quarters) if (q.day > state.day - 30 && q.est != null) recent.push({ c, q });
  }
  recent.sort((a, b) => b.q.day - a.q.day);

  return `
  <div class="page-head"><div><h1 tabindex="-1">Calendar</h1><p>Scheduled fictional earnings reports and ex-dividend days for the next quarter (${E.QUARTER_DAYS} trading days).</p></div></div>
  ${filterChips('cal-sector', SECTOR_OPTIONS, ui.calSector, 'Filter calendar by sector')}
  <div class="grid two-col section-gap">
    <section class="card" aria-labelledby="up-h">
      <div class="card-head"><h2 id="up-h">Coming up</h2><span class="sub">${plural(events.length, 'event')}</span></div>
      <p class="hint">Dates are known in advance, but results are not: the estimate is the market’s expectation, and the price moves on the surprise.</p>
      ${
        byDay.size
          ? `<ol class="cal-list">${[...byDay.entries()]
              .map(
                ([day, list]) => `<li><div class="cal-day"><strong>Day ${day}</strong><span class="muted small">${day === state.day + 1 ? 'Tomorrow' : `in ${plural(day - state.day, 'day')}`}</span></div>
                <ul class="mini-list">${list
                  .map((e) =>
                    e.kind === 'earnings'
                      ? `<li><span class="mini-name">${mark(e.spec, 'sm')}${secLink(e.spec)}</span><span class="tag-kind">Earnings</span><span class="num small">Est. EPS ${dollars2(e.est)}</span></li>`
                      : `<li><span class="mini-name">${mark(e.spec, 'sm')}${secLink(e.spec)}</span><span class="tag-kind div">Ex-dividend</span><span class="num small">${dollars2(e.dps)} / share</span></li>`,
                  )
                  .join('')}</ul></li>`,
              )
              .join('')}</ol>`
          : emptyState('📅', 'Nothing scheduled', 'No reports in this sector over the next quarter.')
      }
    </section>
    <section class="card" aria-labelledby="rec-h">
      <div class="card-head"><h2 id="rec-h">Recent results</h2><span class="sub">Last 30 days</span></div>
      ${
        recent.length
          ? `<ul class="mini-list">${recent
              .slice(0, 25)
              .map(({ c, q }) => `<li><span class="mini-name">${mark(c, 'sm')}${secLink(c, c.ticker)}</span><span class="muted small">Day ${q.day} · EPS ${dollars2(q.eps)} vs ${dollars2(q.est)}</span>${chg(q.surprisePct)}</li>`)
              .join('')}</ul>`
          : emptyState('🧾', 'No recent results', 'Results will appear here as companies report.')
      }
    </section>
  </div>`;
}

export const actions = {
  'cal-sector'(ctx, el) {
    ctx.ui.calSector = el.dataset.filter;
    ctx.app.render();
  },
};
