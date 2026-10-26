import { deflateSync } from 'node:zlib';

export function wav(seconds, sample) {
  const rate = 22050, length = Math.floor(seconds * rate), b = Buffer.alloc(44 + length * 2);
  b.write('RIFF'); b.writeUInt32LE(b.length - 8, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28);
  b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(length * 2, 40);
  for (let i = 0; i < length; i++) {
    const t = i / rate, fade = Math.min(1, t * 30, (seconds - t) * 15);
    b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, sample(t) * fade)) * 26000), 44 + i * 2);
  }
  return b;
}
const sin = (f, t) => Math.sin(2 * Math.PI * f * t);
export function effect(id) {
  if (id === 'doors') return wav(2.4, t => t % .6 < .25 ? .42 * sin(880, t) + .12 * sin(1760, t) : 0);
  if (id === 'horn') return wav(2.8, t => ((t < 1.1 || t > 1.45) ? .7 : 0) * (.4 * sin(311, t) + .3 * sin(370, t) + .2 * sin(466, t)));
  return wav(7, t => (.26 * sin(760 + 20 * t, t) + .13 * sin(1150 + 15 * t, t) + .10 * sin(94, t)) * Math.sin(Math.PI * t / 7));
}

function crc32(b) {
  let crc = -1;
  for (const byte of b) { crc ^= byte; for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); }
  return (crc ^ -1) >>> 0;
}
function chunk(type, data) {
  const b = Buffer.alloc(12 + data.length); b.writeUInt32BE(data.length); b.write(type, 4); data.copy(b, 8);
  b.writeUInt32BE(crc32(b.subarray(4, -4)), b.length - 4); return b;
}
export function icon(size) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size;
    let c = [12, 35, 51];
    if (u > .25 && u < .75 && v > .2 && v < .76) c = [241, 239, 223];
    if (u > .29 && u < .71 && v > .30 && v < .51) c = [13, 103, 161];
    if (u > .25 && u < .75 && v > .55 && v < .59) c = [13, 103, 161];
    if (((u - .34) ** 2 + (v - .66) ** 2 < .0015) || ((u - .66) ** 2 + (v - .66) ** 2 < .0015)) c = [238, 173, 69];
    if (v > .76 && v < .84 && (Math.abs(u - (.35 - (v - .76))) < .025 || Math.abs(u - (.65 + (v - .76))) < .025)) c = [241, 239, 223];
    const i = y * (size * 4 + 1) + 1 + x * 4; raw.set([...c, 255], i);
  }
  const h = Buffer.alloc(13); h.writeUInt32BE(size); h.writeUInt32BE(size, 4); h[8] = 8; h[9] = 6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', h), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
