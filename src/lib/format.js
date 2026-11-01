import { CURRENCIES } from '../data/reference.js';

const nf0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const num = (v, d = 0) => (v == null || Number.isNaN(v) ? '—' : d === 0 ? nf0.format(Math.round(v)) : d === 1 ? nf1.format(v) : nf2.format(v));
export function compact(v, d = 1) {
  if (v == null || Number.isNaN(v)) return '—';
  const a = Math.abs(v);
  if (a >= 1e9) return `${(v / 1e9).toFixed(d)}B`;
  if (a >= 1e6) return `${(v / 1e6).toFixed(d)}M`;
  if (a >= 1e4) return `${(v / 1e3).toFixed(d)}K`;
  return nf0.format(Math.round(v));
}
export function money(v, code = 'USD', o = {}) {
  if (v == null || Number.isNaN(v)) return '—';
  const cur = CURRENCIES[code] || CURRENCIES.USD;
  const { full = false, decimals } = o;
  const sign = v < 0 ? '−' : '';
  const a = Math.abs(v);
  const sym = code === 'USD' ? '$' : `${code}\u00A0`;
  if (full) { const d = decimals ?? cur.decimals; return `${sign}${sym}${d === 0 ? nf0.format(Math.round(a)) : nf2.format(a)}`; }
  if (a >= 1e4) return `${sign}${sym}${compact(a, a >= 1e8 ? 0 : a >= 1e7 ? 1 : 2)}`;
  const d = decimals ?? (code === 'USD' || cur.decimals ? (a < 100 ? 2 : 0) : 0);
  return `${sign}${sym}${d === 0 ? nf0.format(Math.round(a)) : nf2.format(a)}`;
}
export const pctf = (v, d = 1) => (v == null || Number.isNaN(v) ? '—' : `${(v * 100).toFixed(d)}%`);
export const signedPct = (v, d = 1) => (v == null || Number.isNaN(v) ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v * 100).toFixed(d)}%`);
export const signedNum = (v, d = 0) => (v == null ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${num(Math.abs(v), d)}`);
export const signedMoney = (v, code) => (v == null ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${money(Math.abs(v), code)}`);
export const stars = (v) => (v == null ? '—' : v.toFixed(2));
export const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
