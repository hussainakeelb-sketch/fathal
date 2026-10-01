import { useEffect, useState } from 'preact/hooks';
import { t } from '../i18n/index.js';
import { Header } from '../components/Header.jsx';
import { CatIcon } from '../components/Icon.jsx';
import { ErrorState } from '../components/ErrorState.jsx';
import { fetchIndex, fetchCategory } from '../lib/data.js';
import { buildColumn, loadSeen } from '../lib/deck.js';
import { pickTurn, togglePick, startBoard, SYM } from '../lib/game.js';

export function Categories({ prefs, game, setGame, onBack }) {
  const [index, setIndex] = useState(null);
  const [error, setError] = useState(null);
  const [starting, setStarting] = useState(false);

  const loadIndex = () => {
    setError(null);
    fetchIndex().then(setIndex, setError);
  };
  useEffect(loadIndex, []);

  const turn = pickTurn(game);
  const done = game.picks.length >= 6;

  const start = async () => {
    if (!done || starting) return;
    setStarting(true);
    setError(null);
    try {
      const files = await Promise.all(game.picks.map((p) => fetchCategory(p.id)));
      const seen = loadSeen();
      const columns = game.picks.map((p, i) => ({ ...p, tiles: buildColumn(files[i].questions, { seen }) }));
      setGame(startBoard(game, columns));
    } catch (e) {
      setError(e);
      setStarting(false);
    }
  };

  if (error) {
    return (
      <main class="scr">
        <Header prefs={prefs} onBack={onBack} />
        <ErrorState error={error} onRetry={index ? start : loadIndex} />
      </main>
    );
  }

  const ready = index?.categories.filter((c) => c.ready) ?? [];
  const sections = index?.sections.filter((s) => ready.some((c) => c.section === s.id)) ?? [];

  return (
    <main class="scr">
      <Header prefs={prefs} onBack={onBack} />
      <div class="turnbar">
        {!done && (
          <span class={`fz-chip fz-chip--${turn} turnbar__chip`} aria-live="polite">
            {t('cats.turn', { sym: SYM[turn], name: game.teams[turn] })}
          </span>
        )}
        <span class="pill">{t('cats.count', { n: game.picks.length })}</span>
        <div class="grow" />
        <span class="sub">{t('cats.rule')}</span>
      </div>

      {!index ? (
        <div class="cat-grid" aria-busy="true">
          {Array.from({ length: 8 }, () => (
            <div class="fz-cat is-loading" style={{ minWidth: 0 }}>
              <div class="fz-cat__icon fz-skel" />
              <div class="fz-skel" style={{ height: '24px', width: '70%' }} />
            </div>
          ))}
        </div>
      ) : (
        sections.map((s) => (
          <section class="cat-section" aria-labelledby={`sec-${s.id}`}>
            <h2 class="cat-section__title" id={`sec-${s.id}`}>{s.name}</h2>
            <div class="cat-grid">
              {ready.filter((c) => c.section === s.id).map((c) => {
                const pick = game.picks.find((p) => p.id === c.id);
                const isLast = pick && game.picks[game.picks.length - 1].id === c.id;
                const disabled = pick ? !isLast : done;
                const cls = `fz-cat${pick ? ` is-selected-${pick.team}` : ''}${disabled && !pick ? ' is-disabled' : ''}`;
                return (
                  <div
                    class={cls}
                    style={{ minWidth: 0 }}
                    role="button"
                    tabindex={disabled ? -1 : 0}
                    aria-pressed={!!pick}
                    aria-disabled={disabled ? 'true' : undefined}
                    aria-label={t('cats.label', {
                      name: c.name,
                      state: pick ? t('cats.state.taken', { team: game.teams[pick.team] }) : t('cats.state.free'),
                    })}
                    onClick={() => !disabled && setGame((g) => togglePick(g, c))}
                    onKeyDown={(e) => {
                      if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
                        e.preventDefault();
                        setGame((g) => togglePick(g, c));
                      }
                    }}
                  >
                    {pick && <span class="fz-cat__badge">{SYM[pick.team]} {game.teams[pick.team]}</span>}
                    <div class="fz-cat__icon"><CatIcon name={c.icon} /></div>
                    <div class="fz-cat__name">{c.name}</div>
                    <div class="fz-cat__meta">{t('cats.meta', { n: c.count })}</div>
                  </div>
                );
              })}
            </div>
          </section>
        ))
      )}

      <div class="grow" />
      <div class="foot sticky-foot">
        <button
          class={`fz-btn fz-btn--primary${!done ? ' is-disabled' : ''}${starting ? ' is-loading' : ''}`}
          aria-disabled={!done ? 'true' : undefined}
          aria-busy={starting ? 'true' : undefined}
          onClick={start}
        >
          {t('cats.start')}
        </button>
      </div>
    </main>
  );
}
