// MarketLab catalog: fictional sectors, companies, funds, scenarios, and news templates.
// Every name, product, place, and number here is invented for an educational game.

/*
 * Sector parameters (all part of a simplified model):
 *  pe            baseline fair price/earnings multiple
 *  duration      how strongly valuations fall when expected interest rates rise (negative = benefits)
 *  cyc           revenue sensitivity to economic growth
 *  marginCyc     profit-margin sensitivity to economic growth
 *  inflRev       how much inflation passes through into revenue
 *  inflMargin    how inflation changes profit margins (costs vs. pricing power)
 *  rateMargin    margin change per 1 point of interest rates (banks earn more when rates rise)
 *  secVol        daily volatility of the sector-wide factor
 */
export const SECTORS = {
  technology: { label: 'Technology', color: '#7c9cff', pe: 26, duration: 1.5, cyc: 1.3, marginCyc: 0.6, inflRev: 0.0, inflMargin: -0.3, rateMargin: 0, secVol: 0.0055 },
  healthcare: { label: 'Healthcare', color: '#c38bff', pe: 21, duration: 0.8, cyc: 0.3, marginCyc: 0.1, inflRev: 0.2, inflMargin: -0.2, rateMargin: 0, secVol: 0.004 },
  energy: { label: 'Energy', color: '#f5b942', pe: 11, duration: 0.4, cyc: 1.2, marginCyc: 0.8, inflRev: 1.8, inflMargin: 0.8, rateMargin: 0, secVol: 0.007 },
  finance: { label: 'Finance', color: '#2dd4bf', pe: 11, duration: -0.8, cyc: 1.1, marginCyc: 0.9, inflRev: 0.3, inflMargin: 0.1, rateMargin: 1.5, secVol: 0.005 },
  consumer: { label: 'Consumer goods', color: '#fb923c', pe: 19, duration: 0.8, cyc: 0.7, marginCyc: 0.4, inflRev: 0.6, inflMargin: -0.6, rateMargin: 0, secVol: 0.0035 },
  industrials: { label: 'Industrials', color: '#38bdf8', pe: 17, duration: 1.0, cyc: 1.4, marginCyc: 0.7, inflRev: 0.3, inflMargin: -0.4, rateMargin: 0, secVol: 0.0045 },
  utilities: { label: 'Utilities', color: '#f472b6', pe: 16, duration: 1.8, cyc: 0.2, marginCyc: 0.1, inflRev: 0.4, inflMargin: -0.3, rateMargin: 0, secVol: 0.003 },
  realestate: { label: 'Real estate', color: '#d6a878', pe: 17, duration: 2.0, cyc: 0.8, marginCyc: 0.4, inflRev: 0.7, inflMargin: 0.1, rateMargin: 0, secVol: 0.004 },
};
export const SECTOR_KEYS = Object.keys(SECTORS);

/*
 * Company fields
 *  price       starting share price hint in virtual dollars (shares outstanding are sized to match)
 *  revenue     annual revenue, millions of virtual dollars
 *  margin      current net profit margin; targetMargin = long-run margin the business drifts toward
 *  growth      long-run annual revenue growth trend
 *  debt, cash  millions of virtual dollars
 *  payout      share of earnings paid as dividends (0 = no dividend)
 *  vol         annual company-specific volatility; beta = sensitivity to the overall market
 *  turnover    typical share of outstanding shares traded per day (liquidity)
 */
export const COMPANIES = [
  // ---- Technology ----
  {
    id: 'nmbw', ticker: 'NMBW.SIM', name: 'Nimbusweave Systems', sector: 'technology', mark: 'NW', product: 'WeaveOS mesh cloud',
    tagline: 'Mesh cloud computing', hq: 'Port Calder', founded: 2009,
    description: 'Nimbusweave stitches idle office and home computers into one shared supercomputer. Its WeaveOS platform rents rendering and AI-training power by the minute. Fast growth, no dividend, and big swings when expectations change.',
    price: 142, revenue: 4200, margin: 0.14, targetMargin: 0.2, growth: 0.16, debt: 800, cash: 2100, payout: 0, vol: 0.36, beta: 1.3, turnover: 0.009,
  },
  {
    id: 'qlnk', ticker: 'QLNK.SIM', name: 'Quillink Semiconductors', sector: 'technology', mark: 'QL', product: 'Prismcore photonic chips',
    tagline: 'Light-based computer chips', hq: 'Harrowgate', founded: 1994,
    description: 'Quillink designs Prismcore chips that move data with light instead of electricity. Chip demand rises and falls with the economy, so its results are cyclical even though the long-term trend is strong. Pays a small dividend.',
    price: 88, revenue: 9800, margin: 0.22, targetMargin: 0.22, growth: 0.09, debt: 2600, cash: 3400, payout: 0.2, vol: 0.32, beta: 1.4, turnover: 0.007,
  },
  {
    id: 'brvx', ticker: 'BRVX.SIM', name: 'Bramblevox Software', sector: 'technology', mark: 'BV', product: 'Ledgerleaf accounting suite',
    tagline: 'Accounting software for small firms', hq: 'Lindenmoor', founded: 2003,
    description: 'Bramblevox sells Ledgerleaf, a subscription accounting and payroll suite used by small businesses. Subscriptions make revenue steady, and the company returns about a third of its profits as dividends.',
    price: 61, revenue: 1900, margin: 0.18, targetMargin: 0.24, growth: 0.11, debt: 300, cash: 900, payout: 0.35, vol: 0.24, beta: 1.0, turnover: 0.006,
  },
  {
    id: 'lmfd', ticker: 'LMFD.SIM', name: 'Lumenfold Displays', sector: 'technology', mark: 'LF', product: 'foldable glass screens',
    tagline: 'Foldable screens and smart glasses', hq: 'Ashbourne Quay', founded: 2006,
    description: 'Lumenfold manufactures foldable glass screens and lightweight smart glasses. Thin margins and meaningful debt make its profits sensitive to both demand and borrowing costs.',
    price: 27, revenue: 3100, margin: 0.05, targetMargin: 0.09, growth: 0.07, debt: 1900, cash: 450, payout: 0, vol: 0.4, beta: 1.25, turnover: 0.01,
  },
  {
    id: 'ktsp', ticker: 'KTSP.SIM', name: 'Kitespark Robotics', sector: 'technology', mark: 'KS', product: 'Kite warehouse robots',
    tagline: 'Warehouse robots (not yet profitable)', hq: 'Cindervale', founded: 2018,
    description: 'Kitespark builds autonomous warehouse robots. Revenue is growing quickly, but the company still loses money and depends on its cash pile — a classic high-risk, high-uncertainty growth stock.',
    price: 19, revenue: 520, margin: -0.18, targetMargin: 0.12, growth: 0.35, debt: 350, cash: 380, payout: 0, vol: 0.6, beta: 1.6, turnover: 0.02,
  },
  // ---- Healthcare ----
  {
    id: 'vhlx', ticker: 'VHLX.SIM', name: 'Verdant Helix Therapeutics', sector: 'healthcare', mark: 'VH', product: 'HX gene therapies',
    tagline: 'One-time gene therapies', hq: 'Lindenmoor', founded: 2014,
    description: 'Verdant Helix develops one-time gene therapies for rare inherited conditions. Profits are small today but expected to grow, and clinical-trial news can move the stock sharply in either direction.',
    price: 87, revenue: 1400, margin: 0.08, targetMargin: 0.22, growth: 0.18, debt: 600, cash: 1300, payout: 0, vol: 0.46, beta: 0.9, turnover: 0.012,
  },
  {
    id: 'cdmr', ticker: 'CDMR.SIM', name: 'Cordmere Medical', sector: 'healthcare', mark: 'CM', product: 'Cordmere surgical monitors',
    tagline: 'Hospital devices', hq: 'Harrowgate', founded: 1971,
    description: 'Cordmere makes surgical monitors, infusion pumps, and hospital beds. Demand is steady in good times and bad, and the company pays a reliable dividend.',
    price: 132, revenue: 7600, margin: 0.15, targetMargin: 0.16, growth: 0.05, debt: 3000, cash: 1500, payout: 0.4, vol: 0.2, beta: 0.75, turnover: 0.005,
  },
  {
    id: 'plhn', ticker: 'PLHN.SIM', name: 'Pallisade Health Networks', sector: 'healthcare', mark: 'PH', product: 'Pallisade clinic network',
    tagline: 'Clinics and health plans', hq: 'Dunmere Flats', founded: 1985,
    description: 'Pallisade runs neighborhood clinics and sells health plans. It has huge revenue but thin margins, so small changes in medical costs move its earnings noticeably.',
    price: 54, revenue: 21000, margin: 0.04, targetMargin: 0.045, growth: 0.06, debt: 4200, cash: 2600, payout: 0.3, vol: 0.22, beta: 0.7, turnover: 0.006,
  },
  {
    id: 'nvrb', ticker: 'NVRB.SIM', name: 'Novarbor Biosciences', sector: 'healthcare', mark: 'NB', product: 'NV-3 antibiotic',
    tagline: 'Early-stage antibiotics (loss-making)', hq: 'Port Calder', founded: 2019,
    description: 'Novarbor is a young biotech with one approved antibiotic and several in trials. It loses money and burns cash, so its survival depends on growing sales before funding runs short.',
    price: 12, revenue: 140, margin: -0.9, targetMargin: 0.25, growth: 0.45, debt: 120, cash: 420, payout: 0, vol: 0.72, beta: 1.1, turnover: 0.025,
  },
  // ---- Energy ----
  {
    id: 'solq', ticker: 'SOLQ.SIM', name: 'Solquarry Energy', sector: 'energy', mark: 'SQ', product: 'sunstone thermal batteries',
    tagline: 'Quarry solar and sunstone storage', hq: 'Dunmere Flats', founded: 1996,
    description: 'Solquarry operates solar farms on reclaimed quarries and stores the power in "sunstone" thermal batteries. Its revenue tracks power prices, weather, and inflation.',
    price: 58, revenue: 3300, margin: 0.1, targetMargin: 0.12, growth: 0.08, debt: 2400, cash: 500, payout: 0.35, vol: 0.28, beta: 1.0, turnover: 0.008,
  },
  {
    id: 'dpkn', ticker: 'DPKN.SIM', name: 'Deepkern Fuels', sector: 'energy', mark: 'DK', product: 'Deepkern offshore fuel wells',
    tagline: 'Offshore fuel production', hq: 'Saltreach Harbor', founded: 1958,
    description: 'Deepkern produces fuel from offshore wells. Its profits jump when fuel prices and inflation rise and shrink when they fall, and it pays out half its earnings as dividends.',
    price: 71, revenue: 26000, margin: 0.09, targetMargin: 0.08, growth: 0.02, debt: 9000, cash: 3000, payout: 0.5, vol: 0.28, beta: 1.1, turnover: 0.006,
  },
  {
    id: 'hvwd', ticker: 'HVWD.SIM', name: 'Harvestwind Power Co.', sector: 'energy', mark: 'HW', product: 'Tallmast wind turbines',
    tagline: 'Wind turbine maker', hq: 'Greyfen', founded: 2001,
    description: 'Harvestwind builds Tallmast wind turbines. Large projects are financed with debt, so higher interest rates squeeze both its customers and its own margins.',
    price: 33, revenue: 5200, margin: 0.04, targetMargin: 0.08, growth: 0.1, debt: 3800, cash: 700, payout: 0.1, vol: 0.34, beta: 1.2, turnover: 0.011,
  },
  {
    id: 'fnmw', ticker: 'FNMW.SIM', name: 'Fernmarrow Pipelines', sector: 'energy', mark: 'FM', product: 'Fernmarrow pipeline network',
    tagline: 'Fuel and water pipelines', hq: 'Greyfen', founded: 1966,
    description: 'Fernmarrow owns long-distance pipelines paid by volume shipped rather than fuel prices. Cash flows are steady, debt is high, and most profits are paid as dividends.',
    price: 44, revenue: 8800, margin: 0.13, targetMargin: 0.13, growth: 0.03, debt: 11000, cash: 400, payout: 0.8, vol: 0.17, beta: 0.8, turnover: 0.004,
  },
  // ---- Finance ----
  {
    id: 'cstb', ticker: 'CSTB.SIM', name: 'Castellan Trust Bank', sector: 'finance', mark: 'CT', product: 'Castellan business loans',
    tagline: 'Large commercial bank', hq: 'Port Calder', founded: 1902,
    description: 'Castellan is a large fictional bank. It earns more on loans when interest rates rise but suffers when borrowers struggle in recessions.',
    price: 63, revenue: 32000, margin: 0.24, targetMargin: 0.24, growth: 0.04, debt: 2000, cash: 9000, payout: 0.4, vol: 0.2, beta: 1.15, turnover: 0.005,
  },
  {
    id: 'ambr', ticker: 'AMBR.SIM', name: 'Amberlight Insurance', sector: 'finance', mark: 'AL', product: 'Amberlight home policies',
    tagline: 'Home and auto insurance', hq: 'Lindenmoor', founded: 1931,
    description: 'Amberlight insures homes and vehicles. It invests customer premiums, so higher interest rates help its investment income, while storms and claims create surprises.',
    price: 97, revenue: 14000, margin: 0.09, targetMargin: 0.1, growth: 0.05, debt: 2000, cash: 4000, payout: 0.35, vol: 0.18, beta: 0.8, turnover: 0.004,
  },
  {
    id: 'tlrt', ticker: 'TLRT.SIM', name: 'Tallyroot Payments', sector: 'finance', mark: 'TR', product: 'Tallyroot tap-to-pay terminals',
    tagline: 'Card and phone payments', hq: 'Ashbourne Quay', founded: 2011,
    description: 'Tallyroot processes card and phone payments for shops. It grows with consumer spending and keeps its profits to invest rather than paying dividends.',
    price: 118, revenue: 6100, margin: 0.2, targetMargin: 0.26, growth: 0.14, debt: 1200, cash: 2500, payout: 0, vol: 0.3, beta: 1.3, turnover: 0.007,
  },
  {
    id: 'mrgt', ticker: 'MRGT.SIM', name: 'Marrowgate Asset Management', sector: 'finance', mark: 'MG', product: 'Marrowgate pension funds',
    tagline: 'Fund manager', hq: 'Harrowgate', founded: 1977,
    description: 'Marrowgate manages pension and savings funds for fictional clients and earns fees on the money it manages, so its profits rise and fall with the market itself.',
    price: 41, revenue: 3500, margin: 0.25, targetMargin: 0.25, growth: 0.06, debt: 900, cash: 1100, payout: 0.55, vol: 0.26, beta: 1.35, turnover: 0.006,
  },
  // ---- Consumer goods ----
  {
    id: 'pblc', ticker: 'PBLC.SIM', name: 'Pebblecart Goods', sector: 'consumer', mark: 'PC', product: 'Pebblecart own-brand snacks',
    tagline: 'Neighborhood stores and bike delivery', hq: 'Ashbourne Quay', founded: 1988,
    description: 'Pebblecart runs about 1,800 neighborhood stores and a same-hour cargo-bike delivery service. Sales are steady, but thin margins mean rising costs hurt quickly.',
    price: 35, revenue: 12000, margin: 0.03, targetMargin: 0.035, growth: 0.05, debt: 2200, cash: 600, payout: 0.3, vol: 0.22, beta: 0.9, turnover: 0.007,
  },
  {
    id: 'hnyb', ticker: 'HNYB.SIM', name: 'Honeybrook Foods', sector: 'consumer', mark: 'HB', product: 'Honeybrook breakfast cereals',
    tagline: 'Packaged foods', hq: 'Greyfen', founded: 1921,
    description: 'Honeybrook makes cereals, sauces, and frozen meals sold everywhere. People buy food in every economy, so it is a defensive stock with a generous dividend.',
    price: 49, revenue: 9400, margin: 0.1, targetMargin: 0.1, growth: 0.03, debt: 3500, cash: 500, payout: 0.6, vol: 0.15, beta: 0.55, turnover: 0.004,
  },
  {
    id: 'twrl', ticker: 'TWRL.SIM', name: 'Twirlstitch Apparel', sector: 'consumer', mark: 'TS', product: 'Twirlstitch rain jackets',
    tagline: 'Clothing brand', hq: 'Saltreach Harbor', founded: 1999,
    description: 'Twirlstitch designs everyday clothing and outdoor gear. Fashion is optional spending, so sales fall faster than average when households tighten budgets.',
    price: 23, revenue: 4100, margin: 0.06, targetMargin: 0.07, growth: 0.06, debt: 1100, cash: 350, payout: 0.25, vol: 0.32, beta: 1.15, turnover: 0.01,
  },
  {
    id: 'glmp', ticker: 'GLMP.SIM', name: 'Glimmerpot Home', sector: 'consumer', mark: 'GP', product: 'Glimmerpot cleaning pods',
    tagline: 'Household products', hq: 'Lindenmoor', founded: 1948,
    description: 'Glimmerpot sells cleaning supplies, soaps, and paper goods. Steady demand and strong brands support a long record of dividends.',
    price: 76, revenue: 6700, margin: 0.13, targetMargin: 0.13, growth: 0.04, debt: 2100, cash: 800, payout: 0.55, vol: 0.14, beta: 0.5, turnover: 0.004,
  },
  // ---- Industrials ----
  {
    id: 'skyf', ticker: 'SKYF.SIM', name: 'Skyforge Orbital', sector: 'industrials', mark: 'SF', product: 'Kestrel cargo gliders',
    tagline: 'Reusable cargo gliders to orbit', hq: 'Cindervale Spaceport', founded: 2011,
    description: 'Skyforge builds reusable Kestrel cargo gliders that carry small satellites to orbit. Big contracts and test flights make it one of the most volatile stocks in the market.',
    price: 211, revenue: 2900, margin: 0.07, targetMargin: 0.14, growth: 0.15, debt: 1400, cash: 900, payout: 0, vol: 0.44, beta: 1.35, turnover: 0.01,
  },
  {
    id: 'irwr', ticker: 'IRWR.SIM', name: 'Ironwhistle Rail', sector: 'industrials', mark: 'IR', product: 'Ironwhistle freight corridors',
    tagline: 'Freight railroad', hq: 'Harrowgate', founded: 1889,
    description: 'Ironwhistle hauls grain, fuel, and containers across the fictional nation of Aurelia. Shipping volumes follow the economy, and heavy track investment is financed with debt.',
    price: 128, revenue: 11000, margin: 0.2, targetMargin: 0.2, growth: 0.04, debt: 9000, cash: 700, payout: 0.4, vol: 0.19, beta: 1.0, turnover: 0.004,
  },
  {
    id: 'cgmt', ticker: 'CGMT.SIM', name: 'Cogmint Machinery', sector: 'industrials', mark: 'CG', product: 'Cogmint excavators',
    tagline: 'Construction and farm machines', hq: 'Greyfen', founded: 1937,
    description: 'Cogmint makes excavators, tractors, and cranes. Orders boom when builders and farmers are confident and drop sharply in recessions.',
    price: 82, revenue: 15000, margin: 0.1, targetMargin: 0.11, growth: 0.05, debt: 6000, cash: 1800, payout: 0.35, vol: 0.26, beta: 1.25, turnover: 0.005,
  },
  {
    id: 'vltc', ticker: 'VLTC.SIM', name: 'Voltcrate Logistics', sector: 'industrials', mark: 'VC', product: 'Voltcrate electric vans',
    tagline: 'Electric delivery vans (loss-making, indebted)', hq: 'Cindervale', founded: 2016,
    description: 'Voltcrate builds electric delivery vans. It is growing fast but losing money and carries heavy debt, so rising rates or a weak economy could threaten it.',
    price: 8, revenue: 900, margin: -0.25, targetMargin: 0.06, growth: 0.3, debt: 1600, cash: 300, payout: 0, vol: 0.62, beta: 1.5, turnover: 0.03,
  },
  // ---- Utilities ----
  {
    id: 'bkpw', ticker: 'BKPW.SIM', name: 'Brookpenny Water', sector: 'utilities', mark: 'BP', product: 'Brookpenny water service',
    tagline: 'Regulated water utility', hq: 'Dunmere Flats', founded: 1911,
    description: 'Brookpenny supplies water to several fictional cities under regulated prices. Earnings barely move with the economy, but high debt makes the stock sensitive to interest rates.',
    price: 52, revenue: 3000, margin: 0.16, targetMargin: 0.16, growth: 0.03, debt: 7000, cash: 150, payout: 0.7, vol: 0.13, beta: 0.4, turnover: 0.003,
  },
  {
    id: 'glwr', ticker: 'GLWR.SIM', name: 'Glowridge Electric', sector: 'utilities', mark: 'GE', product: 'Glowridge power grid',
    tagline: 'Electric utility', hq: 'Port Calder', founded: 1904,
    description: 'Glowridge generates and delivers electricity to millions of fictional homes. It pays most of its profit as dividends and behaves a bit like a bond when rates change.',
    price: 68, revenue: 12500, margin: 0.12, targetMargin: 0.12, growth: 0.035, debt: 21000, cash: 400, payout: 0.65, vol: 0.14, beta: 0.5, turnover: 0.003,
  },
  {
    id: 'tdhg', ticker: 'TDHG.SIM', name: 'Tidehollow Gas & Grid', sector: 'utilities', mark: 'TH', product: 'Tidehollow heating gas network',
    tagline: 'Gas and grid utility', hq: 'Saltreach Harbor', founded: 1923,
    description: 'Tidehollow delivers heating gas and maintains regional power lines. Stable demand, high debt, and a large dividend define the business.',
    price: 36, revenue: 5400, margin: 0.1, targetMargin: 0.11, growth: 0.03, debt: 8000, cash: 200, payout: 0.7, vol: 0.16, beta: 0.45, turnover: 0.004,
  },
  // ---- Real estate ----
  {
    id: 'hrtl', ticker: 'HRTL.SIM', name: 'Hearthline Residential', sector: 'realestate', mark: 'HL', product: 'Hearthline apartment communities',
    tagline: 'Apartment landlord', hq: 'Ashbourne Quay', founded: 1992,
    description: 'Hearthline owns apartment communities and pays out nearly all its rental profit. Rents keep up with inflation over time, but property values and borrowing costs are very sensitive to interest rates.',
    price: 45, revenue: 2400, margin: 0.3, targetMargin: 0.3, growth: 0.04, debt: 9000, cash: 300, payout: 0.9, vol: 0.19, beta: 0.85, turnover: 0.005,
  },
  {
    id: 'qrso', ticker: 'QRSO.SIM', name: 'Quarrystone Offices', sector: 'realestate', mark: 'QO', product: 'Quarrystone office towers',
    tagline: 'Office landlord (shrinking demand)', hq: 'Harrowgate', founded: 1974,
    description: 'Quarrystone owns downtown office towers. Demand for offices is slowly shrinking and debt is heavy, so it is exposed to both interest rates and falling rents.',
    price: 22, revenue: 1600, margin: 0.18, targetMargin: 0.15, growth: -0.01, debt: 7200, cash: 250, payout: 0.85, vol: 0.26, beta: 1.0, turnover: 0.008,
  },
];

export const COMPANY_MAP = Object.fromEntries(COMPANIES.map((c) => [c.id, c]));

/* Diversified funds (stage 3). NAV is computed from the fictional stocks each day. */
export const FUNDS = [
  {
    id: 'atmf', ticker: 'ATMF.SIM', name: 'Aurelia Total Market Fund', mark: 'TM', kind: 'fund', expense: 0.0005, start: 50,
    rule: 'cap', tagline: 'Every listed company, weighted by size',
    description: 'Holds every listed MarketLab company in proportion to its market value, so it moves almost exactly with the MarketLab 30 index. The broadest diversification available here.',
  },
  {
    id: 'sidf', ticker: 'SIDF.SIM', name: 'Steady Income Dividend Fund', mark: 'SI', kind: 'fund', expense: 0.0025, start: 25,
    rule: 'dividend', tagline: 'Dividend-paying companies, equal weight',
    description: 'Holds, in equal amounts, every company paying a dividend yield of at least 2%. Tends to lean toward utilities, real estate, consumer goods, and finance.',
  },
  {
    id: 'ghrf', ticker: 'GHRF.SIM', name: 'Growth Horizons Fund', mark: 'GH', kind: 'fund', expense: 0.004, start: 40,
    rule: 'growth', tagline: 'Faster-growing companies, equal weight',
    description: 'Holds, in equal amounts, companies whose long-run revenue growth trend is at least 8% a year. Usually heavy in technology and healthcare, and more volatile than the total market.',
  },
];
export const FUND_MAP = Object.fromEntries(FUNDS.map((f) => [f.id, f]));

/* Seeded scenarios. Scripts only nudge the simplified economy; outcomes still depend on randomness. */
export const SCENARIOS = {
  standard: {
    label: 'Standard market',
    description: 'A random seed and a normal economy. Anything can happen, just less dramatically than in the special scenarios.',
    defaultSeed: null,
  },
  recession: {
    label: 'Recession',
    description: 'The economy tips into a recession a few weeks in. Cyclical sectors and heavily indebted companies are under the most pressure.',
    defaultSeed: 'recession-1',
  },
  inflation: {
    label: 'Inflation shock',
    description: 'Inflation surges and the fictional central bank raises interest rates. Energy may benefit while rate-sensitive sectors struggle.',
    defaultSeed: 'inflation-1',
  },
  techboom: {
    label: 'Technology boom',
    description: 'Enthusiasm and faster growth lift technology stocks for a while. The script does not decide how the boom ends.',
    defaultSeed: 'techboom-1',
  },
};

/* Company event templates by sector. {name} and {product} are filled in. */
export const EVENT_TEMPLATES = {
  technology: {
    up: ['{name} signs a multi-year deal to supply its {product} to a major fictional retailer', '{name} unveils a new generation of its {product} that cuts customer costs sharply', '{name} wins a large government contract for its {product}'],
    down: ['{name} suffers a lengthy outage affecting customers of its {product}', '{name} delays the next version of its {product} after engineering problems', '{name} loses a key customer to a rival'],
  },
  healthcare: {
    up: ['{name} reports strong late-stage trial results', '{name} wins fast-track approval for a new treatment', '{name} signs a licensing deal for its {product}'],
    down: ['{name} pauses a trial for a safety review', '{name} fails a quality inspection at its main plant', '{name} faces a patent dispute over its {product}'],
  },
  energy: {
    up: ['{name} brings a large new project online ahead of schedule', '{name} signs a 20-year supply contract', '{name} reports record output from its {product}'],
    down: ['{name} shuts a site after equipment damage', '{name} faces a regulatory pause on a new project', '{name} takes a write-down on an underperforming project'],
  },
  finance: {
    up: ['{name} wins a large new corporate client', '{name} reports lower-than-feared loan losses', '{name} announces a cost-cutting plan that impresses analysts'],
    down: ['{name} is fined by a fictional regulator', '{name} reports a surprise jump in bad loans', '{name} suffers a system outage that angers customers'],
  },
  consumer: {
    up: ['{name} sees its {product} become a surprise bestseller', '{name} launches a membership program with strong sign-ups', '{name} expands into a new region'],
    down: ['{name} recalls a batch of its {product}', '{name} warns that rising costs will squeeze margins', '{name} is left with unsold stock after a weak season'],
  },
  industrials: {
    up: ['{name} wins a record order for its {product}', '{name} completes a milestone test ahead of schedule', '{name} announces a major infrastructure contract'],
    down: ['{name} halts deliveries of its {product} after a defect', '{name} reports a costly project overrun', '{name} loses a contract bid to a competitor'],
  },
  utilities: {
    up: ['Regulators approve a rate increase for {name}', '{name} completes a grid upgrade under budget', '{name} wins approval for a new long-term supply deal'],
    down: ['Regulators reject a planned price increase at {name}', '{name} faces repair costs after severe storms', '{name} is ordered to pay for a service disruption'],
  },
  realestate: {
    up: ['{name} signs a large long-term tenant', '{name} sells a property for more than its book value', 'Occupancy at {name} properties rises to a multi-year high'],
    down: ['A major tenant leaves {name} properties', '{name} marks down the value of several buildings', 'Vacancy rises across {name} properties'],
  },
};

/* Sector-wide event templates, used when a sector factor makes an unusually large move. */
export const SECTOR_NEWS = {
  technology: { up: 'Technology stocks rally as businesses boost digital spending', down: 'Technology stocks slide as customers delay upgrades' },
  healthcare: { up: 'Healthcare shares climb after regulators speed up approvals', down: 'Healthcare shares fall on a drug-pricing reform proposal' },
  energy: { up: 'Energy stocks jump as fuel and power prices spike', down: 'Energy stocks drop as fuel prices tumble' },
  finance: { up: 'Financial stocks rise as loan demand picks up', down: 'Financial stocks fall on worries about bad loans' },
  consumer: { up: 'Consumer stocks gain as shoppers spend more than expected', down: 'Consumer stocks weaken as households cut back' },
  industrials: { up: 'Industrial stocks climb on a surge in factory orders', down: 'Industrial stocks slip as factory orders fall' },
  utilities: { up: 'Utilities rise as investors seek steady dividends', down: 'Utilities slide as investors move to riskier assets' },
  realestate: { up: 'Property stocks gain as rents climb', down: 'Property stocks fall as vacancies rise' },
};
