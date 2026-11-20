import { nameChoices,history,publicResults,saveResult,sorted,publishLink,valid } from './ranking.mjs?v=070';

import { stats, banish, purchase, allocateAttribute, advance, buildView, choose, finish, gearAction, newGame, setMove } from './arena.mjs?v=070';
import { salePrice,marketPrice,attributeCost, MARKET, skillNumbers, ATTRIBUTES, CLASSES, EVOLUTIONS, PASSIVES, PERKS, RARITIES, SKILLS, SLOTS, STEP, TAUNTS, isClass } from './content.mjs?v=070';
import { outfitSprite, gearIcon } from './actors.mjs?v=070';
import { FittingStage } from './fitting-stage.mjs?v=070';
import { Scene } from './scene.mjs?v=070';
import { Squad } from './squad.mjs?v=070';
import { ADVANCEMENTS, getAdvancement } from './advancement.mjs?v=070';

const $ = id => document.getElementById(id);
const ui = Object.fromEntries([
  'home','play','jobs','solo','room-form','room-status','lobby','nickname','room-code','join',
  'room-label','copy','seats','ready','host-start','host','leave','retry','arena',
  'clock','wave','life-bar','xp-bar','life','level','squad-hud','field-status','notice',
  'profile','skillbook','stat-count','boss-banner','boss-name','boss-life','active-skills','battle-count',
  'stick','knob','burst','keyboard','bag','menu','overlay','panel','dialog-title','dialog-copy','dialog-body','dialog-actions'
].map(id=>[id,$(id)]));
const fittingStage=new FittingStage($('fitting-stage'));
const scene=new Scene(ui.arena,$('mini-map'));
$('radar-toggle').addEventListener('click',event=>{
  const map=$('mini-map');
  map.hidden=!map.hidden;
  event.currentTarget.setAttribute('aria-expanded',String(!map.hidden));
  scene.radar.last=-1;
});
const keys=new Set();
const directions=new Set(['w','a','s','d','arrowup','arrowleft','arrowdown','arrowright']);
const invitation=new URLSearchParams(location.search).get('room');
let job='staff', game=null, localView=null, panel='', panelKey='', activeRound='', detail='';
let panelStatsOpen=false;
let pointer=null, analog={x:0,y:0}, lastFrame=0, accumulator=0, lastMotion=0, lastHud=0;
let quiet=matchMedia('(prefers-reduced-motion: reduce)').matches;

try { quiet=(localStorage.getItem('sanmao-orchard-fx') || (quiet?'quiet':'full'))==='quiet'; } catch {}

function element(tag, className, text) {
  const result=document.createElement(tag);
  if(className) result.className=className;
  if(text!==undefined) result.textContent=text;
  return result;
}

function button(label,style,handler) {
  const node=element('button',style,label);
  node.type='button';
  node.addEventListener('click',handler);
  return node;
}

function clock(time) {
  const seconds=Math.max(0,Math.floor(time));
  return Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');
}

function setText(node,text) { if(node.textContent!==text) node.textContent=text; }

const squad=new Squad(message=>{
  detail=message??'';
  if(!ui.home.hidden) renderLobby();
});

function rollNames(){ui.nickname.replaceChildren(...nameChoices().map(name=>new Option(name,name)));}
rollNames();$('reroll').addEventListener('click',rollNames);
let rankRequest=0;
async function drawRanks(){
  const token=++rankRequest,list=$('rank-list'),global=$('rank-source').value==='公開';
  list.textContent='讀取中…';
  try{
    const rows=global?await publicResults():history();
    if(token!==rankRequest)return;
    const best=sorted(rows.filter(r=>r.mode===$('rank-mode').value),$('rank-sort').value).slice(0,30);
    if(!best.length){list.textContent='這個榜目前還沒有戰績。';return;}
    const table=element('table','rank-table');
    const header=table.createTHead().insertRow();for(const label of ['名次','猴名','擊殺','生存'])header.append(element('th','',label));
    const body=table.createTBody();
    best.forEach((r,i)=>{const row=body.insertRow();for(const value of [i+1,r.name,r.kills,clock(r.seconds)])row.insertCell().textContent=value;});
    list.replaceChildren(table);
  }catch{if(token===rankRequest)list.textContent='暫時無法讀取公開榜。收合後再開可重試。';}
}
$('rank-box').addEventListener('toggle',()=>{if($('rank-box').open)drawRanks();});
for(const id of ['rank-mode','rank-source','rank-sort'])$(id).addEventListener('change',drawRanks);
let previewRoute=null,previewMaster=false;
function updateFitting(){
  const track=getAdvancement(job,previewRoute),name=track?.name||CLASSES[job].name;
  fittingStage.select(job,track?.id||null,Boolean(track&&previewMaster));
  $('stage-name').textContent=(track&&previewMaster?'三轉 · ':'')+name;
  $('fitting-stage').setAttribute('aria-label',name+'的全身職業試裝');
  const options=[{id:null,name:'起始職業'},...ADVANCEMENTS[job]];
  $('route-options').replaceChildren(...options.map(option=>{
    const node=button(option.name,'route-option',()=>{
      previewRoute=option.id;previewMaster=false;updateFitting();
      $('route-options').querySelector('[aria-pressed="true"]')?.focus({preventScroll:true});
    });
    node.setAttribute('aria-pressed',String((track?.id||null)===option.id));
    return node;
  }));
  if(track)$('route-options').append(button(previewMaster?'看二轉戰裝':'看三轉戰裝','route-option',()=>{previewMaster=!previewMaster;updateFitting();}));
}
function jobButtons() {
  const buttons=Object.entries(CLASSES).map(([key,item])=>{
    const node=button('', 'job', ()=>{
      if(squad.role==='guest'&&!squad.online) return;
      if(job!==key)previewRoute=null;
      job=key;
      if(squad.role) squad.select(key,false);
      jobButtons();
      ui.jobs.querySelector('[aria-pressed="true"]')?.focus({preventScroll:true});
    });
    node.style.setProperty('--job',item.color+'95');
    node.setAttribute('aria-pressed',String(key===job));
    const header=element('span','job-head');
    const icon=element('span','job-icon',item.icon);
    icon.setAttribute('aria-hidden','true');
    const label=element('span','');
    label.append(element('strong','',item.name),element('small','',item.role));
    header.append(icon,label);
    node.append(outfitSprite({job:key}, {level:1,slots:Array(8).fill(0)}),header,element('p','',item.description));
    node.append(element('small','job-stats','生命 '+item.hp+'　移速 '+item.speed+'　'+SKILLS[item.skill][0]),
      element('small','job-tracks','Lv.8　'+ADVANCEMENTS[key].map(track=>track.name).join(' ／ ')));
    return node;
  });
  ui.jobs.replaceChildren(...buttons);
  updateFitting();
}

function renderLobby() {
  const own=squad.seats.find(seat=>seat.id===squad.self);
  ui['room-form'].hidden=Boolean(squad.role);
  ui.lobby.hidden=!squad.role;
  ui.solo.disabled=Boolean(squad.role);
  ui['room-status'].hidden=!detail;
  setText(ui['room-status'],detail);
  if(!squad.role) return;
  if(own&&isClass(own.job)&&job!==own.job) {job=own.job;jobButtons();}
  setText(ui['room-label'],squad.code);
  ui.copy.disabled=squad.role==='host'&&!squad.online;
  ui.seats.replaceChildren(...Array.from({length:4},(_,i)=>{
    const seat=squad.seats[i];
    const row=element('div','seat'+(seat?.on?' on':''));
    if(!seat) {
      row.append(element('strong','','空位'));
      return row;
    }
    row.append(element('strong','',(i===0?'隊長 · ':'')+seat.name+(seat.id===squad.self?'（你）':'')),
      element('span','',(CLASSES[seat.job]?.name||'採果隊員')+' · '+(!seat.on?'離線':seat.ready?'已準備':'未準備')));
    return row;
  }));
  ui.ready.hidden=squad.role!=='guest';
  ui.ready.disabled=!squad.online;
  setText(ui.ready,own?.ready?'取消準備':'我準備好了');
  ui['host-start'].hidden=squad.role!=='host';
  ui['host-start'].disabled=!squad.canStart();
  ui.retry.hidden=squad.role!=='guest'||(squad.online&&!detail);
}

function clearMotion() {
  keys.clear();
  pointer=null;
  analog={x:0,y:0};
  ui.knob.style.transform='';
  if(game) setMove(game.players[0],0,0);
  squad.move(0,0);
  lastMotion=0;
}

function showPlay(round) {
  clearMotion();
  activeRound=round;
  panel='';panelKey='';lastHud=0;accumulator=0;
  scene.reset();
  ui.home.hidden=true;
  ui.play.hidden=false;
  document.body.classList.add('playing');
  ui.overlay.hidden=true;
}

function showHome() {
  clearMotion();
  activeRound='';panel='';panelKey='';
  ui.play.hidden=true;
  ui.home.hidden=false;
  document.body.classList.remove('playing');
  renderLobby();
}

function startSolo() {
  if(squad.role) return;
  const name=ui.nickname.value.trim().slice(0,16)||'猴三毛';
  game=newGame([{id:'solo',job,name}],crypto.getRandomValues(new Uint32Array(1))[0]);
  localView=buildView(game,'solo');
  showPlay('solo');
}

function action(type,value,version) {
  if(game) {
    const player=game.players[0];
    if(type==='burst'&&!game.paused&&!player.offers.length&&!game.ended) player.burstPending=true;
    else if(type==='choose') choose(game,player,value,version);
    else if(type==='banish') banish(game,player,value,version);
    else if(type==='buy') purchase(game,player,value);
    else if(type==='stat') allocateAttribute(game,player,value);
    else gearAction(game,player,type,value);
    localView=buildView(game,'solo');
  } else squad.action(type,value,version);
}

function setPanel(next) {
  if(panel===next) next='';
  panel=next;
  panelKey='';
  if(game) game.paused=Boolean(panel);
  if(panel&&game) clearMotion();
}

function leaveBattle() {
  game=null;localView=null;
  if(squad.role) squad.leave();
  showHome();
}

function summaryPanel(view,self,content,actions) {
  const rows=saveResult(view),mine=rows[view.players.findIndex(player=>player.id===self.id)];
  if(valid(mine)){
    const link=element('a','secondary','登錄公開榜（GitHub）');
    link.href=publishLink(mine);link.target='_blank';link.rel='noopener noreferrer';
    actions.append(link);content.append(element('p','loadout','本機已記錄。公開榜需登入 GitHub，確認送出預填的公開戰績。'));
  }
  const stats=element('dl','summary');
  for(const [name,value] of [
    ['個人生存',clock(self.aliveSeconds)],['場次時間',clock(view.t)],['職業',(self.master?'三轉 · ':'')+(getAdvancement(self.job,self.promotion)?.name||CLASSES[self.job].name)],['擊退',self.kills],['總傷害',self.damage.toLocaleString('zh-TW')],
    ['首領',self.bosses],['場次等級',view.l],['救援',self.rescues]
  ]) {
    const pair=element('div','');
    pair.append(element('dt','',name),element('dd','',String(value)));
    stats.append(pair);
  }
  content.append(stats,element('p','loadout','技能：'+Object.entries(view.own.skills).map(([key,rank])=>
    (view.own.evolution[key]?EVOLUTIONS[key][0]:SKILLS[key][0])+' Lv.'+rank).join('、')));
  const gear=view.own.gear.filter(Boolean);
  if(gear.length)content.append(element('p','loadout','收工時的裝備　'+gear.map(i=>i.name+(i.rank?' +'+i.rank:'')).join('、')));
  if(view.players.length>1) {
    const result=element('ul','result-team');
    for(const player of view.players) {
      result.append(element('li','',player.name+' · '+player.kills+' 擊退／'+player.bosses+' 首領／'+player.rescues+' 救援'));
    }
    content.append(result);
  }
  if(game) actions.append(button('再守一局','primary',startSolo));
  if(squad.role==='host') actions.append(button('回合作大廳','primary',()=>{squad.reset();showHome();}));
  actions.append(button(squad.role?'離開房間':'回到首頁','quiet',leaveBattle));
}


function formatPerk(key,value) {
  if(key==='regen')return value.toFixed(2)+'/秒';
  return ['magnet','heart'].includes(key)?String(Math.round(value*10)/10):(value*100).toFixed(1).replace(/\.0$/,'')+'%';
}
function gearDifference(own,self,item) {
  const next=own.gear.slice();next[item.slot]=item;
  const after=stats({...own,job:self.job,promotion:self.promotion,limit:own.limit||0},next);
  const parts=[];
  for(const [key,label,unit] of [['power','傷害','%'],['resist','減傷','%'],['haste','冷卻縮減','%'],['speed','跑速',''],['hp','生命',''],['crit','暴擊','%'],['reach','範圍','%'],['magnet','拾取',''],['regen','回復','/秒'],['wisdom','經驗','%']]){
    const delta=(after[key]-own.derived[key])*(unit==='%'?100:1)*(['resist','haste'].includes(key)?-1:1);
    if(Math.abs(delta)<.005)continue;
    parts.push(label+' '+(delta>0?'+':'')+Number(delta.toFixed(2))+unit);
  }
  return parts.join('、')||'實際能力相同';
}
function marketPanel(view,self,content,actions){
  const grid=element('div','market-grid');
  for(const [key,item] of Object.entries(MARKET)){
    const row=element('div','market-item');
    row.append(element('strong','',item.name),element('small','',item.description));
    if(item.perks)row.append(element('small','gear-comparison','換上後　'+gearDifference(view.own,self,item)));
    const cost=marketPrice(key,view.own.pointsBought);
    if(item.rarity){row.style.borderColor=RARITIES[item.rarity][1];row.firstChild.style.color=RARITIES[item.rarity][1];}
    const buy=button('購買 · '+cost+' 果核','secondary',()=>action('buy',key));
    buy.disabled=self.down||view.own.crumbs<cost||(key==='juice'&&self.hp>=self.maxHp)||
      ((key==='boots'||item.perks)&&view.own.loot.length>=12)||(key==='point'&&(view.own.statPoints>=180||view.own.pointsBought>=8||Object.values(view.own.attributes).every(n=>n>=99)));
    row.append(buy);grid.append(row);
  }
  content.append(grid);
  actions.append(button('回裝備欄','secondary',()=>setPanel('bag')),button('返回戰場','primary',()=>setPanel('')));
}

function equipmentPanel(view,content,actions) {
  const owned=view.own;
  const self=view.players.find(player=>player.id===owned.id)||view.players[0];
  const look=self.look||{level:owned.skills[CLASSES[self.job].skill]||1,evolved:Boolean(owned.evolution[CLASSES[self.job].skill]),slots:owned.gear.map(item=>item?1+item.rarity+item.rank*6:0)};
  const fitting=element('div','dressing');
  fitting.append(outfitSprite(self,look),element('strong','',(getAdvancement(self.job,self.promotion)?.name||CLASSES[self.job].name)+' · '+(look.evolved?EVOLUTIONS[CLASSES[self.job].skill][0]:SKILLS[CLASSES[self.job].skill][0])+' Lv.'+look.level));
  fitting.append(element('small','gear-vitals','生命 '+self.hp+' / '+Math.round(self.maxHp)+'　傷害 ×'+owned.derived.power.toFixed(2)+'　暴擊 '+Math.round(owned.derived.crit*100)+'%'),
    element('small','gear-vitals','可分配素質 '+owned.statPoints+' 點'));
  content.append(fitting);
  const wrap=element('div','inventory');
  const equipped=element('section','');
  const found=element('section','');
  const gearList=element('ul','item-list');
  const lootList=element('ul','item-list');
  function itemRow(item,label,worn,slot=item?.slot) {
    const row=element('li','item');
    const icon=gearIcon(slot,self.job,self.promotion,self.master);row.append(icon);row.classList.add('has-gear-art');
    if(!item) {row.classList.add('empty-slot');row.append(element('small','',label+'・空'));return row;}
    const [tier,color]=RARITIES[item.rarity];
    const title=element('strong','',item.name+' · '+tier+(item.rank?' +'+item.rank:''));
    title.style.color=color;
    row.append(title,element('small','',label+' · '+item.perks.map(([key,value])=>
      PERKS[key][0]+' +'+formatPerk(key,value)).join('、')));
    if(worn&&item.rank<4) {
      const cost=4+item.rank*2;
      const forge=button('強化 · '+cost,'secondary',()=>action('forge',item.id));
      forge.disabled=owned.crumbs<cost;
      row.append(forge);
    }
    if(worn){
      const remove=button('卸下','quiet',()=>action('unequip',item.id));remove.disabled=owned.loot.length>=12;row.append(remove);
    }else row.append(element('small','gear-comparison','換上後　'+gearDifference(owned,self,item)));
    if(!worn) row.append(button('裝備','secondary',()=>action('equip',item.id)),
      button('出售 · '+salePrice(item)+' 果核','quiet',()=>action('sell',item.id)));
    return row;
  }
  owned.gear.forEach((item,i)=>gearList.append(itemRow(item,SLOTS[i],true,i)));
  owned.loot.forEach(item=>lootList.append(itemRow(item,SLOTS[item.slot],false)));
  if(!owned.loot.length) lootList.append(element('li','item','小怪偶爾掉裝，精英與首領必掉。'));
  equipped.append(element('h3','','裝備欄'),gearList);
  found.append(element('h3','','戰利品 '+owned.loot.length+' / 12'),lootList);
  const character=element('section','gear-character');
  const details=element('details','sheet-stats');
  details.open=window.matchMedia('(min-width: 760px)').matches||panelStatsOpen;
  details.addEventListener('toggle',()=>{if(details.isConnected)panelStatsOpen=details.open;});
  details.append(element('summary','','角色素質（'+owned.statPoints+'）'));
  appendCharacterStats(view,self,details);
  character.append(details);
  wrap.append(character,equipped,found);
  content.append(wrap);
  actions.append(button('果園行商','secondary',()=>setPanel('market')),button('返回戰場','primary',()=>setPanel('')));
}

function appendCharacterStats(view,self,content){
  const own=view.own;
  const attributes=element('div','attribute-grid');
  const effects={
    str:'金箍系傷害',agi:'移動速度／技能冷卻',vit:'最大生命／減傷',
    int:'法術系傷害',dex:'果籽系傷害／攻擊距離',luk:'暴擊率'
  };
  for(const [key,label] of Object.entries(ATTRIBUTES)){
    const cell=element('div','attribute-row');
    const labelBox=element('span','',key.toUpperCase()+' '+label);
    const value=element('strong','',String(own.attributes[key]));
    const cost=attributeCost(own.attributes[key]);
    const add=button(cost===1?'＋':'＋ ('+cost+'點)','attribute-add',()=>action('stat',key));
    add.disabled=own.statPoints<cost||own.attributes[key]>=99||view.done||self.down;
    add.setAttribute('aria-label','提升 '+label);
    const note=element('small','',effects[key]);
    cell.append(labelBox,value,add,note);
    attributes.append(cell);
  }
  content.append(attributes);
  const derived=own.derived;
  const stats=element('div','derived-grid');
  for(const [title,value] of [
    ['傷害倍率','×'+derived.power.toFixed(2)],
    ['技能冷卻','×'+derived.haste.toFixed(2)],
    ['暴擊機率',Math.round(derived.crit*100)+'%'],
    ['攻擊範圍','×'+derived.reach.toFixed(2)],
    ['移動速度',Math.round(derived.speed)],
    ['被擊傷害',Math.round(derived.resist*100)+'%'],
    ['每秒回復',derived.regen.toFixed(2)],
    ['最大生命',Math.round(derived.hp)]
  ]){
    const stat=element('div','derived-stat');
    stat.append(element('span','',title),element('b','',String(value)));
    stats.append(stat);
  }
  content.append(stats);
}

function profilePanel(view,self,content,actions) {
  const own=view.own;
  const header=element('div','profile-head');
  header.append(outfitSprite(self,self.look),element('strong','',
    (getAdvancement(self.job,self.promotion)?.name||CLASSES[self.job].name)
      +' ・Lv.'+view.l+' ・未分配 '+own.statPoints+' 點'));
  content.append(header);
  appendCharacterStats(view,self,content);
  actions.append(button('查看穿戴與背包','secondary',()=>setPanel('bag')),button('返回戰場','primary',()=>setPanel('')));
}

function skillBookPanel(view,self,content,actions) {
  const own=view.own;
  const title=element('p','loadout',
    (getAdvancement(self.job,self.promotion)?.name||CLASSES[self.job].name)+
    '｜主動技能 '+Object.keys(own.skills).length+'/6・被動技能 '+Object.keys(own.passive).length+'/6');
  content.append(title);
  const sections=[['主動技能',own.skills,SKILLS],['被動技能',own.passive,PASSIVES]];
  for(const [heading,owned,source] of sections){
    content.append(element('h3','skill-heading',heading));
    const grid=element('div','skill-book-grid');
    for(const [key,rank] of Object.entries(owned)){
      const entry=element('div','skill-book-entry');
      const skill=source[key];
      const name=own.evolution[key]?EVOLUTIONS[key]?.[0]:skill?.[0];
      entry.append(element('strong','',name+' Lv.'+rank),
        element('small','',skill?.[1]||'主動武器'));
      if(source===SKILLS)entry.append(element('small','',
        '基礎冷卻 '+skill[4].toFixed(1)+' 秒｜'+(own.evolution[key]?'已進化':'未進化')));
      grid.append(entry);
    }
    content.append(grid);
  }
  if(own.forgotten?.length)content.append(element('p','loadout','本局已遺忘　'+own.forgotten.map(k=>(SKILLS[k]||PASSIVES[k])[0]).join('、')));
  content.append(element('p','loadout','技能會自動攻擊。升級三選一可強化技能；符合條件後會出現進化卡。'));
  actions.append(button('返回戰場','primary',()=>setPanel('')));
}

function menuPanel(content,actions) {
  const note=element('p','loadout', game?'遊戲已暫停。':'合作戰鬥持續進行，開房時請把戰場留在前景。');
  const toggle=button(quiet?'特效：精簡':'特效：完整','secondary',()=>{
    quiet=!quiet;
    try {localStorage.setItem('sanmao-orchard-fx',quiet?'quiet':'full');} catch {}
    toggle.textContent=quiet?'特效：精簡':'特效：完整';
  });
  content.append(note);
  actions.append(button('返回戰場','primary',()=>setPanel('')),button('角色素質','secondary',()=>setPanel('profile')),button('技能圖鑑','secondary',()=>setPanel('skills')),toggle);
  if(game||squad.role==='host') actions.append(button('提前結算','quiet',()=>{
    if(game) finish(game,'猴三毛先收工，下一局見。');
    else squad.end();
    setPanel('');
  }));
  if(squad.role==='guest') actions.append(button('重新連線','secondary',()=>squad.connection.reconnect()),button('離開房間','quiet',leaveBattle));
}

function modal(view,self) {
  const offers=view.own.offers;
  const mode=view.done?'done':offers.length?'choose':panel;
  ui.overlay.hidden=!mode;
  if(!mode) {panelKey='';return;}
  const coop=!game&&['choose','bag','menu','profile','skills','market'].includes(mode);
  ui.overlay.classList.toggle('coop',coop);
  ui.panel.setAttribute('aria-modal',String(!coop));
  const fingerprint=mode==='choose'?String(view.own.offerId):mode==='bag'?
    JSON.stringify([view.own.crumbs,view.own.gear,view.own.loot,view.own.statPoints,self.hp]):mode==='market'?
    [view.own.crumbs,view.own.loot.length,view.own.statPoints,self.hp>=self.maxHp,self.down].join(','):mode==='profile'?
    JSON.stringify([view.own.statPoints,view.own.attributes,view.own.derived]):mode==='skills'?
    JSON.stringify([view.own.skills,view.own.passive,view.own.evolution]):'';
  const key=mode+':'+fingerprint;
  if(key===panelKey) {
    if(mode==='choose'&&!game) setText(ui['dialog-copy'],'剩 '+Math.ceil(Math.max(0,view.own.deadline-view.t))+' 秒。逾時會選第一項。');
    return;
  }
  panelKey=key;
  const content=ui['dialog-body'],actions=ui['dialog-actions'];
  content.replaceChildren();actions.replaceChildren();
  let title,copy;
  if(mode==='done') {
    title='果園日報';copy=view.reason||TAUNTS[3];
    summaryPanel(view,self,content,actions);
  } else if(mode==='choose') {
    const isPromotion=offers[0]?.type==='promotion';
    title=isPromotion?'Lv.8 突破轉職！':'升級了，選一項！';
    copy=isPromotion?'選擇猴三毛的進階路線。轉職後本局不能更換。':game?'挑好技能再繼續。':'剩 '+Math.ceil(Math.max(0,view.own.deadline-view.t))+' 秒。逾時會選第一項。';
    const choices=element('div',isPromotion?'choices promotions':'choices');
    offers.forEach((offer,i)=>{
      const choice=button('','choice',()=>action('choose',i,view.own.offerId));
      choice.dataset.type=offer.type;
      choice.dataset.grade=offer.grade||'normal';
      if(offer.grade) choice.append(element('span','rarity-stamp',offer.grade==='legendary'?'★ 傳奇・技能 +3':'◆ 史詩・技能 +2'));
      choice.append(element('span','offer-type',offer.type==='skill'?'主動技能':offer.type==='passive'?'被動技能':offer.type==='evolution'?'技能進化':offer.type==='promotion'?'轉職分支':'特殊獎勵'));
      if(offer.key===CLASSES[self.job].skill&&(offer.type==='skill'||offer.type==='evolution')){
        const look={level:view.own.skills[CLASSES[self.job].skill]||1,slots:Array(8).fill(0),...self.look};
        if(offer.type==='evolution')look.evolved=true;else look.level=Math.min(10,look.level+(offer.rankGain||1));
        choice.append(outfitSprite(self,look));
      }
      choice.append(element('b','',offer.name),element('small','',offer.text));
      if(isPromotion)choice.prepend(outfitSprite({...self,promotion:offer.key},self.look));
      if(offer.type==='skill'||offer.type==='evolution'){
        const old=view.own.skills[offer.key]||0;
        const evolved=Boolean(view.own.evolution[offer.key]);
        const rank=offer.type==='evolution'?old:Math.min(10,old+(offer.rankGain||1));
        const next=skillNumbers(offer.key,rank,view.own.derived,evolved||offer.type==='evolution');
        const prior=old?skillNumbers(offer.key,old,view.own.derived,evolved):null;
        choice.append(element('small','offer-detail','基礎傷害 '+(prior?prior.damage+' → ':'')+next.damage+'　冷卻 '+(prior?prior.cooldown.toFixed(2)+' → ':'')+next.cooldown.toFixed(2)+' 秒'));
      }else if(offer.detail)choice.append(element('small','offer-detail',offer.detail));
      const card=element('div','card-column');card.append(choice);
      if(view.own.canBanish&&['skill','passive'].includes(offer.type)&&!view.own.skills[offer.key]&&!view.own.passive[offer.key]){
        card.append(button('本局遺忘','banish',()=>action('banish',i,view.own.offerId)));
      }
      choices.append(card);
    });
    content.append(choices);
    if(choices.querySelector('.banish'))content.append(element('small','choice-note','每級可遺忘一個未學技能，立即重抽，本局不再出現。'));
  } else if(mode==='bag') {
    title='當局裝備';copy='強化果核 '+view.own.crumbs;
    equipmentPanel(view,content,actions);
  } else if(mode==='market'){
    title='果園行商';copy='可用果核 '+view.own.crumbs;marketPanel(view,self,content,actions);
  } else if(mode==='profile'){
    title='猴三毛・角色素質';copy='升級可獲得 3 點素質，依職業選擇不同成長路線。';
    profilePanel(view,self,content,actions);
  } else if(mode==='skills'){
    title='已學會的技能';copy='K 可以隨時打開技能圖鑑。';
    skillBookPanel(view,self,content,actions);
  } else {
    title='遊戲選單';copy='';
    menuPanel(content,actions);
  }
  setText(ui['dialog-title'],title);
  ui['dialog-copy'].hidden=!copy;
  setText(ui['dialog-copy'],copy);
  if(!coop) (content.querySelector('button')||actions.querySelector('button'))?.focus({preventScroll:true});
}

function updateHud(view,self,now) {
  if(now-lastHud<78) return;
  lastHud=now;
  setText(ui.clock,clock(view.t));
  setText(ui.wave,view.enemies.some(enemy=>enemy[1]==='boss'||enemy[1]==='queen')?'首領出沒':'下波首領 '+clock(Math.max(0,view.nextBoss-view.t)));
  setText(ui.life,self.hp+' / '+Math.round(self.maxHp)+' 生命');
  setText(ui.level,'Lv. '+view.l+' · '+view.xp+' / '+view.xpMax+' 果籽'+(self.promotion?' · '+(getAdvancement(self.job,self.promotion)?.name||'已轉職'):''));
  setText(ui['stat-count'],view.own.statPoints ? '('+view.own.statPoints+')' : '');
  setText(ui['battle-count'],'擊退 '+self.kills+'　✦ 果核 '+view.own.crumbs+
    (view.own.legendaryTokens?'　★ 傳奇券 '+view.own.legendaryTokens:''));
  ui['boss-banner'].hidden=!view.boss;
  if(view.boss){
    setText(ui['boss-name'],view.boss.name+'　'+view.boss.hp+' / '+view.boss.maxHp);
    ui['boss-life'].style.transform='scaleX('+Math.max(0,Math.min(1,view.boss.hp/view.boss.maxHp))+')';
  }
  const skillEntries=Object.entries(view.own.skills).slice(0,6);
  const skillKey=JSON.stringify([skillEntries,view.own.evolution]);
  if(ui['active-skills'].dataset.skillKey!==skillKey){
    ui['active-skills'].dataset.skillKey=skillKey;
    ui['active-skills'].replaceChildren(...skillEntries.map(([key,rank])=>{
      const item=element('div','active-skill');
      item.dataset.key=key;
      const skill=SKILLS[key];
      item.append(element('strong','',view.own.evolution[key] ? (EVOLUTIONS[key]?.[0]||skill[0]) : skill[0]),
        element('small','', 'Lv.'+rank));
      const fill=element('i','skill-cooldown');
      item.append(fill);
      return item;
    }));
  }
  for(const node of ui['active-skills'].children){
    const key=node.dataset.key;
    const base=skillNumbers(key,view.own.skills[key],view.own.derived).cooldown;
    const cooldown=Math.max(0,view.own.timers[key] || 0);
    node.querySelector('.skill-cooldown').style.transform='scaleY('+Math.min(1,cooldown/base)+')';
    node.classList.toggle('cooling',cooldown>.05);
  }
  ui['life-bar'].style.transform='scaleX('+Math.max(0,Math.min(1,self.hp/self.maxHp))+')';
  ui['xp-bar'].style.transform='scaleX('+Math.max(0,Math.min(1,view.xp/view.xpMax))+')';
  const countdown=Math.ceil(view.own.burst);
  const burstName=getAdvancement(self.job,self.promotion)?.burst||CLASSES[self.job]?.burst||'大招';
  setText(ui.burst.firstElementChild,countdown?'冷卻中':'大招');
  setText(ui.burst.lastElementChild,countdown?countdown+' 秒':burstName);
  ui.burst.disabled=self.down||countdown>0||view.done||Boolean(game&&(view.own.offers.length||panel));
  ui.notice.hidden=!view.notice;
  setText(ui.notice,view.notice);
  ui['squad-hud'].hidden=view.players.length<2;
  if(view.players.length>1) {
    const players=view.players.filter(player=>player.id!==self.id);
    const labels=players.map(player=>{
      const seat=squad.seats.find(s=>s.id===player.id);
      const state=seat&&!seat.on?'離線':player.down?'待救援 '+Math.round(player.rev/2.3*100)+'%':Math.ceil(player.hp)+' ♥';
      return player.name+' · '+state;
    });
    if(ui['squad-hud'].dataset.labels!==JSON.stringify(labels)) {
      ui['squad-hud'].dataset.labels=JSON.stringify(labels);
      ui['squad-hud'].replaceChildren(...labels.map(text=>element('span','',text)));
    }
  }
  const stalled=squad.role==='guest'&&squad.receivedAt&&now-squad.receivedAt>1900&&!view.done;
  const status=stalled?'房主畫面暫停或連線中斷 · 會嘗試重連':self.down&&!view.done?'倒地了，等隊友靠近救援…':'';
  ui['field-status'].hidden=!status;
  setText(ui['field-status'],status);
}

function localMotion() {
  const right=keys.has('d')||keys.has('arrowright');
  const left=keys.has('a')||keys.has('arrowleft');
  const up=keys.has('w')||keys.has('arrowup');
  const down=keys.has('s')||keys.has('arrowdown');
  return pointer!==null ? analog : {x:Number(right)-Number(left),y:Number(down)-Number(up)};
}

function stepLocal(match, delta) {
  const was=match.elapsed;
  accumulator=Math.min(.14,accumulator+delta);
  while(accumulator>=STEP) {
    advance(match);
    accumulator-=STEP;
  }
  return was!==match.elapsed;
}

function frame(now) {
  const delta=lastFrame?Math.min(.12,(now-lastFrame)/1000):0;
  lastFrame=now;
  const match=game||squad.match;
  if(!game) squad.tick(now);
  const id=game?'solo':squad.self;
  if (match) {
    const {x,y}=localMotion();
    setMove(match.players[0],x,y);
    if(stepLocal(match,delta)||!localView||localView.done!==match.ended) localView=buildView(match,id);
  } else if(squad.role==='guest'&&squad.view&&now-lastMotion>85) {
    const {x,y}=localMotion();
    squad.move(x,y);
    lastMotion=now;
  }
  const view=match?localView:squad.view;
  if(view&&id) {
    const self=view.players.find(player=>player.id===id);
    const round=game?'solo':squad.role+String(squad.round);
    if(self) {
      if(activeRound!==round) showPlay(round);
      scene.render(view,id,delta,quiet,squad.role==='guest');
      updateHud(view,self,now);
      modal(view,self);
    }
  } else if(activeRound) showHome();
  if(!ui.home.hidden)fittingStage.draw(now,quiet);
  requestAnimationFrame(frame);
}

ui.solo.addEventListener('click',startSolo);
ui.host.addEventListener('click',()=>squad.enter('host','',ui.nickname.value,job));
ui.join.addEventListener('submit',event=>{
  event.preventDefault();
  void squad.enter('guest',ui['room-code'].value.trim(),ui.nickname.value,job);
});
ui['room-code'].addEventListener('input',event=>{event.target.value=event.target.value.replace(/\D/g,'').slice(0,6);});
ui.copy.addEventListener('click',async()=>{
  const url=new URL(location.href);
  url.hash='';url.search='';
  url.searchParams.set('room',squad.code);
  try {await navigator.clipboard.writeText(url.href);detail='邀請連結已複製。';}
  catch {detail='房號 '+squad.code+'。請傳給好友，在首頁輸入加入。';}
  renderLobby();
});
ui.ready.addEventListener('click',()=>{
  const own=squad.seats.find(player=>player.id===squad.self);
  if(own) squad.select(job,!own.ready);
});
ui['host-start'].addEventListener('click',()=>squad.start());
ui.leave.addEventListener('click',()=>squad.leave());
ui.retry.addEventListener('click',()=>squad.connection.reconnect());

ui.profile.addEventListener('click',()=>setPanel('profile'));
ui.skillbook.addEventListener('click',()=>setPanel('skills'));
ui.bag.addEventListener('click',()=>setPanel('bag'));
ui.menu.addEventListener('click',()=>setPanel('menu'));
ui.burst.addEventListener('click',()=>action('burst'));
window.addEventListener('keydown',event=>{
  if(!activeRound||event.target?.matches?.('input,textarea,select')) return;
  const key=event.key.toLowerCase();
  if(directions.has(key)) {
    event.preventDefault();keys.add(key);
  } else if(!event.repeat) {
    if(key===' '&&!event.target?.matches?.('button, a')) {event.preventDefault();action('burst');}
    if(key==='e') setPanel('bag');
    if(key==='c') setPanel('profile');
    if(key==='k') setPanel('skills');
    if(key==='escape') setPanel(panel?'':'menu');
    const view=(game||squad.match)?localView:squad.view;
    if(['1','2','3'].includes(key)&&view?.own.offers.length) action('choose',Number(key)-1,view.own.offerId);
  }
});
window.addEventListener('keyup',event=>keys.delete(event.key.toLowerCase()));
window.addEventListener('blur',clearMotion);
document.addEventListener('visibilitychange',()=>{if(document.hidden) clearMotion();});

function readStick(event) {
  const box=ui.stick.getBoundingClientRect();
  const max=box.width*.30;
  const dx=event.clientX-box.left-box.width/2,dy=event.clientY-box.top-box.height/2;
  const adjust=Math.max(1,Math.hypot(dx,dy)/max);
  const x=dx/adjust,y=dy/adjust;
  ui.knob.style.transform='translate('+x+'px,'+y+'px)';
  analog={x:Math.abs(x)>2?x/max:0,y:Math.abs(y)>2?y/max:0};
}

ui.stick.addEventListener('pointerdown',event=>{
  if(pointer!==null) return;
  event.preventDefault();
  pointer=event.pointerId;
  ui.stick.setPointerCapture(pointer);
  readStick(event);
});
ui.stick.addEventListener('pointermove',event=>{if(event.pointerId===pointer) readStick(event);});
for(const name of ['pointerup','pointercancel','lostpointercapture']) {
  ui.stick.addEventListener(name,event=>{
    if(event.pointerId!==pointer) return;
    pointer=null;analog={x:0,y:0};ui.knob.style.transform='';
  });
}

jobButtons();
if(/^\d{6}$/.test(invitation||'')) ui['room-code'].value=invitation;
const restore=squad.restoreCode();
if(restore&&(!invitation||invitation===restore)) {
  ui['room-code'].value=restore;
  void squad.enter('guest',restore,'',job,true);
}
requestAnimationFrame(frame);
