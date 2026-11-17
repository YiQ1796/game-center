const ENDPOINT = 'https://script.google.com/macros/s/AKfycbxd1v4tYJhiYSeHhdYbzfGpegvxC9V0mQINT9llaXTyk3QsXeKFqVjmXKGmLMawwydo0A/exec';
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
  let result;
  try {
    const response = await fetch(ENDPOINT, {
      ...options, credentials: 'omit', signal: AbortSignal.timeout(20_000)
    });
    result = await response.json();
    if (!response.ok) throw new Error();
  } catch {
    throw new Error('公開排行榜服務暫時連不上。');
  }
  if (result?.error) throw new Error(result.error);
  return result;
}

export async function getRanking() {
  const result = await scores({ cache: 'no-store' });
  if (!Array.isArray(result.entries)) throw new Error('暫時讀不到歷史榜。');
  return result.entries;
}

export function submitScore(name, seed, actions) {
  if (actions.length > 150_000) throw new Error('本局紀錄過長，無法送出。');
  return scores({ method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
    body: JSON.stringify({ edition: 2, name, seed, actions: actions.join(''), playerId: getPlayerId() }) });
}
