import { useRef, useState } from 'preact/hooks';
import { t } from '../i18n/index.js';
import { Header } from '../components/Header.jsx';
import { Icon } from '../components/Icon.jsx';
import { TeamNameField } from '../components/TeamNameField.jsx';
import { loadTimers, saveTimers, TIMER_MIN, TIMER_MAX, TIMER_STEP } from '../lib/prefs.js';

const LEVELS = [200, 400, 600];

function validate(a, b) {
  const na = a.trim() || t('teams.a.default');
  const nb = b.trim() || t('teams.b.default');
  const errors = {};
  if (a.trim().length === 1) errors.a = t('teams.err.short');
  if (b.trim().length === 1) errors.b = t('teams.err.short');
  else if (na === nb) errors.b = t('teams.err.same');
  return { names: { a: na, b: nb }, errors };
}

export function Teams({ prefs, go, initial }) {
  const [a, setA] = useState(initial?.a ?? '');
  const [b, setB] = useState(initial?.b ?? '');
  const [showErrors, setShowErrors] = useState(false);
  const [timers, setTimers] = useState(loadTimers);
  // مسكّر بالموبايل، ومفتوح باللابتوب والتلفزيون
  const [open, setOpen] = useState(() => matchMedia('(min-width:1024px)').matches);
  const refB = useRef(null);

  const { names, errors } = validate(a, b);
  const shown = showErrors ? errors : {};

  const next = () => {
    if (Object.keys(errors).length) {
      setShowErrors(true);
      return;
    }
    go('categories', { teams: names, timers });
  };

  const change = (p, delta) => {
    const v = Math.min(TIMER_MAX, Math.max(TIMER_MIN, timers[p] + delta));
    const nt = { ...timers, [p]: v };
    setTimers(nt);
    saveTimers(nt);
  };

  return (
    <main class="scr">
      <Header prefs={prefs} onBack={() => go('home')} />
      <div class="center center--top" style={{ paddingTop: 'calc(var(--gap)*1.5)' }}>
        <h1 class="h1">{t('teams.title')}</h1>
        <p class="sub">{t('teams.desc')}</p>

        <div class="teams">
          <TeamNameField
            id="team-a"
            team="a"
            label={t('teams.a.label')}
            value={a}
            error={shown.a}
            onInput={setA}
            onEnter={() => refB.current?.focus()}
          />
          <div class="logo vs" aria-hidden="true">{t('teams.vs')}</div>
          <TeamNameField
            id="team-b"
            team="b"
            label={t('teams.b.label')}
            value={b}
            error={shown.b}
            onInput={setB}
            onEnter={next}
            inputRef={refB}
          />
        </div>

        <div class="timers">
          <button
            class="fz-btn fz-btn--ghost"
            aria-expanded={open}
            aria-controls="timers-panel"
            onClick={() => setOpen(!open)}
          >
            <Icon name="clock" />
            {t('teams.timers')} {open ? '▴' : '▾'}
          </button>
          {open && (
            <div id="timers-panel" class="timers" style={{ gap: '10px' }}>
              <div class="timers__grid">
                {LEVELS.map((p) => (
                  <div class="timer-set">
                    <span class="timer-set__label">{t('teams.timers.level', { points: p })}</span>
                    <span class="timer-set__ctl">
                      <button
                        class="fz-btn fz-btn--icon"
                        aria-label={`${t('teams.timers.inc')} ${p}`}
                        disabled={timers[p] >= TIMER_MAX}
                        onClick={() => change(p, TIMER_STEP)}
                      >+</button>
                      <span class="logo timer-set__val" aria-live="polite">
                        {t('teams.timers.sec', { n: timers[p] })}
                      </span>
                      <button
                        class="fz-btn fz-btn--icon"
                        aria-label={`${t('teams.timers.dec')} ${p}`}
                        disabled={timers[p] <= TIMER_MIN}
                        onClick={() => change(p, -TIMER_STEP)}
                      >−</button>
                    </span>
                  </div>
                ))}
              </div>
              <span class="sub" style={{ fontSize: 'calc(var(--body)*.85)' }}>{t('teams.timers.steal')}</span>
            </div>
          )}
        </div>

        <div class="grow" />
        <button class="fz-btn fz-btn--primary" onClick={next}>
          {t('teams.next')}
          <Icon name="arrow" />
        </button>
      </div>
    </main>
  );
}
