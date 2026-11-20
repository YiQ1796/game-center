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
function castMotion(layer,key,kind,x,y,r,color,t,aim,id,quiet){
  const sweep=['sweep','cyclone','gale','cast-staff'].includes(kind);
  const arrows=kind==='cast-scout',ice=kind==='ice';
  const radius=Math.min(320,Math.max(18,r)),out=1-(1-t)*(1-t);
  const count=quiet?1:sweep?4:arrows?5:kind==='pop'?3:6;
  for(let i=0;i<count;i++){
    const lag=i/(count+2)*.28,age=clamp((t-lag)/(1-lag),0,1);
    if(t<lag)continue;
    const angle=sweep?aim-1.55+age*3.5-i*.32:arrows?aim+(i-2)*.26:id*2.4+i*2*Math.PI/count;
    const dist=radius*(sweep ? .18+.72*age : .06+.83*(1-(1-age)**2));
    const px=x+Math.cos(angle)*dist,py=y+Math.sin(angle)*dist*(sweep?.65:.77)-10;
    const length=sweep?radius*(.24+.47*Math.sin(age*Math.PI)):arrows?22:ice?17:5+radius*.09;
    const node=layer.place(key+'/'+i,'cast-fragment '+(sweep?'blade':arrows?'feather':ice?'crystal':'ember'),px,py,
      length,sweep?Math.max(5,radius*.12):ice?7:arrows?5:Math.max(3,length*.32),angle+(sweep?Math.PI/2:0),Math.min(1,(1-age)*2));
    node.style.setProperty('--light',color);node.dataset.spell=kind;
    if(!quiet && (sweep||ice||kind==='cast-mage') && i<3){
      const curl=angle+(sweep?-.32:.18),drift=dist*(.72+.22*age);
      const spark=layer.place(key+'/glint'+i,'cast-glint',x+Math.cos(curl)*drift,
        y+Math.sin(curl)*drift*.7-12-13*Math.sin(age*Math.PI),4+5*(1-age),3+3*(1-age),curl,Math.sin(age*Math.PI));
      spark.style.setProperty('--light',color);
    }
  }
  if(!sweep&&!arrows&&kind!=='pop'){
    const dia=Math.max(4,radius*out*1.75);
    const ring=layer.place(key+'/wave','cast-wave',x,y,dia,dia*.61,0,(1-t)*.8);
    ring.style.setProperty('--light',color);
  }
}
function lightning(layer,key,x,y,dx,dy,age,color,quiet){
  const distance=Math.hypot(dx,dy);
  if(distance<1)return;
  const nx=-dy/distance,ny=dx/distance,count=quiet?3:6;
  const reach=clamp(age*5.5,0,1),fade=Math.min(1,(1-age)*2.6);
  let lastX=x,lastY=y-21;
  for(let i=1;i<=count;i++){
    const t=Math.min(reach,i/count);
    const offset=Math.sin(t*Math.PI)*Math.sin(i*8.7+Math.floor(age*7))*Math.min(14,distance*.10);
    const px=x+dx*t+nx*offset,py=y-21+dy*t+ny*offset;
    const segment=layer.place(key+'/'+i,'arc-stroke',(lastX+px)/2,(lastY+py)/2,
      Math.hypot(px-lastX,py-lastY)+1,quiet?2:3,Math.atan2(py-lastY,px-lastX),fade);
    segment.style.setProperty('--light',color);
    lastX=px;lastY=py;
    if(t===reach)break;
  }
}
function siphon(layer,key,x,y,dx,dy,t,color,quiet){
  const count=quiet?2:5,length=Math.max(1,Math.hypot(dx,dy));
  for(let i=0;i<count;i++){
    const a=clamp(t*1.5-i*.095,0,1),curl=Math.sin(a*Math.PI)*Math.sin(a*6+i*.8)*13;
    const bead=layer.place(key+'/mote'+i,'soul-mote',x+dx*a-dy/length*curl,
      y-21+dy*a+dx/length*curl,9-i*.65,5,Math.atan2(dy,dx),Math.sin(Math.PI*a));
    bead.style.setProperty('--light',color);
  }
}
const sceneArt={ward:'leaf-ward',trail:'wind-trail',line:'wind-trail',bolt:'lightning',ice:'frost-bloom',upgrade:'pollen',pop:'pollen',
  cyclone:'leaf-cyclone',gale:'leaf-cyclone',sweep:'fx-slash','cast-staff':'leaf-cyclone','cast-mage':'fx-magic','cast-scout':'fx-wind',
  nova:'meteor',impact:'fx-magic'};
const shotArt={blast:'fireball',return:'boomerang',starArrow:'star-arrow',pierce:'seed-arrow'};
function displayDrops(gems,players,visible){
  const nearby=gems.filter(([x,y])=>visible(x,y,20));
  if(nearby.length<40)return nearby;
  const singles=[],cells=new Map();
  for(const gem of nearby){
    const [x,y]=gem;
    if(players.some(p=>!p.down&&Math.abs(x-p.x)<85&&Math.abs(y-p.y)<85)){singles.push(gem);continue;}
    const key=Math.floor(x/42)+','+Math.floor(y/42);
    if(!cells.has(key))cells.set(key,[]);
    cells.get(key).push(gem);
  }
  for(const [key,cell] of cells){
    if(cell.length<3){singles.push(...cell);continue;}
    const marker=cell.reduce((a,b)=>a[2]>=b[2]?a:b);
    singles.push([marker[0],marker[1],cell.reduce((sum,item)=>sum+item[2],0),'pile'+key]);
  }
  return singles;
}
export class FieldEffects {
  constructor(ground,front){this.ground=new SpriteLayer(ground);this.front=new SpriteLayer(front);}
  transform(matrix){this.ground.root.style.transform=this.front.root.style.transform=matrix;}
  clear(){this.ground.clear();this.front.clear();}
  draw(view,smooth,quiet,visible){
    const ground=this.ground,front=this.front;
    ground.begin();front.begin();
    for(const [x,y,value,id] of displayDrops(view.gems,view.players||[],visible)){
      const big=value>8,size=big?20:14;
      ground.art('gem'+(id??(x+'-'+y)),big?'gold-seed':'green-seed',x,y-3+(quiet?0:Math.sin(view.t*3+x)*1.4),size,size);
    }
    for(const [x,y,r,kind,color,remaining,id] of view.zones){
      if(!visible(x,y,r+200))continue;
      const life=remaining/100;
      if(kind==='arrowfall'){
        for(let i=0;i<3;i++)front.art('rain'+id+'/'+i,'seed-arrow',x+(i-1)*17-22*life,y-125*life-8,38,9,1.36);
        continue;
      }
      if(kind==='mine'){
        const span=32+8*Math.min(1,(1-life)*15);
        ground.place('trap/'+id,'snare-cord',x,y-2,span,10,-.18,.84);
        for(const side of [-1,1])ground.place('stake/'+id+'/'+side,'snare-stake',x+side*span*.47,y-3-side*3,3,9,side*.24);
        continue;
      }
      const zone=ground.place('zone'+id,'area-indicator '+kind,x,y,r*2,r*1.4);
      zone.style.setProperty('--area-color',color);
      if(kind==='field'||kind==='frostfield'){
        ground.art('seal'+id,kind==='frostfield'?'frost-bloom':'spell-circle',x,y,r*(1.3+.22*Math.sin(life*6)),r*(1+.12*Math.sin(life*6)),(1-life)*.6,Math.min(.6,life*3));
      }else if(kind==='meteor'||kind==='drop'){
        const meteor=kind==='meteor',size=meteor?100:41;
        front.art('drop'+id,meteor?'meteor':'supply-crate',x-114*life,y-192*life-6,size,size);
      }
    }
    for(const [id,x,y,angle,,kind,tier=1] of view.shots){
      if(!visible(x,y,110))continue;
      const [px,py]=smooth('s'+id,x,y);
      const size=kind==='starArrow'?82:kind==='return'?34:kind==='blast'?54:40+tier*2;
      if(!quiet && (kind==='blast'||kind==='starArrow')){
        const length=kind==='blast'?26:42,glow=front.place('wake'+id,'shot-wake',px-Math.cos(angle)*length*.6,py-15-Math.sin(angle)*length*.6,length,kind==='blast'?9:4,angle,.75);
        glow.style.setProperty('--light',kind==='blast'?'#ffb76d':'#abf3ce');
      }
      front.art('shot'+id,shotArt[kind]||'seed-arrow',px,py-15,size,kind==='return'?size:['pierce','pin','ricochet'].includes(kind)?size*.26:size*.54,kind==='return'?view.t*12:angle);
    }
    for(const [id,x,y,left] of view.hail||[]){
      if(!visible(x,y,240))continue;
      const t=clamp(1-left/1.45,0,1);
      ground.place('hail/'+id,'hail-target',x,y,136,136,0,.75);
      ground.place('hail-fill/'+id,'hail-fill',x,y,136*t,136*t);
      if(t>.36)front.art('hail-stone/'+id,'meteor',x-80*(1-t),y-330*(1-t),42,60,-.25,1);
    }
    for(const enemy of view.enemies){
      if(!(enemy[8]||enemy[13])||!visible(enemy[2],enemy[3],700))continue;
      const [id,kind,x,y,,,,,wind,mode,tx,ty,aim]=enemy;
      if(kind==='boar'){
        if(enemy[13]){
          const age=1-enemy[13]/37,dx=Math.cos(aim),dy=Math.sin(aim);
          for(let i=0;i<(quiet?1:3);i++){
            const a=(age*1.5+i/3)%1,dist=12+45*a,side=Math.sin(i*4.1)*8*a;
            ground.place('dust/'+id+'/'+i,'rush-dust',x-dx*dist-dy*side,y-dy*dist+dx*side-5-9*a,
              9+19*a,6+8*a,aim,.68*(1-a));
          }
          continue;
        }
        const ready=clamp(1-wind/52,0,1),dx=Math.cos(aim),dy=Math.sin(aim);
        ground.place('warn'+id,'warning charge',x+86*dx,y+86*dy,172,33,aim,.58);
        const length=18+154*ready;
        ground.place('charge-fill'+id,'charge-fill',x+length*.5*dx,y+length*.5*dy,length,21,aim,.78);
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
    for(const [x,y,r,color,strength,kind,x2,y2,label,id] of view.fx){
      if(!visible(x,y,650)||strength<=0)continue;
      const stage=1-strength/100,alpha=Math.min(1,(1-stage)*3)*(quiet?.72:1);
      const art=sceneArt[kind]||'pollen',key='fx'+id;
      if(kind==='number'){if(!quiet)front.label(key,label,x,y-30-stage*18,true,alpha);continue;}
      if(kind==='bolt'||kind==='arc'){
        lightning(front,key,x,y,x2-x,y2-y,stage,color,quiet);continue;
      }
      if(kind==='siphon'){
        siphon(front,key,x,y,x2-x,y2-y,stage,color,quiet);continue;
      }
      if(kind==='flame'){
        const core=front.place(key+'/core','flame-core',x,y-15-13*stage,
          9+32*Math.sin(stage*Math.PI),8+22*Math.sin(stage*Math.PI),0,alpha*(1-stage));
        core.style.setProperty('--light',color);
      }
      if(kind==='trail'||kind==='line'){
        const dx=x2-x,dy=y2-y;
        const reach=clamp(stage*5,0,1),tail=clamp((stage-.34)*1.5,0,reach),mid=(reach+tail)*.5;
        front.art(key,art,x+dx*mid,y+dy*mid-12,Math.max(2,Math.hypot(dx,dy)*(reach-tail)),kind==='bolt'?17:12,Math.atan2(dy,dx),alpha);
        continue;
      }
      if(kind!=='ward'){
        castMotion(front,key,kind,x,y,r,color,stage,x2||0,id,quiet);
        if(label)front.label(key+'/name',label,x,y-63-stage*14,true,alpha);
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
        const t=clamp(age/320,0,1);
        const spark=front.place('hit'+id,'contact-spark',x+dir*t*10,y-r*.9-t*5,size*(.12+.45*t),Math.max(2,5*(1-t)),dir*.55,(1-t)*(quiet?.55:1));
        spark.style.setProperty('--light',family==='slash'?'#ffc467':family==='wind'?'#8ce8cf':'#d8aaff');
      }
      front.label('damage'+id,amount,x+dir*(quiet?0:phase*8)+(id%3-1)*4,y-r*1.95-(quiet?3:phase*22),critical,opacity);
    }
    ground.finish();front.finish();
  }
}
