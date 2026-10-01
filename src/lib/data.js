// تحميل الفئات والأسئلة. كل فئة بملف منفصل، فاللاعب ينزّل بس الفئات الي اختارها.
const BASE = import.meta.env.VITE_DATA_URL || '/data';

let indexPromise = null;
const catCache = new Map();

export class LoadError extends Error {
  constructor(offline) {
    super(offline ? 'offline' : 'load');
    this.offline = offline;
  }
}

async function getJSON(url) {
  let res;
  try {
    res = await fetch(url);
  } catch {
    throw new LoadError(!navigator.onLine);
  }
  if (!res.ok) throw new LoadError(false);
  return res.json();
}

export function fetchIndex() {
  if (!indexPromise) {
    indexPromise = getJSON(`${BASE}/index.json?t=${Math.floor(Date.now() / 60000)}`).catch((e) => {
      indexPromise = null;
      throw e;
    });
  }
  return indexPromise;
}

// رقم النسخة بالرابط: إذا الأسئلة تحدثت، المتصفح ينزّل الجديد. وإذا ما تحدثت، ياخذها من الكاش.
export async function fetchCategory(id) {
  if (catCache.has(id)) return catCache.get(id);
  const index = await fetchIndex();
  const p = getJSON(`${BASE}/cats/${id}.json?v=${index.v}`).catch((e) => {
    catCache.delete(id);
    throw e;
  });
  catCache.set(id, p);
  return p;
}

// تحميل مسبق للصورة أو الصوت، حتى ما يتأخر عرض السؤال
export function preloadMedia(q) {
  if (!q?.m) return;
  if (q.t === 'image') {
    const img = new Image();
    img.src = q.m;
  } else if (q.t === 'audio') {
    const a = new Audio();
    a.preload = 'auto';
    a.src = q.m;
  }
}
