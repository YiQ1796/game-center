export const WIDTH = 10;
export const HEIGHT = 20;
export const HIDDEN = 2;
export const MATCH_TIME = 300_000;
export const KO_LIMIT = 3;
export const PIECES = 'IJLOSTZ';

const initial = {
  I: [[0,1],[1,1],[2,1],[3,1]], J: [[0,0],[0,1],[1,1],[2,1]],
  L: [[2,0],[0,1],[1,1],[2,1]], O: [[1,0],[2,0],[1,1],[2,1]],
  S: [[1,0],[2,0],[0,1],[1,1]], T: [[1,0],[0,1],[1,1],[2,1]],
  Z: [[0,0],[1,0],[1,1],[2,1]]
};

const shapes = Object.fromEntries(Object.entries(initial).map(([type, cells]) => {
  const rotations = [cells];
  for (let i = 1; i < 4; i++) {
    const edge = type === 'I' ? 3 : 2;
    rotations.push(type === 'O' ? cells : rotations[i - 1].map(([x, y]) => [edge - y, x]));
  }
  return [type, rotations];
}));

// SRS kick offsets use board coordinates, with positive y pointing down.
const standardKicks = {
  '01': [[-1,0],[-1,-1],[0,2],[-1,2]], '10': [[1,0],[1,1],[0,-2],[1,-2]],
  '12': [[1,0],[1,1],[0,-2],[1,-2]], '21': [[-1,0],[-1,-1],[0,2],[-1,2]],
  '23': [[1,0],[1,-1],[0,2],[1,2]], '32': [[-1,0],[-1,1],[0,-2],[-1,-2]],
  '30': [[-1,0],[-1,1],[0,-2],[-1,-2]], '03': [[1,0],[1,-1],[0,2],[1,2]]
};
const iKicks = {
  '01': [[-2,0],[1,0],[-2,1],[1,-2]], '10': [[2,0],[-1,0],[2,-1],[-1,2]],
  '12': [[-1,0],[2,0],[-1,-2],[2,1]], '21': [[1,0],[-2,0],[1,2],[-2,-1]],
  '23': [[2,0],[-1,0],[2,-1],[-1,2]], '32': [[-2,0],[1,0],[-2,1],[1,-2]],
  '30': [[1,0],[-2,0],[1,2],[-2,-1]], '03': [[-1,0],[2,0],[-1,-2],[2,1]]
};

export const PLAYER_ACTIONS = 'lrdszch';
const emptyRow = () => Array(WIDTH).fill(0);
const emptyBoard = () => Array.from({ length: HEIGHT + HIDDEN }, emptyRow);

function nextRandom(state) {
  state ^= state << 13;
  state ^= state >>> 17;
  state ^= state << 5;
  return state >>> 0;
}

function drawPieces(state) {
  const bag = [...PIECES];
  for (let i = bag.length - 1; i > 0; i--) {
    state.random = nextRandom(state.random);
    const other = state.random % (i + 1);
    [bag[i], bag[other]] = [bag[other], bag[i]];
  }
  state.queue.push(...bag);
}

function spawn(state, type) {
  if (!type) {
    type = state.queue.shift();
    if (state.queue.length < 7) drawPieces(state);
  }
  state.piece = { type, x: 3, y: 1, angle: 0 };
  state.grounded = 0;
  state.lockResets = 0;
  state.gravity = 0;
  state.rotated = false;
  state.dead = !fits(state.board, state.piece);
}

export function createPlayer(seed, duel = false) {
  const state = {
    board: emptyBoard(), queue: [], random: seed >>> 0 || 1, hold: null,
    holdUsed: false, score: 0, lines: 0, combo: -1, difficult: false,
    duel, incoming: [], sent: 0, ko: 0, revision: 0, event: null
  };
  drawPieces(state);
  spawn(state);
  return state;
}

export function cellsOf(piece) {
  return shapes[piece.type][piece.angle].map(([x, y]) => [x + piece.x, y + piece.y]);
}

export function fits(board, piece) {
  return cellsOf(piece).every(([x, y]) =>
    x >= 0 && x < WIDTH && y >= 0 && y < board.length && !board[y][x]);
}

export function projected(state) {
  const piece = { ...state.piece };
  while (fits(state.board, { ...piece, y: piece.y + 1 })) piece.y++;
  return piece;
}

function isGrounded(state) {
  return !fits(state.board, { ...state.piece, y: state.piece.y + 1 });
}

function move(state, x, y) {
  const piece = { ...state.piece, x: state.piece.x + x, y: state.piece.y + y };
  if (!fits(state.board, piece)) return false;
  state.piece = piece;
  state.rotated = false;
  return true;
}

function rotate(state, direction) {
  const { piece } = state;
  if (piece.type === 'O') return false;
  const angle = (piece.angle + direction + 4) % 4;
  const table = piece.type === 'I' ? iKicks : standardKicks;
  const kicks = [[0, 0], ...table[String(piece.angle) + angle]];
  for (const [x, y] of kicks) {
    const candidate = { ...piece, angle, x: piece.x + x, y: piece.y + y };
    if (fits(state.board, candidate)) {
      state.piece = candidate;
      state.rotated = true;
      return true;
    }
  }
  return false;
}

function isTSpin(state) {
  if (state.piece.type !== 'T' || !state.rotated) return false;
  const { x, y } = state.piece;
  const corners = [[x,y], [x + 2,y], [x,y + 2], [x + 2,y + 2]];
  return corners.filter(([col, row]) =>
    col < 0 || col >= WIDTH || row < 0 || row >= state.board.length || state.board[row][col]).length >= 3;
}

function clearRows(state, landed) {
  const bombRows = new Set();
  for (const [x, y] of landed) {
    if (state.board[y + 1]?.[x] !== 9) continue;
    let row = y + 1;
    while (state.board[row]?.[x] === 9) bombRows.add(row++);
  }
  let lines = 0;
  const cleared = [];
  const remaining = state.board.filter((row, y) => {
    if (bombRows.has(y)) {
      cleared.push({ y, cells: row, bomb: true });
      return false;
    }
    if (!row.every(Boolean) || row.includes(9)) return true;
    lines++;
    cleared.push({ y, cells: row, bomb: false });
    return false;
  });
  while (remaining.length < HEIGHT + HIDDEN) remaining.unshift(emptyRow());
  state.board = remaining;
  return { lines, bombs: bombRows.size, cleared };
}

export function attackRows(lines, combo, spin, backToBack, perfect, bombs = 0) {
  const base = spin ? [0, 2, 4, 6][lines] : [0, 0, 1, 2, 4][lines];
  const chain = backToBack ? (spin ? Math.floor(base / 2) : 2) : 0;
  const comboExtra = lines ? Math.min(4, Math.ceil(combo / 2)) : 0;
  return base + chain + comboExtra + (perfect ? 10 : 0) + Math.max(0, bombs - 1);
}

export function scoreClear({ lines, spin = false, backToBack = false, perfect = false, combo = 0, level = 1 }) {
  const base = (spin ? [0, 800, 1200, 1600] : [0, 100, 300, 500, 800])[lines] ?? 0;
  const streak = Math.max(0, combo);
  const normalPoints = Math.floor(base * (backToBack ? 1.5 : 1)) * level;
  const comboBonus = Math.floor(normalPoints * streak / 4);
  return { clearPoints: normalPoints + comboBonus + (perfect ? 2000 * level : 0), comboBonus };
}

function lock(state) {
  const landed = cellsOf(state.piece);
  const spin = isTSpin(state);
  for (const [x, y] of landed) state.board[y][x] = PIECES.indexOf(state.piece.type) + 1;
  const { lines, bombs, cleared } = clearRows(state, landed);
  const perfect = lines > 0 && state.board.every(row => row.every(cell => !cell));
  const difficult = lines > 0 && (lines === 4 || spin);
  const backToBack = difficult && state.difficult;
  const level = levelOf(state);
  if (lines) {
    state.combo++;
    state.difficult = difficult;
  } else if (!bombs) {
    state.combo = -1;
  }
  const { clearPoints, comboBonus } = scoreClear({ lines, spin, backToBack, perfect, combo: state.combo, level });
  state.score += clearPoints;
  state.lines += lines;
  state.revision++;
  state.event = { lines, bombs, spin, perfect, combo: state.combo, attack: 0, clearPoints, comboBonus, cleared };
  if (state.duel) {
    const attack = attackRows(lines, state.combo, spin, backToBack, perfect, bombs);
    const cancelled = Math.min(state.incoming.length, attack);
    state.incoming.splice(0, cancelled);
    state.event.attack = attack - cancelled;
    state.sent += state.event.attack;
    if (!lines && !bombs) {
      let overflow = false;
      for (const column of state.incoming.splice(0, 8)) {
        overflow = state.board.shift().some(Boolean) || overflow;
        const garbage = Array(WIDTH).fill(8);
        garbage[column] = 9;
        state.board.push(garbage);
      }
      if (overflow) {
        state.dead = true;
        return;
      }
    }
  }
  state.holdUsed = false;
  spawn(state);
}

export function applyAction(state, action) {
  if (state.dead) return false;
  if (action === 'k') {
    if (!isGrounded(state)) return false;
    lock(state);
    return true;
  }
  if (action === 'h') {
    const end = projected(state);
    state.score += 2 * (end.y - state.piece.y);
    if (end.y !== state.piece.y) state.rotated = false;
    state.piece = end;
    lock(state);
    return true;
  }
  if (action === 'c') {
    if (state.holdUsed) return false;
    const next = state.hold;
    state.hold = state.piece.type;
    state.holdUsed = true;
    spawn(state, next);
    return true;
  }
  const grounded = isGrounded(state);
  let changed;
  switch (action) {
    case 'l': changed = move(state, -1, 0); break;
    case 'r': changed = move(state, 1, 0); break;
    case 'd':
    case 'g': changed = move(state, 0, 1); break;
    case 's': changed = rotate(state, 1); break;
    case 'z': changed = rotate(state, -1); break;
    default: return false;
  }
  if (changed && action === 'd') state.score++;
  if (changed && grounded && state.lockResets < 15 && 'lrsz'.includes(action)) {
    state.grounded = 0;
    state.lockResets++;
  }
  return changed;
}

export function levelOf(state) {
  return 1 + Math.floor(state.lines / 10);
}

export function advance(state, elapsed, act) {
  if (state.dead) return;
  const interval = state.duel ? 720 : Math.max(70, 900 * 0.84 ** (levelOf(state) - 1));
  if (isGrounded(state)) {
    state.grounded += elapsed;
    if (state.grounded >= 450) act('k');
    return;
  }
  state.grounded = 0;
  state.gravity += elapsed;
  if (state.gravity >= interval) {
    state.gravity -= interval;
    act('g');
  }
}

export function createMatch(seed, now) {
  return {
    players: [createPlayer(seed, true), createPlayer(seed, true)],
    random: (seed ^ 0x71af019e) >>> 0 || 1,
    starts: now + 3000, ends: now + 3000 + MATCH_TIME, winner: null, finished: false
  };
}

export function finishMatch(match, now) {
  if (match.finished) return;
  const [first, second] = match.players;
  if (now < match.ends && first.ko < KO_LIMIT && second.ko < KO_LIMIT) return;
  const result = first.ko - second.ko || first.sent - second.sent;
  match.winner = result === 0 ? null : result > 0 ? 0 : 1;
  match.finished = true;
}

export function playMatch(match, seat, action, now) {
  finishMatch(match, now);
  if (match.finished || now < match.starts) return false;
  const own = match.players[seat];
  const opponent = match.players[1 - seat];
  const revision = own.revision;
  if (!applyAction(own, action)) return false;
  if (own.revision !== revision) {
    for (let row = 0; row < own.event.attack; row += 2) {
      match.random = nextRandom(match.random);
      const column = match.random % WIDTH;
      opponent.incoming.push(...Array(Math.min(2, own.event.attack - row)).fill(column));
    }
  }
  if (own.dead) {
    opponent.ko++;
    own.board = emptyBoard();
    own.incoming = [];
    own.hold = null;
    own.holdUsed = false;
    own.combo = -1;
    own.difficult = false;
    own.revision++;
    own.event = { ko: true };
    spawn(own);
  }
  finishMatch(match, now);
  return true;
}
