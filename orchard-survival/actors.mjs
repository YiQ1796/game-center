import { deform, drawPose, poseFor } from './pose.mjs?v=040';

import { blend, glow, ink, oval, star, stroke, TAU } from './paint.mjs?v=040';
import { getAdvancement } from './advancement.mjs?v=040';
import { drawAdvancedCostume,drawAdvancedWeapon } from './costumes.mjs?v=040';

const outline='#463c42';
const velvet=(c,light,mid,dark)=>blend(c,-12,-26,11,19,light,mid,dark);
function eye(c,x,y,r=3) {
  oval(c,x,y,r*1.13,r*1.38,'#fff2cf');
  oval(c,x+.6,y+.4,r*.84,r*1.13,'#3e343b');
  oval(c,x+r*.25,y-r*.44,r*.36,r*.36,'#fffdf0');
}
function crown(c,x,y){
  c.save();c.translate(x,y);
  ink(c,'M-14 1 L-18 -12 L-8 -8 L-6 -18 L1 -10 L9 -20 L11 -9 L19 -13 L13 2 Q-2 6 -14 1Z',
    velvet(c,'#fff7aa','#edbc58','#aa6430'),outline,1.4);
  ink(c,'M-13 0 Q1 2 14 -1',null,'#fff3a7',1.5);star(c,0,-4,4,'#cc5964');c.restore();
}
function grub(c,phase) {
  const green=velvet(c,'#fff4a1','#b6c85b','#648950');
  for(let i=0;i<4;i++){
    const x=-16+i*7,y=5+Math.sin(phase+i)*2.6;
    oval(c,x-2,y+9,3,3,'#685a38');
    oval(c,x,y,7.7,8.6,'#64734a');oval(c,x-.3,y-1,7.2,7.6,green);
    oval(c,x-2,y-4,1.9,1.5,'#fff0ab');
  }
  ink(c,'M4 -6 C-10 -8 -12 -17 -10 -20 Q2 -19 7 -8Z','#75a45c','#4e7751',1.1);
  stroke(c,[[7,-8],[7,-17],[11,-20]],'#685a3c',1.6);
  oval(c,9,-2,11,11,outline);oval(c,9,-3,10.1,10.1,green);
  eye(c,13,-4,2.8);oval(c,15,1,3,1.3,'#d99165');ink(c,'M9 2 Q11 6 14 3',null,outline,1.2);
}
function mushroom(c,phase) {
  const bob=Math.sin(phase)*1.4;
  oval(c,-7,14-bob,5,3.5,'#694e50',-.2);oval(c,8,14+bob,5.3,3.3,'#694e50',.2);
  ink(c,'M-8 -4 Q-10 1 -11 10 C-9 20 11 20 13 9 Q8 3 9 -5Z',velvet(c,'#fff5c4','#ebcb8c','#ca9969'),outline,1.7);
  eye(c,1,6,2.1);eye(c,8,5,2);oval(c,-4,9,3,1.3,'#e5a187');
  c.translate(0,bob);
  ink(c,'M-22 0 Q-20 -12 -10 -21 C3 -33 17 -18 20 -10 L24 -2 Q24 6 1 6 Q-14 6 -22 0Z',
    velvet(c,'#ffddac','#e67e79','#a64f64'),outline,1.7);
  ink(c,'M-21 0 Q1 8 23 -2 Q15 8 -1 7 Q-15 6 -21 0Z','#efb8a3','#9e5a62',1);
  for(const [x,y,rx,ry] of [[-12,-9,4,2.6],[-2,-18,5,2.9],[10,-12,3.9,2.8],[16,-5,2.6,1.9],[-2,-6,2.1,1.6]])
    oval(c,x,y,rx,ry,'#fff0c9',-.23);
}
function boar(c,phase,royal=false){
  const mane=royal?'#814c58':'#844f49';
  for(let i=0;i<4;i++){
    const x=-14+i*8,step=Math.sin(phase+(i%2)*Math.PI)*2.5;
    oval(c,x+step,12,3.8,6.8,'#643e3d',-.12);oval(c,x+step+1,17,3.8,2.4,outline);
  }
  ink(c,'M-16 -9 L-24 -5 L-20 -15 L-24 -17 L-11 -19 L-14 -25 Q1 -25 7 -16 Q19 -17 22 -4 Q24 13 9 15 L-9 14 Q-24 10 -22 0Z',
    velvet(c,royal?'#f3b56e':'#f7c091',royal?'#b16a51':'#c7805e',mane),outline,1.8);
  ink(c,'M-19 -7 Q-31 -10 -26 -17 Q-21 -22 -21 -16 Q-21 -13 -25 -14',null,mane,2.4);
  ink(c,'M-9 -14 Q-16 -24 -12 -28 Q-2 -25 2 -15Z',mane,outline,1.3);
  ink(c,'M-10 -23 L-7 -17 L-3 -17Z','#e5a18a');
  oval(c,14,1,9.8,8,'#9a5a52');oval(c,15,.1,9,6.8,'#e7a17d');
  oval(c,18,0,1.3,2.1,outline);oval(c,21,-1,1,1.8,outline);
  eye(c,6,-6,2.8);ink(c,'M1 -11 L9 -8',null,mane,2.6);
  ink(c,'M9 8 Q15 9 16 0 Q20 11 12 13Z','#fff0c2','#765d54',1);
  for(let i=0;i<4;i++)stroke(c,[[-15+i*4,-9],[-18+i*4,-4]],'#e7a478',1.5);
  if(royal){crown(c,-1,-22);ink(c,'M-20 -7 L-12 -11 L-4 10 L-15 12Z','#634f78','#f2bc65',1.2);}
}
function wasp(c,phase,royal=false){
  const lift=Math.sin(phase)*4;
  c.save();c.translate(0,-6);c.rotate(-.25+lift*.045);
  ink(c,'M0 2 C-29 -4 -31 -24 -18 -21 Q-6 -19 0 2Z','#e6f1dfdc','#83a59f',1.2);
  ink(c,'M-2 1 C-5 -14 3 -30 11 -26 Q19 -17 -2 1Z','#faf4e0e6','#81a59b',1.2);
  ink(c,'M-3 -1 L-20 -17 M0 -2 L10 -21',null,'#a5c8ba',.85);c.restore();
  ink(c,'M-19 3 L-30 8 L-18 -2Z','#473943');
  ink(c,'M-23 2 C-22 -11 -7 -17 6 -10 C21 -8 24 6 12 13 C-2 19 -20 16 -23 2Z',
    velvet(c,royal?'#ffe0ef':'#fff08d',royal?'#dd90bb':'#f4b84f',royal?'#9a5788':'#a4673b'),outline,1.8);
  ink(c,'M-14 -8 Q-19 3 -10 14 L-4 15 Q-14 4 -8 -11Z M-2 -12 Q-9 0 -1 14 L5 13 Q-3 1 3 -11Z',
    royal?'#753d68':'#714a43');
  stroke(c,[[9,-8],[10,-18],[15,-20]],outline,1.5);
  eye(c,13,-2,3.6);oval(c,16,5,2.6,1.5,'#d88b6c');
  for(let i=0;i<3;i++)stroke(c,[[-12+i*7,12],[-15+i*7,17+Math.sin(phase+i)*2]],outline,1.5);
  if(royal){crown(c,7,-13);star(c,-10,0,5,'#ffec95');}
}
function snail(c,phase){
  ink(c,'M-25 11 Q-16 9 -7 7 Q4 8 9 -3 Q20 -9 22 1 Q20 9 23 12 Q12 19 -14 17Z',
    velvet(c,'#fff2af','#b6ca78','#819955'),outline,1.4);
  oval(c,-6,0,14,15,outline);oval(c,-6,-1,13.3,14,velvet(c,'#ffd38b','#d48764','#975968'));
  ink(c,'M-17 3 C-22 -13 -1 -18 5 -5 C10 8 -7 14 -12 5 C-17 -4 -4 -10 -2 -3 Q0 3 -6 3',
    null,'#995d58',2.6);
  for(const [x,h] of [[13,13],[19,17]]){const swing=Math.sin(phase)*1.2;stroke(c,[[x,0],[x+swing,-h]],'#78864c',2.1);eye(c,x+swing,-h,2);}
}
function trickster(c,phase){
  c.save();c.scale(1.02,1.07);mushroom(c,phase);c.restore();
  ink(c,'M-18 -2 L-26 -13 L-20 -20 L-10 -8Z M14 -9 L21 -22 L27 -19 L21 -1Z',
    velvet(c,'#fff4b3','#e6a757','#98605b'),outline,1.3);
  ink(c,'M-9 4 Q0 1 12 1 L10 8 L1 9 L-7 8Z','#6c4962');eye(c,7,5,1.9);
  star(c,-9,-12,5.8,'#ffe270');crown(c,0,-19);
}
const atlas=new Map();
function frameFor(kind,pose){
  const key=kind+pose;
  if(atlas.has(key))return atlas.get(key);
  const canvas=document.createElement('canvas');canvas.width=canvas.height=160;
  const c=canvas.getContext('2d');c.translate(80,91);c.scale(2,2);
  const phase=pose/6*TAU;
  if(kind==='grub')grub(c,phase);
  if(kind==='shroom')mushroom(c,phase);
  if(kind==='boar'||kind==='boss')boar(c,phase,kind==='boss');
  if(kind==='bee'||kind==='queen')wasp(c,phase,kind==='queen');
  if(kind==='snail')snail(c,phase);
  if(kind==='elite')trickster(c,phase);
  atlas.set(key,canvas);return canvas;
}
export function creature(c,enemy,t,x,y){
  const [id,kind,,,r,hp,hit,face,wind]=enemy;
  const scale=r/(kind==='grub'?15:21);
  const phase=t*(kind==='snail'?5:kind==='bee'||kind==='queen'?16:9)+id;
  const bounce=Math.sin(phase)*(kind==='shroom'?3.3:1.5)*scale;
  oval(c,x,y+8*scale,17*scale,5.4*scale,'#314d4566');
  c.save();c.translate(x,y+bounce);c.scale(face*scale,scale);
  if(wind)c.rotate(-.11);
  c.drawImage(frameFor(kind,Math.floor(phase*1.4)%6),-40,-45.5,80,80);
  if(hit) {star(c,7,-4,11,'#fff8cd',.4);star(c,-11,3,5,'#fff4ae');}
  c.restore();
  if(['elite','boss','queen'].includes(kind)){
    const width=r*2.4,py=y-r*2.25;
    c.fillStyle='#45383b';c.fillRect(x-width/2-1,py-1,width+2,6);
    c.fillStyle='#e68b56';c.fillRect(x-width/2,py,width*hp/100,4);
  }
}

const gearColors=['#c0a47b','#aecb77','#83c4ed','#d4a1ed','#ffba5e','#ff90a6'];
const jobCloth={staff:['#b75136','#fbcb68'],mage:['#624779','#dca8ff'],scout:['#2d7265','#a4e4b4']};
function weapon(c,job,look,t,face,promotion,pose){
  const level=look.level||1,evo=look.evolved;
  const gear=look.slots[0],trim=gear?gearColors[(gear-1)%6]:'#f4c568';
  const rank=gear?Math.floor((gear-1)/6):0;
  const swing=Math.sin((look.swing||0)/100*Math.PI);
  const hand=deform(11,-8,pose);
  c.save();c.translate(...hand);
  // 進階職業改用專屬武器形體，禁止疊上舊的通用武器。
  const aim=look.aim||0;
  const localAngle=Math.atan2(Math.sin(aim),Math.cos(aim)*face);
  if(job==='staff')c.rotate(.22+pose.a*1.65);
  else if(job==='mage')c.rotate(.43+swing*Math.atan2(Math.sin(localAngle+1.15),Math.cos(localAngle+1.15)));
  else c.rotate(.05+swing*localAngle);
  if(promotion){drawAdvancedWeapon(c,job,promotion,look,t);c.restore();return;}
  const size=1+(level-1)*.07+(evo?.18:0)+rank*.025;
  c.scale(size,size);
  if(job==='scout'){
    ink(c,'M1 -25 Q24 -18 13 -8 Q8 0 12 8 Q22 19 0 26 L3 21 Q13 16 7 11 Q-1 0 8 -13 Q14 -18 3 -21Z',
      velvet(c,'#efe2aa','#ba9453','#725742'),outline,1.1);
    stroke(c,[[1,-25],[-3-swing*7,0],[0,26]],'#f3eed1',.95);
    stroke(c,[[-6,0],[21,0]],'#684c36',1.6);ink(c,'M17 -3 L26 0 L17 3Z',trim);
  } else {
    ink(c,'M-2 16 L-2 -32 Q0 -35 2 -32 L2 16 Q0 19 -2 16Z',
      blend(c,-2,0,2,0,'#684332',job==='staff'?'#da6543':'#ad8757','#794837'),outline,.9);
    for(const y of [-28,-24,9,13]){c.fillStyle=trim;c.fillRect(-3,y,6,2.4);}
    if(job==='mage'){
      ink(c,'M0 -27 Q-12 -33 -8 -42 L-4 -36 L0 -38 L5 -42 L8 -44 Q12 -33 0 -27Z',trim,outline,1);
      glow(c,0,-39,11+level*.9,'#f7c8ffad','#ca83ff00');
      ink(c,'M0 -49 L5 -41 L2 -34 L-4 -37 L-5 -43Z',velvet(c,'#fff1c4','#d090ef','#8354c1'),'#5c5074',1);
      ink(c,'M0 -48 L1 -39 L-4 -42Z','#fff3d8');
    }
  }
  if(level>=2) {
    const anchor=job==='scout'?12:0;
    c.save();c.translate(anchor,job==='scout'?12:-17);
    ink(c,'M-6 -1 L-3 -3 L0 -2 L3 -4 L6 -3 L4 0 L-4 2Z',trim,outline,.7);c.restore();
  }
  if(level>=5){
    c.save();c.translate(job==='scout'?2:0,job==='scout'?22:-29);
    ink(c,'M-2 1 Q-12 -2 -11 -11 L-5 -7 L-7 -14 Q-1 -12 1 -4 Q5 -14 10 -15 L8 -8 L13 -11 Q12 -3 2 2Z',evo?'#98f2dc':trim,outline,.85);
    c.restore();
  }
  if(evo){
    c.save();c.translate(job==='scout'?3:0,job==='scout'?-23:-36);
    glow(c,0,0,17,'#fff1ad9f','#ffe9aa00');
    ink(c,'M-16 -14 Q-16 2 0 5 Q14 1 17 -16 L10 -10 L12 -19 L6 -13 Q5 -3 0 0 Q-5 -2 -7 -12 L-14 -20 L-10 -9Z','#ebfbcb','#969f69',.95);
    c.restore();
  }
  for(let i=1;i<level;i++){
    const py=job==='scout'?-9-i*3:-10-i*3;
    c.fillStyle=i%2?trim:'#fff1b1';c.fillRect(job==='scout'?9:-3,py,job==='scout'?5:6,1.6);
  }
  if(level>=3||gear){
    ink(c,job==='scout'?'M8 -11 Q0 -20 -8 -19 Q-5 -15 7 -8Z':'M-2 -23 Q-11 -27 -15 -22 Q-11 -20 -17 -18 Q-6 -17 1 -22Z',
      jobCloth[job][0],trim,.7);
  }
  if(level>=4||evo){
    ink(c,job==='scout'?'M4 -23 L-4 -32 L7 -28 L12 -20Z':'M-2 -31 L-11 -40 L-8 -29 L0 -24 L9 -32 L11 -40 L3 -33Z',trim,outline,.85);
  }
  if(evo||rank>=2){for(let i=0;i<3;i++)star(c,Math.sin(t*2+i*2)*10,-27-i*4,2.4+Math.sin(t*3+i)*.9,'#fff8c4',t*.5);}
  c.restore();
}
export function adventurer(c,p,sprite,t,x,y,self){
  const {face,walk,down,job}=p;
  const look=p.look||{level:1,slots:Array(8).fill(0)};
  const worn=look.slots;
  const [cloth,accent]=jobCloth[job]||jobCloth.staff;
  const tint=i=>worn[i]?gearColors[(worn[i]-1)%6]:accent;
  const promotion=getAdvancement(job,p.promotion);
  const pose=poseFor(p,t);
  oval(c,x+1,y+9,20+(walk?Math.abs(pose.stride)*2:0),5.5,'#304c435c');
  c.save();c.translate(x,y);c.scale(face,1);
  if(down){c.translate(-5,4);c.rotate(-1.05);c.scale(1,.87);}
  if(p.inv&&Math.floor(t*8)%2===0)c.globalAlpha=.79;
  const loaded=Boolean(sprite.complete&&sprite.naturalWidth);
  const skinKey=[sprite.currentSrc||sprite.src,loaded,job,p.promotion||'',worn.join(',')].join('|');
  drawPose(c,skinKey,pose,c=>{
  if(!promotion&&(job==='mage'||worn[2])){
    ink(c,'M-10 -29 Q-18 -19 -22 6 Q-12 11 -2 4 L8 -21Z',velvet(c,accent,cloth,'#4a414b'),outline,1.15);
    ink(c,'M-11 -21 Q-16 -8 -18 4',null,accent,1.2);
  }
  if(!promotion&&job==='scout'){
    ink(c,'M-16 -17 L-23 -37 L-16 -39 L-8 -21Z','#977455',outline,1.2);
    ink(c,'M-22 -32 L-28 -40 L-22 -39 L-19 -45 L-18 -35Z','#9ac8a4',outline,.9);
  }
  if(sprite.complete&&sprite.naturalWidth){
    const height=77,w=height*sprite.naturalWidth/sprite.naturalHeight;
    c.drawImage(sprite,-w/2,10-height,w,height);
  }
  // 全套職業服裝以永久角色造型取代舊披肩 + 粒子效果。
  if(promotion)drawAdvancedCostume(c,job,p.promotion,look,t);
  if(!promotion){
  if(worn[2]){
    ink(c,'M-10 -26 L-16 -22 L-13 -15 L-10 -16 L-10 -1 Q1 4 11 -2 L10 -18 L15 -15 L16 -23 L9 -27 Q0 -21 -10 -26Z',
      velvet(c,tint(2),cloth,'#51414a'),outline,1);
    stroke(c,[[0,-22],[0,-3]],accent,1);oval(c,2,-12,1.2,1.2,'#ffda81');
  }
  ink(c,'M-13 -28 Q0 -22 12 -29 L12 -24 Q4 -17 -4 -20 L-11 -13 L-10 -23Z',cloth,outline,1);
  ink(c,'M-11 -26 Q1 -21 10 -26',null,accent,1);star(c,3,-23,3.7,accent);
  if(job==='staff')ink(c,'M-13 -23 Q-8 -30 -5 -23 L-7 -19 L-14 -18Z',accent,outline,1.1);
  if(worn[1]){
    ink(c,'M-17 -53 Q-17 -67 -4 -69 Q8 -70 15 -57 L21 -55 Q8 -50 -18 -53Z',velvet(c,tint(1),'#9fa867','#6b794e'),outline,1.2);
    ink(c,'M-14 -57 Q1 -54 13 -57',null,cloth,2);star(c,10,-59,3,accent);
  }else if(job==='mage'){
    ink(c,'M-17 -55 Q-12 -61 -10 -68 L-5 -62 L0 -70 L4 -59 L9 -54Z',cloth,outline,1.1);
    stroke(c,[[-16,-56],[-7,-54],[8,-55]],accent,1.4);
  }else if(job==='scout'){
    ink(c,'M-14 -53 Q-23 -61 -20 -69 Q-10 -66 -10 -54Z','#6ca67b','#4c715c',1.1);
  }
  if(worn[4])for(const px of [-8,8]){oval(c,px,6,6.3,3.4,cloth);stroke(c,[[px-3,4],[px+2,4]],tint(4),1.6);}
  if(worn[5]){ink(c,'M-7 -22 Q-2 -10 7 -22',null,'#f7cf83',1.3);star(c,0,-14,3.8,tint(5));}
  }
  });
  weapon(c,job,look,t,face,p.promotion,pose);
  // Fingers and worn jewelry sit in front of the grip, including after advancement.
  for(const [slot,px] of [[6,-15],[7,11]]){
    const [hx,hy]=deform(px,slot===7?-8:-7,pose);
    if(slot===7){
      oval(c,hx,hy,2.7,2.1,'#dcbb8f');
      if(worn[3]){oval(c,hx,hy,4.1,3.4,cloth);stroke(c,[[hx-2,hy-1],[hx+2,hy-1]],tint(3),1.3);}
    }
    if(worn[slot]){
      oval(c,hx,hy+1,3.5,2.8,'#c38b42');
      star(c,hx,hy+.4,3.1,tint(slot));
    }
  }
  c.restore();
  if(!self||down){
    c.font='bold 12px system-ui';c.textAlign='center';c.lineWidth=3;c.strokeStyle='#374c39';c.fillStyle='#fff2bf';
    const label=down?'救援 '+Math.round(p.rev/2.3*100)+'%':p.name;
    c.strokeText(label,x,y+27);c.fillText(label,x,y+27);
  }
}
