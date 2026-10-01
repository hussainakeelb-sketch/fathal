// الروبوت اليومي لموقع فطحل. يشتغل لحاله على GitHub Actions كل يوم:
//   1) يعالج بلاغات اللاعبين
//   2) يولّد أسئلة جديدة ويراجعها (كل يوم لحد ما توصل كل الفئات للهدف، بعدها مرة بالأسبوع)
//   3) يحفظ ويبني ملفات الموقع، وGitHub Actions ترفعها وCloudflare ينشرها تلقائياً
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, MOCK, GEMINI, CF, TARGET } from './config.mjs';
import { Store, loadCategories } from './store.mjs';
import { processReports } from './reports.mjs';
import { generate } from './generate.mjs';
import { geminiUsed, currentModel } from './gemini.mjs';

const lines = [];
const log = (s) => {
  console.log(s);
  lines.push(s);
};

function checkEnv() {
  if (MOCK) return log('🧪 وضع التجربة: ماكو اتصال بأي خدمة حقيقية');
  const missing = [];
  if (!GEMINI.key) missing.push('GEMINI_API_KEY');
  if (!CF.accountId) missing.push('CF_ACCOUNT_ID');
  if (!CF.token) missing.push('CF_API_TOKEN');
  if (!CF.d1Id) missing.push('D1_DATABASE_ID');
  if (missing.length) throw new Error(`مفاتيح ناقصة: ${missing.join('، ')}`);
}

async function main() {
  const started = Date.now();
  checkEnv();
  const { categories } = loadCategories();
  const store = new Store();
  const only = process.env.ROBOT_ONLY; // reports | generate (اختياري)

  if (only !== 'generate') {
    try {
      await processReports(store, categories, log);
    } catch (e) {
      log(`⚠️ البلاغات: ${e.message}`);
    }
    store.save();
  }

  if (only !== 'reports') {
    const allFull = categories.every((c) => store.live(c.id).length >= TARGET.full);
    const isWeeklyDay = new Date().getUTCDay() === TARGET.weeklyDay;
    if (allFull && !isWeeklyDay && !process.env.ROBOT_FORCE) {
      log('التوليد: كل الفئات وصلت للهدف، التوليد الجاي يوم الجمعة');
    } else {
      await generate(store, categories, log, { weekly: allFull });
    }
  }

  const saved = store.save();
  execFileSync(process.execPath, [path.join(ROOT, 'scripts/build-data.mjs')], { stdio: 'inherit' });

  const counts = categories.map((c) => `${c.name}: ${store.live(c.id).length}`);
  log(`نموذج Gemini: ${currentModel()}، طلبات: ${geminiUsed()}، ملفات تغيرت: ${saved}، الوقت: ${Math.round((Date.now() - started) / 1000)} ثانية`);
  log(`عدد الأسئلة: ${counts.join(' | ')}`);

  // سجل مختصر آخر 30 تشغيل
  const logFile = path.join(ROOT, 'data/robot-log.json');
  const history = fs.existsSync(logFile) ? JSON.parse(fs.readFileSync(logFile, 'utf8')) : [];
  history.unshift({ at: new Date().toISOString(), mock: MOCK || undefined, lines });
  fs.writeFileSync(logFile, JSON.stringify(history.slice(0, 30), null, 1));

  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## روبوت فطحل\n\n${lines.map((l) => `- ${l}`).join('\n')}\n`);
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
