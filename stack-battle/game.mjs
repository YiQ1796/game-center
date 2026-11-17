import { advance, applyAction, cellsOf, createPlayer, ENDLESS_MODE, HEIGHT, HIDDEN, levelOf, MATCH_TIME, PIECES, projected, WIDTH } from './engine.mjs?v=120';
import { LineBurst } from './effects.mjs?v=110';
import { BattleRoom } from './room.mjs?v=120';
import { getRanking, submitScore } from './ranking.mjs?v=110';
import { isNickname, nicknameChoices } from './names.mjs?v=100';

const $ = id => document.getElementById(id);
const numberFormat = new Intl.NumberFormat('zh-TW');
const format = value => numberFormat.format(value ?? 0);
const colors = ['#213a30', '#6cc6ce', '#7198e1', '#eea069', '#efce69', '#87c184', '#b79bd9', '#e9858b', '#68776e', '#c24337'];
const effects = new LineBurst($('effects'), colors);
const inputMap = {
  ArrowLeft: 'l', ArrowRight: 'r', ArrowDown: 'd', ArrowUp: 's',
  KeyX: 's', KeyZ: 'z', KeyC: 'c', Space: 'h'
};
const repeating = 'lrd';
const boards = Object.fromEntries(['board', 'opponent', 'hold', 'next'].map(id => [id, $(id).getContext('2d')]));
const modeButtons = [...document.querySelectorAll('[data-mode]')];
const isMultiplayer = mode => mode === 'duel' || mode === ENDLESS_MODE;
const query = new URLSearchParams(location.search);
const inviteCode = /^\d{6}$/.test(query.get('room')) ? query.get('room') : null;
const requestedMode = query.get('mode');
let mode = isMultiplayer(requestedMode) ? requestedMode : inviteCode ? 'duel' : 'solo';
let solo = null;
let soloSeed = 0;
let actions = [];
let soloStatus = 'idle';
let best = 0;
let view = null;
let overlayAction = null;
let lastEventKey = '';
let eventUntil = 0;
let muted = true;
let audio;
const nicknameFields = [$('room-nickname'), $('score-nickname')];
let savedNickname;
try { savedNickname = localStorage.getItem('sanmao-blocks-nickname-v1'); } catch {}
let nicknames = nicknameChoices(savedNickname && isNickname(savedNickname) ? [savedNickname] : []);
if (isNickname(savedNickname)) nicknames = [savedNickname, ...nicknames.slice(0, 4)];
let ranking = null;
let rankingLoading = false;
const canvasKeys = new Map();
try { best = Math.max(0, Number(localStorage.getItem('sanmao-blocks-best-v1')) || 0); } catch {}

const room = new BattleRoom(value => {
  view = value;
  if (!isMultiplayer(mode)) return;
  if (view && view.mode !== mode) showMode(view.mode);
  else render();
}, message => { $('room-status').textContent = message; });

function setMode(target) {
  const matchInProgress = view?.match && !view.match.finished;
  if (target !== mode && isMultiplayer(mode) && matchInProgress) {
    $('room-status').textContent = '對局仍在進行，要切換模式請先離開房間。';
    return;
  }
  if (isMultiplayer(target) && view && target !== view.mode) {
    if (matchInProgress || !view.host) {
      showMode(view.mode);
      $('room-status').textContent = '目前房間的模式由房主選擇。';
      return;
    }
    if (!room.selectMode(target)) return;
  }
  showMode(target);
}

function showMode(target) {
  if (mode !== target) {
    if (soloStatus === 'playing') soloStatus = 'paused';
    cancelInputs();
    lastEventKey = '';
    eventUntil = 0;
    effects.reset();
  }
  mode = target;
  canvasKeys.clear();
  render();
  if (mode === 'rank' && !ranking) void showRank();
}

function startSolo() {
  soloSeed = crypto.getRandomValues(new Uint32Array(1))[0] || 1;
  solo = createPlayer(soloSeed);
  actions = [];
  soloStatus = 'playing';
  canvasKeys.clear();
  lastEventKey = '';
  eventUntil = 0;
  effects.reset();
  $('submit-status').textContent = '';
  $('submit-score').disabled = false;
  render();
}

function finishSolo() {
  soloStatus = 'done';
  best = Math.max(best, solo.score);
  try { localStorage.setItem('sanmao-blocks-best-v1', String(best)); } catch {}
  cancelInputs();
  render();
}

function soloInput(action) {
  if (!applyAction(solo, action)) return;
  actions.push(action);
  if (solo.dead) finishSolo();
}

function togglePause() {
  if (mode !== 'solo' || !['playing', 'paused'].includes(soloStatus)) return;
  soloStatus = soloStatus === 'paused' ? 'playing' : 'paused';
  cancelInputs();
  render();
}

function tick(now) {
  const elapsed = Math.min(75, now - lastFrame);
  lastFrame = now;
  if (mode === 'solo' && soloStatus === 'playing') {
    advance(solo, elapsed, soloInput);
    renderPlay();
  }
  effects.paint(now);
  if (eventUntil && now >= eventUntil) {
    eventUntil = 0;
    setText('event', '');
    $('combo-display').hidden = true;
  }
  requestAnimationFrame(tick);
}

function paintCell(context, x, y, unit, color, ghost = false) {
  const size = unit - 2;
  const left = x + 1;
  const top = y + 1;
  if (ghost) {
    context.strokeStyle = color;
    context.lineWidth = Math.max(1, unit / 10);
    context.strokeRect(left + 1.5, top + 1.5, size - 3, size - 3);
    return;
  }
  context.fillStyle = color;
  context.fillRect(left, top, size, size);
  context.fillStyle = '#ffffff44';
  context.fillRect(left, top, size, Math.max(1, unit * .12));
  context.fillStyle = '#00000032';
  context.fillRect(left, top + size - Math.max(1, unit * .12), size, Math.max(1, unit * .12));
}

function drawBoard(key, state) {
  const frame = state ? [
    state.revision, state.piece?.type, state.piece?.x, state.piece?.y,
    state.piece?.angle, state.dead, state.board[HIDDEN].join(''),
    state.board.slice(-2).map(row => row.join('')).join('')
  ].join(':') : 'empty';
  if (canvasKeys.get(key) === frame) return;
  canvasKeys.set(key, frame);
  const context = boards[key];
  const unit = context.canvas.width / WIDTH;
  context.fillStyle = colors[0];
  context.fillRect(0, 0, context.canvas.width, context.canvas.height);
  context.strokeStyle = '#ffffff13';
  context.lineWidth = 1;
  context.beginPath();
  for (let col = 1; col < WIDTH; col++) {
    context.moveTo(col * unit + .5, 0);
    context.lineTo(col * unit + .5, HEIGHT * unit);
  }
  for (let row = 1; row < HEIGHT; row++) {
    context.moveTo(0, row * unit + .5);
    context.lineTo(WIDTH * unit, row * unit + .5);
  }
  context.stroke();
  if (!state) return;
  for (let row = 0; row < HEIGHT; row++) {
    for (let col = 0; col < WIDTH; col++) {
      const tile = state.board[row + HIDDEN][col];
      if (tile) paintCell(context, col * unit, row * unit, unit, colors[tile]);
      if (tile === 9) {
        context.fillStyle = '#fff0c9';
        context.beginPath();
        context.arc((col + .5) * unit, (row + .55) * unit, unit * .22, 0, Math.PI * 2);
        context.fill();
        context.strokeStyle = '#fff0c9';
        context.beginPath();
        context.moveTo((col + .5) * unit, (row + .39) * unit);
        context.lineTo((col + .68) * unit, (row + .19) * unit);
        context.stroke();
      }
    }
  }
  if (state.dead) return;
  for (const [piece, ghost] of [[projected(state), true], [state.piece, false]]) {
    const color = colors[PIECES.indexOf(piece.type) + 1];
    for (const [x, y] of cellsOf(piece)) {
      if (y >= HIDDEN) paintCell(context, x * unit, (y - HIDDEN) * unit, unit, color, ghost);
    }
  }
}

function drawPreview(key, type) {
  if (canvasKeys.has(key) && canvasKeys.get(key) === type) return;
  canvasKeys.set(key, type);
  const context = boards[key];
  const { width, height } = context.canvas;
  context.clearRect(0, 0, width, height);
  if (!type) return;
  const cells = cellsOf({ type, x: 0, y: 0, angle: 0 });
  const [xs, ys] = [cells.map(cell => cell[0]), cells.map(cell => cell[1])];
  const unit = 16;
  const xOffset = (width - unit * (Math.max(...xs) - Math.min(...xs) + 1)) / 2 - unit * Math.min(...xs);
  const yOffset = (height - unit * (Math.max(...ys) - Math.min(...ys) + 1)) / 2 - unit * Math.min(...ys);
  for (const [x, y] of cells) {
    paintCell(context, xOffset + x * unit, yOffset + y * unit, unit, colors[PIECES.indexOf(type) + 1]);
  }
}

function showOverlay(title, description, button, action) {
  $('board-overlay').hidden = !title;
  if (!title) return;
  $('overlay-title').textContent = title;
  $('overlay-text').textContent = description;
  $('overlay-action').hidden = !button;
  $('overlay-action').textContent = button ?? '';
  overlayAction = action;
}

const setText = (id, value) => {
  const element = $(id);
  const text = String(value);
  if (element.textContent !== text) element.textContent = text;
};

function showBoardEvent(player, key) {
  const eventKey = key + ':' + (player?.revision ?? 0);
  if (player?.event && lastEventKey !== eventKey) {
    lastEventKey = eventKey;
    const { lines, bombs, spin, perfect, combo, attack, ko, clearPoints, comboBonus } = player.event;
    if (lines || bombs) effects.add(player.event, performance.now());
    if (lines) {
      setText('clear-score', '+' + format(clearPoints));
      setText('combo-caption', combo > 0 ? (combo + 1) + ' 連消 ・ 加成 ' + format(comboBonus) : '消除 ' + lines + ' 行');
      $('combo-display').hidden = false;
    }
    const text = [
      ko ? '被 KO，重新出發！' : '',
      perfect ? '全消！' : spin && lines ? (mode === ENDLESS_MODE ? 'T 旋消除' : 'T 旋突擊') : lines === 4 ? '四行全消！' : lines ? '消除 ' + lines + ' 行' : '',
      combo > 0 && lines ? (combo + 1) + ' COMBO' : '',
      bombs ? '炸掉 ' + bombs + ' 列' : '',
      attack ? '送出 ' + attack + ' 列' : ''
    ].filter(Boolean).join(' ・ ');
    if (text) {
      setText('event', text);
      eventUntil = performance.now() + 1950;
      tone(ko ? 180 : lines ? 335 + lines * 90 : 370);
    }
  }
  if (!eventUntil) {
    setText('event', '');
    $('combo-display').hidden = true;
  }
}

function canPlayRoom() {
  const match = view?.match;
  if (!match || match.finished || view.now < match.starts) return false;
  const player = match.players[view.host ? 0 : 1];
  return !player.dead && (view.online || (view.host && match.mode === ENDLESS_MODE));
}

const scoreAndLines = player => format(player.score) + ' 分 ・ ' + format(player.lines) + ' 行';

function renderRoomPlay(match, player, other, seat) {
  const endless = mode === ENDLESS_MODE;
  const title = endless ? '雙人無限' : '好友 KO 對戰';
  const canRestart = view?.host && view.online;
  if (!endless) {
    const time = match ? Math.min(MATCH_TIME, Math.max(0, match.ends - view.now)) : MATCH_TIME;
    const seconds = Math.ceil(time / 1000);
    setText('timer', String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0'));
    setText('ko', (player?.ko ?? 0) + ' ・ ' + (other?.ko ?? 0));
    setText('sent', format(player?.sent));
    setText('pending', format(player?.incoming.length));
  }
  if (other) {
    setText('friend-name', view.names[1 - seat] || '好友');
    const score = endless ? scoreAndLines(other) : 'KO ' + other.ko + ' ・ 送出 ' + other.sent + ' 列';
    const status = other.dead ? ' ・ 已堆到頂' : !view.online && !match.finished ? ' ・ 離線' : '';
    setText('friend-stat', score + status);
    drawBoard('opponent', other);
  }
  if (!match) {
    showOverlay(title, view ? '好友入座後，由房主開始遊戲。' : '建立房間，或輸入好友的房號。');
  } else if (match.finished && endless) {
    showOverlay('雙人無限結算', '你 ' + scoreAndLines(player) + ' ／ 好友 ' + scoreAndLines(other),
      canRestart ? '再玩一局' : null, () => room.start());
  } else if (match.finished) {
    const result = match.winner === null ? '平手' : match.winner === seat ? '你贏了！' : '好友獲勝';
    showOverlay(result, player.ko + '：' + other.ko + ' KO ・ 送出 ' + player.sent + '：' + other.sent + ' 列',
      canRestart ? '再戰一局' : null, () => room.start());
  } else if (endless && player.dead) {
    const status = view.online ? '好友繼續遊玩中。' : '等候好友重新連線。';
    showOverlay('你已堆到頂', scoreAndLines(player) + '。' + status);
  } else if (!view.online && !(endless && view.host)) {
    const status = endless ? '棋盤已保留，連線後繼續。' : '倒數繼續，重新入座後恢復棋盤。';
    showOverlay('等候重新連線', status);
  } else if (match.starts > view.now) {
    showOverlay(String(Math.ceil((match.starts - view.now) / 1000)), '準備開戰！');
  } else {
    showOverlay('');
  }
}

function renderPlay() {
  const isSolo = mode === 'solo';
  const timedDuel = mode === 'duel';
  const match = view?.match;
  const seat = view?.host ? 0 : 1;
  const player = isSolo ? solo : match?.players[seat];
  const other = !isSolo && match?.players[1 - seat];
  const playing = isSolo ? soloStatus === 'playing' : canPlayRoom();
  const liveRoom = !isSolo && Boolean(match && !match.finished);
  $('controls').hidden = !playing;
  document.body.toggleAttribute('data-playing', playing);
  document.body.toggleAttribute('data-live-duel', liveRoom);
  $('room-quick-actions').hidden = !liveRoom;
  $('mid-duel-reconnect').hidden = !liveRoom || view.host || view.online;
  $('action-bar').hidden = !isSolo || !['playing', 'paused'].includes(soloStatus);
  $('score-stats').hidden = timedDuel;
  $('solo-best').hidden = !isSolo;
  $('duel-stats').hidden = !timedDuel;
  $('friend').hidden = isSolo || !other;
  $('submit-panel').hidden = !(isSolo && soloStatus === 'done' && solo.lines > 0);
  $('board-frame').toggleAttribute('data-alert', timedDuel && Boolean(player?.incoming.length));
  if (!timedDuel) {
    setText('score', format(player?.score));
    setText('lines', format(player?.lines));
    setText('level', player ? levelOf(player) : 1);
  }
  if (isSolo) {
    setText('best', format(best));
    if (soloStatus === 'playing') showOverlay('');
    if (soloStatus === 'idle') showOverlay('單人無限', '一次多消，連擊會再加分。', '開始遊戲', startSolo);
    if (soloStatus === 'paused') showOverlay('已暫停', '準備好再繼續。', '繼續遊戲', togglePause);
    if (soloStatus === 'done') showOverlay('本局結算', format(solo.score) + ' 分 ・ 消除 ' + format(solo.lines) + ' 行', '再玩一局', startSolo);
    setText('pause', soloStatus === 'paused' ? '繼續' : '暫停');
  } else {
    renderRoomPlay(match, player, other, seat);
  }
  if (!playing && held.size) cancelInputs();
  drawBoard('board', player);
  drawPreview('hold', player?.dead ? null : player?.hold);
  drawPreview('next', player?.dead ? null : player?.queue[0]);
  showBoardEvent(player, isSolo ? soloSeed : match?.starts);
}

let lastSeats = '';
function renderRoom() {
  const endless = mode === ENDLESS_MODE;
  setText('room-title', endless ? '雙人無限房' : '好友房');
  $('endless-rules').hidden = !endless;
  $('room-form').hidden = Boolean(view);
  $('room-info').hidden = !view;
  if (!view) {
    lastSeats = '';
    return;
  }
  setText('room-code', view.code);
  const seatKey = JSON.stringify([view.names, view.host, view.online, view.ready]);
  if (seatKey !== lastSeats) {
    lastSeats = seatKey;
    $('room-seats').replaceChildren(...view.names.map((name, index) => {
      const ownSeat = index === (view.host ? 0 : 1);
      const online = Boolean(name && (ownSeat ? view.ready : view.online));
      const seat = document.createElement('li');
      seat.dataset.online = String(online);
      seat.textContent = name ? name + (ownSeat ? '（你）' : online ? '・已入座' : '・離線') : index === 0 ? '等待房主' : '等待好友';
      return seat;
    }));
  }
  $('start-match').hidden = !view.host;
  $('start-match').disabled = !view.online || Boolean(view.match && !view.match.finished);
  const labels = endless ? ['開始遊戲', '再玩一局'] : ['開始對戰', '再戰一局'];
  setText('start-match', labels[view.match?.finished ? 1 : 0]);
  $('invite').disabled = !view.ready;
  $('reconnect').hidden = view.host || view.online;
}

function render() {
  for (const button of modeButtons) button.setAttribute('aria-pressed', String(mode === button.dataset.mode));
  $('room').hidden = !isMultiplayer(mode);
  $('ranking').hidden = mode !== 'rank';
  $('play').hidden = mode === 'rank';
  if (isMultiplayer(mode)) renderRoom();
  if (mode !== 'rank') renderPlay();
  else {
    document.body.removeAttribute('data-playing');
    document.body.removeAttribute('data-live-duel');
  }
}

function tone(frequency) {
  if (muted || !audio || audio.state !== 'running') return;
  const note = audio.createOscillator();
  const gain = audio.createGain();
  note.frequency.value = frequency;
  gain.gain.setValueAtTime(.055, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(.0001, audio.currentTime + .13);
  note.connect(gain).connect(audio.destination);
  note.start();
  note.stop(audio.currentTime + .14);
}

function gameInput(action) {
  if ($('help-dialog').open) return;
  if (mode === 'solo' && soloStatus === 'playing') {
    soloInput(action);
    renderPlay();
  } else if (isMultiplayer(mode) && canPlayRoom()) room.input(action);
}

const held = new Map();
function startInput(key, action) {
  if (held.has(key)) return;
  gameInput(action);
  if (!repeating.includes(action)) return;
  const timer = setTimeout(() => {
    gameInput(action);
    if (held.has(key)) held.set(key, setInterval(() => gameInput(action), action === 'd' ? 45 : 42));
  }, 150);
  held.set(key, timer);
}

function stopInput(key) {
  clearTimeout(held.get(key));
  held.delete(key);
}

function cancelInputs() {
  for (const key of held.keys()) stopInput(key);
}

document.addEventListener('keydown', event => {
  if (event.target.closest('input, textarea, select, [contenteditable]') || $('help-dialog').open ||
      event.metaKey || event.altKey || event.ctrlKey) return;
  if (event.code === 'Escape') return togglePause();
  const action = inputMap[event.code];
  const active = mode === 'solo' ? soloStatus === 'playing' : isMultiplayer(mode) && canPlayRoom();
  if (!action || !active || (event.code === 'Space' && event.target.closest('button, a') && event.target.matches(':focus-visible'))) return;
  event.preventDefault();
  if (!event.repeat) startInput(event.code, action);
});
document.addEventListener('keyup', event => stopInput(event.code));
window.addEventListener('blur', cancelInputs);
document.addEventListener('visibilitychange', () => {
  if (document.hidden && mode === 'solo' && soloStatus === 'playing') togglePause();
});
for (const button of document.querySelectorAll('[data-action]')) {
  const action = button.dataset.action;
  button.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    startInput(event.pointerId, action);
  });
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture'])
    button.addEventListener(name, event => stopInput(event.pointerId));
  button.addEventListener('click', event => { if (event.detail === 0) gameInput(action); });
}

async function copy(value, field) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    field.hidden = false;
    field.value = value;
    field.select();
    return false;
  }
}

async function showRank() {
  if (rankingLoading) return;
  rankingLoading = true;
  $('rank-refresh').disabled = true;
  setText('rank-status', '正在讀取公開成績…');
  try {
    ranking = await getRanking();
    const top = ranking[0];
    $('rank-table').hidden = !top;
    $('champion').hidden = !top;
    setText('rank-status', top ? '顯示前 ' + ranking.length + ' 名' : '目前還沒有公開成績。');
    if (!top) return;
    setText('champion-name', top.name);
    setText('champion-score', format(top.score) + ' 分');
    $('rank-rows').replaceChildren(...ranking.map((entry, i) => {
      const row = document.createElement('tr');
      for (const value of [i + 1, entry.name, format(entry.score), format(entry.lines)]) {
        const cell = document.createElement('td');
        cell.textContent = value;
        row.append(cell);
      }
      return row;
    }));
  } catch (error) {
    setText('rank-status', error.message + (ranking ? ' 目前顯示上次榜單。' : ' 請稍後重試。'));
  } finally {
    $('rank-refresh').disabled = false;
    rankingLoading = false;
  }
}

for (const button of modeButtons) button.addEventListener('click', () => setMode(button.dataset.mode));
$('overlay-action').addEventListener('click', () => {
  overlayAction?.();
  $('board').focus({ preventScroll: true });
  if (matchMedia('(max-width: 700px)').matches) window.scrollTo(0, 0);
});
$('board').tabIndex = -1;
$('help').addEventListener('click', () => {
  if (mode === 'solo' && soloStatus === 'playing') togglePause();
  $('help-dialog').showModal();
});
$('sound').addEventListener('click', async () => {
  muted = !muted;
  if (!muted) {
    try {
      audio ??= new (window.AudioContext ?? window.webkitAudioContext)();
      await audio.resume();
      tone(480);
    } catch { muted = true; }
  }
  $('sound').setAttribute('aria-pressed', String(!muted));
  setText('sound', muted ? '音效關' : '音效開');
});

$('pause').addEventListener('click', togglePause);
$('end').addEventListener('click', finishSolo);
$('create-room').addEventListener('click', () => room.enter('host', $('room-nickname').value, null, mode));
$('room-form').addEventListener('submit', event => {
  event.preventDefault();
  void room.enter('guest', $('room-nickname').value, $('code').value.trim(), mode);
});
$('start-match').addEventListener('click', () => {
  room.start();
  $('board').focus({ preventScroll: true });
  if (matchMedia('(max-width: 700px)').matches) window.scrollTo(0, 0);
});
$('mid-duel-leave').addEventListener('click', () => $('leave').click());
$('leave').addEventListener('click', () => {
  room.leave('已離開房間。');
  $('invite-link').hidden = true;
});
$('reconnect').addEventListener('click', () => room.transport.reconnect());
$('mid-duel-reconnect').addEventListener('click', () => room.transport.reconnect());
$('invite').addEventListener('click', async () => {
  const url = new URL(location.href);
  url.search = '';
  url.searchParams.set('room', view.code);
  if (view.mode === ENDLESS_MODE) url.searchParams.set('mode', ENDLESS_MODE);
  $('room-status').textContent = await copy(url.href, $('invite-link')) ? '已複製邀請連結。' : '請複製上方邀請連結。';
});
$('rank-refresh').addEventListener('click', showRank);
function selectNickname(name) {
  for (const field of nicknameFields) field.value = name;
  try { localStorage.setItem('sanmao-blocks-nickname-v1', name); } catch {}
}

function renderNicknames() {
  for (const field of nicknameFields)
    field.replaceChildren(...nicknames.map(name => new Option(name, name)));
  selectNickname(nicknames[0]);
}

for (const field of nicknameFields)
  field.addEventListener('change', () => selectNickname(field.value));
for (const button of document.querySelectorAll('[data-reroll]')) {
  button.addEventListener('click', () => {
    nicknames = nicknameChoices(nicknames);
    renderNicknames();
  });
}
renderNicknames();

$('submit-score').addEventListener('click', async () => {
  const finishedGame = solo;
  $('submit-score').disabled = true;
  try {
    setText('submit-status', '正在送出…');
    const result = await submitScore($('score-nickname').value, soloSeed, actions);
    ranking = null;
    if (solo !== finishedGame) return;
    const message = result.saved ? '已上榜！目前第 ' + result.rank + ' 名。' : result.reason === 'outside' ? '這局未進入歷史榜前 100 名。' : '這局已登錄過，或低於已上傳的最佳成績。';
    setText('submit-status', message);
  } catch (error) {
    if (solo !== finishedGame) return;
    setText('submit-status', error.message || '送出失敗，請稍後再試。');
    $('submit-score').disabled = false;
  }
});

if (isMultiplayer(mode)) $('code').value = inviteCode ?? '';
render();
void room.restore(inviteCode).then(restored => { if (restored) showMode(view.mode); });
let lastFrame = performance.now();
requestAnimationFrame(tick);
