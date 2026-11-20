/**
 * Midnight Cabinet V2 — lobby, WebRTC connections, input mapping, 60Hz host simulation.
 * Host owns the game model. The guest transmits input only.
 */
import {GAMES,createGame,updateGame,WIDTH,HEIGHT} from './engine.js?v=200';
import {drawGame} from './art.js?v=200';

const $=id=>document.getElementById(id);
const ROOM_PREFIX='midnight-curio-v2-';
const HOST_KEY='midnight-curio-host-room';
const SAVE_PREFIX='midnight-curio-v2-';
const NAME_KEY='midnight-curio-name';
const NAME_POOL=['霧中黑貓','午夜魔術師','勇敢的小星星','不睡覺騎士','銀河甜點師','路過的月亮','星際飛行員','冒險布丁','太空小精靈','微笑的幽靈'];
const pickName=()=>NAME_POOL[Math.floor(Math.random()*NAME_POOL.length)];
const cleanName=value=>String(value??'').replace(/[\x00-\x1f\x7f]/g,'').trim().slice(0,16)||pickName();
const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const neutral=()=>({x:0,y:0,action:false,actSeq:0,dirSeq:[0,0,0,0]});
const makeCode=()=>{
  const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',bytes=new Uint8Array(6);
  crypto.getRandomValues(bytes);return [...bytes].map(b=>chars[b%chars.length]).join('');
};
const freshState=(a,b='等待好友入座')=>({
  schema:2,phase:'lobby',names:[a,b],connected:[true,false],ready:[false,false],
  mode:null,data:null,scores:[0,0],totalScores:[0,0],roundId:0,gamesPlayed:0,
  message:'',resultMessage:''
});
let role='none',room='',peer=null,connection=null,state=null;
let peerRetry=0,connTimer=0,toastTimer=0;
let localInputs=[neutral(),neutral()],remoteInput=neutral();
let buttonsHeld=new Set(),pointerBindings=new Map(),audioEnabled=true,audio=null;
let controlKey='',lastFrame=0,accumulator=0,lastSent=0,lastSave=0,lastHud=0,lastSoundEvent=-1;
let gameCtx=null,renderCtx=null,renderScale=1;
let pageVisible=true;
const keysHeld=new Set();
const KEYS={
  KeyW:[0,'up'],KeyA:[0,'left'],KeyS:[0,'down'],KeyD:[0,'right'],Space:[0,'action'],
  ArrowUp:[1,'up'],ArrowLeft:[1,'left'],ArrowDown:[1,'down'],ArrowRight:[1,'right'],Enter:[1,'action']
};
const LANE={up:0,right:1,down:2,left:3};
const DIRECTIONS=['up','left','down','right'];

function note(text){
  const element=$('toast');element.textContent=text;element.classList.add('show');
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>element.classList.remove('show'),3000);
}
function connectionLabel(label,level='off'){
  $('connection-state').textContent=label;
  $('connection-dot').className='connection-dot'+(level==='on'?' online':level==='wait'?' wait':'');
}
function setName(){
  const name=cleanName($('player-name').value);$('player-name').value=name;
  try{localStorage.setItem(NAME_KEY,name)}catch{}
  return name;
}
function storeRoom(){
  if(role!=='host'||!room||!state)return;
  try{
    sessionStorage.setItem(SAVE_PREFIX+room,JSON.stringify(state));
    sessionStorage.setItem(HOST_KEY,room);
  }catch{}
}
function inviteRoom(code){
  const url=new URL(location.href);url.searchParams.set('room',code);
  history.replaceState(null,'',url.pathname+url.search+url.hash);
}
function resetInputs(){
  keysHeld.clear();buttonsHeld.clear();pointerBindings.clear();
  localInputs=[neutral(),neutral()];remoteInput=neutral();
}
function dispose(){
  clearTimeout(peerRetry);clearTimeout(connTimer);peerRetry=0;connTimer=0;
  try{connection?.close()}catch{}
  try{peer?.destroy()}catch{}
  connection=null;peer=null;resetInputs();
}
function exitRoom(){
  const previousRoom=room,wasHost=role==='host';
  role='none';dispose();room='';state=null;controlKey='';lastSoundEvent=-1;
  try{
    sessionStorage.removeItem(HOST_KEY);
    if(wasHost)sessionStorage.removeItem(SAVE_PREFIX+previousRoom);
  }catch{}
  history.replaceState(null,'',location.pathname);
  connectionLabel('尚未連線');$('welcome-status').textContent='';
  render();
}
function sendSnapshot(){
  if(role!=='host'||!state)return;
  if(connection?.open)try{connection.send({type:'snapshot',state})}catch{}
}
function syncNow(){
  if(role==='host'){storeRoom();sendSnapshot()}
  render();
}
function enterLocal(){
  role='local';dispose();room='';controlKey='';
  state=freshState(setName(),pickName());
  state.connected=[true,true];state.ready=[true,true];state.message='兩位玩家已就緒，挑選一扇門。';
  connectionLabel('同機雙人','on');render();
}
function hostRoom(code='',restoring=false){
  if(typeof window.Peer!=='function'){
    $('welcome-status').textContent='線上連線元件無法載入，可使用同機模式。';return;
  }
  role='host';dispose();room=code||makeCode();controlKey='';
  if(restoring){
    try{
      const saved=JSON.parse(sessionStorage.getItem(SAVE_PREFIX+room)||'null');
      if(saved?.schema===2&&Array.isArray(saved.names)&&saved.names.length===2&&
         ['lobby','play','result'].includes(saved.phase)){
        state=saved;state.connected=[true,false];if(state.phase==='lobby')state.ready[1]=false;
      }
    }catch{}
  }
  if(!restoring||!state)state=freshState(setName());
  inviteRoom(room);connectionLabel('建立房間中','wait');render();
  const open=()=>{
    if(role!=='host')return;
    const candidate=new window.Peer(ROOM_PREFIX+room,{debug:0});
    peer=candidate;
    candidate.on('open',()=>{
      if(peer!==candidate)return;
      connectionLabel('房間已建立','on');syncNow();
    });
    candidate.on('connection',incoming=>{
      if(peer!==candidate||role!=='host'){incoming.close();return;}
      if(connection?.open){
        incoming.on('open',()=>{
          incoming.send({type:'rejected',reason:'房間已有兩位玩家。'});
          incoming.close();
        });return;
      }
      connection=incoming;
      incoming.on('open',()=>{
        if(connection!==incoming)return;
        state.connected[1]=true;state.message='好友已入座。';
        syncNow();
      });
      incoming.on('data',msg=>{
        if(connection!==incoming||!msg||typeof msg!=='object')return;
        if(msg.type==='hello'){
          state.names[1]=cleanName(msg.name);state.connected[1]=true;
          state.message='兩位玩家已入座，請完成準備。';syncNow();return;
        }
        if(msg.type==='ready'&&state.phase==='lobby'){
          state.ready[1]=!state.ready[1];syncNow();return;
        }
        if(msg.type==='input'&&state.phase==='play'){
          remoteInput=sanitizeInput(msg.input);
        }
      });
      incoming.on('close',()=>{
        if(connection!==incoming)return;
        connection=null;remoteInput=neutral();state.connected[1]=false;
        if(state.phase==='lobby')state.ready[1]=false;
        state.message='好友離線，請用原房號重新加入。';
        syncNow();
      });
      incoming.on('error',()=>{if(connection===incoming)note('好友連線暫時不穩定。')});
    });
    candidate.on('error',error=>{
      if(peer!==candidate||role!=='host')return;
      const type=String(error?.type||'');
      if(type==='unavailable-id'&&peerRetry<8){
        peerRetry++;connectionLabel('等待原房間釋放','wait');
        candidate.destroy();
        connTimer=setTimeout(open,1500+peerRetry*1100);
      }else{connectionLabel('房間連線發生問題');note('無法開房：'+(type||'未知錯誤'))}
    });
    candidate.on('disconnected',()=>{if(peer===candidate&&role==='host'&&!candidate.destroyed)try{candidate.reconnect()}catch{}});
  };
  try{open()}catch(error){note(String(error?.message||error))}
}
function sanitizeInput(value){
  const v=value&&typeof value==='object'?value:{};
  const axis=n=>Number.isFinite(n)?Math.max(-1,Math.min(1,n)):0;
  return {
    x:axis(v.x),y:axis(v.y),action:v.action===true,
    actSeq:Number.isSafeInteger(v.actSeq)?Math.max(0,Math.min(1e9,v.actSeq)):0,
    dirSeq:Array.from({length:4},(_,i)=>Number.isSafeInteger(v.dirSeq?.[i])?Math.max(0,Math.min(1e9,v.dirSeq[i])):0)
  };
}
function joinRoom(code){
  if(typeof window.Peer!=='function'){
    $('welcome-status').textContent='線上連線元件無法載入，可使用同機模式。';return;
  }
  role='guest';dispose();room=code;controlKey='';state=null;setName();inviteRoom(room);
  connectionLabel('正在尋找好友','wait');$('welcome-status').textContent='正在加入房間 '+room+'…';render();
  try{
    const candidate=new window.Peer(undefined,{debug:0});peer=candidate;
    candidate.on('open',()=>{if(peer===candidate)connectGuest()});
    candidate.on('error',error=>{
      if(peer!==candidate||role!=='guest')return;
      connectionLabel('連線異常','wait');
      if(error?.type==='peer-unavailable')note('找不到這個房間，請核對房號。');
      queueReconnect();
    });
    candidate.on('disconnected',()=>{if(role==='guest'&&!candidate.destroyed)try{candidate.reconnect()}catch{}});
  }catch(error){note(String(error?.message||error))}
}
function connectGuest(){
  if(role!=='guest'||!peer?.open||connection?.open)return;
  const incoming=peer.connect(ROOM_PREFIX+room,{reliable:true,serialization:'json'});
  connection=incoming;
  incoming.on('open',()=>{
    if(connection!==incoming)return;
    clearTimeout(connTimer);connTimer=0;
    connectionLabel('好友已連線','on');incoming.send({type:'hello',name:setName()});
  });
  incoming.on('data',msg=>{
    if(connection!==incoming||!msg||typeof msg!=='object')return;
    if(msg.type==='rejected'){note(msg.reason||'房間已滿');return}
    if(msg.type!=='snapshot'||msg.state?.schema!==2)return;
    const data=msg.state;
    if(!Array.isArray(data.names)||data.names.length!==2||!['lobby','play','result'].includes(data.phase))return;
    const previousId=state?.roundId;
    state=data;
    if(previousId!==state.roundId){resetInputs();lastSoundEvent=-1}
    if(state.phase==='play'&&state.data?.event&&state.data.eventAt!==lastSoundEvent){
      lastSoundEvent=state.data.eventAt;synth(2);
    }
    $('welcome-status').textContent='';
    render();
  });
  incoming.on('close',()=>{
    if(connection!==incoming)return;
    connection=null;connectionLabel('重新連接中','wait');queueReconnect();
  });
  incoming.on('error',()=>{if(connection===incoming){connection=null;queueReconnect()}});
  connTimer=setTimeout(()=>{
    if(role==='guest'&&connection===incoming&&!incoming.open){
      incoming.close();connection=null;queueReconnect();
    }
  },8500);
}
function queueReconnect(){
  if(role!=='guest'||peerRetry)return;
  peerRetry=setTimeout(()=>{
    peerRetry=0;
    if(role==='guest'&&peer?.open&&!connection?.open)connectGuest();
  },2400);
}
function myPlayers(){return role==='local'?[0,1]:role==='host'?[0]:[1]}
function leader(){return role==='local'||role==='host'}
function selectGame(index){
  if(!leader()||!state||state.phase!=='lobby'||!Number.isInteger(index)||index<0||index>=12)return;
  if(!state.connected.every(Boolean)||!state.ready.every(Boolean)){
    note('請先等兩位玩家完成入座與準備。');return;
  }
  state.mode=index;state.data=createGame(index);
  state.scores=[0,0];state.phase='play';state.roundId++;state.message='';
  resetInputs();controlKey='';lastSoundEvent=-1;syncNow();
}
function goLobby(){
  if(!leader()||!state)return;
  state.mode=null;state.data=null;state.phase='lobby';
  state.ready=role==='local'?[true,true]:[true,state.connected[1]];
  state.message='選擇下一扇封印。';controlKey='';resetInputs();syncNow();
}
function finishGame(){
  if(!leader()||!state||state.phase!=='play'||!state.data?.over)return;
  state.scores=state.data.scores.map(x=>Math.round(x));
  state.totalScores=state.totalScores.map((v,i)=>v+state.scores[i]);
  state.gamesPlayed++;
  state.resultMessage=state.data.reason;
  state.phase='result';controlKey='';syncNow();
}
function toggleReady(){
  if(!state||state.phase!=='lobby'||role==='local')return;
  if(role==='guest'){if(connection?.open){connection.send({type:'ready'});$('ready-button').disabled=true;setTimeout(()=>{if(state?.phase==='lobby')$('ready-button').disabled=false},700)}}
  else{state.ready[0]=!state.ready[0];syncNow()}
}
function renderLobby(){
  for(let i=0;i<2;i++){
    $('seat-'+i).textContent=state.names[i];
    $('seat-status-'+i).textContent=!state.connected[i]?'尚未連線':state.ready[i]?'✓ 已準備':'● 等待準備';
  }
  $('room-code-wrap').hidden=role==='local';$('room-code-label').textContent=room;
  $('invite-button').hidden=role==='local';$('ready-button').hidden=role==='local';
  const me=role==='guest'?1:0;
  $('ready-button').textContent=state.ready[me]?'取消準備':'我準備好了';
  const prepared=state.ready.every(Boolean)&&state.connected.every(Boolean);
  $('lobby-note').textContent=!state.connected[1]?'等好友加入房間後就能開始。':!prepared?'雙方都完成準備，再打開神祕封印。':role==='guest'?'兩人已準備，等待房主選擇封印。':'兩人已準備，請選擇一扇門。';
  $('cabinet-grid').innerHTML=GAMES.map((g,i)=>'<button class="cabinet '+(prepared&&leader()?'':'locked')+'" style="--tone:'+g.color+'" data-cabinet="'+i+'" '+(prepared&&leader()?'':'disabled')+' aria-label="開啟封印 '+(i+1)+'"><span class="cabinet-index">SEALED / '+String(i+1).padStart(2,'0')+'</span><span class="cabinet-glyph" aria-hidden="true">'+g.icon+'</span><span class="cabinet-name">未知封印 · '+String(i+1).padStart(2,'0')+'</span><span class="cabinet-sub">✧ 解鎖一場未知的冒險</span></button>').join('');
}
function renderControls(){
  if(state?.phase!=='play')return;
  const mode=GAMES[state.mode],pids=myPlayers(),key=role+'-'+state.roundId+'-'+(mode.rhythm?'rhythm':'move');
  if(key===controlKey)return;
  controlKey=key;
  const labels=mode.rhythm?[['up','↑'],['right','→'],['down','↓'],['left','←']]:[['up','↑'],['left','←'],['down','↓'],['right','→']];
  $('touch-controls').innerHTML=pids.map(p=>'<section class="touch-player touch-p'+p+'"><div class="touch-heading"><span class="player-dot dot-'+p+'"></span>'+escapeHTML(state.names[p])+'</div><div class="touch-key-grid '+(mode.rhythm?'touch-rhythm':'')+'">'+labels.map(([key,symbol])=>'<button type="button" data-player="'+p+'" data-control="'+key+'" aria-label="'+({up:'上',left:'左',down:'下',right:'右'})[key]+'">'+symbol+'</button>').join('')+'</div>'+(mode.rhythm?'':'<button type="button" class="touch-action" data-player="'+p+'" data-control="action">✦ 動作</button>')+'</section>').join('');
  // Data-driven HTML controls: pointer state is rebuilt when the round changes.
}
function renderPlaying(){
  const g=GAMES[state.mode],game=state.data;
  $('mode-title').textContent=g.name;
  $('instruction').textContent=g.tip;
  $('score-name-0').textContent=state.names[0];$('score-name-1').textContent=state.names[1];
  $('score-0').textContent=Math.round(game?.scores?.[0]||0);
  $('score-1').textContent=Math.round(game?.scores?.[1]||0);
  $('game-round').textContent='挑戰 '+String(state.mode+1).padStart(2,'0')+' / 12';
  $('play-notice').textContent=game?.event&&game.elapsed-game.eventAt<2?game.event:'✦ '+g.category+'　·　雙人挑戰進行中';
  $('back-lobby').disabled=!leader();
  renderControls();
}
function renderResult(){
  const [a,b]=state.scores;
  const winner=a>b?0:b>a?1:-1;
  $('result-title').textContent=winner<0?'精彩的平手！':state.names[winner]+' 取得勝利！';
  $('result-detail').textContent=state.resultMessage;
  $('result-scores').innerHTML=state.scores.map((v,p)=>'<div><span>'+escapeHTML(state.names[p])+'</span><strong>'+Math.round(v)+'</strong><small>總分 '+Math.round(state.totalScores[p])+'</small></div>').join('');
  $('again-button').disabled=!leader();$('rematch-button').disabled=!leader();
}
function render(){
  $('welcome').hidden=Boolean(state);
  $('lobby').hidden=!state||state.phase!=='lobby';
  $('playing').hidden=!state||state.phase!=='play';
  $('results').hidden=!state||state.phase!=='result';
  if(role==='local')connectionLabel('同機雙人','on');
  else if(role==='host'&&peer?.open)connectionLabel(state?.connected[1]?'好友已連線':'等待好友入座','on');
  else if(role==='guest'&&connection?.open)connectionLabel('已連上房主','on');
  if(!state)return;
  if(state.phase==='lobby')renderLobby();
  if(state.phase==='play')renderPlaying();
  if(state.phase==='result')renderResult();
}
function synth(sound=1){
  if(!audioEnabled)return;
  try{
    const Audio=window.AudioContext||window.webkitAudioContext;
    if(!Audio)return;
    audio ||=new Audio();
    if(audio.state==='suspended')audio.resume().catch(()=>{});
    const o=audio.createOscillator(),gain=audio.createGain(),t=audio.currentTime;
    o.type=sound===2?'triangle':'sine';
    o.frequency.setValueAtTime(sound===2?390:600,t);
    o.frequency.exponentialRampToValueAtTime(sound===2?750:340,t+.09);
    gain.gain.setValueAtTime(.06,t);gain.gain.exponentialRampToValueAtTime(.001,t+.13);
    o.connect(gain).connect(audio.destination);o.start(t);o.stop(t+.14);
  }catch{}
}
function updateInput(p){
  const pressed=k=>keysHeld.has(k)||(buttonsHeld.has(p+':'+k));
  const input=localInputs[p],prevAction=input.action;
  input.x=Number(pressed('right'))-Number(pressed('left'));
  input.y=Number(pressed('down'))-Number(pressed('up'));
  input.action=pressed('action');
  if(input.action&&!prevAction)input.actSeq++;
  if(role==='guest')sendInput();
}
function keyControl(event,down){
  if(!state||state.phase!=='play'||!KEYS[event.code])return;
  if(event.target instanceof HTMLElement&&event.target.closest('input,textarea,[contenteditable]'))return;
  event.preventDefault();
  const [physicalPlayer,kind]=KEYS[event.code];
  // 異地加入者可用自己的 WASD／空白鍵，不必改用訪客二鍵位。
  const p=role==='guest'?1:physicalPlayer;
  if(!myPlayers().includes(p))return;
  const tag=p+':'+kind;
  if(down){
    if(keysHeld.has(tag))return;
    keysHeld.add(tag);
    if(kind in LANE)localInputs[p].dirSeq[LANE[kind]]++;
  }else keysHeld.delete(tag);
  updateInput(p);
}
function touchControl(event,down){
  const target=event.target.closest?.('button[data-control]');
  if(!target)return;
  const p=Number(target.dataset.player),kind=target.dataset.control;
  if(!myPlayers().includes(p))return;
  event.preventDefault();
  if(down){
    if(pointerBindings.has(event.pointerId))return;
    pointerBindings.set(event.pointerId,{p,kind});
    buttonsHeld.add(p+':'+kind);
    if(kind in LANE)localInputs[p].dirSeq[LANE[kind]]++;
    try{target.setPointerCapture(event.pointerId)}catch{}
    target.classList.add('pressed');
  }else{
    const stored=pointerBindings.get(event.pointerId);
    if(!stored)return;
    pointerBindings.delete(event.pointerId);
    const heldKey=stored.p+':'+stored.kind;
    if(![...pointerBindings.values()].some(b=>b.p===stored.p&&b.kind===stored.kind))buttonsHeld.delete(heldKey);
    target.classList.remove('pressed');
  }
  updateInput(p);
}
function sendInput(){
  if(role==='guest'&&connection?.open)try{connection.send({type:'input',input:localInputs[1]})}catch{}
}
function paintFrame(now){
  requestAnimationFrame(paintFrame);
  const current=Math.min(.15,Math.max(0,(now-(lastFrame||now))/1000));lastFrame=now;
  if(!pageVisible||!state||state.phase!=='play'||!state.data)return;
  if(leader()&&state.connected.every(Boolean)){
    accumulator=Math.min(.15,accumulator+current);
    let steps=0;
    while(accumulator>=1/60&&steps++<8){
      updateGame(state.data,[localInputs[0],role==='local'?localInputs[1]:remoteInput],1/60);
      accumulator-=1/60;
    }
    if(state.data.over){finishGame();return}
    if(state.data.eventAt!==lastSoundEvent&&state.data.event){
      lastSoundEvent=state.data.eventAt;synth(2);
    }
    if(role==='host'&&now-lastSent>85){lastSent=now;sendSnapshot()}
    if(role==='host'&&now-lastSave>1900){lastSave=now;storeRoom()}
  }
  if(state.phase!=='play'||!state.data)return;
  try{drawGame(gameCtx,state.data,state.names)}catch(error){
    if(!window.__mysteryRenderWarned){window.__mysteryRenderWarned=true;console.error('Canvas error:',error);note('畫面繪製異常，請重新整理頁面。')}
  }
  if(now-lastHud>180){lastHud=now;renderPlaying()}
  if(role==='guest'&&now-lastSent>95){lastSent=now;sendInput()}
}
function bind(){
  try{$('player-name').value=localStorage.getItem(NAME_KEY)||pickName()}catch{$('player-name').value=pickName()}
  $('random-name').addEventListener('click',()=>{$('player-name').value=pickName()});
  $('local-start').addEventListener('click',enterLocal);
  $('host-start').addEventListener('click',()=>hostRoom());
  $('join-form').addEventListener('submit',event=>{
    event.preventDefault();const code=$('join-code').value.trim().toUpperCase();
    if(!/^[A-Z0-9]{6}$/.test(code)){note('房號需要六個英數字。');return}
    joinRoom(code);
  });
  $('exit-room').addEventListener('click',exitRoom);
  $('ready-button').addEventListener('click',toggleReady);
  $('invite-button').addEventListener('click',async()=>{
    const url=new URL(location.href);url.searchParams.set('room',room);
    try{await navigator.clipboard.writeText(url.href);note('邀請連結已複製。')}
    catch{note('可以手動告訴朋友房號：'+room)}
  });
  $('cabinet-grid').addEventListener('click',event=>{
    const button=event.target.closest('button[data-cabinet]');
    if(button&&!button.disabled)selectGame(Number(button.dataset.cabinet));
  });
  $('back-lobby').addEventListener('click',()=>{if(leader()&&confirm('放棄這一局，返回大廳？'))goLobby()});
  $('again-button').addEventListener('click',goLobby);
  $('rematch-button').addEventListener('click',()=>{
    if(!leader()||!state)return;
    const id=state.mode;goLobby();selectGame(id);
  });
  $('audio-toggle').addEventListener('click',()=>{
    audioEnabled=!audioEnabled;
    $('audio-toggle').textContent=audioEnabled?'♪ 音效開啟':'♪ 音效關閉';
  });
  window.addEventListener('keydown',e=>keyControl(e,true));
  window.addEventListener('keyup',e=>keyControl(e,false));
  window.addEventListener('blur',()=>{keysHeld.clear();for(let p=0;p<2;p++)updateInput(p)});
  for(const type of ['pointerdown','pointerup','pointercancel','lostpointercapture']){
    $('touch-controls').addEventListener(type,e=>touchControl(e,type==='pointerdown'),{passive:false});
  }
  document.addEventListener('visibilitychange',()=>{pageVisible=!document.hidden;lastFrame=0});
  window.addEventListener('online',()=>{if(role==='guest'&&!connection?.open)queueReconnect()});
  const canvas=$('game-canvas');
  const dpr=Math.min(2,window.devicePixelRatio||1);canvas.width=Math.round(WIDTH*dpr);canvas.height=Math.round(HEIGHT*dpr);
  gameCtx=canvas.getContext('2d');gameCtx.setTransform(dpr,0,0,dpr,0,0);
  render();requestAnimationFrame(paintFrame);
}
function resumeInvite(){
  const code=new URLSearchParams(location.search).get('room')?.toUpperCase();
  if(!code||!/^[A-Z0-9]{6}$/.test(code))return;
  $('join-code').value=code;
  try{
    if(sessionStorage.getItem(HOST_KEY)===code){hostRoom(code,true);return}
  }catch{}
  joinRoom(code);
}
bind();
resumeInvite();
