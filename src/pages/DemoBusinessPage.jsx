import React, { useMemo, useState } from 'react';
import { Armchair, HardHat, FlaskConical, ArrowRight, Layers } from 'lucide-react';
import { useApp } from '../state/app.jsx';
import { Card, Kpi, Badge, Notice, DataTable, Seg, LinkBtn } from '../components/ui.jsx';
import { TrendChart, Donut, DonutLegend, RankBars } from '../components/charts.jsx';
import { demoTotals, demoByCountry, demoSeriesDaily, demoCategories, DEMO_SPEC } from '../data/demoBiz.js';
import { getDS, pct } from '../lib/query.js';
import { PRESETS, fmtDay, fmtRange, monthStartDay, ymd, weekday } from '../lib/dates.js';
import { money, num, pctf, signedPct } from '../lib/format.js';
import { SYNC_LABEL } from '../components/Layout.jsx';

export default function DemoBusinessPage({ id }) {
  const { period, selectPreset, preset, goPaints, goGroup, goCountry } = useApp();
  const ds = getDS();
  const spec = DEMO_SPEC[id];
  const [country, setCountry] = useState('');
  const Icon = id === 'furniture' ? Armchair : HardHat;
  const countries = Object.keys(spec.countries);
  const t = demoTotals(id, period.d0, period.d1, country || undefined), p = period.prev ? demoTotals(id, period.prev.d0, period.prev.d1, country || undefined) : null;
  const cl = period.prev?.label;
  const daily = demoSeriesDaily(id, period.d0, period.d1, country || undefined);
  const trend = useMemo(() => {
    const g = period.days <= 31 ? 'day' : period.days <= 200 ? 'week' : 'month';
    const m = new Map();
    for (const r of daily) {
      const k = g === 'day' ? r.d : g === 'week' ? r.d - weekday(r.d) : monthStartDay(ymd(r.d).y, ymd(r.d).m);
      let o = m.get(k); if (!o) { o = { label: g === 'month' ? new Date(2025, 0, 1 + k).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }) : (g === 'week' ? 'Wk ' : '') + fmtDay(Math.max(period.d0, k), { noYear: true }), rev: 0, gp: 0, opex: 0 }; m.set(k, o); }
      o.rev += r.rev; o.gp += r.rev - r.cogs; o.opex += r.opex;
    }
    return [...m.values()];
  }, [daily, period]);
  const cats = demoCategories(id, period.d0, period.d1, country || undefined);
  const byC = demoByCountry(id, period.d0, period.d1).map((r) => ({ ...r, name: ds.countryByCode.get(r.code).name, prev: period.prev ? demoTotals(id, period.prev.d0, period.prev.d1, r.code).rev : null }));
  return (
    <div className="page">
      <div className="demo-banner">
        <FlaskConical size={20} />
        <div><b>DEMONSTRATION MODULE — {spec.name}</b><div className="small">Summary-level simulated figures only (USD). No transactions, branches, inventory or customers exist for this business in the prototype. Nash Paints is the fully developed business.</div></div>
        <button className="btn" onClick={() => goPaints('overview', true)}>Open Nash Paints<ArrowRight size={14} /></button>
      </div>
      <div className="page-head mt-12">
        <div><h1 className="row" style={{ gap: 10 }}><Icon size={22} />{spec.name}<Badge tone="warn">Demo</Badge></h1><p>{period.label} · {fmtRange(period.d0, period.d1)} · consolidated USD · fictional data synced {SYNC_LABEL}</p></div>
        <div className="row wrap" style={{ gap: 8 }}>
          <Seg small options={PRESETS.filter((x) => x.id !== 'custom').map((x) => ({ id: x.id, label: x.label }))} value={preset} onChange={selectPreset} />
        </div>
      </div>
      <div className="row wrap mt-8" style={{ gap: 8 }}>
        <span className="small muted">Market</span>
        <Seg small options={[{ id: '', label: 'All markets' }, ...countries.map((c) => ({ id: c, label: ds.countryByCode.get(c).name }))]} value={country} onChange={setCountry} />
      </div>
      <div className="col mt-12" style={{ gap: 14 }}>
        <div className="grid g3">
          <Kpi label="Revenue (simulated)" cur={{ code: 'USD' }} value={money(t.rev)} delta={p ? pct(t.rev, p.rev) : undefined} compareLabel={cl} />
          <Kpi label="Orders" value={num(t.orders)} delta={p ? pct(t.orders, p.orders) : undefined} compareLabel={cl} sub={`Avg order ${money(t.avgOrder)}`} />
          <Kpi label="Gross margin" value={pctf(t.margin)} sub={`${money(t.gp)} gross profit`} delta={p && p.margin ? pct(t.margin, p.margin) : undefined} compareLabel={cl} />
          <Kpi label="Cost of goods sold" value={money(t.cogs)} sub={`${pctf(t.rev ? t.cogs / t.rev : null)} of revenue`} />
          <Kpi label="Operating expenses" value={money(t.opex)} goodWhen="down" delta={p ? pct(t.opex, p.opex) : undefined} compareLabel={cl} />
          <Kpi label="Operating profit (simulated)" value={money(t.opProfit)} sub={`${pctf(t.rev ? t.opProfit / t.rev : null)} margin`} />
        </div>
        <div className="grid g-21">
          <Card title="Revenue and gross profit" cur={{ code: 'USD' }} subtitle="Simulated summary series">
            <TrendChart data={trend} series={[{ key: 'rev', name: 'Revenue', kind: 'area', color: '#1C4CAD' }, { key: 'gp', name: 'Gross profit', kind: 'line', color: '#2FA37A' }, { key: 'opex', name: 'Operating expenses', kind: 'line', color: '#6B7F9E', dashed: true }]} fmt={(v) => money(v)} height={270} />
          </Card>
          <Card title="Category mix" subtitle="Allocated by fixed demonstration shares">
            <Donut data={cats.map((c) => ({ name: c.name, value: c.rev }))} fmt={(v) => money(v)} height={180} />
            <DonutLegend data={cats.map((c) => ({ name: c.name, value: c.rev }))} fmt={(v) => money(v)} />
          </Card>
        </div>
        <div className="grid g2">
          <Card title="Revenue by market" cur={{ code: 'USD' }} flush>
            <DataTable columns={[
              { key: 'name', header: 'Market', value: (r) => r.name, render: (r) => <LinkBtn onClick={() => setCountry(country === r.code ? '' : r.code)}>{r.name}</LinkBtn> },
              { key: 'rev', header: 'Revenue (USD)', align: 'r', value: (r) => r.rev, render: (r) => money(r.rev) },
              { key: 'growth', header: `vs ${cl?.toLowerCase() || 'previous'}`, align: 'r', value: (r) => (r.prev ? pct(r.rev, r.prev) : 0), render: (r) => signedPct(r.prev ? pct(r.rev, r.prev) : null) },
              { key: 'margin', header: 'Gross margin', align: 'r', value: (r) => r.margin, render: (r) => pctf(r.margin) },
              { key: 'orders', header: 'Orders', align: 'r', value: (r) => r.orders, render: (r) => num(r.orders) },
            ]} rows={byC} rowKey={(r) => r.code} defaultSort={{ key: 'rev', dir: 'desc' }} footer="Click a market to filter this page. Amounts are USD only." />
          </Card>
          <Card title="Category margins" subtitle="Demonstration assumptions">
            <div className="col" style={{ gap: 10 }}>{cats.map((c) => <div key={c.name}><div className="row-sb small"><b>{c.name}</b><span>{pctf(c.margin, 0)} margin · {money(c.rev)}</span></div><div className="progress"><i style={{ width: `${c.margin * 200}%` }} /></div></div>)}</div>
          </Card>
        </div>
        <Card title="What a full module would add" subtitle="Planned capabilities — not built in this prototype" actions={<Badge>Roadmap</Badge>}>
          <div className="grid g4">{spec.modules.map((m) => <div key={m} className="box"><h4><Layers size={11} style={{ verticalAlign: -1 }} /> Planned</h4><b style={{ fontSize: 13.5 }}>{m}</b></div>)}</div>
        </Card>
        <Notice tone="warn"><b>Reading these figures.</b> Group totals on the landing page add this module’s simulated USD revenue to Nash Paints (transaction-level) and Nash Construction/Furniture (summary-level). Because they are not built from transactions, drill-downs are intentionally unavailable. <LinkBtn onClick={goGroup}>Back to Group overview</LinkBtn></Notice>
      </div>
    </div>
  );
}
