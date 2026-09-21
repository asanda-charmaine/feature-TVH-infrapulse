// Fixed vocabularies shared by the citizen and technician sides.

export const CATEGORIES = [
  {
    id: 'pothole',
    label: 'Pothole / Road Damage',
    short: 'Pothole',
    assetType: 'Road Segment',
    blurb: 'Potholes, cracks and damaged road surfaces',
    detected: 'Pothole / Road Surface Damage',
  },
  {
    id: 'traffic',
    label: 'Traffic Light',
    short: 'Traffic Light',
    assetType: 'Traffic Light',
    blurb: 'Faulty, dark or damaged traffic signals',
    detected: 'Traffic Light / Signal Fault',
  },
  {
    id: 'street',
    label: 'Street Light',
    short: 'Street Light',
    assetType: 'Street Light',
    blurb: 'Street lamps that are out, flickering or damaged',
    detected: 'Street Light / Lamp Fault',
  },
];

export const categoryByLabel = (label) => CATEGORIES.find((c) => c.label === label);
export const categoryById = (id) => CATEGORIES.find((c) => c.id === id);

export const REPORT_STATUSES = ['Submitted', 'Verified', 'Assigned', 'In Progress', 'Resolved'];
export const SEVERITIES = ['Low', 'Medium', 'High', 'Critical'];
export const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];
export const WORK_ORDER_STATUSES = ['Scheduled', 'En Route', 'In Progress', 'Awaiting Verification', 'Completed'];
export const SOURCES = ['Citizen', 'AI'];

export const ASSET_TYPES = ['Traffic Light', 'Street Light', 'Road Segment', 'Municipal Asset', 'Vehicle'];
export const ASSET_PREFIX = {
  'Traffic Light': 'TLS',
  'Street Light': 'SLT',
  'Road Segment': 'RDS',
  'Municipal Asset': 'MUN',
  Vehicle: 'VEH',
};
export const ASSET_CONDITIONS = ['Good', 'Fair', 'Poor', 'Critical'];
export const ASSET_STATUSES = ['Operational', 'Fault Reported', 'Under Maintenance', 'Out of Service'];
export const VEHICLE_STATUSES = ['Available', 'Assigned', 'In Service', 'Maintenance Required', 'Out of Service'];
export const VEHICLE_TYPES = ['Bakkie', 'Cherry Picker', 'Tipper Truck', 'Road Patching Truck', 'Inspection Van'];
export const DEPARTMENTS = ['Roads & Stormwater', 'Traffic Signals', 'Public Lighting', 'Fleet Services'];

export const TECHNICIANS = [
  { id: 'T-01', name: 'Thabo Mokoena', skill: 'Roads' },
  { id: 'T-02', name: 'Naledi Dlamini', skill: 'Traffic Signals' },
  { id: 'T-03', name: 'Pieter van Wyk', skill: 'Public Lighting' },
  { id: 'T-04', name: 'Zanele Khumalo', skill: 'Roads' },
  { id: 'T-05', name: 'Sipho Ndlovu', skill: 'Traffic Signals' },
];
export const DEMO_TECHNICIAN = { id: 'T-01', name: 'Thabo Mokoena', role: 'Field Technician', depot: 'Tshwane Central Depot' };

export const OPEN_REPORT_STATUSES = ['Submitted', 'Verified', 'Assigned', 'In Progress'];
