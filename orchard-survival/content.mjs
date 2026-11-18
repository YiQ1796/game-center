
export const BUILD = '0.3.0';
export const SKILL_CAP = 10;
export const PASSIVE_CAP = 10;
export const ATTRIBUTES = Object.freeze({str:'力量',agi:'敏捷',vit:'體質',int:'智慧',dex:'靈巧',luk:'幸運'});
export const FIELD = { width: 2700, height: 1900 };
export const STEP = 1 / 30;
export const SLOTS = ['武器','帽子','外套','手套','鞋子','項鍊','左戒指','右戒指'];
export const RARITIES = [
  ['普通','#475345'], ['精良','#25613b'], ['稀有','#1956a1'],
  ['史詩','#783aa5'], ['傳說','#a64b16'], ['神話','#a52459']
];
export const CLASSES = {
  staff: { name:'金箍護園員', role:'近戰・耐打', icon:'🥢', color:'#f8ab46', hp:132, speed:212, skill:'sweep', burst:'金箍大旋風',
    description:'揮棒掃開身邊的怪群。被圍住時，用大旋風開路。' },
  mage: { name:'香蕉魔法師', role:'遠程・範圍', icon:'🔥', color:'#c68af1', hp:96, speed:218, skill:'fire', burst:'果園流星雨',
    description:'火球在怪群中炸開。大招會灑下六次流星。' },
  scout: { name:'果園巡邏手', role:'遠程・機動', icon:'🏹', color:'#65dce1', hp:106, speed:240, skill:'seed', burst:'連環果籽箭',
    description:'靠走位拉開距離。大招向四周射出穿透果籽。' }
};
export const SKILLS = {
  sweep: ['金箍橫掃','近距離環形揮擊',24,121,0.81,'#ffd692','ring'],
  fire: ['焦糖火球','打向最近的怪，命中後爆炸',23,455,1.02,'#ff9859','blast'],
  seed: ['果籽箭','瞄準怪物，箭矢能穿過多個敵人',17,515,0.58,'#abf1df','pierce'],
  peel: ['香蕉迴旋鏢','朝目標飛出並飛回',16,410,1.42,'#ffd757','return'],
  spark: ['滋滋落雷','電擊最多三隻相近的怪',19,430,1.59,'#f9ed9e','chain'],
  frost: ['冰果風暴','在目標附近造成傷害並減速',15,415,1.72,'#96ecff','slow'],
  pop: ['爆米花地雷','在腳下留下一顆靠近就炸的地雷',32,0,2.30,'#ffce8d','mine'],
  nut: ['山核桃護衛','旋轉的堅果擊退貼近的怪',15,95,0.61,'#e7b878','orbit'],
  hive: ['蜂蜜陷阱','在怪群腳下留下持續傷害區',10,365,2.48,'#faba53','field'],
  puff: ['風鈴果','把身邊的怪往外推開',12,164,1.94,'#bdf8d0','push'],
  drop: ['果箱空投','在目標頭上預告後砸下一箱水果',39,520,2.40,'#fca2aa','drop'],
  echo: ['回音竹槍','從身邊朝不同方向射出竹槍',14,380,1.54,'#a8e9a8','radial']
};
export const PASSIVES = {
  power:['果園力氣','傷害 +12%'],
  haste:['快手手套','技能冷卻縮短，最多縮短 55%'],
  reach:['伸縮竹竿','近戰與範圍技能的攻擊半徑增加'],
  magnet:['果籽磁鐵','拾取距離 +24'],
  boots:['草地快鞋','移動速度 +6%'],
  guard:['硬殼背心','受到的傷害降低'],
  heart:['猴三毛便當','最大生命 +18，並回復 18 生命'],
  crit:['好運小鈴鐺','暴擊率 +6%'],
  regen:['療癒香蕉','每秒回復 0.45 生命，可升到 10 級'],
  wisdom:['果園見習筆記','拾取果籽的經驗增加 8%']
};
export const EVOLUTIONS = {
  sweep: ['金箍風暴','reach'], fire:['焦糖流星','power'], seed:['千籽穿林','crit']
};
export const ENEMIES = {
  grub:[19,82,12,10,1,'豆豆蟲'],
  shroom:[36,66,17,14,2,'彈跳菇'],
  boar:[58,67,20,21,3,'衝刺小野豬'],
  bee:[37,96,15,13,3,'酸蜜蜂'],
  snail:[108,47,23,20,5,'硬殼蝸牛'],
  elite:[375,77,28,29,13,'果園搗蛋王'],
  boss:[1020,62,46,37,30,'香蕉山大王'],
  queen:[1350,81,41,32,35,'酸蜜蜂女王']
};
export const PERKS = {
  power:['攻擊', 0.035], haste:['冷卻', 0.022], reach:['範圍', 0.033],
  magnet:['拾取', 8], boots:['跑速', 0.018], guard:['防禦', 0.024],
  heart:['生命', 7], crit:['暴擊', 0.025],
  regen:['再生', 0.13], wisdom:['經驗', 0.023]
};
export const TAUNTS = [
  '我就採根香蕉，怎麼整座果園都追來了？',
  '這點果蟲，也敢排隊來領金箍棒？',
  '先把便當收好。誰把蜜蜂引過來的？',
  '倒在香蕉皮上這件事，拜託別寫進結算。'
];
export const THRESHOLD = level => 4 + level * 3 + Math.floor(level * level / 12);
export const isClass = value => typeof value === 'string' && Object.hasOwn(CLASSES, value);
