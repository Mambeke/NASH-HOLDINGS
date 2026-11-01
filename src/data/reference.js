// Static reference data for the fictional Nash Holdings demonstration. ALL entities are fictional.
export const BUSINESSES = [
  { id: 'paints', name: 'Nash Paints', short: 'Paints', status: 'live', tagline: 'Fully developed demonstration business' },
  { id: 'furniture', name: 'Nash Furniture', short: 'Furniture', status: 'demo', tagline: 'Summary-level demonstration module' },
  { id: 'construction', name: 'Nash Construction Materials', short: 'Construction', status: 'demo', tagline: 'Summary-level demonstration module' },
];

export const COUNTRIES = [
  { code: 'ZW', name: 'Zimbabwe', currency: 'USD', baseRate: 1, decimals: 2, drift: 0, trend: 0.004, tz: 'CAT' },
  { code: 'BW', name: 'Botswana', currency: 'BWP', baseRate: 13.45, decimals: 2, drift: 0.0022, trend: 0.003, tz: 'CAT' },
  { code: 'ZM', name: 'Zambia', currency: 'ZMW', baseRate: 27.6, decimals: 2, drift: -0.0045, trend: 0.0045, tz: 'CAT' },
  { code: 'MW', name: 'Malawi', currency: 'MWK', baseRate: 1735, decimals: 0, drift: 0.0055, trend: 0.002, tz: 'CAT' },
  { code: 'KE', name: 'Kenya', currency: 'KES', baseRate: 129, decimals: 0, drift: 0.0012, trend: 0.007, tz: 'EAT' },
];
export const CURRENCIES = {
  USD: { code: 'USD', symbol: '$', name: 'US Dollar', decimals: 2 },
  BWP: { code: 'BWP', symbol: 'P', name: 'Botswana Pula', decimals: 2 },
  ZMW: { code: 'ZMW', symbol: 'K', name: 'Zambian Kwacha', decimals: 2 },
  MWK: { code: 'MWK', symbol: 'MK', name: 'Malawian Kwacha', decimals: 0 },
  KES: { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling', decimals: 0 },
};

// tier: F flagship, L large, M medium, S small  -> base transactions per trading day
export const TIER_TXN = { F: 17, L: 10.5, M: 7.2, S: 4.6 };
export const NETWORK = {
  ZW: [
    ['HRE', 'Harare', [['Harare Central', 'F'], ['Avondale', 'L'], ['Borrowdale', 'L'], ['Msasa Industrial', 'L'], ['Southerton', 'M']]],
    ['BYO', 'Bulawayo', [['Bulawayo Central', 'F'], ['Belmont', 'L'], ['Hillside', 'M']]],
    ['MUT', 'Mutare', [['Mutare Central', 'L'], ['Sakubva', 'M']]],
    ['GWE', 'Gweru', [['Gweru Central', 'M'], ['Mkoba', 'S']]],
    ['MSV', 'Masvingo', [['Masvingo Central', 'M']]],
    ['KWE', 'Kwekwe', [['Kwekwe Central', 'S']]],
    ['CHZ', 'Chinhoyi', [['Chinhoyi Central', 'S']]],
    ['VFA', 'Victoria Falls', [['Victoria Falls Town', 'M']]],
    ['KDM', 'Kadoma', [['Kadoma Central', 'S']]],
  ],
  BW: [
    ['GBE', 'Gaborone', [['Gaborone CBD', 'F'], ['Broadhurst', 'L'], ['Tlokweng', 'M'], ['Gaborone West Industrial', 'L']]],
    ['FRA', 'Francistown', [['Francistown Central', 'L'], ['Blue Jacket Street', 'M']]],
    ['MUB', 'Maun', [['Maun Central', 'M']]],
    ['KSN', 'Kasane', [['Kasane Town', 'S']]],
    ['PLP', 'Palapye', [['Palapye Central', 'S']]],
    ['SRW', 'Serowe', [['Serowe Central', 'S']]],
    ['LOB', 'Lobatse', [['Lobatse Central', 'S']]],
    ['SEP', 'Selebi-Phikwe', [['Selebi-Phikwe Central', 'S']]],
    ['MOL', 'Molepolole', [['Molepolole Central', 'S']]],
    ['JWA', 'Jwaneng', [['Jwaneng Town', 'S']]],
  ],
  ZM: [
    ['LUN', 'Lusaka', [['Lusaka Cairo Road', 'F'], ['Kabulonga', 'L'], ['Matero', 'M'], ['Chilenje', 'M']]],
    ['NLA', 'Ndola', [['Ndola Central', 'L'], ['Kansenshi', 'M']]],
    ['KIT', 'Kitwe', [['Kitwe Central', 'L'], ['Parklands', 'M']]],
    ['LVI', 'Livingstone', [['Livingstone Central', 'M']]],
    ['KBW', 'Kabwe', [['Kabwe Central', 'S']]],
    ['CIP', 'Chipata', [['Chipata Central', 'S']]],
  ],
  MW: [
    ['LLW', 'Lilongwe', [['Lilongwe City Centre', 'F'], ['Area 3', 'L'], ['Area 47', 'M'], ['Kanengo Industrial', 'L']]],
    ['BLZ', 'Blantyre', [['Blantyre Central', 'F'], ['Limbe', 'L'], ['Chichiri', 'M']]],
    ['MZU', 'Mzuzu', [['Mzuzu Central', 'L'], ['Luwinga', 'S']]],
    ['ZZU', 'Zomba', [['Zomba Central', 'S']]],
    ['MAN', 'Mangochi', [['Mangochi Town', 'S']]],
    ['KSU', 'Kasungu', [['Kasungu Central', 'S']]],
    ['SLM', 'Salima', [['Salima Town', 'S']]],
  ],
  KE: [
    ['NBO', 'Nairobi', [['Nairobi CBD', 'F'], ['Westlands', 'F'], ['Industrial Area', 'L'], ['Karen', 'M'], ['Eastleigh', 'L'], ['Kasarani', 'M']]],
    ['MBA', 'Mombasa', [['Mombasa Island', 'L'], ['Nyali', 'L'], ['Changamwe', 'M']]],
    ['KIS', 'Kisumu', [['Kisumu Central', 'L'], ['Milimani', 'M']]],
    ['NKR', 'Nakuru', [['Nakuru Town', 'L'], ['Lanet', 'S']]],
    ['ELD', 'Eldoret', [['Eldoret Town', 'M']]],
    ['THK', 'Thika', [['Thika Town', 'M']]],
    ['MCK', 'Machakos', [['Machakos Town', 'S']]],
    ['NYI', 'Nyeri', [['Nyeri Town', 'S']]],
    ['MLD', 'Malindi', [['Malindi Town', 'S']]],
    ['KTL', 'Kitale', [['Kitale Town', 'S']]],
  ],
};

export const COLOURS = [
  { name: 'Arctic White', code: 'NP-1001', hex: '#F4F4EF', pop: 1.0 },
  { name: 'Soft Linen', code: 'NP-1014', hex: '#E7DFCD', pop: 0.55 },
  { name: 'Savannah Sand', code: 'NP-1032', hex: '#D6C19C', pop: 0.5 },
  { name: 'Baobab Grey', code: 'NP-2008', hex: '#8E9190', pop: 0.46 },
  { name: 'Highveld Slate', code: 'NP-2021', hex: '#4F5B64', pop: 0.3 },
  { name: 'Lake Victoria Blue', code: 'NP-3005', hex: '#5F88A8', pop: 0.32 },
  { name: 'Midnight Navy', code: 'NP-3040', hex: '#1F2E4B', pop: 0.25 },
  { name: 'Kalahari Terracotta', code: 'NP-4012', hex: '#B5654A', pop: 0.36 },
  { name: 'Sunrise Ochre', code: 'NP-4030', hex: '#D2A33D', pop: 0.22 },
  { name: 'Acacia Green', code: 'NP-5003', hex: '#6E8B5E', pop: 0.3 },
  { name: 'Rose Quartz', code: 'NP-6002', hex: '#D9B9B1', pop: 0.2 },
  { name: 'Charcoal Black', code: 'NP-9001', hex: '#2C2E32', pop: 0.4 },
  { name: 'Teak Brown', code: 'NP-7002', hex: '#7A593D', pop: 0.4 },
  { name: 'Clear', code: 'NP-0001', hex: '#EAE6DA', pop: 0.4 },
];
const C = (n) => COLOURS.find((c) => c.name === n);

export const RANGES = [
  { id: 'INT-SILK', name: 'Nash Interior Silk', category: 'Interior Paint', perL: 6.2, margin: 0.43, pop: 1.0, colours: ['Arctic White', 'Soft Linen', 'Savannah Sand', 'Baobab Grey', 'Lake Victoria Blue', 'Rose Quartz'], sizes: [1, 5, 20] },
  { id: 'INT-MATT', name: 'Nash Interior Matt', category: 'Interior Paint', perL: 5.0, margin: 0.4, pop: 0.8, colours: ['Arctic White', 'Soft Linen', 'Highveld Slate', 'Acacia Green'], sizes: [5, 20] },
  { id: 'EXT-WG', name: 'Nash WeatherGuard Exterior', category: 'Exterior Paint', perL: 7.8, margin: 0.45, pop: 0.9, colours: ['Arctic White', 'Savannah Sand', 'Kalahari Terracotta', 'Sunrise Ochre', 'Baobab Grey', 'Midnight Navy'], sizes: [5, 20] },
  { id: 'EXT-MAS', name: 'Nash Masonry Finish', category: 'Exterior Paint', perL: 5.5, margin: 0.39, pop: 0.6, colours: ['Soft Linen', 'Baobab Grey', 'Kalahari Terracotta'], sizes: [20] },
  { id: 'PRM-UNI', name: 'Nash Universal Primer', category: 'Primers', perL: 4.5, margin: 0.37, pop: 0.85, colours: ['Arctic White'], sizes: [1, 5, 20] },
  { id: 'PRM-ALK', name: 'Nash Alkali-Resistant Primer', category: 'Primers', perL: 5.2, margin: 0.38, pop: 0.5, colours: ['Baobab Grey'], sizes: [5, 20] },
  { id: 'PRT-ROOF', name: 'Nash Roof Shield', category: 'Protective Coatings', perL: 6.9, margin: 0.41, pop: 0.6, colours: ['Kalahari Terracotta', 'Charcoal Black', 'Acacia Green'], sizes: [5, 20] },
  { id: 'PRT-MTL', name: 'Nash Metal Armour Enamel', category: 'Protective Coatings', perL: 9.6, margin: 0.47, pop: 0.5, colours: ['Charcoal Black', 'Arctic White', 'Midnight Navy', 'Sunrise Ochre'], sizes: [1, 5] },
  { id: 'PRT-WOOD', name: 'Nash Wood Guard Varnish', category: 'Protective Coatings', perL: 8.7, margin: 0.46, pop: 0.45, colours: ['Teak Brown', 'Clear'], sizes: [1, 5] },
  { id: 'PRT-DAMP', name: 'Nash Damp-Proof Coat', category: 'Protective Coatings', perL: 6.5, margin: 0.4, pop: 0.35, colours: ['Arctic White', 'Baobab Grey'], sizes: [5] },
];
export const SUPPLIES = [
  { name: 'Nash Brush Set (3-piece)', price: 11.5, margin: 0.5, unit: 'Set', pop: 0.45 },
  { name: 'Nash Roller Kit 230mm', price: 8.9, margin: 0.48, unit: 'Kit', pop: 0.5 },
  { name: 'Masking Tape 48mm', price: 2.8, margin: 0.52, unit: 'Roll', pop: 0.55 },
  { name: 'Nash Paint Thinners 5L', price: 14.5, margin: 0.36, unit: '5L', pop: 0.3 },
  { name: 'Nash Wall Filler 5kg', price: 9.9, margin: 0.42, unit: '5kg', pop: 0.4 },
  { name: 'Sandpaper Assortment Pack', price: 4.6, margin: 0.55, unit: 'Pack', pop: 0.35 },
  { name: 'Nash Paint Tray & Liner', price: 5.4, margin: 0.5, unit: 'Each', pop: 0.25 },
];
export const SIZE_FACTOR = { 1: 1.0, 5: 0.88, 20: 0.78 };
export const SIZE_POP = { 1: 0.7, 5: 1.0, 20: 0.55 };

export function buildCatalog() {
  const out = [];
  const pad = (n) => String(n).padStart(3, '0');
  for (const r of RANGES) {
    for (const cn of r.colours) {
      for (const L of r.sizes) {
        const colour = C(cn);
        const price = Math.round(r.perL * L * SIZE_FACTOR[L] * 2) / 2;
        const cost = Math.round(price * (1 - r.margin) * 100) / 100;
        out.push({
          idx: out.length, id: `NP-P${pad(out.length + 1)}`,
          sku: `${r.id}-${colour.code.slice(3)}-${L}L`,
          rangeId: r.id, range: r.name, category: r.category,
          name: `${r.name} · ${cn} · ${L}L`, shortName: `${r.name.replace('Nash ', '')} ${cn} ${L}L`,
          colour: cn, colourCode: colour.code, hex: colour.hex, size: `${L}L`, sizeL: L,
          price, cost,
          pop: r.pop * (r.colours.length === 1 ? 0.9 : colour.pop) * SIZE_POP[L],
        });
      }
    }
  }
  for (const s of SUPPLIES) {
    out.push({
      idx: out.length, id: `NP-P${pad(out.length + 1)}`,
      sku: `SUP-${String(out.length).padStart(3, '0')}`,
      rangeId: 'SUP', range: 'Related Supplies', category: 'Related Supplies',
      name: s.name, shortName: s.name, colour: '—', colourCode: '—', hex: null, size: s.unit, sizeL: 0,
      price: s.price, cost: Math.round(s.price * (1 - s.margin) * 100) / 100, pop: s.pop,
    });
  }
  return out;
}

export const SEGMENTS = [
  { id: 0, name: 'Homeowner', share: 0.45, lines: 1.25, qty: 1.25, size: { 1: 1.4, 5: 1.2, 20: 0.45 }, cat: { 'Interior Paint': 1.35, 'Exterior Paint': 0.8, Primers: 0.8, 'Protective Coatings': 0.5, 'Related Supplies': 1.3 }, pay: [0.4, 0.3, 0.27, 0.03, 0] },
  { id: 1, name: 'Painter / Decorator', share: 0.2, lines: 1.6, qty: 1.7, size: { 1: 0.8, 5: 1.3, 20: 1.1 }, cat: { 'Interior Paint': 1.1, 'Exterior Paint': 1.1, Primers: 1.2, 'Protective Coatings': 1.0, 'Related Supplies': 1.3 }, pay: [0.35, 0.22, 0.3, 0.08, 0.05] },
  { id: 2, name: 'Contractor', share: 0.15, lines: 1.8, qty: 2.0, size: { 1: 0.3, 5: 0.9, 20: 1.6 }, cat: { 'Interior Paint': 0.9, 'Exterior Paint': 1.35, Primers: 1.25, 'Protective Coatings': 1.4, 'Related Supplies': 0.8 }, pay: [0.12, 0.1, 0.18, 0.35, 0.25] },
  { id: 3, name: 'Property Developer', share: 0.04, lines: 2.0, qty: 3.2, size: { 1: 0.1, 5: 0.5, 20: 2.0 }, cat: { 'Interior Paint': 1.2, 'Exterior Paint': 1.4, Primers: 1.2, 'Protective Coatings': 1.1, 'Related Supplies': 0.4 }, pay: [0.02, 0.05, 0.05, 0.5, 0.38] },
  { id: 4, name: 'Reseller', share: 0.07, lines: 2.0, qty: 2.4, size: { 1: 1.1, 5: 1.5, 20: 1.0 }, cat: { 'Interior Paint': 1.0, 'Exterior Paint': 0.9, Primers: 1.0, 'Protective Coatings': 0.9, 'Related Supplies': 1.6 }, pay: [0.2, 0.1, 0.25, 0.3, 0.15] },
  { id: 5, name: 'Institution', share: 0.09, lines: 1.5, qty: 2.2, size: { 1: 0.3, 5: 1.0, 20: 1.5 }, cat: { 'Interior Paint': 1.2, 'Exterior Paint': 1.2, Primers: 1.0, 'Protective Coatings': 1.0, 'Related Supplies': 0.7 }, pay: [0.02, 0.05, 0.03, 0.5, 0.4] },
];
export const ANON_SEGMENT = 6; // "Anonymous walk-in"
export const SEGMENT_NAMES = [...SEGMENTS.map((s) => s.name), 'Anonymous walk-in'];
export const PAYMENT_METHODS = ['Cash', 'Card', 'Mobile Money', 'Bank Transfer', 'Account (credit)'];
export const EXPENSE_CATEGORIES = [
  { id: 0, name: 'Salaries & Wages', pct: 0.125, noise: 0.01, accrual: 'fixed' },
  { id: 1, name: 'Rent & Premises', pct: 0.06, noise: 0.0, accrual: 'fixed' },
  { id: 2, name: 'Utilities', pct: 0.025, noise: 0.12, accrual: 'var' },
  { id: 3, name: 'Transport & Logistics', pct: 0.035, noise: 0.2, accrual: 'var' },
  { id: 4, name: 'Maintenance', pct: 0.015, noise: 0.35, accrual: 'var' },
  { id: 5, name: 'Administration', pct: 0.02, noise: 0.08, accrual: 'fixed' },
  { id: 6, name: 'Marketing', pct: 0.015, noise: 0.25, accrual: 'var' },
];
export const REVIEW_CATEGORIES = ['Product quality', 'Staff service', 'Colour matching', 'Stock availability', 'Pricing', 'Wait time', 'Delivery'];

export const COMMENTS = {
  'Product quality': {
    pos: ['Coverage was excellent — two coats and the wall looks flawless.', 'Finish is smooth and durable, very happy with the paint.', 'Exterior coat has held up well through heavy rain.'],
    neg: ['The tin I bought seemed thin and needed three coats.', 'Paint started peeling within weeks on the exterior wall.', 'Batch appeared inconsistent compared with the previous one.'],
  },
  'Staff service': {
    pos: ['The team was knowledgeable and helped me choose the right primer.', 'Friendly, patient staff — they explained the quantities properly.', 'Quick service and a very helpful advisor.'],
    neg: ['Staff seemed uninterested and were slow to assist.', 'Nobody could advise me on the right product for damp walls.', 'Counter staff were short with customers during the rush.'],
  },
  'Colour matching': {
    pos: ['The colour matched my swatch perfectly.', 'Tinting was spot-on, exactly the shade I wanted.', 'Great tinting service — matched an old wall precisely.'],
    neg: ['The tinted colour was noticeably off from the colour card.', 'Two tins of the same colour did not match each other.', 'Colour matching machine seems to need calibration.'],
  },
  'Stock availability': {
    pos: ['Everything I needed was in stock, including the 20L size.', 'Good availability — no need to visit another branch.', 'Stocked the full range, which is rare.'],
    neg: ['The white interior paint I wanted was out of stock again.', 'Had to wait over a week for the size I needed.', 'Half the range I came for was unavailable.'],
  },
  Pricing: {
    pos: ['Fair pricing and the loyalty discount was appreciated.', 'Good value compared with other suppliers.'],
    neg: ['Prices felt high compared with last month.', 'Price on the shelf did not match the till.'],
  },
  'Wait time': {
    pos: ['Served quickly even on a busy Saturday.', 'Checkout was fast and efficient.'],
    neg: ['Waited more than 25 minutes to be served.', 'Only one till open and a long queue.'],
  },
  Delivery: {
    pos: ['Order was delivered on time and well packed.', 'Delivery driver was courteous and prompt.'],
    neg: ['Delivery arrived two days late.', 'One tin arrived dented and leaking.'],
  },
};

// ---- Simulation scenarios (all tied to the generated dataset; alerts are derived from the data they create) ----
export const SCENARIO_NOTE = 'Demonstration scenarios are injected into the fictional dataset so that alert rules have realistic situations to detect.';
