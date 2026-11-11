import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..', 'aqua-world');
const assets = join(root, 'assets');
const output = join(assets, 'aquarium');
const sources = [
  ['river.jpg', '0/09/Nature_Aquarium_Aquascape.jpg'],
  ['studio.jpg', '3/30/Planted_Nano_Aquarium.JPG', 1280],
  ['guppy.png', 'b/bd/Poecilia_Reticulata_-_Vienna_Guppy.png', 330],
  ['neon.png', '4/44/Neon_tetra_(Paracheirodon_innesi).png', 250],
  ['betta.png', '1/10/Betta_splendens.png', 960],
];

const source = await readFile(join(assets, 'index--LlWkRNN.js'), 'utf8');
const drawStart = 'function A(e,t,n,r,a,o,s){';
const oldStart = source.indexOf(drawStart);
const oldEnd = source.indexOf('function ', oldStart + drawStart.length);
const oldTank = 'r&&n.drawImage(r,0,0,D,O)';
if (oldStart < 0 || oldEnd < 0 || !source.slice(oldStart, oldEnd).includes('#bdf6ddbb')
  || !source.includes('assets/aquarium/art.json') || !source.includes('0.2.0-g2-preview') || !source.includes(oldTank)) {
  throw new Error('The original aquarium bundle no longer matches the preview integration.');
}
// The published G2 bundle supplies the game loop. G3 uses a standalone renderer and a versioned manifest.
const runtime = 'import { drawFishModel as A, drawTankPhoto } from "./aquarium-render.mjs";\n'
  + (source.slice(0, oldStart) + source.slice(oldEnd))
    .replace('assets/aquarium/art.json', 'assets/aquarium/art-v030.json')
    .replace('0.2.0-g2-preview', '0.3.0-g3-preview')
    .replace(oldTank, 'r&&drawTankPhoto(n,r,D,O)');
await writeFile(join(assets, 'aquarium-runtime-v030.js'), runtime);

function download(url, file, thumbnail) {
  execFileSync('curl', ['--fail', '--silent', '--show-error', '--location', '--retry', thumbnail ? '0' : '2',
    '--connect-timeout', '10', '--max-time', thumbnail ? '12' : '35', '--max-filesize', '15000000',
    '--user-agent', 'AquaWorld/0.3 (https://github.com/YiQ1796/game-center)', '--output', file, url],
  { stdio: thumbnail ? 'pipe' : 'inherit' });
}
for (const [name, remote, size] of sources) {
  const file = join(output, name);
  const path = encodeURI(remote);
  const original = 'https://upload.wikimedia.org/wikipedia/commons/' + path;
  let downloaded = false;
  if (size) {
    const basename = path.split('/').at(-1);
    try {
      download('https://thumb.wikimedia.org/wikipedia/commons/thumb/' + path + '/' + size + 'px-' + basename, file, true);
      downloaded = true;
    } catch {
      console.log('Thumbnail unavailable for ' + name + ', using the original');
    }
  }
  if (!downloaded) download(original, file, false);
  const bytes = await readFile(file);
  const signature = name.endsWith('.jpg') ? 'ffd8ff' : '89504e470d0a1a0a';
  if (!bytes.subarray(0, 8).toString('hex').startsWith(signature)) throw new Error('Invalid image: ' + name);
}
await writeFile(join(output, 'art-v030.json'), JSON.stringify({
  fish: {}, tanks: { river: 'river.jpg', studio: 'studio.jpg' },
}) + '\n');
console.log('Aqua World: 2 aquarium backgrounds and 3 species reference photos prepared');
