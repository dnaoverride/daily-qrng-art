/**
 * Japanski vrt — render v2 (ukiyo-e duh).
 *
 * QRNG bira godišnje doba (sakura / leto / javor / zima) i paletu doba dana
 * (zora, dan, ukiyo-e plava, crveno sunce u sumraku, jutarnja magla, noć sa
 * fenjerima). Scena u slojevima:
 *   nebo sa „bokashi" gradijentom → kasumi trake magle → vulkan sa snežnom kapom
 *   → brda sa borovima → daleka obala sa pagodom i drvećem → jezerce sa pravim
 *   odrazom (tehnika iz jezera), koi šaranima i lokvanjima → torii u vodi,
 *   crveni lučni most → bliža obala sa kamenjem i kamenim fenjerom → veliko
 *   drvo sa strane i grana koja uokviruje kadar → latice / lišće / sneg / svici.
 *
 * QRNG bira odluke; geometrija se računa unapred (PRNG seedovan QRNG-om),
 * pa su normalan prolaz i odraz identični. Sve dimenzije relativne (s = w/1200).
 */
import type { QRNGStream } from "../qrng";
import { hslToRgb, rgbString, type RGB } from "../color";
import { prngFromStream, type Rand } from "../prng";
import { NO_HOOKS, type SceneHooks, type SkyLight } from "../sky-events";

type HSL = [number, number, number];
type Season = "spring" | "summer" | "autumn" | "winter";

interface GardenPalette {
  name: string;
  light: SkyLight;
  sky: [HSL, HSL, HSL]; // vrh → sredina → horizont
  body: "sun" | "moon";
  bodyCol: HSL;
  /** Ravan crveni disk bez sjaja (ukiyo-e) */
  flatSun?: boolean;
  sunHigh: [number, number]; // visina sunca kao udeo horizonta (min, max)
  stars: boolean;
  mountain: HSL;
  hills: HSL;
  water: HSL;
  mist: HSL;
  mistAlpha: number;
  /** Boja svetla kojom se „boje" godišnja doba (zelenilo, cvet, tlo) */
  tint: RGB;
  tintAmt: number;
  dim: number; // zatamnjenje prednjeg plana 0–1
  lanterns: boolean;
}

const PALETTES: readonly GardenPalette[] = [
  {
    name: "dawn-pink",
    light: "dusk",
    sky: [[225, 0.35, 0.55], [340, 0.45, 0.8], [30, 0.75, 0.84]],
    body: "sun",
    bodyCol: [30, 1, 0.8],
    sunHigh: [0.7, 0.9],
    stars: false,
    mountain: [250, 0.25, 0.55],
    hills: [270, 0.18, 0.5],
    water: [240, 0.3, 0.35],
    mist: [20, 0.6, 0.92],
    mistAlpha: 0.75,
    tint: [255, 200, 190],
    tintAmt: 0.15,
    dim: 0.05,
    lanterns: false,
  },
  {
    name: "day",
    light: "day",
    sky: [[210, 0.6, 0.5], [200, 0.5, 0.7], [190, 0.35, 0.86]],
    body: "sun",
    bodyCol: [50, 1, 0.94],
    sunHigh: [0.2, 0.45],
    stars: false,
    mountain: [215, 0.35, 0.45],
    hills: [180, 0.2, 0.42],
    water: [195, 0.45, 0.3],
    mist: [45, 0.3, 0.95],
    mistAlpha: 0.6,
    tint: [255, 255, 255],
    tintAmt: 0,
    dim: 0,
    lanterns: false,
  },
  {
    name: "ukiyo-blue",
    light: "day",
    sky: [[218, 0.75, 0.3], [205, 0.45, 0.68], [40, 0.5, 0.9]],
    body: "sun",
    bodyCol: [8, 0.8, 0.55],
    flatSun: true,
    sunHigh: [0.25, 0.5],
    stars: false,
    mountain: [222, 0.55, 0.35],
    hills: [190, 0.25, 0.4],
    water: [210, 0.55, 0.3],
    mist: [40, 0.45, 0.9],
    mistAlpha: 0.85,
    tint: [250, 240, 215],
    tintAmt: 0.1,
    dim: 0,
    lanterns: false,
  },
  {
    name: "red-dusk",
    light: "dusk",
    sky: [[260, 0.4, 0.3], [15, 0.6, 0.6], [38, 0.85, 0.72]],
    body: "sun",
    bodyCol: [5, 0.85, 0.52],
    flatSun: true,
    sunHigh: [0.55, 0.85],
    stars: false,
    mountain: [275, 0.3, 0.3],
    hills: [300, 0.25, 0.27],
    water: [270, 0.35, 0.2],
    mist: [30, 0.7, 0.75],
    mistAlpha: 0.55,
    tint: [255, 150, 100],
    tintAmt: 0.25,
    dim: 0.25,
    lanterns: true,
  },
  {
    name: "morning-mist",
    light: "day",
    sky: [[200, 0.2, 0.75], [190, 0.15, 0.85], [45, 0.3, 0.92]],
    body: "sun",
    bodyCol: [45, 0.7, 0.92],
    sunHigh: [0.35, 0.6],
    stars: false,
    mountain: [210, 0.15, 0.68],
    hills: [180, 0.12, 0.62],
    water: [190, 0.2, 0.5],
    mist: [45, 0.25, 0.97],
    mistAlpha: 0.9,
    tint: [235, 240, 245],
    tintAmt: 0.2,
    dim: 0,
    lanterns: false,
  },
  {
    name: "lantern-night",
    light: "night",
    sky: [[235, 0.55, 0.07], [228, 0.45, 0.15], [215, 0.35, 0.27]],
    body: "moon",
    bodyCol: [48, 0.5, 0.9],
    sunHigh: [0.2, 0.45],
    stars: true,
    mountain: [228, 0.3, 0.2],
    hills: [225, 0.3, 0.13],
    water: [230, 0.5, 0.08],
    mist: [220, 0.25, 0.45],
    mistAlpha: 0.35,
    tint: [70, 90, 150],
    tintAmt: 0.4,
    dim: 0.28,
    lanterns: true,
  },
];

interface SeasonColors {
  bloom: [HSL, HSL, HSL]; // senka, osnova, svetlo (cvet / lišće krošnje)
  pine: HSL;
  ground: HSL;
  bush: HSL;
  snow: boolean;
}

const SEASONS: Record<Season, SeasonColors> = {
  spring: { bloom: [[335, 0.45, 0.72], [345, 0.7, 0.84], [350, 0.8, 0.93]], pine: [150, 0.35, 0.22], ground: [95, 0.35, 0.42], bush: [325, 0.55, 0.6], snow: false },
  summer: { bloom: [[120, 0.4, 0.22], [105, 0.45, 0.34], [90, 0.5, 0.48]], pine: [150, 0.4, 0.2], ground: [100, 0.45, 0.33], bush: [270, 0.4, 0.55], snow: false },
  autumn: { bloom: [[355, 0.7, 0.35], [10, 0.8, 0.5], [32, 0.9, 0.58]], pine: [140, 0.3, 0.2], ground: [38, 0.4, 0.36], bush: [20, 0.75, 0.45], snow: false },
  winter: { bloom: [[215, 0.15, 0.78], [210, 0.1, 0.9], [0, 0, 0.98]], pine: [160, 0.25, 0.2], ground: [212, 0.2, 0.9], bush: [212, 0.15, 0.82], snow: true },
};

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

type Pt = { x: number; y: number };

/** Grane drveta (rekurzivno), unapred izračunate. */
interface Branch {
  x0: number;
  y0: number;
  cx: number;
  cy: number;
  x1: number;
  y1: number;
  w: number;
}

interface Tree {
  kind: "bloom" | "pine";
  branches: Branch[];
  /** Grozdovi krošnje: x, y, r */
  clusters: [number, number, number][];
  /** Jastučići bora: x, y, rx, ry */
  pads: [number, number, number, number][];
  blobs: [number, number, number, number][]; // za bloom: x, y, r, ton (0–1)
}

function growBloomTree(rand: Rand, x: number, baseY: number, size: number, lean: number): Tree {
  const branches: Branch[] = [];
  // Stablo u 2 krivudava segmenta do tačke krošnje
  const ang = -Math.PI / 2 + lean;
  const mx = x + Math.cos(ang) * size * 0.25 + (rand() - 0.5) * size * 0.06;
  const my = baseY + Math.sin(ang) * size * 0.25;
  branches.push({ x0: x, y0: baseY, cx: (x + mx) / 2 + (rand() - 0.5) * size * 0.08, cy: (baseY + my) / 2, x1: mx, y1: my, w: size * 0.055 });
  const a2 = ang + (rand() - 0.5) * 0.5;
  const cx = mx + Math.cos(a2) * size * 0.2;
  const cy = my + Math.sin(a2) * size * 0.2;
  branches.push({ x0: mx, y0: my, cx: (mx + cx) / 2 + (rand() - 0.5) * size * 0.06, cy: (my + cy) / 2, x1: cx, y1: cy, w: size * 0.04 });
  // Krošnja: mase u nepravilnoj elipsi iznad i oko vrha stabla
  const ecx = cx + Math.cos(ang) * size * 0.08;
  const ecy = cy - size * 0.1;
  const erx = size * (0.22 + 0.08 * rand());
  const ery = size * (0.13 + 0.05 * rand());
  const K = 5 + Math.floor(rand() * 4);
  const clusters: [number, number, number][] = [];
  const blobs: [number, number, number, number][] = [];
  for (let k = 0; k < K; k++) {
    const a = (k / K) * Math.PI * 2 + rand() * 0.8;
    const d = k === 0 ? 0 : 0.45 + 0.5 * rand();
    const px = ecx + Math.cos(a) * erx * d;
    const py = ecy + Math.sin(a) * ery * d;
    const R = size * (0.08 + 0.04 * rand());
    clusters.push([px, py, R]);
    // grana do mase
    const sx = cx + (rand() - 0.5) * size * 0.04;
    branches.push({ x0: sx, y0: cy, cx: (sx + px) / 2, cy: Math.max(cy, py) + size * 0.02, x1: px, y1: py + R * 0.3, w: size * 0.016 });
    const n = 12 + Math.floor(rand() * 6);
    for (let i = 0; i < n; i++) {
      const ba = rand() * Math.PI * 2;
      const bd = Math.sqrt(rand()) * R * 0.85;
      blobs.push([px + Math.cos(ba) * bd, py + Math.sin(ba) * bd * 0.7, R * (0.28 + 0.22 * rand()), rand()]);
    }
  }
  return { kind: "bloom", branches, clusters, pads: [], blobs };
}

function growPine(rand: Rand, x: number, baseY: number, size: number, lean: number): Tree {
  const branches: Branch[] = [];
  const pads: [number, number, number, number][] = [];
  // Krivudavo stablo u 3 segmenta
  let px = x;
  let py = baseY;
  let ang = -Math.PI / 2 + lean;
  const segs = 3;
  const pts: Pt[] = [{ x: px, y: py }];
  for (let i = 0; i < segs; i++) {
    const len = size * (0.32 - i * 0.05);
    ang += (rand() - 0.5) * 0.7;
    const nx = px + Math.cos(ang) * len;
    const ny = py + Math.sin(ang) * len;
    branches.push({ x0: px, y0: py, cx: (px + nx) / 2 + (rand() - 0.5) * len * 0.3, cy: (py + ny) / 2, x1: nx, y1: ny, w: size * (0.055 - i * 0.012) });
    px = nx;
    py = ny;
    pts.push({ x: px, y: py });
  }
  pads.push([px, py, size * (0.12 + 0.04 * rand()), size * (0.05 + 0.015 * rand())]);
  // Bočne grane sa jastučićima (niwaki)
  const nb = 3 + Math.floor(rand() * 3);
  for (let i = 0; i < nb; i++) {
    const p = pts[1 + Math.floor(rand() * (pts.length - 1))]!;
    const t = rand();
    const sx = p.x + (pts[0]!.x - p.x) * t * 0.3;
    const sy = p.y + (baseY - p.y) * t * 0.4;
    const dir = i % 2 ? 1 : -1;
    const len = size * (0.2 + 0.2 * rand());
    const ex = sx + dir * len;
    const ey = sy - len * (0.05 + 0.25 * rand());
    branches.push({ x0: sx, y0: sy, cx: (sx + ex) / 2, cy: sy + len * 0.08, x1: ex, y1: ey, w: size * 0.018 });
    pads.push([ex, ey, size * (0.08 + 0.05 * rand()), size * (0.035 + 0.015 * rand())]);
  }
  return { kind: "pine", branches, clusters: [], pads, blobs: [] };
}

export function renderJapaneseGarden(
  ctx: CanvasRenderingContext2D,
  stream: QRNGStream,
  w: number,
  h: number,
  hooks: SceneHooks = NO_HOOKS
): void {
  const s = w / 1200;

  // ---- Odluke (QRNG) ----
  const pal = PALETTES[stream.next_int(0, PALETTES.length - 1)]!;
  const seasonRoll = stream.next_f();
  const season: Season = seasonRoll < 0.32 ? "spring" : seasonRoll < 0.5 ? "summer" : seasonRoll < 0.75 ? "autumn" : "winter";
  const dh = stream.next_int(-5, 5);
  const hillY = Math.floor(h * (0.44 + 0.07 * stream.next_f()));
  const sunX = w * (0.12 + 0.76 * stream.next_f());
  const sunY = hillY * (pal.sunHigh[0] + (pal.sunHigh[1] - pal.sunHigh[0]) * stream.next_f());
  const sunR = (pal.flatSun ? 34 + 26 * stream.next_f() : pal.body === "moon" ? 16 + 10 * stream.next_f() : 20 + 16 * stream.next_f()) * s;
  const hasVolcano = stream.next_f() < 0.6;
  const hasPagoda = stream.next_f() < 0.5;
  const toriiRoll = stream.next_f();
  const hasBridge = stream.next_f() < 0.5;
  const hasLantern = stream.next_f() < 0.65;
  const hasKoi = stream.next_f() < 0.6;
  const bigTreeRoll = stream.next_f();
  const frameRoll = stream.next_f();
  const rand = prngFromStream(stream);

  const sea = SEASONS[season];
  const night = pal.light === "night";
  const shade = (c: RGB, extraDim = 0) => mix(mix(c, pal.tint, pal.tintAmt), [8, 10, 22], Math.min(0.9, pal.dim + extraDim));
  const sky = pal.sky.map((c) => hsl(c, dh));
  const skyTop = sky[0]!;
  const skyHorizon = sky[2]!;
  const bodyCol = hsl(pal.bodyCol);
  const bodyCore = mix(bodyCol, [255, 252, 240], pal.flatSun ? 0.05 : 0.6);
  const mountainCol = hsl(pal.mountain, dh);
  const hillsCol = hsl(pal.hills, dh);
  const water = hsl(pal.water, dh);
  const mistCol = hsl(pal.mist);
  const bloom = sea.bloom.map((c) => shade(hsl(c)));
  const pineCol = shade(hsl(sea.pine));
  const groundCol = shade(hsl(sea.ground));
  const bushCol = shade(hsl(sea.bush));
  const barkCol = shade([58, 42, 36]);
  const vermilion = shade([205, 55, 40]);
  const snowCol = shade([245, 247, 252], -0.1);
  const lightDir = sunX > w / 2 ? 1 : -1;
  const shoreY = hillY + Math.floor(h * (0.035 + 0.035 * rand()));
  const nearY = h * (0.8 + 0.07 * rand());

  // ---- Geometrija ----
  const stars: [number, number, number][] = [];
  if (pal.stars) {
    const n = 120 + Math.floor(rand() * 120);
    for (let i = 0; i < n; i++) stars.push([rand() * w, Math.pow(rand(), 1.4) * hillY * 0.85, 0.3 + 0.6 * rand()]);
  }
  // Kasumi trake (ravne trake sa zaobljenim krajevima)
  const bands: [number, number, number, number][] = [];
  {
    const n = 3 + Math.floor(rand() * 4);
    for (let i = 0; i < n; i++) {
      const y = hillY * (0.15 + 0.85 * rand());
      bands.push([rand() * w * 1.2 - w * 0.1, y, w * (0.25 + 0.4 * rand()), (6 + 12 * rand()) * s]);
    }
    // jedna traka uvek preko podnožja planina
    bands.push([w * (0.1 + 0.3 * rand()), hillY - (8 + 14 * rand()) * s, w * (0.5 + 0.4 * rand()), (10 + 10 * rand()) * s]);
  }
  // Vulkan
  const vx = w * (0.25 + 0.5 * rand());
  const vH = hillY * (0.45 + 0.2 * rand());
  const vW = vH * (1.7 + 0.5 * rand());
  const snowLine = 0.32 + 0.15 * rand() + (season === "winter" ? 0.25 : season === "summer" ? -0.12 : 0);
  const snowTeeth: number[] = Array.from({ length: 13 }, () => rand());
  // Brda (2 sloja) sa borovima na grebenu
  const hillLayers = [0, 1].map((k) => {
    const amp = hillY * (0.07 + 0.05 * rand()) * (1 + k * 0.4);
    const base = hillY + k * (shoreY - hillY) * 0.5;
    const f1 = (1 + rand() * 2) / w;
    const f2 = (3 + rand() * 4) / w;
    const p1 = rand() * 6.28;
    const p2 = rand() * 6.28;
    const pts: Pt[] = [];
    for (let x = -10; x <= w + 10; x += 6 * s) {
      const y = base - amp * (0.6 + 0.4 * Math.sin(x * f1 * 6.28 + p1) + 0.25 * Math.sin(x * f2 * 6.28 + p2));
      pts.push({ x, y });
    }
    const pines: [number, number, number][] = [];
    for (let i = 0; i < pts.length; i += 2) if (rand() < 0.55) pines.push([pts[i]!.x, pts[i]!.y + 2 * s, (5 + rand() * 8) * s * (1 + k * 0.5)]);
    return { pts, pines, base };
  });
  // Daleka obala: žbunje i par drveća
  const shoreBushes: [number, number, number, number][] = [];
  for (let x = -10 * s; x < w + 10 * s; x += (8 + rand() * 14) * s) shoreBushes.push([x, shoreY, (6 + rand() * 10) * s, rand()]);
  const farTrees: Tree[] = [];
  {
    const n = 2 + Math.floor(rand() * 3);
    for (let i = 0; i < n; i++) {
      const x = rand() * w;
      const sz = (60 + rand() * 50) * s;
      farTrees.push(rand() < 0.5 ? growBloomTree(rand, x, shoreY, sz, (rand() - 0.5) * 0.3) : growPine(rand, x, shoreY, sz * 0.9, (rand() - 0.5) * 0.4));
    }
  }
  const pagodaX = w * (rand() < 0.5 ? 0.12 + 0.25 * rand() : 0.63 + 0.25 * rand());
  const pagodaTiers = rand() < 0.5 ? 3 : 5;
  const pagodaH = (shoreY - hillY + hillY * 0.32) * (0.85 + 0.25 * rand());

  // ---- Gornja polovina (normalno + odraz) ----
  const drawUpper = (mirror: boolean) => {
    const g = ctx.createLinearGradient(0, 0, 0, shoreY);
    g.addColorStop(0, rgbString(skyTop));
    g.addColorStop(0.5, rgbString(sky[1]!));
    g.addColorStop(1, rgbString(skyHorizon));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, shoreY + 2);
    for (const [x, y, a] of stars) {
      ctx.fillStyle = `rgba(255,255,255,${(a * (mirror ? 0.5 : 1)).toFixed(3)})`;
      ctx.fillRect(x, y, Math.max(1, 1.4 * s), Math.max(1, 1.4 * s));
    }
    if (!mirror) hooks.sky({ horizonY: shoreY, light: pal.light });
    // Sunce / mesec
    if (!pal.flatSun) {
      const glowR = sunR * (pal.body === "moon" ? 6 : 8);
      const glow = ctx.createRadialGradient(sunX, sunY, sunR * 0.6, sunX, sunY, glowR);
      glow.addColorStop(0, rgba(bodyCol, pal.body === "moon" ? 0.25 : 0.45));
      glow.addColorStop(0.3, rgba(bodyCol, pal.body === "moon" ? 0.07 : 0.15));
      glow.addColorStop(1, rgba(bodyCol, 0));
      ctx.fillStyle = glow;
      ctx.fillRect(sunX - glowR, sunY - glowR, glowR * 2, glowR * 2);
    }
    ctx.fillStyle = rgbString(pal.flatSun ? bodyCol : bodyCore);
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
    ctx.fill();
    if (!mirror) hooks.body({ x: sunX, y: sunY, r: sunR, kind: pal.body });
    // Gornje kasumi trake (iza planine)
    for (let i = 0; i < bands.length - 1; i += 2) drawKasumi(ctx, bands[i]!, mistCol, pal.mistAlpha * 0.8);
    // Vulkan
    if (hasVolcano) drawVolcano(ctx, vx, hillY, vW, vH, snowLine, snowTeeth, mix(mountainCol, skyHorizon, 0.15), mix(snowCol, skyHorizon, night ? 0.4 : 0.1), lightDir);
    // Ostale trake (ispred planine)
    for (let i = 1; i < bands.length; i += 2) drawKasumi(ctx, bands[i]!, mistCol, pal.mistAlpha);
    if (bands.length % 2 === 1) drawKasumi(ctx, bands[bands.length - 1]!, mistCol, pal.mistAlpha);
    // Brda
    hillLayers.forEach((L, k) => {
      const col = mix(hillsCol, skyHorizon, k === 0 ? 0.35 : 0.1);
      ctx.fillStyle = rgbString(col);
      ctx.beginPath();
      ctx.moveTo(-10, shoreY + 2);
      for (const p of L.pts) ctx.lineTo(p.x, p.y);
      ctx.lineTo(w + 10, shoreY + 2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = rgbString(mix(col, [0, 0, 0], 0.12));
      ctx.beginPath();
      for (const [x, y, r] of L.pines) {
        ctx.moveTo(x - r * 0.5, y);
        ctx.lineTo(x, y - r * 1.6);
        ctx.lineTo(x + r * 0.5, y);
      }
      ctx.fill();
    });
    // Pagoda (iza žbunja daleke obale)
    if (hasPagoda) drawPagoda(ctx, pagodaX, shoreY + 2 * s, pagodaH, pagodaTiers, shade([150, 45, 35]), shade([45, 55, 60]), sea.snow ? snowCol : null, pal.lanterns, s);
    // Daleko drveće
    for (const t of farTrees) drawTree(ctx, t, barkCol, bloom, pineCol, sea.snow ? snowCol : null, lightDir, s);
    // Žbunje uz obalu
    for (const [x, y, r, v] of shoreBushes) {
      ctx.fillStyle = rgbString(mix(mix(pineCol, groundCol, 0.3), v < 0.25 ? bushCol : pineCol, 0.4 + 0.3 * v));
      ctx.beginPath();
      ctx.ellipse(x, y, r * 1.4, r, 0, Math.PI, 0);
      ctx.fill();
    }
    ctx.fillStyle = rgbString(mix(groundCol, [0, 0, 0], 0.25));
    ctx.fillRect(0, shoreY - 1 * s, w, 3 * s);
  };

  drawUpper(false);

  // Odraz
  ctx.fillStyle = rgbString(skyTop);
  ctx.fillRect(0, shoreY, w, h - shoreY);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, shoreY, w, h - shoreY);
  ctx.clip();
  ctx.translate(0, 2 * shoreY);
  ctx.scale(1, -1);
  drawUpper(true);
  ctx.restore();

  // Boja vode
  const wg = ctx.createLinearGradient(0, shoreY, 0, h);
  wg.addColorStop(0, rgba(water, 0.35));
  wg.addColorStop(1, rgba(water, 0.75));
  ctx.fillStyle = wg;
  ctx.fillRect(0, shoreY, w, h - shoreY);

  // Lokvanji (leto) i koi
  if (season === "summer" || (season === "spring" && rand() < 0.3)) {
    const n = 8 + Math.floor(rand() * 14);
    for (let i = 0; i < n; i++) {
      const t = rand();
      const y = shoreY + (nearY - shoreY) * (0.2 + 0.75 * t);
      drawLilyPad(ctx, rand, rand() * w, y, (6 + rand() * 10) * s * (0.5 + t), shade([70, 130, 60]), shade([240, 160, 190]), season === "summer" && rand() < 0.3);
    }
  }
  if (hasKoi && season !== "winter") {
    const n = 3 + Math.floor(rand() * 5);
    const kx = w * (0.2 + 0.6 * rand());
    const ky = shoreY + (nearY - shoreY) * (0.45 + 0.35 * rand());
    for (let i = 0; i < n; i++) {
      const t = (ky - shoreY) / (nearY - shoreY);
      drawKoi(ctx, rand, kx + (rand() - 0.5) * 260 * s, ky + (rand() - 0.5) * 50 * s, (24 + 12 * rand()) * s * (0.6 + t), rand() * Math.PI * 2, water, night);
    }
  }

  // Talasići
  {
    const lightLine = mix(skyHorizon, [255, 255, 255], 0.3);
    let y = shoreY + 3 * s;
    let gap = 3 * s;
    while (y < h) {
      const t = (y - shoreY) / (h - shoreY);
      const segs = 1 + Math.floor(rand() * 3);
      for (let k = 0; k < segs; k++) {
        const len = (20 + rand() * 90) * s * (0.6 + t * 1.4);
        ctx.fillStyle = rand() < 0.55 ? rgba(lightLine, 0.06 + 0.1 * rand()) : rgba(water, 0.15 + 0.12 * rand());
        ctx.fillRect(rand() * w - len / 2, y, len, Math.max(1, (0.8 + t) * s));
      }
      y += gap;
      gap *= 1.09;
    }
  }
  // Odsjaj sunca/meseca
  {
    const mirrorY = 2 * shoreY - sunY;
    const n = 70 + Math.floor(rand() * 70);
    for (let i = 0; i < n; i++) {
      const t = rand();
      const gy = shoreY + 2 + t * Math.min(nearY - shoreY, (mirrorY - shoreY) * 1.4 + 30 * s);
      const off = (rand() + rand() - 1) * sunR * (0.8 + t * 1.8);
      const len = (5 + rand() * 18) * s;
      ctx.fillStyle = rgba(pal.flatSun ? mix(bodyCol, [255, 220, 200], 0.4) : bodyCore, 0.4 * (1 - t * 0.6) * rand());
      ctx.fillRect(sunX + off - len / 2, gy, len, Math.max(1, 1.2 * s));
    }
  }

  // Položaj mosta se bira pre toriija, da se ne preklope
  const bY = shoreY + (nearY - shoreY) * (0.35 + 0.2 * rand());
  const bW = w * (0.22 + 0.12 * rand()) * (0.8 + ((bY - shoreY) / (nearY - shoreY)) * 0.5);
  const bx = w * (0.25 + 0.5 * rand());

  // Torii u vodi (bliže dalekoj obali; nikad iza mosta)
  if (toriiRoll < 0.45) {
    const tY = shoreY + (nearY - shoreY) * (hasBridge ? 0.12 : 0.15 + 0.2 * rand());
    const tH = (70 + rand() * 50) * s * (1 + (tY - shoreY) / (nearY - shoreY));
    let tx = hasPagoda ? w - pagodaX + (rand() - 0.5) * 100 * s : w * (0.25 + 0.5 * rand());
    if (hasBridge && Math.abs(tx - bx) < bW * 0.75 + tH * 0.6) tx = bx < w / 2 ? Math.min(w - tH * 0.7, bx + bW * 0.75 + tH * 0.7) : Math.max(tH * 0.7, bx - bW * 0.75 - tH * 0.7);
    withReflection(ctx, tY, w, h, 0.35, () => drawTorii(ctx, tx, tY, tH, vermilion, shade([30, 28, 30]), sea.snow ? snowCol : null));
  }

  // Lučni most
  if (hasBridge) {
    // Obale na krajevima mosta
    withReflection(ctx, bY, w, h, 0.3, () => {
      for (const side of [-1, 1]) {
        const mx = bx + side * bW * 0.55;
        ctx.fillStyle = rgbString(mix(groundCol, pineCol, 0.35));
        ctx.beginPath();
        ctx.ellipse(mx, bY, bW * 0.22, bW * 0.05, 0, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = rgbString(bushCol);
        ctx.beginPath();
        ctx.ellipse(mx + side * bW * 0.08, bY - bW * 0.03, bW * 0.07, bW * 0.045, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      drawBridge(ctx, bx, bY, bW, bW * (0.16 + 0.06 * rand()), vermilion, sea.snow ? snowCol : null, s);
    });
  }

  // Bliža obala
  const edge: Pt[] = [];
  {
    const amp = (h - nearY) * 0.18;
    const f = (0.8 + rand() * 1.4) / w;
    const ph = rand() * 6.28;
    for (let x = -10; x <= w + 10; x += 8 * s) edge.push({ x, y: nearY + amp * Math.sin(x * f * 6.28 + ph) + (rand() - 0.5) * 3 * s });
  }
  ctx.beginPath();
  ctx.moveTo(-10, h + 2);
  for (const p of edge) ctx.lineTo(p.x, p.y);
  ctx.lineTo(w + 10, h + 2);
  ctx.closePath();
  const gg = ctx.createLinearGradient(0, nearY - 20 * s, 0, h);
  gg.addColorStop(0, rgbString(mix(groundCol, [255, 255, 255], sea.snow ? 0 : 0.08)));
  gg.addColorStop(1, rgbString(mix(groundCol, [0, 0, 0], 0.22)));
  ctx.fillStyle = gg;
  ctx.fill();
  // Kamenje duž ivice
  {
    const stoneCol = shade([120, 118, 112]);
    const n = 8 + Math.floor(rand() * 10);
    const stones: [number, number, number][] = [];
    for (let i = 0; i < n; i++) {
      const p = edge[Math.floor(rand() * edge.length)]!;
      stones.push([p.x, p.y + (rand() * 10 - 2) * s, (8 + rand() * 18) * s]);
    }
    stones.sort((a, b) => a[1] - b[1]);
    for (const [x, y, r] of stones) {
      ctx.fillStyle = rgbString(mix(stoneCol, [0, 0, 0], 0.25));
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = rgbString(stoneCol);
      ctx.beginPath();
      ctx.ellipse(x + lightDir * r * 0.15, y - r * 0.12, r * 0.8, r * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
      if (sea.snow) {
        ctx.fillStyle = rgbString(snowCol);
        ctx.beginPath();
        ctx.ellipse(x, y - r * 0.32, r * 0.75, r * 0.22, 0, Math.PI, 0);
        ctx.fill();
      }
    }
  }
  // Žbunje azaleje/hortenzije na obali
  if (!sea.snow || rand() < 0.5) {
    const n = 2 + Math.floor(rand() * 4);
    for (let i = 0; i < n; i++) {
      const p = edge[Math.floor(rand() * edge.length)]!;
      const r = (16 + rand() * 22) * s;
      for (let k = 0; k < 7; k++) {
        ctx.fillStyle = rgbString(mix(bushCol, k < 3 ? [0, 0, 0] : [255, 255, 255], k < 3 ? 0.2 : 0.12 * (k - 3)));
        ctx.beginPath();
        ctx.arc(p.x + (rand() - 0.5) * r * 1.6, p.y + 6 * s - rand() * r * 0.7, r * (0.4 + 0.3 * rand()), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Kameni fenjer
  let lanternPos: Pt | null = null;
  if (hasLantern) {
    const p = edge[Math.floor(edge.length * (lightDir > 0 ? 0.1 + 0.3 * rand() : 0.6 + 0.3 * rand()))]!;
    lanternPos = { x: p.x, y: p.y + (h - p.y) * (0.3 + 0.3 * rand()) };
    drawStoneLantern(ctx, lanternPos.x, lanternPos.y, (90 + rand() * 40) * s, shade([150, 146, 138]), pal.lanterns, sea.snow ? snowCol : null, lightDir);
  }

  // Veliko drvo sa strane
  if (bigTreeRoll < 0.65) {
    const side = lanternPos ? (lanternPos.x < w / 2 ? 1 : -1) : rand() < 0.5 ? -1 : 1;
    const x = side < 0 ? w * (0.02 + 0.1 * rand()) : w * (0.88 + 0.1 * rand());
    const size = h * (0.65 + 0.25 * rand());
    const pine = season === "winter" ? rand() < 0.7 : season === "summer" ? rand() < 0.5 : rand() < 0.2;
    const tree = pine ? growPine(rand, x, h + 5 * s, size, -side * (0.2 + 0.3 * rand())) : growBloomTree(rand, x, h + 5 * s, size, -side * (0.15 + 0.25 * rand()));
    drawTree(ctx, tree, barkCol, bloom, pineCol, sea.snow ? snowCol : null, lightDir, s);
  }

  // Grana koja uokviruje kadar (gornji ugao)
  if (frameRoll < 0.5) {
    const left = rand() < 0.5;
    drawFrameBranch(ctx, rand, w, h, s, left, season, barkCol, bloom, snowCol);
  }

  // Magla preko vode pri obali
  {
    const mh = (10 + 16 * rand()) * s;
    const mg = ctx.createLinearGradient(0, shoreY - mh, 0, shoreY + mh);
    mg.addColorStop(0, rgba(mistCol, 0));
    mg.addColorStop(0.5, rgba(mistCol, 0.35 * pal.mistAlpha));
    mg.addColorStop(1, rgba(mistCol, 0));
    ctx.fillStyle = mg;
    ctx.fillRect(0, shoreY - mh, w, mh * 2);
  }

  // Čestice: latice / lišće / sneg / svici
  if (season === "spring") {
    const n = 90 + Math.floor(rand() * 140);
    for (let i = 0; i < n; i++) {
      const z = rand();
      ctx.fillStyle = rgba(mix(bloom[2]!, bloom[1]!, rand()), 0.55 + 0.4 * z);
      ctx.beginPath();
      ctx.ellipse(rand() * w, rand() * h, (1.5 + 3 * z) * s, (0.8 + 1.5 * z) * s, rand() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (season === "autumn") {
    const n = 30 + Math.floor(rand() * 60);
    for (let i = 0; i < n; i++) {
      const z = rand();
      drawMapleLeaf(ctx, rand() * w, rand() * h, (3 + 5 * z) * s, rand() * Math.PI * 2, bloom[1 + Math.floor(rand() * 2)]!);
    }
  } else if (season === "winter") {
    const n = 200 + Math.floor(rand() * 300);
    for (let i = 0; i < n; i++) {
      const z = rand();
      ctx.fillStyle = rgba([255, 255, 255], 0.4 + 0.5 * z);
      ctx.beginPath();
      ctx.arc(rand() * w, rand() * h, (0.7 + 2 * z) * s, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (night || pal.light === "dusk") {
    const n = 15 + Math.floor(rand() * 25);
    for (let i = 0; i < n; i++) {
      const x = rand() * w;
      const y = shoreY - 30 * s + rand() * (h - shoreY);
      const r = (6 + rand() * 8) * s;
      const gl = ctx.createRadialGradient(x, y, 0, x, y, r);
      gl.addColorStop(0, "rgba(230,255,140,0.85)");
      gl.addColorStop(1, "rgba(230,255,140,0)");
      ctx.fillStyle = gl;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }
}

// ---------------------------------------------------------------------------
// Crtanje

/** Crta fn() normalno, pa preslikano preko baseY (odraz u vodi) sa datom providnošću. */
function withReflection(ctx: CanvasRenderingContext2D, baseY: number, w: number, h: number, alpha: number, fn: () => void): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, baseY, w, h - baseY);
  ctx.clip();
  ctx.globalAlpha = alpha;
  ctx.translate(0, 2 * baseY);
  ctx.scale(1, -1);
  fn();
  ctx.restore();
  fn();
}

function drawKasumi(ctx: CanvasRenderingContext2D, b: [number, number, number, number], col: RGB, alpha: number): void {
  const [x, y, len, th] = b;
  const g = ctx.createLinearGradient(0, y - th, 0, y + th);
  g.addColorStop(0, rgba(col, alpha));
  g.addColorStop(1, rgba(col, alpha * 0.55));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x + th, y - th);
  ctx.lineTo(x + len - th, y - th);
  ctx.arc(x + len - th, y, th, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(x + th, y + th);
  ctx.arc(x + th, y, th, Math.PI / 2, (3 * Math.PI) / 2);
  ctx.closePath();
  ctx.fill();
}

function drawVolcano(ctx: CanvasRenderingContext2D, x: number, baseY: number, W: number, H: number, snowLine: number, teeth: number[], col: RGB, snow: RGB, lightDir: number): void {
  const top = baseY - H;
  const crater = W * 0.05;
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(x - W / 2, baseY + 2);
    ctx.quadraticCurveTo(x - W * 0.2, baseY - H * 0.25, x - crater, top);
    ctx.lineTo(x - crater * 0.3, top + H * 0.012);
    ctx.lineTo(x + crater * 0.4, top - H * 0.005);
    ctx.lineTo(x + crater, top);
    ctx.quadraticCurveTo(x + W * 0.2, baseY - H * 0.25, x + W / 2, baseY + 2);
    ctx.closePath();
  };
  const g = ctx.createLinearGradient(x - W / 2, 0, x + W / 2, 0);
  const lit = mix(col, [255, 255, 255], 0.08);
  const dark = mix(col, [0, 0, 0], 0.18);
  g.addColorStop(0, rgbString(lightDir < 0 ? lit : dark));
  g.addColorStop(1, rgbString(lightDir < 0 ? dark : lit));
  path();
  ctx.fillStyle = g;
  ctx.fill();
  // Snežna kapa sa nazubljenom donjom ivicom
  ctx.save();
  path();
  ctx.clip();
  const sy = top + H * snowLine;
  ctx.fillStyle = rgbString(snow);
  ctx.beginPath();
  ctx.moveTo(x - W / 2, top - 5);
  ctx.lineTo(x + W / 2, top - 5);
  const n = teeth.length;
  for (let i = n - 1; i >= 0; i--) {
    const u = i / (n - 1);
    const tx = x - W * 0.32 + W * 0.64 * u;
    const depth = (teeth[i]! - 0.3) * H * 0.18 * (1 - Math.abs(u - 0.5));
    ctx.lineTo(tx, sy + depth + (i % 2 ? H * 0.06 : -H * 0.02));
  }
  ctx.closePath();
  ctx.fill();
  // senka na snegu (strana dalje od svetla)
  const sg = ctx.createLinearGradient(x, 0, x - lightDir * W * 0.3, 0);
  sg.addColorStop(0, rgba(mix(snow, col, 0.5), 0));
  sg.addColorStop(1, rgba(mix(snow, col, 0.5), 0.5));
  ctx.fillStyle = sg;
  ctx.fillRect(x - W / 2, top - 5, W, H * snowLine + H * 0.2);
  ctx.restore();
}

function drawTree(ctx: CanvasRenderingContext2D, t: Tree, bark: RGB, bloom: RGB[], pine: RGB, snow: RGB | null, lightDir: number, s: number): void {
  ctx.lineCap = "round";
  for (const b of t.branches) {
    ctx.strokeStyle = rgbString(bark);
    ctx.lineWidth = Math.max(1, b.w);
    ctx.beginPath();
    ctx.moveTo(b.x0, b.y0);
    ctx.quadraticCurveTo(b.cx, b.cy, b.x1, b.y1);
    ctx.stroke();
  }
  if (t.kind === "bloom") {
    // 1) senka grozdova, 2) osnova, 3) svetla strana
    for (const [x, y, r] of t.clusters) {
      ctx.fillStyle = rgbString(bloom[0]!);
      ctx.beginPath();
      ctx.arc(x - lightDir * r * 0.15, y + r * 0.15, r, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const [x, y, r, v] of t.blobs) {
      ctx.fillStyle = rgbString(mix(bloom[1]!, bloom[0]!, v * 0.4));
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const [x, y, r, v] of t.blobs) {
      if (v < 0.55) continue;
      ctx.fillStyle = rgbString(bloom[2]!);
      ctx.beginPath();
      ctx.arc(x + lightDir * r * 0.3, y - r * 0.3, r * 0.55, 0, Math.PI * 2);
      ctx.fill();
    }
    if (snow) {
      for (const [x, y, r] of t.clusters) {
        ctx.fillStyle = rgbString(snow);
        ctx.beginPath();
        ctx.ellipse(x, y - r * 0.5, r * 0.8, r * 0.35, 0, Math.PI, 0);
        ctx.fill();
      }
    }
  } else {
    for (const [x, y, rx, ry] of t.pads) {
      // jastučić = 5 preklopljenih „oblačića"
      const sub: [number, number, number][] = [];
      for (let k = 0; k < 5; k++) {
        const u = k / 4 - 0.5;
        sub.push([x + u * rx * 1.5, y + Math.abs(u) * ry * 0.5, (1 - Math.abs(u) * 0.8) * ry * 1.05 + ry * 0.25]);
      }
      ctx.fillStyle = rgbString(mix(pine, [0, 0, 0], 0.25));
      ctx.beginPath();
      for (const [sx, sy, r] of sub) {
        ctx.moveTo(sx + r * 1.3, sy + ry * 0.2);
        ctx.ellipse(sx, sy + ry * 0.2, r * 1.3, r, 0, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.fillStyle = rgbString(pine);
      ctx.beginPath();
      for (const [sx, sy, r] of sub) {
        ctx.moveTo(sx + lightDir * rx * 0.06 + r * 1.1, sy - ry * 0.15);
        ctx.ellipse(sx + lightDir * rx * 0.06, sy - ry * 0.15, r * 1.1, r * 0.75, 0, 0, Math.PI * 2);
      }
      ctx.fill();
      // iglice: sitne tamne crte duž donje ivice
      ctx.strokeStyle = rgba(mix(pine, [0, 0, 0], 0.4), 0.6);
      ctx.lineWidth = Math.max(1, 0.8 * s);
      ctx.beginPath();
      for (let k = -4; k <= 4; k++) {
        const px = x + (k / 4.5) * rx;
        ctx.moveTo(px, y + ry * 0.5);
        ctx.lineTo(px + rx * 0.04, y + ry * 0.9);
      }
      ctx.stroke();
      ctx.fillStyle = rgbString(mix(pine, [255, 255, 255], 0.15));
      ctx.beginPath();
      for (const [sx, sy, r] of sub) {
        ctx.moveTo(sx + lightDir * r * 0.3 + r * 0.6, sy - ry * 0.45);
        ctx.ellipse(sx + lightDir * r * 0.3, sy - ry * 0.45, r * 0.6, r * 0.3, 0, 0, Math.PI * 2);
      }
      ctx.fill();
      if (snow) {
        ctx.fillStyle = rgbString(snow);
        ctx.beginPath();
        for (const [sx, sy, r] of sub) {
          ctx.moveTo(sx + r, sy - ry * 0.4);
          ctx.ellipse(sx, sy - ry * 0.4, r, r * 0.45, 0, Math.PI, 0);
        }
        ctx.fill();
      }
    }
  }
}

function drawPagoda(ctx: CanvasRenderingContext2D, x: number, baseY: number, H: number, tiers: number, body: RGB, roof: RGB, snow: RGB | null, lit: boolean, s: number): void {
  const spire = H * 0.2;
  const tierH = (H - spire) / tiers;
  const baseW = H * 0.32;
  // Kameni postament
  ctx.fillStyle = rgbString(mix(roof, [180, 175, 165], 0.5));
  ctx.fillRect(x - baseW * 0.62, baseY - tierH * 0.18, baseW * 1.24, tierH * 0.18);
  let y = baseY - tierH * 0.18;
  for (let i = 0; i < tiers; i++) {
    const k = 1 - (i / tiers) * 0.45;
    const bw = baseW * k;
    const bh = tierH * 0.55;
    // Telo sprata
    ctx.fillStyle = rgbString(body);
    ctx.fillRect(x - bw / 2, y - bh, bw, bh);
    ctx.fillStyle = rgbString(mix(body, [0, 0, 0], 0.3));
    for (let c = 0; c < 3; c++) ctx.fillRect(x - bw / 2 + (bw / 3) * c + bw * 0.12, y - bh * 0.85, bw * 0.09, bh * 0.75);
    if (lit) {
      ctx.fillStyle = "rgba(255,200,110,0.9)";
      ctx.fillRect(x - bw * 0.08, y - bh * 0.7, bw * 0.16, bh * 0.45);
    }
    y -= bh;
    // Krov sa podignutim uglovima
    const rw = bw * 1.55;
    const rh = tierH * 0.45;
    ctx.fillStyle = rgbString(roof);
    ctx.beginPath();
    ctx.moveTo(x - rw / 2, y - rh * 0.25);
    ctx.quadraticCurveTo(x - rw * 0.3, y + rh * 0.05, x - bw * 0.4, y - rh * 0.55);
    ctx.lineTo(x + bw * 0.4, y - rh * 0.55);
    ctx.quadraticCurveTo(x + rw * 0.3, y + rh * 0.05, x + rw / 2, y - rh * 0.25);
    ctx.quadraticCurveTo(x + rw * 0.25, y - rh * 0.1, x, y - rh * 0.1);
    ctx.quadraticCurveTo(x - rw * 0.25, y - rh * 0.1, x - rw / 2, y - rh * 0.25);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = rgbString(mix(roof, [0, 0, 0], 0.35));
    ctx.fillRect(x - bw * 0.45, y - rh * 0.12, bw * 0.9, rh * 0.12);
    if (snow) {
      ctx.fillStyle = rgbString(snow);
      ctx.beginPath();
      ctx.moveTo(x - bw * 0.42, y - rh * 0.55);
      ctx.lineTo(x + bw * 0.42, y - rh * 0.55);
      ctx.quadraticCurveTo(x + rw * 0.3, y - rh * 0.05, x + rw * 0.45, y - rh * 0.3);
      ctx.quadraticCurveTo(x, y - rh * 0.5, x - rw * 0.45, y - rh * 0.3);
      ctx.quadraticCurveTo(x - rw * 0.3, y - rh * 0.05, x - bw * 0.42, y - rh * 0.55);
      ctx.fill();
    }
    y -= rh * 0.55;
  }
  // Šiljak (sorin) sa prstenovima
  ctx.strokeStyle = rgbString(mix(roof, [0, 0, 0], 0.2));
  ctx.lineWidth = Math.max(1, baseW * 0.04);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y - spire);
  ctx.stroke();
  ctx.fillStyle = rgbString(mix(roof, [0, 0, 0], 0.2));
  for (let r = 0; r < 6; r++) ctx.fillRect(x - baseW * 0.07, y - spire * (0.2 + r * 0.11), baseW * 0.14, Math.max(1, s));
  ctx.beginPath();
  ctx.arc(x, y - spire, baseW * 0.04, 0, Math.PI * 2);
  ctx.fill();
}

function drawTorii(ctx: CanvasRenderingContext2D, x: number, baseY: number, H: number, red: RGB, black: RGB, snow: RGB | null): void {
  const W = H * 1.15;
  const pw = H * 0.075;
  ctx.fillStyle = rgbString(red);
  // Stubovi (blago nagnuti ka unutra)
  for (const side of [-1, 1]) {
    const bx = x + side * W * 0.34;
    ctx.beginPath();
    ctx.moveTo(bx - pw / 2, baseY);
    ctx.lineTo(bx + pw / 2, baseY);
    ctx.lineTo(bx + pw * 0.4 - side * H * 0.03, baseY - H * 0.9);
    ctx.lineTo(bx - pw * 0.4 - side * H * 0.03, baseY - H * 0.9);
    ctx.closePath();
    ctx.fill();
    // crne osnove stubova
    ctx.fillStyle = rgbString(black);
    ctx.fillRect(bx - pw * 0.6, baseY - H * 0.08, pw * 1.2, H * 0.08);
    ctx.fillStyle = rgbString(red);
  }
  // Nuki (donja greda)
  ctx.fillRect(x - W * 0.45, baseY - H * 0.72, W * 0.9, H * 0.06);
  // Gakuzuka (srednji stubić)
  ctx.fillRect(x - pw * 0.3, baseY - H * 0.88, pw * 0.6, H * 0.16);
  // Shimaki + kasagi (gornje grede sa podignutim krajevima)
  ctx.beginPath();
  ctx.moveTo(x - W * 0.5, baseY - H * 0.86);
  ctx.quadraticCurveTo(x, baseY - H * 0.82, x + W * 0.5, baseY - H * 0.86);
  ctx.lineTo(x + W * 0.5, baseY - H * 0.94);
  ctx.quadraticCurveTo(x, baseY - H * 0.9, x - W * 0.5, baseY - H * 0.94);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = rgbString(black);
  ctx.beginPath();
  ctx.moveTo(x - W * 0.58, baseY - H * 1.02);
  ctx.quadraticCurveTo(x, baseY - H * 0.9, x + W * 0.58, baseY - H * 1.02);
  ctx.lineTo(x + W * 0.55, baseY - H * 0.94);
  ctx.quadraticCurveTo(x, baseY - H * 0.86, x - W * 0.55, baseY - H * 0.94);
  ctx.closePath();
  ctx.fill();
  if (snow) {
    ctx.fillStyle = rgbString(snow);
    ctx.beginPath();
    ctx.moveTo(x - W * 0.57, baseY - H * 1.02);
    ctx.quadraticCurveTo(x, baseY - H * 0.9, x + W * 0.57, baseY - H * 1.02);
    ctx.quadraticCurveTo(x, baseY - H * 0.96, x - W * 0.57, baseY - H * 1.02);
    ctx.fill();
  }
}

function drawBridge(ctx: CanvasRenderingContext2D, x: number, baseY: number, W: number, H: number, red: RGB, snow: RGB | null, s: number): void {
  const deckT = Math.max(3 * s, H * 0.14);
  const archY = (u: number) => baseY - H * (1 - Math.pow(2 * u - 1, 2)); // parabola
  // Podne grede / stubovi u vodi
  ctx.fillStyle = rgbString(mix(red, [0, 0, 0], 0.35));
  for (let i = 1; i < 8; i++) {
    const u = i / 8;
    const px = x - W / 2 + W * u;
    ctx.fillRect(px - deckT * 0.25, archY(u), deckT * 0.5, baseY - archY(u));
  }
  // Paluba (luk)
  ctx.fillStyle = rgbString(red);
  ctx.beginPath();
  const n = 24;
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const px = x - W / 2 + W * u;
    if (i === 0) ctx.moveTo(px, archY(u));
    else ctx.lineTo(px, archY(u));
  }
  for (let i = n; i >= 0; i--) {
    const u = i / n;
    ctx.lineTo(x - W / 2 + W * u, archY(u) + deckT);
  }
  ctx.closePath();
  ctx.fill();
  // Ograda: stubići + rukohvat
  const railH = Math.max(6 * s, H * 0.3);
  ctx.strokeStyle = rgbString(red);
  ctx.lineWidth = Math.max(1, deckT * 0.35);
  ctx.beginPath();
  for (let i = 0; i <= 10; i++) {
    const u = 0.04 + (i / 10) * 0.92;
    const px = x - W / 2 + W * u;
    ctx.moveTo(px, archY(u));
    ctx.lineTo(px, archY(u) - railH);
  }
  ctx.stroke();
  ctx.lineWidth = Math.max(1.2, deckT * 0.45);
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const u = 0.04 + (i / n) * 0.92;
    const px = x - W / 2 + W * u;
    if (i === 0) ctx.moveTo(px, archY(u) - railH);
    else ctx.lineTo(px, archY(u) - railH);
  }
  ctx.stroke();
  // Zlatne kape na krajnjim stubićima (giboshi)
  ctx.fillStyle = "rgb(205,170,80)";
  for (const u of [0.04, 0.96]) {
    ctx.beginPath();
    ctx.arc(x - W / 2 + W * u, archY(u) - railH - deckT * 0.3, deckT * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }
  if (snow) {
    ctx.strokeStyle = rgbString(snow);
    ctx.lineWidth = Math.max(1, deckT * 0.4);
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const u = 0.04 + (i / n) * 0.92;
      const px = x - W / 2 + W * u;
      if (i === 0) ctx.moveTo(px, archY(u) - railH - deckT * 0.3);
      else ctx.lineTo(px, archY(u) - railH - deckT * 0.3);
    }
    ctx.stroke();
  }
}

function drawStoneLantern(ctx: CanvasRenderingContext2D, x: number, baseY: number, H: number, stone: RGB, lit: boolean, snow: RGB | null, lightDir: number): void {
  const dark = mix(stone, [0, 0, 0], 0.3);
  const lightS = mix(stone, [255, 255, 255], 0.12);
  const block = (cx: number, y: number, bw: number, bh: number) => {
    ctx.fillStyle = rgbString(stone);
    ctx.fillRect(cx - bw / 2, y - bh, bw, bh);
    ctx.fillStyle = rgbString(lightDir > 0 ? dark : lightS);
    ctx.fillRect(cx - bw / 2, y - bh, bw * 0.2, bh);
    ctx.fillStyle = rgbString(lightDir > 0 ? lightS : dark);
    ctx.fillRect(cx + bw / 2 - bw * 0.2, y - bh, bw * 0.2, bh);
  };
  // Senka
  ctx.fillStyle = "rgba(0,0,0,0.2)";
  ctx.beginPath();
  ctx.ellipse(x - lightDir * H * 0.12, baseY, H * 0.35, H * 0.05, 0, 0, Math.PI * 2);
  ctx.fill();
  let y = baseY;
  block(x, y, H * 0.42, H * 0.08); // postolje
  y -= H * 0.08;
  block(x, y, H * 0.14, H * 0.32); // stub
  y -= H * 0.32;
  block(x, y, H * 0.34, H * 0.07); // platforma
  y -= H * 0.07;
  // Kućište svetla
  block(x, y, H * 0.26, H * 0.2);
  ctx.fillStyle = lit ? "rgb(255,200,110)" : rgbString(mix(stone, [0, 0, 0], 0.6));
  ctx.fillRect(x - H * 0.06, y - H * 0.16, H * 0.12, H * 0.12);
  if (lit) {
    const gl = ctx.createRadialGradient(x, y - H * 0.1, 0, x, y - H * 0.1, H * 0.7);
    gl.addColorStop(0, "rgba(255,190,90,0.4)");
    gl.addColorStop(1, "rgba(255,190,90,0)");
    ctx.fillStyle = gl;
    ctx.fillRect(x - H * 0.7, y - H * 0.8, H * 1.4, H * 1.4);
  }
  y -= H * 0.2;
  // Krov (širok, uvijen)
  ctx.fillStyle = rgbString(stone);
  ctx.beginPath();
  ctx.moveTo(x - H * 0.36, y + H * 0.01);
  ctx.quadraticCurveTo(x - H * 0.2, y - H * 0.04, x - H * 0.08, y - H * 0.14);
  ctx.lineTo(x + H * 0.08, y - H * 0.14);
  ctx.quadraticCurveTo(x + H * 0.2, y - H * 0.04, x + H * 0.36, y + H * 0.01);
  ctx.lineTo(x + H * 0.34, y + H * 0.04);
  ctx.lineTo(x - H * 0.34, y + H * 0.04);
  ctx.closePath();
  ctx.fill();
  if (snow) {
    ctx.fillStyle = rgbString(snow);
    ctx.beginPath();
    ctx.moveTo(x - H * 0.34, y);
    ctx.quadraticCurveTo(x - H * 0.2, y - H * 0.06, x - H * 0.08, y - H * 0.16);
    ctx.lineTo(x + H * 0.08, y - H * 0.16);
    ctx.quadraticCurveTo(x + H * 0.2, y - H * 0.06, x + H * 0.34, y);
    ctx.quadraticCurveTo(x, y - H * 0.08, x - H * 0.34, y);
    ctx.fill();
  }
  // Hoju (vrh)
  ctx.fillStyle = rgbString(stone);
  ctx.beginPath();
  ctx.arc(x, y - H * 0.17, H * 0.04, 0, Math.PI * 2);
  ctx.fill();
}

function drawLilyPad(ctx: CanvasRenderingContext2D, rand: Rand, x: number, y: number, r: number, green: RGB, flower: RGB, bloomFlower: boolean): void {
  const notch = rand() * Math.PI * 2;
  ctx.fillStyle = rgbString(green);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.ellipse(x, y, r, r * 0.4, 0, notch + 0.3, notch + Math.PI * 2 - 0.3);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = rgba(mix(green, [255, 255, 255], 0.25), 0.6);
  ctx.beginPath();
  ctx.ellipse(x - r * 0.15, y - r * 0.08, r * 0.5, r * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();
  if (bloomFlower) {
    ctx.fillStyle = rgbString(flower);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI - Math.PI;
      ctx.beginPath();
      ctx.ellipse(x + Math.cos(a) * r * 0.25, y - r * 0.25 + Math.sin(a) * r * 0.15, r * 0.12, r * 0.3, a + Math.PI / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawKoi(ctx: CanvasRenderingContext2D, rand: Rand, x: number, y: number, L: number, ang: number, water: RGB, night: boolean): void {
  const base: RGB = rand() < 0.6 ? [240, 110, 40] : rand() < 0.5 ? [245, 240, 230] : [225, 60, 45];
  const spot: RGB = base[1] > 200 ? [230, 80, 40] : [250, 245, 235];
  const a = night ? 0.45 : 0.85;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, 0.45); // pogled odozgo pod uglom
  ctx.rotate(ang);
  const body = mix(base, water, 0.25);
  ctx.fillStyle = rgba(body, a);
  ctx.beginPath();
  ctx.ellipse(0, 0, L * 0.5, L * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();
  // Rep
  ctx.beginPath();
  ctx.moveTo(-L * 0.45, 0);
  ctx.quadraticCurveTo(-L * 0.62, -L * 0.18, -L * 0.75, -L * 0.15);
  ctx.quadraticCurveTo(-L * 0.62, 0, -L * 0.75, L * 0.15);
  ctx.quadraticCurveTo(-L * 0.62, L * 0.18, -L * 0.45, 0);
  ctx.fill();
  // Peraja
  ctx.beginPath();
  ctx.ellipse(L * 0.15, L * 0.15, L * 0.1, L * 0.05, 0.6, 0, Math.PI * 2);
  ctx.ellipse(L * 0.15, -L * 0.15, L * 0.1, L * 0.05, -0.6, 0, Math.PI * 2);
  ctx.fill();
  // Fleke
  ctx.fillStyle = rgba(mix(spot, water, 0.2), a);
  for (let i = 0; i < 2; i++) {
    ctx.beginPath();
    ctx.ellipse(L * (0.2 - i * 0.28), (rand() - 0.5) * L * 0.08, L * 0.1, L * 0.09, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawMapleLeaf(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number, col: RGB): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = rgbString(col);
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.45;
    const px = Math.cos(a) * rr;
    const py = Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Grana iz gornjeg ugla (uokviruje kadar): sakura, javor, šljiva sa snegom ili zeleni javor. */
function drawFrameBranch(ctx: CanvasRenderingContext2D, rand: Rand, w: number, h: number, s: number, left: boolean, season: Season, bark: RGB, bloom: RGB[], snow: RGB): void {
  const dir = left ? 1 : -1;
  const x0 = left ? -20 * s : w + 20 * s;
  const y0 = h * (0.02 + 0.12 * rand());
  const len = w * (0.3 + 0.15 * rand());
  const segs: Branch[] = [];
  const tips: Pt[] = [];
  const grow = (x: number, y: number, ang: number, L: number, wd: number, depth: number) => {
    const x1 = x + Math.cos(ang) * L;
    const y1 = y + Math.sin(ang) * L;
    segs.push({ x0: x, y0: y, cx: (x + x1) / 2, cy: (y + y1) / 2 + L * 0.1, x1, y1, w: wd });
    tips.push({ x: x1, y: y1 });
    if (depth === 0) return;
    const n = 2;
    for (let k = 0; k < n; k++) {
      const a = ang + (k === 0 ? -1 : 1) * (0.35 + 0.4 * rand());
      grow(x + (x1 - x) * (0.4 + 0.5 * rand()), y + (y1 - y) * (0.4 + 0.5 * rand()), a, L * (0.45 + 0.15 * rand()), wd * 0.55, depth - 1);
    }
  };
  const ang0 = left ? 0.25 + 0.25 * rand() : Math.PI - 0.25 - 0.25 * rand();
  grow(x0, y0, ang0, len, 14 * s, 3);
  ctx.lineCap = "round";
  ctx.strokeStyle = rgbString(mix(bark, [0, 0, 0], 0.2));
  for (const b of segs) {
    ctx.lineWidth = Math.max(1, b.w);
    ctx.beginPath();
    ctx.moveTo(b.x0, b.y0);
    ctx.quadraticCurveTo(b.cx, b.cy, b.x1, b.y1);
    ctx.stroke();
  }
  if (season === "winter") {
    // Šljiva: crveni cvetići + sneg na granama
    ctx.strokeStyle = rgbString(snow);
    for (const b of segs) {
      ctx.lineWidth = Math.max(1, b.w * 0.45);
      ctx.beginPath();
      ctx.moveTo(b.x0, b.y0 - b.w * 0.45);
      ctx.quadraticCurveTo(b.cx, b.cy - b.w * 0.45, b.x1, b.y1 - b.w * 0.45);
      ctx.stroke();
    }
    for (const t of tips) {
      for (let i = 0; i < 4; i++) drawFlower(ctx, t.x + (rand() - 0.5) * 30 * s, t.y + (rand() - 0.5) * 20 * s, (4 + rand() * 3) * s, [200, 40, 60], [250, 210, 120]);
    }
    return;
  }
  for (const t of tips) {
    const n = season === "spring" ? 6 + Math.floor(rand() * 6) : 5 + Math.floor(rand() * 5);
    for (let i = 0; i < n; i++) {
      const px = t.x + (rand() - 0.5) * 50 * s;
      const py = t.y + (rand() - 0.3) * 34 * s;
      const r = (5 + rand() * 5) * s;
      if (season === "spring") drawFlower(ctx, px, py, r, bloom[1 + Math.floor(rand() * 2)]!, [230, 120, 150]);
      else drawMapleLeaf(ctx, px, py, r * 1.4, rand() * Math.PI * 2 + dir, bloom[Math.floor(rand() * 3)]!);
    }
  }
}

function drawFlower(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, petal: RGB, center: RGB): void {
  ctx.fillStyle = rgbString(petal);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = rgbString(center);
  ctx.beginPath();
  ctx.arc(x, y, r * 0.25, 0, Math.PI * 2);
  ctx.fill();
}
