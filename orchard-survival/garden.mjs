
import { FIELD } from './content.mjs?v=030';
import { blend, ink, oval, TAU } from './paint.mjs?v=030';

export const TRAIL='M-180 1170 C430 870 700 1310 1110 1120 S1580 720 1980 830 S2460 1110 2890 610';
const tileSize=384;
const leaf='M0 0 Q-11 -4 -12 -20 Q-2 -19 2 -4Z';
const blossom='M0 1 C-7 -1 -7 -8 -3 -8 Q0 -8 1 -5 Q4 -11 7 -7 Q10 -2 3 1 Q8 5 4 7 Q1 9 -1 4 Q-5 7 -7 4 Q-9 1 0 1Z';

function rng(x,y){
  let n=(Math.imul(x+17,73856093)^Math.imul(y+19,19349663))>>>0;
  return ()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};
}
function foliage(c,x,y,scale,random){
  c.save();c.translate(x,y);c.scale(scale,scale);
  oval(c,3,4,19,5,'#244d463c');
  for(let k=0;k<5;k++){
    c.save();c.rotate((k-2)*.48);c.scale(.55+random()*.34,.66+random()*.4);
    ink(c,leaf,k%2?'#488361':'#64975d','#49765a',.55);
    ink(c,'M0 -2 L-8 -15',null,'#acb87a',.95);c.restore();
  }
  c.restore();
}
function fruitTree(c,x,y,k){
  c.save();c.translate(x,y);c.scale(k,k);
  oval(c,12,10,49,14,'#31574455');
  ink(c,'M-9 8 Q-2 -8 -4 -27 L-20 -41 L-15 -44 L-2 -33 L7 -53 L13 -50 L6 -29 Q5 -5 13 6Z','#977747','#5f6446',2);
  for(let i=0;i<7;i++){
    const a=i*2.40;
    const lx=Math.cos(a)*23,ly=-44+Math.sin(a)*12;
    oval(c,lx,ly,26,19,blend(c,lx,ly-18,lx+7,ly+18,'#a9bb67','#658e53','#416f55'));
    for(let j=0;j<3;j++){
      oval(c,lx-9+j*7,ly-8+(j%2)*3,4.8,1.4,'#cad07e99',-.4);
    }
  }
  for(let j=0;j<6;j++){const a=j*2.2;const px=Math.cos(a)*33,py=-35+Math.sin(a)*14;
    oval(c,px,py,4.8,5.5,'#d88a45',.1);oval(c,px-1.3,py-2,2.4,2,'#ffda7b');}
  c.restore();
}

function bananaStand(c,x,y){
  c.save();c.translate(x,y);
  oval(c,9,9,47,12,'#38584b42',-.08);
  for(const [offset,lean,size] of [[-15,-.38,.77],[9,.21,1],[-2,-.16,.85]]){
    c.save();c.translate(offset,0);c.rotate(lean);c.scale(size,size);
    ink(c,'M-3 2 Q1 -13 -2 -31 L2 -32 Q6 -16 4 1Z',blend(c,-4,0,5,0,'#8f784d','#c4ad63','#647c53'),'#668058',1);
    for(const [a,len] of [[-1.2,.91],[-.64,.94],[.37,.9],[1.09,1]]){
      c.save();c.translate(0,-28);c.rotate(a);c.scale(len,len);
      ink(c,'M0 0 Q-13 -12 -11 -26 L-8 -24 L-9 -32 Q-6 -44 2 -49 Q9 -40 10 -32 L7 -30 L11 -27 Q11 -10 0 0Z',
        blend(c,-11,-25,11,-22,'#518a65','#8bae69','#649868'),'#4c805d',1.1);
      ink(c,'M0 -2 Q0 -23 2 -46 M0 -13 L-6 -18 M1 -25 L7 -32',null,'#c4d38b',.9);c.restore();
    }
    for(let j=0;j<3;j++){
      c.save();c.translate(-6+j*4,-25+j%2*3);
      ink(c,'M0 0 Q-3 8 4 10 Q10 11 12 3 Q13 15 3 15 Q-5 14 -3 4Z','#f4c964','#85894d',.85);c.restore();
    }
    c.restore();
  }
  c.restore();
}
function cropBed(c,x,y){
  c.save();c.translate(x,y);c.rotate(-.18);
  oval(c,2,5,53,17,'#6281614d');
  ink(c,'M-60 -13 Q-63 -20 -52 -21 L45 -21 Q56 -20 61 -12 L66 7 Q68 15 56 16 L-40 17 Q-54 17 -56 9Z',
    blend(c,0,-23,0,18,'#a9a580','#9a8d69','#857e61'),'#8f936c',1.5);
  for(let row=0;row<2;row++){
    for(let i=0;i<6;i++){
      const px=-42+i*17+row*5,py=-7+row*14;
      oval(c,px+1,py+1,7,2,'#586e515e');
      for(const angle of [-.8,0,.8]){
        c.save();c.translate(px,py);c.rotate(angle);c.scale(.38,.43);
        ink(c,leaf,i%2?'#7fa763':'#8db572','#567c55',1.3);c.restore();
      }
      if(i%2===row)oval(c,px+3,py-2,2.2,2.6,'#df8d64');
    }
  }
  c.restore();
}

function makeTile(col,row){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=tileSize;
  const pathShape=new Path2D(TRAIL);
  const c=canvas.getContext('2d');const left=col*tileSize,top=row*tileSize;
  c.translate(-left,-top);
  c.fillStyle='#476d4d';c.fillRect(left,top,tileSize,tileSize);
  c.save();c.beginPath();c.rect(0,0,FIELD.width,FIELD.height);c.clip();
  c.fillStyle=blend(c,0,0,FIELD.width,FIELD.height,'#689877','#a2ba76','#77a477','#648f69');
  c.fillRect(left,top,tileSize,tileSize);
  // World-space patches overlap adjacent tiles without a visible edge.
  for(let j=Math.floor(top/180)-1;j<=Math.ceil((top+tileSize)/180)+1;j++){
    for(let i=Math.floor(left/180)-1;i<=Math.ceil((left+tileSize)/180)+1;i++){
      const random=rng(i,j);const x=i*180+random()*130,y=j*180+random()*130;
      const g=c.createRadialGradient(x,y,6,x,y,138);
      g.addColorStop(0,random()>.4?'#e6d69070':'#417d674f');g.addColorStop(1,'#abc67c00');
      c.fillStyle=g;c.fillRect(x-138,y-138,276,276);
    }
  }
  for(const [color,width] of [['#dae2a551',126],['#779364',112],['#b7b883',107],['#d3c696',91],['#e1d09f',68]])ink(c,TRAIL,null,color,width);
  for(let gy=Math.floor(top/49)-1;gy<=Math.ceil((top+tileSize)/49);gy++){
    for(let gx=Math.floor(left/49)-1;gx<=Math.ceil((left+tileSize)/49);gx++){
      const random=rng(gx*3,gy*5);
      const x=gx*49+random()*43,y=gy*49+random()*43;
      const path=c.isPointInStroke(pathShape,x-left,y-top);
      if(path){oval(c,x,y,3+random()*4,1.3,'#ad93624a',-.2);continue;}
      const pick=random();
      if(pick<.085)foliage(c,x,y,.45+random()*.45,random);
      else if(pick<.185){
        for(let k=0;k<5;k++){c.save();c.translate(x+random()*22,y+random()*10);c.scale(.33,.33);
          ink(c,blossom,['#ffddb0','#fff2c1','#ddb9dc'][k%3]);oval(c,0,0,2.8,2.3,'#d69b4a');c.restore();}
      } else {
        for(let k=0;k<7;k++){const dx=random()*24,dy=random()*13;
          oval(c,x+dx,y+dy,.9+random(),2+random()*2,k%3?'#45785358':'#d9db935e',.35+random()*.7);}
      }
    }
  }
  for(let row=Math.floor((top-92)/340);row<=Math.ceil((top+tileSize+92)/340);row++){
    for(let col=Math.floor((left-92)/400);col<=Math.ceil((left+tileSize+92)/400);col++){
      const random=rng(col+127,row+75);
      const x=col*400+75+random()*180,y=row*340+60+random()*160;
      if(x<-50||y<-50||x>FIELD.width||y>FIELD.height||x<left-80||x>left+tileSize+80||y<top-16||y>top+tileSize+90)continue;
      if((row+col)%3===0)cropBed(c,x,y);else bananaStand(c,x,y);
    }
  }
  c.restore();
  for(let i=Math.floor(left/79)-1;i<Math.ceil((left+tileSize)/79)+1;i++){
    if(top<60)fruitTree(c,i*79,11+(i%3)*7,1.02);
    if(top+tileSize>FIELD.height-100)fruitTree(c,i*79,FIELD.height+10+(i%2)*7,.94);
  }
  for(let j=Math.floor(top/77)-1;j<Math.ceil((top+tileSize)/77)+1;j++){
    if(left<65)fruitTree(c,5+(j%2)*7,j*77,1);
    if(left+tileSize>FIELD.width-70)fruitTree(c,FIELD.width+(j%2)*6,j*77,1);
  }
  return canvas;
}

export class Garden {
  constructor(){this.tiles=new Map();}
  draw(c,x,y,width,height){
    for(let row=Math.floor(y/tileSize);row<=Math.floor((y+height)/tileSize);row++){
      for(let col=Math.floor(x/tileSize);col<=Math.floor((x+width)/tileSize);col++){
        const key=col+','+row;
        if(!this.tiles.has(key)){
          if(this.tiles.size>=36)this.tiles.delete(this.tiles.keys().next().value);
          this.tiles.set(key,makeTile(col,row));
        }
        c.drawImage(this.tiles.get(key),col*tileSize,row*tileSize,tileSize+.35,tileSize+.35);
      }
    }
  }
}
