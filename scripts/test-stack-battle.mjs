import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
const { DatabaseSync } = await import('node:sqlite').catch(() => ({}));
import { applyAction, attackRows, createMatch, createPlayer, finishMatch, HIDDEN, HEIGHT, KO_LIMIT, MATCH_TIME, playMatch, WIDTH } from '../stack-battle/engine.mjs';
import { nicknameChoices, isNickname } from '../stack-battle/names.mjs';
import { makeScoreCode, verifyScoreCode } from '../stack-battle/replay.mjs';
import worker from '../stack-battle/backend/worker.mjs';

function sampleReplay() {
  const actions = [...'lllh rh rrrrh'.replaceAll(' ', '')];
  for (let seed = 1; seed < 20000; seed++) {
    const player = createPlayer(seed);
    if (player.piece.type + player.queue.slice(0, 2).join('') !== 'IJL') continue;
    for (const action of actions) assert.ok(applyAction(player, action));
    assert.equal(player.lines, 1);
    return { seed, actions, player };
  }
  assert.fail('No seeded replay fixture');
}

test('Uncapped solo play clears a line, raises the score and reconstructs it from the replay', async () => {
  const { seed, actions, player } = sampleReplay();
  const code = await makeScoreCode(seed, actions);
  assert.deepEqual(await verifyScoreCode(code), { score: player.score, lines: player.lines });
  assert.equal(await verifyScoreCode(code.slice(0, -8)), null);
  assert.equal(await verifyScoreCode(await makeScoreCode(seed, ['r', 'r', 'r', 'r', 'r', 'r'])), null);
});

test('Seven-piece bags give mirrored starting queues and hold is restricted once per piece', () => {
  const a = createPlayer(193);
  const b = createPlayer(193);
  assert.deepEqual(a.queue, b.queue);
  assert.equal(new Set([a.piece.type, ...a.queue.slice(0, 6)]).size, 7);
  const type = a.piece.type;
  assert.ok(applyAction(a, 'c'));
  assert.equal(a.hold, type);
  assert.equal(applyAction(a, 'c'), false);
  applyAction(a, 'h');
  assert.ok(applyAction(a, 'c'));
});

test('Standard line attack, combos, T-spins, B2B and consecutive bombs use the intended values', () => {
  assert.deepEqual([1, 2, 3, 4].map(lines => attackRows(lines, 0, false, false, false)), [0, 1, 2, 4]);
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8].map(combo => attackRows(1, combo, false, false, false)), [1, 1, 2, 2, 3, 3, 4, 4]);
  assert.equal(attackRows(2, 0, true, true, false), 6);
  assert.equal(attackRows(0, 0, false, false, false, 2), 1);
});

test('Queued garbage rises from the bottom and leaves correctly placed bombs', () => {
  const p = createPlayer(82, true);
  p.incoming = [4, 4, 7];
  applyAction(p, 'h');
  assert.deepEqual(p.board.slice(-3).map(row => row.indexOf(9)), [4, 4, 7]);
  assert.equal(p.board.length, HEIGHT + HIDDEN);
  assert.equal(p.incoming.length, 0);
});

test('A dropped piece can detonate a vertical pair of bombs and send one row back', () => {
  const p = createPlayer(82, true);
  p.piece = { type: 'I', x: 3, y: 1, angle: 0 };
  for (const offset of [1, 2]) p.board[p.board.length - offset] = Array.from({ length: WIDTH }, (_, x) => x === 4 ? 9 : 8);
  applyAction(p, 'h');
  assert.equal(p.event.bombs, 2);
  assert.equal(p.event.attack, 1);
  assert.equal(p.board.flat().includes(9), false);
});

test('Five-minute countdown, manual KO tiebreak, and a balanced draw', () => {
  const match = createMatch(1, 100);
  assert.equal(MATCH_TIME, 300000);
  assert.equal(match.ends - match.starts, MATCH_TIME);
  assert.equal(playMatch(match, 0, 'h', match.starts - 1), false);
  finishMatch(match, match.ends - 1);
  assert.equal(match.finished, false);
  match.players[1].sent = 12;
  finishMatch(match, match.ends);
  assert.equal(match.winner, 1);
  const draw = createMatch(2, 100);
  finishMatch(draw, draw.ends);
  assert.equal(draw.winner, null);
});

test('Top-out clears the loser board and the third KO ends the battle', () => {
  const match = createMatch(2, 100);
  const victim = match.players[0];
  for (let index = 0; index < KO_LIMIT; index++) {
    victim.board[0][0] = 1;
    victim.incoming = [5, 5];
    assert.ok(playMatch(match, 0, 'h', match.starts + 20 + index));
    assert.equal(match.players[1].ko, index + 1);
    assert.equal(victim.board.length, HEIGHT + HIDDEN);
    assert.ok(victim.board.every(row => !row.some(Boolean)));
  }
  assert.equal(match.finished, true);
  assert.equal(match.winner, 1);
});

test('Generated nicknames are valid, distinct and refresh to a different set', () => {
  const first = nicknameChoices();
  const second = nicknameChoices(first);
  assert.equal(new Set([...first, ...second]).size, 10);
  assert.ok([...first, ...second].every(isNickname));
  assert.equal(isNickname('自行輸入名字'), false);
});

test('Public anonymous ranking persists verified scores, suppresses a copied replay and shows the champion', { skip: !DatabaseSync }, async () => {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../stack-battle/backend/schema.sql', import.meta.url), 'utf8'));
  const d1 = {
    prepare(sql) {
      const stmt = db.prepare(sql);
      return {
        all: async () => ({ results: stmt.all() }),
        bind: (...args) => ({ first: async () => stmt.get(...args) })
      };
    }
  };
  const { seed, actions, player } = sampleReplay();
  const replay = await makeScoreCode(seed, actions);
  const [name] = nicknameChoices();
  const env = { DB: d1 };
  const endpoint = 'https://example.com/api/scores';
  const send = (origin, payload) => worker.fetch(new Request(endpoint, {
    method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }), env);
  const data = { name, replay, playerId: crypto.randomUUID() };
  assert.equal((await send('https://other.example', data)).status, 403);
  assert.equal((await send('https://yiq1796.github.io', { ...data, name: '非法名稱' })).status, 400);
  assert.equal((await send('https://yiq1796.github.io', { ...data, replay: 'tampered' })).status, 422);
  const accepted = await send('https://yiq1796.github.io', data);
  assert.equal(accepted.headers.get('Access-Control-Allow-Origin'), 'https://yiq1796.github.io');
  assert.deepEqual(await accepted.json(), { saved: true, score: player.score, lines: 1 });
  assert.equal((await (await send('https://yiq1796.github.io', { ...data, playerId: crypto.randomUUID() })).json()).saved, false);
  const ranking = await (await worker.fetch(new Request(endpoint), env)).json();
  assert.deepEqual(ranking, { entries: [{ name, score: player.score, lines: 1 }] });
  db.close();
});

test('Host opens a room and a guest connects through the join transport', async () => {
  const { BattleRoom } = await import('../stack-battle/room.mjs');
  const calls = [];
  const room = Object.create(BattleRoom.prototype);
  room.transport = {
    host: async code => calls.push(['host', code]),
    join: async code => calls.push(['join', code])
  };
  room.status = () => {};
  room.leave = message => assert.fail(message);
  room.state = { role: 'host', code: '123456' };
  await room.open();
  assert.equal(room.hostReady, true);
  room.state = { role: 'guest', code: '123456' };
  await room.open();
  assert.deepEqual(calls, [['host', '123456'], ['join', '123456']]);
});
