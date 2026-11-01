# Nash Holdings Command Center — demonstration prototype
Designed by Obitrek. **All data is fictional**, generated in the browser from a seeded model (`src/data/generate.js`). It is not connected to any ERP, POS or accounting system.

## Run
    npm install
    npm run dev        # http://localhost:5173
    npm run build      # production bundle in dist/
    npm run test:data  # node sanity checks on the dataset and alert rules

## Architecture
- `src/data/` seeded dataset (74 branches, 5 countries, 73 SKUs, ~23 months of transactions, stock, expenses, reviews) + Furniture/Construction summary demos
- `src/lib/query.js` the single analytics layer: every screen, report, alert and assistant answer reads from it
- `src/lib/alerts.js` rules-based alerts · `assistant.js` deterministic (non-AI) assistant · `reports.js` 8 reports with reconciliation checks
- `src/components/` charts (Recharts), UI kit, layout, shared panels, inspectors (drawers) · `src/pages/` one file per screen · `src/state/app.jsx` filters/route/alert state (alert acknowledgements and notes persist in localStorage only)

## Scenarios built into the data (as of 1 Nov 2026)
Harare Central decline and Arctic White stock-outs; Malawi decline and supplier delay; Zambia logistics cost spike; Kenya and Botswana demand spikes; Kasane Town and Selebi-Phikwe Central data delays; below-target branches; rating drops.
