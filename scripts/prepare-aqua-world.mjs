import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const assets = resolve(import.meta.dirname, '..', 'aqua-world', 'assets');
const source = await readFile(join(assets, 'index--LlWkRNN.js'), 'utf8');
const previousScene = 'var E=class{fish=new Map;tanks=new Map;';
const mainEntrypoint = 'function N(e){let t=document.getElementById(e);';
const sceneStart = source.indexOf(previousScene);
const sceneEnd = source.indexOf(mainEntrypoint, sceneStart + previousScene.length);
if (sceneStart < 0 || sceneEnd < 0 || !source.slice(sceneStart, sceneEnd).includes('this.texture.refresh()')
  || !source.includes('0.2.0-g2-preview') || !source.slice(sceneEnd).includes('new M(')) {
  throw new Error('The aquarium base bundle no longer matches the scene integration.');
}

// The original app still owns gameplay and persistence. The new module owns the entire tank rendering.
let runtime = 'import { AquariumScene as M } from "./aquarium-life-scene.mjs";\n'
  + (source.slice(0, sceneStart) + source.slice(sceneEnd)).replace('0.2.0-g2-preview', '0.6.0-fish-care');
const feedingIntegration = [
  [
    "async function b(e,t,n){if(t!==`saved`)return{state:d(e,n,Date.now()),mode:t};let r=()=>{let r=y(Date.now());if(r.mode===`protected`)throw Error(`原存檔格式異常，已保護檔案。請重新整理以進入暫存試玩。`);let i=d(r.mode===`memory`?e:r.state,n,Date.now());if(r.mode===`memory`)return{state:i,mode:r.mode};try{return localStorage.setItem(p,JSON.stringify(i)),{state:i,mode:t}}catch{return{state:i,mode:`memory`}}};return navigator.locks?navigator.locks.request(p,r):r()}",
    "async function b(state, mode, action) {\n  function commit(previous, currentMode) {\n    const now = Date.now();\n    const next = d(previous, action, now);\n    let portionIds;\n    if (action.type === 'feed') {\n      const after = new Map(next.tanks.find(tank => tank.id === action.tankId).fish.map(fish => [fish.id, fish]));\n      portionIds = u(previous, now).tanks.find(tank => tank.id === action.tankId).fish\n        .filter(fish => after.get(fish.id).satiety > fish.satiety).map(fish => fish.id);\n    }\n    if (currentMode === 'saved') {\n      try { localStorage.setItem(p, JSON.stringify(next)); }\n      catch { currentMode = 'memory'; }\n    }\n    return { state: next, mode: currentMode, portionIds };\n  }\n  if (mode !== 'saved') return commit(state, mode);\n  const write = () => {\n    const latest = y(Date.now());\n    if (latest.mode === 'protected') throw Error('原存檔格式異常，已保護檔案。請重新整理以進入暫存試玩。');\n    return commit(latest.mode === 'memory' ? state : latest.state, latest.mode);\n  };\n  return navigator.locks ? navigator.locks.request(p, write) : write();\n}"
  ],
  [
    "({state:c,mode:d}=await b(c,d,e)),c.activeTankId!==i&&R(),n?.(),r.textContent=t",
    "let result=await b(c,d,e);({state:c,mode:d}=result),c.activeTankId!==i&&R(),n?.(result.portionIds),r.textContent=t"
  ],
  [
    "()=>C.feed(e.id)",
    "portions=>C.feed(e.id,portions)"
  ],
  [
    "()=>C.feed()",
    "portions=>C.feed(undefined,portions)"
  ]
];
for (const [oldText, newText] of feedingIntegration) {
  if (!runtime.includes(oldText)) throw new Error('The aquarium feeding integration no longer matches the base bundle.');
  runtime = runtime.replace(oldText, newText);
}
await writeFile(join(assets, 'aquarium-runtime-v060.js'), runtime);
const vendor = resolve(assets, '..', 'vendor');
const scratch = await mkdtemp(join(tmpdir(), 'aqua-three-'));
try {
  const [pack] = JSON.parse(execFileSync('npm', ['pack', 'three@0.160.1', '--ignore-scripts', '--json', '--pack-destination', scratch], { encoding: 'utf8' }));
  if (pack.version !== '0.160.1' || pack.filename !== 'three-0.160.1.tgz') throw new Error('Unexpected Three.js package');
  execFileSync('tar', ['-xzf', join(scratch, pack.filename), '-C', scratch, 'package/build/three.module.js', 'package/LICENSE']);
  await copyFile(join(scratch, 'package/build/three.module.js'), join(vendor, 'three-0.160.1.module.js'));
  await copyFile(join(scratch, 'package/LICENSE'), join(vendor, 'three-LICENSE.txt'));
} finally {
  await rm(scratch, { recursive: true, force: true });
}
console.log('Aqua World: WebGL scene and pinned Three.js prepared');
