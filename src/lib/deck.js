// اختيار الأسئلة ومنع التكرار، على هذا الجهاز وعلى كل الأجهزة.
// السؤال ينحسب مستعمل أول ما ينفتح. ينحفظ بالجهاز، وينرسل للسيرفر حتى ما يطلع فوراً
// لأي جهاز يبدي لعبة بعده.
// الترتيب: أسئلة ما انشافت أبداً (الأحدث أولاً) ← الي مر عليها 90 يوم ← أقدم الي انشافت.
import { load, save, KEYS } from './storage.js';

const SEEN_API = import.meta.env.VITE_SEEN_URL || '/api/seen';

const DAY = 86400000;
export const FRESH_MS = 90 * DAY;
const FORGET_MS = 365 * DAY; // نمسح السجلات القديمة كلش حتى ما يكبر التخزين

export function loadSeen() {
  return load(KEYS.seen, {});
}

export function markSeen(id, now = Date.now()) {
  const seen = loadSeen();
  seen[id] = now;
  for (const k in seen) if (now - seen[k] > FORGET_MS) delete seen[k];
  save(KEYS.seen, seen);
  // للسيرفر: إذا ما وصل (ماكو نت) عادي، الجهاز نفسه يبقى يتذكر
  try {
    const body = JSON.stringify({ id });
    if (!navigator.sendBeacon?.(SEEN_API, body)) fetch(SEEN_API, { method: 'POST', body, keepalive: true }).catch(() => {});
  } catch {}
}

// سجل الأجهزة الثانية للفئات المختارة، مدموج ويه سجل هذا الجهاز (ناخذ الأحدث لكل سؤال).
// إذا السيرفر تأخر أكثر من 3 ثواني أو فشل، نكمل بسجل الجهاز بس حتى اللعبة ما تتعطل.
export async function loadSeenAll(cats) {
  const seen = { ...loadSeen() };
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3000);
    const res = await fetch(`${SEEN_API}?cats=${cats.map(encodeURIComponent).join(',')}`, { signal: ctrl.signal });
    clearTimeout(timer);
    if (res.ok) {
      const { seen: global = {} } = await res.json();
      for (const id in global) if (!(seen[id] >= global[id])) seen[id] = global[id];
    }
  } catch {}
  return seen;
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// pool: أسئلة فئة ومستوى واحد، مرتبة من الأقدم للأحدث (الجديد ينضاف بالآخر)
export function pickQuestions(pool, n, { exclude = new Set(), seen = loadSeen(), now = Date.now() } = {}) {
  const cand = pool.map((q, i) => ({ q, i })).filter(({ q }) => !exclude.has(q.id));
  const never = cand.filter(({ q }) => !seen[q.id]);
  const seenOnes = cand.filter(({ q }) => seen[q.id]).sort((x, y) => seen[x.q.id] - seen[y.q.id]);
  const stale = seenOnes.filter(({ q }) => now - seen[q.id] >= FRESH_MS);
  const recent = seenOnes.filter(({ q }) => now - seen[q.id] < FRESH_MS);

  // الأحدث أولاً، بس بشوية عشوائية: نقسمهم ثلث ثلث ونخلط داخل كل ثلث
  const third = Math.max(1, Math.ceil(never.length / 3));
  const byNewest = never.sort((x, y) => y.i - x.i);
  const neverOrdered = [];
  for (let s = 0; s < byNewest.length; s += third) neverOrdered.push(...shuffle(byNewest.slice(s, s + third)));

  return [...neverOrdered, ...stale, ...recent]
    .slice(0, n)
    .map(({ q }) => q);
}

export const LEVELS = [200, 400, 600];

// لوحة فئة وحدة: 6 خانات (200، 200، 400، 400، 600، 600)
export function buildColumn(questions, opts) {
  const tiles = [];
  for (const p of LEVELS) {
    const chosen = pickQuestions(questions.filter((q) => q.p === p), 2, opts);
    for (const q of chosen) tiles.push({ q, used: false, by: null });
  }
  return tiles;
}
