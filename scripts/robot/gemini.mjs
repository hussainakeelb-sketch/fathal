// الاتصال بـ Google Gemini (الباقة المجانية). ميزته: بحث گوگل للتأكد من المعلومات، ويشوف الصور.
// إذا رفض (الحصة خلصت أو ماكو حصة أصلاً) نتركه فوراً لباقي اليوم ونكمل بـ Cloudflare، بدون انتظار.
import { GEMINI, MOCK } from './config.mjs';
import { mockGemini } from './mock.mjs';

const API = 'https://generativelanguage.googleapis.com/v1beta';
let lastAt = 0;
let model = GEMINI.model;
let dead = '';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const short = (t) => String(t).replace(/\s+/g, ' ').slice(0, 160);
export const currentGeminiModel = () => model;
export const geminiDead = () => dead;

// يطلّع JSON من جواب النموذج حتى لو كتب شي قبله أو بعده
export function parseJSON(text) {
  try {
    return JSON.parse(text);
  } catch {}
  const m = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (!m) throw new Error('ماكو JSON بالجواب');
  return JSON.parse(m[1]);
}

async function call(m, body) {
  return fetch(`${API}/models/${m}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': GEMINI.key },
    body: JSON.stringify(body),
  });
}

// نجرب النموذج المحدد وأحدث نموذج Flash بس (طلبين بالكثير). إذا ما اشتغل، Gemini يبقى معطّل لباقي اليوم.
export async function probeGemini(log) {
  if (MOCK) return true;
  if (!GEMINI.key) {
    dead = 'ماكو مفتاح';
    return false;
  }
  const candidates = [model];
  try {
    const res = await fetch(`${API}/models?pageSize=200`, { headers: { 'x-goog-api-key': GEMINI.key } });
    const { models = [] } = await res.json();
    const flash = models
      .filter((x) => x.supportedGenerationMethods?.includes('generateContent') && /flash/.test(x.name) && !/image|tts|live|audio|exp|lite|preview/.test(x.name))
      .map((x) => x.name.replace('models/', ''));
    if (flash[0] && flash[0] !== model) candidates.push(flash.sort().reverse()[0]);
  } catch {}
  for (const m of candidates) {
    const res = await call(m, { contents: [{ role: 'user', parts: [{ text: 'Reply with the word OK.' }] }] });
    if (res.ok) {
      model = m;
      log(`نموذج Gemini المستخدم: ${m}`);
      return true;
    }
    dead = `${res.status} ${m}: ${short(await res.text())}`;
    log(`  ✗ Gemini ${dead}`);
  }
  return false;
}

/**
 * طلب واحد لـ Gemini. parts: نص، أو [{text}|{inline_data:{mime_type,data}}]
 * يرمي 'daily-quota' إذا Gemini رفض، حتى الروبوت يبدّل لـ Cloudflare.
 */
export async function askGemini(parts, { system, search = false, json = true, temperature = 0.7, kind = 'general' } = {}) {
  if (MOCK) return mockGemini(parts, { kind });
  if (dead) throw new Error('daily-quota');
  const wait = lastAt + GEMINI.minGapMs - Date.now();
  if (wait > 0) await sleep(wait);

  const body = {
    contents: [{ role: 'user', parts: typeof parts === 'string' ? [{ text: parts }] : parts }],
    generationConfig: { temperature, ...(json && !search ? { responseMimeType: 'application/json' } : {}) },
    ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
    ...(search ? { tools: [{ google_search: {} }] } : {}),
  };

  for (let attempt = 0; attempt < 2; attempt++) {
    lastAt = Date.now();
    const res = await call(model, body);
    if (res.ok) {
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
      if (!text) throw new Error('جواب فاضي من Gemini');
      return json ? parseJSON(text) : text;
    }
    const raw = await res.text();
    // حصة (429) أو نموذج انسحب (404): نتركه لباقي اليوم. مشغول (5xx): نعيد مرة وحدة بس بعد 20 ثانية
    if (res.status === 429 || res.status === 404 || res.status === 403 || attempt === 1) {
      dead = `${res.status} ${model}: ${short(raw)}`;
      throw new Error('daily-quota');
    }
    await sleep(20000);
  }
  throw new Error('daily-quota');
}
