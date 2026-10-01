import { useEffect, useState } from 'preact/hooks';
import { t, to } from '../i18n/index.js';
import { Scoreboard } from '../components/Scoreboard.jsx';
import { Timer } from '../components/Timer.jsx';
import { QuestionCard } from '../components/QuestionCard.jsx';
import { RevealModal } from '../components/RevealModal.jsx';
import { ReportModal } from '../components/ReportModal.jsx';
import { Icon } from '../components/Icon.jsx';
import { markSeen } from '../lib/deck.js';
import { playSound } from '../lib/sound.js';
import {
  SYM, other, curTile, tickTimer, togglePause, reveal, judgeCorrect, judgeWrong, backToBoard,
} from '../lib/game.js';

export function Question({ header, game, setGame, judge, toast }) {
  const [confirm, setConfirm] = useState(false);
  const [report, setReport] = useState(false);
  const { cur, teams, turn } = game;
  const { q } = curTile(game);
  const col = game.board[cur.col];
  const steal = cur.stage === 'steal';
  const done = cur.stage === 'done';
  const active = steal ? other(turn) : turn;

  // السؤال يُعتبر "مشاهَد" بس لما ينفتح فعلاً
  useEffect(() => markSeen(q.id), [q.id]);

  const onCorrect = () => {
    const next = judgeCorrect(game);
    const v = next.cur.verdict;
    playSound('correct');
    judge(next, { kind: 'success', text: t('toast.gain', { p: v.points, to: to(teams[v.team]) }) });
  };
  const onWrong = () => {
    const next = judgeWrong(game);
    playSound('wrong');
    judge(next, steal
      ? { kind: 'danger', text: t('toast.none') }
      : { kind: 'danger', text: t('toast.steal', { name: teams[other(turn)] }) });
  };

  const ended = cur.timer.left <= 0;
  const verdict = cur.verdict;
  const gain = done && verdict?.type === 'ok' ? { team: verdict.team, points: verdict.points, key: `${cur.col}-${cur.tile}` } : null;

  const chips = (
    <>
      <span class="fz-chip fz-chip--brand">{col.name}</span>
      <span class="fz-chip">{t('q.points', { p: q.p })}</span>
      <span class={`fz-chip fz-chip--${active}`}>
        {steal ? t('q.steal', { sym: SYM[active], name: teams[active] }) : t('q.turn', { sym: SYM[active], name: teams[active] })}
      </span>
    </>
  );

  return (
    <main class="scr scr--fit">
      {header}
      <Scoreboard teams={teams} scores={game.scores} turn={active} gain={gain} compact />
      <QuestionCard
        key={`${cur.col}-${cur.tile}`}
        q={q}
        teams={teams}
        chips={chips}
        revealed={cur.revealed}
        verdict={verdict}
        onReveal={() => setConfirm(true)}
        onReport={() => setReport(true)}
        cardClass={`${done && verdict?.type === 'ok' ? 'is-correct' : ''} ${verdict?.type === 'no' && steal ? 'is-wrong' : ''} ${done && verdict?.type === 'none' ? 'is-wrong' : ''}`}
        cardStyle={steal ? { borderColor: `var(--team-${active})`, borderWidth: '4px' } : null}
        timer={
          <Timer
            key={cur.stage}
            timer={cur.timer}
            steal={steal ? active : null}
            running={!done}
            onTick={() => setGame(tickTimer)}
            onTogglePause={() => setGame(togglePause)}
          />
        }
      />

      <div class="judge-bar">
        {toast && !done && <div class="foot judge-bar__toast">{toast}</div>}
        {done ? (
          <div class="foot">
            {toast}
            <button class="fz-btn fz-btn--primary" onClick={() => setGame(backToBoard)}>
              {t('q.back')}
              <Icon name="arrow" />
            </button>
          </div>
        ) : (
          <div class="fz-judge">
            <span class="fz-judge__hint">
              {steal
                ? t('q.hint.steal', { sym: SYM[active], name: teams[active] })
                : ended ? t('q.hint.ended') : t('q.hint')}
            </span>
            {steal ? (
              <>
                <button class={`fz-btn fz-btn--team-${active}`} onClick={onCorrect}>
                  <Icon name="check" />{t('q.correct.for', { to: to(teams[active]) })}
                </button>
                <button class="fz-btn fz-btn--danger" onClick={onWrong}><Icon name="x" />{t('q.none')}</button>
              </>
            ) : (
              <>
                <button class="fz-btn fz-btn--success" onClick={onCorrect}><Icon name="check" />{t('q.correct')}</button>
                <button class="fz-btn fz-btn--danger" onClick={onWrong}><Icon name="x" />{t('q.wrong')}</button>
              </>
            )}
          </div>
        )}
      </div>

      {report && <ReportModal q={q} cat={col.id} onClose={() => setReport(false)} />}
      {confirm && (
        <RevealModal
          onClose={() => setConfirm(false)}
          onConfirm={() => {
            setConfirm(false);
            playSound('reveal');
            setGame(reveal);
          }}
        />
      )}
    </main>
  );
}
