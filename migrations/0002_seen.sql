-- الأسئلة المستعملة لكل الأجهزة (ينحسب فوراً لأي لعبة تبدي بعد ما ينفتح). الجداول تنسوّى تلقائياً من functions/api/seen.js،
-- وهذا الملف بس للتوثيق أو إذا احتجنا نسويها يدوياً.
CREATE TABLE IF NOT EXISTS seen (
  qid TEXT PRIMARY KEY,   -- رقم السؤال (<الفئة>-<8 حروف>)
  cat TEXT NOT NULL,      -- الفئة
  at INTEGER NOT NULL     -- آخر مرة انفتح (milliseconds)
);
CREATE INDEX IF NOT EXISTS idx_seen_cat ON seen(cat);

-- عدّاد يومي لكل جهاز (بصمة مشفرة) حتى نمنع العبث
CREATE TABLE IF NOT EXISTS seen_hits (
  ip_hash TEXT NOT NULL,
  day TEXT NOT NULL,
  n INTEGER NOT NULL,
  PRIMARY KEY (ip_hash, day)
);
