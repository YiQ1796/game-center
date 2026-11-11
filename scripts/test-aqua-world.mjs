import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SAVE_KEY, applyAction, activeTank, pairOptions, patternOf, readTrial, recessiveChance, salesToday } from '../aqua-world/assets/aquarium-career.mjs';

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
