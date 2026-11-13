import { SAVE_KEY, FISH, SALE_LIMIT, RuleError, activeTank, alive, readTrial, career,
  allFish, sexOf, patternOf, salePrice, salesToday, missions, pairOptions, recessiveChance, applyAction } from './aquarium-career.mjs';
import { drawSidePreview } from './aquarium-side-fish.mjs';

const byId = id => document.getElementById(id);
const dialog = byId('career-dialog');
const content = byId('career-content');
const status = byId('career-status');
const numbers = new Intl.NumberFormat('zh-TW');
const sexText = fish => sexOf(fish) === 'female' ? '母' : '公';
const titles = { shop: '水族商店', missions: '養成任務', breed: '繁殖紀錄', collection: '魚類圖鑑' };
let section = 'missions';
let working = false;
let pairIndex = 0;
let shopMode = 'buy';

function node(tag, value, className) {
  const element = document.createElement(tag);
  if (value) element.textContent = value;
  if (className) element.className = className;
  return element;
}

function button(label, action, { disabled = false, primary = false } = {}) {
  const control = node('button', label, primary ? 'career-primary' : 'career-button');
  control.type = 'button';
  control.disabled = disabled;
  control.addEventListener('click', action);
  return control;
}

function select(label, options, callback) {
  const wrapper = node('label', label, 'career-label');
  const control = node('select');
  for (const [value, text] of options) {
    const option = node('option', text);
    option.value = value;
    control.append(option);
  }
  control.addEventListener('change', () => callback?.(control.value));
  wrapper.append(control);
  return { wrapper, control };
}

function fishPreview(speciesId) {
  const canvas = node('canvas', undefined, 'career-fish-photo');
  canvas.width = 240;
  canvas.height = 108;
  canvas.setAttribute('aria-hidden', 'true');
  drawSidePreview(canvas, speciesId);
  return canvas;
}

function readState() {
  if (byId('edition-label').textContent === '雲端遊玩') throw new RuleError('此版本的養成內容可在單機試玩中使用。');
  if (!byId('save-state').textContent.includes('本機自動存檔')) throw new RuleError('本機存檔尚未就緒。');
  try {
    return readTrial(localStorage.getItem(SAVE_KEY));
  } catch (error) {
    if (error instanceof RuleError) throw error;
    throw new RuleError('目前無法讀取瀏覽器存檔。');
  }
}

async function commit(action) {
  if (working) return;
  working = true;
  try {
    const save = () => {
      const { state, message } = applyAction(readState(), action, Date.now());
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
      window.dispatchEvent(new StorageEvent('storage', { key: SAVE_KEY }));
      return message;
    };
    const message = navigator.locks ? await navigator.locks.request(SAVE_KEY, save) : save();
    render(message);
  } catch (error) {
    status.textContent = error instanceof RuleError ? error.message : '操作未能寫入本機存檔。';
  } finally {
    working = false;
  }
}

function renderShop(state, now) {
  const tank = activeTank(state);
  const switcher = node('div', undefined, 'career-options');
  const modeButton = (label, mode) => {
    const control = button(label, () => { shopMode = mode; render(); });
    control.setAttribute('aria-pressed', String(shopMode === mode));
    return control;
  };
  switcher.append(modeButton('購買魚苗', 'buy'), modeButton('系統收購', 'sell'));
  content.append(switcher, node('p', tank.name + ' · 持有 ' + numbers.format(state.coins) + ' 金幣', 'career-subtext'));
  if (shopMode === 'sell') {
    const remaining = Math.max(0, SALE_LIMIT - salesToday(state, now));
    const busy = new Set(career(state).jobs.flatMap(job => job.parents));
    const eligible = tank.fish.filter(fish => alive(fish, now) && !busy.has(fish.id));
    content.append(node('p', '今日剩餘 ' + remaining + '／' + SALE_LIMIT + ' 次 · 台灣時間午夜重置', 'career-subtext'));
    if (!eligible.length) content.append(node('p', '這座魚缸目前沒有可出售的魚。', 'career-card'));
    for (const fish of eligible) {
      const card = node('article', undefined, 'career-row');
      const detail = node('div');
      detail.append(node('h3', fish.name), node('p', FISH[fish.speciesId].name + ' · ' + sexText(fish), 'career-subtext'));
      const sell = button('出售 · ' + salePrice(fish.speciesId) + ' 金幣', () => {
        if (window.confirm('確定出售「' + fish.name + '」？')) void commit({ type: 'sell', fishId: fish.id });
      }, { disabled: remaining === 0 });
      card.append(detail, sell);
      content.append(card);
    }
    return;
  }

  const grid = node('div', undefined, 'career-species');
  for (const [speciesId, species] of Object.entries(FISH)) {
    const card = node('article', undefined, 'career-card');
    const sex = select('性別', [['female', '母魚'], ['male', '公魚']]);
    card.append(fishPreview(speciesId), node('h3', species.name), node('p', '負載 ' + species.points + ' 點', 'career-subtext'),
      sex.wrapper, button(species.price + ' 金幣 · 購買', () =>
        void commit({ type: 'purchase', speciesId, sex: sex.control.value }), { primary: true, disabled: state.coins < species.price }));
    grid.append(card);
  }
  content.append(grid);
}

function renderMissions(state) {
  for (const task of missions(state)) {
    const card = node('article', undefined, 'career-row');
    const detail = node('div');
    detail.append(node('h3', task.name), node('p', task.description, 'career-subtext'));
    const label = task.claimed ? '已領取' : task.done ? '領取 ' + task.reward + ' 金幣' : task.reward + ' 金幣 · 未完成';
    card.append(detail, button(label, () => void commit({ type: 'mission', id: task.id }),
      { primary: task.done && !task.claimed, disabled: !task.done || task.claimed }));
    content.append(card);
  }
}

function countdown(readyAt, now) {
  const remaining = Math.max(0, Math.ceil((readyAt - now) / 60_000));
  if (!remaining) return '可領取後代';
  const hours = Math.floor(remaining / 60);
  return hours + ' 小時 ' + remaining % 60 + ' 分鐘後完成';
}

function renderBreeding(state, now) {
  const tank = activeTank(state);
  content.append(node('p', '目前魚缸 · ' + tank.name, 'career-subtext'));
  const job = career(state).jobs.find(item => item.tankId === tank.id);
  if (job) {
    const card = node('article', undefined, 'career-card');
    const parents = job.parents.map(id => allFish(state).find(fish => fish.id === id)?.name ?? '已離缸');
    card.append(node('h3', FISH[job.speciesId].name + '配對'),
      node('p', parents.join(' × '), 'career-subtext'),
      node('p', countdown(job.readyAt, now), 'career-time'),
      button('領取後代', () => void commit({ type: 'hatch', id: job.id }),
        { disabled: now < job.readyAt, primary: true }));
    content.append(card);
    return;
  }
  const pairs = pairOptions(state, now);
  if (!pairs.length) {
    content.append(node('p', '請在同一魚缸養一對同種的公母魚。商店可指定性別，換缸可用魚隻的照顧選單。', 'career-card'),
      button('前往購買魚苗', () => { section = 'shop'; shopMode = 'buy'; render(); }, { primary: true }));
    return;
  }
  const selected = select('親魚', pairs.map(({ male, female }, index) =>
    [String(index), male.name + '（公）× ' + female.name + '（母）']), value => { pairIndex = Number(value); preview(); });
  pairIndex = Math.min(pairIndex, pairs.length - 1);
  selected.control.value = String(pairIndex);
  const details = node('p', undefined, 'career-subtext');
  function preview() {
    const { male, female } = pairs[pairIndex];
    const recessive = recessiveChance(male, female);
    details.textContent = FISH[male.speciesId].hours + ' 小時 · 顯性斑點 ' + (100 - recessive)
      + '%／隱性條紋 ' + recessive + '% · 另有 0.5% 變異機率';
  }
  preview();
  content.append(selected.wrapper, details, button('開始配對', () => {
    const { male, female } = pairs[pairIndex];
    void commit({ type: 'pair', maleId: male.id, femaleId: female.id });
  }, { primary: true }));
}

function renderCollection(state, now) {
  const inventory = allFish(state);
  const names = new Map(inventory.map(fish => [fish.id, fish.name]));
  for (const [speciesId, species] of Object.entries(FISH)) {
    const fish = inventory.filter(item => item.speciesId === speciesId);
    const living = fish.filter(item => !item.soldAt && alive(item, now)).length;
    const card = node('article', undefined, 'career-entry');
    const detail = node('div');
    detail.append(node('h3', species.name), node('p', species.habitat + ' · 現有 ' + living + ' 隻', 'career-subtext'),
      node('p', species.detail, 'career-subtext'));
    if (fish.length) {
      const list = node('details');
      list.append(node('summary', '查看個體與族譜（' + fish.length + '）'));
      for (const item of fish) {
        const stateText = item.soldAt ? '已售出' : alive(item, now) ? '飼養中' : '紀念';
        const parentage = item.parents ? ' · 親魚 ' + item.parents.map(id => names.get(id) ?? '未知').join(' × ') : '';
        list.append(node('p', item.name + ' · ' + sexText(item) + ' · ' + patternOf(item) + ' · ' + stateText + parentage));
      }
      detail.append(list);
    }
    card.append(fishPreview(speciesId), detail);
    content.append(card);
  }
}

function refreshTrack(state) {
  const available = missions(state).filter(task => task.done && !task.claimed).length;
  const badge = byId('mission-badge');
  badge.hidden = available === 0;
  badge.textContent = String(available);
  const current = missions(state).find(task => !task.claimed);
  byId('career-track').textContent = current ? (current.done ? '待領取 · ' : '目前任務 · ') + current.name : '養成任務已全數完成';
}

function render(message = '') {
  byId('career-title').textContent = titles[section];
  status.textContent = message;
  content.replaceChildren();
  try {
    const state = readState();
    const now = Date.now();
    refreshTrack(state);
    switch (section) {
      case 'shop': renderShop(state, now); break;
      case 'missions': renderMissions(state); break;
      case 'breed': renderBreeding(state, now); break;
      case 'collection': renderCollection(state, now); break;
    }
  } catch (error) {
    status.textContent = error instanceof RuleError ? error.message : '這項資料暫時無法顯示。';
  }
}

for (const control of document.querySelectorAll('[data-career]')) control.addEventListener('click', () => {
  section = control.dataset.career;
  pairIndex = 0;
  render();
  if (!dialog.open) dialog.showModal();
});
byId('career-close').addEventListener('click', () => dialog.close());
function updateTrack() {
  try { refreshTrack(readState()); } catch { /* The original game displays save errors. */ }
}
new MutationObserver(updateTrack).observe(byId('load-label'), { childList: true, subtree: true });
window.addEventListener('storage', event => {
  if (event.key === SAVE_KEY || event.key === null) updateTrack();
});
setInterval(() => {
  if (dialog.open && section === 'breed' && content.querySelector('.career-time') && !working) render(status.textContent);
}, 60_000);
updateTrack();
