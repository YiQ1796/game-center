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
const runtime = 'import { AquariumScene as M } from "./aquarium-depth-scene.mjs";\n'
  + (source.slice(0, sceneStart) + source.slice(sceneEnd)).replace('0.2.0-g2-preview', '0.5.0-3d');
await writeFile(join(assets, 'aquarium-runtime-v050.js'), runtime);
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
