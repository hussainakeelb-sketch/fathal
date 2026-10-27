// معالجة بلاغات اللاعبين: الذكاء الاصطناعي يتأكد من المعلومة (ببحث گوگل إذا Gemini متوفر)، ويقرر يبقي السؤال أو يصلحه أو يحذفه.
// إذا ما متأكد (unsure)، السؤال يبقى والبلاغ يروح لطابور المراجعة الأسبوعية (Claude):
//   الروبوت يكتب الطابور بـ data/review-queue.json، وClaude يكتب قراراته بـ data/review-decisions.json،
//   والروبوت ينفذها بالتشغيل الجاي ويمسح الملف.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './config.mjs';
import { isLive } from './store.mjs';
import { d1 } from './cloudflare.mjs';
import { ask, aiLeft, aiCaps } from './ai.mjs';
import { sourcesFor } from './wiki.mjs';
import { reportPrompt, SYSTEM } from './prompts.mjs';
import { localCheck, today } from './store.mjs';

const MAX_QUESTIONS_PER_RUN = 40;

const QUEUE = path.join(ROOT, 'data/review-queue.json');
const DECISIONS = path.join(ROOT, 'data/review-decisions.json');

// ملاحظات اللاعبين تنحفظ بمستودع عام: نشيل منها أي إيميل أو رقم تلفون أو رابط
const clean = (t) =>
  String(t || '')
    .replace(/\S+@\S+/g, '[…]')
    .replace(/https?:\/\/\S+|www\.\S+/g, '[…]')
    .replace(/[+\d][\d\s-]{7,}\d/g, '[…]')
    .slice(0, 300);

// قرارات Claude من المراجعة الأسبوعية: [{ "report_ids":[..], "qid":"..", "action":"keep|fix_answer|rewrite|drop_media|remove", "a":"..", "q":"..", "why":".." }]
async function applyClaudeDecisions(store, log) {
  if (!fs.existsSync(DECISIONS)) return;
  let list = [];
  try {
    list = JSON.parse(fs.readFileSync(DECISIONS, 'utf8'));
  } catch (e) {
    return log(`⚠️ قرارات Claude: الملف مو صالح (${e.message})`);
  }
  let n = 0;
  for (const d of list) {
    const found = d.qid && store.find(d.qid);
    const resolution = found && found.q.status !== 'removed' && d.action ? applyDecision(store, found, d) : 'missing';
    const ids = (d.report_ids || []).filter(Number.isInteger);
    if (ids.length) {
      await d1(
        `UPDATE reports SET status = 'done', resolution = ?, resolved_at = ? WHERE id IN (${ids.map(() => '?').join(',')})`,
        [`claude:${resolution}`, new Date().toISOString(), ...ids]
      );
    }
    n++;
  }
  fs.rmSync(DECISIONS);
  log(`قرارات Claude: نفذنا ${n} قرار`);
}

// الطابور للمراجعة الأسبوعية: بلاغات ما تأكد منها الروبوت، وأسئلة شك بيها بالمراجعة على القواعد
export async function exportQueue(store, cats, log) {
  const rows = await d1("SELECT id, qid, cat, reason, note FROM reports WHERE status = 'review' ORDER BY id LIMIT 300");
  const reports = [];
  const byQ = new Map();
  for (const r of rows) {
    if (!byQ.has(r.qid)) byQ.set(r.qid, []);
    byQ.get(r.qid).push(r);
  }
  for (const [qid, rs] of byQ) {
    const found = store.find(qid);
    reports.push({
      qid,
      report_ids: rs.map((r) => r.id),
      q: found?.q.q,
      a: found?.q.a,
      p: found?.q.p,
      reasons: rs.map((r) => ({ reason: r.reason, ...(r.note ? { note: clean(r.note) } : {}) })),
    });
  }
  const flagged = [];
  for (const c of cats) for (const q of store.get(c.id)) if (isLive(q) && q.flag) flagged.push({ cat: c.id, id: q.id, p: q.p, q: q.q, a: q.a, flag: q.flag });
  fs.writeFileSync(QUEUE, JSON.stringify({ updated: new Date().toISOString(), reports, flagged }, null, 1));
  log(`طابور المراجعة الأسبوعية: ${reports.length} بلاغ، ${flagged.length} سؤال مشكوك بيه`);
}

export async function processReports(store, cats, log) {
  await applyClaudeDecisions(store, log);
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
    if (handled >= MAX_QUESTIONS_PER_RUN || aiLeft() < 5) break;
    handled++;
    const found = store.find(qid);
    let resolution;
    if (!found || found.q.status === 'removed') {
      resolution = 'missing';
    } else {
      const cat = cats.find((c) => c.id === found.cat) || { name: found.cat, guide: '' };
      let decision;
      try {
        const { search } = aiCaps();
        const sources = search ? '' : await sourcesFor(found.q, { maxChars: 900 });
        decision = await ask(reportPrompt(cat, found.q, reports, { search, sources }), { system: SYSTEM, search, temperature: 0, kind: 'report' });
      } catch (e) {
        if (e.message === 'budget' || e.message === 'daily-quota') break;
        log(`  ⚠️ بلاغ ${qid}: ${e.message}`);
        continue; // يبقى pending ونرجعله باچر
      }
      // بدون بحث گوگل، الحذف والتعديل يحتاجون تأكيد أقوى: إذا مو متأكد، ننتظر
      if (decision?.action === 'unsure' || !decision?.action) {
        // يروح لطابور المراجعة الأسبوعية (Claude) بدل ما نعيده كل يوم
        await d1(`UPDATE reports SET status = 'review' WHERE id IN (${reports.map(() => '?').join(',')})`, reports.map((r) => r.id));
        done.unsure = (done.unsure || 0) + 1;
        continue;
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
  log(`البلاغات: عالجنا ${handled} سؤال — بقى كما هو ${done.keep}، تصحيح جواب ${done.fix_answer}، إعادة صياغة ${done.rewrite}، شيل وسائط ${done.drop_media}، حذف ${done.remove}، ينتظر مراجعة ${done.unsure || 0}`);
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
