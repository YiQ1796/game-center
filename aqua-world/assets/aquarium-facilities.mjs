const HOUR = 3_600_000;
const MAX_WATER_HOURS = 72;
const MAX_TICKET_HOURS = 12;
const MAX_UNCLAIMED = 500;
const MIN_OPEN_CLARITY = 65;

export const EQUIPMENT = {
  filter: {
    name: '過濾器',
    levels: [
      { price: 420, protection: .42, cleaning: .50 },
      { price: 860, protection: .72, cleaning: 1.10 },
    ],
  },
  heater: {
    name: '恆溫器',
    levels: [
      { price: 320, speed: .60 },
      { price: 680, speed: 1.35 },
    ],
  },
};
export const TEMPERATURE_TARGETS = [24, 25, 26, 27];
const DEFAULT_TEMPERATURE = 25;
const emptyFacility = { filter: 0, heater: 0 };
const emptyExhibit = { open: false, lastAt: 0, unclaimed: 0 };
const within = (value, min, max) => Math.min(max, Math.max(min, value));

export const equipmentOf = tank => tank.equipment ?? emptyFacility;
export const targetTemperature = tank => equipmentOf(tank).target ?? DEFAULT_TEMPERATURE;
export const exhibitOf = tank => tank.exhibit ?? emptyExhibit;

export function validFacilities(tank) {
  const { equipment, exhibit } = tank;
  if (equipment !== undefined) {
    if (!equipment || Object.keys(EQUIPMENT).some(id =>
      !Number.isInteger(equipment[id]) || equipment[id] < 0 || equipment[id] > EQUIPMENT[id].levels.length)) return false;
    if (equipment.target !== undefined && !TEMPERATURE_TARGETS.includes(equipment.target)) return false;
  }
  return exhibit === undefined || Boolean(exhibit && typeof exhibit.open === 'boolean'
    && Number.isSafeInteger(exhibit.lastAt) && exhibit.lastAt > 0
    && Number.isFinite(exhibit.unclaimed) && exhibit.unclaimed >= 0 && exhibit.unclaimed <= MAX_UNCLAIMED);
}

export function waterAfter(tank, now, load) {
  if (!Number.isFinite(tank.calculatedAt)) return {};
  const hours = within((now - tank.calculatedAt) / HOUR, 0, MAX_WATER_HOURS);
  const grass = tank.decorations.filter(item => item.kind === 'grass').length;
  const waste = Math.max(0, load(tank, now) * .055 - grass * .12);
  const { filter, heater } = equipmentOf(tank);
  const filtration = EQUIPMENT.filter.levels[filter - 1];
  const temperatureControl = EQUIPMENT.heater.levels[heater - 1];
  const clarityRate = filtration ? filtration.cleaning - waste * (1 - filtration.protection) : -waste;
  const target = targetTemperature(tank);
  const temperature = temperatureControl
    ? target + (tank.temperature - target) * Math.exp(-hours * temperatureControl.speed)
    : tank.temperature;
  return {
    clarity: within(tank.clarity + hours * clarityRate, 15, 100),
    temperature,
    calculatedAt: Math.max(now, tank.calculatedAt),
  };
}

export function visitorProfile(tank, now, alive) {
  const living = tank.fish.filter(fish => alive(fish, now));
  const species = new Set(living.map(fish => fish.speciesId)).size;
  const decorationTypes = new Set(tank.decorations.map(item => item.kind)).size;
  const rating = within(Math.round(tank.clarity * .40 + species * 11 + decorationTypes * 7 + Math.min(living.length, 6)), 0, 100);
  const eligible = living.length > 0 && tank.clarity >= MIN_OPEN_CLARITY;
  return { rating, living: living.length, species, decorationTypes, eligible,
    perHour: eligible ? 10 + Math.round(rating * .57) : 0 };
}

export function settleExhibit(tank, now, alive, load) {
  const current = exhibitOf(tank);
  if (!tank.exhibit || now <= current.lastAt) return current;
  let unclaimed = current.unclaimed;
  if (current.open && unclaimed < MAX_UNCLAIMED) {
    const start = Math.max(current.lastAt, now - MAX_TICKET_HOURS * HOUR);
    // Project the water and attendance at each interval midpoint. No offline timer is needed.
    for (let at = start; at < now; at += HOUR) {
      const duration = Math.min(HOUR, now - at);
      const midpoint = at + duration / 2;
      const water = waterAfter(tank, midpoint, load);
      const { perHour } = visitorProfile({ ...tank, ...water }, midpoint, alive);
      unclaimed = Math.min(MAX_UNCLAIMED, unclaimed + perHour * duration / HOUR);
    }
  }
  return { ...current, lastAt: now, unclaimed };
}

export function exhibitView(tank, now, alive, load) {
  const state = settleExhibit(tank, now, alive, load);
  const water = waterAfter(tank, now, load);
  const profile = visitorProfile({ ...tank, ...water }, now, alive);
  return { ...state, ...profile, claimable: Math.floor(state.unclaimed),
    maxHours: MAX_TICKET_HOURS, maxUnclaimed: MAX_UNCLAIMED };
}

export function settleTankFacilities(tank, now, alive, load) {
  const water = waterAfter(tank, now, load);
  if (!tank.exhibit) return { ...tank, ...water };
  return { ...tank, ...water, exhibit: settleExhibit(tank, now, alive, load) };
}
