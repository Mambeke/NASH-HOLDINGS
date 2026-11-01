import React, { useMemo, useState } from 'react';
import {
  LayoutDashboard, Building2, Paintbrush, Armchair, HardHat, Boxes, Package, Landmark, Users, MessageSquareText, BellRing, Sparkles, FileText, ChevronRight,
  PanelLeftClose, PanelLeftOpen, Menu, Search, RotateCcw, X, Globe2, MapPin, Store, Info,
} from 'lucide-react';
import { useApp } from '../state/app.jsx';
import { Wordmark, Mark } from './Logo.jsx';
import { Select } from './ui.jsx';
import { PRESETS, COMPARES, fmtDay, dayToISO, isoToDay, TODAY, fmtRange } from '../lib/dates.js';
import { getDS } from '../lib/query.js';
import { buildAlerts } from '../lib/alerts.js';

export const SYNC_LABEL = '1 Nov 2026, 17:45 SAST';

const PAGES = [
  { id: 'overview', label: 'Command Center', icon: LayoutDashboard },
  { id: 'products', label: 'Products & Colours', icon: Paintbrush },
  { id: 'inventory', label: 'Inventory & Stock', icon: Boxes },
  { id: 'finance', label: 'Finance & Profitability', icon: Landmark },
  { id: 'customers', label: 'Customers & Loyalty', icon: Users },
  { id: 'feedback', label: 'Customer Experience', icon: MessageSquareText },
  { id: 'alerts', label: 'Executive Alerts', icon: BellRing },
  { id: 'insights', label: 'Executive Insights', icon: Sparkles },
  { id: 'reports', label: 'Reports & Exports', icon: FileText },
];
export const PAGE_LABEL = Object.fromEntries(PAGES.map((p) => [p.id, p.label]));

export function Sidebar() {
  const { route, collapsed, setCollapsed, mobileNav, setMobileNav, goGroup, goPaints, goBiz, goCountry, alertState } = useApp();
  const ds = getDS();
  const open = buildAlerts().filter((a) => !alertState[a.id]?.ack && (a.severity === 'critical' || a.severity === 'high')).length;
  const inPaints = route.biz === 'paints';
  const [marketsOpen, setMarketsOpen] = useState(true);
  return (
    <aside className={`sidebar ${mobileNav ? 'open' : ''}`} aria-label="Primary navigation">
      <div className="side-head">
        <button className="nav-item" style={{ padding: 0, background: 'none' }} onClick={goGroup} aria-label="Nash Holdings group overview"><Wordmark business="Holdings" compact={collapsed && !mobileNav} /></button>
        <button className="only-mobile icon-btn" style={{ marginLeft: 'auto', background: 'transparent', color: '#fff', borderColor: 'rgba(255,255,255,.2)' }} onClick={() => setMobileNav(false)} aria-label="Close menu"><X size={16} /></button>
      </div>
      <div className="side-scroll">
        <div className="side-label">Group</div>
        <button className={`nav-item ${route.biz === 'group' ? 'active' : ''}`} onClick={goGroup} title="Group overview"><Building2 size={18} /><span className="txt">Group Overview</span></button>
        <div className="side-label">Operating businesses</div>
        <button className={`nav-item ${inPaints ? 'active' : ''}`} onClick={() => goPaints('overview', true)} title="Nash Paints"><Paintbrush size={18} /><span className="txt">Nash Paints</span><span className="tag live">Live demo</span></button>
        {inPaints && (
          <div className="nav-sub">
            {PAGES.map((p) => (
              <button key={p.id} className={`nav-item ${route.page === p.id || (p.id === 'overview' && (route.page === 'country' || route.page === 'branch') && false) ? 'active' : ''}`} onClick={() => goPaints(p.id)} title={p.label}>
                <p.icon size={15} /><span className="txt">{p.label}</span>{p.id === 'alerts' && open > 0 && <span className="badge-count">{open}</span>}
              </button>
            ))}
            <button className="nav-item" style={{ marginTop: 4 }} onClick={() => setMarketsOpen(!marketsOpen)}><Globe2 size={15} /><span className="txt">Markets</span><ChevronRight size={13} style={{ transform: marketsOpen ? 'rotate(90deg)' : 'none', transition: '.15s' }} /></button>
            {marketsOpen && ds.countries.map((c) => (
              <button key={c.code} className={`nav-item ${(route.page === 'country' && route.country === c.code) || (route.page === 'branch' && route.branch?.startsWith(c.code)) ? 'active' : ''}`} style={{ paddingLeft: 24 }} onClick={() => goCountry(c.code)}>
                <span className="txt">{c.name}</span><span className="tag">{c.branchCount}</span>
              </button>
            ))}
          </div>
        )}
        <button className={`nav-item ${route.biz === 'furniture' ? 'active' : ''}`} onClick={() => goBiz('furniture')} title="Nash Furniture (demonstration)"><Armchair size={18} /><span className="txt">Nash Furniture</span><span className="tag">Demo</span></button>
        <button className={`nav-item ${route.biz === 'construction' ? 'active' : ''}`} onClick={() => goBiz('construction')} title="Nash Construction Materials (demonstration)"><HardHat size={18} /><span className="txt">Construction Materials</span><span className="tag">Demo</span></button>
      </div>
      <div className="side-foot">
        <button className="icon-btn hide-tablet" style={{ background: 'transparent', color: '#C9D5EA', borderColor: 'rgba(255,255,255,.14)' }} onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'} title={collapsed ? 'Expand navigation' : 'Collapse navigation'}>
          {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </button>
        <span className="side-foot-txt">Designed by <b style={{ color: '#C9D5EA' }}>Obitrek</b><br />Prototype · fictional data</span>
      </div>
    </aside>
  );
}

function GlobalSearch() {
  const { goBranch, goCountry, goPaints, setDrawer } = useApp();
  const ds = getDS();
  const [t, setT] = useState('');
  const [focus, setFocus] = useState(false);
  const results = useMemo(() => {
    const s = t.trim().toLowerCase(); if (s.length < 2) return [];
    const out = [];
    ds.countries.forEach((c) => { if (c.name.toLowerCase().includes(s)) out.push({ k: 'c' + c.code, icon: Globe2, label: c.name, sub: 'Country dashboard', run: () => goCountry(c.code) }); });
    ds.branches.forEach((b) => { if (out.length < 14 && (b.name + ' ' + b.city + ' ' + b.id).toLowerCase().includes(s)) out.push({ k: b.id, icon: Store, label: b.name, sub: `${b.city}, ${ds.countryByCode.get(b.country).name} · ${b.id}`, run: () => goBranch(b.id) }); });
    ds.catalog.forEach((p) => { if (out.length < 20 && (p.name + ' ' + p.sku).toLowerCase().includes(s)) out.push({ k: p.id, icon: Paintbrush, label: p.name, sub: `${p.sku} · inspect product`, run: () => setDrawer({ type: 'product', idx: p.idx }) }); });
    return out.slice(0, 12);
  }, [t, ds]);
  return (
    <div className="search-wrap">
      <Search size={15} />
      <input placeholder="Find branch, country or product…" value={t} onChange={(e) => setT(e.target.value)} onFocus={() => setFocus(true)} onBlur={() => setTimeout(() => setFocus(false), 150)} aria-label="Global search" />
      {focus && t.trim().length >= 2 && (
        <div className="search-pop">
          {results.length === 0 && <div className="empty" style={{ padding: 16 }}>No matches</div>}
          {results.map((r) => <button key={r.k} onMouseDown={(e) => { e.preventDefault(); r.run(); setT(''); }}><r.icon size={15} color="#64748B" /><span className="grow"><b>{r.label}</b><br /><span className="muted xs">{r.sub}</span></span></button>)}
        </div>
      )}
    </div>
  );
}

export function Topbar() {
  const { route, goGroup, goPaints, goCountry, goBiz, setMobileNav, scope } = useApp();
  const ds = getDS();
  const crumbs = [{ label: 'Nash Holdings', go: goGroup }];
  if (route.biz === 'paints') {
    crumbs.push({ label: 'Nash Paints', go: () => goPaints('overview', true) });
    if (route.page === 'country') crumbs.push({ label: ds.countryByCode.get(route.country)?.name || route.country });
    else if (route.page === 'branch') {
      const b = ds.branchById.get(route.branch);
      if (b) { crumbs.push({ label: ds.countryByCode.get(b.country).name, go: () => goCountry(b.country) }); crumbs.push({ label: b.name }); }
    } else if (route.page !== 'overview') crumbs.push({ label: PAGE_LABEL[route.page] });
  } else if (route.biz === 'furniture') crumbs.push({ label: 'Nash Furniture' });
  else if (route.biz === 'construction') crumbs.push({ label: 'Nash Construction Materials' });
  crumbs[crumbs.length - 1].cur = true;
  return (
    <header className="topbar">
      <button className="icon-btn only-mobile" onClick={() => setMobileNav(true)} aria-label="Open navigation"><Menu size={18} /></button>
      <nav className="crumbs" aria-label="Breadcrumb">
        {crumbs.map((c, i) => (
          <React.Fragment key={i}>
            {i > 0 && <ChevronRight size={14} />}
            {c.cur ? <span className="cur">{c.label}</span> : <button onClick={c.go}>{c.label}</button>}
          </React.Fragment>
        ))}
      </nav>
      <div style={{ flex: 1 }} />
      <GlobalSearch />
      <span className="demo-pill" title="All data in this prototype is fictional and simulated. It is not connected to any POS, ERP or accounting system."><i /><span>DEMO DATA</span></span>
      <div className="hide-tablet row" style={{ gap: 6 }}><span className="xs muted">Designed by</span><b style={{ fontSize: 12, letterSpacing: '.06em' }}>OBITREK</b></div>
    </header>
  );
}

export function FilterBar({ showScope = true, compareControl = true }) {
  const { period, preset, custom, selectPreset, setDateRange, compare, setCompare, scope, setCountryFilter, setCityFilter, setBranchFilter, currencyMode, setCurrencyMode, resetFilters, clearScope, cur, route } = useApp();
  const ds = getDS();
  const cities = ds.cities.filter((c) => !scope.country || c.country === scope.country);
  const branches = ds.branches.filter((b) => (!scope.country || b.country === scope.country) && (!scope.city || b.cityId === scope.city));
  const hasScope = scope.country || scope.city || scope.branch;
  return (
    <div className="filterbar no-print" role="region" aria-label="Filters">
      <div className="filter-row">
        <div className="chips" role="group" aria-label="Date range presets">
          {PRESETS.map((p) => <button key={p.id} className={`chip ${preset === p.id ? 'on' : ''}`} onClick={() => selectPreset(p.id)}>{p.label}</button>)}
        </div>
        {preset === 'custom' && (
          <div className="row">
            <input className="input" type="date" min="2025-01-01" max={dayToISO(TODAY)} value={dayToISO(period.d0)} onChange={(e) => e.target.value && setDateRange(isoToDay(e.target.value), Math.max(isoToDay(e.target.value), custom.d1))} aria-label="Start date" />
            <span className="muted">→</span>
            <input className="input" type="date" min="2025-01-01" max={dayToISO(TODAY)} value={dayToISO(period.d1)} onChange={(e) => e.target.value && setDateRange(Math.min(custom.d0, isoToDay(e.target.value)), isoToDay(e.target.value))} aria-label="End date" />
          </div>
        )}
        <span className="small muted nowrap" title="Reporting period"><b style={{ color: 'var(--text-2)' }}>{fmtRange(period)}</b>{period.prev && <> · vs {fmtRange(period.prev)}</>}</span>
        <div style={{ flex: 1 }} />
        <span className="sync" title="Simulated synchronisation time: this prototype is not connected to a live system"><i className="dot" />Last sync (simulated): {SYNC_LABEL}</span>
        <span className="demo-pill"><i /><span>DEMO DATA</span></span>
      </div>
      <div className="filter-row">
        {showScope && (
          <>
            <Select label="Country" value={scope.country || ''} onChange={(v) => setCountryFilter(v || undefined)} placeholder="All countries" options={ds.countries.map((c) => ({ value: c.code, label: `${c.name} (${c.branchCount})` }))} />
            <Select label="City" value={scope.city || ''} onChange={(v) => setCityFilter(v || undefined)} placeholder="All cities" options={cities.map((c) => ({ value: c.id, label: scope.country ? c.name : `${c.name} · ${c.country}` }))} />
            <div className="field">
              <label>Branch</label>
              <select className="select" value={scope.branch || ''} onChange={(e) => setBranchFilter(e.target.value || undefined)} aria-label="Branch filter" style={{ maxWidth: 240 }}>
                <option value="">All branches ({branches.length})</option>
                {scope.country || scope.city ? branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>) : ds.countries.map((c) => <optgroup key={c.code} label={c.name}>{branches.filter((b) => b.country === c.code).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</optgroup>)}
              </select>
            </div>
          </>
        )}
        {compareControl && <Select label="Compare" value={compare} onChange={setCompare} options={COMPARES.map((c) => ({ value: c.id, label: c.label }))} />}
        <div className="field">
          <label>Currency</label>
          <div className="seg" role="group" aria-label="Reporting currency mode">
            <button className={currencyMode === 'USD' ? 'on' : ''} onClick={() => setCurrencyMode('USD')} title="Consolidated group reporting in USD">Group · USD</button>
            <button className={currencyMode === 'LOCAL' ? 'on' : ''} onClick={() => setCurrencyMode('LOCAL')} title="Local currency view (requires a single country or branch)">Local</button>
          </div>
        </div>
        {cur.forced && <span className="badge warn" title="Select a country or branch to see local currency values. Raw amounts in different currencies are never added together.">Local needs one country · showing USD</span>}
        {cur.local && <span className="badge good">Showing {cur.code}</span>}
        <div style={{ flex: 1 }} />
        {hasScope && <button className="btn sm" onClick={clearScope}><X size={13} />Clear location</button>}
        <button className="btn sm" onClick={resetFilters}><RotateCcw size={13} />Reset all</button>
      </div>
    </div>
  );
}

export function ScopeTags() {
  const { scope, clearScope } = useApp();
  const ds = getDS();
  if (!scope.country) return <span className="badge blue">All 5 countries · 74 branches</span>;
  const parts = [ds.countryByCode.get(scope.country).name];
  if (scope.city) parts.push(ds.cities.find((c) => c.id === scope.city)?.name);
  if (scope.branch) parts.push(ds.branchById.get(scope.branch)?.name);
  return <div className="scope-tags"><span className="scope-tag"><MapPin size={12} />{parts.join(' › ')}<button onClick={clearScope} aria-label="Clear location filter"><X size={10} /></button></span></div>;
}
