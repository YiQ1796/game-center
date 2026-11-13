import assert from 'node:assert/strict';
import { applyMove, newRoom, startRound, viewForSeat } from '../one-a-two-b/duel-core.mjs?v=2';
import { DuelRoom } from '../one-a-two-b/duel-room.mjs?v=2';

const sample = newRoom('012345', '猴三毛');
assert.equal(startRound(sample), false);
sample.players[1] = { name: '好友', online: true };
assert.equal(startRound(sample), true);
assert.equal(applyMove(sample, 0, { type: 'secret', code: '0123', round: 1 }), true);
assert.equal(applyMove(sample, 1, { type: 'secret', code: '0012', round: 1 }), false);
assert.equal(viewForSeat(sample, 1).opponentSecret, null);
assert.equal(applyMove(sample, 1, { type: 'secret', code: '4567', round: 1 }), true);
assert.equal(sample.turn, 0);
const move = { type: 'guess', code: '4567', round: 1, revision: sample.revision };
assert.equal(applyMove(sample, 1, move), false);
assert.equal(applyMove(sample, 0, { ...move, revision: -1 }), false);
sample.players[1].online = false;
assert.equal(applyMove(sample, 0, move), false);
sample.players[1].online = true;
assert.equal(applyMove(sample, 0, move), true);
assert.equal(sample.winner, 0);
assert.equal(viewForSeat(sample, 1).opponentSecret, '0123');
assert.equal(startRound(sample), true);
assert.equal(applyMove(sample, 0, { ...move, type: 'secret' }), false);
assert.equal(applyMove(sample, 0, { type: 'secret', code: '1234', round: 2 }), true);
assert.equal(applyMove(sample, 1, { type: 'secret', code: '5678', round: 2 }), true);
assert.equal(sample.turn, 1);

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
  hostNetwork.onHostMessage({ type: 'hello', protocol: 1, token: 'f'.repeat(32) }, intruder);
  await tick();
  assert.equal(rejection, 'reject');
  host.start();
  host.move('secret', '0123');
  await tick();
  guest.move('secret', '4567');
  await tick();
  assert.equal(guest.view.opponentSecret, null);
  host.move('guess', '9876');
  await tick();
  assert.deepEqual(guest.view.guesses[0], { seat: 0, code: '9876', a: 0, b: 2 });
  assert.equal(guest.view.turn, 1);
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
  guest.move('guess', '0123');
  await tick();
  assert.equal(guest.view.winner, 1);
  assert.equal(reloaded.view.phase, 'finished');
  assert.equal(reloaded.view.opponentSecret, '4567');
  guest.leave(false);
  reloaded.leave(false);
} finally {
  if (oldWindow === undefined) delete globalThis.window;
  else globalThis.window = oldWindow;
}
console.log('1A2B duel rules, privacy, two seats, turns and reconnect checks PASS');
