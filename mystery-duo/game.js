/**
 * 午夜奇物館：房主權威狀態、雙人房間、斷線重連與介面控制。
 * 網路使用 PeerJS 的免費公開訊號服務及 WebRTC DataChannel；
 * 對嚴格 NAT / 防火牆不保證 100% 建立連線。
 */
import {CATALOG,createMode,applyModeAction,tickMode,renderMode} from './modes.js?v=100';

const $=id=>document.getElementById(id);
const ROOM_PREFIX='midnight-curio-';
const STORAGE_PREFIX='midnight-curio-state-';
const NAME_KEY='midnight-curio-name';
const HOST_ROOM_KEY='midnight-curio-host-room';
const namePool=['霧中的黑貓','遲到的魔術師','愛吃布丁的幽靈','倒立的紳士','假裝勇敢的騎士','會唱歌的月亮','迷路的小行星','午夜不睡覺','膽小的星星','神祕的帽子'];
let role='none',room='',peer=null,connection=null,state=null,joinAttempt=0,retryHandle=0,toastTimer=0;
const drafts=[[],[]];
let partyReady=false;
const clampName=value=>String(value??'').replace(/[\x00-\x1f\x7f]/g,'').trim().slice(0,16)||namePool[Math.floor(Math.random()*namePool.length)];
const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const makeCode=()=>{
  const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes=new Uint8Array(6);crypto.getRandomValues(bytes);
  return Array.from(bytes,n=>alphabet[n%alphabet.length]).join('');
};
function showToast(message){
  const el=$('toast');el.textContent=message;el.classList.add('show');
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),3200);
}
function status(text,connected=false,waiting=false){
  $('connection-state').textContent=text;
  $('connection-dot').className='connection-dot'+(connected?' online':waiting?' wait':'');
}
function inputName(){
  const name=clampName($('player-name').value);
  $('player-name').value=name;
  try{localStorage.setItem(NAME_KEY,name)}catch{}
  return name;
}
function freshState(hostName,guestName='等待第二位訪客'){
  return {
    schema:1,phase:'lobby',
    names:[hostName,guestName],ready:[false,false],connected:[true,false],
    mode:null,data:null,scores:[0,0],totalScores:[0,0],
    gamesPlayed:0,roundId:0,message:'',resultMessage:''
  };
}
function resetDrafts(){drafts[0]=[];drafts[1]=[];}
function persist(){
  if(role!=='host'||!room||!state)return;
  try{sessionStorage.setItem(STORAGE_PREFIX+room,JSON.stringify(state));sessionStorage.setItem(HOST_ROOM_KEY,room)}catch{}
}
function setRoomQuery(code){
  const url=new URL(location.href);url.searchParams.set('room',code);
  history.replaceState(null,'',url.pathname+url.search+url.hash);
}
function broadcast(){
  if(role==='host'){
    persist();
    if(connection?.open){try{connection.send({type:'snapshot',state})}catch{}}
  }
  render();
}
function dispose(){
  clearTimeout(retryHandle);retryHandle=0;
  try{connection?.close()}catch{}
  try{peer?.destroy()}catch{}
  connection=null;peer=null;joinAttempt=0;
}
function exitToWelcome(){
  dispose();role='none';room='';state=null;resetDrafts();partyReady=false;
  try{sessionStorage.removeItem(HOST_ROOM_KEY)}catch{}
  history.replaceState(null,'',location.pathname);
  $('welcome-status').textContent='';
  status('尚未連線');render();
}
function chooseLocal(){
  dispose();role='local';room='';state=freshState(inputName(),namePool[Math.floor(Math.random()*namePool.length)]);
  state.ready=[true,true];state.connected=[true,true];state.message='兩位訪客已就緒。選擇任一封印開始。';
  resetDrafts();broadcast();
  showToast('同機雙人已開啟，可以直接選擇挑戰。');
}
function startHost(existingCode='',restoring=false){
  if(typeof window.Peer!=='function'){$('welcome-status').textContent='連線元件載入失敗。仍可使用「同機兩人」。';return;}
  if(!restoring)dispose();
  room=existingCode||makeCode();role='host';resetDrafts();
  if(restoring){
    try{
      const recovered=JSON.parse(sessionStorage.getItem(STORAGE_PREFIX+room)||'null');
      if(recovered&&recovered.schema===1&&Array.isArray(recovered.names)&&recovered.names.length===2){
        state=recovered;state.connected=[true,false];partyReady=true;
      }
    }catch{}
  }
  if(!state||!restoring)state=freshState(inputName());
  setRoomQuery(room);status('建立房間中',false,true);render();
  const openPeer=()=>{
    if(role!=='host')return;
    try{
      peer=new window.Peer(ROOM_PREFIX+room,{debug:0});
      peer.on('open',()=>{
        joinAttempt=0;
        status('房間已建立',true);partyReady=true;persist();broadcast();
      });
      peer.on('connection',incoming=>{
        if(role!=='host'){incoming.close();return;}
        if(connection?.open){
          incoming.on('open',()=>{incoming.send({type:'rejected',reason:'房間已滿，僅限兩位玩家。'});incoming.close()});
          return;
        }
        connection=incoming;
        incoming.on('open',()=>{
          if(connection!==incoming)return;
          state.connected[1]=true;state.message='第二位訪客已入座。';
          broadcast();
        });
        incoming.on('data',message=>{
          if(connection!==incoming||!message||typeof message!=='object')return;
          try{if(JSON.stringify(message).length>1200)return;}catch{return;}
          if(message.type==='hello'){
            state.names[1]=clampName(message.name);
            state.connected[1]=true;
            state.message='兩位訪客已入座，準備好後選擇封印。';
            broadcast();return;
          }
          if(message.type==='ready'&&state.phase==='lobby'){
            state.ready[1]=!state.ready[1];broadcast();return;
          }
          if(message.type==='action'&&typeof message.kind==='string'&&message.kind.length<32){
            if(applyModeAction(state,1,message.kind,message.value))broadcast();
          }
        });
        incoming.on('close',()=>{
          if(connection!==incoming)return;
          connection=null;state.connected[1]=false;
          if(state.phase==='lobby')state.ready[1]=false;
          state.message='好友暫時離線，重新加入原房號即可回到遊戲。';broadcast();
        });
        incoming.on('error',()=>{if(connection===incoming)showToast('好友連線有問題，等待重連。')});
      });
      peer.on('error',error=>{
        if(role!=='host')return;
        const type=String(error?.type||'');
        if(type==='unavailable-id'&&joinAttempt<12){
          joinAttempt++;status('等候舊連線釋放',false,true);
          try{peer.destroy()}catch{}
          retryHandle=setTimeout(openPeer,2000+Math.min(8000,joinAttempt*900));
        }else{
          status('房間連線異常');
          showToast('房間連線錯誤：'+(type||'未知原因'));
        }
      });
      peer.on('disconnected',()=>{if(role==='host'&&!peer.destroyed){status('嘗試恢復信令',false,true);try{peer.reconnect()}catch{}}});
    }catch(error){status('無法開房');$('welcome-status').textContent=String(error?.message||error)}
  };
  openPeer();
}
function startGuest(code){
  if(typeof window.Peer!=='function'){$('welcome-status').textContent='連線元件載入失敗。仍可使用「同機兩人」。';return;}
  dispose();role='guest';room=code.toUpperCase();state=null;inputName();resetDrafts();
  setRoomQuery(room);status('尋找房間中',false,true);$('welcome-status').textContent='正在尋找 '+room+' 的房間...';render();
  try{
    peer=new window.Peer(undefined,{debug:0});
    peer.on('open',()=>connectAsGuest());
    peer.on('error',error=>{
      if(role!=='guest')return;
      status('連線異常',false,true);
      showToast('好友房間暫時無法連接：'+String(error?.type||'網路錯誤'));
      queueReconnect();
    });
    peer.on('disconnected',()=>{try{peer.reconnect()}catch{}});
  }catch(error){$('welcome-status').textContent=String(error?.message||error)}
}
function connectAsGuest(){
  if(role!=='guest'||!peer||peer.destroyed||connection?.open)return;
  try{
    const incoming=peer.connect(ROOM_PREFIX+room,{reliable:true,serialization:'json'});
    connection=incoming;
    incoming.on('open',()=>{
      if(connection!==incoming)return;
      clearTimeout(retryHandle);
      status('已連上房主',true);
      incoming.send({type:'hello',name:inputName()});
    });
    incoming.on('data',message=>{
      if(connection!==incoming||!message||typeof message!=='object')return;
      if(message.type==='rejected'){showToast(String(message.reason||'房間無法加入'));return;}
      if(message.type!=='snapshot'||!message.state||message.state.schema!==1)return;
      const received=message.state;
      if(!Array.isArray(received.names)||received.names.length!==2)return;
      state=received;
      $('welcome-status').textContent='';render();
    });
    incoming.on('close',()=>{
      if(connection!==incoming)return;
      connection=null;status('等待房主重新連接',false,true);
      showToast('連線中斷，正在嘗試恢復原房間。');queueReconnect();
    });
    incoming.on('error',()=>{if(connection===incoming){connection=null;queueReconnect()}});
    setTimeout(()=>{if(role==='guest'&&connection===incoming&&!incoming.open){try{incoming.close()}catch{}connection=null;queueReconnect()}},9000);
  }catch{queueReconnect()}
}
function queueReconnect(){
  if(role!=='guest'||retryHandle)return;
  retryHandle=setTimeout(()=>{
    retryHandle=0;
    if(role==='guest'&&peer&&!peer.destroyed)connectAsGuest();
  },2400);
}
function getViewers(){return role==='local'?[0,1]:role==='host'?[0]:[1]}
function isRoomLeader(){return role==='local'||role==='host'}
function startChallenge(index){
  if(!isRoomLeader()||!state||state.phase!=='lobby'||!Number.isInteger(index)||index<0||index>=CATALOG.length)return;
  if(!state.ready.every(Boolean)||!state.connected.every(Boolean)){
    showToast('兩位玩家都需要入座並準備完成。');return;
  }
  state.phase='play';state.mode=index;state.data=createMode(index);
  state.scores=[0,0];state.message='封印已開啟，祝你們好運。';state.resultMessage='';state.roundId++;resetDrafts();broadcast();
}
function returnLobby(){
  if(!isRoomLeader()||!state)return;
  state.phase='lobby';state.data=null;state.mode=null;
  state.ready=role==='local'?[true,true]:[true,state.connected[1]];
  state.message='挑選下一扇封印吧。';resetDrafts();broadcast();
}
function readyUp(){
  if(!state||state.phase!=='lobby'||role==='local')return;
  if(role==='guest'){if(connection?.open)connection.send({type:'ready'});return;}
  state.ready[0]=!state.ready[0];broadcast();
}
function doGameAction(p,kind,value){
  if(!state||state.phase!=='play')return;
  if(role==='guest'){
    if(p!==1||!connection?.open)return;
    connection.send({type:'action',kind,value});return;
  }
  if(role==='host'&&p!==0)return;
  if(role==='local'&&p!==0&&p!==1)return;
  if(applyModeAction(state,p,kind,value))broadcast();
}
function renderLobby(){
  $('seat-0').textContent=state.names[0];
  $('seat-1').textContent=state.names[1];
  [0,1].forEach(i=>{
    $('seat-status-'+i).textContent=!state.connected[i]?'尚未連線':state.ready[i]?'✓ 已準備':'● 等待準備';
  });
  $('room-code-wrap').hidden=role==='local';
  $('room-code-label').textContent=room;
  $('invite-button').hidden=role==='local';
  $('ready-button').hidden=role==='local';
  const myself=role==='host'?0:1;
  $('ready-button').textContent=state.ready[myself]?'取消準備':'我準備好了';
  $('ready-button').disabled=role==='host'&&!partyReady;
  const allReady=state.connected.every(Boolean)&&state.ready.every(Boolean);
  $('lobby-note').textContent=!state.connected[1]&&role!=='local'?'將房號或邀請連結傳給好友，等他加入。':!allReady?'兩人都按下「準備」，就能開啟十二扇封印。':role==='guest'?'兩位訪客已準備，請房主選擇封印。':'兩位訪客都準備好了，請選擇任意一扇門。';
  $('cabinet-grid').innerHTML=CATALOG.map((entry,i)=>{
    const index=String(i+1).padStart(2,'0');
    return '<button class="cabinet'+(!allReady||!isRoomLeader()?' locked':'')+'" style="--tone:'+entry.tint+'" data-cabinet="'+i+'" '+(!allReady||!isRoomLeader()?'disabled':'')+' aria-label="打開第 '+index+' 道神祕封印"><span class="cabinet-index">SEALED NO. '+index+'</span><span class="cabinet-glyph" aria-hidden="true">'+entry.glyph+'</span><span class="cabinet-name">未知封印 · '+index+'</span><span class="cabinet-sub">✧ 點擊開啟這段故事</span></button>';
  }).join('');
}
function renderPlay(){
  const entry=CATALOG[state.mode];
  $('mode-title').textContent=entry.name;
  $('instruction').textContent=entry.hint;
  $('score-name-0').textContent=state.names[0];$('score-name-1').textContent=state.names[1];
  $('score-0').textContent=state.scores[0];$('score-1').textContent=state.scores[1];
  const data=state.data;
  $('game-round').textContent=data.limit?'ROUND '+(data.round+1)+'/'+data.limit:'封印 '+String(state.mode+1).padStart(2,'0');
  $('arena').innerHTML=renderMode(state,getViewers(),drafts);
  $('play-notice').textContent=state.message||'✦ 無論答案是什麼，請勇敢嘗試。';
  $('back-lobby').disabled=!isRoomLeader();
}
function renderResult(){
  const a=state.scores[0],b=state.scores[1],winner=a>b?0:b>a?1:-1;
  $('result-title').textContent=winner===-1?'兩位平分秋色！':state.names[winner]+' 勝出！';
  $('result-detail').textContent=state.resultMessage;
  $('result-scores').innerHTML=[0,1].map(p=>'<div><span>'+safe(state.names[p])+'</span><strong>'+state.scores[p]+'</strong><small>累積 '+state.totalScores[p]+' 分</small></div>').join('');
  $('again-button').disabled=!isRoomLeader();
  $('rematch-button').disabled=!isRoomLeader();
}
function render(){
  $('welcome').hidden=Boolean(state);
  $('lobby').hidden=!state||state.phase!=='lobby';
  $('playing').hidden=!state||state.phase!=='play';
  $('results').hidden=!state||state.phase!=='result';
  if(role==='local')status('同機雙人',true);
  else if(role==='host'&&peer?.open)status(state?.connected[1]?'好友已連線':'等待好友入座',true);
  else if(role==='guest'&&connection?.open)status('已連上房主',true);
  if(!state)return;
  if(state.phase==='lobby')renderLobby();
  if(state.phase==='play')renderPlay();
  if(state.phase==='result')renderResult();
}
function handleArenaClick(event){
  const button=event.target.closest('button[data-do]');
  if(!button||button.disabled)return;
  const p=Number(button.dataset.p),kind=button.dataset.do,value=button.dataset.v;
  if(!getViewers().includes(p))return;
  if(kind==='prism-add'){
    if(drafts[p].length<4&&/^[0-3]$/.test(value))drafts[p].push(Number(value));
    renderPlay();return;
  }
  if(kind==='prism-clear'){drafts[p]=[];renderPlay();return;}
  if(kind==='prism-submit'){
    if(drafts[p].length===4)doGameAction(p,'prism',drafts[p].join(''));
    return;
  }
  if(kind==='sum-add'){
    const v=Number(value);
    if(drafts[p].length<3&&state.data.numbers.includes(v)&&!drafts[p].includes(v))drafts[p].push(v);
    renderPlay();return;
  }
  if(kind==='sum-clear'){drafts[p]=[];renderPlay();return;}
  if(kind==='sum-submit'){
    if(drafts[p].length===3)doGameAction(p,'sum',drafts[p].join(','));
    return;
  }
  if(kind==='code'){
    const input=$('arena').querySelector('input[data-code="'+p+'"]');
    const attempt=input?.value.trim()||'';
    if(!/^[0-5]{3}$/.test(attempt)||new Set(attempt).size!==3){showToast('請輸入三個不重複的 0～5 數字。');return;}
    doGameAction(p,'code',attempt);return;
  }
  doGameAction(p,kind,value);
}
function bindUI(){
  const stored=(()=>{try{return localStorage.getItem(NAME_KEY)}catch{return null}})();
  $('player-name').value=stored||namePool[Math.floor(Math.random()*namePool.length)];
  $('random-name').addEventListener('click',()=>{$('player-name').value=namePool[Math.floor(Math.random()*namePool.length)]});
  $('local-start').addEventListener('click',chooseLocal);
  $('host-start').addEventListener('click',()=>startHost());
  $('join-form').addEventListener('submit',event=>{
    event.preventDefault();
    const code=$('join-code').value.trim().toUpperCase();
    if(!/^[A-Z0-9]{6}$/.test(code)){showToast('房號需要六個英文字母或數字。');return;}
    startGuest(code);
  });
  $('exit-room').addEventListener('click',exitToWelcome);
  $('ready-button').addEventListener('click',readyUp);
  $('invite-button').addEventListener('click',async()=>{
    const url=new URL(location.href);url.searchParams.set('room',room);
    try{await navigator.clipboard.writeText(url.href);showToast('邀請連結已複製，直接貼給好友。')}
    catch{showToast('無法使用剪貼簿，請手動分享房號：'+room);}
  });
  $('cabinet-grid').addEventListener('click',event=>{
    const card=event.target.closest('button[data-cabinet]');
    if(card&&!card.disabled)startChallenge(Number(card.dataset.cabinet));
  });
  $('arena').addEventListener('click',handleArenaClick);
  $('back-lobby').addEventListener('click',()=>{if(isRoomLeader()&&confirm('離開這扇封印？當局分數不會計入累積戰績。'))returnLobby()});
  $('again-button').addEventListener('click',returnLobby);
  $('rematch-button').addEventListener('click',()=>{if(!isRoomLeader())return;const index=state.mode;returnLobby();startChallenge(index)});
  window.addEventListener('online',()=>{if(role==='guest'&&!connection?.open)queueReconnect()});
  setInterval(()=>{
    if((role==='local'||role==='host')&&state?.phase==='play'&&tickMode(state)){
      if(state.phase==='play'&&state.data?.round>0)resetDrafts();
      broadcast();
    }
  },250);
}
function startFromURL(){
  const code=new URLSearchParams(location.search).get('room');
  if(!code||!/^[A-Za-z0-9]{6}$/.test(code))return;
  $('join-code').value=code.toUpperCase();
  try{
    if(sessionStorage.getItem(HOST_ROOM_KEY)===code.toUpperCase()){
      startHost(code.toUpperCase(),true);return;
    }
  }catch{}
  startGuest(code.toUpperCase());
}
bindUI();
render();
startFromURL();
