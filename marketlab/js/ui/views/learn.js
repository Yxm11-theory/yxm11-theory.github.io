// Learn: short explanations of the ideas MarketLab teaches, and how its simplified model works.
import * as E from '../../engine.js';
import { esc } from '../util.js';

export const title = () => 'Learn';

const SECTIONS = [
  {
    id: 'l-model',
    title: 'A simplified model, not a forecast',
    warn: true,
    html: () => `<p>${esc(E.MODEL_NOTE)}</p>
      <p>MarketLab’s rules are invented to illustrate real ideas — diversification, volatility, valuation, surprises, costs — in a safe, fictional setting. Real markets are shaped by many things this game leaves out, and results here say nothing about real investments.</p>`,
  },
  {
    id: 'l-fund',
    title: 'Company fundamentals',
    html: () => `<p>Every fictional company has a simple business behind it: revenue that grows or shrinks, a profit margin, cash, debt, and a dividend policy. Companies report results every quarter (${E.QUARTER_DAYS} trading days).</p>
      <ul>
        <li><strong>Revenue</strong> is money coming in from sales. <strong>Net income</strong> is what is left after costs and interest.</li>
        <li><strong>Earnings per share (EPS)</strong> divides net income by the number of shares. <strong>P/E</strong> is the price divided by a year of EPS: how many years of current profits the price represents.</li>
        <li><strong>Debt</strong> must be paid interest. Heavily indebted companies are more sensitive to interest rates and hard times.</li>
        <li>A <strong>dividend yield</strong> is a year of dividends divided by the price.</li>
      </ul>
      <div class="example"><strong>Example:</strong> A $50 stock with $2.50 of yearly EPS has a P/E of 20. A high P/E often means investors expect fast growth — it is not automatically “expensive,” and a low P/E is not automatically a bargain.</div>`,
  },
  {
    id: 'l-surprise',
    title: 'Earnings surprises and expectations',
    html: () => `<p>Before each report, fictional analysts publish a <strong>consensus estimate</strong>. Prices already reflect what investors expect, so the reaction depends on the <strong>surprise</strong>: the difference between actual results and expectations.</p>
      <div class="example"><strong>Example:</strong> A company expected to lose $0.40 per share that loses only $0.10 has a positive surprise — its price may rise even though it lost money. A company expected to earn $2.00 that earns $1.80 may fall despite a healthy profit.</div>`,
  },
  {
    id: 'l-div',
    title: 'Diversification',
    html: () => `<p>Diversification means spreading money across different investments so one bad outcome doesn’t sink everything. MarketLab’s 30 companies sit in 8 sectors that react differently to the economy.</p>
      <div class="example"><strong>Example:</strong> Put all $10,000 in one company and a −12% setback costs $1,200. Split evenly across ten companies in different sectors and the same event costs about $120.</div>
      <p>Diversification has limits: economy-wide events tend to move most stocks in the same direction at once.</p>`,
  },
  {
    id: 'l-vol',
    title: 'Volatility',
    html: () => `<p>Volatility measures how much a price typically swings from day to day. Each company page shows its 30-day volatility. High volatility means larger potential gains <em>and</em> larger potential losses — it measures uncertainty, not quality.</p>
      <div class="example"><strong>Example:</strong> A stock with 1.5% daily volatility commonly moves about ±$1.50 on a $100 price. One with 3.5% commonly moves ±$3.50, and occasionally much more.</div>`,
  },
  {
    id: 'l-gain',
    title: 'Realized vs. unrealized gains',
    html: () => `<p>An <strong>unrealized</strong> gain (or loss) is the difference between what your shares are worth now and what you paid. It exists only on paper and changes every day.</p>
      <p>A <strong>realized</strong> gain (or loss) happens when you sell. MarketLab uses your <em>average purchase price</em> to calculate it.</p>
      <div class="example"><strong>Example:</strong> Buy 10 shares at $50 and 10 more at $70. Your average price is $60. Sell 5 at $80: you realize (80 − 60) × 5 = <span class="pos">+$100</span>. The other 15 shares carry an unrealized gain of $300 until you sell them or the price changes.</div>`,
  },
];

export function render() {
  return `
  <div class="learn">
  <div class="page-head"><div><h1 tabindex="-1">Learn the basics</h1><p>Short explanations of the ideas MarketLab is designed to teach, and how its simplified model works.</p></div></div>
  <nav class="card toc" aria-label="On this page"><ul>${SECTIONS.map((s) => `<li><a href="#/learn" data-action="jump" data-target="${s.id}">${esc(s.title)}</a></li>`).join('')}</ul></nav>
  <div class="stack section-gap">
    ${SECTIONS.map((s) => `<section class="card" id="${s.id}" aria-labelledby="${s.id}-h" ${s.warn ? 'style="border-color:var(--warn-border)"' : ''}><h2 id="${s.id}-h">${esc(s.title)}</h2>${s.html()}</section>`).join('')}
    <section class="card" aria-labelledby="l-not" style="border-color:var(--warn-border)">
      <h2 id="l-not">Remember: it’s a simulation</h2>
      <p>${esc(E.DISCLAIMER)}</p>
      <p>${esc(E.NOT_PREDICTIVE)} Real markets involve fees, taxes, real companies, and risks this game leaves out. Talk to a qualified, licensed professional before making real financial decisions.</p>
    </section>
  </div>
  </div>`;
}

export const actions = {
  jump(ctx, el, e) {
    e.preventDefault();
    const target = document.getElementById(el.dataset.target);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      target.querySelector('h2')?.setAttribute('tabindex', '-1');
      target.querySelector('h2')?.focus({ preventScroll: true });
    }
  },
};
export { SECTIONS };
