import { readFile, writeFile } from 'node:fs/promises';
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
const runtime = 'import { AquariumScene as M } from "./aquarium-daylight-scene.mjs";\n'
  + (source.slice(0, sceneStart) + source.slice(sceneEnd)).replace('0.2.0-g2-preview', '0.4.0-daylight');
await writeFile(join(assets, 'aquarium-runtime-v040.js'), runtime);
console.log('Aqua World: daylight scene prepared');
