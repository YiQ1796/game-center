import { FIELD } from './content.mjs?v=083';
function orchardSeed(x,y){
  let n=(Math.imul(x+139,73856093)^Math.imul(y+61,19349663))>>>0;
  return ()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};
}

// Coordinates follow the painted map. Reserve space on both sides of each lane.
const paths=[
  [[0,214],[65,199],[120,183],[166,189],[208,183],[246,158],[282,135],[337,118],[417,120],[520,109]],
  [[56,0],[71,24],[68,56],[72,83],[112,103],[129,124],[133,146],[118,175]],
  [[393,130],[374,156],[365,191],[380,218],[419,240],[450,252],[478,280],[497,319],[515,347]]
];
function onPath(x,y){
  const px=x/FIELD.width*520,py=y/FIELD.height*347;
  return paths.some((line,index)=>line.slice(1).some(([bx,by],i)=>{
    const [ax,ay]=line[i],dx=bx-ax,dy=by-ay;
    const t=Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/(dx*dx+dy*dy)));
    return Math.hypot(px-ax-t*dx,py-ay-t*dy)<(index===0?23:13);
  }));
}
export const LANDMARKS=[
  {kind:'shed',x:1130,y:861,scale:1.05,name:'採果棚'},
  {kind:'mill',x:1554,y:1036,scale:1.04,name:'水車渠'},
  {kind:'post',x:1423,y:907,scale:.92,name:'果園岔路'},
  {kind:'shed',x:641,y:404,scale:.95,name:'北坡果寮'},
  {kind:'mill',x:1954,y:1412,scale:1,name:'南灌渠'}
];
const clearings=[[1330,930,270],...LANDMARKS.map(p=>[p.x,p.y,90])];
function makeGrove(){
  const list=LANDMARKS.map(item=>({...item,variant:0}));
  function add(kind,x,y,scale,variant){list.push({kind,x,y,scale,variant});}
  for(let j=0;j<6;j++)for(let i=0;i<9;i++){
    const random=orchardSeed(i,j);
    const cx=i*320+60+random()*150,cy=j*335+82+random()*150;
    const cultivar=Math.floor(random()*3),banana=(i+2*j)%5===1;
    for(let n=0;n<2;n++){
      const x=cx+(random()-.5)*175,y=cy+(random()-.5)*120;
      const size=.70+random()*.53,variant=cultivar+3*Math.floor(random()*3);
      if(x<38||y<40||x>FIELD.width-38||y>FIELD.height-35||clearings.some(([cx,cy,r])=>Math.hypot(x-cx,y-cy)<r))continue;
      if(onPath(x,y)||list.some(p=>Math.abs(p.x-x)<76&&Math.abs(p.y-y)<52))continue;
      add(banana?'banana':'tree',x,y,size,banana?0:variant);
    }
  }
  
  for(let x=0;x<FIELD.width+64;x+=77){
    add('tree',x,6+12*Math.sin(x),.94,Math.floor(x/77)%9);
    add('tree',x+24,FIELD.height+38+12*Math.cos(x),.98,Math.floor(x/77)%9);
  }
  for(let y=62;y<FIELD.height;y+=86){
    add('tree',9,y,1,Math.floor(y/86)%9);
    add('tree',FIELD.width+7,y,1.04,Math.floor(y/86)%9);
  }
  return list.sort((a,b)=>a.y-b.y);
}
const grove=makeGrove();

// A short battle reaches dusk around its first boss. Co-op uses the host's elapsed time.
export function fieldLight(time){
  const phase=((time%300)+300)%300;
  const ease=(a,b)=>{const f=Math.min(1,Math.max(0,(phase-a)/(b-a)));return f*f*(3-2*f);};
  return {amber:ease(48,85)*(1-ease(94,137))+ease(211,250)*(1-ease(250,291)),
    night:ease(94,155)*(1-ease(215,282))};
}

const imageRoot=new URL('./art/',import.meta.url);
export class Garden {
  constructor(ground=document.createElement('div')){
    this.ground=ground;
    ground.style.width=FIELD.width+'px';ground.style.height=FIELD.height+'px';
    ground.classList.add('orchard-ground');
    this.tint=document.createElement('span');this.tint.className='ground-tint';ground.append(this.tint);
  }
  visible(x,y,w,h){
    return grove.filter(p=>p.x+90*p.scale>=x&&p.x-90*p.scale<=x+w&&p.y+42*p.scale>=y&&p.y-150*p.scale<=y+h);
  }
  light(light){
    this.tint.style.backgroundColor=light.night>.01?'rgba(24,41,77,'+(light.night*.56)+')':'rgba(190,105,56,'+(light.amber*.25)+')';
  }
  propNode(p){
    const name=p.kind==='tree'?(p.variant%2?'pear-tree':'fruit-tree'):p.kind;
    const el=document.createElement('span'),art=document.createElement('span');
    el.className='world-unit';art.className='scenery-img';
    art.style.backgroundImage='url("'+new URL(name+'.webp',imageRoot).href+'")';
    art.style.transform='scale('+p.scale+')';el.append(art);
    let lamp;
    if(p.kind==='post'){lamp=document.createElement('i');lamp.className='scenery-lamp';art.append(lamp);}
    return {el,update(light,players){
      const behind=players.some(a=>Math.abs(a.x-p.x)<(p.kind==='post'?24:60)*p.scale&&a.y<=p.y+1&&a.y>p.y-118*p.scale);
      art.style.opacity=behind?'.26':'1';
      if(lamp)lamp.style.opacity=light.night.toFixed(2);
    }};
  }
}
