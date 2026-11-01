export function toCSV(columns, rows) {
  const esc = (v) => {
    if (v == null) return '';
    const s = typeof v === 'number' ? (Number.isInteger(v) ? String(v) : String(Math.round(v * 10000) / 10000)) : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [columns.map((c) => esc(c.header)).join(','), ...rows.map((r) => columns.map((c) => esc(c.value(r))).join(','))].join('\r\n');
}
export function downloadCSV(filename, columns, rows, preamble = []) {
  const body = toCSV(columns, rows);
  const pre = preamble.map((l) => `# ${l}`).join('\r\n');
  const blob = new Blob(['\uFEFF' + (pre ? pre + '\r\n' : '') + body], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
