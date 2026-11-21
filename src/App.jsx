import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import {
  Activity, ArrowDownRight, ArrowUpRight, BarChart3, Bell, Bot, CalendarDays,
  Check, ChevronDown, ChevronRight, CircleHelp, CloudUpload, Database, FileSpreadsheet, LockKeyhole,
  FileText, Filter, LayoutDashboard, Link2, LoaderCircle, LogOut, Menu, MessageSquareText,
  MoreHorizontal, Paperclip, Plus, Search, Send, Settings2, ShieldCheck, Sparkles, Table2, TrendingUp,
  Upload, X, Zap, Minus, Palette, RotateCcw, Type, PanelLeftClose, PanelLeftOpen, Pencil, Star, RefreshCw
} from 'lucide-react';
import { apiRequest, cancelAllLoads, getLoadCount, subscribeLoads } from './Auth.jsx';
import './datasets.css';
import './dataset-links.css';
import './load-overlay.css';
import userManualEn from '../docs/user-manual.md?raw';
import userManualTh from '../docs/user-manual.th.md?raw';
import { renderMarkdown, manualStyles } from './markdown-lite.js';
import { getLang } from './i18n.jsx';

// Opens the user manual in a new browser window, in the language selected in the top bar.
function openUserManual() {
  const isThai = getLang() === 'th';
  const win = window.open('', '_blank');
  if (!win) {
    alert(isThai ? 'กรุณาอนุญาต pop-up สำหรับเว็บไซต์นี้เพื่อเปิดคู่มือผู้ใช้' : 'Allow pop-ups for this site to view the user manual.');
    return;
  }
  const body = renderMarkdown(isThai ? userManualTh : userManualEn);
  const title = isThai ? 'คู่มือผู้ใช้ Insightful' : 'Insightful User Manual';
  win.document.open();
  win.document.write(`<!doctype html><html lang="${isThai ? 'th' : 'en'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>${manualStyles}</style></head><body><main class="manual">${body}</main><script>document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[href^="#"]');if(!a)return;var el=document.getElementById(a.getAttribute('href').slice(1));if(el){e.preventDefault();el.scrollIntoView({behavior:'smooth'});}});</script></body></html>`);
  win.document.close();
}
import { joinDatasetRows, sourceKey, CARDINALITIES } from './datasetJoin.js';
import FreeChartCanvas, { NewChartButton } from './FreeCharts.jsx';
import { Movable } from './Movable.jsx';
import AdminPanel from './AdminPanel.jsx';
import AskFloating from './AskFloating.jsx';
import { LanguageSwitch, translate, useI18n } from './i18n.jsx';
import { THEMES, getTheme, loadAppearance, applyAppearance, saveAppearance, nextScale, DEFAULT_APPEARANCE, MIN_SCALE, MAX_SCALE, SCALE_STEP } from './appearance.js';
import { parseCSV } from './csv.js';
import {
  Area, AreaChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis
} from 'recharts';

const sampleRows = [
  { month: 'Jan', revenue: 38200, orders: 418, visitors: 4920 },
  { month: 'Feb', revenue: 42100, orders: 456, visitors: 5280 },
  { month: 'Mar', revenue: 39800, orders: 432, visitors: 5010 },
  { month: 'Apr', revenue: 51200, orders: 529, visitors: 6120 },
  { month: 'May', revenue: 48700, orders: 506, visitors: 5940 },
  { month: 'Jun', revenue: 56300, orders: 584, visitors: 6780 },
  { month: 'Jul', revenue: 52800, orders: 552, visitors: 6410 },
  { month: 'Aug', revenue: 64100, orders: 665, visitors: 7520 },
  { month: 'Sep', revenue: 61300, orders: 632, visitors: 7290 },
  { month: 'Oct', revenue: 70400, orders: 718, visitors: 8410 },
  { month: 'Nov', revenue: 67800, orders: 694, visitors: 8130 },
  { month: 'Dec', revenue: 82600, orders: 841, visitors: 9620 },
];

const formatCurrency = (value) => `$${(Number(value) / 1000).toFixed(1)}k`;
const formatNumber = (value) => Number(value).toLocaleString();
const parseChartDate = (value) => {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value !== 'string' || !value.trim()) return null;
  const text = value.trim();
  // Parse SQL/ISO datetimes explicitly as local dates. Native Date parsing of
  // "YYYY-MM-DD HH:mm:ss" differs between browsers and can shift date-only data.
  const sqlDate = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2})(?:\.(\d+))?)?)?$/);
  if (sqlDate) {
    const [, yearText, monthText, dayText, hourText = '0', minuteText = '0', secondText = '0', fractionText = '0'] = sqlDate;
    const parts = [yearText, monthText, dayText, hourText, minuteText, secondText].map(Number);
    const [year, month, day, hour, minute, second] = parts;
    const parsed = new Date(year, month - 1, day, hour, minute, second, Number(`0.${fractionText}`) * 1000);
    return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day && parsed.getHours() === hour && parsed.getMinutes() === minute && parsed.getSeconds() === second ? parsed : null;
  }
  // Avoid parsing category labels such as "Jan" as dates.
  if (!/\b\d{4}\b/.test(text)) return null;
  const normalized = text.replace(/^(\d{4}-\d{2}-\d{2})\s+/, '$1T');
  const date = new Date(normalized);
  if (!Number.isNaN(date.getTime())) return date;
  const match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (!match) return null;
  const [, first, second, year] = match;
  const month = Number(first) > 12 ? Number(second) : Number(first);
  const day = Number(first) > 12 ? Number(first) : Number(second);
  const parsed = new Date(Number(year), month - 1, day);
  return parsed.getFullYear() === Number(year) && parsed.getMonth() === month - 1 && parsed.getDate() === day ? parsed : null;
};
const PREVIEW_PAGE_SIZE = 100;

// Compute chart metadata from a given set of rows. Used so each panel can
// independently select a database and derive its own axes, keys, and totals.
function computePanelMetrics(panelRows, preferred = {}) {
  const dataKeys = Object.keys(panelRows[0] || {});
  const numericKeys = dataKeys.filter((key) => panelRows.some((row) => typeof row[key] === 'number' && Number.isFinite(row[key])));
  const guessedPrimary = numericKeys.includes('revenue') ? 'revenue' : numericKeys.find((key) => /revenue|sales|amount|value|total|profit/i.test(key)) || numericKeys[0];
  const primaryKey = preferred.primary && numericKeys.includes(preferred.primary) ? preferred.primary : guessedPrimary;
  const guessedSecondary = numericKeys.find((key) => key !== primaryKey && /order|count|quantity|units/i.test(key)) || numericKeys.find((key) => key !== primaryKey);
  const secondaryKey = preferred.secondary && preferred.secondary !== primaryKey && numericKeys.includes(preferred.secondary) ? preferred.secondary : guessedSecondary;
  const categoryKeys = dataKeys.filter((key) => !numericKeys.includes(key));
  const dateKeys = dataKeys.filter((key) => panelRows.some((row) => parseChartDate(row[key])));
  const total = panelRows.reduce((sum, row) => sum + (Number(row[primaryKey]) || 0), 0);
  const avg = panelRows.length ? Math.round(total / panelRows.length) : 0;
  const latest = panelRows[panelRows.length - 1] || {};
  const previous = panelRows[panelRows.length - 2] || {};
  const monthlyChange = previous[primaryKey] ? Math.round(((latest[primaryKey] / previous[primaryKey]) - 1) * 100) : 0;
  const firstHalf = panelRows.slice(0, Math.max(1, Math.floor(panelRows.length / 2))).reduce((sum, row) => sum + (Number(row[primaryKey]) || 0), 0);
  const secondHalf = panelRows.slice(Math.max(1, Math.floor(panelRows.length / 2))).reduce((sum, row) => sum + (Number(row[primaryKey]) || 0), 0);
  const growth = firstHalf ? Math.round(((secondHalf / firstHalf) - 1) * 100) : 0;
  return { dataKeys, numericKeys, primaryKey, secondaryKey, categoryKeys, dateKeys, total, avg, latest, previous, monthlyChange, growth, firstHalf, secondHalf };
}
// Universal date filter. Applies to every chart, card and table.
const DATE_RANGES = [
  { value: 'all', label: 'All time' },
  { value: 'today', label: 'Today' },
  { value: 'this_week', label: 'This week' },
  { value: 'this_month', label: 'This month' },
  { value: 'last_3_months', label: 'Last 3 months' },
  { value: 'last_6_months', label: 'Last 6 months' },
  { value: 'this_year', label: 'This year' },
  { value: 'custom', label: 'Custom' },
];
// Maximum rows used by charts, cards and the preview table. 'all' = no limit.
const ROW_LIMIT_OPTIONS = ['50', '100', '200', 'all'];
const limitRows = (rows, rowLimit) => (rowLimit === 'all' ? rows : rows.slice(0, Number(rowLimit)));
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const endOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
// Returns [start, end] for a preset (null bound = open), or null for no filter.
function getDateWindow(preset, from, to, now = new Date()) {
  const today = startOfDay(now);
  switch (preset) {
    case 'today': return [today, endOfDay(now)];
    case 'this_week': return [new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((now.getDay() + 6) % 7)), endOfDay(now)];
    case 'this_month': return [new Date(now.getFullYear(), now.getMonth(), 1), endOfDay(now)];
    case 'last_3_months': return [new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()), endOfDay(now)];
    case 'last_6_months': return [new Date(now.getFullYear(), now.getMonth() - 6, now.getDate()), endOfDay(now)];
    case 'this_year': return [new Date(now.getFullYear(), 0, 1), endOfDay(now)];
    case 'custom': return [from ? new Date(`${from}T00:00:00`) : null, to ? new Date(`${to}T23:59:59.999`) : null];
    default: return null;
  }
}
// Picks the timestamp field: a column named "timestamp" if present, else the first date column.
function pickTimestampKey(dateKeys) {
  return dateKeys.find((k) => /^timestamp$/i.test(k)) || dateKeys.find((k) => /timestamp/i.test(k)) || dateKeys[0] || '';
}
function filterRowsByDate(rows, dateKey, preset, from, to) {
  const window = getDateWindow(preset, from, to);
  if (!window || !dateKey) return rows;
  const [start, end] = window;
  if (!start && !end) return rows;
  return rows.filter((row) => {
    const date = parseChartDate(row[dateKey]);
    return date && (!start || date >= start) && (!end || date <= end);
  });
}

// Per-card calculations applied to the (date-filtered) rows.
const AGG_OPTIONS = [
  { value: 'sum', label: 'Sum' },
  { value: 'count', label: 'Count' },
  { value: 'avg', label: 'Average' },
  { value: 'min', label: 'Minimum' },
  { value: 'max', label: 'Maximum' },
  { value: 'latest', label: 'Latest' },
  { value: 'first', label: 'First' },
];
const AGG_LABELS = Object.fromEntries(AGG_OPTIONS.map((o) => [o.value, o.label]));
function aggregateRows(rows, key, agg, dateKey) {
  if (!key) return null;
  const nonEmpty = rows.filter((r) => r[key] !== null && r[key] !== undefined && r[key] !== '');
  const numeric = nonEmpty.map((r) => Number(r[key])).filter((n) => Number.isFinite(n));
  const sum = numeric.reduce((a, b) => a + b, 0);
  switch (agg) {
    case 'count': return nonEmpty.length;
    case 'sum': return sum;
    case 'avg': return numeric.length ? Math.round(sum / numeric.length) : null;
    case 'min': return numeric.length ? numeric.reduce((a, b) => (b < a ? b : a)) : null;
    case 'max': return numeric.length ? numeric.reduce((a, b) => (b > a ? b : a)) : null;
    case 'first':
    case 'latest': {
      if (!nonEmpty.length) return null;
      let pick = agg === 'first' ? nonEmpty[0] : nonEmpty[nonEmpty.length - 1];
      const dated = dateKey ? nonEmpty.filter((r) => parseChartDate(r[dateKey])) : [];
      if (dated.length) {
        dated.sort((a, b) => parseChartDate(a[dateKey]) - parseChartDate(b[dateKey]));
        pick = agg === 'first' ? dated[0] : dated[dated.length - 1];
      }
      const n = Number(pick[key]);
      return Number.isFinite(n) ? n : pick[key];
    }
    default: return sum;
  }
}
function formatCardValue(value, key, agg) {
  if (value === null || value === undefined || (typeof value === 'number' && Number.isNaN(value))) return '—';
  if (typeof value !== 'number') return String(value);
  const money = key && /revenue|sales|amount|value|profit/i.test(key) && agg !== 'count';
  return money ? `$${formatNumber(value)}` : formatNumber(value);
}

function App({ user, onUserUpdate, onLogout }) {
  const { t, lang } = useI18n();
  const [rows, setRows] = useState(sampleRows);
  const [datasetName, setDatasetName] = useState('E-commerce performance');
  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [showConnect, setShowConnect] = useState(false);
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourceType, setSourceType] = useState('Google Sheets');
  const [sourceMessage, setSourceMessage] = useState('');
  const [sourceBusy, setSourceBusy] = useState(false);
  const [sourceTables, setSourceTables] = useState([]);
  const [sourceTable, setSourceTable] = useState('');
  const [sourceResult, setSourceResult] = useState(null);
  const [savedConnections, setSavedConnections] = useState([]);
  const [sourceConnectionId, setSourceConnectionId] = useState('');
  const [connectionName, setConnectionName] = useState('');
  const [sourceVerified, setSourceVerified] = useState(false);
  const [connectionSaveBusy, setConnectionSaveBusy] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [selectedModel, setSelectedModel] = useState('');
  const [serverError, setServerError] = useState('');
  const [activeNav, setActiveNav] = useState('Overview');
  const [range, setRange] = useState('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [rowLimit, setRowLimit] = useState('50');
  // Adds the Max rows setting to a data query so the server returns at most that many rows ('all' = no limit).
  const withRowLimit = (body) => (rowLimit === 'all' ? body : { ...body, limit: Number(rowLimit) });
  const [cardAgg, setCardAgg] = useState({ metricTotal: 'sum', metricAvg: 'avg', metricLatest: 'latest' });
  const [xAxisKey, setXAxisKey] = useState('month');
  const [yAxisKey, setYAxisKey] = useState('');
  const [secondaryAxisKey, setSecondaryAxisKey] = useState('');
  const [showChartOptions, setShowChartOptions] = useState(false);
  const [previewDateKey, setPreviewDateKey] = useState('');
  const [previewFrom, setPreviewFrom] = useState('');
  const [previewTo, setPreviewTo] = useState('');
  const [previewSort, setPreviewSort] = useState('newest');
  const [previewColumns, setPreviewColumns] = useState(null); // null = default (first 5 columns)
  const [showPreviewColumns, setShowPreviewColumns] = useState(false);
  const [previewPage, setPreviewPage] = useState(0);
  const [showPreviewFilters, setShowPreviewFilters] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem('insightful.sidebar') === 'collapsed'; } catch { return false; } });
  useEffect(() => { try { localStorage.setItem('insightful.sidebar', collapsed ? 'collapsed' : 'expanded'); } catch { /* ignore */ } }, [collapsed]);
  const [appearance, setAppearance] = useState(loadAppearance);
  const fileRef = useRef(null);
  const csvFileRef = useRef(null);
  const [csvImportBusy, setCsvImportBusy] = useState(false);
  const [csvTables, setCsvTables] = useState([]);
  const [dbTables, setDbTables] = useState([]);
  const [csvImportResult, setCsvImportResult] = useState(null);
  const [showManageDatasource, setShowManageDatasource] = useState(false);
  const [showDataSources, setShowDataSources] = useState(false);
  const [localDatasets, setLocalDatasets] = useState([]);
  const [convertBusy, setConvertBusy] = useState(false);
  const [convertNames, setConvertNames] = useState({});
  const [convertSourceTable, setConvertSourceTable] = useState('');
  const [convertTargetName, setConvertTargetName] = useState('');
  const [convertResult, setConvertResult] = useState(null);
  const [dsError, setDsError] = useState('');

  // Refresh the imported CSV tables list whenever the manage datasources
  // modal opens, so tables imported earlier (or in another flow) are visible.
  useEffect(() => {
    if (showManageDatasource) {
      loadCsvTables();
    }
  }, [showManageDatasource]);

  // Refresh all data sources (saved connections + imported CSV tables) whenever
  // the data sources modal opens, so the list is always current.
  useEffect(() => {
    if (showDataSources) {
      setConvertResult(null);
      setDsError('');
      loadAllDataSources();
    }
  }, [showDataSources]);

  // Load imported CSV tables on mount so they are available in any modal
  // without needing to re-import. Also refreshed when either modal opens.
  useEffect(() => {
    loadCsvTables();
  }, []);

  // Inline CSV-to-database conversion in the connect modal
  const [convertToDbTable, setConvertToDbTable] = useState('');
  const [convertToDbTargetName, setConvertToDbTargetName] = useState('');
  // Per-panel independent database selections
  const [panelDataSources, setPanelDataSources] = useState({
    chart: { connectionId: '', tableName: '', rows: [], columns: [], busy: false, error: '' },
    metrics: { connectionId: '', tableName: '', rows: [], columns: [], busy: false, error: '' },
    metricTotal: { connectionId: '', tableName: '', rows: [], columns: [], variable: '', busy: false, error: '' },
    metricAvg: { connectionId: '', tableName: '', rows: [], columns: [], variable: '', busy: false, error: '' },
    metricLatest: { connectionId: '', tableName: '', rows: [], columns: [], variable: '', busy: false, error: '' },
    preview: { connectionId: '', tableName: '', rows: [], columns: [], busy: false, error: '' },
  });
  const chartTheme = getTheme(appearance.theme).chart;

  // Charts refresh only on this interval (set in the sidebar), not on every state change.
  const REFRESH_OPTIONS = [10, 15, 30, 45, 60];
  const [refreshSec, setRefreshSec] = useState(() => {
    const saved = Number(localStorage.getItem('insightful.refreshSec'));
    return REFRESH_OPTIONS.includes(saved) ? saved : 30;
  });
  const [refreshTick, setRefreshTick] = useState(0);
  useEffect(() => { try { localStorage.setItem('insightful.refreshSec', String(refreshSec)); } catch { /* storage unavailable */ } }, [refreshSec]);
  useEffect(() => {
    const id = setInterval(() => setRefreshTick((n) => n + 1), refreshSec * 1000);
    return () => clearInterval(id);
  }, [refreshSec]);

  useEffect(() => { applyAppearance(appearance); saveAppearance(appearance); }, [appearance]);
  useEffect(() => {
    if (!showConnect) return;
    apiRequest('/api/data-sources').then((result) => setSavedConnections(result.connections || [])).catch((error) => setSourceMessage(error.message));
  }, [showConnect]);
  const setTheme = (theme) => setAppearance((current) => ({ ...current, theme }));
  const changeScale = (delta) => setAppearance((current) => ({ ...current, scale: nextScale(current.scale, delta) }));

  // Resolve rows for a panel: use the panel's own database data if a connection is selected, otherwise fall back to global rows.
  const resolvePanelRows = (panel) => {
    const ps = panelDataSources[panel];
    return ps.tableName && ps.rows.length > 0 ? ps.rows : rows;
  };

  // Per-panel derived metrics
  const chartPanelRows = resolvePanelRows('chart');
  // Memoized: these scan every row, so they must not rerun on unrelated clicks.
  const chartPanelMetrics = useMemo(
    () => computePanelMetrics(chartPanelRows, { primary: yAxisKey, secondary: secondaryAxisKey }),
    [chartPanelRows, yAxisKey, secondaryAxisKey]
  );
  const metricsPanelRows = resolvePanelRows('metrics');
  const metricsPanelMetrics = useMemo(() => computePanelMetrics(metricsPanelRows), [metricsPanelRows]);
  const previewPanelRows = resolvePanelRows('preview');
  const previewPanelMetrics = useMemo(() => computePanelMetrics(previewPanelRows), [previewPanelRows]);

  const { dataKeys: chartDataKeys, numericKeys: chartNumericKeys, primaryKey: chartPrimaryKey, secondaryKey: chartSecondaryKey, categoryKeys: chartCategoryKeys, dateKeys: chartDateKeys } = chartPanelMetrics;
  const chartXKey = chartDataKeys.includes(xAxisKey) ? xAxisKey : chartCategoryKeys[0] || chartDataKeys[0] || '';
  const chartTimestampKey = pickTimestampKey(chartDateKeys);
  const chartRows = useMemo(
    () => limitRows(filterRowsByDate(chartPanelRows, chartTimestampKey, range, customFrom, customTo), rowLimit),
    [chartPanelRows, chartTimestampKey, range, customFrom, customTo, rowLimit]
  );

  const { dataKeys: previewDataKeys } = previewPanelMetrics;
  const activePreviewDateKey = previewPanelMetrics.dateKeys.includes(previewDateKey) ? previewDateKey : previewPanelMetrics.dateKeys[0] || '';
  const previewTimestampKey = pickTimestampKey(previewPanelMetrics.dateKeys);
  const previewRows = useMemo(() => {
    let filtered = filterRowsByDate(previewPanelRows, previewTimestampKey, range, customFrom, customTo);
    if (activePreviewDateKey && (previewFrom || previewTo)) {
      filtered = filtered.filter((row) => {
        const date = parseChartDate(row[activePreviewDateKey]);
        if (!date) return false;
        const day = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
        const from = previewFrom ? new Date(`${previewFrom}T00:00:00`).getTime() : -Infinity;
        const to = previewTo ? new Date(`${previewTo}T23:59:59.999`).getTime() : Infinity;
        return day >= from && day <= to;
      });
    }
    if (previewSort !== 'none' && activePreviewDateKey) {
      filtered = [...filtered].sort((a, b) => {
        const left = parseChartDate(a[activePreviewDateKey])?.getTime() ?? 0;
        const right = parseChartDate(b[activePreviewDateKey])?.getTime() ?? 0;
        return previewSort === 'newest' ? right - left : left - right;
      });
    }
    return limitRows(filtered, rowLimit);
  }, [previewPanelRows, activePreviewDateKey, previewTimestampKey, previewFrom, previewTo, previewSort, range, customFrom, customTo, rowLimit]);
  const allPreviewColumns = Object.keys(previewPanelRows[0] || {});
  const visiblePreviewColumns = previewColumns
    ? allPreviewColumns.filter((key) => previewColumns.includes(key))
    : allPreviewColumns.slice(0, 5);
  const pageCount = Math.max(1, Math.ceil(previewRows.length / PREVIEW_PAGE_SIZE));
  const visiblePreviewRows = previewRows.slice(previewPage * PREVIEW_PAGE_SIZE, (previewPage + 1) * PREVIEW_PAGE_SIZE);
  // Panel-specific summary metrics (each graph uses its own database data when selected)
  const chartTotal = chartPanelMetrics.total;
  const chartAvg = chartPanelMetrics.avg;
  const chartLatest = chartPanelMetrics.latest;
  const chartPrevious = chartPanelMetrics.previous;
  const chartMonthlyChange = chartPanelMetrics.monthlyChange;
  const chartGrowth = chartPanelMetrics.growth;
  const metricsTotal = metricsPanelMetrics.total;
  const metricsAvg = metricsPanelMetrics.avg;
  const metricsLatest = metricsPanelMetrics.latest;
  const metricsPrevious = metricsPanelMetrics.previous;
  const metricsMonthlyChange = metricsPanelMetrics.monthlyChange;
  const metricsGrowth = metricsPanelMetrics.growth;

  // Each summary card has its own dataset and variable selection.
  // Applies the universal date filter to any card's rows.
  const applyGlobalRange = (rows) => limitRows(filterRowsByDate(rows, pickTimestampKey(computePanelMetrics(rows).dateKeys), range, customFrom, customTo), rowLimit);
  const cardMetrics = (panel) => {
    const cardRows = applyGlobalRange(resolvePanelRows(panel));
    const metrics = computePanelMetrics(cardRows, { primary: panelDataSources[panel].variable });
    const agg = cardAgg[panel] || 'sum';
    const value = aggregateRows(cardRows, metrics.primaryKey, agg, pickTimestampKey(metrics.dateKeys));
    return { rows: cardRows, metrics, value, agg, total: metrics.total, avg: metrics.avg, growth: metrics.growth, monthlyChange: metrics.monthlyChange };
  };
  const setCardDataset = (panel, tn) => {
    const local = localDatasets.find((d) => d.name === tn);
    setPanelDataSources((p) => ({ ...p, [panel]: { ...p[panel], connectionId: '', tableName: tn, rows: local ? (local.rows || []) : [], columns: local && local.rows?.[0] ? Object.keys(local.rows[0]) : [], variable: '', busy: false, error: '' } }));
    if (tn && !local) fetchPanelData(panel, '', tn);
  };
  const cardSelectors = (panel) => {
    const ps = panelDataSources[panel];
    const { metrics: cm } = cardMetrics(panel);
    return (
      <div style={{ display: 'flex', gap: 6, margin: '6px 0' }}>
        <select aria-label={t('Dataset')} style={{ fontSize: 'calc(10px*var(--fs,1))', maxWidth: 150 }} value={ps.tableName} onChange={(e) => setCardDataset(panel, e.target.value)}>
          <option value="">{t('Default dataset')}</option>
          {localDatasets.map((d) => <option key={'local-' + d.name} value={d.name}>{d.name} · {t('Loaded')}</option>)}
          {csvTables.filter((tb) => !localDatasets.some((d) => d.name === tb)).map((tb) => <option key={'csv-' + tb} value={tb}>{tb}</option>)}
          {dbTables.filter((tb) => !localDatasets.some((d) => d.name === tb) && !csvTables.includes(tb)).map((tb) => <option key={'db-' + tb} value={tb}>{tb}</option>)}
        </select>
        <select aria-label={t('Variable')} style={{ fontSize: 'calc(10px*var(--fs,1))', maxWidth: 150 }} value={ps.variable || ''} onChange={(e) => setPanelDataSources((p) => ({ ...p, [panel]: { ...p[panel], variable: e.target.value } }))}>
          <option value="">{t('Auto variable')}</option>
          {cm.numericKeys.map((k) => <option key={k} value={k}>{k.replace(/_/g, ' ')}</option>)}
        </select>
        <select aria-label={t('Calculation')} title={t('Calculation')} style={{ fontSize: 'calc(10px*var(--fs,1))', maxWidth: 150 }} value={cardAgg[panel] || 'sum'} onChange={(e) => setCardAgg((p) => ({ ...p, [panel]: e.target.value }))}>
          {AGG_OPTIONS.map((o) => <option key={o.value} value={o.value}>{t(o.label)}</option>)}
        </select>
      </div>
    );
  };
  const previewTotal = previewPanelMetrics.total;
  const previewLatest = previewPanelMetrics.latest;
  const previewMonthlyChange = previewPanelMetrics.monthlyChange;

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const parsed = parseCSV(await file.text());
      setRows(parsed);
      setDatasetName(file.name.replace(/\.csv$/i, ''));
      { const localName = file.name.replace(/\.csv$/i, ''); setLocalDatasets((list) => [{ name: localName, rowCount: parsed.length, file, rows: parsed }, ...list.filter((item) => item.name !== localName)]); }
      setAnswer('');
      setActiveNav('Overview');
    } catch (error) {
      window.alert(translate(error.message || 'Unable to read this file. Please try a CSV.'));
    }
    event.target.value = '';
  };

  const importCsvFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) { window.alert(t('Please select a CSV file.')); return; }
    setCsvImportBusy(true); setSourceMessage(''); setCsvImportResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const result = await apiRequest('/api/data-sources/csv/import', { method: 'POST', body: formData });
      setCsvImportResult(result);
      setSourceMessage(result.message || t('CSV imported successfully.'));
      await refreshDataSourceViews();
    } catch (error) {
      setSourceMessage(error.message || t('Failed to import CSV file.'));
    } finally {
      setCsvImportBusy(false);
      event.target.value = '';
    }
  };

  const loadCsvTables = async () => {
    try {
      const result = await apiRequest('/api/data-sources/csv/tables');
      setCsvTables(result.tables || []);
      setDbTables(result.databases || []);
    } catch (error) { setSourceMessage(error.message || t('Failed to list CSV tables.')); setDsError(error.message || t('Failed to list CSV tables.')); }
  };

  const loadAllDataSources = async () => {
    try {
      await loadCsvTables();
      const result = await apiRequest('/api/data-sources');
      setSavedConnections(result.connections || []);
      setDsError('');
    } catch (error) { setDsError(error.message || t('Failed to load data sources.')); }
  };

  const loadCsvTable = async (table) => {
    if (!table) return;
    setSourceBusy(true); setSourceMessage(''); setCsvImportResult(null);
    try {
      const result = await apiRequest(`/api/data-sources/csv/${encodeURIComponent(table)}`);
      setSourceResult(result);
      setSourceMessage(`${result.rowCount} ${t('rows loaded from')} "${result.table}".`);
    } catch (error) {
      setSourceMessage(error.message || t('Failed to load CSV table.'));
    } finally {
      setSourceBusy(false);
    }
  };

  const convertCsvToDatabase = async (sourceTable, targetName) => {
    if (!sourceTable || !targetName || convertBusy) return;
    setConvertBusy(true); setConvertResult(null);
    try {
      const result = await apiRequest(`/api/data-sources/csv/${encodeURIComponent(sourceTable)}/convert`, {
        method: 'POST',
        body: JSON.stringify({ targetTableName: targetName }),
      });
      setConvertResult(result);
      setSourceMessage(result.message || t('CSV table converted to database.'));
      await loadCsvTables();
    } catch (error) {
      setConvertResult(null);
      setSourceMessage(error.message || t('Failed to convert CSV table to database.'));
    } finally {
      setConvertBusy(false);
    }
  };

  const localTableName = (name) => 'csv_' + (name.replace(/[^A-Za-z0-9_]+/g, '_').replace(/^_+|_+$/g, '') || 'import');
  const convertItem = async (item) => {
    if (convertBusy) return;
    const key = item.table || item.name;
    const target = (convertNames[key] ?? (item.table || localTableName(item.name)).replace(/^csv_/i, '')).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(target) || /^csv_/i.test(target)) { setConvertResult({ message: t('Use letters, numbers and underscores, not starting with a digit or "csv_".'), error: true }); return; }
    setConvertBusy(true); setConvertResult(null); setConvertSourceTable(key);
    try {
      let sourceTable = item.table;
      if (!sourceTable) {
        const formData = new FormData();
        formData.append('file', item.file, item.name + '.csv');
        const imported = await apiRequest('/api/data-sources/csv/import', { method: 'POST', body: formData });
        sourceTable = imported.table;
      }
      const result = await apiRequest('/api/data-sources/csv/' + encodeURIComponent(sourceTable) + '/convert', { method: 'POST', body: JSON.stringify({ targetTableName: target }) });
      setConvertResult(result);
      await refreshDataSourceViews();
    } catch (error) {
      setConvertResult({ message: error.message || t('Failed to convert CSV table to database.'), error: true });
    } finally {
      setConvertBusy(false); setConvertSourceTable('');
    }
  };

  // Emergency stop: aborts every in-flight data load tracked by apiRequest.
  const isAbortError = (error) => error?.name === 'AbortError';
  const stopLoading = () => {
    cancelAllLoads();
    setPanelDataSources((prev) => Object.fromEntries(Object.entries(prev).map(([panel, ps]) => [panel, { ...ps, busy: false, error: '' }])));
    setDatasetMessage(t('Data loading stopped.'));
  };
  // Overlay: shown while any tracked load runs (after a 300 ms grace period to avoid flicker).
  const loadCount = useSyncExternalStore(subscribeLoads, getLoadCount);
  const loading = loadCount > 0;
  const [overlayOn, setOverlayOn] = useState(false);
  useEffect(() => {
    if (!loading) { setOverlayOn(false); return undefined; }
    const id = setTimeout(() => setOverlayOn(true), 300);
    return () => clearTimeout(id);
  }, [loading]);

  const fetchPanelData = async (panel, connectionId, tableName) => {
    setPanelDataSources((prev) => ({ ...prev, [panel]: { ...prev[panel], busy: true, error: '' } }));
    try {
      const result = await apiRequest('/api/data-sources/inspect', {
        method: 'POST',
        body: JSON.stringify(withRowLimit(connectionId ? { connectionId, table: tableName } : { type: 'csv', table: tableName })),
      });
      const normalizedRows = (result.rows || []).map((row) =>
        Object.fromEntries(Object.entries(row).map(([key, value]) => [
          key,
          typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value)) ? Number(value) : value,
        ]))
      );
      setPanelDataSources((prev) => ({
        ...prev,
        [panel]: {
          connectionId,
          tableName,
          rows: normalizedRows,
          columns: result.columns || [],
          busy: false,
          error: '',
        },
      }));
      return normalizedRows;
    } catch (error) {
      if (isAbortError(error)) return []; // stopLoading already reset the panel
      setPanelDataSources((prev) => ({
        ...prev,
        [panel]: { ...prev[panel], busy: false, error: error.message || t('Failed to load data from this database.') },
      }));
      return [];
    }
  };

  const [chartSummaries, setChartSummaries] = useState([]);
  const [focusChartId, setFocusChartId] = useState('');
  const focusedChart = chartSummaries.find((c) => c.id === focusChartId) || null;

  const submitAnalysis = async (text = query) => {
    if (!text.trim() || busy) return;
    setBusy(true);
    setServerError('');
    setAnswer('');
    setQuery('');
    try {
      const result = await apiRequest('/api/ai/analyze', {
        method: 'POST',
        body: JSON.stringify({ prompt: text.trim(), rows, datasetName, lang, ...(focusedChart ? { chart: focusedChart } : {}), ...(selectedModel ? { model: selectedModel } : {}) }),
      });
      setAnswer(result.answer);
      setSelectedModel(result.model);
    } catch (error) {
      setServerError(error.message);
      setQuery(text);
    } finally {
      setBusy(false);
    }
  };

  const connectSource = async (event) => {
    event.preventDefault();
    const link = sourceUrl.trim();
    if (sourceType === 'CSV file') {
      setSourceMessage(t('Use the CSV file import below to upload and convert a CSV file to a database table.'));
      return;
    }
    if (!sourceConnectionId && !link) { setSourceMessage(t('Enter a link or connection details to continue.')); return; }
    if (!['PostgreSQL', 'MySQL'].includes(sourceType)) {
      setSourceMessage(t('This data source is not connected yet. Choose PostgreSQL or MySQL to query a database.'));
      return;
    }
    setSourceBusy(true);
    setSourceMessage('');
    setSourceResult(null);
    try {
      const result = await apiRequest('/api/data-sources/inspect', {
        method: 'POST',
        body: JSON.stringify(sourceConnectionId ? { connectionId: sourceConnectionId, ...(sourceTable ? { table: sourceTable } : {}) } : { type: sourceType === 'PostgreSQL' ? 'postgresql' : 'mysql', connectionUrl: link, ...(sourceTable ? { table: sourceTable } : {}) }),
      });
      setSourceTables(result.tables || []);
      setSourceVerified(true);
      setSourceResult(result.table ? result : null);
      if (!result.table) setSourceMessage(`${result.message} ${result.tables.length} ${t('tables found. Select one to load a preview.')}`);
      else setSourceMessage(`${result.message} ${result.rows.length} ${t('rows loaded from')} ${result.table}.`);
    } catch (error) {
      setSourceMessage(error.message);
      setSourceResult(null);
    } finally {
      setSourceBusy(false);
    }
  };

  const loadSourceTable = async () => {
    if (!sourceTable || sourceBusy) return;
    setSourceBusy(true);
    setSourceMessage('');
    setSourceResult(null);
    try {
      const result = await apiRequest('/api/data-sources/inspect', {
        method: 'POST',
        body: JSON.stringify(withRowLimit(sourceConnectionId ? { connectionId: sourceConnectionId, table: sourceTable } : { type: sourceType === 'PostgreSQL' ? 'postgresql' : 'mysql', connectionUrl: sourceUrl.trim(), table: sourceTable })),
      });
      setSourceResult(result);
      setSourceMessage(`${result.rows.length} ${t('rows loaded from')} ${result.table}.`);
    } catch (error) {
      setSourceMessage(error.message);
    } finally {
      setSourceBusy(false);
    }
  };

  const saveSourceConnection = async () => {
    if (!sourceVerified || sourceConnectionId || connectionSaveBusy) return;
    setConnectionSaveBusy(true);
    setSourceMessage('');
    try {
      const result = await apiRequest('/api/data-sources', {
        method: 'POST',
        body: JSON.stringify({ name: connectionName.trim() || `${sourceType} · ${new URL(sourceUrl.trim()).hostname}`, type: sourceType === 'PostgreSQL' ? 'postgresql' : 'mysql', connectionUrl: sourceUrl.trim() }),
      });
      setSavedConnections((connections) => [...connections, result.connection]);
      setSourceConnectionId(result.connection.id);
      setSourceMessage(t('Connection saved securely.'));
    } catch (error) {
      setSourceMessage(error.message);
    } finally {
      setConnectionSaveBusy(false);
    }
  };

  const deleteStoredTable = async (table) => {
    if (!window.confirm(`${t('Delete')} "${table}"?`)) return;
    try {
      await apiRequest(`/api/data-sources/csv/${encodeURIComponent(table)}`, { method: 'DELETE' });
      setConvertResult({ message: `${t('Deleted')} "${table}".` });
      await refreshDataSourceViews();
    } catch (error) { setConvertResult({ message: error.message || t('Failed to delete table.'), error: true }); }
  };

  const deleteSavedConnection = async (id) => {
    try {
      await apiRequest(`/api/data-sources/${encodeURIComponent(id)}`, { method: 'DELETE' });
      setSavedConnections((connections) => connections.filter((connection) => connection.id !== id));
      if (sourceConnectionId === id) { setSourceConnectionId(''); setSourceUrl(''); setSourceTables([]); setSourceTable(''); setSourceVerified(false); }
      await refreshDataSourceViews();
    } catch (error) { setSourceMessage(error.message); }
  };

  const useSourceResult = () => {
    if (!sourceResult) return;
    const normalizedRows = sourceResult.rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value)) ? Number(value) : value])));
    if (!normalizedRows.length) { setSourceMessage(t('The selected table has no rows to display.')); return; }
    setRows(normalizedRows);
    setDatasetName(`${sourceType} · ${sourceResult.table}`);
    setAnswer('');
    setShowConnect(false);
    setSourceMessage('');
  };

  // ---- Datasets: named sets of data sources, saved on the server ----
  const [datasets, setDatasets] = useState([]);
  const [activeDatasetId, setActiveDatasetId] = useState('');
  const [datasetDraft, setDatasetDraft] = useState(null); // null = modal closed
  const [datasetBusy, setDatasetBusy] = useState(false);
  const [datasetMessage, setDatasetMessage] = useState('');
  const [connectionTables, setConnectionTables] = useState({}); // connectionId -> table names
  const defaultDatasetApplied = useRef(false);

  const loadDatasets = async () => {
    try {
      const result = await apiRequest('/api/datasets');
      const list = result.datasets || [];
      setDatasets(list);
      return list;
    } catch (error) {
      setDatasetMessage(error.message || t('Failed to load datasets.'));
      return [];
    }
  };

  const normalizeDatasetRows = (rows) => (rows || []).map((row) =>
    Object.fromEntries(Object.entries(row).map(([key, value]) => [
      key,
      typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value)) ? Number(value) : value,
    ]))
  );
  // Fetches one source's rows.
  // silent: background refresh; not tracked, so it shows no overlay and Cancel does not apply.
  const fetchSourceRows = (source, silent = false) => apiRequest('/api/data-sources/inspect', {
    method: 'POST',
    body: JSON.stringify(source.connectionId ? { connectionId: source.connectionId, table: source.table } : { type: 'csv', table: source.table }),
    track: silent ? false : undefined,
  }).then((result) => normalizeDatasetRows(result.rows))
    .catch((error) => { if (isAbortError(error)) throw error; throw new Error(`${source.table}: ${error.message || 'could not load this table.'}`); });
  // Loads every source of a dataset and joins them into one table: { rows, warnings }.
  const loadDatasetRows = async (dataset, silent = false) => {
    const entries = await Promise.all(dataset.sources.map(async (s) => [sourceKey(s), await fetchSourceRows(s, silent)]));
    return joinDatasetRows(dataset.sources, dataset.links || [], Object.fromEntries(entries));
  };

  // Applies a dataset to every panel (chart, cards, preview). null = sample data.
  const applyDataset = async (dataset) => {
    if (!dataset) {
      setActiveDatasetId('');
      setPanelDataSources((prev) => Object.fromEntries(Object.entries(prev).map(([panel, ps]) => [
        panel, { ...ps, connectionId: '', tableName: '', rows: [], columns: [], variable: '', busy: false, error: '' },
      ])));
      return;
    }
    setDatasetMessage('');
    setPanelDataSources((prev) => Object.fromEntries(Object.entries(prev).map(([panel, ps]) => [panel, { ...ps, busy: true, error: '' }])));
    try {
      const { rows: merged, warnings } = await loadDatasetRows(dataset);
      if (warnings.length) setDatasetMessage(warnings.join(' '));
      if (!merged.length) setDatasetMessage(t('This dataset has no rows.'));
      setActiveDatasetId(dataset.id);
      setPanelDataSources((prev) => Object.fromEntries(Object.entries(prev).map(([panel, ps]) => [panel, {
        ...ps, connectionId: '', tableName: dataset.name, rows: merged, columns: merged[0] ? Object.keys(merged[0]) : [], variable: '', busy: false, error: '',
      }])));
    } catch (error) {
      if (isAbortError(error)) return; // stopLoading already reset the panels
      setPanelDataSources((prev) => Object.fromEntries(Object.entries(prev).map(([panel, ps]) => [panel, { ...ps, busy: false }])));
      setDatasetMessage(error.message || t('Could not load this dataset.'));
    }
  };

  // Per-user saved selections (each card's dataset/variable, chart axes, columns, calculations).
  const selectionKey = `insightful.selections.${user?.id || 'anon'}`;
  const selectionsRestored = useRef(false);

  // Loads one panel's saved source: a saved dataset by name, or a single table.
  const restorePanelSelection = async (panel, sel, list) => {
    const dataset = list.find((item) => item.name === sel.tableName && !sel.connectionId);
    try {
      if (dataset) {
        const { rows: merged } = await loadDatasetRows(dataset);
        setPanelDataSources((prev) => ({ ...prev, [panel]: { ...prev[panel], connectionId: '', tableName: dataset.name, rows: merged, columns: merged[0] ? Object.keys(merged[0]) : [], busy: false, error: '' } }));
      } else {
        await fetchPanelData(panel, sel.connectionId || '', sel.tableName);
      }
    } catch { /* keep the panel empty if its source is gone */ }
    if (sel.variable) setPanelDataSources((prev) => ({ ...prev, [panel]: { ...prev[panel], variable: sel.variable } }));
  };

  // On startup: restore saved selections if any, otherwise apply the default dataset.
  useEffect(() => {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(selectionKey) || 'null'); } catch { saved = null; }
    loadDatasets().then(async (list) => {
      if (saved) {
        if (saved.cardAgg) setCardAgg(saved.cardAgg);
        if (saved.xAxisKey !== undefined) setXAxisKey(saved.xAxisKey);
        if (saved.yAxisKey !== undefined) setYAxisKey(saved.yAxisKey);
        if (saved.secondaryAxisKey !== undefined) setSecondaryAxisKey(saved.secondaryAxisKey);
        if (saved.previewColumns !== undefined) setPreviewColumns(saved.previewColumns);
        if (saved.activeDatasetId && list.some((item) => item.id === saved.activeDatasetId)) setActiveDatasetId(saved.activeDatasetId);
        const panels = saved.panels || {};
        await Promise.all(Object.keys(panelDataSources)
          .filter((panel) => panels[panel]?.tableName)
          .map((panel) => restorePanelSelection(panel, panels[panel], list)));
        selectionsRestored.current = true;
        return;
      }
      const fallback = list.find((item) => item.isDefault);
      if (fallback && !defaultDatasetApplied.current) {
        defaultDatasetApplied.current = true;
        applyDataset(fallback);
      }
      selectionsRestored.current = true;
    });
  }, []);

  // Save selections whenever they change, after the startup restore has finished.
  useEffect(() => {
    if (!selectionsRestored.current) return;
    const panels = Object.fromEntries(Object.entries(panelDataSources).map(([panel, ps]) => [panel, { connectionId: ps.connectionId || '', tableName: ps.tableName || '', variable: ps.variable || '' }]));
    try {
      localStorage.setItem(selectionKey, JSON.stringify({ panels, cardAgg, xAxisKey, yAxisKey, secondaryAxisKey, previewColumns, activeDatasetId }));
    } catch { /* storage full or disabled */ }
  }, [panelDataSources, cardAgg, xAxisKey, yAxisKey, secondaryAxisKey, previewColumns, activeDatasetId]);

  const loadConnectionTables = async () => {
    try {
      const result = await apiRequest('/api/data-sources');
      const connections = result.connections || [];
      setSavedConnections(connections);
      const entries = await Promise.all(connections.map((connection) => apiRequest('/api/data-sources/inspect', {
        method: 'POST',
        body: JSON.stringify({ connectionId: connection.id }),
      }).then((info) => [connection.id, info.tables || []]).catch(() => [connection.id, []])));
      setConnectionTables(Object.fromEntries(entries));
    } catch (error) {
      setDatasetMessage(error.message || t('Failed to load data sources.'));
    }
  };

  const openNewDataset = () => {
    setDatasetMessage('');
    setDatasetPreview(null);
    setDatasetDraft({ id: '', name: '', sources: [], links: [], isDefault: false });
    loadCsvTables();
    loadConnectionTables();
  };
  const openEditDataset = (dataset) => {
    setDatasetMessage('');
    setDatasetPreview(null);
    setDatasetDraft({ id: dataset.id, name: dataset.name, sources: dataset.sources, links: dataset.links || [], isDefault: dataset.isDefault });
    loadCsvTables();
    loadConnectionTables();
  };
  const sameSource = (a, b) => a.connectionId === b.connectionId && a.table === b.table;
  const isDatasetSourceSelected = (source) => Boolean(datasetDraft?.sources.some((item) => sameSource(item, source)));
  const toggleDatasetSource = (source) => setDatasetDraft((draft) => {
    const selected = draft.sources.some((item) => sameSource(item, source));
    const touches = (end) => Boolean(end) && sameSource(end, source);
    return {
      ...draft,
      sources: selected ? draft.sources.filter((item) => !sameSource(item, source)) : [...draft.sources, source],
      // Removing a table also removes the links that used it.
      links: selected ? draft.links.filter((l) => !touches(l.left) && !touches(l.right)) : draft.links,
    };
  });

  const saveDataset = async () => {
    if (!datasetDraft || datasetBusy) return;
    const name = datasetDraft.name.trim();
    if (!name) { setDatasetMessage(t('Enter a name for this dataset.')); return; }
    if (!datasetDraft.sources.length) { setDatasetMessage(t('Select at least one data source.')); return; }
    if (datasetDraft.links.some((l) => !l.left?.column || !l.right?.column)) { setDatasetMessage(t('Complete every link or remove it.')); return; }
    setDatasetBusy(true);
    setDatasetMessage('');
    try {
      const payload = JSON.stringify({ name, sources: datasetDraft.sources, links: datasetDraft.links, isDefault: datasetDraft.isDefault });
      const result = await apiRequest(datasetDraft.id ? `/api/datasets/${datasetDraft.id}` : '/api/datasets', {
        method: datasetDraft.id ? 'PUT' : 'POST',
        body: payload,
      });
      setSourceColumns({});
      await loadDatasets();
      setDatasetDraft(null);
      if (result.dataset.id === activeDatasetId) applyDataset(result.dataset);
    } catch (error) {
      setDatasetMessage(error.message || t('Could not save this dataset.'));
    } finally {
      setDatasetBusy(false);
    }
  };

  const deleteDataset = async () => {
    if (!datasetDraft?.id || datasetBusy) return;
    if (!window.confirm(t('Delete this dataset?'))) return;
    setDatasetBusy(true);
    try {
      const wasActive = datasetDraft.id === activeDatasetId;
      await apiRequest(`/api/datasets/${datasetDraft.id}`, { method: 'DELETE' });
      await loadDatasets();
      setDatasetDraft(null);
      if (wasActive) applyDataset(null);
    } catch (error) {
      setDatasetMessage(error.message || t('Could not delete this dataset.'));
    } finally {
      setDatasetBusy(false);
    }
  };

  const setDefaultDataset = async (dataset) => {
    try {
      await apiRequest(`/api/datasets/${dataset.id}`, { method: 'PUT', body: JSON.stringify({ isDefault: true }) });
      await loadDatasets();
    } catch (error) {
      setDatasetMessage(error.message || t('Could not set the default dataset.'));
    }
  };

  // Column names of each selected source, for the link editor.
  const [sourceColumns, setSourceColumns] = useState({});

  // After any data source change: reload the source lists, then refresh every panel
  // that shows the changed data (the active dataset, or single tables without one).
  const refreshDataSourceViews = async () => {
    setSourceColumns({});
    await Promise.all([loadCsvTables(), loadConnectionTables()]);
    const list = await loadDatasets();
    const active = list.find((item) => item.id === activeDatasetId);
    if (active) { await applyDataset(active); return; }
    const datasetNames = new Set(list.map((item) => item.name));
    await Promise.all(Object.entries(panelDataSources)
      .filter(([, ps]) => ps.tableName && !datasetNames.has(ps.tableName))
      .map(([panel, ps]) => fetchPanelData(panel, ps.connectionId || '', ps.tableName)));
  };
  const [datasetPreview, setDatasetPreview] = useState(null); // { rows, columns, total } | null
  const isSourceAvailable = (s) => (s.connectionId
    ? (connectionTables[s.connectionId] || []).includes(s.table)
    : csvTables.includes(s.table) || dbTables.includes(s.table));
  const missingSources = datasetDraft ? datasetDraft.sources.filter((s) => !isSourceAvailable(s)) : [];
  const previewDataset = async () => {
    setDatasetMessage('');
    setDatasetPreview(null);
    try {
      const draft = { sources: datasetDraft.sources, links: datasetDraft.links.filter((l) => l.left?.column && l.right?.column) };
      const { rows, warnings } = await loadDatasetRows(draft);
      const columns = [...new Set(rows.flatMap((r) => Object.keys(r)))];
      setDatasetPreview({ rows: rows.slice(0, 10), columns, total: rows.length });
      if (warnings.length) setDatasetMessage(warnings.join(' '));
    } catch (error) {
      setDatasetMessage(error.message || t('Could not preview this dataset.'));
    }
  };
  useEffect(() => {
    if (!datasetDraft) return;
    datasetDraft.sources.forEach((s) => {
      const key = sourceKey(s);
      if (sourceColumns[key]) return;
      apiRequest('/api/data-sources/inspect', {
        method: 'POST',
        body: JSON.stringify(s.connectionId ? { connectionId: s.connectionId, table: s.table } : { type: 'csv', table: s.table }),
      }).then((r) => setSourceColumns((prev) => ({ ...prev, [key]: r.columns || [] }))).catch(() => {});
    });
  }, [datasetDraft?.sources]);
  const endKey = (end) => (end ? sourceKey(end) : '');
  const setLink = (i, patch) => setDatasetDraft((d) => ({ ...d, links: d.links.map((l, j) => (j === i ? { ...l, ...patch } : l)) }));
  const pickEnd = (i, side, key) => {
    const s = datasetDraft.sources.find((x) => sourceKey(x) === key);
    if (!s) return;
    setLink(i, { [side]: { connectionId: s.connectionId, table: s.table, column: (sourceColumns[key] || [])[0] || '' } });
  };
  const pickColumn = (i, side, column) => setDatasetDraft((d) => ({ ...d, links: d.links.map((l, j) => (j === i ? { ...l, [side]: { ...l[side], column } } : l)) }));
  const addLink = () => setDatasetDraft((d) => ({ ...d, links: [...d.links, { left: null, right: null, cardinality: '1:M' }] }));
  const removeLink = (i) => setDatasetDraft((d) => ({ ...d, links: d.links.filter((_, j) => j !== i) }));
  const renderLinkEnd = (i, side, link) => (
    <>
      <select value={endKey(link[side])} onChange={(e) => pickEnd(i, side, e.target.value)}>
        <option value="">{t('Table')}</option>
        {datasetDraft.sources.map((s) => <option key={sourceKey(s)} value={sourceKey(s)}>{s.table}{s.connectionId ? ` · ${savedConnections.find((c) => c.id === s.connectionId)?.name || 'database'}` : ''}</option>)}
      </select>
      <select value={link[side]?.column || ''} onChange={(e) => pickColumn(i, side, e.target.value)}>
        <option value="">{t('Column')}</option>
        {(sourceColumns[endKey(link[side])] || []).map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
    </>
  );

  const datasetModalEl = datasetDraft ? (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !datasetBusy) setDatasetDraft(null); }}>
      <div className="connect-modal ds-modal">
        <div className="modal-head">
          <div><div className="section-kicker">{t('DATASETS')}</div><h2>{datasetDraft.id ? t('Edit dataset') : t('New Dataset')}</h2></div>
          <button className="icon-btn" onClick={() => setDatasetDraft(null)} aria-label={t('Close')}><X size={18}/></button>
        </div>
        <label className="ds-field">
          <span className="control-title">{t('Dataset name')}</span>
          <input value={datasetDraft.name} maxLength={80} placeholder={t('e.g. Sales 2025')} onChange={(e) => setDatasetDraft((draft) => ({ ...draft, name: e.target.value }))}/>
        </label>
        <div className="control-title">{t('Data sources')} · {datasetDraft.sources.length} {t('selected')}</div>
        <div className="ds-source-list">
          {csvTables.map((tb) => {
            const source = { connectionId: '', table: tb };
            return (
              <label key={'csv-' + tb} className="ds-check">
                <input type="checkbox" checked={isDatasetSourceSelected(source)} onChange={() => toggleDatasetSource(source)}/>
                <span>{tb} <small>{t('CSV table')}</small></span>
              </label>
            );
          })}
          {dbTables.map((tb) => {
            const source = { connectionId: '', table: tb };
            return (
              <label key={'db-' + tb} className="ds-check">
                <input type="checkbox" checked={isDatasetSourceSelected(source)} onChange={() => toggleDatasetSource(source)}/>
                <span>{tb} <small>{t('Database table')}</small></span>
              </label>
            );
          })}
          {savedConnections.map((connection) => (connectionTables[connection.id] || []).map((tb) => {
            const source = { connectionId: connection.id, table: tb };
            return (
              <label key={connection.id + ':' + tb} className="ds-check">
                <input type="checkbox" checked={isDatasetSourceSelected(source)} onChange={() => toggleDatasetSource(source)}/>
                <span>{tb} <small>{connection.name}</small></span>
              </label>
            );
          }))}
          {csvTables.length === 0 && dbTables.length === 0 && savedConnections.length === 0 && <p className="ds-empty">{t('No data sources yet. Add one first.')}</p>}
        </div>
        {missingSources.length > 0 && (
          <div className="ds-missing">
            <div className="control-title">{t('Missing tables')}</div>
            <p className="ds-hint">{t('These tables no longer exist. Remove them and select the replacement.')}</p>
            {missingSources.map((s) => (
              <div key={sourceKey(s)} className="ds-link-row">
                <span>{s.table}</span>
                <button className="ds-link-remove" onClick={() => toggleDatasetSource(s)}>{t('Remove')}</button>
              </div>
            ))}
          </div>
        )}
        {datasetDraft.sources.length >= 2 && (
          <div className="ds-links">
            <div className="control-title">{t('Links between tables')}</div>
            <p className="ds-hint">{t('1:1 = one row to one row, 1:M = one row to many rows, M:1 = many rows to one row. Without links the tables are stacked.')}</p>
            {datasetDraft.links.map((link, i) => (
              <div key={i} className="ds-link-row">
                {renderLinkEnd(i, 'left', link)}
                <select value={link.cardinality} onChange={(e) => setLink(i, { cardinality: e.target.value })}>
                  {CARDINALITIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                {renderLinkEnd(i, 'right', link)}
                <button className="ds-link-remove" onClick={() => removeLink(i)} aria-label={t('Remove link')}>×</button>
              </div>
            ))}
            <button onClick={addLink}>{t('Add link')}</button>
          </div>
        )}
        <label className="ds-check">
          <input type="checkbox" checked={datasetDraft.isDefault} onChange={(e) => setDatasetDraft((draft) => ({ ...draft, isDefault: e.target.checked }))}/>
          <span>{t('Set as default dataset')}</span>
        </label>
        <div className="ds-preview-bar">
          <button onClick={previewDataset} disabled={datasetBusy || !datasetDraft.sources.length}>{t('Preview')}</button>
        </div>
        {datasetPreview && (
          <div className="ds-preview">
            <div className="ds-hint">{t('Preview')}: {Math.min(10, datasetPreview.total)} / {datasetPreview.total} {t('rows')}</div>
            <div className="ds-preview-scroll">
              <table>
                <thead><tr>{datasetPreview.columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
                <tbody>
                  {datasetPreview.rows.map((r, i) => (
                    <tr key={i}>{datasetPreview.columns.map((c) => <td key={c}>{r[c] === null || r[c] === undefined ? '' : String(r[c])}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {datasetMessage && <div className="dataset-message">{datasetMessage}</div>}
        <div className="ds-actions">
          {datasetDraft.id && <button className="ds-delete" onClick={deleteDataset} disabled={datasetBusy}>{t('Delete')}</button>}
          <span className="ds-spacer"/>
          <button onClick={() => setDatasetDraft(null)} disabled={datasetBusy}>{t('Cancel')}</button>
          <button className="ds-save" onClick={saveDataset} disabled={datasetBusy}>{datasetBusy ? t('Saving…') : t('Save dataset')}</button>
        </div>
      </div>
    </div>
  ) : null;

  const [placingChart, setPlacingChart] = useState('');
  const analyzeChart = (id) => { setFocusChartId(id); setAskOpen(true); };
  const layoutKey = `insightful.layout.${user?.id || 'anon'}`;
  // Data sources offered to each free-form chart.
  const sourceOptions = [
    { label: t('Current data'), source: { kind: 'current' } },
    ...datasets.map((d) => ({ label: `${d.name} · ${t('Dataset')}`, source: { kind: 'dataset', datasetId: d.id } })),
    ...csvTables.map((tb) => ({ label: `${tb} · CSV`, source: { kind: 'table', table: tb, connectionId: '' } })),
    ...dbTables.filter((tb) => !csvTables.includes(tb)).map((tb) => ({ label: `${tb} · ${t('Database table')}`, source: { kind: 'table', table: tb, connectionId: '' } })),
    ...savedConnections.flatMap((c) => (connectionTables[c.id] || []).map((tb) => ({ label: `${tb} · ${c.name}`, source: { kind: 'table', table: tb, connectionId: c.id } }))),
  ];
  const loadSourceRows = async (source, silent = false) => {
    if (source.kind === 'current') return rows;
    if (source.kind === 'dataset') {
      const dataset = datasets.find((d) => d.id === source.datasetId);
      // Throw rather than return []: an empty result would be cached and the dropdowns would stay empty.
      if (!dataset) throw new Error(t('Dataset not found. Refresh the list and try again.'));
      return (await loadDatasetRows(dataset, silent)).rows;
    }
    const body = source.connectionId ? { connectionId: source.connectionId, table: source.table } : { type: 'csv', table: source.table };
    const result = await apiRequest('/api/data-sources/inspect', { method: 'POST', body: JSON.stringify(withRowLimit(body)), track: silent ? false : undefined });
    return normalizeDatasetRows(result.rows);
  };

  const suggestions = [
    { icon: TrendingUp, text: t('What are the main trends in my data?') },
    { icon: BarChart3, text: t('Show me my top performing months') },
    { icon: Sparkles, text: t('What should I focus on next?') },
  ];

  return (
    <div className="app-shell">
      {overlayOn && createPortal(
        <div className="load-overlay" role="status" aria-live="polite">
          <div className="load-card">
            <LoaderCircle className="spin load-spinner" size={44}/>
            <p className="load-text">{t('Loading data…')}</p>
            <button type="button" className="load-cancel-btn" onClick={stopLoading}>{t('Cancel Loading')}</button>
          </div>
        </div>,
        document.body,
      )}
      {datasetModalEl}
      <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''} ${collapsed ? 'sidebar-collapsed' : ''}`}>
        <div className="brand"><div className="brand-mark"><Activity size={19} strokeWidth={2.5} /></div><span>insightful<span className="brand-dot">.</span></span><button className="icon-btn sidebar-close" onClick={() => setMobileNav(false)} aria-label={t('Close menu')}><X size={18}/></button><button className="icon-btn sidebar-collapse" onClick={() => setCollapsed((v) => !v)} aria-label={collapsed ? t('Expand side menu') : t('Collapse side menu')} aria-expanded={!collapsed} title={collapsed ? t('Expand side menu') : t('Collapse side menu')}>{collapsed ? <PanelLeftOpen size={18}/> : <PanelLeftClose size={18}/>}</button></div>
        <div className="sidebar-scroll">
        <button className="workspace-select"><span className="workspace-avatar">S</span><span className="workspace-copy"><b>{t('Studio workspace')}</b><small>{t('Free plan')}</small></span><ChevronDown size={15}/></button>
        <button className="new-analysis" onClick={() => { setAnswer(''); setActiveNav('Overview'); }}><Plus size={17}/> {t('New analysis')} <span>⌘ K</span></button>
        <div className="nav-label">{t('WORKSPACE')}</div>
        <nav className="primary-nav">
          {[['Overview', LayoutDashboard], ['Ask AI', Sparkles], ['Data sources', Database]].map(([name, Icon]) => <button key={name} title={t(name)} className={`nav-item ${activeNav === name ? 'selected' : ''}`} onClick={() => { setActiveNav(name); if (name === 'Data sources') setShowDataSources(true); if (name === 'Ask AI') setAskOpen(true); }}><Icon size={17}/><span>{t(name)}</span>{name === 'Data sources' && <span className="nav-count">1</span>}</button>)}
        </nav>
        <div className="nav-label recent-label">{t('RECENT ANALYSES')} <button aria-label={t('More')}><MoreHorizontal size={16}/></button></div>
        <div className="recent-list"><button className="recent-item active-recent"><span className="recent-icon"><BarChart3 size={15}/></span><span><b>{t('Revenue overview')}</b><small>{t('Today · 10:42 am')}</small></span></button><button className="recent-item"><span className="recent-icon"><TrendingUp size={15}/></span><span><b>{t('Monthly growth')}</b><small>{t('Yesterday')}</small></span></button><button className="recent-item"><span className="recent-icon"><Table2 size={15}/></span><span><b>{t('Customer segments')}</b><small>{t('Jun 12, 2025')}</small></span></button></div>
        <button className="add-source-link" onClick={() => setShowConnect(true)}><Plus size={15}/> {t('Add a data source')}</button>

        <div className="nav-label">{t('DATASETS')}</div>
        <button className="add-source-link" onClick={openNewDataset}><Plus size={15}/> {t('New Dataset')}</button>
        <div className="dataset-list">
          <button className={`dataset-item ${!activeDatasetId ? 'selected' : ''}`} onClick={() => applyDataset(null)}>
            <span className="dataset-copy"><b>{t('Sample data')}</b></span>
          </button>
          {datasets.map((dataset) => (
            <div key={dataset.id} className={`dataset-item ${activeDatasetId === dataset.id ? 'selected' : ''}`}>
              <button className="dataset-copy dataset-pick" onClick={() => applyDataset(dataset)} title={dataset.name}>
                <b>{dataset.name}</b>
                <small>{dataset.sources.length} {t('sources')}{dataset.isDefault ? ` · ${t('Default')}` : ''}</small>
              </button>
              <button className={`icon-btn ds-icon ${dataset.isDefault ? 'on' : ''}`} aria-label={t('Set as default')} title={dataset.isDefault ? t('Default dataset') : t('Set as default')} onClick={() => { if (!dataset.isDefault) setDefaultDataset(dataset); }}><Star size={13} fill={dataset.isDefault ? 'currentColor' : 'none'}/></button>
              <button className="icon-btn ds-icon" aria-label={t('Edit dataset')} title={t('Edit dataset')} onClick={() => openEditDataset(dataset)}><Pencil size={13}/></button>
            </div>
          ))}
        </div>
        {datasetMessage && !datasetDraft && <div className="dataset-message">{datasetMessage}</div>}

        <div className="nav-label">{t('DATE FILTER')}</div>
        <section className="display-controls date-filter-panel" aria-label={t('Date filter')}>
          <label className="control-row control-row-stack">
            <span className="control-title">{t('Period')}</span>
            <select className="range-btn range-select" aria-label={t('Date filter')} value={range} onChange={(event) => setRange(event.target.value)}>{DATE_RANGES.map((option) => <option key={option.value} value={option.value}>{t(option.label)}</option>)}</select>
          </label>
          <label className="control-row control-row-stack">
            <span className="control-title">{t('Max rows')}</span>
            <select className="range-btn range-select" aria-label={t('Max rows')} value={rowLimit} onChange={(event) => setRowLimit(event.target.value)}>{ROW_LIMIT_OPTIONS.map((option) => <option key={option} value={option}>{option === 'all' ? t('All') : option}</option>)}</select>
          </label>
          {range === 'custom' && <div className="control-row control-row-stack" style={{ gap: 4 }}>
            <input type="date" aria-label={t('From')} value={customFrom} onChange={(e) => setCustomFrom(e.target.value)}/>
            <input type="date" aria-label={t('To')} value={customTo} onChange={(e) => setCustomTo(e.target.value)}/>
          </div>}
        </section>
        
        <div className="nav-label">{t('DISPLAY CONTROLS')}</div>
        <section className="display-controls" aria-label={t('Display controls')}>
          <div className="control-row">
            <span className="control-title"><Type size={13}/> {t('Font size')}</span>
            <div className="font-stepper">
              <button onClick={() => changeScale(-SCALE_STEP)} disabled={appearance.scale <= MIN_SCALE} aria-label={t('Decrease font size')}><Minus size={13}/></button>
              <output aria-live="polite">{Math.round(appearance.scale * 100)}%</output>
              <button onClick={() => changeScale(SCALE_STEP)} disabled={appearance.scale >= MAX_SCALE} aria-label={t('Increase font size')}><Plus size={13}/></button>
            </div>
          </div>
          <div className="control-row">
            <span className="control-title"><RefreshCw size={13}/> {t('Refresh charts')}</span>
            <select className="range-btn range-select" aria-label={t('Refresh charts')} value={refreshSec} onChange={(e) => setRefreshSec(Number(e.target.value))}>
              {REFRESH_OPTIONS.map((sec) => <option key={sec} value={sec}>{sec} {t('s')}</option>)}
            </select>
          </div>
          <div className="control-row control-row-stack">
            <span className="control-title"><Palette size={13}/> {t('Page theme')}</span>
            <div className="theme-grid" role="radiogroup" aria-label={t('Page color theme')}>
              {THEMES.map((theme) => <button key={theme.id} role="radio" aria-checked={appearance.theme === theme.id} className={`theme-swatch ${appearance.theme === theme.id ? 'theme-active' : ''}`} onClick={() => setTheme(theme.id)} title={t(theme.label)}><span className="swatch-dot" style={{ background: `linear-gradient(135deg, ${theme.swatch[0]} 55%, ${theme.swatch[1]} 55%)` }}/><small>{t(theme.label)}</small></button>)}
            </div>
          </div>
          <button className="control-reset" onClick={() => setAppearance({ ...DEFAULT_APPEARANCE })} disabled={appearance.theme === DEFAULT_APPEARANCE.theme && appearance.scale === DEFAULT_APPEARANCE.scale}><RotateCcw size={12}/> {t('Reset display')}</button>
        </section>
        </div>
        <div className="sidebar-foot">
        <div className="upgrade-card"><div className="upgrade-top"><span className="upgrade-icon"><Zap size={15}/></span><span>{t('Get more from your data')}</span></div><p>{t('Unlock unlimited analyses and connect all your data sources.')}</p><button onClick={() => setSourceMessage(t('Plan upgrades will be available soon.'))}>{t('Explore plans')} <ArrowUpRight size={14}/></button></div>
        {user.role === 'superuser' && <button className="admin-shortcut" title={t('Admin settings')} onClick={() => setShowAdmin(true)}><Settings2 size={15}/> {t('Admin settings')} <span><ShieldCheck size={12}/> {t('SUPERUSER')}</span></button>}<button className="profile-row" title={t('Sign out')} onClick={async () => { await apiRequest('/api/auth/logout', { method: 'POST' }).catch(() => {}); onLogout(); }}><span className="profile-avatar">{(user.name || user.email).slice(0, 2).toUpperCase()}</span><span className="profile-copy"><b>{user.name}</b><small>{user.email}</small></span><LogOut size={16}/></button>
        </div>
      </aside>

      <main className={`main-area ${collapsed ? 'main-collapsed' : ''}`}>
        <header className="topbar"><div className="breadcrumb"><button className="mobile-menu icon-btn" onClick={() => setMobileNav(true)} aria-label={t('Open menu')}><Menu size={19}/></button><span>{t('Workspace')}</span><ChevronRight size={14}/><b>{t(activeNav)}</b></div><div className="top-actions"><LanguageSwitch /><div className="status-pill"><span/> {t('All systems normal')}</div><button className="icon-btn search-btn" aria-label={t('Search')}><Search size={18}/></button><button className="icon-btn" aria-label={t('Notifications')}><Bell size={18}/><i className="notification-dot"/></button>{user.role === 'superuser' && <button className="top-admin-btn" onClick={() => setShowAdmin(true)}><Settings2 size={14}/><span>{t('Admin')}</span></button>}<button className="help-btn" onClick={openUserManual}><CircleHelp size={17}/><span>{t('Help')}</span></button></div></header>
        <div className="content-wrap">
          <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line"/> {t('YOUR ANALYTICS WORKSPACE')}</div><h1>{t('Good morning, {name}', { name: user.name || 'Jamie' })} <span className="wave">✳</span></h1><p>{t('Here’s what’s happening with your data today.')}</p></div><div className="heading-actions"><NewChartButton t={t} onPick={setPlacingChart}/><button className="primary-btn heading-btn" onClick={() => setShowConnect(true)}><Plus size={17}/> {t('Connect data')}</button></div></div>

          <section className="dataset-strip"><div className="dataset-left"><div className="sheet-icon"><FileSpreadsheet size={19}/></div><div className="dataset-title"><span>{t('ACTIVE DATASET')}</span><strong>{datasetName}<ChevronDown size={15}/></strong></div><span className="connected-badge"><span/> {t('Connected')}</span><span className="dataset-meta">{t('{n} rows', { n: rows.length })} <i/> {t('Updated just now')}</span></div><div className="dataset-actions"><button className="text-action" onClick={() => fileRef.current?.click()}><Upload size={15}/> {t('Upload file')}</button><span className="action-divider"/><button className="icon-btn small" aria-label={t('Dataset settings')}><Settings2 size={17}/></button><button className="icon-btn small" aria-label={t('More dataset actions')}><MoreHorizontal size={18}/></button></div><input ref={fileRef} className="visually-hidden" type="file" accept=".csv,text/csv" onChange={handleFile}/></section>

          {/* Built-in KPI cards and the main trend chart are now default charts in the chart canvas. */}

          <FreeChartCanvas
            storageKey={`insightful.charts.${user?.id || 'anon'}`}
            sourceOptions={sourceOptions}
            loadSourceRows={loadSourceRows}
            dataVersion={datasets.map((d) => `${d.id}:${d.updatedAt}`).join('|')}
            refreshTick={refreshTick}
            currentRows={rows}
            placing={placingChart}
            setPlacing={setPlacingChart}
            onAnalyze={analyzeChart}
            onSummaries={setChartSummaries}
            chartTheme={chartTheme}
            t={t}
          />

          <footer className="footer"><span>© 2025 Insightful Analytics</span><div><button>{t('Privacy')}</button><button>{t('Terms')}</button><button><MessageSquareText size={13}/> {t('Feedback')}</button></div><span className="footer-version">{t('Made for curious minds')} <span>✳</span></span></footer>
        </div>
      </main>

      <AskFloating open={askOpen} onToggle={() => setAskOpen((v) => !v)} onClose={() => setAskOpen(false)} query={query} setQuery={setQuery} answer={answer} setAnswer={setAnswer} busy={busy} error={serverError ? translate(serverError) : ''} onSubmit={submitAnalysis} charts={chartSummaries} focusId={focusedChart ? focusedChart.id : ''} onFocus={setFocusChartId} suggestions={suggestions} model={selectedModel ? `OpenRouter · ${selectedModel}` : ''} canConfigure={user.role === 'superuser'} onConfigure={() => setShowAdmin(true)} />
      {showAdmin && user.role === 'superuser' && <AdminPanel user={user} onUserUpdate={onUserUpdate} onClose={() => setShowAdmin(false)} />}
      {showConnect && <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) { setShowConnect(false); setSourceMessage(''); } }}><div className="connect-modal"><div className="modal-head"><div><div className="modal-icon"><Database size={19}/></div><h2>{t('Connect your data')}</h2><p>{t('Bring your data in to start exploring with AI.')}</p></div><button className="icon-btn" onClick={() => { setShowConnect(false); setSourceMessage(''); }} aria-label={t('Close')}><X size={19}/></button></div><div className="source-options">{[['Google Sheets', FileSpreadsheet], ['Google Drive', CloudUpload], ['Database', Database], ['PostgreSQL', Database], ['MySQL', Database], ['CSV file', FileText]].map(([name, Icon]) => <button key={name} className={`source-option ${sourceType === name ? 'source-selected' : ''}`} onClick={() => { setSourceType(name); setSourceUrl(''); setSourceTable(''); setSourceTables([]); setSourceResult(null); setSourceMessage(''); setSourceConnectionId(''); setSourceVerified(false); }}><Icon size={18}/><span>{t(name)}</span>{sourceType === name && <Check size={15}/>}</button>)}</div>{savedConnections.length > 0 && <div className="saved-connections"><label htmlFor="saved-connection">{t('Saved database connections')}</label><div><select id="saved-connection" value={sourceConnectionId} onChange={(event) => { const connection = savedConnections.find((item) => item.id === event.target.value); setSourceConnectionId(connection?.id || ''); setSourceType(connection?.type === 'postgresql' ? 'PostgreSQL' : connection ? 'MySQL' : sourceType); setSourceUrl(''); setSourceTables([]); setSourceTable(''); setSourceResult(null); setSourceVerified(Boolean(connection)); setSourceMessage(''); }}><option value="">{t('New database connection')}</option>{savedConnections.map((connection) => <option key={connection.id} value={connection.id}>{connection.name} · {connection.host}</option>)}</select>{sourceConnectionId && <button type="button" onClick={() => deleteSavedConnection(sourceConnectionId)} aria-label={t('Delete saved connection')}><X size={15}/></button>}</div></div>}{sourceType === 'Database' && <div className="csv-tables-section" style={{ marginBottom: 14 }}><div className="csv-section-head"><span className="csv-icon"><Database size={16}/></span><div><div className="csv-title">{t('Converted databases')}</div><div className="csv-subtitle">{t('Select a database table to load its data.')}</div></div><button type="button" className="text-action" style={{ marginLeft: 'auto' }} onClick={loadCsvTables}>{t('Refresh')}</button></div>{dbTables.length > 0 ? <div className="csv-table-list">{dbTables.map((table) => <button key={table} type="button" className={`csv-table-row ${sourceTable === table ? 'csv-table-selected' : ''}`} onClick={() => { setSourceTable(table); loadCsvTable(table); }} style={{ textAlign: 'left', padding: '8px 10px' }}><span>{table}</span><span className="csv-table-action">{t('Load')}</span></button>)}</div> : <p className="source-message">{t('No converted databases yet. Convert a CSV table first.')}</p>}</div>}<form onSubmit={connectSource}><label htmlFor="source-url">{['Database', 'PostgreSQL', 'MySQL'].includes(sourceType) ? t('Connection URL') : sourceType === 'CSV file' ? t('File link or upload below') : t('{type} link', { type: sourceType })}</label>{sourceType !== 'CSV file' && <div className="url-field"><Link2 size={16}/><input id="source-url" type="password" autoComplete="new-password" disabled={Boolean(sourceConnectionId)} required={['PostgreSQL', 'MySQL'].includes(sourceType) && !sourceConnectionId} value={sourceUrl} onChange={(e) => { setSourceUrl(e.target.value); setSourceTables([]); setSourceResult(null); setSourceTable(''); setSourceVerified(false); }} placeholder={sourceType === 'PostgreSQL' ? 'postgresql://user:password@host:5432/database' : sourceType === 'MySQL' ? 'mysql://user:password@host:3306/database' : sourceType === 'Database' ? 'postgresql://host:5432/database' : t('Paste a shareable link')} /></div>}{sourceType === 'CSV file' && <div className="csv-import-section"><div className="csv-import-card"><div className="csv-import-head"><span className="csv-icon"><FileText size={18}/></span><div><div className="csv-title">{t('Convert CSV to database')}</div><div className="csv-subtitle">{t('Upload a CSV file to import it as a database table you can query and analyze.')}</div></div></div><div className="csv-import-body"><input ref={csvFileRef} className="visually-hidden" type="file" accept=".csv,text/csv" onChange={importCsvFile}/><button type="button" className="primary-btn" onClick={() => csvFileRef.current?.click()} disabled={csvImportBusy}>{csvImportBusy ? <LoaderCircle className="spin" size={14}/> : <Upload size={15}/>} {t('Choose CSV file')}</button></div></div>{csvTables.length > 0 && <div className="csv-tables-section"><div className="csv-section-head"><span className="csv-icon"><Database size={16}/></span><div><div className="csv-title">{t('Imported CSV tables')}</div><div className="csv-subtitle">{t('Select a table to load its data into your workspace, or convert it to a database table.')}</div></div></div><div className="csv-table-list">{csvTables.map((table) => {
    const isConverting = convertToDbTable === table;
    return (
      <div key={table} className="csv-table-row" style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,width:'100%'}}>
        <button type="button" className={`csv-table-row ${sourceTable === table ? 'csv-table-selected' : ''}`} onClick={() => { setConvertToDbTable(''); loadCsvTable(table); }} style={{flex:1,textAlign:'left',padding:'8px 10px'}}><span>{table}</span><span className="csv-table-action">{t('Load')}</span></button>
        {isConverting ? (
          <div style={{display:'flex',alignItems:'center',gap:6}}>
            <input className="convert-table-input" value={convertToDbTargetName} onChange={(e) => setConvertToDbTargetName(e.target.value)} placeholder={t('New table name')} style={{minWidth:130,height:'30px'}}/>
            <button type="button" className="primary-btn" onClick={() => convertCsvToDatabase(table, convertToDbTargetName)} disabled={convertBusy || !convertToDbTargetName.trim()} style={{fontSize:'calc(10px*var(--fs,1))',padding:'4px 10px',height:'30px'}}><LoaderCircle className="spin" size={12} style={{display:convertBusy && convertToDbTable === table ? 'inline-block' : 'none'}}/> {t('Convert')}</button>
            <button type="button" className="text-action" onClick={() => { setConvertToDbTable(''); setConvertToDbTargetName(''); }} style={{fontSize:'calc(10px*var(--fs,1))',padding:'2px 6px',marginLeft:4}}>{t('Cancel')}</button>
          </div>
        ) : (
          <button type="button" className="text-action" onClick={() => { setConvertToDbTable(table); setConvertToDbTargetName(table); }} style={{fontSize:'calc(10px*var(--fs,1))',padding:'2px 6px',color:'var(--primary,#7168e8)'}}>{t('Convert to database')}</button>
        )}
      </div>
    );
  })}
</div></div>}
</div>}
{['PostgreSQL', 'MySQL'].includes(sourceType) && <><p className="secure-note"><span><LockKeyhole size={13}/></span> {sourceConnectionId ? t('Saved connection credentials are encrypted on the server.') : t('Credentials are encrypted and saved on the server only when you choose Save connection.')}</p>{sourceVerified && !sourceConnectionId && <div className="save-connection-row"><input aria-label={t('Connection name')} value={connectionName} onChange={(event) => setConnectionName(event.target.value)} placeholder={t('Connection name (optional)')}/><button type="button" className="text-action" onClick={saveSourceConnection} disabled={connectionSaveBusy}>{connectionSaveBusy ? <LoaderCircle className="spin" size={14}/> : <Check size={14}/>} {t('Save connection')}</button></div>}</>}{sourceMessage && <p className="source-message" role="status">{sourceBusy && <LoaderCircle className="spin" size={14}/>} {sourceMessage}</p>}{sourceTables.length > 0 && <div className="source-table-picker"><label htmlFor="source-table">{t('Choose a table')}</label><select id="source-table" value={sourceTable} onChange={(e) => setSourceTable(e.target.value)}><option value="">{t('Select table…')}</option>{sourceTables.map((table) => <option key={table} value={table}>{table}</option>)}</select><button type="button" className="primary-btn" onClick={loadSourceTable} disabled={!sourceTable || sourceBusy}>{sourceBusy ? <LoaderCircle className="spin" size={14}/> : <Database size={14}/>} {t('Load preview')}</button></div>}{sourceResult && <div className="source-result"><div className="source-result-head"><b>{sourceResult.table}</b><span>{sourceResult.rows.length} {t('rows (maximum 50)')}</span></div>{sourceResult.rows.length ? <div className="source-result-scroll"><table><thead><tr>{sourceResult.columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{sourceResult.rows.map((row, index) => <tr key={index}>{sourceResult.columns.map((column) => <td key={column}>{row[column] === null ? 'NULL' : typeof row[column] === 'object' ? JSON.stringify(row[column]) : String(row[column])}</td>)}</tr>)}</tbody></table></div> : <p>{t('The selected table is empty.')}</p>}<button type="button" className="primary-btn" onClick={useSourceResult} disabled={!sourceResult.rows.length}>{t('Use this data')} <ArrowUpRight size={14}/></button></div>}{!['PostgreSQL', 'MySQL', 'CSV file'].includes(sourceType) && <div className="secure-note"><span><Check size={13}/></span> {t('Live connection support is currently available for PostgreSQL and MySQL.')}</div>}{sourceType !== 'CSV file' && <button className="primary-btn modal-submit" type="submit" disabled={sourceBusy || !['PostgreSQL', 'MySQL'].includes(sourceType)}>{sourceBusy ? <LoaderCircle className="spin" size={15}/> : <>{t('Test connection')} <ArrowUpRight size={15}/></>}</button>}</form><div className="modal-foot">{t('Need help connecting?')} <span>{t('Only select databases and tables you are authorized to access.')}</span></div></div></div>}
      {showManageDatasource && (() => {
        const localItems = localDatasets.filter((d) => d.file).map((d) => ({ name: d.name, rowCount: d.rowCount, file: d.file }));
        const localTables = new Set(localItems.map((d) => localTableName(d.name)));
        const items = [...localItems, ...csvTables.filter((tb) => !localTables.has(tb)).map((tb) => ({ name: tb, table: tb }))];
        const close = () => { setShowManageDatasource(false); setConvertResult(null); setConvertSourceTable(''); setConvertTargetName(''); };
        return <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}><div className="connect-modal"><div className="modal-head"><div><div className="modal-icon"><Database size={19}/></div><h2>{t('Manage datasources')}</h2><p>{t('Convert imported CSV tables into regular database tables you can save and reuse.')}</p></div><button className="icon-btn" onClick={close} aria-label={t('Close')}><X size={19}/></button></div>
          {items.length > 0 ? <div className="csv-table-list" style={{ marginBottom: 20 }}>{items.map((item) => { const key = item.table || item.name; const busy = convertBusy && convertSourceTable === key; return <div key={key} className="convert-table-row"><span className="convert-table-name"><FileText size={14}/> {item.name}{item.rowCount != null ? ' · ' + item.rowCount + ' ' + t('rows') : ''}</span><div className="convert-table-controls"><input className="convert-table-input" value={convertNames[key] ?? (item.table || localTableName(item.name)).replace(/^csv_/i, '')} onChange={(e) => setConvertNames((n) => ({ ...n, [key]: e.target.value }))} placeholder={t('New table name')} disabled={convertBusy}/><button type="button" className="primary-btn" onClick={() => convertItem(item)} disabled={convertBusy}>{busy ? <LoaderCircle className="spin" size={14}/> : <Database size={14}/>} {t('Convert to database')}</button></div></div>; })}</div>
          : <div className="csv-import-card"><div className="csv-import-head"><span className="csv-icon"><FileText size={18}/></span><div><div className="csv-title">{t('No CSV files')}</div><div className="csv-subtitle">{t('Upload a CSV file first, then come back here to convert it to a database table.')}</div></div></div><div className="csv-import-body"><input ref={csvFileRef} className="visually-hidden" type="file" accept=".csv,text/csv" onChange={importCsvFile}/><button type="button" className="primary-btn" onClick={() => csvFileRef.current?.click()} disabled={csvImportBusy}>{csvImportBusy ? <LoaderCircle className="spin" size={14}/> : <Upload size={15}/>} {t('Choose CSV file')}</button></div></div>}
          {convertResult && <div className="source-message" role="status" style={convertResult.error ? { color: '#c0392b' } : undefined}>{convertResult.message}</div>}
        </div></div>;
      })()}
      {showDataSources && <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) { setShowDataSources(false); } }}><div className="connect-modal ds-modal"><div className="modal-head"><div><div className="modal-icon"><Database size={19}/></div><h2>{t('Data sources')}</h2><p>{t('Your stored database connections and imported tables.')}</p></div><button className="icon-btn" onClick={() => setShowDataSources(false)} aria-label={t('Close')}><X size={19}/></button></div><div className="ds-body"><section className="ds-section"><div className="ds-section-head"><span className="ds-section-icon"><Database size={16}/></span><div><h3>{t('Database connections')}</h3><p>{t('Saved PostgreSQL and MySQL connections.')}</p></div><span className="ds-count">{savedConnections.length}</span></div>{savedConnections.length > 0 ? <div className="ds-list">{savedConnections.map((connection) => <React.Fragment key={connection.id}><div className="ds-row"><span className="ds-icon"><Database size={16}/></span><div className="ds-info"><div className="ds-name">{connection.name}</div><div className="ds-meta">{connection.type === 'postgresql' ? t('PostgreSQL') : t('MySQL')} · {connection.host}</div></div><div className="ds-actions"><button type="button" className="ds-btn ds-btn-primary" onClick={() => { setSourceConnectionId(connection.id); setSourceType(connection.type === 'postgresql' ? 'PostgreSQL' : 'MySQL'); setSourceVerified(true); setShowDataSources(false); setShowConnect(true); }}>{t('Use')}</button><button type="button" className="ds-btn ds-btn-danger" onClick={() => deleteSavedConnection(connection.id)}><X size={14}/> {t('Delete')}</button></div></div></React.Fragment>)}</div> : <div className="ds-empty">{t('No database connections saved yet.')}</div>}</section><section className="ds-section"><div className="ds-section-head"><span className="ds-section-icon"><FileText size={16}/></span><div><h3>{t('Imported CSV tables')}</h3><p>{t('CSV files imported into the local database.')}</p></div><span className="ds-count">{csvTables.length}</span></div>{csvTables.length > 0 ? <div className="ds-list">{csvTables.map((table) => <React.Fragment key={table}><div className="ds-row"><span className="ds-icon"><FileText size={16}/></span><div className="ds-info"><div className="ds-name">{table}</div><div className="ds-meta">{t('CSV table')}</div></div><div className="ds-actions"><button type="button" className="ds-btn ds-btn-primary" onClick={() => { setShowDataSources(false); loadCsvTable(table); }}>{t('Load')}</button><button type="button" className="ds-btn" disabled={convertBusy} onClick={() => convertItem({ name: table, table })}>{convertBusy && convertSourceTable === table ? <LoaderCircle className="spin" size={14}/> : <Database size={14}/>} {t('Convert to DB')}</button><button type="button" className="ds-btn ds-btn-danger" onClick={() => deleteStoredTable(table)}><X size={14}/> {t('Delete')}</button></div></div></React.Fragment>)}</div> : <div className="ds-empty">{t('No imported CSV tables yet.')}</div>}</section><section className="ds-section"><div className="ds-section-head"><span className="ds-section-icon"><Database size={16}/></span><div><h3>{t('Converted databases')}</h3><p>{t('Tables converted from CSV into the SQLite database.')}</p></div><span className="ds-count">{dbTables.length}</span></div>{dbTables.length > 0 ? <div className="ds-list">{dbTables.map((table) => <React.Fragment key={table}><div className="ds-row"><span className="ds-icon"><Database size={16}/></span><div className="ds-info"><div className="ds-name">{table}</div><div className="ds-meta">SQLite</div></div><div className="ds-actions"><button type="button" className="ds-btn ds-btn-primary" onClick={() => { setShowDataSources(false); loadCsvTable(table); }}>{t('Load')}</button><button type="button" className="ds-btn ds-btn-danger" onClick={() => deleteStoredTable(table)}><X size={14}/> {t('Delete')}</button></div></div></React.Fragment>)}</div> : <div className="ds-empty">{t('No converted databases yet.')}</div>}</section><section className="ds-section"><div className="ds-section-head"><span className="ds-section-icon"><FileText size={16}/></span><div><h3>{t('Loaded CSV files')}</h3><p>{t('CSV files uploaded directly to the current session.')}</p></div><span className="ds-count">{localDatasets.length}</span></div>{localDatasets.length > 0 ? <div className="ds-list">{localDatasets.map((d) => <React.Fragment key={d.name}><div className="ds-row"><span className="ds-icon"><FileText size={16}/></span><div className="ds-info"><div className="ds-name">{d.name}</div><div className="ds-meta">{d.rowCount} {t('rows')} · {t('Loaded')}</div></div><div className="ds-actions"><button type="button" className="ds-btn ds-btn-primary" onClick={() => { setShowDataSources(false); setPanelDataSources((p) => ({ ...p, chart: { ...p.chart, connectionId: '', tableName: d.name, rows: d.rows || [], columns: d.rows?.[0] ? Object.keys(d.rows[0]) : [], busy: false, error: '' } })); setRows(d.rows || []); setDatasetName(d.name); setActiveNav('Overview'); }}>{t('Load')}</button><button type="button" className="ds-btn ds-btn-danger" onClick={() => setLocalDatasets((list) => list.filter((item) => item.name !== d.name))}><X size={14}/> {t('Remove')}</button></div></div></React.Fragment>)}</div> : <div className="ds-empty">{t('No CSV files loaded yet.')}</div>}</section></div>{dsError && <div className="source-message ds-message" role="alert" style={{ color: '#c0392b' }}>{dsError}</div>}{convertResult && <div className="source-message ds-message" role="status" style={convertResult.error ? { color: '#c0392b' } : undefined}>{convertResult.message}</div>}<div className="modal-foot ds-foot"><button type="button" className="ds-btn" onClick={() => setShowDataSources(false)}>{t('Close')}</button><button type="button" className="primary-btn ds-add" onClick={() => { setShowDataSources(false); setShowConnect(true); }}><Plus size={15}/> {t('Add a data source')}</button></div></div></div>}
    </div>
  );
}

export default App;
