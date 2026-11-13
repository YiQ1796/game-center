import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SAVE_KEY, FISH, applyAction, activeTank, alive, load, pairOptions, patternOf, readTrial, recessiveChance, salesToday } from '../aqua-world/assets/aquarium-career.mjs';
import { exhibitView, settleTankFacilities } from '../aqua-world/assets/aquarium-facilities.mjs';

const hour = 3_600_000;
const now = Date.UTC(2026, 10, 11);
const male = { id: 'sunny', speciesId: 'guppy', name: '小橘', bornAt: now, diedAt: null };
const female = { ...male, id: 'female', name: '母魚', sex: 'female', alleles: ['b', 'b'] };
const game = (fish = [male], capacity = 30) => ({
  version: 1, coins: 5_000, food: 24, activeTankId: 'river',
  tanks: [{ id: 'river', name: '晨光溪谷', capacity, fish, decorations: [], clarity: 92 }],
});

test('an existing trial save buys a fish without replacing original fish or feeding supplies', () => {
  assert.equal(SAVE_KEY, 'aqua-world:trial:v1');
  const original = readTrial(JSON.stringify(game()));
  const { state } = applyAction(original, { type: 'purchase', speciesId: 'guppy', sex: 'female' }, now, () => 'new');
  assert.equal(state.coins, 4_880);
  assert.equal(state.food, original.food);
  assert.equal(activeTank(state).fish[0].id, 'sunny');
  assert.equal(pairOptions(state, now).length, 1);
  assert.equal(original.coins, 5_000);
  assert.throws(() => applyAction(game([male], 2), { type: 'purchase', speciesId: 'guppy', sex: 'female' }, now), /負載/);
});

test('mission payout can only be claimed once', () => {
  const { state } = applyAction(game(), { type: 'purchase', speciesId: 'guppy', sex: 'female' }, now, () => 'new');
  const reward = applyAction(state, { type: 'mission', id: 'stock' }, now).state;
  assert.equal(reward.coins, state.coins + 180);
  assert.throws(() => applyAction(reward, { type: 'mission', id: 'stock' }, now), /無法領取/);
});

test('breeding persists the outcome, applies the real timer and records parents', () => {
  assert.equal(recessiveChance(male, female), 50);
  const rolls = [.9, .99, .2, .004];
  const paired = applyAction(game([male, female]), { type: 'pair', maleId: male.id, femaleId: female.id },
    now, () => 'pair', () => rolls.shift()).state;
  const restored = readTrial(JSON.stringify(paired));
  assert.throws(() => applyAction(restored, { type: 'hatch', id: 'pair' }, now + 6 * hour - 1), /尚未完成/);
  assert.throws(() => applyAction(restored, { type: 'sell', fishId: male.id }, now), /親魚/);
  const hatched = applyAction(restored, { type: 'hatch', id: 'pair' }, now + 6 * hour, () => 'baby').state;
  const child = activeTank(hatched).fish[2];
  assert.deepEqual(child.parents, [male.id, female.id]);
  assert.deepEqual(child.alleles, ['b', 'b']);
  assert.equal(patternOf(child), '幻光變異');
  assert.throws(() => applyAction(hatched, { type: 'hatch', id: 'pair' }, now + 6 * hour), /尚未完成/);
});

test('daily sales limit resets on the next local day and sold fish stay in the archive', () => {
  const fish = [0, 1, 2, 3].map(id => ({ ...male, id: 'f' + id }));
  let state = game(fish);
  for (const item of fish.slice(0, 3)) state = applyAction(state, { type: 'sell', fishId: item.id }, now).state;
  assert.equal(state.coins, 5_180);
  assert.equal(state.career.archive.length, 3);
  assert.equal(salesToday(state, now), 3);
  assert.throws(() => applyAction(state, { type: 'sell', fishId: fish[3].id }, now), /上限/);
  assert.equal(salesToday(state, now + 24 * hour), 0);
});

function existingAquarium(fish = [male]) {
  const state = game(fish);
  Object.assign(activeTank(state), { calculatedAt: now, temperature: 25 });
  return state;
}

test('equipment upgrades preserve older saves and affect projected water conditions', () => {
  const original = existingAquarium();
  const withFilter = applyAction(original, { type: 'upgradeEquipment', id: 'filter' }, now).state;
  const upgraded = applyAction(withFilter, { type: 'upgradeEquipment', id: 'filter' }, now).state;
  assert.equal(upgraded.coins, 3_720);
  assert.equal(activeTank(original).equipment, undefined);
  assert.throws(() => applyAction(upgraded, { type: 'upgradeEquipment', id: 'filter' }, now), /最高/);
  assert.throws(() => applyAction({ ...original, coins: 0 }, { type: 'upgradeEquipment', id: 'filter' }, now), /不足/);
  const clarity = state => settleTankFacilities(activeTank(state), now + 2 * hour, alive, load).clarity;
  assert.ok(clarity(upgraded) > clarity(withFilter) && clarity(withFilter) > clarity(original));
  const heated = applyAction(upgraded, { type: 'upgradeEquipment', id: 'heater' }, now).state;
  const targeted = applyAction(heated, { type: 'setTemperatureTarget', target: 27 }, now).state;
  const water = settleTankFacilities(activeTank(readTrial(JSON.stringify(targeted))), now + hour, alive, load);
  assert.ok(water.temperature > 25 && water.temperature < 27);
  assert.throws(() => applyAction(heated, { type: 'setTemperatureTarget', target: 35 }, now), /24–27/);
});

test('visitor earnings are settled before pausing and can only be claimed once', () => {
  const open = { type: 'setExhibit', open: true };
  const claim = { type: 'claimTickets' };
  assert.throws(() => applyAction(existingAquarium([]), open, now), /活魚/);
  const original = existingAquarium();
  const opened = applyAction(original, open, now).state;
  const pauseAt = now + 2 * hour;
  const paused = applyAction(opened, { ...open, open: false }, pauseAt).state;
  const view = exhibitView(activeTank(paused), now + 10 * hour, alive, load);
  assert.ok(view.claimable > 0);
  assert.equal(view.claimable, exhibitView(activeTank(opened), pauseAt, alive, load).claimable);
  const paid = applyAction(paused, claim, now + 10 * hour).state;
  assert.equal(paid.coins, original.coins + view.claimable);
  assert.throws(() => applyAction(paid, claim, now + 10 * hour), /沒有/);
  const rewarded = applyAction(paid, { type: 'mission', id: 'firstExhibit' }, now + 10 * hour).state;
  assert.equal(rewarded.coins, paid.coins + 140);
  assert.throws(() => applyAction(rewarded, { type: 'mission', id: 'firstExhibit' }, now + 10 * hour), /無法領取/);
});

test('offline tickets respect the time and balance limits', () => {
  const open = { type: 'setExhibit', open: true };
  const equipped = applyAction(existingAquarium(), { type: 'upgradeEquipment', id: 'filter' }, now).state;
  activeTank(equipped).clarity = 100;
  const simple = applyAction(equipped, open, now).state;
  assert.equal(exhibitView(activeTank(simple), now + 48 * hour, alive, load).claimable,
    exhibitView(activeTank(simple), now + 12 * hour, alive, load).claimable);
  const varied = existingAquarium([male, { ...male, speciesId: 'neon' }, { ...male, speciesId: 'betta' }]);
  activeTank(varied).decorations = ['grass', 'rock', 'wood'].map(kind => ({ kind }));
  const popular = applyAction(varied, open, now).state;
  assert.equal(exhibitView(activeTank(popular), now + 48 * hour, alive, load).claimable, 500);
});

test('all 15 freshwater species can be purchased, loaded and used as parents', () => {
  assert.equal(Object.keys(FISH).length, 15);
  for (const speciesId of Object.keys(FISH)) {
    let state = existingAquarium([]);
    for (const sex of ['male', 'female']) {
      state = applyAction(state, { type: 'purchase', speciesId, sex }, now, () => sex).state;
    }
    const restored = readTrial(JSON.stringify(state));
    assert.equal(load(activeTank(restored), now), 2 * FISH[speciesId].points);
    assert.equal(pairOptions(restored, now).length, 1);
    assert.equal(state.coins, 5_000 - 2 * FISH[speciesId].price);
  }
});

test('larger tanks dilute water waste without changing the behavior of 30-point tanks', () => {
  const small = activeTank(existingAquarium());
  const large = { ...small, capacity: 120 };
  const future = now + 20 * hour;
  const smallLoss = small.clarity - settleTankFacilities(small, future, alive, load).clarity;
  const largeLoss = large.clarity - settleTankFacilities(large, future, alive, load).clarity;
  assert.ok(Math.abs(smallLoss - 2.2) < .000001);
  assert.ok(Math.abs(largeLoss - smallLoss / 4) < .000001);
});
