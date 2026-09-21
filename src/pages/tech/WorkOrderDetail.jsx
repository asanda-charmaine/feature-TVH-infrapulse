import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PageHead, RiskChip } from '../../components/tech.jsx';
import { Alert, Empty, Icon, ImageInput, KV, Photo, SAMPLE_PHOTOS, SeverityBadge, SourceBadge, Spinner, StatusBadge, toast } from '../../components/ui.jsx';
import MapView from '../../components/MapView.jsx';
import { beginRepairVerification, completeWorkOrder, finishRepairVerification, setEnRoute, startWork, useStore } from '../../lib/store.js';
import { categoryByLabel } from '../../lib/constants.js';
import { verifyRepair } from '../../lib/ai.js';
import { fmtCoords, getCurrentPosition, haversine } from '../../lib/geo.js';
import { fmtDateTime } from '../../lib/format.js';

function WoTimeline({ wo }) {
  return (
    <ol className="timeline">
      {wo.timeline.map((t, i) => (
        <li key={i} className={`reached ${i === wo.timeline.length - 1 ? 'current' : ''}`}>
          <span className="node"><Icon name="check" size={14} /></span>
          <div className="t-title">{t.status}{t.note ? <span className="muted small"> — {t.note}</span> : null}</div>
          <div className="t-time">{fmtDateTime(t.at)}</div>
        </li>
      ))}
    </ol>
  );
}

function VerificationResult({ v }) {
  if (!v || v.pending) return null;
  return v.ok ? (
    <div className="verify-box ok">
      <strong className="with-icon"><Icon name="check" size={16} /> Verification Successful</strong>
      <div className="metric-row">
        <div className="metric"><div className="m-label">Asset Match</div><div className="m-value">{v.assetMatch}%</div></div>
        <div className="metric"><div className="m-label">Location Match</div><div className="m-value">{v.locationMatch}%</div></div>
        <div className="metric"><div className="m-label">Infrastructure Category</div><div className="m-value">Verified</div></div>
        <div className="metric"><div className="m-label">Repair Evidence</div><div className="m-value">Accepted</div></div>
      </div>
    </div>
  ) : (
    <div className="verify-box fail" role="alert">
      <strong className="with-icon"><Icon name="x" size={16} /> Verification Failed</strong>
      <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
        {v.failures.map((f) => <li key={f}>{f}{f === 'Location mismatch' ? ` (${v.distanceM} m from the reported site)` : ''}</li>)}
      </ul>
      <div className="metric-row">
        <div className="metric"><div className="m-label">Asset Match</div><div className="m-value">{v.assetMatch}%</div></div>
        <div className="metric"><div className="m-label">Location Match</div><div className="m-value">{v.locationMatch}%</div></div>
      </div>
    </div>
  );
}

function RepairEvidencePanel({ wo, cat }) {
  const prev = wo.completion;
  const [afterImage, setAfterImage] = useState(prev?.afterImage || null);
  const [afterName, setAfterName] = useState(prev?.afterName || '');
  const [loc, setLoc] = useState(prev?.location || null);
  const [notes, setNotes] = useState(prev?.notes || '');
  const [busy, setBusy] = useState(false);
  const [locBusy, setLocBusy] = useState(false);

  const verification = prev?.verification;
  const passed = verification?.ok === true;
  // After a failed attempt the technician must supply a new image.
  const showPrev = Boolean(afterImage) && afterImage === prev?.afterImage;
  const failedAttempt = showPrev && verification && !verification.pending && !verification.ok;

  const distance = loc ? haversine(loc.lat, loc.lng, wo.lat, wo.lng) : null;

  async function captureLocation() {
    setLocBusy(true);
    try {
      const p = await getCurrentPosition();
      setLoc({ lat: p.lat, lng: p.lng, simulated: false });
      toast('Current location captured');
    } catch {
      setLoc({ lat: wo.lat + 0.00008, lng: wo.lng - 0.00006, simulated: true });
      toast('GPS unavailable — using a simulated on-site technician location');
    } finally {
      setLocBusy(false);
    }
  }
  const simulateOnSite = () => setLoc({ lat: wo.lat + 0.00008, lng: wo.lng - 0.00006, simulated: true });
  const simulateOffSite = () => setLoc({ lat: wo.lat + 0.006, lng: wo.lng + 0.006, simulated: true });

  async function run() {
    setBusy(true);
    const draft = { afterImage, afterName, location: loc, notes };
    beginRepairVerification(wo.id, draft);
    const result = await verifyRepair({ workOrder: wo, afterImage, filename: afterName, location: loc });
    finishRepairVerification(wo.id, result);
    setBusy(false);
    toast(result.ok ? 'Repair verified' : 'Repair verification failed', result.ok ? 'info' : 'error');
  }

  return (
    <div className="card">
      <h2>Repair Evidence</h2>
      <p className="muted small">A repair cannot be marked complete without new photographic evidence. InfraPulse compares it with the original report, location and asset.</p>

      <div className="stack">
        <div>
          <div className="label" style={{ marginBottom: 6 }}>After Image</div>
          {!afterImage ? (
            <ImageInput onImage={(d, n) => { setAfterImage(d); setAfterName(n || ''); }} samples={SAMPLE_PHOTOS.repair[cat.id]} sampleTitle="Demo repair photos (pick one to see a pass or a failure)" busy={busy} />
          ) : (
            <div className="grid cols-2" style={{ alignItems: 'start' }}>
              <Photo src={afterImage} alt="Repair evidence" tag="AFTER" tagClass="after" />
              {!passed && (
                <div>
                  <button className="btn btn-secondary btn-sm" onClick={() => { setAfterImage(null); setAfterName(''); }} disabled={busy}>Upload Another Image</button>
                </div>
              )}
            </div>
          )}
        </div>

        <div>
          <div className="label" style={{ marginBottom: 6 }}>Current Location</div>
          <div className="btn-row">
            <button className="btn btn-secondary btn-sm" onClick={captureLocation} disabled={locBusy || busy || passed}>{locBusy ? 'Locating…' : 'Capture My Location'}</button>
            <button className="btn btn-secondary btn-sm" onClick={simulateOnSite} disabled={busy || passed}>Simulate On-Site</button>
            <button className="btn btn-ghost btn-sm" onClick={simulateOffSite} disabled={busy || passed} title="Demo: shows a location mismatch failure">Simulate Off-Site</button>
          </div>
          {loc && (
            <p className="small" style={{ margin: '8px 0 0' }}>
              <span className="mono">{fmtCoords(loc.lat, loc.lng)}</span> · {Math.round(distance)} m from reported site {loc.simulated && <span className="muted">(simulated)</span>}
            </p>
          )}
        </div>

        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="tech-notes">Technician Notes <span className="muted small">(optional)</span></label>
          <textarea id="tech-notes" className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} disabled={busy || passed} placeholder="Describe the work completed" />
        </div>

        {!passed && (
          <div className="btn-row">
            <button className="btn btn-navy" disabled={!afterImage || !loc || busy} onClick={run}>
              {busy ? 'Verifying…' : 'Run InfraPulse Verification'}
            </button>
            {(!afterImage || !loc) && <span className="muted small">Add an after image and location to continue.</span>}
          </div>
        )}

        {busy && (
          <div className="verify-box pending">
            <Spinner label="InfraPulse is comparing the repair with the original report, location and asset…" />
            <div className="scan-bar" />
          </div>
        )}
        <VerificationResult v={showPrev ? verification : null} />

        {failedAttempt && <p className="error-text">Mark as Completed is disabled until a repair photo passes verification.</p>}
        <div className="btn-row">
          <button
            className="btn btn-primary btn-lg"
            disabled={!passed || busy}
            onClick={() => { completeWorkOrder(wo.id); toast(`${wo.id} completed — report resolved`); }}
          >
            Mark as Completed
          </button>
        </div>
      </div>
    </div>
  );
}

export default function WorkOrderDetail() {
  const { id } = useParams();
  const state = useStore();
  const [showRepair, setShowRepair] = useState(false);
  const wo = state.workOrders.find((w) => w.id === id);

  if (!wo) {
    return (
      <>
        <PageHead title="Work order not found" />
        <Empty icon="workorders" title={`No work order ${id}`}><Link to="/technician/work-orders">Back to Work Orders</Link></Empty>
      </>
    );
  }

  const report = state.reports.find((r) => r.id === wo.reportId);
  const asset = state.assets.find((a) => a.id === wo.assetId);
  const cat = categoryByLabel(wo.category);
  const v = wo.completion?.verification;
  const failedBefore = wo.status === 'In Progress' && v && !v.pending && !v.ok;
  const panelOpen = wo.status === 'Awaiting Verification' || (wo.status === 'In Progress' && (showRepair || failedBefore));

  return (
    <>
      <div className="small" style={{ marginBottom: 8 }}><Link to="/technician/work-orders">← Work Orders</Link></div>
      <PageHead title={wo.id} sub={`${wo.category} · ${wo.location}`}>
        <StatusBadge status={wo.status} />
        {wo.status === 'Scheduled' && <button className="btn btn-secondary" onClick={() => { setEnRoute(wo.id); toast('Technician is en route'); }}>Set En Route</button>}
        {['Scheduled', 'En Route'].includes(wo.status) && (
          <button className="btn btn-primary" onClick={() => { try { startWork(wo.id); toast('Work started'); } catch (e) { toast(e.message, 'error'); } }}>Start Work</button>
        )}
        {wo.status === 'In Progress' && !panelOpen && <button className="btn btn-primary" onClick={() => setShowRepair(true)}>Complete Work</button>}
      </PageHead>

      {panelOpen && <div style={{ marginBottom: 16 }}><RepairEvidencePanel key={wo.id} wo={wo} cat={cat} /></div>}

      {wo.status === 'Completed' && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h2>Repair Evidence</h2>
          <div className="comparison">
            <Photo src={wo.image} alt="Before" tag="BEFORE" />
            <Photo src={wo.completion?.afterImage} alt="After" tag="AFTER" tagClass="after" />
          </div>
          <ul className="check-list" style={{ marginTop: 16 }}>
            <li><span className="tick"><Icon name="check" size={14} /></span> Category Verified</li>
            <li><span className="tick"><Icon name="check" size={14} /></span> Location Verified</li>
            <li><span className="tick"><Icon name="check" size={14} /></span> Repair Evidence Accepted</li>
            <li><span className="tick"><Icon name="check" size={14} /></span> Work Order Completed</li>
          </ul>
          <div className="metric-row">
            <div className="metric"><div className="m-label">Asset Match</div><div className="m-value">{v?.assetMatch}%</div></div>
            <div className="metric"><div className="m-label">Location Match</div><div className="m-value">{v?.locationMatch}%</div></div>
            <div className="metric"><div className="m-label">Completed</div><div className="m-value" style={{ fontSize: '.9rem' }}>{fmtDateTime(wo.completion?.completedAt)}</div></div>
          </div>
          {wo.completion?.notes && <p style={{ marginTop: 14 }}><strong>Technician notes:</strong> {wo.completion.notes}</p>}
          <p className="muted small">This evidence is now part of the permanent report{asset ? <> and <Link to={`/technician/assets/${asset.id}`}>{asset.id}</Link> maintenance history</> : ''}.</p>
        </div>
      )}

      <div className="split">
        <div className="stack">
          <div className="card">
            <h2>Original Report</h2>
            <div className="grid cols-2" style={{ alignItems: 'start' }}>
              <Photo src={wo.image} alt="Original evidence" tag="ORIGINAL" empty="No image" />
              <KV
                items={[
                  ['Report', report ? <Link key="r" to={`/technician/reports/${report.id}`} className="mono">{report.id}</Link> : wo.reportId],
                  ['Source', report && <SourceBadge key="s" source={report.source} />],
                  ['Category', wo.category],
                  ['Severity', <SeverityBadge key="sev" severity={wo.severity} />],
                  ['Risk Score', <RiskChip key="rk" risk={wo.risk} />],
                  ['Location', wo.location],
                  ['GPS', <span className="mono" key="g">{fmtCoords(wo.lat, wo.lng)}</span>],
                ]}
              />
            </div>
            <div style={{ marginTop: 14 }}>
              <MapView className="map short" center={[wo.lat, wo.lng]} zoom={16} interactive={false} markers={[{ id: 'w', lat: wo.lat, lng: wo.lng, kind: 'workorder' }]} />
            </div>
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <h2>Work Order Details</h2>
            <KV
              items={[
                ['Technician', wo.technician],
                ['Scheduled', `${wo.date} at ${wo.time}`],
                ['Priority', <SeverityBadge key="p" severity={wo.priority} />],
                ['Status', <StatusBadge key="st" status={wo.status} />],
                ['Repair Instructions', wo.notes || '—'],
              ]}
            />
          </div>
          <div className="card">
            <h2>Asset</h2>
            {asset ? (
              <KV items={[['Asset ID', <Link key="a" to={`/technician/assets/${asset.id}`} className="mono">{asset.id}</Link>], ['Name', asset.name], ['Condition', asset.condition], ['Operational Status', asset.status], ['Last Maintenance', fmtDateTime(asset.lastMaintenance)]]} />
            ) : (
              <p className="muted">No asset linked.</p>
            )}
          </div>
          <div className="card">
            <h2>Progress</h2>
            <WoTimeline wo={wo} />
          </div>
        </div>
      </div>
    </>
  );
}
