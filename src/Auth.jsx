import React, { useState } from 'react';
import { Activity, ArrowRight, Eye, EyeOff, LoaderCircle, LockKeyhole, ShieldCheck, Sparkles } from 'lucide-react';
import { LanguageSwitch, translate, useI18n } from './i18n.jsx';

// ---- Data-loading tracker: every read request is registered here so the UI can show
// a spinner and a Cancel Loading button, and Cancel aborts all of them at once.
const activeLoads = new Set();
const loadListeners = new Set();
const notifyLoads = () => loadListeners.forEach((fn) => fn());
export const subscribeLoads = (fn) => { loadListeners.add(fn); return () => loadListeners.delete(fn); };
export const getLoadCount = () => activeLoads.size;
export function cancelAllLoads() { [...activeLoads].forEach((controller) => controller.abort()); }

// track: true/false forces it; by default GET requests and POST .../inspect (reads) are tracked.
export async function apiRequest(path, options = {}) {
  const { track, ...init } = options;
  const method = (init.method || 'GET').toUpperCase();
  const tracked = track ?? (method === 'GET' || path.endsWith('/inspect'));
  const controller = tracked ? new AbortController() : null;
  if (controller) {
    activeLoads.add(controller);
    notifyLoads();
    if (init.signal) init.signal.addEventListener('abort', () => controller.abort(), { once: true });
  }
  const signal = controller ? controller.signal : init.signal;
  const cancelled = () => Object.assign(new Error('Loading cancelled.'), { name: 'AbortError' });
  try {
    let response;
    try {
      response = await fetch(path, {
        ...init,
        signal,
        credentials: 'same-origin',
        headers: { ...(init.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
      });
    } catch (error) {
      if (error?.name === 'AbortError') throw cancelled();
      throw new Error('Cannot reach the application server. Start it with npm run dev.');
    }
    const data = await response.json().catch(() => {
      if (signal?.aborted) throw cancelled();
      return {};
    });
    if (!response.ok) throw new Error(data.error || `Request failed (${response.status}).`);
    return data;
  } finally {
    if (controller) { activeLoads.delete(controller); notifyLoads(); }
  }
}

export function LoginScreen({ onLogin }) {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [setupKey, setSetupKey] = useState('');
  const [hasSuperuser, setHasSuperuser] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  React.useEffect(() => {
    apiRequest('/api/bootstrap/status').then((data) => setHasSuperuser(data.hasSuperuser)).catch(() => setHasSuperuser(true));
  }, []);

  const isFirstRun = hasSuperuser === false;
  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const data = isFirstRun
        ? await apiRequest('/api/bootstrap/superuser', { method: 'POST', body: JSON.stringify({ name, email, password, setupKey }) })
        : await apiRequest('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      onLogin(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-page">
      <div className="auth-backdrop auth-glow-one"/><div className="auth-backdrop auth-glow-two"/>
      <LanguageSwitch className="lang-switch-floating" />
      <section className="auth-card">
        <a className="auth-brand" href="/"><span className="auth-brand-mark"><Activity size={19}/></span><span>insightful<span>.</span></span></a>
        <div className="auth-kicker"><span/><ShieldCheck size={13}/> {t('PRIVATE ANALYTICS WORKSPACE')}</div>
        <h1>{isFirstRun ? <>{t('Set up your')}<br/>{t('superuser account.')}</> : <>{t('Good to see you')}<br/>{t('again.')}</>}</h1>
        <p className="auth-subtitle">{isFirstRun ? t('Create the first administrator to secure this workspace.') : t('Sign in to continue exploring your data.')}</p>
        <form className="auth-form" onSubmit={submit}>
          {isFirstRun && <><label htmlFor="setup-name">{t('Your name')}</label><input id="setup-name" type="text" autoComplete="name" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder={t('Workspace Admin')}/></>}
          <label htmlFor="login-email">{t('Email address')}</label>
          <input id="login-email" type="email" autoComplete="username" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com"/>
          {isFirstRun && <><label htmlFor="setup-key">{t('One-time setup key')}</label><input id="setup-key" type="password" autoComplete="off" required value={setupKey} onChange={(e) => setSetupKey(e.target.value)} placeholder={t('Enter ADMIN_SETUP_KEY')}/></>}
          <label htmlFor="login-password">{isFirstRun ? t('Create password (12+ characters)') : t('Password')}</label>
          <div className="auth-password">
            <input id="login-password" type={showPassword ? 'text' : 'password'} autoComplete={isFirstRun ? 'new-password' : 'current-password'} required minLength={isFirstRun ? 12 : undefined} maxLength={isFirstRun ? 128 : 256} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={isFirstRun ? t('Use a unique password') : t('Enter your password')}/>
            <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? t('Hide password') : t('Show password')}>{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button>
          </div>
          {error && <div className="auth-error" role="alert">{translate(error)}</div>}
          <button className="auth-submit" type="submit" disabled={busy || hasSuperuser === null}>{busy ? <LoaderCircle className="spin" size={17}/> : <>{isFirstRun ? t('Create superuser') : t('Sign in securely')} <ArrowRight size={16}/></>}</button>
        </form>
        <div className="auth-security"><LockKeyhole size={14}/><span>{isFirstRun ? t('First-run setup is protected by a one-time server key.') : t('Protected sign-in with encrypted, HttpOnly sessions.')}</span></div>
        <div className="auth-footer"><Sparkles size={13}/> {t('Thoughtful answers start with good data.')}</div>
      </section>
      <div className="auth-side-note">{t('An insightful view of what matters.')}<span>✳</span></div>
    </main>
  );
}

