// Client-side CSV parsing and automatic profiling for the "Upload CSV" analysis.

/** RFC-4180-ish CSV parser (quotes, escaped quotes, CRLF). */
export function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  const src = text.replace(/^﻿/, '');
  // Detect delimiter from the header line.
  const head = src.split(/\r?\n/, 1)[0] || '';
  const delim = [',', ';', '\t'].map((d) => [d, head.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === delim) {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((f) => f.trim() !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== '')) rows.push(row);
  if (!rows.length) return { headers: [], records: [] };
  const headers = rows[0].map((h, i) => h.trim() || `column_${i + 1}`);
  const records = rows.slice(1).map((r) => Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? '').trim()])));
  return { headers, records };
}

const ROLE_PATTERNS = {
  category: /categor|type|fault|issue|kind|asset/i,
  status: /status|state|stage/i,
  severity: /severity|priority|risk_?level|urgency/i,
  area: /area|suburb|ward|location|region|district|zone|address|town/i,
  date: /^(?!.*(close|resolv|complet|end)).*(date|created|reported|submitted|opened|logged|time)/i,
  closed: /close|resolv|complet/i,
  days: /days|duration|resolution|turnaround|hours/i,
};

export function detectColumns(headers, records) {
  const used = new Set();
  const found = {};
  const isNumeric = (h) => {
    const vals = records.slice(0, 50).map((r) => r[h]).filter(Boolean);
    return vals.length > 0 && vals.every((v) => !Number.isNaN(Number(v)));
  };
  const isDate = (h) => {
    const vals = records.slice(0, 50).map((r) => r[h]).filter(Boolean);
    return vals.length > 0 && vals.every((v) => !Number.isNaN(Date.parse(v)) && /\d{4}|\d{1,2}[/-]\d{1,2}/.test(v));
  };
  for (const role of ['status', 'severity', 'category', 'area', 'date', 'closed', 'days']) {
    const h = headers.find((c) => !used.has(c) && ROLE_PATTERNS[role].test(c) && (role === 'date' || role === 'closed' ? isDate(c) : role === 'days' ? isNumeric(c) : !isNumeric(c)));
    if (h) {
      found[role] = h;
      used.add(h);
    }
  }
  return found;
}

const tally = (records, col) => {
  const m = new Map();
  records.forEach((r) => {
    const v = r[col] || '(blank)';
    m.set(v, (m.get(v) || 0) + 1);
  });
  return [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
};
const limit = (series, n) => {
  if (series.length <= n) return series;
  const rest = series.slice(n).reduce((s, x) => s + x.value, 0);
  return [...series.slice(0, n), { label: 'Other', value: rest }];
};

export function analyzeCSV({ headers, records }) {
  const cols = detectColumns(headers, records);
  const total = records.length;
  const out = { total, cols, columnsUsed: Object.values(cols), insights: [], cards: [{ label: 'Total Records', value: total.toLocaleString('en-ZA') }] };

  if (cols.category) out.category = limit(tally(records, cols.category), 7);
  if (cols.status) out.status = limit(tally(records, cols.status), 6);
  if (cols.severity) {
    const order = ['low', 'medium', 'high', 'critical'];
    out.severity = tally(records, cols.severity).sort((a, b) => {
      const ia = order.indexOf(a.label.toLowerCase());
      const ib = order.indexOf(b.label.toLowerCase());
      return (ia < 0 ? 9 : ia) - (ib < 0 ? 9 : ib);
    });
  }
  if (cols.area) out.area = tally(records, cols.area).slice(0, 8);

  if (cols.date) {
    const m = new Map();
    records.forEach((r) => {
      const t = Date.parse(r[cols.date]);
      if (Number.isNaN(t)) return;
      const d = new Date(t);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      m.set(key, (m.get(key) || 0) + 1);
    });
    const series = [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    if (series.length >= 2) {
      out.trend = series.map(([k, value]) => {
        const [y, mo] = k.split('-');
        return { label: new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }), value };
      });
    }
  }

  // Average closure time (days) from a numeric column or from open/close date columns.
  let avgClosure = null;
  if (cols.days) {
    const vals = records.map((r) => (r[cols.days] === '' ? NaN : Number(r[cols.days]))).filter((v) => !Number.isNaN(v));
    if (vals.length) avgClosure = vals.reduce((s, v) => s + v, 0) / vals.length / (/hour/i.test(cols.days) ? 24 : 1);
  } else if (cols.date && cols.closed) {
    const vals = records
      .map((r) => (Date.parse(r[cols.closed]) - Date.parse(r[cols.date])) / 86400000)
      .filter((v) => !Number.isNaN(v) && v >= 0);
    if (vals.length) avgClosure = vals.reduce((s, v) => s + v, 0) / vals.length;
  }

  // Insight sentences (deterministic, "AI-style" summary)
  const pct = (n) => Math.round((n / total) * 100);
  out.insights.push(`This dataset contains ${total.toLocaleString('en-ZA')} infrastructure records.`);
  if (out.category?.[0]) {
    out.insights.push(`${out.category[0].label} represents the largest issue category at ${pct(out.category[0].value)}%.`);
    out.cards.push({ label: 'Top Category', value: out.category[0].label });
  }
  if (out.area?.[0]) {
    out.insights.push(`${out.area[0].label} has the highest concentration of reported faults (${pct(out.area[0].value)}% of records).`);
    out.cards.push({ label: 'Hotspot Area', value: out.area[0].label });
  }
  if (out.severity) {
    const hc = out.severity.filter((s) => /high|critical|urgent/i.test(s.label)).reduce((s, x) => s + x.value, 0);
    out.insights.push(`${pct(hc)}% of records are classified as high or critical severity.`);
    out.cards.push({ label: 'High / Critical', value: `${pct(hc)}%` });
  }
  if (out.status) {
    const done = out.status.filter((s) => /resolv|complet|closed|done/i.test(s.label)).reduce((s, x) => s + x.value, 0);
    if (done) {
      out.insights.push(`${pct(done)}% of records are resolved or closed; ${(total - done).toLocaleString('en-ZA')} remain outstanding.`);
      out.cards.push({ label: 'Resolved', value: `${pct(done)}%` });
    }
  }
  if (avgClosure != null) {
    out.insights.push(`Average closure time for completed issues is approximately ${avgClosure.toFixed(1)} days.`);
    out.cards.push({ label: 'Avg Closure', value: `${avgClosure.toFixed(1)} days` });
  }
  if (out.columnsUsed.length === 0) {
    out.insights.push('No category, status, severity, area or date columns were recognised, so only a preview and record count are shown. Try column names such as category, status, severity, area and date.');
  }
  return out;
}
