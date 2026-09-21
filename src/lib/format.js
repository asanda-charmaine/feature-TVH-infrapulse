const LOCALE = 'en-ZA';

export const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

export const fmtShortDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export const fmtDateTime = (iso) =>
  iso
    ? `${new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}, ${new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
    : '—';

export const fmtNumber = (n) => Number(n ?? 0).toLocaleString(LOCALE);

const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
export const isSameDay = (a, b = new Date()) => a && dayKey(new Date(a)) === dayKey(new Date(b));

export const startOfDay = (d = new Date()) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

// Local YYYY-MM-DD (avoids the UTC shift of toISOString)
export const toDateInput = (d = new Date()) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

export const daysBetween = (a, b) => (new Date(b) - new Date(a)) / 86400000;

export const yearsSince = (iso) => (iso ? Math.max(0, (Date.now() - new Date(iso)) / (365.25 * 86400000)) : 0);

export const fmtAge = (iso) => {
  const y = yearsSince(iso);
  if (y >= 1) return `${y.toFixed(1)} years`;
  const m = Math.max(1, Math.round(y * 12));
  return `${m} ${m === 1 ? 'month' : 'months'}`;
};

export const pad = (n, len) => String(n).padStart(len, '0');
