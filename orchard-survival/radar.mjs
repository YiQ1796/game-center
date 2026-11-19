
import { FIELD } from './content.mjs?v=040';
import { TRAIL } from './garden.mjs?v=040';
import { ink, oval, stroke } from './paint.mjs?v=040';

export class Radar {
  constructor(canvas){
    this.canvas=canvas;
    this.ctx=canvas.getContext('2d');
    this.last=-1;
  }
  draw(view,self,camera){
    if(this.canvas.hidden||Math.abs(view.t-this.last)<.095)return;
    this.last=view.t;
    const c=this.ctx,w=this.canvas.width,h=this.canvas.height;
    const sx=w/FIELD.width,sy=h/FIELD.height;
    c.setTransform(1,0,0,1,0,0);c.fillStyle='#263d37';c.fillRect(0,0,w,h);
    c.save();c.scale(sx,sy);
    ink(c,TRAIL,null,'#839670',66);
    c.strokeStyle='#9eab78';c.lineWidth=25;c.strokeRect(0,0,FIELD.width,FIELD.height);
    c.restore();
    c.fillStyle='#ec9b737f';
    for(const cell of view.radar?.cells||[])c.fillRect(((cell%32)+.3)*w/32,(Math.floor(cell/32)+.2)*h/20,3,3);
    const [x,y,worldWidth,worldHeight]=camera;
    c.strokeStyle='#e0e7baae';c.lineWidth=1.3;c.strokeRect(x*sx,y*sy,worldWidth*sx,worldHeight*sy);
    for(const [bx,by,type] of view.radar?.bosses||[]){
      const px=bx*sx,py=by*sy;
      c.save();c.translate(px,py);
      ink(c,'M0 -6 L5 0 L0 6 L-5 0Z',type===2?'#ff9565':'#ffda79','#533e39',1.4);c.restore();
    }
    for(const player of view.players){
      const px=player.x*sx,py=player.y*sy;
      if(player.down){
        stroke(c,[[px-4,py],[px+4,py]],'#ffbea0',2.2);stroke(c,[[px,py-4],[px,py+4]],'#ffbea0',2.2);
      }else {
        oval(c,px,py,player.id===self?5:3.7,player.id===self?5:3.7,'#25483f');
        oval(c,px,py,player.id===self?3.7:2.8,player.id===self?3.7:2.8,player.id===self?'#ffedb0':'#8ee7dd');
      }
    }
  }
}
