import { blend, ink, oval, star, stroke } from './paint.mjs?v=041';
import { getAdvancement } from './advancement.mjs?v=041';

// Costume is permanent illustrated character geometry, not a short-lived particle or filter.
// Each advanced job has its own silhouette: hat, shoulders, chest, skirt, boots and weapon.
const rim='#4e3a3c';
const palette={
  king:['#e6b54d','#fff0a9','#9b343a','#762f32'],
  guardian:['#509b7b','#c1e7a5','#315f53','#304b42'],
  storm:['#8761bf','#e2c2ff','#49396c','#392e5e'],
  archmage:['#e6c17a','#fff4d5','#8c667c','#65526e'],
  ranger:['#6b9867','#d6da8d','#52614c','#51503f'],
  shadow:['#536779','#c7dbe1','#31384f','#333649']
};
const cloth=(c,colors)=>blend(c,-18,-35,18,8,colors[1],colors[0],colors[2]);
const trim=(c,path,color,width=1.5)=>ink(c,path,null,color,width);
function crown(c,colors,crest) {
  ink(c,'M-16 -56 L-17 -65 L-11 -63 L-7 -72 L0 -65 L7 -74 L11 -63 L18 -67 L16 -56 Q0 -51 -16 -56Z',
    cloth(c,colors),rim,1.5);
  ink(c,'M-15 -58 Q0 -54 15 -58',null,colors[1],2);
  oval(c,0,-61,3.8,5,crest);star(c,0,-62,2.7,'#fff9ca');
}
function circlet(c,colors,crest) {
  ink(c,'M-18 -56 Q0 -63 17 -56 L16 -52 Q0 -58 -17 -52Z',colors[0],rim,1.2);
  ink(c,'M-14 -55 Q0 -60 13 -55',null,colors[1],1.6);
  oval(c,0,-56,4.1,3.4,crest);
}
function hood(c,colors,tip=false){
  ink(c,tip?'M-19 -49 Q-29 -64 -12 -75 L-5 -69 Q3 -79 16 -66 L22 -55 L19 -48 Q10 -53 6 -59 Q-7 -60 -18 -50Z':
    'M-19 -50 Q-27 -66 -13 -73 Q6 -81 18 -66 L23 -48 L15 -51 Q10 -60 0 -60 Q-9 -60 -17 -50Z',
    cloth(c,colors),rim,1.7);
  trim(c,'M-17 -52 Q-7 -62 3 -61 Q14 -60 18 -52',colors[1],2.4);
}
function boot(c,x,colors,high=false){
  ink(c,`M${x-5} ${high?-7:0} Q${x-1} 0 ${x+5} ${high?-7:0} L${x+6} 7 Q${x+12} 14 ${x+5} 14 L${x-8} 12 Q${x-10} 8 ${x-5} ${high?-7:0}Z`,
    colors[2],rim,1.1);
  stroke(c,[[x-5,5],[x+5,6]],colors[1],1.3);
  oval(c,x+2,9,2,1,colors[0]);
}
function coat(c,colors,length=12,width=16){
  ink(c,`M-13 -29 Q-21 -21 -${width+2} -9 L-${width} ${length} Q-1 ${length+5} ${width} ${length} L${width+1} -11 Q22 -23 11 -29 Q0 -22 -13 -29Z`,
    cloth(c,colors),rim,1.35);
  ink(c,`M-5 -25 L-3 ${length+2} L4 ${length+2} L5 -26Z`,colors[2],colors[1],.9);
  stroke(c,[[-14,-14],[-8,-9],[8,-9],[14,-14]],colors[1],2);
  oval(c,0,-21,3,3.5,colors[1]);star(c,0,-21,2,colors[0]);
}
function shoulders(c,colors,wide=false){
  const widen=wide?7:0;
  for(const side of [-1,1]){
    c.save();c.scale(side,1);
    ink(c,`M8 -27 Q${21+widen} -33 ${25+widen} -20 L${21+widen} -9 L11 -13Z`,
      cloth(c,colors),rim,1.5);
    ink(c,`M12 -25 Q${21+widen} -28 ${23+widen} -19`,null,colors[1],2.4);
    oval(c,19+widen/2,-20,3.5,2.8,colors[0]);
    c.restore();
  }
}
function quiver(c,colors){
  c.save();c.rotate(-.2);
  ink(c,'M-30 -40 Q-26 -47 -21 -43 L-19 -14 L-27 -11Z',colors[3],rim,1.2);
  for(let i=0;i<4;i++){
    stroke(c,[[-26+i*2,-37],[-26+i*2,-55]],colors[1],1.5);
    ink(c,`M${-28+i*2} -53 L${-26+i*2} -60 L${-23+i*2} -53Z`,i%2?colors[0]:colors[2]);
  }
  c.restore();
}
function shield(c,colors){
  ink(c,'M-27 -28 L-8 -31 L-6 -8 Q-17 8 -29 -5Z',cloth(c,colors),rim,1.8);
  ink(c,'M-23 -24 L-12 -26 L-12 -10 Q-17 -2 -23 -10Z',colors[2],colors[1],1.4);
  star(c,-17,-15,5,colors[1]);
}
export function drawAdvancedCostume(c,job,advancement,look,t){
  const track=getAdvancement(job,advancement);
  if(!track)return false;
  const colors=palette[track.id];
  const tier=look?.slots?.[2] ? Math.min(4,(look.slots[2]%6)+1) : 0;
  const shine=tier?colors[1]:'#f0d6a8';
  c.save();
  if(track.id==='king'){
    ink(c,'M-16 -25 Q-27 -24 -28 8 L-19 7 L-10 -19Z M14 -24 Q30 -23 29 10 L20 7 L9 -19Z',
      '#9d3b4c',rim,1.3);
    coat(c,colors,9,15);shoulders(c,colors,true);crown(c,colors,'#de6873');
    ink(c,'M-13 -16 L0 -7 L13 -16 L11 -8 L0 1 L-11 -8Z',colors[3],colors[1],1.2);
    star(c,0,-14,6,'#ffeaaa');
  } else if(track.id==='guardian'){
    ink(c,'M-13 -29 Q-28 -11 -24 13 L-6 7 L9 11 L24 14 Q25 -18 12 -30Z','#2a574f',rim,1.4);
    coat(c,colors,13,19);shoulders(c,colors,true);hood(c,colors);
    shield(c,colors);
    ink(c,'M-13 -24 L0 -18 L13 -24 M-12 -15 Q0 -9 12 -15',null,colors[1],2.5);
  } else if(track.id==='storm'){
    ink(c,'M-14 -28 Q-28 -19 -30 16 L-14 6 L-6 10 L0 -21 L10 8 L24 15 Q22 -14 13 -29Z',colors[3],rim,1.5);
    coat(c,colors,6,15);shoulders(c,colors);hood(c,colors,true);
    ink(c,'M2 -27 L-5 -14 L4 -14 L-3 1 L12 -18 L3 -18 L9 -27Z','#fcf4db','#bf9cff',1.3);
    for(const side of [-1,1])star(c,side*20,-17,3.4,colors[1],t*.3);
  } else if(track.id==='archmage'){
    ink(c,'M-15 -25 Q-28 -19 -26 14 Q-17 12 -13 8 Q1 18 17 8 Q22 16 26 12 Q25 -18 12 -27Z',
      '#fcf0cf',rim,1.2);
    coat(c,colors,7,15);shoulders(c,colors);
    ink(c,'M-21 -56 Q-15 -76 -4 -75 L7 -84 L12 -75 L20 -57 Q0 -49 -21 -56Z',
      cloth(c,colors),rim,1.5);
    ink(c,'M-17 -57 Q0 -51 17 -57',null,'#fffde5',2);
    oval(c,2,-68,4.8,6,'#e9a86f');star(c,2,-68,3,'#fff4c2');
    ink(c,'M-13 -20 Q-6 -12 0 -10 Q5 -13 14 -21',null,colors[1],2.5);
  } else if(track.id==='ranger'){
    quiver(c,colors);coat(c,colors,4,12);shoulders(c,colors);hood(c,colors);
    ink(c,'M-12 -16 L-2 -5 L5 -19 L14 -13 L3 4 L-3 4Z',colors[3],colors[1],1);
    for(let i=0;i<3;i++)oval(c,-13,-18+i*7,2,2,shine);
  } else if(track.id==='shadow'){
    ink(c,'M-16 -29 Q-30 -20 -29 10 L-14 3 L-7 10 L0 -18 L10 8 L27 5 L21 -27Z',colors[3],rim,1.5);
    coat(c,colors,5,13);shoulders(c,colors);hood(c,colors,true);
    ink(c,'M-17 -49 Q0 -43 17 -49 L16 -44 Q0 -39 -16 -44Z',colors[3],colors[1],1.4);
    trim(c,'M-11 -20 L2 -10 L13 -20 M-11 -13 L2 -3 L13 -13',colors[1],1.5);
  }
  boot(c,-9,colors,track.id==='guardian'||track.id==='king');
  boot(c,10,colors,track.id==='guardian'||track.id==='king');
  if(tier) {oval(c,0,-21,2+tier*.3,2+tier*.3,shine);star(c,0,-21,2,colors[1]);}
  c.restore();
  return true;
}

export function drawAdvancedWeapon(c,job,advancement,look,t) {
  const track=getAdvancement(job,advancement);
  if(!track)return false;
  const colors=palette[track.id];
  const level=Math.max(1,Math.min(10,look?.level||1));
  const lift=Math.sin(t*5)*.5;
  c.save();c.rotate(Math.sin(t*3)*.045);
  if(job==='staff'){
    ink(c,'M-2 25 L-3 -38 Q0 -42 3 -38 L3 25 Q1 27 -2 25Z',
      blend(c,-3,0,3,0,'#4c3235','#c98e57','#4c343d'),rim,1.6);
    for(let y=-31;y<=18;y+=7)ink(c,`M-3 ${y} L3 ${y+1} L3 ${y+4} L-3 ${y+3}Z`,colors[0]);
    if(track.id==='king'){
      for(const side of [-1,1]){
        c.save();c.scale(side,1);
        ink(c,'M0 -34 Q7 -45 5 -53 L13 -57 L14 -44 L7 -37 Q13 -33 15 -22 L6 -26 L0 -33Z',
          colors[0],rim,1.4);c.restore();
      }
      oval(c,0,-37,7,9,'#f3c465');
      star(c,0,-39,5,'#fff0af');
    } else {
      ink(c,'M0 -35 L-8 -47 L0 -55 L8 -47Z',colors[2],colors[1],2);
      oval(c,0,-47,5+level*.12,7,colors[1]);star(c,0,-47,4,'#fff3cd');
      ink(c,'M-8 18 Q-16 10 -16 4 L-10 2 L-9 10 L-3 13Z',colors[0],rim,1.3);
    }
  }else if(job==='mage'){
    ink(c,'M-3 22 L-2 -31 Q0 -35 3 -31 L3 22 Q1 26 -3 22Z',
      colors[3],rim,1.1);
    for(let y=-26;y<=13;y+=8)oval(c,0,y,1.7,1.7,colors[1]);
    if(track.id==='storm'){
      ink(c,'M0 -32 Q-25 -41 -10 -57 L-3 -44 L6 -59 Q24 -46 4 -32Z',
        colors[0],colors[1],1.7);
      ink(c,'M4 -60 L-6 -43 L2 -42 L-8 -27 L12 -47 L4 -47Z','#faf4dc','#c0a0ff',1);
      oval(c,0,-45,3+level*.18,5+level*.13,'#fff2b7');
    }else{
      ink(c,'M0 -55 A18 18 0 1 0 13 -45 Q-1 -43 2 -60Z',colors[0],rim,1.2);
      oval(c,1,-43,9,10,colors[1]);oval(c,0,-43,6,7,colors[2]);
      star(c,0,-43,5,'#fff4d1',t*.6);
      for(const x of [-8,8])star(c,x,-51,2.1,colors[1]);
    }
  } else if(track.id==='ranger'){
    ink(c,'M-1 -36 Q30 -25 17 0 Q27 23 -1 35 L-4 29 Q18 18 10 5 Q-4 -13 17 -27 Q7 -29 -4 -31Z',
      colors[3],rim,2);
    const phase=(look.swing||0)/100;
    const draw=phase>.55?(1-phase)/.45:phase/.55;
    const notch=-5-15*draw;
    stroke(c,[[-1,-34],[notch,0],[-1,34]],'#f7f3d2',1.5);
    c.save();c.translate(-12*draw,0);
    ink(c,'M-10 -4 L33 -4 L26 -10 L39 -3 L26 3 L33 -2 L-10 0Z',colors[1],rim,.7);
    c.restore();
    ink(c,'M-9 -11 L4 -10 L10 3 L-8 4Z',colors[0],rim,1);
  }else{
    for(const side of [-1,1]){
      c.save();c.scale(side,1);c.translate(side===-1?-8:9,0);c.rotate(side*.25+lift*.03);
      ink(c,'M-3 17 L-5 -12 L0 -35 Q7 -27 8 -14 L4 17Z',
        blend(c,0,-35,8,17,'#f0f4ee',colors[1],colors[0]),rim,1.2);
      ink(c,'M-9 12 L9 12 L9 17 L-9 17Z',colors[3],colors[1],1);
      c.restore();
    }
  }
  if(level>=6)star(c,3,-36,2.5,colors[1],t*.7);
  c.restore();
  return true;
}
