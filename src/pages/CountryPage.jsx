import React, { useMemo, useState } from 'react';
import { useApp } from '../state/app.jsx';
import { FilterBar, ScopeTags } from '../components/Layout.jsx';
import { KpiGrid, TodayStrip, TrendCard, RevenueVsExpenses, ProductColourPanel, CustomerMix, AlertsPanel, useFmt } from '../components/panels.jsx';
import { StockPanel, ReviewSummary, NewCustomerTrend } from '../components/panels2.jsx';
import { Card, DataTable, Delta, Badge, LinkBtn, Progress, Seg, Select, Notice, CurChip } from '../components/ui.jsx';
import { RankBars } from '../components/charts.jsx';
import { getDS, branchRowsCompared } from '../lib/query.js';
import { money, num, pctf, signedPct } from '../lib/format.js';

const METRICS = [
  { id: 'rev', label: 'Revenue', f: (r, m) => m(r.rev), v: (r) => r.rev },
  { id: 'txns', label: 'Transactions', f: (r) => num(r.txns), v: (r) => r.txns },
  { id: 'customers', label: 'Customers', f: (r) => num(r.customers), v: (r) => r.customers },
  { id: 'growth', label: 'Growth', f: (r) => signedPct(r.growth), v: (r) => r.growth },
  { id: 'attain', label: 'Target attainment', f: (r) => pctf(r.attain, 0), v: (r) => r.attain },
  { id: 'avgTicket', label: 'Avg transaction value', f: (r, m) => m(r.avgTicket, { decimals: 2 }), v: (r) => r.avgTicket },
  { id: 'margin', label: 'Gross margin', f: (r) => pctf(r.margin), v: (r) => r.margin },
];

export default function CountryPage({ code }) {
  const { q, pq, period, scope, currencyMode, cur, goBranch } = useApp();
  const ds = getDS();
  const country = ds.countryByCode.get(code);
  const [metric, setMetric] = useState('rev');
  const [order, setOrder] = useState('desc');
  const m = (v, o) => money(v, cur.code, o);
  const rows = useMemo(() => branchRowsCompared(q, pq), [q, pq]);
  const met = METRICS.find((x) => x.id === metric);
  const ranked = useMemo(() => [...rows].filter((r) => met.v(r) != null).sort((a, b) => (order === 'desc' ? met.v(b) - met.v(a) : met.v(a) - met.v(b))).slice(0, 12), [rows, metric, order]);
  if (!country) return <div className="page"><Notice tone="warn">Unknown country code.</Notice></div>;
  const cities = ds.cities.filter((c) => c.country === code);
  const cols = [
    { key: 'name', header: 'Branch', render: (r) => <div><LinkBtn onClick={() => goBranch(r.id)}>{r.name}</LinkBtn><div className="xs muted">{r.id}</div></div>, value: (r) => r.name },
    { key: 'city', header: 'City', value: (r) => r.city },
    { key: 'rev', header: 'Revenue', align: 'r', value: (r) => r.rev, render: (r) => <b>{m(r.rev)}</b> },
    { key: 'growth', header: 'Growth', align: 'r', value: (r) => r.growth, render: (r) => <Delta value={r.growth} small /> },
    { key: 'txns', header: 'Transactions', align: 'r', value: (r) => r.txns, render: (r) => num(r.txns) },
    { key: 'customers', header: 'Customers', align: 'r', value: (r) => r.customers, render: (r) => num(r.customers) },
    { key: 'avgTicket', header: 'Avg txn', align: 'r', value: (r) => r.avgTicket, render: (r) => m(r.avgTicket, { decimals: 2 }) },
    { key: 'attain', header: 'Target', align: 'r', value: (r) => r.attain, render: (r) => <div style={{ minWidth: 64 }}><div className="right small"><b>{pctf(r.attain, 0)}</b></div><Progress value={r.attain} /></div> },
    { key: 'margin', header: 'Gross margin', align: 'r', value: (r) => r.margin, render: (r) => pctf(r.margin) },
    { key: 'opex', header: 'OpEx', align: 'r', value: (r) => r.opex, render: (r) => m(r.opex) },
    { key: 'status', header: 'Data', value: (r) => r.dataStatus, render: (r) => (r.dataStatus === 'delayed' ? <Badge tone="warn">Delayed</Badge> : <Badge tone="good">Synced</Badge>) },
  ];
  return (
    <>
      <FilterBar />
      <div className="page">
        <div className="page-head">
          <div>
            <h1 className="row" style={{ gap: 12 }}>{country.name}<Badge tone="navy">{country.code}</Badge><Badge tone="blue">{country.branchCount} branches</Badge><CurChip cur={{ code: country.currency, local: country.currency !== 'USD' && cur.local }} /></h1>
            <p>Nash Paints · {cities.length} cities · reporting {cur.local ? `in local currency (${country.currency})` : `in consolidated USD${country.currency !== 'USD' ? ` — switch to Local to view ${country.currency}` : ''}`} · {period.label}</p>
          </div>
          <ScopeTags />
        </div>
        <div className="col" style={{ gap: 14 }}>
          <TodayStrip scope={scope} currencyMode={currencyMode} />
          <KpiGrid q={q} pq={pq} period={period} />
          <div className="grid g-21" style={{ gridTemplateColumns: 'minmax(0,1.2fr) minmax(0,1fr)' }}>
            <TrendCard q={q} pq={pq} period={period} title={`${country.name} sales trend`} />
            <RevenueVsExpenses q={q} />
          </div>
          <Card title="Branch performance" cur={cur} subtitle="Compare branches on any metric. Click a bar or row to open the branch." flush
            actions={<div className="row wrap"><Seg options={[{ id: 'desc', label: 'Highest' }, { id: 'asc', label: 'Lowest' }]} value={order} onChange={setOrder} /><select className="select" value={metric} onChange={(e) => setMetric(e.target.value)} aria-label="Ranking metric">{METRICS.map((x) => <option key={x.id} value={x.id}>Rank by {x.label}</option>)}</select></div>}>
            <div style={{ padding: '0 16px' }}>
              <RankBars data={ranked.map((r) => ({ ...r, value: met.v(r) }))} nameKey="name" valueKey="value" fmt={(v, p) => met.f({ ...p.payload }, m)} labelFmt={(v) => (met.id === 'rev' || met.id === 'avgTicket' ? m(v) : met.id === 'growth' ? signedPct(v) : met.id === 'attain' || met.id === 'margin' ? pctf(v, 0) : num(v))} onClick={(d) => goBranch(d.id)} nameWidth={140} barSize={14} colorFn={(d) => (met.id === 'attain' && d.value < 0.9 ? '#D5524A' : met.id === 'growth' && d.value < 0 ? '#D5524A' : '#1C4CAD')} />
            </div>
            <DataTable columns={cols} rows={rows} rowKey={(r) => r.id} defaultSort={{ key: 'rev', dir: 'desc' }} onRowClick={(r) => goBranch(r.id)} search searchText={(r) => `${r.name} ${r.city} ${r.id}`} csvName={`${code}-branch-performance`} pageSize={20}
              />
          </Card>
          <ProductColourPanel q={q} />
          <div className="grid g-21" style={{ gridTemplateColumns: 'minmax(0,1.2fr) minmax(0,1fr)' }}>
            <CustomerMix q={q} pq={pq} />
            <NewCustomerTrend q={q} />
          </div>
          <StockPanel scope={scope} />
          <div className="grid g-21" style={{ gridTemplateColumns: 'minmax(0,1.2fr) minmax(0,1fr)' }}>
            <ReviewSummary q={q} />
            <AlertsPanel scope={scope} title={`Operational alerts — ${country.name}`} limit={5} hideOpportunities={false} />
          </div>
        </div>
      </div>
    </>
  );
}
