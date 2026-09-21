import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import MapView from '../../components/MapView.jsx';
import { PageHead, RiskChip } from '../../components/tech.jsx';
import { Alert, KV, Photo, ReportTimeline, SeverityBadge, SourceBadge, StatusBadge, VerificationSummary, toast, Empty } from '../../components/ui.jsx';
import { CreateWorkOrderModal, EvidenceRequiredModal } from '../../components/WorkOrderModals.jsx';
import { hasEvidence, linkReportAsset, useStore, verifyReport } from '../../lib/store.js';
import { categoryByLabel } from '../../lib/constants.js';
import { fmtCoords, haversine } from '../../lib/geo.js';
import { fmtDateTime } from '../../lib/format.js';

export default function TechReportDetail() {
  const { id } = useParams();
  const state = useStore();
  const navigate = useNavigate();
  const [modal, setModal] = useState(null); // 'evidence' | 'workorder'
  const r = state.reports.find((x) => x.id === id);

  if (!r) {
    return (
      <>
        <PageHead title="Report not found" />
        <Empty icon="search" title={`No report with ID ${id}`}><Link to="/technician/reports">Back to Reports</Link></Empty>
      </>
    );
  }

  const asset = state.assets.find((a) => a.id === r.assetId);
  const wo = state.workOrders.find((w) => w.id === r.workOrderId);
  const cat = categoryByLabel(r.category);
  const evidence = hasEvidence(r);
  const eligible = !r.supervisorDismissal && !r.workOrderId && (r.status === 'Submitted' || r.status === 'Verified');
  const sameTypeAssets = state.assets
    .filter((a) => a.type === cat.assetType)
    .map((a) => ({ a, d: haversine(r.location.lat, r.location.lng, a.lat, a.lng) }))
    .sort((x, y) => x.d - y.d)
    .slice(0, 10);

  // Maintenance history = report events + linked asset history.
  const history = [
    ...(asset?.history || []).map((h) => ({ ...h, from: 'asset' })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <>
      <div className="small" style={{ marginBottom: 8 }}><Link to="/technician/reports">← Reports</Link></div>
      <PageHead title={r.id} sub={`${r.category} · ${r.location.address}`}>
        {!r.supervisorDismissal && r.status === 'Submitted' && (
          <button className="btn btn-secondary" onClick={() => { verifyReport(r.id); toast('Report verified'); }}>Verify Report</button>
        )}
        {eligible && (
          <button className="btn btn-primary" onClick={() => setModal(evidence ? 'workorder' : 'evidence')}>Create Work Order</button>
        )}
        {wo && <Link className="btn btn-navy" to={`/technician/work-orders/${wo.id}`}>Open Work Order {wo.id}</Link>}
      </PageHead>

      {r.supervisorDismissal && <Alert kind="info" title="Dismissed by supervisor">{r.supervisorDismissal.note || 'This report does not require a work order.'}</Alert>}
      {!evidence && (
        <div style={{ marginBottom: 16 }}>
          <Alert kind="warn" title="Evidence Required" action={eligible ? <button className="btn btn-primary btn-sm" onClick={() => setModal('evidence')}>Attach Evidence</button> : null}>
            This report has no valid photographic evidence. A valid infrastructure image must be attached before a work order can be created.
          </Alert>
        </div>
      )}

      <div className="split">
        <div className="stack">
          <div className="card">
            <div className="card-head"><h2>Original Image</h2><SourceBadge source={r.source} /></div>
            <Photo src={r.image} alt="Original evidence" tag={r.image ? 'ORIGINAL' : undefined} empty="No image attached — evidence required" />
            {r.description && <p style={{ marginTop: 12 }}><strong>Description:</strong> {r.description}</p>}
          </div>

          <div className="card">
            <h2>AI Image Verification</h2>
            <VerificationSummary ai={r.ai} />
            {r.ai?.match == null && <p className="muted small" style={{ marginTop: 10 }}>No image was available for AI verification.</p>}
          </div>

          <div className="card">
            <h2>Location</h2>
            <p style={{ marginBottom: 4 }}><strong>{r.location.address}</strong></p>
            <p className="muted small">GPS: <span className="mono">{fmtCoords(r.location.lat, r.location.lng)}</span></p>
            <MapView className="map short" center={[r.location.lat, r.location.lng]} zoom={16} markers={[{ id: 'r', lat: r.location.lat, lng: r.location.lng, kind: r.source === 'AI' ? 'ai' : 'citizen' }, ...(asset ? [{ id: asset.id, lat: asset.lat, lng: asset.lng, kind: 'asset' }] : [])]} onNavigate={navigate} />
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <h2>Report Details</h2>
            <KV
              items={[
                ['Report Reference', <span className="mono" key="1">{r.id}</span>],
                ['Report Source', <SourceBadge key="2" source={r.source} />],
                ['Category', r.category],
                ['Severity', <SeverityBadge key="3" severity={r.severity} />],
                ['Risk Score', <RiskChip key="4" risk={r.risk} />],
                ['Date Submitted', fmtDateTime(r.submittedAt)],
                ['Current Status', <StatusBadge key="5" status={r.status} />],
                ['Reporter Email', r.email || 'Not supplied'],
              ]}
            />
          </div>

          <div className="card">
            <h2>Linked Asset</h2>
            {asset ? (
              <KV items={[['Asset', <Link key="a" to={`/technician/assets/${asset.id}`} className="mono">{asset.id}</Link>], ['Name', asset.name], ['Condition', asset.condition], ['Status', asset.status]]} />
            ) : (
              <p className="muted">No asset linked yet.</p>
            )}
            {!r.workOrderId && r.status !== 'Resolved' && (
              <div className="field" style={{ marginTop: 12, marginBottom: 0 }}>
                <label htmlFor="link-asset" className="small">{asset ? 'Change linked asset' : 'Link to an asset'}</label>
                <select id="link-asset" className="select" value={r.assetId || ''} onChange={(e) => { linkReportAsset(r.id, e.target.value); toast('Asset link updated'); }}>
                  <option value="">— none —</option>
                  {sameTypeAssets.map(({ a, d }) => <option key={a.id} value={a.id}>{a.id} · {a.name} ({Math.round(d)} m)</option>)}
                </select>
              </div>
            )}
          </div>

          <div className="card">
            <h2>Linked Work Order</h2>
            {wo ? (
              <KV items={[['Work Order', <Link key="w" to={`/technician/work-orders/${wo.id}`} className="mono">{wo.id}</Link>], ['Technician', wo.technician], ['Scheduled', `${wo.date} ${wo.time}`], ['Status', <StatusBadge key="s" status={wo.status} />]]} />
            ) : (
              <p className="muted">No work order yet.</p>
            )}
          </div>

          <div className="card">
            <h2>Progress</h2>
            <ReportTimeline report={r} />
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2>Maintenance History</h2>
        {history.length === 0 ? (
          <p className="muted">No maintenance history recorded for the linked asset.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Date</th><th>Type</th><th>Event</th><th>Reference</th></tr></thead>
              <tbody>
                {history.slice(0, 12).map((h, i) => (
                  <tr key={i}>
                    <td className="mono" style={{ whiteSpace: 'nowrap' }}>{fmtDateTime(h.date)}</td>
                    <td>{h.type}</td>
                    <td>{h.text}</td>
                    <td className="mono">{h.ref}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal === 'evidence' && (
        <EvidenceRequiredModal report={r} onClose={() => setModal(null)} onAttached={() => setModal('workorder')} />
      )}
      {modal === 'workorder' && <CreateWorkOrderModal report={r} onClose={() => setModal(null)} />}
    </>
  );
}
