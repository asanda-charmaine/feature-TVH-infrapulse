import { TECHNICIANS, categoryByLabel } from './constants.js';

// Reopen validation when the information underlying a decision changes.
export const validationVersion = (r) => JSON.stringify([r.category, r.severity, r.risk, r.ai, r.location, r.image, r.requiresApproval]);
export const isSupervisorValidated = (r) => Boolean(r?.supervisorValidation && r.supervisorValidation.version === validationVersion(r));
export function validationReasons(r) {
  if (r.supervisorDismissal || r.status === 'Resolved' || r.supervisorValidation?.version === validationVersion(r)) return [];
  const reasons = [];
  if (['High', 'Critical'].includes(r.severity) || r.risk >= 85) reasons.push('High-priority issue');
  if (r.ai?.confidence == null || !Number.isFinite(Number(r.ai.confidence)) || Number(r.ai.confidence) < 80) reasons.push('Uncertain AI result');
  if (r.ai?.match === false || r.ai?.conflict || (r.ai?.severity && r.ai.severity !== r.severity)) reasons.push('Conflicting information');
  if (!categoryByLabel(r.category) || r.ai?.uncertain) reasons.push('Unusual classification');
  if (r.requiresApproval) reasons.push('Approval required');
  return reasons;
}
export function suggestedTechnicians(task, orders) {
  const skill = { pothole: 'Roads', traffic: 'Traffic Signals', street: 'Public Lighting' }[categoryByLabel(task.category)?.id];
  return TECHNICIANS.map((t) => ({ ...t, matches: t.skill === skill, load: orders.filter((w) => w.technicianId === t.id && w.status !== 'Completed').length }))
    .sort((a, b) => Number(b.matches) - Number(a.matches) || a.load - b.load || a.name.localeCompare(b.name));
}
export function followUpReason(w, now = Date.now()) {
  if (w.status === 'Completed') return null;
  if (w.supervisorReview?.decision === 'returned') return 'Needs Correction';
  const due = Date.parse(w.date + 'T' + (w.time || '23:59'));
  if (Number.isFinite(due) && due < now) return 'Overdue / Attention Required';
  if (['High', 'Critical'].includes(w.priority)) return 'High-priority task';
  return null;
}

export function supervisorQueues(state, now = Date.now()) {
  const queues = { incoming: [], validated: [], assigned: [], active: [], completed: [] };
  const linkedReports = new Set(state.workOrders.map((w) => w.reportId));
  for (const r of state.reports) {
    if (r.supervisorDismissal || r.status === 'Resolved' || r.workOrderId || linkedReports.has(r.id)) continue;
    const validated = isSupervisorValidated(r);
    queues[validated ? 'validated' : 'incoming'].push({
      kind: 'report', item: r, report: r,
      reason: validated ? 'Validated - ready for assignment' : validationReasons(r).join(' · ') || 'Awaiting supervisor review',
    });
  }
  for (const w of state.workOrders) {
    const report = state.reports.find((r) => r.id === w.reportId);
    if (!report || report.supervisorDismissal) continue;
    const bucket = w.status === 'Completed' ? 'completed'
      : !w.technicianId ? (isSupervisorValidated(report) ? 'validated' : 'incoming')
      : ['In Progress', 'Awaiting Verification'].includes(w.status) ? 'active' : 'assigned';
    const reason = bucket === 'completed'
      ? (w.supervisorReview?.decision === 'accepted' ? 'Completion accepted' : 'Needs Review')
      : followUpReason(w, now) || (bucket === 'validated' ? 'Validated - ready for assignment' : w.status);
    queues[bucket].push({ kind: 'work', item: w, report, reason });
  }
  const rank = { Critical: 4, High: 3, Medium: 2, Low: 1 };
  const sort = (a, b) => (rank[b.item.priority || b.item.severity] || 0) - (rank[a.item.priority || a.item.severity] || 0)
    || (b.item.risk || 0) - (a.item.risk || 0)
    || String(a.item.createdAt || a.item.submittedAt).localeCompare(String(b.item.createdAt || b.item.submittedAt));
  for (const queue of Object.values(queues)) queue.sort(sort);
  return queues;
}
