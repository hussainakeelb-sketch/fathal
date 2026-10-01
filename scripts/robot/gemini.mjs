// الاتصال بـ Google Gemini (الباقة المجانية): توليد ومراجعة وتحقق من الصور، ويه بحث گوگل للتأكد من المعلومات.
import { GEMINI, MOCK } from './config.mjs';
import { mockGemini } from './mock.mjs';

const API = 'https://generativelanguage.googleapis.com/v1beta';
let used = 0;
let lastAt = 0;
let model = GEMINI.model;

export const geminiUsed = () => used;
export const geminiLeft = () => GEMINI.maxRequests - used;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// يطلّع JSON من جواب النموذج حتى لو كتب شي قبله أو بعده
export function parseJSON(text) {
  try {
    return JSON.parse(text);
  } catch {}
  const m = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (!m) throw new Error('ماكو JSON بالجواب');
  return JSON.parse(m[1]);
}

async function pickFallbackModel() {
  const res = await fetch(`${API}/models?pageSize=100`, { headers: { 'x-goog-api-key': GEMINI.key } });
  const { models = [] } = await res.json();
  const ok = models
    .filter((m) => m.supportedGenerationMethods?.includes('generateContent') && /flash/.test(m.name) && !/image|tts|live|audio|thinking-exp/.test(m.name))
    .map((m) => m.name.replace('models/', ''));
  const best = ok.find((n) => !/lite|preview|exp/.test(n)) || ok[0];
  if (!best) throw new Error('ما لگينا نموذج Gemini متوفر');
  console.log(`⚠️ النموذج ${model} مو متوفر، راح نستخدم ${best}`);
  model = best;
}

/**
 * طلب واحد لـ Gemini.
 * parts: نص، أو [{text}|{inline_data:{mime_type,data}}]
 * search: يفعّل بحث گوگل (للتأكد من المعلومات)
 */
export async function ask(parts, { system, search = false, json = true, temperature = 0.7, kind = 'general' } = {}) {
  if (geminiLeft() <= 0) throw new Error('budget');
  used++;
  if (MOCK) return mockGemini(parts, { kind });

  const wait = lastAt + GEMINI.minGapMs - Date.now();
  if (wait > 0) await sleep(wait);

  const body = {
    contents: [{ role: 'user', parts: typeof parts === 'string' ? [{ text: parts }] : parts }],
    generationConfig: { temperature, ...(json && !search ? { responseMimeType: 'application/json' } : {}) },
    ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
    ...(search ? { tools: [{ google_search: {} }] } : {}),
  };

  for (let attempt = 0; attempt < 4; attempt++) {
    lastAt = Date.now();
    const res = await fetch(`${API}/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': GEMINI.key },
      body: JSON.stringify(body),
    });
    if (res.status === 404 && attempt === 0) {
      await pickFallbackModel();
      continue;
    }
    if (res.status === 429 || res.status >= 500) {
      // تجاوزنا الحد أو الخدمة مشغولة: ننتظر ونعيد
      const info = await res.json().catch(() => ({}));
      const retry = info?.error?.details?.find((d) => d.retryDelay)?.retryDelay;
      const ms = retry ? parseFloat(retry) * 1000 : 20000 * (attempt + 1);
      if (res.status === 429 && /per day|PerDay/i.test(JSON.stringify(info))) throw new Error('daily-quota');
      await sleep(Math.min(ms, 90000));
      continue;
    }
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
    if (!text) throw new Error('جواب فاضي من Gemini');
    return json ? parseJSON(text) : text;
  }
  throw new Error('Gemini ما رد بعد عدة محاولات');
}
