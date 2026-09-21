// Geographic helpers. Everything degrades to demo data so location services never block the demo.

export const PRETORIA_CENTER = [-25.7479, 28.2293];

// Small gazetteer used to place manually typed locations on the map without an external geocoder.
export const AREAS = {
  'pretoria cbd': [-25.7463, 28.1891],
  cbd: [-25.7463, 28.1891],
  'church square': [-25.7461, 28.1881],
  arcadia: [-25.7448, 28.2059],
  hatfield: [-25.7487, 28.2381],
  sunnyside: [-25.7538, 28.2093],
  muckleneuk: [-25.7684, 28.2079],
  brooklyn: [-25.7639, 28.2369],
  'menlo park': [-25.7695, 28.2779],
  lynnwood: [-25.7676, 28.2841],
  waterkloof: [-25.7891, 28.2336],
  centurion: [-25.8603, 28.1894],
  'the willows': [-25.7899, 28.3131],
  mamelodi: [-25.7136, 28.3538],
  soshanguve: [-25.5178, 28.1007],
  'pretoria north': [-25.6803, 28.1882],
  'pretoria west': [-25.7473, 28.1478],
  eastwood: [-25.7398, 28.2131],
  riviera: [-25.7292, 28.2249],
};

export const DEMO_LOCATIONS = [
  { street: 'Pretorius Street', area: 'Pretoria CBD', landmark: 'Near Church Square', lat: -25.7463, lng: 28.1891 },
  { street: 'Paul Kruger Street', area: 'Pretoria CBD', landmark: 'Opposite Pretoria Station', lat: -25.7466, lng: 28.1883 },
  { street: 'Lois Avenue', area: 'Menlo Park', landmark: 'Near Menlyn Corner', lat: -25.7715, lng: 28.2783 },
  { street: 'Lynnwood Road', area: 'Hatfield', landmark: 'Near the University of Pretoria', lat: -25.7545, lng: 28.2314 },
];

export const pickDemoLocation = (i = 0) => DEMO_LOCATIONS[i % DEMO_LOCATIONS.length];

export function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export const fmtCoords = (lat, lng) =>
  lat == null || lng == null ? '—' : `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`;

/** Resolve typed text to approximate coordinates using the gazetteer (falls back to the Pretoria CBD). */
export function geocodeManual({ street = '', area = '', landmark = '' }) {
  const text = `${area} ${street} ${landmark}`.toLowerCase();
  const key = Object.keys(AREAS)
    .sort((a, b) => b.length - a.length)
    .find((k) => text.includes(k));
  const base = AREAS[key] || AREAS['pretoria cbd'];
  // Deterministic small offset so different streets in the same suburb are not stacked on one pixel.
  let h = 0;
  for (const ch of `${street}|${landmark}`) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const jitter = (n) => ((((h >> n) & 255) / 255) - 0.5) * 0.006;
  return { lat: base[0] + jitter(0), lng: base[1] + jitter(8), approximate: true, matched: Boolean(key) };
}

export function getCurrentPosition(timeout = 8000) {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new Error('Geolocation is not available on this device.'));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      (e) => reject(new Error(e.message || 'Location permission was denied.')),
      { enableHighAccuracy: true, timeout, maximumAge: 30000 },
    );
  });
}

/** Best-effort reverse geocoding (OpenStreetMap Nominatim). Never throws; falls back to coordinates. */
export async function reverseGeocode(lat, lng) {
  const fallback = { address: `Pinned location (${fmtCoords(lat, lng)})`, street: '', area: '', resolved: false };
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3500);
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&lat=${lat}&lon=${lng}`, {
      signal: ctrl.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timer);
    if (!res.ok) return fallback;
    const data = await res.json();
    const a = data.address || {};
    const street = a.road || a.pedestrian || a.neighbourhood || '';
    const area = a.suburb || a.neighbourhood || a.city_district || a.city || a.town || '';
    const address = [street, area].filter(Boolean).join(', ') || data.display_name?.split(',').slice(0, 2).join(',');
    return address ? { address, street, area, resolved: true } : fallback;
  } catch {
    return fallback;
  }
}

/** Compose a display address from the location parts. */
export function composeAddress({ street, area, landmark }) {
  const main = [street, area].filter((s) => s && s.trim()).join(', ');
  if (main && landmark?.trim()) return `${main} (${landmark.trim()})`;
  return main || landmark?.trim() || '';
}
