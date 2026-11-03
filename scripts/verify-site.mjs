import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const root = resolve(import.meta.dirname, '..');
const read = (name) => readFileSync(resolve(root, name), 'utf8');
const html = read('index.html');
const source = read('assets/games.js');
const context = {window: {}};
vm.runInNewContext(source, context, { timeout: 1000 });
const games = Array.from(context.window.SANMAO_GAMES || []);
assert.equal(games.length, 3, 'Expected three featured games');
assert.equal(new Set(games.map(game => game.id)).size, 3, 'Game IDs must be unique');
const expected = new Map([
  ['wealth-empire', 'https://yiq1796.github.io/Wealth_Empire/v20/'],
  ['big-two', 'https://yiq1796.github.io/BigTwo_Web/'],
  ['rummikub', 'https://yiq1796.github.io/Rummikub_Web/'],
]);
for (const game of games) {
  assert.equal(game.url, expected.get(game.id), `Incorrect game link: ${game.id}`);
  assert.ok(game.url.startsWith('https://yiq1796.github.io/'), 'Only approved game domains allowed');
  if (game.visualType === 'rummikub-tiles') {
    assert.equal(game.id, 'rummikub', 'Only Rummikub should use DOM tile artwork');
    assert.equal(game.status, 'beta', 'Rummikub network UAT has not passed');
    assert.ok(existsSync(resolve(root, 'assets/mascot-logo.webp')), 'Missing mascot');
  } else {
    assert.match(game.image, /^assets\/[\w-]+\.webp$/, 'Image path invalid');
    assert.ok(existsSync(resolve(root, game.image)), `Missing ${game.image}`);
  }
}
assert.match(html, /猴三毛遊戲中心/);
assert.match(html, /https:\/\/yiq1796\.github\.io\/game-center\//);
assert.match(html, /V0\.8\.0/);
assert.ok(!html.includes('utm_source='), 'Do not include tracking parameters');
for(const path of ['assets/mascot-logo.webp','assets/hero-clubhouse.webp','assets/club-welcome.webp']){
 assert.ok(existsSync(resolve(root, path)), `Missing ${path}`);
}
console.log('Game center structural tests PASS (links, artwork, scripts, version)');
