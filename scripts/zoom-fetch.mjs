// يجيب صور ويكيميديا (ملكية عامة أو CC0 بس) لفئة "صورة مقرّبة" ويحفظها خام بمجلد مؤقت حتى نراجعها.
// الاستخدام: node scripts/zoom-fetch.mjs <list.tsv> <outDir>   (كل سطر: رقم<TAB>بحث إنگليزي)
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
const [list, outDir] = process.argv.slice(2);
const UA = 'fathal-quiz/1.0 (https://fathal.pages.dev)';
const FREE = /^(public domain|cc0|pd\b|pd-)/i;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const meta = {};
for (const line of fs.readFileSync(list, 'utf8').split(/\r?\n/).filter(Boolean)) {
  const [n, query, skip = '0'] = line.split('\t');
  await sleep(1500);
  const params = new URLSearchParams({ action: 'query', format: 'json', generator: 'search', gsrsearch: `${query} filetype:bitmap`, gsrnamespace: '6', gsrlimit: '30', prop: 'imageinfo', iiprop: 'url|size|extmetadata', iiurlwidth: '1024' });
  const data = await (await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, { headers: { 'user-agent': UA } })).json();
  const pages = Object.values(data?.query?.pages || {}).sort((a, b) => a.index - b.index);
  let k = Number(skip), got = null;
  for (const p of pages) {
    const i = p.imageinfo?.[0], m = i?.extmetadata || {};
    if (!FREE.test(m.LicenseShortName?.value || '') || m.Restrictions?.value || i.width < 600) continue;
    if (k-- > 0) continue;
    got = { url: i.thumburl || i.url, title: p.title, license: m.LicenseShortName.value };
    break;
  }
  if (!got) { console.log(n, 'NONE', query); continue; }
  const buf = Buffer.from(await (await fetch(got.url, { headers: { 'user-agent': UA } })).arrayBuffer());
  await sharp(buf).rotate().jpeg({ quality: 85 }).toFile(path.join(outDir, `${n}.jpg`));
  meta[n] = got;
  console.log(n, got.title);
}
const mf = path.join(outDir, 'meta.json');
fs.writeFileSync(mf, JSON.stringify({ ...(fs.existsSync(mf) ? JSON.parse(fs.readFileSync(mf, 'utf8')) : {}), ...meta }, null, 1));
