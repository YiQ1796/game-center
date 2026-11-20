import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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
  const {HeroSprite,EnemySprite,gearIcon}=await import('./actors.mjs?v=071');
  const {FieldEffects}=await import('./spells.mjs?v=071');
  expect(document.querySelectorAll('canvas').length===0,'unexpected Canvas renderer in the game');
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
  const stage=el('fitting-stage');
  for(const [index,routeName] of ['金箍戰神','紫電靈猴','疾風神射手'].entries()){
    el('jobs').children[index].click();el('route-options').children[1].click();
    expect(el('stage-name').textContent===routeName&&stage.getAttribute('aria-label').includes(routeName),'fitting route mismatch');
    expect(el('jobs').children[index].getAttribute('aria-pressed')==='true','audition changed starting class');
  }
  const {Garden,fieldLight,LANDMARKS}=await import('./garden.mjs?v=071');
  const garden=new Garden(),day=fieldLight(0),night=fieldLight(168);
  const fieldImage=new Image();fieldImage.src=new URL('./art/orchard-floor.webp',location.href);await fieldImage.decode();
  expect(fieldImage.naturalWidth>=1200,'illustrated field missing');
  garden.light(day);const dayTint=garden.tint.style.backgroundColor;garden.light(night);
  expect(garden.tint.style.backgroundColor!==dayTint,'night failed to light the world');
  const lamp=LANDMARKS.find(p=>p.kind==='post');
  const prop=garden.propNode({...lamp,variant:0});
  prop.update(day,[]);
  expect(Number(prop.el.firstChild.style.opacity)===1,'landmark hidden on an empty field');
  prop.update(day,[{x:lamp.x,y:lamp.y-12}]);
  expect(Number(prop.el.firstChild.style.opacity)<.4,'foreground did not reveal player');

  const plates=new Map();
  async function loadStrip(art,frames){
    const name=art.dataset.sheet;
    if(!plates.has(name)){
      const img=new Image();img.src=new URL('./art/'+name+'.webp',location.href);
      await img.decode();plates.set(name,img);
    }
    const img=plates.get(name);
    expect(img.naturalWidth===(frames===4?400:192)*frames&&getComputedStyle(art).backgroundImage.includes(name+'.webp'),'missing illustration '+name);
    return img;
  }
  function posePixels(img,count,frame,lower=false){
    const w=img.width/count,h=img.height;
    return pixels(()=>ink.drawImage(img,frame*w,lower?h*.62:0,w,lower?h*.38:h,0,0,220,lower?58:150));
  }
  const ready=new Map();
  for(const [job,paths] of [['staff',['staff','king','guardian']],['mage',['mage','storm','archmage']],['scout',['scout','ranger','shadow']]]){
    for(const route of paths){
      const hero=new HeroSprite(),look={level:1,slots:Array(8).fill(0)};
      const player={job,promotion:route,face:1,look};
      document.body.append(hero.el);
      hero.update(player,true,true);
      const img=await loadStrip(hero.art,4);
      const base=job===route;
      expect(hero.art.dataset.sheet===(base?job:route+'-t2'),'incorrect baked outfit');
      expect(!hero.body.querySelector('img,.worn-details'),'equipment icon rendered on body');
      if(!base){
        hero.update({...player,master:true},true,true);
        const master=await loadStrip(hero.art,4);
        expect(hero.art.dataset.sheet===route+'-t3' && difference(posePixels(img,4,0),posePixels(master,4,0))>100,'third tier outfit missing');
        hero.update(player,true,true);
      }
      ready.set(job,posePixels(img,4,0));
      expect(difference(posePixels(img,4,1,true),posePixels(img,4,2,true))>65,route+' legs have identical strides');
      expect(difference(posePixels(img,4,0),posePixels(img,4,3))>700,route+' attack silhouette failed');
      for(const [gait,frame] of [[48,1],[176,2]]){
        hero.update({...player,walk:true,gait},true,true);expect(hero.el.dataset.pose===String(frame),route+' walk');
      }
      look.swing=45;hero.update(player,true,true);expect(hero.el.dataset.pose==='3',route+' strike');look.swing=0;
      for(let slot=0;slot<8;slot++){
        const icon=gearIcon(slot,job,route);await icon.decode();
        look.slots[slot]=5;hero.update(player,true,true);
        expect(hero.body.children.length===1,'inventory art was mounted on actor');
      }
      hero.el.remove();
    }
  }
  for(const [job,pose] of ready)for(const [other,otherPose] of ready)if(job!==other)expect(difference(pose,otherPose)>800,'class outfits match');
  const monsters=[];
  for(const kind of ['grub','shroom','boar','bee','snail','elite','boss','queen']){
    const enemy=new EnemySprite(),state=[12,kind,0,0,30,65,false,1,0];
    document.body.append(enemy.el);enemy.update(state,.03,null);
    const img=await loadStrip(enemy.art,3);
    monsters.push(posePixels(img,3,0));
    expect(difference(posePixels(img,3,0),posePixels(img,3,1))>180,kind+' movement failed');
    enemy.update(state,.03,[12,0,0,30,10,false,49,1,false]);
    expect(enemy.el.dataset.pose==='2'&&enemy.art.classList.contains('struck')&&!enemy.bar.hidden,kind+' ordinary hit feedback');
    expect(difference(posePixels(img,3,0),posePixels(img,3,2))>350,kind+' flinch failed');
    enemy.el.remove();
  }
  for(let i=0;i<monsters.length;i++)for(let j=0;j<i;j++)expect(difference(monsters[i],monsters[j])>350,'enemy silhouettes match');
  const under=document.createElement('div'),over=document.createElement('div');
  const effects=new FieldEffects(under,over);
  const fxState={t:.5,gems:[],shots:[],zones:[],enemies:[],hits:[],fx:[]};
  const projected=(key,x,y)=>[x,y],visible=()=>true;
  for(const [job,art] of [['staff','leaf-cyclone'],['mage','fx-magic'],['scout','fx-wind']]){
    fxState.fx=[[130,128,70,'#ffc285',58,'cast-'+job,0,0,'',1]];
    effects.draw(fxState,projected,false,visible);
    const spell=over.querySelector('[data-spell="cast-'+job+'"]');
    expect(spell,'ultimate illustration missing for '+job);
    const before=spell.style.transform;fxState.fx[0][4]=29;effects.draw(fxState,projected,false,visible);
    expect(spell.style.transform!==before,'cast did not travel across frames');
  }
  fxState.fx=[];fxState.shots=[[3,0,0,0,'#fff','starArrow',6]];
  fxState.hits=[[17,0,0,14,23,false,55,1,false,'wind']];
  effects.draw(fxState,projected,true,visible);
  expect(over.querySelector('.damage-number')?.textContent==='23'&&over.querySelector('[data-art="star-arrow"]'),'hit or projectile disappeared in reduced motion');
  fxState.shots=[];fxState.hits=[];effects.draw(fxState,projected,true,visible);
  expect(over.childElementCount===0,'expired effects leaked into the next frame');
  // 檢查等級門檻、雙轉職選項、不可重複選擇與多人檢視資料。
  const {newGame,advance,choose,buildView}=await import('./arena.mjs?v=071');
  const {THRESHOLD}=await import('./content.mjs?v=071');
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
  await until(()=>document.querySelector('#field-art [data-route="mage"]')&&document.querySelector('#field-art [data-kind]'),'battle sprites never mounted');
  el('burst').click();
  await until(()=>el('burst').disabled,'burst did not cast');
  expect(el('mini-map').getBoundingClientRect().width>=70,'minimap is hidden');
  expect(el('mini-map').querySelector('.radar-point.self')&&el('mini-map').querySelector('.radar-point.camera'),'radar has no self or camera marker');
  el('radar-toggle').click();expect(el('mini-map').hidden,'radar did not fold');el('radar-toggle').click();
  el('bag').click();
  await until(()=>!!document.querySelector('.dressing .hero-body .sprite-art'),'equipment preview missing');
  Array.from(document.querySelectorAll('#dialog-actions button')).find(b=>b.textContent==='果園行商').click();
  await until(()=>['紫晶戰甲','曜金兵裝','赤曜王印'].every(name=>[...document.querySelectorAll('.market-item strong')].some(node=>node.textContent===name)),'high rarity equipment is missing from shop');
  Array.from(document.querySelectorAll('#dialog-actions button')).find(b=>b.textContent==='返回戰場').click();
  el('profile').click();
  await until(()=>!!document.querySelector('.attribute-grid'),'attribute screen missing');
  expect(document.querySelectorAll('.attribute-row').length===6,'six player attributes missing');
  el('profile').click();
  el('skillbook').click();
  await until(()=>!!document.querySelector('.skill-book-grid'),'skill panel missing');
  expect(document.getElementById('active-skills').children.length>0,'skill hotbar missing');
  el('skillbook').click();
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
const chrome = spawn(process.env.CHROME_BIN || 'google-chrome', ['--headless', '--no-sandbox',  '--window-size=1440,940',
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
      const response=await fetch(address+'?ci=071-'+Date.now(),{signal:AbortSignal.timeout(7000)});
      if(response.ok&&(await response.text()).includes('data-build="0.7.1"')){current=true;break;}
    }catch(error){console.log('Waiting for Pages:',error.message);}
    if(publicPage)await delay(3000);
  }
  assert.ok(current,'Orchard v0.7.1 entry not available at '+address);
  for(const [width,height] of [[1440,860],[390,844]]){
    await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<500});
    await call('Page.navigate',{url:address+'?ci=071-'+width+'-'+Date.now()});
    let loaded=false;
    for(let i=0;i<180;i++){
      const state=await call('Runtime.evaluate',{expression:"document.documentElement.dataset.build==='0.7.1' && !!document.getElementById('jobs')?.firstElementChild"});
      if(state.result.value===true){loaded=true;break;}await delay(100);
    }
    assert.ok(loaded,'Game modules failed to initialise: '+JSON.stringify(exceptions));
    async function captureScene(scene){
      if(!process.env.ORCHARD_SCREENSHOTS)return;
      const {data}=await call('Page.captureScreenshot',{format:'jpeg',quality:88});
      await writeFile(join(process.env.ORCHARD_SCREENSHOTS,'orchard-'+scene+'-'+width+'.jpg'),Buffer.from(data,'base64'));
    }
    if(process.env.ORCHARD_SCREENSHOTS){
      await call('Runtime.evaluate',{expression:"Promise.all(['orchard-stage','staff','mage','scout'].map(name=>{const img=new Image();img.src=new URL('./art/'+name+'.webp',location.href);return img.decode()}))",awaitPromise:true});
      await captureScene('selection');
    }
    const checked=await call('Runtime.evaluate',{expression:'('+exercise.toString()+')()',awaitPromise:true,returnByValue:true});
    assert.equal(checked.result.value,'PASS',checked.exceptionDetails?.exception?.description||JSON.stringify(exceptions));
    if(process.env.ORCHARD_SCREENSHOTS){
      await call('Page.navigate',{url:address+'?battle-preview='+width+'-'+Date.now()});
      let previewReady=false;
      for(let i=0;i<160&&!previewReady;i++){
        const js="(()=>{const jobs=document.getElementById('jobs');if(!jobs?.children[0]||document.getElementById('home').hidden)return false;jobs.children[0].click();document.getElementById('solo').click();return true})()";
        previewReady=(await call('Runtime.evaluate',{expression:js})).result.value===true;
        if(!previewReady)await delay(80);
      }
      assert.ok(previewReady,'could not start the screenshot round');
      let hit=false;
      for(let i=0;i<180&&!hit;i++){
        hit=(await call('Runtime.evaluate',{expression:"!!document.querySelector('#field-effects .damage-number')&&!!document.querySelector('#field-art [data-kind]')"})).result.value;
        if(!hit)await delay(55);
      }
      assert.ok(hit,'normal opening attack did not generate visible damage');
      await captureScene('battle');
    }
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
