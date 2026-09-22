import { Link, useLocation, useParams } from 'react-router-dom';
import { Alert, Icon, KV, StatusBadge } from '../../components/ui.jsx';
import { useStore } from '../../lib/store.js';
import { emailStatusMessage } from '../../lib/email.js';

export default function ReportSuccess() {
  const { id } = useParams();
  const { state } = useLocation();
  const { reports } = useStore();
  const report = reports.find((r) => r.id === id);

  if (!report) {
    return (
      <div className="page narrow">
        <Alert kind="warn" title="Report not found">We could not find that report on this device.</Alert>
        <div className="btn-row" style={{ marginTop: 16 }}>
          <Link className="btn btn-primary" to="/history">View Report History</Link>
        </div>
      </div>
    );
  }
  const emailMsg = emailStatusMessage(state?.emailResult);

  return (
    <div className="page narrow">
      <div className="card center">
        <div className="success-mark" aria-hidden="true"><Icon name="check" size={38} /></div>
        <h1>Report Successfully Submitted</h1>
        <p className="muted">Thank you for helping improve infrastructure in our community.</p>
        <div className="label muted small" style={{ marginTop: 18 }}>Reference</div>
        <div className="ref-big mono">{report.id}</div>
        <div style={{ maxWidth: 420, margin: '20px auto 0', textAlign: 'left' }}>
          <KV
            items={[
              ['Category', report.category],
              ['Cellphone', report.cellphone || 'Not provided'],
              ['Location', report.location.address],
              ['Status', <StatusBadge key="s" status={report.status} />],
            ]}
          />
        </div>
        {emailMsg && (
          <div style={{ marginTop: 18, textAlign: 'left' }}>
            <Alert kind={state.emailResult.sent ? 'success' : 'info'} icon={<Icon name="mail" size={20} />}>{emailMsg}</Alert>
          </div>
        )}
        <p className="muted small" style={{ marginTop: 16 }}>Keep your reference number to identify this report.</p>
        <div className="btn-row" style={{ justifyContent: 'center', marginTop: 8 }}>
          <Link to={`/history/${report.id}`} className="btn btn-primary">View Report</Link>
          <Link to="/history" className="btn btn-secondary">View Report History</Link>
          <Link to="/" className="btn btn-ghost">Return Home</Link>
        </div>
      </div>
    </div>
  );
}
