import { advance,buildView,newGame } from './arena.mjs?v=083';
import { STEP } from './content.mjs?v=083';
import { FieldEffects, warmBattleArt } from './spells.mjs?v=083';
import { EnemySprite, HeroSprite } from './actors.mjs?v=083';

export class FittingStage {
  constructor(stage){
    this.stage=stage;
    this.unit=new HeroSprite();
    this.frame=document.getElementById('stage-unit');
    const layer=()=>Object.assign(document.createElement('span'),{className:'preview-effects'});
    const under=layer(),over=layer();this.effects=new FieldEffects(under,over);
    this.foes=[new EnemySprite(),new EnemySprite()];
    this.frame.append(under,...this.foes.map(f=>f.el),this.unit.el,over);
    document.getElementById('try-burst').addEventListener('click',()=>this.preview());
    this.job='staff';this.promotion=null;this.last=-Infinity;this.visible=true;
    this.observer=new IntersectionObserver(([entry])=>{this.visible=entry.isIntersecting;});
    this.observer.observe(stage);
  }
  select(job,promotion,master=false){
    this.resetPreview();warmBattleArt(job,promotion);this.master=master;this.job=job;this.promotion=promotion;this.last=-Infinity;
  }
  preview(){
    const game=newGame([{id:'preview',job:this.job,name:'猴三毛'}],42),p=game.players[0];
    p.promotion=this.promotion;p.master=this.master;p.skills={};
    game.spawnClock=0;advance(game);game.spawnClock=Infinity;
    for(const [i,e] of game.enemies.entries()){
      e.x=p.x+85+i*60;e.y=p.y-15-i*27;e.hp=e.maxHp=900;
    }
    this.demo={game,start:performance.now(),x:p.x,y:p.y};
    this.last=-Infinity;
    p.burstPending=true;
  }
  drawPreview(now,quiet,zoom){
    const {game,start,x,y}=this.demo,age=(now-start)/1000;
    if(age>1.95){this.resetPreview();return false;}
    while(game.elapsed<age+2*STEP && !game.ended && !game.players[0].offers.length)advance(game);
    const view=buildView(game,'preview'),p=view.players[0];
    const scale=1.36*zoom;
    this.effects.transform('matrix('+[scale,0,0,scale,-x*scale,-y*scale].join(',')+')');
    this.effects.draw(view,(key,px,py)=>[px,py],quiet,()=>true);
    this.unit.el.style.transform='translate('+((p.x-x)*scale)+'px,'+((p.y-y)*scale)+'px) scale('+scale+')';
    this.unit.update(p,true,true);
    for(const [i,e] of view.enemies.entries()){
      const foe=this.foes[i];
      foe.el.hidden=false;
      foe.el.style.transform='translate('+((e[2]-x)*scale)+'px,'+((e[3]-y)*scale)+'px) scale('+scale+')';
      foe.update(e,view.t,view.hits.find(h=>h[0]===e[0]));
    }
    return true;
  }
  resetPreview(){
    this.demo=null;this.effects.clear();
    for(const foe of this.foes)foe.el.hidden=true;
  }
  draw(now,quiet){
    if(!this.visible||document.hidden||now-this.last<(this.demo?30:quiet?1000:60))return;
    this.last=now;
    const t=quiet?0:now/1000,phase=t%4.8;
    const swing=phase>=2.83&&phase<3.23?100*(1-(phase-2.83)/.4):0;
    const zoom=Math.min(this.stage.clientWidth/630,this.stage.clientHeight/355);
    if(this.demo&&this.drawPreview(now,quiet,zoom))return;
    this.unit.el.style.transform='scale('+(2.42*zoom)+')';
    this.unit.update({job:this.job,master:this.master,promotion:this.promotion,face:1,walk:phase>.5&&phase<2.45,
      gait:Math.floor((t*1.64%1)*255),look:{level:1,slots:[],swing,ready:phase>=2.70&&phase<2.83}},true,true);
  }
}
