// Day-index based calendar utilities. Day 0 = 2025-01-01. Latest simulated trading day = TODAY.
export const START_MS = Date.UTC(2025, 0, 1);
export const DAYS = 670;               // 2025-01-01 .. 2026-11-01 inclusive
export const TODAY = DAYS - 1;         // 2026-11-01 (Sunday)
const DAY_MS = 86400000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WD_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const dayToDate = (d) => new Date(START_MS + d * DAY_MS);
export const dateToDay = (dt) => Math.round((Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()) - START_MS) / DAY_MS);
export const isoToDay = (iso) => { const [y, m, d] = iso.split('-').map(Number); return Math.round((Date.UTC(y, m - 1, d) - START_MS) / DAY_MS); };
export const dayToISO = (d) => dayToDate(d).toISOString().slice(0, 10);
export const weekday = (d) => (dayToDate(d).getUTCDay() + 6) % 7; // Mon=0
export const weekdayName = (d, long) => (long ? WD_LONG : WD)[weekday(d)];
export const monthIndex = (d) => { const t = dayToDate(d); return (t.getUTCFullYear() - 2025) * 12 + t.getUTCMonth(); };
export const ymd = (d) => { const t = dayToDate(d); return { y: t.getUTCFullYear(), m: t.getUTCMonth(), d: t.getUTCDate() }; };
export const monthStartDay = (y, m) => Math.round((Date.UTC(y, m, 1) - START_MS) / DAY_MS);
export const daysInMonth = (y, m) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
export const fmtDay = (d, opts = {}) => {
  const { y, m, d: dd } = ymd(d);
  if (opts.long) return `${WD[weekday(d)]}, ${dd} ${MONTHS[m]} ${y}`;
  if (opts.noYear) return `${dd} ${MONTHS[m]}`;
  return `${dd} ${MONTHS[m]} ${y}`;
};
export const fmtMonth = (d) => { const { y, m } = ymd(d); return `${MONTHS[m]} ${y}`; };
export const monthLongName = (m) => MONTHS_LONG[m];
export const fmtRange = (r, e) => { const a = typeof r === 'object' ? r.d0 : r, z = typeof r === 'object' ? r.d1 : e; return a === z ? fmtDay(a, { long: true }) : `${fmtDay(a)} – ${fmtDay(z)}`; };
export const clampDay = (d) => Math.max(0, Math.min(TODAY, d));
export const fmtTime = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

export const PRESETS = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'thisWeek', label: 'This week' },
  { id: 'lastWeek', label: 'Last week' },
  { id: 'thisMonth', label: 'This month' },
  { id: 'lastMonth', label: 'Last month' },
  { id: 'ytd', label: 'Year to date' },
  { id: 'custom', label: 'Custom range' },
];
export const COMPARES = [
  { id: 'auto', label: 'Smart (like-for-like)' },
  { id: 'prev', label: 'Previous equivalent period' },
  { id: 'week', label: 'Same period last week' },
  { id: 'month', label: 'Same period last month' },
  { id: 'year', label: 'Same period last year' },
];

function shiftMonths(day, n) {
  const { y, m, d } = ymd(day);
  const tm = m + n;
  const ty = y + Math.floor(tm / 12), tmm = ((tm % 12) + 12) % 12;
  return monthStartDay(ty, tmm) + Math.min(d, daysInMonth(ty, tmm)) - 1;
}
function isFullMonth(r) {
  const a = ymd(r.d0), b = ymd(r.d1);
  return a.d === 1 && a.y === b.y && a.m === b.m && b.d === daysInMonth(b.y, b.m);
}

export function baseRange(preset, custom) {
  const t = TODAY;
  const { y, m } = ymd(t);
  switch (preset) {
    case 'today': return { d0: t, d1: t };
    case 'yesterday': return { d0: t - 1, d1: t - 1 };
    case 'thisWeek': { const s = t - weekday(t); return { d0: s, d1: t }; }
    case 'lastWeek': { const s = t - weekday(t) - 7; return { d0: s, d1: s + 6 }; }
    case 'thisMonth': return { d0: monthStartDay(y, m), d1: t };
    case 'lastMonth': { const py = m === 0 ? y - 1 : y, pm = (m + 11) % 12; return { d0: monthStartDay(py, pm), d1: monthStartDay(py, pm) + daysInMonth(py, pm) - 1 }; }
    case 'ytd': return { d0: monthStartDay(y, 0), d1: t };
    case 'custom': {
      let a = clampDay(custom?.d0 ?? t - 29), b = clampDay(custom?.d1 ?? t);
      if (a > b) [a, b] = [b, a];
      return { d0: a, d1: b };
    }
    default: return { d0: t, d1: t };
  }
}

export function comparisonRange(preset, range, compare) {
  if (compare === 'auto') compare = preset === 'today' || preset === 'yesterday' ? 'week' : 'prev';
  const len = range.d1 - range.d0 + 1;
  let r = null, label = '';
  if (compare === 'week') { r = { d0: range.d0 - 7, d1: range.d1 - 7 }; label = preset === 'today' || preset === 'yesterday' ? 'same weekday last week' : 'same period last week'; }
  else if (compare === 'month') {
    r = isFullMonth(range) ? (() => { const a = ymd(range.d0); const pm = (a.m + 11) % 12, py = a.m === 0 ? a.y - 1 : a.y; const s = monthStartDay(py, pm); return { d0: s, d1: s + daysInMonth(py, pm) - 1 }; })()
      : { d0: shiftMonths(range.d0, -1), d1: shiftMonths(range.d1, -1) };
    label = 'same period last month';
  } else if (compare === 'year') { r = { d0: shiftMonths(range.d0, -12), d1: shiftMonths(range.d1, -12) }; label = 'same period last year'; }
  else {
    // previous equivalent period
    switch (preset) {
      case 'today': case 'yesterday': r = { d0: range.d0 - 1, d1: range.d1 - 1 }; label = preset === 'today' ? 'yesterday' : 'the day before'; break;
      case 'thisWeek': case 'lastWeek': r = { d0: range.d0 - 7, d1: range.d0 - 7 + len - 1 }; label = 'previous week'; break;
      case 'thisMonth': { const a = ymd(range.d0); const pm = (a.m + 11) % 12, py = a.m === 0 ? a.y - 1 : a.y; const s = monthStartDay(py, pm); r = { d0: s, d1: s + Math.min(len, daysInMonth(py, pm)) - 1 }; label = 'previous month (same days)'; break; }
      case 'lastMonth': { const a = ymd(range.d0); const pm = (a.m + 11) % 12, py = a.m === 0 ? a.y - 1 : a.y; const s = monthStartDay(py, pm); r = { d0: s, d1: s + daysInMonth(py, pm) - 1 }; label = 'previous month'; break; }
      case 'ytd': r = { d0: shiftMonths(range.d0, -12), d1: shiftMonths(range.d1, -12) }; label = 'same period last year'; break;
      default: r = { d0: range.d0 - len, d1: range.d0 - 1 }; label = 'preceding period';
    }
  }
  if (!r || r.d0 < 0 || r.d1 < 0) return null;
  return { ...r, label };
}

export function resolvePeriod(preset, custom, compare) {
  const range = baseRange(preset, custom);
  const prev = comparisonRange(preset, range, compare);
  return { ...range, preset, label: PRESETS.find((p) => p.id === preset)?.label || 'Custom', prev, days: range.d1 - range.d0 + 1 };
}

export function grainFor(days) { return days <= 62 ? 'day' : days <= 200 ? 'week' : 'month'; }

export function shiftRangeMonths(range, n) { return { d0: shiftMonths(range.d0, n), d1: shiftMonths(range.d1, n) }; }
