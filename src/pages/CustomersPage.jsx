import React, { useState } from 'react';
import { useApp } from '../state/app.jsx';
import { FilterBar, ScopeTags } from '../components/Layout.jsx';
import { Card, Kpi, DataTable, Badge, Notice, LinkBtn } from '../components/ui.jsx';
import { Donut, DonutLegend, StackedBars, RankBars, TrendChart } from '../components/charts.jsx';
import { NewCustomerTrend } from '../components/panels2.jsx';
import { kpis, customerStats, countryRows, topCustomers, pct, series } from '../lib/query.js';
import { money, num, pctf } from '../lib/format.js';
import { fmtDay } from '../lib/dates.js';

export default function CustomersPage() {
  const { q, pq, period, cur, scope, grain, setDrawer, goCountry } = useApp();
  const [seg, setSeg] = useState('');
  const m = (v, o) => money(v, cur.code, o);
  const c = customerStats(q), p = pq ? customerStats(pq) : null;
  const cl = period.prev?.label;
  const segs = c.segments.filter((s) => s.txns > 0);
  const top = topCustomers(q, 200).filter((r) => !seg || r.segment === seg);
  const countries = !scope.country && !scope.branch ? countryRows(q) : [];
  const cls = [
    { name: 'New customers', value: c.newCust, note: 'First recorded purchase falls inside the selected period' },
    { name: 'Returning customers', value: c.returningCust, note: 'Identified customers with at least one purchase before the period' },
    { name: 'Anonymous walk-in visits', value: c.anonVisits, note: 'Transactions with no customer ID or loyalty card — counted as visits, never as unique people' },
  ];
  const ser = series(q, grain).map((s) => ({ label: s.label, 'Customers served': s.customers, 'New customers': s.newCust }));
  return (
    <>
      <FilterBar />
      <div className="page">
        <div className="page-head"><div><h1>Customer Intelligence & Loyalty</h1><p>{period.label} · customers are anonymised IDs; no personal data exists in this prototype</p></div><ScopeTags /></div>
        <div className="col" style={{ gap: 14 }}>
          <Notice tone="info"><b>How customers are classified.</b> Each customer is derived from transaction history: <b>New</b> = first-ever recorded purchase falls within the selected period; <b>Returning</b> = purchased before the period; <b>Anonymous</b> = no customer ID, counted as walk-in visits. Customers served = identified customers + anonymous visits ({num(c.identified)} + {num(c.anonVisits)} = {num(c.served)}).</Notice>
          <div className="grid g4">
            <Kpi label="Customers served" value={num(c.served)} delta={p ? pct(c.served, p.served) : undefined} compareLabel={cl} sub={`${num(c.txns)} transactions`} />
            <Kpi label="New customers" value={num(c.newCust)} delta={p ? pct(c.newCust, p.newCust) : undefined} compareLabel={cl} sub={`${pctf(c.identified ? c.newCust / c.identified : null)} of identified customers`} />
            <Kpi label="Returning customers" value={num(c.returningCust)} delta={p ? pct(c.returningCust, p.returningCust) : undefined} compareLabel={cl} sub={`${num(c.identified)} identified in total`} />
            <Kpi label="Anonymous walk-in visits" value={num(c.anonVisits)} delta={p ? pct(c.anonVisits, p.anonVisits) : undefined} neutral compareLabel={cl} sub={`${pctf(c.txns ? c.anonVisits / c.txns : null)} of transactions`} />
            <Kpi label="Repeat purchase rate" value={pctf(c.repeatRate)} sub="identified customers buying 2+ times in period" />
            <Kpi label="Purchase frequency" value={c.freq ? c.freq.toFixed(2) : '—'} sub="transactions per identified customer" />
            <Kpi label="Avg spend / identified customer" cur={cur} value={m(c.avgSpendId, { decimals: 2 })} sub={`${m(c.idRev)} identified revenue`} />
            <Kpi label="Loyalty-card usage" value={pctf(c.cardRate)} sub={`${num(c.cardTx)} card transactions`} />
          </div>
          <div className="grid g-12" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.6fr)' }}>
            <Card title="Customer classification" subtitle="Customers served by class">
              <Donut data={cls} center={<div><div style={{ fontSize: 22, fontWeight: 700 }}>{num(c.served)}</div><div className="xs muted">served</div></div>} height={190} />
              <DonutLegend data={cls} />
              <div className="col mt-12" style={{ gap: 6 }}>{cls.map((x) => <div key={x.name} className="xs muted"><b style={{ color: 'var(--text)' }}>{x.name}:</b> {x.note}</div>)}</div>
            </Card>
            <Card title="Customers served over time" subtitle={`Per ${grain}; new customers shown as a subset of identified customers`}>
              <TrendChart data={ser} series={[{ key: 'Customers served', name: 'Customers served (daily distinct + walk-ins)', kind: 'area', color: '#1C4CAD' }, { key: 'New customers', name: 'New customers', kind: 'bar', color: '#5B97F0' }]} fmt={(v) => num(v)} yFmt={(v) => num(v)} height={290} />
              <div className="xs muted mt-8">Bucketed totals add daily distinct customers, so a customer visiting on several days in one bucket is counted once per day. Use the KPI cards for distinct customers across the whole period.</div>
            </Card>
          </div>
          <div className="grid g2">
            <Card title="Revenue by customer class" cur={cur} flush>
              <DataTable columns={[
                { key: 'n', header: 'Class', value: (r) => r.n }, { key: 'tx', header: 'Transactions', align: 'r', value: (r) => r.tx, render: (r) => num(r.tx) },
                { key: 'rev', header: 'Revenue', align: 'r', value: (r) => r.rev, render: (r) => m(r.rev) }, { key: 'share', header: 'Share', align: 'r', value: (r) => r.share, render: (r) => pctf(r.share) },
                { key: 'avg', header: 'Avg txn', align: 'r', value: (r) => r.avg, render: (r) => m(r.avg, { decimals: 2 }) },
              ]} rows={[['New', c.txClass.new], ['Returning', c.txClass.returning], ['Anonymous', c.txClass.anonymous]].map(([n, o]) => ({ n, tx: o.txns, rev: o.revenue, share: c.revenue ? o.revenue / c.revenue : 0, avg: o.txns ? o.revenue / o.txns : 0 }))} rowKey={(r) => r.n}
                footer={`Total: ${num(c.txns)} transactions · ${m(c.revenue)}`} />
            </Card>
            <Card title="Purchase frequency" subtitle="Identified customers by number of purchases in the period">
              <StackedBars data={c.freqBuckets.map((b) => ({ label: b.name, Customers: b.value }))} keys={['Customers']} colors={['#1C4CAD']} fmt={(v) => num(v)} height={200} />
            </Card>
          </div>
          <div className="grid g-21" style={{ gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1fr)' }}>
            <Card title="Customer segments" cur={cur} subtitle="Click a segment to filter the top-customers list below" flush>
              <DataTable columns={[
                { key: 'name', header: 'Segment', value: (r) => r.name, render: (r) => <LinkBtn onClick={() => setSeg(seg === r.name ? '' : r.name)}>{r.name}{seg === r.name ? ' ✓' : ''}</LinkBtn> },
                { key: 'customers', header: 'Customers', align: 'r', value: (r) => r.customers, render: (r) => num(r.customers) }, { key: 'txns', header: 'Transactions', align: 'r', value: (r) => r.txns, render: (r) => num(r.txns) },
                { key: 'revenue', header: 'Revenue', align: 'r', value: (r) => r.revenue, render: (r) => m(r.revenue) }, { key: 'share', header: 'Share', align: 'r', value: (r) => r.revenue, render: (r) => pctf(c.revenue ? r.revenue / c.revenue : 0) },
                { key: 'avgTicket', header: 'Avg txn', align: 'r', value: (r) => r.avgTicket, render: (r) => m(r.avgTicket, { decimals: 2 }) },
              ]} rows={segs} rowKey={(r) => r.id} defaultSort={{ key: 'revenue', dir: 'desc' }} />
            </Card>
            <Card title="Payment methods" cur={cur} subtitle="Share of revenue">
              <Donut data={c.payments.filter((x) => x.revenue > 0).map((x) => ({ name: x.name, value: x.revenue }))} fmt={(v) => m(v)} height={170} />
              <DonutLegend data={c.payments.filter((x) => x.revenue > 0).map((x) => ({ name: x.name, value: x.revenue }))} fmt={(v) => m(v)} />
            </Card>
          </div>
          <NewCustomerTrend q={q} grain={grain} />
          {countries.length > 1 && (
            <Card title="Customers by country" subtitle="Customer counts are unitless, so they can be compared across countries" flush>
              <DataTable columns={[
                { key: 'name', header: 'Country', value: (r) => r.name, render: (r) => <LinkBtn onClick={() => goCountry(r.code)}>{r.name}</LinkBtn> },
                { key: 'customers', header: 'Customers served', align: 'r', value: (r) => r.customers, render: (r) => num(r.customers) }, { key: 'newCust', header: 'New', align: 'r', value: (r) => r.newCust, render: (r) => num(r.newCust) },
                { key: 'ret', header: 'Returning', align: 'r', value: (r) => r.returningCust, render: (r) => num(r.returningCust) }, { key: 'anon', header: 'Walk-in visits', align: 'r', value: (r) => r.anon, render: (r) => num(r.anon) },
                { key: 'newShare', header: 'New share (identified)', align: 'r', value: (r) => (r.identified ? r.newCust / r.identified : 0), render: (r) => pctf(r.identified ? r.newCust / r.identified : null) },
              ]} rows={countries} rowKey={(r) => r.code} footer="A customer is attributed to the branch country where they purchased; customers visiting several branches in a country are counted once per branch." />
            </Card>
          )}
          <Card title="Top customers by spend" cur={cur} subtitle={`Top ${num(top.length)}${seg ? ` in "${seg}"` : ''} · anonymised customer IDs · click a row for the customer profile and history`} flush
            actions={seg ? <button className="btn sm" onClick={() => setSeg('')}>Clear segment filter</button> : null}>
            <DataTable csvName="top-customers" csvPreamble={['DEMO DATA — anonymised fictional customers', `Currency: ${cur.code}`, `Period: ${period.label}`]} search pageSize={12} rowKey={(r) => r.c} onRowClick={(r) => setDrawer({ type: 'customer', c: r.c })} defaultSort={{ key: 'spend', dir: 'desc' }} searchText={(r) => `${r.id} ${r.loyalty || ''} ${r.branch} ${r.segment}`}
              columns={[
                { key: 'id', header: 'Customer ID', value: (r) => r.id, render: (r) => <span className="link">{r.id}</span> },
                { key: 'loyalty', header: 'Loyalty card', value: (r) => r.loyalty || '', render: (r) => r.loyalty || <span className="muted">None</span> },
                { key: 'segment', header: 'Segment', value: (r) => r.segment }, { key: 'branch', header: 'Home branch', value: (r) => r.branch },
                { key: 'status', header: 'Status', value: (r) => r.status, render: (r) => <Badge tone={r.status === 'New' ? 'blue' : 'good'}>{r.status}</Badge> },
                { key: 'visits', header: 'Visits', align: 'r', value: (r) => r.visits }, { key: 'last', header: 'Last purchase', value: (r) => r.last, render: (r) => fmtDay(r.last), csv: (r) => fmtDay(r.last) },
                { key: 'spend', header: `Spend (${cur.code})`, align: 'r', value: (r) => r.spend, render: (r) => <b>{m(r.spend, { decimals: 2 })}</b> },
              ]} rows={top} />
          </Card>
        </div>
      </div>
    </>
  );
}
