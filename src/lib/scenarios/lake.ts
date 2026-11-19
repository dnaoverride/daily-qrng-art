/**
 * Planinsko jezero — render v2.
 *
 * Gornja polovina (nebo, zvezde, sunce/mesec, oblaci, planine, šuma na obali)
 * crta se DVA puta: normalno, pa preslikano preko horizonta u vodu (pravi odraz).
 * Preko odraza: zatamnjenje dubine, talasići koji lome odraz, odsjaj sunca/meseca,
 * magla na vodi. Prednji plan (opciono): drveni mol, čamac, trska.
 *
 * QRNG bira odluke (paleta, horizont, planine, prednji plan); geometrija se
 * izračuna unapred (PRNG seedovan QRNG-om), pa su oba prolaza identična.
 * Sve dimenzije relativne (s = w/1200).
 */
import type { QRNGStream } from "../qrng";
import { hslToRgb, rgbString, type RGB } from "../color";
import { prngFromStream, type Rand } from "../prng";
import { NO_HOOKS, type SceneHooks, type SkyLight } from "../sky-events";

type HSL = [number, number, number];

interface LakePalette {
  name: string;
  light: SkyLight;
  sky: [HSL, HSL, HSL]; // vrh → sredina → horizont
  sun: HSL;
  moon?: boolean;
  mountainFar: HSL;
  mountainNear: HSL;
  forest: HSL;
  waterDeep: HSL;
  mist: number; // 0–1
  stars?: boolean;
  snow: number; // 0–1 verovatnoća snega na dalekim vrhovima
}

const PALETTES: readonly LakePalette[] = [
  {
    name: "dawn-mist",
    light: "dusk",
    sky: [[220, 0.35, 0.62], [330, 0.45, 0.78], [28, 0.8, 0.8]],
    sun: [35, 1, 0.85],
    mountainFar: [260, 0.18, 0.62],
    mountainNear: [250, 0.2, 0.4],
    forest: [200, 0.25, 0.2],
    waterDeep: [230, 0.3, 0.3],
    mist: 0.9,
    snow: 0.6,
  },
  {
    name: "day",
    light: "day",
    sky: [[210, 0.6, 0.48], [205, 0.55, 0.65], [195, 0.45, 0.82]],
    sun: [48, 1, 0.92],
    mountainFar: [215, 0.25, 0.6],
    mountainNear: [200, 0.25, 0.35],
    forest: [150, 0.35, 0.16],
    waterDeep: [205, 0.55, 0.22],
    mist: 0.2,
    snow: 0.8,
  },
  {
    name: "golden",
    light: "dusk",
    sky: [[215, 0.4, 0.5], [35, 0.7, 0.68], [40, 0.95, 0.66]],
    sun: [42, 1, 0.75],
    mountainFar: [25, 0.3, 0.55],
    mountainNear: [15, 0.25, 0.3],
    forest: [90, 0.3, 0.13],
    waterDeep: [210, 0.4, 0.16],
    mist: 0.35,
    snow: 0.5,
  },
  {
    name: "dusk",
    light: "dusk",
    sky: [[245, 0.45, 0.25], [300, 0.4, 0.45], [20, 0.8, 0.6]],
    sun: [25, 1, 0.66],
    mountainFar: [280, 0.2, 0.36],
    mountainNear: [265, 0.25, 0.2],
    forest: [250, 0.3, 0.1],
    waterDeep: [250, 0.45, 0.1],
    mist: 0.3,
    snow: 0.4,
  },
  {
    name: "night",
    light: "night",
    sky: [[230, 0.55, 0.07], [228, 0.45, 0.14], [222, 0.35, 0.24]],
    sun: [50, 0.3, 0.92],
    moon: true,
    mountainFar: [225, 0.25, 0.2],
    mountainNear: [225, 0.3, 0.11],
    forest: [225, 0.35, 0.06],
    waterDeep: [230, 0.55, 0.05],
    mist: 0.15,
    stars: true,
    snow: 0.7,
  },
  {
    name: "alpine-clear",
    light: "day",
    sky: [[218, 0.75, 0.38], [210, 0.65, 0.55], [200, 0.55, 0.75]],
    sun: [50, 1, 0.94],
    mountainFar: [220, 0.3, 0.55],
    mountainNear: [210, 0.3, 0.3],
    forest: [160, 0.4, 0.13],
    waterDeep: [195, 0.7, 0.2],
    mist: 0.1,
    snow: 1,
  },
];

function hsl(c: HSL, dh = 0, dl = 0): RGB {
  return hslToRgb(c[0] + dh, c[1], Math.min(0.96, Math.max(0.02, c[2] + dl)));
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

type Pt = { x: number; y: number };

/**
 * Planinski greben: glavni vrhovi („šatori" sa konkavnim padinama) + pomoćni
 * vrhovi + šum u 3 oktave koji je jači pri vrhu (nazubljen greben, mirno podnožje).
 */
function mountainRidge(
  rand: Rand,
  w: number,
  baseY: number,
  maxH: number,
  peaks: number,
  sharp: number
): { pts: Pt[]; tops: Pt[] } {
  const tops: Pt[] = [];
  const tents: { x: number; y: number; hw: number; exp: number }[] = [];
  for (let i = 0; i < peaks; i++) {
    const t = { x: (i + 0.15 + rand() * 0.7) * (w / peaks), y: baseY - maxH * (0.5 + 0.5 * rand()) };
    tops.push(t);
    tents.push({ ...t, hw: (baseY - t.y) * sharp * (0.8 + 0.5 * rand()), exp: 0.9 + rand() * 0.5 });
    // 1–2 pomoćna vrha na ramenima
    const subs = 1 + Math.floor(rand() * 2);
    for (let k = 0; k < subs; k++) {
      const side = rand() < 0.5 ? -1 : 1;
      const sh = (baseY - t.y) * (0.45 + 0.3 * rand());
      tents.push({
        x: t.x + side * (baseY - t.y) * sharp * (0.35 + 0.4 * rand()),
        y: baseY - sh,
        hw: sh * sharp * (0.7 + 0.4 * rand()),
        exp: 0.9 + rand() * 0.4,
      });
    }
  }
  const octaves = [
    { n: 14, a: 0.09 },
    { n: 38, a: 0.045 },
    { n: 110, a: 0.02 },
  ].map((o) => ({ ...o, v: Array.from({ length: o.n + 2 }, () => rand() - 0.5) }));
  const sample = (v: number[], n: number, u: number) => {
    const f = u * n;
    const i = Math.floor(f);
    const t = f - i;
    const sm = t * t * (3 - 2 * t);
    return v[i]! + (v[i + 1]! - v[i]!) * sm;
  };
  const pts: Pt[] = [];
  const step = w / 300;
  for (let x = -step; x <= w + step; x += step) {
    let y = baseY;
    for (const t of tents) {
      const d = Math.abs(x - t.x) / t.hw;
      if (d < 1) y = Math.min(y, t.y + (baseY - t.y) * Math.pow(d, t.exp));
    }
    const u = Math.min(1, Math.max(0, x / w));
    const height = (baseY - y) / maxH; // 0 u podnožju, ~1 na vrhu
    let n = 0;
    for (const o of octaves) n += sample(o.v, o.n, u) * o.a;
    pts.push({ x, y: Math.min(baseY, y + n * maxH * (0.25 + 0.9 * height)) });
  }
  return { pts, tops };
}

interface Cloud {
  x: number;
  y: number;
  blobs: [number, number, number, number][];
}

export function renderLake(
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
  const horizonY = Math.floor(h * (0.44 + 0.1 * stream.next_f()));
  const sunX = w * (0.15 + 0.7 * stream.next_f());
  const sunR = (pal.moon ? 16 + 12 * stream.next_f() : 22 + 22 * stream.next_f()) * s;
  const sunY = horizonY * (pal.light === "dusk" ? 0.55 + 0.25 * stream.next_f() : 0.15 + 0.3 * stream.next_f());
  const farPeaks = stream.next_int(3, 6);
  const nearPeaks = stream.next_int(2, 5);
  const hasSnow = stream.next_f() < pal.snow;
  const cloudCount = pal.stars ? 0 : stream.next_int(0, 5);
  const fgRoll = stream.next_f();
  const reedsRoll = stream.next_f();
  const birdsRoll = stream.next_f();
  const rand = prngFromStream(stream);

  const sky = pal.sky.map((c) => hsl(c, dh));
  const skyHorizon = sky[2]!;
  const sunCol = hsl(pal.sun);
  const sunCore = mix(sunCol, [255, 252, 240], 0.6);
  const farCol = mix(hsl(pal.mountainFar, dh), skyHorizon, 0.25);
  const nearCol = hsl(pal.mountainNear, dh);
  const forestCol = hsl(pal.forest, dh);
  const waterDeep = hsl(pal.waterDeep, dh);
  const snowCol = mix([250, 250, 255], skyHorizon, pal.light === "night" ? 0.55 : 0.15);

  // ---- Geometrija (jednom, za oba prolaza) ----
  const far = mountainRidge(rand, w, horizonY, horizonY * (0.42 + 0.2 * rand()), farPeaks, 1.1 + rand() * 0.5);
  const near = mountainRidge(rand, w, horizonY, horizonY * (0.22 + 0.16 * rand()), nearPeaks, 1.6 + rand() * 0.8);
  const stars: [number, number, number, number][] = [];
  if (pal.stars) {
    const n = 150 + Math.floor(rand() * 150);
    for (let i = 0; i < n; i++) {
      const y = Math.pow(rand(), 1.4) * horizonY * 0.85;
      stars.push([rand() * w, y, 0.25 + 0.7 * rand(), rand() < 0.9 ? 0.8 : 1.4]);
    }
  }
  const clouds: Cloud[] = [];
  for (let i = 0; i < cloudCount; i++) {
    const cx = rand() * w;
    const cy = horizonY * (0.1 + 0.4 * rand());
    const cw = w * (0.1 + 0.18 * rand());
    const blobs: [number, number, number, number][] = [];
    const nb = 6 + Math.floor(rand() * 7);
    for (let b = 0; b < nb; b++) {
      const u = rand() - 0.5;
      blobs.push([cx + u * cw, cy - rand() * 10 * s, cw * (0.08 + 0.12 * rand()) * (1 - Math.abs(u)), (6 + 12 * rand()) * s * (1 - Math.abs(u) * 0.8)]);
    }
    clouds.push({ x: cx, y: cy, blobs });
  }
  // Šuma na obali: niz jelki različite visine
  const trees: [number, number, number][] = [];
  {
    let x = -10 * s;
    while (x < w + 10 * s) {
      const th = (10 + rand() * 22) * s * (rand() < 0.1 ? 1.6 : 1);
      trees.push([x, th, th * (0.32 + 0.12 * rand())]);
      x += (3 + rand() * 7) * s;
    }
  }
  const birds: [number, number, number][] = [];
  if (birdsRoll < 0.35 && pal.light !== "night") {
    const n = 2 + Math.floor(rand() * 5);
    const bx = w * (0.15 + 0.7 * rand());
    const by = horizonY * (0.15 + 0.35 * rand());
    for (let i = 0; i < n; i++) birds.push([bx + (rand() - 0.5) * 150 * s, by + (rand() - 0.5) * 60 * s, (4 + rand() * 6) * s]);
  }

  // ---- Gornja polovina (pass: normal ili odraz) ----
  const drawUpper = (mirror: boolean) => {
    // Nebo
    const g = ctx.createLinearGradient(0, 0, 0, horizonY);
    g.addColorStop(0, rgbString(sky[0]!));
    g.addColorStop(0.55, rgbString(sky[1]!));
    g.addColorStop(1, rgbString(skyHorizon));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, horizonY + 1);
    // Zvezde
    for (const [x, y, a, r] of stars) {
      ctx.fillStyle = `rgba(255,255,255,${(a * (mirror ? 0.6 : 1)).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(x, y, r * Math.max(0.6, s), 0, Math.PI * 2);
      ctx.fill();
    }
    if (!mirror) hooks.sky({ horizonY, light: pal.light });
    // Sunce / mesec
    const glowR = sunR * (pal.moon ? 6 : 8);
    const glow = ctx.createRadialGradient(sunX, sunY, sunR * 0.6, sunX, sunY, glowR);
    glow.addColorStop(0, rgba(sunCol, pal.moon ? 0.28 : 0.5));
    glow.addColorStop(0.3, rgba(sunCol, pal.moon ? 0.08 : 0.18));
    glow.addColorStop(1, rgba(sunCol, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(sunX - glowR, sunY - glowR, glowR * 2, glowR * 2);
    const core = ctx.createRadialGradient(sunX - sunR * 0.25, sunY - sunR * 0.25, 0, sunX, sunY, sunR);
    core.addColorStop(0, rgbString(sunCore));
    core.addColorStop(1, rgbString(sunCol));
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
    ctx.fill();
    if (!mirror) hooks.body({ x: sunX, y: sunY, r: sunR, kind: pal.moon ? "moon" : "sun" });
    // Oblaci (obasjani sa strane sunca)
    for (const c of clouds) {
      const litSide = c.x < sunX ? 1 : -1;
      const base = mix(skyHorizon, [255, 255, 255], 0.55);
      ctx.beginPath();
      for (const [bx, by, rx, ry] of c.blobs) {
        ctx.save();
        ctx.translate(bx, by);
        ctx.scale(Math.max(1, rx), Math.max(1, ry));
        ctx.moveTo(1, 0);
        ctx.arc(0, 0, 1, 0, Math.PI * 2);
        ctx.restore();
      }
      const cg = ctx.createLinearGradient(c.x - 80 * s * litSide, 0, c.x + 80 * s * litSide, 0);
      cg.addColorStop(0, rgba(mix(base, sunCore, 0.4), 0.85));
      cg.addColorStop(1, rgba(mix(base, sky[0]!, 0.35), 0.75));
      ctx.fillStyle = cg;
      ctx.fill();
    }
    // Ptice (samo normalan prolaz)
    if (!mirror && birds.length) {
      ctx.strokeStyle = rgba(mix(nearCol, [0, 0, 0], 0.3), 0.8);
      ctx.lineWidth = Math.max(1, 1.5 * s);
      ctx.lineCap = "round";
      for (const [x, y, sp] of birds) {
        ctx.beginPath();
        ctx.moveTo(x - sp, y - sp * 0.35);
        ctx.quadraticCurveTo(x - sp * 0.4, y - sp * 0.5, x, y);
        ctx.quadraticCurveTo(x + sp * 0.4, y - sp * 0.5, x + sp, y - sp * 0.35);
        ctx.stroke();
      }
    }
    // Daleke planine (+ sneg)
    const farPath = () => {
      ctx.beginPath();
      ctx.moveTo(-5, horizonY + 1);
      for (const p of far.pts) ctx.lineTo(p.x, p.y);
      ctx.lineTo(w + 5, horizonY + 1);
      ctx.closePath();
    };
    const fg = ctx.createLinearGradient(0, horizonY - horizonY * 0.6, 0, horizonY);
    fg.addColorStop(0, rgbString(farCol));
    fg.addColorStop(1, rgbString(mix(farCol, skyHorizon, 0.45)));
    farPath();
    ctx.fillStyle = fg;
    ctx.fill();
    if (hasSnow) {
      ctx.save();
      farPath();
      ctx.clip();
      for (const t of far.tops) {
        const capH = (horizonY - t.y) * 0.3;
        const sg = ctx.createLinearGradient(0, t.y, 0, t.y + capH);
        sg.addColorStop(0, rgba(snowCol, 0.95));
        sg.addColorStop(0.7, rgba(snowCol, 0.6));
        sg.addColorStop(1, rgba(snowCol, 0));
        ctx.fillStyle = sg;
        ctx.beginPath();
        ctx.moveTo(t.x, t.y - 2);
        ctx.lineTo(t.x - capH * 1.3, t.y + capH);
        ctx.lineTo(t.x + capH * 1.3, t.y + capH);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
    // Izmaglica između slojeva
    const hz = ctx.createLinearGradient(0, horizonY - horizonY * 0.25, 0, horizonY);
    hz.addColorStop(0, rgba(skyHorizon, 0));
    hz.addColorStop(1, rgba(skyHorizon, 0.4 * (0.5 + pal.mist)));
    ctx.fillStyle = hz;
    ctx.fillRect(0, horizonY - horizonY * 0.25, w, horizonY * 0.25 + 1);
    // Bliže planine (osenčena strana dalje od sunca)
    ctx.beginPath();
    ctx.moveTo(-5, horizonY + 1);
    for (const p of near.pts) ctx.lineTo(p.x, p.y);
    ctx.lineTo(w + 5, horizonY + 1);
    ctx.closePath();
    const ng = ctx.createLinearGradient(0, horizonY - horizonY * 0.4, 0, horizonY);
    ng.addColorStop(0, rgbString(nearCol));
    ng.addColorStop(1, rgbString(mix(nearCol, forestCol, 0.6)));
    ctx.fillStyle = ng;
    ctx.fill();
    // Šuma na obali
    ctx.fillStyle = rgbString(forestCol);
    ctx.beginPath();
    for (const [x, th, tw] of trees) {
      ctx.moveTo(x - tw, horizonY + 1);
      ctx.lineTo(x, horizonY - th);
      ctx.lineTo(x + tw, horizonY + 1);
    }
    ctx.fill();
    ctx.fillRect(0, horizonY - 3 * s, w, 4 * s);
  };

  // 1) Normalan prolaz
  drawUpper(false);

  // 2) Odraz: preslikavanje preko horizonta, klipovano na vodu.
  //    Ispod 2×horizonY odraz ne dopire — tu je odraz zenita (boja vrha neba).
  ctx.fillStyle = rgbString(sky[0]!);
  ctx.fillRect(0, horizonY, w, h - horizonY);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, horizonY, w, h - horizonY);
  ctx.clip();
  ctx.translate(0, 2 * horizonY);
  ctx.scale(1, -1);
  drawUpper(true);
  ctx.restore();

  // 3) Voda: zatamnjenje ka dubini + boja vode
  const wg = ctx.createLinearGradient(0, horizonY, 0, h);
  wg.addColorStop(0, rgba(waterDeep, 0.25));
  wg.addColorStop(0.5, rgba(waterDeep, 0.5));
  wg.addColorStop(1, rgba(waterDeep, 0.78));
  ctx.fillStyle = wg;
  ctx.fillRect(0, horizonY, w, h - horizonY);

  // 4) Talasići: tanke svetle i tamne linije, ređe pri horizontu, gušće bliže
  const lightLine = mix(skyHorizon, [255, 255, 255], 0.3);
  let y = horizonY + 3 * s;
  let gap = 2.5 * s;
  while (y < h) {
    const t = (y - horizonY) / (h - horizonY);
    const segs = 2 + Math.floor(rand() * 4);
    for (let k = 0; k < segs; k++) {
      const len = (30 + rand() * 140) * s * (0.6 + t * 1.6);
      const x0 = rand() * w - len / 2;
      ctx.fillStyle = rand() < 0.55 ? rgba(lightLine, 0.05 + 0.1 * rand()) : rgba(waterDeep, 0.15 + 0.15 * rand());
      ctx.fillRect(x0, y, len, Math.max(1, (0.8 + t * 1.5) * s));
    }
    y += gap;
    gap *= 1.08;
  }

  // 5) Odsjaj sunca/meseca: vertikalna staza od kratkih crtica
  const mirrorSunY = 2 * horizonY - sunY;
  const glints = 120 + Math.floor(rand() * 120);
  for (let i = 0; i < glints; i++) {
    const t = rand();
    const gy = horizonY + 2 + t * Math.min(h - horizonY, (mirrorSunY - horizonY) * 1.6 + 40 * s);
    const spread = sunR * (0.8 + t * 2.2);
    const off = (rand() + rand() - 1) * spread;
    const len = (6 + rand() * 22) * s;
    ctx.fillStyle = rgba(sunCore, (pal.moon ? 0.35 : 0.55) * (1 - t * 0.6) * rand());
    ctx.fillRect(sunX + off - len / 2, gy, len, Math.max(1, 1.2 * s));
  }

  // 6) Magla na vodi
  if (pal.mist > 0.05) {
    const mistCol = mix(skyHorizon, [255, 255, 255], 0.5);
    const bands = 2 + Math.floor(rand() * 3);
    for (let i = 0; i < bands; i++) {
      const my = horizonY + (rand() * 0.25 - 0.05) * (h - horizonY);
      const mh = (14 + rand() * 30) * s;
      const mg = ctx.createLinearGradient(0, my - mh, 0, my + mh);
      mg.addColorStop(0, rgba(mistCol, 0));
      mg.addColorStop(0.5, rgba(mistCol, 0.35 * pal.mist));
      mg.addColorStop(1, rgba(mistCol, 0));
      ctx.fillStyle = mg;
      ctx.fillRect(0, my - mh, w, mh * 2);
    }
  }

  // 7) Prednji plan
  const silCol = mix(forestCol, [0, 0, 0], 0.45);
  if (fgRoll < 0.28) {
    drawDock(ctx, rand, w, h, horizonY, s, silCol, waterDeep);
  } else if (fgRoll < 0.5) {
    drawBoat(ctx, w * (0.2 + 0.6 * rand()), horizonY + (h - horizonY) * (0.35 + 0.35 * rand()), s * (0.8 + 0.6 * rand()), silCol);
  }
  if (reedsRoll < 0.5) {
    drawReeds(ctx, rand, w, h, s, silCol, rand() < 0.5);
  }
}

function drawDock(
  ctx: CanvasRenderingContext2D,
  rand: Rand,
  w: number,
  h: number,
  horizonY: number,
  s: number,
  col: RGB,
  water: RGB
): void {
  // Mol u perspektivi: od dna ka središtu slike
  const cx = w * (0.3 + 0.4 * rand());
  const endY = horizonY + (h - horizonY) * (0.45 + 0.15 * rand());
  const endW = 40 * s;
  const baseW = 260 * s;
  const lean = (rand() - 0.5) * 120 * s;
  ctx.fillStyle = rgbString(col);
  ctx.beginPath();
  ctx.moveTo(cx - baseW / 2 + lean, h + 2);
  ctx.lineTo(cx - endW / 2, endY);
  ctx.lineTo(cx + endW / 2, endY);
  ctx.lineTo(cx + baseW / 2 + lean, h + 2);
  ctx.closePath();
  ctx.fill();
  // Daske
  ctx.strokeStyle = rgba(mix(col, water, 0.4), 0.6);
  ctx.lineWidth = Math.max(1, s);
  for (let i = 1; i < 14; i++) {
    const t = Math.pow(i / 14, 1.6);
    const y = endY + (h - endY) * t;
    const hw = endW / 2 + (baseW / 2 - endW / 2) * t;
    const off = lean * t;
    ctx.beginPath();
    ctx.moveTo(cx - hw + off, y);
    ctx.lineTo(cx + hw + off, y);
    ctx.stroke();
  }
  // Stubovi na kraju + njihov odraz
  ctx.fillStyle = rgbString(col);
  for (const side of [-1, 1]) {
    const px = cx + side * endW * 0.45;
    ctx.fillRect(px - 2 * s, endY - 10 * s, 4 * s, 22 * s);
    ctx.fillStyle = rgba(col, 0.35);
    ctx.fillRect(px - 2 * s, endY + 12 * s, 4 * s, 14 * s);
    ctx.fillStyle = rgbString(col);
  }
}

function drawBoat(ctx: CanvasRenderingContext2D, x: number, y: number, k: number, col: RGB): void {
  ctx.fillStyle = rgbString(col);
  ctx.beginPath();
  ctx.moveTo(x - 50 * k, y - 6 * k);
  ctx.quadraticCurveTo(x, y + 12 * k, x + 50 * k, y - 6 * k);
  ctx.lineTo(x + 44 * k, y - 2 * k);
  ctx.quadraticCurveTo(x, y + 4 * k, x - 44 * k, y - 2 * k);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x - 50 * k, y - 6 * k);
  ctx.quadraticCurveTo(x, y + 12 * k, x + 50 * k, y - 6 * k);
  ctx.quadraticCurveTo(x, y + 2 * k, x - 50 * k, y - 6 * k);
  ctx.fill();
  // Veslo
  ctx.strokeStyle = rgbString(col);
  ctx.lineWidth = 2 * k;
  ctx.beginPath();
  ctx.moveTo(x - 10 * k, y - 4 * k);
  ctx.lineTo(x + 30 * k, y + 14 * k);
  ctx.stroke();
  // Odraz čamca
  ctx.fillStyle = rgba(col, 0.3);
  ctx.beginPath();
  ctx.moveTo(x - 46 * k, y + 2 * k);
  ctx.quadraticCurveTo(x, y + 18 * k, x + 46 * k, y + 2 * k);
  ctx.closePath();
  ctx.fill();
}

function drawReeds(ctx: CanvasRenderingContext2D, rand: Rand, w: number, h: number, s: number, col: RGB, left: boolean): void {
  const n = 25 + Math.floor(rand() * 25);
  const span = w * (0.15 + 0.15 * rand());
  ctx.strokeStyle = rgbString(col);
  ctx.fillStyle = rgbString(col);
  ctx.lineCap = "round";
  for (let i = 0; i < n; i++) {
    const u = Math.pow(rand(), 1.5);
    const x = left ? u * span : w - u * span;
    const len = (40 + rand() * 90) * s * (1 - u * 0.6);
    const bend = (rand() - 0.5) * 30 * s;
    ctx.lineWidth = (1 + rand() * 1.8) * s;
    ctx.beginPath();
    ctx.moveTo(x, h + 2);
    ctx.quadraticCurveTo(x + bend * 0.3, h - len * 0.5, x + bend, h - len);
    ctx.stroke();
    if (rand() < 0.3) {
      // Rogoz (klip)
      ctx.beginPath();
      ctx.ellipse(x + bend, h - len - 6 * s, 2.5 * s, 8 * s, bend / (60 * s), 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
