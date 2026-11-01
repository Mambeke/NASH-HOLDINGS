import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { resolvePeriod, grainFor, TODAY } from '../lib/dates.js';
import { makeQ, withRange, currencyFor, getDS } from '../lib/query.js';

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

export function parseHash(h) {
  const parts = (h || '').replace(/^#\/?/, '').split('/').filter(Boolean);
  const [biz = 'group', a, b] = parts;
  if (biz === 'group' || !['paints', 'furniture', 'construction'].includes(biz)) return { biz: 'group', page: 'overview' };
  if (biz !== 'paints') return { biz, page: 'overview' };
  if (a === 'country' && b) return { biz, page: 'country', country: b.toUpperCase() };
  if (a === 'branch' && b) return { biz, page: 'branch', branch: b.toUpperCase() };
  const pages = ['products', 'inventory', 'finance', 'customers', 'feedback', 'alerts', 'insights', 'reports'];
  return { biz, page: pages.includes(a) ? a : 'overview' };
}
export function routeToHash(r) {
  if (r.biz === 'group') return '#/group';
  if (r.biz !== 'paints') return `#/${r.biz}`;
  if (r.page === 'country') return `#/paints/country/${r.country}`;
  if (r.page === 'branch') return `#/paints/branch/${r.branch}`;
  return r.page === 'overview' ? '#/paints' : `#/paints/${r.page}`;
}

const LS_KEY = 'nash-cc-demo-state-v1';
const loadSaved = () => { try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch { return {}; } };

export function AppProvider({ children }) {
  const [route, setRouteState] = useState(() => parseHash(window.location.hash));
  const saved = useMemo(loadSaved, []);
  const [preset, setPreset] = useState('thisWeek');
  const [custom, setCustom] = useState({ d0: TODAY - 29, d1: TODAY });
  const [compare, setCompare] = useState('auto');
  const [currencyMode, setCurrencyMode] = useState('USD');
  const [storedScope, setStoredScope] = useState({});
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [drawer, setDrawer] = useState(null);
  const [alertState, setAlertState] = useState(saved.alerts || {});
  const [toast, setToast] = useState(null);
  const [assistantHistory, setAssistantHistory] = useState([]);

  useEffect(() => { try { localStorage.setItem(LS_KEY, JSON.stringify({ alerts: alertState })); } catch { /* storage unavailable */ } }, [alertState]);
  useEffect(() => {
    const on = () => { setRouteState(parseHash(window.location.hash)); setMobileNav(false); window.scrollTo?.(0, 0); document.querySelector('.main-scroll')?.scrollTo?.(0, 0); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  useEffect(() => { if (!toast) return undefined; const t = setTimeout(() => setToast(null), 3200); return () => clearTimeout(t); }, [toast]);

  const navigate = useCallback((r) => {
    const h = routeToHash(r);
    if (window.location.hash === h) setRouteState(r); else window.location.hash = h;
  }, []);

  const ds = getDS();
  const scope = useMemo(() => {
    if (route.biz !== 'paints') return {};
    if (route.page === 'country') { const city = storedScope.city && storedScope.city.startsWith(route.country) ? storedScope.city : undefined; return { country: route.country, city }; }
    if (route.page === 'branch') { const b = ds?.branchById.get(route.branch); return b ? { country: b.country, city: b.cityId, branch: b.id } : {}; }
    return storedScope;
  }, [route, storedScope, ds]);

  const period = useMemo(() => resolvePeriod(preset, custom, compare), [preset, custom, compare]);
  const cur = useMemo(() => currencyFor(scope, currencyMode), [scope, currencyMode, ds]);
  const q = useMemo(() => (ds ? makeQ(scope, period.d0, period.d1, currencyMode) : null), [scope, period, currencyMode, ds]);
  const pq = useMemo(() => (q && period.prev ? withRange(q, period.prev.d0, period.prev.d1) : null), [q, period]);
  const grain = useMemo(() => grainFor(period.days), [period]);

  const goGroup = () => navigate({ biz: 'group', page: 'overview' });
  const goPaints = (page = 'overview', clearScope = false) => { if (clearScope) setStoredScope({}); navigate({ biz: 'paints', page }); };
  const goCountry = (code) => { setStoredScope({ country: code }); navigate({ biz: 'paints', page: 'country', country: code }); };
  const goBranch = (id) => { const b = ds.branchById.get(id); if (!b) return; setStoredScope({ country: b.country, city: b.cityId, branch: b.id }); navigate({ biz: 'paints', page: 'branch', branch: id }); };
  const goBiz = (id) => navigate({ biz: id, page: 'overview' });

  const setCountryFilter = (code) => {
    if (route.page === 'country' || route.page === 'branch') { if (code) goCountry(code); else { setStoredScope({}); navigate({ biz: 'paints', page: 'overview' }); } return; }
    setStoredScope(code ? { country: code } : {});
  };
  const setCityFilter = (cityId) => {
    const country = cityId ? cityId.slice(0, 2) : scope.country;
    if (route.page === 'branch') { setStoredScope({ country, city: cityId || undefined }); navigate({ biz: 'paints', page: 'country', country }); return; }
    setStoredScope({ country, city: cityId || undefined });
  };
  const setBranchFilter = (id) => {
    if (!id) { if (route.page === 'branch') { setStoredScope({ country: scope.country, city: scope.city }); navigate({ biz: 'paints', page: 'country', country: scope.country }); } else setStoredScope({ country: scope.country, city: scope.city }); return; }
    if (route.page === 'country' || route.page === 'branch') { goBranch(id); return; }
    const b = ds.branchById.get(id); setStoredScope({ country: b.country, city: b.cityId, branch: id });
  };
  const selectPreset = (p) => { setPreset(p); };
  const setDateRange = (d0, d1) => { setCustom({ d0, d1 }); setPreset('custom'); };
  const resetFilters = () => { setPreset('thisWeek'); setCompare('auto'); setCurrencyMode('USD'); setStoredScope({}); if (route.page === 'country' || route.page === 'branch') navigate({ biz: 'paints', page: 'overview' }); setToast('Filters reset to defaults'); };
  const clearScope = () => { setStoredScope({}); if (route.page === 'country' || route.page === 'branch') navigate({ biz: 'paints', page: 'overview' }); };

  const updateAlert = (id, patch) => setAlertState((s) => ({ ...s, [id]: { ...(s[id] || {}), ...patch } }));
  const ackAlert = (id, v = true) => updateAlert(id, { ack: v, ackAt: v ? new Date().toISOString() : null });
  const addNote = (id, text) => { if (!text.trim()) return; setAlertState((s) => { const cur0 = s[id] || {}; return { ...s, [id]: { ...cur0, notes: [...(cur0.notes || []), { at: new Date().toISOString(), text: text.trim() }] } }; }); };

  const value = {
    route, navigate, scope, period, cur, q, pq, grain, preset, custom, compare, currencyMode, collapsed, setCollapsed, mobileNav, setMobileNav, drawer, setDrawer,
    setCompare, setCurrencyMode, selectPreset, setDateRange, setCustom, resetFilters, clearScope, setCountryFilter, setCityFilter, setBranchFilter,
    goGroup, goPaints, goCountry, goBranch, goBiz, alertState, ackAlert, addNote, toast, setToast, assistantHistory, setAssistantHistory,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
