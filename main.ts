// News Image — 24 November 2026 (v2 rebuild, all code written fresh).
// Node 22, standard library only. Draws one 1024x1024 PNG to /output/entry.png
// (or $MAKEFUN_OUTPUT_DIR). No network. Deterministic: two runs are byte-identical.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

const W = 1024;
const H = 1024;
const buf = new Uint8Array(W * H * 3);

// ---------- palette ----------
const PAPER = [247, 243, 232];
const INK = [26, 26, 26];
const NAVY = [20, 33, 61];
const RED = [180, 35, 24];
const BLUE = [29, 78, 216];
const GOLD = [183, 121, 31];
const GREEN = [21, 128, 61];
const TEAL = [15, 118, 110];
const GREY = [107, 114, 128];
const LINE = [216, 210, 192];
const SKY = [214, 232, 240];
const SEA = [38, 84, 124];
const DARK = [16, 22, 34];

// ---------- pixel primitives ----------
function px(x, y, c) {
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2];
}
function rect(x, y, w, h, c) {
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) px(i, j, c);
}
function hline(x0, x1, y, c) { for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) px(x, y, c); }
function vline(x, y0, y1, c) { for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) px(x, y, c); }
function line(x0, y0, x1, y1, c) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy, x = x0, y = y0;
  for (;;) { px(x, y, c); if (x === x1 && y === y1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x += sx; } if (e2 <= dx) { err += dx; y += sy; } }
}
function circle(cx, cy, r, c) {
  cx = Math.round(cx); cy = Math.round(cy);
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
    if (x * x + y * y <= r * r) px(cx + x, cy + y, c);
  }
}
function tri(x0, y0, x1, y1, x2, y2, c) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1); x2 = Math.round(x2); y2 = Math.round(y2);
  const minX = Math.min(x0, x1, x2), maxX = Math.max(x0, x1, x2);
  const minY = Math.min(y0, y1, y2), maxY = Math.max(y0, y1, y2);
  const d = (x1 - x0) * (y2 - y0) - (y1 - y0) * (x2 - x0);
  if (d === 0) return;
  for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
    const a = ((x1 - x) * (y2 - y) - (y1 - y) * (x2 - x)) / d;
    const b = ((x2 - x) * (y0 - y) - (y2 - y) * (x0 - x)) / d;
    const g = 1 - a - b;
    if (a >= 0 && b >= 0 && g >= 0) px(x, y, c);
  }
}
function ring(cx, cy, r, c) {
  for (let a = 0; a < 360; a += 2) {
    const t = a * Math.PI / 180;
    px(Math.round(cx + r * Math.cos(t)), Math.round(cy + r * Math.sin(t)), c);
  }
}

// ---------- 5x7 bitmap font ----------
const FONT = {
  'A': ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  'B': ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  'C': ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
  'D': ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  'E': ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  'F': ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  'G': ['01110', '10001', '10000', '10111', '10001', '10001', '01111'],
  'H': ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  'I': ['01110', '00100', '00100', '00100', '00100', '00100', '01110'],
  'J': ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
  'K': ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  'L': ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  'M': ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  'N': ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  'O': ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  'P': ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  'Q': ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  'R': ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  'S': ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  'T': ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  'U': ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  'V': ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  'W': ['10001', '10001', '10001', '10101', '10101', '10101', '01010'],
  'X': ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  'Y': ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  'Z': ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00110', '01000', '10000', '11111'],
  '3': ['11111', '00010', '00100', '00010', '00001', '10001', '01110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  'a': ['00000', '00000', '01110', '00001', '01111', '10001', '01111'],
  'b': ['10000', '10000', '11110', '10001', '10001', '10001', '11110'],
  'c': ['00000', '00000', '01110', '10000', '10000', '10001', '01110'],
  'd': ['00001', '00001', '01111', '10001', '10001', '10001', '01111'],
  'e': ['00000', '00000', '01110', '10001', '11111', '10000', '01110'],
  'f': ['00110', '01001', '01000', '11110', '01000', '01000', '01000'],
  'g': ['00000', '01111', '10001', '10001', '01111', '00001', '01110'],
  'h': ['10000', '10000', '11110', '10001', '10001', '10001', '10001'],
  'i': ['00100', '00000', '01100', '00100', '00100', '00100', '01110'],
  'j': ['00010', '00000', '00010', '00010', '00010', '00010', '01100'],
  'k': ['10000', '10000', '10010', '10100', '11000', '10100', '10010'],
  'l': ['01100', '00100', '00100', '00100', '00100', '00100', '01110'],
  'm': ['00000', '00000', '11010', '10101', '10101', '10101', '10101'],
  'n': ['00000', '00000', '11110', '10001', '10001', '10001', '10001'],
  'o': ['00000', '00000', '01110', '10001', '10001', '10001', '01110'],
  'p': ['00000', '11110', '10001', '10001', '11110', '10000', '10000'],
  'q': ['00000', '01111', '10001', '10001', '01111', '00001', '00001'],
  'r': ['00000', '00000', '10110', '11001', '10000', '10000', '10000'],
  's': ['00000', '00000', '01111', '10000', '01110', '00001', '11110'],
  't': ['00100', '00100', '11110', '00100', '00100', '00100', '00011'],
  'u': ['00000', '00000', '10001', '10001', '10001', '10011', '01101'],
  'v': ['00000', '00000', '10001', '10001', '10001', '01010', '00100'],
  'w': ['00000', '00000', '10001', '10001', '10101', '10101', '01010'],
  'x': ['00000', '00000', '10001', '01010', '00100', '01010', '10001'],
  'y': ['00000', '00000', '10001', '10001', '01111', '00001', '01110'],
  'z': ['00000', '00000', '11111', '00010', '00100', '01000', '11111'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
  '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'],
  ',': ['00000', '00000', '00000', '00000', '01100', '00100', '01000'],
  ':': ['00000', '01100', '01100', '00000', '01100', '01100', '00000'],
  ';': ['00000', '01100', '01100', '00000', '01100', '00100', '01000'],
  '!': ['00100', '00100', '00100', '00100', '00100', '00000', '00100'],
  '?': ['01110', '10001', '00001', '00110', '00100', '00000', '00100'],
  "'": ['00100', '00100', '01000', '00000', '00000', '00000', '00000'],
  '"': ['01010', '01010', '01010', '00000', '00000', '00000', '00000'],
  '-': ['00000', '00000', '00000', '01110', '00000', '00000', '00000'],
  '(': ['00010', '00100', '01000', '01000', '01000', '00100', '00010'],
  ')': ['01000', '00100', '00010', '00010', '00010', '00100', '01000'],
  '/': ['00001', '00010', '00010', '00100', '01000', '01000', '10000'],
  '%': ['11001', '11010', '00010', '00100', '01000', '01011', '10011'],
  '+': ['00000', '00100', '00100', '01110', '00100', '00100', '00000'],
  '&': ['01100', '10010', '10100', '01000', '10101', '10010', '01101'],
  '$': ['00100', '01111', '10100', '01110', '00101', '11110', '00100'],
  '#': ['01010', '01010', '11111', '01010', '11111', '01010', '01010'],
  '@': ['01110', '10001', '10111', '10101', '10110', '10000', '01110'],
  '*': ['00000', '10101', '01110', '10101', '00000', '00000', '00000'],
  '=': ['00000', '00000', '11111', '00000', '11111', '00000', '00000'],
  '•': ['00000', '00000', '01100', '01100', '01100', '00000', '00000'],
  '×': ['00000', '10001', '01010', '00100', '01010', '10001', '00000'],
};

function norm(s) {
  return s.replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/[–]/g, '-').replace(/—/g, '-').replace(/…/g, '...');
}
function textW(s, sc) {
  return norm(s).length * 6 * sc - sc;
}
function text(s, x, y, sc, c) {
  s = norm(s);
  for (let ci = 0; ci < s.length; ci++) {
    const g = FONT[s[ci]] || FONT['?'];
    const ox = x + ci * 6 * sc;
    for (let r = 0; r < 7; r++) for (let col = 0; col < 5; col++) {
      if (g[r][col] === '1') rect(ox + col * sc, y + r * sc, sc, sc, c);
    }
  }
}
function textC(s, cx, y, sc, c) { text(s, Math.round(cx - textW(s, sc) / 2), y, sc, c); }
function wrap(s, maxW, sc) {
  const words = norm(s).split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (textW(t, sc) <= maxW) cur = t;
    else { if (cur) lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines;
}

// ---------- PNG encoder (RGB, filter 0, zlib) ----------
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  return t;
})();
function crc32(b) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < b.length; i++) c = CRC_TABLE[(c ^ b[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'ascii'), data])), 8 + data.length);
  return out;
}
function encodePNG() {
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0;
    raw.set(buf.subarray(y * W * 3, (y + 1) * W * 3), y * (1 + W * 3) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// ---------- scenes ----------
// Every scene draws inside (x, y, w, h). All vector shapes, no images.

// HERO 1 — Gulf: tanker burning under a missile arc, radar dome, dark sea.
function sceneGulf(x, y, w, h) {
  rect(x, y, w, h, [13, 20, 36]);
  for (let i = 0; i < 40; i++) { const sx = x + ((i * 97) % w); const sy = y + ((i * 53) % 40); px(sx, sy, [200, 210, 230]); }
  circle(x + w - 52, y + 34, 22, [232, 228, 210]); // moon
  circle(x + w - 52, y + 34, 18, [240, 236, 220]);
  // missile arc (dotted parabola) + missile
  for (let t = 0; t <= 20; t++) {
    const ax = x + 20 + (t / 20) * (w - 90);
    const ay = y + (h - 10) - Math.sin((t / 20) * Math.PI) * (h - 40);
    if (t % 2 === 0) circle(ax, ay, 2, [255, 200, 90]);
  }
  tri(x + w - 78, y + 52, x + w - 66, y + 44, x + w - 70, y + 60, [255, 220, 120]);
  // sea
  rect(x, y + h - 62, w, 62, [16, 48, 74]);
  for (let i = 0; i < 8; i++) hline(x + ((i * 131) % (w - 60)), x + ((i * 131) % (w - 60)) + 44, y + h - 48 + (i % 3) * 14, [60, 120, 160]);
  // tanker hull + superstructure
  rect(x + 28, y + h - 96, w - 120, 34, [24, 24, 28]);
  rect(x + 28, y + h - 118, 52, 22, [40, 40, 48]);
  rect(x + 88, y + h - 112, 10, 16, [40, 40, 48]);
  rect(x + 106, y + h - 112, 10, 16, [40, 40, 48]);
  rect(x + 124, y + h - 112, 10, 16, [40, 40, 48]);
  for (let i = 0; i < 6; i++) rect(x + 40 + i * 30, y + h - 90, 12, 8, [255, 200, 90]);
  // flames on the tanker
  tri(x + 150, y + h - 96, x + 168, y + h - 126, x + 186, y + h - 96, [255, 120, 20]);
  tri(x + 168, y + h - 96, x + 182, y + h - 114, x + 196, y + h - 96, [255, 200, 60]);
  tri(x + 210, y + h - 96, x + 224, y + h - 110, x + 238, y + h - 96, [255, 120, 20]);
  circle(x + 168, y + h - 128, 7, [120, 120, 120]);
  circle(x + 190, y + h - 120, 5, [140, 140, 140]);
  // radar dome on the right
  circle(x + w - 40, y + h - 84, 16, [220, 224, 230]);
  rect(x + w - 42, y + h - 68, 4, 8, [180, 184, 190]);
  line(x + w - 40, y + h - 84, x + w - 22, y + h - 100, [255, 220, 120]);
}

// HERO 2 — Nvidia: green chip, soaring chart, record gain.
function sceneNvidia(x, y, w, h) {
  rect(x, y, w, h, [10, 26, 18]);
  for (let i = 0; i < 12; i++) vline(x + 20 + i * 26, y + 10, y + h - 10, [18, 44, 30]);
  // soaring chart line
  const pts = [[0, 0.78], [0.18, 0.72], [0.36, 0.76], [0.55, 0.55], [0.72, 0.38], [0.9, 0.12]];
  for (let i = 0; i < pts.length - 1; i++) {
    line(x + pts[i][0] * w, y + pts[i][1] * h, x + pts[i + 1][0] * w, y + pts[i + 1][1] * h, [34, 197, 94]);
    line(x + pts[i][0] * w, y + pts[i][1] * h + 2, x + pts[i + 1][0] * w, y + pts[i + 1][1] * h + 2, [34, 197, 94]);
  }
  for (const p of pts) circle(x + p[0] * w, y + p[1] * h, 4, [134, 239, 172]);
  tri(x + w - 52, y + 18, x + w - 30, y + 18, x + w - 41, y + 40, [34, 197, 94]);
  // chip
  rect(x + 24, y + h - 92, 96, 72, [22, 90, 54]);
  rect(x + 34, y + h - 82, 76, 52, [16, 64, 38]);
  rect(x + 52, y + h - 66, 40, 20, [34, 197, 94]);
  for (let i = 0; i < 5; i++) { hline(x + 14, x + 24, y + h - 84 + i * 14, [120, 200, 150]); hline(x + 120, x + 130, y + h - 84 + i * 14, [120, 200, 150]); }
  text('NVDA', x + 150, y + h - 58, 2, [220, 255, 230]);
  text('+31%', x + 150, y + h - 34, 3, [74, 222, 128]);
}

// HERO 3 — Chess: board, two kings, clock, 0.5-0.5.
function sceneChess(x, y, w, h) {
  rect(x, y, w, h, [58, 44, 30]);
  const bx = x + 14, by = y + 8, s = 16;
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    rect(bx + c * s, by + r * s, s, s, (r + c) % 2 === 0 ? [238, 220, 180] : [122, 88, 58]);
  }
  // white king (crown + body)
  circle(bx + 3 * s + 9, by + 2 * s + 7, 7, [245, 245, 245]);
  tri(bx + 3 * s + 2, by + 2 * s + 8, bx + 3 * s + 17, by + 2 * s + 8, bx + 3 * s + 9, by + 2 * s + 16, [245, 245, 245]);
  rect(bx + 3 * s + 3, by + 2 * s + 15, 14, 3, [245, 245, 245]);
  // black king
  circle(bx + 5 * s + 9, by + 5 * s + 7, 7, [30, 30, 34]);
  tri(bx + 5 * s + 2, by + 5 * s + 8, bx + 5 * s + 17, by + 5 * s + 8, bx + 5 * s + 9, by + 5 * s + 16, [30, 30, 34]);
  rect(bx + 5 * s + 3, by + 5 * s + 15, 14, 3, [30, 30, 34]);
  // clock
  circle(x + w - 62, y + h - 34, 22, [240, 236, 224]);
  ring(x + w - 62, y + h - 34, 22, [40, 40, 40]);
  line(x + w - 62, y + h - 34, x + w - 62, y + h - 50, [180, 35, 24]);
  line(x + w - 62, y + h - 34, x + w - 48, y + h - 28, [26, 26, 26]);
  text('0.5-0.5', x + 150, y + h - 26, 2, [255, 255, 255]);
}

// MAIN 1 — COP31: cracked globe, no deal.
function sceneCop(x, y, w, h) {
  rect(x, y, w, h, [30, 58, 92]);
  text('NO DEAL', x + w / 2 - 21, y + 2, 1, [255, 120, 100]);
  const cx = x + w / 2, cy = y + h / 2 + 6;
  circle(cx, cy, 20, [46, 120, 70]);
  circle(cx - 8, cy - 8, 7, [46, 120, 70]);
  circle(cx + 9, cy + 9, 6, [46, 120, 70]);
  ring(cx, cy, 20, [220, 225, 235]);
  line(cx - 4, cy - 18, cx + 2, cy - 4, [220, 60, 40]);
  line(cx + 2, cy - 4, cx - 5, cy + 8, [220, 60, 40]);
  line(cx - 5, cy + 8, cx + 4, cy + 18, [220, 60, 40]);
}

// MAIN 2 — Senegal: gold trophy and ball.
function sceneTrophy(x, y, w, h) {
  rect(x, y, w, h, [18, 90, 52]);
  rect(x + w / 2 - 16, y + 8, 32, 22, [240, 200, 60]);
  tri(x + w / 2 - 16, y + 30, x + w / 2 + 16, y + 30, x + w / 2, y + 40, [240, 200, 60]);
  rect(x + w / 2 - 3, y + 40, 6, 8, [220, 180, 40]);
  rect(x + w / 2 - 10, y + 48, 20, 4, [220, 180, 40]);
  circle(x + w / 2 - 20, y + 18, 5, [240, 200, 60]);
  circle(x + w / 2 + 20, y + 18, 5, [240, 200, 60]);
  circle(x + w - 18, y + h - 12, 9, [245, 245, 245]);
  circle(x + w - 18, y + h - 12, 4, [30, 30, 30]);
}

// MAIN 3 — Ukraine: warship, drones, explosion.
function sceneShip(x, y, w, h) {
  rect(x, y, w, h, [20, 30, 52]);
  rect(x, y + h - 18, w, 18, [16, 48, 74]);
  rect(x + 12, y + h - 34, w - 40, 14, [70, 74, 82]);
  tri(x + w - 30, y + h - 34, x + w - 12, y + h - 34, x + w - 20, y + h - 48, [70, 74, 82]);
  rect(x + 30, y + h - 46, 6, 14, [90, 94, 102]);
  for (let i = 0; i < 3; i++) { circle(x + 20 + i * 22, y + 12 + i * 6, 3, [255, 220, 120]); px(x + 20 + i * 22 + 5, y + 13 + i * 6, [255, 220, 120]); }
  tri(x + 58, y + 26, x + 66, y + 12, x + 74, y + 26, [255, 150, 40]);
  tri(x + 62, y + 28, x + 66, y + 18, x + 70, y + 28, [255, 220, 90]);
}

// MAIN 4 — Champions League: pitch, goal, scoreboard 5-1.
function sceneUcl(x, y, w, h) {
  rect(x, y, w, h, [16, 96, 44]);
  hline(x + 6, x + w - 6, y + h - 14, [240, 240, 240]);
  circle(x + w / 2, y + h - 14, 8, [240, 240, 240]);
  rect(x + 8, y + 6, 34, 16, [16, 22, 34]);
  text('5-1', x + 12, y + 9, 1, [255, 255, 255]);
  circle(x + w - 22, y + h - 22, 8, [245, 245, 245]);
  circle(x + w - 22, y + h - 22, 3, [30, 30, 30]);
  line(x + 14, y + h - 30, x + w - 30, y + h - 44, [255, 255, 255]);
}

// MAIN 5 — Brentford: goal, ball, red card.
function sceneGoal(x, y, w, h) {
  rect(x, y, w, h, [20, 110, 60]);
  rect(x + 10, y + 12, 44, 22, [245, 245, 245]);
  for (let i = 0; i < 4; i++) vline(x + 18 + i * 10, y + 14, y + 32, [180, 180, 180]);
  hline(x + 12, x + 52, y + 22, [180, 180, 180]);
  rect(x + w - 24, y + 8, 12, 18, [200, 30, 20]);
  circle(x + w / 2, y + h - 14, 8, [245, 245, 245]);
  circle(x + w / 2, y + h - 14, 3, [30, 30, 30]);
  text('4-0', x + 10, y + h - 12, 1, [255, 255, 255]);
}

// MAIN 6 — Cricket: bat, ball, stumps, 720.
function sceneCricket(x, y, w, h) {
  rect(x, y, w, h, [34, 110, 60]);
  rect(x + 8, y + h - 12, w - 16, 4, [220, 190, 130]);
  rect(x + 14, y + 10, 10, 26, [210, 170, 110]);
  rect(x + 17, y + 36, 4, 12, [150, 110, 60]);
  circle(x + w - 18, y + 16, 7, [190, 40, 30]);
  for (let i = 0; i < 3; i++) vline(x + w - 40 + i * 5, y + h - 24, y + h - 12, [240, 220, 80]);
  hline(x + w - 41, x + w - 27, y + h - 26, [240, 220, 80]);
  text('720', x + 8, y + h - 12, 1, [255, 255, 255]);
}

// MAIN 7 — Nepal quake: mountains, crack, dust.
function sceneQuake(x, y, w, h) {
  rect(x, y, w, h, [214, 228, 236]);
  tri(x + 4, y + h - 10, x + 30, y + 8, x + 56, y + h - 10, [120, 128, 140]);
  tri(x + 30, y + h - 10, x + 56, y + 16, x + 82, y + h - 10, [90, 98, 112]);
  tri(x + 28, y + 12, x + 32, y + 6, x + 36, y + 12, [255, 255, 255]);
  line(x + 44, y + 10, x + 50, y + 26, [120, 60, 40]);
  line(x + 50, y + 26, x + 44, y + 40, [120, 60, 40]);
  circle(x + 70, y + 14, 2, [120, 110, 100]); circle(x + 76, y + 20, 2, [120, 110, 100]);
  text('M5.3', x + 6, y + h - 11, 1, [26, 26, 26]);
}

// MAIN 8 — Seoul: radar, jet, island.
function sceneRadar(x, y, w, h) {
  rect(x, y, w, h, [16, 26, 44]);
  circle(x + 26, y + h / 2, 18, [30, 90, 70]);
  ring(x + 26, y + h / 2, 18, [90, 220, 160]);
  ring(x + 26, y + h / 2, 11, [90, 220, 160]);
  line(x + 26, y + h / 2, x + 40, y + h / 2 - 12, [140, 240, 190]);
  tri(x + 58, y + 12, x + 74, y + 18, x + 58, y + 24, [200, 205, 215]);
  rect(x + 50, y + h - 14, 34, 8, [46, 120, 70]);
  text('KADIZ', x + 52, y + h - 12, 1, [255, 255, 255]);
}

// MAIN 9 — Solomons: island, flag, sea.
function sceneIsland(x, y, w, h) {
  rect(x, y, w, h, [52, 130, 180]);
  circle(x + 30, y + 30, 14, [46, 120, 70]);
  circle(x + 52, y + 34, 10, [46, 120, 70]);
  vline(x + 30, y + 8, y + 30, [240, 240, 240]);
  tri(x + 30, y + 8, x + 48, y + 13, x + 30, y + 18, [30, 90, 160]);
  rect(x + 8, y + h - 12, w - 16, 4, [30, 90, 150]);
  text('$980M', x + 56, y + h - 12, 1, [255, 255, 255]);
}

// MAIN — Hasina return: calendar DEC 16 + plane.
function sceneReturn(x, y, w, h) {
  rect(x, y, w, h, [150, 190, 220]);
  rect(x + 8, y + 8, 34, 30, [245, 245, 245]);
  rect(x + 8, y + 8, 34, 9, [180, 35, 24]);
  text('DEC', x + 12, y + 10, 1, [255, 255, 255]);
  text('16', x + 14, y + 20, 2, [26, 26, 26]);
  tri(x + 44, y + 20, x + 80, y + 14, x + 80, y + 26, [240, 240, 240]);
  tri(x + 56, y + 14, x + 62, y + 6, x + 66, y + 14, [240, 240, 240]);
  tri(x + 44, y + 26, x + 52, y + 32, x + 58, y + 26, [220, 220, 220]);
  hline(x + 8, x + w - 8, y + h - 8, [240, 240, 240]);
}

// MAIN 10 — Badme: desert, border, tanks.
function sceneTanks(x, y, w, h) {
  rect(x, y, w, h, [222, 196, 140]);
  tri(x + 4, y + h - 20, x + 26, y + 12, x + 48, y + h - 20, [180, 150, 100]);
  for (let i = 0; i < 6; i++) { px(x + 8 + i * 14, y + h - 26, [120, 90, 50]); px(x + 8 + i * 14 + 7, y + h - 26, [120, 90, 50]); }
  rect(x + 14, y + h - 26, 26, 10, [90, 84, 70]);
  rect(x + 40, y + h - 24, 16, 3, [90, 84, 70]);
  rect(x + 56, y + h - 24, 20, 8, [90, 84, 70]);
  rect(x + 76, y + h - 22, 12, 3, [90, 84, 70]);
  text('BADME', x + 8, y + 6, 1, [90, 60, 30]);
}

// MAIN 11 — Gaza: buildings, smoke, rubble.
function sceneRubble(x, y, w, h) {
  rect(x, y, w, h, [60, 62, 70]);
  rect(x + 8, y + 18, 20, 30, [110, 110, 116]);
  rect(x + 32, y + 10, 18, 38, [90, 90, 96]);
  rect(x + 54, y + 24, 22, 24, [120, 120, 126]);
  for (let i = 0; i < 4; i++) rect(x + 12 + i * 5, y + 24, 3, 4, [40, 40, 44]);
  circle(x + 40, y + 8, 7, [150, 150, 155]);
  circle(x + 48, y + 14, 5, [170, 170, 175]);
  tri(x + 10, y + h - 8, x + 22, y + h - 20, x + 34, y + h - 8, [80, 80, 86]);
  tri(x + 50, y + h - 8, x + 62, y + h - 18, x + 74, y + h - 8, [80, 80, 86]);
}

// MAIN 12 — Trump-Rutte: two flags, plane.
function sceneFlags(x, y, w, h) {
  rect(x, y, w, h, [150, 190, 220]);
  for (let i = 0; i < 4; i++) rect(x + 10, y + 10 + i * 8, 30, 4, i % 2 === 0 ? [190, 40, 40] : [245, 245, 245]);
  rect(x + 10, y + 10, 12, 14, [30, 50, 120]);
  rect(x + 48, y + 10, 30, 24, [20, 60, 140]);
  circle(x + 63, y + 22, 7, [240, 200, 60]);
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; px(x + 63 + Math.round(6 * Math.cos(a)), y + 22 + Math.round(6 * Math.sin(a)), [240, 200, 60]); }
  tri(x + 14, y + h - 20, x + 30, y + h - 28, x + 70, y + h - 20, [240, 240, 240]);
  tri(x + 30, y + h - 28, x + 34, y + h - 34, x + 38, y + h - 28, [240, 240, 240]);
}

// ---------- data ----------
// Regions: EUR, AFR, ASI, ME, AME, OCE, WLD. Counts are computed from these arrays.
const HEROES = [
  { tag: 'MIDDLE EAST', title: 'GULF ON FIRE', deck: 'Bahrain hit again as Iran fires at US bases; Arab states condemn. 25 tankers hit in Hormuz since 14 Nov.', scene: sceneGulf },
  { tag: 'AMERICAS', title: 'NVIDIA +31%', deck: 'Huang reinstated as CEO; best day since 2003, +$952bn in a day. S&P +4.7%, Nasdaq +6.5%.', scene: sceneNvidia },
  { tag: 'WORLD', title: 'CROWN ON THE LINE', deck: 'Gukesh vs Sindarov, Game 1 a 38-move Berlin draw. Youngest final ever: both 20. 0.5-0.5.', scene: sceneChess },
];

const MAINS = [
  { tag: 'EUROPE', title: 'COP31 COLLAPSES', deck: 'No deal in Antalya; Guterres "deeply disappointing". COP32 to Addis Ababa.', scene: sceneCop },
  { tag: 'AFRICA', title: 'SENEGAL CHAMPIONS AGAIN', deck: 'CAS restores the 2025 AFCON title; 1-0 over Morocco stands.', scene: sceneTrophy },
  { tag: 'EUROPE', title: 'UKRAINE SINKS WARSHIP', deck: 'Kyiv says 7 naval drones sank the corvette Merkury in a Libyan port.', scene: sceneShip },
  { tag: 'EUROPE', title: 'REAL MADRID 5-1', deck: 'UCL Matchday 5: Madrid stay perfect. City 2-2 Napoli, Arsenal 1-1 Dortmund.', scene: sceneUcl },
  { tag: 'EUROPE', title: 'BRENTFORD 4-0', deck: "Lewis-Potter brace in 2 minutes; Tarkowski's first red in 351 games.", scene: sceneGoal },
  { tag: 'ASIA', title: 'INDIA 720, STILL NO WIN', deck: 'NZ draw in Wellington: Pant 128, Rahul 136 — a record total, but NZ save it.', scene: sceneCricket },
  { tag: 'ASIA', title: 'NEPAL QUAKE M5.3', deck: 'Koshi Province shaken at 07:02; felt in India, Bhutan, Bangladesh, China.', scene: sceneQuake },
  { tag: 'ASIA', title: 'FALSE ALARM IN SEOUL', deck: 'Ulleung sent to shelters by a mistaken NK alert; the jets were Russian.', scene: sceneRadar },
  { tag: 'OCEANIA', title: 'SOLOMONS DITCHES CHINA PACT', deck: 'New Australia treaty; $980m+ funding as PM Manele visits Canberra.', scene: sceneIsland },
  { tag: 'ASIA', title: 'HASINA PLANS RETURN', deck: 'Ex-PM eyes a Dec 16 return as her party stays banned. (Reuters, AFP)', scene: sceneReturn },
  { tag: 'MIDDLE EAST', title: 'GAZA STRIKES KILL SIX', deck: 'Israeli strikes amid ceasefire violations; an UNRWA worker among dead.', scene: sceneRubble },
  { tag: 'AMERICAS', title: 'TRUMP TO MEET NATO CHIEF', deck: 'Rutte talks in Florida on Wednesday as Europe presses on Ukraine peace.', scene: sceneFlags },
];

const ALSO = [
  // Africa (8)
  ['AFRICA', 'DR Congo: foreign miners must open local units to Congolese owners (OkayAfrica)'],
  ['AFRICA', 'Burkina Faso opens academy for nuclear science and mining engineers (OkayAfrica)'],
  ['AFRICA', 'GAVI to buy 1.5m doses of a new Ebola vaccine for Congo (Reuters)'],
  ['AFRICA', 'Madagascar seeks arrest warrants for ex-president Rajoelina (Africanews)'],
  ['AFRICA', 'A new group defects from Sudan\'s RSF to join the army in Khartoum (Anadolu)'],
  ['AFRICA', 'South Africa orders Starlink to stop; Ramaphosa tells Musk: be "loyal"'],
  ['AFRICA', 'Joburg: ANC and ActionSA split key posts in an 18-party coalition (Daily Maverick)'],
  ['AFRICA', 'Nigeria police declare nine wanted over a threat to the FirstBank MD (Punch)'],
  ['AFRICA', 'Ethiopia and Eritrea mass troops at Badme; US leverage thins. (CBS)'],
  // Asia (7)
  ['ASIA', 'India announces Rs15,000cr aid for Nepal; new Ayodhya-Janakpur rail opens'],
  ['ASIA', 'Chinese official sentenced to death for spying and leaking secrets'],
  ['ASIA', 'Bangladesh garment workers clash with police (Reuters)'],
  ['ASIA', 'Lahore is the world\'s most polluted major city, AQI 538'],
  ['ASIA', 'Pakistan astronaut to fly aboard China\'s Tiangong station'],
  ['ASIA', 'Indonesia seizes 405 tonnes of missile chemical from a China-bound ship'],
  // Middle East (2)
  ['MIDDLE EAST', 'US sanctions Iranian exchange houses over shadow banking'],
  ['MIDDLE EAST', 'UK sanctions the Houthis and four officials over "renewed aggression" (Anadolu)'],
  // Europe (3)
  ['EUROPE', 'Belgium national strike shuts airports and public transport (Reuters)'],
  ['EUROPE', 'Serbia school shooting injures two; a teenage suspect is arrested (Anadolu)'],
  ['EUROPE', 'NATO boosts its watch after the Poland airspace incident'],
  // Americas (4)
  ['AMERICAS', 'US consumer confidence at 103.3 in November, up from October'],
  ['AMERICAS', 'Colombia drone attack on a Cucuta police base injures three civilians (AP)'],
  ['AMERICAS', '$TRUMP coin down 99% from peak; Democrats plan a probe of Trump\'s crypto'],
  ['AMERICAS', 'Anthropic launches Claude Ship, its AI coding tools'],
  // Oceania (5)
  ['OCEANIA', 'Australian coalition opposes the Vanuatu treaty deal over climate clauses (PINA)'],
  ['OCEANIA', 'Fiji closes all schools for five days as the El Nino drought deepens (PINA)'],
  ['OCEANIA', 'M6.5 quake in the Vanuatu region; no damage reported'],
  ['OCEANIA', 'Kilauea volcano ends its 57th lava-fountaining episode'],
  ['OCEANIA', 'Origin star Hudson Young signs with the PNG Chiefs (PINA)'],
  // World (3)
  ['WORLD', 'WFP: 10m tonnes of wheat may miss markets; Africa\'s importers first in line'],
  ['WORLD', 'UN: five women killed every hour by partners or family; Africa highest toll'],
  ['WORLD', 'Fourteen countries back the UN court ruling on the Rohingya genocide in Myanmar'],
];

const CLOCK = [
  ['01:32', 'Nepal quake M5.3 strikes Koshi Province'],
  ['06:57', 'Nvidia +31% close confirmed, best day since 2003'],
  ['08:59', 'Brentford 4-0 Everton report lands'],
  ['09:51', 'Iran escalates Gulf attacks; US hits Qeshm'],
  ['11:00', 'Arab states condemn Iran strikes on Bahrain'],
  ['14:00', 'Chess Game 1 begins in Geneva'],
];

const NUMBERS = [
  ['+31%', 'NVIDIA ONE-DAY JUMP'],
  ['$952BN', 'NVIDIA VALUE GAINED'],
  ['25', 'TANKERS HIT SINCE 14 NOV'],
  ['5-1', 'REAL MADRID OVER PSV'],
  ['720', "INDIA'S RECORD TEST TOTAL"],
  ['38', 'MOVES IN CHESS GAME 1'],
];

const PINS = [
  ['1', 'MANAMA', 26.2, 50.6], ['2', 'GENEVA', 46.2, 6.1], ['3', 'ANTALYA', 36.9, 30.7],
  ['4', 'DAKAR', 14.7, -17.4], ['5', 'BENGHAZI', 32.1, 20.1], ['6', 'WELLINGTON', -41.3, 174.8],
  ['7', 'KATHMANDU', 27.7, 85.3], ['8', 'SEOUL', 37.6, 127.0], ['9', 'CANBERRA', -35.3, 149.1],
  ['10', 'HONIARA', -9.4, 160.0], ['11', 'WASHINGTON', 38.9, -77.0], ['12', 'MADRID', 40.4, -3.7],
];

const REGION_ORDER = ['EUROPE', 'AFRICA', 'ASIA', 'MIDDLE EAST', 'AMERICAS', 'OCEANIA', 'WORLD'];
const REGION_LABEL = { 'EUROPE': 'EUR', 'AFRICA': 'AFR', 'ASIA': 'ASI', 'MIDDLE EAST': 'ME', 'AMERICAS': 'AME', 'OCEANIA': 'OCE', 'WORLD': 'WLD' };
const REGION_COLOR = { 'EUROPE': [29, 78, 216], 'AFRICA': [180, 120, 20], 'ASIA': [180, 35, 24], 'MIDDLE EAST': [120, 60, 140], 'AMERICAS': [21, 128, 61], 'OCEANIA': [15, 118, 110], 'WORLD': [80, 80, 90] };

function regionCounts() {
  const c = {};
  for (const r of REGION_ORDER) c[r] = 0;
  const add = (tag) => { c[tag] = (c[tag] || 0) + 1; };
  for (const h of HEROES) add(h.tag === 'MIDDLE EAST' ? 'MIDDLE EAST' : h.tag);
  for (const m of MAINS) add(m.tag);
  for (const a of ALSO) add(a[0]);
  return c;
}

// ---------- world map ----------
// Equirectangular crop: lon -170..190, lat -60..85.
const MAP = { x: 8, y: 666, w: 1008, h: 92 };
function mapXY(lon, lat) {
  return [MAP.x + ((lon + 170) / 360) * MAP.w, MAP.y + ((85 - lat) / 145) * MAP.h];
}
function poly(points, c) {
  const pts = points.map(([lo, la]) => mapXY(lo, la));
  const minX = Math.min(...pts.map((p) => p[0])), maxX = Math.max(...pts.map((p) => p[0]));
  const minY = Math.min(...pts.map((p) => p[1])), maxY = Math.max(...pts.map((p) => p[1]));
  for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
    for (let x = Math.floor(minX); x <= Math.ceil(maxX); x++) {
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if (((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)) inside = !inside;
      }
      if (inside) px(x, y, c);
    }
  }
}
const CONTINENTS = [
  [[-168, 66], [-140, 70], [-125, 71], [-110, 68], [-95, 69], [-85, 66], [-80, 73], [-65, 60], [-55, 52], [-60, 47], [-70, 42], [-75, 35], [-80, 32], [-85, 29], [-90, 21], [-97, 16], [-105, 20], [-115, 28], [-125, 40], [-125, 49], [-140, 60], [-155, 58], [-165, 60]],
  [[-80, 10], [-75, 10], [-62, 9], [-52, 5], [-50, 0], [-44, -3], [-35, -8], [-40, -20], [-48, -28], [-58, -35], [-65, -41], [-70, -50], [-74, -53], [-73, -37], [-70, -20], [-77, -12], [-81, -5], [-80, 2]],
  [[-10, 36], [-9, 43], [-2, 48], [0, 50], [3, 52], [8, 57], [10, 59], [18, 56], [21, 55], [24, 58], [28, 60], [30, 62], [32, 70], [40, 68], [44, 68], [40, 60], [35, 55], [30, 50], [28, 45], [23, 40], [20, 40], [15, 44], [12, 44], [8, 44], [3, 43], [-2, 37], [-6, 36]],
  [[-6, 35], [-10, 31], [-17, 15], [-17, 12], [-13, 8], [-8, 5], [6, 6], [9, 4], [13, -2], [12, -6], [13, -12], [12, -18], [16, -23], [18, -29], [20, -35], [26, -34], [32, -28], [35, -22], [40, -16], [41, -11], [46, -1], [51, 11], [48, 11], [43, 12], [40, 15], [38, 18], [37, 22], [34, 28], [32, 31], [30, 32], [25, 32], [19, 33], [11, 34], [10, 37]],
  [[30, 36], [35, 36], [36, 33], [42, 41], [48, 38], [52, 37], [54, 27], [58, 25], [61, 25], [66, 25], [70, 20], [72, 20], [77, 8], [80, 7], [80, 13], [84, 19], [88, 22], [91, 22], [93, 17], [95, 16], [98, 10], [100, 8], [103, 2], [104, 9], [106, 11], [109, 13], [109, 18], [106, 21], [108, 18], [110, 20], [114, 22], [118, 25], [120, 28], [122, 32], [121, 38], [120, 40], [126, 40], [128, 38], [130, 42], [132, 43], [135, 44], [138, 46], [140, 40], [141, 45], [142, 50], [142, 54], [140, 60], [138, 65], [142, 70], [150, 70], [158, 66], [162, 60], [163, 64], [170, 66], [178, 65], [178, 62], [170, 60], [162, 56], [158, 52], [156, 50], [150, 59], [142, 58], [138, 52], [135, 45], [132, 42], [130, 38], [127, 35], [126, 38], [122, 37], [120, 33], [115, 32], [112, 28], [108, 18]],
  [[113, -22], [114, -30], [115, -35], [118, -35], [124, -33], [129, -32], [132, -32], [135, -35], [138, -35], [140, -38], [145, -38], [147, -39], [150, -37], [153, -32], [153, -27], [150, -23], [146, -19], [142, -11], [142, -15], [136, -12], [135, -15], [132, -12], [130, -13], [126, -14], [122, -17], [118, -20], [114, -22]],
  [[-2, 53], [0, 51], [1, 52], [-3, 54], [-5, 53]],
  [[130, 31], [133, 34], [137, 35], [140, 37], [141, 40], [143, 43], [140, 44], [137, 40], [133, 35], [130, 33]],
  [[44, -16], [47, -18], [48, -22], [45, -25], [43, -20]],
];
function drawMap() {
  rect(MAP.x, MAP.y, MAP.w, MAP.h, [205, 224, 235]);
  for (const c of CONTINENTS) poly(c, [196, 190, 160]);
  // island dots
  for (const [lo, la] of [[167, -45], [174, -41], [95, 0], [105, -5], [115, -8], [125, -9], [135, -4], [141, -3]]) {
    const [mx, my] = mapXY(lo, la);
    circle(mx, my, 2, [196, 190, 160]);
  }
  // pins
  for (const [n, , la, lo] of PINS) {
    const [mx, my] = mapXY(lo, la);
    circle(mx, my, 8, [180, 35, 24]);
    circle(mx, my, 6, [255, 255, 255]);
    text(n, mx - (n.length > 1 ? 6 : 3), my - 3, 1, [180, 35, 24]);
  }
}

// ---------- layout ----------
function render() {
  rect(0, 0, W, H, PAPER);
  rect(0, 0, W, 8, NAVY);

  // Masthead
  textC('THE WORLD IN ONE DAY', 512, 14, 6, NAVY);
  textC('TUESDAY, 24 NOVEMBER 2026', 512, 60, 3, RED);
  hline(8, 1016, 86, LINE);

  // Count header
  const total = HEROES.length + MAINS.length + ALSO.length;
  const counts = regionCounts();
  const regionsUsed = REGION_ORDER.filter((r) => counts[r] > 0).length;
  textC(total + ' STORIES • ' + regionsUsed + ' REGIONS • ONE DAY', 512, 92, 2, INK);

  // Region bar (proportional segments)
  let rx = 8;
  let acc = 0;
  for (let i = 0; i < REGION_ORDER.length; i++) {
    const r = REGION_ORDER[i];
    acc += counts[r];
    const nextX = i === REGION_ORDER.length - 1 ? 1016 : 8 + Math.round((acc / total) * 1008);
    rect(rx, 112, nextX - rx, 18, REGION_COLOR[r]);
    const label = REGION_LABEL[r] + ' ' + counts[r];
    textC(label, rx + (nextX - rx) / 2, 116, 1, [255, 255, 255]);
    rx = nextX;
  }

  // Day in Numbers (6 boxes)
  for (let i = 0; i < NUMBERS.length; i++) {
    const bx = 8 + i * 168;
    rect(bx, 136, 166, 40, [255, 255, 255]);
    rect(bx, 136, 166, 1, LINE); rect(bx, 175, 166, 1, LINE);
    rect(bx, 136, 1, 40, LINE); rect(bx + 165, 136, 1, 40, LINE);
    textC(NUMBERS[i][0], bx + 83, 141, 3, NAVY);
    textC(NUMBERS[i][1], bx + 83, 165, 1, GREY);
  }

  // Heroes (3 panels)
  for (let i = 0; i < HEROES.length; i++) {
    const hx = 8 + i * 339;
    const hero = HEROES[i];
    hero.scene(hx, 182, 330, 138);
    text(hero.tag, hx, 326, 1, RED);
    text(hero.title, hx, 340, 3, INK);
    const deckLines = wrap(hero.deck, 330, 1);
    text(deckLines[0], hx, 366, 1, [60, 60, 60]);
    if (deckLines[1]) text(deckLines[1], hx, 375, 1, [60, 60, 60]);
  }
  hline(8, 1016, 388, LINE);

  // Main stories (3 columns x 4 rows, each with a small scene)
  for (let r = 0; r < 4; r++) {
    const y0 = 394 + r * 64;
    if (r > 0) hline(8, 1016, y0, LINE);
    for (let c = 0; c < 3; c++) {
      const m = MAINS[r * 3 + c];
      const mx = 8 + c * 339;
      m.scene(mx, y0 + 4, 88, 52);
      text(m.tag, mx + 96, y0 + 3, 1, REGION_COLOR[m.tag]);
      const hl = wrap(m.title, 234, 2);
      text(hl[0], mx + 96, y0 + 13, 2, INK);
      if (hl[1]) text(hl[1], mx + 96, y0 + 27, 2, INK);
      const dl = wrap(m.deck, 234, 1);
      text(dl[0], mx + 96, y0 + 44, 1, [60, 60, 60]);
      if (dl[1]) text(dl[1], mx + 96, y0 + 53, 1, [60, 60, 60]);
    }
  }

  // Map
  text('THE WORLD — 12 STORIES PINNED', 8, 656, 1, NAVY);
  drawMap();
  const legend = PINS.map(([n, city]) => n + ' ' + city).join('   ');
  text(legend, 8, 762, 1, INK);

  // By the Clock
  text('BY THE CLOCK — UTC', 8, 770, 1, NAVY);
  for (let i = 0; i < CLOCK.length; i++) {
    const cx = 8 + (i % 3) * 336;
    const cy = 782 + Math.floor(i / 3) * 10;
    text(CLOCK[i][0], cx, cy, 1, RED);
    text(CLOCK[i][1], cx + 36, cy, 1, INK);
  }

  // Also on (2 columns x 16 rows)
  hline(8, 1016, 806, LINE);
  text('ALSO ON — 24 NOVEMBER', 8, 812, 2, NAVY);
  for (let i = 0; i < ALSO.length; i++) {
    const col = i < 16 ? 0 : 1;
    const row = i % 16;
    const ax = 8 + col * 508;
    const ay = 832 + row * 9;
    rect(ax, ay + 1, 5, 5, REGION_COLOR[ALSO[i][0]]);
    text(ALSO[i][1], ax + 8, ay, 1, [50, 50, 50]);
  }

  // Footer
  hline(8, 1016, 984, LINE);
  text('SOURCES: AL JAZEERA, REUTERS, CNN, UEFA, CHESSBASE, CBS, ANADOLU, PINA, OKAYAFRICA, DAILY MAVERICK, PUNCH.', 8, 990, 1, GREY);
  text('DATE CHECK: STORIES FIRST REPORTED 23 NOV BUT HEADLINING 24 NOV PAPERS COUNT; ALL DATES UTC.', 8, 1000, 1, GREY);
  rect(0, 1016, W, 8, NAVY);
}

// ---------- main ----------
const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';
mkdirSync(outDir, { recursive: true });
render();
writeFileSync(join(outDir, 'entry.png'), encodePNG());
console.log('wrote ' + join(outDir, 'entry.png'));
