/**
 * Plaža — render v2: tropska plaža.
 *
 * Redosled: nebo → zvezde (noć) → (hooks.sky) → sunce/mesec → (hooks.body) →
 * puhasti oblaci → more (dubina → plićina) → staza odsjaja → ostrvo / jedrilica
 * na horizontu → linije talasa → plićina uz obalu → mokar pesak → pesak →
 * pena na obali → školjke / morske zvezde / suncobran → palme → galebovi.
 *
 * QRNG bira odluke (paleta, horizont, obala, šta se pojavljuje); detalji iz
 * PRNG-a seedovanog QRNG-om. Dimenzije relativne (s = w/1200).
 */
import type { QRNGStream } from "../qrng";
import { hslToRgb, rgbString, type RGB } from "../color";
import { prngFromStream, type Rand } from "../prng";
import { NO_HOOKS, type SceneHooks, type SkyLight } from "../sky-events";

type HSL = [number, number, number];

interface BeachPalette {
  name: string;
  light: SkyLight;
  sky: [HSL, HSL, HSL];
  sun: HSL;
  moon?: boolean;
  stars?: boolean;
  seaDeep: HSL;
  seaShallow: HSL;
  sand: HSL;
  palm: HSL;
  clouds: number; // 0–1 količina oblaka
  cloudTint: HSL;
}

const PALETTES: readonly BeachPalette[] = [
  {
    name: "tropical-noon",
    light: "day",
    sky: [[205, 0.7, 0.5], [198, 0.65, 0.66], [190, 0.55, 0.82]],
    sun: [50, 1, 0.94],
    seaDeep: [210, 0.7, 0.35],
    seaShallow: [178, 0.65, 0.55],
    sand: [42, 0.6, 0.78],
    palm: [130, 0.45, 0.28],
    clouds: 0.6,
    cloudTint: [210, 0.3, 0.97],
  },
  {
    name: "lagoon",
    light: "day",
    sky: [[200, 0.65, 0.58], [190, 0.55, 0.74], [185, 0.45, 0.88]],
    sun: [52, 1, 0.95],
    seaDeep: [195, 0.75, 0.38],
    seaShallow: [172, 0.7, 0.62],
    sand: [45, 0.45, 0.88],
    palm: [120, 0.5, 0.3],
    clouds: 0.35,
    cloudTint: [200, 0.25, 0.98],
  },
  {
    name: "sunset-beach",
    light: "dusk",
    sky: [[260, 0.4, 0.32], [330, 0.55, 0.55], [25, 0.95, 0.62]],
    sun: [30, 1, 0.7],
    seaDeep: [265, 0.4, 0.25],
    seaShallow: [320, 0.35, 0.45],
    sand: [28, 0.6, 0.6],
    palm: [280, 0.3, 0.14],
    clouds: 0.55,
    cloudTint: [15, 0.8, 0.7],
  },
  {
    name: "pastel-morning",
    light: "dusk",
    sky: [[210, 0.45, 0.68], [330, 0.5, 0.82], [30, 0.8, 0.84]],
    sun: [38, 1, 0.86],
    seaDeep: [205, 0.45, 0.48],
    seaShallow: [180, 0.4, 0.68],
    sand: [35, 0.55, 0.8],
    palm: [150, 0.25, 0.3],
    clouds: 0.5,
    cloudTint: [340, 0.6, 0.9],
  },
  {
    name: "moonlit",
    light: "night",
    sky: [[230, 0.55, 0.07], [226, 0.45, 0.15], [215, 0.35, 0.26]],
    sun: [50, 0.25, 0.92],
    moon: true,
    stars: true,
    seaDeep: [225, 0.55, 0.1],
    seaShallow: [200, 0.4, 0.22],
    sand: [220, 0.15, 0.36],
    palm: [225, 0.35, 0.07],
    clouds: 0.25,
    cloudTint: [225, 0.2, 0.4],
  },
  {
    name: "overcast",
    light: "day",
    sky: [[210, 0.15, 0.55], [205, 0.15, 0.68], [195, 0.2, 0.78]],
    sun: [48, 0.5, 0.9],
    seaDeep: [195, 0.35, 0.3],
    seaShallow: [170, 0.35, 0.48],
    sand: [38, 0.3, 0.68],
    palm: [140, 0.3, 0.24],
    clouds: 1,
    cloudTint: [210, 0.1, 0.85],
  },
];

function hsl(c: HSL, dh = 0, dl = 0): RGB {
  return hslToRgb(c[0] + dh, c[1], Math.min(0.97, Math.max(0.02, c[2] + dl)));
}

function mix(a: RGB, b: RGB, t: number): RGB {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

function rgba(c: RGB, a: number): string {
  return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
}

export function renderBeach(
  ctx: CanvasRenderingContext2D,
  stream: QRNGStream,
  w: number,
  h: number,
  hooks: SceneHooks = NO_HOOKS
): void {
  const s = w / 1200;

  // ---- Odluke (QRNG) ----
  const pal = PALETTES[stream.next_int(0, PALETTES.length - 1)]!;
  const dh = stream.next_int(-8, 8);
  const horizonY = Math.floor(h * (0.4 + 0.12 * stream.next_f()));
  const sunX = w * (0.15 + 0.7 * stream.next_f());
  const sunR = (pal.moon ? 16 + 12 * stream.next_f() : 24 + 20 * stream.next_f()) * s;
  const sunY = pal.light === "dusk" ? horizonY * (0.6 + 0.3 * stream.next_f()) : horizonY * (0.15 + 0.35 * stream.next_f());
  // Obala: kosa linija + blaga krivina
  const shoreL = horizonY + (h - horizonY) * (0.35 + 0.35 * stream.next_f());
  const shoreR = horizonY + (h - horizonY) * (0.35 + 0.35 * stream.next_f());
  const islandRoll = stream.next_f();
  const boatRoll = stream.next_f();
  const umbrellaRoll = stream.next_f();
  const palmsCount = stream.next_int(1, 4);
  const rand = prngFromStream(stream);

  const lightDir = sunX < w / 2 ? 1 : -1;
  const sky = pal.sky.map((c) => hsl(c, dh));
  const skyHorizon = sky[2]!;
  const sunCol = hsl(pal.sun);
  const sunCore = mix(sunCol, [255, 252, 240], 0.6);
  const seaDeep = hsl(pal.seaDeep, dh);
  const seaShallow = hsl(pal.seaShallow, dh);
  const sand = hsl(pal.sand, dh * 0.5);
  const palmCol = hsl(pal.palm, dh * 0.5);
  const foam: RGB = pal.moon ? [190, 205, 230] : [255, 255, 255];

  const bend = (rand() - 0.5) * 60 * s;
  const shore = (x: number) => {
    const u = x / w;
    return shoreL + (shoreR - shoreL) * u + bend * Math.sin(u * Math.PI);
  };

  // ---- 1. Nebo ----
  const g = ctx.createLinearGradient(0, 0, 0, horizonY);
  g.addColorStop(0, rgbString(sky[0]!));
  g.addColorStop(0.6, rgbString(sky[1]!));
  g.addColorStop(1, rgbString(skyHorizon));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, horizonY + 1);

  // ---- 2. Zvezde ----
  if (pal.stars) {
    const n = 150 + Math.floor(rand() * 150);
    for (let i = 0; i < n; i++) {
      const y = Math.pow(rand(), 1.4) * horizonY * 0.9;
      ctx.fillStyle = `rgba(255,255,255,${((0.25 + 0.7 * rand()) * (1 - y / horizonY)).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(rand() * w, y, (rand() < 0.9 ? 0.7 : 1.3) * Math.max(0.6, s), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  hooks.sky({ horizonY, light: pal.light });

  // ---- 3. Sunce / mesec ----
  const glowR = sunR * (pal.moon ? 6 : 9);
  const glow = ctx.createRadialGradient(sunX, sunY, sunR * 0.6, sunX, sunY, glowR);
  glow.addColorStop(0, rgba(sunCol, pal.moon ? 0.25 : 0.55));
  glow.addColorStop(0.3, rgba(sunCol, pal.moon ? 0.07 : 0.2));
  glow.addColorStop(1, rgba(sunCol, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(sunX - glowR, Math.max(0, sunY - glowR), glowR * 2, Math.min(horizonY, sunY + glowR) - Math.max(0, sunY - glowR));
  const core = ctx.createRadialGradient(sunX - sunR * 0.25, sunY - sunR * 0.25, 0, sunX, sunY, sunR);
  core.addColorStop(0, rgbString(sunCore));
  core.addColorStop(1, rgbString(sunCol));
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
  ctx.fill();
  hooks.body({ x: sunX, y: sunY, r: sunR, kind: pal.moon ? "moon" : "sun" });

  // ---- 4. Puhasti oblaci (ravno dno, osvetljen vrh) ----
  const cloudN = Math.floor(pal.clouds * (2 + rand() * 6));
  const cloudLit = hsl(pal.cloudTint);
  const cloudShade = mix(cloudLit, sky[0]!, 0.45);
  for (let i = 0; i < cloudN; i++) {
    const cx = rand() * w;
    const cy = horizonY * (0.2 + 0.6 * rand());
    const cw = (90 + rand() * 220) * s * (pal.name === "overcast" ? 1.6 : 1);
    drawCumulus(ctx, rand, cx, cy, cw, cloudLit, cloudShade, lightDir);
  }

  // ---- 5. More: dubina pri horizontu → plićina ka obali ----
  const seaBottom = Math.max(shoreL, shoreR) + 30 * s;
  const sg = ctx.createLinearGradient(0, horizonY, 0, seaBottom);
  sg.addColorStop(0, rgbString(mix(seaDeep, skyHorizon, 0.25)));
  sg.addColorStop(0.35, rgbString(seaDeep));
  sg.addColorStop(1, rgbString(mix(seaDeep, seaShallow, 0.6)));
  ctx.fillStyle = sg;
  ctx.fillRect(0, horizonY, w, h - horizonY);

  // ---- 6. Staza odsjaja ----
  const glints = 160 + Math.floor(rand() * 120);
  for (let i = 0; i < glints; i++) {
    const t = Math.pow(rand(), 1.3);
    const gy = horizonY + 2 + t * (Math.min(shoreL, shoreR) - horizonY);
    const spread = sunR * (1 + t * 4);
    const off = (rand() + rand() - 1) * spread;
    const len = (5 + rand() * 20) * s * (0.6 + t);
    ctx.fillStyle = rgba(sunCore, (pal.moon ? 0.45 : 0.6) * (1 - t * 0.5) * rand());
    ctx.fillRect(sunX + off - len / 2, gy, len, Math.max(1, 1.2 * s));
  }

  // ---- 7. Ostrvo / jedrilica na horizontu ----
  const silCol = mix(seaDeep, [0, 0, 0], 0.35);
  if (islandRoll < 0.35) {
    drawIsland(ctx, rand, w * (0.1 + 0.8 * rand()), horizonY, s, mix(palmCol, skyHorizon, 0.45));
  }
  if (boatRoll < 0.25) {
    drawSail(ctx, w * (0.1 + 0.8 * rand()), horizonY + 4 * s, s * (0.6 + 0.4 * rand()), silCol, foam);
  }

  // ---- 8. Linije talasa (perspektiva) ----
  let y = horizonY + 5 * s;
  let gap = 4 * s;
  while (y < seaBottom) {
    const segs = 2 + Math.floor(rand() * 4);
    for (let k = 0; k < segs; k++) {
      const len = (30 + rand() * 120) * s * (1 + (y - horizonY) / (h - horizonY));
      ctx.fillStyle = rgba(foam, 0.08 + 0.12 * rand());
      ctx.fillRect(rand() * w - len / 2, y, len, Math.max(1, s));
    }
    y += gap;
    gap *= 1.12;
  }

  // ---- 9. Plićina uz obalu (svetlija tirkizna traka) ----
  const shallowW = (30 + rand() * 30) * s;
  ctx.beginPath();
  ctx.moveTo(0, shore(0) - shallowW);
  for (let x = 0; x <= w; x += 8 * s) ctx.lineTo(x, shore(x) - shallowW + Math.sin(x / (40 * s)) * 3 * s);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  const shg = ctx.createLinearGradient(0, Math.min(shoreL, shoreR) - shallowW, 0, Math.max(shoreL, shoreR));
  shg.addColorStop(0, rgba(seaShallow, 0.0));
  shg.addColorStop(0.5, rgba(seaShallow, 0.85));
  shg.addColorStop(1, rgbString(mix(seaShallow, foam, 0.25)));
  ctx.fillStyle = shg;
  ctx.fill();

  // ---- 10. Pesak (mokar pojas + suv) ----
  const wetW = (8 + rand() * 10) * s;
  const sandPath = (off: number) => {
    ctx.beginPath();
    ctx.moveTo(0, h + 2);
    for (let x = 0; x <= w; x += 6 * s) ctx.lineTo(x, shore(x) + off + Math.sin(x / (55 * s) + 1) * 2.5 * s);
    ctx.lineTo(w, h + 2);
    ctx.closePath();
  };
  sandPath(0);
  ctx.fillStyle = rgbString(mix(sand, seaShallow, 0.35));
  ctx.fill();
  sandPath(wetW);
  const dg = ctx.createLinearGradient(0, Math.min(shoreL, shoreR), 0, h);
  dg.addColorStop(0, rgbString(sand));
  dg.addColorStop(1, rgbString(mix(sand, [120, 90, 60], 0.12)));
  ctx.fillStyle = dg;
  ctx.fill();

  // ---- 11. Pena na obali (2–3 talasaste linije) ----
  const foamLines = 2 + Math.floor(rand() * 2);
  for (let k = 0; k < foamLines; k++) {
    const off = -k * (10 + rand() * 14) * s + 2 * s;
    const ph = rand() * 6.28;
    ctx.strokeStyle = rgba(foam, k === 0 ? 0.85 : 0.45);
    ctx.lineWidth = Math.max(1, (k === 0 ? 2.4 : 1.6) * s);
    ctx.beginPath();
    for (let x = 0; x <= w; x += 5 * s) {
      const yy = shore(x) + off + Math.sin(x / (30 * s) + ph) * 2.5 * s + Math.sin(x / (9 * s) + ph * 2) * 1 * s;
      if (x === 0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  // Mehurići pene
  for (let i = 0; i < 80; i++) {
    const x = rand() * w;
    ctx.fillStyle = rgba(foam, 0.5 * rand());
    ctx.beginPath();
    ctx.arc(x, shore(x) + (rand() - 0.6) * 18 * s, (0.8 + rand() * 1.6) * s, 0, Math.PI * 2);
    ctx.fill();
  }

  // ---- 12. Tekstura peska, školjke, morske zvezde ----
  for (let i = 0; i < 260; i++) {
    const x = rand() * w;
    const yy = shore(x) + wetW + rand() * (h - shore(x));
    ctx.fillStyle = rgba(rand() < 0.5 ? mix(sand, [255, 255, 255], 0.4) : mix(sand, [90, 60, 30], 0.3), 0.35);
    ctx.fillRect(x, yy, Math.max(1, 1.4 * s), Math.max(1, 1.4 * s));
  }
  const shells = Math.floor(rand() * 5);
  for (let i = 0; i < shells; i++) {
    const x = w * (0.1 + 0.8 * rand());
    const yy = shore(x) + wetW + (h - shore(x)) * (0.2 + 0.7 * rand());
    if (rand() < 0.4) drawStarfish(ctx, rand, x, yy, (7 + rand() * 6) * s, pal.moon ? [140, 110, 120] : [235, 120, 80]);
    else drawShell(ctx, x, yy, (5 + rand() * 4) * s, mix(sand, [255, 240, 230], 0.6), mix(sand, [120, 90, 70], 0.4));
  }

  // ---- 13. Suncobran ----
  if (umbrellaRoll < 0.2 && !pal.moon) {
    const ux = w * (0.25 + 0.5 * rand());
    const uy = shore(ux) + (h - shore(ux)) * (0.5 + 0.3 * rand());
    drawUmbrella(ctx, rand, ux, uy, s * (0.9 + 0.4 * rand()), lightDir);
  }

  // ---- 14. Palme (sa strana, nagnute ka sredini) ----
  for (let i = 0; i < palmsCount; i++) {
    const left = i % 2 === 0 ? rand() < 0.6 : rand() < 0.4;
    const x = left ? w * (0.02 + 0.14 * rand()) : w * (0.84 + 0.14 * rand());
    const by = h - (h - Math.max(shoreL, shoreR)) * (0.05 + 0.4 * rand());
    // Krošnja mora ostati u kadru (vrh najmanje ~16% visine od gornje ivice)
    const th = Math.min((h - horizonY) * (0.65 + 0.35 * rand()) + 120 * s * rand(), by - h * 0.16);
    drawPalm(ctx, rand, x, by, th, left ? 1 : -1, palmCol, s, lightDir, !!pal.moon);
  }

  // ---- 15. Galebovi ----
  if (!pal.moon && rand() < 0.45) {
    const n = 2 + Math.floor(rand() * 4);
    ctx.strokeStyle = rgba(mix(palmCol, [0, 0, 0], 0.3), 0.85);
    ctx.lineWidth = Math.max(1, 1.6 * s);
    ctx.lineCap = "round";
    for (let i = 0; i < n; i++) {
      const x = w * (0.2 + 0.6 * rand());
      const yy = horizonY * (0.2 + 0.5 * rand());
      const sp = (6 + rand() * 8) * s;
      ctx.beginPath();
      ctx.moveTo(x - sp, yy - sp * 0.3);
      ctx.quadraticCurveTo(x - sp * 0.45, yy - sp * 0.55, x, yy);
      ctx.quadraticCurveTo(x + sp * 0.45, yy - sp * 0.55, x + sp, yy - sp * 0.3);
      ctx.stroke();
    }
  }
}

function drawCumulus(
  ctx: CanvasRenderingContext2D,
  rand: Rand,
  cx: number,
  cy: number,
  cw: number,
  lit: RGB,
  shade: RGB,
  lightDir: number
): void {
  const puffs: [number, number, number][] = [];
  const n = 5 + Math.floor(rand() * 5);
  for (let i = 0; i < n; i++) {
    const u = (i / (n - 1) - 0.5) * 2; // -1..1
    const r = cw * (0.12 + 0.12 * rand()) * (1 - Math.abs(u) * 0.45);
    puffs.push([cx + u * cw * 0.45, cy - r * (0.4 + 0.5 * rand()), r]);
  }
  const path = (dx: number, dy: number, k: number) => {
    ctx.beginPath();
    for (const [px, py, r] of puffs) {
      ctx.moveTo(px + dx + r * k, py + dy);
      ctx.arc(px + dx, py + dy, r * k, 0, Math.PI * 2);
    }
  };
  // Senka (donji deo) pa osvetljeno telo pomereno ka svetlu
  ctx.save();
  ctx.beginPath();
  ctx.rect(cx - cw, cy - cw, cw * 2, cw); // ravno dno na cy
  ctx.clip();
  path(0, 0, 1);
  ctx.fillStyle = rgbString(shade);
  ctx.fill();
  path(-lightDir * cw * 0.03, -cw * 0.03, 0.92);
  ctx.fillStyle = rgbString(lit);
  ctx.fill();
  ctx.restore();
}

function drawIsland(ctx: CanvasRenderingContext2D, rand: Rand, x: number, horizonY: number, s: number, col: RGB): void {
  const iw = (60 + rand() * 120) * s;
  const ih = (8 + rand() * 14) * s;
  ctx.fillStyle = rgbString(col);
  ctx.beginPath();
  ctx.moveTo(x - iw, horizonY + 1);
  ctx.quadraticCurveTo(x - iw * 0.4, horizonY - ih * 1.3, x, horizonY - ih);
  ctx.quadraticCurveTo(x + iw * 0.5, horizonY - ih * 0.9, x + iw, horizonY + 1);
  ctx.closePath();
  ctx.fill();
  const palms = 1 + Math.floor(rand() * 3);
  ctx.strokeStyle = rgbString(col);
  ctx.lineCap = "round";
  for (let i = 0; i < palms; i++) {
    const px = x + (rand() - 0.5) * iw * 0.8;
    const ph = (12 + rand() * 10) * s;
    const top = horizonY - ih * 0.8 - ph;
    ctx.lineWidth = 1.5 * s;
    ctx.beginPath();
    ctx.moveTo(px, horizonY - ih * 0.6);
    ctx.quadraticCurveTo(px + 3 * s, top + ph * 0.5, px + 4 * s, top);
    ctx.stroke();
    for (let f = 0; f < 6; f++) {
      const a = Math.PI + (f / 5) * Math.PI;
      ctx.beginPath();
      ctx.moveTo(px + 4 * s, top);
      ctx.quadraticCurveTo(px + 4 * s + Math.cos(a) * 6 * s, top + Math.sin(a) * 6 * s - 2 * s, px + 4 * s + Math.cos(a) * 9 * s, top + Math.sin(a) * 4 * s + 4 * s);
      ctx.stroke();
    }
  }
}

function drawSail(ctx: CanvasRenderingContext2D, x: number, y: number, k: number, hull: RGB, sail: RGB): void {
  ctx.fillStyle = rgbString(hull);
  ctx.beginPath();
  ctx.moveTo(x - 16 * k, y - 3 * k);
  ctx.lineTo(x + 18 * k, y - 3 * k);
  ctx.lineTo(x + 12 * k, y + 2 * k);
  ctx.lineTo(x - 11 * k, y + 2 * k);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(x - 0.6 * k, y - 36 * k, 1.2 * k, 33 * k);
  ctx.fillStyle = rgba(sail, 0.92);
  ctx.beginPath();
  ctx.moveTo(x + 1.2 * k, y - 35 * k);
  ctx.quadraticCurveTo(x + 12 * k, y - 20 * k, x + 15 * k, y - 5 * k);
  ctx.lineTo(x + 1.2 * k, y - 5 * k);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x - 1.2 * k, y - 30 * k);
  ctx.lineTo(x - 11 * k, y - 5 * k);
  ctx.lineTo(x - 1.2 * k, y - 5 * k);
  ctx.closePath();
  ctx.fill();
}

/** Palma: zakrivljeno stablo sa prstenovima + lišće sa liskama + kokosi. */
function drawPalm(
  ctx: CanvasRenderingContext2D,
  rand: Rand,
  x: number,
  baseY: number,
  th: number,
  lean: number,
  col: RGB,
  s: number,
  lightDir: number,
  night: boolean
): void {
  const trunkCol = night ? mix(col, [0, 0, 0], 0.3) : mix(col, [120, 85, 50], 0.65);
  const topX = x + lean * th * (0.35 + 0.25 * rand());
  const topY = baseY - th;
  const ctrlX = x + lean * th * (0.02 + 0.08 * rand());
  const ctrlY = baseY - th * 0.55;
  const bw = th * 0.045;
  const tw = th * 0.025;
  // Stablo: jedna glatka površina + svetla ivica + prstenovi
  const segs = 22;
  const pt = (t: number) => ({
    x: (1 - t) * (1 - t) * x + 2 * (1 - t) * t * ctrlX + t * t * topX,
    y: (1 - t) * (1 - t) * baseY + 2 * (1 - t) * t * ctrlY + t * t * topY,
  });
  const left: { x: number; y: number }[] = [];
  const right: { x: number; y: number }[] = [];
  const mids: { x: number; y: number; w: number }[] = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const p0 = pt(t);
    const p1 = pt(Math.min(1, t + 0.01));
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const dl = Math.hypot(dx, dy) || 1;
    const nx = -dy / dl;
    const ny = dx / dl;
    const wt = bw + (tw - bw) * t;
    left.push({ x: p0.x + nx * wt, y: p0.y + ny * wt });
    right.push({ x: p0.x - nx * wt, y: p0.y - ny * wt });
    mids.push({ x: p0.x, y: p0.y, w: wt });
  }
  ctx.fillStyle = rgbString(trunkCol);
  ctx.beginPath();
  left.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i]!.x, right[i]!.y);
  ctx.closePath();
  ctx.fill();
  // Svetla ivica sa strane sunca
  const litEdge = lightDir > 0 ? (lean > 0 ? right : left) : lean > 0 ? left : right;
  ctx.strokeStyle = rgba(mix(trunkCol, [255, 245, 220], night ? 0.1 : 0.35), 0.7);
  ctx.lineWidth = Math.max(1, bw * 0.35);
  ctx.beginPath();
  litEdge.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.stroke();
  // Prstenovi
  ctx.strokeStyle = rgba(mix(trunkCol, [0, 0, 0], 0.35), 0.55);
  ctx.lineWidth = Math.max(1, 1.2 * s);
  for (let i = 1; i < segs; i++) {
    ctx.beginPath();
    ctx.moveTo(left[i]!.x, left[i]!.y);
    ctx.quadraticCurveTo(mids[i]!.x, mids[i]!.y + mids[i]!.w * 0.35, right[i]!.x, right[i]!.y);
    ctx.stroke();
  }
  // Lišće
  const fronds = 7 + Math.floor(rand() * 5);
  const lit = night ? mix(col, [150, 175, 220], 0.12) : mix(col, [255, 250, 200], 0.15);
  const shade = mix(col, [0, 0, 0], 0.25);
  const flen = th * (0.38 + 0.12 * rand());
  for (let f = 0; f < fronds; f++) {
    const a0 = -Math.PI / 2 + ((f / (fronds - 1)) - 0.5) * Math.PI * 1.7 + (rand() - 0.5) * 0.25;
    const len = flen * (0.75 + 0.35 * rand());
    const droop = len * (0.35 + 0.35 * Math.abs(Math.cos(a0)));
    const ex = topX + Math.cos(a0) * len;
    const ey = topY + Math.sin(a0) * len * 0.6 + droop;
    const cx = topX + Math.cos(a0) * len * 0.55;
    const cy = topY + Math.sin(a0) * len * 0.55 - len * 0.12;
    const c = Math.cos(a0) * lightDir < 0 ? lit : shade;
    // Pun nazubljen list: niz po rebru, zupci (liske) sa obe strane
    const leaflets = 26;
    const sideA: { x: number; y: number }[] = [];
    const sideB: { x: number; y: number }[] = [];
    for (let k = 0; k <= leaflets; k++) {
      const t = k / leaflets;
      const px = (1 - t) * (1 - t) * topX + 2 * (1 - t) * t * cx + t * t * ex;
      const py = (1 - t) * (1 - t) * topY + 2 * (1 - t) * t * cy + t * t * ey;
      const dx = 2 * (1 - t) * (cx - topX) + 2 * t * (ex - cx);
      const dy = 2 * (1 - t) * (cy - topY) + 2 * t * (ey - cy);
      const dl = Math.hypot(dx, dy) || 1;
      const nx = -dy / dl;
      const ny = dx / dl;
      const ll = len * 0.27 * Math.sin(Math.PI * Math.min(1, 0.1 + t * 0.92));
      const inner = Math.max(1.2 * s, ll * 0.08);
      // duga uska liska: vrh povučen unazad i opušten nadole, pa udubljenje pri rebru
      const back = ll * 0.75;
      const sag = ll * 0.65;
      sideA.push({ x: px + nx * ll - (dx / dl) * back, y: py + ny * ll - (dy / dl) * back + sag });
      sideA.push({ x: px + nx * inner, y: py + ny * inner });
      sideB.push({ x: px - nx * ll - (dx / dl) * back, y: py - ny * ll - (dy / dl) * back + sag });
      sideB.push({ x: px - nx * inner, y: py - ny * inner });
    }
    ctx.fillStyle = rgbString(c);
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    for (const p of sideA) ctx.lineTo(p.x, p.y);
    ctx.lineTo(ex, ey);
    for (let k = sideB.length - 1; k >= 0; k--) ctx.lineTo(sideB[k]!.x, sideB[k]!.y);
    ctx.closePath();
    ctx.fill();
    // Rebro lista
    ctx.strokeStyle = rgbString(mix(c, [0, 0, 0], 0.2));
    ctx.lineCap = "round";
    ctx.lineWidth = Math.max(1, 1.6 * s);
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.quadraticCurveTo(cx, cy, ex, ey);
    ctx.stroke();
  }
  // Kokosi
  ctx.fillStyle = rgbString(mix(trunkCol, [60, 40, 20], 0.4));
  const nuts = 2 + Math.floor(rand() * 3);
  for (let i = 0; i < nuts; i++) {
    ctx.beginPath();
    ctx.arc(topX + (rand() - 0.5) * th * 0.05, topY + th * 0.02 + rand() * th * 0.02, th * 0.017, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawStarfish(ctx: CanvasRenderingContext2D, rand: Rand, x: number, y: number, r: number, col: RGB): void {
  const rot = rand() * Math.PI * 2;
  ctx.fillStyle = rgbString(col);
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = rot + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.42;
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr * 0.6;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

function drawShell(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, col: RGB, line: RGB): void {
  ctx.fillStyle = rgbString(col);
  ctx.beginPath();
  ctx.moveTo(x - r, y);
  ctx.quadraticCurveTo(x, y - r * 1.5, x + r, y);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = rgbString(line);
  ctx.lineWidth = Math.max(0.6, r * 0.12);
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + i * r * 0.4, y - r * 0.6 * (1 - Math.abs(i) * 0.15));
    ctx.stroke();
  }
}

function drawUmbrella(ctx: CanvasRenderingContext2D, rand: Rand, x: number, y: number, k: number, lightDir: number): void {
  const colors: RGB[][] = [
    [[230, 70, 60], [250, 245, 235]],
    [[40, 120, 200], [250, 245, 235]],
    [[245, 180, 40], [235, 90, 60]],
  ];
  const [c1, c2] = colors[Math.floor(rand() * colors.length)]!;
  const tilt = lightDir * 0.15;
  const topX = x + Math.sin(tilt) * 60 * k;
  const topY = y - 60 * k;
  // Senka
  ctx.fillStyle = "rgba(60,40,20,0.18)";
  ctx.beginPath();
  ctx.ellipse(x - lightDir * 20 * k, y + 2 * k, 40 * k, 7 * k, 0, 0, Math.PI * 2);
  ctx.fill();
  // Štap
  ctx.strokeStyle = "rgb(90,70,55)";
  ctx.lineWidth = 2 * k;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(topX, topY);
  ctx.stroke();
  // Platno u segmentima
  const R = 42 * k;
  const segs = 8;
  for (let i = 0; i < segs; i++) {
    const a0 = Math.PI + (i / segs) * Math.PI + tilt;
    const a1 = Math.PI + ((i + 1) / segs) * Math.PI + tilt;
    ctx.fillStyle = rgbString(i % 2 === 0 ? c1 : c2);
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.lineTo(topX + Math.cos(a0) * R, topY + Math.sin(a0) * R * 0.45 + R * 0.3);
    ctx.quadraticCurveTo(
      topX + Math.cos((a0 + a1) / 2) * R * 1.02,
      topY + Math.sin((a0 + a1) / 2) * R * 0.45 + R * 0.22,
      topX + Math.cos(a1) * R,
      topY + Math.sin(a1) * R * 0.45 + R * 0.3
    );
    ctx.closePath();
    ctx.fill();
  }
}
