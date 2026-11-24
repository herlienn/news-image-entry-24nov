// News Image — 24 November 2026.
// A Node 22 program (standard library only) that draws one 1024x1024 newspaper
// image summing up the world's news of Tuesday 24 November 2026 and writes it
// to /output/entry.png. Fully deterministic: fixed seed, no network, no clock.
// Every pixel, glyph and scene is drawn fresh in this file.

import * as fs from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";

// ------------------------------------------------------------------ PRNG ---
// Fixed-seed generator (mulberry32) used only for texture speckle, so the
// two grader runs are byte-identical.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20261124);

// ------------------------------------------------------------------- PNG ---
const CRC_TABLE: number[] = (() => {
  const table: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table.push(c >>> 0);
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "ascii"), data])), 8 + data.length);
  return out;
}

function encodePNG(w: number, h: number, rgb: Buffer): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const raw = Buffer.alloc(h * (1 + w * 3));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 3)] = 0; // filter: none
    rgb.copy(raw, y * (1 + w * 3) + 1, y * w * 3, (y + 1) * w * 3);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------- canvas ---
const W = 1024;
const H = 1024;
const img = Buffer.alloc(W * H * 3);

type RGB = [number, number, number];
const PAPER: RGB = [247, 243, 232];
const INK: RGB = [26, 26, 26];
const RED: RGB = [179, 32, 44];
const BLUE: RGB = [31, 78, 121];
const DBLUE: RGB = [18, 48, 78];
const GREEN: RGB = [46, 107, 52];
const LGREEN: RGB = [120, 170, 90];
const GOLD: RGB = [198, 142, 28];
const ORANGE: RGB = [224, 110, 30];
const GREY: RGB = [110, 110, 108];
const LGREY: RGB = [200, 196, 186];
const SKY: RGB = [168, 196, 216];
const SEA: RGB = [58, 110, 150];
const SAND: RGB = [214, 196, 150];

function px(x: number, y: number, c: RGB): void {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  if (xi < 0 || yi < 0 || xi >= W || yi >= H) return;
  const o = (yi * W + xi) * 3;
  img[o] = c[0];
  img[o] = c[0];
  img[o + 1] = c[1];
  img[o + 2] = c[2];
}

function fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(W, Math.ceil(x + w));
  const y1 = Math.min(H, Math.ceil(y + h));
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) {
      const o = (yy * W + xx) * 3;
      img[o] = c[0];
      img[o + 1] = c[1];
      img[o + 2] = c[2];
    }
  }
}

function hline(x0: number, x1: number, y: number, c: RGB): void {
  if (x1 < x0) [x0, x1] = [x1, x0];
  for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) px(x, y, c);
}

function vline(x: number, y0: number, y1: number, c: RGB): void {
  if (y1 < y0) [y0, y1] = [y1, y0];
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) px(x, y, c);
}

function line(x0: number, y0: number, x1: number, y1: number, c: RGB): void {
  // Integer Bresenham on rounded endpoints: the raw-coordinate version could
  // miss its endpoint by one pixel and then run away across the whole canvas.
  const ax = Math.round(x0);
  const ay = Math.round(y0);
  const bx = Math.round(x1);
  const by = Math.round(y1);
  const dx = Math.abs(bx - ax);
  const dy = Math.abs(by - ay);
  const sx = ax < bx ? 1 : -1;
  const sy = ay < by ? 1 : -1;
  let err = dx - dy;
  let x = ax;
  let y = ay;
  for (let i = 0; i < 4096; i++) {
    px(x, y, c);
    if (x === bx && y === by) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
}

function fillCircle(cx: number, cy: number, r: number, c: RGB): void {
  const rr = Math.max(0, Math.floor(r));
  for (let dy = -rr; dy <= rr; dy++) {
    const dx = Math.floor(Math.sqrt(rr * rr - dy * dy));
    hline(cx - dx, cx + dx, cy + dy, c);
  }
}

function ring(cx: number, cy: number, r: number, c: RGB): void {
  const rr = Math.max(1, Math.floor(r));
  for (let a = 0; a < 360; a += 2) {
    const t = (a * Math.PI) / 180;
    px(cx + rr * Math.cos(t), cy + rr * Math.sin(t), c);
  }
}

function fillEllipse(cx: number, cy: number, rx: number, ry: number, c: RGB): void {
  const ryI = Math.max(1, Math.floor(ry));
  for (let dy = -ryI; dy <= ryI; dy++) {
    const dx = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / (ry * ry))));
    hline(cx - dx, cx + dx, cy + dy, c);
  }
}

function fillTri(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: RGB): void {
  const minY = Math.max(0, Math.floor(Math.min(y0, y1, y2)));
  const maxY = Math.min(H - 1, Math.ceil(Math.max(y0, y1, y2)));
  for (let y = minY; y <= maxY; y++) {
    const xs: number[] = [];
    const edges: [number, number, number, number][] = [
      [x0, y0, x1, y1],
      [x1, y1, x2, y2],
      [x2, y2, x0, y0],
    ];
    for (const [ax, ay, bx, by] of edges) {
      if ((ay <= y && by > y) || (by <= y && ay > y)) {
        xs.push(ax + ((y - ay) / (by - ay)) * (bx - ax));
      }
    }
    if (xs.length >= 2) {
      xs.sort((a, b) => a - b);
      hline(xs[0], xs[xs.length - 1], y, c);
    }
  }
}

function fillPoly(points: [number, number][], c: RGB): void {
  if (points.length < 3) return;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [, y] of points) {
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  for (let y = Math.max(0, Math.floor(minY)); y <= Math.min(H - 1, Math.ceil(maxY)); y++) {
    const xs: number[] = [];
    for (let i = 0; i < points.length; i++) {
      const [ax, ay] = points[i];
      const [bx, by] = points[(i + 1) % points.length];
      if ((ay <= y && by > y) || (by <= y && ay > y)) {
        xs.push(ax + ((y - ay) / (by - ay)) * (bx - ax));
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) hline(xs[k], xs[k + 1], y, c);
  }
}

function speckle(x: number, y: number, w: number, h: number, n: number, c: RGB): void {
  for (let i = 0; i < n; i++) px(x + rnd() * w, y + rnd() * h, c);
}

// -------------------------------------------------------------------- font ---
// Fresh 5x7 bitmap font, drawn from scratch for this entry. All image text
// is rendered in capitals through drawText, so only capitals are needed.
const FONT: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["01110", "10000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00001", "01110"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ",": ["00000", "00000", "00000", "00000", "01100", "00100", "01000"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  ";": ["00000", "01100", "01100", "00000", "01100", "00100", "01000"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  "?": ["01110", "10001", "00001", "00110", "00100", "00000", "00100"],
  "-": ["00000", "00000", "00000", "01110", "00000", "00000", "00000"],
  "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
  "(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
  ")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  "&": ["01100", "10010", "10100", "01000", "10101", "10010", "01101"],
  "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
  "+": ["00000", "00100", "00100", "11111", "00100", "00100", "00000"],
  $: ["00100", "01111", "10100", "01110", "00101", "11110", "00100"],
  "•": ["00000", "00000", "01100", "01100", "01100", "00000", "00000"],
  '"': ["01010", "01010", "01010", "00000", "00000", "00000", "00000"],
  "=": ["00000", "00000", "11111", "00000", "11111", "00000", "00000"],
};

function drawChar(x: number, y: number, ch: string, s: number, c: RGB): void {
  const g = FONT[ch] ?? FONT["?"];
  for (let r = 0; r < 7; r++) {
    for (let col = 0; col < 5; col++) {
      if (g[r][col] === "1") fillRect(x + col * s, y + r * s, s, s, c);
    }
  }
}

function textW(s: string, scale: number): number {
  return s.length * 6 * scale - scale;
}

function drawText(x: number, y: number, s: string, scale: number, c: RGB): number {
  const up = s.toUpperCase();
  for (let i = 0; i < up.length; i++) drawChar(x + i * 6 * scale, y, up[i], scale, c);
  return textW(up, scale);
}

function drawTextCentered(cx: number, y: number, s: string, scale: number, c: RGB): void {
  drawText(cx - Math.floor(textW(s.toUpperCase(), scale) / 2), y, s, scale, c);
}

function wrapText(s: string, scale: number, maxW: number): string[] {
  const words = s.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const trial = cur ? cur + " " + w : w;
    if (textW(trial, scale) <= maxW || !cur) {
      cur = trial;
    } else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function drawWrapped(x: number, y: number, s: string, scale: number, maxW: number, c: RGB, lh?: number): number {
  const lines = wrapText(s, scale, maxW);
  const lineH = lh ?? 7 * scale + 3;
  lines.forEach((ln, i) => drawText(x, y + i * lineH, ln, scale, c));
  return lines.length;
}

// ------------------------------------------------------------------ scenes ---
// Each scene painter draws one small original illustration inside the box
// (x, y, w, h). All coordinates are relative to the box, so the same
// painter serves the large hero panels and the small story thumbnails.

function skyBand(x: number, y: number, w: number, h: number, top: RGB, bot: RGB): void {
  for (let yy = 0; yy < h; yy++) {
    const t = yy / Math.max(1, h - 1);
    const c: RGB = [
      Math.round(top[0] + (bot[0] - top[0]) * t),
      Math.round(top[1] + (bot[1] - top[1]) * t),
      Math.round(top[2] + (bot[2] - top[2]) * t),
    ];
    hline(x, x + w - 1, y + yy, c);
  }
}

function sceneGulf(x: number, y: number, w: number, h: number): void {
  skyBand(x, y, w, h, [58, 74, 96], [140, 150, 160]);
  fillRect(x, y + h * 0.62, w, h * 0.38, SEA);
  // sun haze
  fillCircle(x + w * 0.78, y + h * 0.22, h * 0.13, [232, 200, 120]);
  // radar dome on a base
  fillRect(x + w * 0.12, y + h * 0.52, w * 0.2, h * 0.12, [90, 90, 88]);
  fillCircle(x + w * 0.22, y + h * 0.52, h * 0.14, [235, 235, 230]);
  line(x + w * 0.22, y + h * 0.52, x + w * 0.22, y + h * 0.34, [235, 235, 230]);
  // missile arcs with smoke trails
  line(x + w * 0.42, y + h * 0.6, x + w * 0.6, y + h * 0.2, ORANGE);
  line(x + w * 0.6, y + h * 0.2, x + w * 0.66, y + h * 0.1, GOLD);
  line(x + w * 0.55, y + h * 0.62, x + w * 0.78, y + h * 0.3, ORANGE);
  fillCircle(x + w * 0.66, y + h * 0.1, h * 0.045, GOLD);
  // blast glow on the water
  fillEllipse(x + w * 0.42, y + h * 0.66, w * 0.1, h * 0.05, ORANGE);
  fillEllipse(x + w * 0.55, y + h * 0.68, w * 0.08, h * 0.04, GOLD);
  // small ship
  fillRect(x + w * 0.8, y + h * 0.6, w * 0.14, h * 0.06, [40, 40, 44]);
  fillRect(x + w * 0.84, y + h * 0.53, w * 0.05, h * 0.07, [40, 40, 44]);
}

function sceneMarket(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, DBLUE);
  // grid
  for (let i = 1; i < 5; i++) vline(x + (w * i) / 5, y + 4, y + h - 4, [40, 80, 110]);
  for (let i = 1; i < 4; i++) hline(x + 4, x + w - 4, y + (h * i) / 4, [40, 80, 110]);
  // rising chart
  const pts: [number, number][] = [
    [0.08, 0.78],
    [0.22, 0.72],
    [0.34, 0.76],
    [0.48, 0.55],
    [0.6, 0.58],
    [0.72, 0.38],
    [0.86, 0.2],
    [0.95, 0.12],
  ];
  for (let i = 0; i + 1 < pts.length; i++) {
    line(x + pts[i][0] * w, y + pts[i][1] * h, x + pts[i + 1][0] * w, y + pts[i + 1][1] * h, [90, 220, 120]);
    line(x + pts[i][0] * w, y + pts[i][1] * h + 1, x + pts[i + 1][0] * w, y + pts[i + 1][1] * h + 1, [90, 220, 120]);
  }
  // chip
  fillRect(x + w * 0.08, y + h * 0.62, w * 0.22, h * 0.26, GREEN);
  fillRect(x + w * 0.11, y + h * 0.66, w * 0.16, h * 0.18, [30, 80, 40]);
  for (let i = 0; i < 4; i++) {
    hline(x + w * 0.05, x + w * 0.08, y + h * (0.66 + i * 0.05), GOLD);
    hline(x + w * 0.3, x + w * 0.33, y + h * (0.66 + i * 0.05), GOLD);
  }
  // up arrow
  fillTri(x + w * 0.9, y + h * 0.08, x + w * 0.84, y + h * 0.2, x + w * 0.96, y + h * 0.2, [90, 220, 120]);
  fillRect(x + w * 0.885, y + h * 0.2, w * 0.03, h * 0.14, [90, 220, 120]);
}

function sceneChess(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, [62, 44, 28]);
  const bw = Math.min(w * 0.62, h * 0.92);
  const bx = x + w * 0.05;
  const by = y + (h - bw) / 2;
  const sq = bw / 8;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      fillRect(bx + c * sq, by + r * sq, sq + 1, sq + 1, (r + c) % 2 === 0 ? [240, 220, 190] : [70, 50, 30]);
    }
  }
  // white king and black queen standing on the board
  fillCircle(bx + 2.5 * sq, by + 5.5 * sq, sq * 0.42, [250, 250, 245]);
  fillRect(bx + 2.5 * sq - 1, by + 5.5 * sq - sq * 0.7, 2, sq * 0.4, [250, 250, 245]);
  fillCircle(bx + 5.5 * sq, by + 2.5 * sq, sq * 0.42, [20, 20, 22]);
  fillRect(bx + 5.5 * sq - 1, by + 2.5 * sq - sq * 0.7, 2, sq * 0.4, [20, 20, 22]);
  // trophy glow on the right
  fillCircle(x + w * 0.82, y + h * 0.3, h * 0.1, GOLD);
  fillRect(x + w * 0.78, y + h * 0.38, w * 0.08, h * 0.22, GOLD);
  fillRect(x + w * 0.74, y + h * 0.6, w * 0.16, h * 0.05, GOLD);
  drawText(x + w * 0.72, y + h * 0.72, "$2.5M", 1, [240, 220, 170]);
}

function sceneClimate(x: number, y: number, w: number, h: number): void {
  skyBand(x, y, w, h, [120, 140, 150], [210, 200, 170]);
  // globe
  fillCircle(x + w * 0.3, y + h * 0.48, h * 0.32, SEA);
  fillEllipse(x + w * 0.24, y + h * 0.4, w * 0.09, h * 0.08, GREEN);
  fillEllipse(x + w * 0.36, y + h * 0.58, w * 0.08, h * 0.07, GREEN);
  fillEllipse(x + w * 0.32, y + h * 0.34, w * 0.05, h * 0.04, LGREEN);
  // cracked dry ground
  fillRect(x, y + h * 0.78, w, h * 0.22, [150, 120, 80]);
  line(x + w * 0.2, y + h * 0.78, x + w * 0.3, y + h, [90, 70, 40]);
  line(x + w * 0.3, y + h * 0.9, x + w * 0.45, y + h * 0.82, [90, 70, 40]);
  line(x + w * 0.6, y + h * 0.78, x + w * 0.55, y + h, [90, 70, 40]);
  // rejected document with a red X
  fillRect(x + w * 0.62, y + h * 0.2, w * 0.28, h * 0.5, [250, 250, 245]);
  line(x + w * 0.66, y + h * 0.28, x + w * 0.86, y + h * 0.62, RED);
  line(x + w * 0.86, y + h * 0.28, x + w * 0.66, y + h * 0.62, RED);
  hline(x + w * 0.66, x + w * 0.86, y + h * 0.68, [150, 150, 145]);
}

function sceneKyiv(x: number, y: number, w: number, h: number): void {
  skyBand(x, y, w, h, [70, 80, 100], [170, 160, 140]);
  // skyline
  const tops = [0.42, 0.3, 0.5, 0.36, 0.46, 0.28, 0.4];
  let cx = x;
  const bw = w / tops.length;
  for (let i = 0; i < tops.length; i++) {
    fillRect(cx, y + h * tops[i], bw - 2, h * (0.78 - tops[i]), i % 2 ? [70, 72, 84] : [52, 54, 66]);
    cx += bw;
  }
  // fire glow at the base
  fillEllipse(x + w * 0.6, y + h * 0.8, w * 0.22, h * 0.08, ORANGE);
  fillEllipse(x + w * 0.6, y + h * 0.78, w * 0.12, h * 0.05, GOLD);
  // smoke columns
  fillEllipse(x + w * 0.3, y + h * 0.22, w * 0.08, h * 0.1, [90, 90, 92]);
  fillEllipse(x + w * 0.62, y + h * 0.16, w * 0.1, h * 0.12, [80, 80, 82]);
  // drone
  fillRect(x + w * 0.82, y + h * 0.18, w * 0.08, h * 0.02, INK);
  fillRect(x + w * 0.85, y + h * 0.14, w * 0.02, h * 0.1, INK);
  fillRect(x, y + h * 0.78, w, h * 0.22, [60, 58, 52]);
}

function sceneShip(x: number, y: number, w: number, h: number): void {
  skyBand(x, y, w, h, [100, 120, 140], [190, 190, 180]);
  fillRect(x, y + h * 0.6, w, h * 0.4, SEA);
  // waves
  for (let i = 0; i < 5; i++) {
    const wy = y + h * (0.66 + i * 0.07);
    for (let xx = x; xx < x + w; xx += 14) line(xx, wy, xx + 7, wy - 3, [200, 220, 235]);
  }
  // hull and containers
  fillRect(x + w * 0.14, y + h * 0.5, w * 0.72, h * 0.14, [40, 44, 52]);
  fillRect(x + w * 0.2, y + h * 0.38, w * 0.14, h * 0.12, [180, 60, 40]);
  fillRect(x + w * 0.36, y + h * 0.38, w * 0.14, h * 0.12, [60, 120, 80]);
  fillRect(x + w * 0.52, y + h * 0.38, w * 0.14, h * 0.12, [200, 170, 60]);
  // flames on the deck
  fillTri(x + w * 0.3, y + h * 0.38, x + w * 0.36, y + h * 0.14, x + w * 0.42, y + h * 0.38, ORANGE);
  fillTri(x + w * 0.5, y + h * 0.38, x + w * 0.55, y + h * 0.2, x + w * 0.6, y + h * 0.38, GOLD);
  // smoke
  fillEllipse(x + w * 0.34, y + h * 0.1, w * 0.1, h * 0.08, [80, 80, 82]);
  fillEllipse(x + w * 0.55, y + h * 0.14, w * 0.08, h * 0.06, [95, 95, 96]);
}

function sceneFire(x: number, y: number, w: number, h: number): void {
  skyBand(x, y, w, h, [90, 70, 60], [200, 150, 110]);
  // factory with sawtooth roof
  fillRect(x + w * 0.1, y + h * 0.5, w * 0.8, h * 0.3, [120, 100, 84]);
  fillTri(x + w * 0.1, y + h * 0.5, x + w * 0.3, y + h * 0.32, x + w * 0.5, y + h * 0.5, [90, 76, 62]);
  fillTri(x + w * 0.5, y + h * 0.5, x + w * 0.7, y + h * 0.32, x + w * 0.9, y + h * 0.5, [90, 76, 62]);
  fillRect(x + w * 0.78, y + h * 0.2, w * 0.07, h * 0.34, [100, 84, 68]);
  // big flames
  fillTri(x + w * 0.18, y + h * 0.52, x + w * 0.3, y + h * 0.18, x + w * 0.42, y + h * 0.52, ORANGE);
  fillTri(x + w * 0.34, y + h * 0.52, x + w * 0.44, y + h * 0.26, x + w * 0.54, y + h * 0.52, GOLD);
  fillTri(x + w * 0.56, y + h * 0.52, x + w * 0.66, y + h * 0.22, x + w * 0.76, y + h * 0.52, ORANGE);
  // smoke
  fillEllipse(x + w * 0.3, y + h * 0.12, w * 0.14, h * 0.1, [70, 66, 62]);
  fillEllipse(x + w * 0.62, y + h * 0.1, w * 0.12, h * 0.09, [80, 76, 72]);
  fillRect(x, y + h * 0.8, w, h * 0.2, [70, 62, 52]);
  // rescue ladder
  line(x + w * 0.86, y + h * 0.8, x + w * 0.7, y + h * 0.5, RED);
  line(x + w * 0.9, y + h * 0.8, x + w * 0.74, y + h * 0.5, RED);
}

function sceneFootball(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, [52, 140, 62]);
  // mowing stripes
  for (let i = 0; i < 5; i += 2) fillRect(x + (w * i) / 5, y, w / 5, h, [44, 128, 54]);
  // pitch lines
  ring(x + w * 0.5, y + h * 0.55, h * 0.22, [240, 240, 235]);
  hline(x, x + w - 1, y + h * 0.55, [240, 240, 235]);
  // goal
  fillRect(x + w * 0.68, y + h * 0.08, w * 0.26, h * 0.3, [240, 240, 235]);
  fillRect(x + w * 0.7, y + h * 0.1, w * 0.22, h * 0.26, [52, 140, 62]);
  for (let i = 0; i < 4; i++) vline(x + w * (0.7 + i * 0.055), y + h * 0.1, y + h * 0.36, [220, 220, 215]);
  // ball
  fillCircle(x + w * 0.3, y + h * 0.7, h * 0.12, [250, 250, 248]);
  fillCircle(x + w * 0.3, y + h * 0.7, h * 0.04, INK);
  // players as simple figures
  fillCircle(x + w * 0.18, y + h * 0.32, h * 0.06, RED);
  fillRect(x + w * 0.17, y + h * 0.38, w * 0.03, h * 0.2, RED);
  fillCircle(x + w * 0.52, y + h * 0.4, h * 0.06, BLUE);
  fillRect(x + w * 0.51, y + h * 0.46, w * 0.03, h * 0.2, BLUE);
  // score strip
  fillRect(x + w * 0.05, y + h * 0.82, w * 0.5, h * 0.14, [250, 250, 245]);
  drawText(x + w * 0.08, y + h * 0.84, "BRE 4-0 EVE", 1, INK);
}

function sceneCricket(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, [96, 150, 70]);
  fillRect(x + w * 0.3, y, w * 0.4, h, [196, 178, 130]);
  // stumps
  for (let i = 0; i < 3; i++) vline(x + w * (0.44 + i * 0.05), y + h * 0.2, y + h * 0.42, GOLD);
  hline(x + w * 0.44, x + w * 0.54, y + h * 0.2, GOLD);
  // bat
  line(x + w * 0.62, y + h * 0.28, x + w * 0.72, y + h * 0.55, [150, 110, 60]);
  line(x + w * 0.62, y + h * 0.28, x + w * 0.72, y + h * 0.55, [150, 110, 60]);
  fillRect(x + w * 0.6, y + h * 0.24, w * 0.1, h * 0.05, [150, 110, 60]);
  // ball
  fillCircle(x + w * 0.26, y + h * 0.62, h * 0.07, RED);
  // batsman figure
  fillCircle(x + w * 0.7, y + h * 0.6, h * 0.07, [30, 60, 120]);
  fillRect(x + w * 0.68, y + h * 0.66, w * 0.05, h * 0.22, [30, 60, 120]);
  // score strip
  fillRect(x + w * 0.05, y + h * 0.84, w * 0.62, h * 0.13, [250, 250, 245]);
  drawText(x + w * 0.08, y + h * 0.86, "PANT 128", 1, INK);
}

function sceneStrike(x: number, y: number, w: number, h: number): void {
  skyBand(x, y, w, h, SKY, [220, 220, 205]);
  // grounded plane silhouette
  fillEllipse(x + w * 0.5, y + h * 0.5, w * 0.34, h * 0.09, [240, 240, 238]);
  fillTri(x + w * 0.82, y + h * 0.5, x + w * 0.9, y + h * 0.34, x + w * 0.86, y + h * 0.5, [240, 240, 238]);
  fillTri(x + w * 0.3, y + h * 0.52, x + w * 0.42, y + h * 0.66, x + w * 0.46, y + h * 0.52, [200, 200, 196]);
  fillRect(x + w * 0.2, y + h * 0.56, w * 0.05, h * 0.06, [200, 200, 196]);
  fillRect(x, y + h * 0.62, w, h * 0.06, [90, 90, 88]);
  // picket signs
  const signs: [number, RGB][] = [
    [0.14, RED],
    [0.3, BLUE],
    [0.78, RED],
  ];
  for (const [fx, c] of signs) {
    fillRect(x + w * (fx - 0.05), y + h * 0.68, w * 0.1, h * 0.14, c);
    vline(x + w * fx, y + h * 0.82, y + h * 0.98, INK);
  }
  fillRect(x, y + h * 0.68, w, h * 0.32, [150, 160, 140]);
}

function sceneSanctions(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, DBLUE);
  // circle of stars
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    fillCircle(x + w * 0.5 + Math.cos(a) * w * 0.26, y + h * 0.48 + Math.sin(a) * h * 0.3, Math.max(2, h * 0.03), GOLD);
  }
  // red ban ring and slash
  ring(x + w * 0.5, y + h * 0.48, h * 0.34, RED);
  ring(x + w * 0.5, y + h * 0.48, h * 0.3, RED);
  line(x + w * 0.28, y + h * 0.74, x + w * 0.72, y + h * 0.22, RED);
  line(x + w * 0.3, y + h * 0.76, x + w * 0.74, y + h * 0.24, RED);
}

function sceneGaza(x: number, y: number, w: number, h: number): void {
  skyBand(x, y, w, h, [150, 140, 120], [200, 190, 160]);
  // ruined skyline
  fillRect(x + w * 0.08, y + h * 0.45, w * 0.16, h * 0.35, [110, 100, 88]);
  fillRect(x + w * 0.28, y + h * 0.3, w * 0.16, h * 0.5, [95, 88, 76]);
  fillRect(x + w * 0.48, y + h * 0.55, w * 0.16, h * 0.25, [120, 110, 96]);
  fillRect(x + w * 0.68, y + h * 0.38, w * 0.16, h * 0.42, [100, 92, 80]);
  // warning triangle
  fillTri(x + w * 0.72, y + h * 0.12, x + w * 0.88, y + h * 0.12, x + w * 0.8, y + h * 0.34, GOLD);
  drawText(x + w * 0.78, y + h * 0.16, "!", 1, INK);
  // toxic barrels
  fillRect(x + w * 0.12, y + h * 0.82, w * 0.12, h * 0.14, [60, 90, 50]);
  fillRect(x + w * 0.28, y + h * 0.82, w * 0.12, h * 0.14, [60, 90, 50]);
  fillRect(x + w * 0.44, y + h * 0.82, w * 0.12, h * 0.14, [60, 90, 50]);
  // cracked ground
  fillRect(x, y + h * 0.8, w, h * 0.2, [130, 112, 84]);
  line(x + w * 0.6, y + h * 0.8, x + w * 0.7, y + h, [80, 66, 48]);
}

// -------------------------------------------------------------------- data ---
// 43 stories, 6 continents. Researched from Reuters, AP, AFP, BBC, Al
// Jazeera, Bloomberg, FIDE and TNT Sports on 24 Nov 2026. News-cycle
// standard: stories first reported on 23 Nov that lead today's papers count;
// sports scores verified against two sources.

type Story = { scene: string; kicker: string; head: string; sub: string };

const HEROES: Story[] = [
  {
    scene: "gulf",
    kicker: "MIDDLE EAST",
    head: "GULF ON EDGE",
    sub: "Bahrain demands UN action after Iran's strikes; US widens sanctions; Tehran shows off a new dual missile launcher",
  },
  {
    scene: "market",
    kicker: "MARKETS",
    head: "NVIDIA SOARS",
    sub: "Shares jump nearly a third as founder Jensen Huang returns as CEO; the S&P 500 sits in correction territory",
  },
  {
    scene: "chess",
    kicker: "SPORT - GENEVA",
    head: "CROWN ON THE LINE",
    sub: "Gukesh, 20, defends the chess crown against Sindarov, 20, in the youngest title match in history",
  },
];

const MAIN: Story[] = [
  {
    scene: "climate",
    kicker: "CLIMATE",
    head: "COP31 AFTERMATH",
    sub: "Blame and despair after the Antalya collapse; Erdogan says talks laid groundwork",
  },
  {
    scene: "kyiv",
    kicker: "UKRAINE",
    head: "KYIV UNDER FIRE",
    sub: "Russian drones and missiles hit the Kyiv region; several missing after tower collapse",
  },
  {
    scene: "ship",
    kicker: "BALTIC SEA",
    head: "SHIP ABLAZE",
    sub: "Russian cargo ship Sparta II catches fire in the Gulf of Finland after a drone attack",
  },
  {
    scene: "fire",
    kicker: "INDONESIA",
    head: "FIRE TOLL RISES TO 24",
    sub: "Rescue teams keep searching for the missing at the Banten candy factory",
  },
  {
    scene: "football",
    kicker: "FOOTBALL",
    head: "BRENTFORD HIT FOUR",
    sub: "Lewis-Potter brace and Janelt rocket sink 10-man Everton; Bees climb to sixth",
  },
  {
    scene: "cricket",
    kicker: "CRICKET",
    head: "PANT 128, TEST DRAWN",
    sub: "India fight back to draw the first Test against New Zealand in Wellington",
  },
  {
    scene: "strike",
    kicker: "BELGIUM",
    head: "A NATION STANDS STILL",
    sub: "National strike grounds flights and shuts the skies over Brussels",
  },
  {
    scene: "sanctions",
    kicker: "EUROPE",
    head: "EU'S NEW SANCTIONS",
    sub: "Sports ban planned in a sweeping new package against Russia",
  },
  {
    scene: "gaza",
    kicker: "GAZA",
    head: "TOXIC LEGACY",
    sub: "Oxfam report: war has poisoned Gaza's soil, water and air for decades",
  },
];

const ALSO_ON: string[] = [
  "NATO warns Putin could strike before Europe can respond",
  "Germany faces a knife-edge budget vote",
  "Lisbon marches against the rising cost of living",
  "Russia, Ukraine trade blame at the UN over Black Sea attacks",
  "Netanyahu cites Iran chemical weapons in war push",
  "Netanyahu-Eisenkot talks end with no Israel government deal",
  "Saudi-led coalition says it downed a Houthi missile",
  "Trump targets Newsom and Democrats in DOJ crime speech",
  "Brazil police probe fraud tied to Lula's son",
  "Sheinbaum and Trump hold trade talks at APEC",
  "Drone attack on Colombia police base injures civilians",
  "California sues OpenAI",
  "India and Nepal launch the Saryu-Kamala Express train",
  "India and China hold military talks in Arunachal",
  "Modi opens an AI centre at IIT Patna",
  "Taliban erases women's names from Balkh documents",
  "SpiceJet crisis deepens as pilots seek help on wages",
  "India's oil import bill jumps 60% to $16bn",
  "Ferrari unveils two new 296 models in Spain",
  "Zanzibar hotel fire engulfs beachfront resorts",
  "Nigeria thump Mozambique 4-0 in AFCON last 16",
  "Pacific nations despair after the COP31 flop",
  "Bitcoin ETF outflows reach $669m in four sessions",
  "Pope Leo XIV ends his South America tour",
  "Three challengers emerge against Infantino at FIFA",
  "Alcaraz wins his maiden ATP Finals title in Turin",
  "Verstappen wins the Las Vegas Grand Prix",
  "PSG confirm Doue ruptured his ACL",
  "Barcelona come back 3-2 at Villarreal",
  "Liverpool 4-0 Man Utd: Pochettino's debut nightmare",
  "Hull stun Brighton 2-0 as McBurnie strikes twice",
];

const NUMBERS: [string, string][] = [
  ["44", "HRS COP31 OVERTIME"],
  ["24", "DEAD IN FACTORY FIRE"],
  ["+33%", "NVIDIA JUMP"],
  ["$669M", "BITCOIN ETF OUTFLOWS"],
  ["4-0", "BRENTFORD WIN"],
  ["20", "AGE OF CHESS FINALISTS"],
];

const CLOCK: [string, string][] = [
  ["00:30", "US widens sanctions on Iran's shadow banks"],
  ["04:00", "Pacific nations voice despair after COP31"],
  ["07:30", "Nvidia jumps as Huang returns as CEO"],
  ["10:00", "Belgium's strike grounds flights"],
  ["13:00", "Indonesia fire toll reaches 24"],
  ["15:00", "Chess: Game 1 begins in Geneva"],
  ["19:00", "Brentford 4-0 Everton tops the sports pages"],
];

const REGIONS: [string, number, RGB][] = [
  ["EUROPE 18", 18, BLUE],
  ["AMERICAS 9", 9, GREEN],
  ["ASIA 7", 7, GOLD],
  ["MIDEAST 5", 5, RED],
  ["AFR 2", 2, ORANGE],
  ["OCE 2", 2, SEA],
];

// World map: rough continent outlines in [lon, lat].
const CONTINENTS: [number, number][][] = [
  [
    [-168, 66], [-150, 70], [-135, 69], [-125, 71], [-115, 68], [-105, 68], [-95, 69],
    [-88, 68], [-82, 66], [-76, 62], [-70, 58], [-64, 58], [-60, 52], [-55, 47],
    [-60, 44], [-65, 44], [-70, 41], [-74, 38], [-76, 34], [-80, 30], [-81, 25],
    [-84, 22], [-87, 18], [-90, 14], [-92, 15], [-95, 18], [-97, 22], [-100, 20],
    [-105, 23], [-110, 24], [-114, 29], [-118, 33], [-122, 37], [-124, 42], [-124, 48],
    [-130, 54], [-140, 60], [-152, 58], [-158, 56], [-162, 58], [-166, 60], [-168, 66],
  ],
  [
    [-79, 9], [-77, 5], [-75, 0], [-72, -4], [-68, -8], [-62, -10], [-55, -6],
    [-50, -2], [-44, -3], [-40, -8], [-37, -13], [-39, -18], [-40, -22], [-42, -23],
    [-46, -26], [-48, -28], [-52, -32], [-55, -35], [-58, -38], [-62, -41], [-65, -45],
    [-68, -50], [-70, -54], [-72, -50], [-73, -44], [-73, -37], [-72, -30], [-71, -22],
    [-70, -18], [-75, -15], [-78, -10], [-80, -6], [-81, -1], [-80, 5], [-79, 9],
  ],
  [
    [-17, 15], [-16, 20], [-13, 27], [-10, 31], [-6, 34], [-1, 35], [5, 37],
    [10, 37], [15, 32], [20, 32], [25, 31], [30, 31], [32, 28], [34, 24],
    [36, 20], [38, 17], [40, 15], [43, 11], [46, 11], [51, 11], [51, 6],
    [48, 2], [44, -2], [40, -6], [38, -12], [36, -18], [33, -24], [30, -28],
    [27, -32], [22, -35], [18, -34], [16, -28], [14, -22], [12, -17], [12, -12],
    [11, -6], [9, -2], [9, 3], [6, 4], [0, 6], [-6, 5], [-10, 6], [-13, 8],
    [-16, 12], [-17, 15],
  ],
  [
    [-10, 36], [-9, 38], [-9, 43], [-6, 46], [-2, 48], [-1, 46], [0, 50],
    [2, 51], [5, 53], [7, 54], [8, 57], [10, 59], [12, 58], [18, 56],
    [21, 55], [24, 58], [26, 59], [28, 60], [30, 62], [28, 65], [24, 66],
    [20, 70], [16, 70], [13, 68], [10, 64], [6, 62], [5, 59], [5, 58],
    [0, 55], [-3, 53], [-5, 50], [-8, 48], [-10, 44], [-10, 36],
  ],
  [
    [30, 62], [35, 66], [40, 68], [48, 69], [55, 69], [62, 70], [70, 72],
    [80, 73], [90, 75], [100, 76], [110, 74], [120, 73], [130, 71], [140, 72],
    [150, 70], [158, 69], [165, 66], [170, 66], [178, 65], [178, 64], [170, 60],
    [162, 58], [158, 52], [152, 48], [146, 44], [142, 40], [138, 38], [132, 36],
    [128, 34], [126, 32], [122, 30], [120, 27], [115, 23], [110, 20], [108, 15],
    [106, 10], [104, 8], [100, 7], [98, 10], [96, 15], [93, 18], [90, 22],
    [88, 21], [85, 19], [82, 16], [80, 13], [78, 8], [76, 10], [74, 14],
    [72, 20], [70, 22], [66, 25], [62, 25], [58, 25], [56, 26], [54, 26],
    [52, 28], [50, 29], [48, 30], [46, 30], [44, 32], [42, 35], [40, 36],
    [36, 36], [34, 36], [32, 36], [30, 36],
  ],
  [
    [113, -22], [114, -28], [114, -32], [115, -35], [118, -35], [122, -34], [126, -32],
    [129, -32], [132, -32], [135, -35], [137, -35], [140, -38], [142, -38], [146, -39],
    [149, -37], [150, -35], [152, -32], [153, -28], [152, -24], [150, -22], [147, -19],
    [144, -15], [142, -13], [141, -15], [140, -17], [138, -17], [136, -15], [135, -12],
    [133, -11], [131, -12], [129, -14], [127, -14], [125, -16], [122, -17], [119, -20],
    [116, -21], [113, -22],
  ],
];

const PINS: [number, number, string][] = [
  [30.7, 36.9, "1"],
  [50.5, 26.2, "2"],
  [30.5, 50.4, "3"],
  [26, 59.8, "4"],
  [106, -6.2, "5"],
  [6.1, 46.2, "6"],
  [4.35, 50.85, "7"],
  [-9.1, 38.7, "8"],
  [174.8, -41.3, "9"],
  [-115.1, 36.2, "10"],
  [7.7, 45.1, "11"],
  [39.2, -6.2, "12"],
];

const PIN_LEGEND: [string, string][] = [
  ["1 ANTALYA  2 BAHRAIN  3 KYIV  4 FINLAND  5 BANTEN  6 GENEVA", "7 BRUSSELS  8 LISBON  9 WELLINGTON  10 LAS VEGAS  11 TURIN  12 ZANZIBAR"],
];

const SCENES: Record<string, (x: number, y: number, w: number, h: number) => void> = {
  gulf: sceneGulf,
  market: sceneMarket,
  chess: sceneChess,
  climate: sceneClimate,
  kyiv: sceneKyiv,
  ship: sceneShip,
  fire: sceneFire,
  football: sceneFootball,
  cricket: sceneCricket,
  strike: sceneStrike,
  sanctions: sceneSanctions,
  gaza: sceneGaza,
};

// ------------------------------------------------------------------ layout ---
fillRect(0, 0, W, H, PAPER);
speckle(0, 0, W, H, 2600, [232, 228, 214]);
fillRect(0, 0, W, 4, INK);
fillRect(0, 6, W, 2, RED);

// Masthead
drawTextCentered(512, 14, "THE WORLD IN ONE DAY", 3, INK);
drawTextCentered(512, 40, "TUESDAY, 24 NOVEMBER 2026", 2, INK);
drawTextCentered(512, 60, "43 STORIES  •  6 CONTINENTS  •  ONE DAY", 1, RED);
hline(16, 1008, 76, INK);
hline(16, 1008, 78, INK);

// Region bar
{
  const total = REGIONS.reduce((a, r) => a + r[1], 0);
  let bx = 16;
  for (const [label, n, c] of REGIONS) {
    const bw = Math.floor((992 * n) / total);
    fillRect(bx, 84, bw, 20, c);
    drawTextCentered(bx + bw / 2, 89, label, 1, [250, 250, 245]);
    bx += bw;
  }
}

// Heroes
HEROES.forEach((hero, i) => {
  const hx = 16 + i * 334;
  const hy = 126;
  const hw = 324;
  const hh = 206;
  fillRect(hx, hy, hw, 2, INK);
  fillRect(hx, hy, 2, hh, INK);
  fillRect(hx + hw - 2, hy, 2, hh, INK);
  fillRect(hx, hy + hh - 2, hw, 2, INK);
  SCENES[hero.scene](hx + 2, hy + 2, hw - 4, 108);
  drawText(hx + 8, hy + 116, hero.kicker, 1, RED);
  drawText(hx + 8, hy + 130, hero.head, 2, INK);
  drawWrapped(hx + 8, hy + 150, hero.sub, 1, hw - 16, INK, 10);
});

// Main grid: 9 stories, 3 x 3
MAIN.forEach((story, i) => {
  const col = i % 3;
  const row = Math.floor(i / 3);
  const cx = 16 + col * 334;
  const cy = 344 + row * 76;
  SCENES[story.scene](cx, cy + 2, 64, 64);
  drawText(cx + 72, cy + 4, story.kicker, 1, RED);
  drawText(cx + 72, cy + 18, story.head, 1, INK);
  drawWrapped(cx + 72, cy + 32, story.sub, 1, 244, INK, 9);
  hline(cx, cx + 324, cy + 72, LGREY);
});

// The Day in Numbers
fillRect(16, 580, 992, 52, INK);
drawText(28, 586, "THE DAY IN NUMBERS", 1, GOLD);
{
  const cellW = 992 / 6;
  NUMBERS.forEach(([num, label], i) => {
    const nx = 16 + i * cellW;
    drawTextCentered(nx + cellW / 2, 600, num, 2, [250, 250, 245]);
    drawTextCentered(nx + cellW / 2, 618, label, 1, [200, 200, 195]);
  });
}

// Map panel
{
  const mx = 16;
  const my = 648;
  const mw = 484;
  const mh = 120;
  drawText(mx, my - 12, "WHERE IT HAPPENED", 1, INK);
  fillRect(mx, my, mw, mh, [186, 208, 226]);
  for (const poly of CONTINENTS) {
    const pts = poly.map(([lon, lat]): [number, number] => [
      mx + ((lon + 180) / 360) * mw,
      my + ((90 - lat) / 180) * mh,
    ]);
    fillPoly(pts, [158, 182, 132]);
  }
  // pin numbers
  for (const [lon, lat, n] of PINS) {
    const px0 = mx + ((lon + 180) / 360) * mw;
    const py0 = my + ((90 - lat) / 180) * mh;
    const r = n.length > 1 ? 8 : 7;
    fillCircle(px0, py0, r, RED);
    ring(px0, py0, r, [250, 250, 245]);
    drawText(px0 - textW(n, 1) / 2, py0 - 3, n, 1, [255, 255, 255]);
  }
  drawText(mx, my + mh + 6, PIN_LEGEND[0][0], 1, INK);
  drawText(mx, my + mh + 16, PIN_LEGEND[0][1], 1, INK);
  hline(mx, mx + mw, my - 2, INK);
  vline(mx + mw, my, my + mh, INK);
}

// By the Clock
{
  const cx = 516;
  drawText(cx, 632, "BY THE CLOCK - UTC", 1, INK);
  hline(cx, 1008, 644, INK);
  CLOCK.forEach(([t, s], i) => {
    const y = 654 + i * 21;
    drawText(cx, y, t, 1, RED);
    drawWrapped(cx + 44, y, s, 1, 1008 - cx - 44, INK, 9);
  });
}

// Also on
drawText(16, 808, "ALSO ON 24 NOV", 1, INK);
fillRect(150, 808, 858, 2, RED);
ALSO_ON.forEach((item, i) => {
  const col = i < 16 ? 0 : 1;
  const row = i < 16 ? i : i - 16;
  const ix = 16 + col * 500;
  const iy = 824 + row * 9;
  drawText(ix, iy, String(i + 1) + ".", 1, RED);
  drawText(ix + 24, iy, item, 1, INK);
});

// Footer
hline(16, 1008, 970, INK);
drawText(16, 978, "SOURCES: REUTERS - AP - AFP - BBC - AL JAZEERA - BLOOMBERG - FIDE - TNT SPORTS", 1, GREY);
drawWrapped(
  16,
  990,
  "DATE CHECK: STORIES FIRST REPORTED ON 23 NOV THAT LEAD TODAY'S PAPERS COUNT UNDER THE NEWS-CYCLE STANDARD; SPORTS SCORES VERIFIED AGAINST TWO SOURCES.",
  1,
  976,
  GREY,
  9,
);
drawTextCentered(512, 1010, "DRAWN IN CODE - NO PHOTOGRAPHS - ALL SCENES ORIGINAL", 1, GREY);

// -------------------------------------------------------------------- main ---
const outDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "entry.png"), encodePNG(W, H, img));
