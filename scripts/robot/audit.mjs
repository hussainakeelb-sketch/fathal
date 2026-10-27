// مراجعة الأسئلة القديمة على قواعد الصعوبة والتوازن الجديدة، شوية كل يوم (TARGET.audit سؤال):
//  1) كل سؤال ياخذ مستواه الصحيح حسب المقياس (200 للمهتم، 400 للمتابع، 600 فطحل)، بس إذا تقييمين منفصلين اتفقوا
//  2) أسئلة الأرقام الزايدة عن سؤال من كل 5 بالمستوى تنشال، والتوليد يعوّضها بأسئلة مو أرقام
//  3) أي مستوى ما ينزل أبداً تحت BALANCE.minPerLevel، حتى الفئة ما تنقص
import { ask, askSecond, aiLeft, aiCaps } from './ai.mjs';
import { auditPrompt, SYSTEM } from './prompts.mjs';
import { LEVELS, isLive, isNumeric, balanceOf, today } from './store.mjs';
import { TARGET, BALANCE } from './config.mjs';
import { sourcesForMany } from './wiki.mjs';

const BATCH = 15;

// الفئات الي بيها أكثر نسبة أرقام تتراجع أول
function numericExcess(qs) {
  const b = balanceOf(qs);
  return Math.max(...LEVELS.map((p) => (b[p].n ? b[p].numeric / b[p].n : 0)));
}

// ننقل المستوى بس إذا المستوى القديم يبقى بيه العدد الأدنى. ونعيد اللفة لأن نقلة لفوگ
// تفسح المجال لنقلة لجوه (مثلاً 600←400 تسمح بعدها بـ 400←600). الي ما ينتقل يبقى pWant وينتظر.
function applyMoves(store, cat, qs) {
  let moved = 0;
  for (let changed = true; changed; ) {
    changed = false;
    for (const q of qs) {
      if (!isLive(q) || !q.pWant || q.pWant === q.p || balanceOf(qs)[q.p].n <= BALANCE.minPerLevel) continue;
      if (q.pWant === 200 && isNumeric(q)) continue; // أسئلة السنين ما تنزل لـ 200
      store.update(cat.id, q.id, { pWas: q.p, p: q.pWant, pWant: undefined });
      changed = true;
      moved++;
    }
  }
  // تبديل: سؤال لفوگ ويه سؤال لجوه بين نفس المستويين، فالعدد ما يتغير (يحل حالة 20/20/20)
  const waiting = qs.filter((q) => isLive(q) && q.pWant && q.pWant !== q.p && !(q.pWant === 200 && isNumeric(q)));
  for (const a of waiting) {
    if (!a.pWant || a.pWant === a.p) continue;
    const b = waiting.find((x) => x !== a && x.pWant && x.p === a.pWant && x.pWant === a.p);
    if (!b) continue;
    const [pa, pb] = [a.p, b.p];
    store.update(cat.id, a.id, { pWas: pa, p: pb, pWant: undefined });
    store.update(cat.id, b.id, { pWas: pb, p: pa, pWant: undefined });
    moved += 2;
  }
  return moved;
}

async function rate(cat, items, search, sources, second = false) {
  const res = await (second ? askSecond : ask)(auditPrompt(cat, items, { search, sources }), { system: SYSTEM, search, temperature: 0, kind: 'audit' });
  return new Map((res.results || []).map((r) => [Number(r.i), r]));
}

export async function audit(store, cats, log) {
  const { search } = aiCaps();
  const done = { checked: 0, moved: 0, removedNumeric: 0, removedWrong: 0, flagged: 0 };
  const order = cats
    .map((c) => ({ c, qs: store.get(c.id) }))
    .filter(({ qs }) => qs.some((q) => isLive(q) && (!q.audited || (q.pWant && q.pWant !== q.p))) || numericExcess(qs) > BALANCE.maxNumericShare)
    .sort((a, b) => numericExcess(b.qs) - numericExcess(a.qs));

  outer: for (const { c: cat, qs } of order) {
    // 1) شيل أسئلة الأرقام الزايدة (محلياً، بدون ذكاء اصطناعي)، الأقدم إضافةً أول
    for (const p of LEVELS) {
      const lv = qs.filter((q) => isLive(q) && q.p === p);
      const nums = lv.filter(isNumeric);
      let extra = nums.length - Math.floor(lv.length * BALANCE.maxNumericShare);
      for (const q of nums) {
        if (extra <= 0 || balanceOf(qs)[p].n <= BALANCE.minPerLevel) break;
        store.update(cat.id, q.id, { status: 'removed', removedWhy: 'balance: too many number questions', audited: today() });
        done.removedNumeric++;
        extra--;
      }
    }

    // نقلات من أيام سابقة كانت تنتظر مكان
    done.moved += applyMoves(store, cat, qs);

    // 2) إعادة تقييم المستوى بالذكاء الاصطناعي
    const todo = qs.filter((q) => isLive(q) && !q.audited);
    for (let i = 0; i < todo.length; i += BATCH) {
      if (done.checked >= TARGET.audit || aiLeft() < 4) break outer;
      const items = todo.slice(i, i + BATCH);
      // تأكيد مرتين: نسأل مرتين منفصلتين (المرة الثانية بترتيب مقلوب)، والقرار يمشي بس إذا الجوابين اتفقوا
      let r1, r2;
      try {
        // التقييم الثاني من شركة ثانية إذا موجودة (Mistral أو Cloudflare)، وويه مقتطفات ويكيبيديا إذا ماكو بحث گوگل
        const rev = [...items].reverse();
        r1 = await rate(cat, items, search, search ? '' : await sourcesForMany(items));
        r2 = await rate(cat, rev, search, await sourcesForMany(rev), true);
      } catch (e) {
        if (e.message === 'budget' || e.message === 'daily-quota') break outer;
        log(`  ⚠️ مراجعة ${cat.id}: ${e.message.slice(0, 160)}`);
        continue;
      }
      const n = items.length;
      for (const [j, q] of items.entries()) {
        const a1 = r1.get(j);
        const a2 = r2.get(n - 1 - j);
        if (!a1 || !a2) continue;
        done.checked++;
        const patch = { audited: today() };
        // غلط: لازم الجوابين يگولون غلط. نحذفه بس إذا تأكدنا ببحث گوگل، وإلا ملاحظة للمراجعة
        if (a1.wrong === true && a2.wrong === true) {
          if (search && balanceOf(qs)[q.p].n > BALANCE.minPerLevel) {
            store.update(cat.id, q.id, { ...patch, status: 'removed', removedWhy: `audit: ${String(a1.why || '').slice(0, 150)}` });
            done.removedWrong++;
            continue;
          }
          patch.flag = `audit: ${String(a1.why || '').slice(0, 150)}`;
          done.flagged++;
        }
        const p1 = Number(a1.p);
        const p2 = Number(a2.p);
        // المستوى يتغير بس إذا الجوابين اتفقوا، وأسئلة السنين والأرقام ما تنزل لـ 200 أبداً
        if (LEVELS.includes(p1) && p1 === p2 && p1 !== q.p && !(p1 === 200 && isNumeric(q))) patch.pWant = p1;
        else if (q.pWant) patch.pWant = undefined;
        store.update(cat.id, q.id, patch);
      }
      done.moved += applyMoves(store, cat, qs);
    }
  }
  log(`المراجعة على القواعد: راجعنا ${done.checked} سؤال — تغيّر مستواه ${done.moved}، شلنا أرقام زايدة ${done.removedNumeric}، شلنا غلط ${done.removedWrong}، للمراجعة ${done.flagged}`);
  return done;
}
