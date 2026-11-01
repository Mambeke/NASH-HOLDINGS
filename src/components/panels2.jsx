import React, { useMemo, useState } from 'react';
import { ArrowRight, Star, ShieldCheck, MessageSquare } from 'lucide-react';
import { useApp } from '../state/app.jsx';
import { getDS, inventoryRows, inventoryTotals, makeQ, reviewStats, series, customerStats } from '../lib/query.js';
import { money, num, pctf } from '../lib/format.js';
import { fmtDay, TODAY } from '../lib/dates.js';
import { Card, Badge, DataTable, LinkBtn, Swatch, Kpi, Seg, Empty } from './ui.jsx';
import { TrendChart, RankBars, StackedBars } from './charts.jsx';

export function StockPanel({ scope, limit = 8, title = 'Stock availability' }) {
  const { goBranch, goPaints, setDrawer } = useApp();
  const q = makeQ(scope, TODAY, TODAY, 'USD');
  const t = inventoryTotals(q), rows = inventoryRows(q);
  const flagged = rows.filter((r) => r.status !== 'ok').sort((a, b) => (a.status === 'out' ? 0 : 1) - (b.status === 'out' ? 0 : 1) || b.sold60 - a.sold60);
  const avail = t.positions ? (t.ok + t.low) / t.positions : null;
  return (
    <Card title={title} subtitle="Current stock position as of the latest sync (independent of the date filter)" flush actions={<button className="btn sm" onClick={() => goPaints('inventory')}>Inventory<ArrowRight size={13} /></button>}>
      <div className="grid g4" style={{ padding: '0 16px 12px' }}>
        <Kpi label="Units on hand" value={num(t.units)} />
        <Kpi label="Availability" value={pctf(avail)} sub="positions in stock" />
        <Kpi label="Out of stock" value={num(t.out)} sub="branch × product positions" tone="bad" />
        <Kpi label="Below reorder" value={num(t.low)} sub="low-stock positions" />
      </div>
      <DataTable columns={[
        { key: 'product', header: 'Product', render: (r) => <div className="row" style={{ gap: 6 }}><Swatch hex={r.hex} /><LinkBtn onClick={() => setDrawer({ type: 'product', idx: r.p.idx })}>{r.product}</LinkBtn></div>, value: (r) => r.product },
        { key: 'branch', header: 'Branch', render: (r) => <LinkBtn onClick={() => goBranch(r.branchId)}>{r.branch}</LinkBtn>, value: (r) => r.branch },
        { key: 'stock', header: 'Stock', align: 'r', value: (r) => r.stock },
        { key: 'rp', header: 'Reorder at', align: 'r', value: (r) => r.reorderPoint },
        { key: 'status', header: 'Status', value: (r) => r.status, render: (r) => <Badge tone={r.status === 'out' ? 'bad' : 'warn'}>{r.status === 'out' ? 'Out of stock' : 'Low stock'}</Badge> },
      ]} rows={flagged} rowKey={(r) => r.key} pageSize={limit} defaultSort={null} search emptyText="No low-stock or out-of-stock positions" />
    </Card>
  );
}

export function RatingDist({ stats }) {
  const total = stats.count || 1;
  return (
    <div className="col" style={{ gap: 6 }}>
      {[5, 4, 3, 2, 1].map((s) => (
        <div key={s} className="row small" style={{ gap: 8 }}><span style={{ width: 34 }} className="row"><b>{s}</b><Star size={11} fill="#E0A030" color="#E0A030" /></span>
          <div className="progress grow" style={{ height: 8 }}><i style={{ width: `${(stats.dist[s - 1] / total) * 100}%`, background: s >= 4 ? '#2FA37A' : s === 3 ? '#E0A030' : '#D5524A' }} /></div>
          <span className="tnum muted" style={{ width: 70, textAlign: 'right' }}>{num(stats.dist[s - 1])} · {pctf(stats.dist[s - 1] / total, 0)}</span></div>))}
    </div>
  );
}

export function ReviewSummary({ q, title = 'Customer reviews and complaints' }) {
  const { goPaints } = useApp();
  const st = reviewStats(q, 'week');
  const cats = [...st.cats].sort((a, b) => b.complaints - a.complaints);
  if (!st.count) return <Card title={title}><Empty title="No reviews in this selection" /></Card>;
  return (
    <Card title={title} subtitle="Submitted reviews; verified purchases are linked to a recorded transaction" actions={<button className="btn sm" onClick={() => goPaints('feedback')}>Customer experience<ArrowRight size={13} /></button>}>
      <div className="grid g2">
        <div>
          <div className="row" style={{ gap: 14, marginBottom: 10 }}>
            <div><div style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-.02em' }}>{st.avg.toFixed(2)}</div><div className="xs muted">average rating</div></div>
            <div className="small muted">{num(st.count)} reviews · {pctf(st.verifiedShare, 0)} from verified purchases · {num(st.complaints)} complaints (rating ≤ 2)</div>
          </div>
          <RatingDist stats={st} />
        </div>
        <div><div className="small muted" style={{ marginBottom: 4 }}>Complaints by category (rating ≤ 2)</div>
          <RankBars data={cats.map((c) => ({ name: c.name, value: c.complaints }))} fmt={(v) => num(v)} height={cats.length * 28 + 8} barSize={13} nameWidth={118} color="#6B7F9E" /></div>
      </div>
    </Card>
  );
}

export function NewCustomerTrend({ q, grain }) {
  const s = series(q, grain || (q.d1 - q.d0 > 62 ? 'week' : 'day'));
  const data = s.map((b) => ({ label: b.label, 'New customers': b.newCust }));
  return (
    <Card title="Customer acquisition" subtitle="First-ever recorded purchases per period (identified customers only)">
      <TrendChart data={data} series={[{ key: 'New customers', name: 'New customers', kind: 'bar', color: '#2459C6' }]} fmt={(v) => num(v)} yFmt={(v) => num(v)} height={200} />
    </Card>
  );
}

export function CommentList({ list, limit = 8, onBranch }) {
  const ds = getDS();
  const { goBranch } = useApp();
  const recent = [...list].sort((a, b) => b.day - a.day || b.minute - a.minute).slice(0, limit);
  if (!recent.length) return <Empty title="No reviews for this selection" />;
  return (
    <div className="col" style={{ gap: 0 }}>
      {recent.map((r) => (
        <div key={r.id} style={{ padding: '10px 0', borderTop: '1px solid var(--line-2)' }}>
          <div className="row-sb"><span className="row" style={{ gap: 8 }}><b style={{ color: r.rating >= 4 ? 'var(--pos)' : r.rating === 3 ? 'var(--warn)' : 'var(--neg)' }}>{'★'.repeat(r.rating)}<span style={{ color: '#D5DCE8' }}>{'★'.repeat(5 - r.rating)}</span></b><Badge>{r.cat}</Badge></span>
            <span className="xs muted">{fmtDay(r.day)}</span></div>
          <div style={{ margin: '4px 0' }}>“{r.text}”</div>
          <div className="row small muted" style={{ gap: 8 }}>
            {r.verified ? <Badge tone="good"><ShieldCheck size={11} />Verified purchase</Badge> : <Badge tone="neutral" title="Review submitted without a linked transaction">Unverified submission</Badge>}
            <LinkBtn onClick={() => goBranch(ds.branches[r.br].id)}>{ds.branches[r.br].name}</LinkBtn><span>· {ds.branches[r.br].country}</span>
          </div>
        </div>))}
    </div>
  );
}
