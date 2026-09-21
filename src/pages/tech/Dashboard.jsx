import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import MapView from '../../components/MapView.jsx';
import { PageHead, RiskChip, SectionLink, StatCard } from '../../components/tech.jsx';
import { SeverityBadge, SourceBadge, StatusBadge, Empty } from '../../components/ui.jsx';
import { useStore } from '../../lib/store.js';
import { dashboardStats, priorityIssues, todaysWorkOrders } from '../../lib/stats.js';
import { ALL_LAYERS, MAP_LEGEND, buildMarkers } from '../../lib/mapdata.js';
import { severityFromRisk } from '../../lib/risk.js';
import { DEMO_TECHNICIAN } from '../../lib/constants.js';

export default function Dashboard() {
  const state = useStore();
  const navigate = useNavigate();
  const s = dashboardStats(state);
  const priority = priorityIssues(state.reports, 5);
  const today = todaysWorkOrders(state.workOrders);
  const assetById = (id) => state.assets.find((a) => a.id === id);

  // Preview map: open reports, AI detections, work orders, municipal assets and faulty assets.
  const markers = useMemo(
    () => buildMarkers(state, { ...ALL_LAYERS, vehicles: false }, { assetFilter: (a) => a.type === 'Municipal Asset' || a.status !== 'Operational' }),
    [state],
  );

  return (
    <>
      <PageHead title="Dashboard" sub={`Welcome back, ${DEMO_TECHNICIAN.name.split(' ')[0]}. Here is what needs attention right now.`} />

      <div className="stat-grid">
        <StatCard label="Open Reports" value={s.openReports} sub="Unresolved" to="/technician/reports" />
        <StatCard label="Reports Today" value={s.reportsToday} sub="Newly received" tone="blue" />
        <StatCard label="AI Detected Issues" value={s.aiIssues} sub="From InfraPulse AI" tone="violet" />
        <StatCard label="Active Work Orders" value={s.activeWorkOrders} sub="Being handled" tone="warn" to="/technician/work-orders" />
      </div>

      <div className="split" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="card-head">
            <h2>Priority Issues</h2>
            <SectionLink to="/technician/reports">All reports</SectionLink>
          </div>
          {priority.length === 0 ? (
            <Empty icon="check-circle" title="No open issues" />
          ) : (
            priority.map((r) => {
              const sev = severityFromRisk(r.risk);
              return (
                <Link key={r.id} to={`/technician/reports/${r.id}`} className="issue">
                  <div className={`risk r-${sev}`} title="Risk score">{r.risk}</div>
                  <div className="meta">
                    <div className="row" style={{ gap: 8 }}>
                      <span className="ref mono">{r.id}</span>
                      <SeverityBadge severity={sev} />
                    </div>
                    <div>{r.category}</div>
                    <div className="muted small">{r.location.address}</div>
                  </div>
                  <div className="stack-sm" style={{ alignItems: 'flex-end' }}>
                    <SourceBadge source={r.source} />
                    <StatusBadge status={r.status} />
                  </div>
                </Link>
              );
            })
          )}
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Map Overview</h2>
            <Link to="/technician/map" className="btn btn-secondary btn-sm">Open Full Map</Link>
          </div>
          <MapView className="map" zoom={13} markers={markers} fitToMarkers onNavigate={navigate} />
          <div className="map-legend">
            {MAP_LEGEND.filter(([, l]) => l !== 'Vehicles').map(([c, l]) => (
              <span key={l}><span className="legend-dot" style={{ background: c }} />{l}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="card flush">
        <div className="card-head" style={{ padding: '18px 20px 0' }}>
          <h2>Today's Work Orders</h2>
          <SectionLink to="/technician/work-orders">All work orders</SectionLink>
        </div>
        {today.length === 0 ? (
          <Empty icon="calendar" title="Nothing scheduled today" />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Work Order</th>
                  <th>Asset</th>
                  <th>Issue</th>
                  <th>Location</th>
                  <th>Time</th>
                  <th>Priority</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {today.map((w) => (
                  <tr key={w.id} className="clickable" onClick={() => navigate(`/technician/work-orders/${w.id}`)}>
                    <td className="mono"><strong>{w.id}</strong></td>
                    <td className="mono">{w.assetId || '—'}<div className="muted small" style={{ fontFamily: 'inherit' }}>{assetById(w.assetId)?.name}</div></td>
                    <td>{w.category}</td>
                    <td>{w.location}</td>
                    <td className="mono">{w.time}</td>
                    <td><SeverityBadge severity={w.priority} /></td>
                    <td><StatusBadge status={w.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
