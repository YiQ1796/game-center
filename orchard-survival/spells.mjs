// Battle effects share the same camera and hit data as the illustrated units.
const assets=new URL('./art/',import.meta.url);
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
function style(node,key,value){if(node.style[key]!==value)node.style[key]=value;}

class SpriteLayer {
  constructor(root){this.root=root;this.nodes=new Map();this.seen=new Set();}
  begin(){this.seen.clear();}
  place(key,kind,x,y,width,height,angle=0,opacity=1){
    this.seen.add(key);
    let el=this.nodes.get(key);
    if(!el){
      el=document.createElement('span');this.nodes.set(key,el);this.root.append(el);
    }
    if(el.className!==kind)el.className=kind;
    style(el,'width',width+'px');style(el,'height',height+'px');
    style(el,'transform','translate('+x.toFixed(1)+'px,'+y.toFixed(1)+'px) translate(-50%,-50%) rotate('+angle.toFixed(3)+'rad)');
    style(el,'opacity',clamp(opacity,0,1).toFixed(2));
    return el;
  }
  art(key,asset,x,y,width,height,angle=0,opacity=1,frame=null){
    const el=this.place(key,'battle-illustration',x,y,width,height,angle,opacity);
    if(el.dataset.art!==asset){
      el.dataset.art=asset;el.style.backgroundImage='url("'+new URL(asset+'.webp',assets).href+'")';
      el.style.backgroundSize=frame===null?'100% 100%':'300% 100%';
    }
    if(frame!==null)style(el,'backgroundPosition',(clamp(frame,0,2)*50)+'% center');
    return el;
  }
  label(key,content,x,y,critical,opacity){
    const el=this.place(key,critical?'damage-number critical':'damage-number',x,y,84,24,0,opacity);
    if(el.textContent!==String(content))el.textContent=String(content);
  }
  finish(){for(const [key,el] of this.nodes)if(!this.seen.has(key)){el.remove();this.nodes.delete(key);}}
  clear(){this.root.replaceChildren();this.nodes.clear();this.seen.clear();}
}
const sceneArt={ward:'leaf-ward',trail:'wind-trail',line:'wind-trail',bolt:'lightning',ice:'frost-bloom',upgrade:'pollen',pop:'pollen',
  cyclone:'leaf-cyclone',gale:'leaf-cyclone',sweep:'fx-slash','cast-staff':'leaf-cyclone','cast-mage':'fx-magic','cast-scout':'fx-wind',
  nova:'meteor',impact:'fx-magic'};
const shotArt={blast:'fireball',return:'boomerang',starArrow:'star-arrow',pierce:'seed-arrow'};
export class FieldEffects {
  constructor(ground,front){this.ground=new SpriteLayer(ground);this.front=new SpriteLayer(front);}
  transform(matrix){this.ground.root.style.transform=this.front.root.style.transform=matrix;}
  clear(){this.ground.clear();this.front.clear();}
  draw(view,smooth,quiet,visible){
    const ground=this.ground,front=this.front;
    ground.begin();front.begin();
    for(const [x,y,value,id] of view.gems){
      if(!visible(x,y,20))continue;
      const big=value>8,size=big?20:14;
      ground.art('gem'+(id??(x+'-'+y)),big?'gold-seed':'green-seed',x,y-3+(quiet?0:Math.sin(view.t*3+x)*1.4),size,size);
    }
    for(const [x,y,r,kind,color,remaining,id] of view.zones){
      if(!visible(x,y,r+200))continue;
      const life=remaining/100;
      if(kind==='mine'){ground.art('zone'+id,'seed-mine',x,y-6,29,29);continue;}
      const zone=ground.place('zone'+id,'area-indicator '+kind,x,y,r*2,r*1.4);
      zone.style.setProperty('--area-color',color);
      if(kind==='field'||kind==='frostfield'){
        ground.art('seal'+id,kind==='frostfield'?'frost-bloom':'spell-circle',x,y,r*1.8,r*1.25,0,.65);
      }else if(kind==='meteor'||kind==='drop'){
        const meteor=kind==='meteor',size=meteor?100:41;
        front.art('drop'+id,meteor?'meteor':'supply-crate',x-114*life,y-192*life-6,size,size);
      }
    }
    for(const [id,x,y,angle,,kind,tier=1] of view.shots){
      if(!visible(x,y,110))continue;
      const [px,py]=smooth('s'+id,x,y);
      const size=kind==='starArrow'?82:kind==='return'?34:kind==='blast'?54:40+tier*2;
      front.art('shot'+id,shotArt[kind]||'seed-arrow',px,py-15,size,kind==='return'?size:kind==='pierce'?size*.26:size*.54,kind==='return'?view.t*12:angle);
    }
    for(const enemy of view.enemies){
      if(!enemy[8]||!visible(enemy[2],enemy[3],700))continue;
      const [id,kind,x,y,,,,,wind,mode,tx,ty,aim]=enemy;
      if(kind==='boar'){
        front.place('warn'+id,'warning charge',x+86*Math.cos(aim),y+86*Math.sin(aim),172,38,aim);
      }else{
        const points=mode===2?[[tx,ty],[tx-116,ty+66],[tx+116,ty-66]]:[[tx,ty]];
        const diameter=mode===1?214:150;
        points.forEach(([px,py],i)=>{
          const key='warn'+id+'/'+i;
          front.place(key,'warning circle',px,py,diameter,diameter);
          const fill=Math.max(.02,1-wind/98)*diameter;
          front.place(key+'timer','warning timer',px,py,fill,fill);
        });
      }
    }
    for(const [x,y,r,,strength,kind,x2,y2,label,id] of view.fx){
      if(!visible(x,y,650)||strength<=0)continue;
      const stage=1-strength/100,alpha=Math.min(1,(1-stage)*3)*(quiet?.72:1);
      const art=sceneArt[kind]||'pollen',key='fx'+id;
      if(kind==='number'){if(!quiet)front.label(key,label,x,y-30-stage*18,true,alpha);continue;}
      if(kind==='bolt'||kind==='trail'||kind==='line'){
        const dx=x2-x,dy=y2-y;
        front.art(key,art,x+dx*.5,y+dy*.5-12,Math.max(12,Math.hypot(dx,dy)),kind==='bolt'?32:25,Math.atan2(dy,dx),alpha);
        continue;
      }
      const size=kind==='ward'?86:clamp(r*(1.12+.6*stage),26,340);
      front.art(key,art,x,y-14,size,size,kind==='cyclone'?stage*2.6:0,alpha,art.startsWith('fx-')?Math.min(2,Math.floor(stage*3)):null);
      if(label)front.label(key+'/name',label,x,y-81-stage*12,true,alpha);
    }
    for(const [id,x,y,r,amount,critical,age,dir,,family] of view.hits||[]){
      if(!visible(x,y,100))continue;
      const phase=age/550,opacity=clamp((1-phase)*4,0,1);
      if(age<320){
        const size=Math.min(92,30+r*(critical?2.1:1.35));
        front.art('hit'+id,'fx-'+(family||'magic'),x,y-r*.95,size,size,dir<0?Math.PI:0,quiet?.55:.9,Math.floor(age/320*3));
      }
      front.label('damage'+id,amount,x+dir*(quiet?0:phase*8)+(id%3-1)*4,y-r*1.95-(quiet?3:phase*22),critical,opacity);
    }
    ground.finish();front.finish();
  }
}
