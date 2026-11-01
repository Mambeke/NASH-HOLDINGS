import React, { useRef, useState, useEffect } from 'react';
import { Send, Bot, User, Trash2, ArrowUpRight, AlertCircle } from 'lucide-react';
import { useApp } from '../state/app.jsx';
import { FilterBar, ScopeTags } from '../components/Layout.jsx';
import { Card, Notice, Badge, LinkBtn, SeverityBadge } from '../components/ui.jsx';
import { answer, EXAMPLES } from '../lib/assistant.js';
import { kpis, countryRowsCompared, pct } from '../lib/query.js';
import { buildAlerts } from '../lib/alerts.js';
import { money, num, pctf, signedPct } from '../lib/format.js';
import { fmtRange } from '../lib/dates.js';

function Answer({ a, onFollow }) {
  const { setDrawer, goBranch, goCountry, goPaints, goBiz } = useApp();
  const go = (l) => { if (l.kind === 'alert') setDrawer({ type: 'alert', id: l.id }); else if (l.kind === 'branch') goBranch(l.id); else if (l.kind === 'country') goCountry(l.code); else if (l.kind === 'page') goPaints(l.page); else if (l.kind === 'biz') goBiz(l.id); };
  return (
    <div>
      <div style={{ fontWeight: 650, fontSize: 14.5, marginBottom: 6 }}>{a.title}</div>
      {a.paras.map((p, i) => <p key={i} style={{ margin: '0 0 6px', lineHeight: 1.5 }}>{p}</p>)}
      {a.bullets.length > 0 && <ul style={{ margin: '6px 0 8px', paddingLeft: 18, lineHeight: 1.55 }}>{a.bullets.map((b, i) => <li key={i}>{b}</li>)}</ul>}
      {a.table && <div className="tbl-wrap" style={{ margin: '8px 0' }}><table className="tbl dense"><thead><tr>{a.table.cols.map((c, i) => <th key={c} className={i ? 'r' : ''}>{c}</th>)}</tr></thead><tbody>{a.table.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={j ? 'r' : ''}>{c}</td>)}</tr>)}</tbody></table></div>}
      {a.links.length > 0 && <div className="row wrap" style={{ gap: 6, margin: '8px 0' }}>{a.links.map((l, i) => <button key={i} className="btn sm" onClick={() => go(l)}>{l.label}<ArrowUpRight size={12} /></button>)}</div>}
      <div className="xs muted" style={{ borderTop: '1px solid var(--line-2)', paddingTop: 6, marginTop: 6 }}>{a.basis}</div>
      {a.followups.length > 0 && <div className="row wrap" style={{ gap: 6, marginTop: 8 }}><span className="xs muted">Try next:</span>{a.followups.map((f) => <button key={f} className="chip ex" onClick={() => onFollow(f)}>{f}</button>)}</div>}
    </div>
  );
}

export default function InsightsPage() {
  const { scope, period, alertState, assistantHistory, setAssistantHistory, q, pq, cur, setDrawer, goCountry } = useApp();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);
  const ask = (qs) => {
    const s = (qs ?? text).trim(); if (!s || busy) return;
    setText(''); setBusy(true);
    setAssistantHistory((h) => [...h, { role: 'user', text: s }]);
    setTimeout(() => {
      let a;
      try { a = answer(s, { scope, period, alertState }); } catch (e) { console.error(e); a = { title: 'Something went wrong', paras: ['The analysis failed for this question. Please try another.'], bullets: [], links: [], followups: [], basis: String(e.message) }; }
      setAssistantHistory((h) => [...h, { role: 'bot', a }]); setBusy(false);
    }, 280);
  };
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }); }, [assistantHistory.length]);
  const k = kpis(q), p = pq ? kpis(pq) : null;
  const co = countryRowsCompared(q, pq).filter((c) => c.growthUsd != null);
  const best = [...co].sort((a, b) => b.growthUsd - a.growthUsd)[0], worst = [...co].sort((a, b) => a.growthUsd - b.growthUsd)[0];
  const top = buildAlerts().filter((a) => a.severity !== 'info' && !alertState[a.id]?.ack).slice(0, 4);
  return (
    <>
      <FilterBar compareControl={false} />
      <div className="page">
        <div className="page-head"><div><h1>Executive Insights</h1><p>Ask questions about the demo data. Context follows the current location and date filters unless you name a branch, city, country or period.</p></div><ScopeTags /></div>
        <div className="mt-8"><Notice tone="warn" icon={<AlertCircle size={16} />}><b>This is a demonstration assistant, not artificial intelligence.</b> It uses keyword and entity rules to run fixed analyses over the fictional dataset. It cannot browse, reason beyond those rules, or access real systems; every answer states its basis and anything it cannot support is declined.</Notice></div>
        <div className="grid mt-12" style={{ gridTemplateColumns: 'minmax(0,1.7fr) minmax(0,1fr)', alignItems: 'start' }}>
          <Card title="Ask the demo assistant" subtitle={`Default context: ${period.label} · ${fmtRange(period.d0, period.d1)}`} actions={assistantHistory.length ? <button className="btn sm" onClick={() => setAssistantHistory([])}><Trash2 size={13} />Clear</button> : null}>
            <div style={{ minHeight: 320, maxHeight: 560, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 14, paddingRight: 4 }} aria-live="polite">
              {assistantHistory.length === 0 && (
                <div className="col" style={{ gap: 10 }}>
                  <div className="small muted">Pick an example or type your own question. Examples:</div>
                  <div className="row wrap" style={{ gap: 8 }}>{EXAMPLES.map((e) => <button key={e} className="chip ex" onClick={() => ask(e)}>{e}</button>)}</div>
                </div>)}
              {assistantHistory.map((m, i) => m.role === 'user' ? (
                <div key={i} style={{ alignSelf: 'flex-end', maxWidth: '82%', background: 'var(--navy-800)', color: '#fff', padding: '8px 12px', borderRadius: '12px 12px 2px 12px' }}><span className="row" style={{ gap: 6 }}><User size={13} />{m.text}</span></div>
              ) : (
                <div key={i} style={{ maxWidth: '96%', background: '#F6F8FC', border: '1px solid var(--line)', padding: '12px 14px', borderRadius: '12px 12px 12px 2px' }}>
                  <div className="row" style={{ gap: 6, marginBottom: 6 }}><Bot size={14} /><Badge tone="neutral">Rules-based analysis of demo data</Badge></div>
                  <Answer a={m.a} onFollow={ask} />
                </div>))}
              {busy && <div className="small muted">Analysing the dataset…</div>}
              <div ref={endRef} />
            </div>
            <form className="row" style={{ gap: 8, marginTop: 12 }} onSubmit={(e) => { e.preventDefault(); ask(); }}>
              <input className="input grow" style={{ height: 38 }} value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Why did Harare Central decline?" aria-label="Question" />
              <button className="btn primary" type="submit" disabled={!text.trim() || busy}><Send size={14} />Ask</button>
            </form>
            {assistantHistory.length > 0 && <div className="row wrap" style={{ gap: 6, marginTop: 10 }}>{EXAMPLES.slice(0, 5).map((e) => <button key={e} className="chip ex" onClick={() => ask(e)}>{e}</button>)}</div>}
          </Card>
          <div className="col" style={{ gap: 14 }}>
            <Card title="Briefing" cur={cur} subtitle={`Computed from the data for ${period.label.toLowerCase()} — not generated text`}>
              <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }} className="small">
                <li>Revenue {money(k.rev, cur.code)}{p ? ` (${signedPct(pct(k.rev, p.rev))} vs ${period.prev.label.toLowerCase()})` : ''}; gross margin {pctf(k.margin)}.</li>
                {best && <li>Fastest growing market: <LinkBtn onClick={() => goCountry(best.code)}>{best.name}</LinkBtn> ({signedPct(best.growthUsd)}).</li>}
                {worst && worst.growthUsd < 0 && <li>Weakest market: <LinkBtn onClick={() => goCountry(worst.code)}>{worst.name}</LinkBtn> ({signedPct(worst.growthUsd)}).</li>}
                <li>{num(buildAlerts().filter((a) => a.severity !== 'info' && !alertState[a.id]?.ack).length)} alerts are open across the group.</li>
              </ul>
            </Card>
            <Card title="Open alerts" flush>
              {top.map((a) => <button key={a.id} className="alert-row" onClick={() => setDrawer({ type: 'alert', id: a.id })}><span className={`sev-bar ${a.severity}`} /><div className="grow"><div className="row-sb"><b style={{ fontSize: 12.5 }}>{a.title}</b><SeverityBadge severity={a.severity} /></div></div></button>)}
              {top.length === 0 && <div className="small muted" style={{ padding: 16 }}>All alerts acknowledged.</div>}
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
