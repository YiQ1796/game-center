
export const BUILD = '0.7.3';
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
  staff: { name:'金箍護園員', role:'近戰・耐打', icon:'🥢', color:'#f8ab46', hp:132, speed:166, skill:'sweep', burst:'金箍大旋風',
    description:'揮棒掃開身邊的怪群。被圍住時，用大旋風開路。' },
  mage: { name:'香蕉魔法師', role:'遠程・範圍', icon:'🔥', color:'#c68af1', hp:96, speed:170, skill:'fire', burst:'果園流星雨',
    description:'火球在怪群中炸開。大招會灑下六次流星。' },
  scout: { name:'果園巡邏手', role:'遠程・機動', icon:'🏹', color:'#65dce1', hp:106, speed:188, skill:'seed', burst:'連環果籽箭',
    description:'靠走位拉開距離。大招向四周射出穿透果籽。' }
};
export const CLASS_KITS = {
  staff:['sweep','nut','puff','echo','fault','wheel'],
  mage:['fire','spark','frost','hive','comet','stormwell'],
  scout:['seed','peel','pop','drop','fan','snare']
};
const relicOwner = {gauntlet:'staff',bracers:'staff',grimoire:'mage',emberglass:'mage',quiver:'scout',broadhead:'scout'};
export const allowsPassive = (job,key) => Object.hasOwn(PASSIVES,key) && (!Object.hasOwn(relicOwner,key) || relicOwner[key]===job);
export const SKILLS = {
  fault:['裂地棍','朝目標連續敲出三段地裂',24,178,2.1,'#efbc69','fissure'],
  wheel:['旋身護棍','三處旋擊環繞近身',22,112,.86,'#e7ae57','orbit'],
  comet:['墜星術','標記遠方敵人，短暫延遲後墜落',53,535,2.65,'#dc93fa','drop'],
  stormwell:['紫晶法陣','在怪群腳下持續造成傷害',14,435,2.8,'#c19af2','field'],
  fan:['扇羽箭','朝目標扇射三箭',13,480,1.22,'#95ebce','fan'],
  snare:['縛足箭','箭矢命中後短暫定身',18,490,1.65,'#99dbec','pin'],
  sweep: ['金箍橫掃','近距離環形揮擊',24,121,0.81,'#ffd692','ring'],
  fire: ['焦糖火球','打向最近的怪，命中後爆炸',23,455,1.02,'#ff9859','blast'],
  seed: ['果籽箭','瞄準怪物，箭矢能穿過多個敵人',17,515,0.58,'#abf1df','pierce'],
  peel: ['跳弦箭','命中後彈向附近另一隻敵人',16,410,1.42,'#ffd757','ricochet'],
  spark: ['滋滋落雷','電擊最多三隻相近的怪',19,430,1.59,'#f9ed9e','chain'],
  frost: ['冰果風暴','在目標附近造成傷害並減速',15,415,1.72,'#96ecff','slow'],
  pop: ['絆索陷阱','腳下設索，觸發時傷害並纏住近敵',32,0,2.30,'#ffce8d','mine'],
  nut: ['護身反打','挨打後震開近敵並反擊',34,115,0.7,'#e7b878','counter'],
  hive: ['汲魂術','從目標汲取生命，回復施法者',18,365,2.48,'#ad79ce','drain'],
  puff: ['震退棍','揮棒把身邊的怪往外推開',12,164,1.94,'#bdf8d0','push'],
  drop: ['定點箭雨','在敵群落下三波箭雨',18,520,2.40,'#c8df94','volley'],
  echo: ['穿陣突刺','朝最近敵人直線刺擊，命中沿線怪物',29,178,1.25,'#efc46c','thrust']
};
export const PASSIVES = {
  bracers:['反震護腕','成功反打時，每級多回復 1 點生命'],
  emberglass:['聚焰琉璃','每級增加火球爆炸半徑 6 像素'],
  broadhead:['穿林箭鏃','獲得時及每升兩級，果籽箭與扇羽箭可再穿透一隻敵人'],
  gauntlet:['破陣腕甲','每級增加 5% 傷害與 4% 攻擊範圍'],
  grimoire:['星紋法典','每級增加 6% 傷害並縮短 2% 冷卻'],
  quiver:['翠羽箭袋','每級增加 3% 暴擊率並縮短 3% 冷卻'],
  power:['果園力氣','傷害 +12%'],
  haste:['快手手套','技能冷卻縮短，最多縮短 55%'],
  reach:['戰場洞察','擴大本職業技能的作用範圍'],
  magnet:['果籽磁鐵','拾取距離 +24'],
  boots:['草地快鞋','移動速度 +6%'],
  guard:['硬殼背心','受到的傷害降低'],
  heart:['猴三毛便當','最大生命 +18，並回復 18 生命'],
  crit:['好運小鈴鐺','暴擊率 +6%'],
  regen:['療癒香蕉','每秒回復 0.45 生命，可升到 10 級'],
  wisdom:['果園見習筆記','拾取果籽的經驗增加 8%']
};
export const EVOLUTIONS = {
  sweep: ['金箍風暴','reach'], fire:['焦糖流星','power'], seed:['千籽穿林','crit'],
  spark:['雷樹開花','wisdom'], frost:['碎冰花園','guard'], peel:['連環跳弦','haste']
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

export const MARKET = Object.freeze({
  juice: {name:'蜜桃果汁', cost:5, description:'立即回復最大生命的 35%'},
  boots: {name:'輕羽短靴', cost:12, description:'精良鞋子，跑速 +8%、拾取距離 +12'},
  amethyst: {name:'紫晶戰甲',cost:72,slot:2,rarity:3,perks:[['guard',.11],['heart',36]],description:'史詩護甲 · 減傷 +11%、生命 +36'},
  amber: {cost:165,slot:0,rarity:4},
  scarlet: {name:'赤曜王印',cost:340,slot:5,rarity:5,perks:[['power',.4],['crit',.13],['heart',45]],description:'神話項鍊 · 傷害 +40%、暴擊 +13%、生命 +45'},
  point: {name:'見習筆記殘頁', cost:8, description:'取得 1 點素質；每局限購 8 次，每次加價 8 果核'}
});
const legendaryWeapons = {
  staff:{name:'曜金盤龍棍',perks:[['power',.32],['reach',.12]],description:'傳說長棍 · 傷害 +32%、範圍 +12%'},
  mage:{name:'曜金聚星杖',perks:[['power',.32],['haste',.085]],description:'傳說法杖 · 傷害 +32%、冷卻縮短 8.5%'},
  scout:{name:'曜金穿雲弓',perks:[['power',.26],['crit',.12]],description:'傳說長弓 · 傷害 +26%、暴擊率 +12%'}
};
export function marketItem(key,job){
  return key==='amber'?{...MARKET.amber,...legendaryWeapons[job]}:MARKET[key];
}
export function skillNumbers(key, rank, stats, evolved=false) {
  const skill=SKILLS[key];
  return {
    damage:Math.round(skill[2]*stats.power*(1+(rank-1)*.26)*(evolved?1.55:1)),
    cooldown:skill[4]*stats.haste*Math.max(.72,1-(rank-1)*.055)
  };
}

export const salePrice=item=>[3,6,11,22,40,75][item.rarity]+item.rank*2;
export const marketPrice=(key,bought=0)=>MARKET[key].cost+(key==='point'?8*bought:0);
export const attributeCost=current=>current>=80?3:current>=60?2:1;
