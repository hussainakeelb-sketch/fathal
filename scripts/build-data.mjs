// يبني ملفات البيانات الي يقراها الموقع من data/:
//   public/data/index.json      قائمة الأقسام والفئات وعدد أسئلة كل فئة
//   public/data/cats/<id>.json  أسئلة كل فئة (ملف لكل فئة، حتى اللاعب ينزّل بس الي يحتاجه)
//   src/data/catIcons.js        أيقونات Tabler الي تستخدمها الفئات بس
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..');
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));

const { sections, categories } = read('data/categories.json');
const qDir = path.join(root, 'data/questions');
const outDir = path.join(root, 'public/data');
fs.mkdirSync(path.join(outDir, 'cats'), { recursive: true });

const LEVELS = [200, 400, 600];
const version = Date.now();
const index = { v: version, sections, categories: [] };

for (const c of categories) {
  const file = path.join(qDir, `${c.id}.json`);
  const questions = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
  const live = questions.filter((q) => q.status !== 'removed');
  const levels = Object.fromEntries(LEVELS.map((p) => [p, live.filter((q) => q.p === p).length]));
  // الفئة تنعرض بس إذا بيها سؤالين على الأقل بكل مستوى (لوحة وحدة كاملة)
  const ready = LEVELS.every((p) => levels[p] >= 2);
  index.categories.push({ id: c.id, section: c.section, name: c.name, icon: c.icon, count: live.length, ready, ...(c.tiebreak && { tiebreak: true }) });
  if (live.length) {
    const out = live.map(({ id, p, t, q, a, m }) => ({ id, p, t, q, a, ...(m && { m }) }));
    fs.writeFileSync(path.join(outDir, 'cats', `${c.id}.json`), JSON.stringify({ id: c.id, v: version, questions: out }));
  }
}
fs.writeFileSync(path.join(outDir, 'index.json'), JSON.stringify(index));

// الأيقونات: نأخذ بس الي نحتاجها من Tabler (رخصة MIT)
const nodes = JSON.parse(fs.readFileSync(path.join(root, 'node_modules/@tabler/icons/tabler-nodes-outline.json'), 'utf8'));
const icons = {};
for (const c of categories) {
  if (!nodes[c.icon]) throw new Error(`أيقونة مو موجودة: ${c.icon}`);
  icons[c.icon] = nodes[c.icon].map(([tag, attrs]) => {
    const { key, ...rest } = attrs;
    return [tag, rest];
  });
}
fs.mkdirSync(path.join(root, 'src/data'), { recursive: true });
fs.writeFileSync(
  path.join(root, 'src/data/catIcons.js'),
  `// ملف مولّد من scripts/build-data.mjs. لا تعدّله بإيدك.\nexport const CAT_ICONS = ${JSON.stringify(icons)};\n`
);

const ready = index.categories.filter((c) => c.ready).length;
console.log(`فئات: ${categories.length}، الجاهزة: ${ready}، الأسئلة: ${index.categories.reduce((s, c) => s + c.count, 0)}`);
