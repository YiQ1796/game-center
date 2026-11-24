import { advance, applyAction, createMatch, ENDLESS_MODE, finishMatch, playMatch, PLAYER_ACTIONS } from './engine.mjs?v=132';
import { isRoomTaunt, isTauntIndex, TAUNT_COOLDOWN } from './banter.mjs?v=130';
import { PeerRoom } from '../one-a-two-b/peer-room.mjs?v=stack-150';

const STORAGE = 'sanmao-blocks-room-v1';
const SNAPSHOT_INTERVAL_MS = 125;
const GUEST_CLOCK_REFRESH_MS = 250;
const ROOM_SAVE_INTERVAL_MS = 1000;
const MAX_PENDING_GUEST_ACTIONS = 96;
const PENDING_GUEST_TIMEOUT_MS = 2500;
const MAX_INPUT_BATCH = 24;
const STALE_SNAPSHOT_MS = 4500;
const ROOM = /^\d{6}$/;
const TOKEN = /^[a-f0-9-]{36}$/;
const nameFor = (value, fallback) => typeof value === 'string' ? value.trim().slice(0, 16) || fallback : fallback;
const freshSeed = () => crypto.getRandomValues(new Uint32Array(1))[0] || 1;
const roomMode = (value) => value === ENDLESS_MODE ? ENDLESS_MODE : 'duel';

export class BattleRoom {
  constructor(onView, onStatus) {
    this.onView = onView;
    this.onStatus = onStatus;
    this.transport = new PeerRoom({
      onHostMessage: (message, source) => this.receiveHost(message, source),
      onGuestMessage: message => this.receiveGuest(message),
      onGuestOpen: () => this.transport.sendGuest({
        type: 'hello', name: this.state.name, token: this.state.token, supportsEndless: true, supportsTaunts: true, supportsPrediction: true, supportsInputBatch: true
      }),
      onConnectionClosed: source => this.disconnectGuest(source),
      onStatus: (state, detail) => {
        if (this.state?.role === 'guest' && state !== 'connected') {
          this.remoteReady = false;
          this.resetGuestPrediction();
        }
        if (this.state?.role === 'host' && this.hostReady) return;
        this.status(detail);
      }
    }, { namespace: 'sanmao-blocks-v1' });
    this.lastUpdate = performance.now();
    this.lastSnapshotSentAt = 0;
    this.snapshotNumber = 0;
    this.lastGuestUiTick = 0;
    this.lastRoomSaveAt = 0;
    this.lastGuestInputSequence = 0;
    this.resetGuestPrediction();
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

  resetGuestPrediction() {
    this.pendingGuestActions = [];
    this.predictedMatch = null;
    this.nextGuestInputSequence = 0;
    this.lastSnapshotNumberSeen = 0;
    this.lastSnapshotAt = 0;
    this.lastGuestAckMs = null;
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

  async enter(role, name, code, mode) {
    if (this.state) return;
    if (role === 'host') code = String(100000 + freshSeed() % 900000);
    if (!ROOM.test(code)) {
      this.status('請輸入六位數房號。');
      return;
    }
    this.state = {
      role, code, token: crypto.randomUUID(), name: nameFor(name, role === 'host' ? '房主' : '好友'),
      mode: roomMode(mode), guest: null, match: null
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
    this.resetGuestPrediction();
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
      if (this.state.mode === ENDLESS_MODE && message.supportsEndless !== true) {
        this.transport.sendHost(source, { type: 'update' });
        return;
      }
      if (this.guest && this.guest !== source) {
        const previous = this.guest;
        this.guest = null;
        previous.close();
      }
      if (this.guest !== source || !this.actionWindow) {
        this.actionWindow = { second: 0, count: 0 };
        this.lastGuestInputSequence = 0;
      }
      this.guest = source;
      this.state.guest = {
        token: message.token, name: nameFor(message.name, '好友'), supportsEndless: message.supportsEndless === true,
        supportsTaunts: message.supportsTaunts === true,
        supportsPrediction: message.supportsPrediction === true,
        supportsInputBatch: message.supportsPrediction === true && message.supportsInputBatch === true
      };
      this.sendView();
      this.status('好友已入座。');
      this.save();
      return;
    }
    if (this.guest !== source) return;
    if (message.type === 'taunt') {
      this.publishTaunt(1, message.index);
      return;
    }

    if (message.type === 'inputs' && this.state.guest?.supportsInputBatch) {
      if (!Array.isArray(message.actions) || message.actions.length < 1 ||
          message.actions.length > MAX_INPUT_BATCH ||
          !Number.isSafeInteger(message.firstSequence) || message.firstSequence < 1 ||
          !message.actions.every(action => typeof action === 'string' &&
            action.length === 1 && PLAYER_ACTIONS.includes(action))) return;
      for (let i = 0; i < message.actions.length; i++) {
        this.acceptGuestAction(message.actions[i], message.firstSequence + i, message.round);
      }
      return;
    }
    if (message.type !== 'input' || typeof message.action !== 'string' ||
        message.action.length !== 1 || !PLAYER_ACTIONS.includes(message.action)) return;
    this.acceptGuestAction(message.action, message.sequence);
  }

  acceptGuestAction(action, sequence, round) {
    if (this.state.guest?.supportsPrediction) {
      const previous = this.lastGuestInputSequence || 0;
      if (!Number.isSafeInteger(sequence) || sequence <= previous ||
          sequence > previous + MAX_PENDING_GUEST_ACTIONS) return;
      // Acknowledge even rate-limited commands: otherwise local prediction persists indefinitely.
      this.lastGuestInputSequence = sequence;
    }
    const second = Math.floor(Date.now() / 1000);
    if (this.actionWindow.second !== second) this.actionWindow = { second, count: 0 };
    // Batches may arrive together after a network stall. Keep a bounded burst allowance.
    const limit = this.state.guest?.supportsInputBatch ? 120 : 60;
    if (++this.actionWindow.count <= limit && (round === undefined || round === this.state.match?.starts)) this.play(1, action);
  }

  receiveGuest(message) {
    if (this.state?.role !== 'guest') return;
    if (message?.type === 'occupied') {
      this.leave('這間房已有兩位玩家。');
      return;
    }
    if (message?.type === 'update') {
      this.leave('請重新整理到最新版，再加入雙人無限。');
      return;
    }
    if (message?.type !== 'state' || !Array.isArray(message.names) || message.names.length !== 2 ||
        !Number.isFinite(message.now)) return;
    if (message.match && (!Array.isArray(message.match.players) || message.match.players.length !== 2)) return;
    if (Number.isSafeInteger(message.snapshotNumber)) {
      if (message.snapshotNumber <= (this.lastSnapshotNumberSeen || 0)) return;
      this.lastSnapshotNumberSeen = message.snapshotNumber;
    }
    this.transport.confirmJoined();
    const newRound = this.remote?.match?.starts !== message.match?.starts;
    this.remote = message;
    this.lastSnapshotAt = Date.now();
    this.state.mode = roomMode(message.mode);
    this.remoteReady = true;
    this.clockOffset = message.now - Date.now();
    if (newRound) {
      this.pendingGuestActions = [];
      this.predictedMatch = null;
    }
    const ack = message.inputAcknowledged;
    if (Number.isSafeInteger(ack) && ack >= 0 && message.match && !message.match.finished) {
      this.nextGuestInputSequence = Math.max(this.nextGuestInputSequence || 0, ack);

      const pending = this.pendingGuestActions || [];
      const confirmed = pending.filter(p => p.sequence <= ack).at(-1);
      if (confirmed) this.lastGuestAckMs = Math.max(0, Date.now() - confirmed.sentAt);
      this.pendingGuestActions = pending.filter(p => p.sequence > ack);
      // Reconcile against authoritative state: replay only unacknowledged inputs.
      this.predictedMatch = this.pendingGuestActions.length ? structuredClone(message.match) : null;
      for (const pending of this.pendingGuestActions) {
        if (this.predictedMatch?.players[1]?.dead) break;
        applyAction(this.predictedMatch.players[1], pending.action);
      }
    } else {
      this.pendingGuestActions = [];
      this.predictedMatch = null;
    }
    this.onStatus('');
    this.emit();
  }

  sendView(urgent = true) {
    if (!this.state || !this.guest) return;
    const now = performance.now();
    if (!urgent && now - (this.lastSnapshotSentAt || 0) < SNAPSHOT_INTERVAL_MS) return;
    const { name, guest, match, mode, taunt } = this.state;
    const snapshotNumber = (this.snapshotNumber || 0) + 1;
    // Freeze the authoritative board and its acknowledgement at the same
    // moment. WSS encryption is async; passing a live match reference can
    // otherwise make the board newer than the acknowledged input sequence.
    const message = {
      type: 'state', mode: roomMode(mode), names: [name, guest?.name ?? ''],
      match: match ? structuredClone(match) : null, taunt,
      supportsTaunts: true, now: Date.now(), snapshotNumber
    };
    if (guest?.supportsPrediction) message.inputAcknowledged = this.lastGuestInputSequence || 0;
    if (guest?.supportsInputBatch) message.supportsInputBatch = true;
    if (this.transport.sendHost(this.guest, message) !== false) {
      this.snapshotNumber = snapshotNumber;
      this.lastSnapshotSentAt = now;
    }
  }

  selectMode(mode) {
    if (this.state?.role !== 'host' || (this.state.match && !this.state.match.finished)) return false;
    const nextMode = roomMode(mode);
    if (nextMode === ENDLESS_MODE && this.guest && !this.state.guest?.supportsEndless) {
      this.status('請好友重新整理到最新版，就能切換到雙人無限。');
      return false;
    }
    this.state.mode = nextMode;
    this.state.match = null;
    this.state.taunt = null;
    this.status('');
    this.save();
    this.sendView();
    return true;
  }

  start() {
    if (this.state?.role !== 'host' || !this.guest ||
        (this.state.match && !this.state.match.finished)) return;
    this.state.match = createMatch(freshSeed(), Date.now(), roomMode(this.state.mode));
    this.state.taunt = null;
    this.status('');
    this.save();
    this.sendView();
  }

  input(action) {
    if (this.state?.role === 'host') { this.play(0, action); return; }
    if (this.state?.role !== 'guest' || !this.remoteReady || !this.remote?.match ||
        this.remote.match.finished || this.remote.match.players[1].dead) return;
    // Fall back to the old protocol when the host has not advertised acknowledgements.
    if (!Number.isSafeInteger(this.remote.inputAcknowledged)) {
      this.transport.sendGuest({ type: 'input', action });
      return;
    }

    this.pendingGuestActions ??= [];
    // Never allow unconfirmed commands to grow indefinitely. A stalled connection
    // is recovered by tick(), not by replaying seconds of obsolete button presses.
    if (this.pendingGuestActions.length >= MAX_PENDING_GUEST_ACTIONS) return;
    const sequence = (this.nextGuestInputSequence || 0) + 1;
    const batch = this.remote.supportsInputBatch === true;
    if (!batch && !this.transport.sendGuest({ type: 'input', action, sequence })) return;
    this.nextGuestInputSequence = sequence;
    this.pendingGuestActions.push({ sequence, action, sentAt: Date.now(), sent: !batch });
    this.predictedMatch ??= structuredClone(this.remote.match);
    if (!this.predictedMatch.players[1].dead) applyAction(this.predictedMatch.players[1], action);
    this.emit();
  }

  flushGuestInputs() {
    if (!this.remoteReady || !this.remote?.supportsInputBatch || !this.remote.match || this.remote.match.finished) return;
    const pending = this.pendingGuestActions || [];
    // One unacknowledged batch at a time: broker ACKs alone do not prove the
    // host has processed inputs. This prevents a second backlog in MQTT/SCTP.
    if (pending.some(item => item.sent)) return;
    const batch = pending.slice(0, MAX_INPUT_BATCH);
    if (!batch.length) return;
    const message = { type: 'inputs', firstSequence: batch[0].sequence,
      round: this.remote.match.starts, actions: batch.map(item => item.action) };
    for (const item of batch) item.sent = true;
    if (!this.transport.sendGuest(message)) for (const item of batch) item.sent = false;
  }

  checkGuestHealth(now = Date.now()) {
    if (!this.remoteReady || !this.remote?.match || this.remote.match.finished) return true;
    const oldest = this.pendingGuestActions?.[0];
    if ((oldest && now - oldest.sentAt > PENDING_GUEST_TIMEOUT_MS) ||
        (this.lastSnapshotAt && now - this.lastSnapshotAt > STALE_SNAPSHOT_MS)) {
      this.remoteReady = false;
      this.resetGuestPrediction();
      this.status('同步延遲過高，正在重新連線；舊操作不再排隊。');
      this.transport.reconnect?.();
      return false;
    }
    return true;
  }

  sendTaunt(index) {
    if (!isTauntIndex(index)) return false;
    if (this.state?.role === 'host') return this.publishTaunt(0, index);
    if (this.state?.role === 'guest' && this.remoteReady && this.remote?.match && this.remote.supportsTaunts === true)
      return this.transport.sendGuest({ type: 'taunt', index });
    return false;
  }

  publishTaunt(seat, index, now = Date.now()) {
    const state = this.state;
    if (!state?.match || !this.guest || !state.guest?.supportsTaunts || !isTauntIndex(index)) return false;
    state.tauntAt ??= [null, null];
    if (state.tauntAt[seat] !== null && now - state.tauntAt[seat] < TAUNT_COOLDOWN) return false;
    state.tauntAt[seat] = now;
    state.taunt = { seat, index, at: now };
    this.sendView();
    this.emit();
    this.save();
    return true;
  }

  play(seat, action) {
    const match = this.state.match;
    if (!match || (!this.guest && match.mode !== ENDLESS_MODE)) return;
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
    const taunt = host ? state.taunt : this.remote?.taunt;
    this.onView({
      host, code: state.code, mode: roomMode(state.mode), ready: host ? this.hostReady : Boolean(this.remoteReady),
      online: host ? Boolean(this.guest) : Boolean(this.remoteReady),
      names: host ? [state.name, state.guest?.name ?? ''] : this.remote?.names ?? ['', state.name],
      match: host ? state.match : this.predictedMatch ?? this.remote?.match,
      taunt: isRoomTaunt(taunt) ? taunt : null,
      supportsTaunts: (host ? state.guest : this.remote)?.supportsTaunts === true,
      network: {
        kind: (host ? this.guest : this.transport.connection)?.transportKind || ((host ? this.guest : this.transport.connection) ? 'P2P' : ''),
        ackMs: host ? null : this.lastGuestAckMs,
        pending: host ? 0 : this.pendingGuestActions?.length || 0
      },
      now: Date.now() + (host ? 0 : this.clockOffset || 0)
    });
  }

  tick() {
    const now = performance.now();
    const elapsed = Math.min(100, now - this.lastUpdate);
    this.lastUpdate = now;
    if (!this.state) return;
    if (this.state.role === 'guest') {
      if (!this.checkGuestHealth()) return;
      this.flushGuestInputs();
      // Network snapshots and local input already draw the board.
      if (this.remote?.match && !this.remote.match.finished &&
          now - (this.lastGuestUiTick || 0) >= GUEST_CLOCK_REFRESH_MS) {
        this.lastGuestUiTick = now;
        this.emit();
      }
      return;
    }
    const match = this.state.match;
    if (!match || match.finished) return;
    const wallTime = Date.now();
    finishMatch(match, wallTime);
    const seats = this.guest ? 2 : match.mode === ENDLESS_MODE ? 1 : 0;
    if (wallTime >= match.starts) {
      for (let seat = 0; seat < seats && !match.finished; seat++) {
        advance(match.players[seat], elapsed, action => playMatch(match, seat, action, wallTime));
      }
    }
    this.emit();
    if (this.guest) this.sendView(match.finished);
    if (match.finished || now - (this.lastRoomSaveAt || 0) >= ROOM_SAVE_INTERVAL_MS) {
      this.lastRoomSaveAt = now;
      this.save();
    }
  }
}
