
import { blend, glow, ink, oval, star, stroke, TAU } from './paint.mjs?v=041';

function comet(c,length,width,hot,edge){
  c.save();c.scale(length/100,width/16);
  ink(c,'M14 0 C7 -14 -7 -18 -28 -13 L-18 -8 C-49 -15 -65 -6 -108 -9 Q-79 2 -56 4 L-75 7 Q-44 9 -24 7 C-15 16 5 16 14 0Z',
    blend(c,-100,0,10,0,edge+'00',edge+'ac',hot),null);
  ink(c,'M11 0 Q3 -11 -12 -9 Q-23 -6 -51 -5 Q-24 -3 -13 0 L-34 3 Q-5 13 11 0Z',
    blend(c,-48,0,10,0,edge+'28',hot,'#fff4bf'));
  ink(c,'M7 -2 Q-2 -7 -14 -3 L-6 1 L-14 3 Q0 7 7 -2Z','#fff9df');
  c.restore();
}
function arrow(c,length,width,rare){
  c.save();c.scale(length/38,width/8);
  ink(c,'M-43 0 L-9 -4 L11 0 L-6 4Z',blend(c,-43,0,12,0,'#4ebfbe00','#71dfd1a9','#fff2b0'));
  stroke(c,[[-21,0],[12,0]],rare?'#fff1a0':'#dfc17e',2.4);
  ink(c,'M2 -1 L4 -7 L20 0 L4 7 L7 1Z',rare?'#fff3b3':'#9ae7d8','#33827d',.9);
  ink(c,'M-14 -1 L-25 -8 L-23 -3 L-30 -4 L-23 1 L-13 2 L-24 7 L-21 2Z',rare?'#54e4e5':'#65bd9e');
  c.restore();
}
function slices(c,r,progress,color,loops){
  for(let i=0;i<loops;i++){
    const a=progress*6.3+i*TAU/loops;
    c.save();c.rotate(a);c.scale(r/100,r/100*.79);
    ink(c,'M-98 8 C-82 -64 -2 -96 72 -58 C88 -49 95 -38 99 -27 Q79 -48 55 -51 L64 -45 C-9 -70 -68 -39 -98 8Z',
      blend(c,-100,-30,100,-48,color+'00',color+'a6','#fff5ba',color+'aa'));
    ink(c,'M-67 -36 Q8 -89 76 -51',null,'#fff7ca',2.1);
    if(loops===3){
      c.translate(74,-54);c.rotate(.50);
      ink(c,'M-25 -2 L29 -2 L29 2 L-25 2Z','#c86736','#794d37',.8);
      c.fillStyle='#ffe99d';c.fillRect(15,-3,11,6);c.fillRect(-24,-3,8,6);
    }
    c.restore();
  }
}
function sparks(c,progress,r,count,seed,color,shards=false){
  for(let i=0;i<count;i++){
    const a=seed*.31+i*2.39996;
    const step=r*progress*(.46+(i%7)*.091);
    const x=Math.cos(a)*step,y=Math.sin(a)*step*.87-progress*(1-progress)*18;
    const size=(1-progress*.83)*(2.2+i%4);
    if(shards){
      c.save();c.translate(x,y);c.rotate(a+.7);c.scale(size*.65,size*1.55);
      ink(c,'M0 -2 L.9 .1 L0 1 L-.6 .2Z',i%3?color:'#fff7cd');c.restore();
    }else star(c,x,y,size,i%3?color:'#fff6bd',progress+i);
  }
}
export function groundSpells(c,view){
  for(const [x,y,r,kind,color,remaining=50,id=0] of view.zones){
    c.save();c.translate(x,y);
    if(kind==='mine'){
      oval(c,1,2,12,5,'#41554366');ink(c,'M-9 0 Q-12 -10 -4 -12 Q1 -19 7 -13 Q15 -13 11 -4 Q9 4 -2 5Z','#ffd78d','#966146',1.5);
      star(c,6,-11,3+Math.sin(view.t*8),'#fff6da');
    }else if(kind==='frostfield'){
      oval(c,0,0,r,r*.7,'#9adcea52');
      for(let i=0;i<8;i++){const a=i*2.4;star(c,Math.cos(a)*r*.65,Math.sin(a)*r*.48,4+(i%3),'#dbfbff',a);}
    }else if(kind==='field'){
      oval(c,0,0,r,r*.64,color+'65');
      for(let i=0;i<7;i++){const a=i*2.4;oval(c,Math.cos(a)*r*.56,Math.sin(a)*r*.39,12,5,'#ffe29987');}
    }else{
      const fraction=1-remaining/100;
      oval(c,0,2,10+r*.28*fraction,3+r*.07*fraction,'#6d4d555c');
      for(let i=0;i<4;i++){
        c.save();c.rotate(i*Math.PI/2+.36);c.translate(r*(.62-.37*fraction),0);
        ink(c,'M4 -5 L-3 0 L4 5',null,kind==='meteor'?'#fff1bf':'#ecc28b',2.6);c.restore();
      }
    }
    c.restore();
  }
  for(const [x,y,value] of view.gems){
    c.save();c.translate(x,y);const size=value>8?1.38:.9;c.scale(size,size);
    oval(c,1,3,6.7,2.4,'#48664566');c.translate(0,Math.sin(view.t*3+x)*1.4);
    ink(c,'M0 -8 L5 -4 L6 1 L0 6 L-6 1 L-5 -4Z',value>8?'#e7ae47':'#55ac93','#386d64',1.1);
    ink(c,'M0 -7 L1 -1 L-5 1 L-4 -4Z',value>8?'#fff0aa':'#cbf5c5');
    if(value>8)star(c,4,-5,2.4,'#fff6d1');c.restore();
  }
}

export function airborne(c,view,smooth,quiet){
  for(const [id,x,y,angle,color,kind,tier=1] of view.shots){
    const [px,py]=smooth(id,x,y);
    c.save();c.translate(px,py);c.rotate(angle);
    if(kind==='blast'){
      comet(c,35+tier*6,9+tier*1.3,'#ffb84f','#e35442');
      if(!quiet)star(c,-17,-5,3.2,'#fff1a7',view.t*4);
    }else if(kind==='return'){
      c.rotate(view.t*12);ink(c,'M-17 -11 Q3 4 15 -11 Q11 16 -4 10 Q-12 6 -17 -11Z','#ffe47c','#aa7041',1.4);
    }else arrow(c,kind==='starArrow'?70:31+tier*2.5,kind==='starArrow'?13:7,kind==='starArrow');
    c.restore();
  }
  for(const [x,y,,kind,,remaining=50,id=0] of view.zones){
    if(kind!=='meteor'&&kind!=='drop')continue;
    const f=remaining/100;
    c.save();c.translate(x-114*f,y-192*f-4);
    if(kind==='meteor'){
      c.rotate(1.05);comet(c,84+f*41,19+4*(1-f),'#ffad50','#b354af');
      c.rotate(-1.05);
      ink(c,'M-9 -9 L1 -15 L13 -8 L15 5 L5 14 L-8 11 L-15 1Z',blend(c,-9,-12,8,12,'#fff1ad','#ef8857','#a34b66'),'#ffe7a4',1.6);
      ink(c,'M-9 -8 L-1 -4 L-3 2 L4 4 L6 10 M-2 -4 L7 -10',null,'#ffedac',2);
      if(!quiet)star(c,-13,-8,4.8,'#fff5c8',id+f);
    }else{
      c.rotate(-.19+f*.65);ink(c,'M-15 -12 L14 -12 L16 10 L-13 13Z','#db9f62','#75533e',1.8);
      ink(c,'M-15 -9 L13 -10 M-12 9 L14 7 M-11 7 L11 -9',null,'#f9d28b',2.8);
    }
    c.restore();
  }
}

export function spellFlashes(c,view,quiet){
  for(const [x,y,r,color,strength,kind,x2,y2,label] of view.fx){
    const life=strength/100, p=1-life;
    if(life<=0||quiet&&kind==='number')continue;
    c.save();c.translate(x,y);c.globalAlpha=Math.min(1,life*3.1);
    if(kind==='ward'){
      c.save();c.scale(1,1.15);
      glow(c,0,-15,38,'#e2ffcb44','#76d29e00');
      c.beginPath();c.ellipse(0,-13,32,35,-.13,0,TAU);c.strokeStyle='#b7ecc4';c.lineWidth=2;c.stroke();
      for(let i=0;i<4;i++){const a=i*TAU/4+p*3;star(c,Math.cos(a)*31,-13+Math.sin(a)*31,3.2,'#fff5be',a);}
      c.restore();
    }else if(kind==='trail'){
      const dx=x2-x,dy=y2-y;c.rotate(Math.atan2(dy,dx));const length=Math.hypot(dx,dy);
      for(let i=-1;i<=1;i++){
        const j=i*7;c.beginPath();c.moveTo(0,j);c.quadraticCurveTo(length*.55,j-16-i*6,length,j);
        c.strokeStyle=i?'#95d9e9':'#f0fcff';c.lineWidth=i?2:4;c.stroke();
      }
    }else if(kind==='bolt'){
      const dx=x2-x,dy=y2-y,points=[[0,0],[dx*.27+11,dy*.25],[dx*.4-12,dy*.47],[dx*.6+6,dy*.46],[dx*.76-10,dy*.74],[dx,dy]];
      stroke(c,points,'#a280e88f',quiet?6:12);stroke(c,points,'#c2a5ff',5);stroke(c,points,'#fff9ed',2);
      if(!quiet)stroke(c,[points[2],[dx*.4-34,dy*.49],[dx*.3-40,dy*.68]],'#dec9ff',2);
      star(c,dx,dy,6+9*life,'#fff7dd',p);
    }else if(kind==='line'){
      const dx=x2-x,dy=y2-y;const points=[[0,0],[dx*.26+6,dy*.26-5],[dx*.49-7,dy*.49+4],[dx*.74+3,dy*.74-6],[dx,dy]];
      stroke(c,points,'#b893da88',8);stroke(c,points,'#ffdb79',3.5);stroke(c,points,'#fffee2',1.3);
    }else if(kind==='number'){
      c.font='900 15px system-ui';c.textAlign='center';c.lineWidth=3;c.strokeStyle='#66444a';c.fillStyle='#fff1a9';
      c.strokeText(label,0,-25-p*24);c.fillText(label,0,-25-p*24);
    }else if(kind==='sweep'||kind==='cyclone'||kind==='gale'){
      const big=kind==='cyclone';const radius=r*(.38+.66*Math.sin(Math.min(1,p*1.9)*Math.PI/2));
      slices(c,radius,p,big?'#ffbb45':color,big?3:1);
      if(big&&!quiet){c.save();c.translate(0,-23*p);slices(c,radius*.63,p+.32,'#ffe381',2);c.restore();}
      sparks(c,p,r,big?quiet?8:28:8,Math.floor(x),color,true);
    }else if(kind.startsWith('cast-')){
      const cls=kind.slice(5);
      if(cls==='scout'){
        for(let i=0;i<(quiet?6:12);i++){
          c.save();c.rotate(i*TAU/(quiet?6:12));c.translate(18+p*110,0);arrow(c,39*(1-p*.4),8,true);c.restore();
        }
      }else if(cls==='mage'){
        for(let i=0;i<5;i++){
          const angle=i*TAU/5+p*1.6;star(c,Math.cos(angle)*(25+p*54),-24+Math.sin(angle)*(14+p*25)-p*26,6*(1-p)+2,'#ffe19b',angle);
        }
      }
      if(label){c.textAlign='center';c.font='900 17px system-ui';c.strokeStyle='#50394a';c.lineWidth=3.5;c.fillStyle='#fff1bc';
        c.strokeText(label,0,-83-p*13);c.fillText(label,0,-83-p*13);}
    }else if(kind==='upgrade'){
      for(let i=0;i<(quiet?6:14);i++){
        const a=i*2.4+p;star(c,Math.cos(a)*(16+13*p),8-p*79+(i%4)*5,3+(i%3),'#fff2a3',a);
      }
      if(label){c.font='bold 13px system-ui';c.textAlign='center';c.lineWidth=3;c.strokeStyle='#463b43';c.fillStyle='#ffe7ac';c.strokeText(label,0,-64-p*16);c.fillText(label,0,-64-p*16);}
    }else if(kind==='ice'){
      sparks(c,p,r,quiet?8:18,x,'#c8f9ff',true);
      for(let i=0;i<5;i++){
        c.save();c.rotate((i-2)*.46);c.scale(1,Math.sin(Math.PI*p)*1.05+.09);
        ink(c,'M-7 1 L-7 -19 L0 -44 L6 -19 L6 1Z','#c4f6ef','#6ab9d1',1.2);c.restore();
      }
    }else{
      const nova=kind==='nova',radius=Math.max(10,r);
      glow(c,0,-3,radius*(.22+.55*p),nova?'#ffe195bc':color+'a8',color+'00');
      if(nova){
        for(let i=0;i<(quiet?5:9);i++){
          const a=i*2.4;const px=Math.cos(a)*radius*p*.48,py=Math.sin(a)*radius*p*.28;
          c.save();c.translate(px,py-8*p);c.rotate(-Math.PI/2+Math.cos(a)*.5);
          comet(c,11+life*32,4+life*7,'#ffbd66','#e16d54');c.restore();
        }
      }
      sparks(c,.12+.88*p,radius,nova?(quiet?12:30):(quiet?5:10),x*.07+y,color,true);
      if(p<.55)star(c,0,-4,(nova?31:11)*(1-p*1.65),'#fff7d1',.37);
    }
    c.restore();
  }
}
