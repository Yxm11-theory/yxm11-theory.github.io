// Challenges plus result exports and share cards.
import * as E from '../../engine.js';
import { drawShareCard } from '../../share.js';
import { esc, money } from '../util.js';

export const title = () => 'Challenges';

export function render(ctx) {
  const { state, ui } = ctx;
  const done = E.CHALLENGES.filter((c) => state.challenges[c.id]).length;
  const items = E.CHALLENGES.map((c) => {
    const d = state.challenges[c.id];
    const cur = d ? c.target : Math.min(c.target, c.progress(state));
    const r = cur / c.target;
    const fmt = (v) => (c.money ? money(v) : v.toLocaleString('en-US'));
    return `<li class="ch ${d ? 'done' : ''}">
      <span class="ch-icon" aria-hidden="true">${d ? '✓' : '🏁'}</span>
      <div>
        <h3>${esc(c.title)} ${d ? '<span class="sr-only">(completed)</span>' : ''}</h3>
        <p>${esc(c.description)}</p>
        <div class="progress" role="progressbar" aria-label="${esc(c.title)} progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(r * 100)}"><span style="width:${r * 100}%"></span></div>
        <div class="ch-foot"><span>${d ? `Completed on Day ${d.day}` : `${fmt(cur)} / ${fmt(c.target)}`}</span><span>${Math.round(r * 100)}%</span></div>
      </div>
    </li>`;
  }).join('');
  let shareImg = '';
  if (ui.showShare) {
    const canvas = drawShareCard(state);
    shareImg = `<img class="share-preview" src="${canvas.toDataURL('image/png')}" alt="MarketLab share card for Day ${state.day}. ${esc(E.DISCLAIMER)}">`;
  }
  return `
  <div class="page-head"><div><h1 tabindex="-1">Challenges</h1><p>${done} of ${E.CHALLENGES.length} completed. Challenges are just for learning and fun — there are no prizes, cash, or rewards.</p></div></div>
  <ul class="ch-list">${items}</ul>
  <section class="card section-gap" aria-labelledby="results-h">
    <h2 id="results-h" style="margin-bottom:6px">Export &amp; share your results</h2>
    <p class="small muted">Every export and share card includes the full simulation notice: ${esc(E.DISCLAIMER)} ${esc(E.NOT_PREDICTIVE)}</p>
    <div class="btn-row" style="margin-top:10px">
      <button type="button" class="btn" data-action="export-txt">Download results (.txt)</button>
      <button type="button" class="btn" data-action="export-json">Download results (.json)</button>
      <button type="button" class="btn" data-action="share-card" aria-expanded="${ui.showShare}">${ui.showShare ? 'Hide share card' : 'Create share card'}</button>
      <button type="button" class="btn" data-action="copy-share">Copy share text</button>
    </div>
    ${ui.showShare ? `${shareImg}<div class="btn-row" style="margin-top:10px"><button type="button" class="btn btn-primary" data-action="download-card">Download share card (.png)</button></div>` : ''}
  </section>`;
}
