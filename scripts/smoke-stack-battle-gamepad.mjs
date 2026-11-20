import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join, resolve, sep } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

// Browser-level regression for phone-sized cross D-pad hit areas.
const root = resolve(import.meta.dirname, '..');
const contentTypes = {
  '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript',
  '.js': 'text/javascript', '.css': 'text/css',
  '.webp': 'image/webp', '.png': 'image/png', '.ico': 'image/x-icon'
};
const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    const file = resolve(root, '.' + pathname);
    if (!file.startsWith(root + sep)) throw new Error('Invalid path');
    const content = await readFile(file);
    response.setHeader('Content-Type', contentTypes[extname(file)] ?? 'application/octet-stream');
    response.end(content);
  } catch {
    response.writeHead(404).end();
  }
});

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const profile = await mkdtemp(join(tmpdir(), 'stack-battle-pad-'));
const chrome = spawn('google-chrome', [
  '--headless', '--no-sandbox', '--window-size=900,1000',
  '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank'
]);
let diagnostics = '';
chrome.stderr.on('data', bytes => { diagnostics += bytes; });
let browserError;
chrome.on('error', error => { browserError = error; });
const closed = new Promise(resolve => chrome.once('close', resolve));
let socket;

try {
  let port;
  for (let attempt = 0; attempt < 200 && !port; attempt++) {
    if (browserError) throw browserError;
    port = await readFile(join(profile, 'DevToolsActivePort'), 'utf8')
      .then(value => Number(value.split('\n')[0]), () => undefined);
    if (!port) await delay(100);
  }
  assert.ok(port, 'Chrome failed to start: ' + diagnostics);
  const pages = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json();
  const target = pages.find(page => page.type === 'page');
  assert.ok(target, 'Chrome page target not found');
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.onopen = resolve;
    socket.onerror = reject;
  });

  const pending = new Map();
  let commandId = 0;
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    const command = pending.get(message.id);
    if (!command) return;
    pending.delete(message.id);
    if (message.error) command.reject(new Error(message.error.message));
    else command.resolve(message.result);
  };
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++commandId;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  await call('Runtime.enable');
  await call('Page.enable');

  const address = 'http://127.0.0.1:' + server.address().port + '/stack-battle/index.html';
  for (const width of [320, 390, 430]) {
    await call('Emulation.setDeviceMetricsOverride', {
      width, height: 844, deviceScaleFactor: 2, mobile: true
    });
    await call('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await call('Page.navigate', { url: address + '?ci=v143-' + width });
    let ready = false;
    for (let attempt = 0; attempt < 150; attempt++) {
      const result = await call('Runtime.evaluate', {
        expression: `(() => {
          const button = document.getElementById('overlay-action');
          const controls = document.getElementById('controls');
          if (!button || !controls) return false;
          if (!document.body.hasAttribute('data-playing')) button.click();
          return document.body.hasAttribute('data-playing') &&
                 !controls.hidden && getComputedStyle(controls).display === 'grid';
        })()`,
        returnByValue: true
      });
      if (result.result.value === true) { ready = true; break; }
      await delay(100);
    }
    assert.ok(ready, 'Game module/layout did not load on ' + width + 'px viewport');
    const response = await call('Runtime.evaluate', {
      expression: `(() => {
        const controls = document.getElementById('controls');
        if (controls.hidden) throw new Error('Gamepad was not revealed after starting');
        const lookup = action => {
          const el = controls.querySelector('[data-action="' + action + '"]');
          if (!el) throw new Error('Missing action ' + action);
          const r = el.getBoundingClientRect();
          if (r.width < 44 || r.height < 44)
            throw new Error('Action ' + action + ' too small: ' + r.width + 'x' + r.height);
          return { x: r.x, y: r.y, w: r.width, h: r.height,
                   cx: r.x + r.width/2, cy: r.y + r.height/2 };
        };
        const up = lookup('s'), left = lookup('l'), right = lookup('r');
        const down = lookup('d'), drop = lookup('h');
        const assert = (ok, message) => { if (!ok) throw new Error(message); };
        assert(up.cy < left.cy && left.cy < down.cy, 'D-pad vertical cross placement');
        assert(left.cx < up.cx && up.cx < right.cx, 'D-pad horizontal cross placement');
        assert(Math.abs(left.cy - right.cy) < 3, 'Left/right must share a row');
        assert(Math.abs(up.cx - down.cx) < 3, 'Up/down must share a column');
        assert(drop.x + drop.w < left.x - 2, 'Hard-drop must sit separately on the left');
        assert(drop.h >= 2.3 * up.h && drop.h <= 3.0 * up.h, 'Hard-drop height must fill the marked red touch area');
        assert(drop.w >= (innerWidth <= 355 ? 84 : 100), 'Hard-drop width is below the marked touch area');
        assert(Math.abs(left.h - 64) <= (innerWidth <= 355 ? 7 : 2), 'Left button must match its marked height');
        assert(Math.abs(right.h - left.h) < 2, 'Left/right button heights must match');
        assert(up.w >= (innerWidth <= 355 ? 70 : 82), 'Up rotation button remains too small');
        assert(controls.getBoundingClientRect().height <= 205, 'Controller should not obscure the board');
        assert(getComputedStyle(controls).userSelect === 'none' ||
               getComputedStyle(controls).webkitUserSelect === 'none',
               'Gamepad text selection is enabled');
        return { width: innerWidth, up, left, right, down, drop };
      })()`,
      returnByValue: true
    });
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description);
    assert.equal(response.result.value.width, width);
    // Exercise both event paths in the real browser. Layout-only checks
    // previously missed a Safari rotation button that silently ignored taps.
    const pointerCheck = await call('Runtime.evaluate', {
      expression: `(() => {
        const rotate = document.querySelector('[data-action="s"]');
        const hardDrop = document.querySelector('[data-action="h"]');
        const board = document.getElementById('board');
        const fingerprint = () => {
          const pixels = board.getContext('2d').getImageData(0, 0, board.width, board.height).data;
          let hash = 2166136261;
          for (let i = 0; i < pixels.length; i += 73) {
            hash = Math.imul(hash ^ pixels[i], 16777619) >>> 0;
          }
          return hash;
        };
        const press = id => {
          rotate.dispatchEvent(new PointerEvent('pointerdown', {
            bubbles: true, cancelable: true, pointerType: 'touch', pointerId: id, button: 0
          }));
          const changed = fingerprint();
          rotate.dispatchEvent(new PointerEvent('pointerup', {
            bubbles: true, pointerType: 'touch', pointerId: id, button: 0
          }));
          return changed;
        };
        let before = fingerprint();
        let after = press(908);
        // An O (square) piece does not visibly rotate, so advance one piece.
        if (after === before) {
          hardDrop.click();
          before = fingerprint();
          after = press(909);
        }
        if (after === before) throw new Error('Pointer press did not rotate a rotatable piece');
        rotate.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
        if (fingerprint() !== after)
          throw new Error('Pointer press caused duplicate rotation via synthesized click');
        return true;
      })()`,
      returnByValue: true
    });
    if (pointerCheck.exceptionDetails || pointerCheck.result.value !== true)
      throw new Error('Pointer rotation test failed: ' +
        (pointerCheck.exceptionDetails?.exception?.description ?? JSON.stringify(pointerCheck.result)));
    await delay(120);
    const touchCheck = await call('Runtime.evaluate', {
      expression: `(() => {
        const rotate = document.querySelector('[data-action="s"]');
        const board = document.getElementById('board');
        const fingerprint = () => {
          const pixels = board.getContext('2d').getImageData(0, 0, board.width, board.height).data;
          let hash = 2166136261;
          for (let i = 0; i < pixels.length; i += 73) hash = Math.imul(hash ^ pixels[i], 16777619) >>> 0;
          return hash;
        };
        const before = fingerprint();
        const box = rotate.getBoundingClientRect();
        const finger = new Touch({
          identifier: 911, target: rotate,
          clientX: box.left + box.width / 2, clientY: box.top + box.height / 2
        });
        rotate.dispatchEvent(new TouchEvent('touchstart', {
          bubbles: true, cancelable: true,
          touches: [finger], targetTouches: [finger], changedTouches: [finger]
        }));
        const after = fingerprint();
        rotate.dispatchEvent(new TouchEvent('touchend', {
          bubbles: true, cancelable: true,
          touches: [], targetTouches: [], changedTouches: [finger]
        }));
        if (after === before) throw new Error('Touchstart fallback did not rotate');
        return true;
      })()`,
      returnByValue: true
    });
    if (touchCheck.exceptionDetails || touchCheck.result.value !== true)
      throw new Error('Safari touchstart fallback test failed: ' +
        (touchCheck.exceptionDetails?.exception?.description ?? JSON.stringify(touchCheck.result)));
    console.log('Stack Battle red-box D-pad Chrome ' + width + 'px PASS (layout + pointer + touch rotation)');
  }
} finally {
  socket?.close();
  chrome.kill();
  await closed;
  server.close();
  await rm(profile, { recursive: true, force: true });
}
