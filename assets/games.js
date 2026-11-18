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
    status: 'available',
    url: 'https://yiq1796.github.io/BigTwo_Web/' // 使用者已完成遊戲驗收（2026-11-17）。
  }),
  Object.freeze({
    id: 'rummikub',
    name: '猴三毛拉密',
    category: '數字牌・單機與好友對戰',
    summary: '固定四人開局，單機與 AI 挑戰，或邀請朋友一起排牌！空位由 AI 補滿。',
    visualType: 'rummikub-illustration', // 延用經確認的猴三毛遊戲館角色插畫，數字牌由 DOM/CSS 繪製。
    status: 'available', // 使用者已完成遊戲驗收（2026-11-17）。
    url: 'https://yiq1796.github.io/Rummikub_Web/'
  }),
  Object.freeze({
    id: 'aqua-world',
    name: '水族世界',
    category: '水族養成・自由造景',
    summary: '照顧游動中的小魚、換水和布置魚缸。單機試玩進度儲存在瀏覽器。',
    image: 'assets/aqua-world-sanmao-cover-v1.webp',
    imageAlt: '猴三毛開心餵魚，照顧色彩繽紛的水族箱',
    status: 'beta',
    url: 'https://yiq1796.github.io/game-center/aqua-world/'
  }),
  Object.freeze({
    id: 'one-a-two-b',
    name: '猴三毛 1A2B',
    category: '數字推理・單人與雙人連線',
    summary: '四個數字藏著一組密碼。用 A、B 線索推理，也能開房和朋友輪流猜電腦出的密碼！',
    image: 'assets/one-a-two-b-sanmao-cover-v1.webp',
    imageAlt: '猴三毛正在思考數字謎題，猜測 1A2B 密碼',
    status: 'available',
    url: 'https://yiq1796.github.io/game-center/one-a-two-b/'
  }),
  Object.freeze({
    id: 'stack-battle',
    name: '方塊派對',
    category: '方塊消除・單人與好友對戰',
    summary: '挑戰單人無限歷史榜，或和好友打五分鐘 KO、送垃圾列、炸彈反攻！',
    image: 'assets/block-party-sanmao-cover-v1.webp',
    imageAlt: '猴三毛開心舉起彩色方塊，與朋友參加繽紛的方塊派對',
    status: 'beta',
    url: 'https://yiq1796.github.io/game-center/stack-battle/'
  }),
  Object.freeze({
    id: 'orchard-survival',
    name: '猴三毛割草隊',
    category: '無限生存・單人與 2～4 人合作',
    summary: '揮金箍棒、丟火球、射果籽。升級、打首領，揪朋友一起守住香蕉果園！',
    image: 'one-a-two-b/sanmao-full-body.webp',
    imageAlt: '猴三毛全身插畫',
    status: 'beta',
    url: 'https://yiq1796.github.io/game-center/orchard-survival/'
  })
]);
