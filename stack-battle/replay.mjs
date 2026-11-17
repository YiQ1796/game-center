import { createPlayer, applyAction } from './engine.mjs';

const PREFIX = 'SANMAO-BLOCKS-1';
const MAX_ACTIONS = 2_000_000;
const MAX_CODE = 62_000;
const validReplay = /^[lrdszchkg]+$/;

async function readLimited(stream, limit) {
  const reader = stream.getReader();
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) throw new Error('成績碼超過大小限制。');
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}

function encodeBase64(bytes) {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  }
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

export async function makeScoreCode(seed, actions) {
  const replay = actions.join('');
  if (!replay || replay.length > MAX_ACTIONS) throw new Error('這局超過公開成績碼容量。');
  const zipped = new Blob([replay]).stream().pipeThrough(new CompressionStream('gzip'));
  const code = PREFIX + ' ' + seed.toString(36) + ' ' + encodeBase64(await readLimited(zipped, 46_000));
  if (code.length > MAX_CODE) throw new Error('這局超過公開成績碼容量。');
  return code;
}

export async function verifyScoreCode(comment) {
  if (typeof comment !== 'string' || comment.length > 65_536) return null;
  const match = /^SANMAO-BLOCKS-1 ([0-9a-z]{1,7}) ([A-Za-z0-9_-]+)$/m.exec(comment.trim());
  if (!match || match[0].length > MAX_CODE) return null;
  try {
    const seed = Number.parseInt(match[1], 36);
    if (seed < 1 || seed > 0xffffffff) return null;
    const zipped = Uint8Array.from(atob(match[2].replaceAll('-', '+').replaceAll('_', '/')), char => char.charCodeAt(0));
    const stream = new Blob([zipped]).stream().pipeThrough(new DecompressionStream('gzip'));
    const actions = new TextDecoder().decode(await readLimited(stream, MAX_ACTIONS));
    if (!validReplay.test(actions)) return null;
    const player = createPlayer(seed);
    let i = 0;
    for (const action of actions) {
      if (!applyAction(player, action)) return null;
      if (++i % 6000 === 0) await new Promise(resolve => setTimeout(resolve, 0));
    }
    return player.lines > 0 ? { score: player.score, lines: player.lines } : null;
  } catch {
    return null;
  }
}

