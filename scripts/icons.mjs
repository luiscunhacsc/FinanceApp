// Ícone geométrico original, sem dependências externas ou imagens de terceiros.
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
const crc32 = bytes => {
  let value = 0xffffffff;
  for (const byte of bytes) { value ^= byte; for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ (0xedb88320 & -(value & 1)); }
  return (value ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const name = Buffer.from(type); const result = Buffer.alloc(data.length + 12);
  result.writeUInt32BE(data.length, 0); name.copy(result, 4); data.copy(result, 8);
  result.writeUInt32BE(crc32(Buffer.concat([name, data])), data.length + 8); return result;
};
for (const size of [192, 512]) {
  const rows = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const xx = x / size * 512; const yy = y / size * 512;
    const bar = yy >= 128 && yy < 352 && ((xx >= 136 && xx < 200 && yy >= 256) || (xx >= 224 && xx < 288 && yy >= 184) || (xx >= 312 && xx < 376));
    const index = y * (size * 4 + 1) + 1 + x * 4;
    rows[index] = bar ? 255 : 23; rows[index + 1] = bar ? 255 : 100; rows[index + 2] = bar ? 255 : 85; rows[index + 3] = 255;
  }
  const header = Buffer.alloc(13); header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 6;
  writeFileSync(new URL(`../apps/web/public/icon-${size}.png`, import.meta.url), Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', header), chunk('IDAT', deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]));
}
