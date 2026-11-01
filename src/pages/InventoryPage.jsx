import React, { useMemo, useState } from 'react';
import { PackageX, Boxes } from 'lucide-react';
import { useApp } from '../state/app.jsx';
import { FilterBar, ScopeTags } from '../components/Layout.jsx';
import { Card, Kpi, DataTable, Swatch, Badge, LinkBtn, Seg, Notice, Empty } from '../components/ui.jsx';
import { TrendChart, RankBars, SEMANTIC } from '../components/charts.jsx';
import { getDS, makeQ, inventoryRows, inventoryTotals, stockSeries, discrepancies } from '../lib/query.js';
import { num, pctf } from '../lib/format.js';
import { TODAY, grainFor, fmtDay } from '../lib/dates.js';

const stTone = { out: 'bad', low: 'warn', ok: 'good' };
const stLabel = { out: 'Out of stock', low: 'Low stock', ok: 'In stock' };

export default function InventoryPage() {
  const { q, scope, period, goBranch, setDrawer, grain } = useApp();
  const ds = getDS();
  const [status, setStatus] = useState('flagged');
  const [cat, setCat] = useState('');
  const [view, setView] = useState('positions');
  const qs = useMemo(() => makeQ(scope, TODAY, TODAY, 'USD'), [scope]);
  const t = inventoryTotals(qs);
  const rows = inventoryRows(qs);
  const filtered = rows.filter((r) => (status === 'flagged' ? r.status !== 'ok' : status === 'all' ? true : status === 'slow' ? r.slow : status === 'risk' ? r.risk : r.status === status) && (!cat || r.category === cat));
  const repl = rows.filter((r) => r.replenish > 0 && r.sold60 > 0).sort((a, b) => b.sold60 - a.sold60);
  const ser = stockSeries(q, grain);
  const disc = discrepancies(q, Math.min(30, period.d1 - period.d0 + 1 > 7 ? 30 : 30));
  const byCountry = ds.countries.map((c) => {
    const rs = rows.filter((r) => r.country === c.code); if (!rs.length) return null;
    return { name: c.name, code: c.code, out: rs.filter((r) => r.status === 'out').length, low: rs.filter((r) => r.status === 'low').length, positions: rs.length };
  }).filter(Boolean).map((c) => ({ ...c, rate: c.out / c.positions }));
  const slowN = rows.filter((r) => r.slow).length, riskN = rows.filter((r) => r.risk).length;
  const avail = t.positions ? (t.ok + t.low) / t.positions : null;
  const [tab, setTab] = useState('flagged');
  return (
    <>
      <FilterBar compareControl={false} />
      <div className="page">
        <div className="page-head"><div><h1>Inventory</h1><p>Branch × product stock positions at the latest simulated sync ({fmtDay(TODAY, { long: true })}); movement charts follow the selected period. Quantities are units, so no currency applies.</p></div><ScopeTags /></div>
        <div className="col" style={{ gap: 14 }}>
          <div className="grid g5">
            <Kpi label="Units on hand" value={num(t.units)} sub={`${num(t.positions)} branch × product positions`} />
            <Kpi label="Availability" value={pctf(avail)} sub="positions with stock above zero" />
            <Kpi label="Out of stock" value={num(t.out)} sub={pctf(t.positions ? t.out / t.positions : 0) + ' of positions'} tone="bad" onClick={() => { setStatus('out'); setView('positions'); }} />
            <Kpi label="Below reorder point" value={num(t.low)} sub="low-stock positions" onClick={() => { setStatus('low'); setView('positions'); }} />
            <Kpi label="Suggested replenishment" value={`${num(t.replenishUnits)} units`} sub="to restore order-up-to level" />
          </div>
          <div className="grid g-21">
            <Card title="Stock movement" subtitle={`Units sold vs units received per ${grain} (receipts from suppliers/transfers, sales from transactions)`}>
              <TrendChart data={ser} series={[{ key: 'received', name: 'Units received', kind: 'bar', color: '#5B97F0' }, { key: 'sold', name: 'Units sold', kind: 'bar', color: '#0F2A55' }]} fmt={(v) => num(v)} yFmt={(v) => num(v)} height={250} />
            </Card>
            <Card title="Stock-outs by country" subtitle="Share of branch × product positions at zero stock">
              <RankBars data={byCountry.sort((a, b) => b.rate - a.rate)} valueKey="rate" fmt={(v) => pctf(v, 1)} labelFmt={(v) => pctf(v, 1)} colorFn={(r) => (r.rate > 0.05 ? SEMANTIC.neg : '#1C4CAD')} onClick={(r) => { setStatus('out'); setView('positions'); }} nameWidth={80} />
              <div className="small muted mt-8">Counts of out positions: {byCountry.map((c) => `${c.name} ${c.out}`).join(' · ')}</div>
            </Card>
          </div>
          <Card title="Stock-out SKUs and on-hand units over time" subtitle="On-hand units (right) and number of out-of-stock SKU positions (left) at period end of each bucket">
            <TrendChart data={ser} series={[{ key: 'outSkus', name: 'Out-of-stock positions', kind: 'line', color: SEMANTIC.neg }, { key: 'onHand', name: 'Units on hand', kind: 'area', color: '#1C4CAD', yAxis: 'right' }]} fmt={(v) => num(v)} yFmt={(v) => num(v)} rightFmt={(v) => num(v)} height={230} />
          </Card>
          <Card flush title={view === 'positions' ? 'Stock positions' : view === 'repl' ? 'Replenishment recommendations' : view === 'disc' ? 'Stock adjustments and discrepancies' : 'Slow-moving stock'}
            subtitle={view === 'positions' ? `${num(filtered.length)} positions shown` : view === 'repl' ? 'Products below reorder point with recent sales, ranked by 60-day demand. Rule-based suggestion, not an order.' : view === 'disc' ? 'Negative stock adjustments recorded in the last 30 days of the period (potential shrinkage or count errors)' : 'Over-stocked positions with very low recent demand'}
            actions={<Seg options={[{ id: 'positions', label: 'Positions' }, { id: 'repl', label: 'Replenishment' }, { id: 'slow', label: 'Slow-moving' }, { id: 'disc', label: 'Discrepancies' }]} value={view} onChange={setView} />}>
            {view === 'positions' && (
              <DataTable csvName="inventory-positions" csvPreamble={['DEMO DATA — fictional records', 'Stock position as of ' + fmtDay(TODAY)]} search pageSize={14} defaultSort={{ key: 'stock', dir: 'asc' }} rowKey={(r) => r.key}
                extraTools={<div className="row wrap"><Seg small options={[{ id: 'flagged', label: 'Needs attention' }, { id: 'out', label: 'Out' }, { id: 'low', label: 'Low' }, { id: 'risk', label: '< 5 days cover' }, { id: 'all', label: 'All' }]} value={status} onChange={setStatus} />
                  <select className="select" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category"><option value="">All categories</option>{[...new Set(ds.catalog.map((p) => p.category))].map((c) => <option key={c}>{c}</option>)}</select></div>}
                searchText={(r) => `${r.product} ${r.branch} ${r.sku} ${r.city}`}
                columns={[
                  { key: 'branch', header: 'Branch', value: (r) => r.branch, render: (r) => <LinkBtn onClick={() => goBranch(r.branchId)}>{r.branch}</LinkBtn> },
                  { key: 'country', header: 'Country', value: (r) => r.country },
                  { key: 'product', header: 'Product', value: (r) => r.product, render: (r) => <div className="row" style={{ gap: 6 }}><Swatch hex={r.hex} /><LinkBtn onClick={() => setDrawer({ type: 'product', idx: r.p.idx })}>{r.product}</LinkBtn></div> },
                  { key: 'stock', header: 'On hand', align: 'r', value: (r) => r.stock }, { key: 'rp', header: 'Reorder at', align: 'r', value: (r) => r.reorderPoint },
                  { key: 'velocity', header: 'Units/day', align: 'r', value: (r) => r.velocity, render: (r) => r.velocity.toFixed(2) },
                  { key: 'cover', header: 'Days cover', align: 'r', value: (r) => r.cover ?? 9999, render: (r) => (r.cover == null ? '—' : r.cover.toFixed(1)), csv: (r) => (r.cover == null ? '' : r.cover.toFixed(1)) },
                  { key: 'status', header: 'Status', value: (r) => r.status, render: (r) => <Badge tone={stTone[r.status]}>{stLabel[r.status]}</Badge>, csv: (r) => stLabel[r.status] },
                ]} rows={filtered} />
            )}
            {view === 'repl' && (
              <DataTable csvName="replenishment-recommendations" search pageSize={14} defaultSort={{ key: 'sold60', dir: 'desc' }} rowKey={(r) => r.key} searchText={(r) => `${r.product} ${r.branch}`}
                columns={[
                  { key: 'branch', header: 'Branch', value: (r) => r.branch, render: (r) => <LinkBtn onClick={() => goBranch(r.branchId)}>{r.branch}</LinkBtn> },
                  { key: 'product', header: 'Product', value: (r) => r.product, render: (r) => <div className="row" style={{ gap: 6 }}><Swatch hex={r.hex} />{r.product}</div> },
                  { key: 'stock', header: 'On hand', align: 'r', value: (r) => r.stock }, { key: 'sold60', header: 'Sold (60d)', align: 'r', value: (r) => r.sold60 },
                  { key: 'replenish', header: 'Suggested units', align: 'r', value: (r) => r.replenish, render: (r) => <b>{num(r.replenish)}</b> },
                  { key: 'status', header: 'Status', value: (r) => r.status, render: (r) => <Badge tone={stTone[r.status]}>{stLabel[r.status]}</Badge>, csv: (r) => stLabel[r.status] },
                ]} rows={repl} emptyText="No replenishment suggestions" />
            )}
            {view === 'slow' && (
              <DataTable csvName="slow-moving-stock" search pageSize={14} defaultSort={{ key: 'stock', dir: 'desc' }} rowKey={(r) => r.key} searchText={(r) => `${r.product} ${r.branch}`}
                columns={[
                  { key: 'branch', header: 'Branch', value: (r) => r.branch, render: (r) => <LinkBtn onClick={() => goBranch(r.branchId)}>{r.branch}</LinkBtn> },
                  { key: 'product', header: 'Product', value: (r) => r.product, render: (r) => <div className="row" style={{ gap: 6 }}><Swatch hex={r.hex} />{r.product}</div> },
                  { key: 'stock', header: 'On hand', align: 'r', value: (r) => r.stock }, { key: 'sold60', header: 'Sold (60d)', align: 'r', value: (r) => r.sold60 },
                  { key: 'lastSale', header: 'Last sale', value: (r) => r.lastSale, render: (r) => (r.lastSale < 0 ? 'Not in 60 days' : fmtDay(r.lastSale)), csv: (r) => (r.lastSale < 0 ? '' : fmtDay(r.lastSale)) },
                ]} rows={rows.filter((r) => r.slow)} emptyText="No slow-moving positions" />
            )}
            {view === 'disc' && (
              <DataTable csvName="stock-discrepancies" pageSize={14} rowKey={(r) => r.key} defaultSort={{ key: 'day', dir: 'desc' }}
                columns={[
                  { key: 'day', header: 'Date', value: (r) => r.day, render: (r) => fmtDay(r.day), csv: (r) => fmtDay(r.day) },
                  { key: 'branch', header: 'Branch', value: (r) => r.branch, render: (r) => <LinkBtn onClick={() => goBranch(r.branchId)}>{r.branch}</LinkBtn> },
                  { key: 'product', header: 'Product', value: (r) => r.product },
                  { key: 'qty', header: 'Adjustment (units)', align: 'r', value: (r) => r.qty, render: (r) => <span style={{ color: 'var(--neg)', fontWeight: 600 }}>{num(r.qty)}</span> },
                ]} rows={disc} emptyText="No stock adjustments recorded in the selected scope" />
            )}
          </Card>
          <div className="small muted">Slow-moving positions: {num(slowN)} · positions with under 5 days of cover: {num(riskN)}. Cover is based on 14-day sales velocity.</div>
        </div>
      </div>
    </>
  );
}
