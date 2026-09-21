import { Link } from 'react-router-dom';
import { Empty, Photo, StatusBadge } from '../../components/ui.jsx';
import { useStore } from '../../lib/store.js';
import { fmtDate } from '../../lib/format.js';

export default function History() {
  const { reports } = useStore();
  const mine = reports.filter((r) => r.mine).sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

  return (
    <div className="page narrow">
      <div className="page-title">
        <h1>Report History</h1>
        <p>Reports submitted from this device, plus a few demo reports. No account needed.</p>
      </div>

      {mine.length === 0 ? (
        <div className="card">
          <Empty icon="reports" title="No reports yet">
            Reports you submit will appear here so you can follow their progress.
          </Empty>
          <div className="btn-row" style={{ justifyContent: 'center' }}>
            <Link to="/report" className="btn btn-primary">Log Report</Link>
          </div>
        </div>
      ) : (
        <div className="stack">
          {mine.map((r) => (
            <Link key={r.id} to={`/history/${r.id}`} className="report-card">
              <Photo src={r.image} className="thumb" alt={`${r.category} photo`} />
              <div className="info">
                <div className="ref mono">{r.id}</div>
                <div>{r.category}</div>
                <div className="muted small">{r.location.address}</div>
                <div className="muted small">{fmtDate(r.submittedAt)}</div>
              </div>
              <StatusBadge status={r.status} />
            </Link>
          ))}
        </div>
      )}
      <div className="btn-row" style={{ marginTop: 22 }}>
        <Link to="/report" className="btn btn-primary">Log Another Report</Link>
        <Link to="/" className="btn btn-ghost">Home</Link>
      </div>
    </div>
  );
}
