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
    console.log(name + ': ' + loaded);
  }
  const markup = '<style>body{margin:0;background:white}img{width:450px;height:240px;object-fit:contain;object-position:left top;display:block;margin-bottom:8px}</style>' +
    Object.keys(sources).map(name => '<img src="' + name + '.jpg">').join('');
  await writeFile(join(directory, 'sources.html'), markup);
  const screenshot = join(directory, 'sources.png');
  execFileSync('google-chrome', ['--headless','--no-sandbox','--disable-gpu','--hide-scrollbars','--window-size=460,760',
    '--screenshot=' + screenshot,'file://' + join(directory, 'sources.html')], {stdio:'ignore',timeout:15000});
  const data = await readFile(screenshot);
  for (const [index, block] of data.toString('base64').match(/.{1,2400}/g).entries()) console.log('AQUA_SOURCE '+index+' '+block);
} finally {
  await rm(directory, { recursive: true, force: true });
}
