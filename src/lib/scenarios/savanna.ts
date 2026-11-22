/**
 * Savana — render v2.
 *
 * Redosled: nebo → zvezde + Mlečni put (noć) → (hooks.sky) → ogromno sunce /
 * mesec → (hooks.body) → trake oblaka / zavese kiše → planina sa snegom i
 * stenovita uzvišenja (opciono) → daleki niz akacija → ravnica → velike
 * akacije / baobab → životinje (žirafe, slonovi, antilope/zebre) →
 * visoka trava u prvom planu → ptice.
 *
 * U zalasku i noću životinje i drveće su tamne siluete na nebu (klasika);
 * danju su u boji (šare žirafe, kljove slona, pruge zebre).
 * QRNG bira odluke; detalji iz PRNG-a. Dimenzije relativne (s = w/1200).
 */
import type { QRNGStream } from "../qrng";
import { hslToRgb, rgbString, type RGB } from "../color";
import { prngFromStream, type Rand } from "../prng";
import { choice, optional, type ControlDef } from "./controls";
import { NO_HOOKS, type SceneHooks, type SkyLight } from "../sky-events";

type HSL = [number, number, number];

interface SavannaPalette {
  name: string;
  light: SkyLight;
  sky: [HSL, HSL, HSL];
  sun: HSL;
  moon?: boolean;
  stars?: boolean;
  ground: [HSL, HSL]; // dalje → bliže
  silhouette: boolean; // životinje/drveće kao siluete
  sil: HSL; // boja silueta
  bigSun: boolean;
  rain?: boolean;
}

const PALETTES: readonly SavannaPalette[] = [
  {
    name: "golden-sunset",
    light: "dusk",
    sky: [[30, 0.6, 0.45], [32, 0.85, 0.6], [40, 0.95, 0.7]],
    sun: [40, 1, 0.75],
    ground: [[35, 0.6, 0.42], [25, 0.55, 0.22]],
    silhouette: true,
    sil: [20, 0.4, 0.1],
    bigSun: true,
  },
  {
    name: "red-sunset",
    light: "dusk",
    sky: [[280, 0.4, 0.22], [350, 0.6, 0.42], [18, 0.95, 0.55]],
    sun: [22, 1, 0.62],
    ground: [[10, 0.5, 0.3], [330, 0.35, 0.12]],
    silhouette: true,
    sil: [320, 0.3, 0.07],
    bigSun: true,
  },
  {
    name: "noon",
    light: "day",
    sky: [[205, 0.55, 0.55], [200, 0.45, 0.72], [45, 0.45, 0.85]],
    sun: [50, 1, 0.94],
    ground: [[45, 0.55, 0.62], [38, 0.55, 0.45]],
    silhouette: false,
    sil: [30, 0.3, 0.2],
    bigSun: false,
  },
  {
    name: "dawn-mist",
    light: "dusk",
    sky: [[220, 0.35, 0.6], [330, 0.4, 0.75], [30, 0.7, 0.82]],
    sun: [35, 1, 0.85],
    ground: [[30, 0.35, 0.55], [20, 0.3, 0.32]],
    silhouette: true,
    sil: [260, 0.2, 0.22],
    bigSun: true,
  },
  {
    name: "night",
    light: "night",
    sky: [[235, 0.55, 0.06], [232, 0.45, 0.12], [215, 0.35, 0.22]],
    sun: [50, 0.25, 0.92],
    moon: true,
    stars: true,
    ground: [[220, 0.25, 0.14], [225, 0.3, 0.07]],
    silhouette: true,
    sil: [230, 0.35, 0.04],
    bigSun: false,
  },
  {
    name: "rainy-season",
    light: "day",
    sky: [[210, 0.25, 0.45], [205, 0.25, 0.62], [55, 0.35, 0.78]],
    sun: [50, 0.8, 0.9],
    ground: [[85, 0.45, 0.48], [100, 0.45, 0.3]],
    silhouette: false,
    sil: [100, 0.3, 0.15],
    bigSun: false,
    rain: true,
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

interface Look {
  sil: boolean;
  silCol: RGB;
  haze: RGB;
}

/** Kontrole za Studio. */
export const SAVANNA_CONTROLS: ControlDef[] = [
  { key: "palette", type: "choice", label: "palette", options: PALETTES.map((p) => p.name) },
  { key: "mountain", type: "toggle", label: "mountain" },
  { key: "baobab", type: "toggle", label: "baobab" },
  { key: "giraffes", type: "toggle", label: "giraffes" },
  { key: "elephants", type: "toggle", label: "elephants" },
  { key: "herd", type: "toggle", label: "herd" },
  { key: "birds", type: "toggle", label: "birds" },
];

export function renderSavanna(
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
  const horizonY = Math.floor(h * (0.6 + 0.1 * stream.next_f()));
  const sunX = w * (0.2 + 0.6 * stream.next_f());
  const sunR = (pal.bigSun ? 70 + 60 * stream.next_f() : pal.moon ? 16 + 12 * stream.next_f() : 26 + 16 * stream.next_f()) * s;
  const sunY = pal.bigSun ? horizonY - sunR * (0.2 + 0.9 * stream.next_f()) : horizonY * (0.15 + 0.3 * stream.next_f());
  const mountain = stream.next_f() < 0.35;
  const giraffes = stream.next_f() < 0.5;
  const elephants = stream.next_f() < 0.4;
  const herd = stream.next_f() < 0.5;
  const baobab = stream.next_f() < 0.25;
  const birdsRoll = stream.next_f();
  const rand = prngFromStream(stream);

  const sky = pal.sky.map((c) => hsl(c, dh));
  const skyHorizon = sky[2]!;
  const sunCol = hsl(pal.sun);
  const sunCore = mix(sunCol, [255, 250, 230], 0.55);
  const groundFar = hsl(pal.ground[0], dh * 0.5);
  const groundNear = hsl(pal.ground[1], dh * 0.5);
  const silCol = hsl(pal.sil, dh * 0.5);
  const look: Look = { sil: pal.silhouette, silCol, haze: skyHorizon };

  // ---- 1. Nebo ----
  const g = ctx.createLinearGradient(0, 0, 0, horizonY);
  g.addColorStop(0, rgbString(sky[0]!));
  g.addColorStop(0.55, rgbString(sky[1]!));
  g.addColorStop(1, rgbString(skyHorizon));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // ---- 2. Zvezde + Mlečni put ----
  if (pal.stars) {
    ctx.save();
    ctx.translate(w * (0.2 + 0.6 * rand()), horizonY);
    ctx.rotate(-0.9 - 0.4 * rand());
    const mw = ctx.createLinearGradient(0, -horizonY * 0.18, 0, horizonY * 0.18);
    mw.addColorStop(0, "rgba(200,190,255,0)");
    mw.addColorStop(0.5, "rgba(215,205,255,0.13)");
    mw.addColorStop(1, "rgba(200,190,255,0)");
    ctx.fillStyle = mw;
    ctx.fillRect(-20 * s, -horizonY * 0.18, w * 1.3, horizonY * 0.36);
    for (let i = 0; i < 500; i++) {
      ctx.fillStyle = `rgba(255,255,255,${(0.15 + 0.4 * rand()).toFixed(2)})`;
      ctx.fillRect(rand() * w * 1.3, (rand() + rand() - 1) * horizonY * 0.14, Math.max(0.7, s), Math.max(0.7, s));
    }
    ctx.restore();
    for (let i = 0; i < 220; i++) {
      const y = Math.pow(rand(), 1.3) * horizonY * 0.95;
      ctx.fillStyle = `rgba(255,255,255,${((0.25 + 0.7 * rand()) * (1 - y / horizonY * 0.5)).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(rand() * w, y, (rand() < 0.92 ? 0.7 : 1.4) * Math.max(0.6, s), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  hooks.sky({ horizonY, light: pal.light });

  // ---- 3. Sunce / mesec ----
  const glowR = sunR * (pal.bigSun ? 3.5 : pal.moon ? 6 : 8);
  const glow = ctx.createRadialGradient(sunX, sunY, sunR * 0.8, sunX, sunY, glowR);
  glow.addColorStop(0, rgba(sunCol, pal.moon ? 0.25 : 0.5));
  glow.addColorStop(0.4, rgba(sunCol, pal.moon ? 0.06 : 0.15));
  glow.addColorStop(1, rgba(sunCol, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(sunX - glowR, sunY - glowR, glowR * 2, glowR * 2);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, w, horizonY + 1);
  ctx.clip();
  const core = ctx.createRadialGradient(sunX - sunR * 0.2, sunY - sunR * 0.2, 0, sunX, sunY, sunR);
  core.addColorStop(0, rgbString(sunCore));
  core.addColorStop(1, rgbString(sunCol));
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  hooks.body({ x: sunX, y: sunY, r: sunR, kind: pal.moon ? "moon" : "sun" });

  // ---- 4. Trake oblaka / zavese kiše ----
  const bands = pal.rain ? 7 + Math.floor(rand() * 4) : Math.floor(rand() * 5);
  for (let i = 0; i < bands; i++) {
    const cy = horizonY * (0.12 + 0.6 * rand());
    const cx = rand() * w;
    const cw = w * (0.15 + 0.35 * rand());
    const ch = (3 + rand() * (pal.rain ? 22 : 7)) * s;
    const col = pal.rain ? mix(sky[0]!, [70, 75, 85], 0.45) : mix(sky[1]!, pal.bigSun ? sunCore : [255, 255, 255], 0.35);
    ctx.fillStyle = rgba(col, pal.rain ? 0.85 : 0.55);
    ctx.beginPath();
    ctx.ellipse(cx, cy, cw / 2, ch, 0, 0, Math.PI * 2);
    ctx.fill();
    if (pal.rain && rand() < 0.6) {
      // Zavesa kiše ispod oblaka
      const rg = ctx.createLinearGradient(0, cy, 0, horizonY);
      rg.addColorStop(0, rgba(col, 0.45));
      rg.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = rg;
      const lean = (rand() - 0.5) * 60 * s;
      ctx.beginPath();
      ctx.moveTo(cx - cw * 0.3, cy);
      ctx.lineTo(cx + cw * 0.3, cy);
      ctx.lineTo(cx + cw * 0.3 + lean, horizonY);
      ctx.lineTo(cx - cw * 0.3 + lean, horizonY);
      ctx.closePath();
      ctx.fill();
    }
  }

  // ---- 5. Planina sa snegom (Kilimandžaro) + stenovita uzvišenja ----
  const farCol = mix(look.sil ? silCol : mix(groundFar, [90, 90, 110], 0.5), skyHorizon, 0.6);
  optional(ctx, hooks, "mountain", mountain, rand, (ctx, rand) => {
    const mx = w * (0.15 + 0.7 * rand());
    const mw = (380 + rand() * 220) * s;
    const mh = (90 + rand() * 60) * s;
    ctx.fillStyle = rgbString(farCol);
    ctx.beginPath();
    ctx.moveTo(mx - mw / 2, horizonY);
    ctx.quadraticCurveTo(mx - mw * 0.2, horizonY - mh * 0.7, mx - mw * 0.1, horizonY - mh);
    ctx.lineTo(mx + mw * 0.12, horizonY - mh * 0.98);
    ctx.quadraticCurveTo(mx + mw * 0.25, horizonY - mh * 0.65, mx + mw / 2, horizonY);
    ctx.closePath();
    ctx.fill();
    // Sneg na ravnom vrhu
    ctx.fillStyle = rgba(mix([250, 250, 255], skyHorizon, 0.45), 0.9);
    ctx.beginPath();
    ctx.moveTo(mx - mw * 0.1, horizonY - mh);
    ctx.lineTo(mx + mw * 0.12, horizonY - mh * 0.98);
    ctx.lineTo(mx + mw * 0.17, horizonY - mh * 0.84);
    for (let i = 0; i < 6; i++) ctx.lineTo(mx + mw * (0.12 - i * 0.05), horizonY - mh * (0.86 + (i % 2) * 0.05));
    ctx.lineTo(mx - mw * 0.15, horizonY - mh * 0.86);
    ctx.closePath();
    ctx.fill();
  });
  // Stenovita uzvišenja (kopje)
  const kopjes = Math.floor(rand() * 3);
  for (let i = 0; i < kopjes; i++) {
    const kx = rand() * w;
    const kw = (60 + rand() * 90) * s;
    ctx.fillStyle = rgbString(mix(farCol, look.sil ? silCol : groundFar, 0.3));
    ctx.beginPath();
    ctx.moveTo(kx - kw / 2, horizonY + 1);
    for (let k = 0; k < 5; k++) {
      const bx = kx - kw / 2 + (kw * (k + 0.5)) / 5;
      ctx.arc(bx, horizonY - (10 + rand() * 18) * s, (8 + rand() * 9) * s, Math.PI, 0);
    }
    ctx.lineTo(kx + kw / 2, horizonY + 1);
    ctx.closePath();
    ctx.fill();
  }

  // ---- 6. Daleki niz akacija ----
  ctx.fillStyle = rgbString(mix(look.sil ? silCol : mix(groundNear, [40, 60, 30], 0.5), skyHorizon, 0.5));
  for (let x = rand() * 40 * s; x < w; x += (25 + rand() * 90) * s) {
    const th = (8 + rand() * 10) * s;
    ctx.fillRect(x - 0.6 * s, horizonY - th, 1.2 * s, th);
    ctx.beginPath();
    ctx.ellipse(x, horizonY - th, (8 + rand() * 8) * s, 2.5 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // ---- 7. Ravnica ----
  const gg = ctx.createLinearGradient(0, horizonY, 0, h);
  gg.addColorStop(0, rgbString(mix(groundFar, skyHorizon, 0.3)));
  gg.addColorStop(1, rgbString(groundNear));
  ctx.fillStyle = gg;
  ctx.fillRect(0, horizonY, w, h - horizonY);
  // Prašina/izmaglica nad tlom
  const hz = ctx.createLinearGradient(0, horizonY - 20 * s, 0, horizonY + 40 * s);
  hz.addColorStop(0, rgba(skyHorizon, 0));
  hz.addColorStop(0.5, rgba(mix(skyHorizon, sunCore, 0.3), pal.moon ? 0.15 : 0.4));
  hz.addColorStop(1, rgba(skyHorizon, 0));
  ctx.fillStyle = hz;
  ctx.fillRect(0, horizonY - 20 * s, w, 60 * s);
  // Busenje trave na ravnici
  for (let i = 0; i < 160; i++) {
    const t = Math.pow(rand(), 1.4);
    const y = horizonY + 4 * s + t * (h - horizonY);
    const x = rand() * w;
    ctx.fillStyle = rgba(mix(groundNear, [0, 0, 0], 0.2), 0.35);
    ctx.beginPath();
    ctx.ellipse(x, y, (4 + t * 14) * s, (1 + t * 3) * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // ---- 8. Drveće + životinje (sortirano po y) ----
  const items: { y: number; draw: () => void }[] = [];
  const nAcacia = 1 + Math.floor(rand() * 3);
  for (let i = 0; i < nAcacia; i++) {
    const x = w * (0.05 + 0.9 * rand());
    const y = horizonY + (h - horizonY) * (0.1 + 0.5 * rand());
    const k = s * (1.1 + 1.6 * ((y - horizonY) / (h - horizonY))) * (0.9 + 0.4 * rand());
    const seed = rand();
    items.push({ y, draw: () => drawAcacia(ctx, x, y, k, look, groundNear, seed) });
  }
  optional(ctx, hooks, "baobab", baobab, rand, (ctx, rand) => {
    const x = w * (0.1 + 0.8 * rand());
    const y = horizonY + (h - horizonY) * (0.2 + 0.4 * rand());
    const k = s * (1 + 1.2 * ((y - horizonY) / (h - horizonY)));
    items.push({ y, draw: () => drawBaobab(ctx, rand, x, y, k, look) });
  });
  optional(ctx, hooks, "giraffes", giraffes, rand, (ctx, rand) => {
    const n = 1 + Math.floor(rand() * 3);
    const gx = w * (0.15 + 0.7 * rand());
    const gy = horizonY + (h - horizonY) * (0.15 + 0.35 * rand());
    const dir = rand() < 0.5 ? -1 : 1;
    for (let i = 0; i < n; i++) {
      const y = gy + (rand() - 0.5) * 12 * s;
      const k = s * (1.3 + 1.7 * ((y - horizonY) / (h - horizonY))) * (0.85 + 0.3 * rand());
      const x = gx + i * 70 * k * dir;
      items.push({ y, draw: () => drawGiraffe(ctx, x, y, k, dir, look) });
    }
  });
  optional(ctx, hooks, "elephants", elephants, rand, (ctx, rand) => {
    const n = 1 + Math.floor(rand() * 4);
    const ex = w * (0.1 + 0.8 * rand());
    const ey = horizonY + (h - horizonY) * (0.1 + 0.4 * rand());
    const dir = rand() < 0.5 ? -1 : 1;
    for (let i = 0; i < n; i++) {
      const y = ey + (rand() - 0.5) * 10 * s;
      const baby = i > 0 && rand() < 0.35;
      const k = s * (1.15 + 1.6 * ((y - horizonY) / (h - horizonY))) * (baby ? 0.55 : 0.9 + 0.2 * rand());
      const x = ex + i * 110 * s * dir;
      items.push({ y, draw: () => drawElephant(ctx, x, y, k, dir, look) });
    }
  });
  optional(ctx, hooks, "herd", herd, rand, (ctx, rand) => {
    const n = 4 + Math.floor(rand() * 9);
    const hx = w * (0.1 + 0.8 * rand());
    const hy = horizonY + (h - horizonY) * (0.05 + 0.25 * rand());
    const zebra = !look.sil && rand() < 0.5;
    for (let i = 0; i < n; i++) {
      const y = hy + rand() * 20 * s;
      const k = s * (0.85 + 1.3 * ((y - horizonY) / (h - horizonY)));
      const x = hx + (rand() - 0.5) * 260 * s;
      const dir = rand() < 0.5 ? -1 : 1;
      items.push({ y, draw: () => drawAntelope(ctx, x, y, k, dir, look, zebra) });
    }
  });
  items.sort((a, b) => a.y - b.y);
  for (const it of items) it.draw();

  // ---- 9. Visoka trava u prvom planu ----
  const grassCol = look.sil ? silCol : mix(groundNear, [0, 0, 0], 0.25);
  const blades = 220 + Math.floor(rand() * 160);
  ctx.strokeStyle = rgbString(grassCol);
  ctx.lineCap = "round";
  for (let i = 0; i < blades; i++) {
    const x = rand() * w;
    const len = (25 + rand() * 70) * s * (0.6 + 0.6 * Math.abs(Math.sin(x / (180 * s))));
    const bend = (rand() - 0.3) * 18 * s;
    ctx.lineWidth = Math.max(1, (1 + rand() * 1.5) * s);
    ctx.beginPath();
    ctx.moveTo(x, h + 2);
    ctx.quadraticCurveTo(x + bend * 0.3, h - len * 0.6, x + bend, h - len);
    ctx.stroke();
    if (rand() < 0.15) {
      // Klas
      ctx.fillStyle = rgbString(grassCol);
      ctx.beginPath();
      ctx.ellipse(x + bend, h - len - 4 * s, 1.6 * s, 5 * s, bend / (40 * s), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ---- 10. Ptice ----
  optional(ctx, hooks, "birds", birdsRoll < 0.45, rand, (ctx, rand) => {
    const n = 3 + Math.floor(rand() * 8);
    const bx = w * (0.2 + 0.6 * rand());
    const by = horizonY * (0.2 + 0.4 * rand());
    ctx.strokeStyle = rgba(look.sil ? silCol : mix(silCol, [0, 0, 0], 0.3), 0.85);
    ctx.lineWidth = Math.max(1, 1.6 * s);
    for (let i = 0; i < n; i++) {
      const x = bx + (rand() - 0.5) * 180 * s;
      const y = by + (rand() - 0.5) * 60 * s;
      const sp = (5 + rand() * 7) * s;
      ctx.beginPath();
      ctx.moveTo(x - sp, y - sp * 0.35);
      ctx.quadraticCurveTo(x - sp * 0.4, y - sp * 0.5, x, y);
      ctx.quadraticCurveTo(x + sp * 0.4, y - sp * 0.5, x + sp, y - sp * 0.35);
      ctx.stroke();
    }
  });
}

// ---------------------------------------------------------------------------

/** Akacija: deblo koje se račva u 2–3 grane + široka ravna krošnja u slojevima. */
function drawAcacia(ctx: CanvasRenderingContext2D, x: number, y: number, k: number, look: Look, ground: RGB, seed: number): void {
  const r = (a: number) => {
    const v = Math.sin(seed * 999 + a * 12.9898) * 43758.5453;
    return v - Math.floor(v);
  };
  const H = (90 + r(1) * 50) * k;
  const trunk = look.sil ? look.silCol : ([90, 65, 45] as RGB);
  const leaf = look.sil ? look.silCol : mix([90, 115, 50], ground, 0.25);
  ctx.strokeStyle = rgbString(trunk);
  ctx.lineCap = "round";
  ctx.lineWidth = 5 * k;
  const forkY = y - H * 0.45;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + 4 * k, y - H * 0.25, x, forkY);
  ctx.stroke();
  const tops: [number, number][] = [];
  const nb = 2 + Math.floor(r(2) * 2);
  for (let i = 0; i < nb; i++) {
    const tx = x + (i - (nb - 1) / 2) * 30 * k + (r(3 + i) - 0.5) * 10 * k;
    const ty = y - H * (0.88 + r(6 + i) * 0.1);
    tops.push([tx, ty]);
    ctx.lineWidth = 3 * k;
    ctx.beginPath();
    ctx.moveTo(x, forkY);
    ctx.quadraticCurveTo((x + tx) / 2, forkY - H * 0.1, tx, ty);
    ctx.stroke();
  }
  // Ravna krošnja: niz pljosnatih elipsi
  const cw = (70 + r(9) * 40) * k;
  const cy = y - H * 0.95;
  ctx.fillStyle = rgbString(leaf);
  ctx.beginPath();
  for (let i = 0; i < 9; i++) {
    const u = (i / 8 - 0.5) * 2;
    const bx = x + u * cw * 0.8;
    const by = cy - (1 - u * u) * 6 * k + (r(20 + i) - 0.5) * 4 * k;
    const rx = (18 + r(30 + i) * 10) * k * (1 - Math.abs(u) * 0.35);
    ctx.moveTo(bx + rx, by);
    ctx.ellipse(bx, by, rx, rx * 0.32, 0, 0, Math.PI * 2);
  }
  ctx.fill();
  if (!look.sil) {
    ctx.fillStyle = rgba(mix(leaf, [255, 250, 200], 0.2), 0.7);
    ctx.beginPath();
    ctx.ellipse(x - cw * 0.1, cy - 5 * k, cw * 0.6, 4 * k, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = rgba([40, 30, 20], 0.18);
    ctx.beginPath();
    ctx.ellipse(x, y + 2 * k, cw * 0.7, 5 * k, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  void tops;
}

/** Baobab: debelo stablo kao boca, kratke čvornovate grane. */
function drawBaobab(ctx: CanvasRenderingContext2D, rand: Rand, x: number, y: number, k: number, look: Look): void {
  const H = 110 * k;
  const col = look.sil ? look.silCol : ([125, 100, 85] as RGB);
  ctx.fillStyle = rgbString(col);
  ctx.beginPath();
  ctx.moveTo(x - 22 * k, y);
  ctx.quadraticCurveTo(x - 30 * k, y - H * 0.5, x - 12 * k, y - H * 0.85);
  ctx.lineTo(x + 12 * k, y - H * 0.85);
  ctx.quadraticCurveTo(x + 30 * k, y - H * 0.5, x + 22 * k, y);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = rgbString(col);
  ctx.lineCap = "round";
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI / 2 + (i / 6 - 0.5) * 2.4;
    const len = (20 + rand() * 18) * k;
    const sx = x + (i / 6 - 0.5) * 20 * k;
    const sy = y - H * 0.85;
    ctx.lineWidth = (4 + rand() * 2) * k;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    const ex = sx + Math.cos(a) * len;
    const ey = sy + Math.sin(a) * len;
    ctx.quadraticCurveTo(sx + Math.cos(a) * len * 0.5 + 4 * k, sy + Math.sin(a) * len * 0.3, ex, ey);
    ctx.stroke();
    ctx.lineWidth = 2 * k;
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.lineTo(ex + (rand() - 0.5) * 12 * k, ey - 8 * k);
    ctx.stroke();
  }
  if (!look.sil) {
    ctx.fillStyle = rgba([255, 240, 220], 0.15);
    ctx.fillRect(x - 18 * k, y - H * 0.8, 10 * k, H * 0.75);
  }
}

/** Žirafa: kosi trup, duge noge, dug vrat, glava sa rožićima; danju šare. */
function drawGiraffe(ctx: CanvasRenderingContext2D, x: number, y: number, k: number, dir: number, look: Look): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir, 1);
  const body = look.sil ? look.silCol : ([215, 160, 80] as RGB);
  const spot: RGB = [120, 70, 35];
  ctx.fillStyle = rgbString(body);
  ctx.strokeStyle = rgbString(body);
  ctx.lineCap = "round";
  // Noge
  // Noge: deblje gore, tanje dole
  for (const [lx, sw] of [[-19, -2], [-13, 2], [12, -2], [18, 3]] as const) {
    ctx.beginPath();
    ctx.moveTo((lx - 2.6) * k, -56 * k);
    ctx.lineTo((lx + sw - 1.3) * k, 0);
    ctx.lineTo((lx + sw + 1.3) * k, 0);
    ctx.lineTo((lx + 2.6) * k, -56 * k);
    ctx.closePath();
    ctx.fill();
  }
  // Trup (viši napred, krupniji)
  ctx.beginPath();
  ctx.ellipse(0, -62 * k, 29 * k, 14 * k, -0.2, 0, Math.PI * 2);
  ctx.fill();
  // Vrat (širok pri telu, sužava se ka glavi)
  ctx.beginPath();
  ctx.moveTo(10 * k, -70 * k);
  ctx.lineTo(29 * k, -122 * k);
  ctx.lineTo(37 * k, -120 * k);
  ctx.lineTo(28 * k, -62 * k);
  ctx.closePath();
  ctx.fill();
  // Glava + rožići + uvo
  ctx.beginPath();
  ctx.ellipse(39 * k, -122 * k, 9 * k, 4.5 * k, 0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 1.6 * k;
  ctx.beginPath();
  ctx.moveTo(33 * k, -126 * k);
  ctx.lineTo(32 * k, -132 * k);
  ctx.moveTo(36 * k, -127 * k);
  ctx.lineTo(36 * k, -133 * k);
  ctx.stroke();
  // Rep
  ctx.lineWidth = 1.4 * k;
  ctx.beginPath();
  ctx.moveTo(-23 * k, -62 * k);
  ctx.lineTo(-28 * k, -42 * k);
  ctx.stroke();
  if (!look.sil) {
    ctx.fillStyle = rgbString(spot);
    const spots: [number, number, number][] = [[-16, -64, 4.5], [-6, -60, 5], [5, -66, 4.5], [15, -60, 4], [-21, -57, 3.5], [-8, -70, 3.5], [19, -82, 3.4], [24, -96, 3], [29, -108, 2.6]];
    for (const [sx, sy, sr] of spots) {
      ctx.beginPath();
      ctx.ellipse(sx * k, sy * k, sr * k, sr * 0.8 * k, 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** Slon: veliki trup, glava sa uvom, surla nadole, debele noge, rep; danju kljove. */
function drawElephant(ctx: CanvasRenderingContext2D, x: number, y: number, k: number, dir: number, look: Look): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir, 1);
  const col = look.sil ? look.silCol : ([120, 115, 112] as RGB);
  ctx.fillStyle = rgbString(col);
  // Noge
  for (const lx of [-20, -9, 11, 22]) ctx.fillRect((lx - 4.5) * k, -26 * k, 9 * k, 26 * k);
  // Trup
  ctx.beginPath();
  ctx.ellipse(0, -36 * k, 32 * k, 20 * k, 0, 0, Math.PI * 2);
  ctx.fill();
  // Glava
  ctx.beginPath();
  ctx.ellipse(30 * k, -40 * k, 14 * k, 15 * k, 0, 0, Math.PI * 2);
  ctx.fill();
  // Surla
  ctx.strokeStyle = rgbString(col);
  ctx.lineCap = "round";
  ctx.lineWidth = 7 * k;
  ctx.beginPath();
  ctx.moveTo(40 * k, -36 * k);
  ctx.quadraticCurveTo(48 * k, -18 * k, 44 * k, -4 * k);
  ctx.stroke();
  // Uvo
  ctx.fillStyle = rgbString(look.sil ? col : mix(col, [0, 0, 0], 0.15));
  ctx.beginPath();
  ctx.ellipse(24 * k, -40 * k, 9 * k, 13 * k, -0.2, 0, Math.PI * 2);
  ctx.fill();
  // Rep
  ctx.lineWidth = 1.6 * k;
  ctx.beginPath();
  ctx.moveTo(-31 * k, -40 * k);
  ctx.lineTo(-35 * k, -22 * k);
  ctx.stroke();
  if (!look.sil) {
    ctx.strokeStyle = "rgb(240,235,220)";
    ctx.lineWidth = 2.2 * k;
    ctx.beginPath();
    ctx.moveTo(38 * k, -30 * k);
    ctx.quadraticCurveTo(46 * k, -24 * k, 50 * k, -28 * k);
    ctx.stroke();
    ctx.fillStyle = "rgba(20,20,20,0.8)";
    ctx.beginPath();
    ctx.arc(34 * k, -45 * k, 1.3 * k, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Antilopa (impala) ili zebra (danju, sa prugama). */
function drawAntelope(ctx: CanvasRenderingContext2D, x: number, y: number, k: number, dir: number, look: Look, zebra: boolean): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir, 1);
  const col = look.sil ? look.silCol : zebra ? ([245, 245, 240] as RGB) : ([185, 120, 65] as RGB);
  ctx.fillStyle = rgbString(col);
  ctx.strokeStyle = rgbString(col);
  ctx.lineCap = "round";
  ctx.lineWidth = 2 * k;
  for (const [lx, sw] of [[-9, -1], [-6, 1], [7, -1], [10, 1]] as const) {
    ctx.beginPath();
    ctx.moveTo(lx * k, -18 * k);
    ctx.lineTo((lx + sw) * k, 0);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.ellipse(0, -21 * k, 13 * k, 6 * k, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 3.4 * k;
  ctx.beginPath();
  ctx.moveTo(10 * k, -24 * k);
  ctx.lineTo(15 * k, -33 * k);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(17 * k, -34 * k, 5 * k, 2.6 * k, 0.4, 0, Math.PI * 2);
  ctx.fill();
  if (!zebra) {
    ctx.lineWidth = 1.2 * k;
    ctx.beginPath();
    ctx.moveTo(14 * k, -36 * k);
    ctx.quadraticCurveTo(11 * k, -44 * k, 15 * k, -48 * k);
    ctx.moveTo(16 * k, -36 * k);
    ctx.quadraticCurveTo(15 * k, -44 * k, 19 * k, -47 * k);
    ctx.stroke();
  } else {
    // Pruge zebre + griva
    ctx.strokeStyle = "rgba(25,25,25,0.9)";
    ctx.lineWidth = 1.6 * k;
    for (let i = -10; i <= 8; i += 3.5) {
      ctx.beginPath();
      ctx.moveTo(i * k, -27 * k);
      ctx.lineTo((i + 1.5) * k, -16 * k);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(10 * k, -27 * k);
    ctx.lineTo(15 * k, -36 * k);
    ctx.stroke();
  }
  ctx.restore();
}
