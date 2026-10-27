// مصادر للتأكد: مقتطفات من ويكيبيديا (عربي وإنگليزي) عن موضوع السؤال، حتى النموذج ما يجاوب من ذاكرته بس.
// مجاني وبدون مفتاح. طلب وحد بكل مرة، ويه فاصل صغير، حتى نبقى مؤدبين ويه خوادم ويكيبيديا.
import { MEDIA, MOCK } from './config.mjs';
import { isNumeric } from './store.mjs';

const cache = new Map();
let lastAt = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// كلمات السؤال الي ما تفيد البحث (أدوات استفهام وحشو باللهجة والفصحى)
const STOP = new Set('شنو منو شگد وين بيا يا أي اي ما من في على عن الى إلى هو هي هاي هذا هذه هذي جان كان كانت اسم شنو؟ منو؟ سنة عام بأي باي انتج انعرض الي الذي التي ويا مع لو أو او'.split(' '));

function keywords(q) {
  return String(q)
    .replace(/[؟?!.,،:"«»()]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP.has(w))
    .slice(0, 8)
    .join(' ');
}

// بحث وأول نتيجة بطلب واحد. يرجع {title, text} أو null
async function lookup(lang, query) {
  const key = `${lang}:${query}`;
  if (cache.has(key)) return cache.get(key);
  const wait = lastAt + 300 - Date.now();
  if (wait > 0) await sleep(wait);
  lastAt = Date.now();
  const params = new URLSearchParams({
    action: 'query', format: 'json', generator: 'search', gsrsearch: query, gsrlimit: '1', gsrnamespace: '0',
    prop: 'extracts', explaintext: '1', exsectionformat: 'plain', redirects: '1',
  });
  let hit = null;
  try {
    const res = await fetch(`https://${lang}.wikipedia.org/w/api.php?${params}`, { headers: { 'user-agent': MEDIA.userAgent } });
    const page = Object.values((await res.json())?.query?.pages || {})[0];
    if (page?.extract) hit = { title: page.title, text: page.extract.replace(/\n{2,}/g, '\n') };
  } catch {}
  cache.set(key, hit);
  return hit;
}

// مقطع من المقالة: البداية، والجزء الي بيه الجواب أو كلمة من السؤال (إذا موجود)
function excerpt(text, needles, max) {
  const head = text.slice(0, Math.floor(max / 2));
  for (const n of needles.filter((x) => x && x.length > 2)) {
    const at = text.indexOf(n);
    if (at > head.length) return `${head} … ${text.slice(Math.max(0, at - max / 4), at + max / 4)}`;
    if (at >= 0) return text.slice(0, max);
  }
  return text.slice(0, max);
}

/**
 * مصادر لسؤال واحد. maxChars: حجم المقتطفات لكل مقالة.
 * نبحث بالجواب (إذا مو رقم) وبكلمات السؤال، بالعربي وبالإنگليزي.
 */
export async function sourcesFor(q, { maxChars = 700 } = {}) {
  if (MOCK) return '';
  const kw = keywords(q.q);
  // الأسماء بين علامات التنصيص (عنوان فيلم، مسلسل...) أهم شي: نبحث بيها ونلگاها بالمقالة، بعدها الجواب، بعدها الكلمات
  const quoted = [...String(q.q).matchAll(/["«“]([^"»”]{2,60})["»”]/g)].map((m) => m[1]);
  const words = kw.split(' ').sort((x, y) => y.length - x.length);
  const queries = [...new Set([quoted[0], !isNumeric(q) && q.a, kw].filter(Boolean))].slice(0, 2);
  const seen = new Set();
  const parts = [];
  for (const lang of ['ar', 'en']) {
    for (const query of queries) {
      const hit = await lookup(lang, query);
      if (!hit || seen.has(`${lang}:${hit.title}`)) continue;
      seen.add(`${lang}:${hit.title}`);
      parts.push(`[${lang} Wikipedia: ${hit.title}] ${excerpt(hit.text, [...quoted, q.a, ...words], maxChars)}`);
    }
  }
  return parts.join('\n');
}

// مصادر لمجموعة أسئلة (للمراجعة): مقتطف أقصر لكل سؤال حتى الطلب ما يكبر
export async function sourcesForMany(items, { maxChars = 350 } = {}) {
  const out = [];
  for (const [i, q] of items.entries()) {
    const s = await sourcesFor(q, { maxChars });
    if (s) out.push(`#${i}:\n${s}`);
  }
  return out.join('\n');
}
