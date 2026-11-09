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
  }),
  Object.freeze({
    id: 'rummikub',
    name: '猴三毛拉密',
    category: '數字牌・單機與好友對戰',
    summary: '固定四人開局，單機與 AI 挑戰，或邀請朋友一起排牌！空位由 AI 補滿。',
    visualType: 'rummikub-illustration', // 延用經確認的猴三毛遊戲館角色插畫，數字牌由 DOM/CSS 繪製。
    status: 'beta', // Pages 已發布；跨網路真人連線 UAT 尚未完成。
    url: 'https://yiq1796.github.io/Rummikub_Web/'
  }),
  Object.freeze({
    id: 'aqua-world',
    name: '水族世界',
    category: '水族養成・自由造景',
    summary: '照顧游動中的小魚、換水和布置魚缸。單機試玩進度儲存在瀏覽器。',
    visualType: 'aqua-world-label',
    status: 'beta',
    url: 'https://yiq1796.github.io/game-center/aqua-world/'
  })
]);
