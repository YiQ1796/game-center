import { FIELD } from './content.mjs?v=050';
import { blend, ink, oval, stroke } from './paint.mjs?v=050';
import { orchardSeed, propImage } from './orchard-props.mjs?v=050';

export const ROADS=[
  ['M-90 1250 C320 994 595 1340 960 1114 S1320 924 1570 886 S2225 633 2800 808',83],
  ['M670 -90 C540 325 862 455 997 689 S1080 873 1282 976',52],
  ['M1570 886 C1740 1010 1930 1166 1970 1418 S1790 1760 1850 2000',55]
];
export const LANDMARKS=[
  {kind:'shed',x:1130,y:861,scale:1.05,name:'採果棚'},
  {kind:'mill',x:1554,y:1036,scale:1.04,name:'水車渠'},
  {kind:'post',x:1423,y:907,scale:.92,name:'果園岔路'},
  {kind:'shed',x:641,y:404,scale:.95,name:'北坡果寮'},
  {kind:'mill',x:1954,y:1412,scale:1,name:'南灌渠'}
];
const TILE=384;
const ROAD_SHAPES=()=>ROADS.map(([d,w])=>[new Path2D(d),w]);
const clearings=[[1330,930,117],...LANDMARKS.map(p=>[p.x,p.y,90])];
function makeGrove(){
  const list=LANDMARKS.map(item=>({...item,variant:0}));
  function add(kind,x,y,scale,variant){list.push({kind,x,y,scale,variant});}
  for(let j=0;j<6;j++)for(let i=0;i<9;i++){
    const random=orchardSeed(i,j);
    const cx=i*320+60+random()*150,cy=j*335+82+random()*150;
    const cultivar=Math.floor(random()*3),banana=(i+2*j)%5===1;
    for(let n=0;n<4;n++){
      const x=cx+(random()-.5)*175,y=cy+(random()-.5)*120;
      const size=.70+random()*.53,variant=cultivar+3*Math.floor(random()*3);
      if(x<38||y<40||x>FIELD.width-38||y>FIELD.height-35||clearings.some(([cx,cy,r])=>Math.hypot(x-cx,y-cy)<r))continue;
      if(list.some(p=>Math.abs(p.x-x)<45&&Math.abs(p.y-y)<33))continue;
      add(banana?'banana':'tree',x,y,size,banana?0:variant);
    }
  }
  for(const [x,y,variant] of [[1166,1020,1],[1209,1056,4],[1496,805,0],[1555,783,3]]){
    add('tree',x,y,1.01,variant);
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

function lattice(x,y){
  let h=Math.imul(x,374761393)+Math.imul(y,668265263)|0;
  h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967295;
}
function noise(x,y,span){
  const gx=Math.floor(x/span),gy=Math.floor(y/span);
  const u=x/span-gx,v=y/span-gy,s=u*u*(3-2*u),t=v*v*(3-2*v);
  const a=lattice(gx,gy),b=lattice(gx+1,gy),d=lattice(gx,gy+1),e=lattice(gx+1,gy+1);
  return (a+(b-a)*s)*(1-t)+(d+(e-d)*s)*t;
}
function turf(left,top){
  const size=TILE/3,canvas=document.createElement('canvas');canvas.width=canvas.height=size;
  const c=canvas.getContext('2d'),im=c.createImageData(size,size);
  for(let j=0;j<size;j++)for(let i=0;i<size;i++){
    const x=left+i*3,y=top+j*3;
    const meadow=noise(x,y,220)*.53+noise(x,y,61)*.31+noise(x,y,17)*.16;
    const warm=Math.max(0,(noise(x+270,y-70,137)-.37))*35;
    const grain=(lattice(x,y)-.5)*8,at=(j*size+i)*4;
    im.data[at]=93+meadow*84+warm+grain;
    im.data[at+1]=110+meadow*67+warm*.36+grain;
    im.data[at+2]=72+meadow*42+grain*.7;
    im.data[at+3]=255;
  }
  c.putImageData(im,0,0);return canvas;
}
function canal(c,p){
  c.save();c.translate(p.x,p.y);c.rotate(-.22);
  ink(c,'M-157 -12 Q-105 -29 -38 -18 Q45 -7 115 -20 Q148 -25 165 -32 Q133 -7 91 -2 Q20 9 -48 -4 Q-106 -12 -157 -5Z','#a59a74','#8d896b',2);
  ink(c,'M-148 -10 Q-95 -24 -36 -15 Q49 -4 122 -18 L148 -25 Q96 -4 47 -2 Q15 4 -48 -7 Q-99 -15 -148 -8Z',blend(c,0,-22,0,2,'#668a82','#87a69a','#adc1a4'));
  for(let i=0;i<15;i++){const x=-114+i*15;oval(c,x,-9+5*Math.sin((x+22)/42),4+i%5,.8,'#c3d5b8');}c.restore();
}
function makeTile(col,row,roads){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=TILE;
  const c=canvas.getContext('2d'),left=col*TILE,top=row*TILE;
  c.drawImage(turf(left,top),0,0,TILE,TILE);c.translate(-left,-top);
  for(const [path,width] of roads){
    for(const [extra,color] of [[16,'#92956b68'],[9,'#adab7e'],[3,'#c1b087'],[-5,'#cbb68d'],[-16,'#cfbb96']]){
      c.strokeStyle=color;c.lineWidth=width+extra;c.lineJoin='round';c.stroke(path);
    }
  }
  for(let j=Math.floor(top/18)-1;j<=Math.floor((top+TILE)/18);j++){
    for(let i=Math.floor(left/18)-1;i<=Math.floor((left+TILE)/18);i++){
      const r=orchardSeed(i+90,j-50),x=(i+r())*18,y=(j+r())*18;
      const onRoad=roads.some(([p,w])=>{c.lineWidth=w+4;return c.isPointInStroke(p,x-left,y-top);});
      const pick=r();
      if(onRoad){
        for(let k=0;k<4;k++)oval(c,x+r()*13,y+r()*7,1+r()*2,.5+r()*.65,k===1?'#a28f6d55':'#eee0b13e',-.22);
        if(pick<.09){oval(c,x,y,4,2.1,'#a18d6c');oval(c,x-.4,y-.7,3.4,1.6,'#d6c5a4');}
      }else{
        for(let k=0;k<4;k++){
          const bx=x+r()*13,by=y+r()*7,tall=1.8+r()*3;
          stroke(c,[[bx-1,by-tall*.6],[bx,by],[bx+2,by-tall]],k%2?'#637a4e69':'#c2ca819c',.8+r()*.6);
        }
        if(pick<.043){
          for(let k=0;k<4;k++){
            const px=x+r()*10,py=y+r()*7;
            stroke(c,[[px,py],[px+1,py-4]],'#6b8157',.8);
            oval(c,px,py-4,1.8,1.15,pick<.018?'#eedcb0':'#e5cbcd');oval(c,px+1.4,py-5,1.2,.9,'#f6e7c3');
          }
        }
      }
    }
  }
  // Pale flagstones make the approach to the junction legible on the grass.
  for(const p of LANDMARKS){
    if(Math.abs(p.x-left-TILE/2)<TILE/2+110&&Math.abs(p.y-top-TILE/2)<TILE/2+55&&p.kind!=='mill'){
      const count=p.kind==='post'?5:8;
      for(let i=0;i<count;i++){
        const r=orchardSeed(i,Math.floor(p.x));
        c.save();c.translate(p.x-32+i*12,p.y+16+Math.sin(i*.7)*5);
        c.rotate(-.2+r()*.24);c.scale(.71+r()*.33,.75+r()*.25);
        ink(c,'M-7 -2 L-3 -4 L6 -3 L9 0 L4 3 L-6 2Z','#a79e80','#918b71',.8);
        ink(c,'M-7 -2 L-3 -4 L6 -3 L8 -1 L3 1 L-6 1Z','#cdc3a1');c.restore();
      }
    }
    if(p.kind==='mill'&&p.x+180>left&&p.x-180<left+TILE&&p.y+52>top&&p.y-60<top+TILE)canal(c,p);
  }
  return canvas;
}
// A short battle reaches dusk around its first boss. Co-op uses the host's elapsed time.
export function fieldLight(time){
  const phase=((time%300)+300)%300;
  const ease=(a,b)=>{const f=Math.min(1,Math.max(0,(phase-a)/(b-a)));return f*f*(3-2*f);};
  return {amber:ease(48,85)*(1-ease(94,137))+ease(211,250)*(1-ease(250,291)),
    night:ease(94,155)*(1-ease(215,282))};
}
const nightAtlas=new Map();
function nightImage(prop){
  const key=prop.kind+prop.variant;
  if(!nightAtlas.has(key)){
    const day=propImage(prop.kind,prop.variant),canvas=document.createElement('canvas');canvas.width=day.width;canvas.height=day.height;
    const c=canvas.getContext('2d');c.drawImage(day,0,0);
    c.globalCompositeOperation='source-atop';c.fillStyle='#1c375e99';c.fillRect(0,0,canvas.width,canvas.height);
    nightAtlas.set(key,canvas);
  }
  return nightAtlas.get(key);
}
export class Garden{
  constructor(){this.tiles=new Map();this.roads=ROAD_SHAPES();}
  visible(x,y,w,h){
    return grove.filter(p=>p.x+90*p.scale>=x&&p.x-90*p.scale<=x+w&&p.y+42*p.scale>=y&&p.y-134*p.scale<=y+h);
  }
  draw(c,x,y,w,h,light=fieldLight(0)){
    c.fillStyle='#445641';c.fillRect(x,y,w,h);
    c.save();c.beginPath();c.rect(0,0,FIELD.width,FIELD.height);c.clip();
    const colEnd=Math.min(Math.ceil(FIELD.width/TILE)-1,Math.floor((x+w)/TILE)),rowEnd=Math.min(Math.ceil(FIELD.height/TILE)-1,Math.floor((y+h)/TILE));
    for(let row=Math.max(0,Math.floor(y/TILE));row<=rowEnd;row++)for(let col=Math.max(0,Math.floor(x/TILE));col<=colEnd;col++){
      const key=row*Math.ceil(FIELD.width/TILE)+col;
      if(!this.tiles.has(key)){
        if(this.tiles.size>=32)this.tiles.delete(this.tiles.keys().next().value);
        this.tiles.set(key,makeTile(col,row,this.roads));
      }
      c.drawImage(this.tiles.get(key),col*TILE,row*TILE,TILE+.28,TILE+.28);
    }
    if(light.amber){c.fillStyle='rgba(198,112,58,'+light.amber*.29+')';c.fillRect(x,y,w,h);}
    if(light.night){c.fillStyle='rgba(25,47,84,'+light.night*.62+')';c.fillRect(x,y,w,h);}
    c.restore();
  }
  shadows(c,props,light){
    c.save();
    for(const p of props){
      const s=p.scale,w=p.kind==='post'?11:p.kind==='banana'?33:48;
      oval(c,p.x+(17+light.amber*13)*s,p.y+8*s,w*s,12*s,'#2d42322b',.23);
      oval(c,p.x+12*s,p.y+5*s,w*s*.78,8*s,'#283b3335',.16);
    }
    c.restore();
  }
  prop(c,p,light,players){
    const s=p.scale;
    const behind=players.some(a=>Math.abs(a.x-p.x)<(p.kind==='post'?24:62)*s&&a.y<=p.y+1&&a.y>p.y-116*s);
    c.save();c.translate(p.x,p.y);c.scale(s,s);
    c.globalAlpha=behind?.26:1;
    const day=propImage(p.kind,p.variant);
    // A hidden canopy stays translucent through the night blend as well.
    if(behind){
      c.drawImage(light.night>=.5?nightImage(p):day,-88,-134,176,176);
    }else{
      c.drawImage(day,-88,-134,176,176);
      if(light.night){c.globalAlpha=light.night;c.drawImage(nightImage(p),-88,-134,176,176);}
    }
    if(light.night>.1&&p.kind==='post'){
      c.globalAlpha=light.night;
      const halo=c.createRadialGradient(17,-45,1,17,-45,29);halo.addColorStop(0,'#ffdb8ecc');halo.addColorStop(1,'#ffd37e00');
      c.fillStyle=halo;c.fillRect(-12,-74,58,58);
    }
    c.restore();
  }
}
