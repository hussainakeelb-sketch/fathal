import { useEffect, useState } from 'preact/hooks';
import { load, save, KEYS } from './storage.js';

const darkQuery = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;

function effectiveTheme(stored) {
  if (stored === 'light' || stored === 'dark') return stored;
  return darkQuery?.matches ? 'dark' : 'light';
}

// إذا ماكو اختيار محفوظ، الموقع يتبع إعداد الجهاز (بدون data-theme)
export function useTheme() {
  const [stored, setStored] = useState(() => load(KEYS.theme, null));
  const [, force] = useState(0);

  useEffect(() => {
    if (stored) document.documentElement.setAttribute('data-theme', stored);
    else document.documentElement.removeAttribute('data-theme');
  }, [stored]);

  useEffect(() => {
    if (!darkQuery) return;
    const on = () => force((n) => n + 1);
    darkQuery.addEventListener('change', on);
    return () => darkQuery.removeEventListener('change', on);
  }, []);

  const theme = effectiveTheme(stored);
  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    save(KEYS.theme, next);
    setStored(next);
  };
  return [theme, toggle];
}

export function useMuted() {
  const [muted, setMuted] = useState(() => load(KEYS.muted, false));
  const toggle = () => {
    save(KEYS.muted, !muted);
    setMuted(!muted);
  };
  return [muted, toggle];
}

export const DEFAULT_TIMERS = { 200: 30, 400: 45, 600: 60 };
export const STEAL_SECONDS = 15;
export const TIMER_MIN = 10;
export const TIMER_MAX = 120;
export const TIMER_STEP = 5;

export function loadTimers() {
  const t = load(KEYS.timers, null);
  if (!t) return { ...DEFAULT_TIMERS };
  const out = {};
  for (const p of [200, 400, 600]) {
    const v = Number(t[p]);
    out[p] = Number.isFinite(v) ? Math.min(TIMER_MAX, Math.max(TIMER_MIN, v)) : DEFAULT_TIMERS[p];
  }
  return out;
}

export function saveTimers(timers) {
  save(KEYS.timers, timers);
}
