import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { measureWav } from '../scripts/normalize-wav.mjs';
import { sounds } from '../scripts/catalog.mjs';

test('production soundboard contains only the supplied recordings and excerpts', async () => {
  const catalog = JSON.parse(await readFile('dist/sounds.json', 'utf8'));
  assert.equal(catalog.length, 8);
  assert.equal(catalog.filter(s => s.kind === 'BART announcement').length, 6);
  assert.ok(catalog.every(s => ['BART announcement', 'Field recording'].includes(s.kind)));
  for (const sound of catalog) {
    const wav = await readFile(`dist${sound.url}`);
    assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
    assert.equal(wav.toString('ascii', 8, 12), 'WAVE');
    const original = Buffer.from(await readFile(`audio/${sound.file}.b64`, 'utf8'), 'base64');
    const before = measureWav(original), after = measureWav(wav);
    assert.equal(wav.length, original.length, 'duration and format preserved');
    assert.deepEqual(wav.subarray(0, after.start), original.subarray(0, before.start));
    assert.ok(after.peak <= 10 ** (-1 / 20) + 1 / after.scale, 'peak headroom');
    assert.ok(Math.abs(20 * Math.log10(after.rms) + 18) < .1, 'balanced active level');
    const gain = after.rms / before.rms;
    for (let offset = before.start; offset < before.start + before.length; offset += before.bytes) {
      assert.ok(Math.abs(wav.readIntLE(offset, before.bytes) - original.readIntLE(offset, before.bytes) * gain) < 2, 'constant gain preserves waveform');
    }
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
    events.fetch({ request: new Request('https://party.test/audio/Next_Station_AF.wav', { headers: range ? { Range: range } : {} }), respondWith: p => { response = p; } });
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
