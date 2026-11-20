/**
 * Oluja — render v2 (scenario 12).
 *
 * Redosled: nebo → sjaj na horizontu → sunce ispod oblaka (palete sa
 * probojem) → (hooks.body) → daleki kumulonimbus (nakovanj) → slojevi
 * oblaka od dalekih (nisko, sitni) ka bliskim (gore, krupni) → munje sa
 * grananjem + bljesak → sopstvena duga (paleta „prolazi") → (hooks.sky) →
 * zavese kiše → lokacija (svetionik na moru / usamljeno drvo / planine) →
 * kosa kiša u prvom planu.
 *
 * hooks.sky se zove POSLE oblaka da bi retki događaji (duga, kometa…) bili
 * vidljivi — inače bi ih oblačni pokrivač sakrio.
 *
 * Lokacije (težine): svetionik 40%, usamljeno drvo 35%, planine 25%.
 * QRNG bira odluke; detalji iz PRNG-a. Dimenzije relativne (s = w/1200).
 */
import type { QRNGStream } from "../qrng";
import { hslToRgb, type RGB } from "../color";
import { prngFromStream, type Rand } from "../prng";
import { NO_HOOKS, type SceneHooks, type SkyLight } from "../sky-events";

type HSL = [number, number, number];

interface StormPalette {
  name: string;
  light: SkyLight;
  sky: [HSL, HSL, HSL]; // vrh, sredina, horizont
  cloud: [HSL, HSL]; // tamna osnova, osvetljena ivica
  glow?: HSL; // traka svetla na horizontu
  sun?: HSL; // sunce ispod oblaka
  land: [HSL, HSL]; // dalje → bliže
  sea: [HSL, HSL];
  rain: number; // gustina kiše 0..1
  bolt: HSL;
  lit: boolean; // upaljeni prozori / svetionik
  passing?: boolean; // oluja se povlači: oblaci samo sa jedne strane
}

const PALETTES: readonly StormPalette[] = [
  {
    name: "supercell",
    light: "dusk",
    sky: [[175, 0.25, 0.14], [160, 0.28, 0.27], [62, 0.4, 0.5]],
    cloud: [[185, 0.2, 0.12], [140, 0.22, 0.38]],
    glow: [55, 0.6, 0.58],
    land: [[120, 0.18, 0.24], [110, 0.25, 0.12]],
    sea: [[175, 0.3, 0.2], [185, 0.35, 0.1]],
    rain: 0.6,
    bolt: [200, 0.9, 0.85],
    lit: true,
  },
  {
    name: "slate",
    light: "day",
    sky: [[215, 0.14, 0.32], [210, 0.13, 0.47], [205, 0.12, 0.64]],
    cloud: [[220, 0.12, 0.2], [212, 0.1, 0.52]],
    land: [[150, 0.12, 0.36], [130, 0.22, 0.2]],
    sea: [[205, 0.2, 0.36], [210, 0.28, 0.18]],
    rain: 0.95,
    bolt: [210, 0.8, 0.88],
    lit: false,
  },
  {
    name: "night",
    light: "night",
    sky: [[235, 0.35, 0.05], [240, 0.3, 0.1], [250, 0.25, 0.18]],
    cloud: [[240, 0.25, 0.07], [252, 0.3, 0.24]],
    land: [[240, 0.15, 0.17], [235, 0.2, 0.08]],
    sea: [[235, 0.3, 0.12], [240, 0.35, 0.05]],
    rain: 0.7,
    bolt: [250, 0.9, 0.85],
    lit: true,
  },
  {
    name: "golden-break",
    light: "day",
    sky: [[220, 0.2, 0.27], [28, 0.35, 0.5], [40, 0.8, 0.7]],
    cloud: [[230, 0.15, 0.18], [32, 0.65, 0.62]],
    glow: [42, 0.95, 0.68],
    sun: [45, 1, 0.82],
    land: [[35, 0.3, 0.4], [80, 0.3, 0.18]],
    sea: [[30, 0.35, 0.38], [215, 0.3, 0.15]],
    rain: 0.5,
    bolt: [45, 0.6, 0.9],
    lit: false,
  },
  {
    name: "violet-dusk",
    light: "dusk",
    sky: [[265, 0.35, 0.14], [310, 0.33, 0.3], [18, 0.72, 0.55]],
    cloud: [[270, 0.25, 0.12], [340, 0.45, 0.47]],
    glow: [20, 0.85, 0.58],
    land: [[300, 0.15, 0.22], [280, 0.2, 0.1]],
    sea: [[300, 0.25, 0.24], [260, 0.3, 0.1]],
    rain: 0.55,
    bolt: [280, 0.8, 0.88],
    lit: true,
  },
  {
    name: "passing",
    light: "day",
    sky: [[205, 0.4, 0.45], [200, 0.35, 0.62], [48, 0.5, 0.8]],
    cloud: [[222, 0.16, 0.28], [210, 0.18, 0.74]],
    sun: [48, 1, 0.9],
    land: [[100, 0.3, 0.42], [95, 0.38, 0.24]],
    sea: [[195, 0.4, 0.42], [205, 0.45, 0.22]],
    rain: 0.35,
    bolt: [210, 0.7, 0.9],
    lit: false,
    passing: true,
  },
];

type Location = "lighthouse" | "tree" | "mountains";

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

function rgba(c: RGB, a = 1): string {
  return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
}

function smooth(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

const WHITE: RGB = [255, 255, 255];
const WARM: RGB = hslToRgb(40, 0.95, 0.65);

export function renderStorm(
  ctx: CanvasRenderingContext2D,
  stream: QRNGStream,
  w: number,
  h: number,
  hooks: SceneHooks = NO_HOOKS
): void {
  const s = w / 1200;

  // ---- Odluke (QRNG) ----
  const pal = PALETTES[stream.next_int(0, PALETTES.length - 1)]!;
  const dh = stream.next_int(-6, 6);
  const lr = stream.next_f();
  const loc: Location = lr < 0.4 ? "lighthouse" : lr < 0.75 ? "tree" : "mountains";
  const horizonY = Math.floor(h * (loc === "lighthouse" ? 0.6 + 0.08 * stream.next_f() : 0.58 + 0.1 * stream.next_f()));
  const windSign = stream.next_f() < 0.5 ? -1 : 1;
  const wind = windSign * (0.12 + 0.3 * stream.next_f()); // dx po dy za kišu
  const sunX = w * (0.15 + 0.7 * stream.next_f());
  const sunLift = stream.next_f();
  const boltCount = pal.light === "night" ? stream.next_int(1, 3) : pal.passing ? stream.next_int(0, 1) : stream.next_int(0, 2);
  const boltXs = [stream.next_f(), stream.next_f(), stream.next_f()];
  const anvil = stream.next_f() < 0.45;
  const anvilX = w * (0.15 + 0.7 * stream.next_f());
  const curtains = stream.next_int(2, 4);
  const ownRainbow = !!pal.passing && stream.next_f() < 0.5;
  // lokacija
  const side = stream.next_f() < 0.5 ? -1 : 1; // rt / drvo / koliba: levo ili desno
  const posF = stream.next_f();
  const extraA = stream.next_f() < 0.5; // svetionik: crvene pruge | drvo: ograda | planine: koliba
  const extraB = stream.next_f() < 0.45; // svetionik: kućica | drvo: salaš u daljini | planine: jezero
  const rand = prngFromStream(stream);

  const skyTop = hsl(pal.sky[0], dh);
  const skyMid = hsl(pal.sky[1], dh);
  const skyHor = hsl(pal.sky[2], dh);
  const cloudBase = hsl(pal.cloud[0], dh);
  const cloudLit = hsl(pal.cloud[1], dh);

  // ---- Nebo ----
  const sky = ctx.createLinearGradient(0, 0, 0, horizonY);
  sky.addColorStop(0, rgba(skyTop));
  sky.addColorStop(0.55, rgba(skyMid));
  sky.addColorStop(1, rgba(skyHor));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h); // do dna, da ispod talasastih ivica tla nikad ne ostane prazan procep

  if (pal.glow) {
    const gc = hsl(pal.glow, dh);
    const g = ctx.createRadialGradient(sunX, horizonY, 0, sunX, horizonY, w * 0.6);
    g.addColorStop(0, rgba(gc, 0.7));
    g.addColorStop(0.4, rgba(gc, 0.25));
    g.addColorStop(1, rgba(gc, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, horizonY);
  }

  // ---- Sunce (proboj ispod oblaka) ----
  const sunR = 26 * s + 14 * s * sunLift;
  const sunY = pal.passing ? horizonY * (0.3 + 0.25 * sunLift) : horizonY - h * (0.04 + 0.06 * sunLift);
  // Kod „prolazi" sunce je na vedroj strani (suprotno od oluje)
  const stormLeft = windSign > 0; // oluja dolazi sa strane odakle duva vetar
  const sunXp = pal.passing ? (stormLeft ? w * (0.62 + 0.28 * sunLift) : w * (0.1 + 0.28 * sunLift)) : sunX;
  if (pal.sun) {
    const sc = hsl(pal.sun, dh);
    const halo = ctx.createRadialGradient(sunXp, sunY, sunR * 0.5, sunXp, sunY, sunR * 7);
    halo.addColorStop(0, rgba(sc, 0.6));
    halo.addColorStop(1, rgba(sc, 0));
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, w, horizonY);
    ctx.fillStyle = rgba(mix(sc, WHITE, 0.4));
    ctx.beginPath();
    ctx.arc(sunXp, sunY, sunR, 0, Math.PI * 2);
    ctx.fill();
    hooks.body({ x: sunXp, y: sunY, r: sunR, kind: "sun" });
  }

  // ---- Kumulonimbus (nakovanj) u daljini ----
  if (anvil && !pal.passing) {
    drawAnvil(ctx, rand, anvilX, horizonY, s, mix(cloudBase, skyHor, 0.45), mix(cloudLit, skyHor, 0.3), sunXp);
  }

  // ---- Slojevi oblaka (daleki → bliski) ----
  const bands = 4;
  const passEdge = stormLeft ? w * 0.55 : w * 0.45;
  for (let i = 0; i < bands; i++) {
    const t = i / (bands - 1); // 0 = daleko (nisko), 1 = blizu (gore)
    const base = horizonY * (0.72 - 0.47 * t);
    const rMin = (18 + 50 * t) * s;
    const rMax = (34 + 110 * t) * s;
    const haze = 0.55 * (1 - t);
    const bc = mix(cloudBase, skyHor, haze);
    const lc = mix(cloudLit, skyHor, haze * 0.6);
    const amp = (6 + 20 * t) * s;
    const ph = rand() * Math.PI * 2;
    let yAt = (x: number) => base + amp * Math.sin(x / (160 * s) + ph);
    let xFrom = 0;
    let xTo = w;
    if (pal.passing) {
      // Oblaci se dižu i nestaju ka vedroj strani
      const yb = yAt;
      yAt = stormLeft
        ? (x) => yb(x) - (base + rMax) * smooth(passEdge - w * 0.3, passEdge, x)
        : (x) => yb(x) - (base + rMax) * smooth(passEdge + w * 0.3, passEdge, x);
      if (stormLeft) xTo = passEdge + rMax;
      else xFrom = passEdge - rMax;
    }
    cloudBand(ctx, rand, { yAt, rMin, rMax, base: bc, lit: lc, lightX: pal.sun || pal.glow ? sunXp : w / 2, xFrom, xTo, s });
  }

  // Sunce/sjaj osvetljava donje ivice oblaka
  if (pal.glow || pal.sun) {
    const gc = hsl(pal.glow ?? pal.sun!, dh);
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const g = ctx.createRadialGradient(sunXp, horizonY, 0, sunXp, horizonY, w * 0.55);
    g.addColorStop(0, rgba(gc, 0.45));
    g.addColorStop(0.5, rgba(gc, 0.12));
    g.addColorStop(1, rgba(gc, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, horizonY);
    ctx.restore();
  }

  // ---- Munje ----
  const boltCol = hsl(pal.bolt);
  const boltHits: number[] = [];
  for (let k = 0; k < boltCount; k++) {
    let bx = w * (0.1 + 0.8 * boltXs[k]!);
    if (pal.passing) bx = stormLeft ? w * 0.05 + (passEdge - w * 0.2) * boltXs[k]! : passEdge + w * 0.15 + (w * 0.8 - passEdge) * boltXs[k]!;
    const y0 = horizonY * (0.25 + 0.15 * rand());
    const x1 = bx + (rand() - 0.5) * w * 0.12;
    const y1 = horizonY + 4 * s;
    boltHits.push(x1);
    // bljesak u oblacima
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const fl = ctx.createRadialGradient(bx, y0, 0, bx, y0, w * 0.32);
    fl.addColorStop(0, rgba(boltCol, pal.light === "night" ? 0.45 : 0.3));
    fl.addColorStop(1, rgba(boltCol, 0));
    ctx.fillStyle = fl;
    ctx.fillRect(0, 0, w, horizonY);
    ctx.restore();
    drawBolt(ctx, rand, bx, y0, x1, y1, (k === 0 ? 2.6 : 1.9) * s, boltCol, 3);
  }

  // ---- Sopstvena duga (oluja prolazi) — na tamnoj strani, nasuprot suncu ----
  if (ownRainbow) {
    const R = h * (0.5 + 0.15 * rand());
    const cx = stormLeft ? w * (0.22 + 0.15 * rand()) : w * (0.63 + 0.15 * rand());
    drawOwnRainbow(ctx, cx, horizonY + R * 0.18, R, horizonY, s);
  }

  hooks.sky({ horizonY, light: pal.light });

  // ---- Zavese kiše ----
  const rainCol = mix(cloudLit, skyHor, 0.5);
  for (let i = 0; i < curtains; i++) {
    let cx = w * (0.08 + 0.84 * rand());
    if (pal.passing) cx = stormLeft ? w * 0.05 + (passEdge - w * 0.15) * rand() : passEdge + (w * 0.95 - passEdge) * rand();
    const cw = w * (0.06 + 0.12 * rand());
    const top = horizonY * (0.35 + 0.25 * rand());
    drawCurtain(ctx, rand, cx, cw, top, horizonY + 6 * s, wind, rainCol, 0.18 + 0.2 * pal.rain, s);
  }

  // ---- Lokacija ----
  const ctxL: LocCtx = { ctx, rand, w, h, s, horizonY, pal, dh, skyHor, cloudBase, wind, side, posF, extraA, extraB, boltHits, sunX: sunXp };
  if (loc === "lighthouse") drawLighthouseScene(ctxL);
  else if (loc === "tree") drawTreeScene(ctxL);
  else drawMountainScene(ctxL);

  // ---- Kiša u prvom planu ----
  drawRain(ctx, rand, w, h, s, wind, mix(rainCol, WHITE, 0.35), pal.rain);
}

// ---------------------------------------------------------------------------
// Oblaci
// ---------------------------------------------------------------------------

interface BandOpts {
  yAt: (x: number) => number;
  rMin: number;
  rMax: number;
  base: RGB;
  lit: RGB;
  lightX: number;
  xFrom: number;
  xTo: number;
  s: number;
}

/** Traka oblaka: popunjeno od vrha do linije, ispod nje „naduvani" krugovi sa svetlim temenom. */
function cloudBand(ctx: CanvasRenderingContext2D, rand: Rand, o: BandOpts): void {
  const circles: { x: number; y: number; r: number }[] = [];
  let x = o.xFrom - o.rMax;
  while (x < o.xTo + o.rMax) {
    const r = o.rMin + (o.rMax - o.rMin) * rand();
    circles.push({ x, y: o.yAt(x) - r * (0.15 + 0.45 * rand()), r });
    x += r * (0.9 + 0.7 * rand());
  }
  ctx.fillStyle = rgba(o.base);
  ctx.beginPath();
  ctx.moveTo(o.xFrom - o.rMax, -10);
  for (const c of circles) ctx.lineTo(c.x, c.y);
  ctx.lineTo(o.xTo + o.rMax, -10);
  ctx.closePath();
  ctx.fill();

  // Spljošteni „jastuci" (elipse 1.6 : 0.6) — slojevit olujni pokrivač, ne mehurići.
  circles.sort((a, b) => a.y - b.y);
  const under = mix(o.base, [0, 0, 0], 0.3);
  for (const c of circles) {
    const dx = Math.max(-1, Math.min(1, (o.lightX - c.x) / 600));
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.scale(1.6, 0.6);
    const g = ctx.createRadialGradient(dx * c.r * 0.3, -c.r * 0.55, c.r * 0.05, 0, 0, c.r);
    g.addColorStop(0, rgba(mix(o.lit, o.base, 0.15)));
    g.addColorStop(0.45, rgba(mix(o.lit, o.base, 0.7)));
    g.addColorStop(0.8, rgba(o.base));
    g.addColorStop(1, rgba(mix(o.base, under, 0.5)));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, c.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // tamne pruge podnožja (shelf cloud)
  for (const c of circles) {
    ctx.fillStyle = rgba(under, 0.28);
    ctx.beginPath();
    ctx.ellipse(c.x, c.y + c.r * 0.45, c.r * 1.4, c.r * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Daleki kumulonimbus: kula oblaka sa ravnim nakovnjem na vrhu. */
function drawAnvil(ctx: CanvasRenderingContext2D, rand: Rand, x: number, horizonY: number, s: number, base: RGB, lit: RGB, lightX: number): void {
  const top = horizonY * 0.12;
  const bottom = horizonY * 0.62; // podnožje skriveno iza dalekih slojeva
  const towerW = 150 * s;
  ctx.save();
  ctx.globalAlpha = 0.85;
  // nakovanj
  const aw = 520 * s;
  const lean = (rand() - 0.5) * 120 * s;
  ctx.fillStyle = rgba(mix(base, lit, 0.35));
  ctx.beginPath();
  ctx.moveTo(x - towerW * 0.6, top + 70 * s);
  ctx.quadraticCurveTo(x - aw * 0.45 + lean, top + 30 * s, x - aw * 0.55 + lean, top + 18 * s);
  ctx.quadraticCurveTo(x + lean, top - 22 * s, x + aw * 0.55 + lean, top + 12 * s);
  ctx.quadraticCurveTo(x + aw * 0.45 + lean, top + 34 * s, x + towerW * 0.6, top + 70 * s);
  ctx.closePath();
  ctx.fill();
  // kula: jedna silueta (unija krugova), pa svetla strana kao gradijent preko nje
  ctx.globalAlpha = 1;
  // (bez Path2D — nije globalno dostupan u @napi-rs/canvas na serveru)
  const blobs: [number, number, number][] = [];
  for (let y = bottom; y > top + 40 * s; y -= 24 * s) {
    const t = (bottom - y) / (bottom - top);
    for (let k = 0; k < 3; k++) {
      const r = (42 + 30 * rand()) * s * (1 - 0.3 * t);
      blobs.push([x + (k - 1) * towerW * 0.42 + (rand() - 0.5) * 26 * s, y, r]);
    }
  }
  const tracePath = () => {
    ctx.beginPath();
    for (const [cx, cy, r] of blobs) {
      ctx.moveTo(cx + r, cy);
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
    }
  };
  ctx.fillStyle = rgba(base);
  tracePath();
  ctx.fill();
  ctx.save();
  tracePath();
  ctx.clip();
  const toLight = lightX < x ? -1 : 1;
  const lg = ctx.createLinearGradient(x - toLight * towerW, 0, x + toLight * towerW * 1.2, 0);
  lg.addColorStop(0, rgba(lit, 0));
  lg.addColorStop(1, rgba(lit, 0.75));
  ctx.fillStyle = lg;
  ctx.fillRect(x - towerW * 2, top, towerW * 4, bottom - top + 80 * s);
  ctx.restore();
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Munje, kiša, duga
// ---------------------------------------------------------------------------

type Pt = [number, number];

function boltPath(rand: Rand, x0: number, y0: number, x1: number, y1: number, depth: number): Pt[] {
  let pts: Pt[] = [[x0, y0], [x1, y1]];
  let d = Math.hypot(x1 - x0, y1 - y0) * 0.22;
  for (let it = 0; it < depth; it++) {
    const np: Pt[] = [pts[0]!];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i]!;
      const b = pts[i + 1]!;
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const nx = -(b[1] - a[1]) / len;
      const ny = (b[0] - a[0]) / len;
      const off = (rand() - 0.5) * d;
      np.push([(a[0] + b[0]) / 2 + nx * off, (a[1] + b[1]) / 2 + ny * off], b);
    }
    pts = np;
    d *= 0.55;
  }
  return pts;
}

function strokePts(ctx: CanvasRenderingContext2D, pts: Pt[], width: number, style: string): void {
  ctx.strokeStyle = style;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(pts[0]![0], pts[0]![1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]![0], pts[i]![1]);
  ctx.stroke();
}

function drawBolt(ctx: CanvasRenderingContext2D, rand: Rand, x0: number, y0: number, x1: number, y1: number, width: number, col: RGB, branches: number): void {
  const pts = boltPath(rand, x0, y0, x1, y1, 7);
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.globalCompositeOperation = "lighter";
  strokePts(ctx, pts, width * 9, rgba(col, 0.06));
  strokePts(ctx, pts, width * 3.5, rgba(col, 0.22));
  ctx.globalCompositeOperation = "source-over";
  strokePts(ctx, pts, width, rgba(mix(col, WHITE, 0.75)));
  ctx.restore();
  if (branches <= 0) return;
  const n = 2 + Math.floor(rand() * 3);
  const main = Math.atan2(y1 - y0, x1 - x0);
  const total = Math.hypot(x1 - x0, y1 - y0);
  for (let k = 0; k < n; k++) {
    const idx = Math.floor(pts.length * (0.1 + 0.6 * rand()));
    const p = pts[idx]!;
    const ang = main + (rand() < 0.5 ? -1 : 1) * (0.35 + 0.6 * rand());
    const len = total * (0.15 + 0.3 * rand()) * (1 - idx / pts.length);
    drawBolt(ctx, rand, p[0], p[1], p[0] + Math.cos(ang) * len, p[1] + Math.sin(ang) * len, width * 0.5, col, branches - 2);
  }
}

function drawCurtain(ctx: CanvasRenderingContext2D, rand: Rand, cx: number, cw: number, top: number, bottom: number, wind: number, col: RGB, alpha: number, s: number): void {
  const dx = (bottom - top) * wind;
  ctx.save();
  const g = ctx.createLinearGradient(0, top, 0, bottom);
  g.addColorStop(0, rgba(col, 0));
  g.addColorStop(0.25, rgba(col, alpha));
  g.addColorStop(1, rgba(col, alpha * 0.7));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(cx - cw / 2, top);
  ctx.lineTo(cx + cw / 2, top);
  ctx.quadraticCurveTo(cx + cw / 2 + dx * 0.4, (top + bottom) / 2, cx + cw * 0.6 + dx, bottom);
  ctx.lineTo(cx - cw * 0.6 + dx, bottom);
  ctx.quadraticCurveTo(cx - cw / 2 + dx * 0.4, (top + bottom) / 2, cx - cw / 2, top);
  ctx.closePath();
  ctx.fill();
  // pruge unutar zavese
  ctx.clip();
  ctx.strokeStyle = rgba(col, alpha * 0.8);
  ctx.lineWidth = 1.5 * s;
  const n = Math.floor(cw / (7 * s));
  for (let i = 0; i < n; i++) {
    const x = cx - cw * 0.7 + rand() * cw * 1.4;
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x + dx, bottom);
    ctx.stroke();
  }
  ctx.restore();
}

function drawRain(ctx: CanvasRenderingContext2D, rand: Rand, w: number, h: number, s: number, wind: number, col: RGB, density: number): void {
  const n = Math.floor(1100 * density);
  ctx.save();
  ctx.lineCap = "round";
  for (let i = 0; i < n; i++) {
    const near = rand();
    const len = (10 + 26 * near) * s;
    const x = rand() * (w + 100 * s) - 50 * s;
    const y = rand() * h;
    ctx.strokeStyle = rgba(col, 0.1 + 0.25 * near);
    ctx.lineWidth = (0.7 + 1.1 * near) * s;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + wind * len, y + len);
    ctx.stroke();
  }
  ctx.restore();
}

function drawOwnRainbow(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number, horizonY: number, s: number): void {
  const cols = [0, 30, 55, 120, 200, 240, 275];
  const bw = R * 0.014;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, ctx.canvas.width, horizonY);
  ctx.clip();
  for (let i = 0; i < cols.length; i++) {
    const r = R - i * bw;
    ctx.strokeStyle = `hsla(${cols[i]}, 90%, 62%, 0.3)`;
    ctx.lineWidth = bw + 0.5 * s;
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI, Math.PI * 2);
    ctx.stroke();
  }
  // svetlije nebo unutar luka
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(cx, cy, R - cols.length * bw, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Lokacije
// ---------------------------------------------------------------------------

interface LocCtx {
  ctx: CanvasRenderingContext2D;
  rand: Rand;
  w: number;
  h: number;
  s: number;
  horizonY: number;
  pal: StormPalette;
  dh: number;
  skyHor: RGB;
  cloudBase: RGB;
  wind: number;
  side: number;
  posF: number;
  extraA: boolean;
  extraB: boolean;
  boltHits: number[];
  sunX: number;
}

/** More sa talasima, stenoviti rt i svetionik. */
function drawLighthouseScene(L: LocCtx): void {
  const { ctx, rand, w, h, s, horizonY, pal, dh } = L;
  const seaFar = hsl(pal.sea[0], dh);
  const seaNear = hsl(pal.sea[1], dh);
  const foam = mix(L.skyHor, WHITE, 0.55);

  // osnova mora
  const g = ctx.createLinearGradient(0, horizonY, 0, h);
  g.addColorStop(0, rgba(mix(seaFar, L.skyHor, 0.35)));
  g.addColorStop(1, rgba(seaNear));
  ctx.fillStyle = g;
  ctx.fillRect(0, horizonY, w, h - horizonY);

  // talasi (daleki → bliski)
  const rows = 24;
  for (let i = 0; i < rows; i++) {
    const t = i / (rows - 1);
    const y = horizonY + (h - horizonY) * (0.015 + 0.985 * Math.pow(t, 1.7));
    const amp = (1 + 10 * t) * s;
    const wl = (28 + 300 * t) * s;
    const ph = rand() * 7;
    const ph2 = rand() * 7;
    const col = mix(mix(seaFar, L.skyHor, 0.3 * (1 - t)), seaNear, t);
    const yAt = (x: number) => y + amp * Math.sin((x / wl) * Math.PI * 2 + ph) + amp * 0.3 * Math.sin((x / (wl * 0.43)) * Math.PI * 2 + ph2);
    const step = Math.max(3, 6 * s);
    ctx.fillStyle = rgba(col);
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w + step; x += step) ctx.lineTo(x, yAt(x));
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
    // pena po grebenu: kratki potezi samo na vrhovima talasa
    const segs = Math.floor(3 + 9 * t);
    ctx.lineCap = "round";
    for (let k = 0; k < segs; k++) {
      const x0 = rand() * w;
      const len = (15 + 70 * t) * s * (0.5 + rand());
      ctx.strokeStyle = rgba(foam, 0.25 + 0.45 * t * rand());
      ctx.lineWidth = (0.8 + 3 * t) * s;
      ctx.beginPath();
      for (let x = x0; x <= x0 + len; x += step) {
        const yy = yAt(x) + amp * 0.15;
        if (x === x0) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
    // senka ispod grebena (dubina talasa)
    ctx.strokeStyle = rgba(mix(col, [0, 0, 0], 0.35), 0.25 * t);
    ctx.lineWidth = amp * 0.8;
    ctx.beginPath();
    for (let x = 0; x <= w + step; x += step) {
      const yy = yAt(x) + amp * 0.9;
      if (x === 0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }

  // odsjaj sunca i munja na vodi
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  if (L.pal.sun || L.pal.glow) {
    const gc = hsl(L.pal.glow ?? L.pal.sun!, dh);
    for (let i = 0; i < 70; i++) {
      const t = rand();
      const y = horizonY + (h - horizonY) * t * 0.8;
      const x = L.sunX + (rand() - 0.5) * (30 + 160 * t) * s;
      ctx.fillStyle = rgba(gc, 0.25 * (1 - t));
      ctx.fillRect(x, y, (6 + 30 * t) * s, (1 + 2 * t) * s);
    }
  }
  for (const bx of L.boltHits) {
    const bc = hsl(L.pal.bolt);
    for (let i = 0; i < 40; i++) {
      const t = rand();
      const y = horizonY + (h - horizonY) * t * 0.6;
      ctx.fillStyle = rgba(bc, 0.35 * (1 - t));
      ctx.fillRect(bx + (rand() - 0.5) * (8 + 60 * t) * s, y, (4 + 18 * t) * s, 1.5 * s);
    }
  }
  ctx.restore();

  // rt
  const edge = L.side < 0 ? 0 : w;
  const dir = L.side < 0 ? 1 : -1;
  const tipX = edge + dir * w * (0.3 + 0.12 * L.posF);
  const topY = horizonY - h * (0.09 + 0.06 * L.posF);
  const rock = mix(hslToRgb(28 + dh, 0.12, 0.3), L.cloudBase, 0.35);
  const rockLit = mix(rock, L.skyHor, 0.25);
  const pts: Pt[] = [];
  const nPts = 26;
  for (let i = 0; i <= nPts; i++) {
    const t = i / nPts;
    const x = edge + dir * (Math.abs(tipX - edge) + 60 * s) * t;
    // vrh se blago spušta ka moru, stenoviti zupci; pri kraju strma litica sa stepenicima
    let y = topY + t * 38 * s + Math.sin(t * 19 + L.posF * 9) * 6 * s + (rand() - 0.5) * 10 * s;
    if (t > 0.7) {
      const u = (t - 0.7) / 0.3;
      y = topY + 38 * s * 0.7 + (h * 0.95 - topY) * Math.pow(u, 1.25) + (rand() - 0.5) * 22 * s;
    }
    pts.push([x, y]);
  }
  ctx.fillStyle = rgba(rock);
  ctx.beginPath();
  ctx.moveTo(edge, h);
  for (const p of pts) ctx.lineTo(p[0], p[1]);
  ctx.lineTo(pts[pts.length - 1]![0], h);
  ctx.closePath();
  ctx.fill();
  // strana litice okrenuta moru: posebna (tamnija ili svetlija) ploha sa pukotinama
  const faceStart = Math.floor(pts.length * 0.66);
  const facePts = pts.slice(faceStart);
  const sunOnFace = (L.sunX - tipX) * dir > 0;
  const faceCol = sunOnFace ? mix(rock, L.skyHor, 0.3) : mix(rock, [0, 0, 0], 0.3);
  ctx.save();
  ctx.clip();
  ctx.fillStyle = rgba(faceCol);
  ctx.beginPath();
  facePts.forEach((p, i) => (i === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1])));
  for (let i = facePts.length - 1; i >= 0; i--) {
    const p = facePts[i]!;
    const depth = (30 + 50 * (i / facePts.length)) * s;
    ctx.lineTo(p[0] - dir * depth, p[1] + 14 * s);
  }
  ctx.closePath();
  ctx.fill();
  // pukotine (dijagonalne) i blagi slojevi samo pri vrhu
  ctx.strokeStyle = rgba(mix(rock, [0, 0, 0], 0.45), 0.45);
  ctx.lineWidth = 2 * s;
  for (let k = 0; k < 10; k++) {
    const p = facePts[Math.floor(rand() * facePts.length)]!;
    const len = (30 + 70 * rand()) * s;
    ctx.beginPath();
    ctx.moveTo(p[0] - dir * 6 * s, p[1]);
    ctx.lineTo(p[0] - dir * (10 + 20 * rand()) * s, p[1] + len * 0.5);
    ctx.lineTo(p[0] - dir * (6 + 30 * rand()) * s, p[1] + len);
    ctx.stroke();
  }
  ctx.strokeStyle = rgba(rockLit, 0.18);
  ctx.lineWidth = 2 * s;
  for (let k = 0; k < 5; k++) {
    const y = topY + (30 + k * 26) * s;
    ctx.beginPath();
    ctx.moveTo(edge, y + (rand() - 0.5) * 10 * s);
    ctx.quadraticCurveTo((edge + tipX) / 2, y + (rand() - 0.5) * 20 * s, tipX, y + 15 * s);
    ctx.stroke();
  }
  ctx.restore();
  // stene u podnožju i linija pene duž litice
  for (let k = 0; k < 7; k++) {
    const p = facePts[Math.floor(facePts.length * (0.35 + 0.65 * rand()))]!;
    const r = (8 + 22 * ((p[1] - horizonY) / (h - horizonY))) * s * (0.6 + 0.6 * rand());
    ctx.fillStyle = rgba(mix(rock, [0, 0, 0], 0.35 + 0.2 * rand()));
    ctx.beginPath();
    ctx.ellipse(p[0] + dir * r * 0.6, p[1] + r * 0.2, r, r * 0.6, 0, Math.PI, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = rgba(foam, 0.55);
  ctx.lineWidth = 4 * s;
  ctx.lineCap = "round";
  ctx.beginPath();
  let started = false;
  facePts.forEach((p, i) => {
    if (p[1] < horizonY + 6 * s) return; // samo deo litice koji je u moru
    const off = (10 + 6 * Math.sin(i * 1.7)) * s;
    if (!started) ctx.moveTo(p[0] + dir * off, p[1]);
    else ctx.lineTo(p[0] + dir * off, p[1]);
    started = true;
  });
  ctx.stroke();
  // trava na vrhu
  if (L.pal.light !== "night") {
    ctx.strokeStyle = rgba(mix(hsl([105, 0.3, 0.28], dh), L.cloudBase, 0.3));
    ctx.lineWidth = 12 * s;
    ctx.beginPath();
    for (let i = 0; i < pts.length * 0.7; i++) {
      const p = pts[i]!;
      if (i === 0) ctx.moveTo(p[0], p[1] + 2 * s);
      else ctx.lineTo(p[0], p[1] + 2 * s);
    }
    ctx.stroke();
  }

  // pena udara o rt
  const face = pts.slice(Math.floor(pts.length * 0.72));
  for (let k = 0; k < 4; k++) {
    const p = face[Math.floor(rand() * face.length)]!;
    const yy = Math.max(horizonY + 15 * s, Math.min(h * 0.85, p[1]));
    const x = p[0] + dir * 10 * s;
    // meki oblak pene + kapljice
    for (let j = 0; j < 7; j++) {
      const r = (14 + 30 * rand()) * s;
      const px = x + dir * rand() * 40 * s;
      const py = yy - rand() * 80 * s;
      const sg = ctx.createRadialGradient(px, py, 0, px, py, r);
      sg.addColorStop(0, rgba(foam, 0.45));
      sg.addColorStop(1, rgba(foam, 0));
      ctx.fillStyle = sg;
      ctx.fillRect(px - r, py - r, r * 2, r * 2);
    }
    ctx.fillStyle = rgba(foam, 0.7);
    for (let j = 0; j < 30; j++) {
      const a = -Math.PI / 2 + (rand() - 0.5) * 1.6;
      const d = (20 + 90 * rand()) * s;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * d * 0.6 + dir * 15 * s, yy + Math.sin(a) * d, (1 + 2 * rand()) * s, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // svetionik
  const lIdx = Math.floor(nPts * 0.42);
  const lx = pts[lIdx]![0];
  const ly = pts[lIdx]![1] + 4 * s;
  const th = 235 * s;
  const bw = 40 * s;
  const tw = 26 * s;
  const night = L.pal.light === "night";
  const white = mix(mix([240, 238, 230], L.cloudBase, night ? 0.6 : 0.25), L.skyHor, 0.1);
  const red = mix(hsl([2, 0.65, 0.42]), L.cloudBase, night ? 0.5 : 0.2);
  // kućica
  if (L.extraB) {
    const hx = lx + dir * 46 * s;
    ctx.fillStyle = rgba(white);
    ctx.fillRect(hx - 24 * s, ly - 30 * s, 48 * s, 32 * s);
    ctx.fillStyle = rgba(red);
    ctx.beginPath();
    ctx.moveTo(hx - 28 * s, ly - 30 * s);
    ctx.lineTo(hx, ly - 50 * s);
    ctx.lineTo(hx + 28 * s, ly - 30 * s);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = L.pal.lit ? rgba(WARM) : rgba(L.cloudBase, 0.8);
    ctx.fillRect(hx - 8 * s, ly - 20 * s, 9 * s, 10 * s);
  }
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(lx - bw / 2, ly);
  ctx.lineTo(lx - tw / 2, ly - th);
  ctx.lineTo(lx + tw / 2, ly - th);
  ctx.lineTo(lx + bw / 2, ly);
  ctx.closePath();
  ctx.fillStyle = rgba(white);
  ctx.fill();
  ctx.clip();
  if (L.extraA) {
    ctx.fillStyle = rgba(red);
    for (let k = 0; k < 4; k++) ctx.fillRect(lx - bw, ly - th + (k * 2 + 1) * (th / 8), bw * 2, th / 8);
  }
  // senka na tornju
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.fillRect(lx + (L.sunX < lx ? 0 : -bw), ly - th, bw, th);
  ctx.restore();
  // galerija + lanterna + kupola
  const gy = ly - th;
  ctx.fillStyle = rgba(mix(L.cloudBase, [0, 0, 0], 0.3));
  ctx.fillRect(lx - tw * 0.85, gy - 4 * s, tw * 1.7, 5 * s);
  const lampOn = L.pal.lit || L.pal.light !== "day";
  const lampCol = mix(WARM, WHITE, 0.4);
  ctx.fillStyle = lampOn ? rgba(lampCol) : rgba(mix(L.skyHor, L.cloudBase, 0.5));
  ctx.fillRect(lx - tw * 0.45, gy - 26 * s, tw * 0.9, 22 * s);
  ctx.fillStyle = rgba(red);
  ctx.beginPath();
  ctx.moveTo(lx - tw * 0.6, gy - 26 * s);
  ctx.quadraticCurveTo(lx, gy - 48 * s, lx + tw * 0.6, gy - 26 * s);
  ctx.closePath();
  ctx.fill();
  if (lampOn) {
    const cy = gy - 15 * s;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const halo = ctx.createRadialGradient(lx, cy, 0, lx, cy, 60 * s);
    halo.addColorStop(0, rgba(lampCol, 0.6));
    halo.addColorStop(1, rgba(lampCol, 0));
    ctx.fillStyle = halo;
    ctx.fillRect(lx - 60 * s, cy - 60 * s, 120 * s, 120 * s);
    // snop prema moru
    const len = w * 0.55;
    const ang = (dir > 0 ? 0 : Math.PI) + (rand() - 0.5) * 0.25;
    const spread = 0.07;
    const beam = ctx.createLinearGradient(lx, cy, lx + Math.cos(ang) * len, cy + Math.sin(ang) * len);
    beam.addColorStop(0, rgba(lampCol, 0.35));
    beam.addColorStop(1, rgba(lampCol, 0));
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(lx, cy);
    ctx.lineTo(lx + Math.cos(ang - spread) * len, cy + Math.sin(ang - spread) * len);
    ctx.lineTo(lx + Math.cos(ang + spread) * len, cy + Math.sin(ang + spread) * len);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // galebovi
  if (L.pal.light !== "night") drawBirds(ctx, rand, w, horizonY, s, mix(L.cloudBase, WHITE, 0.6), 3 + Math.floor(rand() * 4));
}

/** Ravnica sa usamljenim drvetom koje savija vetar. */
function drawTreeScene(L: LocCtx): void {
  const { ctx, rand, w, h, s, horizonY, pal, dh } = L;
  const far = hsl(pal.land[0], dh);
  const near = hsl(pal.land[1], dh);
  const windDir = Math.sign(L.wind);

  // daleka brda
  for (let k = 0; k < 2; k++) {
    const col = mix(far, L.skyHor, 0.55 - 0.25 * k);
    const base = horizonY - (14 - 6 * k) * s;
    const amp = (18 - 6 * k) * s;
    const ph = rand() * 7;
    ctx.fillStyle = rgba(col);
    ctx.beginPath();
    ctx.moveTo(0, horizonY + 5 * s);
    for (let x = 0; x <= w; x += 8 * s) ctx.lineTo(x, base - amp * (0.5 + 0.5 * Math.sin(x / (210 * s) + ph)) - amp * 0.4 * Math.sin(x / (73 * s) + ph * 2));
    ctx.lineTo(w, horizonY + 5 * s);
    ctx.closePath();
    ctx.fill();
  }

  // salaš u daljini
  if (L.extraB) {
    const fx = L.side < 0 ? w * (0.7 + 0.15 * rand()) : w * (0.12 + 0.15 * rand());
    const fy = horizonY - 2 * s;
    const hc = mix(far, L.cloudBase, 0.35);
    ctx.fillStyle = rgba(hc);
    ctx.fillRect(fx - 20 * s, fy - 14 * s, 40 * s, 14 * s);
    ctx.beginPath();
    ctx.moveTo(fx - 24 * s, fy - 14 * s);
    ctx.lineTo(fx - 8 * s, fy - 26 * s);
    ctx.lineTo(fx + 14 * s, fy - 26 * s);
    ctx.lineTo(fx + 24 * s, fy - 14 * s);
    ctx.closePath();
    ctx.fill();
    if (pal.lit) {
      ctx.fillStyle = rgba(WARM);
      ctx.fillRect(fx - 10 * s, fy - 10 * s, 5 * s, 5 * s);
      ctx.fillRect(fx + 4 * s, fy - 10 * s, 5 * s, 5 * s);
    }
    // topole
    for (let k = 0; k < 3; k++) {
      const px = fx + (30 + k * 12) * s * (L.side < 0 ? 1 : -1);
      ctx.beginPath();
      ctx.ellipse(px + windDir * 2 * s, fy - 22 * s, 5 * s, 22 * s, windDir * 0.08, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // livada
  const g = ctx.createLinearGradient(0, horizonY, 0, h);
  g.addColorStop(0, rgba(mix(far, L.skyHor, 0.2)));
  g.addColorStop(1, rgba(near));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, horizonY + 4 * s);
  const ph = rand() * 7;
  for (let x = 0; x <= w; x += 10 * s) ctx.lineTo(x, horizonY + 2 * s + 5 * s * Math.sin(x / (300 * s) + ph));
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();

  // pruge vetra kroz travu
  ctx.save();
  ctx.globalAlpha = 0.12;
  for (let k = 0; k < 6; k++) {
    const y = horizonY + (h - horizonY) * (0.1 + 0.8 * rand());
    ctx.fillStyle = rgba(mix(near, L.skyHor, 0.6));
    ctx.beginPath();
    ctx.ellipse(rand() * w, y, w * (0.15 + 0.2 * rand()), (3 + 10 * ((y - horizonY) / (h - horizonY))) * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // ograda koja se gubi ka horizontu
  if (L.extraA) {
    const x0 = L.side < 0 ? w * 0.92 : w * 0.08;
    const x1 = L.side < 0 ? w * 0.55 : w * 0.45;
    const y0 = h * 1.02;
    const y1 = horizonY + 6 * s;
    const n = 12;
    const posts: Pt[] = [];
    for (let i = 0; i <= n; i++) {
      const t = Math.pow(i / n, 0.6);
      posts.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]);
    }
    const pc = mix(near, [0, 0, 0], 0.45);
    ctx.strokeStyle = rgba(pc, 0.8);
    for (let wire = 0; wire < 2; wire++) {
      ctx.lineWidth = 1.2 * s;
      ctx.beginPath();
      posts.forEach((p, i) => {
        const sc = 1 - (i / n) * 0.9;
        const yy = p[1] - (28 + wire * 22) * s * sc;
        if (i === 0) ctx.moveTo(p[0], yy);
        else ctx.lineTo(p[0], yy);
      });
      ctx.stroke();
    }
    ctx.fillStyle = rgba(pc);
    posts.forEach((p, i) => {
      const sc = 1 - (i / n) * 0.9;
      ctx.fillRect(p[0] - 3 * s * sc, p[1] - 60 * s * sc, 6 * s * sc, 60 * s * sc);
    });
  }

  // humka i drvo
  const tx = w * (0.3 + 0.4 * L.posF);
  const ty = horizonY + (h - horizonY) * 0.32;
  ctx.fillStyle = rgba(mix(far, near, 0.55));
  ctx.beginPath();
  ctx.ellipse(tx, ty + 18 * s, 230 * s, 34 * s, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  drawWindTree(ctx, rand, tx, ty + 6 * s, s * (1 + 0.25 * L.posF), windDir, near, L.skyHor, L.sunX);

  // lišće koje leti
  ctx.fillStyle = rgba(mix(near, L.skyHor, 0.2), 0.8);
  for (let i = 0; i < 40; i++) {
    const x = tx + windDir * rand() * w * 0.6;
    const y = ty - 160 * s + rand() * 220 * s;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rand() * Math.PI);
    ctx.fillRect(-3 * s, -1.2 * s, 6 * s, 2.4 * s);
    ctx.restore();
  }

  // bare u prvom planu (odraz neba i munje)
  const nP = 2 + Math.floor(rand() * 2);
  for (let k = 0; k < nP; k++) {
    const px = w * (0.1 + 0.8 * rand());
    const py = h * (0.84 + 0.1 * rand());
    const pw = (70 + 90 * rand()) * s;
    const phh = (8 + 8 * rand()) * s;
    const pg = ctx.createLinearGradient(0, py - phh, 0, py + phh);
    pg.addColorStop(0, rgba(mix(L.cloudBase, L.skyHor, 0.3)));
    pg.addColorStop(1, rgba(mix(L.skyHor, WHITE, 0.15)));
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.ellipse(px, py, pw, phh, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = rgba(WHITE, 0.25);
    ctx.lineWidth = 1 * s;
    for (let r = 0; r < 3; r++) {
      ctx.beginPath();
      ctx.ellipse(px + (rand() - 0.5) * pw, py + (rand() - 0.5) * phh * 0.6, (5 + 10 * rand()) * s, 2 * s, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // trava savijena vetrom
  drawBentGrass(ctx, rand, w, h, s, horizonY + (h - horizonY) * 0.45, windDir, near, L.skyHor);
}

function drawWindTree(ctx: CanvasRenderingContext2D, rand: Rand, x: number, y: number, s: number, windDir: number, leaf: RGB, sky: RGB, lightX: number): void {
  const trunkH = 120 * s;
  const lean = windDir * 26 * s;
  const trunk = mix(leaf, [30, 20, 15], 0.6);
  ctx.fillStyle = rgba(trunk);
  ctx.beginPath();
  ctx.moveTo(x - 10 * s, y);
  ctx.quadraticCurveTo(x - 6 * s + lean * 0.2, y - trunkH * 0.5, x - 4 * s + lean, y - trunkH);
  ctx.lineTo(x + 4 * s + lean, y - trunkH);
  ctx.quadraticCurveTo(x + 7 * s + lean * 0.2, y - trunkH * 0.5, x + 10 * s, y);
  ctx.closePath();
  ctx.fill();
  // grane
  ctx.strokeStyle = rgba(trunk);
  ctx.lineCap = "round";
  for (let k = 0; k < 4; k++) {
    const by = y - trunkH * (0.55 + 0.4 * rand());
    const bx = x + lean * ((y - by) / trunkH);
    ctx.lineWidth = (4 - k * 0.6) * s;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.quadraticCurveTo(bx + windDir * 30 * s, by - 20 * s, bx + windDir * (40 + 40 * rand()) * s + (rand() - 0.5) * 50 * s, by - (30 + 30 * rand()) * s);
    ctx.stroke();
  }
  // krošnja — pomerena niz vetar
  const cx = x + lean + windDir * 40 * s;
  const cy = y - trunkH - 40 * s;
  const dark = mix(leaf, [0, 0, 0], 0.25);
  const lit = mix(leaf, sky, 0.22);
  const blobs: { x: number; y: number; r: number }[] = [];
  for (let i = 0; i < 46; i++) {
    const a = rand() * Math.PI * 2;
    const d = Math.sqrt(rand());
    blobs.push({
      x: cx + Math.cos(a) * 115 * s * d + windDir * d * 30 * s,
      y: cy + Math.sin(a) * 58 * s * d,
      r: (16 + 18 * rand()) * s,
    });
  }
  // jedna tamna masa krošnje, pa svetlije „pramenove" ka svetlu (bez obrisa po krugu)
  ctx.fillStyle = rgba(dark);
  ctx.beginPath();
  for (const b of blobs) {
    ctx.moveTo(b.x + b.r, b.y);
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
  }
  ctx.fill();
  const lx = Math.max(-1, Math.min(1, (lightX - cx) / 400));
  blobs.sort((a, b) => a.y - b.y);
  for (const b of blobs) {
    if (b.y > cy + 20 * s) continue; // donji deo ostaje u senci
    ctx.fillStyle = rgba(mix(dark, lit, 0.35 + 0.4 * rand()), 0.55);
    ctx.beginPath();
    ctx.arc(b.x + lx * b.r * 0.3, b.y - b.r * 0.3, b.r * 0.62, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBentGrass(ctx: CanvasRenderingContext2D, rand: Rand, w: number, h: number, s: number, top: number, windDir: number, base: RGB, sky: RGB): void {
  const n = 650;
  ctx.save();
  ctx.lineCap = "round";
  for (let i = 0; i < n; i++) {
    const t = rand();
    const y = top + (h - top) * Math.sqrt(t) + 6 * s;
    const x = rand() * w;
    const len = (10 + 40 * t) * s * (0.6 + 0.6 * rand());
    const bend = windDir * len * (0.5 + 0.4 * rand());
    ctx.strokeStyle = rgba(mix(mix(base, [0, 0, 0], 0.3), sky, 0.25 * rand()), 0.85);
    ctx.lineWidth = (0.8 + 1.8 * t) * s;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + bend * 0.2, y - len * 0.7, x + bend, y - len * 0.75);
    ctx.stroke();
  }
  ctx.restore();
}

/** Planinski venci u kiši i magli, šuma, koliba. */
function drawMountainScene(L: LocCtx): void {
  const { ctx, rand, w, h, s, horizonY, pal, dh } = L;
  const far = hsl(pal.land[0], dh);
  const near = hsl(pal.land[1], dh);
  const mist = mix(L.skyHor, L.cloudBase, 0.25);
  const ranges = 3;
  for (let k = 0; k < ranges; k++) {
    const t = k / (ranges - 1);
    const base = horizonY + (k * 30 - 10) * s;
    const height = h * (0.3 - 0.08 * t);
    const col = mix(far, near, t);
    const hazed = mix(col, mist, 0.65 * (1 - t));
    const ridge = ridgePoints(rand, w, base, height, 3 + k * 2, s);
    ctx.fillStyle = rgba(hazed);
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (const p of ridge) ctx.lineTo(p[0], p[1]);
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
    // svetla strana vrhova
    ctx.save();
    ctx.clip();
    ctx.fillStyle = rgba(mix(hazed, L.skyHor, 0.25), 0.6);
    for (let i = 1; i < ridge.length - 1; i++) {
      const p = ridge[i]!;
      const prev = ridge[i - 1]!;
      const next = ridge[i + 1]!;
      if (p[1] < prev[1] && p[1] < next[1]) {
        const toLight = L.sunX < p[0] ? prev : next;
        ctx.beginPath();
        ctx.moveTo(p[0], p[1]);
        ctx.lineTo(toLight[0], toLight[1]);
        ctx.lineTo(p[0] + (toLight[0] - p[0]) * 0.15, toLight[1] + (toLight[1] - p[1]) * 0.5);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
    // magla uz podnožje
    const mTop = base - height * 0.4;
    const mBot = base + 110 * s;
    const mg = ctx.createLinearGradient(0, mTop, 0, mBot);
    mg.addColorStop(0, rgba(mist, 0));
    mg.addColorStop(0.65, rgba(mist, 0.55 - 0.15 * k));
    mg.addColorStop(1, rgba(mist, 0)); // bez oštre ivice
    ctx.fillStyle = mg;
    ctx.fillRect(0, mTop, w, mBot - mTop);
  }

  // dolina
  const vy = horizonY + 70 * s;
  const vg = ctx.createLinearGradient(0, vy, 0, h);
  vg.addColorStop(0, rgba(mix(near, mist, 0.3)));
  vg.addColorStop(1, rgba(mix(near, [0, 0, 0], 0.3)));
  ctx.fillStyle = vg;
  ctx.beginPath();
  ctx.moveTo(0, vy + 10 * s);
  const ph = rand() * 7;
  for (let x = 0; x <= w; x += 10 * s) ctx.lineTo(x, vy + 12 * s * Math.sin(x / (250 * s) + ph));
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();

  // planinsko jezero sa odrazom munje
  if (L.extraB) {
    const lx = w * (0.3 + 0.4 * rand());
    const ly = vy + (h - vy) * 0.3;
    const lw = w * (0.18 + 0.1 * rand());
    const lg = ctx.createLinearGradient(0, ly - 14 * s, 0, ly + 14 * s);
    lg.addColorStop(0, rgba(mix(L.cloudBase, L.skyHor, 0.5)));
    lg.addColorStop(1, rgba(L.skyHor));
    ctx.fillStyle = lg;
    ctx.beginPath();
    ctx.ellipse(lx, ly, lw, 16 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    for (const bx of L.boltHits) {
      if (Math.abs(bx - lx) < lw) {
        ctx.strokeStyle = rgba(mix(hsl(pal.bolt), WHITE, 0.5), 0.6);
        ctx.lineWidth = 2 * s;
        ctx.beginPath();
        ctx.moveTo(bx, ly - 14 * s);
        ctx.lineTo(bx + 4 * s, ly - 4 * s);
        ctx.lineTo(bx - 2 * s, ly + 6 * s);
        ctx.lineTo(bx + 2 * s, ly + 14 * s);
        ctx.stroke();
      }
    }
  }

  // koliba
  if (L.extraA) {
    const cx = L.side < 0 ? w * (0.15 + 0.2 * L.posF) : w * (0.65 + 0.2 * L.posF);
    const cy = vy + (h - vy) * 0.45;
    const wood = mix(near, [60, 35, 20], 0.5);
    ctx.fillStyle = rgba(wood);
    ctx.fillRect(cx - 34 * s, cy - 30 * s, 68 * s, 30 * s);
    ctx.fillStyle = rgba(mix(wood, [0, 0, 0], 0.4));
    ctx.beginPath();
    ctx.moveTo(cx - 46 * s, cy - 28 * s);
    ctx.lineTo(cx, cy - 66 * s);
    ctx.lineTo(cx + 46 * s, cy - 28 * s);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = pal.lit ? rgba(WARM) : rgba(mix(L.skyHor, L.cloudBase, 0.5));
    ctx.fillRect(cx - 20 * s, cy - 22 * s, 12 * s, 12 * s);
    ctx.fillRect(cx + 8 * s, cy - 22 * s, 12 * s, 12 * s);
    if (pal.lit) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const glow = ctx.createRadialGradient(cx, cy - 16 * s, 0, cx, cy - 16 * s, 60 * s);
      glow.addColorStop(0, rgba(WARM, 0.35));
      glow.addColorStop(1, rgba(WARM, 0));
      ctx.fillStyle = glow;
      ctx.fillRect(cx - 60 * s, cy - 76 * s, 120 * s, 120 * s);
      ctx.restore();
    }
    // dim koji vetar nosi
    ctx.fillStyle = rgba(mist, 0.25);
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.arc(cx + 22 * s + Math.sign(L.wind) * i * 14 * s, cy - 70 * s - i * 5 * s, (5 + i * 2) * s, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // jele u prvom planu
  const pine = mix(near, [0, 0, 0], 0.45);
  const nTrees = 14 + Math.floor(rand() * 8);
  for (let i = 0; i < nTrees; i++) {
    const x = rand() * w;
    const t = rand();
    const y = h * (0.86 + 0.16 * t);
    const th = (70 + 110 * t) * s;
    drawPine(ctx, x, y, th, rgba(mix(pine, mist, 0.2 * (1 - t))));
  }
}

function ridgePoints(rand: Rand, w: number, base: number, height: number, peaks: number, s: number): Pt[] {
  const pts: Pt[] = [[-20 * s, base - height * 0.3]];
  const step = (w + 40 * s) / (peaks * 2);
  for (let i = 1; i <= peaks * 2; i++) {
    const x = -20 * s + i * step + (rand() - 0.5) * step * 0.5;
    const up = i % 2 === 1;
    const y = up ? base - height * (0.55 + 0.45 * rand()) : base - height * (0.15 + 0.3 * rand());
    // sitni zupci
    const prev = pts[pts.length - 1]!;
    for (let j = 1; j < 5; j++) {
      const tt = j / 5;
      pts.push([prev[0] + (x - prev[0]) * tt, prev[1] + (y - prev[1]) * tt + (rand() - 0.5) * height * 0.08]);
    }
    pts.push([x, y]);
  }
  return pts;
}

function drawPine(ctx: CanvasRenderingContext2D, x: number, y: number, th: number, col: string): void {
  ctx.fillStyle = col;
  const tiers = 4;
  for (let k = 0; k < tiers; k++) {
    const t0 = k / tiers;
    const wTier = th * 0.34 * (1 - t0 * 0.7);
    const yb = y - th * t0 * 0.85;
    ctx.beginPath();
    ctx.moveTo(x - wTier, yb);
    ctx.lineTo(x, yb - th * 0.38);
    ctx.lineTo(x + wTier, yb);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillRect(x - th * 0.03, y - th * 0.05, th * 0.06, th * 0.1);
}

function drawBirds(ctx: CanvasRenderingContext2D, rand: Rand, w: number, horizonY: number, s: number, col: RGB, n: number): void {
  ctx.strokeStyle = rgba(col, 0.9);
  ctx.lineWidth = 2 * s;
  ctx.lineCap = "round";
  for (let i = 0; i < n; i++) {
    const x = w * (0.2 + 0.6 * rand());
    const y = horizonY * (0.55 + 0.35 * rand());
    const span = (8 + 8 * rand()) * s;
    ctx.beginPath();
    ctx.moveTo(x - span, y - span * 0.2);
    ctx.quadraticCurveTo(x - span * 0.4, y - span * 0.6, x, y);
    ctx.quadraticCurveTo(x + span * 0.4, y - span * 0.6, x + span, y - span * 0.2);
    ctx.stroke();
  }
}
