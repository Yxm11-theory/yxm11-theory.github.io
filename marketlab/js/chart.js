// Lightweight interactive SVG line charts and sparklines (no dependencies).

const observers = new Set();

/** Disconnect resize observers from charts that are about to be replaced. */
export function disposeCharts() {
  for (const ro of observers) ro.disconnect();
  observers.clear();
}

function niceStep(range, count) {
  const raw = range / Math.max(1, count);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  return (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
}

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

/**
 * Render an interactive line chart.
 * opts: points [{day, value}], label, formatValue, formatAxis, markers [{day, tone, text}],
 *       height, emptyText, baseline (optional horizontal reference value)
 */
export function lineChart(container, opts) {
  const draw = () => drawChart(container, opts);
  draw();
  let lastWidth = container.clientWidth;
  const ro = new ResizeObserver(() => {
    if (Math.abs(container.clientWidth - lastWidth) > 4) {
      lastWidth = container.clientWidth;
      draw();
    }
  });
  ro.observe(container);
  observers.add(ro);
}

function drawChart(container, opts) {
  const { points, label, formatValue, formatAxis = formatValue, markers = [], emptyText, baseline } = opts;
  container.classList.add('chart');
  if (!points || points.length < 2) {
    container.innerHTML = `<div class="chart-empty">${esc(emptyText || 'Not enough data to chart yet.')}</div>`;
    return;
  }
  const width = Math.max(260, container.clientWidth || 600);
  const height = opts.height || (width < 520 ? 220 : 280);
  const pad = { top: 14, right: 12, bottom: 28, left: width < 520 ? 50 : 62 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const values = points.map((p) => p.value);
  if (baseline != null) values.push(baseline);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    min -= Math.max(1, Math.abs(min) * 0.05);
    max += Math.max(1, Math.abs(max) * 0.05);
  }
  const span = max - min;
  min -= span * 0.08;
  max += span * 0.08;
  const step = niceStep(max - min, 4);
  const ticks = [];
  for (let t = Math.ceil(min / step) * step; t <= max; t += step) ticks.push(t);

  const n = points.length;
  const x = (i) => pad.left + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v) => pad.top + (1 - (v - min) / (max - min)) * plotH;

  const first = points[0].value;
  const last = points[n - 1].value;
  const trend = last > first ? 'up' : last < first ? 'down' : 'flat';
  const gradId = `g${Math.random().toString(36).slice(2, 8)}`;

  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join('');
  const area = `${line}L${x(n - 1).toFixed(1)},${(pad.top + plotH).toFixed(1)}L${x(0).toFixed(1)},${(pad.top + plotH).toFixed(1)}Z`;

  const xTickCount = width < 520 ? 3 : 5;
  const xTicks = [];
  for (let k = 0; k <= xTickCount; k++) xTicks.push(Math.round((k / xTickCount) * (n - 1)));

  const dayIndex = new Map(points.map((p, i) => [p.day, i]));
  const markerByIndex = new Map();
  for (const m of markers) {
    const i = dayIndex.get(m.day);
    if (i == null) continue;
    if (!markerByIndex.has(i)) markerByIndex.set(i, []);
    markerByIndex.get(i).push(m);
  }

  const summary = `${label}. ${n} days from Day ${points[0].day} to Day ${points[n - 1].day}. Starts at ${formatValue(first)}, ends at ${formatValue(last)}, low ${formatValue(Math.min(...points.map((p) => p.value)))}, high ${formatValue(Math.max(...points.map((p) => p.value)))}. Use left and right arrow keys to inspect days.`;

  container.innerHTML = `
    <svg class="chart-svg trend-${trend}" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"
         tabindex="0" role="img" aria-label="${esc(summary)}">
      <defs>
        <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="currentColor" stop-opacity="0.28"/>
          <stop offset="100%" stop-color="currentColor" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <g class="chart-grid" aria-hidden="true">
        ${ticks
          .map(
            (t) => `<line x1="${pad.left}" x2="${width - pad.right}" y1="${y(t).toFixed(1)}" y2="${y(t).toFixed(1)}"/>
                    <text x="${pad.left - 8}" y="${(y(t) + 4).toFixed(1)}" text-anchor="end">${esc(formatAxis(t))}</text>`,
          )
          .join('')}
        ${xTicks
          .map(
            (i) => `<text x="${x(i).toFixed(1)}" y="${height - 8}" text-anchor="${i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}">Day ${points[i].day}</text>`,
          )
          .join('')}
      </g>
      ${baseline != null ? `<line class="chart-baseline" aria-hidden="true" x1="${pad.left}" x2="${width - pad.right}" y1="${y(baseline).toFixed(1)}" y2="${y(baseline).toFixed(1)}"/>` : ''}
      <path class="chart-area" d="${area}" fill="url(#${gradId})" aria-hidden="true"/>
      <path class="chart-line" d="${line}" aria-hidden="true"/>
      <g aria-hidden="true">
        ${[...markerByIndex.entries()]
          .map(([i, ms]) => {
            const tone = ms.some((m) => m.tone === 'negative') ? (ms.some((m) => m.tone === 'positive') ? 'neutral' : 'negative') : ms[0].tone;
            return `<circle class="chart-marker tone-${tone}" cx="${x(i).toFixed(1)}" cy="${y(points[i].value).toFixed(1)}" r="4.5"/>`;
          })
          .join('')}
      </g>
      <g class="chart-cursor" aria-hidden="true" style="display:none">
        <line class="chart-cross" y1="${pad.top}" y2="${pad.top + plotH}"/>
        <circle class="chart-dot" r="5"/>
      </g>
      <rect class="chart-hit" x="${pad.left}" y="${pad.top}" width="${plotW}" height="${plotH}" fill="transparent"/>
    </svg>
    <div class="chart-tip" role="status" aria-live="polite" hidden></div>`;

  const svg = container.querySelector('svg');
  const cursor = svg.querySelector('.chart-cursor');
  const cross = svg.querySelector('.chart-cross');
  const dot = svg.querySelector('.chart-dot');
  const tip = container.querySelector('.chart-tip');
  let active = -1;

  const show = (i) => {
    active = Math.max(0, Math.min(n - 1, i));
    const p = points[active];
    const cx = x(active);
    const cy = y(p.value);
    cursor.style.display = '';
    cross.setAttribute('x1', cx);
    cross.setAttribute('x2', cx);
    dot.setAttribute('cx', cx);
    dot.setAttribute('cy', cy);
    const change = first ? (p.value - first) / first : 0;
    const ms = markerByIndex.get(active) || [];
    tip.innerHTML = `<strong>Day ${p.day}</strong><span class="tip-value">${esc(formatValue(p.value))}</span>
      <span class="tip-change ${change >= 0 ? 'pos' : 'neg'}">${change >= 0 ? '▲' : '▼'} ${Math.abs(change * 100).toFixed(2)}% vs. range start</span>
      ${ms.map((m) => `<span class="tip-event tone-${m.tone}">Fictional event: ${esc(m.text)}</span>`).join('')}`;
    tip.hidden = false;
    const tipW = tip.offsetWidth;
    let left = cx + 12;
    if (left + tipW > width - 4) left = cx - tipW - 12;
    tip.style.left = `${Math.max(4, left)}px`;
    tip.style.top = `${Math.max(4, Math.min(cy - 20, height - tip.offsetHeight - 30))}px`;
  };
  const hide = () => {
    active = -1;
    cursor.style.display = 'none';
    tip.hidden = true;
  };
  const indexFromEvent = (e) => {
    const rect = svg.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * width;
    return Math.round(((px - pad.left) / plotW) * (n - 1));
  };

  svg.addEventListener('pointermove', (e) => show(indexFromEvent(e)));
  svg.addEventListener('pointerdown', (e) => show(indexFromEvent(e)));
  svg.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'mouse') hide();
  });
  svg.addEventListener('blur', hide);
  svg.addEventListener('keydown', (e) => {
    const moves = { ArrowLeft: -1, ArrowRight: 1, PageUp: -10, PageDown: 10 };
    if (e.key in moves) show((active < 0 ? n - 1 : active) + moves[e.key]);
    else if (e.key === 'Home') show(0);
    else if (e.key === 'End') show(n - 1);
    else if (e.key === 'Escape') hide();
    else return;
    e.preventDefault();
  });
}

/** Tiny decorative trend line. */
export function sparkline(values, { width = 96, height = 30 } = {}) {
  if (!values || values.length < 2) return '';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const r = max - min || 1;
  const pts = values
    .map((v, i) => `${((i / (values.length - 1)) * width).toFixed(1)},${(height - 2 - ((v - min) / r) * (height - 4)).toFixed(1)}`)
    .join(' ');
  const trend = values[values.length - 1] >= values[0] ? 'up' : 'down';
  return `<svg class="sparkline trend-${trend}" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" aria-hidden="true" focusable="false"><polyline points="${pts}"/></svg>`;
}
