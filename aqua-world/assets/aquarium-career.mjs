import { EQUIPMENT, TEMPERATURE_TARGETS, targetTemperature, equipmentOf, exhibitOf, visitorProfile, settleTankFacilities, validFacilities } from './aquarium-facilities.mjs?v=080';

export const SAVE_KEY = 'aqua-world:trial:v1';
const HOUR = 3_600_000;
const DAY = HOUR * 24;
export const SALE_LIMIT = 3;

// The three species already supported by the aquarium scene and save format.
import { FISH } from './aquarium-species.mjs?v=090';
export { FISH };

export class RuleError extends Error {}

export const activeTank = state => state.tanks.find(tank => tank.id === state.activeTankId);
export const alive = (fish, now) => fish.diedAt === null && now < fish.bornAt + FISH[fish.speciesId].life * DAY;
const dayKey = now => Math.floor((now + 8 * HOUR) / DAY);
const whole = value => Number.isSafeInteger(value) && value >= 0;

export function readTrial(raw) {
  if (raw === null) throw new RuleError('正在載入魚缸，請稍後再試。');
  try {
    const state = JSON.parse(raw);
    if (state?.version !== 1 || !whole(state.coins) || !whole(state.food) || !Array.isArray(state.tanks)
      || !state.tanks.every(tank => whole(tank.capacity) && typeof tank.clarity === 'number' && validFacilities(tank)
        && Array.isArray(tank.decorations) && Array.isArray(tank.fish)
        && tank.fish.every(fish => Object.hasOwn(FISH, fish.speciesId) && whole(fish.bornAt)))
      || !activeTank(state)) throw new Error();
    if (state.career !== undefined) {
      const c = state.career;
      if (!c || c.version !== 1 || !whole(c.purchases) || !whole(c.hatched)
        || !whole(c.saleDay) || !whole(c.saleCount)
        || !Array.isArray(c.claimed) || !Array.isArray(c.archive) || !Array.isArray(c.jobs)) throw new Error();
    }
    return state;
  } catch {
    throw new RuleError('這份試玩存檔無法安全讀取。');
  }
}

export function career(state) {
  return state.career ?? { version: 1, purchases: 0, hatched: 0, claimed: [], archive: [], jobs: [], saleDay: 0, saleCount: 0 };
}

export const allFish = state => [...state.tanks.flatMap(tank => tank.fish), ...career(state).archive];
export const sexOf = fish => fish.sex ?? (fish.id === 'glint' ? 'female' : 'male');
const allelesOf = fish => fish.alleles ?? ['B', 'b'];
export const patternOf = fish => fish.glow ? '幻光變異' : allelesOf(fish).includes('B') ? '顯性斑點' : '隱性條紋';
export const salePrice = speciesId => Math.floor(FISH[speciesId].price / 2);
export const salesToday = (state, now) => career(state).saleDay === dayKey(now) ? career(state).saleCount : 0;
export const load = (tank, now) => tank.fish.reduce((sum, fish) => sum + (alive(fish, now) ? FISH[fish.speciesId].points : 0), 0);

export function missions(state) {
  const c = career(state);
  return [
    { id: 'stock', name: '迎接一條魚苗', description: '到商店買入任一魚種。', reward: 180, done: c.purchases > 0 },
    { id: 'water', name: '照顧晨光溪谷', description: '將晨光溪谷的清澈度提升至 98%。', reward: 90,
      done: state.tanks.some(tank => tank.id === 'river' && tank.clarity >= 98) },
    { id: 'landscape', name: '布置水下花園', description: '在同一座缸擺放 4 件造景。', reward: 120,
      done: state.tanks.some(tank => tank.decorations.length >= 4) },
    { id: 'firstExhibit', name: '迎接第一批遊客', description: '在任一座有魚的水族缸開放展覽。', reward: 140,
      done: c.openedExhibit === true || state.tanks.some(tank => tank.exhibit?.open) },
    { id: 'lineage', name: '迎接下一代', description: '完成配對並領取一條繁殖後代。', reward: 280, done: c.hatched > 0 },
  ].map(task => ({ ...task, claimed: c.claimed.includes(task.id) }));
}

export function pairOptions(state, now) {
  const tank = activeTank(state);
  const busy = new Set(career(state).jobs.flatMap(job => job.parents));
  const adults = tank.fish.filter(fish => alive(fish, now) && !busy.has(fish.id)
    && (!fish.parents || now - fish.bornAt >= FISH[fish.speciesId].hours * HOUR));
  const females = adults.filter(fish => sexOf(fish) === 'female');
  return adults.filter(fish => sexOf(fish) === 'male').flatMap(male =>
    females.filter(female => female.speciesId === male.speciesId).map(female => ({ male, female })));
}

export function recessiveChance(male, female) {
  const count = fish => allelesOf(fish).filter(allele => allele === 'b').length;
  return count(male) * count(female) * 25;
}

function reserveSpace(tank, speciesId, now) {
  if (load(tank, now) + FISH[speciesId].points > tank.capacity) throw new RuleError('這座魚缸的生物負載已不足。');
}

function newFish(id, speciesId, sex, now, existingFish) {
  const name = FISH[speciesId].name + ' ' + (existingFish.filter(fish => fish.speciesId === speciesId).length + 1);
  return { id, speciesId, name, bornAt: now, lastCalculatedAt: now,
    growthHours: 0, satiety: 55, diedAt: null, sex, alleles: ['B', 'b'] };
}

export function applyAction(current, action, now, makeId = () => crypto.randomUUID(), random = Math.random) {
  const state = structuredClone(current);
  state.tanks = state.tanks.map(tank => settleTankFacilities(tank, now, alive, load));
  const c = state.career = career(state);
  const tank = action.tankId === undefined ? activeTank(state) : state.tanks.find(item => item.id === action.tankId);
  if (!tank) throw new RuleError('找不到這座魚缸。');
  const inventory = allFish(state);

  switch (action.type) {
    case 'upgradeEquipment': {
      const id = action.id;
      if (!Object.hasOwn(EQUIPMENT, id)) throw new RuleError('找不到這項設備。');
      const installed = equipmentOf(tank);
      const next = EQUIPMENT[id].levels[installed[id]];
      if (!next) throw new RuleError('這項設備已升到最高等級。');
      if (state.coins < next.price) throw new RuleError('金幣不足。');
      const level = installed[id] + 1;
      tank.equipment = { ...installed, [id]: level };
      state.coins -= next.price;
      const effect = id === 'heater' ? '水溫將逐步接近 ' + targetTemperature(tank) + '°C。' : '開始自動過濾。';
      return { state, message: EQUIPMENT[id].name + '升至 Lv.' + level + '，' + effect };
    }
    case 'setTemperatureTarget': {
      const installed = equipmentOf(tank);
      if (!installed.heater) throw new RuleError('請先安裝恆溫器。');
      if (!TEMPERATURE_TARGETS.includes(action.target)) throw new RuleError('設定溫度必須介於 24–27°C。');
      tank.equipment = { ...installed, target: action.target };
      return { state, message: '恆溫器已設為 ' + action.target + '°C，水溫將逐步調整。' };
    }
    case 'setExhibit': {
      const exhibit = exhibitOf(tank);
      if (typeof action.open !== 'boolean' || exhibit.open === action.open) throw new RuleError('展缸目前已是這個狀態。');
      if (action.open && !visitorProfile(tank, now, alive).eligible) throw new RuleError('開放前需要至少一隻活魚，清澈度也要達到 65%。');
      if (action.open) c.openedExhibit = true;
      tank.exhibit = { ...exhibit, open: action.open, lastAt: Math.max(now, exhibit.lastAt, tank.calculatedAt ?? now) };
      return { state, message: action.open ? tank.name + '已開放參觀，開始累積門票。' : tank.name + '已暫停開放，已累積門票可照常領取。' };
    }
    case 'claimTickets': {
      const exhibit = exhibitOf(tank);
      const amount = Math.floor(exhibit.unclaimed);
      if (amount < 1) throw new RuleError('目前沒有可領取的門票收益。');
      tank.exhibit = { ...exhibit, unclaimed: exhibit.unclaimed - amount };
      state.coins += amount;
      return { state, message: '已領取 ' + amount + ' 金幣門票收益。' };
    }
    case 'purchase': {
      const { speciesId, sex } = action;
      if (!Object.hasOwn(FISH, speciesId) || !['male', 'female'].includes(sex)) throw new RuleError('請先選擇魚種與性別。');
      const species = FISH[speciesId];
      if (state.coins < species.price) throw new RuleError('金幣不足。');
      reserveSpace(tank, speciesId, now);
      tank.fish.push(newFish(makeId(), speciesId, sex, now, inventory));
      state.coins -= species.price;
      c.purchases++;
      return { state, message: species.name + '已入住' + tank.name + '。' };
    }
    case 'sell': {
      const fish = tank.fish.find(item => item.id === action.fishId && alive(item, now));
      if (!fish) throw new RuleError('這條魚已不在目前魚缸。');
      if (c.jobs.some(job => job.parents.includes(fish.id))) throw new RuleError('繁殖中的親魚不能出售。');
      const count = salesToday(state, now);
      if (count >= SALE_LIMIT) throw new RuleError('今天已達系統收購上限。');
      tank.fish = tank.fish.filter(item => item.id !== fish.id);
      c.archive.push({ ...fish, soldAt: now });
      c.saleDay = dayKey(now);
      c.saleCount = count + 1;
      const price = salePrice(fish.speciesId);
      state.coins += price;
      return { state, message: '已出售' + fish.name + '，獲得 ' + price + ' 金幣。' };
    }
    case 'mission': {
      const mission = missions(state).find(item => item.id === action.id);
      if (!mission?.done || mission.claimed) throw new RuleError('這項獎勵目前無法領取。');
      c.claimed.push(mission.id);
      state.coins += mission.reward;
      return { state, message: '已領取 ' + mission.reward + ' 金幣。' };
    }
    case 'pair': {
      if (c.jobs.some(job => job.tankId === tank.id)) throw new RuleError('這座魚缸已有進行中的配對。');
      const pair = pairOptions(state, now).find(item => item.male.id === action.maleId && item.female.id === action.femaleId);
      if (!pair) throw new RuleError('請選同缸、同種、可繁殖的公母魚。');
      const { male, female } = pair;
      const speciesId = male.speciesId;
      reserveSpace(tank, speciesId, now);
      const traits = {
        sex: random() < .5 ? 'male' : 'female',
        alleles: [allelesOf(male)[Math.floor(random() * 2)], allelesOf(female)[Math.floor(random() * 2)]],
        glow: random() < .005,
      };
      c.jobs.push({ id: makeId(), tankId: tank.id, speciesId, parents: [male.id, female.id],
        readyAt: now + FISH[speciesId].hours * HOUR, traits });
      return { state, message: '配對已開始，時間到後可領取後代。' };
    }
    case 'hatch': {
      const job = c.jobs.find(item => item.id === action.id && item.tankId === tank.id);
      if (!job || now < job.readyAt) throw new RuleError('這筆配對尚未完成。');
      reserveSpace(tank, job.speciesId, now);
      const child = newFish(makeId(), job.speciesId, job.traits.sex, now, inventory);
      tank.fish.push({ ...child, ...job.traits, parents: job.parents });
      c.jobs = c.jobs.filter(item => item.id !== job.id);
      c.hatched++;
      return { state, message: child.name + '已孵育完成。' };
    }
    default:
      throw new RuleError('找不到這個操作。');
  }
}
