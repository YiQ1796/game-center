import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = name => readFileSync(new URL('../stack-battle/' + name, import.meta.url), 'utf8');
const html = read('index.html');
const game = read('game.mjs');
const css = read('game.css');
const ranking = read('ranking.mjs');
const room = read('room.mjs');

test('Mobile gamepad has one rotation, no hold and five large actions', () => {
  const controls = html.split('<div class="controls"')[1].split('<div id="room-quick-actions"')[0];
  const actions = [...controls.matchAll(/data-action="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(actions, ['l', 'r', 'd', 'h', 's']);
  assert.doesNotMatch(html, /id="hold"/);
  assert.doesNotMatch(game, /KeyC:|KeyZ:|drawPreview\('hold'/);
  assert.match(css, /grid-template-rows: repeat\(2, minmax\(76px, auto\)\)/);
  assert.match(css, /\[data-action="h"\] \{ grid-area: 1 \/ 5 \/ 2 \/ 7;/);
  assert.match(css, /\[data-action="s"\] \{ grid-area: 2 \/ 4 \/ 3 \/ 7;/);
  assert.match(css, /-webkit-user-select: none/);
  assert.match(game, /\['selectstart', 'contextmenu'\]/);
});

test('Single-player leaderboard auto-submits with retry and strict player ID', () => {
  assert.match(game, /void uploadSoloScore\(solo\)/);
  assert.match(game, /replayActions = \[\.\.\.actions\]/);
  assert.match(game, /至少消除一行才能登上公開歷史榜/);
  assert.match(game, /排行榜回傳非預期結果/);
  assert.match(ranking, /const PLAYER_ID_PATTERN = .*4\[a-f0-9\]/);
  assert.match(html, /結算後自動登錄公開 TOP 100/);
});

test('Public history is shared via direct URL and rendered from server rather than local best', () => {
  assert.match(game, /requestedMode === 'rank'/);
  assert.match(game, /void showRank\(\)/);
  assert.match(game, /setText\('public-best-score', top \? format\(top.score\)/);
  assert.match(game, /url.searchParams.set\('mode', 'rank'\)/);
  assert.doesNotMatch(game, /sanmao-blocks-best-v1/);
  assert.match(html, /id="rank-share"/);
  assert.match(html, /id="rank-share-status"/);
  assert.match(html, /id="public-best-score"/);
  assert.match(html, /所有朋友共用雲端歷史 TOP 100/);
});

test('Multiplayer loads the same new endless gravity engine without stale cache', () => {
  assert.match(game, /room.mjs\?v=140/);
  assert.match(room, /engine.mjs\?v=132/);
});

test('Active gameplay blocks Safari long-press text selection outside control buttons', () => {
  // Screenshot regression: iOS selected the monkey dialogue above the controller.
  assert.match(css, /body\[data-playing\] \.play \*/);
  assert.match(css, /body\[data-live-duel\] \.play \*/);
  assert.match(css, /body\[data-playing\] \.top \*/);
  assert.match(css, /-webkit-touch-callout: none/);
  assert.match(game, /document\.addEventListener\('selectionchange'/);
  assert.match(game, /document\.addEventListener\(eventName/);
  assert.match(game, /\$\('controls'\)\.addEventListener\('touchstart'/);
  assert.match(game, /\{ passive: false \}/);
  assert.match(game, /function clearGameplaySelection\(\)/);
  assert.match(game, /selection\?\.rangeCount/);
  assert.match(game, /gameplaySurface\(selection\.anchorNode\)/);
  assert.match(game, /\$\('help-dialog'\)\.open/);
  assert.match(html, /V1\.3\.3/);
});

test('Guest input prediction and snapshot throttling are present', () => {
  assert.match(room, /supportsPrediction: true/);
  assert.match(room, /this\.pendingGuestActions\.push/);
  assert.match(room, /inputAcknowledged/);
  assert.match(room, /applyAction\(this\.predictedMatch\.players\[1\]/);
  assert.match(room, /snapshotNumber <= \(this\.lastSnapshotNumberSeen \|\| 0\)/);
  assert.match(room, /SNAPSHOT_INTERVAL_MS = 125/);
  assert.match(room, /GUEST_CLOCK_REFRESH_MS = 250/);
});
test('WSS relay coalesces Stack Battle snapshots without changing other games', () => {
  const relay = readFileSync(new URL('../one-a-two-b/relay-transport.mjs', import.meta.url), 'utf8');
  assert.match(relay, /namespace === 'sanmao-blocks-v1' && payload\?\.type === 'state'/);
  assert.match(relay, /entry\.latestState = payload/);
  assert.match(relay, /sendEncrypted\(latest, 0\)/);
});
