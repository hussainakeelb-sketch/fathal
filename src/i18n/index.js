import ar from './ar.json';

// كل نصوص الواجهة من ملف الترجمة، حتى نضيف الإنگليزي بالمستقبل بدون تعديل الكود
const strings = ar;

export function t(key, vars) {
  let s = strings[key] ?? key;
  if (vars) for (const k in vars) s = s.replaceAll(`{${k}}`, vars[k]);
  return s;
}

// "لـ" قبل الاسم: "الصقور" ← "للصقور"، و"سعد" ← "لـسعد"
export function to(name) {
  return name.startsWith('ال') ? `ل${name.slice(1)}` : `لـ${name}`;
}
