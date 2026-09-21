import { Link } from 'react-router-dom';
import { severityFromRisk } from '../lib/risk.js';

export const PageHead = ({ title, sub, children }) => (
  <div className="tech-head">
    <div>
      <h1>{title}</h1>
      {sub && <p>{sub}</p>}
    </div>
    {children && <div className="btn-row">{children}</div>}
  </div>
);

export const StatCard = ({ label, value, sub, tone = '', to }) => {
  const body = (
    <>
      <div className="s-label">{label}</div>
      <div className="s-value">{value}</div>
      {sub && <div className="s-sub">{sub}</div>}
    </>
  );
  return to ? (
    <Link to={to} className={`stat ${tone}`} style={{ color: 'inherit', textDecoration: 'none', display: 'block' }}>
      {body}
    </Link>
  ) : (
    <div className={`stat ${tone}`}>{body}</div>
  );
};

export const RiskChip = ({ risk }) => <span className={`badge b-sev-${severityFromRisk(risk)} mono`}>{risk}</span>;

export const SectionLink = ({ to, children }) => (
  <Link to={to} className="small" style={{ fontWeight: 700 }}>
    {children} →
  </Link>
);

export const Field = ({ label, hint, error, children, full }) => (
  <div className={`field ${full ? 'full' : ''}`}>
    <label>{label}</label>
    {children}
    {hint && <span className="hint">{hint}</span>}
    {error && <span className="error-text">{error}</span>}
  </div>
);
