/**
 * 午夜奇物館：十二個獨立挑戰的規則引擎。
 * 對戰狀態由房主持有；此模組不操作網路、DOM 或儲存。
 */
export const CATALOG = Object.freeze([
  { glyph:'✦', tint:'#e9c98e', name:'失落星匣', hint:'輪流開啟星匣，帶走其中的運氣。較高分的訪客勝出。' },
  { glyph:'⌘', tint:'#a7bbf6', name:'千面密語', hint:'各自輸入三個不重複的 0～5 數字。精準命中與位置錯誤都會提供線索，三輪後結算。' },
  { glyph:'◈', tint:'#ed9cb8', name:'鏡中花園', hint:'翻開兩張相同的牌就得分。每人輪流翻牌，記住你看過的位置。' },
  { glyph:'☷', tint:'#b8d6a4', name:'九宮結界', hint:'兩人輪流在九宮格留下記號，先連成一線的人獲勝。' },
  { glyph:'♜', tint:'#f6c98d', name:'幽靈拍賣會', hint:'五輪密封出價；每輪由出價最高的人取得神祕拍品。要小心手上的籌碼。' },
  { glyph:'☾', tint:'#8cdedc', name:'迷霧長廊', hint:'輪流指引自己的旅行者穿過迷宮。先到達出口的人獲勝。' },
  { glyph:'✺', tint:'#f5df9c', name:'群星觀測站', hint:'仔細數清天幕上的星星，再提交答案。共計三回合。' },
  { glyph:'⚔', tint:'#eea8c4', name:'三相決鬥', hint:'同時選擇招式，互相克制，五輪後分出高下。' },
  { glyph:'❖', tint:'#a2cbfd', name:'稜鏡回憶', hint:'先記住短暫出現的色彩序列，再依照順序重現。共有三輪。' },
  { glyph:'◎', tint:'#eac3ab', name:'星軌狙擊場', hint:'根據羅盤給你的方位提示，在七乘七的星盤中尋找目標。共四輪。' },
  { glyph:'∑', tint:'#d7c7fa', name:'鍊金算式', hint:'每輪從六枚數字符文中選三枚，讓加總盡量接近指定目標。' },
  { glyph:'⚙', tint:'#a8dfd0', name:'雙心機關', hint:'這是合作試煉。兩人各選一個齒輪刻度；兩個刻度相加除以四的餘數，必須等於中央的光芒值。' }
]);

const icons=['◆','✿','✦','❖','☾','✧','◈','♠'];
const palette=['#f1b1a8','#e6d17e','#83d6c9','#b5a6ed'];
const valuesRange=(n)=>Array.from({length:n},(_,i)=>i);
const randomInt=(max)=>Math.floor(Math.random()*max);
const shuffle=(list)=>list.map(v=>({v,r:Math.random()})).sort((a,b)=>a.r-b.r).map(x=>x.v);
const safe=(text)=>String(text??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const card=(p,kind,value,html,enabled=true,cls='choice')=>'<button class="'+cls+'" data-do="'+kind+'" data-p="'+p+'" data-v="'+safe(value)+'" '+(!enabled?'disabled':'')+'>'+html+'</button>';
const panel=(s,p,body)=>'<section class="player-panel" data-player="'+p+'"><h3>'+safe(s.names[p])+'<span>訪客 '+(p+1)+'</span></h3>'+body+'</section>';
const panels=(s,viewers,makeBody)=>'<div class="player-panels" style="--panel-count:'+viewers.length+'">'+viewers.map(p=>panel(s,p,makeBody(p))).join('')+'</div>';
const done=(list)=>list[0]!==null&&list[1]!==null;
const wait=(d,message)=>{d.reveal=message;d.nextAt=Date.now()+1850;};
const colorDot=(i,unknown=false)=>'<span class="color-dot'+(unknown?' unknown':'')+'" '+(!unknown?'style="--dot:'+palette[i]+'"':'')+'></span>';
const roundBadge=(s,d)=>'<p class="mode-head">回合 '+(d.round+1)+' ／ '+(d.limit||1)+'</p>';
const notice=(s,message)=>{s.message=message;};
const finish=(s,reason)=>{
  if(s.phase!=='play')return;
  s.phase='result';s.resultMessage=reason||'封印挑戰結束。';
  s.totalScores[0]+=s.scores[0];s.totalScores[1]+=s.scores[1];
  s.gamesPlayed+=1;s.message='';
};
function newMaze(){
  const valid=(walls)=>{
    const seen=new Set([0]),queue=[0];
    while(queue.length){const i=queue.shift(),x=i%5,y=Math.floor(i/5);
      for(const [dx,dy] of [[0,1],[1,0],[0,-1],[-1,0]]){
        const nx=x+dx,ny=y+dy,k=ny*5+nx;
        if(nx<0||ny<0||nx>4||ny>4||walls.includes(k)||seen.has(k))continue;
        seen.add(k);queue.push(k);
      }
    }return seen.has(24);
  };
  let walls;
  do{walls=shuffle(valuesRange(23).map(x=>x+1)).slice(0,6)}while(!valid(walls));
  return walls;
}
function newStarSet(n){
  return valuesRange(n).map(i=>({x:5+randomInt(90),y:8+randomInt(84),delay:(i%5)*-.4}));
}
function nextRound(s){
  const d=s.data; d.round+=1;
  if(d.round>=d.limit){finish(s,'全部回合都已完成，奇物館已記錄這次的對決。');return;}
  d.nextAt=0;d.reveal='';
  if(s.mode===1){d.entries=[null,null];}
  if(s.mode===4){d.bids=[null,null];}
  if(s.mode===6){d.count=8+randomInt(9);d.stars=newStarSet(d.count);d.guesses=[null,null];}
  if(s.mode===7){d.choices=[null,null];}
  if(s.mode===8){d.sequence=valuesRange(4).map(()=>randomInt(4));d.guesses=[null,null];d.phase='show';d.showUntil=Date.now()+2900;}
  if(s.mode===9){d.target=[randomInt(7),randomInt(7)];d.guesses=[null,null];}
  if(s.mode===10){d.numbers=shuffle([1,2,3,4,5,6,7,8,9]).slice(0,6);d.target=11+randomInt(13);d.guesses=[null,null];}
  if(s.mode===11){d.target=randomInt(4);d.choices=[null,null];}
  notice(s,'新的一輪開始了。');
}
export function createMode(index){
  switch(index){
    case 0:return {type:0,tiles:shuffle([5,4,3,3,3,2,2,2,1,1,1,0,0,-1,-2,-3]),opened:Array(16).fill(null),turn:0,picks:0};
    case 1:return {type:1,secret:shuffle([0,1,2,3,4,5]).slice(0,3).join(''),entries:[null,null],history:[],round:0,limit:3,nextAt:0};
    case 2:return {type:2,deck:shuffle([0,0,1,1,2,2,3,3,4,4,5,5]),matched:[],open:[],turn:0,first:null,pairs:0,nextAt:0};
    case 3:return {type:3,cells:Array(9).fill(null),turn:0};
    case 4:return {type:4,prizes:shuffle([4,5,7,8,10]),budgets:[20,20],bids:[null,null],round:0,limit:5,nextAt:0,history:[]};
    case 5:return {type:5,walls:newMaze(),pos:[0,0],turn:0,moves:0};
    case 6:{const count=8+randomInt(9);return {type:6,count,stars:newStarSet(count),guesses:[null,null],round:0,limit:3,nextAt:0,history:[]};}
    case 7:return {type:7,choices:[null,null],round:0,limit:5,nextAt:0,history:[]};
    case 8:return {type:8,sequence:valuesRange(4).map(()=>randomInt(4)),guesses:[null,null],round:0,limit:3,phase:'show',showUntil:Date.now()+2900,nextAt:0,history:[]};
    case 9:return {type:9,target:[randomInt(7),randomInt(7)],guesses:[null,null],round:0,limit:4,nextAt:0,history:[]};
    case 10:return {type:10,numbers:shuffle([1,2,3,4,5,6,7,8,9]).slice(0,6),target:11+randomInt(13),guesses:[null,null],round:0,limit:3,nextAt:0,history:[]};
    case 11:return {type:11,target:randomInt(4),choices:[null,null],round:0,limit:5,nextAt:0,history:[]};
    default:throw new RangeError('Invalid cabinet');
  }
}
export function applyModeAction(s,p,kind,raw){
  if(s.phase!=='play'||(p!==0&&p!==1))return false;
  const d=s.data;let i=Number(raw);
  if(d.nextAt>0)return false;
  if(s.mode===0&&kind==='tile'&&d.turn===p&&Number.isInteger(i)&&i>=0&&i<16&&d.opened[i]===null){
    d.opened[i]=p;d.picks++;s.scores[p]+=d.tiles[i];d.turn=1-p;
    notice(s,s.names[p]+' 開啟了星匣。');
    if(d.picks>=12)finish(s,'十二個星匣已被開啟。');return true;
  }
  if(s.mode===1&&kind==='code'&&d.entries[p]===null&&typeof raw==='string'&&/^[0-5]{3}$/.test(raw)&&new Set(raw).size===3){
    const guess=raw,exact=valuesRange(3).filter(k=>guess[k]===d.secret[k]).length;
    const total=[...guess].filter(x=>d.secret.includes(x)).length;
    s.scores[p]+=exact*3+(total-exact);
    if(exact===3)s.scores[p]+=5;
    d.entries[p]={guess,exact,misplaced:total-exact};
    if(done(d.entries)){
      d.history.push(d.entries.map(e=>({guess:e.guess,exact:e.exact,misplaced:e.misplaced})));
      wait(d,'兩位的線索已揭曉：'+d.entries.map((e,k)=>s.names[k]+' '+e.exact+' 精準／'+e.misplaced+' 錯位').join('；'));
    }return true;
  }
  if(s.mode===2&&kind==='flip'&&d.turn===p&&Number.isInteger(i)&&i>=0&&i<12&&!d.matched.includes(i)&&!d.open.includes(i)){
    d.open.push(i);
    if(d.open.length===2){
      if(d.deck[d.open[0]]===d.deck[d.open[1]]){
        d.matched.push(...d.open);d.pairs++;s.scores[p]+=3;d.open=[];
        notice(s,s.names[p]+' 配對成功，再翻一次！');
        if(d.pairs===6)finish(s,'所有鏡面都已配對。');
      }else{d.nextAt=Date.now()+1500;notice(s,'記住這兩張鏡面的位置。');}
    }return true;
  }
  if(s.mode===3&&kind==='mark'&&d.turn===p&&Number.isInteger(i)&&i>=0&&i<9&&d.cells[i]===null){
    d.cells[i]=p;d.turn=1-p;
    const lines=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    if(lines.some(line=>line.every(k=>d.cells[k]===p))){s.scores[p]+=8;finish(s,s.names[p]+' 完成了結界連線。');}
    else if(d.cells.every(v=>v!==null)){s.scores[0]+=2;s.scores[1]+=2;finish(s,'結界不分勝負。');}
    return true;
  }
  if(s.mode===4&&kind==='bid'&&d.bids[p]===null&&Number.isInteger(i)&&i>=0&&i<=10&&i%2===0&&i<=d.budgets[p]){
    d.bids[p]=i;
    if(done(d.bids)){
      const [a,b]=d.bids,prize=d.prizes[d.round];
      if(a!==b){const winner=a>b?0:1;d.budgets[winner]-=d.bids[winner];s.scores[winner]+=prize;}
      d.history.push({a,b,prize});
      wait(d,'本輪拍品價值 '+prize+'；出價 '+a+'：'+b+(a===b?'，流標':'，由'+s.names[a>b?0:1]+'得標'));
    }return true;
  }
  if(s.mode===5&&kind==='move'&&d.turn===p&&['U','D','L','R'].includes(raw)){
    const x=d.pos[p]%5,y=Math.floor(d.pos[p]/5);
    const shifts={U:[0,-1],D:[0,1],L:[-1,0],R:[1,0]},delta=shifts[raw],nx=x+delta[0],ny=y+delta[1],next=ny*5+nx;
    if(nx<0||nx>4||ny<0||ny>4||d.walls.includes(next))return false;
    d.pos[p]=next;d.moves++;d.turn=1-p;
    if(next===24){s.scores[p]+=8;finish(s,s.names[p]+' 首先找到出口！');}
    else if(d.moves>=36){
      const dist=d.pos.map(pos=>8-(pos%5+Math.floor(pos/5)));
      if(dist[0]===dist[1]){s.scores[0]+=2;s.scores[1]+=2;}else s.scores[dist[0]<dist[1]?0:1]+=4;
      finish(s,'迷霧關閉，距離出口最近的旅人獲勝。');
    }return true;
  }
  if(s.mode===6&&kind==='count'&&d.guesses[p]===null&&Number.isInteger(i)&&i>=5&&i<=20){
    d.guesses[p]=i;
    if(done(d.guesses)){
      d.guesses.forEach((v,k)=>s.scores[k]+=Math.max(0,6-Math.abs(v-d.count)*2));
      d.history.push({count:d.count,guesses:[...d.guesses]});
      wait(d,'這片星空共有 '+d.count+' 顆星星；兩位猜了 '+d.guesses.join('／')+'。');
    }return true;
  }
  if(s.mode===7&&kind==='duel'&&d.choices[p]===null&&Number.isInteger(i)&&i>=0&&i<=2){
    d.choices[p]=i;
    if(done(d.choices)){
      const [a,b]=d.choices;let text;
      if(a===b){s.scores[0]++;s.scores[1]++;text='平手，雙方各一分。';}
      else{const winner=(a+1)%3===b?1:0;s.scores[winner]+=3;text=s.names[winner]+' 在這一輪佔上風。';}
      d.history.push({a,b});wait(d,text);
    }return true;
  }
  if(s.mode===8&&kind==='prism'&&d.phase==='answer'&&d.guesses[p]===null&&typeof raw==='string'&&/^[0-3]{4}$/.test(raw)){
    const result=[...raw].map(Number);
    d.guesses[p]=result;
    if(done(d.guesses)){
      d.guesses.forEach((guess,k)=>{
        const hits=guess.filter((v,j)=>v===d.sequence[j]).length;
        s.scores[k]+=hits*2+(hits===4?4:0);
      });
      d.history.push({sequence:[...d.sequence],guesses:d.guesses.map(g=>[...g])});
      d.phase='reveal';wait(d,'真正的光譜已重現：'+d.sequence.map(v=>['紅','金','青','紫'][v]).join(' → '));
    }return true;
  }
  if(s.mode===9&&kind==='aim'&&d.guesses[p]===null&&Number.isInteger(i)&&i>=0&&i<49){
    d.guesses[p]=[i%7,Math.floor(i/7)];
    if(done(d.guesses)){
      d.guesses.forEach((coord,k)=>{
        const dist=Math.hypot(coord[0]-d.target[0],coord[1]-d.target[1]);
        s.scores[k]+=Math.max(0,8-Math.round(dist*1.5));
      });
      d.history.push({target:[...d.target],guesses:d.guesses.map(g=>[...g])});
      wait(d,'星軌真正的座標在第 '+(d.target[0]+1)+' 欄、第 '+(d.target[1]+1)+' 列。');
    }return true;
  }
  if(s.mode===10&&kind==='sum'&&d.guesses[p]===null&&typeof raw==='string'){
    const chosen=raw.split(',').map(Number);
    if(chosen.length!==3||new Set(chosen).size!==3||chosen.some(v=>!d.numbers.includes(v)))return false;
    const total=chosen.reduce((a,b)=>a+b,0);d.guesses[p]={chosen,total};
    if(done(d.guesses)){
      d.guesses.forEach((v,k)=>s.scores[k]+=Math.max(0,9-Math.abs(v.total-d.target)));
      d.history.push({target:d.target,totals:d.guesses.map(x=>x.total)});
      wait(d,'目標 '+d.target+'；兩位完成 '+d.guesses.map(v=>v.total).join('／')+'。');
    }return true;
  }
  if(s.mode===11&&kind==='gear'&&d.choices[p]===null&&Number.isInteger(i)&&i>=0&&i<=3){
    d.choices[p]=i;
    if(done(d.choices)){
      const matched=(d.choices[0]+d.choices[1])%4===d.target;
      if(matched){s.scores[0]+=4;s.scores[1]+=4;}
      wait(d,matched?'齒輪完美咬合！兩人各得四分。':'齒輪偏離了光芒，這一輪沒有得分。');
    }return true;
  }
  return false;
}
export function tickMode(s){
  if(s.phase!=='play')return false;
  const d=s.data,now=Date.now();
  if(s.mode===8&&d.phase==='show'&&now>=d.showUntil){d.phase='answer';return true;}
  if(!d.nextAt||now<d.nextAt)return false;
  if(s.mode===2){d.open=[];d.turn=1-d.turn;d.nextAt=0;return true;}
  nextRound(s);return true;
}
function history(s){
  const d=s.data;
  if(!d.history||!d.history.length)return '';
  return '<div class="mode-history">'+d.history.slice(-5).map((e,i)=>{
    if(s.mode===1)return '<span class="history-chip">#'+(i+1)+' <strong>'+e[0].exact+'／'+e[1].exact+'</strong> 精準</span>';
    if(s.mode===4)return '<span class="history-chip">'+e.a+' : '+e.b+' · <strong>'+e.prize+'</strong></span>';
    if(s.mode===6)return '<span class="history-chip">星星 <strong>'+e.count+'</strong> · '+e.guesses.join('/')+'</span>';
    if(s.mode===7)return '<span class="history-chip">'+['劍','盾','術'][e.a]+' : '+['劍','盾','術'][e.b]+'</span>';
    if(s.mode===8)return '<span class="history-chip">第 '+(i+1)+' 輪 ✦</span>';
    if(s.mode===9)return '<span class="history-chip">座標 '+(e.target[0]+1)+','+(e.target[1]+1)+'</span>';
    if(s.mode===10)return '<span class="history-chip">目標 <strong>'+e.target+'</strong> · '+e.totals.join('/')+'</span>';
    return '';
  }).join('')+'</div>';
}
function locked(d,p,viewers){return !viewers.includes(p)||Boolean(d.nextAt);}
function waiting(text='等待另一位訪客...'){return '<p class="mini-note">✦ '+text+'</p>';}
export function renderMode(s,viewers,drafts){
  const d=s.data;let content='';
  const reveal=d.reveal?'<div class="reveal">'+safe(d.reveal)+'</div>':'';
  switch(s.mode){
    case 0:{
      const tiles=d.tiles.map((v,i)=>{
        const used=d.opened[i]!==null;
        const face=used?(v>0?'+'+v:String(v)):'✧';
        return card(d.turn,'tile',i,face,!used&&viewers.includes(d.turn),'tile'+(used?' open':''));
      }).join('');
      content='<p class="mode-head">輪到 '+safe(s.names[d.turn])+'　·　已開啟 '+d.picks+'/12 個星匣</p><div class="tile-grid" style="--cols:4">'+tiles+'</div>';
      break;
    }
    case 1:{
      content=roundBadge(s,d)+panels(s,viewers,p=>{
        const e=d.entries[p];if(e)return waiting('已提交 '+safe(e.guess)+'，等待揭曉');
        return '<p>選三個不重複的數字。每輪提交一次。</p><div class="digits"><input data-code="'+p+'" inputmode="numeric" pattern="[0-5]{3}" maxlength="3" placeholder="000" aria-label="三位數字"></div>'+card(p,'code','', '送出密語',true,'action-button');
      })+history(s);
      break;
    }
    case 2:{
      const grid=d.deck.map((v,i)=>{
        const matched=d.matched.includes(i),open=d.open.includes(i);
        return card(d.turn,'flip',i,matched||open?icons[v]:'☽',!matched&&!open&&viewers.includes(d.turn)&&!d.nextAt,'tile'+(matched?' used':open?' open':''));
      }).join('');
      content='<p class="mode-head">現在輪到 '+safe(s.names[d.turn])+'　·　已配對 '+d.pairs+'/6</p><div class="tile-grid" style="--cols:4">'+grid+'</div>';
      break;
    }
    case 3:{
      const grid=d.cells.map((v,i)=>card(d.turn,'mark',i,v===null?'✧':(v===0?'✦':'☾'),v===null&&viewers.includes(d.turn),'tile'+(v!==null?' open':''))).join('');
      content='<p class="mode-head">現在輪到 '+safe(s.names[d.turn])+'　·　'+(d.turn===0?'✦':'☾')+'</p><div class="tile-grid" style="--cols:3">'+grid+'</div>';
      break;
    }
    case 4:{
      content=roundBadge(s,d)+'<div class="mode-bubble">本輪拍品在帷幕後方　✦　每人的初始籌碼為 20</div>'+panels(s,viewers,p=>{
        if(d.bids[p]!==null)return waiting('出價已封存');
        return '<p>剩餘籌碼 <strong>'+d.budgets[p]+'</strong> · 每輪最多出價 10</p><div class="choice-grid">'+[0,2,4,6,8,10].map(n=>card(p,'bid',n,'<strong>'+n+'</strong><small>籌碼</small>',n<=d.budgets[p])).join('')+'</div>';
      })+history(s);
      break;
    }
    case 5:{
      const grid=valuesRange(25).map(i=>{
        const blocked=d.walls.includes(i),here=d.pos[0]===i||d.pos[1]===i;
        const label=i===24?'✦':(here?(d.pos[0]===i&&d.pos[1]===i?'◆ ◆':d.pos[0]===i?'◆':'◇'):(blocked?'▨':'·'));
        const extra=blocked?' wall':i===24?' goal':(here?' active':'');
        return '<div class="tile'+extra+'" aria-label="'+(blocked?'障礙':'道路')+'">'+label+'</div>';
      }).join('');
      const p=d.turn;
      content='<p class="mode-head">輪到 '+safe(s.names[p])+'　·　行進步數 '+d.moves+'/36</p><div class="tile-grid maze-grid" style="--cols:5">'+grid+'</div><div class="legend">◆ 訪客一號　◇ 訪客二號　✦ 出口</div><div class="direction-pad">'+[['U','↑'],['L','←'],['D','↓'],['R','→']].map(x=>card(p,'move',x[0],x[1],viewers.includes(p),'')).join('')+'</div>';
      break;
    }
    case 6:{
      content=roundBadge(s,d)+'<div class="star-field">'+d.stars.map((v,i)=>'<span class="a-star" style="left:'+v.x+'%;top:'+v.y+'%;animation-delay:'+v.delay+'s">✦</span>').join('')+'</div>'+panels(s,viewers,p=>{
        if(d.guesses[p]!==null)return waiting('你的答案：'+d.guesses[p]);
        return '<p>你數到了幾顆？</p><div class="choice-grid">'+valuesRange(16).map(x=>card(p,'count',x+5,'<strong>'+(x+5)+'</strong>')).join('')+'</div>';
      })+history(s);
      break;
    }
    case 7:{
      const moves=[['⚔','劍'],['⛨','盾'],['✧','術']];
      content=roundBadge(s,d)+panels(s,viewers,p=>{
        if(d.choices[p]!==null)return waiting('你的招式已封存');
        return '<p>盾克劍、術克盾、劍克術。</p><div class="choice-grid">'+moves.map((m,i)=>card(p,'duel',i,'<strong>'+m[0]+'</strong><small>'+m[1]+'</small>')).join('')+'</div>';
      })+history(s);
      break;
    }
    case 8:{
      const show=d.phase==='show'||d.phase==='reveal';
      content=roundBadge(s,d)+'<div class="color-sequence">'+d.sequence.map(v=>colorDot(v,!show)).join('')+'</div>'+(d.phase==='show'?'<p class="mini-note">記住光譜的順序，光芒即將隱藏...</p>':panels(s,viewers,p=>{
        if(d.guesses[p]!==null)return waiting('已送出你的光譜');
        const arr=drafts[p]||[];
        return '<p>依序點選四個顏色，重現剛才的光譜。</p><div class="color-sequence">'+valuesRange(4).map(i=>colorDot(arr[i],i>=arr.length)).join('')+'</div><div class="choice-grid">'+palette.map((v,i)=>card(p,'prism-add',i,'<span class="color-dot" style="--dot:'+v+'"></span>',arr.length<4)).join('')+'</div><div class="choice-grid">'+card(p,'prism-clear','', '重選',arr.length>0)+card(p,'prism-submit','', '送出光譜',arr.length===4)+'</div>';
      }))+history(s);
      break;
    }
    case 9:{
      const sides=[(d.target[0]<3?'西':'東')+'側',(d.target[1]<3?'北':'南')+'側'];
      content=roundBadge(s,d)+'<div class="mode-bubble">羅盤低語：目標偏向 '+sides.join('、')+'</div>'+panels(s,viewers,p=>{
        if(d.guesses[p]!==null)return waiting('星盤座標已封存');
        const grid=valuesRange(49).map(i=>card(p,'aim',i,'✧',true,'tile')).join('');
        return '<div class="tile-grid grid-aim" style="--cols:7">'+grid+'</div>';
      })+history(s);
      break;
    }
    case 10:{
      content=roundBadge(s,d)+'<div class="target-number"><small>本輪目標</small>'+d.target+'</div>'+panels(s,viewers,p=>{
        if(d.guesses[p]!==null)return waiting('你提交了總和 '+d.guesses[p].total);
        const arr=drafts[p]||[],sum=arr.reduce((a,b)=>a+b,0);
        return '<p>選三枚符文，不可重複。</p><div class="sudoku-choice">'+d.numbers.map(v=>card(p,'sum-add',v,String(v),arr.length<3&&!arr.includes(v),'')).join('')+'</div><div class="selections">已選 '+(arr.join(' + ')||'—')+'　＝ '+sum+'</div><div class="choice-grid">'+card(p,'sum-clear','', '重新選擇',arr.length>0)+card(p,'sum-submit','', '完成鍊金',arr.length===3)+'</div>';
      })+history(s);
      break;
    }
    case 11:{
      content=roundBadge(s,d)+'<div class="target-number"><small>中央光芒值</small>'+d.target+'</div><div class="pulse-line"></div>'+panels(s,viewers,p=>{
        if(d.choices[p]!==null)return waiting('你的齒輪已固定');
        return '<p>選擇你的齒輪刻度，與另一位訪客配合。</p><div class="choice-grid">'+valuesRange(4).map(v=>card(p,'gear',v,'<strong>'+v+'</strong><small>刻度</small>')).join('')+'</div>';
      });
      break;
    }
  }
  return '<div class="mode-board">'+content+reveal+'</div>';
}
