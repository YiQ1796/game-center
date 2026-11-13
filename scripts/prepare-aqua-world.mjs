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
let runtime = 'import { AquariumScene as M } from "./aquarium-life-scene.mjs?v=100";\n'
  + 'import { settleTankFacilities, validFacilities, waterConcentration } from "./aquarium-facilities.mjs?v=100";\n'
  + 'import { alive as isLiving, load as biologicalLoad } from "./aquarium-career.mjs?v=100";\n'
  + (source.slice(0, sceneStart) + source.slice(sceneEnd)).replace('0.2.0-g2-preview', '0.10.0-wide-tanks');
const speciesStart = runtime.indexOf('i={guppy:{label:');
const speciesEnd = runtime.indexOf(',a={grass:', speciesStart);
if (speciesStart < 0 || speciesEnd < 0) throw new Error('The original aquarium fish table could not be located.');
runtime = 'import { FISH } from "./aquarium-species.mjs?v=090";\n'
  + runtime.slice(0, speciesStart)
  + 'i=Object.fromEntries(Object.entries(FISH).map(([id, species]) => [id, { ...species, label: species.name, lifespan: species.life }]))'
  + runtime.slice(speciesEnd);
const tankCapacity = 120;
const runtimeIntegration = [
  ['a.clarity-e.length*1.5','a.clarity-e.length*1.5*waterConcentration(a)'],
  ['id:`river`,name:`晨光溪谷`,capacity:30', 'id:`river`,name:`晨光溪谷`,capacity:' + tankCapacity],
  ['id:`studio`,name:`靜水展示缸`,capacity:30', 'id:`studio`,name:`靜水展示缸`,capacity:' + tankCapacity],
  [
    'function x(e){let t=()=>{let t=localStorage.getItem(p);return t===null?(localStorage.setItem(p,JSON.stringify(e)),e):_(t)};return navigator.locks?navigator.locks.request(p,t):t()}',
    `function x(initialState) {
  const loadAndExpand = () => {
    const raw = localStorage.getItem(p);
    const state = raw === null ? initialState : _(raw);
    let changed = raw === null;
    for (const tank of state.tanks) {
      if ((tank.id === 'river' || tank.id === 'studio') && tank.capacity === 30) {
        tank.capacity = ${tankCapacity};
        changed = true;
      }
    }
    if (changed) localStorage.setItem(p, JSON.stringify(state));
    return state;
  };
  return navigator.locks ? navigator.locks.request(p, loadAndExpand) : loadAndExpand();
}`,
  ],
  ["function u(e,r){return{...e,tanks:e.tanks.map(e=>{let a=Math.max(0,(r-e.calculatedAt)/t),o=e.decorations.filter(e=>e.kind===`grass`).length,s=Math.max(0,l(e)*.055-o*.12);return{...e,calculatedAt:Math.max(r,e.calculatedAt),clarity:Math.max(15,e.clarity-Math.min(a,72)*s),fish:e.fish.map(e=>{if(e.diedAt!==null)return e;let a=e.bornAt+i[e.speciesId].lifespan*n,o=Math.min(r,a),s=Math.min(72,Math.max(0,(o-e.lastCalculatedAt)/t));return{...e,lastCalculatedAt:Math.max(o,e.lastCalculatedAt),growthHours:e.growthHours+s,satiety:Math.max(0,e.satiety-s*2),diedAt:r>=a?a:null}})}})}}", "function u(state, now) {\n  return {\n    ...state,\n    tanks: state.tanks.map(tank => {\n      const settled = settleTankFacilities(tank, now, isLiving, biologicalLoad);\n      return {\n        ...settled,\n        fish: tank.fish.map(fish => {\n          if (fish.diedAt !== null) return fish;\n          const endOfLife = fish.bornAt + i[fish.speciesId].lifespan * n;\n          const elapsed = Math.min(72, Math.max(0, (Math.min(now, endOfLife) - fish.lastCalculatedAt) / t));\n          return {\n            ...fish, lastCalculatedAt: Math.max(Math.min(now, endOfLife), fish.lastCalculatedAt),\n            growthHours: fish.growthHours + elapsed,\n            satiety: Math.max(0, fish.satiety - elapsed * 2),\n            diedAt: now >= endOfLife ? endOfLife : null,\n          };\n        }),\n      };\n    }),\n  };\n}\n"],
  ["if(!t.has(e.activeTankId))throw Error(`找不到原本選用的魚缸。`);return e", "if(!t.has(e.activeTankId))throw Error(`找不到原本選用的魚缸。`);if(!e.tanks.every(validFacilities))throw Error(`設備或展缸資料不完整。`);return e"],
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
for (const [oldText, newText] of runtimeIntegration) {
  if (!runtime.includes(oldText)) throw new Error('The aquarium runtime integration no longer matches the base bundle.');
  runtime = runtime.replace(oldText, newText);
}
await writeFile(join(assets, 'aquarium-runtime-v100.js'), runtime);
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
