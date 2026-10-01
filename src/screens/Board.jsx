import { useState } from 'preact/hooks';
import { t } from '../i18n/index.js';
import { Scoreboard } from '../components/Scoreboard.jsx';
import { openTile, SYM } from '../lib/game.js';
import { preloadMedia } from '../lib/data.js';

const SELECT_MS = 400; // dur-select

export function Board({ header, game, setGame }) {
  const [active, setActive] = useState(null);

  const choose = (col, tile) => {
    if (active) return;
    preloadMedia(game.board[col].tiles[tile].q);
    setActive(`${col}-${tile}`);
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    setTimeout(() => setGame((g) => openTile(g, col, tile)), reduced ? 150 : SELECT_MS);
  };

  return (
    <main class="scr brand scr--fit">
      {header}
      <Scoreboard teams={game.teams} scores={game.scores} turn={game.turn} />
      <div class="board">
        {game.board.map((c, ci) => (
          <div class="col" role="group" aria-label={c.name}>
            <div class="colh">
              <i class={c.team} aria-hidden="true">{SYM[c.team]}</i>
              {c.name}
            </div>
            <div class="tiles">
              {c.tiles.map((tile, ti) => {
                const isActive = active === `${ci}-${ti}`;
                const p = tile.q.p;
                return (
                  <button
                    class={`fz-tile${tile.used ? ' is-used' : ''}${isActive ? ' is-active is-growing' : ''}`}
                    disabled={tile.used}
                    aria-label={t(tile.used ? 'board.tile.used' : 'board.tile', { cat: c.name, p })}
                    onClick={() => choose(ci, ti)}
                  >
                    {p}
                    {tile.used && (
                      <span class={`fz-tile__by fz-tile__by--${tile.by}`} aria-hidden="true">
                        {tile.by === 'none' ? '—' : SYM[tile.by]}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
