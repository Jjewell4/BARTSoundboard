import { mkdir, readFile, writeFile, cp, readdir, unlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { sounds, archive } from './catalog.mjs';
import { effect, icon } from './effects.mjs';
const demo = process.argv.includes('--demo');
await mkdir('audio', { recursive: true });
await mkdir('dist/audio', { recursive: true });
// Remove obsolete generated audio when a clip is removed from the catalog.
for (const file of await readdir('dist/audio')) {
  if (!sounds.some(sound => sound.file === file)) await unlink(`dist/audio/${file}`);
}
await cp('public', 'dist', { recursive: true });
let archiveHtml;
const catalog = [];
for (const sound of sounds) {
  let data, kind = sound.kind;
  if (!sound.text) data = effect(sound.id);
  else {
    try {
      try { data = await readFile(`audio/${sound.file}`); }
      catch { data = Buffer.from(await readFile(`audio/${sound.file}.b64`, 'utf8'), 'base64'); }
    }
    catch {
      if (demo) {
        catalog.push({ ...sound, kind: 'Demo voice', url: null });
        continue;
      } else {
        try {
          if (!archiveHtml) {
            const index = await fetch(archive, { signal: AbortSignal.timeout(20000) });
            if (!index.ok) throw new Error(`Archive HTTP ${index.status}`);
            archiveHtml = await index.text();
          }
          const links = [...archiveHtml.matchAll(/href=["']([^"']+)["']/gi)].map(m => m[1]);
          const href = links.find(link => decodeURIComponent(link).split('/').pop() === sound.file);
          if (!href) throw new Error('File not found in archive index');
          const url = new URL(href.replaceAll('&amp;', '&'), archive);
          if (url.protocol !== 'https:') throw new Error('Expected HTTPS audio link');
          const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
          if (!response.ok) throw new Error(`Audio HTTP ${response.status}`);
          data = Buffer.from(await response.arrayBuffer());
          await writeFile(`audio/${sound.file}`, data);
        } catch (e) { throw new Error(`Could not download ${sound.file}. Save it from ${archive} into audio/ and rerun npm run build. ${e.message}`); }
      }
    }
  }
  if (data.toString('ascii', 0, 4) !== 'RIFF' || data.toString('ascii', 8, 12) !== 'WAVE') throw new Error(`Invalid WAV: ${sound.file}`);
  await writeFile(`dist/audio/${sound.file}`, data);
  catalog.push({ ...sound, text: undefined, kind, url: `/audio/${sound.file}` });
}
await writeFile('dist/sounds.json', JSON.stringify(catalog));
for (const size of [180, 192, 512]) await writeFile(`dist/icon-${size}.png`, icon(size));
const assets = ['/', '/index.html', '/app.js', '/styles.css', '/sounds.json', '/manifest.webmanifest', '/icon-180.png', '/icon-192.png', '/icon-512.png', ...catalog.map(s => s.url).filter(Boolean)];
const hash = createHash('sha256');
for (const path of assets.filter(p => p !== '/')) hash.update(await readFile(`dist${path}`));
const sw = await readFile('public/sw.js', 'utf8'); hash.update(sw);
await writeFile('dist/sw.js', sw.replace('__VERSION__', hash.digest('hex').slice(0, 12)).replace('__ASSETS__', JSON.stringify(assets)));
console.log(`Built ${catalog.length} sounds (${catalog.filter(s => s.kind === 'Demo voice').length} demo voices). Output: dist/`);
