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
  paint(key,motif,x,y,width,progress,angle=0,alpha=1,height=width*208/256){
    const el=this.art(key,'ink-'+motif,x,y,width,height,angle,alpha);
    const frame=clamp(Math.floor(progress*4),0,3);
    style(el,'backgroundSize','400% 100%');
    style(el,'backgroundPosition',(frame*100/3)+'% center');
    el.dataset.frame=String(frame);
    return el;
  }
  label(key,content,x,y,critical,opacity){
    const el=this.place(key,critical?'damage-number critical':'damage-number',x,y,84,24,0,opacity);
    if(el.textContent!==String(content))el.textContent=String(content);
  }
  finish(){for(const [key,el] of this.nodes)if(!this.seen.has(key)){el.remove();this.nodes.delete(key);}}
  clear(){this.root.replaceChildren();this.nodes.clear();this.seen.clear();}
}
// The four painted stages share one origin. The world trajectory is continuous
// between stages and is derived from the simulation's impact or aim.
const ultimateArt={
  staff:'dragon', king:'dragon', guardian:'bastion',
  mage:'meteor', storm:'thunder', archmage:'sun',
  scout:'volley', ranger:'falcon', shadow:'owl'
};
function cast(layer,key,route,x,y,r,aim,t,alpha){
  const motif=ultimateArt[route],pulse=Math.sin(Math.PI*t);
  if(!motif)return;
  const reach=1-(1-t)**2;
  let cx=x,cy=y-18,angle=0,w=r*(.8+.86*reach);
  switch(motif){
    case 'falcon':case 'owl':{
      const distance=24+155*t,side=motif==='owl'?-1:1;
      cx+=Math.cos(aim)*distance;cy+=Math.sin(aim)*distance-36*pulse;
      angle=Math.sin(aim)*.5+side*.14*(1-t);w=70+96*pulse;break;
    }
    case 'dragon':cx+=Math.cos(aim)*15*pulse;cy-=18*pulse;angle=(reach-.4)*.72;break;
    case 'thunder':cy-=54+12*pulse;w*=.87;break;
    case 'meteor':cx+=48*(t-.5);cy-=64*(1-t);w*=.83;break;
    case 'volley':cy-=62*(1-t);break;
    case 'sun':cy-=42*pulse;angle=t*.32;break;
    case 'bastion':cy-=w*.21;break;
  }
  const el=layer.paint(key,motif,cx,cy,w,t,angle,alpha);
  if((motif==='falcon'||motif==='owl')&&Math.cos(aim)<0)el.style.transform+=' scaleX(-1)';
  el.dataset.spell='cast-'+route;
}
function linked(layer,key,kind,x,y,ex,ey,t,alpha){
  const travel=1-(1-t)**2,dx=ex-x,dy=ey-y;
  const cx=x+dx*travel, cy=y+dy*travel-16;
  if(kind==='arc'||kind==='bolt'){
    if(kind==='arc')layer.paint(key+'/jump','crystal',cx,cy-22*Math.sin(t*Math.PI),30,t,0,alpha);
    layer.paint(key,'thunder',ex,ey-42,kind==='bolt'?128:77,t,0,alpha*Math.min(1,t*8));
  }else if(kind==='siphon'){
    layer.paint(key,'soul',cx,cy-Math.sin(t*Math.PI)*37,48,t,-.18,alpha);
  }else if(kind==='trail'){
    const el=layer.paint(key,'owl',cx,cy-10,101,t,0,alpha);
    if(dx<0)el.style.transform+=' scaleX(-1)';
  }else{
    layer.paint(key,'cleave',cx,cy,91,t,Math.atan2(dy,dx),alpha,39);
  }
}
const impactArt={counter:'bastion',sweep:'cleave',gale:'stone',orbit:'cleave',rockburst:'stone',arrowfall:'volley',
  flame:'flame',ice:'ice',entangle:'roots',nova:'meteor',ward:'bastion',impact:'crystal',
  'enemy-impact':'stone',ring:'sun',upgrade:'sun',cyclone:'cleave'};
function impact(layer,key,kind,x,y,r,aim,t,alpha,route){
  const motif=kind==='pop'?({scout:'arrow',mage:'crystal',staff:'stone'}[route]||'stone'):impactArt[kind];
  if(!motif)return;
  const turns=kind==='sweep'||kind==='cyclone'||kind==='orbit';
  const radius=clamp(r,17,210),rotation=aim+(t-.5)*(kind==='cyclone'?5.6:2.3);
  const reach=turns?radius*(.36+.21*t):0;
  const width=turns?radius*(.85+.42*t):radius*(1.05+.68*t);
  const lift=kind==='ward'?21:kind==='ice'||kind==='rockburst'?width*.21:10;
  layer.paint(key,motif,x+Math.cos(rotation)*reach,y+Math.sin(rotation)*reach*.66-lift,width,t,turns?rotation:0,alpha);
}
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
      const t=clamp(1-life,0,1),key='zone'+id;
      if(kind==='arrowfall'){
        front.paint(key,'volley',x-24*life,y-85*life-14,82,t*.71,-.1,1);
      }else if(kind==='meteor'){
        front.paint(key,'meteor',x-99*life,y-185*life-15,62+30*t,t*.6,0,1);
      }else if(kind==='drop'){
        front.art(key,'supply-crate',x-80*life,y-165*life-10,46,46);
      }else if(kind==='mine'){
        ground.paint(key,'roots',x,y-4,56,Math.min(.49,t*4),0,.86);
      }else if(kind==='field'||kind==='frostfield'){
        ground.paint(key,kind==='field'?'crystal':'ice',x,y-13,r*(1.28+.12*Math.sin(t*12)),t,0,.8);
      }else if(kind==='quake'){
        ground.paint(key,'stone',x,y,r*(.45+.32*t),t*.46,0,.68);
      }
    }
    for(const [id,x,y,angle,,kind,tier=1] of view.shots){
      if(!visible(x,y,100))continue;
      const [px,py]=smooth('s'+id,x,y),key='shot'+id;
      if(kind==='return'){
        front.art(key,'boomerang',px,py-15,36,36,view.t*12);
      }else{
        const fire=kind==='blast',size=kind==='starArrow'?76:fire?61:46+tier*1.4;
        front.paint(key,fire?'flame':'arrow',px,py-18,size,fire?.32:.08,angle,1,size*(fire?.67:.46));
      }
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
    for(const [x,y,r,,strength,kind,x2,y2,label,id,route] of view.fx){
      if(!visible(x,y,650)||strength<=0)continue;
      const t=clamp(1-strength/100,0,1),alpha=Math.min(1,(1-t)*3)*(quiet?.76:1),key='fx'+id;
      if(kind==='number'){if(!quiet)front.label(key,label,x,y-30-t*18,true,alpha);continue;}
      if(kind.startsWith('cast-')){
        cast(front,key,route||kind.slice(5),x,y,r,x2,t,alpha);
      }else if(['arc','bolt','siphon','trail','line','thrust'].includes(kind)){
        linked(front,key,kind,x,y,x2,y2,t,alpha);
      }else{
        impact(kind==='rockburst'||kind==='entangle'?ground:front,key,kind,x,y,r,x2,t,alpha,route);
      }
    }
    for(const [id,x,y,r,amount,critical,age,dir,,family] of view.hits||[]){
      if(!visible(x,y,100))continue;
      const phase=age/550,opacity=clamp((1-phase)*4,0,1);
      if(age<320){
        const size=Math.min(92,30+r*(critical?2.1:1.35));
        const t=clamp(age/320,0,1);
        const motif=family==='slash'?'cleave':family==='wind'?'arrow':'crystal';
        front.paint('hit'+id,motif,x+dir*t*6,y-r*.8-2*t,size*.78,.55+.44*t,0,(1-t)*(quiet?.54:.88));

      }
      front.label('damage'+id,amount,x+dir*(quiet?0:phase*8)+(id%3-1)*4,y-r*1.95-(quiet?3:phase*22),critical,opacity);
    }
    ground.finish();front.finish();
  }
}
