import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AssetForm from '../../components/AssetForm.jsx';
import MapView from '../../components/MapView.jsx';
import { PageHead } from '../../components/tech.jsx';
import { Alert, Icon, Modal, toast } from '../../components/ui.jsx';
import { addArea, moveAsset, removeArea, useTechnicianStore } from '../../lib/store.js';
import { ALL_LAYERS, MAP_LEGEND, buildMarkers } from '../../lib/mapdata.js';
import { fmtCoords } from '../../lib/geo.js';

const LAYERS = [
  ['assets', 'Assets'],
  ['citizen', 'Citizen Reports'],
  ['ai', 'AI Detected Issues'],
  ['workorders', 'Work Orders'],
  ['vehicles', 'Vehicles'],
];

const MODES = [
  ['browse', 'Browse'],
  ['add', 'Add Asset Marker'],
  ['point', 'Add Infrastructure Point'],
  ['move', 'Move Asset Marker'],
  ['edit', 'Edit Asset Information'],
  ['area', 'Mark Maintenance Area'],
];

const HELP = {
  browse: 'Click any marker for details. Choose a tool above to edit the map.',
  add: 'Click the map to select a location for the new asset.',
  point: 'Click the map to add a new infrastructure point (municipal asset).',
  move: 'Drag any asset or vehicle marker to a new position. Changes are saved automatically.',
  edit: 'Click an asset marker to edit its information.',
  area: 'Click the map to mark the centre of a maintenance area.',
};

export default function GisMap() {
  const state = useTechnicianStore();
  const navigate = useNavigate();
  const [layers, setLayers] = useState(ALL_LAYERS);
  const [mode, setMode] = useState('browse');
  const [pending, setPending] = useState(null); // { lat, lng, type }
  const [editAsset, setEditAsset] = useState(null);
  const [areaDraft, setAreaDraft] = useState(null);

  const markers = useMemo(() => {
    const base = buildMarkers(state, layers, {
      draggableAssets: mode === 'move',
      onAssetDrag: (id, lat, lng) => {
        moveAsset(id, lat, lng);
        toast(`${id} moved`);
      },
      onAssetClick: mode === 'edit' ? (a) => setEditAsset(a) : undefined,
    });
    if (pending) base.push({ id: 'pending', lat: pending.lat, lng: pending.lng, kind: 'pin', highlight: true });
    return base;
  }, [state, layers, mode, pending]);

  const circles = useMemo(
    () => state.areas.map((a) => ({ id: a.id, lat: a.lat, lng: a.lng, radius: a.radius, popup: `<strong>${a.name}</strong><br/>${a.note || 'Maintenance area'}<br/>Radius ${a.radius} m` })),
    [state.areas],
  );

  function onMapClick(lat, lng) {
    if (mode === 'add' || mode === 'point') setPending({ lat, lng, type: mode === 'point' ? 'Municipal Asset' : 'Traffic Light' });
    if (mode === 'area') setAreaDraft({ lat, lng, name: '', radius: 300, note: '' });
  }

  const counts = {
    assets: state.assets.filter((a) => a.type !== 'Vehicle').length,
    vehicles: state.assets.filter((a) => a.type === 'Vehicle').length,
  };

  return (
    <>
      <PageHead title="GIS Map" sub="Working area overview for Tshwane / Pretoria. Demonstration map — edits are saved locally." />

      <div className="layers" role="group" aria-label="Map layers">
        {LAYERS.map(([key, label]) => (
          <label key={key}>
            <input type="checkbox" checked={layers[key]} onChange={(e) => setLayers({ ...layers, [key]: e.target.checked })} />
            {label}
          </label>
        ))}
      </div>

      <div className="tool-row" role="group" aria-label="Map tools">
        {MODES.map(([key, label]) => (
          <button key={key} className={`tool ${mode === key ? 'on' : ''}`} onClick={() => { setMode(key); setPending(null); }}>{label}</button>
        ))}
      </div>
      <p className="muted small" style={{ margin: '0 0 10px' }}>{HELP[mode]}</p>

      {pending && (
        <div style={{ marginBottom: 12 }}>
          <Alert kind="info" icon={<Icon name="pin" size={20} />} title="Location selected for new asset" action={
            <>
              <button className="btn btn-primary btn-sm" onClick={() => setEditAsset({ __new: true })}>Create Asset Here</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setPending(null)}>Cancel</button>
            </>
          }>
            <span className="mono">{fmtCoords(pending.lat, pending.lng)}</span>
          </Alert>
        </div>
      )}

      <MapView className="map tall" zoom={13} markers={markers} circles={circles} onClickMap={mode === 'browse' || mode === 'move' || mode === 'edit' ? undefined : onMapClick} onNavigate={navigate} fitToMarkers />

      <div className="map-legend">
        {MAP_LEGEND.map(([c, l]) => <span key={l}><span className="legend-dot" style={{ background: c }} />{l}</span>)}
        <span><span className="legend-dot" style={{ background: '#eb6834', opacity: 0.4, border: '1px dashed #eb6834' }} />Maintenance area</span>
        <span className="muted">{counts.assets} assets · {counts.vehicles} vehicles</span>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2>Maintenance Areas</h2>
        {state.areas.length === 0 ? <p className="muted">No maintenance areas marked. Use “Mark Maintenance Area” and click the map.</p> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Name</th><th>Centre</th><th>Radius</th><th>Note</th><th /></tr></thead>
              <tbody>
                {state.areas.map((a) => (
                  <tr key={a.id}>
                    <td><strong>{a.name}</strong></td>
                    <td className="mono">{fmtCoords(a.lat, a.lng)}</td>
                    <td>{a.radius} m</td>
                    <td>{a.note}</td>
                    <td><button className="btn btn-ghost btn-sm" onClick={() => { removeArea(a.id); toast('Maintenance area removed'); }}>Remove</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editAsset && (
        <AssetForm
          asset={editAsset.__new ? null : editAsset}
          initial={editAsset.__new ? { lat: pending.lat, lng: pending.lng, type: pending.type, status: 'Operational' } : undefined}
          onClose={() => setEditAsset(null)}
          onSaved={(a) => { toast(editAsset.__new ? `${a.id} added to the map` : 'Asset updated'); setPending(null); }}
        />
      )}

      {areaDraft && (
        <Modal title="Mark Maintenance Area" onClose={() => setAreaDraft(null)}>
          <form onSubmit={(e) => {
            e.preventDefault();
            addArea({ lat: areaDraft.lat, lng: areaDraft.lng, name: areaDraft.name.trim() || 'Maintenance area', radius: Number(areaDraft.radius) || 300, note: areaDraft.note });
            setAreaDraft(null);
            toast('Maintenance area added');
          }}>
            <p className="muted small">Centre: <span className="mono">{fmtCoords(areaDraft.lat, areaDraft.lng)}</span></p>
            <div className="field"><label htmlFor="ar-name">Area name</label><input id="ar-name" className="input" value={areaDraft.name} onChange={(e) => setAreaDraft({ ...areaDraft, name: e.target.value })} placeholder="e.g. Hatfield resurfacing zone" autoFocus /></div>
            <div className="field"><label htmlFor="ar-rad">Radius (metres)</label><input id="ar-rad" type="number" min="50" max="3000" step="50" className="input" value={areaDraft.radius} onChange={(e) => setAreaDraft({ ...areaDraft, radius: e.target.value })} /></div>
            <div className="field"><label htmlFor="ar-note">Note</label><input id="ar-note" className="input" value={areaDraft.note} onChange={(e) => setAreaDraft({ ...areaDraft, note: e.target.value })} placeholder="Planned works, road closures…" /></div>
            <div className="btn-row end">
              <button type="button" className="btn btn-ghost" onClick={() => setAreaDraft(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Add Area</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
