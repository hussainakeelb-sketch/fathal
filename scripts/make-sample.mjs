// أسئلة تجريبية بس، حتى نفحص اللعب قبل ما تجهز الأسئلة الحقيقية.
// تنمسح وتتبدل بالأسئلة الحقيقية بالمرحلة الرابعة.
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..');
const { categories } = JSON.parse(fs.readFileSync(path.join(root, 'data/categories.json'), 'utf8'));
const dir = path.join(root, 'data/questions');
fs.mkdirSync(dir, { recursive: true });

for (const c of categories.filter((c) => c.launch)) {
  const qs = [];
  for (const p of [200, 400, 600]) {
    const n = c.tiebreak && p === 600 ? 8 : 3;
    for (let i = 1; i <= n; i++) {
      qs.push({ id: `${c.id}-${p}-${i}`, p, t: 'text', q: `سؤال تجريبي ${i} بفئة ${c.name} (${p})؟`, a: `جواب تجريبي ${i}` });
    }
  }
  if (c.id === 'landmarks') {
    qs[3] = { ...qs[3], t: 'image', q: 'سؤال تجريبي ويه صورة: شنو هذا؟', m: '/test/sample.svg' };
  }
  if (c.id === 'tayyibeen') {
    qs[4] = { ...qs[4], t: 'audio', q: 'سؤال تجريبي ويه صوت: شنو هذا الصوت؟', m: '/test/sample.wav' };
  }
  fs.writeFileSync(path.join(dir, `${c.id}.json`), JSON.stringify(qs, null, 1));
}

// صورة وصوت تجريبيين
fs.mkdirSync(path.join(root, 'public/test'), { recursive: true });
fs.writeFileSync(
  path.join(root, 'public/test/sample.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 160"><rect width="320" height="160" fill="#DCE6FD"/><circle cx="250" cy="45" r="24" fill="#FFC72C"/><rect y="115" width="320" height="45" fill="#E9B01F"/><rect x="60" y="60" width="12" height="62" rx="6" fill="#5C4A1A"/><circle cx="66" cy="58" r="24" fill="#15803D"/></svg>`
);
const rate = 8000, secs = 6, n = rate * secs;
const buf = Buffer.alloc(44 + n);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + n, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(rate, 24);
buf.writeUInt32LE(rate, 28); buf.writeUInt16LE(1, 32); buf.writeUInt16LE(8, 34); buf.write('data', 36); buf.writeUInt32LE(n, 40);
for (let i = 0; i < n; i++) {
  const f = [262, 330, 392, 523][Math.floor(i / rate * 2) % 4];
  buf[44 + i] = 128 + Math.round(40 * Math.sin((2 * Math.PI * f * i) / rate));
}
fs.writeFileSync(path.join(root, 'public/test/sample.wav'), buf);
console.log('تم');
