import { useEffect, useState } from 'preact/hooks';
import { t, to } from '../i18n/index.js';
import { Scoreboard } from '../components/Scoreboard.jsx';
import { Timer } from '../components/Timer.jsx';
import { QuestionCard } from '../components/QuestionCard.jsx';
import { RevealModal } from '../components/RevealModal.jsx';
import { ReportModal } from '../components/ReportModal.jsx';
import { ErrorState } from '../components/ErrorState.jsx';
import { Icon } from '../components/Icon.jsx';
import { fetchIndex, fetchCategory, preloadMedia } from '../lib/data.js';
import { pickQuestions, markSeen } from '../lib/deck.js';
import { playSound } from '../lib/sound.js';
import { allUsedIds, setTiebreakQuestion, tbTick, tbTogglePause, tbReveal, tbWin } from '../lib/game.js';

// سؤال الحسم: من فئة "معلومات عامة" وبمستوى 600 (صعب)، للفريقين سوا، وبدون نقاط
async function nextQuestion(game) {
  const index = await fetchIndex();
  const cat = index.categories.find((c) => c.tiebreak) ?? index.categories.find((c) => c.ready);
  const { questions } = await fetchCategory(cat.id);
  const pool = questions.filter((q) => q.p === 600);
  const exclude = new Set([...allUsedIds(game), ...game.tb.used]);
  // إذا خلصت أسئلة الحسم بهاي اللعبة، نسمح بالي انعرضت بالحسم قبل
  const [q] = pickQuestions(pool, 1, { exclude });
  const picked = q ?? pickQuestions(pool, 1, { exclude: new Set(allUsedIds(game)) })[0];
  return picked && { ...picked, cat: cat.id };
}

export function Tiebreak({ header, game, setGame }) {
  const [error, setError] = useState(null);
  const [confirm, setConfirm] = useState(false);
  const [report, setReport] = useState(false);
  const { tb, teams } = game;

  const load = () => {
    setError(null);
    nextQuestion(game).then((q) => {
      preloadMedia(q);
      setGame((g) => setTiebreakQuestion(g, q));
    }, setError);
  };

  useEffect(() => {
    if (!tb.q) load();
  }, [tb.q]);

  useEffect(() => {
    if (tb.q) markSeen(tb.q.id);
  }, [tb.q?.id]);

  const win = (team) => {
    playSound('correct');
    setGame((g) => tbWin(g, team));
  };

  return (
    <main class="scr scr--fit">
      {header}
      <Scoreboard teams={teams} scores={game.scores} turn={null} compact />
      <div class="tb-title"><span class="logo">{t('tb.title')}</span></div>
      {error ? (
        <ErrorState error={error} onRetry={load} />
      ) : !tb.q ? (
        <div class="fz-qcard qcard is-loading-card" aria-busy="true" />
      ) : (
        <>
          <QuestionCard
            key={tb.q.id}
            q={tb.q}
            teams={teams}
            revealed={tb.revealed}
            onReveal={() => setConfirm(true)}
            onReport={() => setReport(true)}
            chips={
              <>
                <span class="fz-chip fz-chip--brand">{t('tb.cat')}</span>
                <span class="fz-chip">{t('tb.both')}</span>
              </>
            }
            timer={
              <Timer
                key={tb.q.id}
                timer={tb.timer}
                running
                onTick={() => setGame(tbTick)}
                onTogglePause={() => setGame(tbTogglePause)}
              />
            }
          />
          <div class="judge-bar">
            <div class="fz-judge">
              <span class="fz-judge__hint">{t('tb.hint')}</span>
              <button class="fz-btn fz-btn--team-a" onClick={() => win('a')}>
                <Icon name="check" />{t('q.correct.for', { to: to(teams.a) })}
              </button>
              <button class="fz-btn fz-btn--team-b" onClick={() => win('b')}>
                <Icon name="check" />{t('q.correct.for', { to: to(teams.b) })}
              </button>
              <button class="fz-btn" onClick={() => setGame((g) => ({ ...g, tb: { ...g.tb, q: null } }))}>
                <Icon name="refresh" />{t('tb.another')}
              </button>
            </div>
          </div>
        </>
      )}
      {report && <ReportModal q={tb.q} cat={tb.q.cat || 'general'} onClose={() => setReport(false)} />}
      {confirm && (
        <RevealModal
          onClose={() => setConfirm(false)}
          onConfirm={() => {
            setConfirm(false);
            playSound('reveal');
            setGame(tbReveal);
          }}
        />
      )}
    </main>
  );
}
