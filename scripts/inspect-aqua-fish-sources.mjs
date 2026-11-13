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
  await Promise.all(Object.entries(sources).map(async ([name, path]) => {
    const file = join(directory, name + '.jpg');
    const response = await fetch('https://upload.wikimedia.org/wikipedia/commons/' + path, {signal: AbortSignal.timeout(15000)});
    if (!response.ok) throw new Error(name + ': ' + response.status);
    await writeFile(file, Buffer.from(await response.arrayBuffer()));
  }));
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
