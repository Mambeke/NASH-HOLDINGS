// Deterministic demonstration assistant. NOT an AI model: a keyword/entity intent parser that runs fixed analyses over the same
// query layer that drives every screen. It answers only what the data supports and states its basis (scope, period, currency).
import { getDS, makeQ, withRange, kpis, totals, branchRowsCompared, countryRowsCompared, lineAgg, colourRollup, inventoryRows, inventoryTotals, reviewStats, customerStats, expenseBreakdown, pct, series } from './query.js';
import { buildAlerts, SEVERITY, ALERT_TYPES } from './alerts.js';
import { resolvePeriod, fmtDay, fmtRange, TODAY } from './dates.js';
import { demoTotals, DEMO_SPEC } from '../data/demoBiz.js';
import { money, num, pctf, signedPct } from './format.js';

export const EXAMPLES = [
  'What needs my attention today?',
  'Why did Harare Central decline?',
  'Which branches are underperforming this week?',
  'Which colours are selling best?',
  'Which products are at risk of stocking out?',
  'How are sales in Malawi this month?',
  'Compare the countries this week',
  'Are expenses above budget?',
  'How are customer ratings and complaints?',
  'How are new and returning customers trending?',
];

const has = (t, ...ws) => ws.some((w) => (w instanceof RegExp ? w.test(t) : t.includes(w)));

function findScope(t, ds, fallback) {
  const s = {};
  let named = false;
  // branch (longest name first)
  const brs = [...ds.branches].sort((a, b) => b.name.length - a.name.length);
  for (const b of brs) if (t.includes(b.name.toLowerCase())) { return { scope: { country: b.country, city: b.cityId, branch: b.id }, named: true, label: `${b.name}, ${ds.countryByCode.get(b.country).name}` }; }
  for (const c of ds.cities) if (new RegExp(`\\b${c.name.toLowerCase()}\\b`).test(t)) { return { scope: { country: c.country, city: c.id }, named: true, label: `${c.name} (city)` }; }
  for (const c of ds.countries) if (t.includes(c.name.toLowerCase())) return { scope: { country: c.code }, named: true, label: c.name };
  return { scope: fallback || {}, named, label: scopeLabel(fallback, ds) };
}
function scopeLabel(s, ds) {
  if (!s || (!s.country && !s.city && !s.branch)) return 'All Nash Paints markets';
  if (s.branch) return ds.branchById.get(s.branch).name;
  if (s.city) return ds.cities.find((c) => c.id === s.city)?.name + ' (city)';
  return ds.countryByCode.get(s.country).name;
}
function findPeriod(t, fallback) {
  const map = [[/\byesterday\b/, 'yesterday'], [/\blast week\b/, 'lastWeek'], [/\bthis week\b/, 'thisWeek'], [/\blast month\b/, 'lastMonth'], [/\bthis month\b/, 'thisMonth'], [/\b(ytd|year to date|this year)\b/, 'ytd'], [/\btoday\b/, 'today']];
  for (const [re, id] of map) if (re.test(t)) return { period: resolvePeriod(id, null, 'auto'), explicit: true };
  return { period: fallback, explicit: false };
}
const alertLink = (a) => ({ label: `Open: ${a.title.length > 60 ? a.title.slice(0, 58) + '…' : a.title}`, kind: 'alert', id: a.id });

export function answer(question, ctx) {
  const ds = getDS();
  const raw = question.trim();
  const t = raw.toLowerCase();
  const { scope, named, label } = findScope(t, ds, ctx.scope);
  const { period, explicit } = findPeriod(t, ctx.period);
  const q = makeQ(scope, period.d0, period.d1, 'USD');
  const pq = period.prev ? withRange(q, period.prev.d0, period.prev.d1) : null;
  const single = scope.country || scope.branch;
  const country = single ? ds.countryByCode.get(scope.country || scope.branch.slice(0, 2)) : null;
  const basis = `Basis: ${label} · ${period.label} (${fmtRange(period.d0, period.d1)}) · compared with ${period.prev ? period.prev.label + ' (' + fmtRange(period.prev.d0, period.prev.d1) + ')' : 'no comparison'} · consolidated USD at fictional monthly rates · demo data`;
  const out = (o) => ({ basis, links: [], bullets: [], paras: [], followups: [], ...o });
  const alerts = buildAlerts().filter((a) => (scope.branch ? a.branchId === scope.branch : scope.city ? (a.branchId && ds.branchById.get(a.branchId)?.cityId === scope.city) : scope.country ? a.country === scope.country : true));

  // ---- Furniture / Construction ----
  if (has(t, 'furniture', 'construction')) {
    const id = t.includes('furniture') ? 'furniture' : 'construction';
    const a = demoTotals(id, period.d0, period.d1), b = period.prev ? demoTotals(id, period.prev.d0, period.prev.d1) : null;
    return out({ title: `${DEMO_SPEC[id].name} (demonstration module)`, paras: [`This business is a summary-level demonstration, not a transaction-level data set. For ${period.label.toLowerCase()} the simulated revenue is ${money(a.rev, 'USD')}${b ? ` (${signedPct(pct(a.rev, b.rev))} vs ${period.prev.label.toLowerCase()})` : ''}, with gross margin ${pctf(a.margin)} and ${num(a.orders)} orders.`, 'Nash Paints is the fully developed business in this prototype.'], links: [{ label: `Open ${DEMO_SPEC[id].name}`, kind: 'biz', id }], followups: ['What needs my attention today?'], basis: 'Basis: simulated summary-level demonstration data (USD). Not connected to any system.' });
  }

  // ---- Decline diagnosis ----
  if (has(t, 'declin', 'drop', 'fall', 'fell', 'down', 'why', 'decrease', 'slump', 'worse') && (named || has(t, 'sales', 'revenue') || explicit)) {
    const p0 = period.prev, k = kpis(q), kp = pq ? kpis(pq) : null;
    // for branch-level questions with no explicit period use the last two trading days vs. same days last week (matches the alert)
    let qq = q, qp = pq, plabel = period.label, pplabel = period.prev?.label;
    if (scope.branch && !explicit) { qq = withRange(q, TODAY - 1, TODAY); qp = withRange(q, TODAY - 8, TODAY - 7); plabel = 'Last two trading days'; pplabel = 'same two days last week'; }
    const a = kpis(qq), b = qp ? kpis(qp) : null;
    if (!b || !b.rev) return out({ title: 'Not enough comparison data', paras: ['There is no comparable earlier period with recorded sales for this selection, so I cannot diagnose a decline.'], followups: EXAMPLES.slice(0, 3) });
    const ch = pct(a.rev, b.rev);
    const bullets = [];
    bullets.push(`Revenue: ${money(a.rev)} vs ${money(b.rev)} (${signedPct(ch)}).`);
    bullets.push(`Transactions: ${num(a.txns)} vs ${num(b.txns)} (${signedPct(pct(a.txns, b.txns))}); average transaction value ${money(a.avgTicket, 'USD', { decimals: 2 })} vs ${money(b.avgTicket, 'USD', { decimals: 2 })} (${signedPct(pct(a.avgTicket, b.avgTicket))}).`);
    bullets.push(`Customers served: ${num(a.served)} vs ${num(b.served)} (${signedPct(pct(a.served, b.served))}).`);
    const la = lineAgg(qq), lb = lineAgg(qp);
    const movers = la.rows.map((r, i) => ({ r, d: r.rev - lb.rows[i].rev })).sort((x, y) => x.d - y.d).slice(0, 3).filter((x) => x.d < 0);
    if (movers.length) bullets.push(`Largest product declines: ${movers.map((m) => `${m.r.p.shortName} (${money(m.d)})`).join('; ')}.`);
    const invQ = makeQ(scope, TODAY, TODAY, 'USD'); const inv = inventoryRows(invQ);
    const topSold = new Set([...la.rows].sort((x, y) => lb.rows[y.idx].rev - lb.rows[x.idx].rev).slice(0, 12).map((r) => r.idx));
    const outTop = inv.filter((r) => r.status === 'out' && topSold.has(r.p.idx));
    if (outTop.length) { const sk = [...new Set(outTop.map((r) => r.p.shortName))].slice(0, 4); bullets.push(`Stock: ${outTop.length} branch × product positions among last period's top-12 products are currently out of stock (${sk.join(', ')}${new Set(outTop.map((r) => r.p.shortName)).size > 4 ? ', …' : ''}). Lost availability is a possible contributor, but this data cannot prove it.`); }
    const delayed = ds.branches.filter((b2) => (!scope.branch || b2.id === scope.branch) && b2.lastDataDay < TODAY && (scope.country ? b2.country === scope.country : true));
    if (delayed.length) bullets.push(`Data quality: ${delayed.map((b2) => b2.name).join(', ')} ${delayed.length > 1 ? 'have' : 'has'} missing recent data, which lowers recorded revenue without necessarily reflecting trading.`);
    const rel = alerts.filter((x) => ['decline', 'stockout', 'country', 'data'].includes(x.type)).slice(0, 3);
    let verdict;
    if (ch > -0.03) verdict = `Revenue is ${ch >= 0 ? 'up' : 'about flat'} (${signedPct(ch)}), so there is no decline to explain for ${label} in this window.`;
    else {
      const txShare = pct(a.txns, b.txns), tkt = pct(a.avgTicket, b.avgTicket);
      verdict = txShare < 0 && (tkt >= 0 || Math.abs(txShare) >= Math.abs(tkt) * 1.5) ? `The fall is driven mainly by fewer transactions (${signedPct(txShare)})${tkt >= 0 ? `, while average basket value moved ${signedPct(tkt)}` : `, with average basket value also ${signedPct(tkt)}`} — pointing to lower footfall or product availability rather than pricing.` : `The fall is driven mainly by smaller average baskets (${signedPct(tkt)}) rather than transaction count (${signedPct(txShare)}).`;
    }
    return out({ title: `Why is ${label} ${ch < -0.03 ? 'down' : 'not declining'}?`, paras: [verdict, `Window analysed: ${plabel} vs ${pplabel}.`], bullets, links: [...(scope.branch ? [{ label: `Open ${label.split(',')[0]}`, kind: 'branch', id: scope.branch }] : scope.country ? [{ label: `Open ${country.name}`, kind: 'country', code: scope.country }] : []), ...rel.map(alertLink)], followups: ['Which products are at risk of stocking out?', 'What needs my attention today?'],
      basis: `Basis: ${label} · ${plabel} vs ${pplabel} · USD · rules-based comparison of recorded transactions, inventory positions and alerts. Findings are associations in demo data, not proven causes.` });
  }

  // ---- Attention / alerts ----
  if (has(t, 'attention', 'alert', 'critical', 'urgent', 'priorit', 'look at first', 'worry', 'problem', 'issue', 'risk') && !has(t, 'stock', 'inventory')) {
    const open = alerts.filter((a) => a.severity !== 'info' && !ctx.alertState[a.id]?.ack).sort((a, b) => SEVERITY[a.severity].rank - SEVERITY[b.severity].rank);
    if (!open.length) return out({ title: 'Nothing open needs attention', paras: [`No open critical, high or medium alerts for ${label}.`], basis: `Basis: ${label} · alert rules evaluated at the latest simulated sync (${fmtDay(TODAY)}).` });
    return out({ title: `${open.length} open alert${open.length > 1 ? 's' : ''} for ${label}`, paras: [`In order of severity. Acknowledging an alert or adding a note records it locally only; nobody is contacted by this prototype.`], bullets: open.slice(0, 7).map((a) => `${SEVERITY[a.severity].label} · ${ALERT_TYPES[a.type]}: ${a.title}`), links: [...open.slice(0, 4).map(alertLink), { label: 'Open all alerts', kind: 'page', page: 'alerts' }], followups: ['Why did Harare Central decline?', 'Which products are at risk of stocking out?'], basis: `Basis: ${label} · alert rules evaluated at the latest simulated sync (${fmtDay(TODAY)}) · demo data` });
  }

  // ---- Stock ----
  if (has(t, 'stock', 'inventory', 'replenish', 'reorder', 'out of')) {
    const iq = makeQ(scope, TODAY, TODAY, 'USD'), it = inventoryTotals(iq), rows = inventoryRows(iq);
    const by = new Map();
    for (const r of rows) if (r.status !== 'ok' || r.risk) { const o = by.get(r.p.idx) || { p: r.p, out: 0, low: 0, risk: 0 }; if (r.status === 'out') o.out++; else if (r.status === 'low') o.low++; else o.risk++; by.set(r.p.idx, o); }
    const top = [...by.values()].sort((a, b) => b.out * 3 + b.low + b.risk - (a.out * 3 + a.low + a.risk)).slice(0, 6);
    return out({ title: `Stock position — ${label}`, paras: [`${num(it.out)} of ${num(it.positions)} branch × product positions are out of stock and ${num(it.low)} are below the reorder point (${pctf(it.positions ? (it.out + it.low) / it.positions : 0)} need attention). Positions are as of the latest sync and independent of the date filter.`], bullets: top.map((o) => `${o.p.shortName}: out in ${o.out} branch${o.out === 1 ? '' : 'es'}, low in ${o.low}${o.risk ? `, under 5 days of cover in ${o.risk}` : ''}.`), links: [{ label: 'Open Inventory', kind: 'page', page: 'inventory' }, ...alerts.filter((a) => a.type === 'stockout').slice(0, 2).map(alertLink)], followups: ['Why did Harare Central decline?', 'Which colours are selling best?'], basis: `Basis: ${label} · stock position at ${fmtDay(TODAY)} (latest simulated sync) · units, no currency` });
  }

  // ---- Colours / products ----
  if (has(t, 'colour', 'color', 'product', 'selling', 'sku', 'paint')) {
    const la = lineAgg(q), cr = colourRollup(la.rows), tp = [...la.rows].sort((a, b) => b.rev - a.rev).slice(0, 5);
    if (!la.totRev) return out({ title: 'No sales in this selection', paras: ['There are no recorded sales for this location and period.'] });
    const lp = pq ? lineAgg(pq) : null;
    return out({ title: `Best-selling colours and products — ${label}`, paras: [`${cr[0]?.key} leads colours with ${money(cr[0]?.rev)} (${pctf(cr[0]?.share)} of ${money(la.totRev)} product revenue).`], bullets: [...cr.slice(0, 5).map((c, i) => `#${i + 1} colour — ${c.key}: ${money(c.rev)}, ${num(c.qty)} units${lp ? ` (${signedPct(pct(c.rev, colourRollup(lp.rows).find((x) => x.key === c.key)?.rev))} vs previous)` : ''}.`), ...tp.slice(0, 3).map((r, i) => `#${i + 1} product — ${r.p.shortName}: ${money(r.rev)}, margin ${pctf(r.margin, 0)}.`)], links: [{ label: 'Open Products & Colours', kind: 'page', page: 'products' }], followups: ['Which products are at risk of stocking out?', 'Compare the countries this week'] });
  }

  // ---- Customers ----
  if (has(t, 'customer', 'loyal', 'new ', 'returning', 'retention', 'repeat') && !has(t, 'rating', 'complain', 'review')) {
    const c = customerStats(q), p = pq ? customerStats(pq) : null;
    return out({ title: `Customers — ${label}`, paras: [`${num(c.served)} customers served: ${num(c.newCust)} new, ${num(c.returningCust)} returning and ${num(c.anonVisits)} anonymous walk-in visits. New customers are those whose first-ever recorded purchase falls in the period.`], bullets: [p ? `New customers ${signedPct(pct(c.newCust, p.newCust))} and returning customers ${signedPct(pct(c.returningCust, p.returningCust))} vs ${period.prev.label.toLowerCase()}.` : null, `Repeat purchase rate ${pctf(c.repeatRate)}; loyalty-card usage ${pctf(c.cardRate)}; average spend per identified customer ${money(c.avgSpendId, 'USD', { decimals: 2 })}.`].filter(Boolean), links: [{ label: 'Open Customer Intelligence', kind: 'page', page: 'customers' }], followups: ['How are customer ratings and complaints?'] });
  }

  // ---- Ratings ----
  if (has(t, 'rating', 'review', 'complain', 'feedback', 'satisf')) {
    const r = reviewStats(q), rp = pq ? reviewStats(pq) : null;
    if (!r.count) return out({ title: 'No reviews', paras: ['No reviews were submitted for this selection and period.'] });
    const cats = [...r.cats].sort((a, b) => b.complaints - a.complaints).slice(0, 3);
    const low = [...r.branches].filter((b) => b.count >= 4).sort((a, b) => a.avg - b.avg).slice(0, 3);
    return out({ title: `Customer feedback — ${label}`, paras: [`Average rating ${r.avg.toFixed(2)} from ${num(r.count)} reviews (${pctf(r.verifiedShare, 0)} verified purchases); ${num(r.complaints)} complaints rated 1–2 stars.${rp?.avg ? ` Previous period: ${rp.avg.toFixed(2)}.` : ''}`], bullets: [`Most common complaint themes: ${cats.map((c) => `${c.name} (${c.complaints})`).join(', ')}.`, low.length ? `Lowest-rated branches (4+ reviews): ${low.map((b) => `${b.name} ${b.avg.toFixed(2)}`).join(', ')}.` : null].filter(Boolean), links: [{ label: 'Open Customer Experience', kind: 'page', page: 'feedback' }], followups: ['What needs my attention today?'] });
  }

  // ---- Expenses / profit ----
  if (has(t, 'expense', 'opex', 'cost', 'profit', 'margin', 'budget')) {
    const k = kpis(q), p = pq ? kpis(pq) : null, eb = expenseBreakdown(q);
    const over = [...eb.categories].sort((a, b) => b.varPct - a.varPct).filter((c) => c.varPct > 0.05).slice(0, 3);
    return out({ title: `Costs and profitability — ${label}`, paras: [`Revenue ${money(k.rev)}; COGS ${money(k.cogs)} (gross margin ${pctf(k.margin)}); operating expenses ${money(k.opex)} against a budget of ${money(k.budget)} (${signedPct(k.budget ? (k.opex - k.budget) / k.budget : null)}). Simulated operating profit ${money(k.opProfit)} (${pctf(k.opMargin)}), which excludes head-office costs, depreciation, interest and tax.`], bullets: [p ? `Gross margin ${pctf(k.margin)} vs ${pctf(p.margin)} previously; OpEx ${signedPct(pct(k.opex, p.opex))}.` : null, over.length ? `Categories over budget: ${over.map((c) => `${c.name} ${signedPct(c.varPct)}`).join(', ')}.` : 'No expense category is more than 5% over budget.'].filter(Boolean), links: [{ label: 'Open Finance & Profitability', kind: 'page', page: 'finance' }, ...alerts.filter((a) => a.type === 'expense').slice(0, 2).map(alertLink)], followups: ['Compare the countries this week'], basis: `${basis} · revenue is not profit; operating profit is simulated.` });
  }

  // ---- Branch ranking ----
  if (has(t, 'branch', 'underperform', 'worst', 'weak', 'best perform', 'top perform', 'lowest', 'highest', 'rank')) {
    const rows = branchRowsCompared(q, pq).filter((r) => r.rev > 0);
    const under = has(t, 'under', 'worst', 'weak', 'lowest', 'below');
    const s = [...rows].sort((a, b) => (under ? (a.attain ?? 9) - (b.attain ?? 9) : (b.growth ?? -9) - (a.growth ?? -9))).slice(0, 8);
    return out({ title: under ? `Branches furthest below target — ${label}` : `Fastest-growing branches — ${label}`, paras: [under ? 'Ranked by revenue attainment against the simulated target (trailing-90-day average × plan factor). Branches with missing data are flagged because gaps depress attainment.' : 'Ranked by revenue growth against the comparison period.'], table: { cols: ['Branch', 'Country', 'Revenue (USD)', under ? 'Target attainment' : 'Growth', 'Data'], rows: s.map((r) => [r.name, r.country, money(r.rev), under ? pctf(r.attain, 0) : signedPct(r.growth), r.dataStatus === 'delayed' ? 'Delayed' : 'OK']) }, links: s.slice(0, 3).map((r) => ({ label: `Open ${r.name}`, kind: 'branch', id: r.id })), followups: ['Why did Harare Central decline?'] });
  }

  // ---- Countries / sales summary ----
  if (has(t, 'countr', 'compare', 'market', 'sales', 'revenue', 'trading', 'how are', 'performance', 'perform', 'growth', 'growing')) {
    const k = kpis(q), p = pq ? kpis(pq) : null;
    const sc = !single ? countryRowsCompared(q, pq) : [];
    const paras = period.days <= 3 ? [`Note: ${period.label} currently covers only ${period.days} day${period.days > 1 ? 's' : ''}, so results are volatile and weekday mix differs from the comparison period.`] : [];
    paras.push(`${label}: revenue ${money(k.rev)}${p ? ` (${signedPct(pct(k.rev, p.rev))} vs ${period.prev.label.toLowerCase()})` : ''} from ${num(k.txns)} transactions; gross margin ${pctf(k.margin)}; target attainment ${pctf(k.attain, 0)}.`);
    if (country && country.currency !== 'USD') { const lk = totals(makeQ(scope, period.d0, period.d1, 'LOCAL')); paras.push(`In local currency: ${money(lk.rev, country.currency)} (shown separately; never added to other currencies).`); }
    return out({ title: `Sales summary — ${label}`, paras, table: sc.length ? { cols: ['Country', 'Revenue (USD)', 'Growth', 'Margin', 'Target'], rows: [...sc].sort((a, b) => b.revUsd - a.revUsd).map((r) => [r.name, money(r.revUsd), signedPct(r.growthUsd), pctf(r.margin, 1), pctf(r.attain, 0)]) } : undefined, links: single ? [] : sc.slice(0, 5).map((r) => ({ label: `Open ${r.name}`, kind: 'country', code: r.code })), followups: ['What needs my attention today?', 'Which branches are underperforming this week?'] });
  }

  // ---- Fallback: honest ----
  return out({ title: 'I can’t answer that from this demo', paras: ['This assistant is a rules-based demo, not a language model. It recognises questions about attention/alerts, sales performance, why a branch or country declined, branch rankings, colours and products, stock-outs, customers, ratings, expenses/profit and the Furniture/Construction demos — for a named country, city or branch and a standard period.', 'I will not guess at anything the dataset cannot show.'], followups: EXAMPLES.slice(0, 5), basis: 'Basis: none — question not recognised.' });
}
