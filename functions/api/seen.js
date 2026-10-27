// الأسئلة المستعملة لكل الأجهزة (Cloudflare Pages Function + قاعدة D1).
// أي سؤال ينفتح بأي جهاز ينحسب مستعمل فوراً عند كل جهاز يبدي لعبة بعده، لمدة 90 يوم.
// ماكو حسابات ولا بيانات شخصية: نحفظ رقم السؤال ووقته بس، وبصمة مشفرة للعدّ ضد العبث.

const KEEP_MS = 365 * 86_400_000; // السجلات الأقدم من سنة تنمسح
const MAX_PER_DAY = 400; // أقصى عدد أسئلة يسجلها نفس الجهاز باليوم (اللعبة الوحدة 36 تقريباً)
const ID_RE = /^([a-z0-9]+(?:-[a-z0-9]+)*)-[0-9a-f]{8}$/; // <الفئة>-<8 حروف>

const json = (status, body, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...headers } });

let tablesReady = false;
async function ensureTables(db) {
  if (tablesReady) return;
  await db.batch([
    db.prepare('CREATE TABLE IF NOT EXISTS seen (qid TEXT PRIMARY KEY, cat TEXT NOT NULL, at INTEGER NOT NULL)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_seen_cat ON seen(cat)'),
    db.prepare('CREATE TABLE IF NOT EXISTS seen_hits (ip_hash TEXT NOT NULL, day TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (ip_hash, day))'),
  ]);
  tablesReady = true;
}

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// GET /api/seen?cats=a,b,c → {"seen":{"<qid>":<وقت آخر استعمال>}} للفئات المطلوبة
export async function onRequestGet({ request, env }) {
  if (!env.DB) return json(503, { ok: false, error: 'db' });
  const cats = [...new Set((new URL(request.url).searchParams.get('cats') || '').split(','))]
    .filter((c) => /^[a-z0-9-]{1,60}$/.test(c))
    .slice(0, 12);
  if (!cats.length) return json(400, { ok: false, error: 'cats' });
  await ensureTables(env.DB);

  const now = Date.now();
  const { results = [] } = await env.DB.prepare(
    `SELECT qid, at FROM seen WHERE cat IN (${cats.map(() => '?').join(',')}) AND at > ?`
  )
    .bind(...cats, now - KEEP_MS)
    .all();
  const seen = Object.fromEntries(results.map((r) => [r.qid, r.at]));
  // بدون كاش: كل لعبة تاخذ آخر سجل لحظتها
  return json(200, { ok: true, seen }, { 'cache-control': 'no-store' });
}

// POST /api/seen  {"id":"<qid>"} — سؤال انفتح هسة
export async function onRequestPost({ request, env }) {
  if (!env.DB) return json(503, { ok: false, error: 'db' });
  let body;
  try {
    // sendBeacon يرسل نص عادي، فنقرا النص ونحوله
    body = JSON.parse(await request.text());
  } catch {
    return json(400, { ok: false, error: 'bad_json' });
  }
  const id = typeof body?.id === 'string' ? body.id : '';
  const m = id.match(ID_RE);
  if (!m) return json(400, { ok: false, error: 'invalid' });
  await ensureTables(env.DB);

  const ip = request.headers.get('CF-Connecting-IP') || 'local';
  const day = new Date().toISOString().slice(0, 10);
  const ipHash = await sha256(`${env.REPORT_SALT || 'fathal'}:seen:${ip}`);
  const hit = await env.DB.prepare(
    'INSERT INTO seen_hits (ip_hash, day, n) VALUES (?, ?, 1) ON CONFLICT(ip_hash, day) DO UPDATE SET n = n + 1 RETURNING n'
  )
    .bind(ipHash, day)
    .first();
  if (hit?.n > MAX_PER_DAY) return json(429, { ok: false, error: 'limit' });

  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare('INSERT INTO seen (qid, cat, at) VALUES (?, ?, ?) ON CONFLICT(qid) DO UPDATE SET at = excluded.at').bind(id, m[1], now),
    // تنظيف خفيف: سجلات العدّ القديمة
    env.DB.prepare('DELETE FROM seen_hits WHERE day < ?').bind(new Date(now - 2 * 86_400_000).toISOString().slice(0, 10)),
  ]);
  return json(200, { ok: true });
}

export function onRequest() {
  return json(405, { ok: false, error: 'method' });
}
