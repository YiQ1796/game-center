import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const read = (name) => readFileSync(resolve(root, name), 'utf8');
const html = read('index.html');
const source = read('assets/games.js');
const context = {window: {}};
vm.runInNewContext(source, context, { timeout: 1000 });
const games = Array.from(context.window.SANMAO_GAMES || []);
const expected = new Map([
  ['wealth-empire', 'https://yiq1796.github.io/Wealth_Empire/v20/'],
  ['big-two', 'https://yiq1796.github.io/BigTwo_Web/'],
  ['rummikub', 'https://yiq1796.github.io/Rummikub_Web/'],
  ['aqua-world', 'https://yiq1796.github.io/game-center/aqua-world/'],
  ['one-a-two-b', 'https://yiq1796.github.io/game-center/one-a-two-b/'],
]);
assert.equal(games.length, expected.size, 'Expected one card per game');
assert.equal(new Set(games.map(game => game.id)).size, expected.size, 'Game IDs must be unique');
for (const game of games) {
  assert.equal(game.url, expected.get(game.id), `Incorrect game link: ${game.id}`);
  assert.ok(game.url.startsWith('https://yiq1796.github.io/'), 'Only approved game domains allowed');
  if (game.visualType === 'rummikub-illustration') {
    assert.equal(game.id, 'rummikub', 'Only Rummikub should use DOM tile artwork');
    assert.equal(game.status, 'beta', 'Rummikub network UAT has not passed');
    assert.ok(existsSync(resolve(root, 'assets/hero-clubhouse.webp')), 'Missing full-size approved monkey artwork');
  } else if (game.id === 'aqua-world') {
    assert.equal(game.visualType, 'aqua-world-label');
    assert.equal(game.status, 'beta', 'Aqua World is a solo trial');
    assert.match(read('aqua-world/index.html'), /水族世界 Aqua World/);
    assert.equal(JSON.parse(read('aqua-world/build-info.json')).mode, 'solo-trial');
  } else if (game.id === 'one-a-two-b') {
    assert.equal(game.visualType, 'one-a-two-b-showcase');
    assert.equal(game.status, 'beta');
  } else {
    assert.match(game.image, /^assets\/[\w-]+\.webp$/, 'Image path invalid');
    assert.ok(existsSync(resolve(root, game.image)), `Missing ${game.image}`);
  }
}
assert.match(html, /猴三毛遊戲中心/);
assert.match(html, /https:\/\/yiq1796\.github\.io\/game-center\//);
assert.match(html, /V0\.8\.3/);
assert.ok(!html.includes('utm_source='), 'Do not include tracking parameters');
const styleSource = read('assets/site.css');
const uiSource = read('assets/site.js');
assert.ok(styleSource.includes('.rummikub-showcase'), 'Rummikub illustration styles missing');
assert.ok(uiSource.includes("rummikub-showcase"), 'Rummikub illustration render missing');
assert.ok(styleSource.includes('.aqua-world-showcase'), 'Aqua World card styles missing');
assert.ok(uiSource.includes('aqua-world-showcase'), 'Aqua World card render missing');
assert.ok(!uiSource.includes('rummikub-mascot'), 'Old small avatar render must be disabled');
for(const path of ['assets/mascot-logo.webp','assets/hero-clubhouse.webp','assets/club-welcome.webp']){
 assert.ok(existsSync(resolve(root, path)), `Missing ${path}`);
}
console.log('Game center structural tests PASS (links, artwork, scripts, version)');
assert.ok(styleSource.includes('.one-a-two-b-showcase'), '1A2B card styles missing');
assert.ok(uiSource.includes('one-a-two-b-showcase'), '1A2B card render missing');
await import('./verify-one-a-two-b.mjs');
// Prepare the assets served by Pages and exercise the current aquarium before upload.
await import('./prepare-aqua-world.mjs');
execFileSync(process.execPath, ['--test', resolve(root, 'scripts/test-aqua-world.mjs')], { stdio: 'inherit' });
await import('./smoke-aqua-world.mjs');
await import('./inspect-aqua-fish-sources.mjs');
