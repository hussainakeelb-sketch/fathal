import { useEffect, useState } from 'preact/hooks';
import { t } from './i18n/index.js';
import { useTheme, useMuted } from './lib/prefs.js';
import { Header } from './components/Header.jsx';
import { Icon } from './components/Icon.jsx';
import { Home } from './screens/Home.jsx';
import { HowTo } from './screens/HowTo.jsx';
import { Teams } from './screens/Teams.jsx';

// شاشة مؤقتة للمراحل الجاية
function Soon({ prefs, go }) {
  return (
    <main class="scr">
      <Header prefs={prefs} onBack={() => go('teams')} />
      <div class="fz-state center">
        <div class="fz-state__icon brand"><Icon name="info" /></div>
        <h1 class="fz-state__title">{t('soon.title')}</h1>
        <p class="fz-state__body">{t('soon.body')}</p>
      </div>
    </main>
  );
}

export function App() {
  const [theme, toggleTheme] = useTheme();
  const [muted, toggleMuted] = useMuted();
  const prefs = { theme, toggleTheme, muted, toggleMuted };

  // للتطوير بس: ‎#screen=teams&theme=dark يفتح شاشة معينة حتى نصورها بكل المقاسات
  const [screen, setScreen] = useState(() => {
    if (!import.meta.env.DEV) return 'home';
    const p = new URLSearchParams(location.hash.slice(1));
    return p.get('screen') || 'home';
  });
  const [setup, setSetup] = useState(null);

  const go = (next, data) => {
    if (data) setSetup((s) => ({ ...s, ...data }));
    setScreen(next);
    // زر الرجوع بالموبايل يرجع للشاشة السابقة بدل ما يطلع من الموقع
    try { history.pushState({ screen: next }, ""); } catch {}
  };

  useEffect(() => {
    try { history.replaceState({ screen: "home" }, ""); } catch {}
    const onPop = (e) => setScreen(e.state?.screen || "home");
    addEventListener("popstate", onPop);
    return () => removeEventListener("popstate", onPop);
  }, []);

  // كل شاشة تبدي من فوگ، والتركيز يروح لأول عنوان
  useEffect(() => {
    window.scrollTo(0, 0);
    document.querySelector('main h1')?.setAttribute('tabindex', '-1');
  }, [screen]);

  switch (screen) {
    case 'howto':
      return <HowTo prefs={prefs} go={go} />;
    case 'teams':
      return <Teams prefs={prefs} go={go} initial={setup?.teams} />;
    case 'categories':
      return <Soon prefs={prefs} go={go} />;
    default:
      return <Home prefs={prefs} go={go} />;
  }
}
