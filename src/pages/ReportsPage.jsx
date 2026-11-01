import React, { useMemo, useState, useEffect } from 'react';
import { Download, Printer, FileText, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useApp } from '../state/app.jsx';
import { FilterBar, ScopeTags, SYNC_LABEL } from '../components/Layout.jsx';
import { Card, DataTable, Notice, Badge, CurChip } from '../components/ui.jsx';
import { REPORTS } from '../lib/reports.js';
import { downloadCSV } from '../lib/csv.js';
import { getDS } from '../lib/query.js';
import { slug, num } from '../lib/format.js';
import { fmtRange, TODAY } from '../lib/dates.js';

const defaults = (r) => Object.fromEntries((r.filters || []).map((f) => { const o = typeof f.options === 'function' ? f.options() : f.options; return [f.id, o[0][0]]; }));

export default function ReportsPage() {
  const { q, pq, scope, period, cur, alertState, currencyMode, compare, setToast } = useApp();
  const ds = getDS();
  const [id, setId] = useState('exec');
  const [params, setParams] = useState({});
  const [printing, setPrinting] = useState(false);
  const def = REPORTS.find((r) => r.id === id);
  const p = { ...defaults(def), ...(params[id] || {}) };
  const out = useMemo(() => def.build({ q, pq, scope, period, cur, alertState }, p), [def, q, pq, scope, period, cur, alertState, JSON.stringify(p)]);
  const scopeText = scope.branch ? ds.branchById.get(scope.branch).name : scope.city ? ds.cities.find((c) => c.id === scope.city)?.name : scope.country ? ds.countryByCode.get(scope.country).name : 'All Nash Paints markets (74 branches)';
  const periodText = def.noPeriod ? `Position as of ${SYNC_LABEL}` : `${period.label}: ${fmtRange(period.d0, period.d1)}${pq && !def.noPeriod ? ` (compared with ${fmtRange(period.prev.d0, period.prev.d1)})` : ''}`;
  const filterLines = [`Location: ${scopeText}`, `Period: ${periodText}`, `Currency: ${out.usdOnly ? 'USD (consolidated)' : cur.code}${cur.forced ? ' — local currency not available for multi-country scope' : ''}`, ...(def.filters || []).map((f) => { const o = typeof f.options === 'function' ? f.options() : f.options; return `${f.label}: ${o.find((x) => x[0] === p[f.id])?.[1]}`; })];
  const exportCsv = () => {
    const cols = out.columns.map((c) => ({ header: c.header, value: c.value }));
    const name = `nash-${slug(def.title)}-${slug(scopeText).slice(0, 24)}-${def.noPeriod ? 'latest' : slug(period.label)}.csv`;
    downloadCSV(name, cols, out.rows, ['DEMO DATA — fictional records; not live ERP, POS or accounting data', `Report: ${def.title}`, ...filterLines, ...out.summary.map(([a, b]) => `${a}: ${b}`), ...(out.note ? [`Note: ${out.note}`] : []), `Generated: simulated sync ${SYNC_LABEL}`]);
    setToast?.(`Exported ${num(out.rows.length)} rows to ${name}`); setTimeout(() => setToast?.(null), 3000);
  };
  const print = () => { setPrinting(true); };
  useEffect(() => { if (!printing) return; const t = setTimeout(() => { window.print(); setPrinting(false); }, 250); return () => clearTimeout(t); }, [printing]);
  const ok = out.check ? Math.abs(out.check.a - out.check.b) < 0.5 : null;
  return (
    <>
      <FilterBar />
      <div className="page">
        <div className="page-head no-print"><div><h1>Reports & Exports</h1><p>Eight standard management reports built from the same data and filters as the dashboards. Export to CSV or print / save as PDF.</p></div><ScopeTags /></div>
        <div className="grid mt-8" style={{ gridTemplateColumns: 'minmax(220px,300px) minmax(0,1fr)', alignItems: 'start' }}>
          <div className="col no-print" style={{ gap: 8 }}>
            {REPORTS.map((r, i) => (
              <button key={r.id} className={`report-pick ${r.id === id ? 'on' : ''}`} onClick={() => setId(r.id)}>
                <span className="n">{i + 1}</span><span><b>{r.title}</b><span className="xs muted" style={{ display: 'block', fontWeight: 400 }}>{r.audience}</span></span>
              </button>))}
          </div>
          <div className="col" style={{ gap: 12 }}>
            <div className="print-only">
              <div style={{ fontFamily: 'var(--serif)', fontSize: 11, letterSpacing: '.14em' }}>NASH HOLDINGS · COMMAND CENTER · DEMO DATA — FICTIONAL RECORDS</div>
              <h1 style={{ fontSize: 20, margin: '4px 0' }}>{def.title}</h1>
              {filterLines.map((l) => <div key={l} style={{ fontSize: 11 }}>{l}</div>)}
              <div style={{ fontSize: 11 }}>Generated from the simulated sync of {SYNC_LABEL}. Designed by Obitrek.</div>
            </div>
            <Card title={def.title} subtitle={def.desc} actions={<div className="row no-print" style={{ gap: 8 }}><button className="btn" onClick={print}><Printer size={14} />Print / PDF</button><button className="btn primary" onClick={exportCsv}><Download size={14} />Export CSV</button></div>}>
              <div className="row wrap no-print" style={{ gap: 10, marginBottom: 10 }}>
                {(def.filters || []).map((f) => { const o = typeof f.options === 'function' ? f.options() : f.options; return (
                  <label key={f.id} className="row small" style={{ gap: 6 }}><span className="muted">{f.label}</span>
                    <select className="select" value={p[f.id]} onChange={(e) => setParams((s) => ({ ...s, [id]: { ...(s[id] || {}), [f.id]: e.target.value } }))}>{o.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>); })}
                <span className="xs muted">Location, period, comparison and currency come from the filter bar above.</span>
              </div>
              <div className="box small" style={{ marginBottom: 10 }}>
                <div className="row wrap" style={{ gap: 14 }}>{filterLines.map((l) => <span key={l}>{l}</span>)}</div>
              </div>
              <div className="row wrap" style={{ gap: 18, marginBottom: 8 }}>{out.summary.map(([a, b]) => <div key={a}><div className="xs muted">{a}</div><b>{b}</b></div>)}</div>
              {out.note && <div className="small muted" style={{ marginBottom: 8 }}>{out.note}</div>}
              {ok != null && <div className="row small" style={{ gap: 6, marginBottom: 8, color: ok ? 'var(--pos)' : 'var(--neg)' }}>{ok ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}<span>{ok ? 'Reconciled: ' : 'Does not reconcile: '}{out.check.label}.</span></div>}
              {out.rows.length === 0 ? <div className="empty"><b>No rows match this report configuration</b><div className="muted small">Try a different filter or widen the date range.</div></div> : (
                <DataTable columns={out.columns.map((c, i) => ({ key: 'c' + i, header: c.header, value: c.value, render: c.render, align: c.align }))} rows={out.rows} rowKey={out.rowKey} pageSize={printing ? 0 : 15} search={!printing} defaultSort={null} searchText={(r) => out.columns.map((c) => String(c.value(r) ?? '')).join(' ')} />
              )}
            </Card>
            <div className="xs muted no-print">DEMO DATA — all records are fictional. CSV files include the report title, applied filters, currency and a data disclaimer as header comments.</div>
          </div>
        </div>
      </div>
    </>
  );
}
