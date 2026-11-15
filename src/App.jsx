import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, ArrowDownRight, ArrowUpRight, BarChart3, Bell, Bot, CalendarDays,
  Check, ChevronDown, ChevronRight, CircleHelp, CloudUpload, Database, FileSpreadsheet,
  FileText, Filter, LayoutDashboard, Link2, LoaderCircle, LogOut, Menu, MessageSquareText,
  MoreHorizontal, Paperclip, Plus, Search, Send, Settings2, ShieldCheck, Sparkles, Table2, TrendingUp,
  Upload, X, Zap, Minus, Palette, RotateCcw, Type, PanelLeftClose, PanelLeftOpen
} from 'lucide-react';
import { apiRequest } from './Auth.jsx';
import AdminPanel from './AdminPanel.jsx';
import AskFloating from './AskFloating.jsx';
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

function App({ user, onUserUpdate, onLogout }) {
  const [rows, setRows] = useState(sampleRows);
  const [datasetName, setDatasetName] = useState('E-commerce performance');
  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [showConnect, setShowConnect] = useState(false);
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourceType, setSourceType] = useState('Google Sheets');
  const [sourceMessage, setSourceMessage] = useState('');
  const [showAdmin, setShowAdmin] = useState(false);
  const [selectedModel, setSelectedModel] = useState('');
  const [serverError, setServerError] = useState('');
  const [activeNav, setActiveNav] = useState('Overview');
  const [range, setRange] = useState('12 months');
  const [mobileNav, setMobileNav] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem('insightful.sidebar') === 'collapsed'; } catch { return false; } });
  useEffect(() => { try { localStorage.setItem('insightful.sidebar', collapsed ? 'collapsed' : 'expanded'); } catch { /* ignore */ } }, [collapsed]);
  const [appearance, setAppearance] = useState(loadAppearance);
  const fileRef = useRef(null);
  const chartTheme = getTheme(appearance.theme).chart;

  useEffect(() => { applyAppearance(appearance); saveAppearance(appearance); }, [appearance]);
  const setTheme = (theme) => setAppearance((current) => ({ ...current, theme }));
  const changeScale = (delta) => setAppearance((current) => ({ ...current, scale: nextScale(current.scale, delta) }));

  const numericKeys = useMemo(() => {
    const first = rows[0] || {};
    return Object.keys(first).filter((key) => key !== 'month' && typeof first[key] === 'number');
  }, [rows]);
  const primaryKey = numericKeys.find((key) => /revenue|sales|amount|value|total|profit/i.test(key)) || numericKeys[0];
  const secondaryKey = numericKeys.find((key) => key !== primaryKey && /order|count|quantity|units/i.test(key)) || numericKeys.find((key) => key !== primaryKey);
  const total = useMemo(() => rows.reduce((sum, row) => sum + (Number(row[primaryKey]) || 0), 0), [rows, primaryKey]);
  const firstHalf = rows.slice(0, Math.max(1, Math.floor(rows.length / 2))).reduce((sum, row) => sum + (Number(row[primaryKey]) || 0), 0);
  const secondHalf = rows.slice(Math.max(1, Math.floor(rows.length / 2))).reduce((sum, row) => sum + (Number(row[primaryKey]) || 0), 0);
  const growth = firstHalf ? Math.round(((secondHalf / firstHalf) - 1) * 100) : 0;
  const avg = rows.length ? Math.round(total / rows.length) : 0;
  const latest = rows[rows.length - 1] || {};
  const previous = rows[rows.length - 2] || {};
  const monthlyChange = previous[primaryKey] ? Math.round(((latest[primaryKey] / previous[primaryKey]) - 1) * 100) : 0;

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const parsed = parseCSV(await file.text());
      setRows(parsed);
      setDatasetName(file.name.replace(/\.csv$/i, ''));
      setAnswer('');
      setActiveNav('Overview');
    } catch (error) {
      window.alert(error.message || 'Unable to read this file. Please try a CSV.');
    }
    event.target.value = '';
  };

  const submitAnalysis = async (text = query) => {
    if (!text.trim() || busy) return;
    setBusy(true);
    setServerError('');
    setAnswer('');
    setQuery('');
    try {
      const result = await apiRequest('/api/ai/analyze', {
        method: 'POST',
        body: JSON.stringify({ prompt: text.trim(), rows, datasetName, ...(selectedModel ? { model: selectedModel } : {}) }),
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

  const connectSource = (event) => {
    event.preventDefault();
    if (!sourceUrl.trim()) { setSourceMessage('Enter a link or connection details to continue.'); return; }
    setSourceMessage(`Source saved. To securely load live data from ${sourceType}, connect a backend integration and keep credentials server-side.`);
  };

  const suggestions = [
    { icon: TrendingUp, text: 'What are the main trends in my data?' },
    { icon: BarChart3, text: 'Show me my top performing months' },
    { icon: Sparkles, text: 'What should I focus on next?' },
  ];

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''} ${collapsed ? 'sidebar-collapsed' : ''}`}>
        <div className="brand"><div className="brand-mark"><Activity size={19} strokeWidth={2.5} /></div><span>insightful<span className="brand-dot">.</span></span><button className="icon-btn sidebar-close" onClick={() => setMobileNav(false)} aria-label="Close menu"><X size={18}/></button><button className="icon-btn sidebar-collapse" onClick={() => setCollapsed((v) => !v)} aria-label={collapsed ? 'Expand side menu' : 'Collapse side menu'} aria-expanded={!collapsed} title={collapsed ? 'Expand side menu' : 'Collapse side menu'}>{collapsed ? <PanelLeftOpen size={18}/> : <PanelLeftClose size={18}/>}</button></div>
        <div className="sidebar-scroll">
        <button className="workspace-select"><span className="workspace-avatar">S</span><span className="workspace-copy"><b>Studio workspace</b><small>Free plan</small></span><ChevronDown size={15}/></button>
        <button className="new-analysis" onClick={() => { setAnswer(''); setActiveNav('Overview'); }}><Plus size={17}/> New analysis <span>⌘ K</span></button>
        <div className="nav-label">WORKSPACE</div>
        <nav className="primary-nav">
          {[['Overview', LayoutDashboard], ['Ask AI', Sparkles], ['Data sources', Database]].map(([name, Icon]) => <button key={name} title={name} className={`nav-item ${activeNav === name ? 'selected' : ''}`} onClick={() => { setActiveNav(name); if (name === 'Data sources') setShowConnect(true); if (name === 'Ask AI') setAskOpen(true); }}><Icon size={17}/><span>{name}</span>{name === 'Data sources' && <span className="nav-count">1</span>}</button>)}
        </nav>
        <div className="nav-label recent-label">RECENT ANALYSES <button aria-label="More"><MoreHorizontal size={16}/></button></div>
        <div className="recent-list"><button className="recent-item active-recent"><span className="recent-icon"><BarChart3 size={15}/></span><span><b>Revenue overview</b><small>Today · 10:42 am</small></span></button><button className="recent-item"><span className="recent-icon"><TrendingUp size={15}/></span><span><b>Monthly growth</b><small>Yesterday</small></span></button><button className="recent-item"><span className="recent-icon"><Table2 size={15}/></span><span><b>Customer segments</b><small>Jun 12, 2025</small></span></button></div>
        <button className="add-source-link" onClick={() => setShowConnect(true)}><Plus size={15}/> Add a data source</button>
        <div className="nav-label">DISPLAY CONTROLS</div>
        <section className="display-controls" aria-label="Display controls">
          <div className="control-row">
            <span className="control-title"><Type size={13}/> Font size</span>
            <div className="font-stepper">
              <button onClick={() => changeScale(-SCALE_STEP)} disabled={appearance.scale <= MIN_SCALE} aria-label="Decrease font size"><Minus size={13}/></button>
              <output aria-live="polite">{Math.round(appearance.scale * 100)}%</output>
              <button onClick={() => changeScale(SCALE_STEP)} disabled={appearance.scale >= MAX_SCALE} aria-label="Increase font size"><Plus size={13}/></button>
            </div>
          </div>
          <div className="control-row control-row-stack">
            <span className="control-title"><Palette size={13}/> Page theme</span>
            <div className="theme-grid" role="radiogroup" aria-label="Page color theme">
              {THEMES.map((theme) => <button key={theme.id} role="radio" aria-checked={appearance.theme === theme.id} className={`theme-swatch ${appearance.theme === theme.id ? 'theme-active' : ''}`} onClick={() => setTheme(theme.id)} title={theme.label}><span className="swatch-dot" style={{ background: `linear-gradient(135deg, ${theme.swatch[0]} 55%, ${theme.swatch[1]} 55%)` }}/><small>{theme.label}</small></button>)}
            </div>
          </div>
          <button className="control-reset" onClick={() => setAppearance({ ...DEFAULT_APPEARANCE })} disabled={appearance.theme === DEFAULT_APPEARANCE.theme && appearance.scale === DEFAULT_APPEARANCE.scale}><RotateCcw size={12}/> Reset display</button>
        </section>
        </div>
        <div className="sidebar-foot">
        <div className="upgrade-card"><div className="upgrade-top"><span className="upgrade-icon"><Zap size={15}/></span><span>Get more from your data</span></div><p>Unlock unlimited analyses and connect all your data sources.</p><button onClick={() => setSourceMessage('Plan upgrades will be available soon.')}>Explore plans <ArrowUpRight size={14}/></button></div>
        {user.role === 'superuser' && <button className="admin-shortcut" title="Admin settings" onClick={() => setShowAdmin(true)}><Settings2 size={15}/> Admin settings <span><ShieldCheck size={12}/> SUPERUSER</span></button>}<button className="profile-row" title="Sign out" onClick={async () => { await apiRequest('/api/auth/logout', { method: 'POST' }).catch(() => {}); onLogout(); }}><span className="profile-avatar">{(user.name || user.email).slice(0, 2).toUpperCase()}</span><span className="profile-copy"><b>{user.name}</b><small>{user.email}</small></span><LogOut size={16}/></button>
        </div>
      </aside>

      <main className={`main-area ${collapsed ? 'main-collapsed' : ''}`}>
        <header className="topbar"><div className="breadcrumb"><button className="mobile-menu icon-btn" onClick={() => setMobileNav(true)} aria-label="Open menu"><Menu size={19}/></button><span>Workspace</span><ChevronRight size={14}/><b>{activeNav === 'Overview' ? 'Overview' : activeNav}</b></div><div className="top-actions"><div className="status-pill"><span/> All systems normal</div><button className="icon-btn search-btn" aria-label="Search"><Search size={18}/></button><button className="icon-btn" aria-label="Notifications"><Bell size={18}/><i className="notification-dot"/></button>{user.role === 'superuser' && <button className="top-admin-btn" onClick={() => setShowAdmin(true)}><Settings2 size={14}/><span>Admin</span></button>}<button className="help-btn"><CircleHelp size={17}/><span>Help</span></button></div></header>
        <div className="content-wrap">
          <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line"/> YOUR ANALYTICS WORKSPACE</div><h1>Good morning, Jamie <span className="wave">✳</span></h1><p>Here’s what’s happening with your data today.</p></div><button className="primary-btn heading-btn" onClick={() => setShowConnect(true)}><Plus size={17}/> Connect data</button></div>

          <section className="dataset-strip"><div className="dataset-left"><div className="sheet-icon"><FileSpreadsheet size={19}/></div><div className="dataset-title"><span>ACTIVE DATASET</span><strong>{datasetName}<ChevronDown size={15}/></strong></div><span className="connected-badge"><span/> Connected</span><span className="dataset-meta">{rows.length} rows <i/> Updated just now</span></div><div className="dataset-actions"><button className="text-action" onClick={() => fileRef.current?.click()}><Upload size={15}/> Upload file</button><span className="action-divider"/><button className="icon-btn small" aria-label="Dataset settings"><Settings2 size={17}/></button><button className="icon-btn small" aria-label="More dataset actions"><MoreHorizontal size={18}/></button></div><input ref={fileRef} className="visually-hidden" type="file" accept=".csv,text/csv" onChange={handleFile}/></section>

          <section className="metrics-grid">
            <article className="metric-card"><div className="metric-top"><span>Total {primaryKey?.replace(/_/g, ' ') || 'value'}</span><span className="metric-symbol purple"><TrendingUp size={16}/></span></div><div className="metric-value">{primaryKey && /revenue|sales|amount|value|profit/i.test(primaryKey) ? `$${formatNumber(total)}` : formatNumber(total)}</div><div className="metric-foot"><span className={`trend ${growth < 0 ? 'down' : ''}`}>{growth >= 0 ? <ArrowUpRight size={14}/> : <ArrowDownRight size={14}/>} {Math.abs(growth)}%</span><span>vs. first half</span><span className="metric-period">{range}</span></div><div className="sparkline"><svg viewBox="0 0 120 30" preserveAspectRatio="none"><path d="M0 23 C12 25 14 14 24 18 S39 22 48 12 S60 18 69 11 S81 15 89 8 S101 13 109 5 S115 6 120 2"/></svg></div></article>
            <article className="metric-card"><div className="metric-top"><span>Average per period</span><span className="metric-symbol blue"><BarChart3 size={16}/></span></div><div className="metric-value">{primaryKey && /revenue|sales|amount|value|profit/i.test(primaryKey) ? `$${formatNumber(avg)}` : formatNumber(avg)}</div><div className="metric-foot"><span className="metric-neutral"><CalendarDays size={13}/> {rows.length} periods</span><span className="metric-period">Average</span></div><div className="mini-bars">{rows.slice(-10).map((row, i) => <i key={i} style={{height: `${Math.max(17, ((Number(row[primaryKey]) || 0) / (Math.max(...rows.map(r => Number(r[primaryKey]) || 0)) || 1)) * 100)}%`}}/>)}</div></article>
            <article className="metric-card"><div className="metric-top"><span>Latest period</span><span className="metric-symbol green"><ArrowUpRight size={16}/></span></div><div className="metric-value">{latest[primaryKey] !== undefined ? (/revenue|sales|amount|value|profit/i.test(primaryKey) ? `$${formatNumber(latest[primaryKey])}` : formatNumber(latest[primaryKey])) : '—'}</div><div className="metric-foot"><span className={`trend ${monthlyChange < 0 ? 'down' : ''}`}>{monthlyChange >= 0 ? <ArrowUpRight size={14}/> : <ArrowDownRight size={14}/>} {Math.abs(monthlyChange)}%</span><span>vs. previous period</span><span className="metric-period">{latest.month || 'Latest'}</span></div><div className="latest-track"><span style={{width: `${Math.min(100, Math.max(8, (Number(latest[primaryKey]) / (Math.max(...rows.map(r => Number(r[primaryKey]) || 0)) || 1)) * 100))}%`}}/></div></article>
          </section>

          <section className="analysis-grid">
            <article className="panel chart-panel"><div className="panel-heading"><div><div className="panel-title"><h2>{primaryKey ? primaryKey.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase()) : 'Data'} over time</h2><button className="chart-menu icon-btn" aria-label="Chart options"><MoreHorizontal size={18}/></button></div><p>Track how your numbers are changing over time.</p></div><div className="chart-controls"><button className="filter-btn"><Filter size={14}/> All data</button><button className="range-btn" onClick={() => setRange(range === '12 months' ? 'All time' : '12 months')}>{range}<ChevronDown size={14}/></button></div></div><div className="chart-legend"><span className="legend-primary"><i/>{primaryKey?.replace(/_/g, ' ') || 'Value'}</span>{secondaryKey && <span className="legend-secondary"><i/>{secondaryKey.replace(/_/g, ' ')}</span>}</div><div className="chart-area"><ResponsiveContainer width="100%" height="100%"><AreaChart data={rows} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}><defs><linearGradient id="mainFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={chartTheme.primary} stopOpacity={0.2}/><stop offset="95%" stopColor={chartTheme.primary} stopOpacity={0}/></linearGradient></defs><CartesianGrid vertical={false} stroke={chartTheme.grid} strokeDasharray="3 5"/><XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: chartTheme.tick, fontSize: 11 * appearance.scale }} dy={10} interval={rows.length > 10 ? 0 : 'preserveStartEnd'}/><YAxis axisLine={false} tickLine={false} tick={{ fill: chartTheme.tick, fontSize: 11 * appearance.scale }} tickFormatter={(value) => value >= 1000 ? `${Math.round(value / 1000)}k` : value} width={40 * appearance.scale} dx={-3}/><Tooltip formatter={(value, name) => [formatNumber(value), name.replace(/_/g, ' ')]} contentStyle={{ background: chartTheme.tooltipBg, border: `1px solid ${chartTheme.tooltipBorder}`, borderRadius: 10, boxShadow: '0 8px 25px #00000018', fontSize: 12 * appearance.scale, color: chartTheme.text }} itemStyle={{ color: chartTheme.text }} labelStyle={{ color: chartTheme.tick, marginBottom: 4 }}/><Area type="monotone" dataKey={primaryKey} name={primaryKey || 'Value'} stroke={chartTheme.primary} strokeWidth={2.5} fill="url(#mainFill)" activeDot={{ r: 5, strokeWidth: 3, stroke: chartTheme.dotStroke }}/>{secondaryKey && <Line type="monotone" dataKey={secondaryKey} name={secondaryKey} stroke={chartTheme.secondary} strokeWidth={2} dot={false} activeDot={{ r: 4 }}/>}</AreaChart></ResponsiveContainer></div><div className="chart-footer"><span><span className="live-dot"/> Live dataset</span><button onClick={() => setActiveNav('Overview')}>View full report <ArrowUpRight size={14}/></button></div></article>

            <article className="panel ai-panel"><div className="ai-heading"><div className="ai-icon"><Sparkles size={17}/></div><div><h2>Ask your data</h2><p>{selectedModel ? `OpenRouter · ${selectedModel}` : 'Powered by your admin’s OpenRouter model'}</p></div>{user.role === 'superuser' && <button className="ai-model-settings" onClick={() => setShowAdmin(true)} aria-label="Configure AI model"><Settings2 size={14}/></button>}<span className="ai-ready"><i/> READY</span></div><div className="ai-divider"/>
              {answer ? <div className="answer-area"><div className="answer-label"><span className="answer-avatar"><Bot size={15}/></span><b>OPENROUTER ANALYSIS</b><button onClick={() => setAnswer('')}><X size={14}/></button></div><div className="answer-copy">{answer.split('\n').map((line, i) => line.startsWith('## ') ? <h3 key={i}>{line.slice(3)}</h3> : line.startsWith('### ') ? <h4 key={i}>{line.slice(4)}</h4> : line.startsWith('- ') ? <p className="answer-bullet" key={i}><span>•</span><span>{line.slice(2)}</span></p> : line.startsWith('1. ') || line.startsWith('2. ') || line.startsWith('3. ') ? <p className="answer-bullet" key={i}><span>{line.slice(0, 2)}</span><span>{line.slice(3)}</span></p> : line ? <p key={i}>{line.split(/(\*\*.*?\*\*|\*[^*]+\*)/g).map((part, j) => part.startsWith('**') ? <strong key={j}>{part.slice(2, -2)}</strong> : part.startsWith('*') && part.endsWith('*') ? <em key={j}>{part.slice(1, -1)}</em> : part)}</p> : <div className="answer-spacer" key={i}/> )}</div></div> : busy ? <div className="ai-loading"><span className="ai-loading-orbit"><Sparkles size={19}/></span><b>Analyzing your data…</b><span>Sending a limited data preview to your configured OpenRouter model.</span></div> : <><div className="ai-welcome"><div className="welcome-orbit"><Sparkles size={21}/></div><h3>Let’s find your next insight.</h3><p>Ask a question in plain English. I’ll dig into the numbers and show you what matters.</p></div><div className="suggestion-list">{suggestions.map(({icon: Icon, text}) => <button key={text} onClick={() => submitAnalysis(text)}><Icon size={14}/><span>{text}</span><ArrowUpRight size={13}/></button>)}</div></>}
              <form className="prompt-box" onSubmit={(e) => { e.preventDefault(); submitAnalysis(); }}><textarea value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ask anything about your data..." rows={2} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitAnalysis(); } }}/><div className="prompt-tools"><button type="button" className="attach-btn" onClick={() => fileRef.current?.click()}><Paperclip size={15}/><span>Attach data</span></button><span className="prompt-shortcut">↵ to send</span><button className="send-btn" type="submit" disabled={!query.trim() || busy} aria-label="Send prompt">{busy ? <LoaderCircle className="spin" size={16}/> : <Send size={15}/>}</button></div></form>
              {serverError && <div className="ai-error" role="alert">{serverError}{user.role === 'superuser' && <button onClick={() => setShowAdmin(true)}>Configure OpenRouter</button>}</div>}<div className="ai-disclaimer"><Sparkles size={12}/> AI can make mistakes. Verify important results.</div>
            </article>
          </section>

          <section className="bottom-grid"><article className="panel data-panel"><div className="bottom-panel-head"><div><div className="section-kicker">YOUR DATA</div><h2>Dataset preview</h2></div><div className="preview-actions"><button className="filter-btn"><Filter size={14}/> Filter</button><button className="text-action" onClick={() => fileRef.current?.click()}>View all <ArrowUpRight size={14}/></button></div></div><div className="table-scroll"><table><thead><tr>{Object.keys(rows[0] || {}).slice(0, 5).map((key) => <th key={key}>{key.replace(/_/g, ' ')}</th>)}</tr></thead><tbody>{rows.slice(0, 5).map((row, i) => <tr key={i}>{Object.keys(rows[0] || {}).slice(0, 5).map((key, j) => <td key={key}>{j > 0 && typeof row[key] === 'number' ? formatNumber(row[key]) : row[key]}</td>)}</tr>)}</tbody></table></div><div className="table-foot"><span>Showing <b>{Math.min(5, rows.length)}</b> of <b>{rows.length}</b> rows</span><button onClick={() => setRows(sampleRows)}>Reset to sample data <ArrowDownRight size={13}/></button></div></article><article className="panel insight-card"><div className="insight-heading"><span className="insight-icon"><Zap size={16}/></span><div><span className="section-kicker">QUICK INSIGHT</span><h2>A strong finish to the year</h2></div></div><p>{latest.month || 'Your latest period'} is your highest recorded period at <b>{primaryKey && /revenue|sales|amount|value|profit/i.test(primaryKey) ? '$' : ''}{formatNumber(Math.max(...rows.map(r => Number(r[primaryKey]) || 0)))}</b>. That’s a great signal heading into your next planning cycle.</p><button onClick={() => submitAnalysis('Why was the latest period so strong?')}>Explore this insight <ArrowUpRight size={14}/></button><div className="insight-decoration"><Sparkles size={73}/></div></article></section>
          <footer className="footer"><span>© 2025 Insightful Analytics</span><div><button>Privacy</button><button>Terms</button><button><MessageSquareText size={13}/> Feedback</button></div><span className="footer-version">Made for curious minds <span>✳</span></span></footer>
        </div>
      </main>

      <AskFloating open={askOpen} onToggle={() => setAskOpen((v) => !v)} onClose={() => setAskOpen(false)} query={query} setQuery={setQuery} answer={answer} setAnswer={setAnswer} busy={busy} error={serverError} onSubmit={submitAnalysis} suggestions={suggestions} model={selectedModel ? `OpenRouter · ${selectedModel}` : ''} canConfigure={user.role === 'superuser'} onConfigure={() => setShowAdmin(true)} />
      {showAdmin && user.role === 'superuser' && <AdminPanel user={user} onUserUpdate={onUserUpdate} onClose={() => setShowAdmin(false)} />}
      {showConnect && <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) { setShowConnect(false); setSourceMessage(''); } }}><div className="connect-modal"><div className="modal-head"><div><div className="modal-icon"><Database size={19}/></div><h2>Connect your data</h2><p>Bring your data in to start exploring with AI.</p></div><button className="icon-btn" onClick={() => { setShowConnect(false); setSourceMessage(''); }} aria-label="Close"><X size={19}/></button></div><div className="source-options">{[['Google Sheets', FileSpreadsheet], ['Google Drive', CloudUpload], ['Database', Database], ['CSV file', FileText]].map(([name, Icon]) => <button key={name} className={`source-option ${sourceType === name ? 'source-selected' : ''}`} onClick={() => { setSourceType(name); setSourceMessage(''); }}><Icon size={18}/><span>{name}</span>{sourceType === name && <Check size={15}/>}</button>)}</div><form onSubmit={connectSource}><label htmlFor="source-url">{sourceType === 'Database' ? 'Connection URL' : sourceType === 'CSV file' ? 'File link or upload below' : `${sourceType} link`}</label><div className="url-field"><Link2 size={16}/><input id="source-url" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder={sourceType === 'Database' ? 'postgresql://host:5432/database' : 'Paste a shareable link'} /></div>{sourceType === 'CSV file' && <button type="button" className="modal-upload" onClick={() => { setShowConnect(false); fileRef.current?.click(); }}><Upload size={15}/> Choose a CSV file</button>}<div className="secure-note"><span><Check size={13}/></span> Your data stays yours. Credentials should be stored securely on your server.</div>{sourceMessage && <p className="source-message">{sourceMessage}</p>}<button className="primary-btn modal-submit" type="submit">Continue <ArrowUpRight size={15}/></button></form><div className="modal-foot">Need help connecting? <button onClick={() => setSourceMessage('For live connections, set up a server-side integration for your chosen data provider. Never expose database credentials in the browser.')}>View setup guide <ArrowUpRight size={13}/></button></div></div></div>}
    </div>
  );
}

export default App;
