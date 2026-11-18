import assert from 'node:assert/strict';
import { test } from 'node:test';
import { advance, applyAction, attackRows, createMatch, createPlayer, ENDLESS_MODE, finishMatch, HIDDEN, HEIGHT, KO_LIMIT, MATCH_TIME, playMatch, WIDTH } from '../stack-battle/engine.mjs';
import { eventBanter, FRIEND_TAUNTS, isRoomTaunt, TAUNT_COOLDOWN } from '../stack-battle/banter.mjs';
import { nicknameChoices, isNickname } from '../stack-battle/names.mjs';

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

test('Dual endless starts immediately, shares a bag and sends no garbage after a four-line clear', () => {
  const match = createMatch(93, 100, ENDLESS_MODE);
  const [first, second] = match.players;
  assert.equal(match.starts, 100);
  assert.equal(match.ends, null);
  assert.equal(first.piece.type, second.piece.type);
  assert.deepEqual(first.queue, second.queue);
  assert.equal(first.duel, false);
  assert.equal(second.duel, false);
  const opponentBefore = structuredClone(second);
  first.piece = { type: 'I', x: 3, y: 1, angle: 1 };
  for (let offset = 1; offset <= 4; offset++) {
    first.board[HEIGHT + HIDDEN - offset] = Array.from({ length: WIDTH }, (_, x) => x === 5 ? 0 : 1);
  }
  assert.equal(playMatch(match, 0, 'h', match.starts + MATCH_TIME + 1), true);
  assert.equal(first.lines, 4);
  assert.equal(first.event.attack, 0);
  assert.equal(first.sent, 0);
  assert.deepEqual(second, opponentBefore);
  assert.equal(match.finished, false);
});

test('A topped-out endless board freezes until the second player finishes, including after serialization', () => {
  let match = createMatch(32, 100, ENDLESS_MODE);
  for (let moves = 0; moves < HEIGHT && !match.players[0].dead; moves++) {
    assert.equal(playMatch(match, 0, 'h', 101 + moves), true);
  }
  assert.equal(match.players[0].dead, true);
  assert.equal(match.finished, false);
  assert.ok(match.players[0].board.some(row => row.some(Boolean)));
  match = JSON.parse(JSON.stringify(match));
  const frozen = structuredClone(match.players[0]);
  assert.equal(playMatch(match, 0, 'h', 200), false);
  for (let moves = 0; moves < HEIGHT && !match.finished; moves++) {
    assert.equal(playMatch(match, 1, 'h', 201 + moves), true);
  }
  assert.equal(match.players[1].dead, true);
  assert.equal(match.finished, true);
  assert.equal(match.winner, null);
  assert.deepEqual(match.players[0], frozen);
  assert.deepEqual(match.players.map(player => player.ko), [0, 0]);
});

test('Generated nicknames are valid, distinct and refresh to a different set', () => {
  const first = nicknameChoices();
  const second = nicknameChoices(first);
  assert.equal(new Set([...first, ...second]).size, 10);
  assert.ok([...first, ...second].every(isNickname));
  assert.equal(isNickname('自行輸入名字'), false);
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

test('The room synchronizes the host mode and keeps KO compatibility with older clients', async () => {
  const { BattleRoom } = await import('../stack-battle/room.mjs');
  const host = Object.create(BattleRoom.prototype);
  const guest = Object.create(BattleRoom.prototype);
  const client = { open: true };
  const token = crypto.randomUUID();
  const sent = [];
  guest.state = { role: 'guest', code: '123456', name: '好友', mode: ENDLESS_MODE };
  guest.onView = () => {};
  guest.onStatus = () => {};
  guest.transport = { confirmJoined() {} };
  host.state = { role: 'host', code: '123456', name: '房主', match: null };
  host.status = () => {};
  host.save = () => {};
  host.transport = { sendHost(_client, message) { sent.push(message); guest.receiveGuest(message); } };

  guest.receiveGuest({ type: 'state', names: ['房主', '好友'], match: null, now: Date.now() });
  assert.equal(guest.state.mode, 'duel');
  host.receiveHost({ type: 'hello', token, name: '好友' }, client);
  assert.equal(host.guest, client);
  assert.equal(host.selectMode(ENDLESS_MODE), false);
  host.receiveHost({ type: 'hello', token, name: '好友', supportsEndless: true }, client);
  assert.equal(host.selectMode(ENDLESS_MODE), true);
  assert.equal(guest.state.mode, ENDLESS_MODE);
  host.start();
  assert.equal(sent.at(-1).match.ends, null);
  assert.equal(host.selectMode('duel'), false);
  assert.equal(host.state.match.mode, ENDLESS_MODE);

  host.guest = null;
  const guestBoard = structuredClone(host.state.match.players[1]);
  host.emit = () => {};
  host.play(0, 'h');
  assert.ok(host.state.match.players[0].score > 0);
  assert.deepEqual(host.state.match.players[1], guestBoard);
});

test('The mascot reacts to meaningful clears and danger without repeating a normal single clear', () => {
  assert.equal(eventBanter({ lines: 1, combo: 0 }, false), null);
  assert.equal(eventBanter({ lines: 1, combo: 1 }, false), 'combo');
  assert.equal(eventBanter({ lines: 4, perfect: true, combo: 3 }, false), 'perfect');
  assert.equal(eventBanter({ lines: 0 }, true), 'danger');
  assert.equal(eventBanter({ lines: 0, bombs: 2 }, false), 'bomb');
  assert.equal(eventBanter({ ko: true }, false), 'knockout');
  assert.equal(isRoomTaunt({ seat: 2, index: 1, at: 100 }), false);
  assert.equal(isRoomTaunt({ seat: 1, index: FRIEND_TAUNTS.length, at: 100 }), false);
  assert.equal(isRoomTaunt({ seat: 1, index: 1, at: 100 }), true);
});

test('Room taunts use presets, rate limit each sender and preserve the board', async () => {
  const { BattleRoom } = await import('../stack-battle/room.mjs');
  const host = Object.create(BattleRoom.prototype);
  const guest = Object.create(BattleRoom.prototype);
  const seat = {};
  let hostView;
  let guestView;
  host.state = { role: 'host', mode: ENDLESS_MODE, code: '123456', name: '房主', guest: { name: '好友', supportsTaunts: true } };
  host.guest = seat;
  host.onView = value => { hostView = value; };
  host.onStatus = () => {};
  guest.state = { role: 'guest', code: '123456' };
  guest.onView = value => { guestView = value; };
  guest.onStatus = () => {};
  host.transport = { sendHost(_source, snapshot) { guest.receiveGuest(structuredClone(snapshot)); } };
  guest.transport = {
    confirmJoined() {},
    sendGuest(message) { host.receiveHost(message, seat); return true; }
  };
  assert.equal(host.sendTaunt(0), false);
  host.start();
  const board = structuredClone(host.state.match);
  host.receiveHost({ type: 'taunt', index: 2 }, {});
  assert.equal(host.state.taunt, null);
  assert.equal(host.sendTaunt('自由輸入'), false);
  assert.equal(host.publishTaunt(0, 1, 1000), true);
  assert.equal(host.publishTaunt(0, 2, 1000 + TAUNT_COOLDOWN - 1), false);
  assert.deepEqual(guestView.taunt, { seat: 0, index: 1, at: 1000 });
  assert.equal(guest.sendTaunt(3), true);
  assert.equal(hostView.taunt.seat, 1);
  assert.equal(hostView.taunt.index, 3);
  assert.deepEqual(hostView.taunt, guestView.taunt);
  assert.equal(host.publishTaunt(0, 4, 1000 + TAUNT_COOLDOWN), true);
  assert.deepEqual(host.state.match, board);
  host.state.match.finished = true;
  host.start();
  assert.equal(guestView.taunt, null);
  host.state.guest.supportsTaunts = false;
  assert.equal(host.sendTaunt(1), false);
});

test('Multi-line clears increase base points and each consecutive clear adds 25%', async () => {
  const { scoreClear } = await import('../stack-battle/engine.mjs');
  assert.deepEqual([1, 2, 3, 4].map(lines => scoreClear({ lines }).clearPoints), [100, 300, 500, 800]);
  assert.deepEqual(scoreClear({ lines: 2, combo: 2 }), { clearPoints: 450, comboBonus: 150 });
  assert.deepEqual(scoreClear({ lines: 4, combo: 3, level: 2 }), { clearPoints: 2800, comboBonus: 1200 });
  const player = createPlayer(82);
  player.combo = 0;
  player.piece = { type: 'I', x: 3, y: 1, angle: 0 };
  player.board[HEIGHT + HIDDEN - 1] = [1, 1, 1, 0, 0, 0, 0, 1, 1, 1];
  player.board[HEIGHT + HIDDEN - 2][0] = 3;
  assert.equal(applyAction(player, 'h'), true);
  assert.equal(player.event.clearPoints, 125);
  assert.equal(player.event.comboBonus, 25);
  assert.equal(player.event.cleared[0].y, HEIGHT + HIDDEN - 1);
  assert.equal(player.event.cleared[0].cells.length, WIDTH);
});

test('Anonymous Apps Script API verifies a replay and stores only the best public record', async () => {
  const { createHash } = await import('node:crypto');
  const { runInNewContext } = await import('node:vm');
  const { buildAppsScript } = await import('../stack-battle/backend/package-leaderboard.mjs');
  const rows = new Map();
  let locked = false;
  const context = {
    console, 
    LockService: { getScriptLock: () => ({
      tryLock: () => { assert.equal(locked, false); locked = true; return true; },
      releaseLock: () => { locked = false; }
    }) },
    PropertiesService: { getScriptProperties: () => ({
      getProperties: () => Object.fromEntries(rows),
      setProperty: (key, value) => { assert.equal(locked, true); rows.set(key, value); },
      deleteProperty: key => rows.delete(key)
    }) },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: value => ({
      setMimeType: () => JSON.parse(value)
    }) },
    Utilities: { DigestAlgorithm: { SHA_256: 'sha256' }, computeDigest: (name, input) =>
      [...createHash(name).update(input).digest()] }
  };
  runInNewContext(buildAppsScript(), context);
  const { seed, actions, player } = sampleReplay();
  const submission = { edition: 2, name: '疾風的工頭', seed, actions: actions.join(''), playerId: crypto.randomUUID() };
  const post = data => context.doPost({ postData: { contents: JSON.stringify(data) } });
  assert.deepEqual(post({ ...submission, validateOnly: true }), { verified: true, score: player.score, lines: 1 });
  assert.equal(rows.size, 0);
  assert.deepEqual(post(submission), { saved: true, rank: 1, score: player.score });
  assert.equal(post(submission).reason, 'lower');
  assert.equal(post({ ...submission, playerId: crypto.randomUUID() }).reason, 'duplicate');
  assert.deepEqual(context.doGet(), { edition: 2, entries: [{ name: '疾風的工頭', score: player.score, lines: 1 }] });
  assert.equal(post({ ...submission, actions: 'l?h' }).error, '這局成績無法驗證，至少需消除一行。');
});

test('Both unlimited modes retain constant gravity after many cleared rows, KO remains distinct', () => {
  const check = (player, expected) => {
    player.lines = 190;
    const observed = [];
    const move = action => {
      observed.push(action);
      return applyAction(player, action);
    };
    advance(player, expected - 1, move);
    assert.equal(observed.length, 0);
    advance(player, 1, move);
    assert.deepEqual(observed, ['g']);
  };
  check(createPlayer(15), 900);
  check(createMatch(15, 100, ENDLESS_MODE).players[0], 900);
  check(createMatch(15, 100, ENDLESS_MODE).players[1], 900);
  check(createPlayer(15, true), 720);
});

test('Guest predicts immediately and reconciles acknowledged actions without duplicate movement', async () => {
  const { BattleRoom } = await import('../stack-battle/room.mjs');
  const host = Object.create(BattleRoom.prototype);
  const guest = Object.create(BattleRoom.prototype);
  const seat = { open: true };
  const upstream = [];
  const received = [];
  host.state = { role: 'host', mode: ENDLESS_MODE, code: '123456', name: '房主', guest: null, match: null };
  host.onView = () => {};
  host.onStatus = () => {};
  host.status = () => {};
  host.save = () => {};
  host.transport = {
    sendHost(_conn, message) {
      const snapshot = structuredClone(message);
      received.push(snapshot);
      guest.receiveGuest(snapshot);
      return true;
    }
  };
  guest.state = { role: 'guest', mode: ENDLESS_MODE, code: '123456', name: '好友' };
  guest.onStatus = () => {};
  let displayed = null;
  guest.onView = value => { displayed = value; };
  guest.remoteReady = false;
  guest.resetGuestPrediction();
  guest.transport = { confirmJoined() {}, sendGuest(value) { upstream.push(value); return true; } };
  host.receiveHost({
    type: 'hello', token: crypto.randomUUID(), name: '好友',
    supportsEndless: true, supportsPrediction: true
  }, seat);
  host.start();
  const originalX = host.state.match.players[1].piece.x;
  guest.input('r');
  guest.input('r');
  assert.deepEqual(upstream.map(item => item.sequence), [1, 2]);
  assert.equal(displayed.match.players[1].piece.x, originalX + 2);
  assert.equal(host.state.match.players[1].piece.x, originalX);
  upstream.forEach(item => host.receiveHost(item, seat));
  const authoritative = structuredClone(host.state.match);
  host.receiveHost(upstream[0], seat);
  assert.equal(host.state.match.players[1].piece.x, originalX + 2);
  host.sendView();
  assert.equal(received.at(-1).inputAcknowledged, 2);
  assert.equal(guest.pendingGuestActions.length, 0);
  assert.deepEqual(displayed.match, authoritative);
  const previous = received.at(-1);
  guest.input('l');
  assert.equal(displayed.match.players[1].piece.x, originalX + 1);
  guest.receiveGuest({ ...previous, snapshotNumber: previous.snapshotNumber - 1 });
  assert.equal(displayed.match.players[1].piece.x, originalX + 1);
  host.receiveHost(upstream.at(-1), seat);
  host.sendView();
  assert.equal(guest.pendingGuestActions.length, 0);
  assert.deepEqual(displayed.match, host.state.match);
});
test('Host supports legacy players without prediction and unchanged KO attack', async () => {
  const { BattleRoom } = await import('../stack-battle/room.mjs');
  const host = Object.create(BattleRoom.prototype);
  const seat = { open: true };
  const sent = [];
  host.guest = seat;
  host.state = { role:'host', mode:'duel', name:'房主', guest:null, match:createMatch(123, Date.now()-4000, 'duel') };
  host.transport = { sendHost() { return true; } };
  host.status = () => {};
  host.onView = () => {};
  host.save = () => {};
  host.receiveHost({ type:'hello', token:crypto.randomUUID(), name:'好友' }, seat);
  assert.equal(host.state.guest.supportsPrediction, false);
  const initialX = host.state.match.players[1].piece.x;
  host.receiveHost({ type:'input', action:'r' }, seat);
  assert.equal(host.state.match.players[1].piece.x, initialX + 1);
  const guest = Object.create(BattleRoom.prototype);
  guest.state = { role:'guest', mode:'duel', code:'123456' };
  guest.remoteReady = true;
  guest.remote = { match: host.state.match };
  guest.transport = { sendGuest(input) { sent.push(input); return true; } };
  guest.input('l');
  assert.deepEqual(sent, [{ type:'input', action:'l' }]);
});

test('Asynchronously sent host snapshots do not mutate after later actions', async () => {
  const { BattleRoom } = await import('../stack-battle/room.mjs');
  const host = Object.create(BattleRoom.prototype);
  host.guest = { open: true };
  host.state = {
    role:'host', name:'房主', mode:ENDLESS_MODE,
    guest:{ name:'好友', supportsPrediction:true },
    match:createMatch(49, Date.now(), ENDLESS_MODE)
  };
  const packets = [];
  host.transport = { sendHost(_seat, payload) { packets.push(payload); return true; } };
  host.sendView();
  const first = packets[0];
  const firstX = first.match.players[1].piece.x;
  const ack = first.inputAcknowledged;
  applyAction(host.state.match.players[1], 'r');
  assert.equal(first.match.players[1].piece.x, firstX);
  assert.equal(first.inputAcknowledged, ack);
  assert.equal(host.state.match.players[1].piece.x, firstX + 1);
});
