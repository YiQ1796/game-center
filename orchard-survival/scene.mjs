import { TAU } from './paint.mjs?v=060';
import { FIELD } from './content.mjs?v=060';
import { HeroSprite, EnemySprite } from './actors.mjs?v=060';
import { Garden, fieldLight } from './garden.mjs?v=060';
import { Radar } from './radar.mjs?v=060';
import { airborne, groundSpells, spellFlashes } from './spells.mjs?v=060';
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

function damageReadouts(c,hits,quiet){
  c.save();c.textAlign='center';c.lineJoin='round';
  for(const [id,x,y,r,amount,critical,ms,direction] of hits){
    const age=Math.min(1,ms/550),rise=quiet?3:age*22;
    c.globalAlpha=Math.min(1,(1-age)*4);
    const px=x+direction*(quiet?0:age*8)+(id%3-1)*4,py=y-r*1.75-rise;
    c.font=(critical?'900 19px':'bold 14px')+' system-ui';c.lineWidth=3;
    c.strokeStyle='#422c37';c.fillStyle=critical?'#ffcb68':'#fff4d8';
    c.strokeText(String(amount),px,py);c.fillText(String(amount),px,py);
  }
  c.restore();
}
export class Scene {
  constructor(canvas,mini) {
    this.canvas=canvas;
    this.garden=new Garden(document.getElementById('field-ground'));this.radar=new Radar(mini);
    this.ctx=canvas.getContext('2d');
    this.world=document.getElementById('field-art');
    this.front=document.getElementById('field-effects');this.effects=this.front.getContext('2d');
    this.illustrations=document.getElementById('field-illustrations');
    this.spellSprites=new Map();
    this.units=new Map();
    this.points=new Map();
    this.seen=new Set();
    this.w=0;this.h=0;
    this.resize=new ResizeObserver(()=>{this.w=0;});
    this.resize.observe(canvas);
  }
  reset(){this.points.clear();this.units.clear();this.world.replaceChildren();this.spellSprites.clear();this.illustrations.replaceChildren();this.radar.last=-1;}
  unit(key,create,x,y){
    let model=this.units.get(key);
    if(!model){model=create();this.units.set(key,model);this.world.append(model.el);}
    this.seen.add(key);
    model.el.style.transform='translate('+x.toFixed(1)+'px,'+y.toFixed(1)+'px)';
    model.el.style.zIndex=String(Math.round(y*8));
    return model;
  }
  paintSpells(view,quiet){
    const seen=new Set();
    const sprite=(key,family,x,y,size,phase,face)=>{
      let el=this.spellSprites.get(key);
      if(!el){
        el=document.createElement('span');el.className='spell-illustration';
        this.spellSprites.set(key,el);this.illustrations.append(el);
      }
      seen.add(key);
      if(el.dataset.family!==family){
        el.dataset.family=family;el.style.backgroundImage='url("'+new URL('./art/fx-'+family+'.webp',import.meta.url).href+'")';
      }
      el.style.width=el.style.height=size+'px';
      el.style.transform='translate('+(x-size/2)+'px,'+(y-size/2)+'px) scaleX('+face+')';
      el.style.backgroundPosition=Math.min(2,Math.floor(phase*3))*50+'% center';
      el.style.opacity=String(Math.min(1,(1-phase)*4)*(quiet?.63:.97));
    };
    for(const hit of (view.hits||[]).slice(-28)){
      const [id,x,y,r,,critical,age,direction,,family]=hit;
      if(age<320)sprite('hit'+id,family||'magic',x,y-r*.95,Math.min(92,30+r*(critical?2.1:1.35)),age/320,direction);
    }
    for(const [x,y,r,,strength,kind,,,,id] of view.fx){
      if(!['sweep','cyclone','cast-mage','cast-scout'].includes(kind))continue;
      const phase=1-strength/100,family=kind==='cast-scout'?'wind':kind==='cast-mage'?'magic':'slash';
      sprite('cast'+id,family,x,y-18,Math.min(295,r*1.72),phase,1);
    }
    for(const [key,el] of this.spellSprites)if(!seen.has(key)){el.remove();this.spellSprites.delete(key);}
  }
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
      this.front.width=this.canvas.width;this.front.height=this.canvas.height;
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
    ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,this.canvas.width,this.canvas.height);
    ctx.setTransform(factor,0,0,factor,-x*factor,-y*factor);
    const light=fieldLight(view.t),props=this.garden.visible(x,y,rangeX,rangeY);
    this.garden.light(light);
    const show=(px,py,margin=85)=>px>=x-margin&&px<=x+rangeX+margin&&py>=y-margin&&py<=y+rangeY+margin;
    groundSpells(ctx,view);
    // Let the paths, the characters and the trees share a single ground plane.
    const protectedActors=[...view.players];
    for(const enemy of view.enemies){
      if(enemy[8]>0||['elite','boss','queen'].includes(enemy[1]))protectedActors.push({x:enemy[2],y:enemy[3]});
    }
    this.world.style.transform='matrix('+[zoom,0,0,zoom,-x*zoom,-y*zoom].join(',')+')';
    this.garden.ground.style.transform=this.illustrations.style.transform=this.world.style.transform;
    this.world.style.setProperty('--scenery-light',String(1-light.night*.34));
    for(const p of props){
      const key='tree/'+p.x+'/'+p.y;
      const model=this.unit(key,()=>this.garden.propNode(p),p.x,p.y);
      model.update(light,protectedActors);
    }
    const hits=new Map((view.hits||[]).map(h=>[h[0],h]));
    for(const enemy of view.enemies){
      const [px,py]=this.position('e'+enemy[0],enemy[2],enemy[3],step);
      if(show(px,py,110))this.unit('mob/'+enemy[0],()=>new EnemySprite(),px,py).update(enemy,view.t,hits.get(enemy[0]));
    }
    for(const player of view.players){
      const [px,py]=this.position('p'+player.id,player.x,player.y,step);
      if(show(px,py))this.unit('hero/'+player.id,()=>new HeroSprite(),px,py).update(player,player.id===id);
    }
    for(const [key,model] of this.units)if(!this.seen.has(key)){model.el.remove();this.units.delete(key);}
    const fx=this.effects;
    fx.setTransform(1,0,0,1,0,0);fx.clearRect(0,0,this.front.width,this.front.height);
    fx.setTransform(factor,0,0,factor,-x*factor,-y*factor);
    for(const enemy of view.enemies)if(show(enemy[2],enemy[3],700))danger(fx,enemy);
    airborne(fx,view,(key,px,py)=>this.position('s'+key,px,py,step),quiet);
    this.paintSpells(view,quiet);
    spellFlashes(fx,view,quiet);
    damageReadouts(fx,view.hits||[],quiet);
    this.radar.draw(view,id,[x,y,rangeX,rangeY]);
    for(const key of this.points.keys()) if(!this.seen.has(key)) this.points.delete(key);
  }
}
