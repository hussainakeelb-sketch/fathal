-- بلاغات اللاعبين عن الأسئلة. الروبوت يقراها كل يوم ويعالجها.
CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  qid TEXT NOT NULL,          -- رقم السؤال
  cat TEXT NOT NULL,          -- الفئة
  q TEXT NOT NULL,            -- نص السؤال مثل ما شافه اللاعب
  a TEXT NOT NULL,            -- الجواب مثل ما شافه اللاعب
  reason TEXT NOT NULL,       -- wrong_answer | inappropriate | media | other
  note TEXT,                  -- ملاحظة اللاعب (اختيارية)
  ip_hash TEXT NOT NULL,      -- بصمة مشفرة للجهاز، بس حتى نمنع العبث (مو العنوان نفسه)
  day TEXT NOT NULL,          -- YYYY-MM-DD
  created_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | done
  resolution TEXT,            -- شنو قرر الروبوت
  resolved_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_ip_day ON reports(ip_hash, day);
