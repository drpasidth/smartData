import React, { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Bot, Check, Copy, LoaderCircle, Send, Settings2, Sparkles, X } from 'lucide-react';
import { useI18n } from './i18n.jsx';

// Copies text to the clipboard, falling back to a hidden textarea when the Clipboard API is unavailable.
function copyText(text, setCopied) {
  const done = () => { setCopied(true); setTimeout(() => setCopied(false), 1500); };
  const fallback = () => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { if (document.execCommand('copy')) done(); } catch { /* copy unsupported */ }
    ta.remove();
  };
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done, fallback);
  else fallback();
}

export function AnswerContent({ answer }) {
  return (
    <div className="answer-copy">{answer.split('\n').map((line, i) => line.startsWith('## ') ? <h3 key={i}>{line.slice(3)}</h3> : line.startsWith('### ') ? <h4 key={i}>{line.slice(4)}</h4> : line.startsWith('- ') ? <p className="answer-bullet" key={i}><span>•</span><span>{line.slice(2)}</span></p> : line.startsWith('1. ') || line.startsWith('2. ') || line.startsWith('3. ') ? <p className="answer-bullet" key={i}><span>{line.slice(0, 2)}</span><span>{line.slice(3)}</span></p> : line ? <p key={i}>{line.split(/(\*\*.*?\*\*|\*[^*]+\*)/g).map((part, j) => part.startsWith('**') ? <strong key={j}>{part.slice(2, -2)}</strong> : part.startsWith('*') && part.endsWith('*') ? <em key={j}>{part.slice(1, -1)}</em> : part)}</p> : <div className="answer-spacer" key={i}/>)}</div>
  );
}

// Floating "Ask AI" button (bottom right) that opens a compact chat popover.
export default function AskFloating({ open, onToggle, onClose, query, setQuery, answer, setAnswer, busy, error, onSubmit, suggestions, model, canConfigure, onConfigure, charts = [], focusId = '', onFocus }) {
  const inputRef = useRef(null);
  const [copied, setCopied] = useState(false);
  const { t } = useI18n();

  useEffect(() => {
    if (!open) return undefined;
    inputRef.current?.focus();
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <>
      {open && (
        <section className="ask-pop" role="dialog" aria-label={t('Ask AI')}>
          <header className="ask-pop-head">
            <span className="ask-pop-icon"><Sparkles size={16}/></span>
            <div><h2>{t('Ask AI')}</h2><p>{model ? model : t('Ask questions about your active dataset')}</p></div>
            {canConfigure && <button className="ask-pop-btn" onClick={onConfigure} aria-label={t('Configure AI model')}><Settings2 size={14}/></button>}
            <button className="ask-pop-btn" onClick={onClose} aria-label={t('Close Ask AI')}><X size={15}/></button>
          </header>
          <div className="ask-pop-body">
            {answer ? (
              <>
                <div className="answer-label"><span className="answer-avatar"><Bot size={15}/></span><b>{t('AI ANALYSIS')}</b><button onClick={() => copyText(answer, setCopied)} aria-label={t('Copy answer')} title={t('Copy answer')}>{copied ? <Check size={14}/> : <Copy size={14}/>}</button><button onClick={() => setAnswer('')} aria-label={t('Clear answer')}><X size={14}/></button></div>
                <div className="answer-selectable"><AnswerContent answer={answer} /></div>
              </>
            ) : busy ? (
              <div className="ask-pop-empty"><span className="ai-loading-orbit"><Sparkles size={19}/></span><b>{t('Analyzing your data…')}</b><span>{t('This can take a few seconds.')}</span></div>
            ) : (
              <>
                <div className="ask-pop-empty"><span className="welcome-orbit"><Sparkles size={21}/></span><b>{t('Let’s find your next insight.')}</b><span>{t('Ask a question in plain English about your data.')}</span></div>
                <div className="ask-pop-suggestions">{suggestions.map(({ icon: Icon, text }) => <button key={text} onClick={() => onSubmit(text)}><Icon size={14}/><span>{text}</span><ArrowUpRight size={13}/></button>)}</div>
              </>
            )}
          </div>
          {error && <div className="ai-error ask-pop-error" role="alert">{error}{canConfigure && <button onClick={onConfigure}>{t('Configure OpenRouter')}</button>}</div>}
          {charts.length > 0 && (
            <div className="ask-pop-focus">
              <label htmlFor="ask-focus">{t('Analyze')}</label>
              <select id="ask-focus" value={focusId} onChange={(e) => onFocus(e.target.value)}>
                <option value="">{t('Whole dashboard')}</option>
                {charts.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>
          )}
          <form className="ask-pop-form" onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
            <textarea ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)} rows={2} placeholder={t('Ask anything about your data...')} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSubmit(); } }}/>
            <button className="send-btn" type="submit" disabled={!query.trim() || busy} aria-label={t('Send question')}>{busy ? <LoaderCircle className="spin" size={16}/> : <Send size={15}/>}</button>
          </form>
        </section>
      )}
      <button className={`ask-fab ${open ? 'ask-fab-open' : ''}`} onClick={onToggle} aria-label={open ? t('Close Ask AI') : t('Ask AI')} aria-expanded={open} title={t('Ask AI')}>
        {open ? <X size={22}/> : <Sparkles size={22}/>}
      </button>
    </>
  );
}
