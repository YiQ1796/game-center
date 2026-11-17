import { advance, createMatch, finishMatch, playMatch, PLAYER_ACTIONS } from './engine.mjs?v=100';
import { PeerRoom } from '../one-a-two-b/peer-room.mjs?v=stack-100';

const STORAGE = 'sanmao-blocks-room-v1';
const ROOM = /^\d{6}$/;
const TOKEN = /^[a-f0-9-]{36}$/;
const nameFor = (value, fallback) => typeof value === 'string' ? value.trim().slice(0, 16) || fallback : fallback;
const freshSeed = () => crypto.getRandomValues(new Uint32Array(1))[0] || 1;

export class BattleRoom {
  constructor(onView, onStatus) {
    this.onView = onView;
    this.onStatus = onStatus;
    this.transport = new PeerRoom({
      onHostMessage: (message, source) => this.receiveHost(message, source),
      onGuestMessage: message => this.receiveGuest(message),
      onGuestOpen: () => this.transport.sendGuest({ type: 'hello', name: this.state.name, token: this.state.token }),
      onConnectionClosed: source => this.disconnectGuest(source),
      onStatus: (state, detail) => {
        if (this.state?.role === 'guest' && state !== 'connected') {
          this.remoteReady = false;
        }
        if (this.state?.role === 'host' && this.hostReady) return;
        this.status(detail);
      }
    }, { namespace: 'sanmao-blocks-v1' });
    this.lastUpdate = performance.now();
    this.interval = setInterval(() => this.tick(), 65);
    window.addEventListener('pagehide', () => {
      this.save();
      this.transport.close();
    });
    window.addEventListener('pageshow', event => {
      if (event.persisted && this.state) {
        this.transport.close();
        void this.open();
      }
    });
  }

  status(detail) {
    this.onStatus(detail);
    this.emit();
  }

  save() {
    try {
      if (this.state) sessionStorage.setItem(STORAGE, JSON.stringify(this.state));
      else sessionStorage.removeItem(STORAGE);
    } catch {}
  }

  async restore(invitedCode) {
    let saved;
    try { saved = JSON.parse(sessionStorage.getItem(STORAGE)); } catch {}
    if (!saved || !ROOM.test(saved.code) || !['guest', 'host'].includes(saved.role)) return false;
    if (invitedCode && invitedCode !== saved.code) return false;
    this.state = saved;
    await this.open();
    return Boolean(this.state);
  }

  async enter(role, name, code) {
    if (this.state) return;
    if (role === 'host') code = String(100000 + freshSeed() % 900000);
    if (!ROOM.test(code)) {
      this.status('請輸入六位數房號。');
      return;
    }
    this.state = {
      role, code, token: crypto.randomUUID(), name: nameFor(name, role === 'host' ? '房主' : '好友'),
      guest: null, match: null
    };
    this.save();
    await this.open();
  }

  async open() {
    const current = this.state;
    this.hostReady = false;
    this.remoteReady = false;
    this.status(current.role === 'host' ? '正在建立好友房…' : '正在尋找房主…');
    try {
      if (current.role === 'host') await this.transport.host(current.code);
      else await this.transport.join(current.code);
      if (this.state !== current) return;
      if (current.role === 'host') {
        this.hostReady = true;
        this.status('房間已開啟。複製邀請連結給好友。');
      }
    } catch (error) {
      if (this.state !== current) return;
      this.leave(error.message || '暫時無法建立房間，請再試一次。');
    }
  }

  leave(detail = '') {
    this.transport.close();
    this.state = this.guest = this.remote = null;
    this.clockOffset = 0;
    this.remoteReady = false;
    this.save();
    this.status(detail);
  }

  disconnectGuest(source) {
    if (this.guest !== source) return;
    this.guest = null;
    this.status('好友離線，座位保留。');
  }

  receiveHost(message, source) {
    if (this.state?.role !== 'host' || !message || typeof message !== 'object') return;
    if (message.type === 'hello' && TOKEN.test(message.token)) {
      const reserved = this.state.guest;
      if (reserved && reserved.token !== message.token) {
        this.transport.sendHost(source, { type: 'occupied' });
        return;
      }
      if (this.guest && this.guest !== source) {
        const previous = this.guest;
        this.guest = null;
        previous.close();
      }
      this.guest = source;
      this.actionWindow = { second: 0, count: 0 };
      this.state.guest = { token: message.token, name: nameFor(message.name, '好友') };
      this.sendView();
      this.status('好友已入座。');
      this.save();
      return;
    }
    if (this.guest !== source || message.type !== 'input' || typeof message.action !== 'string' ||
        message.action.length !== 1 || !PLAYER_ACTIONS.includes(message.action)) return;
    const second = Math.floor(Date.now() / 1000);
    if (this.actionWindow.second !== second) this.actionWindow = { second, count: 0 };
    if (++this.actionWindow.count <= 60) this.play(1, message.action);
  }

  receiveGuest(message) {
    if (this.state?.role !== 'guest') return;
    if (message?.type === 'occupied') {
      this.leave('這間房已有兩位玩家。');
      return;
    }
    if (message?.type !== 'state' || !Array.isArray(message.names) || message.names.length !== 2 ||
        !Number.isFinite(message.now)) return;
    if (message.match && !Array.isArray(message.match.players)) return;
    this.transport.confirmJoined();
    this.remote = message;
    this.remoteReady = true;
    this.clockOffset = message.now - Date.now();
    this.onStatus('');
    this.emit();
  }

  sendView() {
    const { name, guest, match } = this.state;
    this.transport.sendHost(this.guest, { type: 'state', names: [name, guest?.name ?? ''], match, now: Date.now() });
  }

  start() {
    if (this.state?.role !== 'host' || !this.guest ||
        (this.state.match && !this.state.match.finished)) return;
    this.state.match = createMatch(freshSeed(), Date.now());
    this.status('');
    this.save();
    this.sendView();
  }

  input(action) {
    if (this.state?.role === 'host') this.play(0, action);
    else if (this.state?.role === 'guest' && this.remoteReady && this.remote?.match && !this.remote.match.finished)
      this.transport.sendGuest({ type: 'input', action });
  }

  play(seat, action) {
    const match = this.state.match;
    if (!match || !this.guest) return;
    const wasFinished = match.finished;
    const accepted = playMatch(match, seat, action, Date.now());
    if (accepted || (!wasFinished && match.finished)) this.emit();
    if (!wasFinished && match.finished) {
      this.sendView();
      this.save();
    }
  }

  emit() {
    const state = this.state;
    if (!state) return this.onView(null);
    const host = state.role === 'host';
    this.onView({
      host, code: state.code, ready: host ? this.hostReady : Boolean(this.remoteReady),
      online: host ? Boolean(this.guest) : Boolean(this.remoteReady),
      names: host ? [state.name, state.guest?.name ?? ''] : this.remote?.names ?? ['', state.name],
      match: host ? state.match : this.remote?.match, now: Date.now() + (host ? 0 : this.clockOffset || 0)
    });
  }

  tick() {
    const now = performance.now();
    const elapsed = Math.min(100, now - this.lastUpdate);
    this.lastUpdate = now;
    if (!this.state) return;
    if (this.state.role === 'guest') {
      if (this.remote?.match && !this.remote.match.finished) this.emit();
      return;
    }
    const match = this.state.match;
    if (!match || match.finished) return;
    const wallTime = Date.now();
    finishMatch(match, wallTime);
    if (!match.finished && this.guest && wallTime >= match.starts) {
      for (const seat of [0, 1]) {
        if (match.finished) break;
        advance(match.players[seat], elapsed, action => playMatch(match, seat, action, wallTime));
      }
    }
    this.emit();
    if (this.guest) this.sendView();
    this.save();
  }
}
