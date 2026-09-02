// Generates the app icons as PNGs with no dependencies.
// Run: node build-icons.mjs
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

const BG = [0x0e, 0x5c, 0x43];      // deep emerald
const RING = [0xfb, 0xfc, 0xfa];    // cream
const GEM = [0xcf, 0xa2, 0x5a];     // brass

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = c ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size, pixels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;    // bit depth
  ihdr[9] = 6;    // RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  let p = 0;
  for (let y = 0; y < size; y++) {
    raw[p++] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      raw[p++] = pixels[i];
      raw[p++] = pixels[i + 1];
      raw[p++] = pixels[i + 2];
      raw[p++] = pixels[i + 3];
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// Coverage of the ring + gem at a point, sampled 4x4 for smooth edges.
function coverage(px, py, s) {
  const cx = 0.5 * s, cy = 0.585 * s;
  const r = 0.235 * s, half = 0.0275 * s;      // ring radius and half-thickness
  const gemW = 0.15 * s, gemTop = 0.215 * s, gemBot = 0.325 * s;

  let ring = 0, gem = 0;
  for (let sy = 0; sy < 4; sy++) {
    for (let sx = 0; sx < 4; sx++) {
      const x = px + (sx + 0.5) / 4;
      const y = py + (sy + 0.5) / 4;
      const d = Math.hypot(x - cx, y - cy);
      if (Math.abs(d - r) <= half) ring++;
      // gem: a triangle narrowing downward toward the band
      if (y >= gemTop && y <= gemBot) {
        const t = (y - gemTop) / (gemBot - gemTop);
        const w = (gemW / 2) * (1 - t * 0.72);
        if (Math.abs(x - cx) <= w) gem++;
      }
    }
  }
  return { ring: ring / 16, gem: gem / 16 };
}

function render(size) {
  const px = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const { ring, gem } = coverage(x, y, size);
      let col = BG;
      let a = 1;
      if (gem > 0) {
        const m = Math.min(1, gem);
        col = [
          Math.round(BG[0] * (1 - m) + GEM[0] * m),
          Math.round(BG[1] * (1 - m) + GEM[1] * m),
          Math.round(BG[2] * (1 - m) + GEM[2] * m),
        ];
      }
      if (ring > 0) {
        const m = Math.min(1, ring);
        col = [
          Math.round(col[0] * (1 - m) + RING[0] * m),
          Math.round(col[1] * (1 - m) + RING[1] * m),
          Math.round(col[2] * (1 - m) + RING[2] * m),
        ];
      }
      const i = (y * size + x) * 4;
      px[i] = col[0]; px[i + 1] = col[1]; px[i + 2] = col[2]; px[i + 3] = Math.round(a * 255);
    }
  }
  return png(size, px);
}

for (const size of [180, 192, 512]) {
  const file = `icon-${size}.png`;
  writeFileSync(file, render(size));
  console.log("wrote", file);
}
