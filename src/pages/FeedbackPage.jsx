import React, { useMemo, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useApp } from '../state/app.jsx';
import { FilterBar, ScopeTags } from '../components/Layout.jsx';
import { Card, Kpi, DataTable, Badge, Notice, LinkBtn, Seg } from '../components/ui.jsx';
import { TrendChart, RankBars, SEMANTIC } from '../components/charts.jsx';
import { RatingDist } from '../components/panels2.jsx';
import { getDS, reviewStats, pct } from '../lib/query.js';
import { buildAlerts } from '../lib/alerts.js';
import { num, pctf, stars } from '../lib/format.js';
import { fmtDay } from '../lib/dates.js';

function sub(list, pred) {
  const l = list.filter(pred); const n = l.length;
  const avg = n ? l.reduce((a, r) => a + r.rating, 0) / n : null, comp = l.filter((r) => r.rating <= 2).length;
  return { n, avg, comp, compRate: n ? comp / n : null };
}

export default function FeedbackPage() {
  const { q, pq, period, scope, grain, goBranch, goCountry, setDrawer } = useApp();
  const ds = getDS();
  const [ver, setVer] = useState('all');
  const [cat, setCat] = useState('');
  const [rate, setRate] = useState('');
  const st = reviewStats(q, grain === 'day' && period.days > 14 ? 'week' : grain), pst = pq ? reviewStats(pq) : null;
  const vS = sub(st.list, (r) => r.verified), uS = sub(st.list, (r) => !r.verified);
  const list = useMemo(() => st.list.filter((r) => (ver === 'all' || (ver === 'verified') === r.verified) && (!cat || r.cat === cat) && (!rate || (rate === 'low' ? r.rating <= 2 : rate === 'mid' ? r.rating === 3 : r.rating >= 4))), [st, ver, cat, rate]);
  const branches = st.branches.filter((b) => b.count >= 4);
  const low = [...branches].sort((a, b) => a.avg - b.avg).slice(0, 8), high = [...branches].sort((a, b) => b.avg - a.avg).slice(0, 8);
  const cats = [...st.cats].filter((c) => c.reviews).sort((a, b) => b.complaints - a.complaints);
  const ratingAlerts = buildAlerts().filter((a) => a.type === 'rating' && (!scope.country || a.country === scope.country) && (!scope.branch || a.branchId === scope.branch));
  const trend = st.trend.map((t) => ({ label: t.label, 'Average rating': +t.avg.toFixed(2), Reviews: t.count }));
  return (
    <>
      <FilterBar />
      <div className="page">
        <div className="page-head"><div><h1>Customer Feedback</h1><p>{period.label} · fictional reviews · ratings out of 5 · complaints are reviews rated 1–2 stars</p></div><ScopeTags /></div>
        <div className="col" style={{ gap: 14 }}>
          <Notice tone="info"><b>Verified vs unverified.</b> A <b>verified purchase</b> review is linked to a recorded sales transaction at the branch. An <b>unverified submission</b> was left without a matching transaction (for example, a web or social submission) and is reported separately because it cannot be tied to a sale. Both are included in the headline average unless you filter.</Notice>
          {!st.count ? <Card title="No reviews"><div className="muted small">No reviews were submitted for this selection and period.</div></Card> : (<>
          <div className="grid g4">
            <Kpi label="Average rating" value={stars(st.avg)} sub={`${num(st.count)} reviews`} delta={pst && pst.avg ? pct(st.avg, pst.avg) : undefined} compareLabel={period.prev?.label} />
            <Kpi label="Verified-purchase rating" value={stars(vS.avg)} sub={`${num(vS.n)} verified reviews (${pctf(st.verifiedShare, 0)})`} />
            <Kpi label="Unverified rating" value={stars(uS.avg)} sub={`${num(uS.n)} unverified submissions`} />
            <Kpi label="Complaints (1–2 stars)" value={num(st.complaints)} sub={`${pctf(st.count ? st.complaints / st.count : null)} of reviews`} goodWhen="down" delta={pst && pst.complaints ? pct(st.complaints, pst.complaints) : undefined} compareLabel={period.prev?.label} />
          </div>
          <div className="grid g-21">
            <Card title="Average rating over time" subtitle="Each point is the average of reviews received in that bucket"><TrendChart data={trend} series={[{ key: 'Reviews', name: 'Reviews received', kind: 'bar', color: '#C6D3E8', yAxis: 'right' }, { key: 'Average rating', name: 'Average rating', kind: 'line', color: '#1C4CAD' }]} fmt={(v) => (v % 1 ? v.toFixed(2) : num(v))} yFmt={(v) => v.toFixed(1)} rightFmt={(v) => num(v)} height={250} /></Card>
            <Card title="Rating distribution"><RatingDist stats={st} /></Card>
          </div>
          <div className="grid g2">
            <Card title="Complaint themes" subtitle="Reviews rated 1–2 stars by topic"><RankBars data={cats.map((c) => ({ name: c.name, value: c.complaints }))} fmt={(v) => num(v)} labelFmt={(v) => num(v)} nameWidth={140} colorFn={() => '#6B7F9E'} onClick={(r) => setCat(r.name)} /><div className="xs muted">Click a theme to filter the review list below.</div></Card>
            <Card title="Verified versus unverified" flush>
              <DataTable columns={[
                { key: 'k', header: 'Type', value: (r) => r.k }, { key: 'n', header: 'Reviews', align: 'r', value: (r) => r.n, render: (r) => num(r.n) },
                { key: 'avg', header: 'Avg rating', align: 'r', value: (r) => r.avg, render: (r) => stars(r.avg) }, { key: 'comp', header: 'Complaints', align: 'r', value: (r) => r.comp, render: (r) => `${num(r.comp)} (${pctf(r.compRate, 0)})` },
              ]} rows={[{ k: 'Verified purchase', ...vS }, { k: 'Unverified submission', ...uS }]} rowKey={(r) => r.k} />
              {!scope.country && !scope.branch && <div style={{ padding: '0 16px 14px' }}><div className="small muted" style={{ margin: '8px 0 6px' }}>Rating by country</div>
                <RankBars data={st.countries.map((c) => ({ ...c, name: c.name }))} valueKey="avg" fmt={(v) => v.toFixed(2)} labelFmt={(v) => v.toFixed(2)} nameWidth={80} onClick={(r) => goCountry(r.code)} barSize={12} /></div>}
            </Card>
          </div>
          {!scope.branch && <div className="grid g2">
            <Card title="Lowest-rated branches" subtitle="Branches with at least 4 reviews in the period" flush><DataTable columns={[
              { key: 'name', header: 'Branch', value: (r) => r.name, render: (r) => <LinkBtn onClick={() => goBranch(r.id)}>{r.name}</LinkBtn> }, { key: 'avg', header: 'Avg', align: 'r', value: (r) => r.avg, render: (r) => <b style={{ color: r.avg < 3.5 ? 'var(--neg)' : undefined }}>{stars(r.avg)}</b> },
              { key: 'count', header: 'Reviews', align: 'r', value: (r) => r.count }, { key: 'complaintRate', header: 'Complaints', align: 'r', value: (r) => r.complaintRate, render: (r) => pctf(r.complaintRate, 0) }]} rows={low} rowKey={(r) => r.id} /></Card>
            <Card title="Highest-rated branches" subtitle="Branches with at least 4 reviews in the period" flush><DataTable columns={[
              { key: 'name', header: 'Branch', value: (r) => r.name, render: (r) => <LinkBtn onClick={() => goBranch(r.id)}>{r.name}</LinkBtn> }, { key: 'avg', header: 'Avg', align: 'r', value: (r) => r.avg, render: (r) => <b>{stars(r.avg)}</b> },
              { key: 'count', header: 'Reviews', align: 'r', value: (r) => r.count }, { key: 'complaintRate', header: 'Complaints', align: 'r', value: (r) => r.complaintRate, render: (r) => pctf(r.complaintRate, 0) }]} rows={high} rowKey={(r) => r.id} /></Card>
          </div>}
          </>)}
          {ratingAlerts.length > 0 && <Card title="Rating alerts" subtitle="Branches whose recent average fell materially">{ratingAlerts.map((a) => <button key={a.id} className="alert-row" onClick={() => setDrawer({ type: 'alert', id: a.id })}><span className={`sev-bar ${a.severity}`} /><div className="grow"><b style={{ fontSize: 13 }}>{a.title}</b><div className="small muted">{a.what}</div></div></button>)}</Card>}
          {st.count > 0 && <Card title="Reviews" subtitle={`${num(list.length)} of ${num(st.count)} reviews match the filters`} flush>
            <DataTable csvName="customer-reviews" csvPreamble={['DEMO DATA — fictional reviews']} pageSize={10} search searchText={(r) => `${r.text} ${r.cat} ${ds.branches[r.br].name}`} defaultSort={{ key: 'day', dir: 'desc' }} rowKey={(r) => r.id}
              extraTools={<div className="row wrap"><Seg small options={[{ id: 'all', label: 'All' }, { id: 'verified', label: 'Verified' }, { id: 'unverified', label: 'Unverified' }]} value={ver} onChange={setVer} />
                <select className="select" value={rate} onChange={(e) => setRate(e.target.value)} aria-label="Rating filter"><option value="">All ratings</option><option value="low">1–2 stars</option><option value="mid">3 stars</option><option value="high">4–5 stars</option></select>
                <select className="select" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Theme filter"><option value="">All themes</option>{ds.reviewCats.map((c) => <option key={c}>{c}</option>)}</select>
                {(cat || rate || ver !== 'all') && <button className="btn sm" onClick={() => { setCat(''); setRate(''); setVer('all'); }}>Clear</button>}</div>}
              columns={[
                { key: 'day', header: 'Date', value: (r) => r.day * 2000 + r.minute, render: (r) => fmtDay(r.day), csv: (r) => fmtDay(r.day) },
                { key: 'br', header: 'Branch', value: (r) => ds.branches[r.br].name, render: (r) => <LinkBtn onClick={() => goBranch(ds.branches[r.br].id)}>{ds.branches[r.br].name}</LinkBtn> },
                { key: 'rating', header: 'Rating', value: (r) => r.rating, render: (r) => <b style={{ color: r.rating >= 4 ? 'var(--pos)' : r.rating === 3 ? 'var(--warn)' : 'var(--neg)' }}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</b>, csv: (r) => r.rating },
                { key: 'cat', header: 'Theme', value: (r) => r.cat }, { key: 'text', header: 'Comment', value: (r) => r.text, render: (r) => <span style={{ whiteSpace: 'normal' }}>{r.text}</span> },
                { key: 'verified', header: 'Purchase', value: (r) => (r.verified ? 1 : 0), render: (r) => (r.verified ? <button className="badge good" style={{ cursor: 'pointer', border: 0 }} onClick={(e) => { e.stopPropagation(); setDrawer({ type: 'tx', i: r.tx }); }} title="Open the linked transaction"><ShieldCheck size={11} />Verified — view sale</button> : <Badge>Unverified</Badge>), csv: (r) => (r.verified ? 'Verified' : 'Unverified') },
              ]} rows={list} />
          </Card>}
        </div>
      </div>
    </>
  );
}
