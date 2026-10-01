// يبني أسئلة "صورة مقرّبة" من صور ويكيميديا المراجعة يدوياً.
// الاستخدام: node scripts/zoom-build.mjs <rawDir> <spec.tsv> [--sheet out.jpg]
// spec: رقم الصورة<TAB>النقاط<TAB>الجواب  — كل ما زادت النقاط، القص أقرب.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..');
const [dir, specFile, flag, sheetOut] = process.argv.slice(2);
const CROP = { 200: 0.5, 400: 0.32, 600: 0.2 };
const meta = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8'));
const spec = fs.readFileSync(specFile, 'utf8').split(/\r?\n/).filter(Boolean).map((l) => l.split('\t'));

async function crop(n, p, c) {
  const img = sharp(path.join(dir, `${n}.jpg`));
  const { width: w, height: h } = await img.metadata();
  const s = Math.round(Math.min(w, h) * (Number(c) || CROP[p]));
  return img.extract({ left: Math.round((w - s) / 2), top: Math.round((h - s) / 2), width: s, height: s }).resize(640, 640);
}

if (flag === '--sheet') {
  const S = 200, cols = 10, tiles = [];
  for (const [n, p, , c] of spec) {
    const buf = await (await crop(n, p, c)).resize(S, S).toBuffer();
    const label = Buffer.from(`<svg width="${S}" height="30"><rect width="56" height="30" fill="yellow"/><text x="4" y="23" font-size="22" font-family="Arial" font-weight="bold">${n}</text></svg>`);
    tiles.push(await sharp(buf).composite([{ input: label, top: 0, left: 0 }]).toBuffer());
  }
  await sharp({ create: { width: cols * S, height: Math.ceil(tiles.length / cols) * S, channels: 3, background: '#fff' } })
    .composite(tiles.map((t, i) => ({ input: t, left: (i % cols) * S, top: Math.floor(i / cols) * S })))
    .jpeg({ quality: 80 }).toFile(sheetOut);
  process.exit(0);
}

const outFile = path.join(root, 'data/questions/zoom.json');
const existing = fs.existsSync(outFile) ? JSON.parse(fs.readFileSync(outFile, 'utf8')) : [];
const byId = new Map(existing.map((q) => [q.id, q]));
const mediaDir = path.join(root, 'public/media/zoom');
fs.mkdirSync(mediaDir, { recursive: true });
const out = [];
for (const [n, p, a, c] of spec) {
  const m = meta[n];
  const webp = await (await crop(n, p, c)).webp({ quality: 70 }).toBuffer();
  const id = `zoom-${crypto.createHash('sha1').update(m.title).digest('hex').slice(0, 8)}`;
  const file = `${id}-${crypto.createHash('sha1').update(webp).digest('hex').slice(0, 8)}.webp`;
  fs.writeFileSync(path.join(mediaDir, file), webp);
  out.push({ id, p: Number(p), t: 'image', q: 'شنو هذا الشي؟ (صورة مقرّبة)', a, m: `/media/zoom/${file}`, credit: `${m.title} (${m.license})`, src: 'claude-media', created: byId.get(id)?.created || new Date().toISOString().slice(0, 10) });
}
const others = existing.filter((q) => !out.some((o) => o.id === q.id) && q.src !== 'claude-media');
fs.writeFileSync(outFile, JSON.stringify([...out, ...others], null, 1));
console.log(`zoom: ${out.length}`);
