// عقل الروبوت: Gemini إذا عنده حصة (أدق، وبيه بحث گوگل ويشوف الصور)، وإلا Cloudflare Workers AI (مجاني).
// إذا الاثنين خلصت حصتهم، الروبوت يوقف ويكمل باچر. وأي طلب بعد الوقت المسموح يوقف بهدوء.
import { AI, MOCK } from './config.mjs';
import { askGemini, probeGemini, parseJSON, currentGeminiModel, geminiDead } from './gemini.mjs';
import { askCf, ensureCfText, cfTextModel } from './cloudflare.mjs';

let provider = null; // 'gemini' | 'cloudflare'
let cfReady = false;
let used = 0;
let deadline = Infinity;
let log = console.log;

export const aiUsed = () => used;
export const aiLeft = () => (Date.now() > deadline ? 0 : AI.maxRequests - used);
export const aiProvider = () => provider;
// Gemini بس يگدر يبحث بگوگل ويشوف الصور
export const aiCaps = () => ({ search: provider === 'gemini', vision: provider === 'gemini' });
export const aiModel = () => (provider === 'gemini' ? currentGeminiModel() : cfTextModel());

async function useCloudflare() {
  if (!cfReady) {
    await ensureCfText(log);
    cfReady = true;
  }
  provider = 'cloudflare';
}

export async function ensureAI(logFn, { deadlineAt } = {}) {
  log = logFn;
  if (deadlineAt) deadline = deadlineAt;
  if (MOCK) {
    provider = 'gemini';
    return provider;
  }
  if (await probeGemini(log)) {
    provider = 'gemini';
    return provider;
  }
  log(`Gemini معطّل اليوم، نكمل بـ Cloudflare`);
  await useCloudflare();
  return provider;
}

/** طلب واحد. يرجع JSON (أو نص إذا json:false). يرمي 'budget' أو 'daily-quota' إذا لازم نوقف. */
export async function ask(parts, opts = {}) {
  if (aiLeft() <= 0) throw new Error('budget');
  used++;
  if (provider === 'gemini') {
    try {
      return await askGemini(parts, opts);
    } catch (e) {
      if (e.message !== 'daily-quota') throw e;
      log(`Gemini وقف (${geminiDead()})، نكمل بـ Cloudflare`);
      try {
        await useCloudflare();
      } catch (err) {
        log(`❌ ${err.message}`);
        throw new Error('daily-quota');
      }
    }
  }
  // الصور ما تنرسل لـ Cloudflare: الي يحتاج يشوف صورة يتوقف
  if (typeof parts !== 'string' && parts.some((p) => p.inline_data)) throw new Error('no-vision');
  const text = typeof parts === 'string' ? parts : parts.map((p) => p.text || '').join('\n');
  const out = await askCf(opts.system, text, opts);
  return opts.json === false ? out : parseJSON(out);
}
