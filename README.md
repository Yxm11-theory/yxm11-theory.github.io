# yxm11-theory.github.io

Static site served by GitHub Pages at [yxm11.com](https://yxm11.com) (see `CNAME`). There is no build step: files are published exactly as they appear in the repository.

## MarketLab — fictional stock market simulator

> **SIMULATION ONLY.** All money, companies, prices, and news are fictional. No real trades occur. Virtual funds have no monetary value and cannot be withdrawn. This is not investment advice.

MarketLab is an educational game at [`/marketlab/`](marketlab/). Players start with $10,000 in virtual cash and trade whole shares in five invented companies (technology, energy, healthcare, retail, aerospace) while a simulated market moves day by day.

- **No login, backend, API keys, or paid services.** Plain HTML, CSS, and ES modules with no dependencies.
- **Progress is saved in `localStorage`** (key `marketlab:save:v1`) and can be reset from the footer.

### Run locally

ES modules need to be served over HTTP (opening the file directly won't work):

```sh
python3 -m http.server 8000   # or: npm run serve
# then open http://localhost:8000/marketlab/
```

### Tests

The simulation engine is pure JavaScript and is tested with Node's built-in test runner (Node 18+):

```sh
npm test    # same as: node --test marketlab/tests/*.test.mjs
```

### Layout

| File | Purpose |
| --- | --- |
| `marketlab/index.html` | Page shell, simulation banner, first-run notice, reset dialog |
| `marketlab/css/styles.css` | Dark dashboard theme and responsive layout |
| `marketlab/js/engine.js` | Market model, trading rules, challenges, save/load, exports (no DOM) |
| `marketlab/js/app.js` | Routing, views, trading UI, autoplay, persistence |
| `marketlab/js/chart.js` | Interactive SVG price charts and sparklines |
| `marketlab/js/share.js` | Share-card image, which always includes the disclaimer |
| `marketlab/tests/engine.test.mjs` | Engine unit tests |
