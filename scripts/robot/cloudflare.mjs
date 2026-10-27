// الاتصال بـ Cloudflare: قاعدة البلاغات (D1)، نماذج النص (Workers AI)، وتوليد الصور. كلها ضمن الباقة المجانية.
import { CF, MOCK } from './config.mjs';
import { mockD1, mockImage, mockGemini } from './mock.mjs';

const API = 'https://api.cloudflare.com/client/v4';
let images = 0;
export const imagesLeft = () => CF.maxImages - images;

async function cf(path, body, method = 'POST') {
  const res = await fetch(`${API}/accounts/${CF.accountId}${path}`, {
    method,
    headers: { authorization: `Bearer ${CF.token}`, 'content-type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    const err = new Error(`Cloudflare ${res.status}: ${JSON.stringify(data.errors || data).slice(0, 300)}`);
    err.status = res.status;
    // الحصة المجانية اليومية (10,000 neuron) خلصت
    err.quota = res.status === 429 || /4006|daily free allocation|neurons/i.test(err.message);
    throw err;
  }
  return data.result;
}

export async function d1(sql, params = []) {
  if (MOCK) return mockD1(sql, params);
  const result = await cf(`/d1/database/${CF.d1Id}/query`, { sql, params });
  return result?.[0]?.results ?? [];
}

// صورة بالذكاء الاصطناعي (FLUX.1 schnell). ترجع Buffer (JPEG)
export async function aiImage(prompt) {
  if (imagesLeft() <= 0) throw new Error('image-budget');
  images++;
  if (MOCK) return mockImage(prompt);
  const result = await cf('/ai/run/@cf/black-forest-labs/flux-1-schnell', { prompt, steps: 6 });
  if (!result?.image) throw new Error('ما رجعت صورة');
  return Buffer.from(result.image, 'base64');
}

// ---- نماذج النص (Workers AI) ----
// بالترتيب من الأفضل للعربي والدقة. الروبوت ياخذ أول واحد متوفر ويشتغل فعلاً.
const PREFERRED = [
  '@cf/openai/gpt-oss-120b',
  '@cf/meta/llama-4-scout-17b-16e-instruct',
  '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  '@cf/qwen/qwen3-30b-a3b-fp8',
  '@cf/mistralai/mistral-small-3.1-24b-instruct',
  '@cf/google/gemma-3-12b-it',
];
let textModel = null;
export const cfTextModel = () => textModel;

// النص من أي شكل جواب (نماذج Workers AI ترجع أشكال مختلفة)
function textOf(r) {
  if (typeof r === 'string') return r;
  if (typeof r?.response === 'string') return r.response;
  if (r?.response && typeof r.response === 'object') return JSON.stringify(r.response);
  const choice = r?.choices?.[0]?.message?.content;
  if (choice) return choice;
  const out = (r?.output || []).flatMap((o) => o.content || []).map((c) => c.text || '').join('');
  return out || '';
}

async function runText(model, system, user, { temperature = 0.7, maxTokens = 3000 } = {}) {
  try {
    return textOf(await cf(`/ai/run/${model}`, {
      messages: [...(system ? [{ role: 'system', content: system }] : []), { role: 'user', content: user }],
      temperature,
      max_tokens: maxTokens,
    }));
  } catch (e) {
    // بعض النماذج (gpt-oss) تقبل بس صيغة instructions + input
    if (e.quota || e.status !== 400) throw e;
    return textOf(await cf(`/ai/run/${model}`, { instructions: system || undefined, input: user }));
  }
}

// نختار نموذج النص: المحدد بالإعدادات، أو أول نموذج من القائمة متوفر ويرد صح
export async function ensureCfText(log) {
  if (MOCK) return (textModel = '@cf/mock');
  let available = [];
  try {
    const list = await cf('/ai/models/search?task=Text%20Generation&per_page=200', null, 'GET');
    available = (list || []).map((m) => m.name);
  } catch {}
  const candidates = [CF.textModel, ...PREFERRED.filter((m) => !available.length || available.includes(m))].filter(Boolean);
  for (const m of [...new Set(candidates)].slice(0, 5)) {
    try {
      const t = await runText(m, null, 'Reply with the word OK only.', { temperature: 0, maxTokens: 50 });
      if (/ok/i.test(t)) {
        log(`نموذج Cloudflare المستخدم: ${m}`);
        return (textModel = m);
      }
      log(`  ✗ ${m}: جواب غريب`);
    } catch (e) {
      log(`  ✗ ${m}: ${e.message.slice(0, 160)}`);
      if (e.quota) break;
    }
  }
  throw new Error('ماكو نموذج نص يشتغل على Cloudflare');
}

export async function askCf(system, user, { temperature, kind }) {
  if (MOCK) return JSON.stringify(mockGemini(user, { kind }));
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const t = await runText(textModel, system, user, { temperature });
      if (t) return t;
    } catch (e) {
      if (e.quota) throw new Error('daily-quota');
      if (attempt) throw e;
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error('جواب فاضي من Cloudflare');
}
