// Rules-based anomaly detection. Every alert is computed from the generated dataset (no random claims).
import { getDS, makeQ, totals, kpis, inventoryRows, invStats, reviewStats, discrepancies, series, withBranches, lineAgg } from './query.js';
import { DAYS, TODAY, fmtDay, weekday } from './dates.js';
import { money, signedPct, num, pctf } from './format.js';

export const SEVERITY = { critical: { label: 'Critical', rank: 0 }, high: { label: 'High', rank: 1 }, medium: { label: 'Medium', rank: 2 }, info: { label: 'Opportunity', rank: 3 } };
export const ALERT_TYPES = {
  decline: 'Sales decline', stockout: 'Stock-out', expense: 'Expense anomaly', target: 'Below target', data: 'Data delay', demand: 'High demand',
  country: 'Country trend', rating: 'Customer rating', discrepancy: 'Stock discrepancy',
};

let _cache = null;
export function buildAlerts() {
  const DS = getDS();
  if (_cache && _cache.ds === DS) return _cache.list;
  const list = [];
  const T = TODAY;
  const cube = DS.cube;
  const brs = DS.branches;
  const rev = (b, d0, d1) => { let s = 0, t = 0; for (let d = d0; d <= d1; d++) { s += cube.revUsd[b * DAYS + d]; t += cube.txns[b * DAYS + d]; } return { rev: s, txns: t }; };
  const add = (a) => list.push({ refDay: T, ...a });

  // 1) Missing / delayed data
  for (const b of brs) {
    if (b.lastDataDay < T) {
      const days = T - b.lastDataDay;
      add({
        id: `data:${b.id}`, type: 'data', severity: days >= 3 ? 'high' : 'medium', country: b.country, branchId: b.id, title: `${b.name}: sales data delayed`,
        what: `No transactions have been received from ${b.name} (${b.city}) since ${fmtDay(b.lastDataDay, { long: true })}. The last simulated synchronization is ${days} trading ${days === 1 ? 'day' : 'days'} old.`,
        figures: [{ label: 'Days without data', value: String(days) }, { label: 'Last data received', value: fmtDay(b.lastDataDay) }, { label: 'Revenue recorded since', value: '$0' }],
        why: 'Zero recorded sales here is a data gap, not necessarily a trading collapse. It also depresses country and group totals for the period and can trigger false sales-decline signals.',
        action: 'Check the branch point-of-sale synchronization and connectivity, and confirm whether the branch traded normally. Re-run the reports once the data arrives.',
        evidence: { kind: 'branch', branch: b.idx },
      });
    }
  }

  // 2) Branch sales decline: last 2 trading days vs same weekdays previous week, and vs 4-week average of equivalent windows
  for (const b of brs) {
    if (b.lastDataDay < T) continue;
    const cur = rev(b.idx, T - 1, T), prev = rev(b.idx, T - 8, T - 7);
    const hist = []; for (let w = 1; w <= 8; w++) hist.push(rev(b.idx, T - 1 - 7 * w, T - 7 * w));
    const mean = hist.reduce((a, r) => a + r.txns, 0) / 8, sd = Math.sqrt(hist.reduce((a, r) => a + (r.txns - mean) ** 2, 0) / 7);
    const avg = hist.slice(0, 4).reduce((a, r) => a + r.rev, 0) / 4;
    if (prev.txns < 20 || !prev.rev) continue;
    const ch = (cur.rev - prev.rev) / prev.rev, chAvg = (cur.rev - avg) / avg, chTx = (cur.txns - prev.txns) / prev.txns;
    const z = sd ? (cur.txns - mean) / sd : 0;
    if (ch <= -0.2 && chAvg <= -0.15 && chTx <= -0.25 && z <= -2.0) {
      const td = rev(b.idx, T, T), tp = rev(b.idx, T - 7, T - 7);
      add({
        id: `decline:${b.id}`, type: 'decline', severity: ch <= -0.3 ? 'critical' : 'high', country: b.country, branchId: b.id,
        title: `${b.name}: revenue down ${Math.abs(Math.round(ch * 100))}% over the last two trading days`,
        what: `${b.name}: revenue declined ${Math.abs(ch * 100).toFixed(0)}% compared with the previous equivalent days (${fmtDay(T - 8, { noYear: true })}–${fmtDay(T - 7, { noYear: true })}). Transaction volume fell ${Math.abs(chTx * 100).toFixed(0)}%. Review customer traffic, product availability and transaction records.`,
        figures: [
          { label: `Revenue, ${fmtDay(T - 1, { noYear: true })}–${fmtDay(T, { noYear: true })}`, value: money(cur.rev), compare: `${money(prev.rev)} previous equivalent (${signedPct(ch, 0)})` },
          { label: 'Transactions', value: num(cur.txns), compare: `${num(prev.txns)} previous equivalent (${signedPct(chTx, 0)})` },
          { label: 'Vs 4-week average of equivalent days', value: signedPct(chAvg, 0), compare: `average ${money(avg)}` },
          { label: `Today (${fmtDay(T, { noYear: true })}) vs same weekday last week`, value: signedPct(tp.rev ? (td.rev - tp.rev) / tp.rev : null, 0), compare: `${money(td.rev)} vs ${money(tp.rev)}` },
        ],
        why: 'A sustained fall in both revenue and transactions points to lost footfall or availability rather than smaller baskets. Left unaddressed it will push the branch below target and into the country trend.',
        action: 'Review customer traffic, out-of-stock products at the branch, and the transaction log. Compare against neighbouring branches in the same city.',
        evidence: { kind: 'branch', branch: b.idx },
      });
    }
  }

  // 3) Stock-outs: product-level by country, and branch-level top sellers
  const inv = inventoryRows(makeQ({}, T, T, 'USD'));
  const st = invStats();
  const byCs = new Map();
  for (const r of inv) { if (r.status !== 'out') continue; const k = `${r.country}|${r.p.idx}`; if (!byCs.has(k)) byCs.set(k, []); byCs.get(k).push(r); }
  const cCount = Object.fromEntries(DS.countries.map((c) => [c.code, c.branchCount]));
  const csByCountry = new Map();
  for (const [k, rows] of byCs) {
    const [cc, pi] = k.split('|');
    if (rows.length >= Math.max(3, Math.ceil(cCount[cc] * 0.3))) { if (!csByCountry.has(cc)) csByCountry.set(cc, []); csByCountry.get(cc).push({ p: DS.catalog[+pi], rows }); }
  }
  for (const [cc, items] of csByCountry) {
    const cn = DS.countryByCode.get(cc);
    items.sort((x, y) => y.rows.length - x.rows.length);
    const worst = items[0];
    const allRows = items.flatMap((i) => i.rows);
    const sold60 = allRows.reduce((a, r) => a + r.sold60, 0);
    add({
      id: `stockout:${cc}`, type: 'stockout', severity: worst.rows.length >= cCount[cc] * 0.5 ? 'critical' : 'high', country: cc, productId: worst.p.id,
      title: items.length === 1 ? `${worst.p.name} out of stock in ${worst.rows.length} of ${cCount[cc]} ${cn.name} branches` : `${cn.name}: ${items.length} products out of stock in at least 30% of branches`,
      what: items.length === 1
        ? `${worst.p.name} (${worst.p.sku}) has zero stock at ${worst.rows.length} of ${cCount[cc]} branches in ${cn.name}. The replenishment pipeline for this product appears delayed.`
        : `${items.length} products have zero stock at several ${cn.name} branches, led by ${worst.p.name} (out at ${worst.rows.length} of ${cCount[cc]} branches). This pattern suggests a replenishment or supplier delay rather than normal branch-level variation.`,
      figures: [{ label: 'Products affected', value: String(items.length) }, { label: 'Worst-hit product', value: worst.p.shortName, compare: `${worst.rows.length} / ${cCount[cc]} branches out` }, { label: 'Units sold at the affected positions, previous 60 days', value: num(sold60) }, { label: 'Out-of-stock branch positions', value: num(allRows.length) }],
      why: 'These are core-range products. Customers who cannot buy them will switch brand or delay projects, and the lost sales appear as country-level revenue decline.',
      action: 'Confirm supplier lead times and pending purchase orders, expedite replenishment, and consider inter-branch transfers from branches with surplus stock.',
      evidence: { kind: 'stockout', country: cc, product: worst.p.idx, rows: allRows.map((r) => r.key), items: items.map((i) => ({ product: i.p.idx, branches: i.rows.length })) },
    });
  }
  for (const b of brs) {
    const base = b.idx * DS.S;
    const top = [...Array(DS.S).keys()].sort((x, y) => st.v60[base + y] - st.v60[base + x]).slice(0, 15);
    const out = top.filter((s) => DS.inv.stock[base + s] <= 0);
    if (out.length >= 3 && b.lastDataDay === T && !csByCountry.has(b.country)) {
      add({
        id: `stockout:branch:${b.id}`, type: 'stockout', severity: out.length >= 3 ? 'critical' : 'high', country: b.country, branchId: b.id,
        title: `${b.name}: ${out.length} of the top-15 selling products are out of stock`,
        what: `${out.map((s) => DS.catalog[s].name).join('; ')} ${out.length === 1 ? 'is' : 'are'} unavailable at ${b.name}, although they are among the branch's fastest sellers over the previous 60 days.`,
        figures: [{ label: 'Top-15 products out of stock', value: `${out.length} / 15` }, ...out.slice(0, 3).map((s) => ({ label: DS.catalog[s].shortName, value: `${num(st.v60[base + s])} units sold (60d)`, compare: 'Stock: 0' }))],
        why: 'Missing best-sellers reduce basket size and footfall; this is a likely contributor to any recent sales decline at this branch.',
        action: 'Raise urgent replenishment or transfers for the listed products and check why the standard reorder cycle did not cover them.',
        evidence: { kind: 'branchStock', branch: b.idx, skus: out },
      });
    }
  }

  // 4) Expense category anomalies by country (local-currency basis removes FX noise)
  for (const c of DS.countries) {
    const brIdx = brs.filter((b) => b.country === c.code).map((b) => b.idx);
    DS.expCats.forEach((cat) => {
      const sum = (d0, d1, arr) => { let s = 0; for (const b of brIdx) for (let d = d0; d <= d1; d++) s += arr[(b * DAYS + d) * 7 + cat.id]; return s; };
      const cur = sum(T - 13, T, DS.exp.loc) / 14, base = sum(T - 41, T - 14, DS.exp.loc) / 28;
      const curU = sum(T - 13, T, DS.exp.usd), baseU = sum(T - 41, T - 14, DS.exp.usd) / 2;
      const ch = (cur - base) / base;
      if (ch >= 0.15) {
        add({
          id: `expense:${c.code}:${cat.id}`, type: 'expense', severity: ch >= 0.3 ? 'high' : 'medium', country: c.code,
          title: `${c.name}: ${cat.name} up ${(ch * 100).toFixed(0)}% against its recent baseline`,
          what: `${cat.name} expense across ${brIdx.length} ${c.name} branches averaged ${(ch * 100).toFixed(0)}% higher over the last 14 days than over the previous 28 days (measured in ${c.currency}, so currency movements are excluded).`,
          figures: [{ label: 'Last 14 days (USD equivalent)', value: money(curU), compare: `${money(baseU)} in the 14 days of the earlier baseline` }, { label: 'Change in daily average', value: signedPct(ch, 0) }, { label: 'Branches affected', value: String(brIdx.length) }],
          why: 'An unplanned increase in a controllable cost category compresses operating margin even when revenue is stable. Revenue is not profit.',
          action: 'Review invoices and supplier rates for this category, confirm whether the rise is temporary (e.g. one-off freight) and re-forecast the monthly budget.',
          evidence: { kind: 'expense', country: c.code, cat: cat.id },
        });
      }
    });
  }

  // 5) Branches below sales target (trailing 14 days)
  const tgtRows = [];
  for (const b of brs) {
    if (b.lastDataDay < T) continue;
    let r = 0, t = 0; for (let d = T - 13; d <= T; d++) { r += cube.revUsd[b.idx * DAYS + d]; t += cube.targetUsd[b.idx * DAYS + d]; }
    if (t && r / t < 0.88) tgtRows.push({ b, r, t, a: r / t });
  }
  tgtRows.sort((x, y) => x.a - y.a).slice(0, 6).forEach(({ b, r, t, a }) => {
    add({
      id: `target:${b.id}`, type: 'target', severity: a < 0.8 ? 'high' : 'medium', country: b.country, branchId: b.id,
      title: `${b.name}: ${pctf(a, 0)} of sales target over the last 14 days`,
      what: `${b.name} (${b.city}) has delivered ${pctf(a, 1)} of its sales target in the last 14 days — a shortfall of ${money(t - r)}.`,
      figures: [{ label: 'Revenue, last 14 days', value: money(r) }, { label: 'Target, last 14 days', value: money(t) }, { label: 'Attainment', value: pctf(a, 1) }],
      why: 'Persistent target misses indicate either an unrealistic target or genuine commercial under-performance such as weak traffic, pricing or availability.',
      action: 'Review the branch target-setting basis, local competition and product availability; agree a recovery plan with the regional lead.',
      evidence: { kind: 'branch', branch: b.idx },
    });
  });

  // 6) Unusually high demand: units last 7 days vs weekly average of previous 28 days, by country x sku
  const agg = (cc, d0, d1) => lineAgg(makeQ({ country: cc }, d0, d1, 'USD'));
  for (const c of DS.countries) {
    const cur = agg(c.code, T - 6, T), base = agg(c.code, T - 34, T - 7);
    for (let s = 0; s < DS.S; s++) {
      const u = cur.lines[s], bu = base.lines[s] / 4;
      if (u >= 25 && bu > 0 && u / bu >= 1.8) {
        const p = DS.catalog[s];
        let outB = 0, lowB = 0; for (const b of brs) if (b.country === c.code) { const k = b.idx * DS.S + s; if (DS.inv.stock[k] <= 0) outB++; else if (DS.inv.stock[k] <= DS.inv.rp[k]) lowB++; }
        add({
          id: `demand:${c.code}:${p.id}`, type: 'demand', severity: 'info', country: c.code, productId: p.id,
          title: `${p.name}: demand ${((u / bu - 1) * 100).toFixed(0)}% above normal in ${c.name}`,
          what: `${num(cur.qty[s])} units of ${p.name} sold in ${c.name} in the last 7 days (${num(u)} order lines) against a typical week of ${num(bu)} order lines over the previous 28 days.`,
          figures: [{ label: 'Order lines, last 7 days', value: num(u), compare: `${num(bu)} weekly average (prior 4 weeks)` }, { label: 'Units, last 7 days', value: num(cur.qty[s]) }, { label: 'Revenue, last 7 days', value: money(cur.revC[c.idx * DS.S + s]) }, { label: 'Branches out / low of stock', value: `${outB} out · ${lowB} low` }],
          why: 'Unusual demand is a revenue opportunity but also a stock-out risk; the product may deplete before the next replenishment cycle.',
          action: 'Confirm the cause (season, project, competitor stock-out), raise safety stock and align replenishment with the higher run rate.',
          evidence: { kind: 'demand', country: c.code, product: s },
        });
      }
    }
  }

  // 7) Country declining across several consecutive weeks (Mon–Sun, USD)
  for (const c of DS.countries) {
    const wk = []; const lastSun = T - ((weekday(T) + 1) % 7 === 0 ? 0 : weekday(T) === 6 ? 0 : weekday(T) + 1);
    for (let w = 0; w < 6; w++) { const e = lastSun - 7 * w; wk.push(series(makeQ({ country: c.code }, e - 6, e, 'USD'), 'month').reduce((a, s) => a + s.revUsd, 0)); }
    // wk[0] latest
    let decl = 0; for (let i = 0; i < 4; i++) if (wk[i] < wk[i + 1]) decl++;
    const recent = (wk[0] + wk[1] + wk[2]) / 3, prior = (wk[3] + wk[4] + wk[5]) / 3, cum = (recent - prior) / prior;
    if (decl >= 3 && cum <= -0.06) {
      add({
        id: `country:${c.code}`, type: 'country', severity: cum <= -0.12 ? 'critical' : 'high', country: c.code,
        title: `${c.name}: revenue declining — down in ${decl} of the last 4 weeks`,
        what: `${c.name} weekly revenue fell in ${decl} of the last 4 week-over-week comparisons. The latest 3-week average (${money(recent)}) is ${Math.abs(cum * 100).toFixed(1)}% below the previous 3-week average (${money(prior)}), measured in USD over Monday–Sunday weeks.`,
        figures: [...wk.slice(0, 6).map((v, i) => ({ label: i === 0 ? 'Latest full week' : `${i} week${i > 1 ? 's' : ''} earlier`, value: money(v) })), { label: 'Latest 3 weeks vs previous 3 weeks', value: signedPct(cum, 1) }],
        why: 'Several consecutive declines indicate a structural issue (availability, pricing, competition or currency) rather than normal weekly volatility.',
        action: 'Open the country dashboard, check branch-level declines, stock-outs and expense pressure, and review local pricing and FX effects.',
        evidence: { kind: 'country', country: c.code, weeks: wk.slice(0, 6), lastSun },
      });
    }
  }

  // 8) Rating drops (last 30 days vs the preceding 90 days)
  for (const b of brs) {
    const q1 = makeQ({ branch: b.id }, T - 29, T, 'USD'), q0 = makeQ({ branch: b.id }, T - 119, T - 30, 'USD');
    const r1 = reviewStats(q1), r0 = reviewStats(q0);
    if (r1.count >= 12 && r0.count >= 25 && r1.avg - r0.avg <= -0.5) {
      const top = [...r1.cats].sort((x, y) => y.complaints - x.complaints)[0];
      add({
        id: `rating:${b.id}`, type: 'rating', severity: r1.avg - r0.avg <= -0.8 ? 'high' : 'medium', country: b.country, branchId: b.id,
        title: `${b.name}: average customer rating fell to ${r1.avg.toFixed(2)}`,
        what: `Customer rating at ${b.name} averaged ${r1.avg.toFixed(2)} over the last 30 days (${r1.count} reviews) versus ${r0.avg.toFixed(2)} in the preceding 90 days. The most frequent complaint theme is "${top.name}".`,
        figures: [{ label: 'Rating, last 30 days', value: r1.avg.toFixed(2), compare: `${r0.avg.toFixed(2)} previous 90 days` }, { label: 'Reviews', value: `${r1.count}`, compare: `${(r1.verifiedShare * 100).toFixed(0)}% from verified purchases` }, { label: 'Top complaint theme', value: top.name, compare: `${top.complaints} complaints (rating ≤ 2)` }],
        why: 'Falling satisfaction usually precedes lost repeat purchases among loyalty customers.',
        action: 'Review recent comments, address the leading complaint theme and brief the branch team.',
        evidence: { kind: 'rating', branch: b.idx },
      });
    }
  }

  // 9) Stock discrepancies (large count adjustments in the last 30 days)
  const disc = discrepancies(makeQ({}, T, T, 'USD'), 30).filter((r) => Math.abs(r.qty) >= 8);
  const dBy = new Map(); disc.forEach((r) => { if (!dBy.has(r.branchId)) dBy.set(r.branchId, []); dBy.get(r.branchId).push(r); });
  for (const [bid, rows] of dBy) {
    if (rows.length < 3) continue;
    const b = DS.branchById.get(bid), units = rows.reduce((a, r) => a + Math.abs(r.qty), 0);
    add({
      id: `discrepancy:${bid}`, type: 'discrepancy', severity: units >= 120 ? 'high' : 'medium', country: b.country, branchId: bid,
      title: `${b.name}: ${rows.length} large stock count adjustments in 30 days`,
      what: `${rows.length} stock-count adjustments of 8 units or more were posted at ${b.name} in the last 30 days, removing ${num(units)} units from recorded inventory.`,
      figures: [{ label: 'Adjustments ≥ 8 units', value: String(rows.length) }, { label: 'Units written down', value: num(units) }, { label: 'Most recent', value: fmtDay(rows[0].day) }],
      why: 'Repeated large adjustments can indicate shrinkage, receiving errors or process breakdown, and distort availability planning.',
      action: 'Schedule a cycle count of the affected products and review receiving and handling controls.',
      evidence: { kind: 'discrepancy', branch: b.idx, rows },
    });
  }

  list.sort((a, b) => SEVERITY[a.severity].rank - SEVERITY[b.severity].rank);
  _cache = { ds: DS, list };
  return list;
}
