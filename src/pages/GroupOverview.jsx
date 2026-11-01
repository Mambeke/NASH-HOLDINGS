import React, { useMemo } from 'react';
import { ArrowRight, Paintbrush, Armchair, HardHat, Globe2, Info } from 'lucide-react';
import { useApp } from '../state/app.jsx';
import { getDS, kpis, series, makeQ, withRange, countryRows, pct } from '../lib/query.js';
import { demoTotals, demoByCountry, demoSeriesDaily } from '../data/demoBiz.js';
import { money, num, pctf, signedMoney, compact } from '../lib/format.js';
import { PRESETS, COMPARES, fmtDay, fmtRange, TODAY, weekdayName } from '../lib/dates.js';
import { Card, Kpi, Delta, DataTable, Badge, Select, CurChip, Notice, LinkBtn } from '../components/ui.jsx';
import { TrendChart, Donut, DonutLegend, RankBars, PALETTE } from '../components/charts.jsx';
import { AlertsPanel } from '../components/panels.jsx';
import { SYNC_LABEL } from '../components/Layout.jsx';

const BIZ = [
  { id: 'paints', name: 'Nash Paints', icon: Paintbrush, color: '#1C4CAD' },
  { id: 'furniture', name: 'Nash Furniture', icon: Armchair, color: '#5B97F0' },
  { id: 'construction', name: 'Nash Construction Materials', icon: HardHat, color: '#0E2A57' },
];

function groupTotals(d0, d1) {
  const p = kpis(makeQ({}, d0, d1, 'USD'));
  const f = demoTotals('furniture', d0, d1), c = demoTotals('construction', d0, d1);
  const sum = (k) => p[k] + f[k] + c[k];
  const g = { rev: sum('rev'), cogs: sum('cogs'), opex: sum('opex') };
  g.gp = g.rev - g.cogs; g.margin = g.rev ? g.gp / g.rev : null; g.opProfit = g.gp - g.opex;
  return { paints: { rev: p.rev, cogs: p.cogs, opex: p.opex, gp: p.gp, margin: p.margin, opProfit: p.opProfit, txns: p.txns, served: p.served }, furniture: f, construction: c, group: g };
}

export default function GroupOverview() {
  const { period, preset, selectPreset, compare, setCompare, goBiz, goPaints, goCountry, setCustom, setDateRange } = useApp();
  const ds = getDS();
  const cur = useMemo(() => groupTotals(period.d0, period.d1), [period]);
  const prev = useMemo(() => (period.prev ? groupTotals(period.prev.d0, period.prev.d1) : null), [period]);
  const today = useMemo(() => groupTotals(TODAY, TODAY), []);
  const yday = useMemo(() => groupTotals(TODAY - 1, TODAY - 1), []);
  const wk = useMemo(() => groupTotals(TODAY - 7, TODAY - 7), []);
  const cl = period.prev?.label;
  const g = cur.group, pg = prev?.group;
  const d = (a, b) => (pg ? pct(a, b) : undefined);

  const trend = useMemo(() => {
    const qP = makeQ({}, period.d0, period.d1, 'USD');
    const gr = period.days <= 62 ? 'day' : period.days <= 200 ? 'week' : 'month';
    const s = series(qP, gr);
    const f = demoSeriesDaily('furniture', period.d0, period.d1), c = demoSeriesDaily('construction', period.d0, period.d1);
    return s.map((b) => {
      let fr = 0, cr = 0; for (let x = b.start; x <= b.end; x++) { fr += f[x - period.d0].rev; cr += c[x - period.d0].rev; }
      return { label: b.label, start: b.start, end: b.end, Paints: b.revUsd, Furniture: fr, Construction: cr };
    });
  }, [period]);

  const bizRows = BIZ.map((b) => {
    const c = cur[b.id], p = prev?.[b.id];
    return { ...b, rev: c.rev, share: g.rev ? c.rev / g.rev : 0, growth: p ? pct(c.rev, p.rev) : null, margin: c.margin, opex: c.opex, opRatio: c.rev ? c.opex / c.rev : null, opProfit: c.opProfit, status: b.id === 'paints' ? 'Fully developed' : 'Demonstration module' };
  });
  const coverage = useMemo(() => {
    const paintsRows = countryRows(makeQ({}, period.d0, period.d1, 'USD'));
    const fRows = demoByCountry('furniture', period.d0, period.d1), cRows = demoByCountry('construction', period.d0, period.d1);
    return ds.countries.map((c) => {
      const pr = paintsRows.find((r) => r.code === c.code), fr = fRows.find((r) => r.code === c.code), cr = cRows.find((r) => r.code === c.code);
      const total = (pr?.rev || 0) + (fr?.rev || 0) + (cr?.rev || 0);
      return { code: c.code, name: c.name, currency: c.currency, branches: c.branchCount, paints: pr?.rev || 0, furniture: fr ? fr.rev : null, construction: cr ? cr.rev : null, total };
    }).sort((a, b) => b.total - a.total);
  }, [period, ds]);
  const tRev = (x) => x.group.rev;
  const spendT = today.group.cogs + today.group.opex, spendY = yday.group.cogs + yday.group.opex, spendW = wk.group.cogs + wk.group.opex;
  return (
    <div className="page">
      <div className="hero fade">
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div className="small" style={{ color: '#8FA6CC', letterSpacing: '.14em', fontWeight: 600 }}>NASH HOLDINGS · GROUP COMMAND CENTER</div>
          <h1 style={{ marginTop: 6 }}>Welcome, Chief Executive</h1>
          <p>{fmtDay(TODAY, { long: true })} · Reporting period: <b style={{ color: '#fff' }}>{fmtRange(period)}</b>{period.prev && <> · compared with {fmtRange(period.prev)}</>}</p>
          <div className="principle">One group. Three businesses. Five countries. Seventy-four branches. One executive command center.</div>
        </div>
        <div className="col" style={{ position: 'relative', zIndex: 1, alignItems: 'flex-end', gap: 8 }}>
          <div className="chips">{PRESETS.filter((p) => p.id !== 'custom').map((p) => <button key={p.id} className={`chip ${preset === p.id ? 'on' : ''}`} onClick={() => selectPreset(p.id)}>{p.label}</button>)}</div>
          <div className="row wrap" style={{ justifyContent: 'flex-end' }}>
            <select className="select" value={compare} onChange={(e) => setCompare(e.target.value)} aria-label="Comparison basis">{COMPARES.map((c) => <option key={c.id} value={c.id}>Compare: {c.label}</option>)}</select>
            <span className="sync" style={{ color: '#AFC2E6' }}><i className="dot" />Simulated sync {SYNC_LABEL}</span>
          </div>
        </div>
      </div>

      <div className="section-title"><h2>Operating businesses</h2><span>Select a business · Nash Paints is the fully developed experience</span></div>
      <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr) minmax(0,1fr)' }}>
        {BIZ.map((b) => {
          const c = cur[b.id], p = prev?.[b.id];
          const primary = b.id === 'paints';
          return (
            <button key={b.id} className={`biz-card fade ${primary ? 'primary' : ''}`} onClick={() => (primary ? goPaints('overview', true) : goBiz(b.id))} aria-label={`Open ${b.name}`}>
              <div className="row-sb"><div className="row" style={{ gap: 12 }}><div className={`biz-mark ${primary ? '' : 'demo'}`}><b.icon size={18} /></div><div><div style={{ fontWeight: 700, fontSize: 15 }}>{b.name}</div><div className="small muted">{primary ? '5 countries · 74 branches' : b.id === 'furniture' ? '3 markets · summary-level demo' : '4 markets · summary-level demo'}</div></div></div>{primary ? <Badge tone="navy">Primary · Live demo</Badge> : <Badge>Demonstration</Badge>}</div>
              <div className="stat-row">
                <div><b>{money(c.rev, 'USD')}</b><span>Revenue (USD)</span></div>
                <div><b>{pctf(c.margin)}</b><span>Gross margin</span></div>
                <div><b><Delta value={p ? pct(c.rev, p.rev) : null} small /></b><span>vs comparison</span></div>
              </div>
              <div className="row-sb small"><span className="muted">{primary ? 'Sales, customers, products, inventory, finance, alerts, reports' : 'Preview of group-level analytics; modules in development'}</span><span className="row" style={{ color: 'var(--blue-700)', fontWeight: 600 }}>Open<ArrowRight size={14} /></span></div>
            </button>
          );
        })}
      </div>

      <div className="section-title"><h2>Group performance</h2><span>USD consolidated · Paints is transaction-level; Furniture and Construction are simulated summary figures</span></div>
      <div className="grid g5" style={{ gridTemplateColumns: 'repeat(5, minmax(0,1fr))' }}>
        <Kpi label="Group revenue" cur="USD" value={money(g.rev)} delta={d(g.rev, pg?.rev)} abs={pg ? signedMoney(g.rev - pg.rev, 'USD') : undefined} compareLabel={cl} />
        <Kpi label="Cost of goods sold" cur="USD" value={money(g.cogs)} delta={d(g.cogs, pg?.cogs)} tone={pg ? (g.cogs / pg.cogs <= g.rev / pg.rev + 0.005 ? 'good' : 'warn') : undefined} compareLabel={cl} />
        <Kpi label="Gross profit" cur="USD" value={money(g.gp)} delta={d(g.gp, pg?.gp)} compareLabel={cl} sub={`Margin ${pctf(g.margin)}`} />
        <Kpi label="Operating expenses" cur="USD" value={money(g.opex)} delta={d(g.opex, pg?.opex)} goodWhen="down" compareLabel={cl} sub={`${pctf(g.rev ? g.opex / g.rev : null)} of revenue`} />
        <Kpi label="Operating profit" cur="USD" value={money(g.opProfit)} delta={d(g.opProfit, pg?.opProfit)} compareLabel={cl} sub={`${pctf(g.rev ? g.opProfit / g.rev : null)} operating margin`} note="Simulated; excludes head-office, interest and tax" />
      </div>
      <div className="mt-12">
        <Card title={`Today at a glance — ${fmtDay(TODAY, { long: true })}`} subtitle="Group totals for the latest trading day, whatever period is selected above" cur="USD">
          <div className="grid g4">
            {[
              { l: 'Group revenue today', v: money(today.group.rev), a: today.group.rev, y: yday.group.rev, w: wk.group.rev },
              { l: 'Spend today (COGS + OpEx)', v: money(spendT), a: spendT, y: spendY, w: spendW, good: 'down' },
              { l: 'Paints transactions today', v: num(today.paints.txns), a: today.paints.txns, y: yday.paints.txns, w: wk.paints.txns },
              { l: 'Paints customers served today', v: num(today.paints.served), a: today.paints.served, y: yday.paints.served, w: wk.paints.served },
            ].map((x) => (
              <div key={x.l} className="kpi" style={{ boxShadow: 'none' }}><div className="kpi-l">{x.l}</div><div className="kpi-v" style={{ fontSize: 21 }}>{x.v}</div>
                <div className="kpi-sub"><Delta value={pct(x.a, x.w)} goodWhen={x.good || 'up'} small /><span>vs last {weekdayName(TODAY - 7)}</span><Delta value={pct(x.a, x.y)} goodWhen={x.good || 'up'} small /><span>vs yesterday</span></div></div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid g-21 mt-16">
        <Card title="Revenue by business" cur="USD" subtitle="Stacked by business — click a bar to zoom into that period">
          <TrendChart data={trend} height={270} series={[
            { key: 'Paints', name: 'Nash Paints', kind: 'bar', color: '#1C4CAD', stackId: 's' },
            { key: 'Furniture', name: 'Nash Furniture (demo)', kind: 'bar', color: '#7FB0F5', stackId: 's' },
            { key: 'Construction', name: 'Nash Construction (demo)', kind: 'bar', color: '#0E2A57', stackId: 's' },
          ]} fmt={(v) => money(v, 'USD')} onPointClick={(pt) => setDateRange(pt.start, pt.end)} />
        </Card>
        <Card title="Performance comparison" subtitle="Operating businesses, selected period" cur="USD" flush>
          <DataTable columns={[
            { key: 'name', header: 'Business', render: (r) => <LinkBtn onClick={() => (r.id === 'paints' ? goPaints('overview', true) : goBiz(r.id))}>{r.name.replace('Nash ', '')}</LinkBtn>, value: (r) => r.name },
            { key: 'rev', header: 'Revenue', align: 'r', value: (r) => r.rev, render: (r) => <b>{money(r.rev, 'USD')}</b> },
            { key: 'growth', header: 'Change', align: 'r', value: (r) => r.growth, render: (r) => <Delta value={r.growth} small /> },
            { key: 'margin', header: 'GM', align: 'r', value: (r) => r.margin, render: (r) => pctf(r.margin, 0) },
            { key: 'opRatio', header: 'OpEx %', align: 'r', value: (r) => r.opRatio, render: (r) => pctf(r.opRatio, 0) },
          ]} rows={bizRows} rowKey={(r) => r.id} />
          <div style={{ padding: '0 16px 14px' }}>
            <Donut data={bizRows.map((b) => ({ name: b.name.replace('Nash ', ''), value: b.rev, color: b.color }))} height={170} fmt={(v) => money(v, 'USD')} center={<div><div style={{ fontSize: 18, fontWeight: 700 }}>{money(g.rev, 'USD')}</div><div className="xs muted">group revenue</div></div>} inner={48} />
          </div>
        </Card>
      </div>

      <div className="grid g-21 mt-16" style={{ gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1fr)' }}>
        <Card title="Country and market coverage" cur="USD" subtitle="Group revenue by country (USD). Raw local-currency amounts are never added across countries." flush>
          <DataTable columns={[
            { key: 'name', header: 'Country', render: (r) => <LinkBtn onClick={() => goCountry(r.code)}>{r.name}</LinkBtn>, value: (r) => r.name },
            { key: 'cur', header: 'Currency', value: (r) => r.currency },
            { key: 'branches', header: 'Paints branches', align: 'r', value: (r) => r.branches },
            { key: 'paints', header: 'Paints', align: 'r', value: (r) => r.paints, render: (r) => money(r.paints, 'USD') },
            { key: 'furniture', header: 'Furniture*', align: 'r', value: (r) => r.furniture ?? -1, render: (r) => (r.furniture == null ? <span className="faint">not present</span> : money(r.furniture, 'USD')) },
            { key: 'construction', header: 'Construction*', align: 'r', value: (r) => r.construction ?? -1, render: (r) => (r.construction == null ? <span className="faint">not present</span> : money(r.construction, 'USD')) },
            { key: 'total', header: 'Group total', align: 'r', value: (r) => r.total, render: (r) => <b>{money(r.total, 'USD')}</b> },
          ]} rows={coverage} rowKey={(r) => r.code} defaultSort={{ key: 'total', dir: 'desc' }} onRowClick={(r) => goCountry(r.code)} csvName="group-market-coverage" />
          <div className="tbl-foot"><span>* Demonstration summary data. 5 countries · 74 Paints branches. Click a country to open its Nash Paints dashboard.</span></div>
        </Card>
        <AlertsPanel scope={{}} limit={5} title="Needs your attention" />
      </div>
      <div className="notice mt-16"><Info size={16} /><div><b>Prototype notice.</b> Everything shown is fictional, generated for demonstration by Obitrek. It is not connected to any point-of-sale, ERP or accounting system and does not represent verified company information or real-time transactions.</div></div>
    </div>
  );
}
