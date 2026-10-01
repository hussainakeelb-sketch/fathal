// يحوّل ملفات الأسئلة المكتوبة يدوياً (data/src/<فئة>.txt) لملفات data/questions/<فئة>.json
// كل سطر: النقاط|السؤال|الجواب
// رقم السؤال (id) مأخوذ من نص السؤال نفسه، حتى يبقى ثابت إذا تغير ترتيب الأسطر.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..');
const srcDir = path.join(root, 'data/src');
const outDir = path.join(root, 'data/questions');
fs.mkdirSync(outDir, { recursive: true });

const norm = (s) => s.replace(/[ً-ْـ]/g, '').replace(/\s+/g, ' ').trim();

for (const file of fs.readdirSync(srcDir).filter((f) => f.endsWith('.txt'))) {
  const cat = file.replace(/\.txt$/, '');
  const outFile = path.join(outDir, `${cat}.json`);
  const existing = fs.existsSync(outFile) ? JSON.parse(fs.readFileSync(outFile, 'utf8')) : [];
  const byId = new Map(existing.map((q) => [q.id, q]));
  const seen = new Set();
  const out = [];

  fs.readFileSync(path.join(srcDir, file), 'utf8').split(/\r?\n/).forEach((line, i) => {
    if (!line.trim()) return;
    const [p, q, a] = line.split('|').map((s) => s?.trim());
    if (![200, 400, 600].includes(Number(p)) || !q || !a) throw new Error(`${file}:${i + 1} سطر غلط`);
    const key = norm(q);
    if (seen.has(key)) throw new Error(`${file}:${i + 1} سؤال مكرر`);
    seen.add(key);
    const id = `${cat}-${crypto.createHash('sha1').update(key).digest('hex').slice(0, 8)}`;
    const prev = byId.get(id);
    out.push({ id, p: Number(p), t: 'text', q, a, src: 'claude', ...(prev?.created ? { created: prev.created } : { created: new Date().toISOString().slice(0, 10) }) });
  });

  // الأسئلة الي إجت من مصادر ثانية (الروبوت) تبقى كما هي
  const others = existing.filter((q) => q.src && q.src !== 'claude' && !out.some((o) => o.id === q.id));
  fs.writeFileSync(outFile, JSON.stringify([...out, ...others], null, 1));
  console.log(`${cat}: ${out.length}`);
}
