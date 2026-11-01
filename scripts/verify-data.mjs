import { buildDataset } from '../src/data/generate.js';
import { TODAY, DAYS } from '../src/lib/dates.js';
const t = Date.now();
const ds = buildDataset();
console.log('built in', Date.now() - t, 'ms');
console.log('branches', ds.B, 'tx', ds.tx.n, 'lines', ds.line.n, 'customers', ds.cust.n, 'reviews', ds.reviews.length, 'mv', ds.mv.n, 'SKUs', ds.S);
const perCountry = {};
ds.branches.forEach((b) => { perCountry[b.country] = (perCountry[b.country] || 0) + 1; });
console.log(perCountry);
let rev = 0; for (let i = 0; i < ds.tx.n; i++) rev += ds.tx.usd[i];
console.log('total rev USD', Math.round(rev), 'avg ticket', (rev / ds.tx.n).toFixed(1));
// today
let tr = 0, tt = 0, yr = 0;
for (const b of ds.branches) { tr += ds.cube.revUsd[b.idx * DAYS + TODAY]; tt += ds.cube.txns[b.idx * DAYS + TODAY]; yr += ds.cube.revUsd[b.idx * DAYS + TODAY - 1]; }
console.log('today rev', Math.round(tr), 'txns', tt, 'yesterday', Math.round(yr));
import { setDataset, makeQ, totals, customerStats, countryRows, reconcile, inventoryTotals, lineAgg, series } from '../src/lib/query.js';
setDataset(ds);
const q = makeQ({}, 0, TODAY, 'USD');
let tm = Date.now();
console.log('totals', JSON.stringify(totals(q)).slice(0, 300));
console.log('recon', reconcile(q));
console.log('cust', JSON.stringify(customerStats(q)).slice(0, 400));
console.log('time', Date.now() - tm);
const q1 = makeQ({}, TODAY, TODAY, 'USD');
console.log('today', totals(q1).rev, customerStats(q1).served, customerStats(q1).newCust, customerStats(q1).returningCust);
console.log(countryRows(makeQ({}, TODAY - 6, TODAY, 'USD')).map((c) => [c.code, Math.round(c.revUsd), Math.round(c.rev)]));
console.log('inv', inventoryTotals(q1));
// stock consistency check
let bad = 0;
for (let b = 0; b < ds.B; b++) for (let s = 0; s < ds.S; s++) {
  let st = ds.inv.open[b * ds.S + s];
  for (let i = 0; i < ds.mv.n; i++) {} // placeholder
}
const sold = new Float64Array(ds.B * ds.S);
for (let i = 0; i < ds.tx.n; i++) { const e = i + 1 < ds.tx.n ? ds.tx.line[i + 1] : ds.line.n; for (let l = ds.tx.line[i]; l < e; l++) sold[ds.tx.br[i] * ds.S + ds.line.sku[l]] += ds.line.qty[l]; }
const mvNet = new Float64Array(ds.B * ds.S);
for (let i = 0; i < ds.mv.n; i++) mvNet[ds.mv.br[i] * ds.S + ds.mv.sku[i]] += ds.mv.qty[i];
for (let k = 0; k < ds.B * ds.S; k++) if (ds.inv.open[k] + mvNet[k] - sold[k] !== ds.inv.stock[k]) bad++;
console.log('stock ledger mismatches:', bad);
import { buildAlerts } from '../src/lib/alerts.js';
const al = buildAlerts();
console.log('alerts', al.length);
al.forEach((a) => console.log(a.severity.padEnd(8), a.type.padEnd(11), a.title));
