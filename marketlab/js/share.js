// Draws a shareable results card. The full simulation disclaimer is always part of the image.
import { DISCLAIMER, NOT_PREDICTIVE, CHALLENGES, formatCents, formatSignedCents, formatPct, portfolioSummary } from './engine.js';

function wrap(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawShareCard(state) {
  const W = 1200;
  const H = 675;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const font = (size, weight = 500) => `${weight} ${size}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  const sum = portfolioSummary(state);
  const up = sum.gain >= 0;
  const done = CHALLENGES.filter((c) => state.challenges[c.id]).length;

  // Background
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#0b1020');
  bg.addColorStop(1, '#111a2e');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Top disclaimer strip
  ctx.fillStyle = '#3b2a06';
  ctx.fillRect(0, 0, W, 54);
  ctx.fillStyle = '#fde68a';
  ctx.font = font(24, 800);
  ctx.textBaseline = 'middle';
  ctx.fillText('SIMULATION ONLY  ·  FICTIONAL EDUCATIONAL GAME  ·  NOT REAL MONEY', 48, 28);

  // Brand
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#7c9cff';
  roundRect(ctx, 48, 86, 52, 52, 12);
  ctx.fill();
  ctx.fillStyle = '#0b1020';
  ctx.font = font(26, 800);
  ctx.fillText('ML', 56, 122);
  ctx.fillStyle = '#e8eef9';
  ctx.font = font(40, 800);
  ctx.fillText('MarketLab', 116, 124);
  ctx.fillStyle = '#9fb0c9';
  ctx.font = font(22);
  ctx.fillText('Fictional stock market simulator', 118, 154);
  ctx.textAlign = 'right';
  ctx.fillText(`Trading day ${state.day}`, W - 48, 124);
  ctx.textAlign = 'left';

  // Stats
  const stats = [
    ['Total virtual value', formatCents(sum.total), '#e8eef9'],
    ['Simulated gains', `${formatSignedCents(sum.gain)} (${formatPct(sum.gainPct)})`, up ? '#4ade80' : '#f87171'],
    ['Challenges', `${done} / ${CHALLENGES.length}`, '#e8eef9'],
  ];
  const colW = (W - 96 - 40) / 3;
  stats.forEach(([label, value, color], i) => {
    const x = 48 + i * (colW + 20);
    ctx.fillStyle = '#151f36';
    roundRect(ctx, x, 190, colW, 128, 16);
    ctx.fill();
    ctx.fillStyle = '#9fb0c9';
    ctx.font = font(22, 600);
    ctx.fillText(label, x + 24, 232);
    ctx.fillStyle = color;
    let size = 40;
    ctx.font = font(size, 800);
    while (ctx.measureText(value).width > colW - 48 && size > 22) ctx.font = font(--size, 800);
    ctx.fillText(value, x + 24, 290);
  });

  // Value sparkline
  const vals = state.valueHistory.map((v) => v.value);
  const chartX = 48;
  const chartY = 342;
  const chartW = W - 96;
  const chartH = 120;
  ctx.fillStyle = '#151f36';
  roundRect(ctx, chartX, chartY, chartW, chartH, 16);
  ctx.fill();
  if (vals.length >= 2) {
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const r = max - min || 1;
    ctx.strokeStyle = up ? '#4ade80' : '#f87171';
    ctx.lineWidth = 4;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    vals.forEach((v, i) => {
      const px = chartX + 20 + (i / (vals.length - 1)) * (chartW - 40);
      const py = chartY + chartH - 18 - ((v - min) / r) * (chartH - 36);
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    });
    ctx.stroke();
  } else {
    ctx.fillStyle = '#9fb0c9';
    ctx.font = font(22);
    ctx.fillText('Virtual value chart appears after the first simulated day.', chartX + 24, chartY + 68);
  }

  // Disclaimer box (full text, always included)
  const boxY = 482;
  ctx.fillStyle = '#2a1f06';
  roundRect(ctx, 48, boxY, W - 96, H - boxY - 28, 16);
  ctx.fill();
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#fde68a';
  ctx.font = font(23, 600);
  const lines = wrap(ctx, `${DISCLAIMER} ${NOT_PREDICTIVE}`, W - 96 - 48);
  lines.forEach((l, i) => ctx.fillText(l, 72, boxY + 40 + i * 32));

  return canvas;
}

export function shareText(state) {
  const sum = portfolioSummary(state);
  const done = CHALLENGES.filter((c) => state.challenges[c.id]).length;
  return (
    `MarketLab (fictional stock market simulator) — Day ${state.day}: total virtual value ${formatCents(sum.total)}, ` +
    `simulated gains ${formatSignedCents(sum.gain)} (${formatPct(sum.gainPct)}), ${done}/${CHALLENGES.length} challenges.\n\n` +
    `${DISCLAIMER} ${NOT_PREDICTIVE}`
  );
}
