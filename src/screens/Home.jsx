import { t } from '../i18n/index.js';
import { Header, Logo } from '../components/Header.jsx';

export function Home({ prefs, go }) {
  return (
    <main class="scr brand stars">
      <Header prefs={prefs} />
      <div class="center">
        <h1 class="vh">{t('brand')}</h1>
        <Logo style={{ fontSize: 'var(--disp)' }} />
        <p class="sub" style={{ fontSize: 'calc(var(--body)*1.2)' }}>{t('tagline')}</p>
        <div class="foot">
          <span class="pill">{t('home.badge.teams')}</span>
          <span class="pill">{t('home.badge.categories')}</span>
          <span class="pill">{t('home.badge.host')}</span>
        </div>
        <div class="foot">
          <button class="fz-btn fz-btn--primary fz-btn--lg" onClick={() => go('teams')}>
            {t('home.start')}
          </button>
          <button class="fz-btn fz-btn--lg" onClick={() => go('howto')}>
            {t('home.howto')}
          </button>
        </div>
      </div>
      <p class="sub" style={{ textAlign: 'center' }}>{t('home.footer')}</p>
    </main>
  );
}
