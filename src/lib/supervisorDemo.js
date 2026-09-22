import { TECHNICIANS } from './constants.js';
import { computeRisk } from './risk.js';
import { validationVersion } from './supervisor.js';
import { toDateInput } from './format.js';

// Add once to existing saved data; never reset user decisions or duplicate mock tasks.
export function addSupervisorDemoData(state, now = new Date()) {
  if (state.supervisorDemoVersion === 1) return state;
  const scenarios = [
    ['traffic', 'Incoming', 'Offline sensor - restore communication', 'Critical', 'AI'],
    ['pothole', 'Incoming', 'Pothole reported near Pretoria CBD', 'High', 'Citizen'],
    ['traffic', 'Validated', 'Failed controller - controller inspection', 'High', 'AI'],
    ['pothole', 'Validated', 'Pothole maintenance from computer-vision detection', 'High', 'AI'],
    ['traffic', 'Assigned', 'Damaged sensor - sensor replacement', 'High', 'AI'],
    ['traffic', 'Assigned', 'Blown traffic-light lamp - green signal failure', 'Critical', 'AI'],
    ['pothole', 'In Progress', 'Road surface repair and pothole filling', 'High', 'AI'],
    ['traffic', 'Completed', 'Sensor power fault repaired', 'Medium', 'AI'],
  ];
  const reports = [...state.reports];
  const workOrders = [...state.workOrders];
  scenarios.forEach(([kind, stage, issue, severity, source], index) => {
    const id = 'DEMO-SUP-' + String(index + 1).padStart(3, '0');
    if (reports.some((r) => r.id === id)) return;
    const category = kind === 'traffic' ? 'Traffic Light' : 'Pothole / Road Damage';
    const asset = state.assets.find((a) => a.type === (kind === 'traffic' ? 'Traffic Light' : 'Road Segment') && a.area === 'Pretoria CBD')
      || state.assets.find((a) => a.type === (kind === 'traffic' ? 'Traffic Light' : 'Road Segment'));
    const at = new Date(+now - (index + 2) * 3600000).toISOString();
    const assignedAt = new Date(+new Date(at) + 1800000).toISOString();
    const hasOrder = ['Assigned', 'In Progress', 'Completed'].includes(stage);
    const woId = hasOrder ? 'WO-DEMO-SUP-' + String(index + 1).padStart(3, '0') : null;
    if (woId && workOrders.some((w) => w.id === woId)) return;
    const status = stage === 'Incoming' ? 'Submitted' : stage === 'Validated' ? 'Verified' : stage === 'Completed' ? 'Resolved' : stage;
    const location = { address: asset?.location || 'Pretorius Street, Pretoria CBD', area: asset?.area || 'Pretoria CBD',
      street: asset?.location?.split(',')[0] || 'Pretorius Street', lat: asset?.lat ?? -25.7463, lng: asset?.lng ?? 28.1891 };
    const r = { id, source, category, issue, description: issue, image: 'scene:' + kind + ':' + (index + 40),
      imageName: kind + '-evidence.jpg', ai: { detected: issue, confidence: 94, match: true, severity },
      location, severity, risk: computeRisk({ severity, asset }), priority: severity,
      submittedAt: at, status, statusHistory: [{ status: 'Submitted', at }], assetId: asset?.id || null,
      workOrderId: woId, email: '', mine: false, resolvedAt: stage === 'Completed' ? now.toISOString() : null,
      afterImage: stage === 'Completed' ? 'scene:traffic-fixed:40' : null, mock: true };
    if (stage !== 'Incoming') {
      r.supervisorValidation = { decision: 'approved', note: 'Reviewed for maintenance', at: assignedAt, version: validationVersion(r) };
      r.statusHistory.push({ status: 'Verified', at: assignedAt });
    }
    if (hasOrder) {
      r.statusHistory.push({ status: 'Assigned', at: assignedAt });
      if (stage === 'In Progress' || stage === 'Completed') r.statusHistory.push({ status: 'In Progress', at: assignedAt });
      if (stage === 'Completed') r.statusHistory.push({ status: 'Resolved', at: now.toISOString() });
      const technician = TECHNICIANS.find((t) => t.skill === (kind === 'traffic' ? 'Traffic Signals' : 'Roads'));
      const woStatus = stage === 'Assigned' ? 'Scheduled' : stage;
      const timeline = [{ status: 'Scheduled', at: assignedAt }];
      if (stage !== 'Assigned') timeline.push({ status: 'In Progress', at: assignedAt });
      if (stage === 'Completed') timeline.push({ status: 'Completed', at: now.toISOString() });
      workOrders.push({ id: woId, reportId: id, assetId: r.assetId, category, issue, location: location.address,
        lat: location.lat, lng: location.lng, image: r.image, severity, risk: r.risk, priority: severity,
        technician: technician.name, technicianId: technician.id, date: toDateInput(now), time: '14:00',
        notes: issue + '. Inspect the site, repair and verify operation.', createdAt: assignedAt, status: woStatus, timeline,
        completion: stage === 'Completed' ? { notes: 'Restored sensor power and confirmed normal controller readings.',
          afterImage: r.afterImage, afterName: 'repaired-sensor.jpg', location,
          verification: { ok: true, assetMatch: 98, locationMatch: 99, failures: [] }, completedAt: now.toISOString() } : null,
        supervisorReviewRequestedAt: stage === 'Completed' ? now.toISOString() : null, mock: true });
    }
    reports.push(r);
  });
  return { ...state, reports, workOrders, supervisorDemoVersion: 1 };
}
