// توليد أسئلة جديدة: Gemini يكتب، وبعدين Gemini ثاني (ويه بحث گوگل) يراجع بشدة، وبس الي ينجح ينضاف.
import { ask, geminiLeft } from './gemini.mjs';
import { generatePrompt, reviewPrompt, SYSTEM } from './prompts.mjs';
import { LEVELS, localCheck, makeId, norm, today } from './store.mjs';
import { buildMedia } from './media.mjs';
import { imagesLeft } from './cloudflare.mjs';
import { TARGET } from './config.mjs';

// كم سؤال نحتاج بكل مستوى حتى نوصل الهدف
function needFor(store, cat, target) {
  const counts = store.levelCounts(cat.id);
  const perLevel = target / 3;
  const need = {};
  let left = TARGET.batch;
  // نعبي المستوى الأنقص أول
  for (const p of [...LEVELS].sort((a, b) => counts[a] - counts[b])) {
    const n = Math.max(0, Math.min(left, Math.ceil(perLevel - counts[p]), Math.ceil(TARGET.batch / 2)));
    need[p] = n;
    left -= n;
  }
  return need;
}

export async function generate(store, cats, log, { weekly }) {
  const known = store.allNormalized();
  const stats = new Map();
  // الترتيب: الفئات الي بيها أقل أسئلة أول
  const order = () =>
    cats
      .map((c) => ({ c, live: store.live(c.id).length }))
      .sort((a, b) => a.live - b.live);

  const targetFor = (live) => (weekly ? live + 1 : live < TARGET.launch ? TARGET.launch : TARGET.full);
  const weeklyLeft = new Map(cats.map((c) => [c.id, weekly ? TARGET.weekly : Infinity]));

  while (geminiLeft() >= 3) {
    const next = order().find(({ c, live }) => (weekly ? weeklyLeft.get(c.id) > 0 : live < TARGET.full) && !stats.get(c.id)?.stuck);
    if (!next) break;
    const { c: cat, live } = next;
    const target = weekly ? live + weeklyLeft.get(cat.id) : targetFor(live);
    const need = needFor(store, cat, Math.max(target, live + 3));
    const s = stats.get(cat.id) || { added: 0, rejected: 0, tries: 0 };
    stats.set(cat.id, s);
    s.tries++;

    try {
      // 1) التوليد
      const existing = store.get(cat.id).map((q) => q.q);
      const out = await ask(generatePrompt(cat, need, existing, cat.media || 'none'), { system: SYSTEM, temperature: 0.9, kind: 'generate' });
      let items = (out.questions || []).map((x) => ({ ...x, p: Number(x.p), q: String(x.q || '').trim(), a: String(x.a || '').trim() }));

      // 2) فحص محلي + منع التكرار
      items = items.filter((it) => {
        const bad = localCheck(it) || (known.has(norm(it.q)) && 'مكرر');
        if (bad) s.rejected++;
        return !bad;
      });
      if (!items.length) {
        if (s.tries >= 4 && !s.added) s.stuck = true;
        continue;
      }

      // 3) المراجعة الصارمة ويه بحث گوگل
      const review = await ask(reviewPrompt(cat, items), { search: true, temperature: 0, kind: 'review' });
      const results = new Map((review.results || []).map((r) => [Number(r.i), r]));

      for (const [i, it] of items.entries()) {
        const r = results.get(i);
        if (!r || r.ok !== true) {
          s.rejected++;
          continue;
        }
        if (r.a) it.a = String(r.a).trim();
        if (LEVELS.includes(Number(r.p))) it.p = Number(r.p);
        if (localCheck(it)) {
          s.rejected++;
          continue;
        }
        const id = makeId(cat.id, it.q);
        const q = { id, p: it.p, t: 'text', q: it.q, a: it.a, src: 'robot', created: today(), ...(it.fact ? { fact: String(it.fact).slice(0, 200) } : {}) };

        // 4) الوسائط (إذا موجودة): إذا فشلت والسؤال يعتمد عليها، ما ننشره
        if ((it.type === 'image' || it.type === 'audio') && it.media) {
          const needsMedia = /(هذا|هاي|هذي|الصورة|الصوت|المقطع|بالصورة)/.test(it.q);
          const canImage = it.media.source !== 'ai' || imagesLeft() > 0;
          const media = canImage && geminiLeft() > 1 ? await buildMedia(cat.id, id, it) : null;
          if (media) {
            q.t = it.type === 'audio' || it.media.kind === 'audio' ? 'audio' : 'image';
            q.m = media.m;
            q.credit = media.credit;
          } else if (needsMedia) {
            s.rejected++;
            continue;
          }
        }
        store.add(cat.id, q);
        known.add(norm(q.q));
        s.added++;
        if (weekly) weeklyLeft.set(cat.id, weeklyLeft.get(cat.id) - 1);
      }
      if (s.tries >= 6 && s.added === 0) s.stuck = true;
    } catch (e) {
      if (e.message === 'budget' || e.message === 'daily-quota') break;
      log(`  ⚠️ ${cat.id}: ${e.message}`);
      if (s.tries >= 4) s.stuck = true;
    }
  }

  let total = 0;
  for (const [id, s] of stats) {
    total += s.added;
    log(`  ${id}: +${s.added} (مرفوض ${s.rejected})${s.stuck ? ' — توقف مؤقتاً' : ''}`);
  }
  log(`التوليد: انضاف ${total} سؤال جديد`);
  return total;
}
