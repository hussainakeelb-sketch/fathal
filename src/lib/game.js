// منطق اللعبة. كل دالة تاخذ اللعبة وترجع نسخة جديدة، واللعبة تنحفظ بالجهاز بعد كل خطوة
// حتى إذا انسدت الصفحة أو انقطع النت ترجع من نفس المكان.
import { load, save, KEYS } from './storage.js';
import { STEAL_SECONDS } from './prefs.js';

export const TIEBREAK_SECONDS = 30;
export const other = (team) => (team === 'a' ? 'b' : 'a');
export const SYM = { a: '◆', b: '●' };

export function loadGame() {
  const g = load(KEYS.game, null);
  return g && g.v === 1 ? g : null;
}

export function saveGame(g) {
  save(KEYS.game, g);
}

export function newGame(teams, timers) {
  return { v: 1, phase: 'categories', teams, timers, picks: [], board: [], scores: { a: 0, b: 0 }, turn: 'a', cur: null, tb: null, winner: null };
}

// ---- اختيار الفئات: بالتناوب، الفريق الأول يبدي ----
export const pickTurn = (g) => (g.picks.length % 2 === 0 ? 'a' : 'b');

export function togglePick(g, cat) {
  const i = g.picks.findIndex((p) => p.id === cat.id);
  if (i >= 0) {
    // الفريق يگدر يلغي آخر فئة اختارها بس، وقبل ما الفريق الثاني يختار
    if (i !== g.picks.length - 1) return g;
    return { ...g, picks: g.picks.slice(0, -1) };
  }
  if (g.picks.length >= 6) return g;
  return { ...g, picks: [...g.picks, { id: cat.id, name: cat.name, icon: cat.icon, team: pickTurn(g) }] };
}

export function startBoard(g, columns) {
  return { ...g, phase: 'board', board: columns, turn: 'a' };
}

// ---- السؤال ----
export function openTile(g, col, tile) {
  const q = g.board[col].tiles[tile].q;
  const total = g.timers[q.p];
  return { ...g, phase: 'question', cur: { col, tile, stage: 'main', revealed: false, verdict: null, timer: { total, left: total, paused: false } } };
}

export const curTile = (g) => g.board[g.cur.col].tiles[g.cur.tile];

const patchCur = (g, patch) => ({ ...g, cur: { ...g.cur, ...patch } });

// ممكن الثانية تخلص بعد ما المقدّم حكّم ورجع للوحة، فنتأكد إن السؤال بعده مفتوح
export const tickTimer = (g) => !g?.cur ? g : patchCur(g, { timer: { ...g.cur.timer, left: Math.max(0, g.cur.timer.left - 1) } });
export const togglePause = (g) => !g?.cur ? g : patchCur(g, { timer: { ...g.cur.timer, paused: !g.cur.timer.paused } });
export const reveal = (g) => patchCur(g, { revealed: true });

// الفريق صاحب الدور جاوب صح
export function judgeCorrect(g) {
  const { q } = curTile(g);
  const team = g.cur.stage === 'steal' ? other(g.turn) : g.turn;
  return {
    ...patchCur(g, { stage: 'done', revealed: true, verdict: { type: 'ok', team, points: q.p }, timer: { ...g.cur.timer, paused: true } }),
    scores: { ...g.scores, [team]: g.scores[team] + q.p },
  };
}

// غلط: بالمرحلة الأولى السؤال ينتقل للسرقة، وبالسرقة ماكو نقاط لأحد
export function judgeWrong(g) {
  if (g.cur.stage === 'main') {
    return patchCur(g, { stage: 'steal', verdict: { type: 'no', team: g.turn }, timer: { total: STEAL_SECONDS, left: STEAL_SECONDS, paused: false } });
  }
  return patchCur(g, { stage: 'done', revealed: true, verdict: { type: 'none' }, timer: { ...g.cur.timer, paused: true } });
}

// الرجوع للوحة: الخانة تنقفل، والدور ينتقل بغض النظر منو جاوب
export function backToBoard(g) {
  const { col, tile, verdict } = g.cur;
  const by = verdict?.type === 'ok' ? verdict.team : 'none';
  const board = g.board.map((c, ci) =>
    ci !== col ? c : { ...c, tiles: c.tiles.map((t, ti) => (ti !== tile ? t : { ...t, used: true, by })) }
  );
  const next = { ...g, board, cur: null, phase: 'board', turn: other(g.turn) };
  return board.every((c) => c.tiles.every((t) => t.used)) ? endGame(next) : next;
}

// ---- نهاية اللعبة ----
export function endGame(g) {
  const { a, b } = g.scores;
  if (a === b) return { ...g, phase: 'tiebreak', cur: null, tb: { q: null, used: [], timer: null, revealed: false } };
  return { ...g, phase: 'winner', cur: null, winner: a > b ? 'a' : 'b' };
}

export function setTiebreakQuestion(g, q) {
  return { ...g, tb: { q, used: [...g.tb.used, q.id], revealed: false, timer: { total: TIEBREAK_SECONDS, left: TIEBREAK_SECONDS, paused: false } } };
}

const patchTb = (g, patch) => ({ ...g, tb: { ...g.tb, ...patch } });
export const tbTick = (g) => !g?.tb?.timer ? g : patchTb(g, { timer: { ...g.tb.timer, left: Math.max(0, g.tb.timer.left - 1) } });
export const tbTogglePause = (g) => patchTb(g, { timer: { ...g.tb.timer, paused: !g.tb.timer.paused } });
export const tbReveal = (g) => patchTb(g, { revealed: true });
export const tbWin = (g, team) => ({ ...g, phase: 'winner', winner: team });

export const allUsedIds = (g) => g.board.flatMap((c) => c.tiles.map((t) => t.q.id));
