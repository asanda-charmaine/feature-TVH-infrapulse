// Builds map markers from the store for the dashboard preview and the GIS map.
import { isOpen } from './stats.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const popup = (title, lines, href) =>
  `<div style="min-width:170px"><strong>${esc(title)}</strong><br/>${lines.map((l) => `<span>${esc(l)}</span>`).join('<br/>')}${
    href ? `<br/><a href="${href}" data-nav style="font-weight:700">View details →</a>` : ''
  }</div>`;

export const ALL_LAYERS = { assets: true, citizen: true, ai: true, workorders: true, vehicles: true };

/**
 * @param state store state
 * @param layers which layers are visible
 * @param opts { draggableAssets, assetFilter(asset)=>bool, highlightId }
 */
export function buildMarkers(state, layers = ALL_LAYERS, opts = {}) {
  const out = [];
  const { draggableAssets = false, assetFilter, onAssetDrag, onAssetClick, highlightId } = opts;

  state.assets.forEach((a) => {
    const isVehicle = a.type === 'Vehicle';
    if (isVehicle ? !layers.vehicles : !layers.assets) return;
    if (!isVehicle && assetFilter && !assetFilter(a)) return;
    out.push({
      id: a.id,
      lat: a.lat,
      lng: a.lng,
      kind: isVehicle ? 'vehicle' : 'asset',
      title: a.id,
      highlight: a.id === highlightId,
      draggable: draggableAssets,
      onClick: onAssetClick ? () => onAssetClick(a) : undefined,
      onDrag: (lat, lng) => onAssetDrag?.(a.id, lat, lng),
      popup: popup(`${a.id} · ${a.type}`, [a.name, `Status: ${a.status}`, `Condition: ${a.condition}`], `/technician/assets/${a.id}`),
    });
  });

  state.reports.filter(isOpen).forEach((r) => {
    if (r.source === 'AI' ? !layers.ai : !layers.citizen) return;
    out.push({
      id: r.id,
      lat: r.location.lat,
      lng: r.location.lng,
      kind: r.source === 'AI' ? 'ai' : 'citizen',
      title: r.id,
      highlight: r.id === highlightId,
      popup: popup(`${r.id}`, [`${r.source === 'AI' ? 'AI Detected' : 'Citizen Report'} · ${r.category}`, `${r.severity} · Risk ${r.risk}`, r.location.address], `/technician/reports/${r.id}`),
    });
  });

  if (layers.workorders) {
    state.workOrders
      .filter((w) => w.status !== 'Completed')
      .forEach((w) =>
        out.push({
          id: w.id,
          lat: w.lat,
          lng: w.lng,
          kind: 'workorder',
          title: w.id,
          highlight: w.id === highlightId,
          popup: popup(w.id, [w.category, `${w.status} · ${w.date} ${w.time}`, w.technician], `/technician/work-orders/${w.id}`),
        }),
      );
  }
  return out;
}

export const MAP_LEGEND = [
  ['#2a78d6', 'Assets'],
  ['#0fb5ae', 'Citizen Reports'],
  ['#7a4fd6', 'AI Detected'],
  ['#eb6834', 'Work Orders'],
  ['#0b1f3a', 'Vehicles'],
];
