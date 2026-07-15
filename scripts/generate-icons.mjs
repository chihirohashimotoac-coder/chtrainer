// PWA用アイコンを依存ライブラリなしで生成するスクリプト。
// 独自デザイン(同心円+十字)の抽象的なターゲット図案を描画する。
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const outDir = join(dirname(fileURLToPath(import.meta.url)), "../public/icons");
mkdirSync(outDir, { recursive: true });

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const BG = [13, 34, 41];
const RING1 = [23, 74, 91];
const RING2 = [230, 236, 238];
const RING3 = [216, 106, 66];
const CENTER = [240, 178, 70];
const CROSS = [240, 244, 245];

function drawIcon(size) {
  const buf = Buffer.alloc(size * size * 4);
  const c = size / 2;
  const rMax = size * 0.42;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - c;
      const dy = y + 0.5 - c;
      const r = Math.hypot(dx, dy) / rMax;
      let col = BG;
      if (r <= 1.0) {
        if (r <= 0.16) col = CENTER;
        else if (r <= 0.34) col = RING3;
        else if (r <= 0.56) col = RING2;
        else if (r <= 0.8) col = RING1;
        else col = RING2;
      }
      // 十字カーソル
      const cw = size * 0.018;
      const clen = size * 0.47;
      if (
        (Math.abs(dx) < cw && Math.abs(dy) < clen && r > 0.2) ||
        (Math.abs(dy) < cw && Math.abs(dx) < clen && r > 0.2)
      ) {
        col = CROSS;
      }
      const i = (y * size + x) * 4;
      buf[i] = col[0];
      buf[i + 1] = col[1];
      buf[i + 2] = col[2];
      buf[i + 3] = 255;
    }
  }
  return png(size, size, buf);
}

for (const size of [192, 512]) {
  writeFileSync(join(outDir, `icon-${size}.png`), drawIcon(size));
  console.log(`generated icon-${size}.png`);
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
<rect width="100" height="100" fill="#0d2229"/>
<circle cx="50" cy="50" r="42" fill="#e6ecee"/>
<circle cx="50" cy="50" r="33.6" fill="#174a5b"/>
<circle cx="50" cy="50" r="23.5" fill="#e6ecee"/>
<circle cx="50" cy="50" r="14.3" fill="#d86a42"/>
<circle cx="50" cy="50" r="6.7" fill="#f0b246"/>
<rect x="49.2" y="3" width="1.6" height="94" fill="#f0f4f5"/>
<rect x="3" y="49.2" width="94" height="1.6" fill="#f0f4f5"/>
</svg>
`;
writeFileSync(join(outDir, "icon.svg"), svg);
console.log("generated icon.svg");
