// Constant gain balances active audio without compression or changing timing.
// Ignore 50 ms windows more than 20 dB below the loudest window (silence).
export function measureWav(buffer) {
  let format, start, length;
  for (let offset = 12; offset + 8 <= buffer.length;) {
    const name = buffer.toString('ascii', offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    if (offset + 8 + size > buffer.length) throw new Error('Truncated WAV');
    if (name === 'fmt ') format = buffer.subarray(offset + 8, offset + 8 + size);
    if (name === 'data') { start = offset + 8; length = size; }
    offset += 8 + size + size % 2;
  }
  if (!format || start === undefined || format.readUInt16LE(0) !== 1) throw new Error('Expected PCM WAV');
  const bits = format.readUInt16LE(14), bytes = bits / 8;
  if (![16, 24].includes(bits)) throw new Error('Expected 16 or 24 bit PCM');
  const scale = 2 ** (bits - 1);
  const windowBytes = Math.round(format.readUInt32LE(4) * .05) * format.readUInt16LE(2) * bytes;
  const windows = [];
  let peak = 0;
  for (let offset = start; offset < start + length;) {
    const end = Math.min(start + length, offset + windowBytes);
    let sum = 0, count = 0;
    for (; offset < end; offset += bytes) {
      const value = buffer.readIntLE(offset, bytes) / scale;
      peak = Math.max(peak, Math.abs(value)); sum += value * value; count++;
    }
    windows.push(sum / count);
  }
  const max = Math.max(...windows);
  const active = windows.filter(value => value > max * .01);
  const rms = active.length ? Math.sqrt(active.reduce((sum, value) => sum + value, 0) / active.length) : 0;
  return { start, length, bytes, scale, peak, rms };
}

export function trimLead(source, seconds) {
  const { start, length, bytes } = measureWav(source);
  let formatOffset;
  for (let offset = 12; offset + 8 <= source.length;) {
    if (source.toString('ascii', offset, offset + 4) === 'fmt ') { formatOffset = offset + 8; break; }
    const size = source.readUInt32LE(offset + 4); offset += 8 + size + size % 2;
  }
  const frames = Math.round(seconds * source.readUInt32LE(formatOffset + 4));
  const cut = frames * source.readUInt16LE(formatOffset + 2) * bytes;
  if (cut < 0 || cut >= length || cut % 2) throw new Error('Invalid leading trim');
  const output = Buffer.concat([source.subarray(0, start), source.subarray(start + cut)]);
  output.writeUInt32LE(output.length - 8, 4);
  output.writeUInt32LE(length - cut, start - 4);
  return output;
}

export function normalizeWav(source) {
  const measurement = measureWav(source);
  const { start, length, bytes, rms, peak } = measurement;
  // -18 dBFS active RMS; at least 1 dB sample-peak headroom.
  const gain = rms ? Math.min(10 ** (-18 / 20) / rms, 10 ** (-1 / 20) / peak) : 1;
  const data = Buffer.from(source);
  for (let offset = start; offset < start + length; offset += bytes) {
    data.writeIntLE(Math.round(source.readIntLE(offset, bytes) * gain), offset, bytes);
  }
  return { data, gainDb: 20 * Math.log10(gain) };
}
