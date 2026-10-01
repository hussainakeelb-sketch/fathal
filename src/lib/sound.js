// المؤثرات الصوتية تتولد بالكود (Web Audio): ماكو ملفات، وماكو رخص، وحجمها صفر.
// ماكو أي صوت قبل أول ضغطة من المستخدم، والكتم يخص المؤثرات بس.
import { load, KEYS } from './storage.js';

let ctx = null;

export function unlockAudio() {
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
  } catch {}
}

function note(freq, at, dur, { type = 'sine', gain = 0.18, slide } = {}) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  const t0 = ctx.currentTime + at;
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

const SOUNDS = {
  reveal: () => [523, 659, 784].forEach((f, i) => note(f, i * 0.07, 0.18, { type: 'triangle' })),
  correct: () => {
    note(659, 0, 0.14, { type: 'triangle', gain: 0.22 });
    note(988, 0.12, 0.3, { type: 'triangle', gain: 0.22 });
  },
  wrong: () => note(220, 0, 0.45, { type: 'square', gain: 0.08, slide: 110 }),
  tick: () => note(1200, 0, 0.05, { type: 'square', gain: 0.05 }),
  timeup: () => [0, 0.22, 0.44].forEach((at) => note(880, at, 0.16, { type: 'square', gain: 0.08 })),
  win: () =>
    [523, 659, 784, 1047, 784, 1047].forEach((f, i) =>
      note(f, i * 0.13, i === 5 ? 0.6 : 0.16, { type: 'triangle', gain: 0.2 })
    ),
};

export function playSound(name) {
  if (load(KEYS.muted, false) || !ctx || ctx.state !== 'running') return;
  try {
    SOUNDS[name]();
  } catch {}
}
