import React, { useMemo, useState } from 'react';
import { Store, Star, AlertTriangle, MapPin } from 'lucide-react';
import { useApp } from '../state/app.jsx';
import { FilterBar } from '../components/Layout.jsx';
import { KpiGrid, TodayStrip, TrendCard, ProductColourPanel, CustomerMix, AlertsPanel } from '../components/panels.jsx';
import { StockPanel, ReviewSummary, CommentList, NewCustomerTrend } from '../components/panels2.jsx';
import { Card, DataTable, Badge, Swatch, LinkBtn, Notice, CurChip, Progress, Seg } from '../components/ui.jsx';
import { TrendChart, Donut, DonutLegend, RankBars } from '../components/charts.jsx';
import { getDS, txList, lineAgg, rollup, customerStats, inventoryRows, expenseBreakdown, hourlyProfile, reviewStats, kpis } from '../lib/query.js';
import { money, num, pctf, signedPct } from '../lib/format.js';
import { fmtDay, TODAY } from '../lib/dates.js';

export default function BranchPage({ id }) {
  const { q, pq, period, scope, currencyMode, cur, setDrawer, goCountry } = useApp();
  const ds = getDS();
  const b = ds.branchById.get(id);
  const [stFilter, setStFilter] = useState('flagged');
  const [segFilter, setSegFilter] = useState('');
  const [clsFilter, setClsFilter] = useState('');
  const [payFilter, setPayFilter] = useState('');
  if (!b) return <div className="page"><Notice tone="warn">Unknown branch.</Notice></div>;
  const m = (v, o) => money(v, cur.code, o);
  const day = period.d1;
  const agg = lineAgg(q);
  const sizes = rollup(agg.rows.filter((r) => r.p.sizeL > 0), (r) => r.size).sort((x, y) => y.qty - x.qty);
  const cust = customerStats(q);
  const stock = inventoryRows(q);
  const stockRows = stock.filter((r) => (stFilter === 'flagged' ? r.status !== 'ok' : stFilter === 'all' ? true : r.status === stFilter));
  const exp = expenseBreakdown(q, 'week');
  const k = kpis(q);
  const rs = reviewStats(q);
  const hours = hourlyProfile(q);
  const tl = txList(q, 4000);
  const txRows = tl.rows.filter((r) => (!segFilter || r.segment === segFilter) && (!clsFilter || r.cls === clsFilter) && (!payFilter || r.pay === payFilter));
  const stale = b.lastDataDay < TODAY;
  const flagged = stock.filter((r) => r.status !== 'ok').length;
  return (
    <>
      <FilterBar />
      <div className="page">
        <div className="page-head">
          <div>
            <h1 className="row" style={{ gap: 12 }}><Store size={22} />{b.name}<Badge tone="navy">{b.id}</Badge>{stale ? <Badge tone="warn">Data delayed</Badge> : <Badge tone="good">Synced</Badge>}<CurChip cur={cur} /></h1>
            <p><MapPin size={12} style={{ verticalAlign: -1 }} /> {b.city}, <LinkBtn onClick={() => goCountry(b.country)}>{ds.countryByCode.get(b.country).name}</LinkBtn> · {b.tier === 'F' ? 'Flagship' : b.tier === 'L' ? 'Large' : b.tier === 'M' ? 'Medium' : 'Small'} branch · fictional demonstration location · {period.label}{rs.count ? <> · <Star size={12} fill="#E0A030" color="#E0A030" style={{ verticalAlign: -1 }} /> {rs.avg.toFixed(2)} ({num(rs.count)} reviews)</> : null}</p>
          </div>
        </div>
        {stale && <div className="mt-8"><Notice tone="warn"><b>Missing or delayed data.</b> The last transactions received from this branch are dated {fmtDay(b.lastDataDay, { long: true })}. Zero sales since then reflect a data gap, not necessarily trading performance.</Notice></div>}
        <div className="col mt-12" style={{ gap: 14 }}>
          <TodayStrip scope={scope} currencyMode={currencyMode} day={day} />
          <KpiGrid q={q} pq={pq} period={period} />
          <div className="grid g-21">
            <TrendCard q={q} pq={pq} period={period} title="Branch revenue trend" />
            <Card title="Trading hours profile" subtitle="Transactions by hour of day in the selected period">
              <TrendChart data={hours} xKey="label" series={[{ key: 'txns', name: 'Transactions', kind: 'bar', color: '#5B97F0' }]} fmt={(v) => num(v)} yFmt={(v) => num(v)} height={250} legend={false} />
            </Card>
          </div>
          <ProductColourPanel q={q} />
          <div className="grid g-12" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.4fr)' }}>
            <Card title="Container sizes" subtitle="Units sold by container size (paint products)">
              <Donut data={sizes.map((s) => ({ name: s.key, value: s.qty }))} fmt={(v) => `${num(v)} units`} height={180} center={<div><div style={{ fontSize: 18, fontWeight: 700 }}>{num(sizes.reduce((a, s) => a + s.qty, 0))}</div><div className="xs muted">paint units</div></div>} />
              <DonutLegend data={sizes.map((s) => ({ name: s.key, value: s.qty }))} fmt={(v) => `${num(v)}`} />
            </Card>
            <Card title="Customer segments" cur={cur} subtitle="Click a segment to filter the transactions table below" flush>
              <DataTable columns={[
                { key: 'name', header: 'Segment', render: (r) => <LinkBtn onClick={() => { setSegFilter(r.name); document.getElementById('tx-table')?.scrollIntoView({ behavior: 'smooth' }); }}>{r.name}</LinkBtn>, value: (r) => r.name },
                { key: 'customers', header: 'Customers', align: 'r', value: (r) => r.customers, render: (r) => num(r.customers) },
                { key: 'txns', header: 'Transactions', align: 'r', value: (r) => r.txns, render: (r) => num(r.txns) },
                { key: 'revenue', header: 'Revenue', align: 'r', value: (r) => r.revenue, render: (r) => <b>{m(r.revenue)}</b> },
                { key: 'avgTicket', header: 'Avg txn', align: 'r', value: (r) => r.avgTicket, render: (r) => m(r.avgTicket, { decimals: 2 }) },
              ]} rows={cust.segments.filter((s) => s.txns > 0)} rowKey={(r) => r.id} defaultSort={{ key: 'revenue', dir: 'desc' }} />
            </Card>
          </div>
          <div className="grid g-21" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.2fr)' }}>
            <CustomerMix q={q} pq={pq} />
            <NewCustomerTrend q={q} />
          </div>
          <Card title="Stock levels and low-stock warnings" subtitle={`${flagged} of ${stock.length} products need attention · current position at latest sync`} flush
            actions={<Seg options={[{ id: 'flagged', label: 'Needs attention' }, { id: 'out', label: 'Out' }, { id: 'low', label: 'Low' }, { id: 'all', label: 'All' }]} value={stFilter} onChange={setStFilter} />}>
            <DataTable columns={[
              { key: 'product', header: 'Product', render: (r) => <div className="row" style={{ gap: 6 }}><Swatch hex={r.hex} /><LinkBtn onClick={() => setDrawer({ type: 'product', idx: r.p.idx })}>{r.product}</LinkBtn></div>, value: (r) => r.product },
              { key: 'stock', header: 'On hand', align: 'r', value: (r) => r.stock }, { key: 'rp', header: 'Reorder at', align: 'r', value: (r) => r.reorderPoint },
              { key: 'vel', header: 'Units/day (14d)', align: 'r', value: (r) => r.velocity, render: (r) => r.velocity.toFixed(2) },
              { key: 'cover', header: 'Days of cover', align: 'r', value: (r) => r.cover ?? 999, render: (r) => (r.cover == null ? '—' : r.cover.toFixed(1)) },
              { key: 'status', header: 'Status', value: (r) => r.status, render: (r) => <Badge tone={r.status === 'out' ? 'bad' : r.status === 'low' ? 'warn' : 'good'}>{r.status === 'out' ? 'Out of stock' : r.status === 'low' ? 'Low stock' : 'In stock'}</Badge> },
            ]} rows={stockRows} rowKey={(r) => r.key} pageSize={10} search csvName={`${b.id}-stock`} defaultSort={{ key: 'stock', dir: 'asc' }} />
          </Card>
          <div className="grid g-21" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)' }}>
            <Card title="Expenses and cost information" cur={cur} subtitle="COGS is shown separately from operating expenses; budget comparison for the selected period" flush>
              <div style={{ padding: '0 16px 10px' }} className="grid g3">
                <div className="box"><h4>COGS</h4><b>{m(k.cogs)}</b><div className="xs muted">{pctf(k.rev ? k.cogs / k.rev : null)} of revenue</div></div>
                <div className="box"><h4>Operating expenses</h4><b>{m(k.opex)}</b><div className="xs muted">{pctf(k.rev ? k.opex / k.rev : null)} of revenue</div></div>
                <div className="box"><h4>Operating profit</h4><b>{m(k.opProfit)}</b><div className="xs muted">{pctf(k.opMargin)} margin (simulated)</div></div>
              </div>
              <DataTable columns={[
                { key: 'name', header: 'Expense category', value: (r) => r.name }, { key: 'actual', header: 'Actual', align: 'r', value: (r) => r.actual, render: (r) => m(r.actual) },
                { key: 'budget', header: 'Budget', align: 'r', value: (r) => r.budget, render: (r) => m(r.budget) },
                { key: 'varPct', header: 'Variance', align: 'r', value: (r) => r.varPct, render: (r) => <span style={{ color: r.varPct > 0.05 ? 'var(--neg)' : r.varPct < -0.02 ? 'var(--pos)' : undefined, fontWeight: 600 }}>{signedPct(r.varPct)}</span> },
              ]} rows={exp.categories} rowKey={(r) => r.id} />
            </Card>
            <ReviewSummary q={q} title="Customer ratings and reviews" />
          </div>
          <Card title="Recent customer comments" subtitle="Fictional reviews. Verified = linked to a recorded transaction at this branch."><CommentList list={rs.list} limit={6} /></Card>
          <Card title="Transactions" subtitle={`${num(tl.total)} sales transactions in the selected period${tl.truncated ? ` · showing the most recent ${num(tl.rows.length)}` : ''} — click a row to inspect`} cur={cur} flush>
            <div id="tx-table">
              <DataTable csvName={`${b.id}-transactions`} csvPreamble={['DEMO DATA — fictional records', `Branch ${b.id} ${b.name}`, `Period ${fmtDay(period.d0)} to ${fmtDay(period.d1)}`]} pageSize={12} search searchText={(r) => `${r.ref} ${r.product} ${r.customer} ${r.pay} ${r.cls}`} defaultSort={{ key: 'dt', dir: 'desc' }}
                extraTools={<div className="row wrap">
                  <select className="select" value={segFilter} onChange={(e) => setSegFilter(e.target.value)} aria-label="Segment filter"><option value="">All segments</option>{[...new Set(tl.rows.map((r) => r.segment))].map((s) => <option key={s}>{s}</option>)}</select>
                  <select className="select" value={clsFilter} onChange={(e) => setClsFilter(e.target.value)} aria-label="Customer class filter"><option value="">All customer classes</option><option>New</option><option>Returning</option><option>Anonymous</option></select>
                  <select className="select" value={payFilter} onChange={(e) => setPayFilter(e.target.value)} aria-label="Payment filter"><option value="">All payment methods</option>{ds.payMethods.map((p) => <option key={p}>{p}</option>)}</select>
                  {(segFilter || clsFilter || payFilter) && <button className="btn sm" onClick={() => { setSegFilter(''); setClsFilter(''); setPayFilter(''); }}>Clear filters</button>}</div>}
                columns={[
                  { key: 'ref', header: 'Reference', render: (r) => <span className="link">{r.ref}</span>, value: (r) => r.ref },
                  { key: 'dt', header: 'Date & time', value: (r) => r.day * 2000 + r.minute, render: (r) => `${r.date} ${r.time}`, csv: (r) => `${r.date} ${r.time}` },
                  { key: 'product', header: 'Product', value: (r) => r.product, render: (r) => <div className="row" style={{ gap: 6 }}><Swatch hex={r.lines[0].hex} />{r.product}</div> },
                  { key: 'units', header: 'Qty', align: 'r', value: (r) => r.units },
                  { key: 'amount', header: `Sales (${cur.code})`, align: 'r', value: (r) => r.amount, render: (r) => <b>{m(r.amount, { decimals: 2 })}</b> },
                  { key: 'pay', header: 'Payment', value: (r) => r.pay },
                  { key: 'customer', header: 'Customer', value: (r) => r.customer },
                  { key: 'cls', header: 'Class', value: (r) => r.cls, render: (r) => <Badge tone={r.cls === 'New' ? 'blue' : r.cls === 'Returning' ? 'good' : 'neutral'}>{r.cls}</Badge> },
                ]} rows={txRows} rowKey={(r) => r.i} onRowClick={(r) => setDrawer({ type: 'tx', i: r.i })} />
            </div>
          </Card>
          <AlertsPanel scope={scope} title="Alerts and potential anomalies" hideOpportunities={false} />
        </div>
      </div>
    </>
  );
}
