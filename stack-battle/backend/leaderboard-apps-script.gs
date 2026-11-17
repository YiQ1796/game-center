const SCORE_LIMIT = 100;
const MAX_RANK_ACTIONS = 150000;
const RANK_ID = /^([a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})$/i;
const RANK_ACTIONS = /^[lrdszchkg]+$/;
const SCORE_KEY = 'score-v2:';

function reply(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}

function compareScores(a, b) {
  return b.score - a.score || b.lines - a.lines || a.at - b.at || a.id.localeCompare(b.id);
}

function readRank(store) {
  return Object.entries(store.getProperties()).filter(([key]) => key.startsWith(SCORE_KEY))
    .map(([, value]) => JSON.parse(value)).sort(compareScores);
}

function publicScores(rows) {
  return rows.slice(0, SCORE_LIMIT).map(({ name, score, lines }) => ({ name, score, lines }));
}

function doGet() {
  try {
    return reply({ edition: 2, entries: publicScores(readRank(PropertiesService.getScriptProperties())) });
  } catch (error) {
    console.error(error.message);
    return reply({ error: '排行榜暫時無法讀取，請稍後再試。' });
  }
}

function verifiedSolo(seed, actions) {
  if (!Number.isInteger(seed) || seed < 1 || seed > 0xffffffff ||
      typeof actions !== 'string' || !actions.length || actions.length > MAX_RANK_ACTIONS ||
      !RANK_ACTIONS.test(actions)) return null;
  const player = createPlayer(seed);
  for (const action of actions) if (!applyAction(player, action)) return null;
  return player.lines > 0 ? { score: player.score, lines: player.lines } : null;
}

function recordScore(id, name, hash, result) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(4000)) return { error: '成績正在同步，請稍後重試。' };
  try {
    const store = PropertiesService.getScriptProperties();
    const scores = readRank(store);
    const existing = scores.find(row => row.id === id);
    const record = { id, name, hash, score: result.score, lines: result.lines, at: Date.now() };
    if (existing && compareScores(existing, record) <= 0)
      return { saved: false, reason: 'lower', score: result.score };
    if (scores.some(row => row.hash === hash))
      return { saved: false, reason: 'duplicate', score: result.score };
    const sorted = scores.filter(row => row.id !== id).concat(record).sort(compareScores);
    const position = sorted.findIndex(row => row.id === id);
    if (position >= SCORE_LIMIT) return { saved: false, reason: 'outside', score: result.score };
    store.setProperty(SCORE_KEY + id, JSON.stringify(record));
    for (const old of sorted.slice(SCORE_LIMIT)) store.deleteProperty(SCORE_KEY + old.id);
    return { saved: true, rank: position + 1, score: record.score };
  } finally {
    lock.releaseLock();
  }
}

function doPost(event) {
  try {
    const raw = event && event.postData && event.postData.contents;
    if (typeof raw !== 'string' || raw.length > MAX_RANK_ACTIONS + 1024) return reply({ error: '成績資料過長。' });
    let payload;
    try { payload = JSON.parse(raw); }
    catch (_) { return reply({ error: '成績資料格式不符。' }); }
    if (!payload || payload.edition !== 2 || !isNickname(payload.name) || !RANK_ID.test(payload.playerId))
      return reply({ error: '暱稱或成績版本不符，請重新整理遊戲。' });
    const result = verifiedSolo(payload.seed, payload.actions);
    if (!result) return reply({ error: '這局成績無法驗證，至少需消除一行。' });
    if (payload.validateOnly === true) return reply({ verified: true, score: result.score, lines: result.lines });
    const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, payload.seed + ':' + payload.actions);
    const hash = digest.map(byte => (byte & 255).toString(16).padStart(2, '0')).join('');
    return reply(recordScore(payload.playerId, payload.name, hash, result));
  } catch (error) {
    console.error(error.message);
    return reply({ error: '送出成績失敗，請稍後再試。' });
  }
}
