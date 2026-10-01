// وضع التجربة (ROBOT_MOCK=1): أجوبة وهمية بدل الخدمات الحقيقية، حتى نفحص الروبوت بدون حسابات.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { ROOT } from './config.mjs';

let n = 0;
const mockDbFile = path.join(ROOT, '.wrangler/mock-reports.json');

export function mockGemini(parts, { kind }) {
  const text = typeof parts === 'string' ? parts : parts.map((p) => p.text || '').join('\n');
  if (kind === 'generate') {
    const want = [...text.matchAll(/(\d+) questions worth (\d+)/g)].flatMap(([, c, p]) => Array.from({ length: Number(c) }, () => Number(p)));
    const withImage = /"source":"ai"/.test(text);
    return {
      questions: want.map((p, i) => ({
        p,
        q: `سؤال تجريبي من الروبوت رقم ${++n} مستوى ${p}؟`,
        a: `جواب ${n}`,
        type: withImage && i === 0 ? 'image' : 'text',
        media: withImage && i === 0 ? { source: 'ai', query: 'a bowl of lentil soup' } : null,
        fact: 'mock',
      })),
    };
  }
  if (kind === 'review') {
    const count = (text.match(/^\d+\. \[/gm) || []).length;
    // نرفض كل خامس سؤال حتى نتأكد إن الرفض يشتغل
    return { results: Array.from({ length: count }, (_, i) => ({ i, ok: i % 5 !== 4, why: 'mock' })) };
  }
  if (kind === 'report') {
    if (/reason: wrong_answer/.test(text)) return { action: 'fix_answer', a: 'جواب مصحّح', why: 'mock' };
    if (/reason: inappropriate/.test(text)) return { action: 'remove', why: 'mock' };
    return { action: 'keep', why: 'mock' };
  }
  if (kind === 'media-check') return { matches: true, safe: true, leaks: false };
  return {};
}

export function mockD1(sql, params) {
  const rows = fs.existsSync(mockDbFile) ? JSON.parse(fs.readFileSync(mockDbFile, 'utf8')) : [];
  if (/^SELECT/i.test(sql)) return rows.filter((r) => r.status === 'pending');
  if (/^UPDATE/i.test(sql)) {
    const [resolution, at, ...ids] = params;
    for (const r of rows) if (ids.includes(r.id)) Object.assign(r, { status: 'done', resolution, resolved_at: at });
    fs.writeFileSync(mockDbFile, JSON.stringify(rows, null, 1));
  }
  return [];
}

export async function mockImage() {
  return sharp({ create: { width: 800, height: 600, channels: 3, background: { r: 255, g: 199, b: 44 } } }).jpeg().toBuffer();
}
