import React from 'react';

// Corporate wordmarks (original, fictional). Monogram: geometric "N" with accent underline.
export function Mark({ size = 28, accent = '#6C9BEB', bg = '#0F2A55', fg = '#fff' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="7" fill={bg} />
      <path d="M9 23V9h3.2l7.6 9.1V9H23v14h-3.2l-7.6-9.1V23z" fill={fg} />
      <rect x="9" y="25" width="14" height="1.7" rx=".85" fill={accent} />
    </svg>
  );
}
export function Wordmark({ business = 'Holdings', compact = false, dark = true }) {
  const ink = dark ? '#fff' : '#0A1A33';
  const sub = dark ? '#8FA6CC' : '#64748B';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
      <Mark size={30} bg={dark ? '#1B3A73' : '#0F2A55'} />
      {!compact && (
        <div style={{ lineHeight: 1.05, minWidth: 0 }}>
          <div className="serif" style={{ fontSize: 17, fontWeight: 650, letterSpacing: '.04em', color: ink }}>NASH</div>
          <div style={{ fontSize: 9.5, letterSpacing: '.28em', textTransform: 'uppercase', color: sub, fontWeight: 600, marginTop: 2 }}>{business}</div>
        </div>
      )}
    </div>
  );
}
