import { mkdir, readFile, writeFile, cp, readdir, unlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { sounds } from './catalog.mjs';
import { normalizeWav, trimLead } from './normalize-wav.mjs';
import { icon } from './effects.mjs';
await mkdir('dist/audio', { recursive: true });
for (const file of await readdir('dist/audio')) {
  if (!sounds.some(sound => sound.file === file)) await unlink(`dist/audio/${file}`);
}
await cp('public', 'dist', { recursive: true });
const catalog = [];
for (const sound of sounds) {
  let data;
  try { data = await readFile(`audio/${sound.file}`); }
  catch {
    try { data = Buffer.from(await readFile(`audio/${sound.file}.b64`, 'utf8'), 'base64'); }
    catch { throw new Error(`Missing supplied recording: ${sound.file}. Add it to audio/ before building.`); }
  }
  if (data.toString('ascii', 0, 4) !== 'RIFF' || data.toString('ascii', 8, 12) !== 'WAVE') throw new Error(`Invalid WAV: ${sound.file}`);
  if (['next', 'sfo'].includes(sound.id)) data = trimLead(data, 1);
  const normalized = normalizeWav(data);
  console.log(`${sound.title}: ${normalized.gainDb.toFixed(1)} dB volume adjustment`);
  await writeFile(`dist/audio/${sound.file}`, normalized.data);
  catalog.push({ ...sound, url: `/audio/${sound.file}` });
}
await writeFile('dist/sounds.json', JSON.stringify(catalog));
for (const size of [16, 32, 180, 192, 512]) await writeFile(`dist/bp-icon-${size}.png`, icon(size));
const assets = ['/', '/index.html', '/app.js', '/styles.css', '/signage.css', '/sounds.json', '/manifest.webmanifest', '/bp-icon-16.png', '/bp-icon-32.png', '/bp-icon-180.png', '/bp-icon-192.png', '/bp-icon-512.png', ...catalog.map(s => s.url)];
const hash = createHash('sha256');
for (const path of assets.filter(p => p !== '/')) hash.update(await readFile(`dist${path}`));
const sw = await readFile('public/sw.js', 'utf8'); hash.update(sw);
await writeFile('dist/sw.js', sw.replace('__VERSION__', hash.digest('hex').slice(0, 12)).replace('__ASSETS__', JSON.stringify(assets)));
console.log(`Built ${catalog.length} supplied recordings. Output: dist/`);
