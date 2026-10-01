// إعدادات الروبوت. كل المفاتيح السرية تجي من متغيرات البيئة (GitHub Secrets)، وما تنكتب بالكود أبداً.
import path from 'node:path';

export const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '../..');

const env = process.env;
export const MOCK = env.ROBOT_MOCK === '1'; // تشغيل تجريبي بدون أي خدمة خارجية

export const GEMINI = {
  key: env.GEMINI_API_KEY,
  // إذا هذا النموذج ما متوفر، الروبوت يدوّر لحاله على نموذج Flash ثاني مجاني
  model: env.GEMINI_MODEL || 'gemini-2.5-flash',
  maxRequests: Number(env.GEMINI_MAX_REQUESTS || 180), // حد يومي حتى نبقى ضمن الباقة المجانية
  minGapMs: Number(env.GEMINI_MIN_GAP_MS || 7000), // تقريباً 8 طلبات بالدقيقة
};

export const CF = {
  accountId: env.CF_ACCOUNT_ID,
  token: env.CF_API_TOKEN,
  d1Id: env.D1_DATABASE_ID,
  maxImages: Number(env.CF_MAX_IMAGES || 120), // الحد المجاني تقريباً 170 صورة باليوم
};

export const TARGET = {
  launch: 60, // أقل عدد حتى تكون الفئة جاهزة (20 لكل مستوى)
  full: 240, // الهدف الكامل لكل فئة (80 لكل مستوى) حتى ما يتكرر سؤال 3 أشهر
  weekly: 10, // بعد ما توصل كل الفئات للهدف: أسئلة جديدة لكل فئة كل أسبوع
  weeklyDay: 5, // الجمعة
  batch: 12, // عدد الأسئلة بكل طلب توليد
};

export const MEDIA = {
  imageMaxBytes: 300 * 1024,
  audioMaxSeconds: 30,
  userAgent: 'FathalQuizBot/1.0 (https://github.com; free family quiz game)',
};

// كلمات تخلي السؤال مرفوض تلقائياً (سياسة وطائفية)، حتى قبل مراجعة الذكاء الاصطناعي
export const BLOCKLIST = [
  // انتبه: ما نحط كلمات قصيرة تطابق كلمات بريئة (مثل "سني" تطابق "سنين"، و"جنس" تطابق "جنسية")
  'صدام حسين', 'البعث', 'بعثي', 'داعش', 'الحشد الشعبي', 'طائفي', 'طائفة', 'المذهب', 'شيعي', 'الشيعة', 'السنة والشيعة',
  'انتخاب', 'برلمان', 'حزب ', 'الاحتلال', 'إرهاب', 'ارهاب', 'تفجير', 'مجزرة', 'إعدام', 'اعدام',
  'خمر', 'خمور', 'قمار', 'مخدر', 'حشيش', 'إباحي', 'اباحي', 'كافر', 'كفار',
];
