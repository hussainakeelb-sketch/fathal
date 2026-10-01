# فطحل؟

لعبة أسئلة جماعية مجانية بروح عراقية: فريقان، 6 فئات، ومقدّم واحد. بدون تسجيل وبدون إعلانات.

- **الموقع:** Preact + Vite، ينشر على Cloudflare Pages.
- **الأسئلة:** `data/questions/<فئة>.json`، وتنبني لملفات الموقع بـ `npm run build`.
- **البلاغات:** `functions/api/report.js` تحفظ بقاعدة Cloudflare D1.
- **الروبوت:** `scripts/robot/` يشتغل يومياً على GitHub Actions (`.github/workflows/robot.yml`): يعالج البلاغات، ويولّد أسئلة جديدة ويراجعها بالذكاء الاصطناعي (Google Gemini، الباقة المجانية)، ويجهّز الصور.

## أوامر مفيدة
```
npm install          # أول مرة بس
npm run dev          # تشغيل الموقع على الحاسبة
npm run build        # بناء الموقع
ROBOT_MOCK=1 npm run robot   # تجربة الروبوت بدون أي خدمة خارجية
```

الأيقونات من Tabler Icons (MIT)، والخطوط Lalezar وBaloo Bhaijaan 2 (OFL).
