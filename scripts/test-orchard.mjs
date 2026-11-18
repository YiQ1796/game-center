
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allocateAttribute, advance, buildView, choose, finish, gearAction, newGame, setMove } from '../orchard-survival/arena.mjs';
import { ATTRIBUTES, CLASSES, EVOLUTIONS, PASSIVES, SKILLS, SLOTS, THRESHOLD } from '../orchard-survival/content.mjs';
import { ADVANCEMENTS, ADVANCEMENT_LEVEL } from '../orchard-survival/advancement.mjs';
import { Squad } from '../orchard-survival/squad.mjs';

const seats = (...jobs) => jobs.map((job,i)=>({id:'player-'+i,name:'隊員 '+(i+1),job}));
const tick = (game,count) => { for(let i=0;i<count;i++) advance(game); };

test('opening loadouts, bounded movement and world positions',()=>{
  assert.equal(Object.keys(SKILLS).length,12);
  assert.equal(Object.keys(PASSIVES).length,10);
  assert.equal(SLOTS.length,8);
  const game=newGame(seats('staff','mage','scout'),27);
  game.players.forEach(player=>assert.equal(player.skills[CLASSES[player.job].skill],1));
  const player=game.players[0];
  const start={x:player.x,y:player.y};
  setMove(player,19,-5);
  assert.ok(Math.abs(Math.hypot(player.move.x,player.move.y)-1)<.00001);
  tick(game,30);
  assert.ok(player.x>start.x&&player.y<start.y);
  assert.ok(Math.hypot(player.x-start.x,player.y-start.y)<=CLASSES.staff.speed+.05);
  setMove(player,NaN,0);
  assert.ok(Number.isFinite(player.move.x));
});

test('shared experience opens three different offers, solo pauses and stale choices are ignored',()=>{
  const game=newGame(seats('staff'),3);
  const player=game.players[0];
  player.skills.sweep=5;
  player.passive.reach=1;
  game.gems.push({x:player.x,y:player.y,value:9});
  advance(game);
  assert.equal(player.offers.length,3);
  assert.equal(new Set(player.offers.map(offer=>offer.name)).size,3);
  const expected=EVOLUTIONS.sweep[0];
  assert.equal(player.offers[0].name,expected);
  const time=game.elapsed;
  tick(game,30);
  assert.equal(game.elapsed,time);
  assert.equal(choose(game,player,0,player.offerId-1),false);
  assert.ok(choose(game,player,0,player.offerId));
  assert.ok(player.evolution.sweep);
  assert.equal(choose(game,player,0,player.offerId),false);
  advance(game);
  assert.ok(game.elapsed>time);
});


test('level eight offers two class advancement tracks, one selection and visible stat changes',()=>{
  assert.equal(ADVANCEMENT_LEVEL,8);
  assert.equal(Object.values(ADVANCEMENTS).flat().length,6);
  const game=newGame(seats('staff'),518);
  const player=game.players[0];
  game.spawnClock=999;
  game.level=7;
  game.xp=THRESHOLD(7)-1;
  game.gems.push({x:player.x,y:player.y,value:1});
  advance(game);
  assert.equal(game.level,8);
  assert.equal(player.offers.length,2);
  assert.ok(player.offers.every(item=>item.type==='promotion'));
  const version=player.offerId;
  const before=player.maxHp;
  assert.equal(choose(game,player,1,version),true);
  assert.equal(player.promotion,'guardian');
  assert.ok(player.maxHp>before,'guardian must increase actual maximum health');
  assert.equal(choose(game,player,0,version),false);
  const visible=buildView(game,player.id);
  assert.equal(visible.players[0].promotion,'guardian');
  assert.equal(visible.own.promotion,'guardian');
  assert.ok(visible.players[0].maxHp>before);
});

test('new regeneration and wisdom perks work without losing fractional gem experience',()=>{
  const game=newGame(seats('staff'),519);
  const player=game.players[0];
  game.spawnClock=999;
  game.level=5; // Avoid levelling and solo choice pause during the fractional-XP test.
  player.passive.regen=4;
  player.passive.wisdom=2;
  player.hp=30;
  tick(game,30);
  assert.ok(player.hp>31,'regeneration did not heal');
  for(let i=0;i<10;i++){
    game.gems.push({x:player.x,y:player.y,value:1});
    advance(game);
  }
  assert.ok(game.xp>=11,'experience bonus was lost to per-gem rounding');
});

test('co-op keeps advancing, automatically chooses after timeout and revives a nearby friend',()=>{
  const game=newGame(seats('staff','mage','scout','staff'),7);
  const [first,second]=game.players;
  game.spawnClock=999;
  game.gems.push({x:first.x,y:first.y,value:11});
  advance(game);
  assert.equal(game.level,2);
  assert.ok(game.players.every(p=>p.offers.length===3));
  first.down=true;first.hp=0;first.offers=[];
  tick(game,75);
  assert.equal(first.down,false);
  assert.ok(first.hp>0);
  assert.equal(second.rescues,1);
  tick(game,375);
  assert.ok(game.elapsed>12);
  assert.ok(game.players.slice(1).every(p=>p.offers.length===0));
  for(const player of game.players) player.down=true;
  advance(game);
  assert.ok(game.ended);
  const reason=game.reason;
  finish(game,'不該改寫');
  assert.equal(game.reason,reason);
});

test('elite and leader spawn, personal loot can be equipped, upgraded and salvaged once',()=>{
  const game=newGame(seats('staff','staff'),43);
  game.elapsed=51.99;
  advance(game);
  assert.ok(game.enemies.some(enemy=>enemy.kind==='elite'));
  game.elapsed=104.99;
  advance(game);
  const boss=game.enemies.find(enemy=>enemy.kind==='boss');
  assert.ok(boss);
  const [first,second]=game.players;
  boss.x=first.x+22;boss.y=first.y;boss.hp=1;
  first.timers.sweep=0;
  advance(game);
  assert.equal(first.bosses,1);
  const [item]=first.loot;
  assert.ok(item);
  assert.notEqual(item.id,second.loot[0].id);
  assert.equal(gearAction(game,first,'equip',second.loot[0].id),false);
  assert.ok(gearAction(game,first,'equip',item.id));
  assert.ok(gearAction(game,first,'forge',item.id));
  assert.equal(first.gear[item.slot].rank,1);
  const spare={...item,id:999};
  first.loot.push(spare);
  const before=first.crumbs;
  assert.ok(gearAction(game,first,'salvage',spare.id));
  assert.equal(gearAction(game,first,'salvage',spare.id),false);
  assert.ok(first.crumbs>before);
  const rematch=newGame(seats('staff'),43);
  assert.ok(rematch.players[0].gear.every(value=>value===null));
});

class FakeRoom {
  constructor(handlers) { this.handlers=handlers;this.out=[]; }
  async host() {}
  async join() {}
  close() {}
  sendHost(source,message) { this.out.push([source,message]);return true; }
  sendGuest(message) { this.out.push([null,message]);return true; }
  confirmJoined() {}
}

test('host admits four seats, checks ready, rejects mid-round joins, and resumes an existing guest', async()=>{
  const host=new Squad(()=>{},FakeRoom);
  await host.enter('host','','隊長','staff');
  const users=['00000000-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003'];
  const clients=users.map(()=>({close(){}}));
  users.forEach((id,i)=>host.hostMessage({type:'hello',id,name:'猴 '+i,job:'mage'},clients[i]));
  assert.equal(host.seats.length,4);
  assert.equal(host.canStart(),false);
  const refusal=host.connection.out.find(([source,message])=>source===clients[3]&&message.type==='refused');
  assert.ok(refusal);
  clients.slice(0,3).forEach(client=>host.hostMessage({type:'ready',job:'mage',ready:true},client));
  assert.ok(host.canStart());
  host.start();
  assert.equal(host.match.players.length,4);
  host.lost(clients[0]);
  const restored={close(){}};
  host.hostMessage({type:'hello',id:users[0]},restored);
  assert.equal(host.seats[1].source,restored);
  assert.equal(host.seats[1].on,true);
  assert.ok(host.connection.out.some(([source,message])=>source===restored&&message.type==='battle'));
  host.hostMessage({type:'move',x:1,y:0,round:99},restored);
  assert.equal(host.match.players[1].move.x,0);
  host.hostMessage({type:'move',x:1,y:0,round:1},restored);
  assert.equal(host.match.players[1].move.x,1);
  host.end();host.tick(performance.now()+250);
  const view=buildView(host.match,users[0]);
  assert.ok(view.done);
  assert.equal(view.players.length,4);
  host.reset();
  assert.equal(host.canStart(),false);
  host.leave();
});


test('stat points are granted every level, validated on host and affect combat statistics',()=>{
  const game=newGame(seats('staff'),2334);
  const p=game.players[0];
  assert.equal(Object.keys(ATTRIBUTES).length,6);
  game.spawnClock=999;
  game.gems.push({x:p.x,y:p.y,value:THRESHOLD(1)});
  advance(game);
  assert.equal(game.level,2);
  assert.equal(p.statPoints,3);
  const hpBefore=p.maxHp;
  assert.equal(allocateAttribute(game,p,'vit'),true);
  assert.ok(p.maxHp>hpBefore);
  assert.equal(p.statPoints,2);
  assert.equal(allocateAttribute(game,p,'__proto__'),false);
  assert.equal(allocateAttribute(game,p,'strength'),false);
  p.statPoints=0;
  assert.equal(allocateAttribute(game,p,'vit'),false);
  assert.ok(buildView(game,p.id).own.derived.hp>hpBefore);
});

test('active skills can reach rank ten and legendary upgrade remains capped',()=>{
  const game=newGame(seats('mage'),2335);
  const p=game.players[0];
  game.spawnClock=999;
  game.level=13;
  game.xp=THRESHOLD(13)-1;
  game.gems.push({x:p.x,y:p.y,value:1});
  p.skills.fire=9;
  p.legendaryTokens=1;
  advance(game);
  const card=p.offers.find(o=>o.type==='skill'&&o.grade==='legendary');
  assert.ok(card,'boss earned legendary skill card should appear');
  assert.ok(card.rankGain>=1&&card.rankGain<=3);
  const index=p.offers.indexOf(card);
  assert.equal(choose(game,p,index,p.offerId),true);
  assert.equal(p.legendaryTokens,0);
  assert.ok(p.skills[card.key]<=10,'legendary card must respect maximum level');
  assert.ok(p.skills[card.key]>=2,'legendary card must level up');
});

test('appearance and radar use authoritative state, including threats outside the camera',()=>{
  const game=newGame(seats('staff','mage'),109);
  const [player,friend]=game.players;
  friend.skills.fire=5; friend.evolution.fire=true;
  friend.gear[1]={id:88,slot:1,rarity:3,rank:2,perks:[]};
  game.enemies.push({id:77,kind:'boss',hp:44,x:27,y:37});
  const view=buildView(game,player.id);
  assert.equal(view.enemies.length,0);
  assert.deepEqual(view.radar.bosses,[[27,37,2]]);
  assert.deepEqual(view.players[1].look.slots,[0,16,0,0,0,0,0,0]);
  assert.equal(view.players[1].look.level,5);assert.equal(view.players[1].look.evolved,true);
});

test('three ultimate abilities send distinct animated effects to every seat',()=>{
  const game=newGame(seats('staff','mage','scout'),987);
  for(const p of game.players) p.burstPending=true;
  advance(game);
  for(const p of game.players){
    const v=buildView(game,p.id);
    assert.ok(v.fx.some(f=>f[5]==='cyclone'));
    assert.equal(v.zones.filter(z=>z[3]==='meteor'&&z[5]>0).length,6);
    assert.equal(v.shots.filter(s=>s[5]==='starArrow').length,18);
  }
  tick(game,41);
  assert.ok(game.zones.every(z=>z.kind!=='meteor'));
});
