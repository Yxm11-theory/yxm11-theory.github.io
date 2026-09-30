// Lightweight interactive SVG charts (no dependencies): multi-series lines, optional volume bars,
// event markers, pointer/touch/keyboard inspection, and sparklines.

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
const compactNum = (v) => (v >= 1e6 ? (v / 1e6).toFixed(2) + 'M' : v >= 1e3 ? (v / 1e3).toFixed(1) + 'K' : String(Math.round(v)));

/**
 * Render an interactive line chart.
 * opts: series [{points:[{day,value}], label, color?, dashed?}] (or points + label for one series),
 *       formatValue, formatAxis, markers [{day, tone, text}], volumes [{day, value}], baseline,
 *       height, emptyText, label
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
  const series = opts.series || [{ points: opts.points, label: opts.label }];
  const { label, formatValue, formatAxis = formatValue, markers = [], emptyText, baseline, volumes } = opts;
  const main = series[0].points;
  container.classList.add('chart');
  if (!main || main.length < 2) {
    container.innerHTML = `<div class="chart-empty">${esc(emptyText || 'Not enough data to chart yet.')}</div>`;
    return;
  }
  const width = Math.max(260, container.clientWidth || 600);
  const height = opts.height || (width < 520 ? 230 : 290);
  const volH = volumes ? Math.round((height - 42) * 0.2) : 0;
  const pad = { top: 14, right: 12, bottom: 28 + volH, left: width < 520 ? 52 : 64 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const n = main.length;
  const days = main.map((p) => p.day);
  const lookups = series.map((s) => new Map(s.points.map((p) => [p.day, p.value])));
  const values = [];
  lookups.forEach((m) => days.forEach((d) => m.has(d) && values.push(m.get(d))));
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

  const x = (i) => pad.left + (i / (n - 1)) * plotW;
  const y = (v) => pad.top + (1 - (v - min) / (max - min)) * plotH;
  const first = main[0].value;
  const last = main[n - 1].value;
  const trend = last > first ? 'up' : last < first ? 'down' : 'flat';
  const gradId = `g${Math.random().toString(36).slice(2, 8)}`;

  const pathFor = (m) => {
    let d = '';
    let pen = false;
    days.forEach((day, i) => {
      if (!m.has(day)) {
        pen = false;
        return;
      }
      d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(m.get(day)).toFixed(1)}`;
      pen = true;
    });
    return d;
  };
  const mainPath = pathFor(lookups[0]);
  const area = `${mainPath}L${x(n - 1).toFixed(1)},${(pad.top + plotH).toFixed(1)}L${x(0).toFixed(1)},${(pad.top + plotH).toFixed(1)}Z`;

  let volSvg = '';
  let volMap = null;
  if (volumes) {
    volMap = new Map(volumes.map((v) => [v.day, v.value]));
    const vmax = Math.max(1, ...days.map((d) => volMap.get(d) || 0));
    const bw = Math.max(1, plotW / n - 1);
    const base = height - 28;
    volSvg = `<g class="chart-vol" aria-hidden="true">${days
      .map((d, i) => {
        const v = volMap.get(d) || 0;
        const h = (v / vmax) * (volH - 4);
        return `<rect x="${(x(i) - bw / 2).toFixed(1)}" y="${(base - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}"/>`;
      })
      .join('')}</g>`;
  }

  const xTickCount = width < 520 ? 3 : 5;
  const xTicks = [];
  for (let k = 0; k <= xTickCount; k++) xTicks.push(Math.round((k / xTickCount) * (n - 1)));

  const dayIndex = new Map(days.map((d, i) => [d, i]));
  const markerByIndex = new Map();
  for (const m of markers) {
    const i = dayIndex.get(m.day);
    if (i == null || !lookups[0].has(m.day)) continue;
    if (!markerByIndex.has(i)) markerByIndex.set(i, []);
    markerByIndex.get(i).push(m);
  }

  const mainVals = main.map((p) => p.value);
  const summary =
    `${label || series[0].label}. ${n} days from Day ${days[0]} to Day ${days[n - 1]}. ` +
    series
      .map((s, k) => {
        const vs = days.filter((d) => lookups[k].has(d)).map((d) => lookups[k].get(d));
        return vs.length ? `${s.label}: starts ${formatValue(vs[0])}, ends ${formatValue(vs[vs.length - 1])}` : '';
      })
      .join('. ') +
    `. Low ${formatValue(Math.min(...mainVals))}, high ${formatValue(Math.max(...mainVals))}. Use left and right arrow keys to inspect days.`;

  const seriesSvg = series
    .map((s, k) =>
      k === 0
        ? `<path class="chart-line" d="${mainPath}" aria-hidden="true" ${s.color ? `style="stroke:${s.color}"` : ''}/>`
        : `<path class="chart-line chart-line-2 ${s.dashed ? 'dashed' : ''}" d="${pathFor(lookups[k])}" style="stroke:${s.color || 'var(--accent)'}" aria-hidden="true"/>`,
    )
    .join('');

  container.innerHTML = `
    <svg class="chart-svg trend-${trend}" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"
         tabindex="0" role="img" aria-label="${esc(summary)}">
      <defs>
        <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="currentColor" stop-opacity="${series.length > 1 ? 0.12 : 0.26}"/>
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
          .map((i) => `<text x="${x(i).toFixed(1)}" y="${height - 8}" text-anchor="${i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}">Day ${days[i]}</text>`)
          .join('')}
      </g>
      ${volSvg}
      ${baseline != null ? `<line class="chart-baseline" aria-hidden="true" x1="${pad.left}" x2="${width - pad.right}" y1="${y(baseline).toFixed(1)}" y2="${y(baseline).toFixed(1)}"/>` : ''}
      <path class="chart-area" d="${area}" fill="url(#${gradId})" aria-hidden="true"/>
      ${seriesSvg}
      <g aria-hidden="true">
        ${[...markerByIndex.entries()]
          .map(([i, ms]) => {
            const tones = new Set(ms.map((m) => m.tone));
            const t = tones.size > 1 ? 'neutral' : ms[0].tone;
            return `<circle class="chart-marker tone-${t}" cx="${x(i).toFixed(1)}" cy="${y(lookups[0].get(days[i])).toFixed(1)}" r="4.5"/>`;
          })
          .join('')}
      </g>
      <g class="chart-cursor" aria-hidden="true" style="display:none">
        <line class="chart-cross" y1="${pad.top}" y2="${height - 28}"/>
        <circle class="chart-dot" r="5"/>
      </g>
      <rect class="chart-hit" x="${pad.left}" y="${pad.top}" width="${plotW}" height="${height - 28 - pad.top}" fill="transparent"/>
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
    const day = days[active];
    const v0 = lookups[0].get(day);
    const cx = x(active);
    const cy = y(v0);
    cursor.style.display = '';
    cross.setAttribute('x1', cx);
    cross.setAttribute('x2', cx);
    dot.setAttribute('cx', cx);
    dot.setAttribute('cy', cy);
    const change = first ? v0 / first - 1 : 0;
    const ms = markerByIndex.get(active) || [];
    const extra = series
      .slice(1)
      .map((s, k) => (lookups[k + 1].has(day) ? `<span class="tip-series"><i style="background:${s.color || 'var(--accent)'}"></i>${esc(s.label)}: ${esc(formatValue(lookups[k + 1].get(day)))}</span>` : ''))
      .join('');
    tip.innerHTML = `<strong>Day ${day}</strong><span class="tip-value">${series.length > 1 ? `${esc(series[0].label)}: ` : ''}${esc(formatValue(v0))}</span>
      <span class="tip-change ${change >= 0 ? 'pos' : 'neg'}">${change >= 0 ? '▲' : '▼'} ${Math.abs(change * 100).toFixed(2)}% vs. range start</span>
      ${extra}
      ${volMap ? `<span class="tip-series">Volume: ${compactNum(volMap.get(day) || 0)} shares</span>` : ''}
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
