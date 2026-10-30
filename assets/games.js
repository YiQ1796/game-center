/**
 * 遊戲清單是單一資料來源：首頁不修改遊戲本體。
 * 上線狀態必須與線上發布及實際連結驗證分開記錄。
 */
window.SANMAO_GAMES = Object.freeze([
  Object.freeze({
    id: 'wealth-empire',
    name: '財富帝國',
    category: '多人策略・經營遊戲',
    summary: '買地蓋房、投資發展，和朋友一起打造屬於你們的財富王國！',
    image: 'assets/wealth-monkey.webp',
    imageAlt: '猴三毛抱著滿滿金幣的寶箱',
    status: 'available',
    url: 'https://yiq1796.github.io/Wealth_Empire/v20/'
  }),
  Object.freeze({
    id: 'big-two',
    name: '大老二',
    category: '經典撲克・好友對戰',
    summary: '經典台灣撲克遊戲，簡單上手、越玩越有趣！',
    image: 'assets/poker-monkey.webp',
    imageAlt: '猴三毛拿著一手撲克牌',
    status: 'beta',
    url: 'https://yiq1796.github.io/BigTwo_Web/' // Pages 成功，真人跨網 UAT 待驗證。
  })
]);
