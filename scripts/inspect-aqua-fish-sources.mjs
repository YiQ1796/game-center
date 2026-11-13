import { execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const directory = await mkdtemp(join(tmpdir(), 'aqua-photo-check-'));
const sources = {
  guppy: 'f/f8/Guppy_01.jpg',
  neon: '9/97/Neonsalmler_Paracheirodon_innesi.jpg',
  betta: '7/74/Betta_splendens_-_blue_male.JPG',
};
try {
  for (const [name, path] of Object.entries(sources)) {
    const file = join(directory, name + '.jpg');
    const filename = path.split('/').at(-1);
    const urls = ['https://upload.wikimedia.org/wikipedia/commons/' + path,
      'https://thumb.wikimedia.org/wikipedia/commons/thumb/' + path + '/330px-' + filename];
    let loaded = false;
    for (const url of urls) {
      try {
        execFileSync('curl', ['-fsSL', '--max-time', '12', '--user-agent', 'AquaWorld/0.6 (https://github.com/YiQ1796/game-center)', '-o', file, url], {stdio: 'pipe'});
        loaded = true;
        break;
      } catch { /* Try the verified thumbnail too. */ }
    }
    if (!loaded) throw new Error('Missing licensed source: ' + name);
  }
  // Coordinates measured against the reviewed display size, with the background excluded.
  const plates = {
    guppy: { width:323, height:215, cx:155, cy:94, cropWidth:163, cropHeight:104, tilt:-.59, path:
      'M91 84 Q94 72 102 69 L94 47 Q100 47 107 51 L116 56 L126 66 L134 75 Q145 74 151 79 L154 74 L163 76 L173 80 L182 87 Q202 95 208 113 Q219 125 220 134 L213 137 Q205 136 196 131 Q184 122 175 112 L166 105 L154 105 L143 101 L134 96 Q122 116 105 119 L96 115 L93 107 L94 99 L90 94 Z' },
    neon: { width:325, height:215, cx:172, cy:91, cropWidth:303, cropHeight:139, tilt:-.24, flip:true, path:
      'M41 120 Q42 114 53 108 Q74 91 99 84 Q126 73 151 66 L160 52 L172 38 L192 27 L183 54 L185 62 Q220 60 241 64 L254 53 L265 34 Q280 16 291 11 L295 15 L285 38 L277 55 L267 68 L270 89 L279 106 L284 120 L280 122 Q266 115 258 99 Q233 117 203 123 L198 138 L192 145 L183 135 Q139 148 113 144 Q82 151 64 140 L52 136 L44 133 Z' },
    betta: { width:330, height:169, cx:148, cy:80, cropWidth:274, cropHeight:141, tilt:0, path:
      'M20 51 L37 48 L25 44 L48 44 L45 40 L66 37 L86 37 Q105 26 126 27 L140 24 Q156 22 168 29 Q175 34 180 43 Q207 41 234 47 L258 45 L271 49 L267 57 L267 65 L257 76 L242 82 L229 80 L216 88 L213 103 L202 110 L195 104 Q179 126 163 135 L152 130 L141 139 L125 140 L109 136 L99 140 L80 134 L70 130 L58 129 L45 121 L40 113 L48 100 L29 111 L24 105 L33 92 L22 96 L21 87 L38 77 L28 77 L29 68 L42 61 L22 60 Z' },
  };
  const inputs = {};
  for (const [name, plate] of Object.entries(plates)) {
    inputs[name] = { ...plate, data: (await readFile(join(directory, name + '.jpg'))).toString('base64') };
  }
  const script = `
    (async () => {
      const input = ${JSON.stringify(inputs)};
      await Promise.all(Object.entries(input).map(async ([name, plate]) => {
        const fish = new Image();
        await new Promise((resolve, reject) => {
          fish.onload = resolve;
          fish.onerror = reject;
          fish.src = 'data:image/jpeg;base64,' + plate.data;
        });
        const canvas = document.createElement('canvas');
        canvas.width = 384;
        canvas.height = Math.round(384 * plate.cropHeight / plate.cropWidth);
        const ctx = canvas.getContext('2d');
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.scale(384 / plate.cropWidth, 384 / plate.cropWidth);
        ctx.rotate(plate.tilt);
        if (plate.flip) ctx.scale(-1, 1);
        ctx.translate(-plate.cx, -plate.cy);
        ctx.clip(new Path2D(plate.path));
        ctx.drawImage(fish, 0, 0, plate.width, plate.height);
        const result = document.createElement('output');
        result.id = name;
        result.textContent = canvas.toDataURL('image/webp', .86).split(',')[1];
        document.body.append(result);
      }));
    })().catch(error => { document.body.textContent = error.message; });
  `;
  await writeFile(join(directory, 'mask.html'), '<!doctype html><body><script>' + script + '</script>');
  const output = execFileSync('google-chrome', ['--headless','--no-sandbox','--disable-gpu',
    '--virtual-time-budget=10000','--dump-dom','file://' + join(directory, 'mask.html')],
  {encoding:'utf8',stdio:['ignore','pipe','ignore'],maxBuffer:12_000_000,timeout:25000});
  for (const name of Object.keys(inputs)) {
    const value = new RegExp('<output id="' + name + '">([A-Za-z0-9+/=]+)</output>').exec(output)?.[1];
    if (!value || Buffer.from(value,'base64').subarray(8,12).toString() !== 'WEBP') throw new Error('No WebP cutout: ' + name);
    for (const [index, block] of value.match(/.{1,2400}/g).entries()) console.log('AQUA_FISH ' + name + ' ' + index + ' ' + block);
  }
} finally {
  await rm(directory, { recursive: true, force: true });
}
