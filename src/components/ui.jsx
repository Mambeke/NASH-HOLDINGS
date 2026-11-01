import React, { useMemo, useState } from 'react';
import { ArrowUpRight, ArrowDownRight, Minus, Search, ChevronUp, ChevronDown, Download, Inbox, Info, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
import { signedPct, num } from '../lib/format.js';
import { downloadCSV } from '../lib/csv.js';

export function CurChip({ cur }) {
  if (!cur) return null;
  const code = typeof cur === 'string' ? cur : cur.code;
  const local = typeof cur === 'string' ? code !== 'USD' : cur.local;
  return <span className={`cur-chip ${local ? 'local' : ''}`} title={local ? `Local currency view (${code})` : 'Consolidated group reporting currency (fictional FX rates)'}>{code}</span>;
}
export function Card({ title, subtitle, actions, cur, children, className = '', flush = false, style }) {
  return (
    <section className={`card ${className}`} style={style}>
      {(title || actions) && (
        <div className="card-h">
          <div style={{ minWidth: 0 }}>
            <div className="card-t">{title}{cur && <CurChip cur={cur} />}</div>
            {subtitle && <div className="card-s">{subtitle}</div>}
          </div>
          {actions && <div className="row wrap" style={{ justifyContent: 'flex-end' }}>{actions}</div>}
        </div>
      )}
      <div className={`card-b ${flush ? 'flush' : ''}`}>{children}</div>
    </section>
  );
}
export function Delta({ value, goodWhen = 'up', abs, small, neutral, tone: toneOverride }) {
  if (value == null || Number.isNaN(value)) return <span className="delta flat" title="No comparison data available for the selected comparison period">n/a</span>;
  const up = value > 0.0005, down = value < -0.0005;
  let tone = 'flat';
  if (!neutral) { if (up) tone = goodWhen === 'up' ? 'good' : 'bad'; else if (down) tone = goodWhen === 'up' ? 'bad' : 'good'; }
  else if (up || down) tone = 'warn';
  if (toneOverride) tone = toneOverride;
  const Icon = up ? ArrowUpRight : down ? ArrowDownRight : Minus;
  return <span className={`delta ${tone}`}><Icon size={13} strokeWidth={2.5} />{signedPct(value, small ? 0 : 1)}{abs != null && <span style={{ opacity: .75, fontWeight: 500 }}> · {abs}</span>}</span>;
}
export function Kpi({ label, value, delta, goodWhen = 'up', abs, sub, note, onClick, cur, icon, compareLabel, valueTitle, tone, extra }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag className={`kpi fade ${onClick ? 'click' : ''}`} onClick={onClick}>
      <div className="kpi-l"><span>{label}</span>{cur ? <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>{icon}<CurChip cur={cur} /></span> : icon}</div>
      <div className="kpi-v" title={valueTitle}>{value}</div>
      <div className="kpi-sub">
        {delta !== undefined && <Delta value={delta} goodWhen={goodWhen} abs={abs} tone={tone} />}
        {delta !== undefined && compareLabel && <span>vs {compareLabel}</span>}
        {sub && <span>{sub}</span>}
      </div>
      {extra}
      {note && <div className="kpi-note">{note}</div>}
    </Tag>
  );
}
export function Badge({ tone = 'neutral', children, title }) { return <span className={`badge ${tone}`} title={title}>{children}</span>; }
export function SeverityBadge({ severity }) {
  const lbl = { critical: 'Critical', high: 'High', medium: 'Medium', info: 'Opportunity' }[severity];
  return <span className={`badge sev-${severity}`}>{lbl}</span>;
}
export function Swatch({ hex, size = 14 }) { return hex ? <span className="swatch" style={{ background: hex, width: size, height: size }} /> : null; }
export function Progress({ value, tone }) {
  const v = Math.max(0, Math.min(1.25, value || 0));
  const t = tone || (value >= 1 ? 'good' : value >= 0.9 ? '' : value >= 0.8 ? 'warn' : 'bad');
  return <div className={`progress ${t}`}><i style={{ width: `${Math.min(100, v * 100)}%` }} /></div>;
}
export function Notice({ children, tone, icon }) {
  const I = tone === 'warn' ? AlertTriangle : Info;
  return <div className={`notice ${tone || ''}`}>{icon || <I size={16} />}<div>{children}</div></div>;
}
export function Empty({ title = 'No data for this selection', hint = 'Try widening the date range or clearing filters.', icon }) {
  return <div className="empty">{icon || <Inbox size={28} />}<b style={{ color: 'var(--text-2)' }}>{title}</b><span className="small">{hint}</span></div>;
}
export function Skeleton({ h = 120 }) { return <div className="skeleton" style={{ height: h }} />; }
export function Seg({ options, value, onChange, small }) {
  return <div className="seg" role="tablist">{options.map((o) => <button key={o.id ?? o} className={(o.id ?? o) === value ? 'on' : ''} onClick={() => onChange(o.id ?? o)}>{o.label ?? o}</button>)}</div>;
}
export function Select({ value, onChange, options, label, disabled, placeholder, style, title }) {
  return (
    <div className="field">
      {label && <label>{label}</label>}
      <select className="select" value={value ?? ''} onChange={(e) => onChange(e.target.value)} disabled={disabled} style={style} title={title}>
        {placeholder != null && <option value="">{placeholder}</option>}
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
export function SectionTitle({ title, aside }) { return <div className="section-title"><h2>{title}</h2>{aside && <span>{aside}</span>}</div>; }
export function LinkBtn({ onClick, children, title }) { return <button className="link" onClick={(e) => { e.stopPropagation(); onClick(); }} title={title}>{children}</button>; }

export function DataTable({ columns, rows, rowKey, onRowClick, defaultSort, search = false, searchText, pageSize = 0, csvName, csvPreamble, dense = true, emptyText, extraTools, footer, maxHeight, selectedKey }) {
  const [sort, setSort] = useState(defaultSort || null);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const cols = columns.filter((c) => !c.hide);
  const filtered = useMemo(() => {
    if (!q.trim()) return rows;
    const t = q.trim().toLowerCase();
    return rows.filter((r) => (searchText ? searchText(r) : cols.map((c) => String(c.value ? c.value(r) : r[c.key] ?? '')).join(' ')).toLowerCase().includes(t));
  }, [rows, q, cols, searchText]);
  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const col = cols.find((c) => c.key === sort.key); if (!col) return filtered;
    const val = col.sortValue || col.value || ((r) => r[col.key]);
    const arr = [...filtered];
    arr.sort((a, b) => {
      const x = val(a), y = val(b);
      if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1;
      const c = typeof x === 'string' ? x.localeCompare(y) : x - y;
      return sort.dir === 'asc' ? c : -c;
    });
    return arr;
  }, [filtered, sort, cols]);
  const pages = pageSize ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1;
  const pg = Math.min(page, pages - 1);
  const view = pageSize ? sorted.slice(pg * pageSize, pg * pageSize + pageSize) : sorted;
  const toggle = (c) => { if (c.sortable === false) return; setSort((s) => (s && s.key === c.key ? { key: c.key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: c.key, dir: c.align === 'r' ? 'desc' : 'asc' })); setPage(0); };
  const doCsv = () => downloadCSV(`${csvName || 'export'}.csv`, cols.map((c) => ({ header: c.csvHeader || (typeof c.header === 'string' ? c.header : c.key), value: c.csv || c.value || ((r) => r[c.key]) })), sorted, csvPreamble);
  return (
    <div>
      {(search || csvName || extraTools) && (
        <div className="tbl-tools">
          <div className="row wrap">
            {search && <div className="search-wrap" style={{ width: 220 }}><Search size={15} /><input placeholder="Search…" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} aria-label="Search table" /></div>}
            {extraTools}
          </div>
          {csvName && <button className="btn sm" onClick={doCsv} title="Export the rows currently shown (after search and sort) as CSV"><Download size={14} />CSV</button>}
        </div>
      )}
      <div className="tbl-wrap" style={maxHeight ? { maxHeight } : undefined}>
        <table className={`tbl ${dense ? 'dense' : ''}`}>
          <thead><tr>{cols.map((c) => (
            <th key={c.key} className={`${c.align === 'r' ? 'r' : c.align === 'c' ? 'c' : ''} ${c.sortable === false ? '' : 'sortable'}`} style={{ width: c.width }} onClick={() => toggle(c)} aria-sort={sort?.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>{c.header}{sort?.key === c.key && (sort.dir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}</span>
            </th>))}</tr></thead>
          <tbody>
            {view.map((r, i) => (
              <tr key={rowKey ? rowKey(r) : i} className={onRowClick ? 'click' : ''} onClick={onRowClick ? () => onRowClick(r) : undefined} style={selectedKey && rowKey && rowKey(r) === selectedKey ? { background: 'var(--blue-50)' } : undefined}>
                {cols.map((c) => <td key={c.key} className={c.align === 'r' ? 'r' : c.align === 'c' ? 'c' : ''}>{c.render ? c.render(r, i + pg * (pageSize || 0)) : (c.value ? c.value(r) : r[c.key])}</td>)}
              </tr>))}
          </tbody>
        </table>
        {!view.length && <Empty title={emptyText || 'No rows match'} hint={q ? 'Clear the search to see all rows.' : 'Try widening the date range or clearing filters.'} />}
      </div>
      {(pageSize > 0 || footer) && (
        <div className="tbl-foot">
          <span>{footer || `${num(sorted.length)} row${sorted.length === 1 ? '' : 's'}${q ? ` (filtered from ${num(rows.length)})` : ''}`}</span>
          {pageSize > 0 && pages > 1 && <div className="pager"><button className="icon-btn" style={{ width: 28, height: 28 }} onClick={() => setPage(Math.max(0, pg - 1))} disabled={pg === 0} aria-label="Previous page"><ChevronLeft size={15} /></button><span className="small">Page {pg + 1} / {pages}</span><button className="icon-btn" style={{ width: 28, height: 28 }} onClick={() => setPage(Math.min(pages - 1, pg + 1))} disabled={pg >= pages - 1} aria-label="Next page"><ChevronRight size={15} /></button></div>}
        </div>
      )}
    </div>
  );
}

export class ErrorBoundary extends React.Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err, info) { console.error('UI error', err, info); }
  render() {
    if (this.state.err) return (
      <div className="page"><div className="card" style={{ padding: 28 }}>
        <h2>Something went wrong rendering this view</h2>
        <p className="muted">The error was contained so the rest of the command center keeps working. Details: {String(this.state.err.message || this.state.err)}</p>
        <button className="btn primary" onClick={() => { this.setState({ err: null }); window.location.hash = '#/group'; }}>Return to group overview</button>
      </div></div>
    );
    return this.props.children;
  }
}
