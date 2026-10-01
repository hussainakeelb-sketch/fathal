// الصور والأصوات: من الذكاء الاصطناعي (Cloudflare) أو من ويكيميديا (بس الملكية العامة أو CC0، حتى ما نحتاج نذكر أسماء أصحابها).
// كل صورة وصوت يمر على فحص بالذكاء الاصطناعي: هل يطابق الجواب؟ هل مناسب للعائلة؟ هل بيه كتابة تفضح الجواب؟
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import { ROOT, MEDIA, MOCK } from './config.mjs';
import { aiImage } from './cloudflare.mjs';
import { ask } from './gemini.mjs';
import { mediaCheckPrompt } from './prompts.mjs';

const FREE_LICENSE = /^(public domain|cc0|pd\b|pd-)/i;

export async function commonsSearch(query, kind) {
  if (MOCK) return null;
  const filetype = kind === 'audio' ? 'filetype:audio' : 'filetype:bitmap';
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    generator: 'search',
    gsrsearch: `${query} ${filetype}`,
    gsrnamespace: '6',
    gsrlimit: '12',
    prop: 'imageinfo',
    iiprop: 'url|mime|size|extmetadata|metadata',
    ...(kind === 'audio' ? {} : { iiurlwidth: '1024' }),
  });
  const res = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, { headers: { 'user-agent': MEDIA.userAgent } });
  const data = await res.json();
  const pages = Object.values(data?.query?.pages || {}).sort((a, b) => a.index - b.index);
  for (const p of pages) {
    const info = p.imageinfo?.[0];
    const meta = info?.extmetadata || {};
    const license = meta.LicenseShortName?.value || '';
    if (!FREE_LICENSE.test(license)) continue;
    if (meta.Restrictions?.value) continue; // صور أشخاص أو علامات تجارية
    if (kind === 'audio') {
      const len = Number(info.metadata?.find((m) => m.name === 'length')?.value || info.duration || 0);
      if (!len || len > 120 || info.size > 8e6) continue;
      return { url: info.url, title: p.title, license, len };
    }
    if (info.width < 400) continue;
    return { url: info.thumburl || info.url, title: p.title, license };
  }
  return null;
}

async function download(url) {
  const res = await fetch(url, { headers: { 'user-agent': MEDIA.userAgent } });
  if (!res.ok) throw new Error(`تحميل ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

// WebP بأقل من 300KB. الصورة المقرّبة: ناخذ ثلث الصورة من النص
async function toWebp(buf, zoom) {
  let img = sharp(buf).rotate();
  if (zoom) {
    const { width, height } = await img.metadata();
    const w = Math.round(width * 0.38);
    const h = Math.round(height * 0.38);
    img = img.extract({ left: Math.round((width - w) / 2), top: Math.round((height - h) / 2), width: w, height: h });
  }
  for (const [size, quality] of [[1024, 74], [900, 66], [768, 60], [640, 55]]) {
    const out = await img.clone().resize(size, size, { fit: 'inside', withoutEnlargement: !zoom }).webp({ quality }).toBuffer();
    if (out.length <= MEDIA.imageMaxBytes) return out;
  }
  throw new Error('الصورة كبيرة');
}

// MP3 أحادي، أقل من 30 ثانية (يحتاج ffmpeg، موجود على سيرفرات GitHub)
function toMp3(buf) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fz-'));
  const inp = path.join(dir, 'in');
  const out = path.join(dir, 'out.mp3');
  fs.writeFileSync(inp, buf);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', inp, '-t', String(MEDIA.audioMaxSeconds), '-ac', '1', '-b:a', '64k', out]);
  const res = fs.readFileSync(out);
  fs.rmSync(dir, { recursive: true, force: true });
  return res;
}

async function verify(item, buf, mime, kind) {
  const r = await ask([{ text: mediaCheckPrompt(item, kind) }, { inline_data: { mime_type: mime, data: buf.toString('base64') } }], {
    temperature: 0,
    kind: 'media-check',
  });
  return r.matches === true && r.safe === true && r.leaks !== true;
}

function save(cat, id, buf, ext) {
  const hash = crypto.createHash('sha1').update(buf).digest('hex').slice(0, 8);
  const rel = `media/${cat}/${id}-${hash}.${ext}`;
  const file = path.join(ROOT, 'public', rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, buf);
  return `/${rel}`;
}

/**
 * يجهّز وسائط السؤال. يرجع {m, credit} أو null إذا ما نجح (والسؤال ينرفض أو يصير نص).
 */
export async function buildMedia(cat, id, item) {
  const media = item.media;
  if (!media?.query) return null;
  const kind = item.type === 'audio' || media.kind === 'audio' ? 'audio' : 'image';
  try {
    if (kind === 'audio') {
      const found = await commonsSearch(media.query, 'audio');
      if (!found) return null;
      const mp3 = toMp3(await download(found.url));
      if (!(await verify(item, mp3, 'audio/mp3', 'audio clip'))) return null;
      return { m: save(cat, id, mp3, 'mp3'), credit: `${found.title} (${found.license})` };
    }
    let raw;
    let credit;
    if (media.source === 'ai') {
      raw = await aiImage(`${media.query}, realistic photo, natural light, no text, no watermark`);
      credit = 'AI';
    } else {
      const found = await commonsSearch(media.query, 'image');
      if (!found) return null;
      raw = await download(found.url);
      credit = `${found.title} (${found.license})`;
    }
    const webp = await toWebp(raw, media.zoom);
    if (!(await verify(item, webp, 'image/webp', media.zoom ? 'zoomed-in image' : 'image'))) return null;
    return { m: save(cat, id, webp, 'webp'), credit };
  } catch (e) {
    if (e.message === 'budget' || e.message === 'daily-quota') throw e;
    console.log(`  ⚠️ وسائط ${id}: ${e.message}`);
    return null;
  }
}
