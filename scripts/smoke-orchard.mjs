import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { setTimeout as delay } from 'node:timers/promises';
import { createServer } from 'node:http';
import { extname, join, resolve, sep } from 'node:path';

const root=resolve(import.meta.dirname,'..');
const types={'.html':'text/html; charset=utf-8','.mjs':'text/javascript','.css':'text/css','.js':'text/javascript','.webp':'image/webp','.png':'image/png'};

async function exercise() {
  const delay=ms=>new Promise(r=>setTimeout(r,ms));
  const el=id=>document.getElementById(id);
  const expect=(value,hint)=>{if(!value)throw Error(hint);};
  const until=async(test,hint)=>{
    for(let i=0;i<160;i++){if(test())return;await delay(50);}
    throw Error(hint);
  };
  await until(()=>el('jobs')?.children.length===3,'class selection never loaded');
  await el('mascot').decode();
  const {adventurer,creature}=await import('./actors.mjs?v=041');
  const {spellFlashes,airborne}=await import('./spells.mjs?v=041');
  const target=document.createElement('canvas');target.width=290;target.height=240;
  const ink=target.getContext('2d',{willReadFrequently:true});
  function pixels(draw){
    ink.clearRect(0,0,290,240);
    draw();
    return ink.getImageData(0,0,290,240).data;
  }
  function difference(a,b){
    let changed=0;
    for(let i=0;i<a.length;i+=4)if(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])+Math.abs(a[i+3]-b[i+3])>22)changed++;
    return changed;
  }
  for(const job of ['staff','mage','scout']){
    const look={level:1,slots:Array(8).fill(0)};
    const paint=()=>adventurer(ink,{job,face:1,look},el('mascot'),1,140,140,true);
    let old=pixels(paint);
    for(let i=2;i<=5;i++){look.level=i;const next=pixels(paint);expect(difference(old,next)>12,job+' level '+i);old=next;}
    look.evolved=true;expect(difference(old,pixels(paint))>35,job+' evolution');
    for(let slot=0;slot<8;slot++){old=pixels(paint);look.slots[slot]=5;expect(difference(old,pixels(paint))>3,job+' slot '+slot);}
  }
  // 六套進階服飾與專屬武器必須真的改變角色輪廓，不能只換徽章或閃光。
  for(const job of ['staff','mage','scout']){
    const base=pixels(()=>adventurer(ink,{job,face:1,look:{level:8,slots:Array(8).fill(0)}},el('mascot'),1,140,145,true));
    const options=job==='staff'?['king','guardian']:job==='mage'?['storm','archmage']:['ranger','shadow'];
    const outfits=options.map(promotion=>pixels(()=>adventurer(ink,{job,promotion,face:1,look:{level:8,slots:Array(8).fill(0)}},el('mascot'),1,140,145,true)));
    for(const costume of outfits)expect(difference(base,costume)>180,job+' class costume is only a particle');
    expect(difference(outfits[0],outfits[1])>180,job+' advancement routes share the same silhouette');
  }
  const walking={job:'staff',face:1,walk:true,look:{level:1,slots:Array(8).fill(0)}};
  function lowerBody(gait){
    ink.clearRect(0,0,290,240);adventurer(ink,{...walking,gait},el('mascot'),1,140,140,true);
    return ink.getImageData(120,137,40,17).data;
  }
  expect(difference(lowerBody(48),lowerBody(176))>65,'feet must change with the stride');
  const monsters=['grub','shroom','boar','bee','snail','elite','boss','queen'].map(kind=>pixels(()=>creature(ink,[1,kind,0,0,30,100,false,1,0],1,130,140)));
  for(let i=0;i<monsters.length;i++)for(let j=0;j<i;j++)expect(difference(monsters[i],monsters[j])>75,'enemy silhouette');
  const ultimateFrames=['staff','mage','scout'].map(job=>pixels(()=>{
    const view={t:1,fx:[[130,128,70,'#ffc285',58,'cast-'+job,0,0,'']],zones:[],shots:[]};
    if(job==='mage')view.zones.push([165,170,110,'meteor','#ffb040',55,91]);
    if(job==='staff')view.fx.push([130,128,120,'#f6c55b',53,'cyclone',0,0,'']);
    if(job==='scout')view.shots.push([3,163,121,0,'#83edcc','starArrow',6]);
    airborne(ink,view,(id,x,y)=>[x,y],false);spellFlashes(ink,view,false);
  }));
  for(let i=0;i<3;i++)expect(difference(ultimateFrames[i],ultimateFrames[(i+1)%3])>350,'ultimate frames match');
  // 檢查等級門檻、雙轉職選項、不可重複選擇與多人檢視資料。
  const {newGame,advance,choose,buildView}=await import('./arena.mjs?v=041');
  const {THRESHOLD}=await import('./content.mjs?v=041');
  const progression=newGame([{id:'promotion-test',job:'staff',name:'猴三毛'}],1234);
  const adventurerState=progression.players[0];
  progression.level=7;
  progression.xp=THRESHOLD(7)-1;
  progression.gems.push({id:991,x:adventurerState.x,y:adventurerState.y,value:1});
  advance(progression);
  expect(progression.level===8,'level eight was not reached');
  expect(adventurerState.offers.length===2&&adventurerState.offers.every(offer=>offer.type==='promotion'),'two promotion tracks were not offered');
  const offerVersion=adventurerState.offerId;
  expect(choose(progression,adventurerState,0,offerVersion),'promotion choice failed');
  expect(adventurerState.promotion==='king','promotion state not applied');
  expect(!choose(progression,adventurerState,0,offerVersion),'promotion double-choice accepted');
  expect(buildView(progression,adventurerState.id).players[0].promotion==='king','promotion omitted from multiplayer view');
  el('jobs').children[1].click();el('solo').click();
  await until(()=>!el('play').hidden&&el('clock').textContent!=='0:00','battle never started');
  el('burst').click();
  await until(()=>el('burst').disabled,'burst did not cast');
  expect(el('mini-map').getBoundingClientRect().width>=70,'minimap is hidden');
  expect(el('mini-map').getContext('2d').getImageData(108,76,1,1).data[3]>0,'radar has no paint');
  el('radar-toggle').click();expect(el('mini-map').hidden,'radar did not fold');el('radar-toggle').click();
  el('bag').click();
  await until(()=>!!document.querySelector('.dressing canvas'),'equipment preview missing');
  Array.from(document.querySelectorAll('#dialog-actions button')).find(b=>b.textContent==='果園行商').click();
  await until(()=>document.querySelectorAll('.market-item').length===3,'shop is unreachable from bag');
  Array.from(document.querySelectorAll('#dialog-actions button')).find(b=>b.textContent==='返回戰場').click();
  el('profile').click();
  await until(()=>!!document.querySelector('.attribute-grid'),'attribute screen missing');
  expect(document.querySelectorAll('.attribute-row').length===6,'six player attributes missing');
  el('profile').click();
  el('skillbook').click();
  await until(()=>!!document.querySelector('.skill-book-grid'),'skill panel missing');
  expect(document.getElementById('active-skills').children.length>0,'skill hotbar missing');
  return 'PASS';
}
const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    const path = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!path.startsWith(root + sep) || !/^\/(orchard-survival|one-a-two-b|assets)\//.test(pathname)) throw new Error('Invalid path');
    const contents = await readFile(path);
    response.setHeader('Content-Type', types[extname(path)] ?? 'application/octet-stream');
    response.end(contents);
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const profile = await mkdtemp(join(tmpdir(), 'orchard-chrome-'));
const chrome = spawn('google-chrome', ['--headless', '--no-sandbox',  '--window-size=1440,940',
  '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank']);
let diagnostics = '';
chrome.stderr.on('data', data => { diagnostics += data; });
let browserError;
chrome.on('error', error => { browserError = error; });
const closed = new Promise(resolve => chrome.once('close', resolve));
let ws;
try {
  let port;
  for (let attempt = 0; attempt < 250 && !port; attempt++) {
    if (browserError) throw browserError;
    port = await readFile(join(profile, 'DevToolsActivePort'), 'utf8').then(value => Number(value.split('\n')[0]), () => undefined);
    if (!port) await delay(100);
  }
  assert.ok(port, diagnostics);
  const pages = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json();
  ws = new WebSocket(pages.find(page => page.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  const pending = new Map();
  const exceptions = [];
  let commandId = 0;
  ws.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') {
      exceptions.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text);
    }
    const call = pending.get(message.id);
    if (!call) return;
    pending.delete(message.id);
    if (message.error) call.reject(new Error(message.error.message));
    else call.resolve(message.result);
  };
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++commandId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
  await call('Runtime.enable');
  await call('Page.enable');

  const publicPage=process.argv.includes('--published');
  const address=publicPage?'https://yiq1796.github.io/game-center/orchard-survival/index.html':
    'http://127.0.0.1:'+server.address().port+'/orchard-survival/index.html';
  let current=false;
  for(let i=0;i<(publicPage?15:1);i++){
    try{
      const response=await fetch(address+'?ci=041-'+Date.now(),{signal:AbortSignal.timeout(7000)});
      if(response.ok&&(await response.text()).includes('data-build="0.4.1"')){current=true;break;}
    }catch(error){console.log('Waiting for Pages:',error.message);}
    if(publicPage)await delay(3000);
  }
  assert.ok(current,'Orchard v0.4.1 entry not available at '+address);
  for(const [width,height] of [[1440,860],[390,844]]){
    await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<500});
    await call('Page.navigate',{url:address+'?ci=041-'+width+'-'+Date.now()});
    let loaded=false;
    for(let i=0;i<180;i++){
      const state=await call('Runtime.evaluate',{expression:"document.documentElement.dataset.build==='0.4.1' && !!document.getElementById('jobs')?.firstElementChild"});
      if(state.result.value===true){loaded=true;break;}await delay(100);
    }
    assert.ok(loaded,'Game modules failed to initialise: '+JSON.stringify(exceptions));
    const checked=await call('Runtime.evaluate',{expression:'('+exercise.toString()+')()',awaitPromise:true,returnByValue:true});
    assert.equal(checked.result.value,'PASS',checked.exceptionDetails?.exception?.description||JSON.stringify(exceptions));
    console.log('Orchard Chrome '+width+'x'+height+' PASS: 3 jobs + 6 visible advancement outfits, weapon levels 1–5 + evolution, 8 equipment slots, 8 monsters, 3 ultimates, radar, normal solo entry and equipment panel');
  }
  assert.deepEqual(exceptions,[]);
} finally {
  ws?.close();
  chrome.kill();
  await closed;
  server.close();
  await rm(profile, { recursive: true, force: true });
}
