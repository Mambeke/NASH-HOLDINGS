import React from 'react';
import { useApp } from '../state/app.jsx';
import { FilterBar, ScopeTags } from '../components/Layout.jsx';
import { Card, Kpi, DataTable, Badge, Notice, LinkBtn, Delta, Progress } from '../components/ui.jsx';
import { StackedBars, RankBars, SEMANTIC, PALETTE } from '../components/charts.jsx';
import { RevenueVsExpenses, alertsInScope } from '../components/panels.jsx';
import { getDS, kpis, expenseBreakdown, expenseByCategorySeries, lineAgg, rollup, branchRowsCompared, pct } from '../lib/query.js';
import { buildAlerts } from '../lib/alerts.js';
import { money, num, pctf, signedPct, signedMoney } from '../lib/format.js';
import { fmtDay } from '../lib/dates.js';

const varColor = (v, tol = 0.05) => (v == null ? undefined : v > tol ? 'var(--neg)' : v < -0.02 ? 'var(--pos)' : undefined);

export default function FinancePage() {
  const { q, pq, period, cur, grain, scope, goBranch, goCountry, setDrawer } = useApp();
  const ds = getDS();
  const m = (v, o) => money(v, cur.code, o);
  const k = kpis(q), p = pq ? kpis(pq) : null;
  const eb = expenseBreakdown(q, grain);
  const catSeries = expenseByCategorySeries(q, grain);
  const agg = lineAgg(q);
  const cats = rollup(agg.rows, (r) => r.category).sort((a, b) => b.rev - a.rev);
  const brs = branchRowsCompared(q, pq).filter((r) => r.rev > 0 || r.opex > 0);
  const partial = k.missingDays || 0;
  const pl = [
    { l: 'Revenue', v: k.rev, pv: p?.rev, strong: true },
    { l: 'Cost of goods sold (COGS)', v: -k.cogs, pv: p ? -p.cogs : null, indent: true },
    { l: 'Gross profit', v: k.gp, pv: p?.gp, strong: true },
    { l: 'Operating expenses (OpEx)', v: -k.opex, pv: p ? -p.opex : null, indent: true },
    { l: 'Operating profit (simulated)', v: k.opProfit, pv: p?.opProfit, strong: true },
  ];
  const expAlerts = buildAlerts().filter((a) => a.type === 'expense' && (!scope.country || a.country === scope.country) && (!scope.branch || a.branchId === scope.branch));
  const top = [...brs].sort((a, b) => (b.opex / (b.rev || 1)) - (a.opex / (a.rev || 1)));
  return (
    <>
      <FilterBar />
      <div className="page">
        <div className="page-head"><div><h1>Expenses & Profitability</h1><p>{period.label} · amounts in {cur.code} · COGS and operating expenses are reported separately and revenue is never shown as profit</p></div><ScopeTags /></div>
        <div className="col" style={{ gap: 14 }}>
          <Notice tone="info"><b>Simulated accounting assumptions.</b> Gross profit = revenue − COGS (unit cost × quantity). Operating profit = gross profit − branch operating expenses (salaries, rent, utilities, transport & logistics, marketing, maintenance, other) accrued daily. It excludes head-office costs, depreciation, interest and tax, so it is not net profit. All figures are fictional.</Notice>
          {partial > 0 && <Notice tone="warn"><b>Incomplete data.</b> {num(partial)} branch-day{partial === 1 ? '' : 's'} of sales data are missing in this scope, while expenses continue to accrue. Gross and operating profit are therefore understated and should be treated as indicative until the data arrives.</Notice>}
          <div className="grid g4">
            <Kpi label="Revenue" cur={cur} value={m(k.rev)} delta={p ? pct(k.rev, p.rev) : undefined} compareLabel={period.prev?.label} sub="sales, before any costs" />
            <Kpi label="Gross profit" cur={cur} value={m(k.gp)} delta={p ? pct(k.gp, p.gp) : undefined} compareLabel={period.prev?.label} sub={`Gross margin ${pctf(k.margin)}`} />
            <Kpi label="Operating expenses" cur={cur} value={m(k.opex)} delta={p ? pct(k.opex, p.opex) : undefined} goodWhen="down" compareLabel={period.prev?.label} sub={`${pctf(k.rev ? k.opex / k.rev : null)} of revenue`} />
            <Kpi label="Operating profit (simulated)" cur={cur} value={m(k.opProfit)} delta={p ? pct(k.opProfit, p.opProfit) : undefined} compareLabel={period.prev?.label} sub={`Operating margin ${pctf(k.opMargin)}`} tone={k.opProfit < 0 ? 'bad' : undefined} />
          </div>
          <div className="grid g-21">
            <RevenueVsExpenses q={q} grain={grain} />
            <Card title="Profit and loss summary" cur={cur} subtitle="Simulated management view" flush>
              <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Line</th><th className="r">{cur.code}</th><th className="r">% revenue</th><th className="r">vs prior</th></tr></thead><tbody>
                {pl.map((r) => (
                  <tr key={r.l} style={r.strong ? { fontWeight: 700, background: '#F7F9FC' } : undefined}>
                    <td style={r.indent ? { paddingLeft: 24 } : undefined}>{r.l}</td><td className="r">{r.v < 0 ? '−' : ''}{m(Math.abs(r.v))}</td><td className="r">{pctf(k.rev ? Math.abs(r.v) / k.rev : null)}</td>
                    <td className="r">{r.pv != null && r.pv !== 0 ? <Delta value={(r.v - r.pv) / Math.abs(r.pv)} small goodWhen={r.l.startsWith('Cost') || r.l.startsWith('Operating exp') ? 'down' : 'up'} /> : '—'}</td></tr>))}
              </tbody></table></div>
              <div className="tbl-foot"><span>Reconciles: revenue {m(k.rev)} − COGS {m(k.cogs)} − OpEx {m(k.opex)} = {m(k.opProfit)}</span></div>
            </Card>
          </div>
          <div className="grid g-21">
            <Card title="Operating expenses by category" cur={cur} subtitle={`Stacked per ${grain}; COGS is excluded`}>
              <StackedBars data={catSeries} keys={ds.expCats.map((c) => c.name)} colors={PALETTE} fmt={(v) => m(v)} height={280} />
            </Card>
            <Card title="Budget vs actual by category" cur={cur} subtitle="Variance = (actual − budget) ÷ budget" flush>
              <DataTable columns={[
                { key: 'name', header: 'Category', value: (r) => r.name },
                { key: 'actual', header: 'Actual', align: 'r', value: (r) => r.actual, render: (r) => m(r.actual) },
                { key: 'budget', header: 'Budget', align: 'r', value: (r) => r.budget, render: (r) => m(r.budget) },
                { key: 'varPct', header: 'Variance', align: 'r', value: (r) => r.varPct, render: (r) => <b style={{ color: varColor(r.varPct, 0.1) }}>{signedPct(r.varPct)}</b> },
              ]} rows={eb.categories} rowKey={(r) => r.id} footer={<span>Total: actual {m(k.opex)} vs budget {m(k.budget)} ({signedPct(k.budget ? (k.opex - k.budget) / k.budget : null)})</span>} />
            </Card>
          </div>
          {expAlerts.length > 0 && (
            <Card title="Expense anomalies" subtitle="Categories running materially above recent levels (rules-based)">
              {expAlerts.map((a) => <button key={a.id} className="alert-row" onClick={() => setDrawer({ type: 'alert', id: a.id })}><span className={`sev-bar ${a.severity}`} /><div className="grow"><b style={{ fontSize: 13 }}>{a.title}</b><div className="small muted">{a.what}</div></div></button>)}
            </Card>
          )}
          {!scope.branch && (
            <Card title="Expense ratio and margin by branch" cur={cur} subtitle="Click a branch to open it. OpEx ratio = operating expenses ÷ revenue." flush>
              <DataTable columns={[
                { key: 'name', header: 'Branch', value: (r) => r.name, render: (r) => <LinkBtn onClick={() => goBranch(r.id)}>{r.name}</LinkBtn> },
                { key: 'country', header: 'Country', value: (r) => r.country },
                { key: 'rev', header: 'Revenue', align: 'r', value: (r) => r.rev, render: (r) => m(r.rev) },
                { key: 'margin', header: 'Gross margin', align: 'r', value: (r) => r.margin, render: (r) => pctf(r.margin) },
                { key: 'opex', header: 'OpEx', align: 'r', value: (r) => r.opex, render: (r) => m(r.opex) },
                { key: 'ratio', header: 'OpEx ratio', align: 'r', value: (r) => (r.rev ? r.opex / r.rev : 0), render: (r) => pctf(r.rev ? r.opex / r.rev : null) },
                { key: 'budgetVar', header: 'OpEx vs budget', align: 'r', value: (r) => (r.budget ? (r.opex - r.budget) / r.budget : 0), render: (r) => <span style={{ color: varColor(r.budget ? (r.opex - r.budget) / r.budget : null, 0.1) }}>{signedPct(r.budget ? (r.opex - r.budget) / r.budget : null)}</span> },
                { key: 'opProfit', header: 'Operating profit', align: 'r', value: (r) => r.opProfit, render: (r) => <b style={{ color: r.opProfit < 0 ? 'var(--neg)' : undefined }}>{m(r.opProfit)}</b> },
                { key: 'dq', header: 'Data', value: (r) => r.dataStatus, render: (r) => (r.dataStatus === 'delayed' ? <Badge tone="warn">Incomplete</Badge> : <Badge tone="good">Complete</Badge>) },
              ]} rows={brs} rowKey={(r) => r.id} defaultSort={{ key: 'ratio', dir: 'desc' }} search pageSize={12} csvName="branch-profitability" csvPreamble={['DEMO DATA — fictional records', `Currency: ${cur.code}`, `Period: ${period.label}`, 'Operating profit = revenue − COGS − OpEx (simulated)']} />
            </Card>
          )}
          <div className="grid g2">
            <Card title="Gross margin by product category" subtitle="Share of revenue and margin; costs are unit-cost based">
              <DataTable columns={[
                { key: 'key', header: 'Category', value: (r) => r.key }, { key: 'rev', header: 'Revenue', align: 'r', value: (r) => r.rev, render: (r) => m(r.rev) },
                { key: 'cogs', header: 'COGS', align: 'r', value: (r) => r.cogs, render: (r) => m(r.cogs) }, { key: 'margin', header: 'Gross margin', align: 'r', value: (r) => r.margin, render: (r) => pctf(r.margin) },
              ]} rows={cats} rowKey={(r) => r.key} />
            </Card>
            {!scope.country && !scope.branch ? (
              <Card title="Operating expense ratio by country" subtitle="OpEx as a share of revenue (ratios, so currency-neutral)">
                <RankBars data={eb.countries.map((c) => ({ ...c, name: c.name, v: c.ratio }))} valueKey="v" fmt={(v) => pctf(v, 1)} labelFmt={(v) => pctf(v, 1)} onClick={(r) => goCountry(r.code)} nameWidth={80} />
              </Card>
            ) : (
              <Card title="Budget utilisation" subtitle="Actual OpEx as a share of budget for the period">
                <div className="col" style={{ gap: 10 }}>{eb.categories.map((c) => <div key={c.id}><div className="row-sb small"><b>{c.name}</b><span>{pctf(c.budget ? c.actual / c.budget : null, 0)} of budget</span></div><Progress value={c.budget ? Math.min(1.2, c.actual / c.budget) / 1.2 : 0} tone={c.varPct > 0.1 ? 'bad' : 'good'} /></div>)}</div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
