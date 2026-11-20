import { advance, applyAction, cellsOf, createPlayer, ENDLESS_MODE, HEIGHT, HIDDEN, levelOf, MATCH_TIME, PIECES, projected, WIDTH } from './engine.mjs?v=132';
import { eventBanter, FRIEND_TAUNTS, MONKEY_LINES, TAUNT_COOLDOWN, TAUNT_DURATION } from './banter.mjs?v=130';
import { LineBurst } from './effects.mjs?v=110';
import { BattleRoom } from './room.mjs?v=140';
import { getRanking, submitScore } from './ranking.mjs?v=131';
import { isNickname, nicknameChoices } from './names.mjs?v=100';

const $ = id => document.getElementById(id);
const numberFormat = new Intl.NumberFormat('zh-TW');
const format = value => numberFormat.format(value ?? 0);
const colors = ['#242a34', '#59c6bc', '#84a8e7', '#f0a26e', '#f6ce66', '#91c66f', '#bc9ce7', '#eb7b8f', '#7a7f88', '#e66355'];
const effects = new LineBurst($('effects'), colors);
const inputMap = {
  ArrowLeft: 'l', ArrowRight: 'r', ArrowDown: 'd', ArrowUp: 's',
  KeyX: 's', Space: 'h'
};
const repeating = 'lrd';
const boards = Object.fromEntries(['board', 'opponent', 'next'].map(id => [id, $(id).getContext('2d')]));
const boardBackdrops = Object.fromEntries(['board', 'opponent'].map(id => {
  const context = boards[id];
  const gradient = context.createLinearGradient(0, 0, context.canvas.width, context.canvas.height);
  gradient.addColorStop(0, '#333644');
  gradient.addColorStop(.6, colors[0]);
  gradient.addColorStop(1, '#272430');
  return [id, gradient];
}));
const tileImages = new Map();
const modeButtons = [...document.querySelectorAll('[data-mode]')];
const isMultiplayer = mode => mode === 'duel' || mode === ENDLESS_MODE;
const query = new URLSearchParams(location.search);
const inviteCode = /^\d{6}$/.test(query.get('room')) ? query.get('room') : null;
const requestedMode = query.get('mode');
let mode = requestedMode === 'rank' ? 'rank' : isMultiplayer(requestedMode) ? requestedMode : inviteCode ? 'duel' : 'solo';
let solo = null;
let soloSeed = 0;
let actions = [];
let soloStatus = 'idle';
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
const uploadingScores = new WeakSet();
const canvasKeys = new Map();
const chatter = {
  phase: '', line: '', choices: new Map(), reaction: '', reactionUntil: 0, highStack: false,
  peerKey: '', peerUntil: 0, sendAt: 0, nextPreset: Math.floor(Math.random() * FRIEND_TAUNTS.length)
};
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

const room = new BattleRoom(value => {
  view = value;
  if (!view) chatter.sendAt = 0;
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
  if (mode === 'rank') void showRank();
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
  cancelInputs();
  render();
  void uploadSoloScore(solo);
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
  if (mode !== 'rank') renderTalk(now);
  requestAnimationFrame(tick);
}

function tilePath(context, x, y, width, height, radius) {
  context.beginPath();
  if (typeof context.roundRect === 'function') context.roundRect(x, y, width, height, radius);
  else context.rect(x, y, width, height);
}

function tileImage(unit, color) {
  const key = unit + ':' + color;
  if (tileImages.has(key)) return tileImages.get(key);
  const tile = document.createElement('canvas');
  tile.width = tile.height = Math.ceil(unit);
  const ctx = tile.getContext('2d');
  const radius = unit * .17;
  tilePath(ctx, 1, 2.4, unit - 2, unit - 3, radius);
  ctx.fillStyle = '#14101e9e';
  ctx.fill();
  tilePath(ctx, 1, 1, unit - 2, unit - 3.5, radius);
  ctx.fillStyle = color;
  ctx.fill();
  const glaze = ctx.createLinearGradient(0, 0, unit * .38, unit);
  glaze.addColorStop(0, '#fff9dfb2');
  glaze.addColorStop(.47, '#fff9df00');
  glaze.addColorStop(1, '#4d223371');
  ctx.fillStyle = glaze;
  ctx.fill();
  ctx.strokeStyle = '#fff9e266';
  ctx.lineWidth = 1;
  ctx.stroke();
  tileImages.set(key, tile);
  return tile;
}

function paintCell(context, x, y, unit, color, ghost = false) {
  if (ghost) {
    context.save();
    context.globalAlpha = .8;
    context.strokeStyle = color;
    context.lineWidth = Math.max(1, unit / 15);
    tilePath(context, x + 3, y + 3, unit - 6, unit - 6, unit * .13);
    context.stroke();
    context.restore();
    return;
  }
  context.drawImage(tileImage(unit, color), x, y);
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
  context.fillStyle = boardBackdrops[key];
  context.fillRect(0, 0, context.canvas.width, context.canvas.height);
  context.strokeStyle = '#fff2d317';
  context.setLineDash([1, 3]);
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
  context.setLineDash([]);
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

function chooseLine(situation) {
  const lines = MONKEY_LINES[situation];
  const last = chatter.choices.get(situation);
  const index = last === undefined ? Math.floor(Math.random() * lines.length) : (last + 1) % lines.length;
  chatter.choices.set(situation, index);
  return lines[index];
}

function syncTalkPhase(match, player, seat) {
  let situation = 'playing';
  if (mode === 'solo') {
    if (soloStatus === 'done') situation = player.dead ? 'topout' : 'soloEnd';
    else if (soloStatus === 'idle') situation = 'intro';
    else if (soloStatus === 'paused') situation = 'paused';
  } else if (!match) {
    situation = 'lobby';
  } else if (match.finished) {
    if (mode === ENDLESS_MODE) situation = 'settled';
    else situation = match.winner === null ? 'tie' : match.winner === seat ? 'win' : 'loss';
  } else if (player.dead) {
    situation = 'topout';
  }
  const round = mode === 'solo' ? soloSeed : match?.starts ?? view?.code ?? '-';
  const phase = mode + ':' + round + ':' + situation;
  if (chatter.phase === phase) return;
  chatter.phase = phase;
  chatter.line = chooseLine(situation);
  chatter.reactionUntil = 0;
  chatter.highStack = false;
}

function renderTalk(now) {
  const connected = isMultiplayer(mode) && view?.online && view.supportsTaunts;
  const taunt = connected ? view.taunt : null;
  const peerKey = taunt ? view.code + ':' + taunt.seat + ':' + taunt.at : '';
  if (peerKey && peerKey !== chatter.peerKey) {
    chatter.peerKey = peerKey;
    chatter.peerUntil = now + Math.max(0, TAUNT_DURATION - Math.max(0, view.now - taunt.at));
  }
  const peerTalking = peerKey && now < chatter.peerUntil;
  const reacting = now < chatter.reactionUntil;
  const speaker = peerTalking ? (taunt.seat === (view.host ? 0 : 1) ? '你' : view.names[taunt.seat] || '好友') : '猴三毛';
  const line = peerTalking ? FRIEND_TAUNTS[taunt.index] : reacting ? chatter.reaction : chatter.line;
  const tone = peerTalking ? 'player' : reacting ? 'reaction' : 'monkey';
  const talk = $('talk');
  if (talk.dataset.tone !== tone) talk.dataset.tone = tone;
  setText('talk-speaker', speaker);
  if ($('talk-line').textContent !== line) {
    setText('talk-line', line);
    if (!reduceMotion.matches && tone !== 'monkey')
      $('talk-line').animate([{ opacity: .55, transform: 'translateY(3px)' }, { opacity: 1, transform: 'none' }], { duration: 180 });
  }
  const button = $('taunt');
  const showButton = Boolean(connected && view.match);
  if (button.hidden === showButton) button.hidden = !showButton;
  if (!showButton) return;
  const seconds = Math.max(0, Math.ceil((chatter.sendAt - now) / 1000));
  if (button.disabled !== (seconds > 0)) button.disabled = seconds > 0;
  setText('taunt', seconds ? seconds + ' 秒' : '放話');
}

function showBoardEvent(player, key, playing) {
  const eventKey = key + ':' + (player?.revision ?? 0);
  if (player?.event && lastEventKey !== eventKey) {
    lastEventKey = eventKey;
    const { lines, bombs, spin, perfect, combo, attack, ko, clearPoints, comboBonus } = player.event;
    if (playing) {
      const highStack = player.board.slice(HIDDEN, HIDDEN + 4).some(row => row.some(Boolean));
      const situation = eventBanter(player.event, highStack && !chatter.highStack);
      chatter.highStack = highStack;
      if (situation) {
        chatter.reaction = chooseLine(situation);
        chatter.reactionUntil = performance.now() + 3300;
      }
    }
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
  $('public-best').hidden = !isSolo;
  $('duel-stats').hidden = !timedDuel;
  $('friend').hidden = isSolo || !other;
  $('submit-panel').hidden = !(isSolo && soloStatus === 'done');
  $('board-frame').toggleAttribute('data-alert', timedDuel && Boolean(player?.incoming.length));
  if (!timedDuel) {
    setText('score', format(player?.score));
    setText('lines', format(player?.lines));
    setText('level', player ? levelOf(player) : 1);
  }
  if (isSolo) {
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
  drawPreview('next', player?.dead ? null : player?.queue[0]);
  syncTalkPhase(match, player, seat);
  showBoardEvent(player, isSolo ? soloSeed : match?.starts, playing);
  renderTalk(performance.now());
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
/*
 * Safari may omit pointerdown during rapid/multi-touch play and can throw from
 * setPointerCapture on a cancelled pointer. Trigger the action before capture,
 * fall back to touchstart and click, and suppress duplicates from the same tap.
 * Rotation and hard-drop remain single-press actions; l/r/d still auto-repeat.
 */
for (const button of document.querySelectorAll('[data-action]')) {
  const action = button.dataset.action;
  let pointerStartedAt = -Infinity;
  let touchStartedAt = -Infinity;
  let physicalGestureEndedAt = -Infinity;
  const startPress = key => startInput(key, action);
  const endTouch = event => {
    physicalGestureEndedAt = performance.now();
    for (const touch of event.changedTouches) stopInput('touch:' + touch.identifier);
  };

  button.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    clearGameplaySelection();
    const now = performance.now();
    const wasHandledByTouch = event.pointerType === 'touch' && now - touchStartedAt < 85;
    pointerStartedAt = now;
    // Capture is optional: input must never depend on setPointerCapture succeeding.
    if (!wasHandledByTouch) startPress('pointer:' + event.pointerId);
    try { button.setPointerCapture(event.pointerId); } catch { /* iOS cancelled pointer */ }
  });
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture'])
    button.addEventListener(name, event => {
      physicalGestureEndedAt = performance.now();
      stopInput('pointer:' + event.pointerId);
    });

  button.addEventListener('touchstart', event => {
    const now = performance.now();
    touchStartedAt = now;
    // On some WebKit touches, no pointerdown follows: do not drop the press.
    if (now - pointerStartedAt > 85) {
      for (const touch of event.changedTouches) startPress('touch:' + touch.identifier);
    }
  }, { passive: true });
  button.addEventListener('touchend', endTouch, { passive: true });
  button.addEventListener('touchcancel', endTouch, { passive: true });
  button.addEventListener('click', event => {
    if (event.detail === 0) {
      gameInput(action); // Keyboard / accessibility activation.
    } else if (performance.now() - Math.max(pointerStartedAt, touchStartedAt, physicalGestureEndedAt) > 350) {
      gameInput(action); // Browser synthesized click with missing touch/pointer events.
    }
  });
}
// Safari may select text in the monkey dialogue just above the control pad.
// Suppress selection only while a game is actively being played; keep normal
// text selection in leaderboard, instructions, and editable fields.
const gameplayIsActive = () =>
  document.body.hasAttribute('data-playing') || document.body.hasAttribute('data-live-duel');

function clearGameplaySelection() {
  if (!gameplayIsActive() || $('help-dialog').open) return;
  const selection = window.getSelection();
  if (selection?.rangeCount) selection.removeAllRanges();
}

const gameplaySurface = eventTarget =>
  eventTarget instanceof Node &&
  ($('play').contains(eventTarget) || document.querySelector('.top').contains(eventTarget));

for (const eventName of ['selectstart', 'contextmenu']) {
  document.addEventListener(eventName, event => {
    if (!gameplayIsActive() || $('help-dialog').open ||
        !gameplaySurface(event.target)) return;
    if (event.target instanceof Element &&
        event.target.closest('input, textarea, select, [contenteditable]')) return;
    event.preventDefault();
    clearGameplaySelection();
  });
}
document.addEventListener('selectionchange', () => {
  if (!gameplayIsActive() || $('help-dialog').open) return;
  const selection = window.getSelection();
  if (selection?.rangeCount && gameplaySurface(selection.anchorNode))
    selection.removeAllRanges();
});

// WebKit may still synthesize a long-press callout during rapid repeated taps.
$('controls').addEventListener('touchstart', event => {
  if (event.target instanceof Element &&
      event.target.closest('button[data-action]') && event.cancelable)
    event.preventDefault();
  clearGameplaySelection();
}, { passive: false });
window.addEventListener('pointerup', event => stopInput(event.pointerId));
window.addEventListener('pointercancel', event => stopInput(event.pointerId));

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
    setText('public-best-score', top ? format(top.score) : '尚無紀錄');
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
    if (!ranking) setText('public-best-score', '讀取失敗');
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
$('taunt').addEventListener('click', () => {
  const now = performance.now();
  if (now < chatter.sendAt || !room.sendTaunt(chatter.nextPreset)) return;
  chatter.nextPreset = (chatter.nextPreset + 1) % FRIEND_TAUNTS.length;
  chatter.sendAt = now + TAUNT_COOLDOWN;
  renderTalk(now);
  $('board').focus({ preventScroll: true });
});
$('rank-refresh').addEventListener('click', showRank);
$('open-public-rank').addEventListener('click', () => showMode('rank'));
$('rank-share').addEventListener('click', async () => {
  // Share the same globally stored leaderboard, never a device-specific result.
  const url = new URL(location.pathname, location.origin);
  url.searchParams.set('mode', 'rank');
  const shared = await copy(url.href, $('ranking-link'));
  setText('rank-share-status', shared ? '已複製公開排行榜網址，可以傳給朋友！' : '請複製下方的排行榜網址傳給朋友。');
});
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

// Score history stays server-backed; one finished solo round is submitted once at a time.
async function uploadSoloScore(finishedGame = solo) {
  if (solo !== finishedGame || soloStatus !== 'done' || uploadingScores.has(finishedGame)) return;
  if (finishedGame.lines < 1) {
    setText('submit-status', '這局沒有消除行數；至少消除一行才能登上公開歷史榜。');
    $('submit-score').disabled = true;
    return;
  }

  uploadingScores.add(finishedGame);
  $('submit-score').disabled = true;
  setText('submit-status', '正在自動登錄公開排行榜…');
  // Snapshot the replay so a new round cannot change the record being uploaded.
  const replaySeed = soloSeed;
  const replayActions = [...actions];
  const nickname = $('score-nickname').value;
  try {
    const result = await submitScore(nickname, replaySeed, replayActions);
    if (solo !== finishedGame) return;
    if (result.saved === true && Number.isInteger(result.rank)) {
      ranking = null;
      setText('submit-status', '已成功上榜！公開歷史榜第 ' + result.rank + ' 名，朋友也能看到。');
      void showRank();
    } else if (result.reason === 'lower') {
      setText('submit-status', '已經有更高的個人紀錄，這局不會覆蓋原本名次。');
    } else if (result.reason === 'duplicate') {
      setText('submit-status', '這局的方塊紀錄已登錄過，不會重複計分。');
    } else if (result.reason === 'outside') {
      setText('submit-status', '這局沒有進入公開歷史榜前 100 名。');
    } else {
      throw new Error('排行榜回傳非預期結果，請確認榜單或重試。');
    }
  } catch (error) {
    if (solo !== finishedGame) return;
    setText('submit-status', (error.message || '送出失敗。') + ' 成績是否寫入尚未確認；可先查看公開榜，再按「送出成績」重試。');
    $('submit-score').disabled = false;
  } finally {
    uploadingScores.delete(finishedGame);
  }
}
$('submit-score').addEventListener('click', () => { void uploadSoloScore(); });

if (isMultiplayer(mode)) $('code').value = inviteCode ?? '';
render();
void showRank();
// Shared ranking links always open the board even if this browser has a saved room.
if (mode !== 'rank') {
  void room.restore(inviteCode).then(restored => { if (restored) showMode(view.mode); });
}
let lastFrame = performance.now();
requestAnimationFrame(tick);
