import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { apiRequest, LoginScreen } from './Auth.jsx';
import './styles.css';
import './auth-admin.css';
import './extras.css';
import './data-source.css';
import { applyAppearance, loadAppearance } from './appearance.js';
import { I18nProvider } from './i18n.jsx';

// Apply the saved theme/font size before first paint (also covers the sign-in page).
applyAppearance(loadAppearance());

function Root() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    apiRequest('/api/auth/me')
      .then(({ user: currentUser }) => setUser(currentUser))
      .catch(() => setUser(null))
      .finally(() => setReady(true));
  }, []);

  if (!ready) return <div className="app-loading"><span className="auth-brand-mark"><span>✳</span></span><div className="loading-line"/></div>;
  if (!user) return <LoginScreen onLogin={setUser} />;
  return <App user={user} onUserUpdate={setUser} onLogout={() => setUser(null)} />;
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode><I18nProvider><Root /></I18nProvider></React.StrictMode>
);
