import { isCode, scoreGuess } from './rules.mjs?v=1';

export const PROTOCOL = 1;
export const MAX_GUESSES = 80;
export const validRoomCode = value => typeof value === 'string' && /^\d{6}$/.test(value);
export const validToken = value => typeof value === 'string' && /^[a-f0-9]{32}$/.test(value);

export function playerName(value, fallback) {
  return (typeof value === 'string' ? Array.from(value.trim()).slice(0, 16).join('') : '') || fallback;
}

export function newRoom(code, name) {
  return {
    code, players: [{ name, online: true }, null], phase: 'lobby', revision: 0, round: 0,
    turn: null, secrets: [null, null], guesses: [], winner: null
  };
}

export function startRound(room) {
  if (!['lobby', 'finished'].includes(room.phase) || !room.players.every(player => player?.online)) return false;
  room.round += 1;
  room.phase = 'setting';
  room.secrets = [null, null];
  room.guesses = [];
  room.winner = null;
  room.turn = null;
  room.revision += 1;
  return true;
}

export function applyMove(room, seat, move) {
  if (!move || move.round !== room.round || !room.players[seat]?.online ||
      !room.players.every(player => player?.online) || !isCode(move.code)) return false;
  if (move.type === 'secret' && room.phase === 'setting' && room.secrets[seat] === null) {
    room.secrets[seat] = move.code;
    if (room.secrets.every(Boolean)) {
      room.phase = 'playing';
      room.turn = (room.round - 1) % 2;
    }
  } else if (move.type === 'guess' && room.phase === 'playing' &&
      room.turn === seat && move.revision === room.revision) {
    const result = scoreGuess(room.secrets[1 - seat], move.code);
    room.guesses.push({ seat, code: move.code, ...result });
    if (result.a === 4 || room.guesses.length >= MAX_GUESSES) {
      room.winner = result.a === 4 ? seat : null;
      room.phase = 'finished';
      room.turn = null;
    } else {
      room.turn = 1 - seat;
    }
  } else {
    return false;
  }
  room.revision += 1;
  return true;
}

export function viewForSeat(room, seat) {
  return {
    code: room.code, phase: room.phase, revision: room.revision, round: room.round,
    turn: room.turn, winner: room.winner, seat, ownSecret: room.secrets[seat],
    opponentSecret: room.phase === 'finished' ? room.secrets[1 - seat] : null,
    players: room.players.map((player, index) => player && ({
      name: player.name, online: player.online, ready: Boolean(room.secrets[index])
    })),
    guesses: room.guesses
  };
}
