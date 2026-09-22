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
  const queues = { incoming: [], validation: [], validated: [], assigned: [], active: [], completed: [] };
  const linkedReports = new Set(state.workOrders.map((w) => w.reportId));
  for (const r of state.reports) {
    if (r.supervisorDismissal || r.status === 'Resolved' || r.workOrderId || linkedReports.has(r.id)) continue;
    const validated = isSupervisorValidated(r);
    queues[validated ? 'validated' : r.supervisorAcceptance?.version === validationVersion(r) ? 'validation' : 'incoming'].push({
      kind: 'report', item: r, report: r,
      reason: validated ? 'Validated - ready for assignment' : validationReasons(r).join(' · ') || 'Awaiting supervisor review',
    });
  }
  for (const w of state.workOrders) {
    const report = state.reports.find((r) => r.id === w.reportId);
    if (!report || report.supervisorDismissal) continue;
    const bucket = w.status === 'Completed' ? 'completed'
      : !w.technicianId ? (isSupervisorValidated(report) ? 'validated' : report.supervisorAcceptance?.version === validationVersion(report) ? 'validation' : 'incoming')
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

export function supervisorOverview(state, now = Date.now()) {
  const queues = supervisorQueues(state, now);
  const open = [...queues.incoming, ...queues.validation, ...queues.validated, ...queues.assigned, ...queues.active];
  const priority = (e) => ({ Critical: 4, High: 3, Medium: 2, Low: 1 }[e.item.priority || e.item.severity] || 0);
  const due = (e) => e.kind === 'work' ? Date.parse(e.item.date + 'T' + (e.item.time || '23:59')) : NaN;
  const overdue = open.filter((e) => Number.isFinite(due(e)) && due(e) < now);
  const urgent = open.filter((e) => priority(e) >= 3);
  const destination = (e) => e.kind === 'work' && e.item.technicianId ? '/supervisor/assigned'
    : isSupervisorValidated(e.report) ? '/supervisor/assign' : '/supervisor/review';
  const preview = [...open].sort((a, b) => priority(b) - priority(a) || (due(a) || Infinity) - (due(b) || Infinity)).slice(0, 4)
    .map((e) => ({ ...e, to: destination(e) }));
  const events = [];
  for (const r of state.reports) {
    events.push({ id: r.id + '-received', at: r.submittedAt, title: 'Report received', detail: r.issue || r.category, ref: r.id, to: '/supervisor/review' });
    if (r.supervisorValidation) events.push({ id: r.id + '-validated', at: r.supervisorValidation.at, title: 'Report validated', detail: r.issue || r.category, ref: r.id, to: r.workOrderId ? '/supervisor/assigned' : '/supervisor/assign' });
    if (r.supervisorDismissal) events.push({ id: r.id + '-dismissed', at: r.supervisorDismissal.at, title: 'Report dismissed', detail: r.issue || r.category, ref: r.id });
  }
  for (const w of state.workOrders) {
    for (const [i, t] of (w.timeline || []).entries()) {
      events.push({ id: w.id + '-' + i, at: t.at, title: t.note || ({ Scheduled: 'Task assigned', 'In Progress': 'Work started', Completed: 'Task completed' }[t.status] || t.status),
        detail: (w.technician || 'Unassigned') + ' - ' + (w.issue || w.category), ref: w.id, to: '/supervisor/assigned' });
    }
  }
  const recent = events.filter((e) => Number.isFinite(Date.parse(e.at)) && Date.parse(e.at) <= now && Date.parse(e.at) >= now - 7 * 86400000)
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 6);
  return { openCount: open.length, urgentCount: urgent.length, overdueCount: overdue.length, preview, recent };
}
