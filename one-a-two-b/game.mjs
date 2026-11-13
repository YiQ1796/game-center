import { CODE_LENGTH, DIGITS, codeForSeed, isCode, isSeed, scoreGuess, uniqueDigits } from './rules.mjs?v=1';

const get = id => document.getElementById(id);
const play = {
  mode: get('mode'), clock: get('clock'), slots: get('slots'), feedback: get('feedback'),
  keypad: get('keypad'), erase: get('erase'), submit: get('submit'), hint: get('hint'),
  hintResult: get('hint-result'), record: get('record'), history: get('history'),
  empty: get('empty-history'), count: get('count'), exclusions: get('notes-digits'),
  candidates: get('candidates'),
};
const helpDialog = get('help-dialog');
const shareDialog = get('share-dialog');
const restartDialog = get('restart-dialog');
const shareUrl = get('share-url');
const shareFeedback = get('share-feedback');
const digitKeys = [...play.keypad.querySelectorAll('[data-digit]')];
const slots = [...play.slots.children];
const storagePrefix = 'sanmao-1a2b-v1:';
const initialFeedback = '選四個不同的數字。第一格可以填 0。';
const incomingCode = new URL(location.href).searchParams.get('c');
let challenge = isSeed(incomingCode) ? incomingCode : null;

function readSaved(key) {
  try {
    return JSON.parse(localStorage.getItem(storagePrefix + key));
  } catch {
    return null;
  }
}

function writeSaved(key, value) {
  try {
    localStorage.setItem(storagePrefix + key, JSON.stringify(value));
  } catch {
    // The current round remains playable if browser storage is unavailable.
  }
}

function randomSeed() {
  return crypto.getRandomValues(new Uint32Array(1))[0].toString(16).padStart(8, '0');
}

function newRound(seed = randomSeed()) {
  return {
    seed, draft: '', guesses: [], excluded: '', candidates: Array(CODE_LENGTH).fill(''),
    hintIndex: null, startedAt: null, finishedAt: null,
  };
}

function validTime(value) {
  return Number.isFinite(value) && value > 0 ? value : null;
}

function restoreRound() {
  const saved = readSaved(challenge ? 'shared' : 'solo');
  if (!saved || !isSeed(saved.seed) || (challenge && challenge !== saved.seed)) {
    return newRound(challenge ?? undefined);
  }
  const restored = newRound(saved.seed);
  const solution = codeForSeed(saved.seed);
  restored.draft = uniqueDigits(saved.draft).slice(0, CODE_LENGTH);
  restored.excluded = uniqueDigits(saved.excluded);
  restored.startedAt = validTime(saved.startedAt);
  restored.hintIndex = Number.isInteger(saved.hintIndex) && saved.hintIndex >= 0 && saved.hintIndex < CODE_LENGTH
    ? saved.hintIndex : null;
  if (Array.isArray(saved.guesses)) {
    for (const guess of new Set(saved.guesses.filter(isCode))) {
      restored.guesses.push(guess);
      if (guess === solution) {
        restored.finishedAt = validTime(saved.finishedAt) ?? restored.startedAt ?? Date.now();
        restored.draft = '';
        break;
      }
    }
  }
  if (Array.isArray(saved.candidates)) {
    restored.candidates = restored.candidates.map((_, index) => uniqueDigits(saved.candidates[index]));
  }
  return restored;
}

let round = restoreRound();
let answer = codeForSeed(round.seed);
const savedBest = readSaved('best');
let best = Number.isInteger(savedBest?.attempts) && savedBest.attempts > 0
  && Number.isFinite(savedBest.seconds) && savedBest.seconds >= 0 ? savedBest : null;

function saveRound() {
  writeSaved(challenge ? 'shared' : 'solo', round);
}

function feedback(message, tone = '') {
  play.feedback.textContent = message;
  play.feedback.dataset.tone = tone;
}

function elapsedSeconds() {
  return round.startedAt === null ? 0 : Math.max(0, Math.floor(((round.finishedAt ?? Date.now()) - round.startedAt) / 1000));
}

function formatTime(seconds) {
  const minutes = String(Math.floor(seconds / 60)).padStart(2, '0');
  return minutes + ':' + String(seconds % 60).padStart(2, '0');
}

function renderClock() {
  const seconds = elapsedSeconds();
  const text = formatTime(seconds);
  if (play.clock.textContent === text) return;
  play.clock.textContent = text;
  play.clock.dateTime = 'PT' + seconds + 'S';
}

function renderEntry() {
  const solved = round.finishedAt !== null;
  const displayed = solved ? answer : round.draft;
  play.slots.classList.toggle('solved', solved);
  play.slots.setAttribute('aria-label', '目前輸入 ' + (displayed ? [...displayed].join(' ') : '空白'));
  slots.forEach((slot, index) => {
    slot.textContent = displayed[index] ?? '–';
    slot.classList.toggle('filled', index < displayed.length);
    slot.classList.toggle('current', !solved && index === displayed.length);
  });
  digitKeys.forEach(button => {
    button.disabled = solved || displayed.length === CODE_LENGTH || displayed.includes(button.dataset.digit);
  });
  play.erase.disabled = solved || !displayed;
  play.submit.disabled = solved || displayed.length !== CODE_LENGTH;
  play.hint.disabled = solved || round.hintIndex !== null;
  play.hint.textContent = round.hintIndex === null ? '取提示' : '已取提示';
  play.hintResult.hidden = round.hintIndex === null;
  if (round.hintIndex !== null) {
    play.hintResult.textContent = '提示 · 第 ' + (round.hintIndex + 1) + ' 格是 ' + answer[round.hintIndex] + '。';
  }
}

function renderHistory() {
  play.count.textContent = round.guesses.length + ' 次';
  play.empty.hidden = round.guesses.length > 0;
  const rows = [...round.guesses].reverse().map((guess, index) => {
    const row = document.createElement('li');
    const number = document.createElement('small');
    const code = document.createElement('span');
    const clue = document.createElement('span');
    const exact = document.createElement('b');
    const { a, b } = scoreGuess(answer, guess);
    number.textContent = '#' + (round.guesses.length - index);
    code.className = 'guess';
    code.textContent = guess;
    clue.className = 'clue';
    exact.textContent = a + 'A';
    clue.append(exact, ' ' + b + 'B');
    row.append(number, code, clue);
    return row;
  });
  play.history.replaceChildren(...rows);
  play.history.scrollTop = 0;
}

function renderRecord() {
  play.record.textContent = best
    ? '單人最佳 · ' + best.attempts + ' 次 · ' + formatTime(best.seconds) + '（未用提示）'
    : '單人最佳 · —（未用提示）';
}

const exclusionButtons = [...DIGITS].map(digit => {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = digit;
  button.setAttribute('aria-label', '排除數字 ' + digit);
  button.addEventListener('click', () => {
    round.excluded = round.excluded.includes(digit)
      ? round.excluded.replace(digit, '') : round.excluded + digit;
    button.setAttribute('aria-pressed', String(round.excluded.includes(digit)));
    saveRound();
  });
  play.exclusions.append(button);
  return button;
});

const candidateInputs = Array.from({ length: CODE_LENGTH }, (_, index) => {
  const label = document.createElement('label');
  const input = document.createElement('input');
  label.textContent = '第 ' + (index + 1) + ' 格';
  input.type = 'text';
  input.inputMode = 'numeric';
  input.autocomplete = 'off';
  input.addEventListener('input', () => {
    round.candidates[index] = uniqueDigits(input.value);
    if (input.value !== round.candidates[index]) input.value = round.candidates[index];
    saveRound();
  });
  label.append(input);
  play.candidates.append(label);
  return input;
});

function renderRound() {
  play.mode.textContent = challenge ? '好友同題' : '單人練習';
  exclusionButtons.forEach((button, index) => {
    button.setAttribute('aria-pressed', String(round.excluded.includes(DIGITS[index])));
  });
  candidateInputs.forEach((input, index) => { input.value = round.candidates[index]; });
  renderEntry();
  renderHistory();
  renderRecord();
  renderClock();
  if (round.finishedAt !== null) {
    feedback('答對了！用 ' + round.guesses.length + ' 次猜出密碼。', 'success');
  } else {
    feedback(initialFeedback);
  }
}

function addDigit(digit) {
  if (round.finishedAt !== null || round.draft.length === CODE_LENGTH) return;
  if (round.draft.includes(digit)) {
    feedback('數字 ' + digit + ' 已經選過了。', 'error');
    return;
  }
  round.startedAt ??= Date.now();
  round.draft += digit;
  feedback(round.draft.length === CODE_LENGTH ? '四格填好了，可以送出猜測。' : initialFeedback);
  saveRound();
  renderEntry();
  renderClock();
}

function eraseDigit() {
  if (round.finishedAt !== null || !round.draft) return;
  round.draft = round.draft.slice(0, -1);
  feedback(initialFeedback);
  saveRound();
  renderEntry();
}

function submitGuess() {
  if (round.finishedAt !== null || !isCode(round.draft)) return;
  const guess = round.draft;
  if (round.guesses.includes(guess)) {
    feedback('這組已經猜過了，換一組試試。', 'error');
    return;
  }

  round.guesses.push(guess);
  round.draft = '';
  const { a, b } = scoreGuess(answer, guess);
  if (a === CODE_LENGTH) {
    round.finishedAt = Date.now();
    const attempts = round.guesses.length;
    const seconds = elapsedSeconds();
    if (!challenge && round.hintIndex === null && (!best || attempts < best.attempts || (attempts === best.attempts && seconds < best.seconds))) {
      best = { attempts, seconds };
      writeSaved('best', best);
      renderRecord();
    }
    feedback('答對了！用 ' + attempts + ' 次猜出密碼。', 'success');
  } else {
    feedback('這次得到 ' + a + 'A ' + b + 'B，繼續推理吧。');
  }
  saveRound();
  renderEntry();
  renderHistory();
  renderClock();
}

function revealHint() {
  if (round.finishedAt !== null || round.hintIndex !== null) return;
  round.startedAt ??= Date.now();
  round.hintIndex = crypto.getRandomValues(new Uint8Array(1))[0] % CODE_LENGTH;
  saveRound();
  renderEntry();
  renderClock();
  feedback(play.hintResult.textContent);
}

function startNewRound() {
  if (challenge || incomingCode !== null) {
    const url = new URL(location.href);
    url.searchParams.delete('c');
    history.replaceState(history.state, '', url);
  }
  challenge = null;
  let seed = randomSeed();
  while (codeForSeed(seed) === answer) seed = randomSeed();
  round = newRound(seed);
  answer = codeForSeed(round.seed);
  saveRound();
  renderRound();
}

play.keypad.addEventListener('click', event => {
  const digit = event.target.closest('button[data-digit]')?.dataset.digit;
  if (digit !== undefined) addDigit(digit);
});
play.erase.addEventListener('click', eraseDigit);
play.submit.addEventListener('click', submitGuess);
play.hint.addEventListener('click', revealHint);
get('help').addEventListener('click', () => helpDialog.showModal());
get('share').addEventListener('click', () => {
  const url = new URL('./', location.href);
  url.searchParams.set('c', round.seed);
  shareUrl.value = url.href;
  shareFeedback.textContent = '';
  shareDialog.showModal();
});
get('copy-link').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(shareUrl.value);
    shareFeedback.textContent = '連結已複製，可以傳給朋友了。';
  } catch {
    shareUrl.focus();
    shareUrl.select();
    shareFeedback.textContent = '已選取網址，可以手動複製。';
  }
});
get('restart').addEventListener('click', () => {
  if (round.finishedAt === null && (round.draft || round.guesses.length || round.hintIndex !== null
    || round.excluded || round.candidates.some(Boolean))) {
    restartDialog.returnValue = '';
    restartDialog.showModal();
  } else {
    startNewRound();
  }
});
restartDialog.addEventListener('close', () => {
  if (restartDialog.returnValue === 'restart') startNewRound();
});

document.addEventListener('keydown', event => {
  if (event.defaultPrevented || event.isComposing || event.ctrlKey || event.altKey || event.metaKey
    || get('solo-game').hidden || document.querySelector('dialog[open]') || event.target.closest('.notes, input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return;
  if (/^\d$/.test(event.key)) {
    event.preventDefault();
    addDigit(event.key);
    play.slots.focus({ preventScroll: true });
  } else if (event.key === 'Backspace' || event.key === 'Delete') {
    event.preventDefault();
    eraseDigit();
  } else if (event.key === 'Enter' && !event.target.closest('button, a, summary')) {
    event.preventDefault();
    submitGuess();
  }
});

saveRound();
renderRound();
setInterval(renderClock, 500);
