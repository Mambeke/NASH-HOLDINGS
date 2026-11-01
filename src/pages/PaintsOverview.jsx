import React from 'react';
import { useApp } from '../state/app.jsx';
import { FilterBar, ScopeTags } from '../components/Layout.jsx';
import { KpiGrid, TodayStrip, TrendCard, RevenueVsExpenses, ChangeRadar, CountryBars, CountryRanking, BranchLists, ProductColourPanel, CustomerMix, TargetPanel, AlertsPanel } from '../components/panels.jsx';
import { SectionTitle, Notice } from '../components/ui.jsx';
import { getDS } from '../lib/query.js';

export default function PaintsOverview() {
  const { q, pq, period, scope, currencyMode, cur } = useApp();
  const ds = getDS();
  return (
    <>
      <FilterBar />
      <div className="page">
        <div className="page-head">
          <div>
            <h1>Nash Paints Command Center</h1>
            <p>Consolidated trading performance across 5 countries and 74 branches · {period.label}</p>
          </div>
          <ScopeTags />
        </div>
        <div className="col" style={{ gap: 14 }}>
          <TodayStrip scope={scope} currencyMode={currencyMode} />
          <KpiGrid q={q} pq={pq} period={period} />
          {!period.prev && <Notice tone="warn">No comparison period is available for this selection (the demo history starts on 1 Jan 2025). Change the comparison option or date range to see change indicators.</Notice>}
          <div className="grid g-32">
            <TrendCard q={q} pq={pq} period={period} />
            <ChangeRadar q={q} period={period} />
          </div>
          <div className="grid g-12" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.6fr)' }}>
            <CountryBars q={q} pq={pq} />
            <CountryRanking q={q} pq={pq} period={period} />
          </div>
          <div className="grid g-21" style={{ gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1fr)' }}>
            <RevenueVsExpenses q={q} />
            <TargetPanel q={q} />
          </div>
          <BranchLists q={q} pq={pq} />
          <ProductColourPanel q={q} />
          <div className="grid g-21" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.3fr)' }}>
            <CustomerMix q={q} pq={pq} />
            <AlertsPanel scope={scope} />
          </div>
        </div>
      </div>
    </>
  );
}
