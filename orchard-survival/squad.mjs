
import { PeerRoom } from '../one-a-two-b/peer-room.mjs?v=stack-100';
import { banish, purchase, allocateAttribute, buildView, choose, finish, gearAction, newGame, setMove } from './arena.mjs?v=062';
import { isClass } from './content.mjs?v=062';

const CODE = /^\d{6}$/;
const TOKEN = /^[a-f0-9-]{36}$/;
const CACHE = 'sanmao-orchard-guest-v1';
const nameFor = (value,fallback) => typeof value === 'string' ? value.trim().slice(0,16)||fallback : fallback;
const seed = () => crypto.getRandomValues(new Uint32Array(1))[0];
const newCode = () => String(100000+seed()%900000);

function packet(view, round) {
  const result={type:'battle',view,round};
  if(JSON.stringify(result).length<19000) return result;
  view.fx=view.fx.slice(-24);
  view.shots=view.shots.slice(0,82);
  view.gems=view.gems.slice(0,145);
  if(JSON.stringify(result).length>=22500) {
    view.fx=view.fx.filter(f=>f[5].startsWith('cast-')||['cyclone','nova','upgrade'].includes(f[5])).slice(-12);
    view.shots=view.shots.slice(0,46);
    view.enemies=view.enemies.sort((a,b)=>{
      const own=view.players.find(player=>player.id===view.own.id);
      return own ? Math.hypot(a[2]-own.x,a[3]-own.y)-Math.hypot(b[2]-own.x,b[3]-own.y) : 0;
    }).slice(0,170);
  }
  return result;
}

export class Squad {
  constructor(notify, Transport=PeerRoom) {
    this.notify=notify;
    this.connection=new Transport({
      onGuestOpen:()=>this.connection.sendGuest({type:'hello',id:this.self,name:this.name,job:this.job}),
      onHostMessage:(message,source)=>this.hostMessage(message,source),
      onGuestMessage:message=>this.guestMessage(message),
      onConnectionClosed:source=>this.lost(source),
      onStatus:(state,detail)=>{
        if(!this.role||this.role==='host'&&this.online) return;
        this.notify(detail);
      }
    },{namespace:'sanmao-orchard-v1'});
    this.role=null;
    this.round=0;
    this.seats=[];
    this.match=null;
    this.view=null;
    this.sentAt=0;
    this.receivedAt=0;
  }

  async enter(role,code,name,job, restore=false) {
    if(this.role) return false;
    if(role==='host') code=newCode();
    if(!CODE.test(code)) { this.notify('請輸入六位數房號。');return false; }
    this.role=role; this.code=code; this.job=isClass(job)?job:'staff';
    this.name=nameFor(name,role==='host'?'果園隊長':'採果好友');
    let saved;
    try { saved=JSON.parse(sessionStorage.getItem(CACHE)); } catch {}
    const sameRoom=role==='guest'&&saved?.code===code&&TOKEN.test(saved.id);
    this.self=sameRoom?saved.id:crypto.randomUUID();
    if (restore&&sameRoom) {
      this.name=nameFor(saved.name,this.name);
      if(isClass(saved.job)) this.job=saved.job;
    }
    if(role==='guest') this.saveGuest();
    this.online=false;
    this.seats=role==='host'?[{id:this.self,name:this.name,job:this.job,ready:true,on:true}]:[];
    const expected=this.self;
    this.notify(role==='host'?'正在建立房間…':'正在尋找房主…');
    try {
      if(role==='host') await this.connection.host(code);
      else await this.connection.join(code);
      if(this.self!==expected||this.role!==role) return false;
      if(role==='host') {this.online=true;this.lobby('房間已開啟。把邀請連結傳給好友。');}
      return true;
    } catch(error) {
      if(this.self===expected&&this.role===role) this.leave(error.message);
      return false;
    }
  }

  saveGuest() {
    if(this.role!=='guest') return;
    try { sessionStorage.setItem(CACHE,JSON.stringify({code:this.code,id:this.self,name:this.name,job:this.job})); } catch {}
  }

  restoreCode() {
    try { const saved=JSON.parse(sessionStorage.getItem(CACHE));return CODE.test(saved?.code)?saved.code:''; } catch { return ''; }
  }

  leave(reason='') {
    if(this.role==='guest') {
      this.connection.sendGuest({type:'bye'});
      try { sessionStorage.removeItem(CACHE); } catch {}
    }
    if(this.role==='host') {
      for(const seat of this.seats) if(seat.source) this.connection.sendHost(seat.source,{type:'closed'});
    }
    this.role=null;this.online=false;this.self=null;
    this.connection.close();
    this.seats=[];this.match=null;this.view=null;this.round=0;this.sentAt=0;
    this.receivedAt=0;
    this.notify(reason);
  }

  lobby(detail='') {
    const seats=this.seats.map(({id,name,job,ready,on})=>({id,name,job,ready,on}));
    for(const seat of this.seats) {
      if(seat.source) this.connection.sendHost(seat.source,{type:'lobby',seats,active:Boolean(this.match),round:this.round});
    }
    this.notify(detail);
  }

  lost(source,explicit=false) {
    const seat=this.seats.find(player=>player.source===source);
    if(!seat) return;
    seat.source=null;seat.on=false;
    seat.disconnectedAt=performance.now();
    const player=this.match?.players.find(p=>p.id===seat.id);
    setMove(player,0,0);
    if(!this.match) seat.ready=false;
    if(explicit&&!this.match) this.seats=this.seats.filter(p=>p!==seat);
    this.lobby(this.match?'隊友離線，已保留座位。':'隊友離線，座位暫時保留。');
  }

  hostMessage(message,source) {
    if(this.role!=='host'||!message||typeof message!=='object') return;
    if(message.type==='hello'&&typeof message.id==='string'&&TOKEN.test(message.id)) {
      let seat=this.seats.slice(1).find(player=>player.id===message.id);
      if(!seat) {
        if(this.match||this.seats.length>=4||message.id===this.self||this.seats.some(p=>p.source===source)) {
          this.connection.sendHost(source,{type:'refused',active:Boolean(this.match)});
          return;
        }
        seat={id:message.id,name:nameFor(message.name,'採果好友'),job:isClass(message.job)?message.job:'staff',ready:false};
        this.seats.push(seat);
      }
      if(seat.source&&seat.source!==source) {
        const previous=seat.source;
        seat.source=null;
        previous.close();
      }
      if(this.seats.some(p=>p!==seat&&p.source===source)) return;
      seat.on=true;seat.source=source;seat.disconnectedAt=0;
      seat.window=0;seat.count=0;
      seat.lastInputAt=performance.now();
      this.lobby(seat.name+' 已入座。');
      if(this.match) this.connection.sendHost(source,packet(buildView(this.match,seat.id),this.round));
      return;
    }
    const seat=this.seats.find(player=>player.source===source);
    if(!seat) return;
    const now=performance.now();
    const window=Math.floor(now/1000);
    if(seat.window!==window) {seat.window=window;seat.count=0;}
    if(++seat.count>45) return;
    if(message.type==='bye') {this.lost(source,true);return;}
    if(!this.match&&message.type==='ready') {
      if(isClass(message.job)) seat.job=message.job;
      seat.ready=message.ready===true;
      this.lobby();
      return;
    }
    if(!this.match||this.match.ended||message.round!==this.round) return;
    const player=this.match.players.find(item=>item.id===seat.id);
    if(!player) return;
    if(message.type==='move') {
      seat.lastInputAt=now;
      setMove(player,message.x,message.y);
    }
    if(message.type==='action') this.apply(player,message.action,message.value,message.version);
  }

  guestMessage(message) {
    if(this.role!=='guest') return;
    if(message?.type==='closed') {this.leave('房主已關閉房間。');return;}
    if(message?.type==='refused') {this.leave(message.active?'這局已開打，請等房主開下一局。':'房間座位已滿。');return;}
    if(message?.type==='lobby'&&Array.isArray(message.seats)&&message.seats.length<=4) {
      if(!message.seats.some(seat=>seat?.id===this.self)) return;
      this.connection.confirmJoined();
      this.online=true;
      this.seats=message.seats;
      this.round=message.round;
      if(!message.active) this.view=null;
      this.receivedAt=performance.now();
      this.notify('');
    } else if(message?.type==='battle'&&message.round===this.round&&Array.isArray(message.view?.players)&&
      Array.isArray(message.view.enemies)&&Array.isArray(message.view.shots)&&Array.isArray(message.view.gems)&&
      Array.isArray(message.view.zones)&&Array.isArray(message.view.fx)&&message.view.own&&
      message.view.players.some(p=>p?.id===this.self)&&(!this.view||message.view.t>=this.view.t)) {
      this.view=message.view;
      this.receivedAt=performance.now();
      this.notify('');
    }
  }

  select(job,ready) {
    if(!isClass(job)||this.match||this.view) return;
    this.job=job;
    if(this.role==='guest') {
      this.saveGuest();
      this.connection.sendGuest({type:'ready',job,ready});
    }
    if(this.role==='host') { this.seats[0].job=job;this.lobby(); }
  }

  canStart() {
    return this.role==='host'&&this.online&&!this.match&&this.seats.length>=2&&this.seats.every(seat=>seat.on&&seat.ready);
  }

  start() {
    if(!this.canStart()) return;
    this.round++;
    this.match=newGame(this.seats,seed());
    this.sentAt=0;
    this.completeSent=false;
    this.lobby();
  }

  reset() {
    if(this.role!=='host'||!this.match?.ended) return;
    this.match=null;
    this.seats=this.seats.filter(seat=>seat.on);
    for(const seat of this.seats.slice(1)) seat.ready=false;
    this.lobby('回到大廳，可以重新準備。');
  }

  action(action,value,version) {
    if(this.role==='guest') this.connection.sendGuest({type:'action',action,value,version,round:this.round});
    if(this.role==='host'&&this.match) this.apply(this.match.players[0],action,value,version);
  }

  apply(player,action,value,version) {
    if(!this.match||this.match.ended||player.down) return;
    if(action==='burst') player.burstPending=true;
    else if(action==='choose') choose(this.match,player,value,version);
    else if(action==='banish') banish(this.match,player,value,version);
    else if(action==='buy') purchase(this.match,player,value);
    else if(action==='stat') allocateAttribute(this.match,player,value);
    else gearAction(this.match,player,action,value);
  }

  move(x,y) {
    if(this.role==='host'&&this.match) setMove(this.match.players[0],x,y);
    if(this.role==='guest'&&this.view&&!this.view.done) this.connection.sendGuest({type:'move',x,y,round:this.round});
  }

  tick(now) {
    if(this.role!=='host') return;
    if(!this.match) {
      const count=this.seats.length;
      this.seats=this.seats.filter(seat=>seat.on||now-seat.disconnectedAt<24000);
      if(count!==this.seats.length) this.lobby();
    } else {
      for(const seat of this.seats.slice(1)) {
        if(now-seat.lastInputAt>650) setMove(this.match.players.find(p=>p.id===seat.id),0,0);
      }
      if(now-this.sentAt<185) return;
      if(this.match.ended&&this.completeSent) return;
      for(const seat of this.seats) {
        if(seat.source) this.connection.sendHost(seat.source,packet(buildView(this.match,seat.id),this.round));
      }
      this.completeSent=this.match.ended;
      this.sentAt=now;
    }
  }

  end() { if(this.match) finish(this.match,'隊長收工，果園下次見。'); }
}
