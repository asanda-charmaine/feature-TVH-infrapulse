import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHead } from '../../components/tech.jsx';
import { Empty, ExportMenu, SeverityBadge, StatusBadge, Icon } from '../../components/ui.jsx';
import { useStore } from '../../lib/store.js';
import { WORK_ORDER_STATUSES } from '../../lib/constants.js';
import { toDateInput } from '../../lib/format.js';

export default function WorkOrders() {
  const { workOrders, assets } = useStore();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('All');
  const today = toDateInput();

  const counts = useMemo(() => Object.fromEntries(WORK_ORDER_STATUSES.map((s) => [s, workOrders.filter((w) => w.status === s).length])), [workOrders]);
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return workOrders
      .filter((w) => (status === 'All' || w.status === status) && (!needle || [w.id, w.reportId, w.assetId, w.location, w.category, w.technician].some((f) => String(f || '').toLowerCase().includes(needle))))
      .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));
  }, [workOrders, q, status]);

  const exportTable = () => ({
    name: 'infrapulse_work_orders',
    title: 'InfraPulse — Work Orders',
    headers: ['Work Order ID', 'Report ID', 'Category', 'Asset', 'Location', 'Priority', 'Scheduled Date', 'Time', 'Technician', 'Status'],
    rows: rows.map((w) => [w.id, w.reportId, w.category, w.assetId || '', w.location, w.priority, w.date, w.time, w.technician, w.status]),
  });

  return (
    <>
      <PageHead title="Work Orders" sub="Schedule, perform and verify maintenance work.">
        <ExportMenu getTable={exportTable} />
      </PageHead>

      <div className="toolbar">
        <div className="search">
          <span className="search-ico"><Icon name="search" size={16} /></span>
          <input className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search work order, report, asset, technician or location" aria-label="Search work orders" />
        </div>
      </div>
      <div className="filters">
        <button className={`chip ${status === 'All' ? 'on' : ''}`} onClick={() => setStatus('All')}>All ({workOrders.length})</button>
        {WORK_ORDER_STATUSES.map((s) => (
          <button key={s} className={`chip ${status === s ? 'on' : ''}`} onClick={() => setStatus(s)}>{s} ({counts[s]})</button>
        ))}
      </div>

      <div className="card flush">
        {rows.length === 0 ? (
          <Empty icon="workorders" title="No work orders found">Create a work order from a report to get started.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Work Order</th><th>Report</th><th>Category</th><th>Asset</th><th>Location</th><th>Priority</th><th>Scheduled</th><th>Technician</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((w) => (
                  <tr key={w.id} className="clickable" onClick={() => navigate(`/technician/work-orders/${w.id}`)}>
                    <td className="mono"><strong>{w.id}</strong></td>
                    <td className="mono">{w.reportId}</td>
                    <td>{w.category}</td>
                    <td className="mono">{w.assetId || '—'}<div className="muted small" style={{ fontFamily: 'inherit' }}>{assets.find((a) => a.id === w.assetId)?.name}</div></td>
                    <td>{w.location}</td>
                    <td><SeverityBadge severity={w.priority} /></td>
                    <td className="mono" style={{ whiteSpace: 'nowrap' }}>{w.date === today ? <strong>Today</strong> : w.date} {w.time}</td>
                    <td>{w.technician}</td>
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
