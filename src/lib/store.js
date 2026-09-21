// Client-side prototype data store. State lives in memory, persists to localStorage and syncs
// across browser tabs, so a citizen tab and a technician tab can be demoed side by side.
import { useSyncExternalStore } from 'react';
import { buildSeed } from './seed.js';
import { categoryByLabel, ASSET_PREFIX, OPEN_REPORT_STATUSES, TECHNICIANS } from './constants.js';
import { computeRisk } from './risk.js';
import { haversine } from './geo.js';
import { pad } from './format.js';
import { sendEmail } from './email.js';

const KEY = 'infrapulse.state.v1';
const SESSION_KEY = 'infrapulse.technician.v1';
const nowIso = () => new Date().toISOString();

// ---- persistence -------------------------------------------------------------------------
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* fall through to seed */
  }
  return null;
}

let state = load() || buildSeed();
let persistFailed = false;
const listeners = new Set();

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    persistFailed = false;
  } catch {
    persistFailed = true; // quota or private mode: keep working in memory
  }
}
persist();

function commit(next) {
  state = { ...state, ...next };
  persist();
  listeners.forEach((l) => l());
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === KEY && e.newValue) {
      try {
        state = JSON.parse(e.newValue);
        listeners.forEach((l) => l());
      } catch {
        /* ignore */
      }
    }
    if (e.key === SESSION_KEY) listeners.forEach((l) => l());
  });
}

const subscribe = (l) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const getState = () => state;
export const useStore = () => useSyncExternalStore(subscribe, getState);
export const storageWarning = () => persistFailed;

// ---- technician demo session -------------------------------------------------------------
let sessionMemory = false; // used only when localStorage is unavailable
export const isTechnicianLoggedIn = () => {
  try {
    return localStorage.getItem(SESSION_KEY) === '1';
  } catch {
    return sessionMemory;
  }
};
export const loginTechnician = () => {
  sessionMemory = true;
  try {
    localStorage.setItem(SESSION_KEY, '1');
  } catch {
    /* in-memory session */
  }
  listeners.forEach((l) => l());
};
export const logoutTechnician = () => {
  sessionMemory = false;
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
};
export const useTechnicianSession = () => useSyncExternalStore(subscribe, isTechnicianLoggedIn);

// ---- helpers -----------------------------------------------------------------------------
const replaceIn = (list, id, patch, key = 'id') => list.map((x) => (x[key] === id ? { ...x, ...(typeof patch === 'function' ? patch(x) : patch) } : x));

function nextReportId() {
  const year = new Date().getFullYear();
  const max = state.reports.reduce((m, r) => Math.max(m, Number(r.id.split('-').pop()) || 0), 0);
  return `INF-${year}-${pad(max + 1, 5)}`;
}
function nextWorkOrderId() {
  const max = state.workOrders.reduce((m, w) => Math.max(m, Number(w.id.split('-').pop()) || 0), 100);
  return `WO-${new Date().getFullYear()}-${pad(max + 1, 4)}`;
}
export function nextAssetId(type) {
  const prefix = ASSET_PREFIX[type] || 'AST';
  const width = type === 'Vehicle' ? 4 : 5;
  const max = state.assets
    .filter((a) => a.id.startsWith(prefix + '-'))
    .reduce((m, a) => Math.max(m, Number(a.id.split('-')[1]) || 0), 0);
  return `${prefix}-${pad(max + 1, width)}`;
}

/** Nearest asset of the right type for a category within ~400 m. */
export function findNearestAsset(categoryLabel, lat, lng) {
  const cat = categoryByLabel(categoryLabel);
  if (!cat || lat == null) return null;
  let best = null;
  for (const a of state.assets) {
    if (a.type !== cat.assetType) continue;
    const d = haversine(lat, lng, a.lat, a.lng);
    if (d < 400 && (!best || d < best.d)) best = { asset: a, d };
  }
  return best?.asset ?? null;
}

const pushNotification = (n) => ({
  notifications: [{ id: `N-${Date.now()}-${Math.floor(Math.random() * 999)}`, at: nowIso(), read: false, ...n }, ...state.notifications].slice(0, 60),
});

const addAssetHistory = (assets, assetId, entry) =>
  assetId ? replaceIn(assets, assetId, (a) => ({ history: [...(a.history || []), { date: nowIso(), ...entry }] })) : assets;

const pushStatus = (r, status, at = nowIso()) => ({ status, statusHistory: [...(r.statusHistory || []), { status, at }] });

/** Fire-and-forget citizen update email (simulated when SMTP/server is unavailable). */
function notifyCitizen(report, status) {
  if (report.email) sendEmail({ type: 'update', to: report.email, status, report: emailPayload(report) });
}
export const emailPayload = (r) => ({ id: r.id, category: r.category, location: r.location.address });

// ---- citizen actions ---------------------------------------------------------------------
export function submitCitizenReport({ category, image, imageName, ai, location, email }) {
  const asset = findNearestAsset(category, location.lat, location.lng);
  const severity = ai.severity || 'Medium';
  const duplicates = state.reports.filter(
    (r) => OPEN_REPORT_STATUSES.includes(r.status) && r.category === category && haversine(location.lat, location.lng, r.location.lat, r.location.lng) < 150,
  ).length;
  const risk = computeRisk({ severity, asset, duplicates });
  const at = nowIso();
  const report = {
    id: nextReportId(),
    source: 'Citizen',
    category,
    description: '',
    image,
    imageName,
    ai,
    location,
    email: email || '',
    submittedAt: at,
    status: 'Submitted',
    statusHistory: [{ status: 'Submitted', at }],
    severity,
    risk,
    assetId: asset?.id ?? null,
    workOrderId: null,
    mine: true,
    resolvedAt: null,
    afterImage: null,
  };
  let assets = state.assets;
  if (asset) {
    assets = addAssetHistory(assets, asset.id, { type: 'Report', text: `Citizen reported ${categoryByLabel(category).short.toLowerCase()} fault`, ref: report.id });
    assets = replaceIn(assets, asset.id, (a) => (a.status === 'Operational' ? { status: 'Fault Reported' } : {}));
  }
  commit({
    reports: [report, ...state.reports],
    assets,
    ...pushNotification({
      type: severity === 'Critical' || risk >= 85 ? 'critical' : 'report',
      title: 'New citizen report',
      body: `${report.id} — ${category}, ${location.address}.`,
      link: `/technician/reports/${report.id}`,
    }),
  });
  return report;
}

// ---- technician: reports -----------------------------------------------------------------
export function verifyReport(id) {
  const r = state.reports.find((x) => x.id === id);
  if (!r || r.status !== 'Submitted') return;
  commit({ reports: replaceIn(state.reports, id, (x) => pushStatus(x, 'Verified')) });
  notifyCitizen(r, 'Verified');
}

export function linkReportAsset(reportId, assetId) {
  commit({ reports: replaceIn(state.reports, reportId, { assetId: assetId || null }) });
}

/** Attach validated evidence (image) to a report that lacked it. */
export function attachEvidence(reportId, { image, imageName, ai }) {
  commit({
    reports: replaceIn(state.reports, reportId, (r) => ({
      image,
      imageName,
      ai: { ...ai, severity: ai.severity || r.severity },
      severity: r.severity,
    })),
  });
}

/** Simulates the InfraPulse AI pipeline creating a new report from a camera feed. */
export function simulateAiDetection() {
  const cats = ['Pothole / Road Damage', 'Traffic Light', 'Street Light'];
  const category = cats[Math.floor(Math.random() * cats.length)];
  const cat = categoryByLabel(category);
  const candidates = state.assets.filter((a) => a.type === cat.assetType);
  const asset = candidates[Math.floor(Math.random() * candidates.length)];
  const severity = ['Medium', 'High', 'High', 'Critical'][Math.floor(Math.random() * 4)];
  const n = Number(nextReportId().split('-').pop());
  const at = nowIso();
  const report = {
    id: nextReportId(),
    source: 'AI',
    category,
    description: `InfraPulse AI detected a ${cat.short.toLowerCase()} issue from a live camera feed.`,
    image: `scene:${cat.id}:${n}`,
    imageName: `${cat.id}-${n}.jpg`,
    ai: { detected: cat.detected, match: true, confidence: 88 + Math.floor(Math.random() * 10), severity },
    location: { address: asset.location, street: asset.location.split(',')[0], area: asset.area, landmark: '', lat: asset.lat + 0.0001, lng: asset.lng - 0.0001 },
    email: '',
    submittedAt: at,
    status: 'Submitted',
    statusHistory: [{ status: 'Submitted', at }],
    severity,
    risk: computeRisk({ severity, asset }),
    assetId: asset.id,
    workOrderId: null,
    mine: false,
    resolvedAt: null,
    afterImage: null,
  };
  commit({
    reports: [report, ...state.reports],
    assets: addAssetHistory(state.assets, asset.id, { type: 'Report', text: `AI detected ${cat.short.toLowerCase()} fault`, ref: report.id }),
    ...pushNotification({ type: severity === 'Critical' ? 'critical' : 'report', title: 'New AI detection', body: `${report.id} — ${category}, ${asset.location}.`, link: `/technician/reports/${report.id}` }),
  });
  return report;
}

// ---- technician: work orders -------------------------------------------------------------
export function hasEvidence(report) {
  return Boolean(report?.image) && report.ai?.match !== false;
}

/** Creates a work order that inherits its evidence from the report. Refuses without evidence. */
export function createWorkOrder({ reportId, assetId, technicianId, date, time, priority, notes }) {
  const report = state.reports.find((r) => r.id === reportId);
  if (!report) throw new Error('Report not found.');
  if (!hasEvidence(report)) throw new Error('Evidence required: a valid infrastructure image must be attached before a work order can be created.');
  if (report.workOrderId) throw new Error('This report already has a work order.');
  const tech = TECHNICIANS.find((t) => t.id === technicianId) || TECHNICIANS[0];
  const at = nowIso();
  const wo = {
    id: nextWorkOrderId(),
    reportId,
    assetId: assetId || null,
    category: report.category,
    location: report.location.address,
    lat: report.location.lat,
    lng: report.location.lng,
    image: report.image,
    severity: report.severity,
    risk: report.risk,
    technician: tech.name,
    technicianId: tech.id,
    date,
    time,
    priority,
    notes,
    status: 'Scheduled',
    createdAt: at,
    completion: null,
    timeline: [{ status: 'Scheduled', at }],
  };
  let reports = state.reports;
  if (report.status === 'Submitted') reports = replaceIn(reports, reportId, (r) => pushStatus(r, 'Verified', at));
  reports = replaceIn(reports, reportId, (r) => ({ ...pushStatus(r, 'Assigned', at), workOrderId: wo.id, assetId: assetId || r.assetId }));
  commit({
    reports,
    workOrders: [...state.workOrders, wo],
    assets: addAssetHistory(state.assets, assetId, { type: 'Work Order', text: `Work order ${wo.id} scheduled for ${date} ${time}`, ref: wo.id }),
    ...pushNotification({ type: 'workorder', title: 'Work order created', body: `${wo.id} assigned to ${tech.name} for ${reportId}.`, link: `/technician/work-orders/${wo.id}` }),
  });
  notifyCitizen(report, 'Assigned');
  return wo;
}

const woPatch = (id, fn) => ({ workOrders: replaceIn(state.workOrders, id, fn) });

export function setEnRoute(id) {
  commit(woPatch(id, (w) => ({ status: 'En Route', timeline: [...w.timeline, { status: 'En Route', at: nowIso() }] })));
}

export function startWork(id) {
  const wo = state.workOrders.find((w) => w.id === id);
  if (!wo || !wo.image) throw new Error('Evidence required before work can start.');
  const at = nowIso();
  const report = state.reports.find((r) => r.id === wo.reportId);
  commit({
    ...woPatch(id, (w) => ({ status: 'In Progress', timeline: [...w.timeline, { status: 'In Progress', at }] })),
    reports: replaceIn(state.reports, wo.reportId, (r) => pushStatus(r, 'In Progress', at)),
    assets: replaceIn(state.assets, wo.assetId, (a) => (a.type === 'Vehicle' ? {} : { status: 'Under Maintenance' })),
  });
  if (report) notifyCitizen(report, 'In Progress');
}

/** Technician submitted repair evidence: status moves to Awaiting Verification while it is checked. */
export function beginRepairVerification(id, { afterImage, afterName, location, notes }) {
  commit(
    woPatch(id, (w) => ({
      status: 'Awaiting Verification',
      timeline: [...w.timeline, { status: 'Awaiting Verification', at: nowIso() }],
      completion: { afterImage, afterName, location, notes, verification: { pending: true }, completedAt: null },
    })),
  );
}

export function finishRepairVerification(id, verification) {
  commit(
    woPatch(id, (w) => {
      if (verification.ok) return { completion: { ...w.completion, verification } };
      // Failed: drop back to In Progress and keep the failed attempt visible.
      return {
        status: 'In Progress',
        timeline: [...w.timeline, { status: 'In Progress', at: nowIso(), note: 'Repair verification failed' }],
        completion: { ...w.completion, verification },
      };
    }),
  );
}

/** Only possible after a successful verification. Closes the work order, report and updates the asset. */
export function completeWorkOrder(id) {
  const wo = state.workOrders.find((w) => w.id === id);
  if (!wo?.completion?.verification?.ok) throw new Error('Repair verification must succeed before completion.');
  const at = nowIso();
  const report = state.reports.find((r) => r.id === wo.reportId);
  const asset = state.assets.find((a) => a.id === wo.assetId);
  const cat = categoryByLabel(wo.category);
  let assets = state.assets;
  if (asset) {
    assets = replaceIn(assets, asset.id, (a) => ({
      status: 'Operational',
      condition: a.condition === 'Critical' || a.condition === 'Poor' ? 'Good' : a.condition,
      lastMaintenance: at,
      previousFaults: (a.previousFaults || 0) + 1,
    }));
    assets = addAssetHistory(assets, asset.id, {
      type: 'Maintenance',
      text: `${cat?.short || 'Infrastructure'} repair completed and verified (${wo.id})`,
      ref: wo.reportId,
    });
  }
  commit({
    ...woPatch(id, (w) => ({
      status: 'Completed',
      timeline: [...w.timeline, { status: 'Completed', at }],
      completion: { ...w.completion, completedAt: at },
    })),
    reports: replaceIn(state.reports, wo.reportId, (r) => ({
      ...pushStatus(r, 'Resolved', at),
      resolvedAt: at,
      afterImage: wo.completion.afterImage,
    })),
    assets,
    ...pushNotification({ type: 'workorder', title: 'Work order completed', body: `${wo.id} verified and closed. ${wo.reportId} is now Resolved.`, link: `/technician/work-orders/${wo.id}` }),
  });
  if (report) notifyCitizen(report, 'Resolved');
}

// ---- technician: assets ------------------------------------------------------------------
export function addAsset(data) {
  const id = nextAssetId(data.type);
  const asset = {
    condition: 'Good',
    status: data.type === 'Vehicle' ? 'Available' : 'Operational',
    previousFaults: 0,
    notes: '',
    ...data,
    id,
    history: [{ date: nowIso(), type: 'Registered', text: `${data.type} registered in the Asset Registry`, ref: id }],
    lastMaintenance: data.lastMaintenance || nowIso(),
  };
  commit({ assets: [...state.assets, asset] });
  return asset;
}

export function updateAsset(id, patch, note = 'Asset details edited') {
  commit({
    assets: replaceIn(state.assets, id, (a) => ({ ...patch, history: [...(a.history || []), { date: nowIso(), type: 'Edit', text: note, ref: id }] })),
  });
}

export function moveAsset(id, lat, lng) {
  commit({
    assets: replaceIn(state.assets, id, (a) => ({ lat, lng, history: [...(a.history || []), { date: nowIso(), type: 'Edit', text: 'Marker moved on the GIS map', ref: id }] })),
  });
}

/** Deletion is guarded: assets with open reports or work orders cannot be removed. */
export function deleteAsset(id) {
  const blockers = assetLinks(state, id);
  const open = blockers.reports.filter((r) => OPEN_REPORT_STATUSES.includes(r.status)).length + blockers.workOrders.filter((w) => w.status !== 'Completed').length;
  if (open > 0) throw new Error(`Cannot delete ${id}: it has ${open} open report(s) / work order(s).`);
  commit({ assets: state.assets.filter((a) => a.id !== id) });
}

export const assetLinks = (s, assetId) => ({
  reports: s.reports.filter((r) => r.assetId === assetId),
  workOrders: s.workOrders.filter((w) => w.assetId === assetId),
});

// ---- technician: map areas & notifications -----------------------------------------------
export function addArea(area) {
  commit({ areas: [...state.areas, { id: `AREA-${Date.now()}`, ...area }] });
}
export function removeArea(id) {
  commit({ areas: state.areas.filter((a) => a.id !== id) });
}
export function markNotificationRead(id) {
  commit({ notifications: replaceIn(state.notifications, id, { read: true }) });
}
export function markAllNotificationsRead() {
  commit({ notifications: state.notifications.map((n) => ({ ...n, read: true })) });
}

export function resetDemo() {
  commit(buildSeed());
}
