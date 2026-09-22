import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AssetForm from '../../components/AssetForm.jsx';
import { PageHead, RiskChip } from '../../components/tech.jsx';
import { ConditionBadge, Empty, ExportMenu, StatusBadge, toast, Icon } from '../../components/ui.jsx';
import { useTechnicianStore } from '../../lib/store.js';
import { currentRisk } from '../../lib/stats.js';
import { ASSET_CONDITIONS, ASSET_STATUSES, ASSET_TYPES, VEHICLE_STATUSES } from '../../lib/constants.js';
import { fmtAge, fmtShortDate } from '../../lib/format.js';

export default function AssetRegistry() {
  const state = useTechnicianStore();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [type, setType] = useState('All');
  const [condition, setCondition] = useState('All');
  const [status, setStatus] = useState('All');
  const [form, setForm] = useState(false);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return state.assets.filter((a) => {
      if (type !== 'All' && a.type !== type) return false;
      if (condition !== 'All' && a.condition !== condition) return false;
      if (status !== 'All' && a.status !== status) return false;
      return !needle || [a.id, a.name, a.location, a.area, a.type, a.registration, a.technician, a.department].some((f) => String(f || '').toLowerCase().includes(needle));
    });
  }, [state.assets, q, type, condition, status]);

  const statusOptions = type === 'Vehicle' ? VEHICLE_STATUSES : [...ASSET_STATUSES, ...VEHICLE_STATUSES.filter((s) => !ASSET_STATUSES.includes(s))];

  const exportTable = () => ({
    name: 'infrapulse_assets',
    title: 'InfraPulse — Asset Registry',
    headers: ['Asset ID', 'Type', 'Name', 'Location', 'Latitude', 'Longitude', 'Installed', 'Condition', 'Status', 'Last Maintenance', 'Previous Faults', 'Risk'],
    rows: rows.map((a) => [a.id, a.type, a.name, a.location, a.lat.toFixed(5), a.lng.toFixed(5), a.installDate?.slice(0, 10) || '', a.condition, a.status, fmtShortDate(a.lastMaintenance), a.previousFaults, currentRisk(a, state)]),
  });

  return (
    <>
      <PageHead title="Asset Registry" sub="Infrastructure and maintenance vehicles known to InfraPulse.">
        <ExportMenu getTable={exportTable} />
        <button className="btn btn-primary" onClick={() => setForm(true)}>+ Add Asset</button>
      </PageHead>

      <div className="toolbar">
        <div className="search">
          <span className="search-ico"><Icon name="search" size={16} /></span>
          <input className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by asset ID, name, location, registration…" aria-label="Search assets" />
        </div>
      </div>
      <div className="filters">
        <select className="select" value={type} onChange={(e) => { setType(e.target.value); setStatus('All'); }} aria-label="Type">
          <option value="All">Type: All</option>
          {ASSET_TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
        <select className="select" value={condition} onChange={(e) => setCondition(e.target.value)} aria-label="Condition">
          <option value="All">Condition: All</option>
          {ASSET_CONDITIONS.map((t) => <option key={t}>{t}</option>)}
        </select>
        <select className="select" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="All">Status: All</option>
          {statusOptions.map((t) => <option key={t}>{t}</option>)}
        </select>
      </div>

      <div className="card flush">
        {rows.length === 0 ? (
          <Empty icon="assets" title="No assets found">Try a different search or filter.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Asset ID</th><th>Type</th><th>Name</th><th>Location</th><th>Age</th><th>Condition</th><th>Status</th><th>Risk</th><th>Last Maintenance</th></tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id} className="clickable" onClick={() => navigate(`/technician/assets/${a.id}`)}>
                    <td className="mono"><strong>{a.id}</strong></td>
                    <td>{a.type}</td>
                    <td>{a.name}</td>
                    <td>{a.location}</td>
                    <td>{fmtAge(a.installDate)}</td>
                    <td><ConditionBadge value={a.condition} /></td>
                    <td><StatusBadge status={a.status} /></td>
                    <td><RiskChip risk={currentRisk(a, state)} /></td>
                    <td className="mono" style={{ whiteSpace: 'nowrap' }}>{fmtShortDate(a.lastMaintenance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="muted small" style={{ marginTop: 10 }}>{rows.length} of {state.assets.length} assets</p>

      {form && <AssetForm onClose={() => setForm(false)} onSaved={(a) => toast(`${a.id} added to the registry`)} />}
    </>
  );
}
