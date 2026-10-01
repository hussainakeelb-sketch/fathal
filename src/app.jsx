import { useEffect, useState } from 'preact/hooks';
import { t } from './i18n/index.js';
import { useTheme, useMuted } from './lib/prefs.js';
import { loadGame, saveGame, newGame, endGame } from './lib/game.js';
import { Header } from './components/Header.jsx';
import { Icon } from './components/Icon.jsx';
import { Modal } from './components/Modal.jsx';
import { Toast } from './components/Toast.jsx';
import { Home } from './screens/Home.jsx';
import { HowTo } from './screens/HowTo.jsx';
import { Teams } from './screens/Teams.jsx';
import { Categories } from './screens/Categories.jsx';
import { Board } from './screens/Board.jsx';
import { Question } from './screens/Question.jsx';
import { Tiebreak } from './screens/Tiebreak.jsx';
import { Winner } from './screens/Winner.jsx';

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
  const [lastTeams, setLastTeams] = useState(null);

  // اللعبة الحالية تنحفظ بعد كل خطوة، وإذا انسدت الصفحة ترجع من نفس المكان
  const [game, setGameState] = useState(loadGame);
  const [toast, setToast] = useState(null); // {kind, text, key, undo}
  const [confirmEnd, setConfirmEnd] = useState(false);

  // يقبل لعبة جديدة أو دالة (g) => لعبة، حتى ما نشتغل على نسخة قديمة إذا صارت ضغطتين ورا بعض
  const setGame = (u) =>
    setGameState((prev) => {
      const g = typeof u === 'function' ? u(prev) : u;
      saveGame(g);
      return g;
    });

  // تحكيم المقدّم: يطلع Toast بيه "تراجع" لمدة 5 ثواني
  const judge = (next, info) => {
    const before = game;
    setGame(next);
    setToast({ ...info, key: Date.now(), undo: before });
  };

  const go = (next, data) => {
    if (next === 'categories' && data) {
      setLastTeams(data.teams);
      setGame(newGame(data.teams, data.timers));
      setToast(null);
      return;
    }
    setScreen(next);
    // زر الرجوع بالموبايل يرجع للشاشة السابقة بدل ما يطلع من الموقع
    try { history.pushState({ screen: next }, ''); } catch {}
  };

  const leaveGame = (to) => {
    setGame(null);
    setToast(null);
    setScreen(to);
  };

  useEffect(() => {
    try { history.replaceState({ screen: 'home' }, ''); } catch {}
    const onPop = (e) => setScreen(e.state?.screen || 'home');
    addEventListener('popstate', onPop);
    return () => removeEventListener('popstate', onPop);
  }, []);

  // كل شاشة تبدي من فوگ
  const phaseKey = game ? `${game.phase}` : screen;
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [phaseKey]);

  // التوست يختفي إذا تغيرت الشاشة (التراجع بس لنفس السؤال)
  useEffect(() => {
    if (game?.phase !== 'question') setToast(null);
  }, [game?.phase]);

  const gameHeader = (
    <Header prefs={prefs}>
      <button class="fz-btn fz-btn--ghost" onClick={() => setConfirmEnd(true)}>{t('game.end')}</button>
    </Header>
  );

  let view;
  if (game) {
    switch (game.phase) {
      case 'categories':
        view = (
          <Categories
            prefs={prefs}
            game={game}
            setGame={setGame}
            onBack={() => {
              setGame(null);
              setScreen('teams');
            }}
          />
        );
        break;
      case 'board':
        view = <Board header={gameHeader} game={game} setGame={setGame} />;
        break;
      case 'question':
        view = <Question header={gameHeader} game={game} setGame={setGame} judge={judge} />;
        break;
      case 'tiebreak':
        view = <Tiebreak header={gameHeader} game={game} setGame={setGame} />;
        break;
      default:
        view = (
          <Winner
            prefs={prefs}
            game={game}
            onNew={() => {
              setLastTeams(game.teams);
              leaveGame('teams');
            }}
            onHome={() => leaveGame('home')}
          />
        );
    }
  } else if (screen === 'howto') view = <HowTo prefs={prefs} go={go} />;
  else if (screen === 'teams') view = <Teams prefs={prefs} go={go} initial={lastTeams} />;
  else view = <Home prefs={prefs} go={go} />;

  return (
    <>
      {view}
      {toast && game?.phase === 'question' && (
        <Toast
          toast={toast}
          onDone={() => setToast(null)}
          onUndo={() => {
            setGame(toast.undo);
            setToast(null);
          }}
        />
      )}
      {confirmEnd && game && (
        <Modal
          icon="exit"
          iconStyle={{ background: 'var(--danger)', color: 'var(--on-danger)' }}
          title={t('game.end.title')}
          body={t('game.end.body')}
          onClose={() => setConfirmEnd(false)}
          actions={
            <>
              <button
                class="fz-btn fz-btn--danger"
                onClick={() => {
                  setConfirmEnd(false);
                  // بسؤال الحسم ماكو نتيجة نعرضها (تعادل)، فنرجع للرئيسية
                  if (game.phase === 'tiebreak') leaveGame('home');
                  else setGame(endGame({ ...game, cur: null }));
                }}
              >
                <Icon name="exit" />{t('game.end.confirm')}
              </button>
              <button class="fz-btn" onClick={() => setConfirmEnd(false)}>{t('game.end.cancel')}</button>
            </>
          }
        />
      )}
    </>
  );
}
