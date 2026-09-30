// Shared UI helpers and HTML fragments.
import * as E from '../engine.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
export const money = E.formatCents;
export const tone = (v) => (v > 0 ? 'pos' : v < 0 ? 'neg' : 'flat');
export const plural = (n, word, pluralWord = `${word}s`) => `${n.toLocaleString('en-US')} ${n === 1 ? word : pluralWord}`;
export const dollars2 = (cents) => (cents < 0 ? '−' : '') + '$' + (Math.abs(cents) / 100).toFixed(2);

export function chg(ratio) {
  const t = !Number.isFinite(ratio) || Math.abs(ratio) < 0.00005 ? 'flat' : tone(ratio);
  const arrow = t === 'pos' ? '▲' : t === 'neg' ? '▼' : '■';
  return `<span class="chg ${t}"><span aria-hidden="true">${arrow}</span> ${E.formatPct(ratio)}</span>`;
}
export const gain = (cents) => `<span class="${tone(cents)}">${E.formatSignedCents(cents)}</span>`;
export const sectorColor = (key) => (key === 'cash' ? '#64748b' : key === 'funds' ? '#94a3b8' : E.SECTORS[key]?.color || '#94a3b8');
export function mark(spec, cls = '') {
  const color = spec.kind === 'fund' ? '#cbd5e1' : sectorColor(spec.sector);
  return `<span class="co-mark ${cls}" style="background:${color}" aria-hidden="true">${esc(spec.mark)}</span>`;
}
export const axisPrice = (v) => '$' + (v / 100).toLocaleString('en-US', { maximumFractionDigits: v < 10000 ? 2 : 0 });
export const axisValue = (v) => '$' + (v / 100000).toFixed(1) + 'k';
export const secLink = (spec, text = spec.name) => `<a class="co-name" href="#/stock/${spec.id}">${esc(text)}</a>`;

export function flashClass(ctx, id) {
  if (!ctx.ui.flash) return '';
  const before = ctx.ui.flash[id];
  const now = E.currentPrice(ctx.state, id);
  return now > before ? 'flash-up' : now < before ? 'flash-down' : '';
}

export function emptyState(icon, title, text, action = '') {
  return `<div class="empty"><span class="empty-icon" aria-hidden="true">${icon}</span><strong>${esc(title)}</strong><p>${text}</p>${action}</div>`;
}
export const nextDayBtn = `<button type="button" class="btn btn-primary" data-action="next-day">Next Day</button>`;
export const virtualTag = '<span class="tag-virtual">Virtual</span>';
export const fictionalTag = '<span class="badge-fict">Fictional</span>';

export function statTile(label, value, sub = '', t = '') {
  return `<div class="card stat ${t ? `tone-${t}` : ''}">
    <div class="stat-label">${label}</div>
    <div class="stat-value">${value}</div>
    ${sub ? `<div class="stat-sub">${sub}</div>` : ''}
  </div>`;
}

export function filterChips(action, options, current, label) {
  return `<div class="filters" role="group" aria-label="${esc(label)}">${options
    .map(([k, l]) => `<button type="button" data-action="${action}" data-filter="${k}" aria-pressed="${current === k}">${esc(l)}</button>`)
    .join('')}</div>`;
}

export function newsItem(ctx, n, { compact = false } = {}) {
  const cos = n.companyIds.map((id) => E.securityById(id)).filter(Boolean);
  return `<li class="news-item tone-${n.tone} ${ctx.ui.freshNews.has(n.id) ? 'is-new' : ''}">
    <div class="news-meta"><span class="news-label">Fictional market event</span><span class="news-type">${esc(E.NEWS_TYPES[n.type] || 'Market')}</span><span>Day ${n.day}</span>
      ${n.impact != null && Math.abs(n.impact) >= 0.0005 ? `<span class="${tone(n.impact)}">Price reaction ${E.formatPct(n.impact, 1)}</span>` : ''}</div>
    <h3>${esc(n.headline)}</h3>
    ${compact ? '' : `<p>${esc(n.body)}</p>`}
    ${cos.length ? `<div class="news-links">${cos.map((c) => `<a href="#/stock/${c.id}">${esc(c.ticker)}</a>`).join('')}</div>` : ''}
  </li>`;
}

export function toast(title, body = '', type = 'info', ms = 4200) {
  const box = $('#toasts');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<strong>${esc(title)}</strong>${body ? `<span>${esc(body)}</span>` : ''}`;
  box.appendChild(t);
  while (box.children.length > 4) box.firstElementChild.remove();
  setTimeout(() => {
    t.classList.add('leaving');
    setTimeout(() => t.remove(), 260);
  }, ms);
}

export function announce(msg) {
  const el = $('#sr-status');
  el.textContent = '';
  setTimeout(() => (el.textContent = msg), 40);
}

export function download(filename, content, mime) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  }
}

/** Sector list options for filter chips. */
export const SECTOR_OPTIONS = [['all', 'All sectors'], ...E.SECTOR_KEYS.map((k) => [k, E.SECTORS[k].label])];
