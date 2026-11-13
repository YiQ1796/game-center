import { DuelRoom } from './duel-room.mjs?v=4';
import { isCode } from './rules.mjs?v=1';
import { validRoomCode } from './duel-core.mjs?v=3';

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

function renderPlay(state) {
  const view = state.view;
  play.hidden = !view || view.phase === 'lobby';
  if (play.hidden) return;
  const { phase, players, round, seat, turn, winner } = view;
  const playing = phase === 'playing';
  const bothOnline = state.ready && players.every(player => player?.online);
  const canMove = bothOnline && playing && turn === seat;
  const nextKey = [view.code, round, phase, view.guessCount].join(':');
  if (nextKey !== inputKey) {
    inputKey = nextKey;
    digits.value = '';
    moveError.textContent = '';
  }
  get('duel-round').textContent = '第 ' + round + ' 局';
  let message;
  if (phase === 'finished') {
    message = winner === seat ? '你猜中了，這局你贏了！' : players[winner].name + ' 猜中了。';
  } else if (!bothOnline) {
    message = '等待玩家重新連線，對局暫停。';

  } else {
    message = turn === seat ? '輪到你猜電腦出的密碼。' : '輪到 ' + players[turn].name + ' 猜題。';
  }
  get('duel-turn').textContent = message;
  moveForm.hidden = !canMove;
  digits.disabled = state.pending;
  get('duel-submit').disabled = state.pending;
  get('duel-secret').textContent = phase === 'finished'
    ? '電腦出的密碼是 ' + view.answer + '。'
    : '';
  get('duel-history').hidden = view.guessCount === 0;
  get('duel-history-note').textContent = view.guessCount > view.guesses.length ? '顯示最近 ' + view.guesses.length + ' 次猜測。' : '';
  const nextHistoryKey = JSON.stringify([view.code, round, seat, view.guesses]);
  if (historyKey === nextHistoryKey) return;
  historyKey = nextHistoryKey;
  historyList.replaceChildren(...[...view.guesses].reverse().map((guess, index) => {
    const item = document.createElement('li');
    const who = guess.seat === seat ? '你' : players[guess.seat].name;
    item.append(label('span', '', '#' + (view.guessCount - index) + '　' + who + ' 猜 ' + guess.code),
      label('strong', '', guess.a + 'A ' + guess.b + 'B'));
    return item;
  }));
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
  url.searchParams.set('v', '5');
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
