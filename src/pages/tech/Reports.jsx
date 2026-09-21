import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHead, RiskChip } from '../../components/tech.jsx';
import { Empty, ExportMenu, Icon, SeverityBadge, SourceBadge, StatusBadge, toast } from '../../components/ui.jsx';
import { useStore, simulateAiDetection } from '../../lib/store.js';
import { CATEGORIES, REPORT_STATUSES, SEVERITIES } from '../../lib/constants.js';
import { fmtShortDate, startOfDay, toDateInput } from '../../lib/format.js';

const DATE_OPTIONS = ['All', 'Today', 'This Week', 'This Month', 'Custom Range'];

export default function Reports() {
  const { reports, assets } = useStore();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [source, setSource] = useState('All');
  const [category, setCategory] = useState('All');
  const [severity, setSeverity] = useState('All');
  const [status, setStatus] = useState('All');
  const [dateMode, setDateMode] = useState('All');
  const [from, setFrom] = useState(toDateInput(new Date(Date.now() - 7 * 86400000)));
  const [to, setTo] = useState(toDateInput());
  const [sort, setSort] = useState('newest');

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const today = startOfDay();
    const weekStart = startOfDay(new Date(Date.now() - 6 * 86400000));
    const monthStart = startOfDay(new Date(Date.now() - 29 * 86400000));
    return reports
      .filter((r) => {
        if (source !== 'All' && r.source !== source) return false;
        if (category !== 'All' && r.category !== category) return false;
        if (severity !== 'All' && r.severity !== severity) return false;
        if (status !== 'All' && r.status !== status) return false;
        const d = new Date(r.submittedAt);
        if (dateMode === 'Today' && d < today) return false;
        if (dateMode === 'This Week' && d < weekStart) return false;
        if (dateMode === 'This Month' && d < monthStart) return false;
        if (dateMode === 'Custom Range') {
          if (from && d < new Date(`${from}T00:00:00`)) return false;
          if (to && d > new Date(`${to}T23:59:59`)) return false;
        }
        if (!needle) return true;
        const asset = assets.find((a) => a.id === r.assetId);
        return [r.id, r.assetId, asset?.name, r.location.address, r.location.area, r.category, r.description, r.source === 'AI' ? 'ai detected' : 'citizen report'].some((f) => String(f || '').toLowerCase().includes(needle));
      })
      .sort((a, b) => (sort === 'risk' ? b.risk - a.risk : new Date(b.submittedAt) - new Date(a.submittedAt)));
  }, [reports, assets, q, source, category, severity, status, dateMode, from, to, sort]);

  const exportTable = () => ({
    name: 'infrapulse_reports',
    title: 'InfraPulse — Reports',
    headers: ['Report ID', 'Source', 'Category', 'Location', 'Severity', 'Risk', 'Status', 'Date', 'Asset', 'Work Order'],
    rows: filtered.map((r) => [r.id, r.source === 'AI' ? 'AI Detected' : 'Citizen Report', r.category, r.location.address, r.severity, r.risk, r.status, fmtShortDate(r.submittedAt), r.assetId || '', r.workOrderId || '']),
  });

  const clear = () => {
    setQ('');
    setSource('All');
    setCategory('All');
    setSeverity('All');
    setStatus('All');
    setDateMode('All');
  };
  const hasFilters = q || source !== 'All' || category !== 'All' || severity !== 'All' || status !== 'All' || dateMode !== 'All';

  return (
    <>
      <PageHead title="Reports" sub="All infrastructure issues submitted by citizens or detected by InfraPulse AI.">
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => {
            const r = simulateAiDetection();
            toast(`AI detected a new issue: ${r.id}`);
          }}
        >
          <Icon name="spark" size={15} /> Receive Connected AI Detection
        </button>
        <ExportMenu getTable={exportTable} />
      </PageHead>

      <div className="toolbar">
        <div className="search">
          <span className="search-ico"><Icon name="search" size={16} /></span>
          <input className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search Report ID, Asset ID, location, category or description — e.g. INF-2026-00421 or Pretoria CBD" aria-label="Search reports" />
        </div>
      </div>

      <div className="filters">
        <select className="select" value={source} onChange={(e) => setSource(e.target.value)} aria-label="Source">
          <option value="All">Source: All</option>
          <option value="Citizen">Source: Citizen</option>
          <option value="AI">Source: AI</option>
        </select>
        <select className="select" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
          <option value="All">Category: All</option>
          {CATEGORIES.map((c) => <option key={c.id}>{c.label}</option>)}
        </select>
        <select className="select" value={severity} onChange={(e) => setSeverity(e.target.value)} aria-label="Severity">
          <option value="All">Severity: All</option>
          {SEVERITIES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select className="select" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="All">Status: All</option>
          {REPORT_STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select className="select" value={dateMode} onChange={(e) => setDateMode(e.target.value)} aria-label="Date">
          {DATE_OPTIONS.map((d) => <option key={d} value={d}>{d === 'All' ? 'Date: All' : d}</option>)}
        </select>
        {dateMode === 'Custom Range' && (
          <>
            <input type="date" className="input input-sm" style={{ width: 'auto' }} value={from} max={to} onChange={(e) => setFrom(e.target.value)} aria-label="From date" />
            <input type="date" className="input input-sm" style={{ width: 'auto' }} value={to} min={from} onChange={(e) => setTo(e.target.value)} aria-label="To date" />
          </>
        )}
        <select className="select" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">
          <option value="newest">Sort: Newest</option>
          <option value="risk">Sort: Highest risk</option>
        </select>
        {hasFilters && <button className="btn btn-ghost btn-sm" onClick={clear}>Clear filters</button>}
      </div>

      <div className="card flush">
        {filtered.length === 0 ? (
          <Empty icon="search" title="No reports match your search">Try a different keyword or clear the filters.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Report ID</th>
                  <th>Source</th>
                  <th>Category</th>
                  <th>Location</th>
                  <th>Severity</th>
                  <th>Risk</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="clickable" onClick={() => navigate(`/technician/reports/${r.id}`)}>
                    <td className="mono"><strong>{r.id}</strong></td>
                    <td><SourceBadge source={r.source} /></td>
                    <td>{r.category}</td>
                    <td>{r.location.address}</td>
                    <td><SeverityBadge severity={r.severity} /></td>
                    <td><RiskChip risk={r.risk} /></td>
                    <td><StatusBadge status={r.status} />{r.supervisorDismissal && <div className="muted small">Dismissed by supervisor</div>}</td>
                    <td className="mono" style={{ whiteSpace: 'nowrap' }}>{fmtShortDate(r.submittedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="muted small" style={{ marginTop: 10 }}>{filtered.length} of {reports.length} reports</p>
    </>
  );
}
