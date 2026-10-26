import { readFile, writeFile } from 'node:fs/promises';
// Usage: node scripts/trim-wav.mjs input.wav output.wav startSeconds endSeconds
const [input, output, startText, endText] = process.argv.slice(2);
const start = Number(startText), end = Number(endText);
if (!input || !output || !Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start) throw new Error('Expected input.wav output.wav startSeconds endSeconds');
const source = await readFile(input);
if (source.toString('ascii', 0, 4) !== 'RIFF' || source.toString('ascii', 8, 12) !== 'WAVE') throw new Error('Expected RIFF WAV');
let format, samples;
for (let offset = 12; offset + 8 <= source.length;) {
  const name = source.toString('ascii', offset, offset + 4), length = source.readUInt32LE(offset + 4);
  if (offset + 8 + length > source.length) throw new Error('Truncated WAV');
  if (name === 'fmt ') format = source.subarray(offset + 8, offset + 8 + length);
  if (name === 'data') samples = source.subarray(offset + 8, offset + 8 + length);
  offset += 8 + length + length % 2;
}
if (!format || !samples || format.readUInt16LE(0) !== 1) throw new Error('Expected uncompressed PCM WAV');
const rate = format.readUInt32LE(4), frameBytes = format.readUInt16LE(12);
if (end > samples.length / frameBytes / rate) throw new Error('End is beyond the recording');
const clip = samples.subarray(Math.floor(start * rate) * frameBytes, Math.floor(end * rate) * frameBytes);
// Preserve the exact PCM sample bytes and format. Discard source metadata chunks.
const header = Buffer.alloc(44);
header.write('RIFF'); header.writeUInt32LE(36 + clip.length + clip.length % 2, 4); header.write('WAVEfmt ', 8);
header.writeUInt32LE(16, 16); format.copy(header, 20, 0, 16); header.write('data', 36); header.writeUInt32LE(clip.length, 40);
await writeFile(output, Buffer.concat([header, clip, Buffer.alloc(clip.length % 2)]));
console.log(`${output}: ${start}–${end}s (${(clip.length / frameBytes / rate).toFixed(3)}s), original PCM preserved.`);
