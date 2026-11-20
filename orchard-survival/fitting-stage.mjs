import { HeroSprite } from './actors.mjs?v=060';

export class FittingStage {
  constructor(stage){
    this.stage=stage;
    this.unit=new HeroSprite();
    this.frame=document.getElementById('stage-unit');
    this.frame.append(this.unit.el);
    this.job='staff';this.promotion=null;this.last=-Infinity;this.visible=true;
    this.observer=new IntersectionObserver(([entry])=>{this.visible=entry.isIntersecting;});
    this.observer.observe(stage);
  }
  select(job,promotion){
    this.job=job;this.promotion=promotion;this.last=-Infinity;
  }
  draw(now,quiet){
    if(!this.visible||document.hidden||now-this.last<(quiet?1000:60))return;
    this.last=now;
    const t=quiet?0:now/1000,phase=t%4.8;
    const swing=phase>=2.83&&phase<3.23?100*(1-(phase-2.83)/.4):0;
    const zoom=Math.min(this.stage.clientWidth/630,this.stage.clientHeight/355);
    this.unit.el.style.transform='scale('+(2.42*zoom)+')';
    this.unit.update({job:this.job,promotion:this.promotion,face:1,walk:phase>.5&&phase<2.45,
      gait:Math.floor((t*1.64%1)*255),look:{level:1,slots:[],swing}},true,true);
  }
}
