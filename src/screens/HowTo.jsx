import { t } from '../i18n/index.js';
import { Header } from '../components/Header.jsx';

const STEPS = [1, 2, 3, 4, 5];

export function HowTo({ prefs, go }) {
  return (
    <main class="scr">
      <Header prefs={prefs} onBack={() => go('home')} />
      <div class="center center--top">
        <h1 class="h1">{t('howto.title')}</h1>
        <ol class="steps">
          {STEPS.map((n) => (
            <li class="step">
              <span class="logo step__num" aria-hidden="true">{n}</span>
              <span class="step__text">{t(`howto.step${n}`)}</span>
            </li>
          ))}
        </ol>
        <div class="grow" />
        <button class="fz-btn fz-btn--primary" onClick={() => go('teams')}>
          {t('howto.start')}
        </button>
      </div>
    </main>
  );
}
