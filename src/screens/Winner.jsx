import { useEffect, useMemo } from 'preact/hooks';
import { t } from '../i18n/index.js';
import { Header } from '../components/Header.jsx';
import { Icon } from '../components/Icon.jsx';
import { playSound } from '../lib/sound.js';
import { SYM } from '../lib/game.js';

const COLORS = ['var(--surface-brand)', 'var(--accent)', 'var(--team-a)', 'var(--team-b)'];

// كونفيتي بالـ CSS بس، وما يطلع إذا الجهاز مفعّل عليه تقليل الحركة
function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 600,
        rot: Math.random() * 720 - 360,
        drift: Math.random() * 120 - 60,
        color: COLORS[i % COLORS.length],
      })),
    []
  );
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return null;
  return (
    <div class="confetti" aria-hidden="true">
      {pieces.map((p) => (
        <span
          class="conf"
          style={{ insetInlineStart: `${p.left}%`, background: p.color, animationDelay: `${p.delay}ms`, '--rot': `${p.rot}deg`, '--drift': `${p.drift}px` }}
        />
      ))}
    </div>
  );
}

export function Winner({ prefs, game, onNew, onHome }) {
  const w = game.winner;
  useEffect(() => playSound('win'), []);

  return (
    <main class="scr brand stars winner">
      <Confetti />
      <Header prefs={prefs} />
      <div class="center" style={{ position: 'relative' }}>
        <div class="fz-state__icon trophy" style={{ background: 'var(--surface-card)', color: 'var(--text-primary)', width: 'calc(var(--btnh)*2)', height: 'calc(var(--btnh)*2)' }}>
          <Icon name="trophy" />
        </div>
        <h1 class="win-title">{t('win.title')}</h1>
        <div class={`win-name win-name--${w}`}>{SYM[w]} {game.teams[w]}</div>
        <div class="foot" style={{ gap: 'var(--gap)' }}>
          {['a', 'b'].map((k) => (
            <span class="pill">{t('win.score', { sym: SYM[k], name: game.teams[k], n: game.scores[k] })}</span>
          ))}
        </div>
        <div class="foot">
          <button class="fz-btn fz-btn--primary fz-btn--lg" onClick={onNew}>{t('win.new')}</button>
          <button class="fz-btn fz-btn--lg" onClick={onHome}>{t('win.home')}</button>
        </div>
      </div>
    </main>
  );
}
