import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Icon, ImageInput, Photo, SAMPLE_PHOTOS, Spinner, Stepper, VerificationSummary } from '../../components/ui.jsx';
import MapView from '../../components/MapView.jsx';
import { CATEGORIES } from '../../lib/constants.js';
import { verifyReportImage } from '../../lib/ai.js';
import { PRETORIA_CENTER, composeAddress, fmtCoords, geocodeManual, getCurrentPosition, pickDemoLocation, reverseGeocode } from '../../lib/geo.js';
import { submitCitizenReport } from '../../lib/store.js';
import { sendEmail } from '../../lib/email.js';

const STEPS = ['Category', 'Photo', 'Location', 'Email', 'Review'];
const CAT_ICON = { pothole: 'road', traffic: 'traffic', street: 'lamp' };
const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LogReport() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [category, setCategory] = useState(null);
  const [image, setImage] = useState(null);
  const [imageName, setImageName] = useState('');
  const [verification, setVerification] = useState(null); // null | {pending} | result
  const [loc, setLoc] = useState({ street: '', area: '', landmark: '', lat: null, lng: null, note: '' });
  const [locBusy, setLocBusy] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const demoIdx = useRef(0);

  // Re-run AI verification whenever the category or photo changes.
  useEffect(() => {
    if (!category || !image) return setVerification(null);
    let cancelled = false;
    setVerification({ pending: true });
    verifyReportImage({ categoryLabel: category.label, image, filename: imageName }).then((res) => !cancelled && setVerification(res));
    return () => {
      cancelled = true;
    };
  }, [category, image, imageName]);

  const verified = verification && !verification.pending && verification.match === true;
  const failed = verification && !verification.pending && verification.match === false;

  const hasLocation = (loc.lat != null && loc.lng != null) || Boolean(loc.street.trim() || loc.area.trim() || loc.landmark.trim());
  const emailError = email.trim() && !EMAIL_RX.test(email.trim()) ? 'Please enter a valid email address, or leave it blank.' : '';

  const address = composeAddress(loc) || (loc.lat != null ? `Pinned location (${fmtCoords(loc.lat, loc.lng)})` : '');
  const coords = useMemo(() => {
    if (loc.lat != null && loc.lng != null) return { lat: loc.lat, lng: loc.lng, approximate: false };
    return geocodeManual(loc);
  }, [loc]);

  async function applyPin(lat, lng, source) {
    setLoc((l) => ({ ...l, lat, lng, note: source, noteKind: 'ok' }));
    const rev = await reverseGeocode(lat, lng);
    setLoc((l) => ({ ...l, street: rev.street || l.street, area: rev.area || l.area }));
  }

  async function useCurrent() {
    setLocBusy('current');
    try {
      const p = await getCurrentPosition();
      await applyPin(p.lat, p.lng, 'Current location detected');
    } catch (err) {
      setLoc((l) => ({ ...l, noteKind: 'warn', note: `${err.message} You can type the location, tap the map or use the demo location.` }));
    } finally {
      setLocBusy('');
    }
  }

  function useDemo() {
    const d = pickDemoLocation(demoIdx.current++);
    setLoc({ street: d.street, area: d.area, landmark: d.landmark, lat: d.lat, lng: d.lng, note: 'Demo location applied', noteKind: 'ok' });
  }

  function pickImage(data, name) {
    setImage(data);
    setImageName(name || '');
  }

  async function submit() {
    setSubmitting(true);
    const report = submitCitizenReport({
      category: category.label,
      image,
      imageName,
      ai: { detected: verification.detected, match: true, confidence: verification.confidence, severity: verification.severity },
      location: { address, street: loc.street, area: loc.area, landmark: loc.landmark, lat: coords.lat, lng: coords.lng },
      email: email.trim(),
    });
    const emailResult = email.trim()
      ? await sendEmail({ type: 'confirmation', to: email.trim(), report: { id: report.id, category: report.category, location: report.location.address } })
      : null;
    navigate(`/report/submitted/${report.id}`, { state: { emailResult } });
  }

  const marker = useMemo(
    () => (loc.lat != null ? [{ id: 'pin', lat: loc.lat, lng: loc.lng, kind: 'pin' }] : coords && hasLocation ? [{ id: 'pin', lat: coords.lat, lng: coords.lng, kind: 'pin' }] : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loc.lat, loc.lng, coords.lat, coords.lng, hasLocation],
  );
  const center = loc.lat != null ? [loc.lat, loc.lng] : hasLocation ? [coords.lat, coords.lng] : PRETORIA_CENTER;

  return (
    <div className="page narrow">
      <div className="page-title">
        <h1>Log Report</h1>
        <p>Tell us about the infrastructure problem. It only takes a minute.</p>
      </div>
      <Stepper steps={STEPS} current={step} />

      {/* STEP 1: CATEGORY */}
      {step === 0 && (
        <div className="stack">
          <div>
            <h2>What is the problem?</h2>
            <p className="muted">Select one category. This is used to check your photograph.</p>
          </div>
          <div className="cat-grid" role="radiogroup" aria-label="Infrastructure category">
            {CATEGORIES.map((c) => (
              <button key={c.id} type="button" role="radio" aria-checked={category?.id === c.id} className={`cat-card ${category?.id === c.id ? 'selected' : ''}`} onClick={() => setCategory(c)}>
                <div className="cat-ico"><Icon name={CAT_ICON[c.id]} size={26} /></div>
                <h3>{c.label}</h3>
                <span className="muted small">{c.blurb}</span>
              </button>
            ))}
          </div>
          <div className="btn-row end">
            <button className="btn btn-primary btn-lg" disabled={!category} onClick={() => setStep(1)}>Continue</button>
          </div>
        </div>
      )}

      {/* STEP 2 + 3: IMAGE and AI VERIFICATION */}
      {step === 1 && (
        <div className="stack">
          <div>
            <h2>Add a photograph</h2>
            <p className="muted">Category: <strong>{category.label}</strong></p>
          </div>

          {!image && <ImageInput onImage={pickImage} samples={SAMPLE_PHOTOS.citizen} />}

          {image && (
            <div className="card">
              <div className="grid cols-2" style={{ alignItems: 'start' }}>
                <Photo src={image} alt="Your uploaded photo" />
                <div className="stack-sm">
                  <h3 style={{ margin: 0 }}>AI Image Verification</h3>
                  {verification?.pending && (
                    <div className="verify-box pending">
                      <Spinner label="Checking your photo…" />
                      <div className="scan-bar" />
                    </div>
                  )}
                  {verified && (
                    <div className="verify-box ok">
                      <strong className="with-icon"><Icon name="check" size={16} /> Verified</strong>
                      <p className="muted small" style={{ margin: '2px 0 0' }}>The photo matches “{category.label}”.</p>
                    </div>
                  )}
                  {failed && (
                    <div className="verify-box fail" role="alert">
                      <strong className="with-icon"><Icon name="x" size={16} /> Verification Failed</strong>
                      <p style={{ margin: '4px 0 0' }}>{verification.reason}</p>
                    </div>
                  )}
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => pickImage(null, '')}>
                    <Icon name="upload" size={15} /> {failed ? 'Upload Another Image' : 'Change photo'}
                  </button>
                </div>
              </div>

              {verified && <VerificationSummary ai={{ ...verification, match: true }} />}
              {failed && (
                <div className="metric-row">
                  <div className="metric"><div className="m-label">Selected Category</div><div className="m-value" style={{ fontSize: '.92rem' }}>{category.label}</div></div>
                  <div className="metric"><div className="m-label">AI Detected</div><div className="m-value" style={{ fontSize: '.92rem' }}>{verification.detected}</div></div>
                  <div className="metric"><div className="m-label">Confidence</div><div className="m-value">{verification.confidence}%</div></div>
                </div>
              )}
              <p className="muted small" style={{ margin: '12px 0 0' }}>Simulated verification for demonstration purposes.</p>
            </div>
          )}

          <div className="btn-row spread">
            <button className="btn btn-ghost" onClick={() => setStep(0)}>Back</button>
            <button className="btn btn-primary btn-lg" disabled={!verified} onClick={() => setStep(2)}>Continue</button>
          </div>
          {failed && <p className="error-text center">A report cannot be submitted until a photo matching the selected category is provided.</p>}
        </div>
      )}

      {/* STEP 4: LOCATION */}
      {step === 2 && (
        <div className="stack">
          <div>
            <h2>Where is it?</h2>
            <p className="muted">Type the location, tap the map, or use one of the shortcuts.</p>
          </div>
          <div className="btn-row">
            <button className="btn btn-secondary" onClick={useCurrent} disabled={locBusy === 'current'}>
              <Icon name="pin" /> {locBusy === 'current' ? 'Locating…' : 'Use My Current Location'}
            </button>
            <button className="btn btn-secondary" onClick={useDemo}>Use Demo Location</button>
          </div>
          {loc.note && <Alert kind={loc.noteKind === 'warn' ? 'warn' : 'success'}>{loc.note}</Alert>}

          <div className="card">
            <div className="form-grid">
              <div className="field">
                <label htmlFor="street">Street</label>
                <input id="street" className="input" value={loc.street} placeholder="Pretorius Street" onChange={(e) => setLoc({ ...loc, street: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="area">Suburb / Area</label>
                <input id="area" className="input" value={loc.area} placeholder="Pretoria CBD" onChange={(e) => setLoc({ ...loc, area: e.target.value })} />
              </div>
              <div className="field full">
                <label htmlFor="landmark">Landmark or description</label>
                <input id="landmark" className="input" value={loc.landmark} placeholder="Near Church Square" onChange={(e) => setLoc({ ...loc, landmark: e.target.value })} />
              </div>
            </div>
            <div className="label" style={{ marginBottom: 6 }}>Map pin <span className="muted small">(tap the map to drop a pin)</span></div>
            <MapView
              center={center}
              zoom={loc.lat != null ? 16 : 13}
              markers={marker}
              onClickMap={(lat, lng) => applyPin(lat, lng, 'Pin placed on the map')}
            />
            <p className="muted small" style={{ margin: '8px 0 0' }}>
              {loc.lat != null ? `Coordinates: ${fmtCoords(loc.lat, loc.lng)}` : hasLocation ? 'No pin yet — an approximate map position will be used for the typed address.' : 'No location selected yet.'}
            </p>
          </div>
          <div className="btn-row spread">
            <button className="btn btn-ghost" onClick={() => setStep(1)}>Back</button>
            <button className="btn btn-primary btn-lg" disabled={!hasLocation} onClick={() => setStep(3)}>Continue</button>
          </div>
        </div>
      )}

      {/* STEP 5: OPTIONAL EMAIL */}
      {step === 3 && (
        <div className="stack">
          <div>
            <h2>Email Address <span className="muted" style={{ fontWeight: 500 }}>(Optional)</span></h2>
            <p className="muted">Add your email if you would like to receive confirmation and updates about this report.</p>
          </div>
          <div className="card">
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="email">Email address</label>
              <input id="email" type="email" className="input" value={email} placeholder="citizen@example.com" autoComplete="email" onChange={(e) => setEmail(e.target.value)} />
              {emailError && <span className="error-text">{emailError}</span>}
              <span className="hint">You can skip this. Your report will be submitted normally either way.</span>
            </div>
          </div>
          <div className="btn-row spread">
            <button className="btn btn-ghost" onClick={() => setStep(2)}>Back</button>
            <button className="btn btn-primary btn-lg" disabled={Boolean(emailError)} onClick={() => setStep(4)}>
              {email.trim() ? 'Continue' : 'Skip & Continue'}
            </button>
          </div>
        </div>
      )}

      {/* STEP 6: REVIEW */}
      {step === 4 && (
        <div className="stack">
          <div>
            <h2>Review your report</h2>
            <p className="muted">Please check everything before submitting.</p>
          </div>
          <div className="card stack">
            <div className="grid cols-2" style={{ alignItems: 'start' }}>
              <div>
                <div className="label muted small">Category</div>
                <h3>{category.label}</h3>
                <div className="label muted small" style={{ marginTop: 14 }}>AI Verification</div>
                <VerificationSummary ai={{ ...verification, match: true }} />
              </div>
              <div>
                <div className="label muted small" style={{ marginBottom: 6 }}>Image</div>
                <Photo src={image} alt="Uploaded photograph" />
              </div>
            </div>
            <div className="divider" style={{ margin: 0 }} />
            <div>
              <div className="label muted small">Location</div>
              <h3 style={{ marginBottom: 8 }}>{address}</h3>
              <MapView className="map short" center={[coords.lat, coords.lng]} zoom={16} interactive={false} markers={[{ id: 'p', lat: coords.lat, lng: coords.lng, kind: 'pin' }]} />
              <p className="muted small" style={{ margin: '6px 0 0' }}>
                {fmtCoords(coords.lat, coords.lng)}
                {coords.approximate ? ' (approximate)' : ''}
              </p>
            </div>
            {email.trim() && (
              <>
                <div className="divider" style={{ margin: 0 }} />
                <div>
                  <div className="label muted small">Email</div>
                  <strong>{email.trim()}</strong>
                </div>
              </>
            )}
          </div>
          <div className="btn-row spread">
            <button className="btn btn-ghost" onClick={() => setStep(3)} disabled={submitting}>Back</button>
            <button className="btn btn-primary btn-lg" onClick={submit} disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit Report'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
