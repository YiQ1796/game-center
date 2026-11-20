/**
 * Midnight Cabinet V2 — deterministic-ish authoritative two-player simulation.
 * Pure game-state updates; rendering and networking live in separate modules.
 * All positions live in a 960 × 540 logical playfield.
 */
export const WIDTH=960, HEIGHT=540;
export const GAMES=Object.freeze([
  {icon:'✹',color:'#93e9fd',name:'流星護衛隊',tip:'移動：方向鍵／WASD。按住動作鍵連射，並避開衝來的異物。',duration:68,category:'ACTION'},
  {icon:'❯',color:'#ffc59c',name:'月下極速',tip:'左右轉向、向上加速。按住動作鍵啟動推進器，閃開路障。',duration:66,category:'RACE'},
  {icon:'☁',color:'#d6e6ff',name:'浮島跳跳',tip:'左右奔跑；動作鍵跳躍，抓取發亮的星果。',duration:66,category:'PLATFORM'},
  {icon:'✦',color:'#d3baff',name:'極光冰球',tip:'上下操控球拍，將發光的球打進對面球門。',duration:70,category:'SPORT'},
  {icon:'➹',color:'#f6d99c',name:'燈火射手',tip:'上下調射角、左右調力度；動作鍵發射弧線箭矢。',duration:66,category:'SKILL'},
  {icon:'♓',color:'#98def0',name:'星海釣手',tip:'左右移動釣竿；按一下放鉤，按住動作鍵把獵物拉回來。',duration:68,category:'FISHING'},
  {icon:'♨',color:'#ffae9f',name:'勇闖火線',tip:'移動並按住動作鍵噴水，兩個人一起守護街道。',duration:68,category:'CO-OP'},
  {icon:'♫',color:'#f8acd7',name:'節拍魔法師',tip:'四個方向分別對應四條音軌。符文抵達底線時按相同方向。',duration:62,category:'RHYTHM',rhythm:true},
  {icon:'⚙',color:'#c9e2a8',name:'機巧防線',tip:'移動建塔游標，在適合的位置按動作鍵蓋塔，守護右方核心。',duration:70,category:'DEFENSE'},
  {icon:'✿',color:'#ffe0a2',name:'午夜料理屋',tip:'移動到食材箱按動作鍵拿取，再送去中央餐檯。',duration:68,category:'COOKING'},
  {icon:'⌁',color:'#b9f4c3',name:'靈蛇花園',tip:'用四方向控制方向、吃掉星果，切勿撞上自己或對方。',duration:62,category:'ARCADE'},
  {icon:'❖',color:'#f0bbed',name:'彩墨之戰',tip:'移動並按住動作鍵在地面揮灑彩墨，搶下最多的區域。',duration:65,category:'PAINT'}
]);
const rand=(min,max)=>min+Math.random()*(max-min);
const randInt=(max)=>Math.floor(Math.random()*max);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const sign=n=>n<0?-1:1;
const speed=(x,y,s)=>{const k=Math.max(1,Math.hypot(x,y));return {x:x*s/k,y:y*s/k}};
const controls=()=>({x:0,y:0,action:false,actSeq:0,dirSeq:[0,0,0,0]});
const point=(x,y)=>({x,y});
const removeSwap=(items,index)=>{items[index]=items[items.length-1];items.pop()};
const move=(p,i,dt,s=220)=>{const v=speed(i.x,i.y,s);p.x=clamp(p.x+v.x*dt,27,WIDTH-27);p.y=clamp(p.y+v.y*dt,53,HEIGHT-27)};
const event=(g,text)=>{g.event=text;g.eventAt=g.elapsed};
const score=(g,p,n)=>{g.scores[p]+=n;};
function end(g,message){
  if(g.over)return;
  g.over=true;g.reason=message;
  g.scores=g.scores.map(x=>Math.round(x));
}
function freshPlayers(points){return points.map(([x,y])=>({x,y,hp:100,cool:0,invul:0}))}
function createFood(g){
  for(let tries=0;tries<80;tries++){
    const x=1+randInt(24),y=1+randInt(12);
    if(g.snakes.every(s=>s.body.every(b=>b.x!==x||b.y!==y))){g.food={x,y};return}
  }
  g.food={x:13,y:7};
}
export function createGame(id){
  if(!Number.isInteger(id)||id<0||id>=GAMES.length)throw new RangeError('Unknown game');
  const g={id,elapsed:0,duration:GAMES[id].duration,over:false,reason:'',scores:[0,0],p:[],event:'',eventAt:0,prevActs:[0,0],prevDirs:[Array(4).fill(0),Array(4).fill(0)],ticks:0,objects:[],fx:[]};
  switch(id){
    case 0:
      g.p=freshPlayers([[230,275],[730,275]]);g.enemies=[];g.shots=[];g.spawn=.3;g.lives=10;break;
    case 1:
      g.p=[{x:250,y:340,progress:0,boost:85,hurt:0},{x:710,y:340,progress:0,boost:85,hurt:0}];
      g.roadblocks=[];g.spawn=1.3;g.track=3800;break;
    case 2:
      g.p=[{x:80,y:420,vy:0,ground:false},{x:145,y:420,vy:0,ground:false}];
      g.platforms=[{x:0,y:485,w:960},{x:150,y:403,w:190},{x:430,y:335,w:170},{x:690,y:405,w:180},{x:260,y:257,w:170},{x:595,y:222,w:180}];
      g.coins=Array.from({length:11},(_,i)=>({x:rand(35,925),y:[450,365,300,210][i%4],phase:rand(0,6)}));g.thorns=[350,555,800];break;
    case 3:
      g.p=[{x:115,y:270},{x:845,y:270}];g.ball={x:480,y:270,vx:rand(190,260)*sign(rand(-1,1)),vy:rand(-135,135)};g.serves=0;break;
    case 4:
      g.p=[{x:138,y:438,angle:.65,power:370,cool:0},{x:822,y:438,angle:.65,power:370,cool:0}];
      g.arrows=[];g.lanterns=Array.from({length:6},(_,i)=>({x:rand(340,620),y:90+i*60,phase:rand(0,6),alive:true,respawn:0}));g.wind=rand(-32,32);break;
    case 5:
      g.p=[{x:230,y:95,hook:null},{x:730,y:95,hook:null}];
      g.fish=Array.from({length:13},(_,i)=>({x:rand(30,930),y:rand(235,490),vx:rand(45,115)*sign(rand(-1,1)),kind:randInt(4),caught:-1}));break;
    case 6:
      g.p=freshPlayers([[210,290],[750,290]]);g.buildings=Array.from({length:6},(_,i)=>({x:115+(i%3)*360,y:i<3?105:438,hp:100}));
      g.fires=Array.from({length:7},()=>({x:rand(120,820),y:rand(160,390),heat:rand(38,85)}));g.spread=2.3;g.water=[];break;
    case 7:
      g.p=[{combo:0,miss:0},{combo:0,miss:0}];
      g.notes=Array.from({length:140},(_,i)=>({p:i%2,lane:randInt(4),at:1.6+i*.395,hit:false,miss:false}));g.hitFx=[-1,-1];break;
    case 8:
      g.p=[{x:345,y:195},{x:615,y:395}];g.towers=[];g.creeps=[];g.money=22;g.gate=16;g.spawn=1.1;g.waves=0;break;
    case 9:
      g.p=[{x:180,y:405,holding:-1},{x:780,y:405,holding:-1}];
      g.crates=[{x:130,y:120,name:'月莓'},{x:350,y:120,name:'奶霜'},{x:610,y:120,name:'星糖'},{x:830,y:120,name:'薄荷'}];
      g.orders=Array.from({length:3},()=>randInt(4));g.delivered=0;break;
    case 10:
      g.snakes=[
        {body:[{x:5,y:5},{x:4,y:5},{x:3,y:5}],dir:1,next:1,dead:0},
        {body:[{x:20,y:9},{x:21,y:9},{x:22,y:9}],dir:3,next:3,dead:0}
      ];g.snakeTimer=0;createFood(g);break;
    case 11:
      g.p=[{x:220,y:270,ink:100,cool:0},{x:740,y:270,ink:100,cool:0}];
      g.paint=Array(30*16).fill(-1);g.splashes=[];break;
  }
  return g;
}
function simulateShooter(g,i,dt,edge){
  for(let p=0;p<2;p++){
    const hero=g.p[p];hero.cool=Math.max(0,hero.cool-dt);hero.invul=Math.max(0,hero.invul-dt);
    move(hero,i[p],dt,225);
    if(i[p].action&&hero.cool===0&&hero.hp>0){
      let best=null,range=Infinity;
      for(const e of g.enemies){const d=dist(hero,e);if(d<range){range=d;best=e}}
      const a=best?Math.atan2(best.y-hero.y,best.x-hero.x):(p===0?0:Math.PI);
      g.shots.push({x:hero.x,y:hero.y,vx:Math.cos(a)*590,vy:Math.sin(a)*590,owner:p,ttl:1.1});
      hero.cool=.16;
    }
  }
  g.spawn-=dt;if(g.spawn<=0){
    const angle=rand(0,Math.PI*2),fromX=480+Math.cos(angle)*560,fromY=270+Math.sin(angle)*375;
    g.enemies.push({x:fromX,y:fromY,r:rand(13,22),hp:Math.random()<.2?3:2,sp:rand(55,95)+g.elapsed*.43});
    g.spawn=clamp(.9-g.elapsed*.006,.3,.9);
  }
  for(const e of g.enemies){
    const target=dist(e,g.p[0])<dist(e,g.p[1])?g.p[0]:g.p[1];
    const dx=target.x-e.x,dy=target.y-e.y,mag=Math.max(1,Math.hypot(dx,dy));
    e.x+=dx/mag*e.sp*dt;e.y+=dy/mag*e.sp*dt;
    for(const h of g.p){
      if(h.hp>0&&h.invul===0&&dist(h,e)<e.r+17){h.hp-=21;h.invul=.65;g.lives--;e.hp=0;event(g,'護盾受到撞擊！')}
    }
  }
  for(let j=g.shots.length-1;j>=0;j--){
    const b=g.shots[j];b.x+=b.vx*dt;b.y+=b.vy*dt;b.ttl-=dt;
    if(b.ttl<=0||b.x<-20||b.x>980||b.y<-20||b.y>560){removeSwap(g.shots,j);continue}
    const hit=g.enemies.find(e=>e.hp>0&&dist(e,b)<e.r+5);
    if(hit){hit.hp--;removeSwap(g.shots,j);if(hit.hp<=0){score(g,b.owner,3);event(g,'擊破來襲異物！')}}
  }
  g.enemies=g.enemies.filter(e=>e.hp>0&&e.x>-60&&e.x<1020&&e.y>-70&&e.y<610);
  if(g.lives<=0||g.p.every(p=>p.hp<=0))end(g,'守護核心暫時失去能量。');
}
function simulateRacer(g,i,dt){
  for(let p=0;p<2;p++){
    const car=g.p[p],mid=p?710:250,low=mid-150,high=mid+150;
    car.hurt=Math.max(0,car.hurt-dt);
    car.x=clamp(car.x+i[p].x*dt*245,low,high);
    const activeBoost=i[p].action&&car.boost>0;
    car.boost=clamp(car.boost+(activeBoost?-30:13)*dt,0,100);
    const base=115+(i[p].y<-.4?75:i[p].y>.4?-45:0)+(activeBoost?100:0);
    car.progress+=Math.max(36,base)*(car.hurt>0?.57:1)*dt;
    score(g,p,Math.max(36,base)*dt/45);
    if(car.progress>=g.track){end(g,'第一位賽車手已抵達終點線！');break}
  }
  g.spawn-=dt;
  if(g.spawn<=0){g.roadblocks.push({p:randInt(2),side:rand(-115,115),at:Math.max(g.p[0].progress,g.p[1].progress)+rand(300,480),hit:false});g.spawn=1.5}
  for(const obstacle of g.roadblocks){
    const car=g.p[obstacle.p],rel=obstacle.at-car.progress;
    if(!obstacle.hit&&rel<33&&rel>-28&&Math.abs(car.x-((obstacle.p?710:250)+obstacle.side))<34){obstacle.hit=true;car.hurt=1.2;event(g,'撞到路障，速度下降！')}
  }
  g.roadblocks=g.roadblocks.filter(o=>o.at>Math.min(g.p[0].progress,g.p[1].progress)-60);
}
function simulatePlatformer(g,i,dt,edge){
  for(let p=0;p<2;p++){
    const h=g.p[p],prevBottom=h.y+19;
    h.x=clamp(h.x+i[p].x*dt*235,24,936);
    if(edge[p]&&h.ground){h.vy=-465;h.ground=false}
    h.vy=clamp(h.vy+1050*dt,-650,850);h.y+=h.vy*dt;h.ground=false;
    for(const platform of g.platforms){
      if(h.vy>=0&&h.x+16>=platform.x&&h.x-16<=platform.x+platform.w&&
        prevBottom<=platform.y+10&&h.y+19>=platform.y){
        h.y=platform.y-19;h.vy=0;h.ground=true;break;
      }
    }
    if(h.y>560){h.x=p?135:80;h.y=445;h.vy=0;score(g,p,-2)}
    if(h.ground&&h.y>445&&g.thorns.some(x=>Math.abs(x-h.x)<29)){
      h.x=p?135:80;h.y=440;h.vy=0;score(g,p,-2);event(g,'跳回安全的地面！');
    }
    for(const c of g.coins){if(Math.hypot(h.x-c.x,h.y-c.y)<27){score(g,p,3);c.x=rand(28,930);c.y=[448,365,300,217][randInt(4)];c.phase=rand(0,6)}}
  }
}
function resetPuck(g,p){
  g.ball={x:480,y:270,vx:p===0?-rand(240,290):rand(240,290),vy:rand(-150,150)};
}
function simulateHockey(g,i,dt){
  for(let p=0;p<2;p++)g.p[p].y=clamp(g.p[p].y+i[p].y*dt*(i[p].action?465:345),95,445);
  const b=g.ball;b.x+=b.vx*dt;b.y+=b.vy*dt;
  if(b.y<76){b.y=76;b.vy=Math.abs(b.vy)}
  if(b.y>470){b.y=470;b.vy=-Math.abs(b.vy)}
  for(let p=0;p<2;p++){
    const h=g.p[p],nearX=p===0?(b.x>107&&b.x<144&&b.vx<0):(b.x<853&&b.x>816&&b.vx>0);
    if(nearX&&Math.abs(b.y-h.y)<57){
      b.x=p===0?144:816;b.vx=(p===0?1:-1)*clamp(Math.abs(b.vx)*1.07+18,235,690);
      b.vy=clamp((b.y-h.y)*5.7,-380,380);event(g,'漂亮的反擊！');
    }
  }
  if(b.x<-22){score(g,1,1);g.serves++;resetPuck(g,0)}
  if(b.x>982){score(g,0,1);g.serves++;resetPuck(g,1)}
  if(g.scores[0]>=7||g.scores[1]>=7)end(g,'對決已達七分，冰場落下帷幕。');
}
function simulateArchery(g,i,dt,edge){
  for(let p=0;p<2;p++){
    const h=g.p[p];
    h.angle=clamp(h.angle-i[p].y*dt*.75,.15,1.4);
    h.power=clamp(h.power+i[p].x*dt*155,230,650);
    h.cool=Math.max(0,h.cool-dt);
    if(edge[p]&&h.cool===0){
      const way=p===0?1:-1;
      g.arrows.push({x:h.x,y:h.y-23,vx:way*Math.cos(h.angle)*h.power,vy:-Math.sin(h.angle)*h.power,owner:p,life:3});
      h.cool=.55;
    }
  }
  for(const target of g.lanterns){
    target.phase+=dt*1.3;
    if(!target.alive){target.respawn-=dt;if(target.respawn<=0){target.alive=true;target.x=rand(350,610);target.y=rand(90,365)}}
  }
  for(let n=g.arrows.length-1;n>=0;n--){
    const a=g.arrows[n];
    a.x+=(a.vx+g.wind)*dt;a.y+=a.vy*dt;a.vy+=355*dt;a.life-=dt;
    if(a.life<=0||a.y>485||a.x<0||a.x>960){removeSwap(g.arrows,n);continue}
    const hit=g.lanterns.find(t=>t.alive&&Math.hypot(a.x-(t.x+Math.sin(t.phase)*22),a.y-t.y)<28);
    if(hit){hit.alive=false;hit.respawn=2.2;score(g,a.owner,4);removeSwap(g.arrows,n);event(g,'一擊命中天空燈！')}
  }
}
function simulateFishing(g,i,dt,edge){
  for(let p=0;p<2;p++){
    const hero=g.p[p];hero.x=clamp(hero.x+i[p].x*dt*185,p===0?70:515,p===0?445:885);
    const hook=hero.hook;
    if(!hook){if(edge[p])hero.hook={x:hero.x,y:154,fish:-1,reeling:false,time:0};continue}
    hook.time+=dt;
    if(hook.fish>=0){hook.y-=245*dt;g.fish[hook.fish].x=hook.x;g.fish[hook.fish].y=hook.y+15}
    else if(hook.reeling||i[p].action||hook.y>490){hook.reeling=true;hook.y-=225*dt}
    else hook.y+=205*dt;
    if(hook.fish<0&&!hook.reeling){
      for(let f=0;f<g.fish.length;f++){
        const fish=g.fish[f];
        if(fish.caught>=0)continue;
        if(Math.abs(hook.x-fish.x)<27&&Math.abs(hook.y-fish.y)<18){
          hook.fish=f;fish.caught=p;event(g,'魚兒上鉤了！');break;
        }
      }
    }
    if(hook.y<=145){
      if(hook.fish>=0){
        const fish=g.fish[hook.fish];score(g,p,fish.kind+2);
        fish.x=rand(50,910);fish.y=rand(255,480);fish.caught=-1;
        event(g,'漂亮地收獲了海裡的訪客。');
      }
      hero.hook=null;
    }
  }
  for(const f of g.fish){
    if(f.caught>=0)continue;
    f.x+=f.vx*dt;
    if(f.x<35||f.x>925){f.vx*=-1;f.x=clamp(f.x,35,925)}
  }
}
function simulateFire(g,i,dt){
  g.spread-=dt;
  for(let p=0;p<2;p++){
    const h=g.p[p];move(h,i[p],dt,245);
    if(i[p].action){
      let nearest=null,d=190;
      for(const f of g.fires){const r=dist(h,f);if(r<d){d=r;nearest=f}}
      if(nearest){nearest.heat-=150*dt;g.water.push({x:h.x,y:h.y,tx:nearest.x,ty:nearest.y,ttl:.16,owner:p})}
      if(nearest&&nearest.heat<=0){score(g,p,5);event(g,'火勢被澆熄！')}
    }
  }
  g.fires=g.fires.filter(f=>f.heat>0);
  if(g.spread<=0&&g.fires.length<28){
    g.spread=clamp(2.7-g.elapsed*.015,1.1,2.7);
    const from=g.fires.length?g.fires[randInt(g.fires.length)]:{x:rand(70,890),y:rand(140,400)};
    g.fires.push({x:clamp(from.x+rand(-110,110),45,915),y:clamp(from.y+rand(-100,100),126,420),heat:rand(35,75)});
  }
  for(const f of g.fires){
    for(const house of g.buildings){if(dist(f,house)<95){house.hp=clamp(house.hp-(f.heat/50)*dt*1.2,0,100)}}
  }
  g.water=g.water.filter(v=>(v.ttl-=dt)>0);
  if(g.buildings.every(b=>b.hp===0))end(g,'城鎮暫時失守，兩位消防英雄辛苦了。');
}
function simulateRhythm(g,i,dt,edge,dirEdges){
  for(let p=0;p<2;p++){
    for(let lane=0;lane<4;lane++){
      if(!dirEdges[p][lane])continue;
      let best=null,d=.2;
      for(const note of g.notes){
        if(note.p!==p||note.lane!==lane||note.hit||note.miss)continue;
        const offset=Math.abs(note.at-g.elapsed);
        if(offset<d){best=note;d=offset}
      }
      if(best){
        best.hit=true;g.p[p].combo++;g.hitFx[p]=g.elapsed;
        score(g,p,d<.07?140:90);
        score(g,p,Math.min(80,g.p[p].combo*3));event(g,'完美節奏！');
      }else{g.p[p].combo=0;g.p[p].miss++;event(g,'拍點落空！')}
    }
  }
  for(const note of g.notes){if(!note.hit&&!note.miss&&g.elapsed>note.at+.22){note.miss=true;g.p[note.p].combo=0}}
}
function simulateDefense(g,i,dt,edge){
  for(let p=0;p<2;p++){
    move(g.p[p],i[p],dt,290);
    if(edge[p]&&g.money>=7&&g.p[p].x>100&&g.p[p].x<850&&
      g.towers.every(t=>dist(t,g.p[p])>78)){
      g.towers.push({x:g.p[p].x,y:g.p[p].y,owner:p,cool:0,range:153});
      g.money-=7;event(g,'一座新防禦塔升起。');
    }
  }
  g.spawn-=dt;
  if(g.spawn<=0){
    g.creeps.push({x:-20,y:270,hp:3+Math.floor(g.elapsed/22),max:3+Math.floor(g.elapsed/22),speed:rand(58,91),phase:rand(0,6)});
    g.spawn=clamp(1.3-g.elapsed*.005,.68,1.3);g.waves++;
  }
  for(const creep of g.creeps){
    creep.x+=creep.speed*dt;
    creep.y=260+95*Math.sin(creep.x*.011+creep.phase*.14);
  }
  for(const tower of g.towers){
    tower.cool=Math.max(0,tower.cool-dt);
    if(tower.cool>0)continue;
    const target=g.creeps.filter(c=>dist(c,tower)<tower.range).sort((a,b)=>b.x-a.x)[0];
    if(!target)continue;
    target.hp-=2;tower.cool=.32;
    if(target.hp<=0){score(g,tower.owner,4);g.money=Math.min(70,g.money+3);event(g,'防禦塔擊退了一個敵人！')}
  }
  g.creeps=g.creeps.filter(c=>{
    if(c.hp<=0)return false;
    if(c.x>=970){g.gate--;event(g,'核心護盾下降！');return false}
    return true;
  });
  if(g.gate<=0)end(g,'能量核心的護盾已耗盡。');
}
function simulateKitchen(g,i,dt,edge){
  for(let p=0;p<2;p++){
    const hero=g.p[p];move(hero,i[p],dt,238);
    if(!edge[p])continue;
    if(hero.holding===-1){
      const near=g.crates.findIndex(c=>dist(c,hero)<68);
      if(near!==-1){hero.holding=near;event(g,'取得了食材！')}
    }else if(Math.hypot(hero.x-480,hero.y-270)<99){
      const wanted=g.orders[0];
      if(hero.holding===wanted){score(g,p,5);g.orders.shift();g.orders.push(randInt(4));g.delivered++;event(g,'一道香噴噴的料理完成了！')}
      else{score(g,p,-1);event(g,'食材不符合訂單，重新準備！')}
      hero.holding=-1;
    }else{
      hero.holding=-1;event(g,'把食材放回了餐檯。');
    }
  }
}
function simulateSnake(g,i,dt){
  const newDirs=[0,0];
  for(let p=0;p<2;p++){
    if(Math.abs(i[p].x)>Math.abs(i[p].y)&&Math.abs(i[p].x)>.2)newDirs[p]=i[p].x>0?1:3;
    else if(Math.abs(i[p].y)>.2)newDirs[p]=i[p].y>0?2:0;
    else newDirs[p]=g.snakes[p].dir;
    if((newDirs[p]+2)%4!==g.snakes[p].dir)g.snakes[p].next=newDirs[p];
  }
  g.snakeTimer+=dt;
  if(g.snakeTimer<.145)return;
  g.snakeTimer=0;
  for(let p=0;p<2;p++){
    const s=g.snakes[p];
    if(s.dead>0){
      s.dead-=.145;
      if(s.dead<=0){const x=p?20:5,y=p?9:5;s.body=[{x,y},{x:p?21:4,y},{x:p?22:3,y}];s.dir=p?3:1;s.next=s.dir}
      continue;
    }
    s.dir=s.next;const head=s.body[0];
    const vectors=[[0,-1],[1,0],[0,1],[-1,0]];
    const next={x:head.x+vectors[s.dir][0],y:head.y+vectors[s.dir][1]};
    const eat=next.x===g.food.x&&next.y===g.food.y;
    const hit=next.x<0||next.y<0||next.x>=26||next.y>=14||
      g.snakes.some(other=>other.body.slice(0,other===s&&!eat?-1:undefined).some(body=>body.x===next.x&&body.y===next.y));
    if(hit){s.dead=1.3;score(g,p,-3);event(g,'撞到障礙，重新出發！');continue}
    s.body.unshift(next);if(!eat)s.body.pop();
    else{score(g,p,5);createFood(g);event(g,'靈蛇吃到了星果！')}
  }
}
function paintSpot(g,p,x,y){
  const cx=Math.floor(x/32),cy=Math.floor((y-28)/32);
  for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++){
    if(ox*ox+oy*oy>2)continue;
    const px=cx+ox,py=cy+oy;if(px<0||px>=30||py<0||py>=16)continue;
    g.paint[py*30+px]=p;
  }
}
function simulatePaint(g,i,dt){
  for(let p=0;p<2;p++){
    const h=g.p[p];move(h,i[p],dt,260);h.cool=Math.max(0,h.cool-dt);
    h.ink=clamp(h.ink+(i[p].action?-33:18)*dt,0,100);
    if(i[p].action&&h.ink>1&&h.cool<=0){paintSpot(g,p,h.x,h.y);h.cool=.08;
      g.splashes.push({x:h.x,y:h.y,t:g.elapsed,p});
    }
  }
  g.splashes=g.splashes.filter(s=>g.elapsed-s.t<.4);
  g.scores=[g.paint.filter(v=>v===0).length,g.paint.filter(v=>v===1).length];
}
export function updateGame(g,inputs,dt){
  if(g.over)return false;
  const step=clamp(Number.isFinite(dt)?dt:0,0,.055);
  if(step===0)return false;
  g.elapsed+=step;g.ticks++;
  const i=[inputs[0]||controls(),inputs[1]||controls()];
  const edges=i.map((input,p)=>Number.isInteger(input.actSeq)&&input.actSeq!==g.prevActs[p]);
  const dirEdges=i.map((input,p)=>Array.from({length:4},(_,lane)=>{
    const v=input.dirSeq?.[lane]||0;const changed=v!==g.prevDirs[p][lane];
    g.prevDirs[p][lane]=v;return changed;
  }));
  for(let p=0;p<2;p++)g.prevActs[p]=i[p].actSeq||0;
  switch(g.id){
    case 0:simulateShooter(g,i,step,edges);break;
    case 1:simulateRacer(g,i,step);break;
    case 2:simulatePlatformer(g,i,step,edges);break;
    case 3:simulateHockey(g,i,step);break;
    case 4:simulateArchery(g,i,step,edges);break;
    case 5:simulateFishing(g,i,step,edges);break;
    case 6:simulateFire(g,i,step);break;
    case 7:simulateRhythm(g,i,step,edges,dirEdges);break;
    case 8:simulateDefense(g,i,step,edges);break;
    case 9:simulateKitchen(g,i,step,edges);break;
    case 10:simulateSnake(g,i,step);break;
    case 11:simulatePaint(g,i,step);break;
  }
  if(g.elapsed>=g.duration)end(g,'時間到！奇物館將這一局的故事封存。');
  return true;
}
