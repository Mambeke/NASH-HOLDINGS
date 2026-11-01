// Centralised analytics layer: every number shown in the UI is computed here from the generated dataset.
import { DAYS, TODAY, weekday, ymd, monthStartDay, daysInMonth, dayToISO, fmtDay, fmtMonth, fmtTime } from './dates.js';
import { SEGMENT_NAMES, PAYMENT_METHODS, ANON_SEGMENT } from '../data/reference.js';

let DS = null;
let CUST_STAMP = null, CUST_COUNT = null;
const cache = new Map();
export function setDataset(ds) {
  DS = ds;
  CUST_STAMP = new Int32Array(ds.cust.n).fill(-1);
  CUST_COUNT = new Uint16Array(ds.cust.n);
  cache.clear();
}
export const getDS = () => DS;
function memo(key, fn) {
  if (cache.has(key)) return cache.get(key);
  if (cache.size > 150) cache.clear();
  const v = fn();
  cache.set(key, v);
  return v;
}

let _small = { k: null, v: null };
function memoSmall(key, fn) { if (_small.k === key) return _small.v; const v = fn(); _small = { k: key, v }; return v; }
// ---------- scope & query context ----------
export function scopeBranches({ country, city, branch } = {}) {
  const out = [];
  for (const b of DS.branches) {
    if (branch && b.id !== branch) continue;
    if (city && b.cityId !== city) continue;
    if (country && b.country !== country) continue;
    out.push(b.idx);
  }
  return out;
}
export function currencyFor(scope, mode) {
  const single = scope?.country || (scope?.branch ? scope.branch.slice(0, 2) : null);
  if (mode === 'LOCAL' && single) { const c = DS.countryByCode.get(single); return { local: true, code: c.currency, country: single }; }
  return { local: false, code: 'USD', country: single || null, forced: mode === 'LOCAL' && !single };
}
export function makeQ(scope, d0, d1, mode = 'USD') {
  const cur = currencyFor(scope, mode);
  const br = scopeBranches(scope);
  return { d0, d1, br, local: cur.local, cur: cur.code, scope: scope || {}, key: `${scope?.country || ''}|${scope?.city || ''}|${scope?.branch || ''}|${d0}|${d1}|${cur.code}` };
}
export const withRange = (q, d0, d1) => ({ ...q, d0, d1, key: `${q.scope.country || ''}|${q.scope.city || ''}|${q.scope.branch || ''}|${d0}|${d1}|${q.cur}` });
export const withBranches = (q, br) => ({ ...q, br, key: q.key + '|b' + br.join(',') });
export const pct = (a, b) => (b ? (a - b) / b : null);

const REV = (q) => (q.local ? DS.cube.revLoc : DS.cube.revUsd);
const COGS = (q) => (q.local ? DS.cube.cogsLoc : DS.cube.cogsUsd);
const TGT = (q) => (q.local ? DS.cube.targetLoc : DS.cube.targetUsd);
const TXREV = (q) => (q.local ? DS.tx.loc : DS.tx.usd);
const TXCOGS = (q) => (q.local ? DS.tx.cogsLoc : DS.tx.cogsUsd);
const LNREV = (q) => (q.local ? DS.line.loc : DS.line.usd);
const LNCOGS = (q) => (q.local ? DS.line.cogsLoc : DS.line.cogsUsd);
const EXPA = (q) => (q.local ? DS.exp.loc : DS.exp.usd);
const EXPB = (q) => (q.local ? DS.exp.budLoc : DS.exp.budUsd);
const NCAT = 7;
const lineEnd = (i) => (i + 1 < DS.tx.n ? DS.tx.line[i + 1] : DS.line.n);
const txRange = (b, d0, d1) => [DS.tx.start[b * DAYS + d0], DS.tx.start[b * DAYS + d1 + 1]];

// ---------- cube-based totals ----------
export function totals(q) {
  return memo('tot|' + q.key, () => {
    const c = DS.cube, rev = REV(q), cogs = COGS(q), tgt = TGT(q), ea = EXPA(q), eb = EXPB(q);
    const o = { rev: 0, revUsd: 0, cogs: 0, txns: 0, units: 0, idTx: 0, anonTx: 0, cardTx: 0, target: 0, opex: 0, budget: 0, newCust: 0, dailyCust: 0, missingDays: 0 };
    for (const b of q.br) {
      for (let d = q.d0; d <= q.d1; d++) {
        const i = b * DAYS + d;
        o.rev += rev[i]; o.revUsd += c.revUsd[i]; o.cogs += cogs[i]; o.txns += c.txns[i]; o.units += c.units[i];
        o.idTx += c.idTx[i]; o.anonTx += c.anonTx[i]; o.cardTx += c.cardTx[i]; o.target += tgt[i]; o.newCust += c.newCust[i]; o.dailyCust += c.dCust[i];
        o.missingDays += c.missing[i];
        for (let k = 0; k < NCAT; k++) { o.opex += ea[i * NCAT + k]; o.budget += eb[i * NCAT + k]; }
      }
    }
    o.gp = o.rev - o.cogs; o.margin = o.rev ? o.gp / o.rev : null; o.opProfit = o.gp - o.opex; o.opMargin = o.rev ? o.opProfit / o.rev : null;
    o.avgTicket = o.txns ? o.rev / o.txns : 0; o.attain = o.target ? o.rev / o.target : null;
    return o;
  });
}

// ---------- customer scan (distinct counts must come from transactions, not from summed daily counts) ----------
export function customerStats(q) {
  return memo('cust|' + q.key, () => {
    const tx = DS.tx, rev = TXREV(q), cust = DS.cust;
    let stampBase = 0; CUST_STAMP.fill(-1);
    const touched = [];
    let identified = 0, newC = 0, anonTx = 0, idTx = 0, cardTx = 0, tot = 0, idRev = 0, nTx = 0, repeatC = 0;
    const segRev = new Float64Array(7), segTx = new Float64Array(7), segCust = new Float64Array(7);
    const pay = new Float64Array(5), payTx = new Float64Array(5);
    const clsTx = [0, 0, 0], clsRev = [0, 0, 0];
    const freqBuckets = [0, 0, 0, 0, 0]; // 1,2,3-4,5-9,10+
    for (const b of q.br) {
      const [a, e] = txRange(b, q.d0, q.d1);
      for (let i = a; i < e; i++) {
        const c = tx.cust[i], amt = rev[i];
        nTx++; tot += amt; segRev[tx.seg[i]] += amt; segTx[tx.seg[i]]++; pay[tx.pay[i]] += amt; payTx[tx.pay[i]]++; clsTx[tx.cls[i]]++; clsRev[tx.cls[i]] += amt;
        if (tx.card[i]) cardTx++;
        if (c < 0) { anonTx++; continue; }
        idTx++; idRev += amt;
        if (CUST_STAMP[c] !== stampBase) {
          CUST_STAMP[c] = stampBase; CUST_COUNT[c] = 0; touched.push(c); identified++; segCust[cust.seg[c]]++;
          if (!cust.prior[c] && cust.first[c] >= q.d0 && cust.first[c] <= q.d1) newC++;
        }
        CUST_COUNT[c]++;
      }
    }
    for (const c of touched) {
      const n = CUST_COUNT[c];
      if (n >= 2) repeatC++;
      freqBuckets[n === 1 ? 0 : n === 2 ? 1 : n <= 4 ? 2 : n <= 9 ? 3 : 4]++;
    }
    const returningC = identified - newC;
    return {
      txns: nTx, revenue: tot, identified, newCust: newC, returningCust: returningC, anonVisits: anonTx, served: identified + anonTx,
      idTx, cardTx, cardRate: nTx ? cardTx / nTx : 0, repeatCustomers: repeatC, repeatRate: identified ? repeatC / identified : null,
      freq: identified ? idTx / identified : null, avgSpendId: identified ? idRev / identified : null, idRev,
      segments: SEGMENT_NAMES.map((n, i) => ({ id: i, name: n, revenue: segRev[i], txns: segTx[i], customers: i === ANON_SEGMENT ? anonTx : segCust[i], avgTicket: segTx[i] ? segRev[i] / segTx[i] : 0 })),
      payments: PAYMENT_METHODS.map((n, i) => ({ name: n, revenue: pay[i], txns: payTx[i] })),
      txClass: { new: { txns: clsTx[0], revenue: clsRev[0] }, returning: { txns: clsTx[1], revenue: clsRev[1] }, anonymous: { txns: clsTx[2], revenue: clsRev[2] } },
      freqBuckets: [
        { name: '1 purchase', value: freqBuckets[0] }, { name: '2 purchases', value: freqBuckets[1] }, { name: '3–4', value: freqBuckets[2] },
        { name: '5–9', value: freqBuckets[3] }, { name: '10+', value: freqBuckets[4] },
      ],
    };
  });
}

export function kpis(q) {
  return memo('kpi|' + q.key, () => {
    const t = totals(q), c = customerStats(q);
    return { ...t, served: c.served, identified: c.identified, newCust: c.newCust, returningCust: c.returningCust, anonVisits: c.anonVisits, repeatRate: c.repeatRate, cust: c };
  });
}

// ---------- branch & country rows ----------
export function branchRows(q) {
  return memo('br|' + q.key, () => {
    const c = DS.cube, rev = REV(q), cogs = COGS(q), tgt = TGT(q), ea = EXPA(q), eb = EXPB(q), tx = DS.tx;
    const rows = [];
    CUST_STAMP.fill(-1);
    for (const bi of q.br) {
      const b = DS.branches[bi];
      const r = { b, idx: bi, id: b.id, name: b.name, city: b.city, cityId: b.cityId, country: b.country, rev: 0, revUsd: 0, cogs: 0, txns: 0, units: 0, target: 0, opex: 0, budget: 0, identified: 0, newCust: 0, anon: 0, missingDays: 0 };
      for (let d = q.d0; d <= q.d1; d++) {
        const i = bi * DAYS + d;
        r.rev += rev[i]; r.revUsd += c.revUsd[i]; r.cogs += cogs[i]; r.txns += c.txns[i]; r.units += c.units[i]; r.target += tgt[i]; r.missingDays += c.missing[i];
        for (let k = 0; k < NCAT; k++) { r.opex += ea[i * NCAT + k]; r.budget += eb[i * NCAT + k]; }
      }
      const [a, e] = txRange(bi, q.d0, q.d1);
      const stamp = bi * 7 + 1;
      for (let i = a; i < e; i++) {
        const cu = tx.cust[i];
        if (cu < 0) { r.anon++; continue; }
        if (CUST_STAMP[cu] !== stamp) { CUST_STAMP[cu] = stamp; r.identified++; if (!DS.cust.prior[cu] && DS.cust.first[cu] >= q.d0 && DS.cust.first[cu] <= q.d1) r.newCust++; }
      }
      r.customers = r.identified + r.anon; r.returningCust = r.identified - r.newCust;
      r.gp = r.rev - r.cogs; r.margin = r.rev ? r.gp / r.rev : null; r.opProfit = r.gp - r.opex; r.avgTicket = r.txns ? r.rev / r.txns : 0;
      r.attain = r.target ? r.rev / r.target : null; r.dataStatus = DS.branches[bi].lastDataDay < q.d1 && r.missingDays > 0 ? 'delayed' : 'ok';
      rows.push(r);
    }
    return rows;
  });
}
export function branchRowsCompared(q, pq) {
  const rows = branchRows(q);
  if (!pq) return rows.map((r) => ({ ...r, prevRev: null, growth: null, prevTxns: null, txnGrowth: null }));
  const pm = new Map(branchRows(pq).map((r) => [r.idx, r]));
  return rows.map((r) => {
    const p = pm.get(r.idx);
    return { ...r, prevRev: p?.rev ?? null, growth: p && p.rev ? (r.rev - p.rev) / p.rev : null, prevTxns: p?.txns ?? null, txnGrowth: p && p.txns ? (r.txns - p.txns) / p.txns : null, prevCustomers: p?.customers ?? null };
  });
}
export function countryRows(q) {
  return memo('co|' + q.key, () => {
    const rows = branchRows(q);
    return DS.countries.map((c) => {
      const rs = rows.filter((r) => r.country === c.code);
      if (!rs.length) return null;
      const s = (k) => rs.reduce((a, r) => a + r[k], 0);
      const o = { code: c.code, name: c.name, currency: c.currency, branches: rs.length, rev: s('rev'), revUsd: s('revUsd'), cogs: s('cogs'), txns: s('txns'), units: s('units'), target: s('target'), opex: s('opex'), budget: s('budget'), customers: s('customers'), identified: s('identified'), newCust: s('newCust'), anon: s('anon') };
      o.gp = o.rev - o.cogs; o.margin = o.rev ? o.gp / o.rev : null; o.avgTicket = o.txns ? o.rev / o.txns : 0; o.attain = o.target ? o.rev / o.target : null; o.opProfit = o.gp - o.opex;
      o.returningCust = o.identified - o.newCust;
      return o;
    }).filter(Boolean);
  });
}
// Country rows always carry both local and USD values; used for group-level ranking in USD
export function countryRowsCompared(q, pq) {
  const rows = countryRows(q);
  const pm = pq ? new Map(countryRows(pq).map((r) => [r.code, r])) : null;
  return rows.map((r) => {
    const p = pm?.get(r.code);
    return { ...r, prevRev: p?.rev ?? null, growth: p && p.rev ? (r.rev - p.rev) / p.rev : null, prevRevUsd: p?.revUsd ?? null, growthUsd: p && p.revUsd ? (r.revUsd - p.revUsd) / p.revUsd : null };
  });
}

// ---------- time series ----------
export function series(q, grain = 'day') {
  return memo(`ser|${q.key}|${grain}`, () => {
    const c = DS.cube, rev = REV(q), cogs = COGS(q), tgt = TGT(q), ea = EXPA(q), eb = EXPB(q);
    const buckets = [], idx = new Map();
    const keyOf = (d) => {
      if (grain === 'day') return d;
      if (grain === 'week') return d - weekday(d);
      const { y, m } = ymd(d); return monthStartDay(y, m);
    };
    for (let d = q.d0; d <= q.d1; d++) {
      const k = keyOf(d);
      if (!idx.has(k)) {
        const start = Math.max(q.d0, k);
        const end = grain === 'day' ? d : grain === 'week' ? Math.min(q.d1, k + 6) : Math.min(q.d1, k + daysInMonth(ymd(k).y, ymd(k).m) - 1);
        const label = grain === 'month' ? fmtMonth(k) : grain === 'week' ? `Wk ${fmtDay(start, { noYear: true })}` : fmtDay(d, { noYear: true });
        idx.set(k, buckets.length);
        buckets.push({ key: k, start, end, label, rev: 0, revUsd: 0, cogs: 0, txns: 0, units: 0, target: 0, opex: 0, budget: 0, customers: 0, newCust: 0, days: 0 });
      }
      const o = buckets[idx.get(k)];
      o.days++;
      for (const b of q.br) {
        const i = b * DAYS + d;
        o.rev += rev[i]; o.revUsd += c.revUsd[i]; o.cogs += cogs[i]; o.txns += c.txns[i]; o.units += c.units[i]; o.target += tgt[i]; o.customers += c.dCust[i] + c.anonTx[i]; o.newCust += c.newCust[i];
        for (let kk = 0; kk < NCAT; kk++) { o.opex += ea[i * NCAT + kk]; o.budget += eb[i * NCAT + kk]; }
      }
    }
    buckets.forEach((o) => { o.gp = o.rev - o.cogs; o.opProfit = o.gp - o.opex; o.avgTicket = o.txns ? o.rev / o.txns : 0; });
    return buckets;
  });
}

// ---------- product / line analytics ----------
export function lineAgg(q) {
  return memo('line|' + q.key, () => {
    const S = DS.S, C = DS.C, tx = DS.tx, ln = DS.line, lr = LNREV(q), lc = LNCOGS(q);
    const qty = new Float64Array(S), rev = new Float64Array(S), cogs = new Float64Array(S), cnt = new Float64Array(S);
    const qtyC = new Float64Array(C * S), revC = new Float64Array(C * S), cogsC = new Float64Array(C * S);
    const branchesSold = Array.from({ length: S }, () => new Set());
    for (const b of q.br) {
      const ci = DS.branches[b].countryIdx;
      const [a, e] = txRange(b, q.d0, q.d1);
      if (a >= e) continue;
      const l0 = tx.line[a], l1 = lineEnd(e - 1);
      for (let l = l0; l < l1; l++) {
        const s = ln.sku[l];
        qty[s] += ln.qty[l]; rev[s] += lr[l]; cogs[s] += lc[l]; cnt[s]++;
        qtyC[ci * S + s] += ln.qty[l]; revC[ci * S + s] += lr[l]; cogsC[ci * S + s] += lc[l];
        branchesSold[s].add(b);
      }
    }
    let totRev = 0, totQty = 0;
    for (let s = 0; s < S; s++) { totRev += rev[s]; totQty += qty[s]; }
    const rows = DS.catalog.map((p) => ({
      p, idx: p.idx, id: p.id, sku: p.sku, name: p.name, category: p.category, range: p.range, colour: p.colour, hex: p.hex, size: p.size, price: p.price, cost: p.cost,
      qty: qty[p.idx], rev: rev[p.idx], cogs: cogs[p.idx], gp: rev[p.idx] - cogs[p.idx], margin: rev[p.idx] ? (rev[p.idx] - cogs[p.idx]) / rev[p.idx] : null,
      lines: cnt[p.idx], share: totRev ? rev[p.idx] / totRev : 0, branchesSold: branchesSold[p.idx].size,
    }));
    return { rows, qty, rev, cogs, lines: cnt, qtyC, revC, cogsC, totRev, totQty };
  });
}
export function rollup(rows, keyFn, extra = () => ({})) {
  const m = new Map();
  for (const r of rows) {
    const k = keyFn(r); if (k == null) continue;
    let o = m.get(k); if (!o) { o = { key: k, qty: 0, rev: 0, cogs: 0, ...extra(r) }; m.set(k, o); }
    o.qty += r.qty; o.rev += r.rev; o.cogs += r.cogs;
  }
  const arr = [...m.values()];
  const tot = arr.reduce((a, r) => a + r.rev, 0);
  arr.forEach((o) => { o.gp = o.rev - o.cogs; o.margin = o.rev ? o.gp / o.rev : null; o.share = tot ? o.rev / tot : 0; });
  return arr;
}
export function colourRollup(rows) {
  return rollup(rows.filter((r) => r.hex), (r) => r.colour, (r) => ({ hex: r.hex, code: r.p.colourCode })).sort((a, b) => b.rev - a.rev);
}
export function productTrend(q, skuList, grain) {
  return memo(`ptr|${q.key}|${skuList.join(',')}|${grain}`, () => {
    const set = new Set(skuList), tx = DS.tx, ln = DS.line, lr = LNREV(q);
    const days = q.d1 - q.d0 + 1, qty = new Float64Array(days), rev = new Float64Array(days);
    for (const b of q.br) {
      const [a, e] = txRange(b, q.d0, q.d1);
      for (let i = a; i < e; i++) {
        const d = tx.day[i] - q.d0, l1 = lineEnd(i);
        for (let l = tx.line[i]; l < l1; l++) if (set.has(ln.sku[l])) { qty[d] += ln.qty[l]; rev[d] += lr[l]; }
      }
    }
    const bucketKey = (d) => (grain === 'day' ? d : grain === 'week' ? d - weekday(d) : monthStartDay(ymd(d).y, ymd(d).m));
    const m = new Map();
    for (let i = 0; i < days; i++) {
      const d = q.d0 + i, k = bucketKey(d);
      let o = m.get(k);
      if (!o) { o = { key: k, label: grain === 'month' ? fmtMonth(k) : grain === 'week' ? `Wk ${fmtDay(Math.max(q.d0, k), { noYear: true })}` : fmtDay(d, { noYear: true }), qty: 0, rev: 0 }; m.set(k, o); }
      o.qty += qty[i]; o.rev += rev[i];
    }
    return [...m.values()];
  });
}

// ---------- inventory ----------
let _invStats = null;
export function invStats() {
  if (_invStats && _invStats.ds === DS) return _invStats;
  const S = DS.S, B = DS.B, tx = DS.tx, ln = DS.line;
  const v14 = new Float64Array(B * S), v60 = new Float64Array(B * S), lastSale = new Int16Array(B * S).fill(-1), days14 = new Float64Array(B);
  for (let b = 0; b < B; b++) {
    for (let d = TODAY - 59; d <= TODAY; d++) {
      const [a, e] = txRange(b, d, d);
      for (let i = a; i < e; i++) {
        const l1 = lineEnd(i);
        for (let l = tx.line[i]; l < l1; l++) {
          const k = b * S + ln.sku[l];
          v60[k] += ln.qty[l]; if (d > TODAY - 14) v14[k] += ln.qty[l]; lastSale[k] = d;
        }
      }
    }
    let n = 0; for (let d = TODAY - 13; d <= TODAY; d++) if (!DS.cube.missing[b * DAYS + d]) n++;
    days14[b] = Math.max(1, n);
  }
  _invStats = { ds: DS, v14, v60, lastSale, days14 };
  return _invStats;
}
export function inventoryRows(q) {
  return memo('inv|' + q.key, () => {
    const st = invStats(), S = DS.S, rows = [];
    for (const b of q.br) {
      const br = DS.branches[b];
      for (let s = 0; s < S; s++) {
        const k = b * S + s, stock = DS.inv.stock[k], rp = DS.inv.rp[k], p = DS.catalog[s];
        const vel = st.v14[k] / st.days14[b];
        const status = stock <= 0 ? 'out' : stock <= rp ? 'low' : 'ok';
        const cover = vel > 0 ? stock / vel : null;
        const sixty = st.v60[k];
        rows.push({
          key: `${br.id}|${p.id}`, b: br, branchId: br.id, branch: br.name, country: br.country, city: br.city, p, productId: p.id, sku: p.sku, product: p.name, category: p.category, colour: p.colour, hex: p.hex, size: p.size,
          stock, reorderPoint: rp, orderUpTo: DS.inv.oup[k], status, velocity: vel, cover, sold60: sixty, lastSale: st.lastSale[k],
          replenish: status !== 'ok' ? Math.max(0, DS.inv.oup[k] - stock) : 0,
          slow: sixty <= Math.max(2, DS.inv.rp[k] * 0.35) && stock > rp * 1.5,
          risk: status === 'ok' && cover != null && cover < 5,
        });
      }
    }
    return rows;
  });
}
export function stockSeries(q, grain) {
  return memo(`stk|${q.key}|${grain}`, () => {
    const c = DS.cube, mv = DS.mv, set = new Set(q.br);
    const days = q.d1 - q.d0 + 1;
    const inn = new Float64Array(days), out = new Float64Array(days), adj = new Float64Array(days), on = new Float64Array(days), outSk = new Float64Array(days);
    for (const b of q.br) for (let d = q.d0; d <= q.d1; d++) { const i = b * DAYS + d; out[d - q.d0] += c.units[i]; on[d - q.d0] += c.onHand[i]; outSk[d - q.d0] += c.outSkus[i]; }
    for (let i = 0; i < mv.n; i++) {
      const d = mv.day[i]; if (d < q.d0 || d > q.d1 || !set.has(mv.br[i])) continue;
      if (mv.type[i] === 0) inn[d - q.d0] += mv.qty[i]; else adj[d - q.d0] += mv.qty[i];
    }
    const bk = (d) => (grain === 'day' ? d : grain === 'week' ? d - weekday(d) : monthStartDay(ymd(d).y, ymd(d).m));
    const m = new Map();
    for (let i = 0; i < days; i++) {
      const d = q.d0 + i, k = bk(d); let o = m.get(k);
      if (!o) { o = { key: k, label: grain === 'month' ? fmtMonth(k) : grain === 'week' ? `Wk ${fmtDay(Math.max(q.d0, k), { noYear: true })}` : fmtDay(d, { noYear: true }), received: 0, sold: 0, adjusted: 0, onHand: 0, outSkus: 0 }; m.set(k, o); }
      o.received += inn[i]; o.sold += out[i]; o.adjusted += adj[i]; o.onHand = on[i]; o.outSkus = outSk[i];
    }
    return [...m.values()];
  });
}
export function discrepancies(q, lookback = 30) {
  const set = new Set(q.br), mv = DS.mv, rows = [];
  for (let i = 0; i < mv.n; i++) {
    if (mv.type[i] !== 1 || mv.day[i] < q.d1 - lookback + 1 || mv.day[i] > q.d1 || !set.has(mv.br[i])) continue;
    const b = DS.branches[mv.br[i]];
    rows.push({ key: i, day: mv.day[i], branch: b.name, branchId: b.id, country: b.country, product: DS.catalog[mv.sku[i]].name, productId: DS.catalog[mv.sku[i]].id, qty: mv.qty[i] });
  }
  return rows.sort((a, b) => b.day - a.day);
}
export function inventoryTotals(q) {
  return memo('invt|' + q.key, () => {
    const rows = inventoryRows(q);
    let units = 0, out = 0, low = 0, repl = 0;
    for (const r of rows) { units += r.stock; if (r.status === 'out') out++; else if (r.status === 'low') low++; repl += r.replenish; }
    return { units, out, low, ok: rows.length - out - low, positions: rows.length, replenishUnits: repl };
  });
}

// ---------- expenses ----------
export function expenseBreakdown(q, grain = 'week') {
  return memo(`exp|${q.key}|${grain}`, () => {
    const ea = EXPA(q), eb = EXPB(q), rev = REV(q);
    const cat = DS.expCats.map((c) => ({ id: c.id, name: c.name, actual: 0, budget: 0 }));
    const byBranch = new Map();
    for (const b of q.br) {
      const br = DS.branches[b]; const r = { b: br, id: br.id, name: br.name, country: br.country, actual: 0, budget: 0, rev: 0 };
      for (let d = q.d0; d <= q.d1; d++) {
        const i = b * DAYS + d; r.rev += rev[i];
        for (let k = 0; k < NCAT; k++) { cat[k].actual += ea[i * NCAT + k]; cat[k].budget += eb[i * NCAT + k]; r.actual += ea[i * NCAT + k]; r.budget += eb[i * NCAT + k]; }
      }
      r.var = r.actual - r.budget; r.varPct = r.budget ? r.var / r.budget : null; r.ratio = r.rev ? r.actual / r.rev : null;
      byBranch.set(b, r);
    }
    const byCountry = DS.countries.map((c) => {
      const rs = [...byBranch.values()].filter((r) => r.country === c.code); if (!rs.length) return null;
      const o = { code: c.code, name: c.name, currency: c.currency, actual: rs.reduce((a, r) => a + r.actual, 0), budget: rs.reduce((a, r) => a + r.budget, 0), rev: rs.reduce((a, r) => a + r.rev, 0) };
      o.var = o.actual - o.budget; o.varPct = o.budget ? o.var / o.budget : null; o.ratio = o.rev ? o.actual / o.rev : null; return o;
    }).filter(Boolean);
    cat.forEach((c) => { c.var = c.actual - c.budget; c.varPct = c.budget ? c.var / c.budget : null; });
    const ser = series(q, grain).map((s) => ({ ...s }));
    return { categories: cat, branches: [...byBranch.values()], countries: byCountry, series: ser };
  });
}
export function expenseByCategorySeries(q, grain) {
  return memo(`expc|${q.key}|${grain}`, () => {
    const ea = EXPA(q), bk = (d) => (grain === 'day' ? d : grain === 'week' ? d - weekday(d) : monthStartDay(ymd(d).y, ymd(d).m));
    const m = new Map();
    for (let d = q.d0; d <= q.d1; d++) {
      const k = bk(d); let o = m.get(k);
      if (!o) { o = { key: k, label: grain === 'month' ? fmtMonth(k) : grain === 'week' ? `Wk ${fmtDay(Math.max(q.d0, k), { noYear: true })}` : fmtDay(d, { noYear: true }) }; DS.expCats.forEach((c) => { o[c.name] = 0; }); m.set(k, o); }
      for (const b of q.br) { const i = b * DAYS + d; for (let c = 0; c < NCAT; c++) o[DS.expCats[c].name] += ea[i * NCAT + c]; }
    }
    return [...m.values()];
  });
}

// ---------- reviews ----------
export function reviewStats(q, grain = 'week') {
  return memo(`rev|${q.key}|${grain}`, () => {
    const set = new Set(q.br);
    const list = DS.reviews.filter((r) => r.day >= q.d0 && r.day <= q.d1 && set.has(r.br));
    const dist = [0, 0, 0, 0, 0], cats = {}, byBranch = new Map(), trendMap = new Map();
    let sum = 0, verified = 0, complaints = 0;
    DS.reviewCats.forEach((c) => { cats[c] = { name: c, reviews: 0, complaints: 0, sum: 0 }; });
    const bk = (d) => (grain === 'day' ? d : grain === 'week' ? d - weekday(d) : monthStartDay(ymd(d).y, ymd(d).m));
    for (const r of list) {
      sum += r.rating; dist[r.rating - 1]++; if (r.verified) verified++;
      const c = cats[r.cat]; c.reviews++; c.sum += r.rating; if (r.rating <= 2) { c.complaints++; complaints++; }
      let o = byBranch.get(r.br); if (!o) { const b = DS.branches[r.br]; o = { b, id: b.id, name: b.name, country: b.country, count: 0, sum: 0, complaints: 0, verified: 0 }; byBranch.set(r.br, o); }
      o.count++; o.sum += r.rating; if (r.rating <= 2) o.complaints++; if (r.verified) o.verified++;
      const k = bk(r.day); let t = trendMap.get(k); if (!t) { t = { key: k, label: grain === 'month' ? fmtMonth(k) : fmtDay(Math.max(q.d0, k), { noYear: true }), sum: 0, count: 0 }; trendMap.set(k, t); }
      t.sum += r.rating; t.count++;
    }
    const branchRows = [...byBranch.values()].map((o) => ({ ...o, avg: o.sum / o.count, complaintRate: o.complaints / o.count, verifiedShare: o.verified / o.count }));
    const catRows = Object.values(cats).map((c) => ({ ...c, avg: c.reviews ? c.sum / c.reviews : null }));
    const trend = [...trendMap.values()].sort((a, b) => a.key - b.key).map((t) => ({ ...t, avg: t.sum / t.count }));
    const countryMap = new Map();
    branchRows.forEach((r) => { const o = countryMap.get(r.country) || { code: r.country, count: 0, sum: 0, complaints: 0 }; o.count += r.count; o.sum += r.sum; o.complaints += r.complaints; countryMap.set(r.country, o); });
    const byCountry = [...countryMap.values()].map((o) => ({ ...o, name: DS.countryByCode.get(o.code).name, avg: o.sum / o.count }));
    return { list, count: list.length, avg: list.length ? sum / list.length : null, dist, verified, verifiedShare: list.length ? verified / list.length : null, complaints, cats: catRows, branches: branchRows, countries: byCountry, trend };
  });
}

// ---------- transactions ----------
export function txRef(i) {
  const tx = DS.tx, b = DS.branches[tx.br[i]];
  const iso = dayToISO(tx.day[i]).replace(/-/g, '');
  const seq = i - DS.tx.start[tx.br[i] * DAYS + tx.day[i]] + 1;
  return `TX-${b.id.replace(/-/g, '').slice(0, 7)}-${iso}-${String(seq).padStart(4, '0')}`;
}
export const custLabel = (c) => (c < 0 ? 'Anonymous walk-in' : `CUS-${DS.branches[DS.cust.branch[c]].country}-${String(c + 1).padStart(6, '0')}`);
export const loyaltyId = (c) => (c >= 0 && DS.cust.card[c] ? `LC-${String(40000000 + ((c * 7919) % 59999999)).padStart(8, '0')}` : null);
const CLS = ['New', 'Returning', 'Anonymous'];
export function txRow(i, local) {
  const tx = DS.tx, b = DS.branches[tx.br[i]], l1 = lineEnd(i), ln = DS.line, lines = [];
  for (let l = tx.line[i]; l < l1; l++) {
    const p = DS.catalog[ln.sku[l]];
    lines.push({ p, sku: p.sku, productId: p.id, name: p.name, colour: p.colour, hex: p.hex, size: p.size, qty: ln.qty[l], loc: ln.loc[l], usd: ln.usd[l], cogsUsd: ln.cogsUsd[l], unitLoc: ln.loc[l] / ln.qty[l] });
  }
  const rate = tx.loc[i] / tx.usd[i];
  return {
    i, ref: txRef(i), day: tx.day[i], date: dayToISO(tx.day[i]), time: fmtTime(tx.min[i]), minute: tx.min[i], branchId: b.id, branch: b.name, country: b.country, currency: b.currency,
    custId: tx.cust[i], customer: custLabel(tx.cust[i]), loyalty: tx.card[i] ? loyaltyId(tx.cust[i]) : null, cls: CLS[tx.cls[i]], segment: SEGMENT_NAMES[tx.seg[i]],
    pay: PAYMENT_METHODS[tx.pay[i]], units: tx.units[i], lines, nLines: lines.length, amountLoc: tx.loc[i], amountUsd: tx.usd[i], amount: local ? tx.loc[i] : tx.usd[i], cogsUsd: tx.cogsUsd[i], rate,
    product: lines[0].name + (lines.length > 1 ? ` +${lines.length - 1} more` : ''), colour: lines[0].colour,
  };
}
export function txList(q, limit = 6000) {
  return memoSmall(`txl|${q.key}|${limit}`, () => {
    const rows = []; let total = 0;
    for (const b of q.br) {
      const [a, e] = txRange(b, q.d0, q.d1); total += e - a;
    }
    for (const b of q.br) {
      const [a, e] = txRange(b, q.d0, q.d1);
      for (let i = e - 1; i >= a && rows.length < limit; i--) rows.push(txRow(i, q.local));
    }
    rows.sort((x, y) => (y.day - x.day) || (y.minute - x.minute));
    return { rows, total, truncated: total > rows.length };
  });
}
export function customerProfile(c) {
  const tx = DS.tx, b = DS.cust.branch[c], out = [];
  const [a, e] = txRange(b, 0, DAYS - 1);
  for (let i = a; i < e; i++) if (tx.cust[i] === c) out.push(i);
  const spend = out.reduce((s, i) => s + tx.usd[i], 0);
  return { id: custLabel(c), loyalty: loyaltyId(c), segment: SEGMENT_NAMES[DS.cust.seg[c]], branch: DS.branches[b], visits: out.length, spendUsd: spend, firstDay: out.length ? tx.day[out[0]] : null, lastDay: out.length ? tx.day[out[out.length - 1]] : null, legacy: !!DS.cust.prior[c], txs: out };
}

// ---------- group-level helpers ----------
export function branchDailySeries(branchIdx, d0, d1) {
  const out = [];
  for (let d = d0; d <= d1; d++) { const i = branchIdx * DAYS + d; out.push({ d, rev: DS.cube.revUsd[i], txns: DS.cube.txns[i] }); }
  return out;
}
export function hourlyProfile(q) {
  return memo('hr|' + q.key, () => {
    const hrs = Array.from({ length: 12 }, (_, i) => ({ hour: i + 7, label: `${String(i + 7).padStart(2, '0')}:00`, txns: 0, rev: 0 }));
    const tx = DS.tx, rev = TXREV(q);
    for (const b of q.br) { const [a, e] = txRange(b, q.d0, q.d1); for (let i = a; i < e; i++) { const h = Math.floor(tx.min[i] / 60) - 7; if (h >= 0 && h < 12) { hrs[h].txns++; hrs[h].rev += rev[i]; } } }
    return hrs;
  });
}
export function lastSyncInfo(branchIdx) {
  const b = DS.branches[branchIdx];
  return { lastDataDay: b.lastDataDay, delayed: b.lastDataDay < TODAY };
}
export function reconcile(q) {
  // verifies cube totals reconcile with transaction and line-level records for the same scope
  const t = totals(q); let txSum = 0, lnSum = 0;
  const rev = TXREV(q), lr = LNREV(q);
  for (const b of q.br) { const [a, e] = txRange(b, q.d0, q.d1); for (let i = a; i < e; i++) txSum += rev[i]; if (a < e) { for (let l = DS.tx.line[a]; l < lineEnd(e - 1); l++) lnSum += lr[l]; } }
  return { cube: t.rev, tx: txSum, lines: lnSum, ok: Math.abs(t.rev - txSum) < 0.01 * Math.max(1, t.rev) / 100 && Math.abs(txSum - lnSum) < 0.01 * Math.max(1, txSum) / 100 };
}

export function topCustomers(q, n = 30) {
  return memo(`topc|${q.key}|${n}`, () => {
    const tx = DS.tx, rev = TXREV(q), m = new Map();
    for (const b of q.br) { const [a, e] = txRange(b, q.d0, q.d1); for (let i = a; i < e; i++) { const c = tx.cust[i]; if (c < 0) continue; let o = m.get(c); if (!o) { o = { c, spend: 0, visits: 0, last: 0 }; m.set(c, o); } o.spend += rev[i]; o.visits++; o.last = Math.max(o.last, tx.day[i]); } }
    return [...m.values()].sort((x, y) => y.spend - x.spend).slice(0, n).map((o) => ({ ...o, id: custLabel(o.c), loyalty: loyaltyId(o.c), segment: SEGMENT_NAMES[DS.cust.seg[o.c]], branch: DS.branches[DS.cust.branch[o.c]].name, country: DS.branches[DS.cust.branch[o.c]].country, status: !DS.cust.prior[o.c] && DS.cust.first[o.c] >= q.d0 && DS.cust.first[o.c] <= q.d1 ? 'New' : 'Returning' }));
  });
}
export function newCustomerSeries(q, grain) {
  return series(q, grain).map((s) => ({ label: s.label, key: s.key, newCust: s.newCust }));
}

export function productByBranch(q, skuList) {
  return memo(`pbb|${q.key}|${skuList.join(',')}`, () => {
    const set = new Set(skuList), tx = DS.tx, ln = DS.line, lr = LNREV(q), lc = LNCOGS(q), rows = [];
    for (const b of q.br) {
      const [a, e] = txRange(b, q.d0, q.d1); let qty = 0, rev = 0, cogs = 0;
      for (let i = a; i < e; i++) { const l1 = lineEnd(i); for (let l = tx.line[i]; l < l1; l++) if (set.has(ln.sku[l])) { qty += ln.qty[l]; rev += lr[l]; cogs += lc[l]; } }
      const br = DS.branches[b];
      if (qty > 0) rows.push({ b: br, id: br.id, name: br.name, country: br.country, city: br.city, qty, rev, cogs, margin: rev ? (rev - cogs) / rev : null });
    }
    return rows;
  });
}
export function stockForSkus(skuList, branchIdx) {
  const set = new Set(skuList), out = [];
  for (const b of branchIdx) for (const s of set) {
    const k = b * DS.S + s, stock = DS.inv.stock[k], rp = DS.inv.rp[k];
    out.push({ b: DS.branches[b], sku: s, stock, rp, status: stock <= 0 ? 'out' : stock <= rp ? 'low' : 'ok' });
  }
  return out;
}
