// رفع الصعوبة (طلب صاحب المشروع): أسئلة 600 القديمة تصير 200،
// وأسئلة 400 و600 الجديدة (الأصعب) تجي من data/hard/<فئة>.txt
// يشتغل بس على الفئات الي إلها ملف بـ data/hard وبيه 20 سؤال 400 و20 سؤال 600 على الأقل.
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..');
const only = process.argv.slice(2);
for (const f of fs.readdirSync(path.join(root, 'data/hard')).filter((f) => f.endsWith('.txt'))) {
  const cat = f.replace('.txt', '');
  if (only.length && !only.includes(cat)) continue;
  const hard = fs.readFileSync(path.join(root, 'data/hard', f), 'utf8').split(/\r?\n/).filter(Boolean);
  const n4 = hard.filter((l) => l.startsWith('400|')).length;
  const n6 = hard.filter((l) => l.startsWith('600|')).length;
  if (n4 < 20 || n6 < 20 || hard.some((l) => l.startsWith('200|'))) {
    console.log(`${cat}: ناقص (400: ${n4}، 600: ${n6})، ما انلمس`);
    continue;
  }
  const srcFile = path.join(root, 'data/src', f);
  const old = fs.existsSync(srcFile) ? fs.readFileSync(srcFile, 'utf8').split(/\r?\n/).filter(Boolean) : [];
  const promoted = old.filter((l) => l.startsWith('600|')).map((l) => '200|' + l.slice(4));
  fs.writeFileSync(srcFile, [...promoted, ...hard].join('\n') + '\n');
  fs.renameSync(path.join(root, 'data/hard', f), path.join(root, 'data/hard', f + '.done'));
  console.log(`${cat}: 200=${promoted.length} 400=${n4} 600=${n6}`);
}
