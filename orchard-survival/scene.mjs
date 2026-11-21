import { FIELD } from './content.mjs?v=082';
import { HeroSprite, EnemySprite } from './actors.mjs?v=082';
import { Garden, fieldLight } from './garden.mjs?v=082';
import { Radar } from './radar.mjs?v=082';
import { FieldEffects } from './spells.mjs?v=082';
const LIMIT=(v,min,max)=>Math.max(min,Math.min(max,v));
export class Scene {
  constructor(viewport,mini) {
    this.viewport=viewport;
    this.garden=new Garden(document.getElementById('field-ground'));this.radar=new Radar(mini);
    this.world=document.getElementById('field-art');
    this.effects=new FieldEffects(document.getElementById('field-items'),document.getElementById('field-effects'));
    this.units=new Map();
    this.points=new Map();
    this.seen=new Set();
    this.w=0;this.h=0;
    this.resize=new ResizeObserver(()=>{this.w=0;});
    this.resize.observe(viewport);
  }
  reset(){this.points.clear();this.units.clear();this.world.replaceChildren();this.effects.clear();this.radar.last=-1;}
  unit(key,create,x,y){
    let model=this.units.get(key);
    if(!model){model=create();this.units.set(key,model);this.world.append(model.el);}
    this.seen.add(key);
    model.el.style.transform='translate('+x.toFixed(1)+'px,'+y.toFixed(1)+'px)';
    model.el.style.zIndex=String(Math.round(y*8));
    return model;
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
    if(!this.w) {
      const box=this.viewport.getBoundingClientRect();
      if(!box.width||!box.height) return;
      this.w=Math.round(box.width);this.h=Math.round(box.height);
    }
    const w=this.w,h=this.h;
    const zoom=Math.min(1.38,Math.max(.72,Math.min(w/670,h/490)));
    const rangeX=w/zoom,rangeY=h/zoom;
    const step=1-Math.exp(-Math.max(.001,delta)*(remote?21:44));
    this.seen.clear();
    const [focusX,focusY]=this.position('focus',own.x,own.y,step);
    const x=LIMIT(focusX-rangeX/2,-28,Math.max(-28,FIELD.width-rangeX+28));
    const y=LIMIT(focusY-rangeY/2,-34,Math.max(-34,FIELD.height-rangeY+30));
    const light=fieldLight(view.t),props=this.garden.visible(x,y,rangeX,rangeY);
    this.garden.light(light);
    const show=(px,py,margin=85)=>px>=x-margin&&px<=x+rangeX+margin&&py>=y-margin&&py<=y+rangeY+margin;
    // Let the paths, the characters and the trees share a single ground plane.
    const protectedActors=[...view.players];
    for(const enemy of view.enemies){
      if(show(enemy[2],enemy[3],150))protectedActors.push({x:enemy[2],y:enemy[3]});
    }
    this.world.style.transform='matrix('+[zoom,0,0,zoom,-x*zoom,-y*zoom].join(',')+')';
    this.garden.ground.style.transform=this.world.style.transform;
    this.effects.transform(this.world.style.transform);
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
    this.effects.draw(view,(key,px,py)=>this.position(key,px,py,step),quiet,show);
    this.radar.draw(view,id,[x,y,rangeX,rangeY]);
    for(const key of this.points.keys()) if(!this.seen.has(key)) this.points.delete(key);
  }
}
