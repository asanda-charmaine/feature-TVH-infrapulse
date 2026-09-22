import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHead } from '../../components/tech.jsx';
import { KV, Modal, toast } from '../../components/ui.jsx';
import { logoutTechnician, resetDemo, useTechnicianStore } from '../../lib/store.js';
import { DEMO_TECHNICIAN } from '../../lib/constants.js';

export default function Profile() {
  const { workOrders } = useTechnicianStore();
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(false);
  const mine = workOrders.filter((w) => w.technicianId === DEMO_TECHNICIAN.id);

  return (
    <>
      <PageHead title="Technician Profile" sub="Demo technician account (no credentials required)." />
      <div className="grid cols-2">
        <div className="card">
          <h2>{DEMO_TECHNICIAN.name}</h2>
          <KV
            items={[
              ['Role', DEMO_TECHNICIAN.role],
              ['Employee ID', DEMO_TECHNICIAN.id],
              ['Depot', DEMO_TECHNICIAN.depot],
              ['Assigned work orders', mine.length],
              ['Completed', mine.filter((w) => w.status === 'Completed').length],
              ['Outstanding', mine.filter((w) => w.status !== 'Completed').length],
            ]}
          />
          <div className="btn-row" style={{ marginTop: 16 }}>
            <button className="btn btn-secondary" onClick={() => { logoutTechnician(); navigate('/'); }}>Logout</button>
          </div>
        </div>
        <div className="card">
          <h2>Demo Data</h2>
          <p className="muted">All data in this prototype is stored in this browser. Reset restores the seeded Tshwane / Pretoria demonstration data, including reports submitted from the citizen side.</p>
          <button className="btn btn-danger" onClick={() => setConfirm(true)}>Reset Demo Data</button>
        </div>
      </div>
      {confirm && (
        <Modal title="Reset demo data?" onClose={() => setConfirm(false)}>
          <p>This removes any reports, work orders and asset changes you made and restores the original seeded data.</p>
          <div className="btn-row end">
            <button className="btn btn-ghost" onClick={() => setConfirm(false)}>Cancel</button>
            <button className="btn btn-danger" onClick={() => { resetDemo(); setConfirm(false); toast('Demo data reset'); }}>Reset</button>
          </div>
        </Modal>
      )}
    </>
  );
}
