import React, { useEffect, useState } from 'react';
import { AppProvider, useApp } from './state/app.jsx';
import { Sidebar, Topbar } from './components/Layout.jsx';
import { ErrorBoundary } from './components/ui.jsx';
import { Mark } from './components/Logo.jsx';
import { buildDataset } from './data/generate.js';
import { setDataset } from './lib/query.js';
import DrawerHost from './components/Drawers.jsx';
import GroupOverview from './pages/GroupOverview.jsx';
import PaintsOverview from './pages/PaintsOverview.jsx';
import CountryPage from './pages/CountryPage.jsx';
import BranchPage from './pages/BranchPage.jsx';
import ProductsPage from './pages/ProductsPage.jsx';
import InventoryPage from './pages/InventoryPage.jsx';
import FinancePage from './pages/FinancePage.jsx';
import CustomersPage from './pages/CustomersPage.jsx';
import FeedbackPage from './pages/FeedbackPage.jsx';
import AlertsPage from './pages/AlertsPage.jsx';
import InsightsPage from './pages/InsightsPage.jsx';
import ReportsPage from './pages/ReportsPage.jsx';
import DemoBusinessPage from './pages/DemoBusinessPage.jsx';

function Router() {
  const { route } = useApp();
  if (route.biz === 'group') return <GroupOverview />;
  if (route.biz === 'furniture' || route.biz === 'construction') return <DemoBusinessPage id={route.biz} />;
  switch (route.page) {
    case 'country': return <CountryPage code={route.country} />;
    case 'branch': return <BranchPage id={route.branch} />;
    case 'products': return <ProductsPage />;
    case 'inventory': return <InventoryPage />;
    case 'finance': return <FinancePage />;
    case 'customers': return <CustomersPage />;
    case 'feedback': return <FeedbackPage />;
    case 'alerts': return <AlertsPage />;
    case 'insights': return <InsightsPage />;
    case 'reports': return <ReportsPage />;
    default: return <PaintsOverview />;
  }
}
function Shell() {
  const { collapsed, mobileNav, setMobileNav, toast, route } = useApp();
  return (
    <div className={`app ${collapsed ? 'collapsed' : ''}`}>
      <Sidebar />
      {mobileNav && <div className="overlay" style={{ zIndex: 35 }} onClick={() => setMobileNav(false)} />}
      <div className="main">
        <Topbar />
        <main className="main-scroll" id="main">
          <ErrorBoundary key={JSON.stringify(route)}><Router /></ErrorBoundary>
        </main>
      </div>
      <DrawerHost />
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
export default function App() {
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState(null);
  useEffect(() => {
    const t = setTimeout(() => {
      try { const ds = buildDataset(); setDataset(ds); setReady(true); } catch (e) { console.error(e); setErr(e); }
    }, 60);
    return () => clearTimeout(t);
  }, []);
  if (err) return <div style={{ padding: 40 }}><h2>Unable to prepare the demonstration dataset</h2><pre>{String(err.stack || err)}</pre></div>;
  if (!ready) return (
    <div style={{ height: '100vh', display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg,#0A1A33,#183262)', color: '#fff' }}>
      <div style={{ textAlign: 'center' }}>
        <Mark size={54} bg="#1B3A73" />
        <div className="serif" style={{ fontSize: 22, letterSpacing: '.12em', marginTop: 14 }}>NASH HOLDINGS</div>
        <div style={{ fontSize: 11, letterSpacing: '.3em', color: '#8FA6CC', marginTop: 4 }}>COMMAND CENTER</div>
        <div className="skeleton" style={{ width: 220, height: 4, margin: '26px auto 10px', opacity: .5 }} />
        <div style={{ fontSize: 12, color: '#AFC2E6' }}>Preparing fictional demonstration dataset…</div>
        <div style={{ fontSize: 11, color: '#6F86AE', marginTop: 6 }}>Designed by Obitrek · DEMO DATA</div>
      </div>
    </div>
  );
  return <AppProvider><Shell /></AppProvider>;
}
