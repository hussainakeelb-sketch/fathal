// عقل الروبوت. الترتيب: Gemini (أدق، وبيه بحث گوگل ويشوف الصور) ← Mistral ← Cloudflare Workers AI.
// كل الي يشتغلون اليوم يتجهزون من البداية: الأول هو الرئيسي، والي بعده "رأي ثاني" من شركة مختلفة.
// إذا واحد خلصت حصته، الروبوت ينتقل للي بعده. وأي طلب بعد الوقت المسموح يوقف بهدوء.
import { AI, MOCK } from './config.mjs';
import { askGemini, probeGemini, parseJSON, currentGeminiModel, geminiDead } from './gemini.mjs';
import { askMistral, probeMistral, mistralModel, mistralDead } from './mistral.mjs';
import { askCf, ensureCfText, cfTextModel } from './cloudflare.mjs';

const NAMES = { gemini: 'Gemini', mistral: 'Mistral', cloudflare: 'Cloudflare' };
let ready = []; // المزودين الي يشتغلون اليوم، بالترتيب
let started = []; // الي اشتغلوا ببداية اليوم (للسجل)
let used = 0;
let deadline = Infinity;
let log = console.log;

export const aiUsed = () => used;
export const aiLeft = () => (Date.now() > deadline ? 0 : AI.maxRequests - used);
export const aiProvider = () => ready[0] || null;
export const aiProviders = () => [...ready];
// Gemini بس يگدر يبحث بگوگل ويشوف الصور
export const aiCaps = () => ({ search: ready[0] === 'gemini', vision: ready[0] === 'gemini' });
const modelOf = (p) => ({ gemini: currentGeminiModel, mistral: mistralModel, cloudflare: cfTextModel })[p]?.();
export const aiModel = () => started.map((p) => `${NAMES[p]} ${modelOf(p) || ''}`.trim()).join(' + ');

export async function ensureAI(logFn, { deadlineAt } = {}) {
  log = logFn;
  if (deadlineAt) deadline = deadlineAt;
  if (MOCK) {
    ready = ['gemini'];
    started = [...ready];
    return ready[0];
  }
  if (await probeGemini(log)) ready.push('gemini');
  else log('Gemini معطّل اليوم');
  if (await probeMistral(log)) ready.push('mistral');
  try {
    await ensureCfText(log);
    ready.push('cloudflare');
  } catch (e) {
    log(`Cloudflare: ${e.message}`);
  }
  if (!ready.length) throw new Error('ماكو أي ذكاء اصطناعي يشتغل اليوم');
  started = [...ready];
  log(`العقل الرئيسي: ${NAMES[ready[0]]}${ready[1] ? `، والرأي الثاني: ${NAMES[ready[1]]}` : ''}`);
  return ready[0];
}

const deadReason = (p) => ({ gemini: geminiDead, mistral: mistralDead })[p]?.() || '';

async function askOne(p, parts, opts) {
  if (p === 'gemini') return askGemini(parts, opts);
  // الصور تروح لـ Gemini بس
  if (typeof parts !== 'string' && parts.some((x) => x.inline_data)) throw new Error('no-vision');
  const text = typeof parts === 'string' ? parts : parts.map((x) => x.text || '').join('\n');
  const out = p === 'mistral' ? await askMistral(opts.system, text, opts) : await askCf(opts.system, text, opts);
  return opts.json === false ? out : parseJSON(out);
}

// يجرب المزودين من index وطالع. الي يرفض (حصة) ينشال من القائمة لباقي اليوم
async function askFrom(index, parts, opts) {
  if (aiLeft() <= 0) throw new Error('budget');
  used++;
  for (let i = Math.min(index, ready.length - 1); i < ready.length; ) {
    const p = ready[i];
    try {
      return await askOne(p, parts, opts);
    } catch (e) {
      if (e.message !== 'daily-quota') throw e;
      log(`${NAMES[p]} وقف (${deadReason(p) || 'الحصة خلصت'})${ready[i + 1] ? `، نكمل بـ ${NAMES[ready[i + 1]]}` : ''}`);
      ready.splice(i, 1);
    }
  }
  throw new Error('daily-quota');
}

/** طلب للعقل الرئيسي. يرجع JSON (أو نص إذا json:false). يرمي 'budget' أو 'daily-quota' إذا لازم نوقف. */
export const ask = (parts, opts = {}) => askFrom(0, parts, opts);

/** "رأي ثاني": من المزود الثاني (شركة مختلفة) إذا موجود، وإلا من الرئيسي. */
export const askSecond = (parts, opts = {}) => askFrom(ready.length > 1 ? 1 : 0, parts, opts);
