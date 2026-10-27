// التعليمات الي نرسلها للذكاء الاصطناعي. بالإنگليزي لأن النموذج يفهمها أدق، والناتج عربي.

// مقتطفات ويكيبيديا تنضاف للتعليمات حتى النموذج يتأكد منها بدل ما يعتمد على ذاكرته
function sourcesBlock(sources) {
  if (!sources) return '';
  return `
REFERENCE EXCERPTS (Wikipedia, may be incomplete; #N refers to question N):
${sources}
Use them to verify facts: if an excerpt contradicts an answer, that answer is wrong. If the excerpts say nothing about a fact, judge from your own knowledge and be strict.
`;
}

// قواعد الصعوبة والتوازن (وافق عليها صاحب المشروع). نفس النص يروح للتوليد والمراجعة وإعادة التقييم.
export const DIFFICULTY = `DIFFICULTY SCALE (judge it for an Iraqi adult who likes this category's topic):
  200 "للمهتم" = about HALF of such people would know it. A known fact about a known thing.
  400 "للمتابع" = about 1 in 5 would know it. Needs real following of the topic: a second-tier name, a detail of a famous thing.
  600 "فطحل" = about 1 in 20 would know it. Expert knowledge, but it must be reachable by knowledge or reasoning, NOT by memorising a random number.
BALANCE RULES:
  - Questions whose answer is a year, date or number: at most 1 in 5 per level. Never ask for a day/month date.
  - Mix question kinds: people, places, meanings/definitions, "what is it", works/titles, and only a few numbers.
  - Cover several different sub-topics of the category; do not build many questions around one person or one show.
  - A 200 question must never be harder than a 400 question of the same category.
  - Answers are short: 1 to 4 words.`;

export const SYSTEM = `You write questions for "Fathal" (فطحل), a free family trivia game played by two teams in Iraq.
HARD RULES (never break them):
- Write questions in Arabic: simple Modern Standard Arabic or Iraqi dialect are both fine. Keep the wording short, clear and natural. Answers are short, in Arabic.
- Every fact must be true, well documented and stable over time. If you are not 100% sure, do not write the question.
- Family friendly for all ages. Absolutely no politics, politicians, parties, wars, terrorism, violence, crime details, sects or sectarian topics, religious disputes, alcohol, gambling, romance, or anything that could offend any Iraqi community (Arabs, Kurds, Turkmen, Christians, Yazidis, Sabeans, Sunni, Shia...).
- Never mock any city, tribe, dialect or group.
- Never quote song lyrics or long copyrighted text (max 6 words).
- The question must belong clearly to the given category.
- One clear correct answer. No trick questions. No "which of these" multiple choice.
${DIFFICULTY}`;

// balance: {200:{n, numeric}, 400:{...}, 600:{...}} حتى النموذج يعرف شنو الناقص
export function generatePrompt(cat, need, existing, mediaKind, balance) {
  const mediaRule = {
    'ai-image': `About 1 in 4 questions may have an illustrative image of a GENERIC thing (food, object, tool, animal, plant) that an image AI can draw accurately. Then set "type":"image" and "media":{"source":"ai","query":"<short English prompt for a realistic photo, no text, no people faces>"}. The question must then be about what the image shows (e.g. شنو اسم هاي الأكلة؟).`,
    'commons-image': `About 1 in 4 questions may use a real photo from Wikimedia Commons (landmarks, real objects, flags, animals, famous places). Then set "type":"image" and "media":{"source":"commons","query":"<precise English search term for Wikimedia Commons>"}. Never use photos of living private people.`,
    'commons-image-zoom': `EVERY question uses a zoomed real photo: "type":"image","media":{"source":"commons","query":"<English search term of a common object/food/animal>","zoom":true}. Question text: شنو هذا الشي؟ (صورة مقرّبة) or similar.`,
    'commons-audio': `About 1 in 5 questions may be an audio question with a short real sound from Wikimedia Commons (animal sounds). Then set "type":"audio" and "media":{"source":"commons","kind":"audio","query":"<English search term, e.g. 'lion roar'>"}. Question text: صوت يا حيوان هذا؟`,
    none: 'All questions are text only: "type":"text","media":null.',
  }[mediaKind] || 'All questions are text only: "type":"text","media":null.';

  const levels = Object.entries(need).filter(([, n]) => n > 0).map(([p, n]) => `${n} questions worth ${p}`).join(', ');
  const avoid = existing.slice(-80).map((q) => `- ${q}`).join('\n');
  const state = balance
    ? Object.entries(balance).map(([p, b]) => `${p}: ${b.n} questions, ${b.numeric} of them are year/number questions`).join('; ')
    : '';

  return `Category: "${cat.name}" (id: ${cat.id})
What this category is about: ${cat.guide}
Current balance of this category: ${state || 'empty'}.
Follow the difficulty scale exactly. Prefer non-number questions, especially where the number share is already high.

Write exactly: ${levels}.
${mediaRule}

Do NOT repeat or rephrase any of these existing questions:
${avoid || '(none yet)'}

Return JSON only:
{"questions":[{"p":200,"q":"<question>","a":"<short answer>","type":"text","media":null,"fact":"<one short English sentence with the source of the fact>"}]}`;
}

export function reviewPrompt(cat, items, { search, sources }) {
  return `You are a strict fact-checker and editor for a family trivia game in Iraq.${search ? ' Use Google Search to verify every fact.' : ' You cannot browse: reject anything you are not completely sure about from your own knowledge.'}
Category: "${cat.name}" — ${cat.guide}
${DIFFICULTY}

${sourcesBlock(sources)}
For EACH question below decide:
- "ok": true only if ALL are true: the answer is 100% correct and verifiable; the question has one clear answer; it belongs to the category; it is family friendly with no politics, sects, religion disputes, violence or anything offensive to any Iraqi group; the Arabic reads naturally.
- If the only problem is the answer wording, put the corrected short answer in "a".
- Put the correct level by the difficulty scale above in "p" (200/400/600), even if it equals the current one.
Be strict: when in doubt, reject.

Questions:
${items.map((it, i) => `${i}. [${it.p}] Q: ${it.q} | A: ${it.a}${it.fact ? ` | claimed fact: ${it.fact}` : ''}`).join('\n')}

Return JSON only:
{"results":[{"i":0,"ok":true,"a":null,"p":400,"why":"<short English reason>"}]}`;
}

// إعادة تقييم الأسئلة الموجودة على القواعد الجديدة (شوية كل يوم)
export function auditPrompt(cat, items, { search, sources }) {
  return `You are re-rating existing questions of a family trivia game in Iraq against new rules.${search ? ' Use Google Search when a fact looks doubtful.' : ''}
Category: "${cat.name}" — ${cat.guide}
${DIFFICULTY}

${sourcesBlock(sources)}
For EACH question give:
- "p": its correct level by the scale above (200/400/600).
- "wrong": true ONLY if you are sure the answer is factually wrong or the question is inappropriate; otherwise false.
- "why": a very short English reason.

Questions:
${items.map((q, i) => `${i}. [${q.p}] Q: ${q.q} | A: ${q.a}`).join('\n')}

Return JSON only:
{"results":[{"i":0,"p":400,"wrong":false,"why":"..."}]}`;
}

export function reportPrompt(cat, q, reports, { search, sources }) {
  return `Players reported a problem with this trivia question from a family game in Iraq.${search ? ' Use Google Search to check the facts carefully.' : ' You cannot browse: only decide what you are sure about.'}
Category: "${cat.name}" — ${cat.guide}
Question: ${q.q}
Answer shown: ${q.a}
Points: ${q.p}
Has media: ${q.m ? q.t : 'no'}
Reports:
${reports.map((r) => `- reason: ${r.reason}${r.note ? `, note: ${r.note}` : ''}`).join('\n')}

${sourcesBlock(sources)}
Decide ONE action:
- "keep": the question and answer are correct and appropriate (reports are wrong or abusive).
- "fix_answer": the answer is wrong or incomplete; give the corrected answer in "a".
- "rewrite": the question is unclear or ambiguous but fixable; give new "q" and "a".
- "drop_media": the image/audio is wrong but the question works as text alone.
- "remove": the question is wrong, inappropriate, political, sectarian, offensive, or cannot be fixed.
- "unsure": you cannot tell who is right without checking sources. The question stays and waits for a later check.
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
