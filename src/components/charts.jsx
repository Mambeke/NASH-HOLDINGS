import React from 'react';
import { ResponsiveContainer, ComposedChart, Area, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, BarChart, PieChart, Pie, Cell, LabelList, ReferenceLine } from 'recharts';
import { compact, money, num } from '../lib/format.js';

export const PALETTE = ['#1C4CAD', '#5B97F0', '#0E2A57', '#9CBCEA', '#6B7F9E', '#C6D3E8', '#2E7BB5', '#34476B'];
export const SEMANTIC = { pos: '#2FA37A', neg: '#D5524A', warn: '#E0A030', blue: '#2459C6', navy: '#0F2A55', grey: '#9AA8BD' };
const axisStyle = { fontSize: 11, fill: '#64748B' };

export function ChartTip({ active, payload, label, fmt, labelFmt, hideZero }) {
  if (!active || !payload?.length) return null;
  const rows = payload.filter((p) => p.value != null && !(hideZero && p.value === 0));
  return (
    <div className="tip">
      <b>{labelFmt ? labelFmt(label, payload) : label ?? payload[0]?.payload?.name}</b>
      {rows.map((p, i) => (
        <div key={i}><span><i className="dot" style={{ background: p.color || p.fill || p.stroke }} />{p.name}</span><span className="tnum">{(p.payload?.[`__fmt_${p.dataKey}`]) || (fmt ? fmt(p.value, p) : num(p.value))}</span></div>
      ))}
    </div>
  );
}
const yFmtDefault = (v) => compact(v);

export function TrendChart({ data, xKey = 'label', series, height = 270, fmt, yFmt, onPointClick, stackedBars, xInterval, refLines, brushless = true, rightFmt, legend = true }) {
  if (!data?.length) return null;
  const hasRight = series.some((s) => s.yAxis === 'right');
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: hasRight ? 4 : 10, left: 0, bottom: 0 }} onClick={onPointClick ? (e) => { if (e?.activePayload?.[0]) onPointClick(e.activePayload[0].payload); } : undefined} style={onPointClick ? { cursor: 'pointer' } : undefined}>
        <defs>
          {series.filter((s) => s.kind === 'area').map((s) => (
            <linearGradient key={s.key} id={`g-${s.key}-${s.color.slice(1)}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={s.color} stopOpacity={0.22} /><stop offset="100%" stopColor={s.color} stopOpacity={0.02} /></linearGradient>
          ))}
        </defs>
        <CartesianGrid stroke="#E9EDF3" vertical={false} />
        <XAxis dataKey={xKey} tick={axisStyle} tickLine={false} axisLine={{ stroke: '#D9E0EA' }} interval={xInterval ?? 'preserveStartEnd'} minTickGap={22} />
        <YAxis yAxisId="left" tick={axisStyle} tickLine={false} axisLine={false} width={52} tickFormatter={yFmt || yFmtDefault} />
        {hasRight && <YAxis yAxisId="right" orientation="right" tick={axisStyle} tickLine={false} axisLine={false} width={44} tickFormatter={rightFmt || yFmtDefault} />}
        <Tooltip content={<ChartTip fmt={fmt} />} cursor={{ stroke: '#9CBCEA', strokeDasharray: 3 }} />
        {legend && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 4 }} />}
        {refLines?.map((r, i) => <ReferenceLine key={i} yAxisId="left" y={r.y} stroke={r.color || '#9AA8BD'} strokeDasharray="4 4" label={{ value: r.label, fontSize: 10, fill: '#64748B', position: 'insideTopRight' }} />)}
        {series.map((s) => {
          const common = { dataKey: s.key, name: s.name, yAxisId: s.yAxis || 'left', isAnimationActive: false };
          if (s.kind === 'bar') return <Bar key={s.key} {...common} fill={s.color} radius={s.stackId ? 0 : [3, 3, 0, 0]} stackId={s.stackId} maxBarSize={s.maxBar || 28} />;
          if (s.kind === 'area') return <Area key={s.key} {...common} type="monotone" stroke={s.color} strokeWidth={2.2} fill={`url(#g-${s.key}-${s.color.slice(1)})`} dot={false} activeDot={{ r: 4 }} strokeDasharray={s.dashed ? '5 4' : undefined} stackId={s.stackId} />;
          return <Line key={s.key} {...common} type="monotone" stroke={s.color} strokeWidth={s.width || 2} strokeDasharray={s.dashed ? '5 4' : undefined} dot={false} activeDot={{ r: 4 }} connectNulls />;
        })}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function RankBars({ data, nameKey = 'name', valueKey = 'value', fmt, height, onClick, color = '#1C4CAD', colorFn, labelFmt, nameWidth = 110, barSize = 16, showLabels = true, secondary }) {
  if (!data?.length) return null;
  const h = height || Math.max(120, data.length * (barSize + 14) + 16);
  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={data} layout="vertical" margin={{ top: 2, right: showLabels ? 70 : 12, left: 0, bottom: 2 }} style={onClick ? { cursor: 'pointer' } : undefined}>
        <CartesianGrid stroke="#EEF1F6" horizontal={false} />
        <XAxis type="number" hide />
        <YAxis type="category" dataKey={nameKey} tick={{ fontSize: 12, fill: '#34445C' }} tickLine={false} axisLine={false} width={nameWidth} interval={0} />
        <Tooltip content={<ChartTip fmt={fmt} />} cursor={{ fill: 'rgba(36,89,198,.06)' }} />
        <Bar dataKey={valueKey} name={secondary?.name || 'Value'} radius={[0, 4, 4, 0]} barSize={barSize} onClick={onClick ? (d) => onClick(d.payload || d) : undefined} isAnimationActive={false}>
          {data.map((d, i) => <Cell key={i} fill={colorFn ? colorFn(d, i) : color} />)}
          {showLabels && <LabelList dataKey={valueKey} position="right" formatter={labelFmt || fmt || compact} style={{ fontSize: 11, fill: '#34445C', fontWeight: 600 }} />}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function StackedBars({ data, xKey = 'label', keys, colors, height = 260, fmt, yFmt, onClick, percent }) {
  if (!data?.length) return null;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} stackOffset={percent ? 'expand' : undefined} onClick={onClick ? (e) => e?.activePayload?.[0] && onClick(e.activePayload[0].payload) : undefined} style={onClick ? { cursor: 'pointer' } : undefined}>
        <CartesianGrid stroke="#E9EDF3" vertical={false} />
        <XAxis dataKey={xKey} tick={axisStyle} tickLine={false} axisLine={{ stroke: '#D9E0EA' }} interval="preserveStartEnd" minTickGap={14} />
        <YAxis tick={axisStyle} tickLine={false} axisLine={false} width={percent ? 40 : 52} tickFormatter={percent ? (v) => `${Math.round(v * 100)}%` : yFmt || yFmtDefault} />
        <Tooltip content={<ChartTip fmt={fmt} />} cursor={{ fill: 'rgba(36,89,198,.06)' }} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
        {keys.map((k, i) => <Bar key={k.key || k} dataKey={k.key || k} name={k.name || k} stackId="a" fill={colors?.[i] || PALETTE[i % PALETTE.length]} maxBarSize={34} isAnimationActive={false} radius={i === keys.length - 1 ? [3, 3, 0, 0] : 0} />)}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function Donut({ data, nameKey = 'name', valueKey = 'value', colors = PALETTE, height = 210, fmt, center, onClick, inner = 58 }) {
  const total = data.reduce((a, d) => a + (d[valueKey] || 0), 0);
  if (!total) return null;
  return (
    <div style={{ position: 'relative', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip content={<ChartTip fmt={(v) => `${fmt ? fmt(v) : num(v)} · ${((v / total) * 100).toFixed(1)}%`} />} />
          <Pie data={data} dataKey={valueKey} nameKey={nameKey} innerRadius={inner} outerRadius={inner + 28} paddingAngle={2} stroke="#fff" strokeWidth={2} onClick={onClick ? (d) => onClick(d.payload || d) : undefined} isAnimationActive={false} style={onClick ? { cursor: 'pointer' } : undefined}>
            {data.map((d, i) => <Cell key={i} fill={d.color || colors[i % colors.length]} />)}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      {center && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none', textAlign: 'center' }}>{center}</div>}
    </div>
  );
}
export function DonutLegend({ data, colors = PALETTE, nameKey = 'name', valueKey = 'value', fmt, onClick }) {
  const total = data.reduce((a, d) => a + (d[valueKey] || 0), 0);
  return (
    <div className="col" style={{ gap: 6 }}>
      {data.map((d, i) => (
        <div key={d[nameKey]} className="row-sb small" style={onClick ? { cursor: 'pointer' } : undefined} onClick={onClick ? () => onClick(d) : undefined}>
          <span className="row" style={{ gap: 7 }}><i style={{ width: 10, height: 10, borderRadius: 3, background: d.color || colors[i % colors.length], display: 'inline-block' }} />{d[nameKey]}</span>
          <span className="tnum"><b>{fmt ? fmt(d[valueKey]) : num(d[valueKey])}</b> <span className="muted">· {total ? ((d[valueKey] / total) * 100).toFixed(0) : 0}%</span></span>
        </div>
      ))}
    </div>
  );
}
export function Spark({ data, dataKey = 'v', color = '#2459C6', height = 34 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 3, bottom: 3, left: 0, right: 0 }}>
        <defs><linearGradient id="spk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity={0.25} /><stop offset="1" stopColor={color} stopOpacity={0} /></linearGradient></defs>
        <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={1.8} fill="url(#spk)" dot={false} isAnimationActive={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
