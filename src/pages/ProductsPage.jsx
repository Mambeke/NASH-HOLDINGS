import React, { useMemo, useState } from 'react';
import { useApp } from '../state/app.jsx';
import { FilterBar, ScopeTags } from '../components/Layout.jsx';
import { Card, Kpi, DataTable, Swatch, Badge, LinkBtn, Select, Seg } from '../components/ui.jsx';
import { Donut, DonutLegend, RankBars, PALETTE } from '../components/charts.jsx';
import { getDS, lineAgg, rollup, colourRollup, inventoryRows, makeQ, kpis } from '../lib/query.js';
import { money, num, pctf, compact } from '../lib/format.js';
import { TODAY } from '../lib/dates.js';

function ColourBars({ rows, metric, m, onClick }) {
  const max = Math.max(1, ...rows.map((r) => r[metric]));
  return (
    <div className="col" style={{ gap: 9 }}>
      {rows.map((c) => (
        <button key={c.key} className="row" style={{ background: 'none', border: 0, padding: 0, width: '100%', textAlign: 'left', gap: 10 }} onClick={() => onClick(c)}>
          <Swatch hex={c.hex} size={18} />
          <div className="grow"><div className="row-sb small"><b>{c.key} <span className="muted" style={{ fontWeight: 400 }}>{c.code}</span></b><span className="tnum"><b>{metric === 'rev' ? m(c.rev) : num(c.qty)}</b></span></div>
            <div className="progress" style={{ marginTop: 3 }}><i style={{ width: `${(c[metric] / max) * 100}%` }} /></div></div>
        </button>
      ))}
    </div>
  );
}

export default function ProductsPage() {
  const { q, scope, cur, setDrawer, period } = useApp();
  const ds = getDS();
  const [cat, setCat] = useState('');
  const m = (v, o) => money(v, cur.code, o);
  const agg = lineAgg(q);
  const k = kpis(q);
  const rows = agg.rows.filter((r) => !cat || r.category === cat);
  const sold = agg.rows.filter((r) => r.qty > 0);
  const colours = colourRollup(agg.rows);
  const sizes = rollup(agg.rows.filter((r) => r.p.sizeL > 0), (r) => r.size).sort((a, b) => b.qty - a.qty);
  const cats = rollup(agg.rows, (r) => r.category).sort((a, b) => b.rev - a.rev);
  const stock = useMemo(() => {
    const inv = inventoryRows(makeQ(scope, TODAY, TODAY, 'USD'));
    const by = new Map();
    for (const r of inv) {
      let o = by.get(r.p.idx); if (!o) { o = { p: r.p, units: 0, out: 0, low: 0, positions: 0, sold60: 0, replenish: 0, slowPos: 0, risk: 0 }; by.set(r.p.idx, o); }
      o.units += r.stock; o.positions++; o.sold60 += r.sold60; o.replenish += r.replenish; if (r.status === 'out') o.out++; if (r.status === 'low') o.low++; if (r.slow) o.slowPos++; if (r.risk) o.risk++;
    }
    return [...by.values()].map((o) => ({ ...o, cover: o.sold60 > 0 ? o.units / (o.sold60 / 60) : null, id: o.p.id }));
  }, [scope]);
  const slow = [...stock].filter((o) => o.sold60 >= 0).sort((a, b) => (b.cover ?? 9999) - (a.cover ?? 9999)).slice(0, 10);
  const risk = [...stock].filter((o) => o.out + o.low + o.risk > 0).sort((a, b) => b.out * 3 + b.low + b.risk - (a.out * 3 + a.low + a.risk)).slice(0, 12);
  const top12 = [...agg.rows].sort((a, b) => b.rev - a.rev).slice(0, 12);
  const countryCols = ds.countries.filter((c) => !scope.country || c.code === scope.country);
  const maxCell = Math.max(1, ...top12.flatMap((r) => countryCols.map((c) => agg.revC[c.idx * ds.S + r.idx])));
  const open = (r) => setDrawer({ type: 'product', idx: r.idx });
  return (
    <>
      <FilterBar />
      <div className="page">
        <div className="page-head"><div><h1>Products & Colour Intelligence</h1><p>Catalog of {ds.S} fictional SKUs across interior, exterior, primers, protective coatings and supplies · {period.label}</p></div><ScopeTags /></div>
        <div className="col" style={{ gap: 14 }}>
          <div className="grid g4">
            <Kpi label="Revenue from products" cur={cur} value={m(agg.totRev)} sub={`${sold.length} of ${ds.S} SKUs sold`} />
            <Kpi label="Units sold" value={num(agg.totQty)} sub={`${num(k.txns)} transactions`} />
            <Kpi label="Gross margin" value={pctf(k.margin)} sub={`${m(k.gp)} gross profit`} />
            <Kpi label="Products at stock-out risk" value={num(risk.length)} sub="out, low or < 5 days of cover" tone="bad" />
          </div>
          <Card title="Product performance" subtitle="All SKUs for the current filters. Click a product to inspect its sales trend and geographic performance." cur={cur} flush
            actions={<select className="select" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category"><option value="">All categories</option>{[...new Set(ds.catalog.map((p) => p.category))].map((c) => <option key={c}>{c}</option>)}</select>}>
            <DataTable columns={[
              { key: 'name', header: 'Product', render: (r) => <div className="row" style={{ gap: 8 }}><Swatch hex={r.hex} /><div><LinkBtn onClick={() => open(r)}>{r.range.replace('Nash ', '')}</LinkBtn><div className="xs muted">{r.colour !== '—' ? `${r.colour} · ` : ''}{r.size}</div></div></div>, value: (r) => r.name },
              { key: 'sku', header: 'SKU', value: (r) => r.sku, render: (r) => <span className="xs muted">{r.sku}</span> },
              { key: 'category', header: 'Category', value: (r) => r.category },
              { key: 'qty', header: 'Units', align: 'r', value: (r) => r.qty, render: (r) => num(r.qty) },
              { key: 'rev', header: 'Revenue', align: 'r', value: (r) => r.rev, render: (r) => <b>{m(r.rev)}</b> },
              { key: 'share', header: 'Contribution', align: 'r', value: (r) => r.share, render: (r) => pctf(r.share, 1) },
              { key: 'margin', header: 'Margin', align: 'r', value: (r) => r.margin, render: (r) => pctf(r.margin, 0) },
              { key: 'branches', header: 'Branches', align: 'r', value: (r) => r.branchesSold },
            ]} rows={rows} rowKey={(r) => r.id} defaultSort={{ key: 'rev', dir: 'desc' }} onRowClick={open} search searchText={(r) => `${r.name} ${r.sku} ${r.colour} ${r.category}`} pageSize={12} csvName="product-performance" />
          </Card>
          <div className="grid g2">
            <Card title="Best-selling colours by revenue" cur={cur} subtitle="Click a colour to see its trend and geography"><ColourBars rows={colours.slice(0, 10)} metric="rev" m={m} onClick={(c) => setDrawer({ type: 'colour', name: c.key })} /></Card>
            <Card title="Best-selling colours by quantity" subtitle="Units across all ranges"><ColourBars rows={[...colours].sort((a, b) => b.qty - a.qty).slice(0, 10)} metric="qty" m={m} onClick={(c) => setDrawer({ type: 'colour', name: c.key })} /></Card>
          </div>
          <div className="grid g3">
            <Card title="Container sizes" subtitle="Most frequently purchased sizes (units)">
              <Donut data={sizes.map((s) => ({ name: s.key, value: s.qty }))} height={170} fmt={(v) => `${num(v)} units`} />
              <DonutLegend data={sizes.map((s) => ({ name: s.key, value: s.qty }))} />
            </Card>
            <Card title="Revenue contribution by category" cur={cur}>
              <Donut data={cats.map((s) => ({ name: s.key, value: s.rev }))} height={170} fmt={(v) => m(v)} />
              <DonutLegend data={cats.map((s) => ({ name: s.key, value: s.rev }))} fmt={(v) => m(v)} />
            </Card>
            <Card title="Gross margin by category" subtitle="Where unit costs are known">
              <div className="col" style={{ gap: 10 }}>{cats.map((c) => <div key={c.key}><div className="row-sb small"><b>{c.key}</b><span>{pctf(c.margin)}</span></div><div className="progress"><i style={{ width: `${(c.margin || 0) * 160}%` }} /></div></div>)}</div>
            </Card>
          </div>
          <Card title="Product sales by country" cur={cur} subtitle="Top 12 products by revenue; shading shows relative revenue per cell. Currency: consolidated USD when comparing countries." flush>
            <div className="tbl-wrap"><table className="tbl dense"><thead><tr><th>Product</th>{countryCols.map((c) => <th key={c.code} className="r">{c.name}</th>)}<th className="r">Total</th></tr></thead>
              <tbody>{top12.map((r) => (
                <tr key={r.id} className="click" onClick={() => open(r)}><td><div className="row" style={{ gap: 6 }}><Swatch hex={r.hex} />{r.p.shortName}</div></td>
                  {countryCols.map((c) => { const v = agg.revC[c.idx * ds.S + r.idx]; return <td key={c.code} className="r" style={{ background: `rgba(36,89,198,${(v / maxCell) * 0.28})` }}>{money(v, cur.code)}</td>; })}
                  <td className="r"><b>{m(r.rev)}</b></td></tr>))}</tbody></table></div>
            <div className="tbl-foot"><span>{cur.local ? `Values in ${cur.code}.` : 'Values in USD (converted at fictional monthly rates).'}</span></div>
          </Card>
          <div className="grid g2">
            <Card title="Slow-moving products" subtitle="Highest days of stock cover based on the previous 60 days of sales (current stock position)" flush>
              <DataTable columns={[
                { key: 'p', header: 'Product', render: (r) => <div className="row" style={{ gap: 6 }}><Swatch hex={r.p.hex} /><LinkBtn onClick={() => setDrawer({ type: 'product', idx: r.p.idx })}>{r.p.shortName}</LinkBtn></div>, value: (r) => r.p.name },
                { key: 'units', header: 'Units on hand', align: 'r', value: (r) => r.units, render: (r) => num(r.units) }, { key: 'sold60', header: 'Sold (60d)', align: 'r', value: (r) => r.sold60, render: (r) => num(r.sold60) },
                { key: 'cover', header: 'Days of cover', align: 'r', value: (r) => r.cover ?? 9999, render: (r) => (r.cover == null ? '∞' : num(r.cover)) },
              ]} rows={slow} rowKey={(r) => r.id} onRowClick={(r) => setDrawer({ type: 'product', idx: r.p.idx })} />
            </Card>
            <Card title="Stock-out risk and replenishment" subtitle="Products with out-of-stock or low-stock branch positions" flush>
              <DataTable columns={[
                { key: 'p', header: 'Product', render: (r) => <div className="row" style={{ gap: 6 }}><Swatch hex={r.p.hex} /><LinkBtn onClick={() => setDrawer({ type: 'product', idx: r.p.idx })}>{r.p.shortName}</LinkBtn></div>, value: (r) => r.p.name },
                { key: 'out', header: 'Out', align: 'r', value: (r) => r.out, render: (r) => (r.out ? <Badge tone="bad">{r.out}</Badge> : '0') }, { key: 'low', header: 'Low', align: 'r', value: (r) => r.low, render: (r) => (r.low ? <Badge tone="warn">{r.low}</Badge> : '0') },
                { key: 'replenish', header: 'Replenish (units)', align: 'r', value: (r) => r.replenish, render: (r) => num(r.replenish) },
              ]} rows={risk} rowKey={(r) => r.id} onRowClick={(r) => setDrawer({ type: 'product', idx: r.p.idx })} />
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
