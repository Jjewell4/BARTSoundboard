import { readFile, writeFile } from 'node:fs/promises';
const [first, second, output] = process.argv.slice(2);
if (!first || !second || !output) throw new Error('Usage: node scripts/combine-wav.mjs first.wav second.wav output.wav');
async function load(path) {
  const b = await readFile(path); let format, data;
  for (let o = 12; o + 8 <= b.length;) {
    const id = b.toString('ascii', o, o + 4), n = b.readUInt32LE(o + 4);
    if (id === 'fmt ') format = b.subarray(o + 8, o + 24);
    if (id === 'data') data = b.subarray(o + 8, o + 8 + n);
    o += 8 + n + n % 2;
  }
  if (!format || !data || format.readUInt16LE(0) !== 1 || format.readUInt16LE(14) !== 16) throw new Error('Expected 16-bit PCM WAV');
  return { format, data };
}
const a = await load(first), b = await load(second);
if (!a.format.equals(b.format)) throw new Error('WAV formats must match');
const rate = a.format.readUInt32LE(4), block = a.format.readUInt16LE(12);
// Remove only the silence at the join; preserve a short cushion around speech.
let end = a.data.length / block, start = 0;
const quiet = (data, frame) => {
  for (let c = 0; c < block; c += 2) if (Math.abs(data.readInt16LE(frame * block + c)) > 128) return false;
  return true;
};
while (end > 0 && quiet(a.data, end - 1)) end--;
while (start < b.data.length / block && quiet(b.data, start)) start++;
end = Math.min(a.data.length / block, end + Math.round(rate * .025));
start = Math.max(0, start - Math.round(rate * .025));
const data = Buffer.concat([a.data.subarray(0, end * block), b.data.subarray(start * block)]);
const header = Buffer.alloc(44); header.write('RIFF'); header.writeUInt32LE(36 + data.length, 4); header.write('WAVEfmt ', 8);
header.writeUInt32LE(16, 16); a.format.copy(header, 20); header.write('data', 36); header.writeUInt32LE(data.length, 40);
await writeFile(output, Buffer.concat([header, data]));
console.log(`${output}: ${(data.length / block / rate).toFixed(3)}s; joined first through ${(end / rate).toFixed(3)}s to second from ${(start / rate).toFixed(3)}s.`);
