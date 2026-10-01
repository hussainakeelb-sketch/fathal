// localStorage ممكن يكون مقفول (وضع خاص أو إعدادات المتصفح)، فكل قراءة وكتابة محمية
export function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  try {
    if (value === undefined || value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export const KEYS = {
  theme: 'fz.theme',
  muted: 'fz.muted',
  timers: 'fz.timers',
  seen: 'fz.seen',
  game: 'fz.game',
};
