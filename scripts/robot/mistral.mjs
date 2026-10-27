// الاتصال بـ Mistral (الباقة المجانية "Experiment"). شركة ثانية غير Google وCloudflare،
// فنستخدمه كعقل رئيسي إذا Gemini معطّل، وكـ "رأي ثاني" بمراجعة الأسئلة.
import { MISTRAL, MOCK } from './config.mjs';
import { mockGemini } from './mock.mjs';

const API = 'https://api.mistral.ai/v1';
let model = null;
let dead = '';
let lastAt = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const short = (t) => String(t).replace(/\s+/g, ' ').slice(0, 160);

export const mistralModel = () => model;
export const mistralDead = () => dead;

async function chat(m, system, user, { temperature = 0.7, json = true, maxTokens = 8000 } = {}) {
  // الباقة المجانية تسمح تقريباً بطلب بالثانية
  const wait = lastAt + 1500 - Date.now();
  if (wait > 0) await sleep(wait);
  lastAt = Date.now();
  return fetch(`${API}/chat/completions`, {
    method: 'POST',
    headers: { authorization: `Bearer ${MISTRAL.key}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: m,
      messages: [...(system ? [{ role: 'system', content: system }] : []), { role: 'user', content: user }],
      temperature,
      max_tokens: maxTokens,
      ...(json ? { response_format: { type: 'json_object' } } : {}),
    }),
  });
}

export async function probeMistral(log) {
  if (MOCK || !MISTRAL.key) return false;
  for (const m of [...new Set([MISTRAL.model, 'mistral-large-latest', 'mistral-medium-latest', 'mistral-small-latest'].filter(Boolean))]) {
    const res = await chat(m, null, 'Reply with JSON {"ok":true}', { temperature: 0, maxTokens: 30 });
    if (res.ok) {
      model = m;
      log(`نموذج Mistral المستخدم: ${m}`);
      return true;
    }
    dead = `${res.status} ${m}: ${short(await res.text())}`;
    log(`  ✗ Mistral ${dead}`);
    if (res.status === 401 || res.status === 403) break; // المفتاح نفسه غلط، ما نجرب غيره
  }
  return false;
}

// يرجع النص. يرمي 'daily-quota' إذا Mistral رفض (حصة خلصت) حتى الروبوت يبدّل لغيره
export async function askMistral(system, user, { temperature, json = true, kind } = {}) {
  if (MOCK) return JSON.stringify(mockGemini(user, { kind }));
  if (dead && !model) throw new Error('daily-quota');
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await chat(model, system, user, { temperature, json });
    if (res.ok) {
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content || '';
      if (text) return text;
      throw new Error('جواب فاضي من Mistral');
    }
    const raw = await res.text();
    // 429 مرة أو مرتين = سرعة (ننتظر شوية). أكثر = الحصة خلصت
    if (res.status === 429 && attempt < 2) {
      await sleep(5000 * (attempt + 1));
      continue;
    }
    if (res.status === 429 || res.status === 401 || res.status === 403) {
      dead = `${res.status} ${model}: ${short(raw)}`;
      model = null;
      throw new Error('daily-quota');
    }
    if (res.status >= 500 && attempt < 2) {
      await sleep(10000);
      continue;
    }
    throw new Error(`Mistral ${res.status}: ${short(raw)}`);
  }
  throw new Error('daily-quota');
}
