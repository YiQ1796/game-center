import { TAU } from './paint.mjs?v=021';
import { FIELD } from './content.mjs?v=021';
import { adventurer, creature } from './actors.mjs?v=021';
import { Garden } from './garden.mjs?v=021';
import { Radar } from './radar.mjs?v=021';
import { airborne, groundSpells, spellFlashes } from './spells.mjs?v=021';
const LIMIT=(v,min,max)=>Math.max(min,Math.min(max,v));
function ellipse(ctx,x,y,rx,ry,color) {
  ctx.beginPath(); ctx.ellipse(x,y,rx,ry,0,0,TAU);ctx.fillStyle=color;ctx.fill();
}

function ring(ctx,x,y,r,color,width=2) {
  ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();
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

export class Scene {
  constructor(canvas,sprite,mini) {
    this.canvas=canvas;
    this.garden=new Garden();this.radar=new Radar(mini);
    this.ctx=canvas.getContext('2d',{alpha:false});
    this.sprite=sprite;
    this.points=new Map();
    this.seen=new Set();
    this.w=0;this.h=0;
    this.resize=new ResizeObserver(()=>{this.w=0;});
    this.resize.observe(canvas);
  }
  reset() { this.points.clear();this.radar.last=-1; }
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
    this.garden.draw(ctx,x,y,rangeX,rangeY);
    const show=(px,py,margin=85)=>px>=x-margin&&px<=x+rangeX+margin&&py>=y-margin&&py<=y+rangeY+margin;
    for(const enemy of view.enemies) if(show(enemy[2],enemy[3],700)) danger(ctx,enemy);
    groundSpells(ctx,view);
    const draw=[];
    for(const enemy of view.enemies) {
      const [px,py]=this.position('e'+enemy[0],enemy[2],enemy[3],step);
      if(show(px,py)) draw.push([py,()=>creature(ctx,enemy,view.t,px,py)]);
    }
    for(const player of view.players) {
      const [px,py]=this.position('p'+player.id,player.x,player.y,step);
      if(show(px,py)) draw.push([py,()=>adventurer(ctx,player,this.sprite,view.t,px,py,player.id===id)]);
    }
    draw.sort((a,b)=>a[0]-b[0]).forEach(entry=>entry[1]());
    airborne(ctx,view,(key,px,py)=>this.position('s'+key,px,py,step),quiet);
    spellFlashes(ctx,view,quiet);
    this.radar.draw(view,id,[x,y,rangeX,rangeY]);
    for(const key of this.points.keys()) if(!this.seen.has(key)) this.points.delete(key);
  }
}
