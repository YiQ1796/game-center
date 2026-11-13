import { PeerRoom } from './peer-room.mjs?v=3';
import { PROTOCOL, applyMove, newRoom, playerName, startRound, validRoomCode, validToken, viewForSeat, isTaunt, TAUNT_COOLDOWN } from './duel-core.mjs?v=6';

const HEARTBEAT_INTERVAL = 5000;
const HOST_TIMEOUT = 16000;
const HOST_STORAGE = 'sanmao-1a2b:host-room-v1';
const guestKey = code => 'sanmao-1a2b:guest-v1:' + code;
const randomToken = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), n => n.toString(16).padStart(2, '0')).join('');
const randomRoom = () => String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0');

function read(storage, key) {
  try { return JSON.parse(window[storage].getItem(key)); } catch { return null; }
}
function save(storage, key, value) {
  try {
    if (value === null) window[storage].removeItem(key);
    else window[storage].setItem(key, JSON.stringify(value));
  } catch { /* A restricted browser can still play until it is closed. */ }
}

export class DuelRoom {
  constructor(onChange, createTransport = handlers => new PeerRoom(handlers)) {
    this.onChange = onChange;
    this.transport = createTransport({
      onStatus: (state, detail) => this.onStatus(state, detail),
      onHostMessage: (message, connection) => this.onHostMessage(message, connection),
      onConnectionClosed: connection => this.onConnectionClosed(connection),
      onGuestOpen: () => this.sendGuest('hello', { name: this.name, token: this.token }),
      onGuestMessage: message => this.onGuestMessage(message)
    });
    this.reset();
  }

  reset() {
    this.role = null;
    this.code = null;
    this.state = null;
    this.view = null;
    this.connection = null;
    this.guestToken = null;
    this.ready = false;
    this.pending = false;
    this.message = '';
    this.error = false;
    this.taunt = null;
    this.tauntSerial = 0;
    this.lastTauntAt = [-Infinity, -Infinity];
    clearTimeout(this.moveTimer);
    clearInterval(this.heartbeat);
    this.heartbeat = null;
  }

  update(message = this.message, error = this.error) {
    this.message = message;
    this.error = error;
    this.onChange(this);
  }

  persist() {
    if (this.role === 'host') save('sessionStorage', HOST_STORAGE, { state: this.state, guestToken: this.guestToken });
  }

  async host(name, saved = null) {
    if (this.role) return;
    this.role = 'host';
    this.state = saved?.state ?? newRoom(randomRoom(), playerName(name, '房主'));
    this.guestToken = saved?.guestToken ?? null;
    if (this.state.players[1]) this.state.players[1].online = false;
    this.code = this.state.code;
    const attempt = this.state;
    this.update('正在建立房間…');
    try {
      await this.transport.host(this.code);
      if (this.state !== attempt) return;
      this.ready = true;
      this.publish('房間已開啟，等待好友入座。');
    } catch (error) {
      if (this.state !== attempt) return;
      this.reset();
      this.update(error.message || '房間建立失敗，請重試。', true);
    }
  }

  restoreHost() {
    const saved = read('sessionStorage', HOST_STORAGE);
    if (saved?.state?.protocol !== PROTOCOL || !validRoomCode(saved?.state?.code) || !Array.isArray(saved.state.players)) return false;
    void this.host('', saved);
    return true;
  }

  async join(code, name) {
    if (this.role || !validRoomCode(code)) return;
    const saved = read('localStorage', guestKey(code));
    this.role = 'guest';
    this.code = code;
    this.token = validToken(saved?.token) ? saved.token : randomToken();
    this.name = playerName(name || saved?.name, '好友');
    this.update('正在連線，等待房主確認座位…');
    try {
      await this.transport.join(code);
    } catch (error) {
      if (this.role !== 'guest' || this.code !== code) return;
      this.leave(false);
      this.update(error.message || '加入失敗，請重試。', true);
    }
  }

  storedGuestName(code) {
    return read('localStorage', guestKey(code))?.name ?? '';
  }

  onStatus(status, detail) {
    if (this.role === 'guest') {
      if (status !== 'connected') {
        this.ready = false;
        this.clearPending();
      }
      this.update(this.ready ? this.message : detail, status === 'error');
    } else if (this.role === 'host' && status !== 'connected' && !this.connection?.open) {
      this.update(detail, status === 'error');
    }
  }

  sendHost(connection, type, payload = {}) {
    return this.transport.sendHost(connection, { protocol: PROTOCOL, type, ...payload });
  }

  sendGuest(type, payload = {}) {
    return this.transport.sendGuest({ protocol: PROTOCOL, type, ...payload });
  }

  publish(message = '') {
    this.view = viewForSeat(this.state, 0);
    this.persist();
    if (this.connection?.open) this.sendHost(this.connection, 'view', { view: viewForSeat(this.state, 1) });
    this.update(message, false);
  }

  onHostMessage(message, connection) {
    if (this.role !== 'host' || message?.protocol !== PROTOCOL) return;
    if (message.type === 'hello') {
      if (!validToken(message.token)) return;
      if (this.guestToken && this.guestToken !== message.token) {
        this.sendHost(connection, 'reject', { text: '這間房的好友座位已有人。' });
        return;
      }
      const previous = this.connection;
      const alreadyOnline = previous === connection && this.state.players[1]?.online;
      this.guestToken = message.token;
      this.connection = connection;
      this.state.players[1] = {
        name: this.state.players[1]?.name ?? playerName(message.name, '好友'), online: true
      };
      if (previous && previous !== connection) previous.close();
      if (!alreadyOnline) this.state.revision += 1;
      this.sendHost(connection, 'welcome', { view: viewForSeat(this.state, 1) });
      this.publish();
      return;
    }
    if (connection !== this.connection) return;
    if (message.type === 'ping') {
      this.sendHost(connection, 'pong');
    } else if (message.type === 'taunt') {
      if (message.round === this.state.round) this.publishTaunt(1, message.id);
    } else if (message.type === 'leave') {
      this.connection = null;
      if (this.state.phase === 'lobby') {
        this.state.players[1] = null;
        this.guestToken = null;
      } else {
        this.state.players[1].online = false;
      }
      this.state.revision += 1;
      connection.close();
      this.publish();
    } else if (message.type === 'move') {
      if (applyMove(this.state, 1, message.move)) this.publish();
      else this.sendHost(connection, 'view', {
        view: viewForSeat(this.state, 1),
        notice: this.rejectionMessage(message.move?.code)
      });
    }
  }

  onConnectionClosed(connection) {
    if (connection !== this.connection || !this.state) return;
    this.connection = null;
    this.state.players[1].online = false;
    this.state.revision += 1;
    this.publish();
  }

  onGuestMessage(message) {
    if (this.role !== 'guest' || message?.protocol !== PROTOCOL) return;
    this.hostLastSeen = Date.now();
    if (message.type === 'reject' || message.type === 'closed') {
      this.leave(false);
      this.update(message.type === 'closed' ? '房主已關閉房間。' : message.text, true);
      return;
    }
    if (message.type === 'taunt') {
      const { id, seat, round, serial } = message;
      if (this.ready && this.view?.round === round && isTaunt(id) && (seat === 0 || seat === 1) &&
          Number.isSafeInteger(serial) && serial > this.tauntSerial) {
        this.tauntSerial = serial;
        this.taunt = { id, seat, round, serial };
        this.onChange(this);
      }
      return;
    }
    const view = message.view;
    if (!['welcome', 'view'].includes(message.type) || view?.code !== this.code || view.seat !== 1 ||
        !Number.isSafeInteger(view.revision) || !Array.isArray(view.players) || !Array.isArray(view.guesses)) return;
    if (message.type === 'welcome') {
      this.tauntSerial = 0;
      this.transport.confirmJoined();
      this.ready = true;
      if (!this.heartbeat) {
        this.heartbeat = setInterval(() => {
          if (!this.ready) return;
          if (Date.now() - this.hostLastSeen >= HOST_TIMEOUT || !this.sendGuest('ping')) this.reconnect();
        }, HEARTBEAT_INTERVAL);
      }
      save('localStorage', guestKey(this.code), { token: this.token, name: this.name });
    } else if (!this.ready || (this.view && view.revision < this.view.revision)) return;
    this.clearPending();
    this.view = view;
    this.update(typeof message.notice === 'string' ? message.notice : '', Boolean(message.notice));
  }

  publishTaunt(seat, id) {
    if (!this.state || !['playing', 'finished'].includes(this.state.phase) ||
        !this.state.players.every(player => player?.online) || !isTaunt(id)) return false;
    const now = Date.now();
    if (now - this.lastTauntAt[seat] < TAUNT_COOLDOWN) return false;
    this.lastTauntAt[seat] = now;
    this.taunt = { id, seat, round: this.state.round, serial: ++this.tauntSerial };
    if (this.connection?.open) this.sendHost(this.connection, 'taunt', this.taunt);
    this.onChange(this);
    return true;
  }

  sendTaunt(id) {
    if (!this.ready || !this.view || !isTaunt(id) ||
        !['playing', 'finished'].includes(this.view.phase) ||
        !this.view.players.every(player => player?.online)) return false;
    return this.role === 'host' ? this.publishTaunt(0, id)
      : this.sendGuest('taunt', { id, round: this.view.round });
  }

  start() {
    if (this.role === 'host' && this.ready && startRound(this.state)) this.publish();
  }

  releaseSeat() {
    if (this.role !== 'host' || !['lobby', 'finished'].includes(this.state.phase) || this.state.players[1]?.online) return;
    this.guestToken = null;
    this.state.players[1] = null;
    this.state.revision += 1;
    this.publish();
  }

  move(code) {
    if (!this.ready || !this.view || this.pending) return;
    const move = { code, round: this.view.round, revision: this.view.revision };
    if (this.role === 'host') {
      if (applyMove(this.state, 0, move)) this.publish();
      else this.update(this.rejectionMessage(code), true);
      return;
    }
    this.pending = this.sendGuest('move', { move });
    if (!this.pending) {
      this.reconnect();
      return;
    }
    this.moveTimer = setTimeout(() => this.reconnect(), 8500);
    this.update('等待房主確認…', false);
  }

  rejectionMessage(code) {
    return this.state.guesses.some(guess => guess.code === code)
      ? '這組數字已猜過，請換一組。' : '這次猜測未送出，請確認回合後再試。';
  }

  clearPending() {
    this.pending = false;
    clearTimeout(this.moveTimer);
  }

  reconnect() {
    if (this.role !== 'guest') return;
    this.ready = false;
    this.clearPending();
    this.update('正在重新連線…', false);
    this.transport.reconnect();
  }

  async leave(notify = true) {
    const role = this.role;
    const sent = notify && (role === 'guest' && this.ready ? this.sendGuest('leave')
      : role === 'host' && this.connection?.open && this.sendHost(this.connection, 'closed'));
    if (role === 'host') save('sessionStorage', HOST_STORAGE, null);
    this.reset();
    if (sent) {
      this.role = 'leaving';
      await new Promise(resolve => setTimeout(resolve, 300));
      this.reset();
    }
    this.transport.close();
    this.update();
  }
}
