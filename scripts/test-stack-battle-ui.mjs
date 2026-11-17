import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = name => readFileSync(new URL('../stack-battle/' + name, import.meta.url), 'utf8');
const html = read('index.html');
const game = read('game.mjs');
const css = read('game.css');
const ranking = read('ranking.mjs');

test('Mobile gamepad has one rotation, no hold and five large actions', () => {
  const controls = html.split('<div class="controls"')[1].split('<div id="room-quick-actions"')[0];
  const actions = [...controls.matchAll(/data-action="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(actions, ['l', 'r', 'd', 's', 'h']);
  assert.doesNotMatch(html, /id="hold"/);
  assert.doesNotMatch(game, /KeyC:|KeyZ:|drawPreview\('hold'/);
  assert.match(css, /grid-template-rows: repeat\(2, minmax\(76px, auto\)\)/);
  assert.match(css, /-webkit-user-select: none/);
  assert.match(game, /\['selectstart', 'contextmenu'\]/);
});

test('Single-player leaderboard auto-submits with retry and strict player ID', () => {
  assert.match(game, /void uploadSoloScore\(solo\)/);
  assert.match(game, /replayActions = \[\.\.\.actions\]/);
  assert.match(game, /至少消除一行才能登上公開歷史榜/);
  assert.match(game, /排行榜回傳非預期結果/);
  assert.match(ranking, /const PLAYER_ID_PATTERN = .*4\[a-f0-9\]/);
  assert.match(html, /結算後自動送出合格成績/);
});
