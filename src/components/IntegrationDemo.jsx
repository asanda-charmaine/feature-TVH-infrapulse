
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MapView from './MapView.jsx';
import ConnectorImageInput from './ConnectorImageInput.jsx';
import { Alert, Icon, KV, Photo, SeverityBadge, StatusBadge } from './ui.jsx';
import { useStore, connectDemoConnector, disconnectDemoConnectors, simulateIntegrationEvent, loginTechnician, loginSupervisor, storageWarning } from '../lib/store.js';
import { fmtDateTime } from '../lib/format.js';

const processingStatus = (r) => r.supervisorDismissal ? 'Dismissed'
  : r.status === 'Resolved' ? 'Completed'
  : r.status === 'In Progress' ? 'In Progress'
  : r.workOrderId ? 'Assigned' : 'Awaiting Assignment';

export default function IntegrationDemo() {
  const state = useStore();
  const navigate = useNavigate();
  const connected = state.connectors || {};
  const [tab, setTab] = useState('pothole');
  const [filter, setFilter] = useState('all');
  const [inputImage, setInputImage] = useState(null);
  const [imageBusy, setImageBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [startedAt] = useState(() => new Date().toISOString());
  const reports = state.reports.filter((r) => r.integration);
  const latest = reports[0];
  const pothole = reports.find((r) => r.integration.kind === 'pothole');
  const traffic = reports.find((r) => r.integration.kind === 'traffic');
  const asset = state.assets.find((a) => a.type === 'Traffic Light' && a.area === 'Pretoria CBD')
    || state.assets.find((a) => a.type === 'Traffic Light');
  const sensor = traffic?.integration.payload.telemetry || {
    trafficLightId: asset?.id || 'TLS-DEMO-01', intersection: asset?.location || 'Pretorius Street, Pretoria CBD',
    controller: 'Online', red: 'Working', amber: 'Working', green: 'Working',
    power: 'Normal', communication: 'Connected', lastUpdate: startedAt,
  };
  function simulate(kind) {
    setError(''); setSuccess('');
    try {
      simulateIntegrationEvent(kind, kind === 'pothole' ? inputImage || {} : {});
      setFilter('all');
      setSuccess(kind === 'pothole' ? 'Pothole detection received and report created successfully.'
        : 'Traffic-light fault received and maintenance report created.');
    } catch (e) { setError(e.message); }
  }
  function openReports(id) {
    loginTechnician();
    navigate(id ? '/technician/reports/' + id : '/technician/reports');
  }
  function openSupervisor() {
    loginSupervisor();
    navigate('/supervisor/review');
  }
  const visible = reports.filter((r) => filter === 'all' || r.integration.kind === filter);
  // A controller has one current marker; its latest telemetry supersedes earlier readings.
  const seen = new Set();
  const markers = visible.filter((r) => {
    const key = r.integration.kind === 'traffic' ? r.assetId || 'traffic-demo' : r.id;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  }).map((r) => ({
    id: r.id, lat: r.location.lat, lng: r.location.lng,
    kind: r.severity === 'Critical' ? 'critical' : 'ai',
    title: r.id + ' - ' + r.category + ' - ' + r.severity,
    onClick: () => openReports(r.id),
  }));
  if (connected.traffic && !traffic && filter !== 'pothole') markers.push({
    id: 'healthy-controller', lat: asset?.lat ?? -25.7463, lng: asset?.lng ?? 28.1891,
    kind: 'asset', title: sensor.trafficLightId + ' - Controller online; all signals working',
  });
  const current = tab === 'pothole' ? pothole : traffic;
  const steps = tab === 'pothole'
    ? ['Computer Vision API', 'InfraPulse', 'Report Created', 'Map Updated', 'Supervisor Review']
    : ['Traffic-Light Sensor', 'InfraPulse', 'Fault Detected', 'Report Created', 'Map Updated', 'Supervisor Review'];
  return (
    <section className="stack" aria-labelledby="integration-title" style={{ margin: '32px 0' }}>
      <div>
        <h2 id="integration-title">Connected Infrastructure</h2>
        <p className="muted">Connected Computer Vision API and traffic-light controllers feed reports, map updates and supervisor review.</p>
      </div>
      <div className="grid cols-2" aria-label="External system connectors">
        {[['pothole', 'Computer Vision / AI Connector', 'Computer Vision API', 'spark'], ['traffic', 'Traffic-Light Sensor Connector', 'Traffic-Light Sensors', 'traffic']].map(([kind, name, system, icon]) => (
          <div className="card stack-sm" key={kind}>
            <div className="btn-row"><Icon name={icon} size={28} /><h3>{name}</h3></div>
            <p className="muted">{system}</p>
            <p role="status">Status: <strong>{connected[kind] ? 'Connected' : 'Not Connected'}</strong></p>
            <button className="btn btn-primary" style={{ alignSelf: 'flex-start' }} disabled={Boolean(connected[kind])} onClick={() => connectDemoConnector(kind)} aria-label={'Connect ' + system}>{connected[kind] ? 'Connected' : 'Connect'}</button>
          </div>
        ))}
      </div>
      {(connected.pothole || connected.traffic) && <button type="button" className="btn btn-secondary" style={{ alignSelf: 'flex-start' }} onClick={() => {
        disconnectDemoConnectors();
        setInputImage(null);
        setImageBusy(false);
        setSuccess('');
        setError('');
      }}>End Demonstration</button>}
      <div className="btn-row" aria-label="Connected infrastructure type">
        <button className={'btn ' + (tab === 'pothole' ? 'btn-primary' : 'btn-secondary')} aria-pressed={tab === 'pothole'} onClick={() => { setTab('pothole'); setSuccess(''); }}>Potholes</button>
        <button className={'btn ' + (tab === 'traffic' ? 'btn-primary' : 'btn-secondary')} aria-pressed={tab === 'traffic'} onClick={() => { setTab('traffic'); setSuccess(''); }}>Traffic Lights</button>
      </div>
      <div className="card stack">
        {!connected[tab] && <p className="muted">Connect the {tab === 'pothole' ? 'Computer Vision API' : 'Traffic-Light Sensors'} above to receive data.</p>}
        {tab === 'pothole' ? (
          <>
            <h3>Computer Vision API</h3>
            <ConnectorImageInput key={String(Boolean(connected.pothole))} disabled={!connected.pothole} value={inputImage} onChange={setInputImage} onBusyChange={setImageBusy} />
            <button className="btn btn-primary" style={{ alignSelf: 'flex-start' }} disabled={!connected.pothole || imageBusy} onClick={() => simulate('pothole')}>Receive Pothole Detection</button>
            {pothole ? <div className="grid cols-2">
              <Photo src={pothole.image} alt="Connected Computer Vision API pothole detection" />
              <KV items={[
                ['Detection', pothole.integration.payload.detected],
                ['Confidence', pothole.integration.payload.confidence + '%'],
                ['Severity', pothole.severity], ['Location', pothole.location.address],
                ['Timestamp', fmtDateTime(pothole.submittedAt)], ['Report ID', pothole.id],
              ]} />
            </div> : <p className="muted">Receive a connected image detection to create a High priority pothole report in Pretoria CBD.</p>}
          </>
        ) : (
          <>
            <h3>Live Sensor Panel <span className="muted small">{connected.traffic ? '(connected controllers)' : '(not connected)'}</span></h3>
            {connected.traffic && <KV items={[
              ['Traffic Light ID', sensor.trafficLightId], ['Intersection', sensor.intersection],
              ['Controller Status', sensor.controller], ['Red Signal', sensor.red], ['Amber Signal', sensor.amber],
              ['Green Signal', <strong key="green" style={{ color: sensor.green === 'FAILED' ? '#d03b3b' : undefined }}>{sensor.green}</strong>],
              ['Power Status', sensor.power], ['Communication Status', sensor.communication],
              ['Last Update', fmtDateTime(sensor.lastUpdate)], ['Severity', traffic ? 'Critical' : 'Normal'],
            ]} />}
            <button className="btn btn-primary" style={{ alignSelf: 'flex-start' }} disabled={!connected.traffic} onClick={() => simulate('traffic')}>Receive Traffic Light Fault</button>
          </>
        )}
        <div role="status" aria-live="polite">
          {success && <Alert kind="success" title={success} />}
          {error && <Alert kind="error" title={error} />}
        </div>
        {current && <>
          <p className="small"><strong>Processing completed:</strong> {steps.join(' → ')}</p>
          <div className="btn-row">
            <button className="btn btn-secondary" onClick={() => openReports(current.id)}>Open Report {current.id}</button>
            <button className="btn btn-secondary" onClick={openSupervisor}>Open Supervisor Review Tasks</button>
          </div>
        </>}
      </div>

      <div className="card stack" aria-live="polite">
        <h3>Latest InfraPulse Event</h3>
        {latest ? <>
          <KV items={[
            ['Event ID', latest.integration.eventId], ['Source', latest.integration.source],
            ['Asset/Issue', latest.assetId ? latest.assetId + ' / ' + latest.category : latest.category],
            ['Location', latest.location.address], ['Severity', <SeverityBadge key="severity" severity={latest.severity} />],
            ['Time', fmtDateTime(latest.submittedAt)], ['Report ID', latest.id],
            ['Priority / Risk', (latest.priority || latest.severity) + ' / ' + latest.risk],
            ['Processing Status', processingStatus(latest)],
            ['Report Status', <StatusBadge key="status" status={latest.status} />],
          ]} />
          <p className="small">{[...latest.integration.stages, processingStatus(latest)].join(' → ')}</p>
          <p className="muted small">Validation checks the incoming data. Supervisor approval and assignment happen in Review Tasks.</p>
          <div className="btn-row">
            <button className="btn btn-secondary" onClick={() => openReports()}>Open Reports</button>
            <button className="btn btn-secondary" onClick={openSupervisor}>Open Supervisor Review Tasks</button>
          </div>
        </> : <p className="muted">Receive a connected detection or fault to see its operational report here.</p>}
        {storageWarning() && <Alert kind="warn" title="Browser storage is full">The report is available in this tab, but could not be saved for reload or other tabs.</Alert>}
      </div>
      <div className="card stack">
        <h3>Connected Hotspots</h3>
        <div className="btn-row" aria-label="Filter connected hotspots">
          {[['all', 'All'], ['pothole', 'Potholes'], ['traffic', 'Traffic Lights']].map(([value, label]) =>
            <button key={value} className={'btn ' + (filter === value ? 'btn-primary' : 'btn-secondary')} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}
        </div>
        <MapView markers={markers} fitToMarkers center={latest ? [latest.location.lat, latest.location.lng] : [asset?.lat ?? -25.7463, asset?.lng ?? 28.1891]} zoom={14} />
        <p className="muted small">Blue: healthy controller. Purple: pothole detection. Red: critical traffic-light fault. Select a report marker to open its existing report.</p>
        <p className="small">{visible.length} connected report(s) match this filter. Repeated controller readings update the same asset marker.</p>
      </div>
    </section>
  );
}
