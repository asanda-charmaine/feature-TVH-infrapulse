import { useEffect, useRef, useState } from 'react';
import { resolveImage, sceneDataUri } from '../lib/scenes.js';
import { REPORT_STATUSES } from '../lib/constants.js';
import { fmtDateTime } from '../lib/format.js';

// ---- Icons -------------------------------------------------------------------------------
const ICONS = {
  dashboard: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
  assets: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>',
  map: '<polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>',
  reports: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
  workorders: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  analytics: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
  bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
  menu: '<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>',
  camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
  pin: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  arrow: '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>',
  search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  alert: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
  mail: '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>',
  spark: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 16v4M17 18h4"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  'check-circle': '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
  'x-circle': '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>',
  truck: '<rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',
  road: '<path d="M8 3L4 21"/><path d="M16 3l4 18"/><line x1="12" y1="4" x2="12" y2="8"/><line x1="12" y1="11" x2="12" y2="15"/><line x1="12" y1="18" x2="12" y2="21"/>',
  traffic: '<rect x="8" y="2" width="8" height="20" rx="3"/><circle cx="12" cy="7" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="12" cy="17" r="1.2"/>',
  lamp: '<path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3h6c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2z"/>',
};

/** Same icons as an SVG string, for HTML that is not rendered by React (Leaflet map pins). */
export const iconSvg = (name, size = 14) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;

export function Icon({ name, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: ICONS[name] || '' }} />
  );
}

export function LogoMark({ size = 36 }) {
  return (
    <span className="brand-mark" style={{ width: size, height: size }}>
      <svg width={size * 0.66} height={size * 0.66} viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <path d="M6 34h14l7-19 9 34 7-15h15" stroke="#14c8bd" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

// ---- Badges ------------------------------------------------------------------------------
const cls = (s) => String(s).replace(/\s+/g, '-');

export const StatusBadge = ({ status }) => (
  <span className={`badge b-${cls(status)}`}>
    <span className="dot" />
    {status}
  </span>
);
export const SeverityBadge = ({ severity }) => <span className={`badge b-sev-${severity}`}>{severity}</span>;
export const SourceBadge = ({ source }) => (
  <span className={`badge b-src-${source}`}>
    {source === 'AI' ? (
      <>
        <Icon name="spark" size={12} /> AI Detected
      </>
    ) : (
      'Citizen Report'
    )}
  </span>
);
export const ConditionBadge = ({ value }) => <span className={`badge b-${cls(value)}`}>{value}</span>;

// ---- Photo -------------------------------------------------------------------------------
export function Photo({ src, alt = 'Photograph', className = '', tag, tagClass = '', empty = 'No image', rotation = 0 }) {
  const url = resolveImage(src);
  return (
    <div className={`photo ${className}`}>
      {url ? <img src={url} alt={alt} loading="lazy" style={rotation ? { transform: 'rotate(' + rotation + 'deg) scale(' + (rotation % 180 ? 0.7 : 1) + ')', objectFit: 'contain' } : undefined} /> : <div className="photo-empty">{empty}</div>}
      {tag && url && <span className={`tag ${tagClass}`}>{tag}</span>}
    </div>
  );
}

// ---- Modal / toast -----------------------------------------------------------------------
export function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

const toastListeners = new Set();
export const toast = (message, type = 'info') => toastListeners.forEach((l) => l({ id: Math.random(), message, type }));
export function ToastHost() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    const l = (t) => {
      setItems((x) => [...x, t]);
      setTimeout(() => setItems((x) => x.filter((i) => i.id !== t.id)), 3800);
    };
    toastListeners.add(l);
    return () => toastListeners.delete(l);
  }, []);
  return (
    <div className="toast-host" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`toast ${t.type}`}>
          {t.message}
        </div>
      ))}
    </div>
  );
}

// ---- Misc --------------------------------------------------------------------------------
export const Alert = ({ kind = 'info', icon, title, children, action }) => (
  <div className={`alert alert-${kind}`} role={kind === 'error' ? 'alert' : undefined}>
    <span className="ico">{icon || <Icon name={{ success: 'check-circle', error: 'x-circle', warn: 'alert', info: 'info' }[kind]} size={20} />}</span>
    <div style={{ flex: 1 }}>
      {title && <h3>{title}</h3>}
      {children && <p>{children}</p>}
      {action && <div className="btn-row" style={{ marginTop: 10 }}>{action}</div>}
    </div>
  </div>
);

export const Empty = ({ icon = 'reports', title, children }) => (
  <div className="empty">
    <div className="big"><Icon name={icon} size={40} /></div>
    <h3>{title}</h3>
    {children && <p>{children}</p>}
  </div>
);

export const KV = ({ items }) => (
  <dl className="kv">
    {items
      .filter(Boolean)
      .map(([k, v]) => (
        <div key={k} style={{ display: 'contents' }}>
          <dt>{k}</dt>
          <dd>{v ?? '—'}</dd>
        </div>
      ))}
  </dl>
);

export function Spinner({ label }) {
  return (
    <div className="row">
      <span className="spinner" />
      {label && <strong>{label}</strong>}
    </div>
  );
}

/** Report progress timeline: Submitted → Verified → Assigned → In Progress → Resolved. */
export function ReportTimeline({ report }) {
  const reached = new Map((report.statusHistory || []).map((h) => [h.status, h.at]));
  const idx = REPORT_STATUSES.indexOf(report.status);
  return (
    <ol className="timeline">
      {REPORT_STATUSES.map((s, i) => {
        const on = i <= idx;
        return (
          <li key={s} className={`${on ? 'reached' : ''} ${i === idx ? 'current' : ''}`}>
            <span className="node">{on ? <Icon name="check" size={14} /> : i + 1}</span>
            <div className="t-title">{s}</div>
            <div className="t-time">{on ? fmtDateTime(reached.get(s)) : 'Pending'}</div>
          </li>
        );
      })}
    </ol>
  );
}

export function Stepper({ steps, current }) {
  return (
    <div className="stepper" aria-label="Progress">
      {steps.map((s, i) => (
        <div key={s} className={`step ${i < current ? 'done' : ''} ${i === current ? 'active' : ''}`}>
          {s}
        </div>
      ))}
    </div>
  );
}

/** AI verification result panel shared by the citizen and technician flows. */
export function VerificationSummary({ ai }) {
  if (!ai) return null;
  return (
    <div className="metric-row">
      <div className="metric">
        <div className="m-label">Detected</div>
        <div className="m-value" style={{ fontSize: '.92rem' }}>{ai.detected}</div>
      </div>
      <div className="metric">
        <div className="m-label">Category Match</div>
        <div className="m-value">
          {ai.match === true ? (
            <span className="with-icon"><Icon name="check" size={15} /> Verified</span>
          ) : ai.match === false ? (
            <span className="with-icon"><Icon name="x" size={15} /> Failed</span>
          ) : (
            'Not available'
          )}
        </div>
      </div>
      <div className="metric">
        <div className="m-label">Confidence</div>
        <div className="m-value">{ai.confidence != null ? `${ai.confidence}%` : '—'}</div>
      </div>
      <div className="metric">
        <div className="m-label">Severity</div>
        <div className="m-value">{ai.severity || '—'}</div>
      </div>
    </div>
  );
}

// ---- Image input (upload / camera / demo photos) -----------------------------------------

/** Downscale to keep localStorage small. SVG and unreadable images pass through unchanged. */
export function fileToDataUrl(file, maxDim = 960) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.onload = () => {
      const raw = reader.result;
      if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') return resolve(raw);
      const img = new Image();
      img.onerror = () => reject(new Error('That file is not a readable image.'));
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.72));
      };
      img.src = raw;
    };
    reader.readAsDataURL(file);
  });
}

export const SAMPLE_PHOTOS = {
  citizen: [
    { kind: 'pothole', seed: 7, label: 'Pothole' },
    { kind: 'traffic', seed: 5, label: 'Traffic light' },
    { kind: 'street', seed: 3, label: 'Street light' },
  ],
  repair: {
    pothole: [
      { kind: 'pothole-fixed', seed: 4, label: 'Repaired pothole' },
      { kind: 'traffic-fixed', seed: 4, label: 'Wrong asset' },
      { kind: 'blurry', seed: 4, label: 'Blurry photo' },
      { kind: 'pothole', seed: 4, label: 'Still damaged' },
    ],
    traffic: [
      { kind: 'traffic-fixed', seed: 4, label: 'Working signal' },
      { kind: 'street-fixed', seed: 4, label: 'Wrong asset' },
      { kind: 'blurry', seed: 4, label: 'Blurry photo' },
      { kind: 'traffic', seed: 4, label: 'Still faulty' },
    ],
    street: [
      { kind: 'street-fixed', seed: 4, label: 'Working lamp' },
      { kind: 'pothole-fixed', seed: 4, label: 'Wrong asset' },
      { kind: 'blurry', seed: 4, label: 'Blurry photo' },
      { kind: 'street', seed: 4, label: 'Still out' },
    ],
  },
};

export function ImageInput({ onImage, samples = [], camera = true, busy = false, sampleTitle = 'No photo handy? Try a demo photo' }) {
  const [error, setError] = useState('');
  const fileRef = useRef(null);
  const camRef = useRef(null);

  async function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    try {
      onImage(await fileToDataUrl(file), file.name);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="stack-sm">
      <div className="dropzone">
        <div className="btn-row" style={{ justifyContent: 'center' }}>
          {camera && (
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => camRef.current?.click()}>
              <Icon name="camera" /> Take Photo
            </button>
          )}
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => fileRef.current?.click()}>
            <Icon name="upload" /> Upload Image
          </button>
        </div>
        <p className="muted small" style={{ margin: '10px 0 0' }}>JPG, PNG or WebP. On a phone, “Take Photo” opens the camera.</p>
        <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
      </div>
      {error && <p className="error-text">{error}</p>}
      {samples.length > 0 && (
        <div>
          <div className="label muted small" style={{ margin: '8px 0 6px' }}>{sampleTitle}</div>
          <div className="samples">
            {samples.map((s) => (
              <button type="button" key={s.label} className="sample-btn" disabled={busy} onClick={() => onImage(`scene:${s.kind}:${s.seed}`, `${s.kind}.demo`)}>
                <img src={sceneDataUri(s.kind, s.seed)} alt="" />
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Export menu -------------------------------------------------------------------------
export function ExportMenu({ getTable, label = 'Export' }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  async function run(format) {
    setOpen(false);
    setBusy(true);
    try {
      const { exportTable } = await import('../lib/exporters.js');
      await exportTable(format, getTable());
      toast(`Exported ${format.toUpperCase()} successfully`);
    } catch (err) {
      // Exports must never break the demo: report a simulated success if generation fails.
      console.error(err);
      toast(`${format.toUpperCase()} export could not be generated`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="menu" ref={ref}>
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpen((o) => !o)} disabled={busy} aria-haspopup="menu" aria-expanded={open}>
        <Icon name="download" size={15} /> {busy ? 'Preparing…' : label}
      </button>
      {open && (
        <div className="menu-list" role="menu">
          <button role="menuitem" onClick={() => run('csv')}>Export CSV</button>
          <button role="menuitem" onClick={() => run('xlsx')}>Export Excel</button>
          <button role="menuitem" onClick={() => run('pdf')}>Export PDF</button>
        </div>
      )}
    </div>
  );
}
