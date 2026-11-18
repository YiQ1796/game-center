
import { advance, buildView, choose, finish, gearAction, newGame, setMove } from './arena.mjs?v=021';
import { CLASSES, EVOLUTIONS, PASSIVES, PERKS, RARITIES, SKILLS, SLOTS, STEP, TAUNTS, isClass } from './content.mjs?v=021';
import { adventurer } from './actors.mjs?v=021';
import { Scene } from './scene.mjs?v=021';
import { Squad } from './squad.mjs?v=021';
import { getAdvancement } from './advancement.mjs?v=021';

const $ = id => document.getElementById(id);
const ui = Object.fromEntries([
  'home','play','jobs','solo','room-form','room-status','lobby','nickname','room-code','join',
  'room-label','copy','seats','ready','host-start','host','leave','retry','mascot','arena',
  'clock','wave','life-bar','xp-bar','life','level','squad-hud','field-status','notice',
  'stick','knob','burst','keyboard','bag','menu','overlay','panel','dialog-title','dialog-copy','dialog-body','dialog-actions'
].map(id=>[id,$(id)]));
const scene=new Scene(ui.arena,ui.mascot,$('mini-map'));
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

function jobButtons() {
  const buttons=Object.entries(CLASSES).map(([key,item])=>{
    const node=button('', 'job', ()=>{
      if(squad.role==='guest'&&!squad.online) return;
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
    node.append(header,element('p','',item.description));
    return node;
  });
  ui.jobs.replaceChildren(...buttons);
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
  const stats=element('dl','summary');
  for(const [name,value] of [
    ['生存時間',clock(view.t)],['職業',getAdvancement(self.job,self.promotion)?.name||CLASSES[self.job].name],['擊退',self.kills],['總傷害',self.damage.toLocaleString('zh-TW')],
    ['首領',self.bosses],['場次等級',view.l],['救援',self.rescues]
  ]) {
    const pair=element('div','');
    pair.append(element('dt','',name),element('dd','',String(value)));
    stats.append(pair);
  }
  content.append(stats,element('p','loadout','技能：'+Object.entries(view.own.skills).map(([key,rank])=>
    (view.own.evolution[key]?EVOLUTIONS[key][0]:SKILLS[key][0])+' Lv.'+rank).join('、')));
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

function outfitPreview(player,look) {
  const canvas=element('canvas','look-preview');
  canvas.setAttribute('aria-hidden','true');
  canvas.width=144;canvas.height=112;
  const c=canvas.getContext('2d');
  c.scale(1.24,1.24);
  adventurer(c,{...player,face:1,walk:false,down:false,inv:false,look:{...look,swing:0}},ui.mascot,.4,51,72,true);
  return canvas;
}

function equipmentPanel(view,content,actions) {
  const owned=view.own;
  const self=view.players.find(player=>player.id===owned.id)||view.players[0];
  const look=self.look||{level:owned.skills[CLASSES[self.job].skill]||1,evolved:Boolean(owned.evolution[CLASSES[self.job].skill]),slots:owned.gear.map(item=>item?1+item.rarity+item.rank*6:0)};
  const fitting=element('div','dressing');
  fitting.append(outfitPreview(self,look),element('strong','',(getAdvancement(self.job,self.promotion)?.name||CLASSES[self.job].name)+' · '+(look.evolved?EVOLUTIONS[CLASSES[self.job].skill][0]:SKILLS[CLASSES[self.job].skill][0])+' Lv.'+look.level));
  content.append(fitting);
  const wrap=element('div','inventory');
  const equipped=element('section','');
  const found=element('section','');
  const gearList=element('ul','item-list');
  const lootList=element('ul','item-list');
  function itemRow(item,label,worn) {
    const row=element('li','item');
    if(!item) {row.append(element('small','',label+'・空'));return row;}
    const [tier,color]=RARITIES[item.rarity];
    const title=element('strong','',item.name+' · '+tier+(item.rank?' +'+item.rank:''));
    title.style.color=color;
    row.append(title,element('small','',label+' · '+item.perks.map(([key,value])=>
      PERKS[key][0]+' +'+(['magnet','heart'].includes(key)?value.toFixed(1):Math.round(value*100)+'%')).join('、')));
    if(worn&&item.rank<4) {
      const cost=4+item.rank*2;
      const forge=button('強化 · '+cost,'secondary',()=>action('forge',item.id));
      forge.disabled=owned.crumbs<cost;
      row.append(forge);
    }
    if(!worn) row.append(button('裝備','secondary',()=>action('equip',item.id)),
      button('分解 +' + (2+item.rarity),'quiet',()=>action('salvage',item.id)));
    return row;
  }
  owned.gear.forEach((item,i)=>gearList.append(itemRow(item,SLOTS[i],true)));
  owned.loot.forEach(item=>lootList.append(itemRow(item,SLOTS[item.slot],false)));
  if(!owned.loot.length) lootList.append(element('li','item','打倒精英或首領會掉裝備。'));
  equipped.append(element('h3','','裝備欄'),gearList);
  found.append(element('h3','','戰利品'),lootList);
  wrap.append(equipped,found);
  content.append(wrap);
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
  actions.append(button('返回戰場','primary',()=>setPanel('')),toggle);
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
  const coop=!game&&['choose','bag','menu'].includes(mode);
  ui.overlay.classList.toggle('coop',coop);
  ui.panel.setAttribute('aria-modal',String(!coop));
  const fingerprint=mode==='choose'?String(view.own.offerId):mode==='bag'?
    JSON.stringify([view.own.crumbs,view.own.gear,view.own.loot]):'';
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
      if(offer.key===CLASSES[self.job].skill&&(offer.type==='skill'||offer.type==='evolution')){
        const look={level:view.own.skills[CLASSES[self.job].skill]||1,slots:Array(8).fill(0),...self.look};
        if(offer.type==='evolution')look.evolved=true;else look.level++;
        choice.append(outfitPreview(self,look));
      }
      choice.append(element('b','',offer.name),element('small','',offer.text));
      choices.append(choice);
    });
    content.append(choices);
  } else if(mode==='bag') {
    title='當局裝備';copy='強化果核 '+view.own.crumbs;
    equipmentPanel(view,content,actions);
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
  ui['life-bar'].style.transform='scaleX('+Math.max(0,Math.min(1,self.hp/self.maxHp))+')';
  ui['xp-bar'].style.transform='scaleX('+Math.max(0,Math.min(1,view.xp/view.xpMax))+')';
  const countdown=Math.ceil(view.own.burst);
  const burstName=CLASSES[self.job]?.burst||'大招';
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
