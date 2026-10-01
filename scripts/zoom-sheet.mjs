// يسوي ورقة مراجعة (شبكة صور مرقّمة) من مجلد صور مؤقت.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
const [dir, from, to, out, cropArg] = process.argv.slice(2);
const crop = Number(cropArg || 1);
const S = 220, cols = 6, tiles = [];
for (let n = Number(from); n <= Number(to); n++) {
  const f = path.join(dir, `${n}.jpg`);
  if (!fs.existsSync(f)) continue;
  let img = sharp(f);
  if (crop < 1) {
    const { width: w, height: h } = await img.metadata();
    const cw = Math.round(Math.min(w, h) * crop);
    img = img.extract({ left: Math.round((w - cw) / 2), top: Math.round((h - cw) / 2), width: cw, height: cw });
  }
  const buf = await img.resize(S, S, { fit: 'cover' }).toBuffer();
  const label = Buffer.from(`<svg width="${S}" height="34"><rect width="60" height="34" fill="yellow"/><text x="6" y="26" font-size="26" font-family="Arial" font-weight="bold">${n}</text></svg>`);
  tiles.push(await sharp(buf).composite([{ input: label, top: 0, left: 0 }]).toBuffer());
}
const rows = Math.ceil(tiles.length / cols);
await sharp({ create: { width: cols * S, height: rows * S, channels: 3, background: '#fff' } })
  .composite(tiles.map((t, i) => ({ input: t, left: (i % cols) * S, top: Math.floor(i / cols) * S })))
  .jpeg({ quality: 80 }).toFile(out);
