import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyAction, createPlayer } from '../stack-battle/engine.mjs';

// Read the same endpoint as the browser. Never write real scores during smoke tests.
const source = readFileSync(new URL('../stack-battle/ranking.mjs', import.meta.url), 'utf8');
const endpoint = source.match(/const ENDPOINT = '([^']+)'/)?.[1];
assert.ok(endpoint, 'Leaderboard endpoint is missing');
const origin = 'https://yiq1796.github.io';

function sampleReplay() {
  const actions = 'lllh rh rrrrh'.replaceAll(' ', '');
  for (let seed = 1; seed < 20000; seed++) {
    const player = createPlayer(seed);
    if (player.piece.type + player.queue.slice(0, 2).join('') !== 'IJL') continue;
    for (const action of actions) assert.ok(applyAction(player, action));
    assert.equal(player.lines, 1);
    return { seed, actions, player };
  }
  throw new Error('No deterministic replay for leaderboard health check');
}

async function request(method, body) {
  const response = await fetch(endpoint, {
    method,
    headers: {
      Origin: origin,
      ...(body ? { 'Content-Type': 'text/plain;charset=UTF-8' } : {})
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
    redirect: 'follow'
  });
  const allowed = response.headers.get('access-control-allow-origin');
  console.log(method, 'status=', response.status, 'url=', new URL(response.url).host,
    'CORS allowed origin=', allowed ?? '(none)');
  const raw = await response.text();
  if (!response.ok) throw new Error(method + ' returned HTTP ' + response.status);
  let result;
  try { result = JSON.parse(raw); }
  catch { throw new Error(method + ' returned non-JSON: ' + raw.slice(0, 140)); }
  if (result.error) throw new Error(method + ': ' + result.error);
  if (allowed !== '*' && allowed !== origin)
    throw new Error(method + ' response does not advertise an allowed browser origin');
  return result;
}

try {
  const leaderboard = await request('GET');
  assert.equal(leaderboard.edition, 2);
  assert.ok(Array.isArray(leaderboard.entries));

  const { seed, actions, player } = sampleReplay();
  const validated = await request('POST', {
    edition: 2, name: '疾風的工頭', seed, actions,
    playerId: '00000000-0000-4000-8000-000000000000',
    validateOnly: true
  });
  assert.equal(validated.verified, true);
  assert.equal(validated.score, player.score);
  assert.equal(validated.lines, player.lines);
  console.log('Leaderboard GET and replay validation POST are healthy.');
} catch (error) {
  console.error('Leaderboard integration needs attention:', error.message);
  process.exitCode = 1;
}
