// Deterministic generator for the fictional Nash Paints dataset.
// Everything downstream (KPIs, charts, alerts, reports, assistant) is derived from these arrays.
import { mulberry32, hashStr, poisson, normal, buildCdf, cdfPick } from './rng.js';
import {
  COUNTRIES, NETWORK, TIER_TXN, buildCatalog, SEGMENTS, ANON_SEGMENT, EXPENSE_CATEGORIES,
  REVIEW_CATEGORIES, COMMENTS, PAYMENT_METHODS,
} from './reference.js';
import { DAYS, TODAY, weekday, monthIndex, ymd, daysInMonth, monthStartDay } from '../lib/dates.js';

const SEED = 20261101;
const WDF = [1.0, 0.98, 1.0, 1.03, 1.1, 1.3, 0.35];
const SEASON = [0.92, 0.9, 0.96, 1.0, 0.98, 0.94, 0.96, 1.0, 1.06, 1.1, 1.14, 1.2];
const COUNTRY_SCALE = { ZW: 1.0, BW: 0.88, ZM: 0.92, MW: 0.8, KE: 1.12 };
const LEAD = { ZW: [3, 6], BW: [4, 7], ZM: [4, 8], MW: [5, 9], KE: [3, 6] };
const MONTHS_N = 23;

class Grow {
  constructor(Type, cap = 1 << 16) { this.T = Type; this.a = new Type(cap); this.n = 0; }
  push(v) {
    if (this.n === this.a.length) { const b = new this.T(this.a.length * 2); b.set(this.a); this.a = b; }
    this.a[this.n++] = v;
  }
  done() { return this.a.slice(0, this.n); }
}

function niceRound(v, code) {
  switch (code) {
    case 'USD': return Math.round(v * 2) / 2;
    case 'BWP': case 'ZMW': return Math.max(1, Math.round(v));
    case 'MWK': return Math.max(100, Math.round(v / 100) * 100);
    case 'KES': return Math.max(10, Math.round(v / 10) * 10);
    default: return v;
  }
}

export function buildDataset() {
  const t0 = Date.now();
  const D = DAYS, T = TODAY;
  const catalog = buildCatalog();
  const S = catalog.length;
  const C = COUNTRIES.length;
  const NCAT = EXPENSE_CATEGORIES.length;
  const skuByName = (n) => catalog.findIndex((p) => p.name.includes(n));
  const skuBy = (rangeId, colour, L) => catalog.findIndex((p) => p.rangeId === rangeId && p.colour === colour && p.sizeL === L);

  // ---------- Exchange rates (fictional, monthly) ----------
  const fx = COUNTRIES.map((c, ci) => {
    const r = mulberry32(SEED + 77 + ci);
    const arr = new Float64Array(MONTHS_N);
    let noise = 0;
    for (let m = 0; m < MONTHS_N; m++) {
      noise = noise * 0.5 + (r() - 0.5) * 0.008;
      arr[m] = c.currency === 'USD' ? 1 : c.baseRate * Math.pow(1 + c.drift, m) * (1 + noise);
      if (c.currency !== 'USD') arr[m] = Math.round(arr[m] * 10000) / 10000;
    }
    return arr;
  });
  const monthOf = new Uint8Array(D);
  for (let d = 0; d < D; d++) monthOf[d] = monthIndex(d);
  const periodOf = (d) => Math.floor(monthOf[d] / 6);
  const NPER = Math.floor((MONTHS_N - 1) / 6) + 1;
  const priceLoc = [];
  for (let p = 0; p < NPER; p++) {
    priceLoc.push(COUNTRIES.map((c, ci) => catalog.map((s) => niceRound(s.price * fx[ci][Math.min(p * 6, MONTHS_N - 1)], c.currency))));
  }

  // ---------- SKU sampling distributions per country x segment ----------
  const COUNTRY_CAT = {
    ZW: { 'Interior Paint': 1, 'Exterior Paint': 1, Primers: 1, 'Protective Coatings': 1, 'Related Supplies': 1 },
    BW: { 'Interior Paint': 0.95, 'Exterior Paint': 1, Primers: 1, 'Protective Coatings': 1.25, 'Related Supplies': 1 },
    ZM: { 'Interior Paint': 0.95, 'Exterior Paint': 1.05, Primers: 1.15, 'Protective Coatings': 1.05, 'Related Supplies': 1 },
    MW: { 'Interior Paint': 1.15, 'Exterior Paint': 0.9, Primers: 1.0, 'Protective Coatings': 0.85, 'Related Supplies': 1.1 },
    KE: { 'Interior Paint': 1.0, 'Exterior Paint': 1.2, Primers: 1.0, 'Protective Coatings': 1.05, 'Related Supplies': 1.05 },
  };
  const sizeClass = (p) => (p.sizeL === 0 ? 5 : p.sizeL);
  const cdf = COUNTRIES.map((c) => SEGMENTS.map((sg) => {
    const w = catalog.map((p) => {
      const sizeW = p.sizeL === 0 ? 1 : sg.size[p.sizeL];
      return p.pop * sg.cat[p.category] * sizeW * COUNTRY_CAT[c.code][p.category];
    });
    return buildCdf(w);
  }));
  const avgShare = COUNTRIES.map((c, ci) => {
    const out = new Float64Array(S);
    for (let sg = 0; sg < SEGMENTS.length; sg++) {
      let prev = 0;
      for (let s = 0; s < S; s++) { const sh = cdf[ci][sg][s] - prev; prev = cdf[ci][sg][s]; out[s] += sh * SEGMENTS[sg].share; }
    }
    return out;
  });
  const referenceTxn = 8;
  const refCountry = 0;
  catalog.forEach((p) => {
    const lam = referenceTxn * 4.0 * avgShare[refCountry][p.idx];
    p.reorderThreshold = Math.max(3, Math.ceil(lam * 10 * 1.25) + 2);
  });

  // ---------- Branches ----------
  const countries = COUNTRIES.map((c, i) => ({ ...c, idx: i, branchCount: 0 }));
  const cities = [], branches = [];
  const rb = mulberry32(SEED + 5);
  const HQ = { tier: 'F' };
  countries.forEach((c) => {
    for (const [ccode, cityName, list] of NETWORK[c.code]) {
      const city = { id: `${c.code}-${ccode}`, code: ccode, name: cityName, country: c.code, countryIdx: c.idx, branchCount: list.length };
      cities.push(city);
      list.forEach(([name, tier], i) => {
        const b = {
          idx: branches.length,
          id: `${c.code}-${ccode}-${String(i + 1).padStart(2, '0')}`,
          name, city: cityName, cityId: city.id, country: c.code, countryIdx: c.idx, currency: c.currency, tier,
          baseTxn: TIER_TXN[tier] * COUNTRY_SCALE[c.code] * (0.88 + rb() * 0.26),
          perf: 0.93 + rb() * 0.14,
          idRate: 0.55 + rb() * 0.17,
          quality: 3.75 + rb() * 0.75,
          planFactor: 0.97 + rb() * 0.1,
          opexFactor: 0.88 + rb() * 0.25,
          sc: {},
        };
        branches.push(b);
        c.branchCount++;
      });
    }
  });
  const B = branches.length;
  const byName = (n) => branches.find((b) => b.name === n);

  // ---------- Demonstration scenarios ----------
  const scen = { spikes: [], supplierDelays: [], expenseSpikes: [], stockBlocks: [], trends: [] };
  const hc = byName('Harare Central');
  hc.sc.decline = { from: T - 1, txn: 0.55, qty: 0.85 };
  const hcBlock = [skuBy('INT-SILK', 'Arctic White', 5), skuBy('EXT-WG', 'Arctic White', 20), skuBy('PRM-UNI', 'Arctic White', 5), skuBy('INT-MATT', 'Arctic White', 20)];
  scen.stockBlocks.push({ branch: hc.idx, skus: hcBlock, from: T - 9 });
  scen.trends.push({ country: 'MW', from: T - 35, perDay: 0.0085 });
  scen.supplierDelays.push({ country: 'MW', from: T - 40, lead: 60, skus: [skuBy('INT-SILK', 'Arctic White', 5), skuBy('PRM-UNI', 'Arctic White', 5), skuBy('INT-SILK', 'Soft Linen', 5), skuBy('INT-MATT', 'Arctic White', 20), skuBy('INT-SILK', 'Arctic White', 20), skuBy('PRM-UNI', 'Arctic White', 20), skuBy('INT-SILK', 'Savannah Sand', 5)] });
  scen.expenseSpikes.push({ country: 'ZM', cat: 3, from: T - 20, mult: 1.42 });
  scen.spikes.push({ country: 'KE', sku: skuBy('EXT-WG', 'Arctic White', 20), from: T - 10, p: 0.09 });
  scen.spikes.push({ country: 'BW', sku: skuBy('PRT-ROOF', 'Charcoal Black', 20), from: T - 9, p: 0.09 });
  byName('Kasane Town').sc.missingFrom = T;
  byName('Selebi-Phikwe Central').sc.missingFrom = T - 2;
  ['Eastleigh', 'Gaborone West Industrial', 'Parklands', 'Sakubva', 'Chilenje'].forEach((n) => { byName(n).planFactor = 1.3; });
  byName('Limbe').planFactor = 1.15;
  byName('Limbe').sc.rating = { from: T - 30, shift: -1.15, cat: 'Wait time' };
  byName('Eastleigh').sc.rating = { from: T - 45, shift: -0.75, cat: 'Colour matching' };
  byName('Westlands').sc.ramp = { from: T - 120, perDay: 0.0026 };
  byName('Matero').sc.discrepancy = [T - 24, T - 17, T - 9, T - 3];
  scen.spikeSkuNames = scen.spikes.map((s) => catalog[s.sku].name);

  // ---------- Output containers ----------
  const cBranch = new Grow(Int16Array), cSeg = new Grow(Uint8Array), cCard = new Grow(Uint8Array), cFirst = new Grow(Int16Array), cPrior = new Grow(Uint8Array);
  const tDay = new Grow(Uint16Array, 1 << 18), tBr = new Grow(Uint8Array, 1 << 18), tMin = new Grow(Uint16Array, 1 << 18), tCust = new Grow(Int32Array, 1 << 18),
    tPay = new Grow(Uint8Array, 1 << 18), tCard = new Grow(Uint8Array, 1 << 18), tCls = new Grow(Uint8Array, 1 << 18), tSeg = new Grow(Uint8Array, 1 << 18),
    tLoc = new Grow(Float64Array, 1 << 18), tUsd = new Grow(Float64Array, 1 << 18), tCogsLoc = new Grow(Float64Array, 1 << 18), tCogsUsd = new Grow(Float64Array, 1 << 18),
    tUnits = new Grow(Uint16Array, 1 << 18), tLine = new Grow(Int32Array, 1 << 18);
  const lSku = new Grow(Uint8Array, 1 << 19), lQty = new Grow(Uint16Array, 1 << 19), lLoc = new Grow(Float64Array, 1 << 19), lUsd = new Grow(Float64Array, 1 << 19),
    lCogsLoc = new Grow(Float64Array, 1 << 19), lCogsUsd = new Grow(Float64Array, 1 << 19);
  const txStart = new Int32Array(B * D + 1);
  const mvBr = new Grow(Uint8Array), mvSku = new Grow(Uint8Array), mvDay = new Grow(Uint16Array), mvQty = new Grow(Int16Array), mvType = new Grow(Uint8Array);
  const N = B * D;
  const cube = {
    revUsd: new Float64Array(N), revLoc: new Float64Array(N), cogsUsd: new Float64Array(N), cogsLoc: new Float64Array(N),
    txns: new Uint16Array(N), units: new Uint32Array(N), idTx: new Uint16Array(N), anonTx: new Uint16Array(N), cardTx: new Uint16Array(N),
    dCust: new Uint16Array(N), newCust: new Uint16Array(N), targetUsd: new Float64Array(N), targetLoc: new Float64Array(N),
    onHand: new Int32Array(N), outSkus: new Uint8Array(N), lowSkus: new Uint8Array(N), missing: new Uint8Array(N),
  };
  const exp = { loc: new Float64Array(N * NCAT), usd: new Float64Array(N * NCAT), budLoc: new Float64Array(N * NCAT), budUsd: new Float64Array(N * NCAT) };
  const reviews = [];
  const inv = { open: new Int32Array(B * S), stock: new Int32Array(B * S), rp: new Int32Array(B * S), oup: new Int32Array(B * S), lastReceipt: new Int16Array(B * S).fill(-1) };
  let custCount = 0, txCount = 0, lineCount = 0, revCounter = 0;
  const lineSkusTmp = new Int16Array(12);

  for (const br of branches) {
    const b = br.idx, ci = br.countryIdx, cc = br.country;
    const rng = mulberry32(hashStr(br.id) ^ SEED);
    const stock = new Int32Array(S), rp = new Int32Array(S), oup = new Int32Array(S), pendDay = new Int16Array(S).fill(-1), pendQty = new Int32Array(S);
    const lead = LEAD[cc];
    for (let s = 0; s < S; s++) {
      const lam = br.baseTxn * 4.0 * avgShare[ci][s];
      rp[s] = Math.max(3, Math.ceil(lam * (lead[1] + 2)) + 1);
      oup[s] = rp[s] + Math.max(5, Math.ceil(lam * 14));
      stock[s] = Math.round(oup[s] * (0.6 + 0.4 * rng()));
      inv.open[b * S + s] = stock[s]; inv.rp[b * S + s] = rp[s]; inv.oup[b * S + s] = oup[s];
    }
    let onHand = 0; for (let s = 0; s < S; s++) onHand += stock[s];
    // legacy customers: have purchase history before the data window
    const pool = [];
    const legacyN = Math.round(br.baseTxn * 24);
    const segCdf = buildCdf(SEGMENTS.map((x) => x.share));
    const newCustomer = (seg, firstDay, prior) => {
      const id = custCount++;
      cBranch.push(b); cSeg.push(seg); cCard.push(rng() < 0.55 ? 1 : 0); cFirst.push(firstDay); cPrior.push(prior);
      pool.push(id);
      return id;
    };
    for (let i = 0; i < legacyN; i++) newCustomer(cdfPick(segCdf, rng()), -1, 1);
    const spikes = scen.spikes.filter((s) => s.country === cc);
    const delays = scen.supplierDelays.filter((s) => s.country === cc);
    const blocks = scen.stockBlocks.filter((s) => s.branch === b);
    const trend = scen.trends.find((t) => t.country === cc);
    const cardArr = cCard.a; // live reference reads after growth: use accessor below
    const sumRevLoc = { v: 0, n: 0 };
    const dayRevLoc = new Float64Array(D), dayRevUsd = new Float64Array(D);
    const stampArr = []; // per-day distinct identified customers
    const seenDay = new Map();

    for (let d = 0; d < D; d++) {
      const bi = b * D + d;
      txStart[bi] = txCount;
      const mi = monthOf[d], period = periodOf(d), rate = fx[ci][mi];
      const wd = weekday(d), { m: month } = ymd(d);
      // receipts
      for (let s = 0; s < S; s++) {
        if (pendDay[s] === d) {
          stock[s] += pendQty[s]; onHand += pendQty[s];
          mvBr.push(b); mvSku.push(s); mvDay.push(d); mvQty.push(pendQty[s]); mvType.push(0);
          inv.lastReceipt[b * S + s] = d; pendDay[s] = -1;
        }
      }
      // stock block (inter-branch transfer out + suspended replenishment) scenario
      for (const blk of blocks) {
        if (d === blk.from) for (const s of blk.skus) {
          const keep = Math.min(stock[s], 5), out = stock[s] - keep;
          if (out > 0) { stock[s] = keep; onHand -= out; mvBr.push(b); mvSku.push(s); mvDay.push(d); mvQty.push(-out); mvType.push(2); }
          pendDay[s] = -1;
        }
      }
      const missing = br.sc.missingFrom !== undefined && d >= br.sc.missingFrom;
      let txnMult = 1, qtyMult = 1;
      if (trend && d >= trend.from) txnMult *= Math.max(0.55, 1 - trend.perDay * (d - trend.from));
      if (br.sc.decline && d >= br.sc.decline.from) { txnMult *= br.sc.decline.txn; qtyMult *= br.sc.decline.qty; }
      if (br.sc.ramp && d >= br.sc.ramp.from) txnMult *= 1 + br.sc.ramp.perDay * (d - br.sc.ramp.from);
      const lambda = br.baseTxn * WDF[wd] * SEASON[month] * Math.pow(1 + COUNTRIES[ci].trend, d / 30.4) * br.perf * txnMult;
      const nTry = missing ? 0 : Math.max(0, Math.round(lambda + normal(rng) * Math.sqrt(lambda) * 0.4));
      // trading minutes
      const open = wd === 6 ? 510 : wd === 5 ? 480 : 450, close = wd === 6 ? 750 : wd === 5 ? 840 : 1020;
      const mins = [];
      for (let i = 0; i < nTry; i++) mins.push(Math.round(open + ((rng() + rng()) / 2) * (close - open)));
      mins.sort((x, y) => x - y);
      let dRev = 0, dRevU = 0, dCogs = 0, dCogsU = 0, dUnits = 0, dTx = 0, dId = 0, dAnon = 0, dCard = 0, dNew = 0, dCust = 0;
      const dayStartTx = txCount;
      for (let i = 0; i < nTry; i++) {
        const identified = rng() < br.idRate;
        let cust = -1, isNew = false, seg = ANON_SEGMENT, behave;
        if (identified) {
          if (rng() < 0.15) { isNew = true; seg = cdfPick(segCdf, rng()); }
          else { cust = pool[Math.floor(pool.length * Math.pow(rng(), 1.7))]; seg = cSeg.a[cust]; }
          behave = seg;
        } else {
          const r = rng(); behave = r < 0.7 ? 0 : r < 0.9 ? 1 : 2;
        }
        const sg = SEGMENTS[behave];
        const nl = Math.min(6, 1 + poisson(rng, sg.lines - 1));
        let nLines = 0, txLoc = 0, txUsd = 0, txCogsL = 0, txCogsU = 0, txUnitsN = 0;
        const lineStartIdx = lineCount;
        const addLine = (s, wantQty) => {
          if (stock[s] <= 0) return false;
          for (let k = 0; k < nLines; k++) if (lineSkusTmp[k] === s) return false;
          const qty = Math.min(wantQty, stock[s]);
          stock[s] -= qty; onHand -= qty;
          const loc = priceLoc[period][ci][s] * qty, usd = loc / rate, cogsU = catalog[s].cost * qty, cogsL = cogsU * rate;
          lSku.push(s); lQty.push(qty); lLoc.push(loc); lUsd.push(usd); lCogsLoc.push(cogsL); lCogsUsd.push(cogsU);
          lineSkusTmp[nLines++] = s; lineCount++;
          txLoc += loc; txUsd += usd; txCogsL += cogsL; txCogsU += cogsU; txUnitsN += qty;
          return true;
        };
        const qtyMean = 1 + (sg.qty - 1) * qtyMult;
        for (let l = 0; l < nl; l++) {
          let s = -1;
          for (let tries = 0; tries < 3; tries++) { const c = cdfPick(cdf[ci][behave], rng()); if (stock[c] > 0) { s = c; break; } }
          if (s < 0) continue;
          const isSupply = catalog[s].sizeL === 0;
          const q = Math.min(12, 1 + poisson(rng, isSupply ? Math.min(qtyMean - 1, 1.5) : qtyMean - 1));
          addLine(s, q);
        }
        for (const sp of spikes) if (d >= sp.from && rng() < sp.p) addLine(sp.sku, 2 + Math.floor(rng() * 3));
        if (nLines === 0) continue; // lost sale (stock unavailable) - no transaction recorded
        // finalize customer
        let cls = 2;
        if (identified) {
          if (isNew) { cust = newCustomer(seg, d, 0); cls = 0; dNew++; }
          else cls = 1;
          if (seenDay.get(cust) !== d) { seenDay.set(cust, d); dCust++; }
          dId++;
        } else dAnon++;
        const hasCard = identified && cCard.a[cust] === 1 && rng() < 0.92 ? 1 : 0;
        if (hasCard) dCard++;
        // payment
        const pw = sg.pay.slice();
        const mm = { ZW: 1.4, BW: 0.6, ZM: 1.5, MW: 1.6, KE: 1.8 }[cc];
        pw[2] *= mm;
        let r2 = rng() * pw.reduce((a, c) => a + c, 0), pay = 0;
        for (let k = 0; k < pw.length; k++) { r2 -= pw[k]; if (r2 <= 0) { pay = k; break; } }
        tDay.push(d); tBr.push(b); tMin.push(mins[i]); tCust.push(cust); tPay.push(pay); tCard.push(hasCard); tCls.push(cls); tSeg.push(seg);
        tLoc.push(txLoc); tUsd.push(txUsd); tCogsLoc.push(txCogsL); tCogsUsd.push(txCogsU); tUnits.push(txUnitsN); tLine.push(lineStartIdx);
        txCount++; dTx++; dRev += txLoc; dRevU += txUsd; dCogs += txCogsL; dCogsU += txCogsU; dUnits += txUnitsN;
      }
      // reviews
      if (dTx > 0) {
        const rr = poisson(rng, dTx * 0.06);
        const outFrac = (() => { let o = 0; for (let s = 0; s < S; s++) if (stock[s] <= 0) o++; return o / S; })();
        for (let k = 0; k < rr; k++) {
          let mean = br.quality - 4 * Math.max(0, outFrac - 0.06);
          let sc = br.sc.rating && d >= br.sc.rating.from ? br.sc.rating : null;
          if (sc) mean += sc.shift;
          const rating = Math.max(1, Math.min(5, Math.round(mean + normal(rng) * 0.95)));
          const wPos = [0.3, 0.3, 0.12, 0.1, 0.08, 0.05, 0.05], wNeg = [0.2, 0.2, 0.12, 0.18, 0.12, 0.1, 0.08];
          const w = (rating >= 4 ? wPos : wNeg).slice();
          if (rating <= 3) {
            w[3] *= 1 + 8 * outFrac;
            if (sc) w[REVIEW_CATEGORIES.indexOf(sc.cat)] *= 5;
          }
          let r3 = rng() * w.reduce((a, c) => a + c, 0), ck = 0;
          for (let q = 0; q < w.length; q++) { r3 -= w[q]; if (r3 <= 0) { ck = q; break; } }
          const cat = REVIEW_CATEGORIES[ck];
          const list = COMMENTS[cat][rating >= 4 ? 'pos' : 'neg'];
          const verified = rng() < 0.72;
          const txi = dayStartTx + Math.floor(rng() * dTx);
          reviews.push({ id: `RV-${String(++revCounter).padStart(6, '0')}`, day: d, br: b, rating, cat, text: list[Math.floor(rng() * list.length)], verified, tx: verified ? txi : -1, minute: 600 + Math.floor(rng() * 400) });
        }
      }
      // end-of-day: discrepancies, reorder
      if (br.sc.discrepancy && br.sc.discrepancy.includes(d)) {
        for (let k = 0; k < 3; k++) {
          const s = Math.floor(rng() * 40) + 0; const qty = Math.min(stock[s], 8 + Math.floor(rng() * 18));
          if (qty > 0) { stock[s] -= qty; onHand -= qty; mvBr.push(b); mvSku.push(s); mvDay.push(d); mvQty.push(-qty); mvType.push(1); }
        }
      }
      for (let s = 0; s < S; s++) {
        if (rng() < 0.0006 && stock[s] > 1) { const q = 1 + Math.floor(rng() * 2); stock[s] -= q; onHand -= q; mvBr.push(b); mvSku.push(s); mvDay.push(d); mvQty.push(-q); mvType.push(1); }
      }
      let out = 0, low = 0;
      for (let s = 0; s < S; s++) {
        if (stock[s] <= 0) out++; else if (stock[s] <= rp[s]) low++;
        if (pendDay[s] < 0 && stock[s] <= rp[s]) {
          let blocked = false;
          for (const blk of blocks) if (d >= blk.from && blk.skus.includes(s)) blocked = true;
          if (blocked) continue;
          let ld = lead[0] + Math.floor(rng() * (lead[1] - lead[0] + 1));
          for (const dl of delays) if (d >= dl.from && dl.skus.includes(s)) ld = dl.lead;
          pendDay[s] = d + ld; pendQty[s] = Math.max(1, oup[s] - stock[s]);
        }
      }
      cube.revLoc[bi] = dRev; cube.revUsd[bi] = dRevU; cube.cogsLoc[bi] = dCogs; cube.cogsUsd[bi] = dCogsU; cube.txns[bi] = dTx; cube.units[bi] = dUnits;
      cube.idTx[bi] = dId; cube.anonTx[bi] = dAnon; cube.cardTx[bi] = dCard; cube.dCust[bi] = dCust; cube.newCust[bi] = dNew;
      cube.onHand[bi] = onHand; cube.outSkus[bi] = out; cube.lowSkus[bi] = low; cube.missing[bi] = missing ? 1 : 0;
      dayRevLoc[d] = dRev; dayRevUsd[d] = dRevU;
      if (!missing) { sumRevLoc.v += dRev; sumRevLoc.n++; }
    }
    for (let s = 0; s < S; s++) inv.stock[b * S + s] = stock[s];
    br.lastDataDay = br.sc.missingFrom !== undefined ? br.sc.missingFrom - 1 : T;

    // ---- sales targets: trailing 90-day run-rate x plan factor, distributed by weekday ----
    const avgLoc = sumRevLoc.v / Math.max(1, sumRevLoc.n);
    for (let y = 2025; y <= 2026; y++) for (let m = 0; m < 12; m++) {
      const ms = monthStartDay(y, m); if (ms >= D) break;
      const dim = daysInMonth(y, m), me = Math.min(D - 1, ms + dim - 1);
      let tot = 0, n = 0;
      const lo = Math.max(0, ms - 90), hi = ms - 1;
      for (let d = lo; d <= hi; d++) if (!cube.missing[b * D + d]) { tot += dayRevLoc[d]; n++; }
      if (n < 20) { tot = 0; n = 0; for (let d = ms; d < Math.min(D, ms + 28); d++) if (!cube.missing[b * D + d]) { tot += dayRevLoc[d]; n++; } }
      const base = (n ? tot / n : avgLoc) * br.planFactor * (1 + 0.002 * (ms / 30));
      let wsum = 0; for (let d = ms; d < ms + dim; d++) wsum += WDF[weekday(d)];
      for (let d = ms; d <= me; d++) {
        const tl = (base * dim * WDF[weekday(d)]) / wsum, rate = fx[ci][monthOf[d]];
        cube.targetLoc[b * D + d] = tl; cube.targetUsd[b * D + d] = tl / rate;
      }
    }
    // ---- expenses & budgets (accrual basis, per category per day) ----
    const re = mulberry32(hashStr(br.id) ^ (SEED + 9));
    for (let d = 0; d < D; d++) {
      const bi = b * D + d, mi = monthOf[d], rate = fx[ci][mi];
      const { y, m } = ymd(d); const dim = daysInMonth(y, m);
      for (const ec of EXPENSE_CATEGORIES) {
        const monthlyBudgetLoc = avgLoc * 30.4 * ec.pct * br.opexFactor;
        const bud = monthlyBudgetLoc / dim;
        let act = bud * Math.pow(1.0018, mi) * (1 + (ec.noise ? normal(re) * ec.noise : 0));
        for (const es of scen.expenseSpikes) if (es.country === cc && es.cat === ec.id && d >= es.from) act *= es.mult;
        act = Math.max(0, act);
        const k = bi * NCAT + ec.id;
        exp.loc[k] = act; exp.usd[k] = act / rate; exp.budLoc[k] = bud; exp.budUsd[k] = bud / rate;
      }
    }
  }
  txStart[B * D] = txCount;
  // fix any txStart gaps (branch-day indices are written sequentially so all are set)

  const ds = {
    meta: { startISO: '2025-01-01', days: D, today: T, generatedMs: Date.now() - t0, seed: SEED },
    countries, cities, branches, catalog, segments: SEGMENTS, payMethods: PAYMENT_METHODS, expCats: EXPENSE_CATEGORIES, reviewCats: REVIEW_CATEGORIES,
    fx, monthOf, priceLocPeriods: priceLoc, S, B, D, C, scenarios: scen,
    cust: { n: custCount, branch: cBranch.done(), seg: cSeg.done(), card: cCard.done(), first: cFirst.done(), prior: cPrior.done() },
    tx: {
      n: txCount, day: tDay.done(), br: tBr.done(), min: tMin.done(), cust: tCust.done(), pay: tPay.done(), card: tCard.done(), cls: tCls.done(), seg: tSeg.done(),
      loc: tLoc.done(), usd: tUsd.done(), cogsLoc: tCogsLoc.done(), cogsUsd: tCogsUsd.done(), units: tUnits.done(), line: tLine.done(), start: txStart,
    },
    line: { n: lineCount, sku: lSku.done(), qty: lQty.done(), loc: lLoc.done(), usd: lUsd.done(), cogsLoc: lCogsLoc.done(), cogsUsd: lCogsUsd.done() },
    mv: { n: mvBr.n, br: mvBr.done(), sku: mvSku.done(), day: mvDay.done(), qty: mvQty.done(), type: mvType.done() },
    cube, exp, reviews, inv,
  };
  ds.branchById = new Map(branches.map((b) => [b.id, b]));
  ds.countryByCode = new Map(countries.map((c) => [c.code, c]));
  return ds;
}
