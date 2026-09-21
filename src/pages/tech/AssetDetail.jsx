import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import AssetForm from '../../components/AssetForm.jsx';
import MapView from '../../components/MapView.jsx';
import { PageHead, RiskChip } from '../../components/tech.jsx';
import { ConditionBadge, Empty, KV, Modal, SeverityBadge, StatusBadge, toast } from '../../components/ui.jsx';
import { assetLinks, deleteAsset, useStore } from '../../lib/store.js';
import { fmtCoords } from '../../lib/geo.js';
import { fmtDateTime, fmtShortDate, fmtAge as age } from '../../lib/format.js';
import { currentRisk } from '../../lib/stats.js';

export default function AssetDetail() {
  const { id } = useParams();
  const state = useStore();
  const navigate = useNavigate();
  const [edit, setEdit] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const a = state.assets.find((x) => x.id === id);

  if (!a) {
    return (
      <>
        <PageHead title="Asset not found" />
        <Empty icon="assets" title={`No asset ${id}`}><Link to="/technician/assets">Back to Asset Registry</Link></Empty>
      </>
    );
  }
  const links = assetLinks(state, a.id);
  const isVehicle = a.type === 'Vehicle';
  const history = [...(a.history || [])].sort((x, y) => new Date(y.date) - new Date(x.date));

  function remove() {
    try {
      deleteAsset(a.id);
      toast(`${a.id} deleted`);
      navigate('/technician/assets');
    } catch (e) {
      setConfirm(false);
      toast(e.message, 'error');
    }
  }

  const items = [
    ['Asset ID', <span className="mono" key="i">{a.id}</span>],
    ['Asset Type', a.type],
    ['Name', a.name],
    ['Location', a.location],
    ['GPS Coordinates', <span className="mono" key="g">{fmtCoords(a.lat, a.lng)}</span>],
    ['Installation Date', a.installDate ? `${fmtShortDate(a.installDate)}` : '—'],
    ['Asset Age', age(a.installDate)],
    ['Current Condition', <ConditionBadge key="c" value={a.condition} />],
    ['Operational Status', <StatusBadge key="s" status={a.status} />],
    ['Last Maintenance', fmtShortDate(a.lastMaintenance)],
    ['Previous Faults', a.previousFaults],
    ['Current Risk Score', <RiskChip key="r" risk={currentRisk(a, state)} />],
  ];
  if (isVehicle) {
    items.push(
      ['Registration', a.registration],
      ['Vehicle Type', a.vehicleType],
      ['Department', a.department],
      ['Assigned Technician', a.technician || 'Unassigned'],
      ['Last Service', fmtShortDate(a.lastService)],
      ['Next Service', fmtShortDate(a.nextService)],
      ['Odometer', `${Number(a.odometer).toLocaleString('en-ZA')} km`],
      ['Maintenance Status', a.maintenanceStatus],
    );
  }

  return (
    <>
      <div className="small" style={{ marginBottom: 8 }}><Link to="/technician/assets">← Asset Registry</Link></div>
      <PageHead title={a.id} sub={a.name}>
        <button className="btn btn-secondary" onClick={() => setEdit(true)}>Edit Asset</button>
        <button className="btn btn-danger" onClick={() => setConfirm(true)}>Delete</button>
      </PageHead>

      <div className="split">
        <div className="stack">
          <div className="card"><h2>Asset Information</h2><KV items={items} />{a.notes && <p style={{ marginTop: 12 }}><strong>Notes:</strong> {a.notes}</p>}</div>
          <div className="card">
            <h2>Asset History</h2>
            {history.length === 0 ? <p className="muted">No history recorded yet.</p> : (
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Date</th><th>Type</th><th>Event</th><th>Reference</th></tr></thead>
                  <tbody>
                    {history.map((h, i) => (
                      <tr key={i}>
                        <td className="mono" style={{ whiteSpace: 'nowrap' }}>{fmtDateTime(h.date)}</td>
                        <td>{h.type}</td>
                        <td>{h.text}</td>
                        <td className="mono">{h.ref?.startsWith('INF-') ? <Link to={`/technician/reports/${h.ref}`}>{h.ref}</Link> : h.ref}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
        <div className="stack">
          <div className="card">
            <h2>Location</h2>
            <MapView className="map short" center={[a.lat, a.lng]} zoom={16} interactive={false} markers={[{ id: a.id, lat: a.lat, lng: a.lng, kind: isVehicle ? 'vehicle' : 'asset' }]} />
          </div>
          <div className="card">
            <h2>Linked Reports</h2>
            {links.reports.length === 0 ? <p className="muted">None.</p> : links.reports.slice(0, 8).map((r) => (
              <Link key={r.id} to={`/technician/reports/${r.id}`} className="issue">
                <div className="meta"><span className="ref mono">{r.id}</span><div className="muted small">{r.category}</div></div>
                <SeverityBadge severity={r.severity} /><StatusBadge status={r.status} />
              </Link>
            ))}
          </div>
          <div className="card">
            <h2>Linked Work Orders</h2>
            {links.workOrders.length === 0 ? <p className="muted">None.</p> : links.workOrders.slice(-8).reverse().map((w) => (
              <Link key={w.id} to={`/technician/work-orders/${w.id}`} className="issue">
                <div className="meta"><span className="ref mono">{w.id}</span><div className="muted small">{w.date} · {w.technician}</div></div>
                <StatusBadge status={w.status} />
              </Link>
            ))}
          </div>
        </div>
      </div>

      {edit && <AssetForm asset={a} onClose={() => setEdit(false)} onSaved={() => toast('Asset updated')} />}
      {confirm && (
        <Modal title="Delete asset?" onClose={() => setConfirm(false)}>
          <p>This permanently removes <strong>{a.id}</strong> ({a.name}) from the demo registry. Assets with open reports or work orders cannot be deleted.</p>
          <div className="btn-row end">
            <button className="btn btn-ghost" onClick={() => setConfirm(false)}>Cancel</button>
            <button className="btn btn-danger" onClick={remove}>Delete asset</button>
          </div>
        </Modal>
      )}
    </>
  );
}
