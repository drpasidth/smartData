import React, { useState } from 'react';
import { Activity, ArrowRight, Eye, EyeOff, LoaderCircle, LockKeyhole, ShieldCheck, Sparkles } from 'lucide-react';

export async function apiRequest(path, options = {}) {
  let response;
  try {
    response = await fetch(path, {
      ...options,
      credentials: 'same-origin',
      headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
    });
  } catch {
    throw new Error('Cannot reach the application server. Start it with npm run dev.');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status}).`);
  return data;
}

export function LoginScreen({ onLogin }) {
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

  return <main className="auth-page"><div className="auth-backdrop auth-glow-one"/><div className="auth-backdrop auth-glow-two"/><section className="auth-card"><a className="auth-brand" href="/"><span className="auth-brand-mark"><Activity size={19}/></span><span>insightful<span>.</span></span></a><div className="auth-kicker"><span/><ShieldCheck size={13}/> PRIVATE ANALYTICS WORKSPACE</div><h1>{isFirstRun ? <>Set up your<br/>superuser account.</> : <>Good to see you<br/>again.</>}</h1><p className="auth-subtitle">{isFirstRun ? 'Create the first administrator to secure this workspace.' : 'Sign in to continue exploring your data.'}</p><form className="auth-form" onSubmit={submit}>{isFirstRun && <><label htmlFor="setup-name">Your name</label><input id="setup-name" type="text" autoComplete="name" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="Workspace Admin"/></>}<label htmlFor="login-email">Email address</label><input id="login-email" type="email" autoComplete="username" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com"/>{isFirstRun && <><label htmlFor="setup-key">One-time setup key</label><input id="setup-key" type="password" autoComplete="off" required value={setupKey} onChange={(e) => setSetupKey(e.target.value)} placeholder="Enter ADMIN_SETUP_KEY"/></>}<label htmlFor="login-password">{isFirstRun ? 'Create password (12+ characters)' : 'Password'}</label><div className="auth-password"><input id="login-password" type={showPassword ? 'text' : 'password'} autoComplete={isFirstRun ? 'new-password' : 'current-password'} required minLength={isFirstRun ? 12 : undefined} maxLength={isFirstRun ? 128 : 256} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={isFirstRun ? 'Use a unique password' : 'Enter your password'}/><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></div>{error && <div className="auth-error" role="alert">{error}</div>}<button className="auth-submit" type="submit" disabled={busy || hasSuperuser === null}>{busy ? <LoaderCircle className="spin" size={17}/> : <>{isFirstRun ? 'Create superuser' : 'Sign in securely'} <ArrowRight size={16}/></>}</button></form><div className="auth-security"><LockKeyhole size={14}/><span>{isFirstRun ? 'First-run setup is protected by a one-time server key.' : 'Protected sign-in with encrypted, HttpOnly sessions.'}</span></div><div className="auth-footer"><Sparkles size={13}/> Thoughtful answers start with good data.</div></section><div className="auth-side-note">An insightful view of what matters.<span>✳</span></div></main>;
}
