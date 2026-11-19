import { adventurer } from './actors.mjs?v=051';
import { propImage } from './orchard-props.mjs?v=051';
import { blend, ink, oval, stroke, TAU } from './paint.mjs?v=051';

// The character audition uses the same sprite, costume mesh and grips as a live round.
const W=630,H=355;
function backdrop(){
  const paper=document.createElement('canvas');paper.width=W;paper.height=H;
  const c=paper.getContext('2d');
  c.fillStyle=blend(c,0,0,W*.35,H,'#e8cfaa','#f7deac','#d4c486','#839368');c.fillRect(0,0,W,H);
  const sun=c.createRadialGradient(176,67,7,176,67,140);
  sun.addColorStop(0,'#fff1c2');sun.addColorStop(.43,'#ffeab077');sun.addColorStop(1,'#ffe9a300');c.fillStyle=sun;c.fillRect(35,0,290,212);
  oval(c,158,57,23,23,'#fff0c1');
  ink(c,'M0 130 Q48 118 100 93 Q127 77 151 89 Q199 116 231 99 Q285 70 319 83 Q369 108 415 82 Q456 53 492 68 Q545 94 630 52 L630 206 L0 206Z','#b7b694');
  ink(c,'M0 143 Q45 123 105 124 Q169 129 232 97 Q261 89 303 108 Q361 135 399 112 Q454 84 484 95 Q547 122 630 87 L630 206 L0 206Z','#97a38a');
  ink(c,'M0 160 Q102 132 214 152 Q348 166 455 132 Q548 108 630 127 L630 220 L0 220Z','#899578');
  c.fillStyle=blend(c,0,155,55,H,'#adad7d','#c6be8b','#a1a16c','#788861');c.beginPath();c.moveTo(0,167);c.bezierCurveTo(147,143,362,192,630,131);c.lineTo(W,H);c.lineTo(0,H);c.fill();
  for(let i=0;i<26;i++){
    const x=i*29-38,y=159-17*Math.sin(i*.41)+i*.23,size=.28+(i%3)*.065;
    c.drawImage(propImage('tree',i%9),x-88*size,y-134*size,176*size,176*size);
  }
  ink(c,'M-10 274 Q121 207 271 193 Q364 182 460 158 Q387 184 313 199 Q152 235 49 297Z','#d9c59b');
  c.drawImage(propImage('shed',0),34,138,81,81);
  for(let j=0;j<11;j++){const x=j*61-19,y=222+10*Math.sin(j*.51);
    c.drawImage(propImage('tree',(j+4)%9),x-39,y-67,80,80);}
  for(let i=0;i<1150;i++){
    const x=(i*179.413)%W,y=221+((i*97.57)%134),s=.5+(y-210)*.016;
    oval(c,x,y,1.1*s,.48*s,i%3?'#d2c68c96':'#78896180',-.34);
  }
  for(const [x,y,size,kind,v] of [[24,296,1.37,'tree',1],[-38,305,1.12,'banana',0],[612,275,1.18,'tree',2],[648,309,1.5,'banana',0]]){
    c.drawImage(propImage(kind,v),x-88*size,y-134*size,176*size,176*size);
  }
  oval(c,319,304,125,18,'#576a4a55');
  ink(c,'M190 275 Q191 249 310 246 Q429 244 443 271 L442 286 Q435 306 318 311 Q200 311 190 289Z',blend(c,0,253,0,306,'#c3baa1','#958b72','#887f68'),'#726e59',1.3);
  oval(c,316,275,126,27,blend(c,0,248,0,305,'#eee1b8','#d9cba4','#bfb695'));
  c.beginPath();c.ellipse(316,275,110,22,0,0,TAU);c.strokeStyle='#a49a7a';c.lineWidth=1.3;c.stroke();
  for(let i=0;i<12;i++){
    const a=i*TAU/12;stroke(c,[[316+Math.cos(a)*93,275+Math.sin(a)*19],[316+Math.cos(a)*107,275+Math.sin(a)*22]],'#b0a584',1.4);
    if(i<6)stroke(c,[[316+Math.cos(a)*124,277+Math.sin(a)*25],[315+Math.cos(a)*124,288+Math.sin(a)*21]],'#867f6a',1.1);
  }
  return paper;
}
export class FittingStage{
  constructor(canvas,sprite){
    this.canvas=canvas;this.sprite=sprite;this.ctx=canvas.getContext('2d');
    this.paper=null;this.job='staff';this.promotion=null;this.last=-Infinity;this.visible=true;
    const observer=new IntersectionObserver(([entry])=>{this.visible=entry.isIntersecting;});observer.observe(canvas);
  }
  select(job,promotion){
    this.job=job;this.promotion=promotion;this.last=-Infinity;
  }
  draw(now,quiet){
    if(!this.visible||document.hidden||now-this.last<(quiet?1000:65))return;
    this.last=now;
    const t=quiet?0:now/1000,phase=t%4.8;
    const c=this.ctx;
    this.paper??=backdrop();
    c.drawImage(this.paper,0,0);
    const walk=phase>.5&&phase<2.45,swing=phase>=2.83&&phase<3.23?100*(1-(phase-2.83)/.4):0;
    c.save();c.translate(315,257);c.scale(2.13,2.13);
    adventurer(c,{job:this.job,promotion:this.promotion,face:1,walk,gait:Math.floor((t*1.64%1)*255),look:{level:1,slots:Array(8).fill(0),swing,aim:0}},this.sprite,t,0,0,true);
    c.restore();
  }
}
