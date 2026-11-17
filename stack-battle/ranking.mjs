import { makeScoreCode } from './replay.mjs?v=100';

const ENDPOINT = 'https://sanmao-blocks-scores.kzyi0902.chatgpt.site/api/scores';
const IDENTIFIER = 'sanmao-blocks-player-v1';
let playerId;

function getPlayerId() {
  if (playerId) return playerId;
  try { playerId = localStorage.getItem(IDENTIFIER); } catch {}
  if (!/^[a-f0-9-]{36}$/i.test(playerId ?? '')) {
    playerId = crypto.randomUUID();
    try { localStorage.setItem(IDENTIFIER, playerId); } catch {}
  }
  return playerId;
}

async function scores(options = {}) {
  let response;
  try {
    response = await fetch(ENDPOINT, { ...options, signal: AbortSignal.timeout(12000) });
  } catch {
    throw new Error('公開排行榜服務暫時連不上。');
  }
  const result = await response.json().catch(() => null);
  if (!response.ok || !result) throw new Error(result?.error ?? '公開排行榜服務暫時連不上。');
  return result;
}

export async function getRanking() {
  const result = await scores();
  if (!Array.isArray(result.entries)) throw new Error('暫時讀不到歷史榜。');
  return result.entries;
}

export async function submitScore(name, seed, actions) {
  const replay = await makeScoreCode(seed, actions);
  return scores({ method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, replay, playerId: getPlayerId() }) });
}
