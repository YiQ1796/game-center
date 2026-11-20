import { SOCKETS } from './sockets.mjs?v=070';

// Actors are illustrated transparent image strips. The browser composites their
// frames as DOM sprites in the field, the inventory and the fitting room.
const url=name=>new URL('./art/'+name+'.webp',import.meta.url).href;
const routes={staff:['staff','king','guardian'],mage:['mage','storm','archmage'],scout:['scout','ranger','shadow']};
const gearArt=['staff-rod','leaf-cap','guard-coat','bracer','boots','pendant','ruby-ring','jade-ring'];
const weapons={staff:'staff-rod',king:'king-rod',guardian:'jade-pole',mage:'moon-wand',storm:'storm-wand',archmage:'sun-wand',scout:'shortbow',ranger:'longbow',shadow:'sabres'};
const metals=['#cfb495','#9ed085','#8ac5eb','#d0a1ef','#ffd272','#ff9fad'];
const rarity=code=>metals[Math.max(0,code-1)%6];
const routeFor=(job,track)=>routes[job]?.includes(track)?track:job;
const node=cls=>{const el=document.createElement('span');el.className=cls;return el;};
function style(el,key,value){if(el.style[key]!==value)el.style[key]=value;}
function imageStrip(el,name,frame,count){
  if(el.dataset.sheet!==name){
    el.dataset.sheet=name;el.style.backgroundImage='url("'+url(name)+'")';
    el.style.backgroundSize=(count*100)+'% 100%';
  }
  if(el.dataset.frame!==String(frame)){
    el.dataset.frame=String(frame);
    el.style.backgroundPosition=(frame*100/(count-1))+'% center';
  }
}
const masterWeapons={king:'jade-pole',guardian:'king-rod',storm:'sun-wand',archmage:'storm-wand',ranger:'longbow',shadow:'sabres'};
function weaponFor(route,master){return master&&masterWeapons[route]||weapons[route];}
export function gearIcon(slot,job,promotion,master=false){
  const el=document.createElement('img');el.className='gear-art';
  el.src=url(slot===0?weaponFor(routeFor(job,promotion),master):gearArt[slot]);el.alt='';el.draggable=false;return el;
}
const gaitFrames=[0,1,1,0,0,2,2,0];
export function heroFrame(p){
  const swing=p.down?0:p.look?.swing||0;
  if(swing>0)return swing<18||swing>85?0:3;
  if(!p.walk||p.down)return 0;
  return gaitFrames[Math.floor((p.gait||0)*8/256)%8];
}
// Grip and outer weapon boundary on each 250 by 150 reference pose.
const grips={
  staff:[[126,87,15],[117,87,12],[121,83,13],[157,81,8]],
  mage:[[116,78,52],[113,82,52],[117,76,52],[136,79,19]],
  scout:[[137,89,0],[130,91,0],[129,89,0],[163,71,0]]
};
const trim={
  staff:[[[131,73],[131,94]],[[120,75],[120,97]],[[125,70],[125,90]],[[161,66],[161,89]]],
  mage:[[[121,25],[121,59],[114,72],[123,82]],[[125,28],[122,67],[113,78],[120,87]],[[124,26],[124,61],[117,72],[123,80]],[[147,31],[147,66],[136,76],[145,85]]],
  scout:[[[131,29],[143,62],[136,82],[138,95]],[[137,33],[142,66],[129,86],[134,99]],[[137,33],[141,61],[127,84],[133,98]],[[126,8],[131,32],[143,49],[136,58],[161,62],[161,80],[143,106],[143,119]]]
};
function bodyClip(job,frame){
  const edge=trim[job][frame],percent=([x,y])=>(x*.4)+'% '+(y*2/3)+'%';
  return 'polygon(0 0,100% 0,100% '+(edge[0][1]*2/3)+'%,'+edge.map(percent).join(',')+',100% '+(edge.at(-1)[1]*2/3)+'%,100% 100%,0 100%)';
}
export class HeroSprite{
  constructor(){
    this.el=node('world-unit');this.shadow=node('sprite-shadow');this.body=node('hero-body');
    this.art=node('sprite-art');this.body.append(this.art);
    this.bar=node('sprite-hp');this.fill=node('sprite-hp-fill');this.bar.append(this.fill);
    this.label=node('unit-name');this.el.append(this.shadow,this.body,this.bar,this.label);
    this.dress=node('worn-details');this.body.append(this.dress);this.gearKey='';this.fittings=[];
  }
  update(p,self=true,preview=false){
    const look=p.look||{},slots=look.slots||[],route=routeFor(p.job,p.promotion);
    const frame=heroFrame(p),swing=look.swing||0;
    imageStrip(this.art,p.job,frame,4);
    const face=p.face<0?-1:1;
    const angle=p.down?-65:swing>85?-7:swing>0&&swing<18?3:0;
    const tilt=p.walk&&p.travelY?Math.sign(p.travelY)*1.5:0;
    const phase=(p.gait||0)*Math.PI/128;
    const step=p.walk&&!p.down?Math.sin(phase):0;
    const strike=p.down?0:Math.sin(Math.PI*Math.min(1,swing/100));
    const lunge=strike*({staff:7,mage:-2,scout:-4}[p.job]||0);
    style(this.body,'transform','translate('+ (face*lunge).toFixed(1)+'px,'+(-Math.abs(step)*2.5-(p.job==='mage'?strike*4:0)).toFixed(1)+'px) scaleX('+face+') rotate('+(angle+tilt+step*2+strike*(p.job==='staff'?8:-3)).toFixed(1)+'deg)');
    style(this.body,'opacity',p.inv?'.82':'1');
    const changedWeapon=Boolean(p.promotion||slots[0]);
    style(this.art,'clipPath',changedWeapon?bodyClip(p.job,frame):'none');
    this.el.dataset.tier=p.master?3:p.promotion?2:1;
    const build=[route,Boolean(p.master),...slots,look.level||1,Boolean(look.evolved)].join('/');
    if(build!==this.gearKey){
      this.gearKey=build;this.dress.replaceChildren();this.fittings=[];
      const add=(part,item,code)=>{
        const el=document.createElement('img');el.alt='';el.draggable=false;el.className='worn worn-'+part;
        el.src=url(item);if(code)el.style.filter='drop-shadow(0 0 .6px '+rarity(code)+')';
        this.dress.append(el);this.fittings.push([part,el]);
      };
      if(p.promotion||slots[2])add('armor','guard-coat',slots[2]);
      if(p.master)add('mantle','leaf-cap');
      if(changedWeapon)add('held',weaponFor(route,p.master),slots[0]);
      if(slots[1])add('cap','leaf-cap',slots[1]);
      if(slots[2])add('brooch','coat-clasp',slots[2]);
      if(slots[3])add('wrist','bracer',slots[3]);
      if(slots[4]){add('boot-l','boot-single',slots[4]);add('boot-r','boot-single',slots[4]);}
      if(slots[5])add('neck','pendant',slots[5]);
      if(slots[6])add('ring-l','ruby-ring',slots[6]);
      if(slots[7])add('ring-r','jade-ring',slots[7]);
      const level=look.level||1;
      if(slots[0]||level>1||look.evolved){
        add('weapon',look.evolved?'evolved-jewel':'weapon-jewel',slots[0]);
        const el=this.fittings.at(-1)[1],size=(slots[0]?3:0)+5+Math.min(10,level)*1.25+(look.evolved?6:0);
        el.style.width=size+'px';el.style.height=size+'px';
        el.style.filter='drop-shadow(0 0 '+(look.evolved?3:1)+'px '+(slots[0]?rarity(slots[0]):'#ffde91')+')';
      }
    }
    const anchors=SOCKETS[p.job][frame];
    for(const [part,el] of this.fittings){
      if(part==='held'){
        const [gx,gy,tilt]=grips[p.job][frame],bow=p.job==='scout'&&route!=='shadow';
        style(el,'left',gx*.4+'%');style(el,'top',gy*2/3+'%');
        const size=(bow?46:p.job==='staff'?64:49)*(p.master?1.12:1);
        style(el,'width',size+'px');style(el,'height',size+'px');
        style(el,'transform','translate(-50%,-50%) rotate('+(bow?-35:47-tilt)+'deg)');
        continue;
      }
      const a=ANCHOR_INDEX[part],x=anchors[a*2],y=anchors[a*2+1];
      style(el,'left',x+'%');style(el,'top',y+'%');
    }
    this.bar.hidden=preview||p.down||!p.maxHp;
    if(!this.bar.hidden){style(this.fill,'transform','scaleX('+Math.max(0,Math.min(1,p.hp/p.maxHp))+')');this.bar.dataset.ally=self?'self':'ally';}
    this.label.hidden=preview||(!p.down&&self);
    if(!this.label.hidden)this.label.textContent=p.down?'救援 '+Math.round((p.rev||0)/2.3*100)+'%':p.name;
    this.el.dataset.route=route;this.el.dataset.pose=String(frame);
  }
}
const ANCHOR_INDEX={armor:1,mantle:5,cap:0,brooch:1,wrist:2,'boot-l':3,'boot-r':4,neck:5,'ring-l':6,'ring-r':7,weapon:8};
export class EnemySprite{
  constructor(){
    this.el=node('world-unit');this.shadow=node('sprite-shadow');this.body=node('enemy-body');
    this.art=node('sprite-art');this.body.append(this.art);
    this.bar=node('sprite-hp');this.fill=node('sprite-hp-fill');this.bar.append(this.fill);
    this.el.append(this.shadow,this.body,this.bar);
  }
  update(enemy,time,hit){
    const [id,kind,,,radius,hp,flash,face,wind]=enemy;
    const age=hit?hit[6]:999,stagger=flash||age<210;
    const phase=Math.floor(time*(kind==='bee'||kind==='queen'?10:5)+id)%2;
    const frame=stagger?2:wind?1:phase;
    imageStrip(this.art,kind,frame,3);
    if(this.el.dataset.kind!==kind){
      this.el.dataset.kind=kind;
      this.body.style.setProperty('--foe-width',radius*3.65+'px');
      this.body.style.setProperty('--foe-height',radius*2.83+'px');
      this.shadow.style.width=radius*1.95+'px';
    }
    const recoil=stagger&&hit?Math.max(0,1-age/210)*Math.min(7,radius*.28)*hit[7]:0;
    style(this.body,'transform','translateX('+recoil.toFixed(1)+'px) scaleX('+(face<0?-1:1)+')');
    this.art.classList.toggle('struck',age<100||Boolean(flash&&!hit));this.el.dataset.pose=String(frame);
    this.bar.hidden=!(hit||kind==='boss'||kind==='queen'||kind==='elite');
    if(!this.bar.hidden){style(this.fill,'transform','scaleX('+Math.max(0,hp/100)+')');this.bar.dataset.ally='enemy';}
  }
}
export function outfitSprite(player,look){
  const box=node('look-preview');box.setAttribute('aria-hidden','true');
  const unit=new HeroSprite();unit.el.classList.add('preview-unit');box.append(unit.el);
  unit.update({...player,face:1,look},true,true);return box;
}
