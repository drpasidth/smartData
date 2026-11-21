import React, { useEffect, useRef, useState } from 'react';

const readLayout = (key) => {
  try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch { return {}; }
};
const INTERACTIVE = 'button,select,input,textarea,label,a,option,[role=menu],[role=menuitem]';

// Bottom-right corner handle. Drag it to resize the card it sits in.
export function ResizeHandle({ onResize, minW = 240, minH = 120 }) {
  const start = useRef(null);
  const down = (e) => {
    e.stopPropagation();
    e.preventDefault();
    const r = e.currentTarget.parentElement.getBoundingClientRect();
    start.current = { x: e.clientX, y: e.clientY, w: r.width, h: r.height };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const move = (e) => {
    const s = start.current;
    if (!s) return;
    e.stopPropagation();
    onResize(
      Math.round(Math.max(minW, s.w + e.clientX - s.x)),
      Math.round(Math.max(minH, s.h + e.clientY - s.y)),
    );
  };
  const up = (e) => { e.stopPropagation(); start.current = null; };
  return (
    <div
      className="resize-handle"
      title="Drag to resize"
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
    />
  );
}

// Wraps a card so the user can drag and resize it. Position and size are saved per card in localStorage.
export function Movable({ id, storageKey, children }) {
  const [lay, setLay] = useState(() => readLayout(storageKey)[id] || { x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const drag = useRef(null);
  const skipFirstSave = useRef(true);

  useEffect(() => {
    if (skipFirstSave.current) { skipFirstSave.current = false; return; }
    try { localStorage.setItem(storageKey, JSON.stringify({ ...readLayout(storageKey), [id]: lay })); } catch { /* storage unavailable */ }
  }, [lay]);

  const onPointerDown = (e) => {
    if (e.button !== 0 || e.target.closest(INTERACTIVE)) return;
    // Keep the card inside its own section (metrics row or analysis row).
    const rect = e.currentTarget.getBoundingClientRect();
    const sec = e.currentTarget.parentElement.getBoundingClientRect();
    const baseL = rect.left - lay.x;
    const baseT = rect.top - lay.y;
    drag.current = {
      sx: e.clientX, sy: e.clientY, ox: lay.x, oy: lay.y,
      minX: sec.left - baseL, maxX: sec.right - rect.width - baseL,
      minY: sec.top - baseT, maxY: sec.bottom - rect.height - baseT,
    };
    setDragging(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), Math.max(lo, hi));
    setLay((prev) => ({
      ...prev,
      x: clamp(d.ox + e.clientX - d.sx, d.minX, d.maxX),
      y: clamp(d.oy + e.clientY - d.sy, d.minY, d.maxY),
    }));
  };
  const end = () => { drag.current = null; setDragging(false); };
  const sized = !!(lay.w || lay.h);

  return (
    <div
      className={`movable ${dragging ? 'dragging' : ''} ${sized ? 'sized' : ''}`}
      style={{ transform: `translate(${lay.x}px, ${lay.y}px)`, width: lay.w, height: lay.h }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
    >
      {children}
      <ResizeHandle onResize={(w, h) => setLay((prev) => ({ ...prev, w, h }))} />
    </div>
  );
}
