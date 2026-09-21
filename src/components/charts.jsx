import { useState } from 'react';

// Categorical palette (validated default from the dataviz method) plus fixed status colours.
export const SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'];
export const BRAND = '#0a8f8a';
export const SEVERITY_COLORS = { Low: '#0ca30c', Medium: '#fab219', High: '#ec835a', Critical: '#d03b3b' };
const INK = '#5b6b7f';
const GRID = '#e6edf3';

/** Card wrapper with a "table view" toggle so no chart is colour- or hover-only. */
export function ChartCard({ title, subtitle, data, children, action }) {
  const [table, setTable] = useState(false);
  return (
    <div className="card">
      <div className="card-head" style={{ marginBottom: 8 }}>
        <div>
          <div className="chart-title">{title}</div>
          {subtitle && <div className="muted small">{subtitle}</div>}
        </div>
        <div className="row">
          {action}
          {data && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setTable((t) => !t)}>
              {table ? 'Chart' : 'Table'}
            </button>
          )}
        </div>
      </div>
      {table && data ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Label</th>
                <th className="num">Value</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.label}>
                  <td>{d.label}</td>
                  <td className="num">{d.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}
    </div>
  );
}

/** Horizontal bars with direct value labels. `colors` maps label → colour; default is the brand teal. */
export function BarList({ data, colors, max, unit = '' }) {
  const top = max ?? Math.max(1, ...data.map((d) => d.value));
  if (!data.length || data.every((d) => !d.value)) return <p className="muted">No data yet.</p>;
  return (
    <div className="chart">
      {data.map((d) => (
        <div className="bar-row" key={d.label} title={`${d.label}: ${d.value}${unit}`}>
          <span className="bar-label">{d.label}</span>
          <span className="bar-track">
            <span className="bar-fill" style={{ display: 'block', width: `${(d.value / top) * 100}%`, background: colors?.[d.label] || BRAND }} />
          </span>
          <strong className="mono" style={{ textAlign: 'right' }}>{d.value}{unit}</strong>
        </div>
      ))}
    </div>
  );
}

/** Vertical columns (SVG) with hover tooltip. */
export function ColumnChart({ data, color = BRAND, height = 220 }) {
  const [hover, setHover] = useState(null);
  const W = 600;
  const H = height;
  const pad = { l: 30, r: 8, t: 12, b: 34 };
  const max = Math.max(1, ...data.map((d) => d.value));
  const niceMax = Math.ceil(max / 4) * 4 || 4;
  const bw = (W - pad.l - pad.r) / data.length;
  const y = (v) => pad.t + (H - pad.t - pad.b) * (1 - v / niceMax);
  const ticks = [0, 1, 2, 3, 4].map((i) => (niceMax / 4) * i);
  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="Column chart">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke={GRID} />
            <text x={pad.l - 6} y={y(t) + 4} fontSize="11" fill={INK} textAnchor="end">{t}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = pad.l + i * bw + bw * 0.18;
          const w = bw * 0.64;
          const top = y(d.value);
          return (
            <g key={d.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={pad.l + i * bw} y={pad.t} width={bw} height={H - pad.t - pad.b} fill="transparent" />
              <path
                d={`M${x} ${H - pad.b} V${top + 4} Q${x} ${top} ${x + 4} ${top} H${x + w - 4} Q${x + w} ${top} ${x + w} ${top + 4} V${H - pad.b} Z`}
                fill={color}
                opacity={hover == null || hover === i ? 1 : 0.55}
              />
              {d.value > 0 && data.length <= 8 && <text x={x + w / 2} y={top - 4} fontSize="11" fontWeight="700" fill="#0b1f3a" textAnchor="middle">{d.value}</text>}
              {(data.length <= 8 || i % 2 === 0) && (
                <text x={x + w / 2} y={H - 14} fontSize="10.5" fill={INK} textAnchor="middle">{d.label}</text>
              )}
            </g>
          );
        })}
      </svg>
      {hover != null && (
        <div className="chart-tip" style={{ left: `${((pad.l + hover * bw + bw / 2) / W) * 100}%`, top: `${(y(data[hover].value) / H) * 100}%` }}>
          {data[hover].label}: <strong>{data[hover].value}</strong>
        </div>
      )}
    </div>
  );
}

/** Line chart (SVG) with crosshair + tooltip. */
export function LineChart({ data, color = BRAND, height = 220 }) {
  const [hover, setHover] = useState(null);
  const W = 600;
  const H = height;
  const pad = { l: 30, r: 12, t: 14, b: 32 };
  const max = Math.max(1, ...data.map((d) => d.value));
  const niceMax = Math.ceil(max / 4) * 4 || 4;
  const x = (i) => pad.l + (data.length === 1 ? 0.5 : i / (data.length - 1)) * (W - pad.l - pad.r);
  const y = (v) => pad.t + (H - pad.t - pad.b) * (1 - v / niceMax);
  const path = data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(d.value).toFixed(1)}`).join(' ');
  const ticks = [0, 1, 2, 3, 4].map((i) => (niceMax / 4) * i);
  const step = Math.ceil(data.length / 7);
  return (
    <div style={{ position: 'relative' }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="chart"
        role="img"
        aria-label="Line chart"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * W;
          const i = Math.round(((px - pad.l) / (W - pad.l - pad.r)) * (data.length - 1));
          setHover(Math.max(0, Math.min(data.length - 1, i)));
        }}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke={GRID} />
            <text x={pad.l - 6} y={y(t) + 4} fontSize="11" fill={INK} textAnchor="end">{t}</text>
          </g>
        ))}
        <path d={`${path} L${x(data.length - 1)} ${y(0)} L${x(0)} ${y(0)} Z`} fill={color} opacity=".1" />
        <path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {data.map((d, i) => (
          <text key={d.label} x={x(i)} y={H - 10} fontSize="10.5" fill={INK} textAnchor="middle" opacity={i % step === 0 || i === data.length - 1 ? 1 : 0}>{d.label}</text>
        ))}
        {hover != null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={H - pad.b} stroke="#9fb0c2" strokeDasharray="3 3" />
            <circle cx={x(hover)} cy={y(data[hover].value)} r="5" fill={color} stroke="#fff" strokeWidth="2" />
          </g>
        )}
      </svg>
      {hover != null && (
        <div className="chart-tip" style={{ left: `${(x(hover) / W) * 100}%`, top: `${(y(data[hover].value) / H) * 100}%` }}>
          {data[hover].label}: <strong>{data[hover].value}</strong>
        </div>
      )}
    </div>
  );
}

/** Donut with a centre total and a legend that never relies on colour alone. */
export function Donut({ data, colors }) {
  const [hover, setHover] = useState(null);
  const total = data.reduce((s, d) => s + d.value, 0);
  if (!total) return <p className="muted">No data yet.</p>;
  const R = 62;
  const r = 40;
  let angle = -Math.PI / 2;
  const slices = data
    .filter((d) => d.value > 0)
    .map((d, i) => {
      const a0 = angle;
      const a1 = angle + (d.value / total) * Math.PI * 2;
      angle = a1;
      const large = a1 - a0 > Math.PI ? 1 : 0;
      const p = (rad, a) => [(80 + rad * Math.cos(a)).toFixed(2), (80 + rad * Math.sin(a)).toFixed(2)];
      const single = data.filter((x) => x.value > 0).length === 1;
      const [x0, y0] = p(R, a0);
      const [x1, y1] = p(R, single ? a0 + Math.PI * 1.999 : a1);
      const [x2, y2] = p(r, single ? a0 + Math.PI * 1.999 : a1);
      const [x3, y3] = p(r, a0);
      return {
        ...d,
        color: colors?.[d.label] || SERIES[i % SERIES.length],
        path: `M${x0} ${y0} A${R} ${R} 0 ${single ? 1 : large} 1 ${x1} ${y1} L${x2} ${y2} A${r} ${r} 0 ${single ? 1 : large} 0 ${x3} ${y3} Z`,
      };
    });
  const active = hover != null ? slices[hover] : null;
  return (
    <div className="donut-wrap">
      <svg viewBox="0 0 160 160" width="170" height="170" role="img" aria-label="Donut chart">
        {slices.map((s, i) => (
          <path
            key={s.label}
            d={s.path}
            fill={s.color}
            stroke="#fff"
            strokeWidth="2"
            opacity={hover == null || hover === i ? 1 : 0.5}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <title>{`${s.label}: ${s.value} (${Math.round((s.value / total) * 100)}%)`}</title>
          </path>
        ))}
        <text x="80" y="78" textAnchor="middle" fontSize="22" fontWeight="800" fill="#0b1f3a">{active ? active.value : total}</text>
        <text x="80" y="95" textAnchor="middle" fontSize="9.5" fill={INK}>{active ? `${Math.round((active.value / total) * 100)}%` : 'total'}</text>
      </svg>
      <div className="donut-legend">
        {slices.map((s) => (
          <div key={s.label}>
            <span className="legend-dot" style={{ background: s.color }} />
            <span>{s.label}</span>
            <strong className="mono">{s.value}</strong>
            <span className="muted small">({Math.round((s.value / total) * 100)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}
