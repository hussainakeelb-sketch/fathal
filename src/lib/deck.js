// اختيار الأسئلة ومنع التكرار على نفس الجهاز.
// الترتيب: أسئلة ما شافها الجهاز أبداً (الأحدث أولاً) ← الي مر عليها 90 يوم ← أقدم الي شافها.
import { load, save, KEYS } from './storage.js';

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
