// Simulated InfraPulse AI. Deterministic and offline so the demo always works.
//
// How an image is "recognised":
//   1. Generated demo photos carry their true content in their reference (scene:<kind>:<seed>).
//   2. Uploaded files are recognised from keywords in the file name (e.g. "pothole.jpg", "cat.png").
//   3. Any other real photo is assumed to show what the citizen/technician says it shows.
import { CATEGORIES, categoryById, categoryByLabel } from './constants.js';
import { sceneKindOf } from './scenes.js';
import { haversine } from './geo.js';

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

function hash(str = '') {
  let h = 2166136261;
  const step = Math.max(1, Math.floor(str.length / 4000));
  for (let i = 0; i < str.length; i += step) h = Math.imul(h ^ str.charCodeAt(i), 16777619) >>> 0;
  return (h ^ str.length) >>> 0;
}
const between = (h, lo, hi, salt = 0) => lo + (((h >>> salt) % 1000) / 999) * (hi - lo);

const KEYWORDS = [
  ['blurry', /blur|shaky|dark_?photo|out.?of.?focus/],
  ['traffic', /traffic|robot|signal/],
  ['street', /street|lamp|streetlight|lamppost/],
  ['pothole', /pothole|road|crack|asphalt|tar(mac)?/],
  ['unrelated', /cat|dog|selfie|tree|food|meme|screenshot|person|portrait|car(?!d)|unrelated|random/],
];

/** What does the image show? Returns { kind, fixed, source }. */
export function analyzeImage(imageRef, filename = '') {
  const scene = sceneKindOf(imageRef);
  if (scene) return { kind: scene.replace('-fixed', ''), fixed: scene.endsWith('-fixed'), source: 'sample' };
  const name = filename.toLowerCase();
  for (const [kind, rx] of KEYWORDS) if (rx.test(name)) return { kind, fixed: /fixed|repair|after|done/.test(name), source: 'filename' };
  return { kind: null, fixed: /fixed|repair|after|done/.test(name), source: 'photo' };
}

const DETECTED_LABEL = {
  pothole: 'Pothole / Road Surface Damage',
  traffic: 'Traffic Light / Signal Fault',
  street: 'Street Light / Lamp Fault',
  unrelated: 'Road Surface / Unrelated Object',
  blurry: 'Unclear image',
};

const SEVERITY_BY_KIND = { pothole: 'High', traffic: 'High', street: 'Medium' };

/**
 * Citizen step 3: does the photo match the selected category?
 * Resolves { match, detected, confidence, severity, reason }.
 */
export async function verifyReportImage({ categoryLabel, image, filename }) {
  await delay(1700);
  const expected = categoryByLabel(categoryLabel);
  const seen = analyzeImage(image, filename);
  const h = hash(image);

  if (seen.kind === 'blurry') {
    return {
      match: false,
      detected: DETECTED_LABEL.blurry,
      confidence: Math.round(between(h, 41, 58)),
      severity: null,
      reason: 'The image is too blurry to verify.',
    };
  }
  // Real photos with no recognisable hint are trusted to match the chosen category.
  const kind = seen.kind ?? expected.id;
  const match = kind === expected.id;
  const confidence = Math.round(between(h, match ? 88 : 79, match ? 98 : 93));
  const severities = ['Medium', 'High', 'High', 'Critical', 'Medium'];
  return {
    match,
    detected: match ? expected.detected : DETECTED_LABEL[kind],
    confidence,
    severity: match ? (seen.source === 'sample' ? SEVERITY_BY_KIND[kind] : severities[h % severities.length]) : null,
    reason: match ? null : 'The uploaded image does not appear to match the selected infrastructure category.',
  };
}

/** Quick check used when attaching missing evidence on the technician side. */
export const verifyEvidenceImage = verifyReportImage;

/**
 * Technician step: compare the repair evidence with the original report/asset.
 * Resolves { ok, assetMatch, locationMatch, categoryVerified, evidenceAccepted, failures[] }.
 */
export async function verifyRepair({ workOrder, afterImage, filename, location }) {
  await delay(2000);
  const expected = categoryByLabel(workOrder.category);
  const seen = analyzeImage(afterImage, filename);
  const h = hash(afterImage + workOrder.id);
  const failures = [];

  const distance = location ? haversine(location.lat, location.lng, workOrder.lat, workOrder.lng) : 0;
  const locationMatch = Math.round(Math.max(0, 100 - distance / 12) * 10) / 10;

  let categoryVerified = true;
  let assetMatch = Math.round(between(h, 93, 98.5) * 10) / 10;
  let quality = true;

  if (seen.kind === 'blurry') {
    quality = false;
    assetMatch = Math.round(between(h, 30, 55));
    failures.push('Image quality insufficient');
  } else if (seen.kind && seen.kind !== expected.id) {
    categoryVerified = false;
    assetMatch = Math.round(between(h, 8, 30));
    failures.push(seen.kind === 'unrelated' ? 'Image does not contain the reported asset' : 'Incorrect infrastructure type');
  } else if (seen.source === 'sample' && !seen.fixed) {
    // The technician re-uploaded the original faulty photo: the fault is still visible.
    assetMatch = Math.round(between(h, 62, 74));
    failures.push('Image still shows the reported fault');
  }
  if (distance > 250) failures.push('Location mismatch');

  const ok = failures.length === 0;
  return {
    ok,
    assetMatch,
    locationMatch: Math.min(99.5, locationMatch),
    distanceM: Math.round(distance),
    categoryVerified,
    quality,
    evidenceAccepted: ok,
    failures,
    at: new Date().toISOString(),
  };
}

export const categoryLabelOf = (id) => categoryById(id)?.label;
export const ALL_CATEGORY_LABELS = CATEGORIES.map((c) => c.label);
