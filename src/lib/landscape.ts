/**
 * Pejzaž — render v2: dramatični planinski vrhovi (fasetirani, low-poly stil).
 *
 * Redosled: nebo → zvezde (noć) → (hooks.sky) → sunce/mesec → (hooks.body) →
 * oblaci → daleki venac → glavni masiv (osvetljena/senovita strana po grebenu,
 * nazubljene snežne kape) → more oblaka (opciono) → šumovita podbrđa →
 * alpska livada sa cvećem → staza / koliba sa dimom (opciono) → ptice.
 *
 * QRNG bira odluke (paleta, horizont, vrhovi, šta se pojavljuje); geometrija i
 * detalji iz PRNG-a seedovanog QRNG-om. Dimenzije relativne (s = w/1200).
 * v1 verzija ovog scenarija je zamrznuta u src/lib/scenarios/v1/landscape.ts.
 */
import type { QRNGStream } from "./qrng";
import { hslToRgb, rgbString, type RGB } from "./color";
import { prngFromStream, type Rand } from "./prng";
import { NO_HOOKS, type SceneHooks, type SkyLight } from "./sky-events";

type HSL = [number, number, number];

interface LandscapePalette {
  name: string;
  light: SkyLight;
  sky: [HSL, HSL, HSL];
  sun: HSL;
  moon?: boolean;
  stars?: boolean;
  rockLit: HSL;
  rockShade: HSL;
  snowLit: HSL;
  snowShade: HSL;
  forest: HSL;
  meadow: [HSL, HSL];
  flowers: HSL[];
  clouds: number;
}

const PALETTES: readonly LandscapePalette[] = [
  {
    name: "alpine-day",
    light: "day",
    sky: [[212, 0.65, 0.48], [205, 0.55, 0.66], [195, 0.45, 0.84]],
    sun: [50, 1, 0.94],
    rockLit: [215, 0.15, 0.58],
    rockShade: [225, 0.25, 0.32],
    snowLit: [210, 0.3, 0.97],
    snowShade: [220, 0.35, 0.78],
    forest: [150, 0.4, 0.2],
    meadow: [[95, 0.45, 0.52], [105, 0.45, 0.36]],
    flowers: [[50, 0.95, 0.65], [0, 0, 0.97], [280, 0.5, 0.7]],
    clouds: 0.6,
  },
  {
    name: "alpenglow",
    light: "dusk",
    sky: [[225, 0.4, 0.42], [300, 0.3, 0.66], [25, 0.75, 0.8]],
    sun: [35, 1, 0.82],
    rockLit: [350, 0.35, 0.6],
    rockShade: [250, 0.25, 0.32],
    snowLit: [345, 0.75, 0.88],
    snowShade: [245, 0.3, 0.7],
    forest: [220, 0.3, 0.18],
    meadow: [[120, 0.25, 0.4], [140, 0.3, 0.26]],
    flowers: [[330, 0.6, 0.75], [0, 0, 0.95]],
    clouds: 0.4,
  },
  {
    name: "sunset-orange",
    light: "dusk",
    sky: [[250, 0.4, 0.3], [340, 0.5, 0.52], [25, 0.95, 0.6]],
    sun: [28, 1, 0.68],
    rockLit: [20, 0.55, 0.5],
    rockShade: [270, 0.3, 0.22],
    snowLit: [30, 0.9, 0.82],
    snowShade: [265, 0.25, 0.55],
    forest: [270, 0.3, 0.13],
    meadow: [[40, 0.4, 0.38], [300, 0.2, 0.2]],
    flowers: [[45, 0.9, 0.65]],
    clouds: 0.5,
  },
  {
    name: "night",
    light: "night",
    sky: [[230, 0.55, 0.07], [228, 0.45, 0.14], [220, 0.35, 0.24]],
    sun: [50, 0.25, 0.92],
    moon: true,
    stars: true,
    rockLit: [220, 0.2, 0.32],
    rockShade: [230, 0.35, 0.12],
    snowLit: [215, 0.35, 0.8],
    snowShade: [225, 0.35, 0.45],
    forest: [220, 0.35, 0.07],
    meadow: [[210, 0.25, 0.18], [215, 0.3, 0.1]],
    flowers: [[210, 0.3, 0.7]],
    clouds: 0.2,
  },
  {
    name: "blue-hour-mist",
    light: "dusk",
    sky: [[225, 0.45, 0.3], [220, 0.35, 0.5], [210, 0.3, 0.7]],
    sun: [40, 0.8, 0.85],
    rockLit: [215, 0.2, 0.5],
    rockShade: [228, 0.3, 0.28],
    snowLit: [210, 0.3, 0.9],
    snowShade: [222, 0.3, 0.68],
    forest: [215, 0.3, 0.16],
    meadow: [[200, 0.2, 0.36], [210, 0.25, 0.22]],
    flowers: [[200, 0.4, 0.8]],
    clouds: 0.3,
  },
  {
    name: "autumn-highlands",
    light: "day",
    sky: [[210, 0.5, 0.55], [200, 0.4, 0.7], [40, 0.5, 0.82]],
    sun: [45, 1, 0.9],
    rockLit: [30, 0.25, 0.55],
    rockShade: [250, 0.2, 0.3],
    snowLit: [40, 0.3, 0.96],
    snowShade: [230, 0.25, 0.75],
    forest: [20, 0.5, 0.28],
    meadow: [[42, 0.55, 0.52], [30, 0.5, 0.34]],
    flowers: [[10, 0.7, 0.55], [45, 0.9, 0.6]],
    clouds: 0.5,
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

interface Peak {
  x: number;
  y: number;
  hwL: number; // polu-širina leve padine
  hwR: number;
}

export function renderLandscape(
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
  const horizonY = Math.floor(h * (0.5 + 0.12 * stream.next_f()));
  const sunX = w * (0.12 + 0.76 * stream.next_f());
  const sunR = (pal.moon ? 16 + 12 * stream.next_f() : 24 + 20 * stream.next_f()) * s;
  const sunY = pal.light === "dusk" ? horizonY * (0.35 + 0.3 * stream.next_f()) : horizonY * (0.12 + 0.25 * stream.next_f());
  const mainPeaks = stream.next_int(2, 4);
  const cloudSea = stream.next_f() < 0.3;
  const cabinRoll = stream.next_f();
  const pathRoll = stream.next_f();
  const rand = prngFromStream(stream);

  const lightDir = sunX < w / 2 ? 1 : -1; // +1: svetlo sleva → senka desno
  const sky = pal.sky.map((c) => hsl(c, dh));
  const skyHorizon = sky[2]!;
  const sunCol = hsl(pal.sun);
  const sunCore = mix(sunCol, [255, 252, 240], 0.6);
  const rockLit = hsl(pal.rockLit, dh);
  const rockShade = hsl(pal.rockShade, dh);
  const snowLit = hsl(pal.snowLit);
  const snowShade = hsl(pal.snowShade);
  const forest = hsl(pal.forest, dh * 0.5);
  const meadowFar = hsl(pal.meadow[0], dh * 0.5);
  const meadowNear = hsl(pal.meadow[1], dh * 0.5);
  const fog = mix(skyHorizon, [255, 255, 255], pal.moon ? 0.05 : 0.2);

  // ---- 1. Nebo ----
  const g = ctx.createLinearGradient(0, 0, 0, horizonY);
  g.addColorStop(0, rgbString(sky[0]!));
  g.addColorStop(0.6, rgbString(sky[1]!));
  g.addColorStop(1, rgbString(skyHorizon));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // ---- 2. Zvezde ----
  if (pal.stars) {
    const n = 180 + Math.floor(rand() * 180);
    for (let i = 0; i < n; i++) {
      const y = Math.pow(rand(), 1.4) * horizonY * 0.85;
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
  ctx.fillRect(sunX - glowR, sunY - glowR, glowR * 2, glowR * 2);
  const core = ctx.createRadialGradient(sunX - sunR * 0.25, sunY - sunR * 0.25, 0, sunX, sunY, sunR);
  core.addColorStop(0, rgbString(sunCore));
  core.addColorStop(1, rgbString(sunCol));
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
  ctx.fill();
  hooks.body({ x: sunX, y: sunY, r: sunR, kind: pal.moon ? "moon" : "sun" });

  // ---- 4. Oblaci (izduženi, mekani) ----
  const cloudN = Math.floor(pal.clouds * (2 + rand() * 5));
  const cloudCol = mix(skyHorizon, pal.moon ? [120, 130, 160] : [255, 255, 255], 0.6);
  for (let i = 0; i < cloudN; i++) {
    const cx = rand() * w;
    const cy = horizonY * (0.1 + 0.45 * rand());
    const cw = (100 + rand() * 220) * s;
    ctx.fillStyle = rgba(cloudCol, 0.75);
    ctx.beginPath();
    const blobs = 6 + Math.floor(rand() * 6);
    for (let b = 0; b < blobs; b++) {
      const u = rand() - 0.5;
      const rx = cw * (0.12 + 0.14 * rand()) * (1 - Math.abs(u));
      const ry = (6 + 10 * rand()) * s * (1 - Math.abs(u) * 0.7);
      ctx.save();
      ctx.translate(cx + u * cw, cy - ry * 0.4 * rand());
      ctx.scale(Math.max(1, rx), Math.max(1, ry));
      ctx.moveTo(1, 0);
      ctx.arc(0, 0, 1, 0, Math.PI * 2);
      ctx.restore();
    }
    ctx.fill();
  }

  // ---- 5. Daleki venac ----
  {
    const farBase = horizonY;
    const peaks: Peak[] = [];
    const n = 5 + Math.floor(rand() * 4);
    for (let i = 0; i < n; i++) {
      const ph = horizonY * (0.12 + 0.18 * rand());
      peaks.push({ x: (i + rand()) * (w / n), y: farBase - ph, hwL: ph * (1.2 + rand()), hwR: ph * (1.2 + rand()) });
    }
    drawRange(ctx, rand, peaks, farBase, w, h, s, mix(rockLit, fog, 0.6), mix(rockShade, fog, 0.55), mix(snowLit, fog, 0.35), mix(snowShade, fog, 0.4), lightDir, 0.4);
  }

  // ---- 6. Glavni masiv ----
  const mainBase = horizonY + (h - horizonY) * 0.12;
  {
    const peaks: Peak[] = [];
    for (let i = 0; i < mainPeaks; i++) {
      const ph = horizonY * (0.45 + 0.35 * rand());
      peaks.push({
        x: (i + 0.15 + 0.7 * rand()) * (w / mainPeaks),
        y: mainBase - ph,
        hwL: ph * (0.75 + 0.5 * rand()),
        hwR: ph * (0.75 + 0.5 * rand()),
      });
      // Pomoćni vrh na ramenu
      const sh = ph * (0.45 + 0.25 * rand());
      const side = rand() < 0.5 ? -1 : 1;
      peaks.push({ x: peaks[peaks.length - 1]!.x + side * ph * (0.5 + 0.3 * rand()), y: mainBase - sh, hwL: sh * 0.9, hwR: sh * 0.9 });
    }
    // Viši vrhovi se crtaju poslednji (ispred nižih) — sortiranje po visini (niži prvo)
    drawRange(ctx, rand, peaks, mainBase, w, h, s, rockLit, rockShade, snowLit, snowShade, lightDir, 0.32);
  }

  // Izmaglica na dnu masiva
  const hz = ctx.createLinearGradient(0, mainBase - (h - horizonY) * 0.15, 0, mainBase + 10 * s);
  hz.addColorStop(0, rgba(fog, 0));
  hz.addColorStop(1, rgba(fog, 0.55));
  ctx.fillStyle = hz;
  ctx.fillRect(0, mainBase - (h - horizonY) * 0.15, w, (h - horizonY) * 0.15 + 10 * s);

  // ---- 7. More oblaka (inverzija) ----
  const hillsBase = horizonY + (h - horizonY) * 0.42;
  if (cloudSea) {
    const seaTop = mainBase - 6 * s;
    ctx.fillStyle = rgbString(mix(fog, [255, 255, 255], pal.moon ? 0.1 : 0.4));
    ctx.beginPath();
    ctx.moveTo(0, hillsBase);
    for (let x = 0; x <= w; x += 6 * s) {
      const y = seaTop + Math.sin(x / (60 * s) + 1.3) * 5 * s + Math.sin(x / (23 * s)) * 3 * s;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, hillsBase);
    ctx.closePath();
    ctx.fill();
    // Puhasti vrhovi oblaka
    for (let i = 0; i < 30; i++) {
      const x = rand() * w;
      const r = (10 + rand() * 30) * s;
      ctx.beginPath();
      ctx.arc(x, seaTop + r * 0.3, r, Math.PI, 0);
      ctx.fill();
    }
  }

  // ---- 8. Šumovita podbrđa ----
  const hillAmp = (25 + rand() * 30) * s;
  const hp1 = rand() * 6.28;
  const hf1 = (1 + rand() * 1.5) * Math.PI * 2;
  const hill = (x: number) => hillsBase - hillAmp * (0.5 + 0.5 * Math.sin((x / w) * hf1 + hp1));
  ctx.fillStyle = rgbString(mix(forest, meadowNear, 0.3));
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let x = 0; x <= w; x += 8 * s) ctx.lineTo(x, hill(x));
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = rgbString(forest);
  ctx.beginPath();
  for (let x = -5 * s; x < w + 5 * s; x += (4 + rand() * 6) * s) {
    const th = (12 + rand() * 20) * s;
    const y = hill(x) + 4 * s;
    ctx.moveTo(x - th * 0.32, y);
    ctx.lineTo(x, y - th);
    ctx.lineTo(x + th * 0.32, y);
  }
  ctx.fill();

  // ---- 9. Alpska livada ----
  const meadowY = horizonY + (h - horizonY) * 0.55;
  const ma = (6 + rand() * 10) * s;
  const mp = rand() * 6.28;
  const meadowEdge = (x: number) => meadowY + ma * Math.sin((x / w) * Math.PI * 2 + mp);
  const mg = ctx.createLinearGradient(0, meadowY, 0, h);
  mg.addColorStop(0, rgbString(meadowFar));
  mg.addColorStop(1, rgbString(meadowNear));
  ctx.fillStyle = mg;
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let x = 0; x <= w; x += 8 * s) ctx.lineTo(x, meadowEdge(x));
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();

  // Staza: vijuga od dna ka podbrđu
  if (pathRoll < 0.45) {
    const x0 = w * (0.35 + 0.3 * rand());
    const x1 = w * (0.2 + 0.6 * rand());
    const wig = (60 + rand() * 120) * s;
    const pathCol = mix(meadowFar, [235, 215, 180], pal.moon ? 0.15 : 0.5);
    ctx.fillStyle = rgbString(pathCol);
    ctx.beginPath();
    const steps = 30;
    const left: [number, number][] = [];
    const right: [number, number][] = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const y = h - (h - meadowEdge(x1)) * t;
      const x = x0 + (x1 - x0) * t + Math.sin(t * Math.PI * 2.2) * wig * (1 - t);
      const pw = (40 * (1 - t) + 2) * s;
      left.push([x - pw, y]);
      right.push([x + pw, y]);
    }
    left.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i]![0], right[i]![1]);
    ctx.closePath();
    ctx.fill();
  }

  // Cveće i travke
  const flowers = pal.flowers.map((c) => hsl(c));
  const nf = 220 + Math.floor(rand() * 200);
  for (let i = 0; i < nf; i++) {
    const t = Math.pow(rand(), 0.8);
    const x = rand() * w;
    const y = meadowEdge(x) + 4 * s + t * (h - meadowEdge(x));
    const r = (0.8 + t * 2.4) * s;
    if (rand() < 0.45) {
      ctx.fillStyle = rgba(flowers[Math.floor(rand() * flowers.length)]!, 0.85);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = rgba(mix(meadowNear, [0, 0, 0], 0.25), 0.55);
      ctx.lineWidth = Math.max(1, (0.6 + t) * s);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (rand() - 0.5) * 3 * s, y - (3 + t * 9) * s);
      ctx.stroke();
    }
  }

  // ---- 10. Koliba sa dimom ----
  if (cabinRoll < 0.3) {
    const cx = w * (0.12 + 0.76 * rand());
    const cy = meadowEdge(cx) + (h - meadowY) * (0.12 + 0.2 * rand());
    drawCabin(ctx, rand, cx, cy, s * (0.8 + 0.4 * rand()), lightDir, !!pal.moon, fog);
  }

  // ---- 11. Ptice ----
  if (!pal.moon && rand() < 0.35) {
    const n = 2 + Math.floor(rand() * 4);
    const bx = w * (0.2 + 0.6 * rand());
    const by = horizonY * (0.15 + 0.3 * rand());
    ctx.strokeStyle = rgba(mix(rockShade, [0, 0, 0], 0.3), 0.8);
    ctx.lineWidth = Math.max(1, 1.5 * s);
    ctx.lineCap = "round";
    for (let i = 0; i < n; i++) {
      const x = bx + (rand() - 0.5) * 150 * s;
      const y = by + (rand() - 0.5) * 50 * s;
      const sp = (5 + rand() * 6) * s;
      ctx.beginPath();
      ctx.moveTo(x - sp, y - sp * 0.35);
      ctx.quadraticCurveTo(x - sp * 0.4, y - sp * 0.5, x, y);
      ctx.quadraticCurveTo(x + sp * 0.4, y - sp * 0.5, x + sp, y - sp * 0.35);
      ctx.stroke();
    }
  }
}

/**
 * Venac planina: svaki vrh posebno (niži prvo), osvetljena strana + senovita
 * strana podeljene nazubljenim grebenom, snežna kapa sa nazubljenom donjom ivicom.
 */
function drawRange(
  ctx: CanvasRenderingContext2D,
  rand: Rand,
  peaks: Peak[],
  baseY: number,
  w: number,
  h: number,
  s: number,
  rockLit: RGB,
  rockShade: RGB,
  snowLit: RGB,
  snowShade: RGB,
  lightDir: number,
  snowFrac: number
): void {
  // Zajednička podloga ispod podnožja (bez vertikalnih zidova ispod pojedinačnih vrhova)
  ctx.fillStyle = rgbString(mix(rockShade, rockLit, 0.35));
  ctx.fillRect(0, baseY - 1, w, h - baseY + 1);
  const sorted = [...peaks].sort((a, b) => b.y - a.y); // niži (veći y) prvo
  for (const p of sorted) {
    const ph = baseY - p.y;
    const left = p.x - p.hwL;
    const right = p.x + p.hwR;
    // Silueta vrha sa sitnim stepenicama na padinama
    const outline: [number, number][] = [];
    const steps = 10;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = left + (p.x - left) * t;
      const y = baseY - ph * Math.pow(t, 1.08) + (i > 0 && i < steps ? (rand() - 0.5) * ph * 0.05 : 0);
      outline.push([x, y]);
    }
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const x = p.x + (right - p.x) * t;
      const y = p.y + ph * Math.pow(t, 0.92) + (i < steps ? (rand() - 0.5) * ph * 0.05 : 0);
      outline.push([x, y]);
    }
    // zatvara se po liniji podnožja (closePath)
    const path = () => {
      ctx.beginPath();
      outline.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
    };
    path();
    ctx.fillStyle = rgbString(rockLit);
    ctx.fill();

    ctx.save();
    path();
    ctx.clip();
    // Greben: nazubljena linija od vrha ka podnožju, blago ka senovitoj strani
    const ridge: [number, number][] = [[p.x, p.y]];
    const rsteps = 9;
    const shadowSide = lightDir; // svetlo sleva → senka desno
    for (let i = 1; i <= rsteps; i++) {
      const t = i / rsteps;
      ridge.push([p.x + shadowSide * ph * 0.18 * t + (rand() - 0.5) * ph * 0.08, p.y + ph * t * 1.05]);
    }
    // Snežna kapa (cela, pa senka preko)
    const capY = p.y + ph * snowFrac * (0.8 + 0.4 * rand());
    ctx.fillStyle = rgbString(snowLit);
    ctx.beginPath();
    ctx.moveTo(p.x - p.hwL * 1.2, p.y - 5);
    ctx.lineTo(p.x + p.hwR * 1.2, p.y - 5);
    const zig = 7 + Math.floor(rand() * 5);
    for (let i = zig; i >= 0; i--) {
      const x = p.x - p.hwL + ((p.hwL + p.hwR) * i) / zig;
      const dist = Math.abs(x - p.x) / Math.max(p.hwL, p.hwR);
      const y = capY - ph * snowFrac * dist * 0.9 + (i % 2 === 0 ? 1 : -1) * ph * 0.05 * rand() + (rand() - 0.3) * ph * 0.08;
      ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    // Senovita strana (stena i sneg)
    const far = shadowSide > 0 ? right + 10 : left - 10;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - 2);
    ridge.forEach(([x, y]) => ctx.lineTo(x, y));
    ctx.lineTo(ridge[ridge.length - 1]![0], h);
    ctx.lineTo(far, h);
    ctx.lineTo(far, p.y - 2);
    ctx.closePath();
    ctx.fillStyle = rgba(rockShade, 0.88);
    ctx.fill();
    // Sneg na senovitoj strani: ponovo kapa u boji senke snega, klipovana na senku
    ctx.save();
    ctx.clip();
    ctx.fillStyle = rgbString(snowShade);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - 2);
    ctx.lineTo(far, p.y - 2);
    ctx.lineTo(far, capY - ph * snowFrac * 0.6);
    ctx.lineTo(p.x + shadowSide * ph * 0.1, capY + ph * 0.03);
    ctx.closePath();
    ctx.globalAlpha = 0.9;
    ctx.fill();
    ctx.restore();
    // Par sekundarnih faseta na osvetljenoj strani
    ctx.fillStyle = rgba(mix(rockLit, rockShade, 0.35), 0.3);
    for (let k = 0; k < 2; k++) {
      const fx = p.x - shadowSide * ph * (0.25 + 0.35 * rand());
      const fy = p.y + ph * (0.35 + 0.3 * rand());
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(fx - shadowSide * ph * 0.12, fy + ph * 0.5);
      ctx.lineTo(fx + shadowSide * ph * 0.06, fy + ph * 0.5);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawCabin(
  ctx: CanvasRenderingContext2D,
  rand: Rand,
  x: number,
  y: number,
  k: number,
  lightDir: number,
  night: boolean,
  fog: RGB
): void {
  const wall: RGB = night ? [60, 50, 50] : [140, 90, 55];
  const roof: RGB = night ? [40, 35, 45] : [95, 55, 40];
  const bw = 46 * k;
  const bh = 26 * k;
  // Zid
  ctx.fillStyle = rgbString(wall);
  ctx.fillRect(x - bw / 2, y - bh, bw, bh);
  ctx.fillStyle = rgba([0, 0, 0], 0.18);
  ctx.fillRect(lightDir > 0 ? x : x - bw / 2, y - bh, bw / 2, bh);
  // Krov
  ctx.fillStyle = rgbString(roof);
  ctx.beginPath();
  ctx.moveTo(x - bw * 0.62, y - bh + 2 * k);
  ctx.lineTo(x, y - bh - 24 * k);
  ctx.lineTo(x + bw * 0.62, y - bh + 2 * k);
  ctx.closePath();
  ctx.fill();
  // Dimnjak + dim
  const chx = x + bw * 0.22;
  ctx.fillRect(chx - 3 * k, y - bh - 20 * k, 6 * k, 12 * k);
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = rgba(mix(fog, [255, 255, 255], 0.4), 0.45 - i * 0.06);
    ctx.beginPath();
    ctx.arc(chx + i * 4 * k + Math.sin(i) * 3 * k, y - bh - 24 * k - i * 9 * k, (3 + i * 1.6) * k, 0, Math.PI * 2);
    ctx.fill();
  }
  // Prozor i vrata
  ctx.fillStyle = night ? "rgb(255,210,120)" : "rgb(70,55,45)";
  ctx.fillRect(x - bw * 0.32, y - bh * 0.7, 8 * k, 7 * k);
  if (night) {
    const gw = ctx.createRadialGradient(x - bw * 0.32 + 4 * k, y - bh * 0.7 + 3 * k, 0, x - bw * 0.32 + 4 * k, y - bh * 0.7 + 3 * k, 26 * k);
    gw.addColorStop(0, "rgba(255,200,110,0.45)");
    gw.addColorStop(1, "rgba(255,200,110,0)");
    ctx.fillStyle = gw;
    ctx.fillRect(x - bw, y - bh * 1.6, bw * 1.5, bh * 2);
  }
  ctx.fillStyle = rgbString(mix(roof, [0, 0, 0], 0.3));
  ctx.fillRect(x + bw * 0.05, y - bh * 0.6, 9 * k, bh * 0.6);
  void rand;
}
