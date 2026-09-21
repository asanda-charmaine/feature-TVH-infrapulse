import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, ImageInput, Modal, Photo, Spinner, toast } from './ui.jsx';
import { createWorkOrder, attachEvidence, useStore, findNearestAsset } from '../lib/store.js';
import { PRIORITIES, TECHNICIANS, categoryByLabel } from '../lib/constants.js';
import { verifyEvidenceImage } from '../lib/ai.js';
import { haversine } from '../lib/geo.js';
import { toDateInput } from '../lib/format.js';
import { SAMPLE_PHOTOS } from './ui.jsx';

/** Shown instead of the work-order form when a report has no valid photographic evidence. */
export function EvidenceRequiredModal({ report, onClose, onAttached }) {
  const [image, setImage] = useState(null);
  const [name, setName] = useState('');
  const [result, setResult] = useState(null);
  const cat = categoryByLabel(report.category);

  useEffect(() => {
    if (!image) return setResult(null);
    let cancelled = false;
    setResult({ pending: true });
    verifyEvidenceImage({ categoryLabel: report.category, image, filename: name }).then((r) => !cancelled && setResult(r));
    return () => {
      cancelled = true;
    };
  }, [image, name, report.category]);

  const ok = result && !result.pending && result.match;

  return (
    <Modal title="Evidence Required" onClose={onClose}>
      <Alert kind="warn" title="Evidence Required">A valid infrastructure image must be attached before a work order can be created.</Alert>
      <p className="muted small" style={{ margin: '12px 0' }}>
        Every work order keeps an evidence trail from problem → work order → repair. Attach a photograph of the {cat?.short.toLowerCase()} issue to continue.
      </p>
      {!image ? (
        <ImageInput onImage={(d, n) => { setImage(d); setName(n || ''); }} samples={SAMPLE_PHOTOS.citizen.filter((s) => s.kind === cat?.id || s.kind === 'unrelated')} sampleTitle="Demo photos" />
      ) : (
        <div className="stack-sm">
          <Photo src={image} alt="Evidence to attach" />
          {result?.pending && <Spinner label="Verifying evidence…" />}
          {ok && <Alert kind="success" title="Evidence verified">{result.detected} · {result.confidence}% confidence</Alert>}
          {result && !result.pending && !result.match && (
            <Alert kind="error" title="Verification Failed">{result.reason}</Alert>
          )}
          <button className="btn btn-secondary btn-sm" onClick={() => setImage(null)}>Upload Another Image</button>
        </div>
      )}
      <div className="btn-row spread" style={{ marginTop: 18 }}>
        <button className="btn btn-ghost" onClick={onClose}>Return to Report</button>
        <button
          className="btn btn-primary"
          disabled={!ok}
          onClick={() => {
            attachEvidence(report.id, { image, imageName: name, ai: { detected: result.detected, match: true, confidence: result.confidence, severity: result.severity } });
            toast('Evidence attached to report');
            onAttached?.();
          }}
        >
          Attach Evidence
        </button>
      </div>
    </Modal>
  );
}

export function CreateWorkOrderModal({ report, onClose }) {
  const { assets } = useStore();
  const navigate = useNavigate();
  const cat = categoryByLabel(report.category);
  const candidates = useMemo(
    () =>
      assets
        .filter((a) => a.type === cat.assetType)
        .map((a) => ({ a, d: haversine(report.location.lat, report.location.lng, a.lat, a.lng) }))
        .sort((x, y) => x.d - y.d)
        .slice(0, 12),
    [assets, cat, report],
  );
  const defaultAsset = report.assetId || findNearestAsset(report.category, report.location.lat, report.location.lng)?.id || '';
  const skill = { pothole: 'Roads', traffic: 'Traffic Signals', street: 'Public Lighting' }[cat.id];
  const [form, setForm] = useState({
    assetId: defaultAsset,
    technicianId: (TECHNICIANS.find((t) => t.skill === skill) || TECHNICIANS[0]).id,
    date: toDateInput(),
    time: '14:00',
    priority: report.severity,
    notes: '',
  });
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  function submit(e) {
    e.preventDefault();
    if (!form.notes.trim()) return setError('Please add notes / repair instructions.');
    try {
      const wo = createWorkOrder({ reportId: report.id, ...form });
      toast(`Work order ${wo.id} created`);
      navigate(`/technician/work-orders/${wo.id}`);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Modal title="Create Work Order" onClose={onClose} wide>
      <form onSubmit={submit}>
        <div className="card" style={{ background: '#f7fafc', marginBottom: 14, boxShadow: 'none' }}>
          <div className="label muted small" style={{ marginBottom: 8 }}>Inherited from the report</div>
          <div className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
            <Photo src={report.image} className="thumb" alt="Evidence" />
            <dl className="kv" style={{ flex: 1 }}>
              <dt>Report</dt><dd className="mono">{report.id}</dd>
              <dt>Category</dt><dd>{report.category}</dd>
              <dt>Location</dt><dd>{report.location.address}</dd>
              <dt>Severity / Risk</dt><dd>{report.severity} · {report.risk}</dd>
            </dl>
          </div>
        </div>
        <div className="form-grid">
          <div className="field full">
            <label htmlFor="wo-asset">Asset</label>
            <select id="wo-asset" className="select" value={form.assetId} onChange={set('assetId')}>
              <option value="">Unlinked — no matching asset</option>
              {candidates.map(({ a, d }) => (
                <option key={a.id} value={a.id}>{a.id} · {a.name} ({Math.round(d)} m away)</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="wo-tech">Technician</label>
            <select id="wo-tech" className="select" value={form.technicianId} onChange={set('technicianId')}>
              {TECHNICIANS.map((t) => <option key={t.id} value={t.id}>{t.name} — {t.skill}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="wo-priority">Priority</label>
            <select id="wo-priority" className="select" value={form.priority} onChange={set('priority')}>
              {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="wo-date">Date</label>
            <input id="wo-date" type="date" className="input" value={form.date} onChange={set('date')} required />
          </div>
          <div className="field">
            <label htmlFor="wo-time">Scheduled time</label>
            <input id="wo-time" type="time" className="input" value={form.time} onChange={set('time')} required />
          </div>
          <div className="field full">
            <label htmlFor="wo-notes">Notes / repair instructions</label>
            <textarea id="wo-notes" className="textarea" value={form.notes} onChange={set('notes')} placeholder="e.g. Cut back damaged edges, fill and compact with cold-mix asphalt. Cone off the lane." />
          </div>
        </div>
        {error && <p className="error-text">{error}</p>}
        <div className="btn-row end">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary">Create Work Order</button>
        </div>
      </form>
    </Modal>
  );
}
