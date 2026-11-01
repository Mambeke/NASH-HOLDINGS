import React, { useMemo, useState } from 'react';
import { TrendingUp, Target, ShieldAlert, CheckCircle2, ArrowRight, Info } from 'lucide-react';
import { useApp } from '../state/app.jsx';
import { getDS, kpis, series, branchRowsCompared, countryRowsCompared, lineAgg, colourRollup, rollup, pct, makeQ, withRange, totals, customerStats } from '../lib/query.js';
import { money, num, pctf, signedPct, signedMoney, compact } from '../lib/format.js';
import { fmtDay, fmtRange, TODAY, shiftRangeMonths, weekdayName } from '../lib/dates.js';
import { buildAlerts } from '../lib/alerts.js';
import { Card, Kpi, Delta, DataTable, Badge, SeverityBadge, Swatch, Progress, Seg, Empty, LinkBtn } from './ui.jsx';
import { TrendChart, RankBars, Donut, DonutLegend, PALETTE, SEMANTIC } from './charts.jsx';

export function useFmt() {
  const { cur } = useApp();
  return useMemo(() => ({ cur, m: (v, o) => money(v, cur.code, o), mc: (v) => money(v, cur.code) }), [cur]);
}

// ---------------- KPI grid ----------------
export function KpiGrid({ q, pq, period, extra = false, onDrill }) {
  const { cur } = useApp();
  const m = (v, o) => money(v, cur.code, o);
  const k = kpis(q), p = pq ? kpis(pq) : null;
  const cl = period?.prev?.label;
  const d = (a, b) => (p ? pct(a, b) : undefined);
  const marginDelta = p && k.margin != null && p.margin != null ? k.margin - p.margin : null;
  const revUp = p && k.rev > p.rev;
  const revNote = revUp && marginDelta != null && marginDelta < -0.003 ? `Revenue is up but gross margin fell ${(Math.abs(marginDelta) * 100).toFixed(1)} pts — growth is not necessarily profit.` : null;
  const cogsTone = p ? (k.cogs / Math.max(1, p.cogs) <= k.rev / Math.max(1, p.rev) + 0.005 ? 'good' : 'warn') : undefined;
  const opexVar = k.budget ? (k.opex - k.budget) / k.budget : null;
  const a = k.attain;
  return (
    <div className="grid g4">
      <Kpi label="Total revenue" cur={cur} value={m(k.rev)} valueTitle={m(k.rev, { full: true })} delta={d(k.rev, p?.rev)} abs={p ? signedMoney(k.rev - p.rev, cur.code) : undefined} compareLabel={cl} note={revNote} />
      <Kpi label="Sales transactions" value={num(k.txns)} delta={d(k.txns, p?.txns)} abs={p ? `${k.txns - p.txns >= 0 ? '+' : '−'}${num(Math.abs(k.txns - p.txns))}` : undefined} compareLabel={cl} sub={`${num(k.units)} units sold`} />
      <Kpi label="Customers served" value={num(k.served)} delta={d(k.served, p?.served)} abs={p ? `${k.served - p.served >= 0 ? '+' : '−'}${num(Math.abs(k.served - p.served))}` : undefined} compareLabel={cl} sub={`${num(k.identified)} identified · ${num(k.anonVisits)} walk-in visits`} />
      <Kpi label="Average transaction value" cur={cur} value={m(k.avgTicket, { decimals: 2 })} delta={d(k.avgTicket, p?.avgTicket)} abs={p ? signedMoney(k.avgTicket - p.avgTicket, cur.code) : undefined} compareLabel={cl} sub="per sales transaction" />
      <Kpi label="Cost of goods sold" cur={cur} value={m(k.cogs)} delta={d(k.cogs, p?.cogs)} tone={cogsTone} compareLabel={cl} sub={`${pctf(k.rev ? k.cogs / k.rev : null)} of revenue`} />
      <Kpi label="Operating expenses" cur={cur} value={m(k.opex)} delta={d(k.opex, p?.opex)} goodWhen="down" compareLabel={cl} sub={opexVar != null ? `${signedPct(opexVar)} vs budget (${m(k.budget)})` : undefined} />
      <Kpi label="Gross profit" cur={cur} value={m(k.gp)} delta={d(k.gp, p?.gp)} compareLabel={cl} sub={`Gross margin ${pctf(k.margin)}${marginDelta != null ? ` (${marginDelta >= 0 ? '+' : '−'}${(Math.abs(marginDelta) * 100).toFixed(1)} pts)` : ''}`} note={k.rev ? `Operating profit ${m(k.opProfit)} (${pctf(k.opMargin)}) after OpEx` : null} />
      <Kpi label="Sales target achievement" value={pctf(a)} delta={p && p.attain ? (k.attain - p.attain) / p.attain : undefined} compareLabel={cl} sub={`${m(k.rev)} of ${m(k.target)}`} tone={a >= 1 ? 'good' : a >= 0.9 ? 'warn' : 'bad'} extra={<Progress value={a} />} />
    </div>
  );
}

// ---------------- Today at a glance (independent of the period filter, respects location filter) ----------------
export function TodayStrip({ scope, currencyMode = 'USD', day = TODAY, title }) {
  const qT = makeQ(scope, day, day, currencyMode), qY = withRange(qT, day - 1, day - 1), qW = withRange(qT, day - 7, day - 7);
  const t = kpis(qT), y = kpis(qY), w = kpis(qW);
  const code = qT.cur;
  const m = (v) => money(v, code);
  const spend = t.cogs + t.opex, spendY = y.cogs + y.opex, spendW = w.cogs + w.opex;
  const Item = ({ label, value, a, b, good = 'up', sub }) => (
    <div className="kpi" style={{ boxShadow: 'none' }}>
      <div className="kpi-l"><span>{label}</span></div>
      <div className="kpi-v" style={{ fontSize: 21 }}>{value}</div>
      <div className="kpi-sub"><Delta value={pct(a.cur, a.prev)} goodWhen={good} small /><span>vs {weekdayName(day - 7)}</span><Delta value={pct(b.cur, b.prev)} goodWhen={good} small /><span>vs yesterday</span></div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
  return (
    <Card title={title || (day === TODAY ? `Today at a glance — ${fmtDay(day, { long: true })}` : `Daily snapshot — ${fmtDay(day, { long: true })}`)} subtitle={day === TODAY ? 'Always shows the latest trading day, independent of the date filter. Spend = cost of goods sold + operating expenses (accrued).' : 'The last day of the selected period. Spend = cost of goods sold + operating expenses (accrued).'} cur={qT.cur}>
      <div className="grid g4">
        <Item label={day === TODAY ? 'Revenue today' : 'Revenue (day)'} value={m(t.rev)} a={{ cur: t.rev, prev: w.rev }} b={{ cur: t.rev, prev: y.rev }} sub={`${day === TODAY ? 'Yesterday' : 'Previous day'} ${m(y.rev)} · last ${weekdayName(day - 7, true)} ${m(w.rev)}`} />
        <Item label={day === TODAY ? 'Spend today' : 'Spend (day)'} value={m(spend)} a={{ cur: spend, prev: spendW }} b={{ cur: spend, prev: spendY }} good="down" sub={`COGS ${m(t.cogs)} · OpEx ${m(t.opex)}`} />
        <Item label={day === TODAY ? 'Transactions today' : 'Transactions (day)'} value={num(t.txns)} a={{ cur: t.txns, prev: w.txns }} b={{ cur: t.txns, prev: y.txns }} sub={`${num(t.units)} units sold`} />
        <Item label={day === TODAY ? 'Customers served today' : 'Customers served (day)'} value={num(t.served)} a={{ cur: t.served, prev: w.served }} b={{ cur: t.served, prev: y.served }} sub={`${num(t.newCust)} new · ${num(t.returningCust)} returning · ${num(t.anonVisits)} walk-in`} />
      </div>
      {t.missingDays > 0 && <div className="notice warn mt-12"><Info size={16} /><div>{t.missingDays} branch-day(s) in this view have no data received yet (delayed synchronisation) — today's totals are understated. See Executive Alerts.</div></div>}
    </Card>
  );
}

// ---------------- Trend ----------------
export function TrendCard({ q, pq, period, title = 'Revenue trend', grainDefault }) {
  const { cur, setDateRange, grain: autoGrain } = useApp();
  const [g, setG] = useState(null);
  const grain = g || grainDefault || autoGrain;
  const m = (v) => money(v, cur.code);
  const data = useMemo(() => {
    const s = series(q, grain), ps = pq ? series(pq, grain) : [];
    return s.map((b, i) => ({ ...b, prevRev: ps[i]?.rev ?? null, prevLabel: ps[i] ? ps[i].label : null }));
  }, [q, pq, grain]);
  const hasPrev = pq && data.some((d) => d.prevRev != null);
  const serieDefs = [
    { key: 'rev', name: `Revenue (${cur.code})`, kind: 'area', color: '#1C4CAD' },
    ...(hasPrev ? [{ key: 'prevRev', name: `Comparison: ${period.prev.label}`, kind: 'line', color: '#9AA8BD', dashed: true }] : []),
    { key: 'target', name: 'Sales target', kind: 'line', color: '#E0A030', dashed: true, width: 1.5 },
  ];
  return (
    <Card title={title} cur={cur} subtitle={`${fmtRange(period)} · ${grain === 'day' ? 'daily' : grain === 'week' ? 'weekly (Mon–Sun)' : 'monthly'} · click a point to zoom into that ${grain}`}
      actions={<Seg options={[{ id: 'day', label: 'Daily' }, { id: 'week', label: 'Weekly' }, { id: 'month', label: 'Monthly' }]} value={grain} onChange={setG} />}>
      {data.length <= 1 && grain === 'day' ? <div className="small muted" style={{ marginBottom: 8 }}>A single day has one data point — switch to a wider range to see a trend.</div> : null}
      <TrendChart data={data} series={serieDefs} fmt={(v) => m(v)} yFmt={(v) => compact(v)} onPointClick={(pt) => setDateRange(pt.start, pt.end)} />
    </Card>
  );
}

export function RevenueVsExpenses({ q, grain }) {
  const { cur, period } = useApp();
  const m = (v) => money(v, cur.code);
  const g = grain || (period.days <= 14 ? 'day' : period.days <= 120 ? 'week' : 'month');
  const data = useMemo(() => series(q, g).map((s) => ({ ...s, opexNeg: s.opex })), [q, g]);
  return (
    <Card title="Revenue versus expenses" cur={cur} subtitle="COGS and operating expenses are shown separately. Operating profit = revenue − COGS − OpEx (simulated management accounts; excludes head-office costs, depreciation, interest and tax).">
      <TrendChart data={data} fmt={(v) => m(v)} series={[
        { key: 'rev', name: 'Revenue', kind: 'bar', color: '#1C4CAD' }, { key: 'cogs', name: 'Cost of goods sold', kind: 'bar', color: '#9CBCEA' }, { key: 'opex', name: 'Operating expenses', kind: 'bar', color: '#6B7F9E' },
        { key: 'opProfit', name: 'Operating profit', kind: 'line', color: '#2FA37A', width: 2.4 },
      ]} height={280} />
    </Card>
  );
}

// ---------------- Change radar ----------------
export function ChangeRadar({ q, period }) {
  const { cur } = useApp();
  const single = period.days === 1;
  const defs = single
    ? [{ id: 'y', label: 'Yesterday', r: { d0: q.d0 - 1, d1: q.d1 - 1 } }, { id: 'w', label: 'Same day last wk', r: { d0: q.d0 - 7, d1: q.d1 - 7 } }, { id: 'm', label: 'Same day last mo', r: shiftRangeMonths(q, -1) }]
    : [{ id: 'y', label: 'Prior period', r: { d0: q.d0 - period.days, d1: q.d0 - 1 } }, { id: 'w', label: '1 wk earlier', r: { d0: q.d0 - 7, d1: q.d1 - 7 } }, { id: 'm', label: '1 mo earlier', r: shiftRangeMonths(q, -1) }];
  const cur0 = kpis(q);
  const rows = [
    { name: 'Revenue', v: (k) => k.rev, f: (v) => money(v, cur.code) },
    { name: 'Transactions', v: (k) => k.txns, f: num },
    { name: 'Customers served', v: (k) => k.served, f: num },
    { name: 'Avg transaction value', v: (k) => k.avgTicket, f: (v) => money(v, cur.code, { decimals: 2 }) },
    { name: 'Gross margin', v: (k) => k.margin, f: (v) => pctf(v), pts: true },
    { name: 'Operating expenses', v: (k) => k.opex, f: (v) => money(v, cur.code), good: 'down' },
  ];
  const comps = defs.map((d) => (d.r.d0 >= 0 ? kpis(withRange(q, d.r.d0, d.r.d1)) : null));
  return (
    <Card title="What changed?" cur={cur} subtitle="Selected period against three reference periods">
      <div className="tbl-wrap">
        <table className="tbl dense">
          <thead><tr><th>Metric</th><th className="r">Current</th>{defs.map((d) => <th key={d.id} className="r">{d.label}</th>)}</tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.name}><td>{r.name}</td><td className="r"><b>{r.f(r.v(cur0))}</b></td>
              {comps.map((c, i) => {
                if (!c) return <td key={i} className="r muted">n/a</td>;
                const a = r.v(cur0), b = r.v(c);
                if (r.pts) { const df = a != null && b != null ? (a - b) * 100 : null; return <td key={i} className="r"><span className="small tnum" style={{ color: df == null || Math.abs(df) < 0.05 ? 'var(--muted)' : df > 0 ? 'var(--pos)' : 'var(--neg)', fontWeight: 600 }}>{df == null ? '—' : `${df > 0 ? '+' : df < 0 ? '−' : ''}${Math.abs(df).toFixed(1)} pts`}</span></td>; }
                return <td key={i} className="r"><Delta value={pct(a, b)} goodWhen={r.good || 'up'} small /></td>;
              })}</tr>))}</tbody>
        </table>
      </div>
      <div className="small muted mt-8">Gross margin change is shown in percentage points.</div>
    </Card>
  );
}

// ---------------- Country performance ----------------
export function localRevenue(code, d0, d1) { return totals(makeQ({ country: code }, d0, d1, 'LOCAL')).rev; }

export function CountryBars({ q, pq }) {
  const { goCountry, goBranch, scope, cur } = useApp();
  const ds = getDS();
  if (!scope.country) {
    const q2 = { ...q, local: false, cur: 'USD' };
    const rows = countryRowsCompared(makeQ(scope, q.d0, q.d1, 'USD'), pq ? makeQ(scope, pq.d0, pq.d1, 'USD') : null).sort((a, b) => b.rev - a.rev);
    const total = rows.reduce((a, r) => a + r.rev, 0);
    return (
      <Card title="Sales performance by country" cur="USD" subtitle="Consolidated USD for like-for-like comparison. Click a country to open its dashboard.">
        <RankBars data={rows.map((r) => ({ ...r, value: r.rev, label: r.name }))} nameKey="label" valueKey="value" fmt={(v) => money(v, 'USD')} onClick={(d) => goCountry(d.code)} height={rows.length * 38 + 10} barSize={20} nameWidth={84} />
        <div className="small muted mt-8">Total {money(total, 'USD')} · {rows.length} markets</div>
      </Card>
    );
  }
  const rows = branchRowsCompared(q, pq).sort((a, b) => b.rev - a.rev).slice(0, 12);
  return (
    <Card title="Sales by branch" cur={cur} subtitle={`${ds.countryByCode.get(scope.country).name} — click a branch to open it`}>
      <RankBars data={rows.map((r) => ({ ...r, value: r.rev }))} nameKey="name" valueKey="value" fmt={(v) => money(v, cur.code)} onClick={(d) => goBranch(d.id)} nameWidth={130} barSize={16} />
    </Card>
  );
}

export function CountryRanking({ q, pq, period }) {
  const { goCountry, scope } = useApp();
  const ds = getDS();
  const qU = makeQ(scope, q.d0, q.d1, 'USD');
  const rows = useMemo(() => countryRowsCompared(qU, pq ? makeQ(scope, pq.d0, pq.d1, 'USD') : null).map((r) => ({ ...r, localRev: localRevenue(r.code, q.d0, q.d1), cogsUsd: r.cogs })), [q, pq, scope]);
  const total = rows.reduce((a, r) => a + r.rev, 0);
  const cols = [
    { key: 'rank', header: '#', sortable: false, render: (r, i) => <span className="rank">{i + 1}</span>, width: 36, csv: (r) => '' },
    { key: 'name', header: 'Country', render: (r) => <LinkBtn onClick={() => goCountry(r.code)}>{r.name}</LinkBtn> },
    { key: 'branches', header: 'Branches', align: 'r', value: (r) => r.branches },
    { key: 'rev', header: 'Revenue (USD)', align: 'r', value: (r) => r.rev, render: (r) => <b>{money(r.rev, 'USD')}</b> },
    { key: 'share', header: 'Share', align: 'r', value: (r) => r.rev / total, render: (r) => pctf(r.rev / total, 0) },
    { key: 'localRev', header: 'Local revenue', align: 'r', value: (r) => r.localRev, render: (r) => <span className="muted">{money(r.localRev, r.currency)}</span> },
    { key: 'growth', header: 'vs comparison', align: 'r', value: (r) => r.growthUsd, render: (r) => <Delta value={r.growthUsd} small /> },
    { key: 'attain', header: 'Target', align: 'r', value: (r) => r.attain, render: (r) => <span style={{ color: r.attain >= 1 ? 'var(--pos)' : r.attain < 0.9 ? 'var(--neg)' : undefined, fontWeight: 600 }}>{pctf(r.attain, 0)}</span> },
    { key: 'margin', header: 'Gross margin', align: 'r', value: (r) => r.margin, render: (r) => pctf(r.margin) },
    { key: 'customers', header: 'Customers', align: 'r', value: (r) => r.customers, render: (r) => num(r.customers) },
  ];
  return (
    <Card title="Country performance ranking" cur="USD" subtitle="Ranked by revenue. Local-currency revenue is shown per country in its own currency and is never summed across countries." flush>
      <DataTable columns={cols} rows={rows} rowKey={(r) => r.code} defaultSort={{ key: 'rev', dir: 'desc' }} onRowClick={(r) => goCountry(r.code)} csvName="country-ranking" />
    </Card>
  );
}

// ---------------- Branch lists ----------------
const branchCols = (go, m, extra) => [
  { key: 'name', header: 'Branch', render: (r) => <div><LinkBtn onClick={() => go(r.id)}>{r.name}</LinkBtn><div className="xs muted">{r.city}, {r.country}</div></div>, value: (r) => r.name },
  { key: 'rev', header: 'Revenue', align: 'r', value: (r) => r.rev, render: (r) => <b>{m(r.rev)}</b> },
  { key: 'growth', header: 'Change', align: 'r', value: (r) => r.growth, render: (r) => <Delta value={r.growth} small /> },
  { key: 'attain', header: 'Target', align: 'r', value: (r) => r.attain, render: (r) => <div style={{ minWidth: 70 }}><div className="right small"><b>{pctf(r.attain, 0)}</b></div><Progress value={r.attain} /></div> },
  ...extra,
];
export function BranchLists({ q, pq }) {
  const { goBranch, cur, period } = useApp();
  const m = (v) => money(v, cur.code);
  const rows = useMemo(() => branchRowsCompared(q, pq).filter((r) => r.dataStatus === 'ok' || r.rev > 0), [q, pq]);
  const top = [...rows].sort((a, b) => b.rev - a.rev).slice(0, 8);
  const comparable = rows.filter((r) => r.target > 0 && r.dataStatus === 'ok');
  const under = [...comparable].sort((a, b) => (a.attain ?? 9) - (b.attain ?? 9)).slice(0, 8);
  const delayed = rows.filter((r) => r.dataStatus === 'delayed');
  return (
    <div className="grid g2">
      <Card title="Top-performing branches" cur={cur} subtitle="Highest revenue in the selected period" flush>
        <DataTable columns={[{ key: 'rank', header: '#', sortable: false, render: (r, i) => <span className="rank">{i + 1}</span>, width: 32 }, ...branchCols(goBranch, m, [])]} rows={top} rowKey={(r) => r.id} onRowClick={(r) => goBranch(r.id)} />
      </Card>
      <Card title="Underperforming branches" cur={cur} subtitle="Lowest sales-target attainment (branches with delayed data excluded to avoid false signals)" flush>
        <DataTable columns={[{ key: 'rank', header: '#', sortable: false, render: (r, i) => <span className="rank" style={{ background: 'var(--neg-bg)', color: 'var(--neg)' }}>{i + 1}</span>, width: 32 }, ...branchCols(goBranch, m, [])]} rows={under} rowKey={(r) => r.id} onRowClick={(r) => goBranch(r.id)} />
        {delayed.length > 0 && <div className="tbl-foot"><span className="row"><Badge tone="warn">Data delayed</Badge>{delayed.map((d) => d.name).join(', ')} — excluded from this ranking.</span></div>}
      </Card>
    </div>
  );
}

// ---------------- Products & colours ----------------
export function ProductColourPanel({ q }) {
  const { cur, setDrawer, goPaints } = useApp();
  const m = (v) => money(v, cur.code);
  const agg = lineAgg(q);
  const top = [...agg.rows].sort((a, b) => b.rev - a.rev).slice(0, 8);
  const colours = colourRollup(agg.rows).slice(0, 8);
  const maxC = Math.max(1, ...colours.map((c) => c.rev));
  return (
    <div className="grid g2">
      <Card title="Best-selling paint products" cur={cur} subtitle="By revenue — click a product to inspect trend and geography" flush
        actions={<button className="btn sm" onClick={() => goPaints('products')}>All products<ArrowRight size={13} /></button>}>
        <DataTable columns={[
          { key: 'name', header: 'Product', render: (r) => <div className="row" style={{ gap: 8 }}><Swatch hex={r.hex} /><div><LinkBtn onClick={() => setDrawer({ type: 'product', idx: r.idx })}>{r.range.replace('Nash ', '')}</LinkBtn><div className="xs muted">{r.colour !== '—' ? r.colour : r.category} · {r.size}</div></div></div>, value: (r) => r.name },
          { key: 'qty', header: 'Qty', align: 'r', value: (r) => r.qty, render: (r) => num(r.qty) },
          { key: 'rev', header: 'Revenue', align: 'r', value: (r) => r.rev, render: (r) => <b>{m(r.rev)}</b> },
          { key: 'margin', header: 'Margin', align: 'r', value: (r) => r.margin, render: (r) => pctf(r.margin, 0) },
        ]} rows={top} rowKey={(r) => r.id} onRowClick={(r) => setDrawer({ type: 'product', idx: r.idx })} />
      </Card>
      <Card title="Best-selling colours" cur={cur} subtitle="Revenue and units across all ranges — click to inspect a colour">
        <div className="col" style={{ gap: 9 }}>
          {colours.map((c) => (
            <button key={c.key} className="row" style={{ background: 'none', border: 0, padding: 0, width: '100%', textAlign: 'left', gap: 10 }} onClick={() => setDrawer({ type: 'colour', name: c.key })}>
              <Swatch hex={c.hex} size={18} />
              <div className="grow"><div className="row-sb small"><b>{c.key}</b><span className="tnum"><b>{m(c.rev)}</b> <span className="muted">· {num(c.qty)} units</span></span></div><div className="progress" style={{ marginTop: 3 }}><i style={{ width: `${(c.rev / maxC) * 100}%`, background: '#2459C6' }} /></div></div>
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ---------------- Customer mix ----------------
export function CustomerMix({ q, pq }) {
  const { goPaints, period } = useApp();
  const c = customerStats(q), p = pq ? customerStats(pq) : null;
  const data = [{ name: 'New customers', value: c.newCust, color: '#1C4CAD' }, { name: 'Returning customers', value: c.returningCust, color: '#5B97F0' }, { name: 'Anonymous walk-in visits', value: c.anonVisits, color: '#C6D3E8' }];
  return (
    <Card title="New versus returning customers" subtitle="Classified from full purchase history, not just the selected dates" actions={<button className="btn sm" onClick={() => goPaints('customers')}>Customer intelligence<ArrowRight size={13} /></button>}>
      <div className="grid g2" style={{ alignItems: 'center' }}>
        <Donut data={data} onClick={() => goPaints('customers')} center={<div><div style={{ fontSize: 22, fontWeight: 700 }}>{num(c.served)}</div><div className="xs muted">customers served</div></div>} />
        <div className="col" style={{ gap: 12 }}>
          <DonutLegend data={data} />
          <div className="box small">
            <div className="row-sb"><span>Repeat purchase rate</span><b>{pctf(c.repeatRate)}</b></div>
            <div className="row-sb"><span>Loyalty-card usage</span><b>{pctf(c.cardRate)}</b></div>
            <div className="row-sb"><span>Avg spend / identified customer</span><b>{money(c.avgSpendId, q.cur)}</b></div>
          </div>
        </div>
      </div>
    </Card>
  );
}

// ---------------- Target attainment ----------------
export function TargetPanel({ q }) {
  const { goCountry, goBranch, scope, cur } = useApp();
  const k = kpis(q);
  const rows = scope.country
    ? branchRowsCompared(q, null).filter((r) => r.target > 0).sort((a, b) => a.attain - b.attain).slice(0, 8).map((r) => ({ key: r.id, name: r.name, attain: r.attain, rev: r.rev, target: r.target, go: () => goBranch(r.id) }))
    : countryRowsCompared(makeQ(scope, q.d0, q.d1, 'USD'), null).sort((a, b) => b.attain - a.attain).map((r) => ({ key: r.code, name: r.name, attain: r.attain, rev: r.rev, target: r.target, go: () => goCountry(r.code), usd: true }));
  const branchRows = branchRowsCompared(q, null).filter((r) => r.target > 0);
  const hit = branchRows.filter((r) => r.attain >= 1).length;
  return (
    <Card title="Sales target attainment" cur={cur} subtitle={scope.country ? 'Lowest-attaining branches' : 'By country (USD)'}>
      <div className="row" style={{ gap: 16, marginBottom: 12 }}>
        <div><div style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-.02em', color: k.attain >= 1 ? 'var(--pos)' : k.attain >= 0.9 ? 'var(--warn)' : 'var(--neg)' }}>{pctf(k.attain, 1)}</div><div className="xs muted">of target achieved</div></div>
        <div className="grow small muted">{hit} of {branchRows.length} branches at or above target. Targets are set from each branch's trailing 90-day run-rate and a plan factor (simulation rule).</div>
      </div>
      <div className="col" style={{ gap: 9 }}>
        {rows.map((r) => (
          <button key={r.key} style={{ background: 'none', border: 0, padding: 0, textAlign: 'left' }} onClick={r.go}>
            <div className="row-sb small"><b>{r.name}</b><span className="tnum">{pctf(r.attain, 0)} <span className="muted">· {money(r.rev, r.usd ? 'USD' : cur.code)} / {money(r.target, r.usd ? 'USD' : cur.code)}</span></span></div>
            <Progress value={r.attain} />
          </button>
        ))}
      </div>
    </Card>
  );
}

// ---------------- Alerts panel ----------------
export function alertsInScope(scope) {
  const ds = getDS();
  return buildAlerts().filter((a) => {
    if (scope.branch) return a.branchId === scope.branch;
    if (scope.city) { const b = a.branchId && ds.branchById.get(a.branchId); return b ? b.cityId === scope.city : false; }
    if (scope.country) return a.country === scope.country;
    return true;
  });
}
export function AlertsPanel({ scope, limit = 6, title = 'Alerts requiring management attention', hideOpportunities = true }) {
  const { alertState, setDrawer, goPaints } = useApp();
  let list = alertsInScope(scope || {});
  if (hideOpportunities) list = list.filter((a) => a.severity !== 'info');
  const shown = [...list].sort((a, b) => (alertState[a.id]?.ack ? 1 : 0) - (alertState[b.id]?.ack ? 1 : 0)).slice(0, limit);
  return (
    <Card title={title} subtitle={`${list.filter((a) => !alertState[a.id]?.ack).length} open · generated from the fictional dataset by defined rules, as of the latest sync`} flush
      actions={<button className="btn sm" onClick={() => goPaints('alerts')}>All alerts<ArrowRight size={13} /></button>}>
      {shown.length === 0 && <Empty title="No alerts in this scope" hint="No rules are currently triggered for the selected location." icon={<CheckCircle2 size={28} />} />}
      {shown.map((a) => (
        <button key={a.id} className={`alert-row ${alertState[a.id]?.ack ? 'ack' : ''}`} onClick={() => setDrawer({ type: 'alert', id: a.id })}>
          <span className={`sev-bar ${a.severity}`} />
          <div className="grow"><div className="row-sb"><b style={{ fontSize: 13 }}>{a.title}</b><SeverityBadge severity={a.severity} /></div><div className="small muted" style={{ marginTop: 2 }}>{a.what.length > 150 ? a.what.slice(0, 148) + '…' : a.what}</div>{alertState[a.id]?.ack && <Badge tone="good">Acknowledged</Badge>}</div>
        </button>
      ))}
    </Card>
  );
}
