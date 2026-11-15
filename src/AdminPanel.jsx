import React, { useEffect, useState } from 'react';
import { ArrowDownRight, Check, Database, Eye, EyeOff, KeyRound, LoaderCircle, LockKeyhole, Plus, RefreshCw, Save, Settings2, ShieldCheck, UserRound, Users, X } from 'lucide-react';
import { apiRequest } from './Auth.jsx';

const defaultModels = ['openai/gpt-4o-mini', 'openai/gpt-4o', 'anthropic/claude-3.7-sonnet', 'google/gemini-2.5-flash-preview', 'deepseek/deepseek-chat-v3-0324', 'meta-llama/llama-3.3-70b-instruct'];

export default function AdminPanel({ onClose, onUserUpdate, user }) {
  const [settings, setSettings] = useState(null);
  const [databaseSettings, setDatabaseSettings] = useState(null);
  const [databaseForm, setDatabaseForm] = useState({ type: 'sqlite3', filename: 'data/app.db', host: '', port: '3306', database: '', user: '', password: '', ssl: false });
  const [databaseBusy, setDatabaseBusy] = useState(false);
  const [users, setUsers] = useState([]);
  const [modelList, setModelList] = useState(defaultModels.map((id) => ({ id, name: id })));
  const [model, setModel] = useState(defaultModels[0]);
  const [customModel, setCustomModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [keyVisible, setKeyVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showAddUser, setShowAddUser] = useState(false);
  const [accountName, setAccountName] = useState(user.name || '');
  const [accountEmail, setAccountEmail] = useState(user.email || '');
  const [accountCurrentPassword, setAccountCurrentPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [nextPassword, setNextPassword] = useState('');
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  const load = async () => {
    setError('');
    try {
      const [config, accounts, databaseConfig] = await Promise.all([apiRequest('/api/admin/settings'), apiRequest('/api/admin/users'), apiRequest('/api/admin/database')]);
      setDatabaseSettings(databaseConfig.database);
      setDatabaseForm((form) => ({ ...form, ...databaseConfig.database, type: databaseConfig.database.type, password: '' }));
      setSettings(config);
      setModel(config.model);
      setUsers(accounts.users);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const changeDatabaseField = (field, value) => setDatabaseForm((form) => ({ ...form, [field]: value }));
  const testDatabase = async () => {
    setDatabaseBusy(true); setError(''); setMessage('');
    try { const result = await apiRequest('/api/admin/database/test', { method: 'POST', body: JSON.stringify({ ...databaseForm, port: Number(databaseForm.port) || undefined }) }); setMessage(result.message); }
    catch (err) { setError(err.message); }
    finally { setDatabaseBusy(false); }
  };
  const saveDatabase = async (event) => {
    event.preventDefault(); setDatabaseBusy(true); setError(''); setMessage('');
    try {
      const result = await apiRequest('/api/admin/database', { method: 'PUT', body: JSON.stringify({ ...databaseForm, port: Number(databaseForm.port) || undefined }) });
      setDatabaseSettings(result.database); setDatabaseForm((form) => ({ ...form, ...result.database, password: '' })); setMessage(`Database connection saved. New application data will use ${result.database.type}.`);
    } catch (err) { setError(err.message); }
    finally { setDatabaseBusy(false); }
  };

  const refreshModels = async () => {
    setRefreshing(true); setError('');
    try {
      const data = await apiRequest('/api/ai/models');
      if (!data.models.length) throw new Error('OpenRouter did not return available models.');
      setModelList(data.models);
      setMessage(`Loaded ${data.models.length} models from your OpenRouter account.`);
    } catch (err) { setError(err.message); }
    finally { setRefreshing(false); }
  };

  const saveSettings = async (event) => {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      const data = await apiRequest('/api/admin/settings', { method: 'PUT', body: JSON.stringify({ model: customModel.trim() || model, ...(apiKey.trim() ? { openRouterApiKey: apiKey.trim() } : {}) }) });
      setSettings((current) => ({ ...current, ...data })); setModel(data.model); setCustomModel(''); setApiKey(''); setMessage('OpenRouter settings saved securely on the server.');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const addUser = async (event) => {
    event.preventDefault(); setError(''); setMessage(''); setBusy(true);
    try {
      const data = await apiRequest('/api/admin/users', { method: 'POST', body: JSON.stringify({ name: newName, email: newEmail, password: newPassword }) });
      setUsers((current) => [...current, data.user]); setNewName(''); setNewEmail(''); setNewPassword(''); setShowAddUser(false); setMessage(`Account created for ${data.user.email}.`);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const toggleUser = async (account) => {
    setError(''); setMessage('');
    try {
      const data = await apiRequest(`/api/admin/users/${account.id}`, { method: 'PATCH', body: JSON.stringify({ active: !account.active }) });
      setUsers((current) => current.map((userItem) => userItem.id === data.user.id ? data.user : userItem));
      setMessage(`${data.user.email} ${data.user.active ? 'enabled' : 'disabled'}.`);
    } catch (err) { setError(err.message); }
  };

  const updateAccount = async (event) => {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      const data = await apiRequest('/api/admin/account', { method: 'PUT', body: JSON.stringify({ name: accountName, email: accountEmail, currentPassword: accountCurrentPassword }) });
      onUserUpdate?.(data.user); setAccountCurrentPassword(''); setMessage('Superuser account details updated.');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const updatePassword = async (event) => {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      await apiRequest('/api/admin/password', { method: 'PUT', body: JSON.stringify({ currentPassword, newPassword: nextPassword }) });
      setCurrentPassword(''); setNextPassword(''); setShowPasswordForm(false); setMessage('Superuser password updated.');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const models = [...new Map([...modelList, ...(model && !modelList.some((item) => item.id === model) ? [{ id: model, name: model }] : [])].map((item) => [item.id, item])).values()];

  return <div className="modal-backdrop admin-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="admin-heading"><header className="admin-header"><div className="admin-header-icon"><Settings2 size={20}/></div><div><h2 id="admin-heading">Admin settings</h2><p>Manage OpenRouter, models and workspace users.</p></div><button className="icon-btn" onClick={onClose} aria-label="Close admin settings"><X size={19}/></button></header>{loading ? <div className="admin-loading"><LoaderCircle className="spin" size={20}/> Loading admin settings…</div> : <><div className="admin-who"><span><ShieldCheck size={14}/></span><div><b>{user.name}</b><small>Superuser · {user.email}</small></div><span className="admin-secure">SERVER-SECURED</span></div>{error && <div className="admin-message admin-message-error" role="alert">{error}</div>}{message && <div className="admin-message admin-message-success" role="status"><Check size={14}/>{message}</div>}
    <section className="admin-section"><div className="admin-section-title"><span className="admin-section-icon"><Database size={16}/></span><div><h3>Application database</h3><p>Select the database used for workspace accounts, settings, and app data.</p></div></div><form onSubmit={saveDatabase}><label className="admin-label" htmlFor="database-type">Database engine</label><select className="admin-text-input" id="database-type" value={databaseForm.type} onChange={(e) => { const type = e.target.value; changeDatabaseField('type', type); if (type === 'mysql') changeDatabaseField('port', '3306'); if (type === 'postgresql') changeDatabaseField('port', '5432'); }}><option value="sqlite3">SQLite3 (local file)</option><option value="mysql">MySQL</option><option value="postgresql">PostgreSQL</option></select>{databaseForm.type === 'sqlite3' ? <><label className="admin-label" htmlFor="sqlite-filename">SQLite database file</label><input className="admin-text-input" id="sqlite-filename" required value={databaseForm.filename || ''} onChange={(e) => changeDatabaseField('filename', e.target.value)} placeholder="data/app.db"/><div className="admin-help">Use an absolute path or a path relative to the server data directory. Existing application data is copied when you switch databases.</div></> : <><div className="admin-model-row"><div style={{flex:1}}><label className="admin-label" htmlFor="db-host">Host</label><input className="admin-text-input" id="db-host" required value={databaseForm.host || ''} onChange={(e) => changeDatabaseField('host', e.target.value)} placeholder="localhost"/></div><div style={{width:95}}><label className="admin-label" htmlFor="db-port">Port</label><input className="admin-text-input" id="db-port" type="number" required min="1" max="65535" value={databaseForm.port || ''} onChange={(e) => changeDatabaseField('port', e.target.value)}/></div></div><label className="admin-label" htmlFor="db-name">Database name</label><input className="admin-text-input" id="db-name" required value={databaseForm.database || ''} onChange={(e) => changeDatabaseField('database', e.target.value)} placeholder="analytics"/><label className="admin-label" htmlFor="db-user">Username</label><input className="admin-text-input" id="db-user" required value={databaseForm.user || ''} onChange={(e) => changeDatabaseField('user', e.target.value)} placeholder="Database user"/><label className="admin-label" htmlFor="db-password">Password <span>{databaseSettings?.passwordHint && databaseSettings.type === databaseForm.type ? 'Saved · leave blank to keep' : 'Required'}</span></label><input className="admin-text-input" id="db-password" type="password" autoComplete="new-password" value={databaseForm.password || ''} onChange={(e) => changeDatabaseField('password', e.target.value)} placeholder={databaseSettings?.passwordHint && databaseSettings.type === databaseForm.type ? 'Leave blank to keep saved password' : 'Database password'} required={!(databaseSettings?.passwordHint && databaseSettings.type === databaseForm.type)}/><label className="admin-label"><span><input type="checkbox" checked={databaseForm.ssl === true} onChange={(e) => changeDatabaseField('ssl', e.target.checked)}/> Use TLS/SSL</span></label></>}<div className="admin-help">Database passwords are encrypted with the server ENCRYPTION_KEY. Keep a private backup before switching databases.</div><div className="admin-model-row"><button className="admin-refresh" type="button" onClick={testDatabase} disabled={databaseBusy}>{databaseBusy ? <LoaderCircle className="spin" size={14}/> : <Check size={14}/>}<span>Test connection</span></button><button className="admin-save" type="submit" disabled={databaseBusy}>{databaseBusy ? <LoaderCircle className="spin" size={15}/> : <Save size={15}/>} Save and switch</button></div></form></section>
    <section className="admin-section"><div className="admin-section-title"><span className="admin-section-icon"><ShieldCheck size={16}/></span><div><h3>Superuser account</h3><p>Update the name and email shown for your administrator account.</p></div></div><form onSubmit={updateAccount}><label className="admin-label" htmlFor="superuser-name">Name</label><input className="admin-text-input" id="superuser-name" required maxLength={80} value={accountName} onChange={(e) => setAccountName(e.target.value)}/><label className="admin-label" htmlFor="superuser-email">Email address</label><input className="admin-text-input" id="superuser-email" type="email" required maxLength={254} value={accountEmail} onChange={(e) => setAccountEmail(e.target.value)}/><label className="admin-label" htmlFor="account-current-password">Confirm with current password</label><input className="admin-text-input" id="account-current-password" type="password" required autoComplete="current-password" value={accountCurrentPassword} onChange={(e) => setAccountCurrentPassword(e.target.value)}/><button className="admin-save" type="submit" disabled={busy}>{busy ? <LoaderCircle className="spin" size={15}/> : <Save size={15}/>} Save account details</button></form></section>
    <section className="admin-section"><div className="admin-section-title"><span className="admin-section-icon"><KeyRound size={16}/></span><div><h3>OpenRouter provider</h3><p>Set a server-side API key and default analysis model.</p></div></div><form onSubmit={saveSettings}><label className="admin-label" htmlFor="openrouter-key">API key <span>{settings?.openRouterConfigured ? `Configured · ${settings.openRouterKeyHint}` : 'Not configured'}</span></label><div className="admin-input-wrap"><KeyRound size={15}/><input id="openrouter-key" type={keyVisible ? 'text' : 'password'} autoComplete="new-password" spellCheck="false" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={settings?.openRouterConfigured ? 'Leave blank to keep current key' : 'sk-or-v1-…'}/><button type="button" aria-label={keyVisible ? 'Hide API key' : 'Show API key'} onClick={() => setKeyVisible(!keyVisible)}>{keyVisible ? <EyeOff size={15}/> : <Eye size={15}/>}</button></div><div className="admin-help">The key is stored only by the API server; it is never returned to the browser.</div><label className="admin-label" htmlFor="default-model">Default model</label><div className="admin-model-row"><select id="default-model" value={model} onChange={(e) => setModel(e.target.value)}>{models.map((item) => <option key={item.id} value={item.id}>{item.name ? `${item.name} (${item.id})` : item.id}</option>)}</select><button className="admin-refresh" type="button" onClick={refreshModels} disabled={refreshing || !settings?.openRouterConfigured} title="Load models from OpenRouter">{refreshing ? <LoaderCircle className="spin" size={15}/> : <RefreshCw size={15}/>}<span>Refresh models</span></button></div><label className="admin-label" htmlFor="custom-model">Custom model ID <span>Optional</span></label><input className="admin-text-input" id="custom-model" value={customModel} onChange={(e) => setCustomModel(e.target.value)} placeholder="e.g. provider/model-name"/><button className="admin-save" type="submit" disabled={busy}>{busy ? <LoaderCircle className="spin" size={15}/> : <Save size={15}/>} Save OpenRouter settings</button></form></section>
    <section className="admin-section user-admin-section"><div className="admin-section-title"><span className="admin-section-icon"><Users size={16}/></span><div><h3>Workspace users <span className="user-count">{users.filter((item) => item.role === 'user').length}</span></h3><p>Create accounts and enable or disable access.</p></div><button className="admin-add-user" onClick={() => { setShowAddUser(!showAddUser); setError(''); }}><Plus size={14}/><span>Add user</span></button></div>{showAddUser && <form className="add-user-form" onSubmit={addUser}><div className="add-user-fields"><input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Full name" maxLength={80}/><input type="email" required value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="Email address" maxLength={254}/><input type="password" required minLength={12} maxLength={128} autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Temporary password (12+ characters)"/></div><div className="add-user-actions"><span>New accounts are standard users, not admins.</span><button type="submit" disabled={busy}>{busy ? <LoaderCircle className="spin" size={14}/> : <Plus size={14}/>} Create account</button></div></form>}<div className="admin-user-list">{users.map((account) => <div className="admin-user-row" key={account.id}><span className="user-avatar"><UserRound size={15}/></span><div className="admin-user-name"><b>{account.name}</b><small>{account.email}</small></div><span className={`role-tag ${account.role === 'superuser' ? 'role-admin' : ''}`}>{account.role}</span>{account.role === 'user' ? <button className={`user-toggle ${account.active ? 'user-enabled' : 'user-disabled'}`} onClick={() => toggleUser(account)}>{account.active ? 'Active' : 'Disabled'}</button> : <span className="superuser-lock"><LockKeyhole size={13}/></span>}</div>)}</div></section>
    <section className="admin-section password-section"><button className="password-toggle" onClick={() => { setShowPasswordForm(!showPasswordForm); setError(''); }}><span className="admin-section-icon"><LockKeyhole size={15}/></span><span><b>Change superuser password</b><small>Use a unique password of at least 12 characters.</small></span><ArrowDownRight size={16}/></button>{showPasswordForm && <form className="password-form" onSubmit={updatePassword}><input type="password" required autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Current password"/><input type="password" required minLength={12} maxLength={128} autoComplete="new-password" value={nextPassword} onChange={(e) => setNextPassword(e.target.value)} placeholder="New password (12+ characters)"/><button className="admin-save" type="submit" disabled={busy}>{busy ? <LoaderCircle className="spin" size={15}/> : <Save size={15}/>} Update password</button></form>}</section></>}</section></div>;
}
