const titles = ['疾風的', '愚笨的', '悠閒的', '迷路的', '退休的', '暴走的', '剛下班的', '還在夢遊的', '忘記打卡的', '放空的', '無敵的', '微波中的', '帶薪發呆的'];
const roles = ['工頭', '打工達人', '香蕉會計', '積木搬運工', '小豬班長', '加班王', '木板師傅', '午睡隊長', '便當主管', '苦瓜園丁', '方塊外送員', '茶水間股東', '鍋貼博士', '落枕教練', '彈珠阿伯'];
const puns = ['塊樂打工人', '落地生方', '積不可失', '塊塊樂', '消極上班族', '三毛錢薪水', '四行外送中', '方方面麵', '工頭叫我堆', '派駐荔枝的蘋果', '一塊來值班', '消夜消四行', '磚職摸魚員'];
const names = [...puns, ...titles.flatMap(title => roles.map(role => title + role))];
const allowed = new Set(names);

export function nicknameChoices(exclude = []) {
  const skipped = new Set(exclude);
  const choices = names.filter(name => !skipped.has(name));
  const random = crypto.getRandomValues(new Uint32Array(5));
  return [...random].map(seed => choices.splice(seed % choices.length, 1)[0]);
}

export function isNickname(name) {
  return allowed.has(name);
}
