// استقبال بلاغات "إبلاغ عن خطأ" من اللاعبين (Cloudflare Pages Function + قاعدة D1).
// ماكو حسابات ولا بيانات شخصية: نحفظ بصمة مشفرة بس حتى نحدد عدد البلاغات لكل جهاز.

const REASONS = new Set(['wrong_answer', 'inappropriate', 'media', 'other']);
const MAX_PER_DAY = 20; // أقصى عدد بلاغات لنفس الجهاز باليوم

const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });

const clean = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json(503, { ok: false, error: 'db' });

  let body;
  try {
    body = await request.json();
  } catch {
    return json(400, { ok: false, error: 'bad_json' });
  }

  const qid = clean(body.qid, 80);
  const cat = clean(body.cat, 60);
  const q = clean(body.q, 600);
  const a = clean(body.a, 300);
  const reason = clean(body.reason, 20);
  const note = clean(body.note, 300);
  if (!/^[a-z0-9-]+$/.test(qid) || !/^[a-z0-9-]+$/.test(cat) || !q || !a || !REASONS.has(reason)) {
    return json(400, { ok: false, error: 'invalid' });
  }
  if (reason === 'other' && !note) return json(400, { ok: false, error: 'note_required' });

  const ip = request.headers.get('CF-Connecting-IP') || 'local';
  const day = new Date().toISOString().slice(0, 10);
  const ipHash = await sha256(`${env.REPORT_SALT || 'fathal'}:${ip}`);

  const { n } = await env.DB.prepare('SELECT COUNT(*) AS n FROM reports WHERE ip_hash = ? AND day = ?').bind(ipHash, day).first();
  if (n >= MAX_PER_DAY) return json(429, { ok: false, error: 'limit' });

  // نفس الجهاز بلّغ عن نفس السؤال قبل؟ ما نكرره، بس نرد عليه بنجاح
  const dup = await env.DB.prepare("SELECT id FROM reports WHERE ip_hash = ? AND qid = ? AND status = 'pending'").bind(ipHash, qid).first();
  if (dup) return json(200, { ok: true });

  await env.DB.prepare(
    'INSERT INTO reports (qid, cat, q, a, reason, note, ip_hash, day, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  )
    .bind(qid, cat, q, a, reason, note || null, ipHash, day, new Date().toISOString())
    .run();

  return json(200, { ok: true });
}

export function onRequest() {
  return json(405, { ok: false, error: 'method' });
}
