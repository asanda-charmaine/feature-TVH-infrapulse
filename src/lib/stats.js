// Derived operational statistics for the dashboard and analytics pages.
import { OPEN_REPORT_STATUSES, SEVERITIES, WORK_ORDER_STATUSES, REPORT_STATUSES, CATEGORIES } from './constants.js';
import { isSameDay, daysBetween, toDateInput, startOfDay } from './format.js';
import { assetBaselineRisk } from './risk.js';

export const isOpen = (r) => OPEN_REPORT_STATUSES.includes(r.status);

const countBy = (list, fn) => {
  const out = new Map();
  list.forEach((x) => out.set(fn(x), (out.get(fn(x)) || 0) + 1));
  return out;
};
const toSeries = (map, order) =>
  (order || [...map.keys()]).map((label) => ({ label, value: map.get(label) || 0 }));

export function dashboardStats({ reports, workOrders }) {
  const open = reports.filter(isOpen);
  const woActive = workOrders.filter((w) => ['En Route', 'In Progress', 'Awaiting Verification'].includes(w.status));
  return {
    openReports: open.length,
    reportsToday: reports.filter((r) => isSameDay(r.submittedAt)).length,
    aiIssues: reports.filter((r) => r.source === 'AI').length,
    activeWorkOrders: woActive.length,
  };
}

export const priorityIssues = (reports, n = 5) =>
  reports.filter(isOpen).sort((a, b) => b.risk - a.risk || new Date(b.submittedAt) - new Date(a.submittedAt)).slice(0, n);

export const todaysWorkOrders = (workOrders) => workOrders.filter((w) => w.date === toDateInput()).sort((a, b) => a.time.localeCompare(b.time));

export function analyticsStats({ reports, workOrders }) {
  const resolved = reports.filter((r) => r.status === 'Resolved' && r.resolvedAt);
  const avgDays = resolved.length ? resolved.reduce((s, r) => s + daysBetween(r.submittedAt, r.resolvedAt), 0) / resolved.length : 0;
  const open = reports.filter(isOpen);

  const byCategory = toSeries(countBy(reports, (r) => r.category), CATEGORIES.map((c) => c.label));
  const bySource = toSeries(countBy(reports, (r) => (r.source === 'AI' ? 'AI Detected' : 'Citizen Report')), ['Citizen Report', 'AI Detected']);
  const bySeverity = toSeries(countBy(reports, (r) => r.severity), SEVERITIES);
  const byStatus = toSeries(countBy(reports, (r) => r.status), REPORT_STATUSES);
  const byWorkOrder = toSeries(countBy(workOrders, (w) => w.status), WORK_ORDER_STATUSES);

  const areaMap = countBy(reports, (r) => r.location.area || 'Unknown');
  const byLocation = [...areaMap.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 8);

  // Highest risk areas: average risk of open reports, weighted by count.
  const riskMap = new Map();
  open.forEach((r) => {
    const a = r.location.area || 'Unknown';
    const cur = riskMap.get(a) || { total: 0, n: 0 };
    riskMap.set(a, { total: cur.total + r.risk, n: cur.n + 1 });
  });
  const highestRiskAreas = [...riskMap.entries()]
    .map(([label, { total, n }]) => ({ label, value: Math.round(total / n), n }))
    .sort((a, b) => b.value * Math.log2(b.n + 1) - a.value * Math.log2(a.n + 1))
    .slice(0, 5);

  // Reports per day (last 14 days)
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = startOfDay(new Date(Date.now() - i * 86400000));
    days.push({ label: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), key: toDateInput(d), value: 0 });
  }
  reports.forEach((r) => {
    const k = toDateInput(new Date(r.submittedAt));
    const bucket = days.find((d) => d.key === k);
    if (bucket) bucket.value += 1;
  });

  const buckets = [
    { label: '< 1 day', max: 1 },
    { label: '1–2 days', max: 2 },
    { label: '2–4 days', max: 4 },
    { label: '4+ days', max: Infinity },
  ].map((b) => ({ ...b, value: 0 }));
  resolved.forEach((r) => {
    const d = daysBetween(r.submittedAt, r.resolvedAt);
    buckets.find((b) => d < b.max).value += 1;
  });

  const commonFault = [...byCategory].sort((a, b) => b.value - a.value)[0];
  return {
    total: reports.length,
    citizen: reports.filter((r) => r.source === 'Citizen').length,
    ai: reports.filter((r) => r.source === 'AI').length,
    open: open.length,
    resolved: resolved.length,
    critical: open.filter((r) => r.severity === 'Critical' || r.risk >= 85).length,
    avgDays,
    mostCommonFault: commonFault?.value ? commonFault.label : '—',
    woCompleted: workOrders.filter((w) => w.status === 'Completed').length,
    woOutstanding: workOrders.filter((w) => w.status !== 'Completed').length,
    highestRiskAreas,
    byCategory,
    bySource,
    bySeverity,
    byStatus,
    byWorkOrder,
    byLocation,
    overTime: days,
    resolutionBuckets: buckets,
  };
}

/** Current risk of an asset: the worst open linked report, or its condition-based baseline. */
export function currentRisk(asset, state) {
  const open = state.reports.filter((r) => r.assetId === asset.id && isOpen(r));
  return Math.max(assetBaselineRisk(asset), ...open.map((r) => r.risk));
}
