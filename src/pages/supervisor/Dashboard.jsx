import IntegrationDemo from '../../components/IntegrationDemo.jsx';
import { useEffect, useState } from 'react';
import MapView from '../../components/MapView.jsx';
import { useSearchParams } from 'react-router-dom';
import { EvidenceRequiredModal } from '../../components/WorkOrderModals.jsx';
import { ChartCard, BarList } from '../../components/charts.jsx';
import { PageHead, StatCard } from '../../components/tech.jsx';
import { Modal, Photo, SeverityBadge, StatusBadge, SourceBadge, toast } from '../../components/ui.jsx';
import { useStore, acceptSupervisorReport, validateSupervisorReport, assignSupervisorTask, reviewSupervisorCompletion, dismissSupervisorReport } from '../../lib/store.js';
import { supervisorQueues, supervisorOverview, suggestedTechnicians, validationReasons, isSupervisorValidated } from '../../lib/supervisor.js';
import { CATEGORIES, SEVERITIES } from '../../lib/constants.js';
import { toDateInput, fmtDateTime } from '../../lib/format.js';

const tabs = [['incoming', 'Pending Logs'], ['validation', 'Data Validation'], ['validated', 'Validated Tasks'], ['assigned', 'Assigned Tasks'], ['active', 'In Progress'], ['completed', 'Completed Logs']];
function Decision({ entry, state, onClose, view }) {
  const linkedTask = entry.kind === 'work' ? state.workOrders.find((w) => w.id === entry.item.id) : null;
  const report = state.reports.find((r) => r.id === (linkedTask?.reportId || entry.item.id));
  const task = linkedTask || state.workOrders.find((w) => w.id === report?.workOrderId);
  const technicians = suggestedTechnicians(task || report || entry.item, state.workOrders);
  const [correct, setCorrect] = useState(false);
  const [category, setCategory] = useState(report?.category || '');
  const [severity, setSeverity] = useState(report?.severity || 'Medium');
  const [address, setAddress] = useState(report?.location?.address || '');
  const [note, setNote] = useState('');
  const [technicianId, setTechnician] = useState(technicians[0]?.id || '');
  const [date, setDate] = useState(toDateInput());
  const [time, setTime] = useState('09:00');
  const [priority, setPriority] = useState(report?.severity || 'Medium');
  const [assignmentNotes, setAssignmentNotes] = useState('');
  const [error, setError] = useState('');
  const [showEvidence, setShowEvidence] = useState(false);
  if (!report) return <Modal title="Task unavailable" onClose={onClose}><p>The linked report is no longer available.</p><button className="btn btn-secondary" onClick={onClose}>Close</button></Modal>;
  if (showEvidence && report) return <EvidenceRequiredModal report={report} onClose={() => setShowEvidence(false)} onAttached={() => { acceptSupervisorReport(report.id); setShowEvidence(false); }} />;
  const needsValidation = view === 'validation' && !report.supervisorDismissal && report.status !== 'Resolved' && !isSupervisorValidated(report);
  const needsReview = view !== 'map' && task?.status === 'Completed' && task.supervisorReview?.decision !== 'accepted';
  const needsAssignment = view === 'assign' && !report.supervisorDismissal && isSupervisorValidated(report) && (!report.workOrderId || task && !task.technicianId && task.status !== 'Completed');
  function act(fn, message, close = true) {
    try { fn(); toast(message); if (close) onClose(); } catch (e) { setError(e.message); }
  }
  return <Modal title={task?.id || report.id} onClose={onClose}>
    <div className="stack">
      <section><h3>Problem</h3><div className="btn-row"><SourceBadge source={report.source} /><StatusBadge status={task?.status || report.status} /></div><p className="muted small">{report.id} · {fmtDateTime(report.submittedAt)}</p><p className="muted small">Risk: {task?.risk ?? report.risk}</p><p><strong>{task?.issue || report.issue || report.ai?.detected || report.category}</strong></p><p>{report.location.address}</p>{report.cellphone && <p className="small">Cellphone: {report.cellphone}</p>}<SeverityBadge severity={task?.priority || report.severity} /></section>
      <section><h3>System / AI Result</h3><p>{report.ai?.detected || 'No classification available'}{view === 'validation' && report.ai?.confidence != null ? ' · ' + report.ai.confidence + '% confidence' : ''}</p><p className="muted small">{needsValidation ? (validationReasons(report).join(' · ') || 'Ready for data validation') : report.supervisorValidation ? 'Supervisor decision recorded' : 'No validation decision needed'}</p>
        {report.image && <details><summary>View supporting image</summary><Photo rotation={report.imageRotation} src={report.image} alt="Reported infrastructure issue" /></details>}
      </section>
      <section><h3>Technician Result</h3>{task ? <><p>{task.technician || 'Unassigned'} · <StatusBadge status={task.status} /></p><p>{task.completion?.notes || 'No completion note submitted.'}</p><p className="muted small">Scheduled: {task.date} {task.time}</p>{task.completion?.verification && <p className="muted small">{task.completion.verification.pending ? 'System verification pending' : task.completion.verification.ok ? 'Existing repair verification passed' : 'Repair verification needs correction'}</p>}{task.supervisorReview?.decision === 'returned' && <p>Needs Correction: {task.supervisorReview.note}</p>}</> : <p className="muted">Not yet assigned.</p>}</section>
      <section className="stack-sm"><h3>{view === 'validation' ? 'Data Validation' : 'Supervisor Decision'}</h3>
        {view === 'review' && !task?.technicianId && !report.supervisorDismissal && report.status !== 'Resolved' && !isSupervisorValidated(report) && <button className="btn btn-primary" onClick={() => act(() => acceptSupervisorReport(report.id, note), 'Accepted - available in Data Validation')}>Accept </button>}
        {(view === 'review' || needsValidation || needsReview) && <div className="field"><label htmlFor="decision-note">Short comment (optional)</label><input id="decision-note" className="input" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder={needsReview ? 'Task not fully completed' : 'Reason for this decision'} /></div>}
        {needsValidation && <>
          {!report.image && <button className="btn btn-secondary" onClick={() => setShowEvidence(true)}>Attach Evidence</button>}
          {correct && <div className="stack-sm"><div className="field"><label htmlFor="correct-category">Issue type</label><select id="correct-category" className="select" value={category} onChange={(e) => setCategory(e.target.value)}>{CATEGORIES.map((c) => <option key={c.id}>{c.label}</option>)}</select></div><div className="field"><label htmlFor="correct-severity">Priority</label><select id="correct-severity" className="select" value={severity} onChange={(e) => setSeverity(e.target.value)}>{SEVERITIES.map((s) => <option key={s}>{s}</option>)}</select></div><div className="field"><label htmlFor="correct-address">Location description</label><input id="correct-address" className="input" value={address} onChange={(e) => setAddress(e.target.value)} /></div></div>}
          <div className="btn-row"><button className="btn btn-primary" disabled={!report.image} onClick={() => act(() => validateSupervisorReport(report.id, correct ? { category, severity, address, note } : { note }), 'Task validated - available in Assign Tasks')}>{correct ? 'Save Correction' : 'Validate Data'}</button><button className="btn btn-secondary" onClick={() => setCorrect(!correct)}>{correct ? 'Cancel Correction' : 'Correct'}</button></div>
        </>}
        {view === 'review' && !task && !report.workOrderId && !report.supervisorDismissal && report.status !== 'Resolved' && <button className="btn btn-secondary  " onClick={() => act(() => dismissSupervisorReport(report.id, note), 'Report dismissed')}>Reject </button>}
        {needsReview && <div className="btn-row"><button className="btn btn-primary" onClick={() => act(() => reviewSupervisorCompletion(task.id, 'accepted', note), 'Completion accepted')}>Accept Completion</button><button className="btn btn-secondary" onClick={() => act(() => reviewSupervisorCompletion(task.id, 'returned', note), 'Task sent back to technician')}>Send Back</button></div>}
        {needsAssignment && <><div className="field"><label htmlFor="assign-tech">Suitable technicians · expertise · active load</label><select id="assign-tech" className="select" value={technicianId} onChange={(e) => setTechnician(e.target.value)}>{technicians.map((t) => <option key={t.id} value={t.id}>{t.matches ? 'Recommended: ' : ''}{t.name} · {t.skill} · {t.load} active</option>)}</select></div><div className="field"><label htmlFor="assign-date">Scheduled date</label><input id="assign-date" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div><div className="field"><label htmlFor="assign-time">Scheduled time</label><input id="assign-time" className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} /></div><div className="field"><label htmlFor="assign-priority">Priority</label><select id="assign-priority" className="select" value={priority} onChange={(e) => setPriority(e.target.value)}>{SEVERITIES.map((s) => <option key={s}>{s}</option>)}</select></div><div className="field"><label htmlFor="assign-notes">Notes / repair instructions (optional)</label><textarea id="assign-notes" className="textarea" maxLength={1000} value={assignmentNotes} onChange={(e) => setAssignmentNotes(e.target.value)} /></div><button className="btn btn-primary" onClick={() => act(() => assignSupervisorTask(report.id, technicianId, date, { time, priority, notes: assignmentNotes }), 'Task assigned')}>Assign Technician</button>{!report.image && <p className="muted small">The existing task system requires a report image. Attach evidence in Data Validation before approval.</p>}</>}
        {!needsValidation && !needsReview && !needsAssignment && <p className="muted">{task?.supervisorReview?.decision === 'returned' ? 'Waiting for the technician to correct and resubmit.' : task?.status === 'Completed' ? 'Completion accepted.' : view === 'review' ? 'Accept this log for Data Validation, or dismiss it.' : 'Follow-up: review the schedule and technician progress above.'}</p>}
      </section>
      {error && <p className="error-text" role="alert">{error}</p>}
      <div className="btn-row end"><button className="btn btn-ghost" onClick={onClose}>Close</button></div>
    </div>
  </Modal>;
}
export default function SupervisorDashboard({ view = 'dashboard' }) {
  const state = useStore();
  const [searchParams] = useSearchParams();
  const requestedReport = searchParams.get('report');
  const [tab, setTab] = useState(view === 'assign' ? 'validated' : view === 'validation' ? 'validation' : view === 'assigned' ? 'assigned' : 'incoming');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState(null);
  useEffect(() => {
    if (requestedReport) {
      const report = state.reports.find((r) => r.id === requestedReport);
      if (report) setSelected({ kind: 'report', item: report });
    }
  }, [requestedReport]);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(timer); }, []);
  const queues = supervisorQueues(state, now);
  const visibleTabs = view === 'review' ? tabs.filter(([id]) => id === 'incoming' || id === 'completed')
    : view === 'validation' ? tabs.filter(([id]) => id === 'validation')
    : view === 'assign' ? tabs.filter(([id]) => id === 'validated')
    : tabs.filter(([id]) => ['assigned', 'active', 'completed'].includes(id));
  if (view === 'dashboard') {
    const overview = supervisorOverview(state, now);
    const pending = queues.completed.filter((e) => e.item.supervisorReview?.decision !== 'accepted').length;
    return <>
      <PageHead title="Supervisor Dashboard" sub="Infrastructure task overview." />
      <div className="grid cols-4">
        <StatCard label="Open Tasks" value={overview.openCount} sub="Incoming, validated, assigned and in-progress work" />
        <StatCard label="Awaiting Review" value={queues.incoming.length + pending} sub="Incoming reports and completed work awaiting decisions" to="/supervisor/review" />
        <StatCard label="Completed Work Orders" value={queues.completed.length} to="/supervisor/assigned" />
        <StatCard label="Technicians On Site" value={new Set(state.workOrders.filter((w) => w.status === 'In Progress' && w.technicianId).map((w) => w.technicianId)).size} sub="Technicians with work currently In Progress" />
      </div>
      <div className="grid cols-2" style={{ marginTop: 20 }}>
        <ChartCard title="Work Orders by Status" data={['Scheduled', 'En Route', 'In Progress', 'Awaiting Verification', 'Completed'].map((label) => ({ label, value: state.workOrders.filter((w) => w.status === label).length }))}>
          <BarList data={['Scheduled', 'En Route', 'In Progress', 'Awaiting Verification', 'Completed'].map((label) => ({ label, value: state.workOrders.filter((w) => w.status === label).length }))} />
        </ChartCard>
        <section className="card"><h2>AI-Detected Reports</h2><MapView fitToMarkers markers={state.reports.filter((r) => r.source === 'AI' && !r.supervisorDismissal && Number.isFinite(r.location?.lat) && Number.isFinite(r.location?.lng)).map((r) => ({ id: r.id, lat: r.location.lat, lng: r.location.lng, kind: 'ai', title: r.id + ' - ' + r.category, onClick: () => setSelected({ kind: 'report', item: r }) }))} /></section>
      </div>
      <IntegrationDemo />
      {selected && <Decision entry={selected} state={state} view="map" onClose={() => setSelected(null)} />}
    </>;
  }
  const list = queues[tab];
  const currentPage = Math.min(page, Math.max(0, Math.ceil(list.length / 8) - 1));
  return <>
    <PageHead title={view === 'review' ? 'Review Tasks' : view === 'validation' ? 'Data Validation' : view === 'assign' ? 'Assign Tasks' : 'Assigned Tasks'} sub={view === 'review' ? 'Review citizen and connected infrastructure reports.' : view === 'validation' ? 'Validate accepted report data before assignment.' : view === 'assign' ? 'Assign validated tasks to existing technicians.' : 'Monitor assigned work and completion.'} />
    <div className="btn-row" style={{ marginBottom: 20 }} aria-label="Supervisor queues">{visibleTabs.map(([id, label]) => <button key={id} className={'btn ' + (tab === id ? 'btn-primary' : 'btn-secondary')} aria-pressed={tab === id} onClick={() => { setTab(id); setPage(0); }}>{label} ({queues[id].length})</button>)}</div>
    <div className="stack-sm">
      <p className="muted small">{{ incoming: 'Review pending logs and accept or dismiss them.', validation: 'Confirm or correct the data in accepted logs before assignment.', validated: 'Validated reports ready for technician assignment.', assigned: 'Assigned tasks scheduled or en route.', active: 'Technician work in progress, including corrections and repair verification.', completed: 'Completed tasks and supervisor completion reviews.' }[tab]}</p>
      {!list.length && <div className="card"><h2>Nothing needs attention here</h2><p className="muted">This queue is up to date.</p></div>}
      {list.slice(currentPage * 8, currentPage * 8 + 8).map((entry) => <article className="card" key={entry.kind + entry.item.id}><div className="stack-sm"><div><strong>{entry.item.issue || entry.report.issue || entry.report.ai?.detected || entry.item.category}</strong><div className="btn-row" style={{ marginTop: 8 }}><SourceBadge source={entry.report.source} /><StatusBadge status={entry.item.status} /><SeverityBadge severity={entry.item.priority || entry.item.severity} /></div><p className="muted small">{entry.item.id} · {typeof entry.item.location === 'string' ? entry.item.location : entry.item.location?.address}</p><p className="muted small">Risk: {entry.item.risk} · {fmtDateTime(entry.report.submittedAt)}{entry.item.technician ? ' · ' + entry.item.technician : ''}</p><p>{entry.reason}</p>{entry.kind === 'work' && <p className="muted small">Scheduled: {entry.item.date} {entry.item.time}</p>}
        {entry.kind === 'work' && <p className="muted small">Asset / sensor: {entry.item.assetId || entry.report.assetId || 'Not linked'} · Technician: {entry.item.technician || 'Unassigned'} · Date assigned: {fmtDateTime(entry.item.createdAt)}</p>}</div><button className="btn btn-primary" style={{ alignSelf: 'flex-start', maxWidth: '100%', whiteSpace: 'normal' }} onClick={() => setSelected(entry)}>{tab === 'completed' ? 'Review' : tab === 'validated' ? 'Assign Technician' : tab === 'validation' ? 'Validate Data' : tab === 'incoming' ? 'Review' : 'View Task'}</button></div></article>)}
      {list.length > 8 && <div className="btn-row"><button className="btn btn-secondary" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</button><span>Page {currentPage + 1} of {Math.ceil(list.length / 8)}</span><button className="btn btn-secondary" disabled={(currentPage + 1) * 8 >= list.length} onClick={() => setPage(currentPage + 1)}>Next</button></div>}
    </div>
    {selected && <Decision key={selected.kind + selected.item.id} entry={selected} view={view} state={state} onClose={() => setSelected(null)} />}
  </>;
}
