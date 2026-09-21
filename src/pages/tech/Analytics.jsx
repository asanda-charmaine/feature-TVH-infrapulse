import { useMemo, useRef, useState } from 'react';
import { PageHead, StatCard } from '../../components/tech.jsx';
import { BarList, ChartCard, ColumnChart, Donut, LineChart, SERIES, SEVERITY_COLORS } from '../../components/charts.jsx';
import { Alert, ExportMenu, Icon, toast } from '../../components/ui.jsx';
import { useStore } from '../../lib/store.js';
import { analyticsStats } from '../../lib/stats.js';
import { analyzeCSV, parseCSV } from '../../lib/csv.js';
import { fmtNumber } from '../../lib/format.js';

function CsvAnalyzer() {
  const [file, setFile] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [drag, setDrag] = useState(false);
  const inputRef = useRef(null);

  const analysis = useMemo(() => (data ? analyzeCSV(data) : null), [data]);

  function load(text, name) {
    try {
      const parsed = parseCSV(text);
      if (!parsed.headers.length || !parsed.records.length) throw new Error('That CSV has no data rows.');
      setData(parsed);
      setFile(name);
      setError('');
    } catch (e) {
      setData(null);
      setError(e.message || 'Could not read that CSV file.');
    }
  }
  async function onFile(f) {
    if (!f) return;
    if (!/\.csv$/i.test(f.name) && f.type !== 'text/csv') return setError('Please upload a .csv file.');
    load(await f.text(), f.name);
  }
  async function useSample() {
    try {
      const res = await fetch('/sample-data/tshwane-service-requests.csv');
      if (!res.ok) throw new Error('Sample not found');
      load(await res.text(), 'tshwane-service-requests.csv');
    } catch {
      setError('Could not load the sample dataset.');
    }
  }

  const exportTable = () => {
    const rows = [['Summary', 'Total Records', analysis.total]];
    analysis.insights.forEach((t, i) => rows.push(['Insight', `#${i + 1}`, t]));
    [['Category', analysis.category], ['Status', analysis.status], ['Severity', analysis.severity], ['Area', analysis.area], ['Trend', analysis.trend]].forEach(([n, s]) => s?.forEach((x) => rows.push([n, x.label, x.value])));
    return { name: `analysis_${(file || 'csv').replace(/\.csv$/i, '')}`, title: `InfraPulse — CSV Analysis (${file})`, headers: ['Section', 'Label', 'Value'], rows };
  };
  const previewTable = () => ({ name: `data_${(file || 'csv').replace(/\.csv$/i, '')}`, title: `InfraPulse — ${file}`, headers: data.headers, rows: data.records.map((r) => data.headers.map((h) => r[h])) });

  return (
    <div className="card" id="csv">
      <div className="card-head">
        <div>
          <h2>Upload CSV</h2>
          <p className="muted small" style={{ margin: 0 }}>Analyse any additional dataset. InfraPulse detects category, status, severity, area and date columns automatically.</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={useSample}>Use sample dataset (428 records)</button>
      </div>

      <div
        className="dropzone"
        style={drag ? { borderColor: 'var(--teal)', background: 'var(--teal-50)' } : undefined}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); onFile(e.dataTransfer.files?.[0]); }}
      >
        <button className="btn btn-primary" onClick={() => inputRef.current?.click()}>Choose .csv file</button>
        <p className="muted small" style={{ margin: '8px 0 0' }}>…or drag and drop a file here. Parsed in your browser — nothing is uploaded.</p>
        <input ref={inputRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
      </div>
      {error && <div style={{ marginTop: 12 }}><Alert kind="error">{error}</Alert></div>}

      {analysis && (
        <div className="stack" style={{ marginTop: 20 }}>
          <div className="row spread">
            <div><strong>{file}</strong> <span className="muted small">· {fmtNumber(analysis.total)} rows · {data.headers.length} columns</span></div>
            <div className="row">
              <ExportMenu getTable={exportTable} label="Export analysis" />
              <button className="btn btn-ghost btn-sm" onClick={() => { setData(null); setFile(null); }}>Clear</button>
            </div>
          </div>

          <div>
            <h3>Preview the Data</h3>
            <div className="table-wrap card flush">
              <table className="table">
                <thead><tr>{data.headers.map((h) => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>{data.records.slice(0, 6).map((r, i) => <tr key={i}>{data.headers.map((h) => <td key={h}>{r[h]}</td>)}</tr>)}</tbody>
              </table>
            </div>
            <p className="muted small" style={{ margin: '6px 0 0' }}>Showing first 6 of {fmtNumber(analysis.total)} rows. Recognised columns: {analysis.columnsUsed.length ? analysis.columnsUsed.join(', ') : 'none'}.</p>
          </div>

          <Alert kind="info" icon={<Icon name="spark" size={20} />} title="InfraPulse Analysis">InfraPulse analysed this dataset and generated the following operational insights.</Alert>
          <div>{analysis.insights.map((t, i) => <div className="insight" key={i}>{t}</div>)}</div>

          <div className="stat-grid" style={{ marginBottom: 0 }}>
            {analysis.cards.map((c, i) => <StatCard key={c.label} label={c.label} value={c.value} tone={i === 0 ? '' : ['blue', 'warn', 'violet', ''][i % 4]} />)}
          </div>

          <div className="grid cols-2">
            {analysis.category && <ChartCard title="Category Distribution" data={analysis.category}><Donut data={analysis.category} /></ChartCard>}
            {analysis.status && <ChartCard title="Status Distribution" data={analysis.status}><Donut data={analysis.status} /></ChartCard>}
            {analysis.severity && <ChartCard title="Severity Distribution" data={analysis.severity}><BarList data={analysis.severity} colors={SEVERITY_COLORS} /></ChartCard>}
            {analysis.area && <ChartCard title="Reports by Area" data={analysis.area}><BarList data={analysis.area} /></ChartCard>}
            {analysis.trend && <div style={{ gridColumn: '1 / -1' }}><ChartCard title="Date Trends" subtitle="Records per month" data={analysis.trend}><LineChart data={analysis.trend} /></ChartCard></div>}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Analytics() {
  const state = useStore();
  const a = useMemo(() => analyticsStats(state), [state]);

  const exportTable = () => {
    const rows = [
      ['Summary', 'Total Reports', a.total], ['Summary', 'Citizen Reports', a.citizen], ['Summary', 'AI Reports', a.ai], ['Summary', 'Open Issues', a.open],
      ['Summary', 'Resolved Issues', a.resolved], ['Summary', 'Critical Issues', a.critical], ['Summary', 'Average Resolution Time (days)', a.avgDays.toFixed(1)],
      ['Summary', 'Most Common Fault', a.mostCommonFault], ['Summary', 'Work Orders Completed', a.woCompleted], ['Summary', 'Work Orders Outstanding', a.woOutstanding],
    ];
    [['Category', a.byCategory], ['Source', a.bySource], ['Severity', a.bySeverity], ['Location', a.byLocation], ['Work Order Status', a.byWorkOrder], ['Resolution Performance', a.resolutionBuckets], ['Reports Over Time', a.overTime]].forEach(([n, s]) => s.forEach((x) => rows.push([n, x.label, x.value])));
    a.highestRiskAreas.forEach((x) => rows.push(['Highest Risk Areas', x.label, `${x.value} avg risk (${x.n} open)`]));
    return { name: 'infrapulse_analytics', title: 'InfraPulse — Data & Analytics', headers: ['Section', 'Label', 'Value'], rows };
  };

  return (
    <>
      <PageHead title="Data & Analytics" sub="Operational statistics from InfraPulse data.">
        <a href="#csv" className="btn btn-secondary btn-sm" onClick={(e) => { e.preventDefault(); document.getElementById('csv')?.scrollIntoView({ behavior: 'smooth' }); }}>Upload CSV ↓</a>
        <ExportMenu getTable={exportTable} label="Export analytics" />
      </PageHead>

      <div className="stat-grid">
        <StatCard label="Total Reports" value={a.total} />
        <StatCard label="Citizen Reports" value={a.citizen} tone="blue" />
        <StatCard label="AI Reports" value={a.ai} tone="violet" />
        <StatCard label="Open Issues" value={a.open} tone="warn" />
        <StatCard label="Resolved Issues" value={a.resolved} />
        <StatCard label="Critical Issues" value={a.critical} tone="critical" />
        <StatCard label="Avg Resolution Time" value={`${a.avgDays.toFixed(1)} d`} sub="Submitted → resolved" />
        <StatCard label="Most Common Fault" value={a.mostCommonFault} tone="text" />
        <StatCard label="Work Orders Completed" value={a.woCompleted} />
        <StatCard label="Work Orders Outstanding" value={a.woOutstanding} tone="warn" />
        <div className="stat" style={{ gridColumn: 'span 2' }}>
          <div className="s-label">Highest Risk Areas</div>
          {a.highestRiskAreas.length === 0 ? <div className="s-sub">No open issues</div> : (
            <ol style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              {a.highestRiskAreas.slice(0, 3).map((x) => <li key={x.label}><strong>{x.label}</strong> <span className="muted small">avg risk {x.value} · {x.n} open</span></li>)}
            </ol>
          )}
        </div>
      </div>

      <div className="grid cols-2" style={{ marginBottom: 16 }}>
        <ChartCard title="Reports by Category" data={a.byCategory}><BarList data={a.byCategory} /></ChartCard>
        <ChartCard title="Reports by Source" data={a.bySource}><Donut data={a.bySource} colors={{ 'Citizen Report': SERIES[0], 'AI Detected': SERIES[6] }} /></ChartCard>
        <ChartCard title="Reports by Severity" data={a.bySeverity}><BarList data={a.bySeverity} colors={SEVERITY_COLORS} /></ChartCard>
        <ChartCard title="Reports by Location" subtitle="Top areas" data={a.byLocation}><BarList data={a.byLocation} /></ChartCard>
        <ChartCard title="Reports Over Time" subtitle="Last 14 days" data={a.overTime}><LineChart data={a.overTime} /></ChartCard>
        <ChartCard title="Work Order Status" data={a.byWorkOrder}><Donut data={a.byWorkOrder} /></ChartCard>
        <div style={{ gridColumn: '1 / -1' }}>
          <ChartCard title="Resolution Performance" subtitle="Resolved reports by time to resolve" data={a.resolutionBuckets}><ColumnChart data={a.resolutionBuckets} height={200} /></ChartCard>
        </div>
      </div>

      <CsvAnalyzer />
    </>
  );
}
