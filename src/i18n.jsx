import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { th, patterns } from './i18n-th.js';

// Lightweight Thai/English switch. English strings are the translation keys, so a
// missing Thai entry just falls back to English.

const STORAGE_KEY = 'insightful.lang';
export const LANGS = [
  { id: 'en', label: 'EN', name: 'English' },
  { id: 'th', label: 'ไทย', name: 'ภาษาไทย' },
];

function detectLang() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'th') return saved;
  } catch { /* storage unavailable */ }
  return (typeof navigator !== 'undefined' && (navigator.language || '').toLowerCase().startsWith('th')) ? 'th' : 'en';
}

let currentLang = detectLang();
if (typeof document !== 'undefined') document.documentElement.lang = currentLang;

export const getLang = () => currentLang;

const fill = (text, params) => (params ? text.replace(/\{(\w+)\}/g, (match, key) => (params[key] !== undefined ? String(params[key]) : match)) : text);

// Translate outside React (e.g. API errors). Uses the language last selected.
export function translate(text, params, lang = currentLang) {
  if (typeof text !== 'string') return text;
  if (lang === 'th') {
    if (th[text] !== undefined) return fill(th[text], params);
    for (const [pattern, output] of patterns) {
      const match = text.match(pattern);
      if (match) return output.replace(/\$(\d)/g, (_, index) => match[Number(index)] ?? '');
    }
  }
  return fill(text, params);
}

const I18nContext = createContext({ lang: 'en', setLang: () => {}, t: (text, params) => fill(text, params) });

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(currentLang);
  const setLang = useCallback((next) => {
    if (next !== 'en' && next !== 'th') return;
    currentLang = next;
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* ignore */ }
    setLangState(next);
  }, []);
  useEffect(() => { currentLang = lang; document.documentElement.lang = lang; }, [lang]);
  const t = useCallback((text, params) => translate(text, params, lang), [lang]);
  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);

// Small EN | ไทย toggle.
export function LanguageSwitch({ className = '' }) {
  const { lang, setLang, t } = useI18n();
  return (
    <div className={`lang-switch ${className}`} role="group" aria-label={t('Language')}>
      {LANGS.map((item) => (
        <button key={item.id} type="button" className={lang === item.id ? 'lang-active' : ''} aria-pressed={lang === item.id} title={item.name} onClick={() => setLang(item.id)}>{item.label}</button>
      ))}
    </div>
  );
}
