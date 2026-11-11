import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..', 'aqua-world');
const assets = join(root, 'assets');
const output = join(assets, 'aquarium');
const sources = {
  river: '0/09/Nature_Aquarium_Aquascape.jpg',
  studio: '3/30/Planted_Nano_Aquarium.JPG',
  guppy: 'b/bd/Poecilia_Reticulata_-_Vienna_Guppy.png',
  neon: '4/44/Neon_tetra_(Paracheirodon_innesi).png',
  betta: '1/10/Betta_splendens.png',
};

const source = await readFile(join(assets, 'index--LlWkRNN.js'), 'utf8');
const drawStart = 'function A(e,t,n,r,a,o,s){';
const oldStart = source.indexOf(drawStart);
const oldEnd = source.indexOf('function ', oldStart + drawStart.length);
if (oldStart < 0 || oldEnd < 0 || !source.slice(oldStart, oldEnd).includes('#bdf6ddbb')
  || !source.includes('assets/aquarium/art.json') || !source.includes('0.2.0-g2-preview')) {
  throw new Error('The original aquarium bundle no longer matches the preview integration.');
}
// The published G2 bundle supplies the game loop. G3 uses a standalone renderer and a versioned manifest.
const runtime = 'import { drawFishModel as A } from "./aquarium-render.mjs";\n'
  + (source.slice(0, oldStart) + source.slice(oldEnd))
    .replace('assets/aquarium/art.json', 'assets/aquarium/art-v030.json')
    .replace('0.2.0-g2-preview', '0.3.0-g3-preview');
await writeFile(join(assets, 'aquarium-runtime-v030.js'), runtime);
const scratch = await mkdtemp(join(tmpdir(), 'aqua-world-art-'));
try {
  const run = (bin, args) => execFileSync(bin, args, { stdio: 'inherit' });
  const convert = (() => {
    try { execFileSync('magick', ['-version'], { stdio: 'ignore' }); return 'magick'; }
    catch { return 'convert'; }
  })();
  for (const [name, remote] of Object.entries(sources)) {
    const file = join(scratch, name);
    const url = 'https://upload.wikimedia.org/wikipedia/commons/' + encodeURI(remote);
    run('curl', ['--fail', '--silent', '--show-error', '--location', '--retry', '2',
      '--connect-timeout', '12', '--max-time', '35', '--max-filesize', '15000000',
      '--user-agent', 'AquaWorld/0.3 (https://github.com/YiQ1796/game-center)', '--output', file, url]);
    const tank = name === 'river' || name === 'studio';
    const resize = tank
      ? ['-resize', '1440x810^', '-gravity', 'center', '-extent', '1440x810']
      : ['-resize', '480x320>'];
    run(convert, [file, '-auto-orient', ...resize, '-strip', '-quality', '82', join(output, name + '.webp')]);
  }
  await writeFile(join(output, 'art-v030.json'), JSON.stringify({
    fish: {}, tanks: { river: 'river.webp', studio: 'studio.webp' },
  }) + '\n');
  console.log('Aqua World: 2 aquarium backgrounds and 3 species reference photos prepared');
} finally {
  await rm(scratch, { recursive: true, force: true });
}
