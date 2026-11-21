import React, { memo, useEffect, useRef, useState } from 'react';
import {
  Activity, BarChart3, Hash, Layers, Plus, PieChart, Settings2, Sparkles, Table2, TrendingUp, X
} from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart as RePieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import './free-charts.css';
import { ResizeHandle } from './Movable.jsx';

export const CHART_TYPES = [
  { id: 'line', label: 'Line graph', icon: TrendingUp },
  { id: 'bar', label: 'Bar graph', icon: BarChart3 },
  { id: 'donut', label: 'Donut', icon: PieChart },
  { id: 'histogram', label: 'Histogram', icon: Layers },
  { id: 'boxplot', label: 'Box plot', icon: Activity },
  { id: 'card', label: 'Card (single value)', icon: Hash },
  { id: 'table', label: 'Table', icon: Table2 },
];
const AGGS = [['sum', 'Sum'], ['avg', 'Average'], ['count', 'Count'], ['min', 'Minimum'], ['max', 'Maximum']];
const TYPES_WITH_X = ['line', 'bar', 'donut', 'boxplot'];
const TYPES_WITH_AGG = ['bar', 'donut', 'card'];
const WIDTHS = [300, 380, 520, 680];
const PALETTE = ['#7168e8', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6', '#ec4899'];
// Lighten a #rrggbb colour toward white by `amount` (0–1). Used for donut slices of a custom colour.
const shadeOf = (hex, amount) => {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c) => Math.round(c + (255 - c) * amount);
  return `rgb(${mix((n >> 16) & 255)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`;
};
const GRID_MIN = 4;
const GRID_MAX = 100;
const GRID_DEFAULT = 20;
// Snap a value to the nearest grid line (no snapping when size is 0).
const snapTo = (v, g) => Math.round(g ? Math.round(v / g) * g : v);
// Keep a position inside [0, max], on a grid line when snapping is on.
const fitTo = (v, max, g) => Math.max(0, Math.min(v, g ? Math.floor(max / g) * g : max));

export const sourceKey = (s) => (s.kind === 'current' ? 'current'
  : s.kind === 'dataset' ? `ds:${s.datasetId}`
  : `tb:${s.connectionId || ''}|${s.table}`);

const isBlank = (v) => v === null || v === undefined || v === '';
const isNum = (v) => !isBlank(v) && Number.isFinite(Number(v));
const roundTo = (v) => Math.round(v * 100) / 100;

export function columnsOf(rows) {
  // Union of keys across all rows: stacked dataset sources can have different columns.
  const keySet = new Set();
  rows.forEach((r) => Object.keys(r).forEach((k) => keySet.add(k)));
  const keys = [...keySet];
  const numeric = [];
  const categorical = [];
  keys.forEach((key) => {
    const vals = rows.map((r) => r[key]).filter((v) => !isBlank(v));
    const share = vals.length ? vals.filter(isNum).length / vals.length : 0;
    (share >= 0.8 ? numeric : categorical).push(key);
  });
  return { keys, numeric, categorical };
}

function aggregate(values, agg) {
  if (agg === 'count') return values.filter((v) => !isBlank(v)).length;
  const nums = values.filter(isNum).map(Number);
  if (!nums.length) return null;
  if (agg === 'avg') return nums.reduce((a, b) => a + b, 0) / nums.length;
  if (agg === 'min') return nums.reduce((a, b) => (b < a ? b : a));
  if (agg === 'max') return nums.reduce((a, b) => (b > a ? b : a));
  return nums.reduce((a, b) => a + b, 0);
}

function groupRows(rows, xKey, yKey, agg) {
  const groups = new Map();
  rows.forEach((r) => {
    const k = isBlank(r[xKey]) ? '—' : String(r[xKey]);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r[yKey]);
  });
  return [...groups].map(([name, vals]) => ({ name, value: aggregate(vals, agg) ?? 0 }));
}

export function histogramBins(rows, key, count = 10) {
  const nums = rows.map((r) => r[key]).filter(isNum).map(Number);
  if (!nums.length) return [];
  const min = nums.reduce((a, b) => (b < a ? b : a));
  const max = nums.reduce((a, b) => (b > a ? b : a));
  const width = (max - min) / count || 1;
  const bins = Array.from({ length: count }, (_, i) => ({ name: `${roundTo(min + i * width)}–${roundTo(min + (i + 1) * width)}`, count: 0 }));
  nums.forEach((n) => { bins[Math.min(count - 1, Math.floor((n - min) / width))].count += 1; });
  return bins;
}

function quantile(sorted, q) {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export function boxStats(rows, key) {
  const nums = rows.map((r) => r[key]).filter(isNum).map(Number).sort((a, b) => a - b);
  if (!nums.length) return null;
  return { min: nums[0], q1: quantile(nums, 0.25), median: quantile(nums, 0.5), q3: quantile(nums, 0.75), max: nums[nums.length - 1], n: nums.length };
}

// Vertical box plots: values on the Y axis, one box per category on the X axis.
function BoxPlot({ groups, color, tick, grid }) {
  const W = 320;
  const H = 200;
  const padL = 34;
  const padR = 10;
  const top = 12;
  const bottom = H - 30;
  const all = groups.flatMap((g) => [g.stats.min, g.stats.max]);
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const span = hi - lo || 1;
  const y = (v) => bottom - ((v - lo) / span) * (bottom - top);
  const slot = (W - padL - padR) / groups.length;
  const bw = Math.min(44, slot * 0.6);
  const ticks = [lo, (lo + hi) / 2, hi];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" role="img" aria-label="Box plot">
      {ticks.map((v) => (
        <g key={v}>
          <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke={grid} strokeDasharray="3 5" />
          <text x={padL - 4} y={y(v) + 4} fontSize={10} fill={tick} textAnchor="end">{roundTo(v)}</text>
        </g>
      ))}
      {groups.map((g, i) => {
        const s = g.stats;
        const cx = padL + slot * (i + 0.5);
        return (
          <g key={`${g.name}-${i}`}>
            <title>{`${g.name ? g.name + ': ' : ''}min ${roundTo(s.min)}, median ${roundTo(s.median)}, max ${roundTo(s.max)}, n = ${s.n}`}</title>
            <line x1={cx} x2={cx} y1={y(s.max)} y2={y(s.min)} stroke={tick} strokeWidth={1.5} />
            <line x1={cx - bw / 4} x2={cx + bw / 4} y1={y(s.max)} y2={y(s.max)} stroke={tick} strokeWidth={1.5} />
            <line x1={cx - bw / 4} x2={cx + bw / 4} y1={y(s.min)} y2={y(s.min)} stroke={tick} strokeWidth={1.5} />
            <rect x={cx - bw / 2} y={y(s.q3)} width={bw} height={Math.max(2, y(s.q1) - y(s.q3))} fill={color} fillOpacity={0.25} stroke={color} strokeWidth={2} />
            <line x1={cx - bw / 2} x2={cx + bw / 2} y1={y(s.median)} y2={y(s.median)} stroke={color} strokeWidth={3} />
            {g.name && <text x={cx} y={H - 10} fontSize={10} fill={tick} textAnchor="middle">{g.name.length > 12 ? `${g.name.slice(0, 11)}…` : g.name}</text>}
          </g>
        );
      })}
    </svg>
  );
}

// Columns a table chart shows: the saved selection (in dataset order), or every column when none is saved.
function tableColumns(rows, selected) {
  const all = Object.keys(rows[0] || {});
  if (!Array.isArray(selected)) return all;
  const picked = all.filter((k) => selected.includes(k));
  return picked;
}

// Only re-renders when its data or settings change, or when the refresh tick changes (see the sidebar refresh interval).
function ChartBodyView({ type, rows, xKey, yKey, agg, theme, t, columns, refreshTick, customColor }) {
  if (!rows.length) return <p className="fc-empty">{t('No data to show.')}</p>;
  if (type === 'table') {
    const keys = tableColumns(rows, columns);
    if (!keys.length) return <p className="fc-empty">{t('Choose a column to show.')}</p>;
    return (
      <div className="fc-table-scroll">
        <table className="fc-table">
          <thead><tr>{keys.map((k) => <th key={k}>{k.replace(/_/g, ' ')}</th>)}</tr></thead>
          <tbody>
            {rows.map((r, i) => <tr key={i}>{keys.map((k) => <td key={k}>{typeof r[k] === 'number' ? r[k].toLocaleString(undefined, { maximumFractionDigits: 2 }) : String(r[k] ?? '')}</td>)}</tr>)}
          </tbody>
        </table>
      </div>
    );
  }
  if (!yKey) return <p className="fc-empty">{t('Choose a value column.')}</p>;
  // A chart's own colour wins; otherwise it follows the page theme.
  const color = customColor || theme.primary;
  const tick = theme.tick;
  const grid = theme.grid;
  const axisProps = { axisLine: false, tickLine: false, tick: { fill: tick, fontSize: 11 } };

  if (type === 'line') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={grid} strokeDasharray="3 5" />
          <XAxis dataKey={xKey || undefined} {...axisProps} />
          <YAxis {...axisProps} />
          <Tooltip />
          <Line type="monotone" dataKey={yKey} stroke={color} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    );
  }
  if (type === 'histogram') {
    const bins = histogramBins(rows, yKey);
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={bins} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={grid} strokeDasharray="3 5" />
          <XAxis dataKey="name" {...axisProps} tick={{ fill: tick, fontSize: 9 }} />
          <YAxis {...axisProps} />
          <Tooltip />
          <Bar dataKey="count" name={t('Count')} fill={color} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  }
  if (type === 'boxplot') {
    let groups;
    if (xKey) {
      const map = new Map();
      rows.forEach((r) => {
        const k = isBlank(r[xKey]) ? '—' : String(r[xKey]);
        if (!map.has(k)) map.set(k, []);
        map.get(k).push(r);
      });
      groups = [...map].map(([name, rs]) => ({ name, stats: boxStats(rs, yKey) })).filter((g) => g.stats);
    } else {
      groups = [{ name: '', stats: boxStats(rows, yKey) }].filter((g) => g.stats);
    }
    return groups.length
      ? <BoxPlot groups={groups} color={color} tick={tick} grid={grid} />
      : <p className="fc-empty">{t('No numeric values.')}</p>;
  }
  if (type === 'card') {
    const value = aggregate(rows.map((r) => r[yKey]), agg);
    const label = AGGS.find(([v]) => v === agg)?.[1] || 'Sum';
    return (
      <div className="fc-card-value">
        <b style={customColor ? { color: customColor } : undefined}>{value === null ? '—' : Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}</b>
        <span>{t(label)} · {yKey.replace(/_/g, ' ')}</span>
      </div>
    );
  }
  if (!xKey) return <p className="fc-empty">{t('Choose a category column.')}</p>;
  const data = groupRows(rows, xKey, yKey, agg);
  if (type === 'donut') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <RePieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="85%" paddingAngle={2}>
            {data.map((_, i) => <Cell key={i} fill={customColor ? shadeOf(customColor, Math.min(0.6, i * 0.14)) : PALETTE[i % PALETTE.length]} />)}
          </Pie>
          <Tooltip />
          <Legend />
        </RePieChart>
      </ResponsiveContainer>
    );
  }
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={grid} strokeDasharray="3 5" />
        <XAxis dataKey="name" {...axisProps} />
        <YAxis {...axisProps} />
        <Tooltip />
        <Bar dataKey="value" name={yKey} fill={color} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

const ChartBody = memo(ChartBodyView);

// Free-form canvas: click "New chart", pick a type, then click where it should appear.
// "New chart" button for the page heading. Picking a type starts placement on the canvas.
export function NewChartButton({ onPick, t }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="fc-add">
      <button className="primary-btn heading-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open}><Plus size={17} /> {t('New chart')}</button>
      {open && (
        <div className="fc-menu" role="menu">
          {CHART_TYPES.map((ct) => {
            const Icon = ct.icon;
            return <button key={ct.id} role="menuitem" onClick={() => { onPick(ct.id); setOpen(false); }}><Icon size={15} /> {t(ct.label)}</button>;
          })}
        </div>
      )}
    </div>
  );
}

// Built-in dashboard charts. They are seeded once per user as ordinary charts,
// so they can be configured, analyzed with AI and deleted like any new chart.
const DEFAULT_CHARTS = [
  { type: 'card', title: 'Total', agg: 'sum', x: 0, y: 0, w: 300 },
  { type: 'card', title: 'Average', agg: 'avg', x: 320, y: 0, w: 300 },
  { type: 'card', title: 'Maximum', agg: 'max', x: 640, y: 0, w: 300 },
  { type: 'line', title: 'Trend over time', agg: 'sum', x: 0, y: 150, w: 680, h: 380 },
];

export default function FreeChartCanvas({ storageKey, sourceOptions, loadSourceRows, dataVersion = '', refreshTick = 0, currentRows, chartTheme, t, placing, setPlacing, onAnalyze, onSummaries }) {
  const [charts, setCharts] = useState(() => {
    let stored = [];
    try { stored = JSON.parse(localStorage.getItem(storageKey) || '[]'); } catch { stored = []; }
    const seedFlag = `${storageKey}:defaults-v1`;
    if (localStorage.getItem(seedFlag)) return stored;
    try { localStorage.setItem(seedFlag, '1'); } catch { /* storage unavailable */ }
    const seeded = DEFAULT_CHARTS.map((c, i) => ({ id: `builtin-${i}`, source: { kind: 'current' }, xKey: '', yKey: '', ...c }));
    return [...seeded, ...stored];
  });
  const [cache, setCache] = useState({});
  const [loadErrors, setLoadErrors] = useState({});
  const [editingId, setEditingId] = useState('');
  const requested = useRef(new Set());
  const canvasRef = useRef(null);
  const dragRef = useRef(null);
  const gridKey = `${storageKey}:grid`;
  const [grid, setGrid] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(gridKey) || '{}');
      return { on: !!saved.on, size: Math.min(GRID_MAX, Math.max(GRID_MIN, Number(saved.size) || GRID_DEFAULT)) };
    } catch { return { on: false, size: GRID_DEFAULT }; }
  });
  // Grid size used for snapping; 0 means snapping is off.
  const gridSize = grid.on ? grid.size : 0;

  useEffect(() => {
    try { localStorage.setItem(gridKey, JSON.stringify(grid)); } catch { /* storage unavailable */ }
  }, [grid, gridKey]);

  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(charts)); } catch { /* storage unavailable */ }
  }, [charts, storageKey]);

  // When the saved datasets change (saved, edited or deleted), drop their cached rows so they reload.
  // Runs before the loader below, so the loader sees the cleared request set.
  // Also runs on every refresh tick, so saved data sources are fetched again at the chosen interval.
  // Timer refreshes reload silently (no blocking Loading overlay), so Cancel Loading is not undone by them.
  const lastTick = useRef(refreshTick);
  const silentKeys = useRef(new Set());
  useEffect(() => {
    if (refreshTick !== lastTick.current) {
      lastTick.current = refreshTick;
      Object.keys(cache).filter((k) => k.startsWith('ds:')).forEach((k) => silentKeys.current.add(k));
    }
    requested.current = new Set([...requested.current].filter((k) => !k.startsWith('ds:')));
    setCache((c) => Object.fromEntries(Object.entries(c).filter(([k]) => !k.startsWith('ds:'))));
  }, [dataVersion, refreshTick]);

  // Load rows for any chart source that is not loaded yet.
  useEffect(() => {
    charts.forEach((chart) => {
      const key = sourceKey(chart.source);
      if (chart.source.kind === 'current' || cache[key] || requested.current.has(key)) return;
      requested.current.add(key);
      const silent = silentKeys.current.delete(key);
      loadSourceRows(chart.source, silent)
        .then((rows) => setCache((c) => ({ ...c, [key]: rows || [] })))
        .catch((error) => {
          requested.current.delete(key);
          if (error?.name === 'AbortError') return; // cancelled by the user
          setLoadErrors((e) => ({ ...e, [key]: error?.message || true }));
        });
    });
  }, [charts, cache, dataVersion, refreshTick]);

  useEffect(() => {
    if (!placing) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setPlacing(''); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [placing]);

  const rowsFor = (chart) => (chart.source.kind === 'current' ? currentRows : (cache[sourceKey(chart.source)] || []));
  // Column scans walk every row, so cache them per rows array instead of redoing them on every render.
  const columnsCache = useRef(new WeakMap());
  const columnsFor = (rows) => {
    let cols = columnsCache.current.get(rows);
    if (!cols) { cols = columnsOf(rows); columnsCache.current.set(rows, cols); }
    return cols;
  };

  // Compact, plain-data description of each chart, so the AI assistant can analyze one chart at a time.
  const describeChart = (chart) => {
    const rows = rowsFor(chart);
    const cols = columnsFor(rows);
    const xKey = cols.keys.includes(chart.xKey) ? chart.xKey : (cols.categorical[0] || cols.keys[0] || '');
    const yKey = cols.numeric.includes(chart.yKey) ? chart.yKey : (cols.numeric[0] || '');
    const agg = chart.agg || 'sum';
    const option = sourceOptions.find((o) => sourceKey(o.source) === sourceKey(chart.source));
    const info = {
      id: chart.id,
      title: chart.title || CHART_TYPES.find((ct) => ct.id === chart.type)?.label || chart.type,
      type: chart.type,
      source: option ? option.label : 'Current data',
      xColumn: xKey || null,
      valueColumn: yKey || null,
      calculation: agg,
      rowCount: rows.length,
    };
    if (chart.type === 'table') return { ...info, columns: tableColumns(rows, chart.columns), sampleRows: rows.slice(0, 100) };
    if (!rows.length || !yKey) return info;
    if (chart.type === 'card') return { ...info, value: aggregate(rows.map((r) => r[yKey]), agg) };
    if (chart.type === 'histogram') return { ...info, bins: histogramBins(rows, yKey) };
    if (chart.type === 'boxplot') {
      const groupsOf = xKey
        ? [...rows.reduce((m, r) => { const k = isBlank(r[xKey]) ? '—' : String(r[xKey]); m.set(k, [...(m.get(k) || []), r]); return m; }, new Map())]
        : [['all', rows]];
      return { ...info, boxStats: groupsOf.map(([name, rs]) => ({ group: name, ...(boxStats(rs, yKey) || {}) })).slice(0, 50) };
    }
    if (chart.type === 'line') return { ...info, points: rows.slice(0, 200).map((r) => ({ x: xKey ? r[xKey] : null, y: r[yKey] })) };
    if (xKey) return { ...info, groups: groupRows(rows, xKey, yKey, agg).slice(0, 50) };
    return info;
  };

  // Summaries only depend on what the chart shows, not on its position or size.
  // Keying the effect on that avoids recomputing and re-rendering the whole page while dragging.
  const summaryKey = JSON.stringify(charts.map(({ x, y, w, h, ...rest }) => rest));
  useEffect(() => {
    if (onSummaries) onSummaries(charts.map(describeChart));
  }, [summaryKey, cache, currentRows]);
  const update = (id, patch) => setCharts((list) => list.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  // Skip the state update when the position has not changed (common while snapping to the grid).
  const moveChart = (id, x, y) => setCharts((list) => (
    list.some((c) => c.id === id && c.x === x && c.y === y) ? list : list.map((c) => (c.id === id ? { ...c, x, y } : c))
  ));
  const removeChart = (id) => {
    setCharts((list) => list.filter((c) => c.id !== id));
    setEditingId((current) => (current === id ? '' : current));
  };

  const onCanvasClick = (e) => {
    if (!placing) { if (e.target === e.currentTarget) setEditingId(''); return; }
    const rect = canvasRef.current.getBoundingClientRect();
    const width = 380;
    const chart = {
      id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
      type: placing,
      title: '',
      w: width,
      ...(placing === 'table' ? { h: 360 } : {}),
      x: fitTo(snapTo(e.clientX - rect.left, gridSize), rect.width - width, gridSize),
      y: Math.max(0, snapTo(e.clientY - rect.top, gridSize)),
      source: { kind: 'current' },
      xKey: '',
      yKey: '',
      agg: 'sum',
    };
    setCharts((list) => [...list, chart]);
    setPlacing('');
  };

  const startDrag = (e, chart) => {
    if (e.target.closest('button,select,input,textarea')) return;
    const rect = canvasRef.current.getBoundingClientRect();
    dragRef.current = { id: chart.id, dx: e.clientX - rect.left - chart.x, dy: e.clientY - rect.top - chart.y, w: chart.w };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e) => {
    const drag = dragRef.current;
    if (!drag) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = fitTo(snapTo(e.clientX - rect.left - drag.dx, gridSize), rect.width - drag.w, gridSize);
    const y = Math.max(0, snapTo(e.clientY - rect.top - drag.dy, gridSize));
    moveChart(drag.id, x, y);
  };
  const endDrag = () => { dragRef.current = null; };

  const bottom = Math.max(0, ...charts.map((c) => c.y + (c.h || 380)));
  const minHeight = Math.max(460, bottom + 40);

  const renderCard = (chart) => {
    const rows = rowsFor(chart);
    const cols = columnsFor(rows);
    const xKey = cols.keys.includes(chart.xKey) ? chart.xKey : (cols.categorical[0] || cols.keys[0] || '');
    const yKey = cols.numeric.includes(chart.yKey) ? chart.yKey : (cols.numeric[0] || '');
    const agg = chart.agg || 'sum';
    const key = sourceKey(chart.source);
    const option = sourceOptions.find((o) => sourceKey(o.source) === key);
    const typeLabel = CHART_TYPES.find((ct) => ct.id === chart.type)?.label || '';
    const loading = chart.source.kind !== 'current' && !cache[key];
    const editing = editingId === chart.id;
    return (
      <article key={chart.id} className={`panel fc-card ${chart.h ? 'sized' : ''}`} style={{ left: chart.x, top: chart.y, width: chart.w, height: chart.h || undefined }} onPointerDown={(e) => startDrag(e, chart)}>
        <div className="fc-head">
          <div className="fc-title">
            <b>{chart.title || t(typeLabel)}</b>
            <small>{option ? option.label : t('Current data')}</small>
          </div>
          <button className="icon-btn" aria-label={t('Analyze with AI')} title={t('Analyze with AI')} onClick={() => onAnalyze && onAnalyze(chart.id)}><Sparkles size={14} /></button>
          <button className="icon-btn" aria-label={t('Chart settings')} onClick={() => setEditingId(editing ? '' : chart.id)}><Settings2 size={14} /></button>
          <button className="icon-btn" aria-label={t('Delete chart')} onClick={() => removeChart(chart.id)}><X size={14} /></button>
        </div>
        {editing && (
          <div className="fc-settings">
            <label>{t('Type')}
              <select value={chart.type} onChange={(e) => update(chart.id, { type: e.target.value })}>
                {CHART_TYPES.map((ct) => <option key={ct.id} value={ct.id}>{t(ct.label)}</option>)}
              </select>
            </label>
            <label>{t('Data')}
              <select value={key} onChange={(e) => {
                const o = sourceOptions.find((x) => sourceKey(x.source) === e.target.value);
                if (o) update(chart.id, { source: o.source, xKey: '', yKey: '' });
              }}>
                {sourceOptions.map((o) => <option key={sourceKey(o.source)} value={sourceKey(o.source)}>{o.label}</option>)}
              </select>
              {loadErrors[key] && !cache[key] && <small style={{ color: '#ef4444' }}>{typeof loadErrors[key] === 'string' ? loadErrors[key] : t('Could not load this data. Check the server and try again.')}</small>}
            </label>
            {TYPES_WITH_X.includes(chart.type) && (
              <label>{t('Category (X)')}
                <select value={xKey} onChange={(e) => update(chart.id, { xKey: e.target.value })}>
                  {cols.keys.map((k) => <option key={k} value={k}>{k.replace(/_/g, ' ')}</option>)}
                </select>
              </label>
            )}
            <label>{t('Value (Y)')}
              <select value={yKey} onChange={(e) => update(chart.id, { yKey: e.target.value })}>
                {cols.numeric.map((k) => <option key={k} value={k}>{k.replace(/_/g, ' ')}</option>)}
              </select>
            </label>
            {chart.type === 'table' && (
              <div className="fc-table-cols">
                <span>{t('Columns')}</span>
                {Object.keys(rows[0] || {}).map((k) => {
                  const shown = tableColumns(rows, chart.columns).includes(k);
                  return (
                    <label key={k}>
                      <input type="checkbox" checked={shown} onChange={() => {
                        const current = tableColumns(rows, chart.columns);
                        const next = shown ? current.filter((c) => c !== k) : [...current, k];
                        update(chart.id, { columns: Object.keys(rows[0] || {}).filter((c) => next.includes(c)) });
                      }} />
                      {k.replace(/_/g, ' ')}
                    </label>
                  );
                })}
                <button type="button" className="text-action" onClick={() => update(chart.id, { columns: null })}>{t('Show all')}</button>
              </div>
            )}
            {TYPES_WITH_AGG.includes(chart.type) && (
              <label>{t('Calculation')}
                <select value={agg} onChange={(e) => update(chart.id, { agg: e.target.value })}>
                  {AGGS.map(([v, l]) => <option key={v} value={v}>{t(l)}</option>)}
                </select>
              </label>
            )}
            <label>{t('Width')}
              <select value={chart.w} onChange={(e) => update(chart.id, { w: Number(e.target.value) })}>
                {WIDTHS.map((w) => <option key={w} value={w}>{w}px</option>)}
              </select>
            </label>
            <div className="fc-color-field" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span>{t('Chart color')}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="color" aria-label={t('Chart color')} value={chart.color || chartTheme.primary} onChange={(e) => update(chart.id, { color: e.target.value })} style={{ width: 44, height: 28, padding: 0, border: 'none', background: 'none', cursor: 'pointer' }} />
                {chart.color
                  ? <button type="button" className="text-action" onClick={() => update(chart.id, { color: undefined })}>{t('Use theme color')}</button>
                  : <small>{t('Follows page theme')}</small>}
              </span>
            </div>
            <label style={{ gridColumn: '1 / -1' }}>{t('Title')}
              <input value={chart.title} maxLength={60} placeholder={t(typeLabel)} onChange={(e) => update(chart.id, { title: e.target.value })} />
            </label>
          </div>
        )}
        <div className="fc-body">
          {loading
            ? <p className="fc-empty">{t('Loading data…')}</p>
            : <ChartBody type={chart.type} rows={rows} xKey={xKey} yKey={yKey} agg={agg} theme={chartTheme} t={t} columns={chart.columns} refreshTick={refreshTick} customColor={chart.color} />}
        </div>
        <ResizeHandle minW={240} minH={160} onResize={(w, h) => update(chart.id, { w: Math.max(240, snapTo(w, gridSize)), h: Math.max(160, snapTo(h, gridSize)) })} />
      </article>
    );
  };

  return (
    <section className="free-charts" aria-label={t('Charts')}>
      {placing && (
        <div className="fc-hint">
          <span>{t('Click on the canvas where the chart should go. Press Esc to cancel.')}</span>
          <button onClick={() => setPlacing('')}>{t('Cancel')}</button>
        </div>
      )}
      <div className="fc-grid-bar">
        <label className="fc-grid-toggle">
          <input type="checkbox" checked={grid.on} onChange={(e) => setGrid((g) => ({ ...g, on: e.target.checked }))} />
          {t('Show grid')}
        </label>
        <label className="fc-grid-size">
          {t('Grid size')}
          <input type="range" min={GRID_MIN} max={GRID_MAX} step={1} value={grid.size} onChange={(e) => setGrid((g) => ({ ...g, size: Number(e.target.value) }))} />
          <output>{grid.size}px</output>
        </label>
        {grid.on && <small>{t('Charts snap to the grid')}</small>}
      </div>
      {charts.length === 0 && <p className="fc-empty-canvas">{t('No charts yet. Choose New chart, then click where it should appear.')}</p>}
      {/* Keeps room in the page for charts placed low on the canvas. */}
      <div className="fc-spacer" style={{ height: minHeight }} />
      {/* Overlay covering the whole page content so custom charts can sit anywhere, including over the current charts. */}
      <div
        ref={canvasRef}
        className={`fc-canvas ${placing ? 'fc-placing' : ''}`}
        style={gridSize ? {
          backgroundImage: 'linear-gradient(to right, rgba(113,104,232,0.18) 1px, transparent 1px), linear-gradient(to bottom, rgba(113,104,232,0.18) 1px, transparent 1px)',
          backgroundSize: `${gridSize}px ${gridSize}px`,
        } : undefined}
        onClick={onCanvasClick}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
      >
        {charts.map(renderCard)}
      </div>
    </section>
  );
}
