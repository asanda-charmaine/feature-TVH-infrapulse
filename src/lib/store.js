// Client-side prototype data store. State lives in memory, persists to localStorage and syncs
// across browser tabs, so a citizen tab and a technician tab can be demoed side by side.
import { useSyncExternalStore } from 'react';
import { buildSeed, enrichSeedTaskContent } from './seed.js';
import { addSupervisorDemoData } from './supervisorDemo.js';
import { categoryByLabel, ASSET_PREFIX, OPEN_REPORT_STATUSES, TECHNICIANS, DEMO_TECHNICIAN } from './constants.js';
import { computeRisk } from './risk.js';
import { haversine } from './geo.js';
import { pad } from './format.js';
import { sendEmail } from './email.js';
import { validationVersion, validationReasons, isSupervisorValidated } from './supervisor.js';

const KEY = 'infrapulse.state.v1';
const SESSION_KEY = 'infrapulse.technician.v1';
const SUPERVISOR_KEY = 'infrapulse.supervisor.v1';
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

let state = { ...addSupervisorDemoData(enrichSeedTaskContent(load() || buildSeed())), connectors: {} };
state = { ...state, reports: state.reports.map((r) => r.integration
  ? { ...r, description: r.description?.replace(/simulated/gi, 'Connected') } : r) };
let persistFailed = false;
const listeners = new Set();

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...state, connectors: {} }));
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
        state = { ...JSON.parse(e.newValue), connectors: state.connectors || {} };
        listeners.forEach((l) => l());
      } catch {
        /* ignore */
      }
    }
    if (e.key === SESSION_KEY || e.key === SUPERVISOR_KEY) listeners.forEach((l) => l());
  });
}

export function technicianState(s) {
  const workOrders = s.workOrders.filter((w) => w.technicianId === DEMO_TECHNICIAN.id);
  const reportIds = new Set(workOrders.map((w) => w.reportId));
  const refs = new Set([...reportIds, ...workOrders.map((w) => w.id)]);
  return { ...s, workOrders, reports: s.reports.filter((r) => reportIds.has(r.id)),
    assets: s.assets.map((a) => ({ ...a, history: (a.history || []).filter((h) => !h.ref || h.ref === a.id || refs.has(h.ref)) })),
    notifications: s.notifications.filter((n) => !n.link || (!n.link.includes('/reports/') && !n.link.includes('/work-orders/')) || refs.has(n.link.split('/').pop())) };
}
export const useTechnicianStore = () => technicianState(useStore());
function requireAssignedTechnician(id) {
  const w = state.workOrders.find((w) => w.id === id);
  if (!isTechnicianLoggedIn() || !w || w.technicianId !== DEMO_TECHNICIAN.id) throw new Error('This task is not assigned to you.');
  return w;
}
const subscribe = (l) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const getState = () => state;
export const useStore = () => useSyncExternalStore(subscribe, getState);
export const isOwnCitizenReport = (r) => Boolean(r.mine && (r.submittedFromDevice || !/^INF-2026-00(38\d|39\d|40\d|41\d|42[01])$/.test(r.id)));
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
export function findDuplicateReport(category, location) {
  return state.reports.find((r) => !r.supervisorDismissal && OPEN_REPORT_STATUSES.includes(r.status) && r.category === category
    && Number.isFinite(location.lat) && Number.isFinite(location.lng)
    && Number.isFinite(r.location?.lat) && Number.isFinite(r.location?.lng)
    && haversine(location.lat, location.lng, r.location.lat, r.location.lng) < 150);
}
export function submitCitizenReport({ category, image, imageName, ai, location, email, cellphone = '', imageRotation = 0 }) {
  if (!categoryByLabel(category) || !image || ai?.match !== true) throw new Error('Provide a verified infrastructure image.');
  if (cellphone && !/^\+?\d{9,15}$/.test(cellphone.replace(/[\s()-]/g, ''))) throw new Error('Enter a valid cellphone number.');
  const existing = findDuplicateReport(category, location);
  if (existing) throw new Error('A report already exists for this issue at this location: ' + existing.id + '. Please use that reference.');

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
    imageRotation,
    cellphone: cellphone.trim(),
    imageHistory: [image],
    submittedFromDevice: true,
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
  if (!r || r.supervisorDismissal || r.status !== 'Submitted') return;
  commit({ reports: replaceIn(state.reports, id, (x) => pushStatus(x, 'Verified')) });
  notifyCitizen(r, 'Verified');
}

export function linkReportAsset(reportId, assetId) {
  commit({ reports: replaceIn(state.reports, reportId, { assetId: assetId || null }) });
}

/** Attach validated evidence (image) to a report that lacked it. */
export function attachEvidence(reportId, { image, imageName, ai }) {
  const report = state.reports.find((r) => r.id === reportId);
  if (!report) throw new Error('Report not found.');
  if (report.image === image || report.imageHistory?.includes(image)) throw new Error('This image has already been uploaded for this report.');

  commit({
    reports: replaceIn(state.reports, reportId, (r) => ({
      image,
      imageName,
      imageHistory: [...(r.imageHistory || [r.image].filter(Boolean)), image],
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
  return Boolean(report?.image) && (report.ai?.match !== false || report.supervisorValidation?.version === validationVersion(report));
}

/** Creates a work order that inherits its evidence from the report. Refuses without evidence. */
export function createWorkOrder({ reportId, assetId, technicianId, date, time, priority, notes }) {
  requireSupervisor();
  const report = state.reports.find((r) => r.id === reportId);
  if (!report) throw new Error('Report not found.');
  if (report.supervisorDismissal) throw new Error('This report was dismissed by the supervisor.');
  if (!isSupervisorValidated(report)) throw new Error('Validate the report through the supervisor workflow before assignment.');
  if (!hasEvidence(report)) throw new Error('Evidence required: a valid infrastructure image must be attached before a work order can be created.');
  if (report.workOrderId) throw new Error('This report already has a work order.');
  const tech = TECHNICIANS.find((t) => t.id === technicianId) || TECHNICIANS[0];
  const at = nowIso();
  const wo = {
    id: nextWorkOrderId(),
    reportId,
    assetId: assetId || null,
    category: report.category,
    issue: report.issue || report.ai?.detected || report.category,
    location: report.location.address,
    lat: report.location.lat,
    lng: report.location.lng,
    image: report.image,
    imageRotation: report.imageRotation || 0,
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
  requireAssignedTechnician(id);
  commit(woPatch(id, (w) => ({ status: 'En Route', timeline: [...w.timeline, { status: 'En Route', at: nowIso() }] })));
}

export function startWork(id) {
  requireAssignedTechnician(id);
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
  const task = requireAssignedTechnician(id);
  if (afterImage === task.image || task.repairImageHistory?.includes(afterImage)) throw new Error('This image has already been uploaded for this report. Use a new repair image.');

  commit(
    woPatch(id, (w) => ({
      status: 'Awaiting Verification',
      repairImageHistory: [...(w.repairImageHistory || []), afterImage],
      timeline: [...w.timeline, { status: 'Awaiting Verification', at: nowIso() }],
      completion: { afterImage, afterName, location, notes, verification: { pending: true }, completedAt: null },
    })),
  );
}

export function finishRepairVerification(id, verification) {
  requireAssignedTechnician(id);
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
export function completeWorkOrder(id, notes) {
  requireAssignedTechnician(id);
  const wo = state.workOrders.find((w) => w.id === id);
  if (!wo?.completion?.verification?.ok) throw new Error('Repair verification must succeed before completion.');
  if (!['In Progress', 'Awaiting Verification'].includes(wo.status)) throw new Error('This task is not awaiting completion.');
  const completionNotes = (notes ?? wo.completion.notes ?? '').trim();
  if (!completionNotes) throw new Error('Add a short completion note.');
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
      previousFaults: (a.previousFaults || 0) + (wo.completion.completedAt ? 0 : 1),
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
      supervisorReview: null,
      supervisorReviewRequestedAt: at,
      timeline: [...w.timeline, { status: 'Completed', at }],
      completion: { ...w.completion, notes: completionNotes, completedAt: at },
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
  commit(addSupervisorDemoData(buildSeed()));
}

// ---- supervisor demo session and decisions -----------------------------------------------
let supervisorMemory = false;
export const isSupervisorLoggedIn = () => {
  try { return localStorage.getItem(SUPERVISOR_KEY) === '1'; } catch { return supervisorMemory; }
};
export function loginSupervisor() {
  supervisorMemory = true;
  try { localStorage.setItem(SUPERVISOR_KEY, '1'); } catch { /* in-memory demo */ }
  listeners.forEach((l) => l());
}
export function logoutSupervisor() {
  supervisorMemory = false;
  try { localStorage.removeItem(SUPERVISOR_KEY); } catch { /* in-memory demo */ }
  listeners.forEach((l) => l());
}
export const useSupervisorSession = () => useSyncExternalStore(subscribe, isSupervisorLoggedIn);
function requireSupervisor() {
  if (!isSupervisorLoggedIn()) throw new Error('Sign in as Supervisor to make this decision.');
}
export function acceptSupervisorReport(id, note = '') {
  requireSupervisor();
  const r = state.reports.find((r) => r.id === id);
  if (!r || r.supervisorDismissal || r.status === 'Resolved' || isSupervisorValidated(r)) throw new Error('This report no longer needs review.');
  commit({ reports: replaceIn(state.reports, id, { supervisorAcceptance: { at: nowIso(), note: note.trim(), version: validationVersion(r) } }) });
}
export function validateSupervisorReport(id, { category, severity, address, note = '' }) {
  requireSupervisor();
  const r = state.reports.find((r) => r.id === id);
  if (!r || r.supervisorDismissal || r.status === 'Resolved' || isSupervisorValidated(r)) throw new Error('This report no longer needs validation.');
  if (r.supervisorAcceptance?.version !== validationVersion(r)) throw new Error('Accept this report in Review before data validation.');
  const corrected = category !== undefined;
  if (corrected && (!categoryByLabel(category) || !['Low', 'Medium', 'High', 'Critical'].includes(severity) || !address?.trim())) throw new Error('Choose an issue type, priority and location.');
  const next = { ...r };
  if (corrected) {
    Object.assign(next, { category, severity, location: { ...r.location, address: address.trim() } });
    if (category !== r.category) next.assetId = null;
    next.risk = computeRisk({ severity, asset: state.assets.find((a) => a.id === next.assetId) });
  }
  next.supervisorValidation = { decision: corrected ? 'corrected' : 'approved', note: note.trim(), at: nowIso(), version: validationVersion(next) };
  if (next.status === 'Submitted') Object.assign(next, pushStatus(next, 'Verified'));
  commit({ reports: replaceIn(state.reports, id, next), workOrders: state.workOrders.map((w) => w.reportId === id && corrected ? { ...w, category: next.category, severity: next.severity, priority: next.severity, risk: next.risk, location: next.location.address, assetId: next.assetId } : w) });
}

export function dismissSupervisorReport(id, note = '') {
  requireSupervisor();
  const r = state.reports.find((r) => r.id === id);
  if (!r || r.supervisorDismissal || r.workOrderId || state.workOrders.some((w) => w.reportId === id) || r.status === 'Resolved') {
    throw new Error('Only unassigned reports can be dismissed.');
  }
  commit({ reports: replaceIn(state.reports, id, { supervisorDismissal: { at: nowIso(), note: note.trim() } }) });
}
export function assignSupervisorTask(reportId, technicianId, date, { time = '09:00', priority, notes = '' } = {}) {
  requireSupervisor();
  const r = state.reports.find((r) => r.id === reportId);
  if (!r || r.supervisorDismissal || r.status === 'Resolved') throw new Error('This report is no longer available for assignment.');
  if (!isSupervisorValidated(r)) throw new Error('Validate the report before assigning.');
  const t = TECHNICIANS.find((t) => t.id === technicianId);
  const schedule = new Date(date + 'T' + time);
  priority = priority || r.severity;
  if (!t || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)
      || !Number.isFinite(schedule.getTime()) || schedule.getDate() !== Number(date.slice(-2))
      || !['Low', 'Medium', 'High', 'Critical'].includes(priority)) {
    throw new Error('Select a technician, priority and valid scheduled date/time.');
  }
  const existing = state.workOrders.find((w) => w.id === r.workOrderId || w.reportId === r.id);
  if (r.workOrderId || existing) {
    if (!existing || existing.technicianId || existing.status === 'Completed') throw new Error('This task is already assigned or closed.');
    if (!hasEvidence(r)) throw new Error('Evidence required before assigning this task.');
    const at = nowIso();
    commit({
      ...woPatch(existing.id, (w) => ({
        technicianId: t.id, technician: t.name, date, time, priority, notes: notes.trim(), status: 'Scheduled',
        timeline: [...(w.timeline || []), { status: 'Scheduled', at, note: 'Assigned to ' + t.name }],
      })),
      reports: replaceIn(state.reports, r.id, (r) => ({ ...pushStatus(r, 'Assigned', at), workOrderId: existing.id })),
    });
    return state.workOrders.find((w) => w.id === existing.id);
  }
  return createWorkOrder({ reportId, assetId: r.assetId, technicianId, date, time, priority, notes: notes.trim() });
}
export function reviewSupervisorCompletion(id, decision, note = '') {
  requireSupervisor();
  const w = state.workOrders.find((w) => w.id === id);
  if (!w || w.status !== 'Completed' || w.supervisorReview?.decision === 'accepted') throw new Error('This task is no longer awaiting review.');
  if (!['accepted', 'returned'].includes(decision)) throw new Error('Invalid review decision.');
  const at = nowIso();
  const review = { decision, note: note.trim() || (decision === 'returned' ? 'Task not fully completed' : ''), at };
  const returned = decision === 'returned';
  commit({
    ...woPatch(id, (w) => ({ supervisorReview: review, supervisorReviews: [...(w.supervisorReviews || []), review], status: returned ? 'In Progress' : w.status, timeline: [...w.timeline, { status: returned ? 'In Progress' : 'Completed', at, note: returned ? 'Supervisor: ' + review.note : 'Completion accepted by supervisor' }] })),
    ...(returned ? { reports: replaceIn(state.reports, w.reportId, (r) => ({ ...pushStatus(r, 'In Progress', at), resolvedAt: null, afterImage: null })), assets: replaceIn(state.assets, w.assetId, { status: 'Under Maintenance' }), ...pushNotification({ type: 'workorder', title: 'Task needs correction', body: w.id + ': ' + review.note, link: '/technician/work-orders/' + w.id }) } : {}),
  });
}
export function resubmitSupervisorTask(id, notes) {
  requireAssignedTechnician(id);
  if (!isTechnicianLoggedIn()) throw new Error('Sign in as Technician to resubmit.');
  const w = state.workOrders.find((w) => w.id === id);
  if (!w || w.status !== 'In Progress' || w.supervisorReview?.decision !== 'returned') throw new Error('This task is not awaiting correction.');
  if (!notes.trim()) throw new Error('Add a short completion note.');
  if (!w.completion?.verification?.ok) throw new Error('Complete the existing repair verification first.');
  completeWorkOrder(id, notes);
}

/** Demo adapter: validate a simulated external payload, then use the operational report store. */
export function simulateIntegrationEvent(kind, { image, imageName } = {}) {
  if (!['pothole', 'traffic'].includes(kind)) throw new Error('Unknown integration event.');
  if (!state.connectors?.[kind]) throw new Error('Connect this external system before receiving data.');
  const category = kind === 'pothole' ? 'Pothole / Road Damage' : 'Traffic Light';
  const prefix = kind === 'pothole' ? 'AI-POT-' : 'AI-TL-';
  const number = state.reports.filter((r) => r.id.startsWith(prefix))
    .reduce((max, r) => Math.max(max, Number(r.id.slice(prefix.length)) || 0), 0) + 1;
  const id = prefix + String(number).padStart(4, '0');
  const type = kind === 'pothole' ? 'Road Segment' : 'Traffic Light';
  const asset = state.assets.find((a) => a.type === type && a.area === 'Pretoria CBD') || state.assets.find((a) => a.type === type);
  const at = nowIso();
  const severity = kind === 'pothole' ? 'High' : 'Critical';
  const location = {
    address: asset?.location || 'Pretorius Street, Pretoria CBD',
    area: asset?.area || 'Pretoria CBD', street: asset?.location?.split(',')[0] || 'Pretorius Street',
    lat: (asset?.lat ?? -25.7463) + (kind === 'pothole' ? (number % 12) * 0.00012 : 0),
    lng: asset?.lng ?? 28.1891,
  };
  const existing = findDuplicateReport(category, location);
  if (existing) throw new Error('A report already exists for this issue at this location: ' + existing.id + '. Please use that reference.');
  const payload = {
    image: kind === 'pothole' && image ? image : 'scene:' + kind + ':' + number,
    detected: kind === 'pothole' ? 'Pothole' : 'Green signal failure',
    confidence: kind === 'pothole' ? 94 : 99,
    severity, location, timestamp: at,
    ...(kind === 'traffic' ? { telemetry: {
      trafficLightId: asset?.id || 'TLS-DEMO-01', intersection: location.address,
      controller: 'Online', red: 'Working', amber: 'Working', green: 'FAILED',
      power: 'Normal', communication: 'Connected', lastUpdate: at,
    } } : {}),
  };
  if (!payload.image || !Number.isFinite(location.lat) || !Number.isFinite(location.lng)
      || !payload.detected || payload.confidence < 80 || !Number.isFinite(Date.parse(at))) {
    throw new Error('Incoming data could not be validated.');
  }
  const risk = computeRisk({ severity, asset });
  const report = {
    id, source: 'AI', category, issue: kind === 'pothole' ? 'Pothole maintenance from computer-vision detection' : 'Green signal failure - traffic-light controller', description: kind === 'pothole'
      ? 'Connected Computer Vision API detected a pothole.'
      : 'Connected controller telemetry detected a failed green signal.',
    image: payload.image, imageName: kind === 'pothole' && imageName ? imageName : kind + '-detection.jpg',
    ai: { detected: payload.detected, confidence: payload.confidence, severity, match: true },
    location, severity, risk, priority: severity, submittedAt: at,
    status: 'Verified', statusHistory: [{ status: 'Submitted', at }, { status: 'Verified', at }],
    assetId: asset?.id || null, workOrderId: null, email: '', mine: false, resolvedAt: null, afterImage: null,
    integration: {
      eventId: 'EVT-' + id, kind, source: kind === 'pothole' ? 'Computer Vision API' : 'Traffic Light Sensor',
      receivedAt: at, payload, stages: ['Received', 'Validated', 'Report Created', 'Mapped'],
    },
  };
  let assets = addAssetHistory(state.assets, asset?.id, { type: 'Report', text: report.description, ref: id });
  if (asset) assets = replaceIn(assets, asset.id, { status: 'Fault Reported' });
  commit({
    reports: [report, ...state.reports], assets,
    ...pushNotification({ type: kind === 'traffic' ? 'critical' : 'report',
      title: 'Integration report created', body: id + ' - ' + category + ', ' + location.address,
      link: '/technician/reports/' + id }),
  });
  return report;
}

/** Visual hackathon connection state; no external network integration. */
export function connectDemoConnector(kind) {
  if (!['pothole', 'traffic'].includes(kind)) throw new Error('Unknown connector.');
  commit({ connectors: { ...state.connectors, [kind]: true } });
}

export function disconnectDemoConnectors() {
  commit({ connectors: {} });
}
