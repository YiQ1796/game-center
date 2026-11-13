import { codeForSeed, isCode, scoreGuess } from './rules.mjs?v=1';

export const PROTOCOL = 2;
const RECENT_GUESSES = 80;
export const validRoomCode = value => typeof value === 'string' && /^\d{6}$/.test(value);
export const validToken = value => typeof value === 'string' && /^[a-f0-9]{32}$/.test(value);

export function playerName(value, fallback) {
  return (typeof value === 'string' ? Array.from(value.trim()).slice(0, 16).join('') : '') || fallback;
}

export function newRoom(code, name) {
  return {
    protocol: PROTOCOL, code, players: [{ name, online: true }, null],
    phase: 'lobby', revision: 0, round: 0, turn: null, answer: null, guesses: [], winner: null
  };
}

export function randomAnswer() {
  const seed = crypto.getRandomValues(new Uint32Array(1))[0].toString(16).padStart(8, '0');
  return codeForSeed(seed);
}

export function startRound(room, answer = randomAnswer()) {
  if (!['lobby', 'finished'].includes(room.phase) || !room.players.every(player => player?.online) || !isCode(answer)) return false;
  room.round += 1;
  room.phase = 'playing';
  room.answer = answer;
  room.guesses = [];
  room.winner = null;
  room.turn = (room.round - 1) % 2;
  room.revision += 1;
  return true;
}

export function applyMove(room, seat, move) {
  if (!move || room.phase !== 'playing' || move.round !== room.round ||
      room.turn !== seat || move.revision !== room.revision ||
      !room.players.every(player => player?.online) || !isCode(move.code) ||
      room.guesses.some(guess => guess.code === move.code)) return false;
  const result = scoreGuess(room.answer, move.code);
  room.guesses.push({ seat, code: move.code, ...result });
  if (result.a === 4) {
    room.winner = seat;
    room.phase = 'finished';
    room.turn = null;
  } else {
    room.turn = 1 - seat;
  }
  room.revision += 1;
  return true;
}

export function viewForSeat(room, seat) {
  return {
    code: room.code, phase: room.phase, revision: room.revision, round: room.round,
    turn: room.turn, winner: room.winner, seat,
    answer: room.phase === 'finished' ? room.answer : null,
    players: room.players.map(player => player && ({ name: player.name, online: player.online })),
    guessCount: room.guesses.length, guesses: room.guesses.slice(-RECENT_GUESSES)
  };
}
