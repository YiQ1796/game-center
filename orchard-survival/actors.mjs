// Actors are illustrated transparent image strips. The browser composites their
// frames as DOM sprites in the field, the inventory and the fitting room.
const url=name=>new URL('./art/'+name+'.webp',import.meta.url).href;
const routes={staff:['staff','king','guardian'],mage:['mage','storm','archmage'],scout:['scout','ranger','shadow']};
const gearArt=['staff-rod','leaf-cap','guard-coat','bracer','boots','pendant','ruby-ring','jade-ring'];
const weapons={staff:'staff-rod',king:'king-rod',guardian:'jade-pole',mage:'moon-wand',storm:'storm-wand',archmage:'sun-wand',scout:'shortbow',ranger:'longbow',shadow:'longbow'};
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
export function gearIcon(slot,job,promotion){
  const el=document.createElement('img');el.className='gear-art';
  el.src=url(slot===0?weapons[routeFor(job,promotion)]:gearArt[slot]);el.alt='';el.draggable=false;return el;
}
const gaitFrames=[0,1,1,0,0,2,2,0];
export function heroFrame(p){
  const swing=p.down?0:p.look?.swing||0;
  if(!p.down&&p.look?.ready)return 4;
  if(swing>48)return 3;
  if(swing>0)return 5;
  if(!p.walk||p.down)return 0;
  return gaitFrames[Math.floor((p.gait||0)*8/256)%8];
}
export class HeroSprite{
  constructor(){
    this.el=node('world-unit');this.shadow=node('sprite-shadow');this.body=node('hero-body');
    this.art=node('sprite-art');this.body.append(this.art);
    this.bar=node('sprite-hp');this.fill=node('sprite-hp-fill');this.bar.append(this.fill);
    this.label=node('unit-name');this.el.append(this.shadow,this.body,this.bar,this.label);
  }
  update(p,self=true,preview=false){
    const look=p.look||{},route=routeFor(p.job,p.promotion);
    const frame=heroFrame(p),swing=look.swing||0;
    const tier=route===p.job?1:p.master?3:2;
    const sheet=tier===1?route+'-poses1':route+'-regalia'+tier;
    imageStrip(this.art,sheet,frame,6);
    this.el.dataset.tier=tier;
    const face=p.face<0?-1:1;
    const angle=p.down?-65:look.ready?-5:swing>0&&swing<18?3:0;
    const tilt=p.walk&&p.travelY?Math.sign(p.travelY)*1.5:0;
    const phase=(p.gait||0)*Math.PI/128;
    const step=p.walk&&!p.down?Math.sin(phase):0;
    const strike=p.down?0:Math.sin(Math.PI*Math.min(1,swing/100));
    const lunge=strike*({staff:7,mage:-2,scout:-4}[p.job]||0);
    style(this.body,'transform','translate('+ (face*lunge).toFixed(1)+'px,'+(-Math.abs(step)*2.5-(p.job==='mage'?strike*4:0)).toFixed(1)+'px) scaleX('+face+') rotate('+(angle+tilt+step*2+strike*(p.job==='staff'?8:-3)).toFixed(1)+'deg)');
    style(this.body,'opacity',p.inv?'.82':'1');
    this.bar.hidden=preview||p.down||!p.maxHp;
    if(!this.bar.hidden){style(this.fill,'transform','scaleX('+Math.max(0,Math.min(1,p.hp/p.maxHp))+')');this.bar.dataset.ally=self?'self':'ally';}
    this.label.hidden=preview||(!p.down&&self);
    if(!this.label.hidden)this.label.textContent=p.down?'救援 '+Math.round((p.rev||0)/2.3*100)+'%':p.name;
    this.el.dataset.route=route;this.el.dataset.pose=String(frame);
  }
}
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
