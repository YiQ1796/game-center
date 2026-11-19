
import { CLASSES, ENEMIES, EVOLUTIONS, FIELD, PASSIVES, PERKS, RARITIES, SKILLS, SLOTS, STEP, THRESHOLD, MARKET, skillNumbers, ATTRIBUTES, SKILL_CAP, PASSIVE_CAP, isClass } from './content.mjs?v=050';
import { ADVANCEMENTS, ADVANCEMENT_LEVEL, getAdvancement } from './advancement.mjs?v=050';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const TAU = Math.PI * 2;
const CELL = 96;
const ANGLE = Math.PI / 180;
const headings = [0, 60, 120, 180, 240, 300].map(value => value * ANGLE);
const templates = [
  ['榛果短棒','power'],['蕉葉漁夫帽','crit'],['果園工作服','guard'],['採果手套','haste'],
  ['軟底竹鞋','boots'],['蜜蜂墜飾','magnet'],['紅莓戒指','reach'],['蜂蜜戒指','heart']
];

function random(game) {
  let value = game.seed;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  game.seed = value >>> 0;
  return game.seed / 4294967296;
}

function newPlayer(seat, i) {
  const job = isClass(seat.job) ? seat.job : 'staff';
  const type = CLASSES[job];
  return {
    id: seat.id, name: seat.name, job, x: FIELD.width / 2 + (i % 2) * 39 - 20,
    y: FIELD.height / 2 + Math.floor(i / 2) * 39 - 20, face: 1, walk: false,
    hp:type.hp, maxHp:type.hp, inv:0, down:false, rescue:0, burst:0, burstPending:false,
    strikeAt:-5, gait:0, aim:0, forgotten:[], banishedAt:0, promotion:null, move:{x:0,y:0}, skills:{[type.skill]:1}, passive:{}, evolution:{}, timers:{},
    attributes:{str:5,agi:5,vit:5,int:5,dex:5,luk:5},statPoints:0,legendaryTokens:0,
    gear:Array(SLOTS.length).fill(null), loot:[], crumbs:0, pending:0, offers:[], deadline:0, offerId:0,
    kills:0, damage:0, bosses:0, rescues:0, limit:0
  };
}

export function newGame(seats, seed = 1) {
  if (!Array.isArray(seats) || seats.length < 1 || seats.length > 4) throw new Error('需要 1～4 位玩家');
  return {
    seed:(seed >>> 0) || 1, serial:0, players:seats.map(newPlayer), bonusXpCarry:0,
    enemies:[], gems:[], shots:[], zones:[], fx:[], cells:new Map(),
    elapsed:0, level:1, xp:0, eliteAt:52, bossAt:105, bossCycle:0, spawnClock:0.2,
    modifiers:seats.length, ended:false, reason:'', paused:false,
    notice:'果園開工！先撿果籽，練出你的第一招。', noticeAt:6
  };
}

export function setMove(player, x, y) {
  if (!player || !Number.isFinite(x) || !Number.isFinite(y)) return;
  x = clamp(x,-1,1);
  y = clamp(y,-1,1);
  const length = Math.max(1, Math.hypot(x,y));
  player.move = { x:x/length, y:y/length };
}

export function stats(player, equipment=player.gear) {
  const points = {...player.passive};
  const gear = {};
  for (const item of equipment) {
    if (!item) continue;
    for (const [key,value] of item.perks) gear[key] = (gear[key] || 0) + value;
  }
  const bonus = key => gear[key] || 0;
  const rank = key => points[key] || 0;
  const promotion = getAdvancement(player.job,player.promotion);
  const promoted = key => promotion?.[key] || 0;
  const attr = key => Math.max(0,player.attributes?.[key] || 0);
  const mainAttribute=player.job==='staff'?'str':player.job==='mage'?'int':'dex';
  const baseAttack=(attr(mainAttribute)-5)*.027;
  return {
    power:(1 + rank('power')*.12 + bonus('power')) * (1 + .3 * Math.log1p(player.limit/5)) * (1+promoted('power')+baseAttack), 
    haste:Math.max(.35, 1-rank('haste')*.075-bonus('haste')-promoted('haste')-(attr('agi')-5)*.003),
    reach:Math.min(2.3, 1+rank('reach')*.09+bonus('reach')+promoted('reach')+(attr('dex')-5)*.003),
    magnet:Math.min(255, 57+rank('magnet')*24+bonus('magnet')),
    speed:CLASSES[player.job].speed*Math.min(1.82,1+rank('boots')*.06+bonus('boots')+promoted('speed')+(attr('agi')-5)*.006),
    resist:Math.max(.26, 1-rank('guard')*.08-bonus('guard')-promoted('guard')-(attr('vit')-5)*.002),
    hp:(CLASSES[player.job].hp+rank('heart')*18+bonus('heart')+(attr('vit')-5)*7)*(1+promoted('health')),
    crit:Math.min(.75,.05+rank('crit')*.06+bonus('crit')+promoted('crit')+(attr('luk')-5)*.006),
    regen:rank('regen')*.45+bonus('regen'), wisdom:rank('wisdom')*.08+bonus('wisdom')
  };
}

export function allocateAttribute(game,player,key) {
  if(game.ended||!player||player.down||!Object.hasOwn(ATTRIBUTES,key) ||
     !Number.isInteger(player.statPoints)||player.statPoints<1||player.attributes[key]>=99) return false;
  player.attributes[key] += 1;
  player.statPoints -= 1;
  updateMaxHp(player,key==='vit');
  return true;
}
function updateMaxHp(player, heal = false) {
  const maxHp = stats(player).hp;
  player.hp = clamp(player.hp + (heal ? Math.max(0,maxHp-player.maxHp) : 0),0,maxHp);
  player.maxHp = maxHp;
}

function shuffled(game, options) {
  for (let i=options.length-1; i>0; i--) {
    const j = Math.floor(random(game)*(i+1));
    [options[i],options[j]] = [options[j],options[i]];
  }
  return options;
}

function makeOffers(game, player) {
  // 職業突破是獨立里程碑，不與三選一的隨機技能池混合。
  if (game.level >= ADVANCEMENT_LEVEL && !player.promotion) {
    player.offers = (ADVANCEMENTS[player.job] || []).map(track=>({
      type:'promotion', key:track.id, name:track.name,
      text:track.role+'・'+track.description, detail:track.burst+'｜'+track.technique
    }));
    player.offerId += 1;
    player.deadline = game.elapsed + 25;
    return;
  }
  const activeCount = Object.keys(player.skills).length;
  const passiveCount = Object.keys(player.passive).length;
  const active = Object.entries(SKILLS).flatMap(([key,skill]) => {
    const level = player.skills[key] || 0;
    if (level >= SKILL_CAP || (!level && activeCount >= 6)) return [];
    if (player.forgotten.includes(key)) return [];
    return [{ type:'skill', key, name:skill[0],
      rankGain:1, text:level ? 'Lv.'+level+' → '+(level+1)+'｜'+skill[1] : skill[1],
      detail:'傷害 '+skill[2]+'｜冷卻 '+skill[4].toFixed(1)+' 秒｜最高 Lv.'+SKILL_CAP }];
  });
  const passive = Object.entries(PASSIVES).flatMap(([key,perk]) => {
    const level = player.passive[key] || 0;
    if (player.forgotten.includes(key) || level >= PASSIVE_CAP || (!level && passiveCount >= 6)) return [];
    return [{ type:'passive', key, name:perk[0], text:'Lv.'+level+' → '+(level+1)+'｜'+perk[1],
      detail:'被動技能｜最高 Lv.'+PASSIVE_CAP }];
  });
  const evolutions = Object.entries(EVOLUTIONS).flatMap(([key,[name,perk]]) =>
    player.skills[key] >= 5 && player.passive[perk] && !player.evolution[key]
      ? [{ type:'evolution', key, name, text:'傷害大幅提高，範圍擴張，普攻變為進化版' }] : []);
  shuffled(game, active);
  const primary = CLASSES[player.job].skill;
  const primaryIndex = active.findIndex(option => option.key === primary);
  if (primaryIndex > 0 && (game.level <= 3 || game.level % 3 === 0)) {
    active.unshift(active.splice(primaryIndex, 1)[0]);
  }
  shuffled(game, passive);
  const choices = [...evolutions.slice(0,1)];
  if (active.length) choices.push(active.shift());
  if (passive.length) choices.push(passive.shift());
  choices.push(...shuffled(game, [...active,...passive]).slice(0,3-choices.length));
  for (const option of [
    {type:'limit',name:'果園超限',text:'提高所有攻擊傷害，增幅逐漸遞減'},
    {type:'heal',name:'急救果汁',text:'回復 45% 生命'},
    {type:'crumbs',name:'工具口袋',text:'取得 8 個強化果核'}
  ]) {
    if (choices.length < 3) choices.push(option);
  }
  // Boss 戰利品提供一張傳奇 +3 升級卡；一般里程碑則可能有精良 +2 卡。
  const skills=choices.map((offer,index)=>({offer,index})).filter(({offer})=>offer.type==='skill');
  if(skills.length&&player.legendaryTokens>0){
    const index=skills[0].index,original=choices[index],current=player.skills[original.key]||0;
    choices[index]={...original,grade:'legendary',rankGain:Math.min(3,SKILL_CAP-current),
      text:'傳奇突破！Lv.'+current+' → '+Math.min(SKILL_CAP,current+3)+'｜'+SKILLS[original.key][1]};
  }else if(skills.length&&game.level%5===0){
    const index=skills[0].index,original=choices[index],current=player.skills[original.key]||0;
    choices[index]={...original,grade:'epic',rankGain:Math.min(2,SKILL_CAP-current),
      text:'史詩強化！Lv.'+current+' → '+Math.min(SKILL_CAP,current+2)+'｜'+SKILLS[original.key][1]};
  }
  player.offers = choices;
  player.offerId += 1;
  player.deadline = game.elapsed + 12;
}

export function banish(game, player, index, version) {
  const card=player?.offers[index];
  if (!Number.isInteger(index) || !card || game.ended || player.down ||
      player.offerId!==version || player.banishedAt===game.level ||
      !['skill','passive'].includes(card.type) || player.skills[card.key] || player.passive[card.key]) return false;
  player.forgotten.push(card.key);
  player.banishedAt=game.level;
  const deadline=player.deadline;
  makeOffers(game,player);
  player.deadline=deadline;
  return true;
}

export function choose(game, player, index, version) {
  const offer = player?.offers[index];
  if (!offer || game.ended || player.down || !Number.isInteger(index) || version !== player.offerId) return false;
  const {type,key} = offer;
  if (type === 'skill'){
    player.skills[key]=Math.min(SKILL_CAP,(player.skills[key]||0)+(offer.rankGain||1));
    if(offer.grade==='legendary')player.legendaryTokens=Math.max(0,player.legendaryTokens-1);
  }
  if (type === 'passive') {
    player.passive[key] = Math.min(PASSIVE_CAP,(player.passive[key] || 0) + 1);
    updateMaxHp(player, key === 'heart');
  }
  if (type === 'evolution') player.evolution[key] = true;
  if (type === 'promotion') {
    const track = getAdvancement(player.job,key);
    if (!track || player.promotion) return false;
    player.promotion=key;
    updateMaxHp(player,true);
    player.hp=Math.min(player.maxHp,player.hp+player.maxHp*.22);
    player.burst=0;
    game.notice=player.name+'轉職成功：'+track.name+'！';
    game.noticeAt=game.elapsed+6;
    effect(game,player.x,player.y,124,track.color,1.5,'upgrade',0,0,track.name);
  }
  if (type === 'limit') player.limit += 1;
  if (type === 'heal') player.hp = Math.min(player.maxHp,player.hp+player.maxHp*.45);
  if (type === 'crumbs') player.crumbs += 8;
  if (type==='skill' || type==='evolution') effect(game,player.x,player.y,65,CLASSES[player.job].color,.95,'upgrade',0,0,offer.name);
  player.pending -= 1;
  player.offers = [];
  if (player.pending > 0) makeOffers(game, player);
  return true;
}

function gainXp(game, amount) {
  game.xp += amount;
  while (game.xp >= THRESHOLD(game.level)) {
    game.xp -= THRESHOLD(game.level++);
    for (const player of game.players) {
      player.pending++;
      player.statPoints=Math.min(180,player.statPoints+3);
      if (!player.down && !player.offers.length) makeOffers(game, player);
    }
  }
}

function rollGear(game, high, job) {
  const slot = Math.floor(random(game)*SLOTS.length);
  const [base,key] = templates[slot];
  const variants=[
    {staff:['榛果短棒','赤漆盤龍棍'],mage:['晶露短杖','星糖法杖'],scout:['藤木短弓','碧羽獵弓']}[job],
    ['蕉葉漁夫帽','金穗頭巾'],['果園工作服','林衛短甲'],['採果手套','斑紋護腕'],
    ['軟底竹鞋','踏風木屐'],['蜜蜂墜飾','琥珀葉墜'],['紅莓戒指','赤晶藤戒'],['蜂蜜戒指','露珠指環']
  ];
  const find = random(game) + Math.min(.18,game.elapsed/3400) + (high ? .28 : 0);
  const rarity = find > 1.27 ? 5 : find > 1.12 ? 4 : find > .94 ? 3 : find > .72 ? 2 : find > .34 ? 1 : 0;
  const keys = [key,...shuffled(game,Object.keys(PERKS).filter(other => other !== key)).slice(0,Math.min(3,rarity))];
  return {
    id:++game.serial, slot, name:variants[slot]?.[rarity>=2?1:0]||base, rarity, rank:0,
    perks:keys.map(stat => [stat, PERKS[stat][1]*(1+rarity*.36)])
  };
}

export function purchase(game,player,key) {
  if (game.ended || !player || player.down || !Object.hasOwn(MARKET,key)) return false;
  const item=MARKET[key];
  if (player.crumbs<item.cost || (key==='juice' && player.hp>=player.maxHp) ||
      (key==='boots' && player.loot.length>=12) || (key==='point' && player.statPoints>=180)) return false;
  player.crumbs-=item.cost;
  if (key==='juice') player.hp=Math.min(player.maxHp,player.hp+player.maxHp*.35);
  if (key==='boots') player.loot.push({id:++game.serial,slot:4,name:item.name,rarity:1,rank:0,perks:[['boots',.08],['magnet',12]]});
  if (key==='point') player.statPoints++;
  effect(game,player.x,player.y,38,'#f6da90',.65,'upgrade',0,0,item.name);
  return true;
}

export function gearAction(game, player, action, id) {
  if (game.ended || !player || player.down || !Number.isSafeInteger(id)) return false;
  if (action==='unequip') {
    const slot=player.gear.findIndex(item=>item?.id===id);
    if (slot<0 || player.loot.length>=12) return false;
    player.loot.push(player.gear[slot]);player.gear[slot]=null;
    updateMaxHp(player);
    return true;
  }
  const lootIndex = player.loot.findIndex(item => item.id === id);
  if (lootIndex !== -1 && (action === 'equip' || action === 'salvage')) {
    const [item] = player.loot.splice(lootIndex,1);
    if (action === 'equip') effect(game,player.x,player.y,48,'#ffc46e',.76,'upgrade',0,0,item.name);
    if (action === 'salvage') player.crumbs += 2+item.rarity;
    else {
      const old = player.gear[item.slot];
      if (old) player.loot.push(old);
      player.gear[item.slot] = item;
      updateMaxHp(player);
    }
    return true;
  }
  const item = player.gear.find(piece => piece?.id === id);
  if (action !== 'forge' || !item || item.rank >= 4 || player.crumbs < 4+item.rank*2) return false;
  player.crumbs -= 4+item.rank*2;
  item.rank++;
  item.perks = item.perks.map(([key,value]) => [key,value+PERKS[key][1]*.65]);
  updateMaxHp(player);
  return true;
}

function effect(game, x, y, radius, color, life=.35, kind='ring', x2=0, y2=0, label='') {
  if (game.fx.length >= 130) game.fx.shift();
  game.fx.push({ id:++game.serial,x,y,radius,color,life,max:life,kind,x2,y2,label });
}

function dropGem(game, target) {
  const value = ENEMIES[target.kind][4];
  if (game.gems.length < 220) game.gems.push({ id:++game.serial,x:target.x,y:target.y,value });
  else {
    const nearby = game.gems.find(gem => dist(gem,target)<88);
    (nearby || game.gems[game.gems.length-1]).value += value;
  }
}

function hurt(game, player, enemy, amount, color, crit, knock=0) {
  if (enemy.hp <= 0) return;
  const critical = random(game) < crit;
  const dealt = Math.round(amount*(critical ? 1.65 : 1));
  player.damage += Math.min(enemy.hp,dealt);
  enemy.hp -= dealt;
  enemy.flash = .12;
  if (critical && game.fx.length < 75) effect(game,enemy.x,enemy.y,0,color,.44,'number',0,0,String(dealt));
  if (enemy.hp > 0 && knock && enemy.radius < 30) {
    const angle = Math.atan2(enemy.y-player.y,enemy.x-player.x);
    enemy.x = clamp(enemy.x+Math.cos(angle)*knock,17,FIELD.width-17);
    enemy.y = clamp(enemy.y+Math.sin(angle)*knock,17,FIELD.height-17);
  }
  if (enemy.hp > 0) return;
  const boss = enemy.kind === 'boss' || enemy.kind === 'queen';
  const elite = enemy.kind === 'elite';
  player.kills++;
  if (boss) player.bosses++;
  dropGem(game,enemy);
  // 小怪也能偶爾掉裝備與果核，讓成長節奏不再完全卡在精英刷新。
  if(!boss&&!elite&&random(game)<.018){
    const item=rollGear(game,false,player.job);
    if(player.loot.length<12)player.loot.push(item);
    else player.crumbs+=2+item.rarity;
  }
  if(!boss&&!elite&&random(game)<.15)player.crumbs++;
  effect(game,enemy.x,enemy.y,enemy.radius*(boss ? 4 : 1.85),color,.42,'pop');
  if (boss || elite) {
    for (const ally of game.players) {
      const item = rollGear(game,boss,ally.job);
      if (ally.loot.length < 12) ally.loot.push(item);
      else ally.crumbs += 2+item.rarity;
      ally.crumbs += boss ? 8 : 3;
      if(boss)ally.legendaryTokens=Math.min(3,ally.legendaryTokens+1);
      if (!ally.down) ally.hp = Math.min(ally.maxHp,ally.hp+ally.maxHp*(boss ? .3 : .14));
    }
    game.notice = ENEMIES[enemy.kind][5] + '被打跑了！每位隊友都有自己的裝備。';
    game.noticeAt = game.elapsed+6;
  }
}

function indexEnemies(game) {
  game.cells.clear();
  for (const enemy of game.enemies) {
    if (enemy.hp <= 0) continue;
    const key = Math.floor(enemy.x/CELL)+Math.floor(enemy.y/CELL)*64;
    if (!game.cells.has(key)) game.cells.set(key,[]);
    game.cells.get(key).push(enemy);
  }
}

function nearby(game, x, y, radius, visitor) {
  const minCol=Math.floor((x-radius)/CELL), maxCol=Math.floor((x+radius)/CELL);
  const minRow=Math.floor((y-radius)/CELL), maxRow=Math.floor((y+radius)/CELL);
  for (let row=minRow; row<=maxRow; row++) {
    for (let col=minCol; col<=maxCol; col++) {
      for (const enemy of game.cells.get(col+row*64) || []) {
        if (enemy.hp<=0) continue;
        const distance=Math.hypot(enemy.x-x,enemy.y-y);
        if (distance <= radius) visitor(enemy,distance);
      }
    }
  }
}

function nearest(game,x,y,radius,exclude) {
  let found;
  let best=radius;
  nearby(game,x,y,radius,(enemy,distance) => {
    if (enemy.id!==exclude && distance<=best) { found=enemy;best=distance; }
  });
  return found;
}

function blast(game, player, x, y, radius, amount, color, crit, knock=0, slow=0, style='impact') {
  nearby(game,x,y,radius,(enemy) => {
    hurt(game,player,enemy,amount,color,crit,knock);
    enemy.slow=Math.max(enemy.slow,slow);
  });
  effect(game,x,y,radius,color,style==='cyclone' ? 1.04 : .48,style);
}

function shoot(game, player, angle, {amount,color,crit,reach,kind,speed=485,pierce=1,tier=1}) {
  if (game.shots.length >= 192) return;
  game.shots.push({
    id:++game.serial,x:player.x,y:player.y,owner:player.id,angle,speed,amount,color,crit,
    life:reach/speed,reach,kind,pierce,tier,hit:new Set(),returning:false
  });
}

function zone(game, player, kind, x, y, radius, amount, color, crit, duration) {
  if (game.zones.length < 48) game.zones.push({
    id:++game.serial,owner:player.id,kind,x,y,radius,amount,color,crit,life:duration,max:duration,tick:0
  });
}

function useSkill(game, player, key, level, config) {
  const [, , , range, , color, kind] = SKILLS[key];
  const evolved = player.evolution[key];
  const {damage:amount,cooldown}=skillNumbers(key,level,config,evolved);
  const scale = config.reach*(evolved ? 1.27 : 1);
  const x = player.x, y = player.y;
  const target = range && nearest(game,x,y,range*(kind==='ring' ? scale : 1));
  const targeted = ['blast','pierce','return','chain','slow','field','drop'].includes(kind);
  if (targeted && !target) return;
  const angle = target ? Math.atan2(target.y-y,target.x-x) : 0;
  if (kind === 'ring' || kind === 'orbit' || kind === 'push') {
    if (!nearest(game,x,y,range*scale)) return;
    if (kind === 'orbit') {
      const phase=game.elapsed*5+player.id.length;
      for (let i=0;i<3;i++) {
        const direction=phase+i*TAU/3;
        blast(game,player,x+Math.cos(direction)*65*scale,y+Math.sin(direction)*65*scale,41*scale,amount,color,config.crit,15);
      }
    } else blast(game,player,x,y,range*scale,amount,color,config.crit,kind==='push' ? 52 : 12,0,kind==='push'?'gale':'sweep');
  } else if (kind === 'chain') {
    let head=target, previous=player;
    const hitIds=new Set();
    for (let i=0;i<3+Math.floor(level/3)+(evolved?2:0)&&head;i++) {
      effect(game,previous.x,previous.y,0,color,.26,'line',head.x,head.y);
      hurt(game,player,head,amount*Math.max(.35,1-i*.11),color,config.crit);
      hitIds.add(head.id);
      previous=head;
      let closest=125*scale;
      head=null;
      nearby(game,previous.x,previous.y,closest,(enemy,distance) => {
        if (!hitIds.has(enemy.id)&&distance<closest) { closest=distance;head=enemy; }
      });
    }
  } else if (kind === 'slow') {
    if(evolved) zone(game,player,'frostfield',target.x,target.y,86*scale,amount*.32,color,config.crit,2.2);
    blast(game,player,target.x,target.y,79*scale,amount,color,config.crit,0,1.6,'ice');
  } else if (kind === 'mine' || kind === 'field' || kind === 'drop') {
    const duration=kind==='mine' ? 7 : kind==='field' ? 2.5 : .48;
    zone(game,player,kind,target?.x ?? x,target?.y ?? y,(kind==='mine' ? 73 : 89)*scale,amount,color,config.crit,duration);
  } else {
    const angles = kind === 'radial' ? headings : evolved && kind==='return' ? [angle-.19,angle+.19] : evolved && kind==='pierce' ? [angle-.15,angle,angle+.15] : [angle];
    for (const direction of angles) {
      shoot(game,player,direction,{amount,color,crit:config.crit,reach:(range+40)*scale,kind,tier:evolved?6:level,speed:kind==='blast' ? 445 : 580,
        pierce:kind==='pierce' ? 2+Math.floor(level/2)+(evolved ? 2 : 0) : kind==='return' ? 12 : kind==='radial' ? 2 : 1});
    }
    if (evolved && kind === 'blast') zone(game,player,'meteor',target.x,target.y,105*scale,amount*.58,color,config.crit,.58);
  }
  if (key===CLASSES[player.job].skill) {
    player.strikeAt=game.elapsed;
    player.aim=angle;
    if (target && Math.abs(Math.cos(angle))>.18) player.face=Math.cos(angle)>0?1:-1;
  }
  player.timers[key] = cooldown;
}

function burst(game, player, config) {
  const {x,y} = player;
  const type=CLASSES[player.job];
  const promotion=getAdvancement(player.job,player.promotion);
  player.burst=promotion ? 18 : 22;
  const target=nearest(game,x,y,620);
  player.aim=target?Math.atan2(target.y-y,target.x-x):(player.face===1?0:Math.PI);
  player.strikeAt=game.elapsed;
  if(Math.abs(Math.cos(player.aim))>.18)player.face=Math.cos(player.aim)>0?1:-1;
  effect(game,x,y,promotion ? 150 : 110,promotion?.color||type.color,1.0,'cast-'+player.job,0,0,promotion ? promotion.burst : type.burst);
  if (promotion) {
    const power=config.power, color=promotion.color, reach=config.reach;
    if (promotion.id==='king') {
      for(const [i,radius] of [90,150,220].entries())
        zone(game,player,'quake',x,y,radius*reach,62*power,color,config.crit,.12+.23*i);
      player.inv=Math.max(.8,player.inv);
    } else if (promotion.id==='guardian') {
      blast(game,player,x,y,184*reach,80*power,color,config.crit,98,1,'gale');
      for(const ally of game.players.filter(p=>!p.down && dist(player,p)<=225*reach)){
        ally.hp=Math.min(ally.maxHp,ally.hp+ally.maxHp*.22);
        ally.inv=Math.max(2.2,ally.inv);
        effect(game,ally.x,ally.y,38,color,2.2,'ward');
      }
    } else if (promotion.id==='storm') {
      const enemies=[];
      nearby(game,x,y,470*reach,(enemy,distance)=>enemies.push({enemy,distance}));
      for(const {enemy} of enemies.sort((a,b)=>a.distance-b.distance).slice(0,6)){
        effect(game,enemy.x,enemy.y-145,0,color,.52,'bolt',enemy.x,enemy.y);
        blast(game,player,enemy.x,enemy.y,38,100*power,color,config.crit);
      }
    } else if (promotion.id==='archmage') {
      blast(game,player,x,y,180*reach,45*power,'#b5edff',config.crit,0,2.5,'ice');
      const cx=target?.x??x,cy=target?.y??y;
      for(let i=0;i<5;i++) zone(game,player,'meteor',cx+(i?Math.cos(i*Math.PI/2)*68:0),
        cy+(i?Math.sin(i*Math.PI/2)*68:0),91*reach,70*power,color,config.crit,.3+i*.22);
    } else if (promotion.id==='ranger') {
      for(let i=-4;i<=4;i++) shoot(game,player,player.aim+i*.09,{amount:74*power,color,crit:config.crit,reach:680*reach,kind:'starArrow',pierce:7,tier:8});
    } else if (promotion.id==='shadow') {
      const dx=Math.cos(player.aim),dy=Math.sin(player.aim);
      player.x=clamp(x+dx*165,21,FIELD.width-21);player.y=clamp(y+dy*165,21,FIELD.height-21);
      const length=Math.hypot(player.x-x,player.y-y);
      nearby(game,x,y,length+52,(enemy)=>{
        const u=clamp(((enemy.x-x)*(player.x-x)+(enemy.y-y)*(player.y-y))/(length*length||1),0,1);
        if(Math.hypot(enemy.x-x-u*(player.x-x),enemy.y-y-u*(player.y-y))<=45+enemy.radius)
          hurt(game,player,enemy,136*power,color,config.crit);
      });
      player.inv=Math.max(1.6,player.inv);
      effect(game,x,y,35,color,.6,'trail',player.x,player.y);
    }
    return;
  }
  if (player.job==='staff') {
    blast(game,player,x,y,230*config.reach,125*config.power,type.color,config.crit,105,0,'cyclone');
    player.inv=Math.max(1.15,player.inv);
  } else if (player.job==='mage') {
    for (const angle of headings) {
      const distance=95+random(game)*120;
      zone(game,player,'meteor',x+Math.cos(angle)*distance,y+Math.sin(angle)*distance,111*config.reach,67*config.power,type.color,config.crit,.48+random(game)*.82);
    }
  } else {
    for (let i=0;i<(promotion?24:18);i++) shoot(game,player,i/(promotion?24:18)*TAU,{amount:54*config.power,color:type.color,crit:config.crit,reach:560*config.reach,kind:'starArrow',pierce:5,tier:6});
    player.inv=Math.max(.78,player.inv);
  }
}

function updateShots(game, owners) {
  for (const shot of game.shots) {
    shot.life-=STEP;
    const owner=owners.get(shot.owner);
    if (shot.kind==='return' && (shot.returning || shot.life < shot.reach/shot.speed*.50)) {
      if (!owner) { shot.life=0;continue; }
      if (!shot.returning) { shot.returning=true; shot.hit.clear(); }
      shot.angle=Math.atan2(owner.y-shot.y,owner.x-shot.x);
      if (dist(shot,owner)<20) { shot.life=0;continue; }
    }
    shot.x+=Math.cos(shot.angle)*shot.speed*STEP;
    shot.y+=Math.sin(shot.angle)*shot.speed*STEP;
    if (!owner || shot.life<=0) continue;
    nearby(game,shot.x,shot.y,58,(enemy,distance) => {
      if (shot.pierce<=0 || shot.hit.has(enemy.id) || distance>enemy.radius+10) return;
      shot.hit.add(enemy.id);
      shot.pierce--;
      if (shot.kind==='blast') blast(game,owner,shot.x,shot.y,74,shot.amount,shot.color,shot.crit);
      else hurt(game,owner,enemy,shot.amount,shot.color,shot.crit);
    });
  }
  game.shots=game.shots.filter(shot=>shot.life>0&&shot.pierce>0);
}

function updateZones(game, owners) {
  for (const item of game.zones) {
    item.life-=STEP;
    const owner=owners.get(item.owner);
    if (!owner) { item.life=0; continue; }
    const { x,y,radius,amount,color,crit,kind }=item;
    if ((kind==='drop'||kind==='meteor') && item.life<=0 || kind==='mine' && nearest(game,x,y,47)) {
      blast(game,owner,x,y,radius,amount,color,crit,19,0,kind==='meteor'?'nova':'impact');
      item.life=0;
    }
    if(kind==='quake' && item.life<=0) blast(game,owner,x,y,radius,amount,color,crit,16,0,'sweep');
    if ((kind==='field'||kind==='frostfield') && item.life>0) {
      item.tick-=STEP;
      if (item.tick<=0) {
        item.tick=.44;
        nearby(game,x,y,radius,enemy=>{hurt(game,owner,enemy,amount,color,crit);if(kind==='frostfield')enemy.slow=Math.max(enemy.slow,.75);});
      }
    }
  }
  game.zones=game.zones.filter(item=>item.life>0);
}

function spawn(game, kind, around) {
  const [baseHp,speed,radius,damage]=ENEMIES[kind];
  const big = kind==='boss'||kind==='queen'||kind==='elite';
  const distance=big ? 340 : game.elapsed<2 ? 143+random(game)*85 : 330+random(game)*130;
  const angle=random(game)*TAU;
  const minutes=game.elapsed/60;
  const strength=(1+minutes*.21+Math.sqrt(minutes)*.15)*(1+(game.modifiers-1)*(big ? .58 : .28));
  const enemy={
    id:++game.serial,kind,x:clamp(around.x+Math.cos(angle)*distance,22,FIELD.width-22),
    y:clamp(around.y+Math.sin(angle)*distance,22,FIELD.height-22), radius,
    hp:baseHp*strength,maxHp:baseHp*strength,speed:speed*Math.min(1.8,1+minutes*.022),
    damage:damage*(1+minutes*.082),flash:0,slow:0,timer:1.5+random(game)*2,
    wind:0,dash:0,aim:0,face:1,mode:0,tx:0,ty:0
  };
  game.enemies.push(enemy);
  return enemy;
}

function schedule(game, alive) {
  const time=game.elapsed;
  const minutes=time/60;
  if (time>=game.eliteAt) {
    game.eliteAt+=68;
    if (game.enemies.filter(enemy=>enemy.kind==='elite').length<3) {
      spawn(game,'elite',alive[0]);
      game.notice='果園搗蛋王鑽出來了！打倒牠會掉裝備。';
          game.noticeAt=time+5;
    }
  }
  if (time>=game.bossAt) {
    game.bossAt+=125;
    if (game.enemies.filter(enemy=>enemy.kind==='boss'||enemy.kind==='queen').length<2) {
      const kind=game.bossCycle++%2===0 ? 'boss' : 'queen';
      spawn(game,kind,alive[0]);
      game.notice=ENEMIES[kind][5]+'來了！留意紅色預警。';
          game.noticeAt=time+7;
    }
  }
  game.spawnClock-=STEP;
  if (game.spawnClock>0) return;
  const cap=150+Math.min(140,Math.floor(minutes*28));
  const group=Math.min(9,2+Math.floor(time/35)+Math.floor((game.modifiers-1)*.8));
  for (let i=0;i<group && game.enemies.length<cap;i++) {
    const roll=random(game);
    const kind=time>70&&roll>.91?'snail':time>43&&roll>.8?'bee':time>23&&roll>.65?'boar':time>10&&roll>.42?'shroom':'grub';
    spawn(game,kind,alive[Math.floor(random(game)*alive.length)]);
  }
  game.spawnClock=Math.max(.46,1.28-time*.003)/(1+(game.modifiers-1)*.17);
}

function hitPlayer(player, amount, config) {
  if (player.inv>0 || player.down) return;
  player.hp=Math.max(0,player.hp-amount*config.resist);
  player.inv=.70;
  if (player.hp>0) return;
  player.down=true;
  player.walk=false;
  player.rescue=0;
  player.offers=[];
  setMove(player,0,0);
}

function attack(game, enemy, alive, configs) {
  const {kind,mode,tx,ty} = enemy;
  if (kind==='boar') { enemy.dash=.37; return; }
  const radius=mode===1 ? 107 : 75;
  const points = mode===2 ? [[tx,ty],[tx-116,ty+66],[tx+116,ty-66]] : [[tx,ty]];
  for (const [x,y] of points) {
    effect(game,x,y,radius,'#f47154',.44,'pop');
    for (const player of alive) if (Math.hypot(player.x-x,player.y-y)<radius) hitPlayer(player,enemy.damage,configs.get(player.id));
  }
}

function updateEnemies(game, alive, configs) {
  for (const enemy of game.enemies) {
    if (enemy.hp<=0) continue;
    const {kind}=enemy;
    const boss=kind==='boss'||kind==='queen';
    let focus=alive[0], length=dist(enemy,focus);
    for (const player of alive.slice(1)) {
      const distance=dist(enemy,player);
      if (distance<length) { focus=player;length=distance; }
    }
    enemy.flash=Math.max(0,enemy.flash-STEP);
    enemy.slow=Math.max(0,enemy.slow-STEP);
    enemy.timer-=STEP;
    if (enemy.wind>0) {
      enemy.wind=Math.max(0,enemy.wind-STEP);
      if (enemy.wind===0) attack(game,enemy,alive,configs);
    } else if (enemy.dash>0) {
      enemy.dash-=STEP;
      enemy.x=clamp(enemy.x+Math.cos(enemy.aim)*455*STEP,17,FIELD.width-17);
      enemy.y=clamp(enemy.y+Math.sin(enemy.aim)*455*STEP,17,FIELD.height-17);
    } else {
      const angle=Math.atan2(focus.y-enemy.y,focus.x-enemy.x);
      const phase=enemy.hp<enemy.maxHp*.52;
      if (enemy.timer<=0&&((kind==='boar'&&length<228)||(kind==='bee'&&length<240)||(boss&&length<630))) {
        enemy.timer=boss ? (phase ? 2.3 : 3.4) : 3.1;
        enemy.wind=boss ? .92 : kind==='boar' ? .52 : .65;
        enemy.aim=angle;
        enemy.mode=boss ? (kind==='queen'||phase ? 2 : 1) : 0;
        enemy.tx=focus.x;
        enemy.ty=focus.y;
      } else if (length>15) {
        const speed=enemy.speed*(enemy.slow>0 ? .48 : 1)*(boss&&phase ? 1.24 : 1);
        const front=kind==='bee'&&length<113 ? -.60 : 1;
        enemy.x=clamp(enemy.x+Math.cos(angle)*speed*front*STEP,17,FIELD.width-17);
        enemy.y=clamp(enemy.y+Math.sin(angle)*speed*front*STEP,17,FIELD.height-17);
        if (Math.abs(Math.cos(angle))>.19) enemy.face=Math.cos(angle)>0 ? 1 : -1;
      }
    }
    for (const player of alive) {
      if (dist(enemy,player)<enemy.radius+12) hitPlayer(player,enemy.damage,configs.get(player.id));
    }
  }
}

function collect(game, configs) {
  let value=0;
  for (const gem of game.gems) {
    let focus, distance=Infinity;
    for (const player of game.players) {
      if (player.down) continue;
      const length=dist(gem,player);
      if (length<player.pickup && length<distance) { focus=player;distance=length; }
    }
    if (!focus) continue;
    if (distance<=18) { value+=gem.value;gem.value=0;continue; }
    const fraction=Math.min(1,STEP*(200+Math.max(0,focus.pickup-distance)*2.9)/distance);
    gem.x+=(focus.x-gem.x)*fraction;
    gem.y+=(focus.y-gem.y)*fraction;
  }
  if (value) {
    game.gems=game.gems.filter(gem=>gem.value>0);
    // 小額果籽也能累積經驗加成；餘數保留到下次拾取。
    const teamWisdom=Math.max(0,...game.players.filter(player=>!player.down).map(player=>configs.get(player.id)?.wisdom||0));
    const adjusted=value*(1+teamWisdom)+game.bonusXpCarry;
    const gained=Math.floor(adjusted);
    game.bonusXpCarry=adjusted-gained;
    if(gained>0)gainXp(game,gained);
  }
}

function updateRescue(game) {
  for (const down of game.players) {
    if (!down.down) continue;
    const helper=game.players.find(player=>!player.down&&dist(player,down)<66);
    down.rescue=clamp(down.rescue+(helper ? STEP : -STEP*.8),0,2.3);
    if (down.rescue<2.3) continue;
    down.down=false;
    down.hp=Math.ceil(down.maxHp*.44);
    down.inv=2;
    down.rescue=0;
    helper.rescues++;
    if (down.pending) makeOffers(game,down);
    effect(game,down.x,down.y,85,'#fff078',.75,'ring');
  }
}

export function finish(game, reason) {
  if (game.ended) return;
  game.ended=true;
  game.reason=reason;
  for (const player of game.players) { player.offers=[];player.walk=false; }
}

export function advance(game) {
  if (game.ended || game.paused || game.players.length===1 && game.players[0].offers.length) return;
  const alive=game.players.filter(player=>!player.down);
  if (!alive.length) { finish(game,'果園收工！下次再來。');return; }
  game.elapsed+=STEP;
  schedule(game,alive);
  const owners=new Map(game.players.map(player=>[player.id,player]));
  const configs=new Map();
  indexEnemies(game);
  for (const player of alive) {
    const config=stats(player);
    configs.set(player.id,config);
    player.pickup=config.magnet;
    player.inv=Math.max(0,player.inv-STEP);
    player.burst=Math.max(0,player.burst-STEP);
    if (config.regen>0) player.hp=Math.min(player.maxHp,player.hp+config.regen*STEP);
    const {x,y}=player.move;
    const oldX=player.x, oldY=player.y;
    player.x=clamp(player.x+x*config.speed*STEP,21,FIELD.width-21);
    player.y=clamp(player.y+y*config.speed*STEP,21,FIELD.height-21);
    const stride=Math.hypot(player.x-oldX,player.y-oldY);
    player.walk=stride>.03;
    if(player.walk)player.gait=(player.gait+stride/67) % 1;
    if (Math.abs(x)>.12 && game.elapsed-player.strikeAt>.34) player.face=x>0 ? 1 : -1;
    for (const [key,level] of Object.entries(player.skills)) {
      player.timers[key]=Math.max(0,(player.timers[key]||0)-STEP);
      if (player.timers[key]===0) useSkill(game,player,key,level,config);
    }
    if (player.burstPending && player.burst===0) burst(game,player,config);
    player.burstPending=false;
    if (player.offers.length&&game.elapsed>=player.deadline) choose(game,player,0,player.offerId);
  }
  updateShots(game,owners);
  updateZones(game,owners);
  updateEnemies(game,alive,configs);
  collect(game,configs);
  updateRescue(game);
  game.enemies=game.enemies.filter(enemy=>enemy.hp>0);
  game.fx=game.fx.filter(item=>(item.life-=STEP)>0);
  if (game.players.every(player=>player.down)) finish(game,'果園收工！下次再來。');
}

// Keep one occupancy cell per group, including enemies beyond the camera.
function radarContacts(enemies) {
  const cells = new Set(), bosses = [];
  for (const e of enemies) {
    if (e.hp<=0) continue;
    if (['elite','boss','queen'].includes(e.kind)) bosses.push([Math.round(e.x),Math.round(e.y),e.kind==='elite'?1:2]);
    else cells.add(Math.min(31,Math.floor(e.x/FIELD.width*32))+32*Math.min(19,Math.floor(e.y/FIELD.height*20)));
  }
  return { cells:[...cells], bosses };
}

export function buildView(game, focusId) {
  const focus=game.players.find(player=>player.id===focusId) || game.players[0];
  const see=object=>Math.abs(object.x-focus.x)<760&&Math.abs(object.y-focus.y)<660;
  const n=Math.round;
  return {
    radar:radarContacts(game.enemies), t:game.elapsed,l:game.level,xp:game.xp,xpMax:THRESHOLD(game.level),done:game.ended,reason:game.reason,
    notice:game.elapsed<game.noticeAt ? game.notice : '', nextBoss:game.bossAt, paused:game.paused,
    players:game.players.map(p=>({
      id:p.id,name:p.name,job:p.job,promotion:p.promotion,x:n(p.x),y:n(p.y),face:p.face,walk:p.walk,gait:n(p.gait*255),travelY:p.walk&&Math.abs(p.move.y)>.35?Math.sign(p.move.y):0,down:p.down,
      look:{ level:p.skills[CLASSES[p.job].skill], evolved:Boolean(p.evolution[CLASSES[p.job].skill]), slots:p.gear.map(item=>item ? 1+item.rarity+item.rank*6 : 0), swing:n(Math.max(0,1-(game.elapsed-p.strikeAt)/.4)*100), aim:n(p.aim*100)/100 },
      hp:n(p.hp),maxHp:p.maxHp,rev:p.rescue,inv:p.inv>0,kills:p.kills,damage:n(p.damage),bosses:p.bosses,rescues:p.rescues
    })),
    own:{id:focus.id,limit:focus.limit,forgotten:focus.forgotten,canBanish:focus.banishedAt!==game.level,promotion:focus.promotion,burst:focus.burst,offers:focus.offers,offerId:focus.offerId,deadline:focus.deadline,
      gear:focus.gear,loot:focus.loot,crumbs:focus.crumbs,skills:focus.skills,passive:focus.passive,evolution:focus.evolution,
      attributes:focus.attributes,statPoints:focus.statPoints,legendaryTokens:focus.legendaryTokens,
      timers:focus.timers,derived:stats(focus)},
    boss:game.enemies.filter(e=>e.hp>0&&['boss','queen'].includes(e.kind))
      .map(e=>({name:ENEMIES[e.kind][5],hp:n(e.hp),maxHp:n(e.maxHp),kind:e.kind}))
      .sort((a,b)=>b.hp-a.hp)[0]||null,
    enemies:game.enemies.filter(see).map(e=>[e.id,e.kind,n(e.x),n(e.y),e.radius,n(100*e.hp/e.maxHp),e.flash>0,e.face,n(e.wind*100),e.mode,n(e.tx),n(e.ty),n(e.aim*100)/100]),
    gems:game.gems.filter(see).map(g=>[n(g.x),n(g.y),g.value]),
    shots:game.shots.filter(see).map(s=>[s.id,n(s.x),n(s.y),n(s.angle*100)/100,s.color,s.kind,s.tier]),
    zones:game.zones.filter(see).map(z=>[n(z.x),n(z.y),n(z.radius),z.kind,z.color,n(100*z.life/z.max),z.id]),
    fx:game.fx.filter(see).slice(-44).map(f=>[n(f.x),n(f.y),n(f.radius),f.color,n(f.life/f.max*100),f.kind,n(f.x2),n(f.y2),f.label])
  };
}
