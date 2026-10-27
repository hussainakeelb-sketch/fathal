// الروبوت اليومي لموقع فطحل. يشتغل لحاله على GitHub Actions كل يوم:
//   1) يعالج بلاغات اللاعبين
//   2) يراجع شوية من الأسئلة القديمة على قواعد الصعوبة والتوازن
//   3) يولّد أسئلة جديدة ويراجعها (كل يوم لحد ما توصل كل الفئات للهدف، بعدها مرة بالأسبوع)
//   4) يحفظ ويبني ملفات الموقع، وGitHub Actions ترفعها وCloudflare ينشرها تلقائياً
// العقل: Gemini إذا عنده حصة، وإلا Cloudflare Workers AI. وما يشتغل أكثر من AI.maxMinutes دقيقة.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, MOCK, CF, TARGET, AI } from './config.mjs';
import { Store, loadCategories } from './store.mjs';
import { processReports } from './reports.mjs';
import { audit } from './audit.mjs';
import { generate } from './generate.mjs';
import { ensureAI, aiUsed, aiProvider, aiModel } from './ai.mjs';

const lines = [];
const log = (s) => {
  console.log(s);
  lines.push(s);
};

function checkEnv() {
  if (MOCK) return log('🧪 وضع التجربة: ماكو اتصال بأي خدمة حقيقية');
  const missing = [];
  if (!CF.accountId) missing.push('CF_ACCOUNT_ID');
  if (!CF.token) missing.push('CF_API_TOKEN');
  if (!CF.d1Id) missing.push('D1_DATABASE_ID');
  if (missing.length) throw new Error(`مفاتيح ناقصة: ${missing.join('، ')}`);
}

// سجل مختصر آخر 30 تشغيل
function saveLog() {
  const logFile = path.join(ROOT, 'data/robot-log.json');
  const history = fs.existsSync(logFile) ? JSON.parse(fs.readFileSync(logFile, 'utf8')) : [];
  history.unshift({ at: new Date().toISOString(), mock: MOCK || undefined, lines });
  fs.writeFileSync(logFile, JSON.stringify(history.slice(0, 30), null, 1));
}

async function main() {
  const started = Date.now();
  const { categories } = loadCategories();
  const store = new Store();
  const only = process.env.ROBOT_ONLY; // reports | audit | generate (اختياري)
  const step = async (name, fn) => {
    if (only && only !== name) return;
    try {
      await fn();
    } catch (e) {
      log(`⚠️ ${name}: ${e.message}`);
    }
    store.save();
  };

  try {
    checkEnv();
    // نتأكد إن الذكاء الاصطناعي يشتغل قبل أي شي. إذا ما اشتغل، نسجل السبب ونوقف
    try {
      await ensureAI(log, { deadlineAt: started + AI.maxMinutes * 60_000 });
    } catch (e) {
      log(`❌ ${e.message}`);
      process.exitCode = 1;
      return;
    }

    await step('reports', () => processReports(store, categories, log));
    await step('audit', () => audit(store, categories, log));
    await step('generate', async () => {
      const allFull = categories.every((c) => store.live(c.id).length >= TARGET.full);
      const isWeeklyDay = new Date().getUTCDay() === TARGET.weeklyDay;
      if (allFull && !isWeeklyDay && !process.env.ROBOT_FORCE) return log('التوليد: كل الفئات وصلت للهدف، التوليد الجاي يوم الجمعة');
      await generate(store, categories, log, { weekly: allFull });
    });

    const saved = store.save();
    execFileSync(process.execPath, [path.join(ROOT, 'scripts/build-data.mjs')], { stdio: 'inherit' });
    log(`العقل: ${aiProvider()} (${aiModel()})، طلبات: ${aiUsed()}، ملفات تغيرت: ${saved}، الوقت: ${Math.round((Date.now() - started) / 1000)} ثانية`);
    log(`عدد الأسئلة: ${categories.map((c) => `${c.name}: ${store.live(c.id).length}`).join(' | ')}`);
  } finally {
    // السجل ينحفظ دائماً، حتى لو صار خطأ، حتى نعرف شصار
    saveLog();
    if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## روبوت فطحل\n\n${lines.map((l) => `- ${l}`).join('\n')}\n`);
  }
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
