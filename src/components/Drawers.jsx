import React, { useMemo, useState } from 'react';
import { X, ArrowLeft, ExternalLink, CheckCircle2, Circle, MapPin, Store, Paintbrush, StickyNote, Info } from 'lucide-react';
import { useApp } from '../state/app.jsx';
import { getDS, txRow, customerProfile, productTrend, productByBranch, stockForSkus, lineAgg, makeQ, withRange, series, expenseByCategorySeries, reviewStats, inventoryRows, custLabel } from '../lib/query.js';
import { buildAlerts, ALERT_TYPES } from '../lib/alerts.js';
import { money, num, pctf, signedPct, compact } from '../lib/format.js';
import { fmtDay, TODAY, grainFor, fmtTime } from '../lib/dates.js';
import { Card, Badge, SeverityBadge, Swatch, DataTable, Delta, LinkBtn, Kpi } from './ui.jsx';
import { TrendChart, RankBars } from './charts.jsx';

function Shell({ title, subtitle, onClose, back, children, badges }) {
  React.useEffect(() => { const h = (e) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [onClose]);
  return (
    <>
      <div className="overlay" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={title}>
        <div className="drawer-h">
          <div style={{ minWidth: 0 }}>
            {back && <button className="link small" onClick={back} style={{ marginBottom: 4, display: 'inline-flex', gap: 4, alignItems: 'center' }}><ArrowLeft size={13} />Back</button>}
            <div className="row wrap" style={{ gap: 8 }}><h3 style={{ fontSize: 17 }}>{title}</h3>{badges}</div>
            {subtitle && <div className="muted small" style={{ marginTop: 2 }}>{subtitle}</div>}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close panel"><X size={16} /></button>
        </div>
        <div className="drawer-b">{children}</div>
      </aside>
    </>
  );
}

function TxInspector({ i, close, back }) {
  const { goBranch, setDrawer } = useApp();
  const t = txRow(i, false);
  const d = { type: 'tx', i };
  const lineCols = [
    { key: 'name', header: 'Product', render: (l) => <div className="row" style={{ gap: 7 }}><Swatch hex={l.hex} /><LinkBtn onClick={() => setDrawer({ type: 'product', idx: l.p.idx, from: d })}>{l.name}</LinkBtn></div>, value: (l) => l.name },
    { key: 'size', header: 'Size', value: (l) => l.size }, { key: 'qty', header: 'Qty', align: 'r', value: (l) => l.qty },
    { key: 'unit', header: `Unit (${t.currency})`, align: 'r', value: (l) => l.unitLoc, render: (l) => money(l.unitLoc, t.currency, { decimals: 2 }) },
    { key: 'amt', header: `Amount (${t.currency})`, align: 'r', value: (l) => l.loc, render: (l) => money(l.loc, t.currency, { decimals: 2 }) },
  ];
  return (
    <Shell title={t.ref} subtitle={`${fmtDay(t.day, { long: true })} · ${t.time}`} onClose={close} back={back} badges={<Badge tone={t.cls === 'New' ? 'blue' : t.cls === 'Returning' ? 'good' : 'neutral'}>{t.cls} customer</Badge>}>
      <div className="kv">
        <div><span>Branch</span><b><LinkBtn onClick={() => { close(); goBranch(t.branchId); }}>{t.branch}</LinkBtn></b></div>
        <div><span>Payment method</span><b>{t.pay}</b></div>
        <div><span>Customer</span><b>{t.custId >= 0 ? <LinkBtn onClick={() => setDrawer({ type: 'customer', c: t.custId, from: d })}>{t.customer}</LinkBtn> : t.customer}</b></div>
        <div><span>Segment · loyalty card</span><b>{t.segment}{t.loyalty ? ` · ${t.loyalty}` : t.custId >= 0 ? ' · no card presented' : ''}</b></div>
      </div>
      <div className="box">
        <h4>Currency fields (kept separate)</h4>
        <div className="kv">
          <div><span>Original transaction currency</span><b>{t.currency}</b></div>
          <div><span>Original amount</span><b>{money(t.amountLoc, t.currency, { full: true, decimals: 2 })}</b></div>
          <div><span>Reporting currency · rate used</span><b>USD · 1 USD = {t.rate.toFixed(t.currency === 'MWK' || t.currency === 'KES' ? 2 : 4)} {t.currency}</b></div>
          <div><span>Converted reporting amount</span><b>{money(t.amountUsd, 'USD', { full: true, decimals: 2 })}</b></div>
        </div>
        <div className="xs muted mt-8">Fictional monthly exchange rates for the prototype.</div>
      </div>
      <DataTable columns={lineCols} rows={t.lines} rowKey={(l) => l.sku} dense />
      <div className="kv"><div><span>Units</span><b>{t.units}</b></div><div><span>Cost of goods (USD) · gross margin</span><b>{money(t.cogsUsd, 'USD', { decimals: 2 })} · {pctf((t.amountUsd - t.cogsUsd) / t.amountUsd)}</b></div></div>
      <div className="notice"><Info size={16} /><div>Customer classification is evaluated from purchase history before this transaction: <b>{t.cls}</b>{t.cls === 'New' ? ' (first recorded purchase)' : t.cls === 'Returning' ? ' (at least one earlier qualifying purchase)' : ' (cannot be confidently identified — not counted as new)'}. All records are fictional.</div></div>
    </Shell>
  );
}

function CustomerInspector({ c, close, back }) {
  const { setDrawer, goBranch } = useApp();
  const p = useMemo(() => customerProfile(c), [c]);
  const rows = p.txs.slice(-60).reverse().map((i) => txRow(i, false));
  return (
    <Shell title={p.id} subtitle={`${p.segment} · home branch ${p.branch.name}`} onClose={close} back={back} badges={p.loyalty ? <Badge tone="blue">{p.loyalty}</Badge> : <Badge>No loyalty card</Badge>}>
      <div className="grid g3">
        <Kpi label="Recorded visits" value={num(p.visits)} /><Kpi label="Lifetime spend (USD)" value={money(p.spendUsd, 'USD')} /><Kpi label="Avg spend / visit" value={money(p.visits ? p.spendUsd / p.visits : 0, 'USD')} />
      </div>
      <div className="kv"><div><span>First purchase in dataset</span><b>{p.firstDay != null ? fmtDay(p.firstDay) : '—'}{p.legacy ? ' (earlier history exists before 2025)' : ''}</b></div><div><span>Most recent purchase</span><b>{p.lastDay != null ? fmtDay(p.lastDay) : '—'}</b></div></div>
      <div className="notice"><Info size={16} /><div>Fictional customer ID — no personal data. This customer is classified as <b>{p.legacy ? 'returning in every period' : 'new only in the period containing their first purchase'}</b>.</div></div>
      <DataTable csvName={`customer-${p.id}`} columns={[
        { key: 'ref', header: 'Transaction', render: (r) => <LinkBtn onClick={() => setDrawer({ type: 'tx', i: r.i, from: { type: 'customer', c } })}>{r.ref}</LinkBtn>, value: (r) => r.ref },
        { key: 'date', header: 'Date', value: (r) => `${r.date} ${r.time}` }, { key: 'product', header: 'Items', value: (r) => r.product },
        { key: 'amount', header: 'Amount (USD)', align: 'r', value: (r) => r.amountUsd, render: (r) => money(r.amountUsd, 'USD', { decimals: 2 }) },
      ]} rows={rows} rowKey={(r) => r.i} defaultSort={{ key: 'date', dir: 'desc' }} pageSize={10} />
    </Shell>
  );
}

function ProductDetail({ skus, title, subtitle, hex, close, back, code, meta }) {
  const { q, period, cur, goBranch, goCountry, goPaints, grain } = useApp();
  const ds = getDS();
  const m = (v) => money(v, cur.code);
  const g = grain === 'day' && period.days < 3 ? 'day' : grain;
  const tr = productTrend(q, skus, g);
  const byBranch = productByBranch(q, skus);
  const stock = stockForSkus(skus, q.br);
  const agg = lineAgg(q);
  const tot = byBranch.reduce((a, r) => ({ qty: a.qty + r.qty, rev: a.rev + r.rev, cogs: a.cogs + r.cogs }), { qty: 0, rev: 0, cogs: 0 });
  const byCountry = ds.countries.map((c) => { const rows = byBranch.filter((r) => r.country === c.code); return { code: c.code, name: c.name, qty: rows.reduce((a, r) => a + r.qty, 0), rev: rows.reduce((a, r) => a + r.rev, 0), currency: c.currency }; }).filter((c) => c.qty > 0).sort((a, b) => b.rev - a.rev);
  const stockCounts = { out: stock.filter((s) => s.status === 'out').length, low: stock.filter((s) => s.status === 'low').length, ok: stock.filter((s) => s.status === 'ok').length };
  const units = stock.reduce((a, s) => a + s.stock, 0);
  return (
    <Shell title={<span className="row">{hex && <Swatch hex={hex} size={18} />}{title}</span>} subtitle={subtitle} onClose={close} back={back} badges={code && <Badge>{code}</Badge>}>
      {meta}
      <div className="grid g4">
        <Kpi label="Revenue" cur={cur} value={m(tot.rev)} sub={`${pctf(agg.totRev ? tot.rev / agg.totRev : 0)} of selected-scope revenue`} />
        <Kpi label="Units sold" value={num(tot.qty)} />
        <Kpi label="Gross margin" value={pctf(tot.rev ? (tot.rev - tot.cogs) / tot.rev : null)} sub={tot.rev ? `${m(tot.rev - tot.cogs)} gross profit` : ''} />
        <Kpi label="Stock position" value={num(units)} sub={`${stockCounts.out} out · ${stockCounts.low} low · ${stockCounts.ok} ok`} />
      </div>
      <Card title="Sales trend" cur={cur} subtitle={`Selected period, ${g === 'day' ? 'daily' : g === 'week' ? 'weekly' : 'monthly'}`}>
        {tr.length ? <TrendChart data={tr} series={[{ key: 'rev', name: `Revenue (${cur.code})`, kind: 'area', color: '#1C4CAD' }, { key: 'qty', name: 'Units', kind: 'line', color: '#E0A030', yAxis: 'right' }]} fmt={(v, p) => (p.dataKey === 'qty' ? num(v) : m(v))} height={220} rightFmt={(v) => num(v)} /> : <div className="muted small">No sales in this period.</div>}
      </Card>
      <Card title="Geographic performance" cur={cur} subtitle="Revenue by country in the current location filter. Click a country to open it." >
        {byCountry.length ? <RankBars data={byCountry.map((c) => ({ ...c, value: c.rev }))} fmt={(v) => m(v)} onClick={(d) => { close(); goCountry(d.code); }} barSize={16} nameWidth={84} /> : <div className="muted small">No sales for this selection.</div>}
      </Card>
      <Card title="Top branches" cur={cur} flush>
        <DataTable columns={[
          { key: 'name', header: 'Branch', render: (r) => <LinkBtn onClick={() => { close(); goBranch(r.id); }}>{r.name}</LinkBtn>, value: (r) => r.name }, { key: 'country', header: 'Country', value: (r) => r.country },
          { key: 'qty', header: 'Units', align: 'r', value: (r) => r.qty, render: (r) => num(r.qty) }, { key: 'rev', header: 'Revenue', align: 'r', value: (r) => r.rev, render: (r) => m(r.rev) }, { key: 'margin', header: 'Margin', align: 'r', value: (r) => r.margin, render: (r) => pctf(r.margin, 0) },
        ]} rows={byBranch} rowKey={(r) => r.id} defaultSort={{ key: 'rev', dir: 'desc' }} pageSize={8} csvName="product-by-branch" />
      </Card>
    </Shell>
  );
}

function ProductInspector({ idx, close, back }) {
  const ds = getDS(); const p = ds.catalog[idx];
  return <ProductDetail skus={[idx]} title={p.name} subtitle={`${p.category} · ${p.sku} · ${p.id}`} hex={p.hex} code={p.colourCode !== '—' ? p.colourCode : null} close={close} back={back}
    meta={<div className="box"><div className="kv"><div><span>List price (USD)</span><b>{money(p.price, 'USD', { decimals: 2 })}</b></div><div><span>Unit cost (USD)</span><b>{money(p.cost, 'USD', { decimals: 2 })} · {pctf((p.price - p.cost) / p.price)} margin</b></div><div><span>Container size</span><b>{p.size}</b></div><div><span>Catalog reorder threshold (reference branch)</span><b>{p.reorderThreshold} units</b></div></div></div>} />;
}
function ColourInspector({ name, close, back }) {
  const ds = getDS(); const skus = ds.catalog.filter((p) => p.colour === name).map((p) => p.idx); const p = ds.catalog[skus[0]];
  return <ProductDetail skus={skus} title={name} subtitle={`Colour ${p.colourCode} · ${skus.length} SKUs across ${[...new Set(skus.map((s) => ds.catalog[s].range))].length} ranges`} hex={p.hex} code={p.colourCode} close={close} back={back} />;
}

function Evidence({ a, close }) {
  const { goBranch, goCountry, setDrawer, goPaints } = useApp();
  const ds = getDS(); const ev = a.evidence; const T = TODAY;
  if (ev.kind === 'branch') {
    const b = ds.branches[ev.branch], q = makeQ({ branch: b.id }, T - 27, T, 'USD'), s = series(q, 'day');
    const sp = s.map((x, i) => ({ ...x, prev: i >= 7 ? s[i - 7].rev : null }));
    return (<>
      <Card title="Supporting data: daily revenue and transactions, last 28 days" cur="USD"><TrendChart data={sp} series={[{ key: 'rev', name: 'Revenue', kind: 'bar', color: '#5B97F0' }, { key: 'prev', name: 'Same weekday, 1 week earlier', kind: 'line', color: '#9AA8BD', dashed: true }, { key: 'txns', name: 'Transactions', kind: 'line', color: '#0F2A55', yAxis: 'right' }]} fmt={(v, p) => (p.dataKey === 'txns' ? num(v) : money(v, 'USD'))} rightFmt={(v) => num(v)} height={230} /></Card>
      <div className="row wrap"><button className="btn primary" onClick={() => { close(); goBranch(b.id); }}><Store size={14} />Open {b.name}</button><button className="btn" onClick={() => { close(); goCountry(b.country); }}><MapPin size={14} />Open {ds.countryByCode.get(b.country).name}</button></div>
    </>);
  }
  if (ev.kind === 'stockout') {
    const rows = inventoryRows(makeQ({ country: ev.country }, T, T, 'USD')).filter((r) => ev.rows.includes(r.key));
    return (<>
      <Card title={`Affected positions (${rows.length})`} flush><DataTable csvName="stockout-positions" columns={[
        { key: 'branch', header: 'Branch', render: (r) => <LinkBtn onClick={() => { close(); goBranch(r.branchId); }}>{r.branch}</LinkBtn>, value: (r) => r.branch },
        { key: 'product', header: 'Product', render: (r) => <div className="row" style={{ gap: 6 }}><Swatch hex={r.hex} /><LinkBtn onClick={() => setDrawer({ type: 'product', idx: r.p.idx, from: { type: 'alert', id: a.id } })}>{r.product}</LinkBtn></div>, value: (r) => r.product },
        { key: 'sold60', header: 'Sold prev. 60d', align: 'r', value: (r) => r.sold60, render: (r) => num(r.sold60) }, { key: 'stock', header: 'Stock', align: 'r', value: (r) => r.stock },
      ]} rows={rows} rowKey={(r) => r.key} defaultSort={{ key: 'sold60', dir: 'desc' }} pageSize={8} search /></Card>
      <div className="row wrap"><button className="btn primary" onClick={() => { close(); goCountry(ev.country); }}><MapPin size={14} />Open {ds.countryByCode.get(ev.country).name}</button><button className="btn" onClick={() => { close(); goPaints('inventory'); }}>Open inventory dashboard</button></div>
    </>);
  }
  if (ev.kind === 'branchStock') {
    const b = ds.branches[ev.branch];
    return (<>
      <Card title="Out-of-stock top sellers"><div className="col">{ev.skus.map((s) => <div key={s} className="row-sb"><span className="row"><Swatch hex={ds.catalog[s].hex} /><LinkBtn onClick={() => setDrawer({ type: 'product', idx: s, from: { type: 'alert', id: a.id } })}>{ds.catalog[s].name}</LinkBtn></span><Badge tone="bad">Stock 0</Badge></div>)}</div></Card>
      <div className="row wrap"><button className="btn primary" onClick={() => { close(); goBranch(b.id); }}><Store size={14} />Open {b.name}</button></div>
    </>);
  }
  if (ev.kind === 'expense') {
    const q = makeQ({ country: ev.country }, T - 83, T, 'USD'), data = expenseByCategorySeries(q, 'week');
    const cat = ds.expCats[ev.cat].name;
    return (<>
      <Card title={`Supporting data: weekly ${cat} expense, last 12 weeks`} cur="USD"><TrendChart data={data} series={[{ key: cat, name: cat, kind: 'bar', color: '#1C4CAD' }]} fmt={(v) => money(v, 'USD')} height={220} /></Card>
      <div className="row wrap"><button className="btn primary" onClick={() => { close(); goCountry(ev.country); }}><MapPin size={14} />Open {ds.countryByCode.get(ev.country).name}</button><button className="btn" onClick={() => { close(); goPaints('finance'); }}>Open finance & profitability</button></div>
    </>);
  }
  if (ev.kind === 'demand') {
    const q = makeQ({ country: ev.country }, T - 55, T, 'USD'), tr = productTrend(q, [ev.product], 'week');
    return (<>
      <Card title="Supporting data: weekly units sold, last 8 weeks"><TrendChart data={tr} series={[{ key: 'qty', name: 'Units', kind: 'bar', color: '#2459C6' }]} fmt={(v) => num(v)} yFmt={(v) => num(v)} height={220} /></Card>
      <div className="row wrap"><button className="btn primary" onClick={() => setDrawer({ type: 'product', idx: ev.product, from: { type: 'alert', id: a.id } })}><Paintbrush size={14} />Inspect product</button><button className="btn" onClick={() => { close(); goCountry(ev.country); }}>Open {ds.countryByCode.get(ev.country).name}</button></div>
    </>);
  }
  if (ev.kind === 'country') {
    const data = ev.weeks.slice().reverse().map((v, i) => ({ label: `Wk ${fmtDay(ev.lastSun - 7 * (5 - i) - 6, { noYear: true })}`, rev: v }));
    return (<>
      <Card title="Supporting data: weekly revenue, last 6 full weeks" cur="USD"><TrendChart data={data} series={[{ key: 'rev', name: 'Revenue', kind: 'bar', color: '#1C4CAD' }]} fmt={(v) => money(v, 'USD')} height={220} /></Card>
      <div className="row wrap"><button className="btn primary" onClick={() => { close(); goCountry(ev.country); }}><MapPin size={14} />Open {ds.countryByCode.get(ev.country).name} dashboard</button></div>
    </>);
  }
  if (ev.kind === 'rating') {
    const b = ds.branches[ev.branch], q = makeQ({ branch: b.id }, T - 111, T, 'USD'), rs = reviewStats(q, 'week'), recent = rs.list.filter((r) => r.rating <= 3).slice(-5).reverse();
    return (<>
      <Card title="Supporting data: weekly average rating"><TrendChart data={rs.trend} series={[{ key: 'avg', name: 'Average rating', kind: 'line', color: '#1C4CAD', width: 2.4 }]} fmt={(v) => v.toFixed(2)} yFmt={(v) => v.toFixed(1)} height={200} /></Card>
      <Card title="Recent low-rating comments"><div className="col">{recent.map((r) => <div key={r.id} className="box small"><div className="row-sb"><b>{r.rating}★ · {r.cat}</b><Badge tone={r.verified ? 'good' : 'neutral'}>{r.verified ? 'Verified purchase' : 'Unverified submission'}</Badge></div><div className="muted">“{r.text}” — {fmtDay(r.day)}</div></div>)}</div></Card>
      <div className="row wrap"><button className="btn primary" onClick={() => { close(); goBranch(b.id); }}><Store size={14} />Open {b.name}</button></div>
    </>);
  }
  if (ev.kind === 'discrepancy') {
    const b = ds.branches[ev.branch];
    return (<>
      <Card title="Adjustments posted (last 30 days)" flush><DataTable columns={[{ key: 'day', header: 'Date', value: (r) => r.day, render: (r) => fmtDay(r.day) }, { key: 'product', header: 'Product', value: (r) => r.product }, { key: 'qty', header: 'Units', align: 'r', value: (r) => r.qty }]} rows={ev.rows} rowKey={(r) => r.key} dense /></Card>
      <div className="row wrap"><button className="btn primary" onClick={() => { close(); goBranch(b.id); }}><Store size={14} />Open {b.name}</button></div>
    </>);
  }
  return null;
}

function AlertInspector({ id, close, back }) {
  const { alertState, ackAlert, addNote, setToast } = useApp();
  const a = buildAlerts().find((x) => x.id === id);
  const [note, setNote] = useState('');
  if (!a) return <Shell title="Alert not found" onClose={close}><div className="muted">This alert is no longer triggered.</div></Shell>;
  const st = alertState[a.id] || {};
  return (
    <Shell title={a.title} subtitle={`${ALERT_TYPES[a.type]} · evaluated as of ${fmtDay(a.refDay, { long: true })} (latest sync)`} onClose={close} back={back} badges={<><SeverityBadge severity={a.severity} />{st.ack && <Badge tone="good">Acknowledged</Badge>}</>}>
      <div className="box"><h4>What happened</h4><div>{a.what}</div></div>
      <div className="box"><h4>Relevant figures & comparison</h4>
        <table className="tbl dense"><tbody>{a.figures.map((f, i) => <tr key={i}><td className="muted">{f.label}</td><td className="r"><b>{f.value}</b>{f.compare && <div className="xs muted">{f.compare}</div>}</td></tr>)}</tbody></table></div>
      <div className="grid g2"><div className="box"><h4>Why it may matter</h4><div className="small">{a.why}</div></div><div className="box"><h4>Recommended next action</h4><div className="small">{a.action}</div></div></div>
      <Evidence a={a} close={close} />
      <div className="box">
        <h4>Acknowledgement & follow-up</h4>
        <div className="row wrap" style={{ marginBottom: 8 }}>
          <button className={`btn ${st.ack ? '' : 'primary'}`} onClick={() => { ackAlert(a.id, !st.ack); setToast(st.ack ? 'Acknowledgement removed' : 'Alert marked as acknowledged'); }}>{st.ack ? <CheckCircle2 size={14} /> : <Circle size={14} />}{st.ack ? 'Acknowledged — click to undo' : 'Mark as acknowledged'}</button>
          {st.ackAt && <span className="small muted">Acknowledged {new Date(st.ackAt).toLocaleString()}</span>}
        </div>
        <textarea placeholder="Record a follow-up note (e.g. owner, due date, decision)…" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Follow-up note" />
        <div className="row-sb mt-8"><span className="xs muted">Stored in this browser only (demo persistence). No message is sent to any branch manager or external system.</span><button className="btn sm primary" disabled={!note.trim()} onClick={() => { addNote(a.id, note); setNote(''); setToast('Follow-up note recorded'); }}><StickyNote size={13} />Save note</button></div>
        {(st.notes || []).length > 0 && <div className="col mt-12">{st.notes.slice().reverse().map((n, i) => <div key={i} className="small" style={{ borderLeft: '3px solid var(--blue-400)', paddingLeft: 10 }}><div className="muted xs">{new Date(n.at).toLocaleString()}</div>{n.text}</div>)}</div>}
      </div>
    </Shell>
  );
}

export default function DrawerHost() {
  const { drawer, setDrawer } = useApp();
  if (!drawer) return null;
  const close = () => setDrawer(null);
  const back = drawer.from ? () => setDrawer(drawer.from) : null;
  switch (drawer.type) {
    case 'tx': return <TxInspector key={drawer.i} i={drawer.i} close={close} back={back} />;
    case 'customer': return <CustomerInspector key={drawer.c} c={drawer.c} close={close} back={back} />;
    case 'product': return <ProductInspector key={drawer.idx} idx={drawer.idx} close={close} back={back} />;
    case 'colour': return <ColourInspector key={drawer.name} name={drawer.name} close={close} back={back} />;
    case 'alert': return <AlertInspector key={drawer.id} id={drawer.id} close={close} back={back} />;
    default: return null;
  }
}
