// Summary-level demonstration data for Nash Furniture and Nash Construction Materials.
// These businesses are NOT transaction-level in this prototype; figures are simulated daily summaries in USD.
import { mulberry32, normal } from './rng.js';
import { DAYS, weekday, monthIndex, TODAY } from '../lib/dates.js';

const SPEC = {
  furniture: {
    name: 'Nash Furniture', cogs: 0.6, opex: 0.27, avgOrder: 410, wd: [0.9, 0.9, 0.95, 1.0, 1.15, 1.45, 0.8],
    countries: { ZW: 3300, BW: 2600, KE: 4400 }, growth: 0.006,
    categories: [
      { name: 'Living Room', share: 0.31, margin: 0.4 }, { name: 'Bedroom', share: 0.27, margin: 0.42 }, { name: 'Office Furniture', share: 0.17, margin: 0.36 },
      { name: 'Kitchen & Dining', share: 0.14, margin: 0.38 }, { name: 'Outdoor', share: 0.11, margin: 0.37 },
    ],
    modules: ['Showroom performance', 'Order-to-delivery tracking', 'Collection and fabric analytics', 'Interior-design project pipeline'],
  },
  construction: {
    name: 'Nash Construction Materials', cogs: 0.8, opex: 0.12, avgOrder: 1850, wd: [1.05, 1.05, 1.05, 1.05, 1.1, 0.75, 0.2],
    countries: { ZW: 7200, ZM: 5100, MW: 3000, KE: 8400 }, growth: 0.004,
    categories: [
      { name: 'Cement', share: 0.37, margin: 0.17 }, { name: 'Steel & Reinforcement', share: 0.22, margin: 0.15 }, { name: 'Aggregates & Sand', share: 0.17, margin: 0.25 },
      { name: 'Roofing', share: 0.14, margin: 0.24 }, { name: 'Blocks & Bricks', share: 0.1, margin: 0.27 },
    ],
    modules: ['Yard and depot inventory', 'Contract & project pricing', 'Delivery fleet utilisation', 'Customer credit exposure'],
  },
};
let cache = null;
export function buildDemoBiz() {
  if (cache) return cache;
  const out = {};
  let seed = 9001;
  for (const [id, spec] of Object.entries(SPEC)) {
    const rng = mulberry32(seed++);
    const countries = Object.keys(spec.countries);
    const rev = {}, orders = {}, cogs = {}, opex = {};
    for (const c of countries) {
      rev[c] = new Float64Array(DAYS); orders[c] = new Float64Array(DAYS); cogs[c] = new Float64Array(DAYS); opex[c] = new Float64Array(DAYS);
      let drift = 0;
      for (let d = 0; d < DAYS; d++) {
        drift = drift * 0.9 + normal(rng) * 0.012;
        const season = 0.92 + 0.12 * Math.sin(((monthIndex(d) % 12) / 12) * Math.PI * 2 - 1.2);
        const v = spec.countries[c] * spec.wd[weekday(d)] * season * Math.pow(1 + spec.growth, d / 30.4) * (1 + drift) * (1 + normal(rng) * 0.06);
        rev[c][d] = Math.max(0, v);
        orders[c][d] = Math.max(0, Math.round(v / (spec.avgOrder * (0.9 + rng() * 0.2))));
        cogs[c][d] = v * (spec.cogs + normal(rng) * 0.01);
        opex[c][d] = v * (spec.opex + normal(rng) * 0.012);
      }
    }
    out[id] = { id, spec, countries, rev, orders, cogs, opex };
  }
  cache = out;
  return out;
}
export function demoTotals(id, d0, d1, countryFilter) {
  const b = buildDemoBiz()[id];
  const o = { rev: 0, cogs: 0, opex: 0, orders: 0 };
  for (const c of b.countries) {
    if (countryFilter && c !== countryFilter) continue;
    for (let d = d0; d <= d1; d++) { o.rev += b.rev[c][d]; o.cogs += b.cogs[c][d]; o.opex += b.opex[c][d]; o.orders += b.orders[c][d]; }
  }
  o.gp = o.rev - o.cogs; o.margin = o.rev ? o.gp / o.rev : null; o.opProfit = o.gp - o.opex; o.avgOrder = o.orders ? o.rev / o.orders : 0;
  return o;
}
export function demoByCountry(id, d0, d1) {
  const b = buildDemoBiz()[id];
  return b.countries.map((c) => ({ code: c, ...demoTotals(id, d0, d1, c) }));
}
export function demoSeriesDaily(id, d0, d1, countryFilter) {
  const b = buildDemoBiz()[id], out = [];
  for (let d = d0; d <= d1; d++) {
    let rev = 0, orders = 0, cogs = 0, opex = 0;
    for (const c of b.countries) { if (countryFilter && c !== countryFilter) continue; rev += b.rev[c][d]; orders += b.orders[c][d]; cogs += b.cogs[c][d]; opex += b.opex[c][d]; }
    out.push({ d, rev, orders, cogs, opex });
  }
  return out;
}
export function demoCategories(id, d0, d1, countryFilter) {
  const b = buildDemoBiz()[id], t = demoTotals(id, d0, d1, countryFilter);
  return b.spec.categories.map((c) => ({ name: c.name, rev: t.rev * c.share, share: c.share, margin: c.margin, gp: t.rev * c.share * c.margin }));
}
export { SPEC as DEMO_SPEC };
