import { isNickname } from '../names.mjs';
import { verifyScoreCode } from '../replay.mjs';

const GAME_ORIGIN = 'https://yiq1796.github.io';
const JSON_LIMIT = 65_536;
const PLAYER_ID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const cors = {
  'Access-Control-Allow-Origin': GAME_ORIGIN,
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '600',
  Vary: 'Origin'
};
const json = (value, status = 200) => Response.json(value, {
  status, headers: { ...cors, 'Cache-Control': 'no-store' }
});

async function readBody(request) {
  if (!request.body || Number(request.headers.get('content-length')) > JSON_LIMIT) return null;
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let raw = '';
  let bytes = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.length;
      if (bytes > JSON_LIMIT) return null;
      raw += decoder.decode(value, { stream: true });
    }
    return JSON.parse(raw + decoder.decode());
  } catch { return null; }
  finally { await reader.cancel(); }
}

async function submit(request, db) {
  if (request.headers.get('Origin') !== GAME_ORIGIN) return json({ error: '請從猴三毛遊戲中心送出。' }, 403);
  const input = await readBody(request);
  if (!isNickname(input?.name) || !PLAYER_ID.test(input?.playerId) ||
      typeof input?.replay !== 'string' || input.replay.includes('\n')) {
    return json({ error: '暱稱或對局紀錄資料無效。' }, 400);
  }
  const result = await verifyScoreCode(input.replay);
  if (!result) return json({ error: '這一局的分數無法驗證。' }, 422);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input.replay)));
  const hash = Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('');
  const now = new Date().toISOString();
  const row = await db.prepare(`
    INSERT INTO historical_scores (player_id, name, score, lines, played_at, replay_hash)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT DO NOTHING
    RETURNING score
  `).bind(input.playerId, input.name, result.score, result.lines, now, hash).first();
  if (row) return json({ saved: true, ...result });
  const updated = await db.prepare(`
    UPDATE historical_scores
    SET name = ?, score = ?, lines = ?, played_at = ?, replay_hash = ?
    WHERE player_id = ?
      AND (score < ? OR (score = ? AND lines < ?))
      AND NOT EXISTS (SELECT 1 FROM historical_scores WHERE replay_hash = ?)
    RETURNING score
  `).bind(input.name, result.score, result.lines, now, hash, input.playerId, result.score, result.score, result.lines, hash).first();
  return json({ saved: Boolean(updated), ...result });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== '/api/scores') return json({ service: 'sanmao-blocks-scores-v1' });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    try {
      if (request.method === 'POST') return await submit(request, env.DB);
      if (request.method !== 'GET') return json({ error: '不支援此操作。' }, 405);
      const result = await env.DB.prepare(`
        SELECT name, score, lines FROM historical_scores
        ORDER BY score DESC, lines DESC, played_at ASC
        LIMIT 100
      `).all();
      return json({ entries: result.results });
    } catch {
      return json({ error: '公開排行榜服務暫時無法使用。' }, 503);
    }
  }
};

