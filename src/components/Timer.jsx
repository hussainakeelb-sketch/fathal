import { useEffect, useRef } from 'preact/hooks';
import { t } from '../i18n/index.js';
import { SYM } from '../lib/game.js';
import { playSound } from '../lib/sound.js';
import { Icon } from './Icon.jsx';

const C = 263.9; // محيط الحلقة (2π × 42)

// العداد: يعد كل ثانية، والمقدّم يگدر يوقفه مؤقتاً بس ما يگدر يلغيه.
// لما يخلص ما ينقل السؤال لحاله: يطلع صوت ورسالة، والمقدّم يقرر.
export function Timer({ timer, steal, running, onTick, onTogglePause }) {
  const { total, left, paused } = timer;
  const tickRef = useRef(onTick);
  tickRef.current = onTick;
  const leftRef = useRef(left);
  leftRef.current = left;

  // نحسب الوقت من الساعة الحقيقية، حتى لو المتصفح بطّأ المؤقتات (مثلاً الموبايل طفّى الشاشة)
  const active = running && !paused && left > 0;
  useEffect(() => {
    if (!active) return;
    let last = Date.now();
    const id = setInterval(() => {
      let n = Math.floor((Date.now() - last) / 1000);
      if (n <= 0) return;
      last += n * 1000;
      while (n-- > 0 && leftRef.current > 0) {
        const next = --leftRef.current;
        if (next === 0) playSound('timeup');
        else if (next <= 10 && n === 0) playSound('tick');
        tickRef.current();
      }
    }, 200);
    return () => clearInterval(id);
  }, [active]);

  const ended = left <= 0;
  const warning = !ended && left <= 10;
  let cls = 'fz-timer';
  let state = t('timer.running');
  if (ended) {
    cls += ' is-ended';
    state = '';
  } else if (paused || !running) {
    cls += ' is-paused';
    state = t('timer.paused');
  } else if (warning) {
    cls += ' is-warning';
    state = t('timer.warning');
  } else if (steal) {
    state = t('timer.steal', { sym: SYM[steal] });
  }
  if (steal && !ended) cls += ` is-steal-${steal}`;

  // قارئ الشاشة: نعلن بس عند 10 ثواني وعند الانتهاء
  const announce = ended ? t('timer.ended') : left === 10 ? t('timer.label', { n: 10 }) : '';

  return (
    <>
      <button
        class="fz-btn fz-btn--icon"
        aria-label={paused ? t('q.resume') : t('q.pause')}
        disabled={!running || ended}
        onClick={onTogglePause}
      >
        <Icon name={paused ? 'play' : 'pause'} filled />
      </button>
      <div class={cls} role="timer" aria-label={t('timer.label', { n: left })}>
        <svg viewBox="0 0 96 96" aria-hidden="true">
          <circle class="fz-timer__track" cx="48" cy="48" r="42" />
          <circle class="fz-timer__ring" cx="48" cy="48" r="42" stroke-dasharray={C} stroke-dashoffset={(C * (1 - left / total)).toFixed(1)} />
        </svg>
        <span class="fz-timer__num">{ended ? t('timer.ended') : left}</span>
        <span class="fz-timer__state">{state}</span>
        <span class="vh" aria-live="polite">{announce}</span>
      </div>
    </>
  );
}
