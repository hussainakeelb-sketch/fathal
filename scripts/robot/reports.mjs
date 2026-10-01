// معالجة بلاغات اللاعبين: الذكاء الاصطناعي يتأكد من المعلومة ببحث گوگل، ويقرر يبقي السؤال أو يصلحه أو يحذفه.
import { d1 } from './cloudflare.mjs';
import { ask, geminiLeft } from './gemini.mjs';
import { reportPrompt, SYSTEM } from './prompts.mjs';
import { localCheck, today } from './store.mjs';

const MAX_QUESTIONS_PER_RUN = 40;

export async function processReports(store, cats, log) {
  const pending = await d1("SELECT id, qid, cat, q, a, reason, note FROM reports WHERE status = 'pending' ORDER BY id LIMIT 500");
  if (!pending.length) return log('البلاغات: ماكو بلاغات جديدة');

  // نجمع البلاغات حسب السؤال
  const byQ = new Map();
  for (const r of pending) {
    if (!byQ.has(r.qid)) byQ.set(r.qid, []);
    byQ.get(r.qid).push(r);
  }

  const done = { keep: 0, fix_answer: 0, rewrite: 0, drop_media: 0, remove: 0, missing: 0 };
  let handled = 0;
  for (const [qid, reports] of byQ) {
    if (handled >= MAX_QUESTIONS_PER_RUN || geminiLeft() < 5) break;
    handled++;
    const found = store.find(qid);
    let resolution;
    if (!found || found.q.status === 'removed') {
      resolution = 'missing';
    } else {
      const cat = cats.find((c) => c.id === found.cat) || { name: found.cat, guide: '' };
      let decision;
      try {
        decision = await ask(reportPrompt(cat, found.q, reports), { system: SYSTEM, search: true, temperature: 0, kind: 'report' });
      } catch (e) {
        if (e.message === 'budget' || e.message === 'daily-quota') break;
        log(`  ⚠️ بلاغ ${qid}: ${e.message}`);
        continue; // يبقى pending ونرجعله باچر
      }
      resolution = applyDecision(store, found, decision);
    }
    done[resolution] = (done[resolution] || 0) + 1;
    const ids = reports.map((r) => r.id);
    await d1(
      `UPDATE reports SET status = 'done', resolution = ?, resolved_at = ? WHERE id IN (${ids.map(() => '?').join(',')})`,
      [resolution, new Date().toISOString(), ...ids]
    );
  }
  log(`البلاغات: عالجنا ${handled} سؤال — بقى كما هو ${done.keep}، تصحيح جواب ${done.fix_answer}، إعادة صياغة ${done.rewrite}، شيل وسائط ${done.drop_media}، حذف ${done.remove}`);
}

function applyDecision(store, { cat, q }, d) {
  const action = d?.action;
  const stamp = { reviewed: today() };
  if (action === 'fix_answer' && d.a && !localCheck({ ...q, a: d.a })) {
    store.update(cat, q.id, { a: String(d.a).trim(), ...stamp });
    return 'fix_answer';
  }
  if (action === 'rewrite' && d.q && d.a && !localCheck({ p: q.p, q: d.q, a: d.a })) {
    // الرقم يبقى نفسه حتى سجل "شافه الجهاز" يبقى صحيح
    store.update(cat, q.id, { q: String(d.q).trim(), a: String(d.a).trim(), ...stamp });
    return 'rewrite';
  }
  if (action === 'drop_media' && q.m) {
    // إذا السؤال يعتمد على الصورة أو الصوت ("شنو هذا؟")، نحذفه بدل ما يصير ناقص
    if (/(هذا|هاي|هذي|الصورة|الصوت|المقطع)/.test(q.q)) {
      store.update(cat, q.id, { status: 'removed', removedWhy: 'media', ...stamp });
      return 'remove';
    }
    store.update(cat, q.id, { t: 'text', m: undefined, credit: undefined, ...stamp });
    return 'drop_media';
  }
  if (action === 'keep') {
    store.update(cat, q.id, stamp);
    return 'keep';
  }
  // أي شي ثاني (remove، أو قرار ناقص) = نحذف السؤال، الأسلم للعائلة
  store.update(cat, q.id, { status: 'removed', removedWhy: d?.why ? String(d.why).slice(0, 200) : 'report', ...stamp });
  return 'remove';
}
