import { FIELD } from './content.mjs?v=072';
import { LANDMARKS } from './garden.mjs?v=072';

export class Radar {
  constructor(map){
    this.map=map;this.marks=new Map();this.last=-1;
    for(const p of LANDMARKS){
      const el=document.createElement('i');el.className='radar-point site';
      el.style.left=(100*p.x/FIELD.width)+'%';el.style.top=(100*p.y/FIELD.height)+'%';map.append(el);
    }
  }
  draw(view,self,[x,y,w,h]){
    if(this.map.hidden||Math.abs(view.t-this.last)<.095)return;
    this.last=view.t;
    const seen=new Set();
    const mark=(key,cls,px,py)=>{
      let el=this.marks.get(key);
      if(!el){el=document.createElement('i');this.marks.set(key,el);this.map.append(el);}
      seen.add(key);el.className='radar-point '+cls;
      el.style.left=(100*px/FIELD.width)+'%';el.style.top=(100*py/FIELD.height)+'%';
      return el;
    };
    const frame=mark('view','camera',x,y);
    frame.style.width=(100*w/FIELD.width)+'%';frame.style.height=(100*h/FIELD.height)+'%';
    for(const cell of view.radar?.cells||[]){
      mark('cell'+cell,'swarm',((cell%32)+.5)*FIELD.width/32,(Math.floor(cell/32)+.5)*FIELD.height/20);
    }
    for(const [i,[bx,by,type]] of (view.radar?.bosses||[]).entries())mark('boss'+i,type===2?'boss':'elite',bx,by);
    for(const p of view.players)mark('player'+p.id,p.down?'down':p.id===self?'self':'ally',p.x,p.y);
    for(const [key,el] of this.marks)if(!seen.has(key)){el.remove();this.marks.delete(key);}
  }
}
