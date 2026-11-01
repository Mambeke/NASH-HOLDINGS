// Report definitions: every report is built from the shared query layer with the same filters as the dashboards,
// and carries a reconciliation check against the dashboard totals.
import { getDS, kpis, totals, branchRowsCompared, countryRowsCompared, lineAgg, inventoryRows, customerStats, expenseBreakdown, reviewStats, pct, makeQ, topCustomers } from './query.js';
import { buildAlerts, SEVERITY, ALERT_TYPES } from './alerts.js';
import { fmtDay, TODAY } from './dates.js';
import { money, num, pctf, signedPct } from './format.js';

const M0 = (v, code) => money(v, code, { full: true, decimals: 0 });
const col = (header, value, o = {}) => ({ header, value, ...o });

export const REPORTS = [
  {
    id: 'exec', title: 'Executive Summary by Country', icon: 'globe', audience: 'CEO / Board',
    desc: 'Revenue, growth, margin, operating expenses and target attainment for each country. USD is consolidated; local-currency revenue is shown in its own column and never summed.',
    filters: [],
    build({ q, pq, cur }) {
      const rows = countryRowsCompared(q, pq).map((r) => ({ ...r, local: totals(makeQ({ ...q.scope, country: r.code }, q.d0, q.d1, 'LOCAL')).rev }));
      const K = kpis(q);
      const sumUsd = rows.reduce((a, r) => a + r.revUsd, 0);
      return {
        columns: [
          col('Country', (r) => r.name), col('Local currency', (r) => r.currency), col('Branches', (r) => r.branches, { align: 'r' }),
          col('Revenue (USD)', (r) => r.revUsd, { align: 'r', render: (r) => M0(r.revUsd, 'USD') }),
          col('Revenue (local currency, not summed)', (r) => Math.round(r.local), { align: 'r', render: (r) => M0(r.local, r.currency) }),
          col('Growth vs comparison (USD)', (r) => r.growthUsd, { align: 'r', render: (r) => signedPct(r.growthUsd), fmt: (v) => (v == null ? '' : +(v * 100).toFixed(2)) }),
          col('Gross margin %', (r) => (r.margin == null ? null : +(r.margin * 100).toFixed(2)), { align: 'r', render: (r) => pctf(r.margin) }),
          col('Operating expenses (USD)', (r) => r.opex, { align: 'r', render: (r) => M0(r.opex, 'USD') }),
          col('Transactions', (r) => r.txns, { align: 'r', render: (r) => num(r.txns) }),
          col('Customers served', (r) => r.customers, { align: 'r', render: (r) => num(r.customers) }),
          col('Target attainment %', (r) => (r.attain == null ? null : +(r.attain * 100).toFixed(1)), { align: 'r', render: (r) => pctf(r.attain, 0) }),
        ].map((c) => c),
        rows: rows.map((r) => ({ ...r, opex: r.opex })),
        rowKey: (r) => r.code,
        summary: [['Total revenue (USD)', M0(sumUsd, 'USD')], ['Total transactions', num(K.txns)], ['Gross margin', pctf(K.margin)]],
        note: 'USD columns are consolidated at fictional monthly rates and can be summed. The local-currency column shows each country in its own currency (USD, BWP, ZMW, MWK, KES) and is never added across rows.',
        check: { label: 'Sum of country revenue (USD) equals dashboard total', a: sumUsd, b: K.revUsd },
        usdOnly: true,
      };
    },
  },
  {
    id: 'branch', title: 'Branch Performance', icon: 'store', audience: 'Regional managers',
    desc: 'Every branch in scope with revenue, growth, transactions, average ticket, margin, operating expenses, target attainment and data status.',
    filters: [{ id: 'status', label: 'Show', options: [['all', 'All branches'], ['below', 'Below target (<90%)'], ['delayed', 'Data delayed'], ['declining', 'Revenue declining']] }],
    build({ q, pq, cur }, p) {
      let rows = branchRowsCompared(q, pq);
      const full = rows;
      if (p.status === 'below') rows = rows.filter((r) => r.attain != null && r.attain < 0.9 && r.dataStatus === 'ok');
      else if (p.status === 'delayed') rows = rows.filter((r) => r.dataStatus === 'delayed');
      else if (p.status === 'declining') rows = rows.filter((r) => r.growth != null && r.growth < -0.05);
      const c = cur.code;
      return {
        columns: [
          col('Branch ID', (r) => r.id), col('Branch', (r) => r.name), col('City', (r) => r.city), col('Country', (r) => r.country),
          col(`Revenue (${c})`, (r) => r.rev, { align: 'r', render: (r) => M0(r.rev, c) }),
          col('Growth vs comparison %', (r) => (r.growth == null ? null : +(r.growth * 100).toFixed(2)), { align: 'r', render: (r) => signedPct(r.growth) }),
          col('Transactions', (r) => r.txns, { align: 'r', render: (r) => num(r.txns) }),
          col(`Avg transaction (${c})`, (r) => +r.avgTicket.toFixed(2), { align: 'r', render: (r) => money(r.avgTicket, c, { decimals: 2 }) }),
          col('Gross margin %', (r) => (r.margin == null ? null : +(r.margin * 100).toFixed(2)), { align: 'r', render: (r) => pctf(r.margin) }),
          col(`OpEx (${c})`, (r) => r.opex, { align: 'r', render: (r) => M0(r.opex, c) }),
          col('Target attainment %', (r) => (r.attain == null ? null : +(r.attain * 100).toFixed(1)), { align: 'r', render: (r) => pctf(r.attain, 0) }),
          col('Data status', (r) => (r.dataStatus === 'delayed' ? 'Delayed' : 'OK')),
        ],
        rows, rowKey: (r) => r.id,
        summary: [[`Revenue shown (${c})`, M0(rows.reduce((a, r) => a + r.rev, 0), c)], ['Branches', `${rows.length} of ${full.length}`]],
        check: { label: 'Sum of all branch revenue equals dashboard total', a: full.reduce((a, r) => a + r.rev, 0), b: kpis(q).rev },
      };
    },
  },
  {
    id: 'product', title: 'Product & Colour Performance', icon: 'palette', audience: 'Merchandising',
    desc: 'Units, revenue, contribution and gross margin for every SKU that sold, including colour and size.',
    filters: [{ id: 'category', label: 'Category', options: () => [['', 'All categories'], ...[...new Set(getDS().catalog.map((p) => p.category))].map((c) => [c, c])] }],
    build({ q, cur }, p) {
      const a = lineAgg(q); const c = cur.code;
      const rows = a.rows.filter((r) => r.qty > 0 && (!p.category || r.category === p.category)).sort((x, y) => y.rev - x.rev);
      return {
        columns: [
          col('SKU', (r) => r.sku), col('Product', (r) => r.range), col('Colour', (r) => r.colour), col('Size', (r) => r.size), col('Category', (r) => r.category),
          col('Units sold', (r) => r.qty, { align: 'r', render: (r) => num(r.qty) }), col(`Revenue (${c})`, (r) => r.rev, { align: 'r', render: (r) => M0(r.rev, c) }),
          col('Share of revenue %', (r) => +(r.share * 100).toFixed(2), { align: 'r', render: (r) => pctf(r.share, 2) }),
          col('Gross margin %', (r) => (r.margin == null ? null : +(r.margin * 100).toFixed(1)), { align: 'r', render: (r) => pctf(r.margin, 0) }),
          col('Branches selling', (r) => r.branchesSold, { align: 'r' }),
        ],
        rows, rowKey: (r) => r.id,
        summary: [[`Revenue shown (${c})`, M0(rows.reduce((s, r) => s + r.rev, 0), c)], ['SKUs sold', `${rows.length}`]],
        check: { label: 'Sum of all SKU revenue equals dashboard total', a: a.totRev, b: kpis(q).rev },
      };
    },
  },
  {
    id: 'inventory', title: 'Inventory & Replenishment', icon: 'boxes', audience: 'Supply chain',
    desc: 'Current stock positions with reorder points, days of cover and suggested replenishment quantities (units; no currency).',
    filters: [{ id: 'status', label: 'Show', options: [['flagged', 'Needs attention'], ['out', 'Out of stock'], ['low', 'Low stock'], ['all', 'All positions']] }],
    build({ scope }, p) {
      const iq = makeQ(scope, TODAY, TODAY, 'USD');
      let rows = inventoryRows(iq);
      const all = rows.length;
      if (p.status === 'flagged') rows = rows.filter((r) => r.status !== 'ok'); else if (p.status === 'out' || p.status === 'low') rows = rows.filter((r) => r.status === p.status);
      rows = [...rows].sort((a, b) => (a.status === 'out' ? 0 : 1) - (b.status === 'out' ? 0 : 1) || b.sold60 - a.sold60);
      return {
        columns: [
          col('Branch ID', (r) => r.branchId), col('Branch', (r) => r.branch), col('Country', (r) => r.country), col('SKU', (r) => r.sku), col('Product', (r) => r.product),
          col('On hand (units)', (r) => r.stock, { align: 'r' }), col('Reorder point', (r) => r.reorderPoint, { align: 'r' }),
          col('Sold last 60 days', (r) => r.sold60, { align: 'r' }), col('Days of cover', (r) => (r.cover == null ? null : +r.cover.toFixed(1)), { align: 'r', render: (r) => (r.cover == null ? '—' : r.cover.toFixed(1)) }),
          col('Status', (r) => (r.status === 'out' ? 'Out of stock' : r.status === 'low' ? 'Low stock' : 'In stock')), col('Suggested replenishment (units)', (r) => r.replenish, { align: 'r' }),
        ],
        rows, rowKey: (r) => r.key,
        summary: [['Positions listed', `${num(rows.length)} of ${num(all)}`], ['Suggested replenishment', `${num(rows.reduce((a, r) => a + r.replenish, 0))} units`]],
        note: `Stock position as of ${fmtDay(TODAY)} (latest simulated sync). Replenishment suggestions are rule-based (order-up-to level minus on-hand) and are not purchase orders.`,
        noPeriod: true,
      };
    },
  },
  {
    id: 'customers', title: 'Customer & Loyalty Summary', icon: 'users', audience: 'Marketing & CRM',
    desc: 'Customers served by class (new, returning, anonymous) and segment, with revenue, transactions and average spend. Customer IDs are anonymised.',
    filters: [],
    build({ q, cur }) {
      const c = customerStats(q); const code = cur.code;
      const rows = [
        { group: 'Class', name: 'New customers', customers: c.newCust, txns: c.txClass.new.txns, rev: c.txClass.new.revenue },
        { group: 'Class', name: 'Returning customers', customers: c.returningCust, txns: c.txClass.returning.txns, rev: c.txClass.returning.revenue },
        { group: 'Class', name: 'Anonymous walk-in visits', customers: c.anonVisits, txns: c.txClass.anonymous.txns, rev: c.txClass.anonymous.revenue },
        ...c.segments.filter((s) => s.txns > 0).map((s) => ({ group: 'Segment', name: s.name, customers: s.customers, txns: s.txns, rev: s.revenue })),
      ];
      return {
        columns: [
          col('Group', (r) => r.group), col('Name', (r) => r.name), col('Customers / visits', (r) => r.customers, { align: 'r', render: (r) => num(r.customers) }), col('Transactions', (r) => r.txns, { align: 'r', render: (r) => num(r.txns) }),
          col(`Revenue (${code})`, (r) => r.rev, { align: 'r', render: (r) => M0(r.rev, code) }), col(`Avg transaction (${code})`, (r) => (r.txns ? +(r.rev / r.txns).toFixed(2) : 0), { align: 'r', render: (r) => money(r.txns ? r.rev / r.txns : 0, code, { decimals: 2 }) }),
          col('Share of revenue %', (r) => (c.revenue ? +((r.rev / c.revenue) * 100).toFixed(2) : 0), { align: 'r', render: (r) => pctf(c.revenue ? r.rev / c.revenue : 0) }),
        ],
        rows, rowKey: (r) => r.group + r.name,
        summary: [['Customers served', num(c.served)], ['Identified + anonymous', `${num(c.identified)} + ${num(c.anonVisits)}`], ['Repeat purchase rate', pctf(c.repeatRate)], ['Loyalty-card usage', pctf(c.cardRate)]],
        note: 'Class rows sum to total customers served; segment rows are a second cut of the same transactions (do not add the two groups together).',
        check: { label: 'New + returning + anonymous revenue equals dashboard total', a: c.txClass.new.revenue + c.txClass.returning.revenue + c.txClass.anonymous.revenue, b: kpis(q).rev },
      };
    },
  },
  {
    id: 'finance', title: 'Expenses & Profitability', icon: 'landmark', audience: 'Finance',
    desc: 'Revenue, COGS, gross profit, operating expenses, budget variance and simulated operating profit by branch. COGS and OpEx are reported separately.',
    filters: [],
    build({ q, cur }) {
      const rows = branchRowsCompared(q, null).filter((r) => r.rev > 0 || r.opex > 0); const c = cur.code;
      const K = kpis(q);
      return {
        columns: [
          col('Branch ID', (r) => r.id), col('Branch', (r) => r.name), col('Country', (r) => r.country),
          col(`Revenue (${c})`, (r) => r.rev, { align: 'r', render: (r) => M0(r.rev, c) }), col(`COGS (${c})`, (r) => r.cogs, { align: 'r', render: (r) => M0(r.cogs, c) }),
          col(`Gross profit (${c})`, (r) => r.gp, { align: 'r', render: (r) => M0(r.gp, c) }), col('Gross margin %', (r) => (r.margin == null ? null : +(r.margin * 100).toFixed(2)), { align: 'r', render: (r) => pctf(r.margin) }),
          col(`Operating expenses (${c})`, (r) => r.opex, { align: 'r', render: (r) => M0(r.opex, c) }), col(`OpEx budget (${c})`, (r) => r.budget, { align: 'r', render: (r) => M0(r.budget, c) }),
          col('OpEx vs budget %', (r) => (r.budget ? +(((r.opex - r.budget) / r.budget) * 100).toFixed(2) : null), { align: 'r', render: (r) => signedPct(r.budget ? (r.opex - r.budget) / r.budget : null) }),
          col(`Operating profit, simulated (${c})`, (r) => r.opProfit, { align: 'r', render: (r) => M0(r.opProfit, c) }), col('Data status', (r) => (r.dataStatus === 'delayed' ? 'Incomplete — profit understated' : 'Complete')),
        ],
        rows, rowKey: (r) => r.id,
        summary: [[`Revenue (${c})`, M0(K.rev, c)], [`COGS (${c})`, M0(K.cogs, c)], [`OpEx (${c})`, M0(K.opex, c)], [`Operating profit, simulated (${c})`, M0(K.opProfit, c)]],
        note: 'Simulated management accounts: operating profit = revenue − COGS − branch operating expenses. Excludes head-office costs, depreciation, interest and tax; it is not net profit.',
        check: { label: 'Sum of branch revenue − COGS − OpEx equals dashboard operating profit', a: rows.reduce((a, r) => a + r.opProfit, 0), b: K.opProfit },
      };
    },
  },
  {
    id: 'feedback', title: 'Customer Feedback by Branch', icon: 'message', audience: 'Customer experience',
    desc: 'Review counts, average rating, complaint rate and verified-purchase share by branch.',
    filters: [{ id: 'ver', label: 'Reviews', options: [['all', 'All reviews'], ['verified', 'Verified purchases only'], ['unverified', 'Unverified only']] }],
    build({ q }, p) {
      const st = reviewStats(q); const set = new Map();
      for (const r of st.list) {
        if (p.ver === 'verified' && !r.verified) continue; if (p.ver === 'unverified' && r.verified) continue;
        const b = getDS().branches[r.br]; let o = set.get(b.id); if (!o) { o = { id: b.id, name: b.name, country: b.country, n: 0, sum: 0, comp: 0, ver: 0 }; set.set(b.id, o); }
        o.n++; o.sum += r.rating; if (r.rating <= 2) o.comp++; if (r.verified) o.ver++;
      }
      const rows = [...set.values()].map((o) => ({ ...o, avg: o.sum / o.n })).sort((a, b) => a.avg - b.avg);
      const tot = rows.reduce((a, r) => a + r.n, 0);
      return {
        columns: [col('Branch ID', (r) => r.id), col('Branch', (r) => r.name), col('Country', (r) => r.country), col('Reviews', (r) => r.n, { align: 'r' }), col('Average rating', (r) => +r.avg.toFixed(2), { align: 'r', render: (r) => r.avg.toFixed(2) }),
          col('Complaints (1–2 stars)', (r) => r.comp, { align: 'r' }), col('Complaint rate %', (r) => +((r.comp / r.n) * 100).toFixed(1), { align: 'r', render: (r) => pctf(r.comp / r.n, 0) }), col('Verified purchases', (r) => r.ver, { align: 'r' }), col('Verified share %', (r) => +((r.ver / r.n) * 100).toFixed(0), { align: 'r', render: (r) => pctf(r.ver / r.n, 0) })],
        rows, rowKey: (r) => r.id,
        summary: [['Reviews', num(tot)], ['Average rating', tot ? (rows.reduce((a, r) => a + r.sum, 0) / tot).toFixed(2) : '—']],
        note: 'Verified = linked to a recorded transaction. Unverified submissions are not linked to a sale and may be less reliable.',
        check: p.ver === 'all' || !p.ver ? { label: 'Review count equals dashboard review count', a: tot, b: st.count } : null,
      };
    },
  },
  {
    id: 'alerts', title: 'Alerts & Follow-up Register', icon: 'bell', audience: 'Executive office',
    desc: 'All alerts in scope with severity, status and recorded follow-up notes. Notes are local to this browser; no one has been contacted.',
    filters: [{ id: 'sev', label: 'Severity', options: [['all', 'All severities'], ['critical', 'Critical'], ['high', 'High'], ['medium', 'Medium'], ['info', 'Opportunity']] }],
    noPeriod: true,
    build({ scope, alertState }, p) {
      const ds = getDS();
      const rows = buildAlerts().filter((a) => (scope.branch ? a.branchId === scope.branch : scope.country ? a.country === scope.country : true) && (!p.sev || p.sev === 'all' || a.severity === p.sev))
        .sort((a, b) => SEVERITY[a.severity].rank - SEVERITY[b.severity].rank);
      return {
        columns: [col('Severity', (r) => SEVERITY[r.severity].label), col('Type', (r) => ALERT_TYPES[r.type]), col('Location', (r) => (r.branchId ? ds.branchById.get(r.branchId).name : r.country ? ds.countryByCode.get(r.country).name : 'Group')), col('Alert', (r) => r.title),
          col('Summary', (r) => r.what, { render: (r) => (r.what.length > 120 ? r.what.slice(0, 118) + '…' : r.what) }), col('Recommended action', (r) => r.action), col('Status', (r) => (alertState[r.id]?.ack ? 'Acknowledged' : 'Open')),
          col('Follow-up notes (local)', (r) => (alertState[r.id]?.notes || []).map((n) => n.text).join(' | '))],
        rows, rowKey: (r) => r.id,
        summary: [['Alerts', String(rows.length)], ['Open', String(rows.filter((r) => !alertState[r.id]?.ack).length)]],
        note: 'Acknowledgements and notes are stored locally in the browser. This prototype does not send messages or contact anyone.',
      };
    },
  },
];
