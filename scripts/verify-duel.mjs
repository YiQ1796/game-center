import assert from 'node:assert/strict';
import { applyMove, newRoom, startRound, viewForSeat } from '../one-a-two-b/duel-core.mjs?v=3';
import { DuelRoom } from '../one-a-two-b/duel-room.mjs?v=3';

const sample = newRoom('012345', '猴三毛');
assert.equal(startRound(sample, '0123'), false);
sample.players[1] = { name: '好友', online: true };
assert.equal(startRound(sample, '0123'), true);
assert.equal(sample.turn, 0);
assert.equal(viewForSeat(sample, 1).answer, null);
const first = { code: '4567', round: 1, revision: sample.revision };
assert.equal(applyMove(sample, 1, first), false);
assert.equal(applyMove(sample, 0, { ...first, code: '0012' }), false);
assert.equal(applyMove(sample, 0, { ...first, revision: -1 }), false);
assert.equal(applyMove(sample, 0, first), true);
assert.equal(sample.turn, 1);
const next = { code: '0123', round: 1, revision: sample.revision };
assert.equal(applyMove(sample, 1, { ...next, code: first.code }), false);
sample.players[1].online = false;
assert.equal(applyMove(sample, 1, next), false);
sample.players[1].online = true;
assert.equal(applyMove(sample, 1, next), true);
assert.equal(sample.winner, 1);
assert.equal(viewForSeat(sample, 0).answer, '0123');
assert.equal(startRound(sample, '5678'), true);
assert.equal(sample.turn, 1);
assert.equal(applyMove(sample, 1, next), false);

function storage() {
  const data = new Map();
  return {
    getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value),
    removeItem: key => data.delete(key)
  };
}
const oldWindow = globalThis.window;
globalThis.window = { localStorage: storage(), sessionStorage: storage() };
try {
  let hostNetwork;
  let guestNetwork;
  let link;
  const hostFactory = handlers => {
    hostNetwork = handlers;
    return {
      host: async () => {},
      sendHost: (target, packet) => {
        if (!target.open) return false;
        const receive = target.receive;
        queueMicrotask(() => { if (target.open) receive(packet); });
        return true;
      },
      close: () => link?.close()
    };
  };
  function attach() {
    link = {
      open: true,
      receive: guestNetwork.onGuestMessage,
      close() {
        if (!this.open) return;
        this.open = false;
        hostNetwork.onConnectionClosed(this);
        guestNetwork.onStatus('reconnecting', '正在重連');
      }
    };
    guestNetwork.onGuestOpen();
  }
  const guestFactory = handlers => {
    guestNetwork = handlers;
    return {
      join: async () => attach(),
      reconnect: attach,
      sendGuest: packet => {
        const target = link;
        if (!target?.open) return false;
        queueMicrotask(() => { if (target.open) hostNetwork.onHostMessage(packet, target); });
        return true;
      },
      confirmJoined: () => {},
      close: () => link?.close()
    };
  };
  const tick = () => new Promise(resolve => setImmediate(resolve));
  const host = new DuelRoom(() => {}, hostFactory);
  const guest = new DuelRoom(() => {}, guestFactory);
  await host.host('猴三毛');
  await guest.join(host.code, '好友');
  await tick();
  assert.equal(guest.ready, true);
  assert.equal(host.view.players[1].name, '好友');
  const intruder = { open: true, close() {}, receive() { throw new Error('席位不應被取代'); } };
  let rejection;
  intruder.receive = packet => { rejection = packet.type; };
  hostNetwork.onHostMessage({ type: 'hello', protocol: 2, token: 'f'.repeat(32) }, intruder);
  await tick();
  assert.equal(rejection, 'reject');
  host.start();
  await tick();
  const answer = host.state.answer;
  const miss = answer.slice(1) + answer[0];
  assert.equal(guest.view.answer, null);
  host.move(miss);
  await tick();
  assert.deepEqual(guest.view.guesses[0], { seat: 0, code: miss, a: 0, b: 4 });
  assert.equal(guest.view.turn, 1);
  guest.move(miss);
  await tick();
  assert.equal(guest.view.guessCount, 1);
  assert.match(guest.message, /已猜過/);
  link.close();
  assert.equal(host.view.players[1].online, false);
  assert.equal(guest.ready, false);
  const reloaded = new DuelRoom(() => {}, hostFactory);
  assert.equal(reloaded.restoreHost(), true);
  await tick();
  guest.reconnect();
  await tick();
  assert.equal(reloaded.view.players[1].online, true);
  assert.equal(guest.view.turn, 1);
  assert.equal(guest.view.guesses.length, 1);
  guest.move(answer);
  await tick();
  assert.equal(guest.view.winner, 1);
  assert.equal(reloaded.view.phase, 'finished');
  assert.equal(reloaded.view.answer, answer);
  guest.leave(false);
  reloaded.leave(false);
} finally {
  if (oldWindow === undefined) delete globalThis.window;
  else globalThis.window = oldWindow;
}
console.log('1A2B duel rules, privacy, two seats, turns and reconnect checks PASS');
