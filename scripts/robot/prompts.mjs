// التعليمات الي نرسلها للذكاء الاصطناعي. بالإنگليزي لأن النموذج يفهمها أدق، والناتج عربي باللهجة العراقية.

export const SYSTEM = `You write questions for "Fathal" (فطحل), a free family trivia game played by two teams in Iraq.
HARD RULES (never break them):
- Questions are written in natural Iraqi Arabic dialect (شنو، منو، شگد، وين، بيا، يا، هسه، چان...). Answers are short (1-6 words), in Arabic.
- Every fact must be true, well documented and stable over time. If you are not 100% sure, do not write the question.
- Family friendly for all ages. Absolutely no politics, politicians, parties, wars, terrorism, violence, crime details, sects or sectarian topics, religious disputes, alcohol, gambling, romance, or anything that could offend any Iraqi community (Arabs, Kurds, Turkmen, Christians, Yazidis, Sabeans, Sunni, Shia...).
- Never mock any city, tribe, dialect or group.
- Never quote song lyrics or long copyrighted text (max 6 words).
- The question must belong clearly to the given category.
- Difficulty is HIGH (the players asked for hard questions). Never write easy common-knowledge questions:
  200 = hard: a well-read adult who follows the topic may know it (e.g. a specific year, a second-tier name, a lesser-known detail).
  400 = very hard: only real fans/specialists of the topic know it.
  600 = expert level: precise details (exact years, full names, records, rare facts) that only experts know.
  The fact must still be verifiable on reliable sources, and the question must stay short and clear.
- One clear correct answer. No trick questions. No "which of these" multiple choice.`;

export function generatePrompt(cat, need, existing, mediaKind) {
  const mediaRule = {
    'ai-image': `About 1 in 4 questions may have an illustrative image of a GENERIC thing (food, object, tool, animal, plant) that an image AI can draw accurately. Then set "type":"image" and "media":{"source":"ai","query":"<short English prompt for a realistic photo, no text, no people faces>"}. The question must then be about what the image shows (e.g. شنو اسم هاي الأكلة؟).`,
    'commons-image': `About 1 in 4 questions may use a real photo from Wikimedia Commons (landmarks, real objects, flags, animals, famous places). Then set "type":"image" and "media":{"source":"commons","query":"<precise English search term for Wikimedia Commons>"}. Never use photos of living private people.`,
    'commons-image-zoom': `EVERY question uses a zoomed real photo: "type":"image","media":{"source":"commons","query":"<English search term of a common object/food/animal>","zoom":true}. Question text: شنو هذا الشي؟ (صورة مقرّبة) or similar.`,
    'commons-audio': `About 1 in 5 questions may be an audio question with a short real sound from Wikimedia Commons (animal sounds). Then set "type":"audio" and "media":{"source":"commons","kind":"audio","query":"<English search term, e.g. 'lion roar'>"}. Question text: صوت يا حيوان هذا؟`,
    none: 'All questions are text only: "type":"text","media":null.',
  }[mediaKind] || 'All questions are text only: "type":"text","media":null.';

  const levels = Object.entries(need).filter(([, n]) => n > 0).map(([p, n]) => `${n} questions worth ${p}`).join(', ');
  const avoid = existing.slice(-160).map((q) => `- ${q}`).join('\n');

  return `Category: "${cat.name}" (id: ${cat.id})
What this category is about: ${cat.guide}

Write exactly: ${levels}.
${mediaRule}

Do NOT repeat or rephrase any of these existing questions:
${avoid || '(none yet)'}

Return JSON only:
{"questions":[{"p":200,"q":"<question in Iraqi dialect>","a":"<short answer>","type":"text","media":null,"fact":"<one short English sentence with the source of the fact>"}]}`;
}

export function reviewPrompt(cat, items) {
  return `You are a strict fact-checker and editor for a family trivia game in Iraq. Use Google Search to verify every fact.
Category: "${cat.name}" — ${cat.guide}

For EACH question below decide:
- "ok": true only if ALL are true: the answer is 100% correct and verifiable; the question has one clear answer; it belongs to the category; it is family friendly with no politics, sects, religion disputes, violence or anything offensive to any Iraqi group; the Arabic reads naturally in Iraqi dialect; difficulty "p" is reasonable.
- If the only problem is the answer wording, put the corrected short answer in "a".
- If difficulty is wrong, put the right one (200/400/600) in "p".
Be strict: when in doubt, reject.

Questions:
${items.map((it, i) => `${i}. [${it.p}] Q: ${it.q} | A: ${it.a}${it.fact ? ` | claimed fact: ${it.fact}` : ''}`).join('\n')}

Return JSON only:
{"results":[{"i":0,"ok":true,"a":null,"p":null,"why":"<short English reason>"}]}`;
}

export function reportPrompt(cat, q, reports) {
  return `Players reported a problem with this trivia question from a family game in Iraq. Use Google Search to check the facts carefully.
Category: "${cat.name}" — ${cat.guide}
Question (Iraqi dialect): ${q.q}
Answer shown: ${q.a}
Points: ${q.p}
Has media: ${q.m ? q.t : 'no'}
Reports:
${reports.map((r) => `- reason: ${r.reason}${r.note ? `, note: ${r.note}` : ''}`).join('\n')}

Decide ONE action:
- "keep": the question and answer are correct and appropriate (reports are wrong or abusive).
- "fix_answer": the answer is wrong or incomplete; give the corrected answer in "a".
- "rewrite": the question is unclear or ambiguous but fixable; give new "q" (Iraqi dialect) and "a".
- "drop_media": the image/audio is wrong but the question works as text alone.
- "remove": the question is wrong, inappropriate, political, sectarian, offensive, or cannot be fixed.
Never keep anything political, sectarian or offensive. Only "keep" if you are sure it is correct.

Return JSON only: {"action":"keep","a":null,"q":null,"why":"<short English reason>"}`;
}

export function mediaCheckPrompt(item, kind) {
  return `This ${kind} is attached to a family trivia question in Iraq.
Question: ${item.q}
Answer: ${item.a}
Check:
1. "matches": does the ${kind} clearly show/contain what the answer says, so players can answer from it?
2. "safe": is it family friendly (no violence, nudity, gore, politics, religious symbols used offensively)?
3. "leaks": does it contain readable text or a caption that gives away the answer?
Return JSON only: {"matches":true,"safe":true,"leaks":false}`;
}
