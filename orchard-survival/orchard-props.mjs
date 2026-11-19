import { blend, ink, oval, stroke, TAU } from './paint.mjs?v=051';

export function orchardSeed(x,y){
  let n=(Math.imul(x+139,73856093)^Math.imul(y+61,19349663))>>>0;
  return ()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};
}
const trunk='#514a3b', wood='#916541', edge='#634c36', gold='#e3bb74';
const canopyColors=[
  ['#354c3b','#496045','#607749','#859155','#a4a75e','#c6bd78'],
  ['#374e46','#47684c','#658354','#84965e','#a8ab71','#c7c88a'],
  ['#4e5343','#646840','#878444','#a09c4f','#c0ad5c','#d3c383']
];
function fruitTree(c,variant,random){
  const colors=canopyColors[variant%3];
  c.transform(1,(variant%3-1)*.035,(Math.floor(variant/3)-1)*.095,variant%3===1?.94:1,0,0);
  ink(c,'M-15 3 Q-5 -8 -9 -31 L-27 -55 L-23 -58 L-4 -43 L-4 -64 L3 -65 L5 -47 L21 -63 L25 -60 L9 -35 Q4 -9 15 3 L5 1 L0 5 L-4 1Z',
    blend(c,-10,-52,10,0,'#aa8b57','#806340','#544d3b'),trunk,1.5);
  ink(c,'M-6 -32 Q1 -18 -4 -2 M4 -35 L12 -44 M-4 -23 L-6 -12',null,'#bc9b66',1.7);
  // Interlocking masses have a cool underside and clusters of sunlit leaves along their upper-left rim.
  const groups=[[-27,-47,24],[-2,-43,29],[26,-53,23],[-34,-65,22],[13,-69,31],[-11,-74,28],[-4,-89,20]];
  for(let i=0;i<groups.length;i++){
    const [cx,cy,rad]=groups[i],x=cx+random()*5,y=cy+random()*7,rx=rad,ry=rad*.76;
    const lumps=12, contour=[];
    for(let j=0;j<lumps;j++){
      const a=j/lumps*TAU, rough=.85+random()*.22;
      contour.push([x+Math.cos(a)*rx*rough,y+Math.sin(a)*ry*rough]);
    }
    c.beginPath();c.moveTo((contour[0][0]+contour[11][0])/2,(contour[0][1]+contour[11][1])/2);
    for(let j=0;j<lumps;j++){
      const a=contour[j],b=contour[(j+1)%lumps];c.quadraticCurveTo(a[0],a[1],(a[0]+b[0])/2,(a[1]+b[1])/2);
    }
    c.closePath();c.fillStyle=blend(c,x-6,y-ry,x+7,y+ry,colors[4],colors[2],colors[0]);c.fill();
    for(let j=0;j<64;j++){
      const a=random()*TAU,r=Math.sqrt(random())*.98,dx=Math.cos(a)*r,dy=Math.sin(a)*r;
      const lit=1.6-dy*1.5-dx*.7+random()*2;
      const shade=colors[Math.max(0,Math.min(5,Math.floor(lit)))];
      oval(c,x+dx*rx,y+dy*ry,2+random()*3,1.1+random()*1.5,shade,-.55+random()*.9);
    }
  }
  for(let j=0;j<14;j++){
    const x=(random()-.5)*79,y=-48-random()*32+Math.abs(x)*.11;
    if(variant%3===1){oval(c,x,y,2.2,1.4,'#eacbaf');oval(c,x+2,y-2,2,1.2,'#f2ded2');}
    else {oval(c,x,y,3,3.6,variant%3===2?'#be7856':'#c99949');oval(c,x-.7,y-1.2,1.35,1.15,'#f7d184');}
  }
}
function banana(c){
  for(const [x,y,a,k] of [[-10,0,-.24,.84],[9,-3,.16,1],[1,5,-.05,.69]]){
    c.save();c.translate(x,y);c.rotate(a);c.scale(k,k);
    ink(c,'M-6 1 Q0 -19 -4 -46 L2 -46 Q7 -18 7 2Z',blend(c,-5,0,7,0,'#756841','#bfa05e','#687447'),edge,1);
    for(const angle of [-1.35,-.92,-.4,.3,.9,1.35]){
      c.save();c.translate(0,-42);c.rotate(angle);
      ink(c,'M0 0 Q-12 -10 -14 -23 L-9 -22 L-14 -29 L-11 -30 Q-9 -46 1 -55 Q10 -46 11 -36 L8 -34 L13 -30 L11 -22 L8 -20 L12 -19 Q10 -7 0 0Z',blend(c,-11,-24,11,-24,'#416d54','#8ea464','#4e7950'),trunk,1);
      ink(c,'M0 -1 Q2 -29 1 -52 M1 -12 L-6 -19 M1 -24 L7 -34',null,'#bec284',1);c.restore();
    }
    for(let j=0;j<4;j++){c.save();c.translate(j*3-7,-40+j%2*3);
      ink(c,'M0 0 Q-5 11 1 13 Q6 15 9 6 Q10 18 0 17 Q-9 15 -3 2Z','#e9bd59','#897943',.8);c.restore();}
    c.restore();
  }
}
function crate(c,x,y){
  c.save();c.translate(x,y);
  ink(c,'M-12 -11 L4 -15 L16 -10 L1 -6Z','#d0a064',edge,1);
  ink(c,'M-12 -11 L1 -6 L1 5 L-12 0Z','#ab7749',edge,1);
  ink(c,'M1 -6 L16 -10 L16 0 L1 5Z','#876041',edge,1);
  ink(c,'M-10 -8 L-1 1 M3 1 L14 -7',null,'#ddb37a',1.6);c.restore();
}
function packingHouse(c){
  ink(c,'M-58 -57 L22 -75 L55 -59 L54 -5 L-17 13 L-58 -5Z','#857552',edge,1.8);
  ink(c,'M-57 -54 L-16 -39 L-17 12 L-57 -5Z','#b29663',edge,1.4);
  ink(c,'M-17 -40 L54 -57 L54 -5 L-17 12Z',blend(c,0,-56,14,9,'#e6c98e','#b89564','#94734f'),edge,1.5);
  for(let i=0;i<7;i++)stroke(c,[[-12+i*10,-36-i*2.35],[-12+i*10,10-i*2.35]],'#826545',1);
  // Timber braces and a shuttered window on the side facing the orchard.
  ink(c,'M-55 -52 L-51 -50 L-51 -6 L-55 -7Z M-20 -38 L-16 -39 L-17 11 L-21 10Z','#876846',edge,.8);
  for(let i=0;i<5;i++)stroke(c,[[-52,-46+i*8],[-20,-34+i*8]],'#a1885f',.75);
  ink(c,'M-48 -40 L-29 -33 L-29 -14 L-48 -21Z','#785e44',edge,1.3);
  ink(c,'M-45 -37 L-32 -32 L-32 -18 L-45 -23Z','#58685b',edge,.75);
  ink(c,'M-40 -35 L-38 -34 L-38 -21 L-40 -22Z M-45 -31 L-32 -26 L-32 -24 L-45 -29Z','#d2b885');
  ink(c,'M-51 -21 L-28 -13 L-26 -15 L-48 -24Z','#c29668',edge,.8);
  ink(c,'M-58 -3 L-18 10 L-18 14 L-59 0Z','#928568',edge,.8);
  ink(c,'M-67 -54 L-40 -91 L36 -107 L66 -57 L-16 -36Z','#704a3e',edge,2);
  ink(c,'M-65 -57 L-39 -93 L-13 -39Z','#ad8057',edge,1.6);
  ink(c,'M-40 -93 L36 -109 L66 -62 L-13 -41Z',blend(c,0,-100,9,-45,'#d3946b','#af6b51','#825341'),edge,1.5);
  for(let j=0;j<4;j++){
    const yy=-91+j*11;stroke(c,[[-37+j*7,yy],[37+j*7,yy-16]],'#795340',1.8);
    for(let i=0;i<9;i++){const x=-36+i*8.4+j*7+(j%2)*2;
      stroke(c,[[x,yy-(i*.22)*8],[x+4,yy+7-(i*.22)*8]],'#d99a6e',1);}
  }
  ink(c,'M-42 -94 L35 -111 L39 -108 L-38 -90Z','#e4b07e',edge,1);
  ink(c,'M-4 -27 L18 -32 L17 2 L-5 8Z','#5f5341',edge,1);
  ink(c,'M-9 -35 L33 -45 L43 -32 L-1 -21Z','#e7ce96',edge,1.2);
  for(let i=0;i<3;i++){c.save();c.translate(i*13,-i*3);ink(c,'M-7 -35 L-1 -36 L9 -23 L3 -21Z','#628677');c.restore();}
  stroke(c,[[-1,-21],[-1,8]],wood,2);stroke(c,[[42,-31],[42,-4]],wood,2);
  crate(c,37,-2);crate(c,50,4);crate(c,38,-12);
}
function mill(c){
  ink(c,'M-52 -22 L22 -39 L47 -26 L-30 -8Z','#c5b799',edge,1.3);
  ink(c,'M-52 -22 L-30 -8 L-30 4 L-52 -10Z M-30 -8 L47 -26 L46 -14 L-30 4Z','#8f9077',edge,1.2);
  ink(c,'M-32 -12 L-31 -64 L-24 -68 L-24 -11Z M23 -26 L24 -72 L31 -74 L30 -26Z','#906f4a',edge,1.4);
  ink(c,'M-41 -61 L23 -79 L39 -74 L-26 -55Z','#c6a471',edge,1.5);
  c.save();c.translate(2,-29);c.transform(1,-.22,0,1,0,0);
  for(let i=0;i<10;i++){c.save();c.rotate(i*TAU/10);
    ink(c,'M-2 -1 L-2 -23 L-7 -27 L-3 -31 L5 -27 L4 -22 L2 -1Z','#b48c5b',edge,1.2);c.restore();}
  c.beginPath();c.arc(0,0,22,0,TAU);c.lineWidth=5;c.strokeStyle='#6b5038';c.stroke();c.lineWidth=2;c.strokeStyle='#bd9c6a';c.stroke();
  oval(c,0,0,5,5,'#665342');oval(c,-1,-1,2,2,gold);c.restore();
  for(let i=0;i<4;i++)stroke(c,[[-21+i*9,6-i*1.8],[-13+i*9,5-i*1.8]],'#adcebc',1.4);
}
function waypost(c){
  ink(c,'M-3 2 L-4 -56 L2 -58 L3 1Z',wood,edge,1.1);
  ink(c,'M-17 -52 L9 -56 L15 -52 L11 -47 L-17 -44Z','#d4ac73',edge,1.1);
  ink(c,'M-10 -39 L-5 -44 L15 -45 L16 -38 L-5 -35Z','#89a18b',edge,1.1);
  stroke(c,[[-12,-49],[5,-51]],'#795d42',1.5);
  stroke(c,[[2,-57],[12,-60],[18,-58],[18,-52]],edge,1.7);
  ink(c,'M13 -51 L21 -52 L23 -44 L20 -38 L14 -38 L11 -44Z','#eac77c',edge,1.2);
  ink(c,'M15 -49 L15 -41',null,'#f9dfa2',1.8);
}
const detailAtlas=new Map();
export function propImage(kind,variant){
  const key=kind+variant;
  if(detailAtlas.has(key))return detailAtlas.get(key);
  const size=176,canvas=document.createElement('canvas');canvas.width=canvas.height=size*1.5;
  const c=canvas.getContext('2d');c.scale(1.5,1.5);c.translate(size/2,134);
  if(kind==='tree')fruitTree(c,variant,orchardSeed(variant,83));
  else if(kind==='banana')banana(c);
  else if(kind==='shed')packingHouse(c);
  else if(kind==='mill')mill(c);
  else waypost(c);
  detailAtlas.set(key,canvas);return canvas;
}
