/**
 * Zalazak nad vodom — render v2.
 *
 * Redosled: nebo (paleta) → zvezde (tamne palete) → sunce (meki sjaj) →
 * oblaci obasjani odozdo → izmaglica na horizontu → voda (refleks neba) →
 * svetlosna staza → linije talasa → silueta (opciono) → ptice (opciono).
 *
 * QRNG bira odluke (paleta, visina/veličina sunca, oblaci, silueta);
 * sitni detalji (odsjaji, zvezde, talasići) idu iz PRNG-a seedovanog QRNG-om.
 * Sve dimenzije su relativne (s = w/1200), pa thumbnail i OG izgledaju isto.
 */
import type { QRNGStream } from "../qrng";
import { hslToRgb, rgbString, type RGB } from "../color";
import { ridgePoints } from "../draw-utils";
import { prngFromStream, type Rand } from "../prng";
import { choice, optional, type ControlDef } from "./controls";
import { NO_HOOKS, type SceneHooks } from "../sky-events";

interface SunsetPalette {
  name: string;
  /** Nebo od vrha ka horizontu: [h, s, l] */
  sky: [number, number, number][];
  sun: [number, number, number];
  cloudLit: [number, number, number];
  cloudShade: [number, number, number];
  waterDeep: [number, number, number];
  /** Plavi sat — sunce je ispod horizonta, vidi se samo sjaj. */
  sunBelow?: boolean;
  stars?: boolean;
}

const PALETTES: readonly SunsetPalette[] = [
  {
    name: "classic",
    sky: [[235, 0.55, 0.2], [285, 0.55, 0.35], [330, 0.7, 0.5], [22, 0.9, 0.58]],
    sun: [38, 1, 0.72],
    cloudLit: [25, 0.95, 0.62],
    cloudShade: [280, 0.35, 0.3],
    waterDeep: [235, 0.55, 0.08],
  },
  {
    name: "golden",
    sky: [[210, 0.45, 0.42], [200, 0.3, 0.6], [40, 0.8, 0.7], [32, 0.95, 0.62]],
    sun: [45, 1, 0.82],
    cloudLit: [38, 0.95, 0.72],
    cloudShade: [215, 0.25, 0.45],
    waterDeep: [210, 0.5, 0.14],
  },
  {
    name: "pastel",
    sky: [[220, 0.45, 0.62], [270, 0.35, 0.72], [340, 0.6, 0.78], [25, 0.85, 0.78]],
    sun: [35, 1, 0.88],
    cloudLit: [345, 0.8, 0.82],
    cloudShade: [255, 0.25, 0.6],
    waterDeep: [225, 0.4, 0.28],
  },
  {
    name: "crimson",
    sky: [[230, 0.6, 0.1], [300, 0.5, 0.2], [350, 0.75, 0.35], [10, 0.9, 0.48]],
    sun: [20, 1, 0.62],
    cloudLit: [5, 0.9, 0.5],
    cloudShade: [290, 0.4, 0.15],
    waterDeep: [240, 0.6, 0.05],
  },
  {
    name: "tropical",
    sky: [[200, 0.6, 0.38], [190, 0.4, 0.55], [15, 0.85, 0.62], [35, 1, 0.6]],
    sun: [48, 1, 0.75],
    cloudLit: [18, 1, 0.68],
    cloudShade: [205, 0.3, 0.4],
    waterDeep: [195, 0.6, 0.12],
  },
  {
    name: "lilac",
    sky: [[250, 0.4, 0.3], [270, 0.35, 0.48], [300, 0.35, 0.62], [20, 0.7, 0.72]],
    sun: [30, 0.95, 0.8],
    cloudLit: [320, 0.55, 0.72],
    cloudShade: [255, 0.3, 0.35],
    waterDeep: [250, 0.45, 0.12],
  },
  {
    name: "smoky-amber",
    sky: [[30, 0.15, 0.3], [30, 0.35, 0.42], [28, 0.7, 0.52], [38, 0.95, 0.58]],
    sun: [45, 1, 0.7],
    cloudLit: [32, 0.8, 0.55],
    cloudShade: [20, 0.2, 0.25],
    waterDeep: [25, 0.3, 0.08],
  },
  {
    name: "blue-hour",
    sky: [[230, 0.6, 0.1], [228, 0.5, 0.2], [235, 0.35, 0.35], [25, 0.75, 0.5]],
    sun: [28, 1, 0.6],
    cloudLit: [15, 0.6, 0.42],
    cloudShade: [230, 0.4, 0.16],
    waterDeep: [230, 0.6, 0.05],
    sunBelow: true,
    stars: true,
  },
];

type HSL = [number, number, number];

function jitter(c: HSL, dh: number, dl: number): RGB {
  return hslToRgb(c[0] + dh, c[1], Math.min(0.95, Math.max(0.03, c[2] + dl)));
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

/** Kontrole za Studio. */
export const OCEAN_SUNSET_CONTROLS: ControlDef[] = [
  { key: "palette", type: "choice", label: "palette", options: PALETTES.map((p) => p.name) },
  { key: "silhouette", type: "choice", label: "silhouette", options: ["none", "coast", "sailboat", "lighthouse"] },
  { key: "clouds", type: "toggle", label: "clouds" },
  { key: "birds", type: "toggle", label: "birds" },
];

export function renderOceanSunset(
  ctx: CanvasRenderingContext2D,
  stream: QRNGStream,
  w: number,
  h: number,
  hooks: SceneHooks = NO_HOOKS
): void {
  const s = w / 1200;

  // ---- Odluke (QRNG) ----
  const pal = PALETTES[choice(hooks, "palette", stream.next_int(0, PALETTES.length - 1), PALETTES.length)]!;
  const dh = stream.next_int(-8, 8);
  const dl = (stream.next_f() - 0.5) * 0.08;
  const horizonY = Math.floor(h * (0.5 + 0.12 * stream.next_f()));
  const sunX = w * (0.25 + 0.5 * stream.next_f());
  const sunR = (26 + 30 * stream.next_f()) * s;
  // Visina sunca: od napola zašlog (-0.5r) do ~2.5r iznad horizonta
  const sunLift = pal.sunBelow ? -1.6 : -0.5 + 3 * Math.pow(stream.next_f(), 1.4);
  const sunY = horizonY - sunLift * sunR;
  const cloudCount = stream.next_int(0, 9);
  const silhouetteRoll = stream.next_f();
  const birdsRoll = stream.next_f();
  const rand = prngFromStream(stream);

  const sky = pal.sky.map((c) => jitter(c, dh, dl));
  const skyHorizon = sky[sky.length - 1]!;
  const sunCol = jitter(pal.sun, dh * 0.5, 0);
  const sunCore = mix(sunCol, [255, 250, 235], 0.65);
  const cloudLit = jitter(pal.cloudLit, dh, dl);
  const cloudShade = jitter(pal.cloudShade, dh, dl);
  const waterDeep = jitter(pal.waterDeep, dh, 0);
  // Što je sunce niže, to je horizont toplije obojen
  const warmth = pal.sunBelow ? 0.6 : 1 - Math.min(1, Math.max(0, sunLift / 2.5)) * 0.5;

  // ---- 1. Nebo ----
  const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
  const stops = [0, 0.35, 0.7, 1];
  sky.forEach((c, i) => skyGrad.addColorStop(stops[i]!, rgbString(c)));
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, w, horizonY + 1);

  // ---- 2. Zvezde (samo tamne palete) ----
  if (pal.stars) {
    const n = 60 + Math.floor(rand() * 90);
    for (let i = 0; i < n; i++) {
      const y = Math.pow(rand(), 1.6) * horizonY * 0.6;
      const x = rand() * w;
      const a = (0.3 + 0.6 * rand()) * (1 - y / (horizonY * 0.6));
      ctx.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(x, y, (rand() < 0.9 ? 0.8 : 1.4) * Math.max(0.6, s), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ---- 3. Sunce: veliki meki sjaj + jezgro ----
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, w, horizonY);
  ctx.clip();
  const glowR = sunR * (pal.sunBelow ? 14 : 9);
  const glow = ctx.createRadialGradient(sunX, sunY, sunR * 0.5, sunX, sunY, glowR);
  glow.addColorStop(0, rgba(sunCol, 0.55 * warmth));
  glow.addColorStop(0.25, rgba(sunCol, 0.22 * warmth));
  glow.addColorStop(1, rgba(sunCol, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, horizonY);
  if (!pal.sunBelow) {
    const core = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunR);
    core.addColorStop(0, rgbString(sunCore));
    core.addColorStop(0.75, rgbString(mix(sunCore, sunCol, 0.6)));
    core.addColorStop(1, rgbString(sunCol));
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // ---- 4. Oblaci obasjani odozdo ----
  // Prirodno: pozicije iz streama; forsirano uključeni oblaci uzimaju sve iz forka (stream netaknut).
  optional(ctx, hooks, "clouds", cloudCount > 0, rand, (ctx, rand) => {
    const nf = cloudCount > 0 ? () => stream.next_f() : rand;
    const n = cloudCount > 0 ? cloudCount : 5;
    for (let i = 0; i < n; i++) {
      const cy = horizonY * (0.12 + 0.72 * nf());
      const cx = w * nf();
      const cw = w * (0.12 + 0.3 * nf());
      const ch = (8 + 22 * nf()) * s;
      drawLitCloud(ctx, rand, cx, cy, cw, ch, sunX, sunY, w, cloudLit, cloudShade, warmth);
    }
  });

  hooks.sky({ horizonY, light: pal.sunBelow ? "night" : "dusk" });
  if (!pal.sunBelow) hooks.body({ x: sunX, y: sunY, r: sunR, kind: "sun" });

  // ---- 5. Izmaglica na horizontu ----
  const hazeH = h * 0.06;
  const haze = ctx.createLinearGradient(0, horizonY - hazeH, 0, horizonY);
  haze.addColorStop(0, rgba(skyHorizon, 0));
  haze.addColorStop(1, rgba(mix(skyHorizon, sunCore, 0.35), 0.55));
  ctx.fillStyle = haze;
  ctx.fillRect(0, horizonY - hazeH, w, hazeH);

  // ---- 6. Voda: refleks neba ka dubokoj boji ----
  const waterTop = mix(skyHorizon, waterDeep, 0.35);
  const waterMid = mix(sky[1]!, waterDeep, 0.7);
  const water = ctx.createLinearGradient(0, horizonY, 0, h);
  water.addColorStop(0, rgbString(waterTop));
  water.addColorStop(0.35, rgbString(waterMid));
  water.addColorStop(1, rgbString(waterDeep));
  ctx.fillStyle = water;
  ctx.fillRect(0, horizonY, w, h - horizonY);

  // ---- 7. Svetlosna staza (perspektiva: šira i ređa ka posmatraču) ----
  const pathStrength = pal.sunBelow ? 0.35 : 0.9 * warmth;
  const depth = h - horizonY;
  const glints = Math.floor(260 + rand() * 160);
  for (let i = 0; i < glints; i++) {
    const t = Math.pow(rand(), 1.4); // gušće pri horizontu
    const y = horizonY + 2 + t * depth;
    const spread = sunR * (1.2 + t * 5.5);
    const off = (rand() + rand() + rand() - 1.5) / 1.5; // ~normalno
    const x = sunX + off * spread;
    const len = (6 + rand() * 26) * s * (0.5 + t * 1.6);
    const a = pathStrength * (1 - Math.abs(off)) * (0.35 + 0.65 * rand()) * (1 - 0.55 * t);
    if (a <= 0.02) continue;
    ctx.fillStyle = rgba(mix(sunCore, sunCol, rand() * 0.6), Math.min(0.9, a));
    ctx.fillRect(x - len / 2, y, len, Math.max(1, (1 + t * 2.2) * s));
  }

  // ---- 8. Linije talasa preko cele vode (razmak raste ka dnu) ----
  ctx.save();
  let y = horizonY + 6 * s;
  let gap = 4 * s;
  while (y < h) {
    const segs = 3 + Math.floor(rand() * 5);
    for (let k = 0; k < segs; k++) {
      const x0 = rand() * w;
      const len = (40 + rand() * 160) * s * (1 + (y - horizonY) / depth);
      ctx.fillStyle = rgba(mix(skyHorizon, [255, 255, 255], 0.4), 0.05 + 0.08 * rand());
      ctx.fillRect(x0, y, len, Math.max(1, s));
    }
    y += gap;
    gap *= 1.12;
  }
  ctx.restore();

  // ---- 9. Silueta (opciono) ----
  const silCol = mix(waterDeep, [0, 0, 0], 0.35);
  const sil = choice(hooks, "silhouette", silhouetteRoll < 0.3 ? 1 : silhouetteRoll < 0.52 ? 2 : silhouetteRoll < 0.64 ? 3 : 0, 4);
  if (sil === 1) {
    drawCoast(ctx, stream, w, horizonY, s, silCol, stream.next_f() < 0.5);
  } else if (sil === 2) {
    drawSailboat(ctx, w * (0.12 + 0.76 * stream.next_f()), horizonY, s * (0.7 + 0.6 * stream.next_f()), silCol);
  } else if (sil === 3) {
    drawLighthouse(ctx, stream.next_f() < 0.5 ? w * 0.1 : w * 0.88, horizonY, s, silCol);
  }

  // ---- 10. Ptice (opciono) ----
  optional(ctx, hooks, "birds", birdsRoll < 0.4, rand, (ctx, rand) => {
    const n = 2 + Math.floor(rand() * 6);
    const bx = w * (0.15 + 0.7 * rand());
    const by = horizonY * (0.25 + 0.4 * rand());
    ctx.strokeStyle = rgba(silCol, 0.85);
    ctx.lineWidth = Math.max(1, 1.6 * s);
    ctx.lineCap = "round";
    for (let i = 0; i < n; i++) {
      const x = bx + (rand() - 0.5) * 160 * s;
      const yb = by + (rand() - 0.5) * 70 * s;
      const span = (5 + rand() * 7) * s;
      ctx.beginPath();
      ctx.moveTo(x - span, yb - span * 0.35);
      ctx.quadraticCurveTo(x - span * 0.4, yb - span * 0.5, x, yb);
      ctx.quadraticCurveTo(x + span * 0.4, yb - span * 0.5, x + span, yb - span * 0.35);
      ctx.stroke();
    }
  });
}

/** Izduženi oblak: unija elipsi, vertikalni gradijent (senka gore, obasjano dole). */
function drawLitCloud(
  ctx: CanvasRenderingContext2D,
  rand: Rand,
  cx: number,
  cy: number,
  cw: number,
  ch: number,
  sunX: number,
  sunY: number,
  w: number,
  lit: RGB,
  shade: RGB,
  warmth: number
): void {
  // Bliže suncu → jače obasjan
  const dist = Math.min(1, Math.hypot(cx - sunX, (cy - sunY) * 2) / (w * 0.7));
  const litAmt = (1 - dist * 0.7) * warmth;
  const bottom = mix(shade, lit, Math.min(1, 0.35 + litAmt));
  const top = mix(shade, lit, Math.max(0, litAmt * 0.5));

  // Više manjih, pljosnatih elipsi; sredina deblja, krajevi tanki (pramen)
  const blobs: [number, number, number, number][] = [];
  const n = 9 + Math.floor(rand() * 8);
  for (let i = 0; i < n; i++) {
    const u = rand() - 0.5; // -0.5..0.5 duž oblaka
    const taper = 1 - Math.abs(u) * 1.4;
    const bx = cx + u * cw;
    const rx = cw * (0.06 + 0.12 * rand()) * (0.6 + taper * 0.6);
    const ry = ch * (0.3 + 0.5 * rand()) * Math.max(0.25, taper);
    const by = cy - ry * 0.5 * rand(); // ravnija donja ivica
    blobs.push([bx, by, rx, ry]);
  }
  const tracePath = (dy: number) => {
    ctx.beginPath();
    for (const [bx, by, rx, ry] of blobs) {
      ctx.save();
      ctx.translate(bx, by + dy);
      ctx.scale(rx, ry);
      ctx.moveTo(1, 0);
      ctx.arc(0, 0, 1, 0, Math.PI * 2);
      ctx.restore();
    }
  };

  // 1) Obasjani donji obod (ceo oblak u svetloj boji)
  tracePath(0);
  ctx.fillStyle = rgba(bottom, 0.95);
  ctx.fill();
  // 2) Telo oblaka pomereno nagore — ostavlja svetli srp na dnu
  tracePath(-ch * 0.22);
  const g = ctx.createLinearGradient(0, cy - ch * 1.1, 0, cy + ch * 0.3);
  g.addColorStop(0, rgba(top, 0.92));
  g.addColorStop(1, rgba(mix(top, bottom, 0.45), 0.92));
  ctx.fillStyle = g;
  ctx.fill();
}

function drawCoast(
  ctx: CanvasRenderingContext2D,
  stream: QRNGStream,
  w: number,
  horizonY: number,
  s: number,
  col: RGB,
  left: boolean
): void {
  const pts = ridgePoints(stream, w, horizonY - 34 * s, 70 * s, 0.6, 8, 0.25, 80);
  const coverage = 0.25 + 0.2 * stream.next_f();
  ctx.save();
  ctx.beginPath();
  ctx.rect(left ? 0 : w * (1 - coverage), 0, w * coverage, horizonY + 1);
  ctx.clip();
  // Ka otvorenom moru obala se spušta do horizonta
  ctx.beginPath();
  ctx.moveTo(0, horizonY + 1);
  for (const p of pts) {
    const edge = left ? p.x / (w * coverage) : (w - p.x) / (w * coverage);
    const fall = Math.min(1, Math.max(0, (edge - 0.55) / 0.45));
    ctx.lineTo(p.x, p.y + (horizonY - p.y) * fall);
  }
  ctx.lineTo(w, horizonY + 1);
  ctx.closePath();
  ctx.fillStyle = rgbString(col);
  ctx.fill();
  ctx.restore();
}

function drawSailboat(ctx: CanvasRenderingContext2D, x: number, horizonY: number, k: number, col: RGB): void {
  const y = horizonY + 3 * k;
  ctx.fillStyle = rgbString(col);
  // Trup
  ctx.beginPath();
  ctx.moveTo(x - 22 * k, y - 4 * k);
  ctx.lineTo(x + 24 * k, y - 4 * k);
  ctx.lineTo(x + 16 * k, y + 2 * k);
  ctx.lineTo(x - 16 * k, y + 2 * k);
  ctx.closePath();
  ctx.fill();
  // Jarbol + jedra
  ctx.fillRect(x - 0.8 * k, y - 50 * k, 1.6 * k, 46 * k);
  ctx.beginPath();
  ctx.moveTo(x + 1.5 * k, y - 48 * k);
  ctx.lineTo(x + 20 * k, y - 7 * k);
  ctx.lineTo(x + 1.5 * k, y - 7 * k);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x - 1.5 * k, y - 40 * k);
  ctx.lineTo(x - 14 * k, y - 7 * k);
  ctx.lineTo(x - 1.5 * k, y - 7 * k);
  ctx.closePath();
  ctx.fill();
}

function drawLighthouse(ctx: CanvasRenderingContext2D, x: number, horizonY: number, s: number, col: RGB): void {
  ctx.fillStyle = rgbString(col);
  // Stena
  ctx.beginPath();
  ctx.moveTo(x - 70 * s, horizonY + 2);
  ctx.quadraticCurveTo(x - 40 * s, horizonY - 30 * s, x, horizonY - 28 * s);
  ctx.quadraticCurveTo(x + 45 * s, horizonY - 26 * s, x + 75 * s, horizonY + 2);
  ctx.closePath();
  ctx.fill();
  // Kula (sužava se nagore)
  const baseY = horizonY - 26 * s;
  const topY = baseY - 90 * s;
  ctx.beginPath();
  ctx.moveTo(x - 10 * s, baseY);
  ctx.lineTo(x - 6 * s, topY);
  ctx.lineTo(x + 6 * s, topY);
  ctx.lineTo(x + 10 * s, baseY);
  ctx.closePath();
  ctx.fill();
  // Kapa
  ctx.fillRect(x - 9 * s, topY - 4 * s, 18 * s, 4 * s);
  ctx.beginPath();
  ctx.moveTo(x - 7 * s, topY - 14 * s);
  ctx.lineTo(x, topY - 22 * s);
  ctx.lineTo(x + 7 * s, topY - 14 * s);
  ctx.closePath();
  ctx.fill();
  // Svetlo
  const lx = x;
  const ly = topY - 9 * s;
  const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, 40 * s);
  g.addColorStop(0, "rgba(255,240,190,0.9)");
  g.addColorStop(0.15, "rgba(255,230,170,0.45)");
  g.addColorStop(1, "rgba(255,230,170,0)");
  ctx.fillStyle = g;
  ctx.fillRect(lx - 40 * s, ly - 40 * s, 80 * s, 80 * s);
  ctx.fillStyle = "rgb(255,245,210)";
  ctx.fillRect(lx - 4 * s, ly - 3 * s, 8 * s, 6 * s);
}
