import React, { useState } from 'react';
import { CheckCircle2, Check, Undo2, MessageSquare } from 'lucide-react';
import { useApp } from '../state/app.jsx';
import { FilterBar, ScopeTags, SYNC_LABEL } from '../components/Layout.jsx';
import { Card, Kpi, Badge, SeverityBadge, Notice, Empty, Seg } from '../components/ui.jsx';
import { alertsInScope } from '../components/panels.jsx';
import { SEVERITY, ALERT_TYPES } from '../lib/alerts.js';
import { getDS } from '../lib/query.js';
import { fmtDay } from '../lib/dates.js';

export default function AlertsPage() {
  const { scope, alertState, ackAlert, setDrawer } = useApp();
  const ds = getDS();
  const [sev, setSev] = useState('all');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('open');
  const all = alertsInScope(scope);
  const isAck = (a) => !!alertState[a.id]?.ack;
  const list = all.filter((a) => (sev === 'all' || a.severity === sev) && (!type || a.type === type) && (status === 'all' || (status === 'open') === !isAck(a)))
    .sort((a, b) => (SEVERITY[a.severity].rank - SEVERITY[b.severity].rank) || a.title.localeCompare(b.title));
  const cnt = (s) => all.filter((a) => a.severity === s && !isAck(a)).length;
  const notes = all.reduce((n, a) => n + (alertState[a.id]?.notes?.length || 0), 0);
  return (
    <>
      <FilterBar showScope compareControl={false} />
      <div className="page">
        <div className="page-head"><div><h1>Executive Alerts</h1><p>Rules-based signals computed from the fictional dataset as of the latest simulated sync ({SYNC_LABEL}). Alerts are independent of the date filter.</p></div><ScopeTags /></div>
        <div className="col" style={{ gap: 14 }}>
          <Notice tone="info"><b>Acknowledgement and follow-up notes are recorded locally in this browser only.</b> The prototype does not send emails, messages or tasks, and it has not contacted anyone about any alert. Use the follow-up note to record who you intend to ask.</Notice>
          <div className="grid g5">
            <Kpi label="Critical (open)" value={cnt('critical')} tone={cnt('critical') ? 'bad' : undefined} sub="needs same-day attention" />
            <Kpi label="High (open)" value={cnt('high')} sub="review this week" />
            <Kpi label="Medium (open)" value={cnt('medium')} sub="monitor" />
            <Kpi label="Opportunities (open)" value={cnt('info')} sub="demand and growth signals" />
            <Kpi label="Acknowledged / notes" value={`${all.filter(isAck).length} / ${notes}`} sub="stored locally" />
          </div>
          <Card title="Alerts" subtitle={`${list.length} of ${all.length} alerts shown`} flush
            actions={<div className="row wrap">
              <Seg small value={status} onChange={setStatus} options={[{ id: 'open', label: 'Open' }, { id: 'ack', label: 'Acknowledged' }, { id: 'all', label: 'All' }]} />
              <select className="select" value={sev} onChange={(e) => setSev(e.target.value)} aria-label="Severity"><option value="all">All severities</option>{Object.entries(SEVERITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
              <select className="select" value={type} onChange={(e) => setType(e.target.value)} aria-label="Alert type"><option value="">All types</option>{Object.entries(ALERT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            </div>}>
            {list.length === 0 && <Empty title={status === 'open' ? 'No open alerts match these filters' : 'No alerts match these filters'} hint="Change the severity, type or status filter, or widen the location filter." icon={<CheckCircle2 size={28} />} />}
            {list.map((a) => {
              const s = alertState[a.id]; const loc = a.branchId ? ds.branchById.get(a.branchId)?.name : a.country ? ds.countryByCode.get(a.country)?.name : 'Group';
              return (
                <div key={a.id} className={`alert-row ${isAck(a) ? 'ack' : ''}`} style={{ alignItems: 'flex-start' }}>
                  <span className={`sev-bar ${a.severity}`} style={{ alignSelf: 'stretch' }} />
                  <button className="grow" style={{ background: 'none', border: 0, textAlign: 'left', padding: 0 }} onClick={() => setDrawer({ type: 'alert', id: a.id })}>
                    <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}><b style={{ fontSize: 13.5 }}>{a.title}</b><SeverityBadge severity={a.severity} /><Badge>{ALERT_TYPES[a.type]}</Badge><span className="xs muted">{loc}</span></div>
                    <div className="small muted" style={{ marginTop: 3 }}>{a.what.length > 260 ? a.what.slice(0, 258) + '…' : a.what}</div>
                    <div className="row xs muted" style={{ gap: 10, marginTop: 4 }}>{isAck(a) && <Badge tone="good">Acknowledged {new Date(s.ackAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}</Badge>}{s?.notes?.length ? <span className="row" style={{ gap: 4 }}><MessageSquare size={12} />{s.notes.length} follow-up note{s.notes.length > 1 ? 's' : ''}</span> : null}<span className="link">Open evidence →</span></div>
                  </button>
                  <button className="btn sm" onClick={() => ackAlert(a.id, !isAck(a))}>{isAck(a) ? <><Undo2 size={13} />Reopen</> : <><Check size={13} />Acknowledge</>}</button>
                </div>
              );
            })}
          </Card>
        </div>
      </div>
    </>
  );
}
