import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { setTimeout as delay } from 'node:timers/promises';
import { createServer } from 'node:http';
import { extname, join, resolve, sep } from 'node:path';

const root = resolve(import.meta.dirname, '..', 'aqua-world');
const types = { '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript', '.js': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png' };
const exercise = `
(async () => {
  const marker = document.createElement('meta');
  marker.id = 'aqua-smoke';
  document.head.append(marker);
  const find = selector => document.querySelector(selector);
  async function until(test, label, timeout = 10_000) {
    const deadline = performance.now() + timeout;
    while (performance.now() < deadline) {
      if (test()) return;
      await new Promise(resolve => setTimeout(resolve, 30));
    }
    throw new Error(label + ' / ' + find('#feeding-status')?.textContent + ' / ' + find('#food')?.textContent);
  }
  try {
    await until(() => find('#stage canvas') && find('#stage').dataset.scene === 'river'
      && find('#stage').dataset.renderEngine === 'webgl' && find('#stage').dataset.fishArt === 'illustrated', 'WebGL aquarium with illustrated fish');
    if (getComputedStyle(document.documentElement).colorScheme !== 'light'
      || getComputedStyle(find('.care')).backgroundColor !== 'rgb(255, 254, 250)') throw new Error('Expected light interface');
    find('#tank-list .tank-option:nth-child(2)').click();
    await until(() => find('#stage').dataset.scene === 'studio' && !find('#stage-message').hidden
      && find('#tank-count').textContent.includes('0'), 'empty showcase aquarium');
    find('#tank-list .tank-option').click();
    await until(() => find('#stage').dataset.scene === 'river' && find('#stage-message').hidden, 'return to river aquarium');
    const previousArt = ['river.jpg', 'studio.jpg', 'art-v030.json', 'fish-profiles/'];
    if (performance.getEntriesByType('resource').some(entry => previousArt.some(path => entry.name.includes(path)))) {
      throw new Error('Previous aquarium photographs were requested');
    }
    const food = () => Number(find('#food').textContent);
    const startingFood = food();
    find('#fish-list .fish-option').click();
    const singleFeed = [...find('#fish-card').querySelectorAll('button')].find(button => button.textContent === '單獨餵食');
    singleFeed.click();
    await until(() => food() === startingFood - 1 && find('#feeding-status').textContent.includes('0／1'), 'single fish receives one portion');
    await until(() => find('#stage').dataset.feeding === 'eaten' && find('#feeding-status').textContent.includes('1／1'), 'single fish eats', 16_000);
    find('#feed').click();
    await until(() => food() === startingFood - 3 && find('#feeding-status').textContent.includes('0／2'), 'only the two hungry fish receive portions');
    await until(() => find('#stage').dataset.feeding === 'eaten' && find('#feeding-status').textContent.includes('2／2'), 'the two fish eat their portions', 16_000);
    find('#tank-list .tank-option:nth-child(2)').click();
    await until(() => find('#stage').dataset.scene === 'studio' && find('#feeding-status').hidden, 'meal state clears when switching tanks');
    find('#tank-list .tank-option').click();
    await until(() => find('#stage').dataset.scene === 'river', 'return to fed aquarium');
    await until(() => find('#career-track').textContent.includes('迎接一條魚苗'), 'mission tracker');
    find('[data-career=shop]').click();
    await until(() => find('#career-content .career-card button'), 'shop');
    const thumbnails = [...document.querySelectorAll('#career-content .career-fish-photo')];
    if (thumbnails.length !== 3 || new Set(thumbnails.map(canvas => canvas.toDataURL())).size !== 3) {
      throw new Error('Expected three distinct illustrated fish in the shop');
    }
    for (const canvas of thumbnails) {
      const ctx = canvas.getContext('2d');
      const picture = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let painted = 0;
      for (let i = 3; i < picture.length; i += 4) if (picture[i] > 96) painted++;
      if (painted < 550 || picture[3] !== 0) throw new Error('Fish preview is blank or lacks transparency');
    }
    find('#career-content .career-card button').click();
    await until(() => find('#coins').textContent === '4,880' && find('#fish-list').children.length === 4, 'purchase and rerender');
    find('#career-close').click();
    find('[data-career=missions]').click();
    find('#career-content button:not(:disabled)').click();
    await until(() => find('#coins').textContent === '5,060', 'mission claim');
    find('#career-close').click();
    find('[data-career=breed]').click();
    await until(() => find('#career-content select'), 'pair preview');
    find('#career-content button').click();
    await until(() => find('.career-time')?.textContent.includes('6 小時'), 'start breeding');
    find('#career-close').click();
    find('#water').click();
    await until(() => find('#water-metrics').textContent.includes('100%'), 'existing water action');
    const getSave = () => JSON.parse(localStorage.getItem('aqua-world:trial:v1'));
    const decor = () => getSave().tanks.find(tank => tank.id === 'river').decorations;
    const count = decor().length;
    find('#decor-tab').click();
    find('[data-decor=grass]').click();
    find('#place-center').click();
    await until(() => decor().length === count + 1, 'add 3D decoration');
    const placed = decor().at(-1);
    find('[data-move=right]').click();
    await until(() => decor().find(item => item.id === placed.id).x > placed.x, 'move 3D decoration');
    const save = getSave();
    if (save.career.jobs.length !== 1 || save.career.claimed[0] !== 'stock') throw new Error('Legacy care action lost career save');
    const river = () => getSave().tanks.find(tank => tank.id === 'river');
    const beforeEquipment = getSave().coins;
    find('[data-career=facilities]').click();
    find('#career-content .facility-card button').click();
    await until(() => river().equipment?.filter === 1 && getSave().coins === beforeEquipment - 420, 'install filter');
    find('#career-content .facility-card:nth-of-type(2) button').click();
    await until(() => river().equipment?.heater === 1, 'install heater');
    const temperature = find('#career-content .facility-setting select');
    temperature.value = '27';
    temperature.dispatchEvent(new Event('change'));
    find('#career-content .facility-setting button').click();
    await until(() => river().equipment?.target === 27, 'adjust thermostat');
    find('#career-close').click();
    find('[data-career=visitors]').click();
    find('#career-content .career-row button').click();
    await until(() => river().exhibit?.open, 'open visitor exhibit');
    find('#career-close').click();
    const originalNow = Date.now;
    const beforeTickets = getSave().coins;
    Date.now = () => originalNow() + 2 * 3_600_000;
    try {
      find('#care-tab').click();
      find('#water').click();
      await until(() => river().exhibit.unclaimed >= 1 && river().temperature > 25, 'legacy care settles tickets and heat');
      find('[data-career=visitors]').click();
      const claim = [...find('#career-content').querySelectorAll('button')]
        .find(button => button.textContent === '領取門票收益');
      if (claim.disabled) throw new Error('Visitor tickets did not accrue');
      claim.click();
      await until(() => getSave().coins > beforeTickets && find('#career-status').textContent.includes('門票收益'), 'claim tickets');
    } finally {
      Date.now = originalNow;
    }
    find('#career-close').click();
    marker.content = 'PASS';
  } catch (error) {
    marker.content = error.message;
  }
  return marker.content;
})()`;

const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    const path = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!path.startsWith(root + sep)) throw new Error('Invalid path');
    const contents = await readFile(path);
    response.setHeader('Content-Type', types[extname(path)] ?? 'application/octet-stream');
    response.end(contents);
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const profile = await mkdtemp(join(tmpdir(), 'aqua-chrome-'));
const chrome = spawn('google-chrome', ['--headless', '--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1440,940',
  '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank']);
let diagnostics = '';
chrome.stderr.on('data', data => { diagnostics += data; });
let browserError;
chrome.on('error', error => { browserError = error; });
const closed = new Promise(resolve => chrome.once('close', resolve));
let ws;
try {
  let port;
  for (let attempt = 0; attempt < 100 && !port; attempt++) {
    if (browserError) throw browserError;
    port = await readFile(join(profile, 'DevToolsActivePort'), 'utf8').then(value => Number(value.split('\n')[0]), () => undefined);
    if (!port) await delay(100);
  }
  assert.ok(port, diagnostics);
  const pages = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json();
  ws = new WebSocket(pages.find(page => page.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  const pending = new Map();
  const exceptions = [];
  const shaderErrors = [];
  let commandId = 0;
  ws.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') {
      exceptions.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text);
    }
    if (message.method === 'Log.entryAdded' && /shader error|validation error|linking error|THREE\.WebGLProgram/i.test(message.params.entry.text)) {
      shaderErrors.push(message.params.entry.text);
    }
    const call = pending.get(message.id);
    if (!call) return;
    pending.delete(message.id);
    if (message.error) call.reject(new Error(message.error.message));
    else call.resolve(message.result);
  };
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++commandId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
  await call('Runtime.enable');
  await call('Page.enable');
  await call('Log.enable');
  await call('Page.navigate', { url: 'http://127.0.0.1:' + server.address().port });
  const evaluate = (expression, awaitPromise = false) => call('Runtime.evaluate', { expression, awaitPromise, returnByValue: true });
  for (let attempt = 0; attempt < 100; attempt++) {
    const response = await evaluate("location.hostname === '127.0.0.1' && document.readyState === 'complete'");
    if (response.result.value === true) break;
    await delay(50);
  }
  const response = await evaluate(exercise, true);
  const diagnostic = await evaluate("JSON.stringify({feedback: document.getElementById('feedback')?.textContent, loaded: performance.getEntriesByType('resource').map(entry => new URL(entry.name).pathname)})");
  assert.equal(response.result.value, 'PASS', JSON.stringify({ result: response.result.value, errors: exceptions, state: diagnostic.result.value }));
  assert.deepEqual(shaderErrors, []);
  await call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await delay(150);
  const mobile = await evaluate("document.documentElement.scrollWidth <= 391 && document.querySelector('#stage').getBoundingClientRect().width > 300");
  assert.equal(mobile.result.value, true, 'Phone viewport must show the tank without horizontal overflow');
  assert.deepEqual(exceptions, []);
  console.log('Aqua World Chrome smoke test PASS (illustrated fish in two WebGL tanks, desktop and phone layout, shop, missions, breeding, decoration, individual and full-tank feeding, equipment, visitor tickets, and saves)');
} finally {
  ws?.close();
  chrome.kill();
  await closed;
  server.close();
  await rm(profile, { recursive: true, force: true });
}
