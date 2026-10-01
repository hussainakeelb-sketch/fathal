import { useEffect, useRef, useState } from 'preact/hooks';
import { t } from '../i18n/index.js';
import { SYM } from '../lib/game.js';

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// الرقم يعد لفوگ لما تنضاف نقاط (dur-score)
function useCountUp(value, ms = 800) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = from.current;
    from.current = value;
    if (start === value || reduced()) return setShown(value);
    let raf;
    const t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / ms);
      setShown(Math.round(start + (value - start) * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    // إذا المتصفح وقّف الحركة (تبويب مخفي)، الرقم الصحيح يطلع بكل الأحوال
    const done = setTimeout(() => setShown(value), ms + 100);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(done);
    };
  }, [value]);
  return shown;
}

function Team({ team, name, score, turn, gain }) {
  const shown = useCountUp(score);
  const cls = `fz-team fz-team--${team}${turn ? ' is-turn' : ''}${gain ? ' is-scoring' : ''}`;
  return (
    <div class={cls}>
      {turn && <span class="fz-team__turn">{t('board.turn')}</span>}
      {gain && <span class="fz-team__gain" key={gain.key}>+{gain.points}</span>}
      <span class="fz-team__sym" aria-hidden="true">{SYM[team]}</span>
      <span class="fz-team__name">{name}</span>
      <span class="fz-team__score" aria-live="polite">{shown}</span>
    </div>
  );
}

// turn: الفريق الي عليه الدور (أو null بسؤال الحسم). gain: {team, points, key} لحظة إضافة النقاط
export function Scoreboard({ teams, scores, turn, gain, compact }) {
  return (
    <div class={compact ? 'compact' : ''}>
      <div class="fz-scores" style={{ paddingTop: '12px' }}>
        {['a', 'b'].map((k) => (
          <Team team={k} name={teams[k]} score={scores[k]} turn={turn === k} gain={gain?.team === k ? gain : null} />
        ))}
      </div>
    </div>
  );
}
