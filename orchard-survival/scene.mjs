
import { CLASSES, FIELD } from './content.mjs?v=010';

const TAU = Math.PI*2;
const LIMIT = (value,min,max) => Math.max(min,Math.min(max,value));
const palettes = {
  grub:['#cda44e','#654a2b'], shroom:['#df7b88','#693955'],
  boar:['#f4a37d','#7b4934'], bee:['#ffc857','#674331'],
  snail:['#acc783','#5d7651'], elite:['#ef847b','#7c3f56'],
  boss:['#f4bc57','#744a35'], queen:['#eaa8db','#733963']
};

function ellipse(ctx,x,y,rx,ry,color) {
  ctx.beginPath(); ctx.ellipse(x,y,rx,ry,0,0,TAU);ctx.fillStyle=color;ctx.fill();
}

function ring(ctx,x,y,r,color,width=2) {
  ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();
}

function polygon(ctx,x,y,points,r,fill,angle=-Math.PI/2) {
  ctx.beginPath();
  for(let i=0;i<points;i++) {
    const direction=angle+TAU*i/points;
    const px=x+Math.cos(direction)*r,py=y+Math.sin(direction)*r;
    if (i===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
  }
  ctx.closePath();ctx.fillStyle=fill;ctx.fill();
}

function hash(x,y) {
  let n=Math.imul(x+5381,19990303)^Math.imul(y+1361,1799969);
  n=Math.imul(n^(n>>>15),2246822519);
  return ((n^(n>>>13))>>>0)/4294967296;
}

function field(ctx,x,y,w,h) {
  ctx.fillStyle='#466b43';
  ctx.fillRect(x,y,w,h);
  ctx.save();
  ctx.beginPath();ctx.rect(0,0,FIELD.width,FIELD.height);ctx.clip();
  ctx.fillStyle='#9fbc75';
  ctx.fillRect(x,y,w,h);
  ctx.fillStyle='#c1ca89';
  ctx.beginPath();
  ctx.moveTo(-90,1170);ctx.bezierCurveTo(760,730,840,1430,1530,1000);
  ctx.bezierCurveTo(2190,620,2190,1150,2850,670);
  ctx.lineTo(2850,809);ctx.bezierCurveTo(2200,1290,2180,762,1550,1140);
  ctx.bezierCurveTo(850,1570,760,870,-90,1310);ctx.closePath();ctx.fill();
  for(let row=Math.floor(y/82)-1;row<=Math.ceil((y+h)/82)+1;row++) {
    for(let col=Math.floor(x/82)-1;col<=Math.ceil((x+w)/82)+1;col++) {
      const px=col*82+hash(col,row)*70;
      const py=row*82+hash(row,-col)*70;
      const seed=hash(row+16,col);
      if(seed>.72) {
        ellipse(ctx,px,py,18+seed*18,5+seed*5,'#789d673d');
        for(let i=0;i<5;i++) {
          const fx=px-10+i*5, fy=py+3-hash(i+col,row)*13;
          ellipse(ctx,fx,fy,1.8,2.7,i%3===0?'#fff4c3':'#6b9053');
        }
      } else {
        ctx.strokeStyle='#628a5360';ctx.lineWidth=1.6;
        ctx.beginPath();ctx.moveTo(px-4,py+2);ctx.quadraticCurveTo(px-1,py-1,px-3,py-5);
        ctx.moveTo(px-1,py+2);ctx.quadraticCurveTo(px+1,py-3,px+5,py-5);ctx.stroke();
        if(seed<.29) ellipse(ctx,px+13,py-3,4,1.7,'#d9d79b');
      }
    }
  }
  ctx.strokeStyle='#55794b';ctx.lineWidth=13;
  ctx.strokeRect(2,2,FIELD.width-4,FIELD.height-4);
  ctx.restore();
  const trees=(vertical,fixed,start,end,edge)=>{
    for(let i=Math.max(0,Math.floor(start/129)-1);i<Math.ceil(end/129)+1;i++) {
      const p=i*129+29;const scale=hash(i,edge)*12;
      const px=vertical?fixed:p,py=vertical?p:fixed;
      ellipse(ctx,px,py+21,42,13,'#263e326b');
      ctx.fillStyle='#795238';ctx.fillRect(px-7,py-9,14,31);
      ellipse(ctx,px-18,py-19,27+scale,28,'#577d4c');
      ellipse(ctx,px+17,py-19,29+scale,25,'#517446');
      ellipse(ctx,px,py-35,31+scale,28,'#769a59');
      ellipse(ctx,px-8,py-43,22+scale,11,'#91ae69');
      for(let j=0;j<4;j++) {
        ellipse(ctx,px-22+j*12,py-24+hash(i,j)*9,4.7,4.1,j%2?'#f1a35e':'#f1c96b');
      }
    }
  };
  if(x<48) trees(true,-21,y,y+h,1);
  if(x+w>FIELD.width-48) trees(true,FIELD.width+21,y,y+h,2);
  if(y<65) trees(false,-6,x,x+w,3);
  if(y+h>FIELD.height-70) trees(false,FIELD.height+22,x,x+w,4);
}

function danger(ctx,enemy) {
  const [,kind,x,y,,, , ,wind,mode,tx,ty,aim]=enemy;
  if(wind<=0) return;
  ctx.save();
  ctx.beginPath();ctx.setLineDash([6,5]);
  if (kind==='boar') {
    ctx.translate(x,y);ctx.rotate(aim);
    ctx.fillStyle='#e7513748';ctx.fillRect(0,-19,172,38);
    ctx.strokeStyle='#b63132';ctx.lineWidth=2;ctx.strokeRect(0,-19,172,38);
  } else {
    const points=mode===2?[[tx,ty],[tx-116,ty+66],[tx+116,ty-66]]:[[tx,ty]];
    const radius=mode===1?107:75;
    for(const [px,py] of points) {
      ellipse(ctx,px,py,radius,radius,'#dd49274c');
      ring(ctx,px,py,radius,'#ae3334',2.4);
      ctx.setLineDash([]);
      ring(ctx,px,py,Math.max(4,radius*(1-wind/98)),'#f9d2b2',1.5);
      ctx.setLineDash([6,5]);
    }
  }
  ctx.restore();
}

function monster(ctx,enemy,clock,x,y) {
  const [id,kind,,,r,hp,flash,face]=enemy;
  const [body,ink]=palettes[kind] || palettes.grub;
  const big=['elite','boss','queen'].includes(kind);
  const bounce=Math.sin(clock*9+id)*Math.min(2.3,r*.10);
  ellipse(ctx,x,y+r*.62,r*.86,r*.34,'#3b503e64');
  ctx.save();ctx.translate(x,y+bounce);ctx.scale(face,1);
  if(kind==='bee'||kind==='queen') {
    const flap=Math.sin(clock*23+id)*r*.21;
    ellipse(ctx,-r*.42,-r*.52,r*.42,r*.33+flap/3,'#f6ffddc6');
    ellipse(ctx,r*.09,-r*.63,r*.42,r*.31-flap/3,'#f9ffdfd6');
  }
  if(kind==='boar'||kind==='boss'||kind==='elite') {
    polygon(ctx,r*.62,-r*.62,3,r*.46,ink,.15);
    polygon(ctx,-r*.55,-r*.63,3,r*.44,ink,-.52);
  }
  ellipse(ctx,0,0,r,r*.83,ink);
  ellipse(ctx,0,-r*.06,r*.91,r*.73,flash?'#fff4d9':body);
  if(kind==='shroom') {
    ellipse(ctx,-r*.08,-r*.36,r*.98,r*.46,'#a24f77');
    ellipse(ctx,-r*.12,-r*.48,r*.88,r*.37,flash?'#fff4d9':'#fba3a2');
    ellipse(ctx,-r*.48,-r*.44,r*.20,r*.11,'#ffe3c3');
    ellipse(ctx,r*.25,-r*.63,r*.15,r*.10,'#ffe3c3');
  }
  if(kind==='grub'||kind==='snail') {
    ellipse(ctx,-r*.38,-r*.10,r*.56,r*.61,kind==='snail'?'#cf8356':'#af813f');
    if(kind==='snail') ring(ctx,-r*.42,-r*.20,r*.30,'#f6bc7a',1.8);
  }
  if(kind==='bee'||kind==='queen') {
    const stripe=r*.15;
    ellipse(ctx,-r*.48,-r*.04,stripe,r*.68,ink);
    ellipse(ctx,-r*.15,-r*.04,stripe,r*.74,ink);
  }
  if (kind==='boss') {
    polygon(ctx,-r*.10,-r*.81,5,r*.46,'#e97949',-.37);
    polygon(ctx,-r*.10,-r*.87,5,r*.34,'#fff0a3',-.37);
  }
  if (kind==='queen') polygon(ctx,r*.28,-r*.77,5,r*.27,'#fff2ac',-.45);
  ellipse(ctx,r*.68,r*.05,r*.18,r*.14,'#ffe1ae');
  ellipse(ctx,r*.31,-r*.13,r*.083,r*.122,ink);
  ellipse(ctx,r*.63,-r*.18,r*.079,r*.11,ink);
  ellipse(ctx,r*.38,r*.15,r*.11,r*.067,'#7a423e');
  ctx.restore();
  if(big||hp<99&&kind==='snail') {
    const width=r*(big?2.1:1.5);
    ctx.fillStyle='#644342';ctx.fillRect(x-width/2,y-r-12,width,5);
    ctx.fillStyle=big?'#ffbd63':'#f7e4a8';ctx.fillRect(x-width/2,y-r-12,width*hp/100,5);
  }
}

function playerSprite(ctx,player,sprite,clock,x,y,self) {
  const {face,walk,down,inv,name,job,rev}=player;
  const color=CLASSES[job]?.color || '#f8ab46';
  const drift=walk&&!down?Math.sin(clock*15)*2.1:0;
  ellipse(ctx,x,y+9,19,7,'#334b3694');
  if(self||down) ring(ctx,x,y+3,21,down?'#fff1a2':color,2.4);
  if(down&&rev>0) ring(ctx,x,y+3,28,'#fff8b6',2.8+rev);
  ctx.save();ctx.translate(x,y);
  if(inv && Math.floor(clock*9)%2===0) ctx.globalAlpha=.64;
  if(down) {ctx.globalAlpha=.62;ctx.rotate(-.62);}
  ctx.scale(face,1);
  if(sprite.complete&&sprite.naturalWidth>0) {
    const height=62;
    const width=LIMIT(height*sprite.naturalWidth/sprite.naturalHeight,31,68);
    ctx.drawImage(sprite,-width/2,-height+9+drift,width,height);
  } else {
    ellipse(ctx,0,-14,15,20,'#af724a');
    ellipse(ctx,0,-21,12,12,'#f4d0a0');
  }
  ctx.restore();
  if(!self||down) {
    ctx.font='700 12px system-ui';
    ctx.textAlign='center';
    ctx.lineWidth=3;
    ctx.strokeStyle='#496039';
    const tag=down?'救援 '+Math.round(rev/2.3*100)+'%':name;
    ctx.strokeText(tag,x,y+30);ctx.fillStyle='#fff8d1';ctx.fillText(tag,x,y+30);
  }
}

function drawEffects(ctx,view,shooting) {
  for(const [x,y,r,kind,color] of view.zones) {
    ellipse(ctx,x,y,kind==='mine'?13:r,kind==='mine'?9:r,kind==='drop'?'#ffda9276':color+'57');
    ring(ctx,x,y,kind==='mine'?15:r,kind==='drop'?'#c25746':color,2);
    if(kind==='mine') ellipse(ctx,x,y-4,3,3,'#fff4b5');
  }
  for(const [x,y,count] of view.gems) {
    ellipse(ctx,x,y+3,8,3,'#46684464');
    polygon(ctx,x,y,4,count>8?8:5,count>8?'#fae07f':'#39675b');
    polygon(ctx,x,y-1,4,count>8?5:3.2,count>8?'#fff3b0':'#b9f1cc');
  }
  for(const [id,sx,sy,angle,color,kind] of view.shots) {
    const [x,y]=shooting(id,sx,sy);
    const flame=kind==='blast';
    ctx.save();ctx.translate(x,y);ctx.rotate(angle);
    ellipse(ctx,-8,0,17,flame?5:2.5,color+'73');
    ellipse(ctx,0,0,flame?9:6,flame?7:3.6,color);
    ellipse(ctx,2,0,3.5,2.2,'#fff3c9');ctx.restore();
  }
}

function drawFlash(ctx,view,quiet) {
  for(const [x,y,r,color,strength,kind,x2,y2,label] of view.fx) {
    if(quiet&&kind==='number') continue;
    const life=strength/100;
    ctx.save();
    if(kind==='line') {
      ctx.globalAlpha=life;ctx.strokeStyle=color;ctx.lineWidth=3;
      ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo((x+x2)/2+8,(y+y2)/2-13);ctx.lineTo(x2,y2);ctx.stroke();
    } else if(kind==='number') {
      ctx.globalAlpha=life;ctx.textAlign='center';ctx.font='800 15px system-ui';
      ctx.strokeStyle='#6b5248';ctx.lineWidth=2;ctx.fillStyle='#fff0c9';
      ctx.strokeText(label,x,y-(1-life)*30-18);ctx.fillText(label,x,y-(1-life)*30-18);
    } else {
      const radius=Math.max(1,r*(1.05-life*.85));
      ctx.globalAlpha=life*.65;
      ellipse(ctx,x,y,radius,radius,color+'64');ring(ctx,x,y,radius,color,kind==='pop'?3:2);
      if(kind==='pop'&&!quiet) {
        for(let i=0;i<5;i++) {
          const angle=i/5*TAU+x/21;
          const dx=x+Math.cos(angle)*radius,dy=y+Math.sin(angle)*radius;
          ellipse(ctx,dx,dy,1.7+life*1.7,1.7+life*1.7,color);
        }
      }
      if(label) {
        ctx.globalAlpha=Math.min(1,life*2);ctx.textAlign='center';ctx.font='800 18px system-ui';ctx.lineWidth=3;
        ctx.strokeStyle='#695138';ctx.fillStyle='#fff4ca';
        ctx.strokeText(label,x,y-90);ctx.fillText(label,x,y-90);
      }
    }
    ctx.restore();
  }
}

export class Scene {
  constructor(canvas,sprite) {
    this.canvas=canvas;
    this.ctx=canvas.getContext('2d',{alpha:false});
    this.sprite=sprite;
    this.points=new Map();
    this.seen=new Set();
    this.w=0;this.h=0;
    this.resize=new ResizeObserver(()=>{this.w=0;});
    this.resize.observe(canvas);
  }
  reset() { this.points.clear(); }
  position(key,x,y,rate) {
    this.seen.add(key);
    let point=this.points.get(key);
    if(!point || Math.hypot(point[0]-x,point[1]-y)>200) {
      point=[x,y];
      this.points.set(key,point);
    } else {
      point[0]+=(x-point[0])*rate;
      point[1]+=(y-point[1])*rate;
    }
    return point;
  }
  render(view,id,delta,quiet,remote) {
    const own=view.players.find(p=>p.id===id) || view.players[0];
    if(!own) return;
    const ctx=this.ctx;
    if(!this.w) {
      const box=this.canvas.getBoundingClientRect();
      if(!box.width||!box.height) return;
      this.w=Math.round(box.width);this.h=Math.round(box.height);
      this.dpr=Math.min(2,window.devicePixelRatio||1);
      this.canvas.width=Math.round(this.w*this.dpr);
      this.canvas.height=Math.round(this.h*this.dpr);
    }
    const w=this.w,h=this.h;
    const zoom=Math.min(1.38,Math.max(.72,Math.min(w/670,h/490)));
    const rangeX=w/zoom,rangeY=h/zoom;
    const step=1-Math.exp(-Math.max(.001,delta)*(remote?21:44));
    this.seen.clear();
    const [focusX,focusY]=this.position('focus',own.x,own.y,step);
    const x=LIMIT(focusX-rangeX/2,-28,Math.max(-28,FIELD.width-rangeX+28));
    const y=LIMIT(focusY-rangeY/2,-34,Math.max(-34,FIELD.height-rangeY+30));
    const factor=this.dpr*zoom;
    ctx.setTransform(factor,0,0,factor,-x*factor,-y*factor);
    field(ctx,x,y,rangeX,rangeY);
    const show=(px,py,margin=85)=>px>=x-margin&&px<=x+rangeX+margin&&py>=y-margin&&py<=y+rangeY+margin;
    for(const enemy of view.enemies) if(show(enemy[2],enemy[3],700)) danger(ctx,enemy);
    drawEffects(ctx,view,(key,px,py)=>this.position('s'+key,px,py,step));
    const draw=[];
    for(const enemy of view.enemies) {
      const [px,py]=this.position('e'+enemy[0],enemy[2],enemy[3],step);
      if(show(px,py)) draw.push([py,()=>monster(ctx,enemy,view.t,px,py)]);
    }
    for(const player of view.players) {
      const [px,py]=this.position('p'+player.id,player.x,player.y,step);
      if(show(px,py)) draw.push([py,()=>playerSprite(ctx,player,this.sprite,view.t,px,py,player.id===id)]);
    }
    draw.sort((a,b)=>a[0]-b[0]).forEach(entry=>entry[1]());
    drawFlash(ctx,view,quiet);
    for(const key of this.points.keys()) if(!this.seen.has(key)) this.points.delete(key);
  }
}
