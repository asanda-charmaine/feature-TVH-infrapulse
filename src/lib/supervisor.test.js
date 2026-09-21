import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { validationReasons, supervisorQueues, suggestedTechnicians } from './supervisor.js';

const data = new Map();
globalThis.localStorage = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: (k) => data.delete(k) };
let storageEvent;
globalThis.window = { addEventListener: (name, fn) => { if (name === 'storage') storageEvent = fn; } };
globalThis.fetch = async () => ({ json: async () => ({ ok: true, simulated: true }) });
const store = await import('./store.js');
const report = (patch = {}) => ({
  id: 'INF-2026-00001', category: 'Pothole / Road Damage', severity: 'Medium', risk: 50,
  ai: { confidence: 95, match: true, severity: 'Medium', detected: 'Pothole' },
  image: 'scene:pothole:1', location: { address: 'Main Road', lat: -25.7, lng: 28.2 },
  status: 'Submitted', statusHistory: [], submittedAt: '2026-09-20T09:00:00Z', assetId: 'RDS-1', workOrderId: null, ...patch,
});
function fixture(reports = [report()], workOrders = []) {
  const state = { reports, workOrders, assets: [{ id: 'RDS-1', type: 'Road Segment', condition: 'Good', status: 'Operational', previousFaults: 1, history: [] }], notifications: [], areas: [] };
  storageEvent({ key: 'infrapulse.state.v1', newValue: JSON.stringify(state) });
}
beforeEach(() => { data.clear(); store.logoutSupervisor(); store.logoutTechnician(); store.disconnectDemoConnectors(); fixture(); });

test('normal reports bypass validation; important, uncertain and conflicting reports surface', () => {
  assert.deepEqual(validationReasons(report()), []);
  for (const patch of [{ severity: 'High' }, { risk: 90 }, { ai: { confidence: 60 } }, { ai: { confidence: null } }, { ai: { confidence: 99, match: false } }, { category: 'Unknown' }, { requiresApproval: true }]) {
    assert.ok(validationReasons(report(patch)).length);
  }
});
test('supervisor actions require their own session', () => {
  store.loginTechnician();
  assert.equal(store.isSupervisorLoggedIn(), false);
  assert.throws(() => store.validateSupervisorReport('INF-2026-00001', {}), /Supervisor/);
  assert.throws(() => store.assignSupervisorTask('INF-2026-00001', 'T-01', '2026-09-22'), /Supervisor/);
  assert.throws(() => store.reviewSupervisorCompletion('WO-1', 'accepted'), /Supervisor/);
  store.loginSupervisor();
  assert.equal(store.isSupervisorLoggedIn(), true);
  store.logoutSupervisor();
  assert.equal(store.isTechnicianLoggedIn(), true);
});
test('approval clears the queue and changed AI data resurfaces', () => {
  fixture([report({ severity: 'High' })]);
  store.loginSupervisor();
  store.validateSupervisorReport('INF-2026-00001', { note: 'Confirmed' });
  const r = store.getState().reports[0];
  assert.equal(r.status, 'Verified');
  assert.deepEqual(validationReasons(r), []);
  assert.ok(validationReasons({ ...r, ai: { ...r.ai, confidence: 30 } }).length);
  assert.throws(() => store.validateSupervisorReport(r.id, {}), /no longer/);
});
test('correction preserves original AI result and updates linked work', () => {
  const r = report({ severity: 'High', workOrderId: 'WO-1' });
  fixture([r], [{ id: 'WO-1', reportId: r.id, category: r.category }]);
  store.loginSupervisor();
  store.validateSupervisorReport(r.id, { category: 'Street Light', severity: 'Low', address: 'Lamp 4, Main Road', note: 'Lamp issue' });
  const updated = store.getState();
  assert.equal(updated.reports[0].category, 'Street Light');
  assert.equal(updated.reports[0].ai.detected, 'Pothole');
  assert.equal(updated.reports[0].assetId, null);
  assert.equal(updated.workOrders[0].category, 'Street Light');
  assert.deepEqual(validationReasons(updated.reports[0]), []);
});
test('assignment requires approval and uses existing work orders', () => {
  store.loginSupervisor();
  assert.throws(() => store.assignSupervisorTask('INF-2026-00001', 'T-04', '2026-09-22'), /Validate/);
  store.validateSupervisorReport('INF-2026-00001', {});
  const wo = store.assignSupervisorTask('INF-2026-00001', 'T-04', '2026-09-22', { priority: 'High', time: '13:45', notes: 'Repair road edge' });
  assert.equal(wo.priority, 'High');
  assert.equal(wo.time, '13:45');
  assert.equal(wo.notes, 'Repair road edge');
  assert.equal(supervisorQueues(store.getState()).assigned.length, 1);
  assert.equal(wo.technicianId, 'T-04');
  assert.equal(store.getState().reports[0].status, 'Assigned');
  assert.equal(store.getState().reports[0].workOrderId, wo.id);
  assert.throws(() => store.assignSupervisorTask('INF-2026-00001', 'T-01', '2026-09-22'), /already assigned/);
  fixture([report({ severity: 'Critical' })]);
  assert.throws(() => store.assignSupervisorTask('INF-2026-00001', 'T-01', '2026-09-22'), /Validate/);
});
test('expertise ranks before load and load breaks expertise ties', () => {
  const ranked = suggestedTechnicians(report(), [{ technicianId: 'T-01', status: 'In Progress' }]);
  assert.equal(ranked[0].id, 'T-04');
  assert.equal(ranked[1].id, 'T-01');
  assert.equal(ranked[1].load, 1);
});
test('queues show each linked task once and ignore orphan work orders', () => {
  const r = report({ severity: 'Critical', workOrderId: 'WO-1' });
  fixture([r, report({ id: 'INF-2' })], [
    { id: 'WO-1', reportId: r.id, status: 'In Progress', technicianId: 'T-01', date: '2020-01-01' },
    { id: 'WO-2', status: 'Scheduled', technicianId: 'T-01', date: '2030-01-01', priority: 'Low' },
    { id: 'WO-3', status: 'Completed', completion: { completedAt: '2020-01-01' } },
  ]);
  const q = supervisorQueues(store.getState(), Date.parse('2026-09-21'));
  assert.equal(q.active.length, 1);
  assert.equal(q.incoming.length, 1);
  assert.equal(q.validated.length, 0);
  assert.equal(q.completed.length, 0); // orphan orders do not appear
});
test('send-back, note-only resubmission, and acceptance preserve evidence and clear review', () => {
  const r = report({ status: 'Resolved', workOrderId: 'WO-1' });
  const w = { id: 'WO-1', reportId: r.id, assetId: 'RDS-1', category: r.category, status: 'Completed', technicianId: 'T-01', timeline: [], completion: { notes: 'Repaired', afterImage: 'existing-photo', completedAt: new Date().toISOString(), verification: { ok: true } } };
  fixture([r], [w]);
  store.loginSupervisor();
  store.reviewSupervisorCompletion(w.id, 'returned', 'Please correct the reported result.');
  assert.equal(store.getState().workOrders[0].status, 'In Progress');
  assert.equal(store.getState().reports[0].status, 'In Progress');
  assert.equal(store.getState().assets[0].status, 'Under Maintenance');
  assert.throws(() => store.resubmitSupervisorTask(w.id, 'Updated'), /Technician/);
  store.loginTechnician();
  assert.throws(() => store.resubmitSupervisorTask(w.id, '  '), /completion note/);
  store.resubmitSupervisorTask(w.id, 'Filled remaining edge and compacted.');
  assert.equal(store.getState().workOrders[0].completion.afterImage, 'existing-photo');
  assert.equal(store.getState().assets[0].previousFaults, 1);
  assert.equal(store.getState().reports[0].status, 'Resolved');
  assert.equal(supervisorQueues(store.getState()).completed.length, 1);
  store.reviewSupervisorCompletion(w.id, 'accepted');
  assert.equal(supervisorQueues(store.getState()).completed[0].reason, 'Completion accepted');
  assert.equal(store.getState().workOrders[0].supervisorReviews.length, 2);
  assert.throws(() => store.reviewSupervisorCompletion(w.id, 'returned'), /no longer/);
});
test('initial completion requires a short note and cannot be repeated', () => {
  const r = report({ workOrderId: 'WO-1' });
  fixture([r], [{ id: 'WO-1', reportId: r.id, assetId: 'RDS-1', category: r.category, status: 'Awaiting Verification', timeline: [], completion: { verification: { ok: true } } }]);
  assert.throws(() => store.completeWorkOrder('WO-1'), /completion note/);
  store.completeWorkOrder('WO-1', 'Repair completed.');
  assert.equal(store.getState().assets[0].previousFaults, 2);
  assert.throws(() => store.completeWorkOrder('WO-1', 'Repeat'), /not awaiting/);
  assert.equal(JSON.parse(data.get('infrapulse.state.v1')).workOrders[0].completion.notes, 'Repair completed.');
});
test('assignment preserves required evidence but accepts supervisor validation of conflicting AI', () => {
  store.loginSupervisor();
  fixture([report({ image: null })]);
  store.validateSupervisorReport('INF-2026-00001', {});
  assert.throws(() => store.assignSupervisorTask('INF-2026-00001', 'T-01', '2026-09-22'), /Evidence required/);
  fixture([report({ ai: { confidence: 50, match: false } })]);
  store.validateSupervisorReport('INF-2026-00001', {});
  assert.ok(store.assignSupervisorTask('INF-2026-00001', 'T-01', '2026-09-22'));
});

test('citizen and automated reports share incoming, validated, assigned, progress and completed queues', () => {
  store.loginSupervisor();
  for (const source of ['Citizen', 'AI']) {
    fixture([report({ source, status: 'Verified' })]);
    let q = supervisorQueues(store.getState());
    assert.equal(q.incoming.length, 1);
    assert.equal(q.incoming[0].report.source, source);
    store.validateSupervisorReport('INF-2026-00001', {});
    q = supervisorQueues(store.getState());
    assert.equal(q.incoming.length, 0);
    assert.equal(q.validated.length, 1);
    const w = store.assignSupervisorTask('INF-2026-00001', 'T-02', '2026-09-23', { priority: 'Critical', time: '10:30' });
    q = supervisorQueues(store.getState());
    assert.equal(q.validated.length, 0);
    assert.equal(q.assigned[0].item.technicianId, 'T-02');
    store.startWork(w.id);
    q = supervisorQueues(store.getState());
    assert.equal(q.assigned.length, 0);
    assert.equal(q.active[0].item.status, 'In Progress');
    store.beginRepairVerification(w.id, { afterImage: 'repaired-photo', notes: 'Repair complete.' });
    store.finishRepairVerification(w.id, { ok: true });
    store.completeWorkOrder(w.id);
    q = supervisorQueues(store.getState());
    assert.equal(q.active.length, 0);
    assert.equal(q.completed[0].item.status, 'Completed');
  }
});
test('dismissed reports remain recorded but cannot be validated or assigned through either entry point', () => {
  store.loginSupervisor();
  for (const source of ['Citizen', 'AI']) {
    fixture([report({ source })]);
    store.dismissSupervisorReport('INF-2026-00001', 'Duplicate report');
    assert.equal(store.getState().reports.length, 1);
    assert.equal(store.getState().reports[0].supervisorDismissal.note, 'Duplicate report');
    assert.equal(supervisorQueues(store.getState()).incoming.length, 0);
    assert.equal(supervisorQueues(store.getState()).validated.length, 0);
    assert.throws(() => store.validateSupervisorReport('INF-2026-00001', {}), /no longer/);
    assert.throws(() => store.assignSupervisorTask('INF-2026-00001', 'T-01', '2026-09-22'), /no longer/);
    assert.throws(() => store.createWorkOrder({ reportId: 'INF-2026-00001' }), /dismissed/);
  }
});
test('invalid schedules and technicians are rejected without creating a work order', () => {
  store.loginSupervisor();
  store.validateSupervisorReport('INF-2026-00001', {});
  for (const [technician, date, options] of [
    ['missing', '2026-09-22', {}],
    ['T-01', '2026-02-30', {}],
    ['T-01', '2026-09-22', { time: '25:10' }],
    ['T-01', '2026-09-22', { priority: 'invalid' }],
  ]) assert.throws(() => store.assignSupervisorTask('INF-2026-00001', technician, date, options), /Select/);
  assert.equal(store.getState().workOrders.length, 0);
  assert.equal(supervisorQueues(store.getState()).validated.length, 1);
});
test('existing unassigned work order is reused and dismissal cannot cancel assigned work', () => {
  fixture([report({ workOrderId: 'WO-1' })], [{ id: 'WO-1', reportId: 'INF-2026-00001', status: 'Scheduled', timeline: [] }]);
  store.loginSupervisor();
  store.validateSupervisorReport('INF-2026-00001', {});
  const w = store.assignSupervisorTask('INF-2026-00001', 'T-03', '2026-09-22', { time: '15:30', priority: 'High', notes: 'Inspect' });
  assert.equal(w.id, 'WO-1');
  assert.equal(w.technicianId, 'T-03');
  assert.equal(w.time, '15:30');
  assert.equal(store.getState().workOrders.length, 1);
  assert.equal(store.getState().reports[0].status, 'Assigned');
  assert.equal(supervisorQueues(store.getState()).assigned.length, 1);
  assert.throws(() => store.dismissSupervisorReport('INF-2026-00001'), /Only unassigned/);
});

test('integration detections create operational reports and supervisor incoming tasks', () => {
  for (const kind of ['pothole', 'traffic']) {
    store.connectDemoConnector(kind);
    const r = store.simulateIntegrationEvent(kind);
    assert.match(r.id, kind === 'pothole' ? /^AI-POT-\d{4}$/ : /^AI-TL-\d{4}$/);
    assert.equal(r.source, 'AI');
    assert.equal(r.status, 'Verified');
    assert.ok(r.image);
    assert.ok(Number.isFinite(r.location.lat) && Number.isFinite(r.location.lng));
    assert.ok(r.risk >= 65);
    assert.equal(r.priority, kind === 'pothole' ? 'High' : 'Critical');
    assert.deepEqual(r.integration.stages, ['Received', 'Validated', 'Report Created', 'Mapped']);
    assert.ok(supervisorQueues(store.getState()).incoming.some((e) => e.report.id === r.id));
    assert.ok(JSON.parse(data.get('infrapulse.state.v1')).reports.some((report) => report.id === r.id));
    store.loginSupervisor();
    store.validateSupervisorReport(r.id, {});
    const w = store.assignSupervisorTask(r.id, 'T-01', '2026-09-22');
    assert.equal(w.reportId, r.id);
    assert.equal(w.image, r.image);
  }
});
test('traffic telemetry fails only the green signal and updates the linked asset', () => {
  const state = store.getState();
  fixture(state.reports);
  store.connectDemoConnector('traffic');
  const r = store.simulateIntegrationEvent('traffic');
  assert.deepEqual(
    [r.integration.payload.telemetry.green, r.integration.payload.telemetry.controller, r.integration.payload.telemetry.power, r.integration.payload.telemetry.communication],
    ['FAILED', 'Online', 'Normal', 'Connected'],
  );
  store.connectDemoConnector('pothole');
  store.connectDemoConnector('traffic');
  const a = store.simulateIntegrationEvent('pothole');
  assert.equal(store.getState().assets.find((asset) => asset.id === a.assetId).status, 'Fault Reported');
  assert.ok(store.getState().assets[0].history.some((h) => h.ref === a.id));
});
test('repeated integration events have distinct report IDs and invalid event types leave state unchanged', () => {
  store.connectDemoConnector('pothole');
  store.connectDemoConnector('traffic');
  const a = store.simulateIntegrationEvent('pothole');
  const b = store.simulateIntegrationEvent('pothole');
  const c = store.simulateIntegrationEvent('traffic');
  assert.notEqual(a.id, b.id);
  assert.notEqual(b.integration.eventId, c.integration.eventId);
  const before = store.getState();
  assert.throws(() => store.simulateIntegrationEvent('invalid'), /Unknown/);
  assert.equal(store.getState(), before);
});

test('each connector gates only its own flow and connecting creates no reports', () => {
  const count = store.getState().reports.length;
  assert.throws(() => store.simulateIntegrationEvent('pothole'), /Connect/);
  assert.throws(() => store.simulateIntegrationEvent('traffic'), /Connect/);
  store.connectDemoConnector('pothole');
  assert.equal(store.getState().reports.length, count);
  assert.ok(store.simulateIntegrationEvent('pothole'));
  assert.throws(() => store.simulateIntegrationEvent('traffic'), /Connect/);
  store.connectDemoConnector('traffic');
  assert.ok(store.simulateIntegrationEvent('traffic'));
  assert.deepEqual(store.getState().connectors, { pothole: true, traffic: true });
  assert.deepEqual(JSON.parse(data.get('infrapulse.state.v1')).connectors, {});
});
test('seed task enrichment preserves assignments and is idempotent', async () => {
  const { buildSeed, enrichSeedTaskContent } = await import('./seed.js');
  const seeded = buildSeed();
  const traffic = seeded.workOrders.filter((w) => w.category === 'Traffic Light');
  assert.ok(traffic.length);
  assert.ok(traffic.every((w) => w.issue && w.technicianId && w.assetId));
  assert.ok(traffic.some((w) => w.issue.includes('sensor')));
  const next = enrichSeedTaskContent(seeded);
  assert.deepEqual(next, seeded);
  assert.equal(next.workOrders.length, seeded.workOrders.length);
});

test('computer vision retains the selected image through report creation and assignment', () => {
  store.connectDemoConnector('pothole');
  const image = 'data:image/jpeg;base64,dGVzdA==';
  const r = store.simulateIntegrationEvent('pothole', { image, imageName: 'uploaded-road.jpg' });
  assert.equal(r.image, image);
  assert.equal(r.integration.payload.image, image);
  assert.equal(r.imageName, 'uploaded-road.jpg');
  assert.equal(r.ai.confidence, 94);
  store.loginSupervisor();
  store.validateSupervisorReport(r.id, {});
  const w = store.assignSupervisorTask(r.id, 'T-01', '2026-09-22');
  assert.equal(w.image, image);
  store.connectDemoConnector('traffic');
  assert.match(store.simulateIntegrationEvent('traffic', { image }).image, /^scene:traffic:/);
});

test('ending the demonstration disconnects both connectors and retains reports', () => {
  store.connectDemoConnector('pothole');
  store.connectDemoConnector('traffic');
  const report = store.simulateIntegrationEvent('pothole');
  store.disconnectDemoConnectors();
  assert.deepEqual(store.getState().connectors, {});
  assert.ok(store.getState().reports.some((r) => r.id === report.id));
  assert.throws(() => store.simulateIntegrationEvent('pothole'), /Connect/);
  assert.throws(() => store.simulateIntegrationEvent('traffic'), /Connect/);
  store.connectDemoConnector('traffic');
  assert.ok(store.simulateIntegrationEvent('traffic'));
});
test('reload starts disconnected while preserving existing reports', async () => {
  store.connectDemoConnector('pothole');
  const report = store.simulateIntegrationEvent('pothole');
  const reloaded = await import('./store.js?reload-test');
  assert.deepEqual(reloaded.getState().connectors, {});
  assert.ok(reloaded.getState().reports.some((r) => r.id === report.id));
  assert.throws(() => reloaded.simulateIntegrationEvent('pothole'), /Connect/);
});
