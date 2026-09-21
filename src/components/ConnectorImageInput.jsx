import { useEffect, useRef, useState } from 'react';
import { Icon, Photo, fileToDataUrl } from './ui.jsx';

export default function ConnectorImageInput({ disabled, value, onChange, onBusyChange }) {
  const fileRef = useRef(null);
  const videoRef = useRef(null);
  const requestRef = useRef(0);
  const [stream, setStream] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => () => { requestRef.current += 1; onBusyChange(false); }, []);
  useEffect(() => {
    if (!stream) return;
    onBusyChange(true);
    videoRef.current.srcObject = stream;
    videoRef.current.play().catch(() => setError('Camera preview could not start. Try Upload Image.'));
    return () => { stream.getTracks().forEach((track) => track.stop()); onBusyChange(false); };
  }, [stream]);

  function stopCamera() {
    requestRef.current += 1;
    if (stream) stream.getTracks().forEach((track) => track.stop());
    setStream(null);
    setBusy(false);
    onBusyChange(false);
  }
  async function openCamera() {
    setError('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera access is unavailable here. Use Upload Image, or open this page over HTTPS or localhost.');
      return;
    }
    const request = ++requestRef.current;
    setBusy(true); onBusyChange(true);
    try {
      const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      if (request !== requestRef.current) { media.getTracks().forEach((track) => track.stop()); return; }
      setStream(media);
    } catch {
      if (request === requestRef.current) setError('Camera access was denied or no camera is available. You can use Upload Image instead.');
    } finally {
      if (request === requestRef.current) { setBusy(false); onBusyChange(false); }
    }
  }
  function capture() {
    const video = videoRef.current;
    if (!video?.videoWidth) { setError('Wait for the camera preview before capturing.'); return; }
    try {
      const scale = Math.min(1, 960 / Math.max(video.videoWidth, video.videoHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
      onChange({ image: canvas.toDataURL('image/jpeg', 0.72), imageName: 'camera-capture.jpg' });
      setError(''); stopCamera();
    } catch { setError('Could not capture this image. Try Upload Image.'); }
  }
  async function upload(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Choose a JPG, PNG or WebP image.'); return;
    }
    if (file.size > 20 * 1024 * 1024) { setError('Choose an image smaller than 20 MB.'); return; }
    const request = ++requestRef.current;
    setBusy(true); onBusyChange(true);
    try {
      const image = await fileToDataUrl(file);
      if (request === requestRef.current) onChange({ image, imageName: file.name });
    } catch (err) {
      if (request === requestRef.current) setError(err.message);
    } finally {
      if (request === requestRef.current) { setBusy(false); onBusyChange(false); }
    }
  }
  return <div className="stack-sm">
    <div className="btn-row">
      <button type="button" className="btn btn-secondary" disabled={disabled || busy || Boolean(stream)} onClick={openCamera}><Icon name="camera" /> Open Camera</button>
      <button type="button" className="btn btn-secondary" disabled={disabled || busy || Boolean(stream)} onClick={() => fileRef.current?.click()}><Icon name="upload" /> Upload Image</button>
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={upload} />
    </div>
    {busy && <p role="status">Preparing image input…</p>}
    {(stream || busy) && <button type="button" className="btn btn-ghost" onClick={stopCamera}>Cancel</button>}
    {stream && <div className="stack-sm">
      <video ref={videoRef} autoPlay muted playsInline aria-label="Camera preview" style={{ width: '100%', maxHeight: 360, borderRadius: 12 }} />
      <button type="button" className="btn btn-primary" onClick={capture}>Capture Image</button>
    </div>}
    {value && <div className="stack-sm">
      <Photo src={value.image} alt="Image selected for Computer Vision processing" />
      <p className="muted small">{value.imageName} — ready for Computer Vision processing.</p>
      <button type="button" className="btn btn-ghost" disabled={busy || Boolean(stream)} onClick={() => onChange(null)}>Remove Image</button>
    </div>}
    {error && <p className="error-text" role="alert">{error}</p>}
  </div>;
}
