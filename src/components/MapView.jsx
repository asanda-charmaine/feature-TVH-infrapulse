import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { PRETORIA_CENTER } from '../lib/geo.js';
import { iconSvg } from './ui.jsx';

// A thin wrapper around Leaflet. OpenStreetMap tiles are used when online; offline the map
// falls back to a plain grid background and markers keep working (demo-first).

const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

export const MARKER_STYLES = {
  asset: { color: '#2a78d6', icon: 'assets' },
  citizen: { color: '#0fb5ae', icon: 'reports' },
  ai: { color: '#7a4fd6', icon: 'spark' },
  workorder: { color: '#eb6834', icon: 'workorders' },
  vehicle: { color: '#0b1f3a', icon: 'truck' },
  critical: { color: '#d03b3b', icon: 'alert' },
  pin: { color: '#d03b3b', icon: 'pin' },
};

export function pinIcon(kind = 'asset', highlight = false) {
  const s = MARKER_STYLES[kind] || MARKER_STYLES.asset;
  return L.divIcon({
    className: '',
    html: `<div class="pin" style="background:${s.color};${highlight ? 'transform:rotate(-45deg) scale(1.25);' : ''}"><span style="color:#fff">${iconSvg(s.icon, 14)}</span></div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -28],
  });
}

/**
 * props:
 *  - center, zoom
 *  - markers: [{ id, lat, lng, kind, popup, draggable, onDrag(lat,lng), onClick }]
 *  - circles: [{ id, lat, lng, radius, popup }]
 *  - onClickMap(lat,lng)
 *  - fitToMarkers
 *  - interactive (false = static preview)
 */
export default function MapView({ center = PRETORIA_CENTER, zoom = 13, markers = [], circles = [], onClickMap, onNavigate, interactive = true, className = 'map', fitToMarkers = false }) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const fittedRef = useRef(false);
  const clickRef = useRef(onClickMap);
  clickRef.current = onClickMap;

  useEffect(() => {
    const map = L.map(elRef.current, {
      center,
      zoom,
      zoomControl: interactive,
      dragging: interactive,
      scrollWheelZoom: false,
      doubleClickZoom: interactive,
      touchZoom: interactive,
      boxZoom: false,
      keyboard: interactive,
      attributionControl: true,
      // No animated transitions: their timers can fire after the map has been unmounted.
      zoomAnimation: false,
      fadeAnimation: false,
      markerZoomAnimation: false,
    });
    L.tileLayer(TILE_URL, { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors', subdomains: 'abc' }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    map.on('click', (e) => clickRef.current?.(e.latlng.lat, e.latlng.lng));
    mapRef.current = map;
    fittedRef.current = false;
    // Leaflet needs a size recalculation when its container settles (tabs, drawers, flex layouts).
    const t = setTimeout(() => map.invalidateSize(), 120);
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(elRef.current);
    return () => {
      clearTimeout(t);
      ro.disconnect();
      map.stop();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-centre when the requested centre changes (e.g. pin placed, demo location chosen).
  const key = `${center[0]},${center[1]}`;
  useEffect(() => {
    mapRef.current?.setView(center, Math.max(mapRef.current.getZoom(), zoom), { animate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    const pts = [];
    circles.forEach((c) => {
      const circle = L.circle([c.lat, c.lng], { radius: c.radius, color: '#eb6834', weight: 2, dashArray: '6 6', fillColor: '#eb6834', fillOpacity: 0.12 }).addTo(layer);
      if (c.popup) circle.bindPopup(c.popup);
    });
    markers.forEach((m) => {
      const marker = L.marker([m.lat, m.lng], { icon: pinIcon(m.kind, m.highlight), draggable: Boolean(m.draggable), title: m.title || '' }).addTo(layer);
      if (m.popup) marker.bindPopup(m.popup);
      if (m.onClick) marker.on('click', () => m.onClick(m));
      if (m.draggable) marker.on('dragend', () => m.onDrag?.(marker.getLatLng().lat, marker.getLatLng().lng));
      pts.push([m.lat, m.lng]);
    });
    if (fitToMarkers && pts.length > 1 && !fittedRef.current) {
      fittedRef.current = true;
      map.fitBounds(pts, { padding: [40, 40], maxZoom: 15 });
    }
  }, [markers, circles, fitToMarkers]);

  // Popup links (data-nav) navigate inside the SPA instead of reloading the page.
  const onContainerClick = (e) => {
    const a = e.target.closest?.('a[data-nav]');
    if (a && onNavigate) {
      e.preventDefault();
      onNavigate(a.getAttribute('href'));
    }
  };

  return <div ref={elRef} className={className} role="application" aria-label="Map" onClick={onContainerClick} />;
}
