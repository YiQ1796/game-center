export const TAUNT_COOLDOWN = 5000;
export const TAUNT_DURATION = 4600;

export const FRIEND_TAUNTS = Object.freeze([
  '先讓你一顆，待會兒別說我欺負你。',
  '那條縫也太寬，你在蓋車庫嗎？',
  '等我消完這排，再來聽你解釋。',
  '你繼續蓋，我先把地板掃乾淨。',
  '方塊沒長腳，怎麼還抓不到？',
  '這排我先包了，你去隔壁排隊。'
]);

export const MONKEY_LINES = Object.freeze({
  intro: ['先說好，方塊可聽不懂藉口。', '方塊有計畫，你有打算嗎？'],
  lobby: ['兩位都到齊了嗎？我連香蕉都剝好了。', '房間留一席，藉口留門外。'],
  playing: ['手先熱一下，地板還是你的。', '招呼打完了，現在看你怎麼堆。'],
  paused: ['歇一下，我幫你看著那條縫。', '可以休息，方塊還在等你收拾。'],
  combo: ['這串連消有點吵，我喜歡。', '一排接一排，地板被你掃得發亮。', '別停，下一排已經在排隊了。'],
  clear: ['這排收掉了，下面那排有點緊張。', '方塊住得好好的，你怎麼整排請走？'],
  perfect: ['清得一顆不剩，連灰塵都怕你。', '連地板都露出來了，這手可以。'],
  danger: ['越蓋越高，你買到頂樓了？', '屋頂就在頭上，先留條退路。'],
  bomb: ['這聲夠響，隔壁都知道你在玩。', '炸完就有位子了，別客氣。'],
  knockout: ['這棟樓不太穩，換一棟再來。', '方塊一多，連三毛都要搬家了。'],
  topout: ['屋頂都蓋好了，門還沒留呢。', '這棟先封頂，下一棟留點空位。'],
  soloEnd: ['今天先收工，地板還你。', '分數算好了，三毛還想看一局。'],
  settled: ['各蓋各的，收工記得看分數。', '兩位都收工，地板總算能喘氣。'],
  win: ['你贏了，現在換好友找藉口。', '這局讓你好好得意一下。'],
  loss: ['別忙著怪方塊，下一局還會見面。', '先借好友得意一下，下局再討回來。'],
  tie: ['平手？那就再加賽一根香蕉。', '誰都沒搶到面子，剛剛好。']
});

export function isTauntIndex(index) {
  return Number.isInteger(index) && index >= 0 && index < FRIEND_TAUNTS.length;
}

export function isRoomTaunt(taunt) {
  return !!taunt && (taunt.seat === 0 || taunt.seat === 1) && isTauntIndex(taunt.index) &&
    Number.isFinite(taunt.at);
}

export function eventBanter(event, dangerEntered) {
  if (event.ko) return 'knockout';
  if (event.perfect) return 'perfect';
  if (event.lines > 0 && event.combo > 0) return 'combo';
  if (event.bombs > 0) return 'bomb';
  if (dangerEntered) return 'danger';
  if (event.lines >= 2) return 'clear';
  return null;
}
