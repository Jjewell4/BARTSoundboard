import { deflateSync } from 'node:zlib';

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
