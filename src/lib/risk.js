// Risk scoring: deterministic and explainable. Severity sets the band, asset context moves the score within it.
import { yearsSince } from './format.js';

const BANDS = { Low: [10, 39], Medium: [40, 64], High: [65, 84], Critical: [85, 99] };

export function severityFromRisk(risk) {
  if (risk >= 85) return 'Critical';
  if (risk >= 65) return 'High';
  if (risk >= 40) return 'Medium';
  return 'Low';
}

/** Risk 0-99 for a report, given its severity and (optionally) the linked asset. */
export function computeRisk({ severity = 'Medium', asset = null, duplicates = 0 }) {
  const [lo, hi] = BANDS[severity] || BANDS.Medium;
  let score = lo + (hi - lo) * 0.45;
  if (asset) {
    score += { Good: -2, Fair: 1, Poor: 5, Critical: 9 }[asset.condition] ?? 0;
    score += Math.min(6, (asset.previousFaults || 0) * 1.5);
    score += Math.min(4, yearsSince(asset.installDate) / 5);
  }
  score += Math.min(6, duplicates * 3);
  return Math.round(Math.min(hi, Math.max(lo, score)));
}

export const riskLevel = (risk) => severityFromRisk(risk);

/** Baseline risk shown for an asset with no open faults. */
export const assetBaselineRisk = (asset) =>
  Math.round(
    ({ Good: 8, Fair: 28, Poor: 52, Critical: 78 }[asset.condition] ?? 20) +
      Math.min(10, (asset.previousFaults || 0) * 1.5) +
      Math.min(6, yearsSince(asset.installDate) / 4),
  );
