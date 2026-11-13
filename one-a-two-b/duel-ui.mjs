import { DuelRoom } from './duel-room.mjs?v=6';
import { isCode } from './rules.mjs?v=1';
import { TAUNTS, TAUNT_COOLDOWN, validRoomCode } from './duel-core.mjs?v=6';

const get = id => document.getElementById(id);
const lobby = get('duel-form');
const toggle = get('open-duel');
const roomPanel = get('duel-room');
const roomStatus = get('room-status');
const actionStatus = get('duel-action-status');
const name = get('duel-name');
const codeInput = get('duel-code');
const invite = get('duel-invite');
const seats = get('duel-seats');
const play = get('duel-play');
const moveForm = get('duel-move');
const digits = get('duel-digits');
const moveError = get('duel-move-error');
const historyList = get('duel-guesses');
let inputKey = '';
let seatsKey = '';
let historyKey = '';
let lobbyOpen = false;
let oldCode;
let tauntKey = '';
let tauntTimer;
let tauntCooldownTimer;
let tauntLockedUntil = 0;
let muted = false;

function showLobby(open) {
  lobbyOpen = open;
  lobby.hidden = !open || Boolean(room.role);
  toggle.setAttribute('aria-expanded', String(!room.role && open));
}

function label(tag, className, value) {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = value;
  return element;
}

function renderSeats(view, ready) {
  const players = view?.players ?? [null, null];
  const key = JSON.stringify([players, view?.seat, view?.phase, view?.turn, ready]);
  if (seatsKey === key) return;
  seatsKey = key;
  get('duel-seat-count').textContent = players.filter(player => ready && player?.online).length + '／2 人已入座';
  seats.replaceChildren(...players.map((player, seat) => {
    const item = document.createElement('li');
    item.className = 'duel-seat';
    const online = Boolean(ready && player?.online);
    const turn = online && view?.phase === 'playing' && view.turn === seat && players.every(value => value?.online);
    item.dataset.state = player ? (online ? 'online' : 'offline') : 'open';
    item.dataset.turn = String(turn);
    const seatNumber = label('span', 'seat-number', String(seat + 1));
    seatNumber.setAttribute('aria-label', '座位 ' + (seat + 1));
    const seatBody = document.createElement('div');
    const role = seat === 0 ? '房主' : '好友';
    const you = view?.seat === seat ? '（你）' : '';
    const details = !player ? '空位' : !online ? '離線・保留座位'
      : '已入座・' + role + (turn ? '・猜題中' : '');
    seatBody.append(label('strong', 'seat-name', player ? player.name + you : '等待' + role),
      label('span', 'seat-detail', details));
    item.append(seatNumber, seatBody);
    return item;
  }));
}

function digitsTile(code, compact = false) {
  const row = label('span', compact ? 'duel-code is-compact' : 'duel-code', '');
  row.setAttribute('role', 'img');
  row.setAttribute('aria-label', [...code].join(' '));
  for (const digit of code) {
    const tile = label('span', 'duel-digit', digit);
    tile.setAttribute('aria-hidden', 'true');
    row.append(tile);
  }
  return row;
}

function scoreTile(a, b) {
  const score = label('span', 'duel-score', '');
  for (const [count, letter] of [[a, 'A'], [b, 'B']]) {
    const chip = label('span', 'duel-score-' + letter.toLowerCase(), '');
    chip.append(label('strong', '', String(count)), label('span', '', letter));
    score.append(chip);
  }
  return score;
}

function renderGuesses(view) {
  const { code, round, seat, players, guesses, guessCount } = view;
  get('duel-history').hidden = guessCount === 0;
  get('duel-spotlight').hidden = guessCount === 0;
  get('duel-history-count').textContent = guessCount + ' 次';
  get('duel-history-note').textContent = guessCount > guesses.length ? '顯示最近 ' + guesses.length + ' 次猜測。' : '';
  const key = JSON.stringify([code, round, seat, guessCount, guesses]);
  if (key === historyKey) return;
  historyKey = key;
  const latest = guesses.at(-1);
  if (latest) {
    const who = latest.seat === seat ? '你' : players[latest.seat]?.name ?? '好友';
    get('duel-spotlight-label').textContent = who + ' · 第 ' + guessCount + ' 次猜測';
    get('duel-spotlight-value').replaceChildren(digitsTile(latest.code), scoreTile(latest.a, latest.b));
  }
  historyList.replaceChildren(...[...guesses].reverse().map((guess, index) => {
    const item = label('li', 'duel-guess', '');
    const own = guess.seat === seat;
    item.dataset.owner = own ? 'you' : 'friend';
    const who = own ? '你' : players[guess.seat]?.name ?? '好友';
    item.append(label('span', 'duel-guess-who', '#' + (guessCount - index) + ' · ' + who),
      digitsTile(guess.code, true), scoreTile(guess.a, guess.b));
    return item;
  }));
}

function renderTaunts(state) {
  const view = state.view;
  const bubble = get('duel-taunt');
  const buttons = get('duel-taunt-buttons');
  buttons.hidden = muted;
  const enabled = state.ready && view?.players.every(player => player?.online) &&
    Date.now() >= tauntLockedUntil;
  for (const button of buttons.children) button.disabled = !enabled;
  const taunt = state.taunt;
  if (!taunt || taunt.round !== view?.round || muted) {
    bubble.textContent = '';
    return;
  }
  const key = [view.code, taunt.round, taunt.seat, taunt.serial].join(':');
  if (tauntKey === key) return;
  tauntKey = key;
  const who = taunt.seat === view.seat ? '你' : view.players[taunt.seat]?.name ?? '好友';
  bubble.textContent = who + '：「' + TAUNTS[taunt.id] + '」';
  clearTimeout(tauntTimer);
  tauntTimer = setTimeout(() => { bubble.textContent = ''; }, 6500);
}

function renderPlay(state) {
  const view = state.view;
  play.hidden = !view || view.phase === 'lobby';
  if (play.hidden) return;
  const { phase, players, round, seat, turn, winner } = view;
  const finished = phase === 'finished';
  const bothOnline = state.ready && players.every(player => player?.online);
  const canMove = bothOnline && !finished && turn === seat;
  const nextKey = [view.code, round, phase, view.guessCount].join(':');
  if (nextKey !== inputKey) {
    inputKey = nextKey;
    digits.value = '';
    moveError.textContent = '';
  }
  get('duel-round').textContent = '第 ' + round + ' 局';
  const stage = get('duel-stage');
  stage.dataset.state = finished ? (winner === seat ? 'win' : 'loss') : !bothOnline ? 'paused' : canMove ? 'yours' : 'waiting';
  get('duel-stage-tag').textContent = finished ? '本局結果' : !bothOnline ? '對局暫停' : canMove ? '你的回合' : '好友回合';
  const message = finished
    ? (winner === seat ? '你猜中了，這局你贏了！' : (players[winner]?.name ?? '好友') + ' 先猜中密碼。')
    : !bothOnline ? '等待玩家重新連線。'
    : canMove ? '輪到你猜電腦出的密碼。' : '輪到 ' + players[turn].name + ' 猜題。';
  const turnStatus = get('duel-turn');
  if (turnStatus.textContent !== message) turnStatus.textContent = message;
  moveForm.hidden = !canMove;
  digits.disabled = state.pending;
  get('duel-submit').disabled = state.pending;
  const secret = get('duel-secret');
  secret.hidden = !finished;
  if (finished && secret.dataset.answer !== view.answer) {
    secret.dataset.answer = view.answer;
    secret.replaceChildren(label('strong', '', '正確密碼'), digitsTile(view.answer, true));
  }
  renderGuesses(view);
  renderTaunts(state);
}

function render(state) {
  const view = state.view;
  const active = Boolean(state.role);
  const host = state.role === 'host';
  const canStart = host && view && ['lobby', 'finished'].includes(view.phase);
  if (oldCode !== state.code) {
    oldCode = state.code;
    invite.hidden = true;
    actionStatus.textContent = '';
    inputKey = '';
    tauntKey = '';
    tauntLockedUntil = 0;
    clearTimeout(tauntCooldownTimer);
    clearTimeout(tauntTimer);
    get('duel-taunt').textContent = '';
  }
  toggle.hidden = active;
  showLobby(lobbyOpen);
  roomPanel.hidden = !active;
  get('solo-game').hidden = active;
  roomStatus.dataset.error = String(state.error);
  roomStatus.textContent = state.message || (!active ? '' : !state.ready ? '正在確認房間連線…' :
    view?.phase === 'lobby' ? (view.players.every(player => player?.online)
      ? host ? '兩位玩家都已入座，房主可以開局。' : '已入座，等待房主開局。'
      : '等待好友入座。') : '');
  get('duel-room-code').textContent = state.code ?? '';
  get('duel-start').hidden = !canStart;
  get('duel-start').disabled = !view?.players.every(player => player?.online);
  get('duel-start').textContent = view?.phase === 'finished' ? '再玩一局' : '開始對局';
  get('duel-copy').hidden = !host || !state.ready;
  get('duel-reconnect').hidden = state.role !== 'guest';
  get('duel-release').hidden = !canStart || !view?.players[1] || view.players[1].online;
  renderSeats(view ?? (host ? { players: state.state.players, seat: 0 } : null), state.ready);
  renderPlay(state);
}

const room = new DuelRoom(render);

const tauntButtons = get('duel-taunt-buttons');
tauntButtons.replaceChildren(...TAUNTS.map((line, id) => {
  const button = label('button', 'action-button', line);
  button.type = 'button';
  button.addEventListener('click', () => {
    if (!room.sendTaunt(id)) return;
    tauntLockedUntil = Date.now() + TAUNT_COOLDOWN;
    renderTaunts(room);
    clearTimeout(tauntCooldownTimer);
    tauntCooldownTimer = setTimeout(() => renderTaunts(room), TAUNT_COOLDOWN);
  });
  return button;
}));
get('duel-mute').addEventListener('click', event => {
  muted = !muted;
  if (muted && room.taunt && room.view) {
    const { round, seat, serial } = room.taunt;
    tauntKey = [room.view.code, round, seat, serial].join(':');
  }
  event.currentTarget.setAttribute('aria-pressed', String(muted));
  event.currentTarget.textContent = muted ? '取消靜音' : '靜音';
  renderTaunts(room);
});

function setRoomUrl(code) {
  const url = new URL(location.href);
  if (code) url.searchParams.set('room', code);
  else url.searchParams.delete('room');
  window.history.replaceState(null, '', url);
}

toggle.addEventListener('click', () => showLobby(!lobbyOpen));
get('duel-create').addEventListener('click', () => {
  setRoomUrl(null);
  void room.host(name.value);
});
lobby.addEventListener('submit', event => {
  event.preventDefault();
  const code = codeInput.value.trim();
  if (!validRoomCode(code)) {
    room.update('請輸入 6 位數字房號。', true);
    codeInput.focus();
    return;
  }
  setRoomUrl(code);
  void room.join(code, name.value);
});
get('duel-start').addEventListener('click', () => room.start());
get('duel-reconnect').addEventListener('click', () => room.reconnect());
get('duel-release').addEventListener('click', () => room.releaseSeat());
get('duel-leave').addEventListener('click', () => {
  setRoomUrl(null);
  room.leave();
});
get('duel-copy').addEventListener('click', async () => {
  const url = new URL('./', location.href);
  url.searchParams.set('v', '6');
  url.searchParams.set('room', room.code);
  invite.value = url.href;
  invite.hidden = false;
  try {
    await navigator.clipboard.writeText(url.href);
    actionStatus.textContent = '邀請連結已複製。';
  } catch {
    invite.focus();
    invite.select();
    actionStatus.textContent = '已選取連結，可手動複製。';
  }
});
digits.addEventListener('input', () => { moveError.textContent = ''; });
moveForm.addEventListener('submit', event => {
  event.preventDefault();
  if (!isCode(digits.value)) {
    moveError.textContent = '請輸入四個不同的數字，首位可以是 0。';
    digits.focus();
    return;
  }
  if (room.view.guesses.some(guess => guess.code === digits.value)) {
    moveError.textContent = '這組數字已猜過，請換一組。';
    digits.focus();
    return;
  }
  room.move(digits.value);
});

const incomingRoom = new URL(location.href).searchParams.get('room');
if (validRoomCode(incomingRoom)) {
  codeInput.value = incomingRoom;
  name.value = room.storedGuestName(incomingRoom);
  showLobby(true);
  if (name.value) void room.join(incomingRoom, name.value);
} else {
  room.restoreHost();
}
