import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';

const root = resolve(import.meta.dirname, '..', 'aqua-world');
const types = { '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript', '.js': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp' };
const exercise = `
<script type="module">
  const marker = document.createElement('meta');
  marker.id = 'aqua-smoke';
  document.head.append(marker);
  const find = selector => document.querySelector(selector);
  async function until(test, label) {
    for (let attempt = 0; attempt < 140; attempt++) {
      if (test()) return;
      await new Promise(resolve => setTimeout(resolve, 30));
    }
    throw new Error(label + ' / ' + document.getElementById('career-status')?.textContent);
  }
  try {
    await until(() => find('#stage canvas') && find('.stage.has-tank-art'), 'scene and photo');
    await until(() => find('#career-track').textContent.includes('迎接一條魚苗'), 'mission tracker');
    find('[data-career=shop]').click();
    await until(() => find('#career-content .career-card button'), 'shop');
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
    const save = JSON.parse(localStorage.getItem('aqua-world:trial:v1'));
    if (save.career.jobs.length !== 1 || save.career.claimed[0] !== 'stock') throw new Error('Legacy care action lost career save');
    marker.content = 'PASS';
  } catch (error) {
    marker.content = error.message;
  }
</script>`;

const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    const path = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!path.startsWith(root + sep)) throw new Error('Invalid path');
    const contents = await readFile(path);
    response.setHeader('Content-Type', types[extname(path)] ?? 'application/octet-stream');
    response.end(pathname === '/' ? contents.toString('utf8').replace('</body>', exercise + '</body>') : contents);
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
try {
  const url = 'http://127.0.0.1:' + server.address().port;
  const chrome = spawn('google-chrome', ['--headless', '--no-sandbox', '--disable-gpu',
    '--window-size=1440,900', '--virtual-time-budget=18000', '--dump-dom', url]);
  let html = '';
  let diagnostics = '';
  chrome.stdout.on('data', data => { html += data; });
  chrome.stderr.on('data', data => { diagnostics += data; });
  const code = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { chrome.kill(); reject(new Error('Chrome smoke test timed out')); }, 45_000);
    chrome.once('error', error => { clearTimeout(timeout); reject(error); });
    chrome.once('close', code => { clearTimeout(timeout); resolve(code); });
  });
  assert.equal(code, 0, diagnostics);
  assert.match(html, /<meta id="aqua-smoke" content="PASS">/, html.match(/<meta id="aqua-smoke"[^>]*>/)?.[0] ?? diagnostics);
  console.log('Aqua World Chrome smoke test PASS (art, shop, missions, breeding and existing saves)');
} finally {
  server.close();
}
