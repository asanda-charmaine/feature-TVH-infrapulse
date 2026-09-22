import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Empty, Photo, StatusBadge } from '../../components/ui.jsx';
import { useStore, isOwnCitizenReport } from '../../lib/store.js';
import { fmtDate } from '../../lib/format.js';

export default function History() {
  const { reports } = useStore();
  const [query, setQuery] = useState('');
  const mine = reports.filter(isOwnCitizenReport)
    .filter((r) => [r.id, r.category, r.location.address, r.status, fmtDate(r.submittedAt)].some((v) => String(v || '').toLowerCase().includes(query.trim().toLowerCase()))).sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

  return (
    <div className="page narrow">
      <div className="page-title">
        <h1>Report History</h1>
        <p>Reports submitted from this device. No account needed.</p>
      </div>

      <input className="input" type="search" aria-label="Search Report History" placeholder="Search reference, category, location or status" value={query} onChange={(e) => setQuery(e.target.value)} style={{ marginBottom: 16 }} />
      {mine.length === 0 ? (
        <div className="card">
          <Empty icon="reports" title={query ? 'No matching reports' : 'No reports yet'}>
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
              <Photo rotation={r.imageRotation} src={r.image} className="thumb" alt={`${r.category} photo`} />
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
      </div>
    </div>
  );
}
