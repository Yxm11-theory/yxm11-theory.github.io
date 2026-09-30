// MarketLab engine facade: pure game logic with no DOM access, so it can be unit-tested in Node.
// All money is stored as integer cents; company fundamentals are in millions of virtual dollars.
export * from './constants.js';
export * from './catalog.js';
export * from './securities.js';
export { createGame, advanceDay, randomSeedText } from './game.js';
export { parseQuantity, sharesOwned, availableCash, maxAffordable, buy, sell } from './trading.js';
export { portfolioSummary, sectorsHeld, maxDrawdown, CHALLENGES, checkChallenges } from './portfolio.js';
export { companyMetrics, fairValue, ttm } from './fundamentals.js';
export { NEWS_TYPES } from './news.js';
export { economyLabel } from './market.js';
export { serialize, deserialize, migrateV1 } from './save.js';
export { resultsSummary, resultsText, transactionsCsv, transactionRow, TX_LABELS } from './exports.js';
export { hashSeed } from './rng.js';
