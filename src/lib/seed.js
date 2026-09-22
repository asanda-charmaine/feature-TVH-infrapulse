// Seeded demonstration data (Tshwane / Pretoria). Dates are generated relative to "now" so the
// dashboard always looks live ("Reports Today", "Today's Work Orders", ...).
import { CATEGORIES, TECHNICIANS, categoryById } from './constants.js';
import { computeRisk } from './risk.js';
import { toDateInput, pad, startOfDay } from './format.js';

const rng = (seed) => {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
};

// ---- Locations ---------------------------------------------------------------------------
const LOCS = [
  { area: 'Pretoria CBD', street: 'Pretorius Street', lat: -25.7463, lng: 28.1891, tl: 421 },
  { area: 'Pretoria CBD', street: 'Paul Kruger Street', lat: -25.7466, lng: 28.1883, tl: 422 },
  { area: 'Pretoria CBD', street: 'Church Street', lat: -25.7452, lng: 28.1922, tl: 423 },
  { area: 'Arcadia', street: 'Church Street', lat: -25.7448, lng: 28.2059, tl: 437 },
  { area: 'Hatfield', street: 'Lynnwood Road', lat: -25.7545, lng: 28.2314, tl: 438 },
  { area: 'Hatfield', street: 'Burnett Street', lat: -25.7489, lng: 28.2385, tl: 445 },
  { area: 'Sunnyside', street: 'Esselen Street', lat: -25.7538, lng: 28.2093, tl: 450 },
  { area: 'Brooklyn', street: 'Bronkhorst Street', lat: -25.7639, lng: 28.2369, tl: 451 },
  { area: 'Menlo Park', street: 'Atterbury Road', lat: -25.7695, lng: 28.2779, tl: 462 },
  { area: 'Menlo Park', street: 'Lois Avenue', lat: -25.7715, lng: 28.2783, tl: 470 },
  { area: 'Waterkloof', street: 'Rupert Street', lat: -25.7891, lng: 28.2336, tl: 471 },
  { area: 'Pretoria West', street: 'Church Street West', lat: -25.7473, lng: 28.1478, tl: 480 },
];

const DEPOT = { name: 'Tshwane Central Depot', lat: -25.7331, lng: 28.1668 };

const iso = (d) => new Date(d).toISOString();
const NOW = () => new Date();
const hoursAgo = (h) => new Date(Date.now() - h * 3600000);
const daysAgo = (d, hour = 10) => {
  const x = startOfDay(new Date(Date.now() - d * 86400000));
  x.setHours(hour, Math.round((hour * 7) % 60));
  return x;
};
// A moment earlier today (fraction of the time elapsed since midnight).
const todayAt = (f) => new Date(startOfDay().getTime() + (Date.now() - startOfDay().getTime()) * f);
const clampPast = (d) => (d > NOW() ? NOW() : d);

// ---- Assets ------------------------------------------------------------------------------
function buildAssets() {
  const r = rng(77);
  const assets = [];
  const conditions = ['Good', 'Good', 'Fair', 'Fair', 'Poor', 'Critical'];
  const mk = (type, id, name, loc, dLat, dLng, extra = {}) => {
    const condition = conditions[Math.floor(r() * conditions.length)];
    const installYear = 2004 + Math.floor(r() * 19);
    return {
      id,
      type,
      name,
      location: `${loc.street}, ${loc.area}`,
      area: loc.area,
      lat: loc.lat + dLat,
      lng: loc.lng + dLng,
      installDate: `${installYear}-0${1 + Math.floor(r() * 9)}-1${Math.floor(r() * 9)}`,
      condition,
      status: 'Operational',
      lastMaintenance: iso(daysAgo(30 + Math.floor(r() * 400))),
      previousFaults: Math.floor(r() * 5),
      notes: '',
      history: [],
      ...extra,
    };
  };
  LOCS.forEach((loc, i) => {
    assets.push(mk('Traffic Light', `TLS-${pad(loc.tl, 5)}`, `${loc.street} Signal`, loc, 0.0001, 0.0001));
    assets.push(mk('Street Light', `SLT-${pad(1180 + i * 7, 5)}`, `${loc.street} Lamp ${1 + (i % 4)}`, loc, -0.0003, 0.0004));
    assets.push(mk('Road Segment', `RDS-${pad(310 + i * 3, 5)}`, `${loc.street} Block ${1 + (i % 3)}`, loc, 0.0002, -0.0003));
  });
  const muni = [
    ['MUN-00050', 'Church Square Stormwater Drain', LOCS[0], 0.0006, 0.0008],
    ['MUN-00051', 'Hatfield Pump Station', LOCS[4], -0.001, 0.001],
    ['MUN-00052', 'Menlyn Retention Pond Outlet', LOCS[8], 0.0012, -0.001],
    ['MUN-00053', 'Arcadia Park Culvert', LOCS[3], 0.0007, -0.0009],
  ];
  muni.forEach(([id, name, loc, a, b]) => assets.push(mk('Municipal Asset', id, name, loc, a, b)));

  const vehicles = [
    ['VEH-0001', 'BX 47 KL GP', 'Road Patching Truck', 'Roads & Stormwater', 'Thabo Mokoena', 'Assigned'],
    ['VEH-0002', 'CM 12 TT GP', 'Cherry Picker', 'Traffic Signals', 'Naledi Dlamini', 'In Service'],
    ['VEH-0003', 'DL 88 RW GP', 'Cherry Picker', 'Public Lighting', 'Pieter van Wyk', 'Assigned'],
    ['VEH-0004', 'FG 34 HN GP', 'Bakkie', 'Roads & Stormwater', 'Zanele Khumalo', 'Available'],
    ['VEH-0005', 'GH 61 PS GP', 'Tipper Truck', 'Roads & Stormwater', '', 'Maintenance Required'],
    ['VEH-0006', 'HJ 09 MB GP', 'Inspection Van', 'Traffic Signals', 'Sipho Ndlovu', 'Available'],
    ['VEH-0007', 'JK 73 CD GP', 'Bakkie', 'Public Lighting', '', 'Out of Service'],
    ['VEH-0008', 'KL 25 YZ GP', 'Road Patching Truck', 'Roads & Stormwater', '', 'Available'],
  ];
  vehicles.forEach(([id, reg, vtype, dept, tech, vstatus], i) => {
    const inField = ['Assigned', 'In Service'].includes(vstatus);
    const loc = inField ? LOCS[(i * 3) % LOCS.length] : { ...DEPOT, street: DEPOT.name, area: 'Capital Park' };
    assets.push({
      id,
      type: 'Vehicle',
      name: `${vtype} ${reg}`,
      location: inField ? `${loc.street}, ${loc.area}` : DEPOT.name,
      area: loc.area,
      lat: loc.lat + (inField ? 0.0004 : (i % 3) * 0.0002),
      lng: loc.lng + (inField ? 0.0006 : (i % 4) * 0.0002),
      installDate: `${2016 + (i % 8)}-03-01`,
      condition: vstatus === 'Out of Service' ? 'Critical' : vstatus === 'Maintenance Required' ? 'Poor' : 'Good',
      status: vstatus,
      registration: reg,
      vehicleType: vtype,
      department: dept,
      technician: tech,
      lastService: iso(daysAgo(20 + i * 9)),
      nextService: iso(daysAgo(-(10 + i * 11))),
      odometer: 42000 + i * 17350,
      maintenanceStatus: vstatus === 'Maintenance Required' ? 'Service overdue' : vstatus === 'Out of Service' ? 'Awaiting repairs' : 'Up to date',
      lastMaintenance: iso(daysAgo(20 + i * 9)),
      previousFaults: i % 3,
      notes: '',
      history: [],
    });
  });
  return assets;
}

const assetIndexByLoc = (assets, loc, type) =>
  assets.find((a) => a.type === type && a.area === loc.area && a.location.startsWith(loc.street));

// ---- Reports & work orders ---------------------------------------------------------------
const DESCRIPTIONS = {
  pothole: [
    'Deep pothole in the left lane, cars are swerving to avoid it.',
    'Road surface breaking up with several cracks around a growing hole.',
    'Large pothole damaged my tyre this morning.',
    'Edge of the road has collapsed near the storm drain.',
  ],
  traffic: [
    'Traffic light is completely dark at the intersection.',
    'Signal stuck on red in all directions, traffic is backing up.',
    'Lens cracked and the signal head is hanging loose.',
    'Green phase does not activate for the turning lane.',
  ],
  street: [
    'Street light has been out for several nights, area is very dark.',
    'Lamp flickers on and off and then goes out.',
    'Street light pole leaning after a vehicle collision.',
    'Whole row of street lights not coming on at dusk.',
  ],
};

const AI_DESCRIPTIONS = {
  pothole: 'InfraPulse AI detected road surface damage from a fleet camera feed.',
  traffic: 'InfraPulse AI detected an inactive signal head from junction camera analysis.',
  street: 'InfraPulse AI detected an unlit street lamp during a night-time camera sweep.',
};

const STATUS_ORDER = ['Submitted', 'Verified', 'Assigned', 'In Progress', 'Resolved'];

function buildHistory(submittedAt, finalStatus, endAt) {
  const idx = STATUS_ORDER.indexOf(finalStatus);
  const span = Math.max(0, endAt - submittedAt);
  return STATUS_ORDER.slice(0, idx + 1).map((status, i) => ({
    status,
    at: iso(idx === 0 ? submittedAt : new Date(+submittedAt + (span * i) / idx)),
  }));
}

export function buildSeed() {
  const r = rng(2026);
  const assets = buildAssets();
  const reports = [];
  const workOrders = [];
  let woSeq = 100;
  const woId = () => `WO-2026-${pad(++woSeq, 4)}`;
  const today = toDateInput(NOW());
  const tomorrow = toDateInput(new Date(Date.now() + 86400000));
  const techFor = (catId) => {
    const skill = { pothole: 'Roads', traffic: 'Traffic Signals', street: 'Public Lighting' }[catId];
    const pool = TECHNICIANS.filter((t) => t.skill === skill);
    return pool[Math.floor(r() * pool.length)] || TECHNICIANS[0];
  };

  function addReport(spec) {
    const cat = categoryById(spec.cat);
    const loc = spec.loc;
    const asset = spec.noAsset ? null : assetIndexByLoc(assets, loc, cat.assetType);
    const lat = (asset?.lat ?? loc.lat) + (r() - 0.5) * 0.0004;
    const lng = (asset?.lng ?? loc.lng) + (r() - 0.5) * 0.0004;
    const submittedAt = spec.submittedAt;
    const severity = spec.severity;
    const risk = spec.risk ?? computeRisk({ severity, asset, duplicates: Math.floor(r() * 2) });
    const id = `INF-2026-${pad(spec.n, 5)}`;
    const hasImage = !spec.noImage;
    const image = hasImage ? `scene:${cat.id}:${spec.n}` : null;
    const status = spec.status;
    const endAt = spec.endAt || clampPast(new Date(+submittedAt + (20 + r() * 100) * 3600000));

    let workOrderId = null;
    if (['Assigned', 'In Progress', 'Resolved'].includes(status)) {
      const tech = techFor(cat.id);
      const wid = woId();
      workOrderId = wid;
      const scheduledDate = spec.woDate || toDateInput(clampPast(new Date(+submittedAt + 86400000 * (1 + r() * 2))));
      const time = spec.woTime || `${pad(8 + Math.floor(r() * 8), 2)}:${r() > 0.5 ? '30' : '00'}`;
      const woStatus = spec.woStatus || { Assigned: 'Scheduled', 'In Progress': 'In Progress', Resolved: 'Completed' }[status];
      const createdAt = new Date(+submittedAt + (endAt - submittedAt) * 0.4);
      const timeline = [{ status: 'Scheduled', at: iso(createdAt) }];
      if (['En Route', 'In Progress', 'Awaiting Verification', 'Completed'].includes(woStatus)) timeline.push({ status: 'En Route', at: iso(new Date(+createdAt + 3600000)) });
      if (['In Progress', 'Awaiting Verification', 'Completed'].includes(woStatus)) timeline.push({ status: 'In Progress', at: iso(new Date(+createdAt + 2 * 3600000)) });
      let completion = null;
      if (woStatus === 'Completed') {
        timeline.push({ status: 'Awaiting Verification', at: iso(new Date(+endAt - 600000)) }, { status: 'Completed', at: iso(endAt) });
        completion = {
          afterImage: `scene:${cat.id}-fixed:${spec.n}`,
          afterName: 'after-repair.jpg',
          location: { lat: lat + 0.00005, lng: lng - 0.00004, simulated: true },
          notes: cat.id === 'pothole' ? 'Cleared debris, filled and compacted with cold-mix asphalt.' : cat.id === 'traffic' ? 'Replaced faulty signal head controller and tested all phases.' : 'Replaced lamp and photocell, tested at dusk cycle.',
          verification: { ok: true, assetMatch: 95 + Math.round(r() * 30) / 10, locationMatch: 96 + Math.round(r() * 30) / 10, categoryVerified: true, evidenceAccepted: true, failures: [], at: iso(endAt) },
          completedAt: iso(endAt),
        };
      }
      workOrders.push({
        id: wid,
        reportId: id,
        assetId: asset?.id ?? null,
        category: cat.label,
        location: `${loc.street}, ${loc.area}`,
        lat,
        lng,
        image,
        severity,
        risk,
        technician: tech.name,
        technicianId: tech.id,
        date: scheduledDate,
        time,
        priority: severity,
        notes: cat.id === 'pothole' ? 'Cut back damaged edges, fill and compact. Cone off the lane.' : cat.id === 'traffic' ? 'Isolate power, inspect signal head and controller. Restore all phases.' : 'Inspect lamp, photocell and cabling. Replace faulty components.',
        status: woStatus,
        createdAt: iso(createdAt),
        completion,
        timeline,
      });
    }

    const report = {
      id,
      source: spec.src,
      category: cat.label,
      description: spec.src === 'AI' ? AI_DESCRIPTIONS[cat.id] : DESCRIPTIONS[cat.id][Math.floor(r() * 4)],
      image,
      imageName: image ? `${cat.id}-${spec.n}.jpg` : null,
      ai: hasImage
        ? { detected: cat.detected, match: true, confidence: 86 + Math.floor(r() * 13), severity }
        : { detected: 'No image supplied (sensor telemetry only)', match: null, confidence: null, severity },
      location: { address: `${loc.street}, ${loc.area}`, street: loc.street, area: loc.area, landmark: '', lat, lng },
      email: spec.email || '',
      submittedAt: iso(submittedAt),
      status,
      statusHistory: buildHistory(submittedAt, status, endAt),
      severity,
      risk,
      assetId: asset?.id ?? null,
      workOrderId,
      mine: Boolean(spec.mine),
      resolvedAt: status === 'Resolved' ? iso(endAt) : null,
      afterImage: status === 'Resolved' ? `scene:${cat.id}-fixed:${spec.n}` : null,
    };
    reports.push(report);

    if (asset) {
      if (status === 'Resolved') {
        asset.history.push({ date: iso(endAt), type: 'Maintenance', text: `${cat.short} repair completed and verified`, ref: id });
        asset.lastMaintenance = iso(endAt);
        asset.previousFaults += 1;
      } else {
        asset.history.push({ date: iso(submittedAt), type: 'Report', text: `${spec.src === 'AI' ? 'AI detected' : 'Citizen reported'} ${cat.short.toLowerCase()} fault`, ref: id });
        if (status === 'In Progress') asset.status = 'Under Maintenance';
        else if (asset.status === 'Operational') asset.status = 'Fault Reported';
        if (asset.condition === 'Good') asset.condition = 'Fair';
      }
    }
    return report;
  }

  // ---- Generated history (INF-2026-00380 .. 00413) ----
  const catPool = ['pothole', 'pothole', 'pothole', 'pothole', 'street', 'street', 'traffic', 'traffic'];
  const locPool = [0, 0, 1, 2, 4, 4, 5, 3, 6, 7, 8, 9, 10, 11];
  const sevPool = ['Low', 'Medium', 'Medium', 'High', 'High', 'Critical'];
  let assignedCount = 0;
  let inProgressCount = 0;
  for (let n = 380; n <= 413; n++) {
    const ageDays = 1 + (413 - n) * 0.85 + r() * 1.5;
    const submittedAt = daysAgo(ageDays, 7 + Math.floor(r() * 10));
    let status;
    const roll = r();
    if (ageDays > 12) status = roll < 0.85 ? 'Resolved' : 'In Progress';
    else if (ageDays > 5) status = roll < 0.5 ? 'Resolved' : roll < 0.7 ? 'In Progress' : roll < 0.85 ? 'Assigned' : 'Verified';
    else status = roll < 0.15 ? 'Resolved' : roll < 0.3 ? 'In Progress' : roll < 0.5 ? 'Assigned' : roll < 0.7 ? 'Verified' : 'Submitted';
    const spec = {
      n,
      cat: catPool[Math.floor(r() * catPool.length)],
      loc: LOCS[locPool[Math.floor(r() * locPool.length)]],
      src: r() < 0.62 ? 'Citizen' : 'AI',
      severity: sevPool[Math.floor(r() * sevPool.length)],
      status,
      submittedAt,
    };
    if (status === 'Assigned') {
      assignedCount += 1;
      if (assignedCount <= 3) Object.assign(spec, { woDate: today, woTime: `${pad(9 + assignedCount * 2, 2)}:00`, woStatus: assignedCount === 1 ? 'En Route' : 'Scheduled' });
      else Object.assign(spec, { woDate: tomorrow });
    }
    if (status === 'In Progress') {
      inProgressCount += 1;
      Object.assign(spec, { woDate: inProgressCount <= 2 ? today : toDateInput(daysAgo(1)), woTime: '08:30' });
    }
    if (status === 'Resolved') spec.endAt = clampPast(new Date(+submittedAt + (1 + r() * 4.5) * 86400000));
    addReport(spec);
  }

  // ---- Specials: today's activity and demo scenarios ----
  const special = (n, over) => addReport({ n, ...over });
  special(414, { cat: 'street', loc: LOCS[4], src: 'Citizen', severity: 'Medium', status: 'Resolved', submittedAt: daysAgo(3, 19), endAt: todayAt(0.45) });
  special(415, { cat: 'traffic', loc: LOCS[5], src: 'AI', severity: 'High', status: 'Resolved', submittedAt: daysAgo(2, 6), endAt: todayAt(0.7) });
  // Demonstrates the "Evidence Required" rule: telemetry-only report with no photograph.
  special(416, { cat: 'traffic', loc: LOCS[1], src: 'AI', severity: 'High', status: 'Verified', submittedAt: todayAt(0.2), noImage: true });
  // Demonstrates a report with no linked asset yet.
  special(417, { cat: 'pothole', loc: { area: 'Rietondale', street: 'Soutpansberg Road', lat: -25.7195, lng: 28.2364 }, src: 'Citizen', severity: 'High', status: 'Submitted', submittedAt: todayAt(0.3), noAsset: true });
  special(418, { cat: 'pothole', loc: LOCS[2], src: 'AI', severity: 'High', status: 'Verified', submittedAt: todayAt(0.4) });
  special(419, { cat: 'street', loc: LOCS[6], src: 'Citizen', severity: 'Medium', status: 'Submitted', submittedAt: todayAt(0.5), mine: true, email: 'citizen@example.com' });
  special(420, { cat: 'traffic', loc: LOCS[3], src: 'AI', severity: 'Critical', status: 'Submitted', submittedAt: todayAt(0.75) });
  special(421, { cat: 'pothole', loc: LOCS[0], src: 'Citizen', severity: 'Critical', risk: 88, status: 'Assigned', submittedAt: todayAt(0.6), mine: true, woDate: today, woTime: '10:30', woStatus: 'Scheduled' });
  reports.find((x) => x.id === 'INF-2026-00421').description = 'Large pothole in the left lane of Pretorius Street near Church Square. Vehicles are swerving into the next lane to avoid it.';

  // Give the citizen a few extra reports in their history (a resolved and an in-progress one).
  const firstResolvedCitizen = reports.find((x) => x.source === 'Citizen' && x.status === 'Resolved' && x.category);
  const firstInProgressCitizen = reports.find((x) => x.source === 'Citizen' && x.status === 'In Progress');
  [firstResolvedCitizen, firstInProgressCitizen].filter(Boolean).forEach((x) => (x.mine = true));

  // Make sure the depot vehicles reflect their jobs
  const today421 = workOrders.find((w) => w.reportId === 'INF-2026-00421');
  if (today421) today421.technician = 'Thabo Mokoena';

  reports.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
  workOrders.sort((a, b) => a.id.localeCompare(b.id));

  const notifications = [
    { id: 'N-1', at: iso(todayAt(0.75)), type: 'critical', title: 'Critical AI detection', body: 'INF-2026-00420 — traffic signal inactive in Arcadia (risk score above 85).', link: '/technician/reports/INF-2026-00420', read: false },
    { id: 'N-2', at: iso(todayAt(0.6)), type: 'report', title: 'New citizen report', body: 'INF-2026-00421 — Pothole / Road Damage, Pretoria CBD.', link: '/technician/reports/INF-2026-00421', read: false },
    { id: 'N-3', at: iso(todayAt(0.7)), type: 'workorder', title: 'Work order completed', body: 'Repair on INF-2026-00415 verified and closed.', link: '/technician/reports/INF-2026-00415', read: false },
    { id: 'N-4', at: iso(todayAt(0.2)), type: 'evidence', title: 'Evidence missing', body: 'INF-2026-00416 has no photographic evidence. Attach an image before creating a work order.', link: '/technician/reports/INF-2026-00416', read: true },
    { id: 'N-5', at: iso(daysAgo(1, 16)), type: 'vehicle', title: 'Vehicle service overdue', body: 'VEH-0005 (GH 61 PS GP) requires maintenance.', link: '/technician/map', read: true },
  ];

  const areas = [
    { id: 'AREA-1', name: 'CBD signal upgrade zone', lat: -25.7463, lng: 28.1891, radius: 450, note: 'Planned signal controller upgrades this quarter.' },
  ];

  return enrichSeedTaskContent({ reports, assets, workOrders, notifications, areas, connectors: {} });
}

export const SEED_CATEGORIES = CATEGORIES;

export function enrichSeedTaskContent(state) {
  const issues = [
    'Traffic-light sensor fault - sensor maintenance',
    'Damaged sensor - sensor replacement',
    'Sensor communication failure - connectivity fault',
    'Offline sensor - restore connection',
    'Failed controller - controller inspection',
    'Blown traffic-light lamp - lamp replacement',
    'Red signal failure',
    'Amber signal failure',
    'Green signal failure',
    'Power fault - inspect traffic-light supply',
    'Damaged traffic-light equipment',
    'Sensor maintenance - intermittent readings',
    'Sensor replacement - faulty detector',
  ];
  let index = 0;
  const reports = state.reports.map((r) => {
    const seedNumber = Number(r.id.match(/^INF-2026-(\d+)$/)?.[1]);
    if (!seedNumber || seedNumber > 421 || r.issue || !r.workOrderId) return r;
    if (r.category === 'Traffic Light') return { ...r, issue: issues[index++ % issues.length] };
    if (r.category === 'Pothole / Road Damage' && r.source === 'AI') return { ...r, issue: 'Pothole maintenance from computer-vision detection' };
    return r;
  });
  const byId = new Map(reports.map((r) => [r.id, r]));
  return { ...state, reports, workOrders: state.workOrders.map((w) => w.issue || !byId.get(w.reportId)?.issue ? w : { ...w, issue: byId.get(w.reportId).issue }) };
}
