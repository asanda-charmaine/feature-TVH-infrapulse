import { useState } from 'react';
import { Modal } from './ui.jsx';
import MapView from './MapView.jsx';
import { ASSET_CONDITIONS, ASSET_STATUSES, ASSET_TYPES, DEPARTMENTS, TECHNICIANS, VEHICLE_STATUSES, VEHICLE_TYPES } from '../lib/constants.js';
import { PRETORIA_CENTER, fmtCoords } from '../lib/geo.js';
import { toDateInput } from '../lib/format.js';
import { addAsset, updateAsset } from '../lib/store.js';

const dateOnly = (v) => (v ? String(v).slice(0, 10) : '');

/** Add / edit an asset. Fields adapt to the selected type (vehicles have their own record). */
export default function AssetForm({ asset, initial, onClose, onSaved }) {
  const editing = Boolean(asset);
  const base = asset || {
    type: 'Traffic Light',
    name: '',
    location: '',
    area: '',
    lat: PRETORIA_CENTER[0],
    lng: PRETORIA_CENTER[1],
    installDate: toDateInput(),
    condition: 'Good',
    status: 'Operational',
    notes: '',
    ...initial,
  };
  const [f, setF] = useState({
    registration: '',
    vehicleType: VEHICLE_TYPES[0],
    department: DEPARTMENTS[0],
    technician: '',
    lastService: new Date().toISOString(),
    nextService: new Date(Date.now() + 90 * 86400000).toISOString(),
    odometer: 0,
    maintenanceStatus: 'Up to date',
    ...base,
    installDate: dateOnly(base.installDate),
  });
  const [errors, setErrors] = useState({});
  const isVehicle = f.type === 'Vehicle';
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  function changeType(e) {
    const type = e.target.value;
    setF((x) => ({ ...x, type, status: type === 'Vehicle' ? 'Available' : 'Operational' }));
  }

  function save(e) {
    e.preventDefault();
    const err = {};
    if (isVehicle && !f.registration.trim()) err.registration = 'Registration number is required.';
    if (!isVehicle && !f.name.trim()) err.name = 'Name / description is required.';
    if (!isVehicle && !f.location.trim()) err.location = 'Location is required.';
    if (Number.isNaN(Number(f.lat)) || Number.isNaN(Number(f.lng))) err.coords = 'Enter valid coordinates or pick a point on the map.';
    setErrors(err);
    if (Object.keys(err).length) return;
    const payload = {
      ...f,
      lat: Number(f.lat),
      lng: Number(f.lng),
      odometer: Number(f.odometer) || 0,
      name: isVehicle ? `${f.vehicleType} ${f.registration}` : f.name.trim(),
      location: isVehicle ? f.location || f.area || 'Tshwane Central Depot' : f.location.trim(),
      installDate: f.installDate ? new Date(f.installDate).toISOString() : undefined,
    };
    if (editing) {
      updateAsset(asset.id, payload);
      onSaved?.(asset);
    } else {
      onSaved?.(addAsset(payload));
    }
    onClose();
  }

  return (
    <Modal title={editing ? `Edit ${asset.id}` : 'Add New Asset'} onClose={onClose} wide>
      <form onSubmit={save} noValidate>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="af-type">Asset Type</label>
            <select id="af-type" className="select" value={f.type} onChange={changeType} disabled={editing}>
              {ASSET_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>

          {isVehicle ? (
            <>
              <div className="field">
                <label htmlFor="af-reg">Registration Number</label>
                <input id="af-reg" className="input" value={f.registration} onChange={set('registration')} placeholder="BX 47 KL GP" />
                {errors.registration && <span className="error-text">{errors.registration}</span>}
              </div>
              <div className="field">
                <label htmlFor="af-vt">Vehicle Type</label>
                <select id="af-vt" className="select" value={f.vehicleType} onChange={set('vehicleType')}>{VEHICLE_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
              </div>
              <div className="field">
                <label htmlFor="af-dep">Assigned Department</label>
                <select id="af-dep" className="select" value={f.department} onChange={set('department')}>{DEPARTMENTS.map((t) => <option key={t}>{t}</option>)}</select>
              </div>
              <div className="field">
                <label htmlFor="af-tech">Assigned Technician</label>
                <select id="af-tech" className="select" value={f.technician} onChange={set('technician')}>
                  <option value="">Unassigned</option>
                  {TECHNICIANS.map((t) => <option key={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="af-vs">Current Status</label>
                <select id="af-vs" className="select" value={f.status} onChange={set('status')}>{VEHICLE_STATUSES.map((t) => <option key={t}>{t}</option>)}</select>
              </div>
              <div className="field">
                <label htmlFor="af-odo">Odometer (km)</label>
                <input id="af-odo" type="number" min="0" className="input" value={f.odometer} onChange={set('odometer')} />
              </div>
              <div className="field">
                <label htmlFor="af-ls">Last Service</label>
                <input id="af-ls" type="date" className="input" value={dateOnly(f.lastService)} onChange={set('lastService')} />
              </div>
              <div className="field">
                <label htmlFor="af-ns">Next Service</label>
                <input id="af-ns" type="date" className="input" value={dateOnly(f.nextService)} onChange={set('nextService')} />
              </div>
              <div className="field">
                <label htmlFor="af-ms">Maintenance Status</label>
                <select id="af-ms" className="select" value={f.maintenanceStatus} onChange={set('maintenanceStatus')}>
                  {['Up to date', 'Service due soon', 'Service overdue', 'Awaiting repairs'].map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="af-loc">Current Location</label>
                <input id="af-loc" className="input" value={f.location} onChange={set('location')} placeholder="Tshwane Central Depot" />
              </div>
            </>
          ) : (
            <>
              <div className="field">
                <label htmlFor="af-name">Name / Description</label>
                <input id="af-name" className="input" value={f.name} onChange={set('name')} placeholder={f.type === 'Traffic Light' ? 'Pretorius Street Signal' : 'Describe the asset'} />
                {errors.name && <span className="error-text">{errors.name}</span>}
              </div>
              <div className="field">
                <label htmlFor="af-loc2">Location</label>
                <input id="af-loc2" className="input" value={f.location} onChange={set('location')} placeholder="Pretorius Street, Pretoria CBD" />
                {errors.location && <span className="error-text">{errors.location}</span>}
              </div>
              <div className="field">
                <label htmlFor="af-area">Suburb / Area</label>
                <input id="af-area" className="input" value={f.area} onChange={set('area')} placeholder="Pretoria CBD" />
              </div>
              <div className="field">
                <label htmlFor="af-inst">Installation Date</label>
                <input id="af-inst" type="date" className="input" value={f.installDate} onChange={set('installDate')} max={toDateInput()} />
              </div>
              <div className="field">
                <label htmlFor="af-cond">Current Condition</label>
                <select id="af-cond" className="select" value={f.condition} onChange={set('condition')}>{ASSET_CONDITIONS.map((t) => <option key={t}>{t}</option>)}</select>
              </div>
              <div className="field">
                <label htmlFor="af-st">Operational Status</label>
                <select id="af-st" className="select" value={f.status} onChange={set('status')}>{ASSET_STATUSES.map((t) => <option key={t}>{t}</option>)}</select>
              </div>
            </>
          )}

          <div className="field full">
            <label>Location on map <span className="muted small">— click to set · {fmtCoords(Number(f.lat), Number(f.lng))}</span></label>
            <MapView className="map short" center={[Number(f.lat) || PRETORIA_CENTER[0], Number(f.lng) || PRETORIA_CENTER[1]]} zoom={15} markers={[{ id: 'sel', lat: Number(f.lat), lng: Number(f.lng), kind: isVehicle ? 'vehicle' : 'asset', draggable: true, onDrag: (lat, lng) => setF((x) => ({ ...x, lat, lng })) }]} onClickMap={(lat, lng) => setF((x) => ({ ...x, lat, lng }))} />
            {errors.coords && <span className="error-text">{errors.coords}</span>}
          </div>
          <div className="field full">
            <label htmlFor="af-notes">Notes</label>
            <textarea id="af-notes" className="textarea" style={{ minHeight: 64 }} value={f.notes || ''} onChange={set('notes')} />
          </div>
        </div>
        <div className="btn-row end">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary">{editing ? 'Save Changes' : 'Add Asset'}</button>
        </div>
      </form>
    </Modal>
  );
}
