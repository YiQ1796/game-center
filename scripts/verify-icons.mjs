import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join, resolve} from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'index.html'), 'utf8');
const manifest = JSON.parse(readFileSync(join(root, 'site.webmanifest'), 'utf8'));
const expectedFiles = new Map([
  ['favicon.ico', null],
  ['assets/icons/favicon-32-v070.png', 32],
  ['assets/icons/apple-touch-icon-v070.png', 180],
  ['assets/icons/app-icon-192-v070.png', 192],
  ['assets/icons/app-icon-512-v070.png', 512],
  ['assets/icons/app-maskable-512-v070.png', 512],
]);
for (const [assetPath, requiredSize] of expectedFiles) {
  const diskPath = join(root, assetPath);
  assert.ok(existsSync(diskPath), `Missing icon ${assetPath}`);
  const bytes = readFileSync(diskPath);
  assert.ok(bytes.length > 100, `Empty icon ${assetPath}`);
  if (requiredSize) {
    assert.equal(bytes.subarray(1, 4).toString('ascii'), 'PNG', 'Invalid PNG header');
    assert.equal(bytes.readUInt32BE(16), requiredSize, `Wrong width: ${assetPath}`);
    assert.equal(bytes.readUInt32BE(20), requiredSize, `Wrong height: ${assetPath}`);
  }
}
assert.equal(manifest.name, '猴三毛遊戲中心');
assert.equal(manifest.start_url, './');
assert.equal(manifest.scope, './');
assert.equal(manifest.display, 'standalone');
assert.equal(manifest.icons.length, 3);
for (const item of manifest.icons) {
  assert.equal(item.type, 'image/png');
  const path = item.src.replace(/^\.\//, '');
  assert.ok(expectedFiles.has(path), `Unknown manifest icon ${item.src}`);
}
for (const fragment of [
  'href="./site.webmanifest?v=070"',
  'apple-touch-icon-v070.png',
  'favicon-32-v070.png',
  'V0.7.0',
  'https://yiq1796.github.io/game-center/',
]) assert.ok(html.includes(fragment), `HTML missing ${fragment}`);
assert.ok(!html.includes('rel="icon" href="assets/mascot-logo.webp"'), 'Old favicon render source was not removed');
console.log('HouSanMao V0.7.0 icon integration PASS');
