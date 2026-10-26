import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { sounds } from '../scripts/catalog.mjs';

test('production soundboard contains all six supplied recordings', async () => {
  const catalog = JSON.parse(await readFile('dist/sounds.json', 'utf8'));
  assert.equal(catalog.length, 9);
  assert.equal(catalog.filter(s => s.kind === 'BART announcement').length, 6);
  for (const sound of catalog) {
    const wav = await readFile(`dist${sound.url}`);
    assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
    assert.equal(wav.toString('ascii', 8, 12), 'WAVE');
  }
  assert.equal(new Set(sounds.map(s => s.id)).size, sounds.length);
});

const source = await readFile('dist/sw.js', 'utf8');
function worker() {
  const events = {};
  const bytes = Uint8Array.from({ length: 100 }, (_, n) => n);
  vm.runInNewContext(source, {
    self: { addEventListener: (name, callback) => { events[name] = callback; }, location: { origin: 'https://party.test' } },
    caches: { open: async () => ({ match: async () => new Response(bytes, { headers: { 'Content-Type': 'audio/wav' } }) }) },
    Response, URL, fetch: () => { throw new Error('Offline: network must not be used'); }
  });
  return async range => {
    let response;
    events.fetch({ request: new Request('https://party.test/audio/horn.wav', { headers: range ? { Range: range } : {} }), respondWith: p => { response = p; } });
    return response;
  };
}
test('offline Safari byte ranges return the correct audio bytes', async () => {
  const fetch = worker();
  for (const [range, start, end] of [['bytes=0-1', 0, 1], ['bytes=20-', 20, 99], ['bytes=-10', 90, 99], ['bytes=90-200', 90, 99]]) {
    const response = await fetch(range);
    assert.equal(response.status, 206);
    assert.equal(response.headers.get('content-range'), `bytes ${start}-${end}/100`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    assert.equal(bytes.length, end - start + 1); assert.equal(bytes[0], start); assert.equal(bytes.at(-1), end);
  }
});
test('invalid audio ranges return 416 and complete audio works offline', async () => {
  const fetch = worker();
  for (const range of ['bytes=200-', 'bytes=30-10', 'bytes=-', 'bytes=0-1,4-5']) assert.equal((await fetch(range)).status, 416);
  assert.equal((await fetch()).status, 200);
});
