/**
 * Original procedural 2D art for the twelve interactive genres.
 * No external images, spritesheets, generated pictures or licensed assets.
 */
import {GAMES,WIDTH,HEIGHT} from './engine.js?v=200';

const PALETTE=['#f7bc83','#90ecf0'];
const COLORS=['#ffb59b','#f7d890','#8ce7d4','#c4aaff','#f3a9df','#a9d7ff'];
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const point=(x,y)=>({x,y});
const rgba=(hex,a)=>{const str=hex.replace('#','');const n=parseInt(str,16);return 'rgba('+(n>>16)+','+((n>>8)&255)+','+(n&255)+','+a+')'};
function rr(c,x,y,w,h,r=12){c.beginPath();c.roundRect(x,y,w,h,r)}
function box(c,x,y,w,h,fill,r=12,stroke=null,width=1){rr(c,x,y,w,h,r);c.fillStyle=fill;c.fill();if(stroke){c.lineWidth=width;c.strokeStyle=stroke;c.stroke()}}
function circle(c,x,y,r,fill,stroke=null,lineWidth=1){c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fillStyle=fill;c.fill();if(stroke){c.lineWidth=lineWidth;c.strokeStyle=stroke;c.stroke()}}
function line(c,x1,y1,x2,y2,color,width=2){c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.strokeStyle=color;c.lineWidth=width;c.stroke()}
function txt(c,text,x,y,size=16,color='#fff9e9',align='center',weight=700){c.textAlign=align;c.textBaseline='middle';c.fillStyle=color;c.font=weight+' '+size+'px "Noto Sans TC",system-ui';c.fillText(String(text),x,y)}
function star(c,x,y,r,color){c.save();c.translate(x,y);c.fillStyle=color;c.beginPath();for(let j=0;j<8;j++){const a=j*Math.PI/4-Math.PI/2,rad=j%2?r*.3:r;const px=Math.cos(a)*rad,py=Math.sin(a)*rad;if(!j)c.moveTo(px,py);else c.lineTo(px,py)}c.closePath();c.fill();c.restore()}
function halo(c,x,y,r,color){const grd=c.createRadialGradient(x,y,0,x,y,r);grd.addColorStop(0,rgba(color,.29));grd.addColorStop(1,rgba(color,0));circle(c,x,y,r,grd)}
function gradient(c,top,bottom){const gr=c.createLinearGradient(0,0,0,HEIGHT);gr.addColorStop(0,top);gr.addColorStop(1,bottom);c.fillStyle=gr;c.fillRect(0,0,WIDTH,HEIGHT)}
function backdrop(c,g,from='#151c37',to='#312c52'){
  gradient(c,from,to);
  const t=g.elapsed;
  for(let i=0;i<85;i++){
    const sx=(Math.sin(i*122.14)*412313.7)%1,sy=(Math.sin(i*91.735)*839124.3)%1;
    const x=Math.abs(sx)*WIDTH,y=Math.abs(sy)*HEIGHT;
    const size=(i%7===0?2.5:1.1)+Math.sin(t*.7+i)*.24;
    circle(c,x,y,size,rgba(i%3?'#fff5dc':'#9ddaf0',.18+(i%4)*.1));
  }
  halo(c,780,90,260,'#a597e5');halo(c,180,420,260,'#f1a36c');
}
function sparkle(c,g){
  for(let i=0;i<7;i++){const x=32+i*151,y=60+((i*47)%380),v=.5+.5*Math.sin(g.elapsed*2+i);star(c,x,y,(2.5+v*2),'rgba(255,235,187,'+(.2+v*.4)+')')}
}
function avatar(c,x,y,p,scale=1){
  c.save();c.translate(x,y);c.scale(scale,scale);
  halo(c,0,0,43,PALETTE[p]);circle(c,0,9,19,p?'#80bccd':'#d9a16e','#fff7dc',2.5);
  circle(c,-12,-9,6,p?'#5b849e':'#b87c51');circle(c,12,-9,6,p?'#5b849e':'#b87c51');
  circle(c,0,-6,18,p?'#d3edf2':'#f5cf9b','#fff8e1',2);
  circle(c,-6,-8,2.4,'#3f3150');circle(c,6,-8,2.4,'#3f3150');
  c.strokeStyle='#513955';c.lineWidth=2;c.beginPath();c.arc(0,-1,5,.1,Math.PI-.1);c.stroke();
  c.restore();
}
function scoreHud(c,g,names){
  box(c,18,13,245,39,'#151729d9',12,rgba(PALETTE[0],.5),1);
  box(c,697,13,245,39,'#151729d9',12,rgba(PALETTE[1],.5),1);
  circle(c,39,32,9,PALETTE[0]);circle(c,719,32,9,PALETTE[1]);
  txt(c,(names?.[0]||'訪客一號').slice(0,9),56,33,13,'#fff5e5','left',700);
  txt(c,(names?.[1]||'訪客二號').slice(0,9),737,33,13,'#fff5e5','left',700);
  txt(c,Math.round(g.scores[0]),250,33,16,PALETTE[0],'right',900);
  txt(c,Math.round(g.scores[1]),925,33,16,PALETTE[1],'right',900);
  const left=Math.max(0,Math.ceil(g.duration-g.elapsed));
  box(c,423,12,114,41,'#14172ad9',12,'#d7bd8166');
  txt(c,Math.floor(left/60)+':'+String(left%60).padStart(2,'0'),480,32,20,'#ffdfa7','center',900);
}
function hpBar(c,x,y,w,h,part,color){
  box(c,x,y,w,h,'#15172ec9',h/2);
  if(part>0)box(c,x+1,y+1,(w-2)*clamp(part,0,1),h-2,color,h/2);
}
function triangle(c,x,y,angle,size,color){
  c.save();c.translate(x,y);c.rotate(angle);c.beginPath();c.moveTo(size,0);c.lineTo(-size*.8,-size*.65);c.lineTo(-size*.35,0);c.lineTo(-size*.8,size*.65);c.closePath();c.fillStyle=color;c.fill();c.strokeStyle='#fffbe0';c.lineWidth=1.5;c.stroke();c.restore();
}
function shooter(c,g){
  backdrop(c,g,'#081b37','#201636');sparkle(c,g);
  c.strokeStyle='#7d9fc01f';c.lineWidth=1;
  for(let x=0;x<=960;x+=48)line(c,x,55,x,540,'#70a6bf12');
  for(let y=55;y<540;y+=48)line(c,0,y,960,y,'#70a6bf13');
  halo(c,480,275,105,'#ffd590');
  circle(c,480,275,61,'#172c50','#cfad88',3);
  circle(c,480,275,45,'#253d5c','#e8d2a3',2);star(c,480,275,29,'#f6dba5');
  for(let p=0;p<2;p++){
    const h=g.p[p],col=PALETTE[p];
    halo(c,h.x,h.y,48,col);triangle(c,h.x,h.y,p?Math.PI:0,22,col);
    hpBar(c,h.x-27,h.y+25,54,6,h.hp/100,col);
    if(h.invul>0)circle(c,h.x,h.y,29,'#ffffff12',col,2);
  }
  for(const e of g.enemies){halo(c,e.x,e.y,e.r*2.6,'#f080bd');star(c,e.x,e.y,e.r,'#e995c4');circle(c,e.x,e.y,e.r*.42,'#643b62')}
  for(const b of g.shots){halo(c,b.x,b.y,22,PALETTE[b.owner]);circle(c,b.x,b.y,5,PALETTE[b.owner])}
  txt(c,'守護核心　'+Math.max(0,g.lives)+'/10',480,500,14,'#ffdfad');
}
function racer(c,g){
  backdrop(c,g,'#2a294c','#131f3c');
  for(let p=0;p<2;p++){
    const mid=p?710:250,x0=mid-180;
    box(c,x0,58,360,470,'#282e49',16,'#e9c88e80',3);
    const gr=c.createLinearGradient(x0,0,x0+360,0);
    gr.addColorStop(0,'#4a4472');gr.addColorStop(.12,'#34394e');gr.addColorStop(.88,'#34394e');gr.addColorStop(1,'#4a4472');
    box(c,x0+18,70,324,444,gr,12);
    line(c,x0+26,70,x0+26,513,'#eacb9c',3);line(c,x0+334,70,x0+334,513,'#eacb9c',3);
    const h=g.p[p];
    for(let y=-80;y<550;y+=85){const ofs=h.progress%85;line(c,mid,70+((y+ofs+444)%444),mid,93+((y+ofs+444)%444),'#fff1cc99',5)}
    for(const o of g.roadblocks){
      if(o.p!==p||o.hit)continue;
      const relative=o.at-h.progress,yy=396-relative*.73;
      if(yy<76||yy>515)continue;
      box(c,mid+o.side-24,yy-15,48,30,'#d88d65',7,'#fff1c5',2);
      line(c,mid+o.side-11,yy-8,mid+o.side+13,yy+8,'#f8d995',5);
    }
    c.save();c.translate(h.x,393);c.fillStyle=PALETTE[p];c.shadowColor=PALETTE[p];c.shadowBlur=20;
    box(c,-19,-31,38,62,h.hurt>0?'#a77275':p===0?'#edb37d':'#7fc3d0',12,'#fff9d8',3);
    box(c,-12,-17,24,22,'#28344e',6);box(c,-14,13,28,9,'#fff2cb',4);c.restore();
    hpBar(c,mid-137,84,274,12,h.progress/g.track,PALETTE[p]);
    hpBar(c,mid-64,468,128,9,h.boost/100,'#bd9ce8');
    txt(c,'TURBO',mid,490,11,'#ffebc7');
  }
  txt(c,'✦',480,273,42,'#f5d39d');
}
function platform(c,g){
  gradient(c,'#223d72','#ab9fcd');
  for(let j=0;j<9;j++){
    const x=((j*163-g.elapsed*15)%1150+1150)%1150-100,y=85+(j%5)*71;
    halo(c,x,y,75,'#e2efff');
    circle(c,x,y,26,'#f9ebd1a6');circle(c,x+26,y+7,19,'#f9ebd1a6');circle(c,x-25,y+7,20,'#f9ebd1a6');
  }
  for(const platform of g.platforms){
    box(c,platform.x,platform.y,platform.w,26,'#58456b',8,'#d2ad95',2);
    box(c,platform.x,platform.y-7,platform.w,13,'#93cb94',6,'#d5e9ae',1);
    for(let k=20;k<platform.w;k+=35)star(c,platform.x+k,platform.y+9,3,'#eccd94');
  }
  for(const x of g.thorns){
    c.fillStyle='#9d6685';c.beginPath();c.moveTo(x-24,482);c.lineTo(x,450);c.lineTo(x+24,482);c.fill();
  }
  for(const coin of g.coins){halo(c,coin.x,coin.y,32,'#ffebb3');star(c,coin.x,coin.y+Math.sin(g.elapsed*3+coin.phase)*4,12,'#ffefaa')}
  for(let p=0;p<2;p++){const h=g.p[p];avatar(c,h.x,h.y,p,.8)}
}
function hockey(c,g){
  gradient(c,'#233956','#4b577a');
  box(c,32,58,896,460,'#d1ecf1',42,'#e4cba6',7);
  box(c,48,73,864,430,'#a1d9e2',36,'#f2fff4',4);
  c.strokeStyle='#dfeefa';c.lineWidth=3;c.strokeRect(480,82,1,409);
  circle(c,480,289,92,'#ffffff19','#f8fffa',4);
  for(const x of [165,795])circle(c,x,289,70,'#ffffff13','#fcf8e2',3);
  box(c,32,199,12,183,'#f2c78d',4);box(c,916,199,12,183,'#a9ecf1',4);
  for(let p=0;p<2;p++){
    const hero=g.p[p],col=PALETTE[p];halo(c,hero.x,hero.y,70,col);
    circle(c,hero.x,hero.y,36,p===0?'#efac79':'#83c9d3','#fff8e2',5);
    circle(c,hero.x,hero.y,18,p===0?'#b97759':'#5e95b2','#fff9da',2);
  }
  halo(c,g.ball.x,g.ball.y,55,'#ffefab');circle(c,g.ball.x,g.ball.y,17,'#fff0be','#b8955b',3);
  star(c,g.ball.x,g.ball.y,9,'#d9a36d');
}
function archery(c,g){
  gradient(c,'#1a2c52','#b77e9e');halo(c,480,90,180,'#efcc96');
  circle(c,480,107,66,'#f1d5a5');
  for(let y=425;y<540;y+=17)line(c,0,y,960,y,'#583c6280',4);
  box(c,0,460,960,80,'#453852',4);
  for(const target of g.lanterns){
    if(!target.alive)continue;
    const x=target.x+Math.sin(target.phase)*22,y=target.y;
    halo(c,x,y,42,'#ffe4a3');box(c,x-18,y-23,36,43,'#f7c78f',18,'#fff3c9',3);
    line(c,x-17,y+4,x+17,y+4,'#a86e72',2);circle(c,x,y,7,'#fff7d1');line(c,x,y+21,x,y+33,'#ffe4aa',2);
  }
  for(let p=0;p<2;p++){
    const h=g.p[p];avatar(c,h.x,h.y,p,1);
    const dx=(p===0?1:-1)*Math.cos(h.angle),dy=-Math.sin(h.angle);
    line(c,h.x,h.y-25,h.x+dx*70,h.y-25+dy*70,PALETTE[p],3);
    c.beginPath();c.arc(h.x,h.y-25,24,-1.2,1.2,p===1);c.strokeStyle='#ffdfaa';c.lineWidth=3;c.stroke();
    txt(c,Math.round(h.power/6)+'%',h.x,497,13,'#fff0d5');
  }
  for(const a of g.arrows){line(c,a.x,a.y,a.x-a.vx*.04,a.y-a.vy*.04,PALETTE[a.owner],4);star(c,a.x,a.y,5,'#fff3c6')}
  txt(c,'風向　'+(g.wind>0?'➜':'⬅'),480,484,14,'#ffe9c1');
}
function fishShape(c,x,y,size,kind,vx){
  c.save();c.translate(x,y);c.scale(vx>=0?1:-1,1);
  halo(c,0,0,size*2,COLORS[kind+1]);c.fillStyle=COLORS[kind+1];c.beginPath();c.ellipse(0,0,size,size*.58,0,0,Math.PI*2);c.fill();
  c.beginPath();c.moveTo(-size*.8,0);c.lineTo(-size*1.55,-size*.72);c.lineTo(-size*1.55,size*.72);c.closePath();c.fill();
  circle(c,size*.44,-size*.12,2.5,'#29324f');c.restore();
}
function fishing(c,g){
  gradient(c,'#253f63','#285e78');halo(c,480,80,280,'#f6d3b0');
  for(let x=-40;x<1050;x+=105){const waveY=173+Math.sin(g.elapsed*1.2+x*.02)*7;
    c.beginPath();c.arc(x,waveY,70,Math.PI,Math.PI*2);c.strokeStyle='#b9eff3a8';c.lineWidth=3;c.stroke();
  }
  box(c,0,175,960,365,'#276482af',0);
  for(let i=0;i<35;i++){const x=i*91%960,y=210+i*37%300;circle(c,x,y,2+(i%3),'#b9f1f0'+(i%2?'66':'33'))}
  for(let j=0;j<13;j++){
    const x=25+j*86;line(c,x,540,x+Math.sin(g.elapsed+j)*12,476-(j%3)*24,'#5daf9a',5);
  }
  for(const f of g.fish){fishShape(c,f.x,f.y,14+f.kind*2,f.kind,f.vx)}
  for(let p=0;p<2;p++){
    const h=g.p[p];halo(c,h.x,132,65,PALETTE[p]);
    box(c,h.x-60,132,120,27,p?'#6ea9b0':'#c78e67',12,'#f4ddb5',3);
    avatar(c,h.x,117,p,.62);
    line(c,h.x+25,118,h.x+40,81,'#f4d5a4',3);
    if(h.hook){
      line(c,h.x+40,81,h.hook.x,h.hook.y,'#e5f6de',1.5);
      circle(c,h.hook.x,h.hook.y,5,'#fff5c7');
      if(h.hook.fish>=0)star(c,h.hook.x,h.hook.y-10,9,'#ffeda9');
    }
  }
  txt(c,'✦ 海流平穩・小心魚兒溜走',480,517,13,'#ecf3dd');
}
function firehouse(c,x,y,hp){
  halo(c,x,y,67,'#ebb88b');
  box(c,x-55,y-40,110,85,'#c9b4a3',8,'#f4ddc9',3);
  c.beginPath();c.moveTo(x-70,y-40);c.lineTo(x,y-84);c.lineTo(x+70,y-40);c.closePath();c.fillStyle='#a56578';c.fill();
  box(c,x-15,y+5,30,41,'#51445c',5,'#e8c6a1',2);
  box(c,x-39,y-22,20,20,'#9edbe3',4);
  box(c,x+19,y-22,20,20,'#9edbe3',4);
  hpBar(c,x-54,y+55,108,8,hp/100,hp>40?'#8be4c0':'#faab94');
}
function fire(c,g){
  gradient(c,'#382d52','#b06e75');
  for(let x=0;x<960;x+=70)line(c,x,50,x,540,'#fde3bd18');
  for(let y=60;y<540;y+=70)line(c,0,y,960,y,'#fde3bd18');
  for(const house of g.buildings)firehouse(c,house.x,house.y,house.hp);
  for(const f of g.fires){
    halo(c,f.x,f.y,55,'#ff865c');
    c.save();c.translate(f.x,f.y);
    c.fillStyle='#ff9873';c.beginPath();c.moveTo(-19,19);c.quadraticCurveTo(-25,-5,-3,-28);c.quadraticCurveTo(12,-9,10,-36);c.quadraticCurveTo(37,-7,19,19);c.fill();
    c.fillStyle='#ffe5a0';c.beginPath();c.moveTo(-9,18);c.quadraticCurveTo(-12,-4,5,-18);c.quadraticCurveTo(18,6,13,18);c.fill();c.restore();
    hpBar(c,f.x-20,f.y+27,40,5,f.heat/100,'#ffb485');
  }
  for(const water of g.water){line(c,water.x,water.y,water.tx,water.ty,PALETTE[water.owner],7);halo(c,water.tx,water.ty,19,'#bbf7ff')}
  for(let p=0;p<2;p++){const h=g.p[p];avatar(c,h.x,h.y,p,.8);star(c,h.x,h.y-23,10,'#bdf4f0')}
  txt(c,'✦ 合作守護街坊',480,525,14,'#fff1d1');
}
function rhythm(c,g){
  backdrop(c,g,'#1b1736','#272043');
  for(let p=0;p<2;p++){
    const x0=p===0?44:516;
    box(c,x0,65,400,429,'#141a31eb',16,'#d0b8c870',3);
    for(let lane=0;lane<4;lane++){
      const x=x0+22+lane*91;
      box(c,x,83,79,386,lane%2?'#393052aa':'#313554aa',8);
      line(c,x+3,441,x+76,441,'#e3b781',5);
      const arrow=['↑','→','↓','←'][lane];
      txt(c,arrow,x+39,473,20,'#f4d1a6');
    }
    for(const note of g.notes){
      if(note.p!==p||note.hit||note.miss)continue;
      const y=441-(note.at-g.elapsed)*218;
      if(y<88||y>472)continue;
      const x=x0+24+note.lane*91;
      box(c,x,y-14,75,27,COLORS[note.lane],9,'#fff4e2',2);
      star(c,x+38,y,10,'#fff5dc');
    }
    if(g.hitFx[p]>0&&g.elapsed-g.hitFx[p]<.3){halo(c,x0+200,441,100,PALETTE[p]);txt(c,'PERFECT',x0+200,395,24,'#ffe4ac')}
    txt(c,'COMBO ×'+g.p[p].combo,x0+200,114,15,'#fce0ae');
  }
}
function defense(c,g){
  gradient(c,'#183b45','#29444c');
  for(let x=0;x<960;x+=48)for(let y=62;y<540;y+=48){
    box(c,x+3,y+3,42,42,(x+y)%3?'#40736a33':'#5d82703d',6);
  }
  c.beginPath();
  for(let x=-20;x<=980;x+=5){const y=260+95*Math.sin(x*.011);if(x===-20)c.moveTo(x,y);else c.lineTo(x,y)}
  c.strokeStyle='#ba987a';c.lineWidth=62;c.stroke();c.strokeStyle='#ead9b99c';c.lineWidth=3;c.setLineDash([10,13]);c.stroke();c.setLineDash([]);
  box(c,883,180,65,142,'#b5b0d9',12,'#ffe9ae',4);
  star(c,916,251,24,'#fff3bb');
  for(const tower of g.towers){
    halo(c,tower.x,tower.y,56,PALETTE[tower.owner]);
    circle(c,tower.x,tower.y,25,'#393853',PALETTE[tower.owner],4);
    star(c,tower.x,tower.y,14,PALETTE[tower.owner]);circle(c,tower.x,tower.y,5,'#fff9e8');
  }
  for(const creep of g.creeps){
    halo(c,creep.x,creep.y,30,'#ff9a9d');circle(c,creep.x,creep.y,17,'#bc6e81','#ffe5c6',2);
    star(c,creep.x,creep.y,6,'#fff0d5');hpBar(c,creep.x-20,creep.y-30,40,5,creep.hp/creep.max,'#fb9eaa');
  }
  for(let p=0;p<2;p++){
    const h=g.p[p];circle(c,h.x,h.y,24,'#ffffff13',PALETTE[p],3);
    line(c,h.x-32,h.y,h.x+32,h.y,PALETTE[p],2);line(c,h.x,h.y-32,h.x,h.y+32,PALETTE[p],2);
  }
  txt(c,'材料 '+g.money+'　　核心 '+Math.max(0,g.gate)+'/16',480,515,16,'#fff0ce');
}
const INGREDIENTS=['✿','✧','❋','☘'];
function kitchen(c,g){
  gradient(c,'#57456a','#8d6e80');
  for(let x=0;x<960;x+=56)for(let y=54;y<540;y+=56){
    box(c,x+2,y+2,52,52,((x+y)/56)%2?'#f0d1b22e':'#e8c6ad1b',7,'#ffeec316');
  }
  box(c,0,60,960,65,'#4b3c51',6,'#e3b68d',3);
  for(let idx=0;idx<g.crates.length;idx++){
    const crate=g.crates[idx];
    box(c,crate.x-48,crate.y-45,96,90,'#a87366',12,'#ffdb9b',3);
    box(c,crate.x-40,crate.y-38,80,76,'#dbb18b',10);
    txt(c,INGREDIENTS[idx],crate.x,crate.y-5,36,COLORS[idx]);
    txt(c,crate.name,crate.x,crate.y+26,12,'#423049');
  }
  halo(c,480,270,165,'#ffe3b4');circle(c,480,270,86,'#54455f','#ead1a0',6);
  circle(c,480,270,68,'#ab7f84','#fbe9c3',2);
  star(c,480,270,34,COLORS[g.orders[0]]);
  txt(c,'當前餐點',480,212,13,'#fff1d8');
  box(c,362,365,236,66,'#322d48cb',14,'#d8bf9c',1);
  txt(c,'待備食材　'+g.orders.map(x=>INGREDIENTS[x]).join('  '),480,398,20,'#fce6b3');
  for(let p=0;p<2;p++){
    const h=g.p[p];avatar(c,h.x,h.y,p,.92);
    if(h.holding>=0){star(c,h.x,h.y-32,14,COLORS[h.holding])}
  }
  txt(c,'已完成 '+g.delivered+' 道料理',480,506,14,'#fff0d6');
}
function snake(c,g){
  gradient(c,'#172d3c','#23463f');
  const side=30,x0=90,y0=73;
  box(c,x0-13,y0-13,26*side+26,14*side+26,'#1b3640',12,'#c3d9ad',3);
  for(let y=0;y<14;y++)for(let x=0;x<26;x++){
    box(c,x0+x*side+1,y0+y*side+1,side-2,side-2,(x+y)%2?'#304e44':'#2b584a',4);
  }
  star(c,x0+g.food.x*side+15,y0+g.food.y*side+15,12,'#ffdfa6');
  for(let p=0;p<2;p++){
    const s=g.snakes[p];
    if(s.dead>0)continue;
    s.body.forEach((segment,j)=>{
      const x=x0+segment.x*side+15,y=y0+segment.y*side+15;
      circle(c,x,y,j===0?14:12,j===0?(p?'#95e5eb':'#ffd49c'):(p?'#518f99':'#b98662'),'#f3f6ce',j===0?2:1);
      if(j===0){circle(c,x-4,y-3,2.6,'#313445');circle(c,x+4,y-3,2.6,'#313445')}
    });
  }
  txt(c,'✿ 吃掉星果、守好自己的路線 ✿',480,516,14,'#e2eacb');
}
function paint(c,g){
  gradient(c,'#1c223f','#343052');
  for(let y=0;y<16;y++)for(let x=0;x<30;x++){
    const owner=g.paint[y*30+x],color=owner===-1?'#565275':owner===0?'#edaa83':'#8ed6db';
    box(c,x*32+1,y*32+28,30,30,color,5,'#eae7f51b',1);
    if(owner>=0&&((x+y)%7===0))star(c,x*32+16,y*32+43,4,'#fff6e4b4');
  }
  for(const splash of g.splashes){halo(c,splash.x,splash.y,63,PALETTE[splash.p]);circle(c,splash.x,splash.y,18,'#ffffff3b')}
  for(let p=0;p<2;p++){
    const h=g.p[p];halo(c,h.x,h.y,64,PALETTE[p]);avatar(c,h.x,h.y,p,.88);
    hpBar(c,h.x-35,h.y+28,70,8,h.ink/100,PALETTE[p]);
  }
}
export function drawGame(c,g,names){
  c.save();c.clearRect(0,0,WIDTH,HEIGHT);
  switch(g.id){
    case 0:shooter(c,g);break;
    case 1:racer(c,g);break;
    case 2:platform(c,g);break;
    case 3:hockey(c,g);break;
    case 4:archery(c,g);break;
    case 5:fishing(c,g);break;
    case 6:fire(c,g);break;
    case 7:rhythm(c,g);break;
    case 8:defense(c,g);break;
    case 9:kitchen(c,g);break;
    case 10:snake(c,g);break;
    case 11:paint(c,g);break;
  }
  scoreHud(c,g,names);
  if(g.over){box(c,330,238,300,70,'#16182edc',15,'#f5d59e');txt(c,'挑戰完成 ✦',480,273,26,'#ffe1b6')}
  c.restore();
}
