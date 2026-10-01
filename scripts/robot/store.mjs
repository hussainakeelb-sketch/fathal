// قراءة وحفظ الأسئلة (data/questions/<فئة>.json) ومنع التكرار.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ROOT, BLOCKLIST } from './config.mjs';

const qDir = path.join(ROOT, 'data/questions');

export const LEVELS = [200, 400, 600];

export function loadCategories() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'data/categories.json'), 'utf8'));
}

// نشيل التشكيل والمسافات الزايدة وعلامات الترقيم حتى نكشف التكرار
export const norm = (s) =>
  String(s)
    .replace(/[ً-ْـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[^\p{L}\p{N} ]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const makeId = (cat, q) => `${cat}-${crypto.createHash('sha1').update(norm(q)).digest('hex').slice(0, 8)}`;

export const isLive = (q) => q.status !== 'removed';

export class Store {
  constructor() {
    this.cache = new Map();
    this.dirty = new Set();
  }
  get(cat) {
    if (!this.cache.has(cat)) {
      const f = path.join(qDir, `${cat}.json`);
      this.cache.set(cat, fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : []);
    }
    return this.cache.get(cat);
  }
  live(cat) {
    return this.get(cat).filter(isLive);
  }
  levelCounts(cat) {
    const live = this.live(cat);
    return Object.fromEntries(LEVELS.map((p) => [p, live.filter((q) => q.p === p).length]));
  }
  // كل الأسئلة بكل الفئات (حتى المحذوفة) حتى ما نولّد سؤال انحذف قبل
  allNormalized() {
    const set = new Set();
    for (const f of fs.readdirSync(qDir)) for (const q of this.get(f.replace('.json', ''))) set.add(norm(q.q));
    return set;
  }
  add(cat, q) {
    this.get(cat).push(q);
    this.dirty.add(cat);
  }
  update(cat, id, patch) {
    const q = this.get(cat).find((x) => x.id === id);
    if (!q) return false;
    Object.assign(q, patch, { updated: today() });
    this.dirty.add(cat);
    return true;
  }
  find(id) {
    for (const f of fs.readdirSync(qDir)) {
      const cat = f.replace('.json', '');
      const q = this.get(cat).find((x) => x.id === id);
      if (q) return { cat, q };
    }
    return null;
  }
  save() {
    fs.mkdirSync(qDir, { recursive: true });
    for (const cat of this.dirty) fs.writeFileSync(path.join(qDir, `${cat}.json`), JSON.stringify(this.get(cat), null, 1));
    const n = this.dirty.size;
    this.dirty.clear();
    return n;
  }
}

export const today = () => new Date().toISOString().slice(0, 10);

// فحوصات محلية قبل أي مراجعة: الطول، اللغة، الكلمات الممنوعة
export function localCheck(item) {
  const q = String(item.q || '').trim();
  const a = String(item.a || '').trim();
  if (!LEVELS.includes(Number(item.p))) return 'نقاط غلط';
  if (q.length < 8 || q.length > 220) return 'طول السؤال';
  if (!a || a.length > 80) return 'طول الجواب';
  if (!/[؀-ۿ]/.test(q)) return 'السؤال مو عربي';
  if (q.includes('|') || a.includes('|')) return 'رمز ممنوع';
  const text = `${q} ${a}`;
  const bad = BLOCKLIST.find((w) => text.includes(w));
  if (bad) return `كلمة ممنوعة: ${bad.trim()}`;
  return null;
}
