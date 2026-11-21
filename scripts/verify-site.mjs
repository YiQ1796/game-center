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
  ['stack-battle', 'https://yiq1796.github.io/game-center/stack-battle/'],
  ['mystery-duo', 'https://yiq1796.github.io/game-center/mystery-duo/'],
  ['orchard-survival', 'https://yiq1796.github.io/game-center/orchard-survival/'],
]);
assert.equal(games.length, expected.size, 'Expected one card per game');
const approvedGames = new Set(['big-two', 'rummikub', 'one-a-two-b']);
for (const game of games) {
  if (approvedGames.has(game.id)) assert.equal(game.status, 'available', `${game.id} must show 立即進入`);
}
assert.equal(games.find(game => game.id === 'aqua-world').status, 'beta', 'Aquarium remains a trial');
assert.equal(new Set(games.map(game => game.id)).size, expected.size, 'Game IDs must be unique');
for (const game of games) {
  assert.equal(game.id === 'mystery-duo' ? game.url.replace(/\?v=200$/, '') : game.url, expected.get(game.id), `Incorrect game link: ${game.id}`);
  assert.ok(game.url.startsWith('https://yiq1796.github.io/'), 'Only approved game domains allowed');
  if (game.visualType === 'rummikub-illustration') {
    assert.equal(game.id, 'rummikub', 'Only Rummikub should use DOM tile artwork');
    assert.equal(game.status, 'available', 'Rummikub passed user acceptance');
    assert.ok(existsSync(resolve(root, 'assets/hero-clubhouse.webp')), 'Missing full-size approved monkey artwork');
  } else if (game.id === 'mystery-duo') {
    assert.equal(game.visualType, 'mystery-cabinet');
    assert.ok(existsSync(resolve(root,'mystery-duo/index.html')));
    assert.match(read('mystery-duo/index.html'), /id="game-canvas"/);
    assert.match(read('mystery-duo/index.html'), /v2\.js\?v=200/);
    for(const file of ['engine.js','art.js','v2.js']) assert.ok(existsSync(resolve(root,'mystery-duo',file)), `Missing V2 game component: ${file}`);
    assert.ok(read('assets/site.js').includes("game.visualType === 'mystery-cabinet'"));
  } else if (game.id === 'aqua-world') {
    assert.equal(game.image, 'assets/aqua-world-sanmao-cover-v1.webp');
    assert.match(game.imageAlt, /猴三毛/);
    assert.equal(game.status, 'beta', 'Aqua World is a solo trial');
    assert.match(read('aqua-world/index.html'), /水族世界 Aqua World/);
    assert.equal(JSON.parse(read('aqua-world/build-info.json')).mode, 'solo-trial');
    assert.ok(existsSync(resolve(root, game.image)), 'Missing aquarium cover');
  } else if (game.id === 'one-a-two-b') {
    assert.equal(game.image, 'assets/one-a-two-b-sanmao-cover-v1.webp');
    assert.match(game.imageAlt, /猴三毛/);
    assert.equal(game.status, 'available', '1A2B passed user acceptance');
    assert.ok(existsSync(resolve(root, game.image)), 'Missing 1A2B cover');
  } else if (game.id === 'orchard-survival') {
    assert.equal(game.status, 'beta');
    assert.equal(game.image, 'orchard-survival/art/orchard-cover.webp');
    assert.ok(existsSync(resolve(root, game.image)), 'Orchard mascot is missing');
    assert.match(read('orchard-survival/index.html'), /data-build="0\.8\.1"/);
  } else if (game.id === 'stack-battle') {
    assert.equal(game.status, 'beta');
    assert.equal(game.name, '方塊派對');
    assert.equal(game.image, 'assets/block-party-sanmao-cover-v1.webp');
    assert.match(game.imageAlt, /猴三毛/);
    assert.match(read('stack-battle/index.html'), /猴三毛方塊對戰/); // 遊戲本體名稱保留，首頁只更名卡片
    assert.ok(existsSync(resolve(root, game.image)), 'Block Party cover missing');
  } else {
    assert.match(game.image, /^assets\/[\w-]+\.webp$/, 'Image path invalid');
    assert.ok(existsSync(resolve(root, game.image)), `Missing ${game.image}`);
  }
}
assert.match(html, /猴三毛遊戲中心/);
assert.match(html, /https:\/\/yiq1796\.github\.io\/game-center\//);
assert.match(html, /V0\.9\.0/);
assert.ok(!html.includes('utm_source='), 'Do not include tracking parameters');
const styleSource = read('assets/site.css');
const uiSource = read('assets/site.js');
assert.ok(uiSource.includes("game.status === 'beta' ? '進入測試版 →' : '立即進入 →'"), 'Card buttons must follow approved game status');
assert.ok(styleSource.includes('.rummikub-showcase'), 'Rummikub illustration styles missing');
assert.ok(styleSource.includes('.game-stack-battle'), 'Block Party cover layout missing');
assert.ok(!uiSource.includes('stack-battle-showcase'), 'Old block avatar/render must be disabled');
assert.ok(!styleSource.includes('.stack-battle-showcase'), 'Old block CSS must be removed');
assert.ok(!styleSource.includes('.game-one-a-two-b .game-entry{'), '1A2B must use shared orange entry button');
assert.ok(styleSource.includes('background:var(--orange)'), 'Shared orange button missing');
assert.ok(uiSource.includes("rummikub-showcase"), 'Rummikub illustration render missing');
assert.ok(styleSource.includes('.game-aqua-world'), 'Aqua World image card styles missing');
assert.ok(!uiSource.includes('aqua-world-showcase'), 'Old Aqua World placeholder render remains');
assert.ok(!uiSource.includes('rummikub-mascot'), 'Old small avatar render must be disabled');
for(const path of ['assets/mascot-logo.webp','assets/hero-clubhouse.webp','assets/club-welcome.webp']){
 assert.ok(existsSync(resolve(root, path)), `Missing ${path}`);
}
console.log('Game center structural tests PASS (links, artwork, scripts, version)');
assert.ok(styleSource.includes('.game-one-a-two-b'), '1A2B image card styles missing');
assert.ok(!uiSource.includes('one-a-two-b-showcase'), 'Old 1A2B placeholder render remains');
assert.ok(uiSource.includes('game-illustration'), 'Shared image renderer missing');
await import('./verify-one-a-two-b.mjs');
execFileSync(process.execPath, ['--test', resolve(root, 'scripts/test-stack-battle.mjs')], { stdio: 'inherit' });
// Prepare the assets served by Pages and exercise the current aquarium before upload.
await import('./prepare-aqua-world.mjs');
execFileSync(process.execPath, ['--test', resolve(root, 'scripts/test-aqua-world.mjs')], { stdio: 'inherit' });
await import('./smoke-aqua-world.mjs');

execFileSync(process.execPath, ['--test', resolve(root, 'scripts/test-orchard.mjs')], { stdio: 'inherit' });
for (const name of ['content', 'advancement', 'sockets', 'arena', 'scene', 'squad', 'game', 'actors', 'garden', 'fitting-stage', 'radar', 'spells']) {
  execFileSync(process.execPath, ['--check', resolve(root, 'orchard-survival', name + '.mjs')]);
}

await import('./smoke-orchard.mjs');
