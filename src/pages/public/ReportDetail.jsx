import { Link, useParams } from 'react-router-dom';
import { Alert, KV, Photo, ReportTimeline, StatusBadge } from '../../components/ui.jsx';
import MapView from '../../components/MapView.jsx';
import { useStore, isOwnCitizenReport } from '../../lib/store.js';
import { fmtDate } from '../../lib/format.js';

// Citizen view: strictly read-only. No risk score, technician, work order or asset data is shown.
export default function CitizenReportDetail() {
  const { id } = useParams();
  const { reports } = useStore();
  const r = reports.find((x) => x.id === id && isOwnCitizenReport(x));

  if (!r) {
    return (
      <div className="page narrow">
        <Alert kind="warn" title="Report not found">We could not find that report.</Alert>
        <div className="btn-row" style={{ marginTop: 16 }}>
          <Link to="/history" className="btn btn-primary">Back to Report History</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page narrow">
      <Link to="/history" className="small">← Report History</Link>
      <div className="page-title" style={{ marginTop: 8 }}>
        <div className="row spread">
          <h1 className="mono" style={{ margin: 0 }}>{r.id}</h1>
          <StatusBadge status={r.status} />
        </div>
        <p>{r.category}</p>
      </div>

      <div className="stack">
        <div className="card">
          <div className="grid cols-2" style={{ alignItems: 'start' }}>
            <Photo rotation={r.imageRotation} src={r.image} alt="Original photograph" tag="ORIGINAL" />
            <KV
              items={[
                ['Reference', <span className="mono" key="r">{r.id}</span>],
                ['Category', r.category],
                ['Cellphone', r.cellphone || 'Not provided'],
                ['Location', r.location.address],
                ['Submitted', fmtDate(r.submittedAt)],
                ['Status', <StatusBadge key="s" status={r.status} />],
              ]}
            />
          </div>
          <div style={{ marginTop: 16 }}>
            <MapView className="map short" center={[r.location.lat, r.location.lng]} zoom={16} interactive={false} markers={[{ id: 'p', lat: r.location.lat, lng: r.location.lng, kind: 'pin' }]} />
          </div>
        </div>

        <div className="card">
          <h2>Progress</h2>
          <ReportTimeline report={r} />
        </div>

        {r.status === 'Resolved' && (
          <div className="card">
            <h2>Resolved</h2>
            <p className="muted">
              Completed on <strong>{fmtDate(r.resolvedAt)}</strong>. The repair was checked and verified by InfraPulse.
            </p>
            {r.afterImage && (
              <div className="comparison">
                <Photo rotation={r.imageRotation} src={r.image} alt="Before repair" tag="BEFORE" />
                <Photo src={r.afterImage} alt="After repair" tag="AFTER" tagClass="after" />
              </div>
            )}
          </div>
        )}
        <p className="muted small">This page is read-only. Status updates appear automatically as the maintenance team progresses your report.</p>
      </div>
    </div>
  );
}
