/**
 * Polja i ravnica — render v2. Regioni: Vojvodina, Provansa, Toskana.
 *
 * Redosled: nebo → zvezde (plavi sat) → (hooks.sky) → sunce/mesec → (hooks.body)
 * → oblaci → daleki pejzaž (topole / planina / brežuljci) → polje:
 *   - redovi useva u perspektivi ka tački nestajanja (suncokret, lavanda, žito,
 *     vinograd), ili brežuljci-krpljenac (Toskana)
 * → kuća regiona (salaš sa đermom / kamena kuća / kuća na brdu sa čempresima)
 * → detalji u prvom planu (veliki suncokreti, lavanda, klasje sa bulkama, loza)
 * → ptice.
 *
 * QRNG bira region (težine), usev, paletu i detalje; hooks.meta({ place }) →
 * ime regiona ispod slike. Dimenzije relativne (s = w/1200).
 */
import type { QRNGStream } from "../qrng";
import { hslToRgb, rgbString, type RGB } from "../color";
import { prngFromStream, type Rand } from "../prng";
import { NO_HOOKS, type SceneHooks, type SkyLight } from "../sky-events";

type HSL = [number, number, number];

interface SkyPalette {
  name: string;
  light: SkyLight;
  sky: [HSL, HSL, HSL];
  sun: HSL;
  moon?: boolean;
  stars?: boolean;
  tint: HSL; // boja svetla na poljima
  dim: number; // zatamnjenje tla 0–1 (sumrak)
  clouds: number;
  storm?: boolean;
}

const SKIES: readonly SkyPalette[] = [
  { name: "morning-mist", light: "dusk", sky: [[210, 0.4, 0.62], [200, 0.35, 0.76], [40, 0.6, 0.85]], sun: [45, 1, 0.88], tint: [45, 0.6, 0.85], dim: 0.05, clouds: 0.3 },
  { name: "noon", light: "day", sky: [[208, 0.65, 0.5], [205, 0.55, 0.67], [200, 0.45, 0.83]], sun: [50, 1, 0.94], tint: [50, 0.5, 0.9], dim: 0, clouds: 0.7 },
  { name: "golden", light: "dusk", sky: [[215, 0.4, 0.52], [35, 0.6, 0.68], [40, 0.95, 0.72]], sun: [42, 1, 0.76], tint: [35, 0.85, 0.65], dim: 0.12, clouds: 0.5 },
  { name: "sunset", light: "dusk", sky: [[255, 0.4, 0.3], [335, 0.5, 0.52], [22, 0.95, 0.62]], sun: [25, 1, 0.66], tint: [15, 0.8, 0.55], dim: 0.35, clouds: 0.5 },
  { name: "blue-hour", light: "night", sky: [[232, 0.55, 0.12], [228, 0.45, 0.22], [25, 0.5, 0.42]], sun: [50, 0.25, 0.92], moon: true, stars: true, tint: [225, 0.4, 0.5], dim: 0.62, clouds: 0.2 },
  { name: "summer-storm", light: "day", sky: [[215, 0.2, 0.32], [210, 0.18, 0.48], [45, 0.45, 0.72]], sun: [48, 0.8, 0.9], tint: [45, 0.7, 0.75], dim: 0.15, clouds: 1, storm: true },
];

type Crop = "sunflower" | "wheat" | "lavender" | "vineyard" | "patchwork";

interface Region {
  key: string;
  weight: number;
  crops: [Crop, number][];
}

const REGIONS: readonly Region[] = [
  { key: "vojvodina", weight: 40, crops: [["sunflower", 0.5], ["wheat", 0.5]] },
  { key: "provence", weight: 30, crops: [["lavender", 0.75], ["sunflower", 0.25]] },
  { key: "tuscany", weight: 30, crops: [["patchwork", 0.6], ["vineyard", 0.4]] },
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

interface FCtx {
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
  s: number;
  horizonY: number;
  lightDir: number;
  tint: RGB;
  dim: number;
  haze: RGB;
  night: boolean;
}

/** Boja sa svetlom scene: osvetli tintom, zatamni u sumraku. */
function shade(f: FCtx, c: RGB, lit = 0.15): RGB {
  return mix(mix(c, f.tint, lit), [10, 12, 30], f.dim);
}

export function renderFields(
  ctx: CanvasRenderingContext2D,
  stream: QRNGStream,
  w: number,
  h: number,
  hooks: SceneHooks = NO_HOOKS
): void {
  const s = w / 1200;

  // ---- Odluke (QRNG) ----
  let roll = stream.next_f() * REGIONS.reduce((a, r) => a + r.weight, 0);
  let region = REGIONS[0]!;
  for (const r of REGIONS) {
    if (roll < r.weight) {
      region = r;
      break;
    }
    roll -= r.weight;
  }
  const cropRoll = stream.next_f();
  let crop: Crop = region.crops[0]![0];
  let acc = 0;
  for (const [c, p] of region.crops) {
    acc += p;
    if (cropRoll < acc) {
      crop = c;
      break;
    }
  }
  const pal = SKIES[stream.next_int(0, SKIES.length - 1)]!;
  const dh = stream.next_int(-8, 8);
  const horizonY = Math.floor(h * (0.42 + 0.12 * stream.next_f()));
  const sunX = w * (0.12 + 0.76 * stream.next_f());
  const sunR = (pal.moon ? 16 + 10 * stream.next_f() : 24 + 22 * stream.next_f()) * s;
  const sunY = pal.light === "dusk" ? horizonY * (0.55 + 0.35 * stream.next_f()) : horizonY * (0.15 + 0.35 * stream.next_f());
  const vpX = w * (0.25 + 0.5 * stream.next_f()); // tačka nestajanja
  const houseRoll = stream.next_f();
  const rand = prngFromStream(stream);
  hooks.meta?.({ place: region.key });

  const sky = pal.sky.map((c) => hsl(c, dh));
  const skyHorizon = sky[2]!;
  const sunCol = hsl(pal.sun);
  const sunCore = mix(sunCol, [255, 252, 240], 0.6);
  const f: FCtx = {
    ctx,
    w,
    h,
    s,
    horizonY,
    lightDir: sunX < w / 2 ? 1 : -1,
    tint: hsl(pal.tint),
    dim: pal.dim,
    haze: mix(skyHorizon, [255, 255, 255], pal.moon ? 0 : 0.15),
    night: !!pal.moon,
  };

  // ---- 1. Nebo ----
  const g = ctx.createLinearGradient(0, 0, 0, horizonY);
  g.addColorStop(0, rgbString(sky[0]!));
  g.addColorStop(0.6, rgbString(sky[1]!));
  g.addColorStop(1, rgbString(skyHorizon));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  if (pal.stars) {
    for (let i = 0; i < 160; i++) {
      const y = Math.pow(rand(), 1.4) * horizonY * 0.8;
      ctx.fillStyle = `rgba(255,255,255,${((0.2 + 0.7 * rand()) * (1 - y / horizonY)).toFixed(3)})`;
      ctx.fillRect(rand() * w, y, Math.max(0.8, s), Math.max(0.8, s));
    }
  }
  hooks.sky({ horizonY, light: pal.light });

  // ---- 2. Sunce / mesec ----
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

  // ---- 3. Oblaci (kumulusi; oluja: tamni nakovanj) ----
  const nClouds = Math.floor(pal.clouds * (2 + rand() * 5));
  for (let i = 0; i < nClouds; i++) {
    const cx = rand() * w;
    const cy = horizonY * (0.2 + 0.5 * rand());
    const cw = (90 + rand() * 200) * s * (pal.storm ? 1.6 : 1);
    const lit = pal.storm ? mix(sky[0]!, [200, 200, 205], 0.35) : mix(skyHorizon, [255, 255, 255], 0.75);
    const dark = mix(lit, sky[0]!, pal.storm ? 0.7 : 0.4);
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx - cw, cy - cw, cw * 2, cw);
    ctx.clip();
    const puffs = 5 + Math.floor(rand() * 5);
    const pp: [number, number, number][] = [];
    for (let k = 0; k < puffs; k++) {
      const u = (k / (puffs - 1) - 0.5) * 2;
      const r = cw * (0.13 + 0.12 * rand()) * (1 - Math.abs(u) * 0.4);
      pp.push([cx + u * cw * 0.45, cy - r * (0.4 + 0.5 * rand()), r]);
    }
    ctx.fillStyle = rgbString(dark);
    ctx.beginPath();
    for (const [px, py, r] of pp) {
      ctx.moveTo(px + r, py);
      ctx.arc(px, py, r, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.fillStyle = rgbString(lit);
    ctx.beginPath();
    for (const [px, py, r] of pp) {
      ctx.moveTo(px - f.lightDir * cw * 0.03 + r * 0.9, py - cw * 0.03);
      ctx.arc(px - f.lightDir * cw * 0.03, py - cw * 0.03, r * 0.9, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.restore();
  }
  if (pal.storm) {
    // Zavesa kiše u daljini
    const rx = w * (0.1 + 0.6 * rand());
    const rg = ctx.createLinearGradient(0, horizonY * 0.4, 0, horizonY);
    rg.addColorStop(0, "rgba(90,95,110,0.5)");
    rg.addColorStop(1, "rgba(90,95,110,0.1)");
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.moveTo(rx, horizonY * 0.4);
    ctx.lineTo(rx + 220 * s, horizonY * 0.4);
    ctx.lineTo(rx + 260 * s, horizonY);
    ctx.lineTo(rx + 30 * s, horizonY);
    ctx.closePath();
    ctx.fill();
  }

  // ---- 4. Daleki pejzaž ----
  if (region.key === "vojvodina") {
    drawPoplarRow(f, rand);
  } else if (region.key === "provence") {
    // Planina u daljini (Mont Ventoux) + niski brežuljci
    const mx = w * (0.2 + 0.6 * rand());
    ctx.fillStyle = rgbString(mix(shade(f, [120, 120, 150], 0), f.haze, 0.55));
    ctx.beginPath();
    ctx.moveTo(mx - 420 * s, horizonY);
    ctx.quadraticCurveTo(mx - 60 * s, horizonY - 120 * s, mx, horizonY - 115 * s);
    ctx.quadraticCurveTo(mx + 120 * s, horizonY - 110 * s, mx + 420 * s, horizonY);
    ctx.closePath();
    ctx.fill();
    drawRollingHills(f, rand, 2, [[90, 0.3, 0.45], [75, 0.35, 0.5]], 0.5, 18);
  } else {
    drawRollingHills(f, rand, 2, [[95, 0.3, 0.5], [60, 0.4, 0.55]], 0.45, 30);
  }

  // ---- 5. Polje ----
  if (crop === "patchwork") drawPatchwork(f, rand);
  else drawRows(f, rand, crop, vpX);

  // ---- 6. Kuća regiona ----
  if (houseRoll < 0.8) {
    if (region.key === "vojvodina") drawSalas(f, rand, w * (0.12 + 0.76 * rand()), horizonY + 3 * s, s * (0.9 + 0.3 * rand()));
    else if (region.key === "provence") drawMas(f, rand, w * (0.12 + 0.76 * rand()), horizonY + 4 * s, s * (0.9 + 0.3 * rand()));
    else drawTuscanHill(f, rand);
  }

  // ---- 7. Prvi plan ----
  drawForeground(f, rand, crop, sunX);

  // ---- 8. Ptice ----
  if (!pal.moon && rand() < 0.45) {
    const n = 3 + Math.floor(rand() * 6);
    const bx = w * (0.2 + 0.6 * rand());
    const by = horizonY * (0.2 + 0.4 * rand());
    ctx.strokeStyle = rgba(mix(sky[0]!, [0, 0, 0], 0.6), 0.8);
    ctx.lineWidth = Math.max(1, 1.5 * s);
    ctx.lineCap = "round";
    for (let i = 0; i < n; i++) {
      const x = bx + (rand() - 0.5) * 160 * s;
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

// ---------------------------------------------------------------------------

function drawPoplarRow(f: FCtx, rand: Rand): void {
  const { ctx, w, s, horizonY } = f;
  const col = mix(shade(f, [60, 90, 50], 0.1), f.haze, 0.45);
  ctx.fillStyle = rgbString(col);
  // 1–2 drvoreda topola (uske visoke krošnje) + niži šumarci
  let x = rand() * 60 * s;
  while (x < w) {
    if (rand() < 0.35) {
      const n = 4 + Math.floor(rand() * 8);
      for (let i = 0; i < n; i++) {
        const th = (40 + rand() * 25) * s;
        ctx.beginPath();
        ctx.ellipse(x, horizonY - th / 2, 5 * s, th / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        x += (10 + rand() * 4) * s;
      }
    } else {
      const bw = (30 + rand() * 80) * s;
      ctx.beginPath();
      ctx.moveTo(x, horizonY + 1);
      for (let k = 0; k <= 5; k++) ctx.lineTo(x + (bw * k) / 5, horizonY - (8 + rand() * 14) * s);
      ctx.lineTo(x + bw, horizonY + 1);
      ctx.closePath();
      ctx.fill();
      x += bw + rand() * 60 * s;
    }
  }
}

function drawRollingHills(f: FCtx, rand: Rand, layers: number, cols: HSL[], haze0: number, amp: number): void {
  const { ctx, w, s, horizonY } = f;
  for (let li = 0; li < layers; li++) {
    const col = mix(shade(f, hsl(cols[li % cols.length]!), 0.15), f.haze, haze0 * (1 - li / layers));
    const a = (amp + rand() * amp) * s;
    const f1 = (1 + rand() * 1.5) * Math.PI * 2;
    const p1 = rand() * 6.28;
    ctx.fillStyle = rgbString(col);
    ctx.beginPath();
    ctx.moveTo(0, horizonY + 2);
    for (let x = 0; x <= w; x += 8 * s) ctx.lineTo(x, horizonY - a * (0.5 + 0.5 * Math.sin((x / w) * f1 + p1)) + li * 6 * s);
    ctx.lineTo(w, horizonY + 2);
    ctx.closePath();
    ctx.fill();
  }
}

const CROP_COLORS: Record<Exclude<Crop, "patchwork">, { row: HSL; gap: HSL; top?: HSL }> = {
  sunflower: { row: [100, 0.45, 0.3], gap: [30, 0.35, 0.28], top: [48, 0.95, 0.55] },
  wheat: { row: [42, 0.7, 0.6], gap: [38, 0.6, 0.48] },
  lavender: { row: [270, 0.45, 0.55], gap: [80, 0.25, 0.4], top: [280, 0.5, 0.65] },
  vineyard: { row: [100, 0.45, 0.35], gap: [30, 0.3, 0.45] },
};

/** Redovi useva u perspektivi: klinovi od tačke nestajanja do dna slike. */
function drawRows(f: FCtx, rand: Rand, crop: Exclude<Crop, "patchwork">, vpX: number): void {
  const { ctx, w, h, s, horizonY } = f;
  const cc = CROP_COLORS[crop];
  const row = shade(f, hsl(cc.row), 0.2);
  const gap = shade(f, hsl(cc.gap), 0.1);
  const fieldTop = horizonY + 2 * s;
  // Podloga polja: od izmaglice ka boji reda
  const base = ctx.createLinearGradient(0, fieldTop, 0, h);
  base.addColorStop(0, rgbString(mix(mix(row, gap, 0.5), f.haze, 0.5)));
  base.addColorStop(0.3, rgbString(mix(row, gap, 0.5)));
  base.addColorStop(1, rgbString(gap));
  ctx.fillStyle = base;
  ctx.fillRect(0, fieldTop, w, h - fieldTop);
  if (crop === "wheat") {
    // Žito: bez redova — zlatno polje sa talasima vetra
    ctx.fillStyle = rgbString(mix(row, f.haze, 0.25));
    ctx.fillRect(0, fieldTop, w, h - fieldTop);
    const wg = ctx.createLinearGradient(0, fieldTop, 0, h);
    wg.addColorStop(0, rgba(f.haze, 0.45));
    wg.addColorStop(0.35, rgba(row, 0));
    wg.addColorStop(1, rgba(gap, 0.4));
    ctx.fillStyle = wg;
    ctx.fillRect(0, fieldTop, w, h - fieldTop);
    // Tragovi traktora (parovi linija ka tački nestajanja)
    ctx.strokeStyle = rgba(mix(gap, [60, 40, 20], 0.3), 0.35);
    for (let i = -4; i <= 4; i++) {
      const bx = vpX + i * w * 0.38;
      for (const o of [-1, 1]) {
        ctx.lineWidth = Math.max(1, 2.5 * s);
        ctx.beginPath();
        ctx.moveTo(vpX, fieldTop);
        ctx.lineTo(bx + o * 14 * s, h + 2);
        ctx.stroke();
      }
    }
    // Talasi vetra preko žita
    for (let i = 0; i < 40; i++) {
      const t = Math.pow(rand(), 1.3);
      const y = fieldTop + t * (h - fieldTop);
      const x = rand() * w;
      const len = (40 + rand() * 160) * s * (0.4 + t);
      ctx.strokeStyle = rgba(mix(row, [255, 245, 200], 0.4), 0.25);
      ctx.lineWidth = Math.max(1, (1 + t * 3) * s);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + len * 0.5, y - 4 * s * (1 + t), x + len, y);
      ctx.stroke();
    }
    // Okrugle bale sena po dubini (55%)
    if (rand() < 0.55) {
      const bales: [number, number][] = [];
      const n = 6 + Math.floor(rand() * 10);
      for (let i = 0; i < n; i++) bales.push([rand() * w, fieldTop + Math.pow(rand(), 1.5) * (h - fieldTop) * 0.8]);
      bales.sort((a, b) => a[1] - b[1]);
      for (const [bx, by] of bales) {
        const t = (by - fieldTop) / (h - fieldTop);
        const r = (3 + t * 30) * s;
        ctx.fillStyle = rgba([40, 30, 20], 0.2);
        ctx.beginPath();
        ctx.ellipse(bx - f.lightDir * r * 0.8, by + r * 0.1, r * 1.3, r * 0.25, 0, 0, Math.PI * 2);
        ctx.fill();
        const bale = shade(f, [205, 165, 85], 0.25);
        ctx.fillStyle = rgbString(bale);
        ctx.fillRect(bx - r, by - r * 1.6, r * 2, r * 1.6);
        ctx.fillStyle = rgbString(mix(bale, [255, 240, 200], 0.2));
        ctx.beginPath();
        ctx.ellipse(bx + f.lightDir * r, by - r * 0.8, r * 0.45, r * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = rgba(mix(bale, [0, 0, 0], 0.3), 0.6);
        ctx.lineWidth = Math.max(0.7, r * 0.06);
        ctx.beginPath();
        ctx.ellipse(bx + f.lightDir * r, by - r * 0.8, r * 0.25, r * 0.45, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    return;
  }
  // Redovi
  const n = crop === "vineyard" ? 26 : 34;
  const spread = w * 2.6;
  for (let i = 0; i < n; i++) {
    const u0 = (i / n - 0.5) * spread + w / 2;
    const u1 = ((i + 0.55) / n - 0.5) * spread + w / 2;
    ctx.fillStyle = rgbString(row);
    ctx.beginPath();
    ctx.moveTo(vpX, fieldTop);
    ctx.lineTo(u0, h + 2);
    ctx.lineTo(u1, h + 2);
    ctx.closePath();
    ctx.fill();
    // Osvetljena ivica reda
    ctx.strokeStyle = rgba(mix(row, f.tint, 0.4), 0.35);
    ctx.lineWidth = Math.max(1, 1.2 * s);
    ctx.beginPath();
    ctx.moveTo(vpX, fieldTop);
    ctx.lineTo(f.lightDir > 0 ? u0 : u1, h + 2);
    ctx.stroke();
  }
  // Teksture vrhova redova (cvetovi lavande / glave suncokreta u daljini / kočići vinograda)
  if (cc.top) {
    const top = shade(f, hsl(cc.top), 0.25);
    for (let k = 0; k < 2600; k++) {
      const t = Math.pow(rand(), 1.6);
      const y = fieldTop + t * (h - fieldTop);
      const i = Math.floor(rand() * n);
      const uc = ((i + 0.27) / n - 0.5) * spread + w / 2;
      const x = vpX + (uc - vpX) * t + (rand() - 0.5) * (spread / n) * 0.4 * t;
      const r = (0.6 + t * 4.5) * s;
      ctx.fillStyle = rgba(top, 0.85);
      ctx.beginPath();
      ctx.ellipse(x, y - r * 0.5, r * (crop === "lavender" ? 0.8 : 1), r * (crop === "lavender" ? 1.3 : 1), 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (crop === "vineyard") {
    ctx.strokeStyle = rgba(shade(f, [90, 70, 50], 0), 0.8);
    for (let i = 0; i < n; i++) {
      const uc = ((i + 0.27) / n - 0.5) * spread + w / 2;
      for (let t = 0.05; t < 1; t += 0.08 + t * 0.1) {
        const y = fieldTop + t * (h - fieldTop);
        const x = vpX + (uc - vpX) * t;
        ctx.lineWidth = Math.max(1, (0.6 + t * 2.5) * s);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y - (3 + t * 30) * s);
        ctx.stroke();
      }
    }
  }
  // Izmaglica pri horizontu
  const hz = ctx.createLinearGradient(0, fieldTop, 0, fieldTop + (h - fieldTop) * 0.25);
  hz.addColorStop(0, rgba(f.haze, 0.6));
  hz.addColorStop(1, rgba(f.haze, 0));
  ctx.fillStyle = hz;
  ctx.fillRect(0, fieldTop, w, (h - fieldTop) * 0.25);
}

/** Toskana: brežuljci-krpljenac (polja različitih boja), redovi na delu polja. */
function drawPatchwork(f: FCtx, rand: Rand): void {
  const { ctx, w, h, s, horizonY } = f;
  const cols: HSL[] = [[60, 0.45, 0.55], [42, 0.6, 0.6], [95, 0.35, 0.45], [30, 0.4, 0.45], [80, 0.4, 0.5]];
  const layers = 4;
  for (let li = 0; li < layers; li++) {
    const t = li / (layers - 1);
    const base = horizonY + (h - horizonY) * (0.12 + 0.75 * t);
    const amp = (25 + rand() * 30) * s * (1 + t);
    const f1 = (1 + rand() * 1.2) * Math.PI * 2;
    const p1 = rand() * 6.28;
    const hill = (x: number) => base - amp * (0.5 + 0.5 * Math.sin((x / w) * f1 + p1));
    // Krpe: vertikalne trake različitih useva preko brda
    // Međe između krpa: kose, blago zakrivljene linije (ne vertikalne)
    const edges: [number, number][] = []; // [x na vrhu brda, x na dnu]
    let ex = -60 * s;
    while (ex < w + 60 * s) {
      edges.push([ex, ex + (rand() - 0.5) * 220 * s * (0.5 + t)]);
      ex += (80 + rand() * 180) * s * (0.6 + t);
    }
    for (let e = 0; e < edges.length - 1; e++) {
      const [xa, xb] = edges[e]!;
      const [xc, xd] = edges[e + 1]!;
      const x = Math.min(xa, xc);
      const pw = Math.abs(xc - xa);
      const c = mix(shade(f, hsl(cols[Math.floor(rand() * cols.length)]!), 0.2), f.haze, 0.5 * (1 - t));
      ctx.fillStyle = rgbString(c);
      ctx.beginPath();
      ctx.moveTo(xb, h + 2);
      ctx.quadraticCurveTo((xa + xb) / 2 + 20 * s, (hill(xa) + h) / 2, xa, hill(xa));
      for (let xx = xa; xx <= xc; xx += 8 * s) ctx.lineTo(xx, hill(xx));
      ctx.lineTo(xc, hill(xc));
      ctx.quadraticCurveTo((xc + xd) / 2 + 20 * s, (hill(xc) + h) / 2, xd, h + 2);
      ctx.closePath();
      ctx.fill();
      // Brazde na nekim krpama
      if (rand() < 0.45) {
        ctx.strokeStyle = rgba(mix(c, [0, 0, 0], 0.2), 0.35);
        ctx.lineWidth = Math.max(1, (0.8 + t) * s);
        for (let k = 1; k < 8; k++) {
          ctx.beginPath();
          for (let xx = x; xx <= x + pw; xx += 10 * s) {
            const yy = hill(xx) + k * (6 + t * 8) * s;
            if (xx === x) ctx.moveTo(xx, yy);
            else ctx.lineTo(xx, yy);
          }
          ctx.stroke();
        }
      }
    }
  }
}

/** Salaš: dugačka bela kuća sa crepom, đeram (bunar), plast sena, dud. */
function drawSalas(f: FCtx, rand: Rand, x: number, y: number, k: number): void {
  const { ctx } = f;
  const wall = shade(f, [240, 235, 225], 0.2);
  const roof = shade(f, [150, 80, 55], 0.1);
  const dark = shade(f, [60, 45, 35], 0);
  // Dud/drvo iza
  ctx.fillStyle = rgbString(shade(f, [55, 85, 45], 0.1));
  ctx.beginPath();
  ctx.arc(x + 70 * k, y - 38 * k, 26 * k, 0, Math.PI * 2);
  ctx.arc(x + 88 * k, y - 30 * k, 18 * k, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(x + 72 * k, y - 20 * k, 4 * k, 20 * k);
  // Kuća
  ctx.fillStyle = rgbString(wall);
  ctx.fillRect(x - 55 * k, y - 22 * k, 110 * k, 22 * k);
  ctx.fillStyle = rgbString(roof);
  ctx.beginPath();
  ctx.moveTo(x - 60 * k, y - 22 * k);
  ctx.lineTo(x - 48 * k, y - 40 * k);
  ctx.lineTo(x + 48 * k, y - 40 * k);
  ctx.lineTo(x + 60 * k, y - 22 * k);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(x + 20 * k, y - 48 * k, 5 * k, 10 * k); // dimnjak
  ctx.fillStyle = f.night ? "rgb(255,205,120)" : rgbString(dark);
  for (let i = 0; i < 4; i++) ctx.fillRect(x - 45 * k + i * 24 * k, y - 16 * k, 7 * k, 8 * k);
  if (f.night) {
    const gw = ctx.createRadialGradient(x, y - 12 * k, 0, x, y - 12 * k, 70 * k);
    gw.addColorStop(0, "rgba(255,200,110,0.3)");
    gw.addColorStop(1, "rgba(255,200,110,0)");
    ctx.fillStyle = gw;
    ctx.fillRect(x - 70 * k, y - 80 * k, 140 * k, 100 * k);
  }
  // Senka zida
  ctx.fillStyle = "rgba(0,0,0,0.12)";
  ctx.fillRect(f.lightDir > 0 ? x + 20 * k : x - 55 * k, y - 22 * k, 35 * k, 22 * k);
  // Đeram: račvasti stub, dugačka motka sa tegom, uže sa kofom
  const dx = x - 95 * k;
  ctx.strokeStyle = rgbString(dark);
  ctx.lineCap = "round";
  ctx.lineWidth = 3 * k;
  ctx.beginPath();
  ctx.moveTo(dx, y);
  ctx.lineTo(dx, y - 42 * k);
  ctx.moveTo(dx, y - 42 * k);
  ctx.lineTo(dx - 4 * k, y - 48 * k);
  ctx.moveTo(dx, y - 42 * k);
  ctx.lineTo(dx + 4 * k, y - 48 * k);
  ctx.stroke();
  ctx.lineWidth = 2 * k;
  ctx.beginPath();
  ctx.moveTo(dx - 30 * k, y - 22 * k);
  ctx.lineTo(dx + 50 * k, y - 66 * k);
  ctx.stroke();
  ctx.lineWidth = 1 * k;
  ctx.beginPath();
  ctx.moveTo(dx + 50 * k, y - 66 * k);
  ctx.lineTo(dx + 50 * k, y - 14 * k);
  ctx.stroke();
  ctx.fillStyle = rgbString(dark);
  ctx.fillRect(dx - 34 * k, y - 26 * k, 7 * k, 7 * k);
  ctx.fillRect(dx + 46 * k, y - 16 * k, 8 * k, 10 * k); // bunar (ograda)
  // Plast sena
  if (rand() < 0.7) {
    const hx = x + 120 * k;
    ctx.fillStyle = rgbString(shade(f, [200, 165, 90], 0.2));
    ctx.beginPath();
    ctx.moveTo(hx - 16 * k, y);
    ctx.quadraticCurveTo(hx - 16 * k, y - 34 * k, hx, y - 38 * k);
    ctx.quadraticCurveTo(hx + 16 * k, y - 34 * k, hx + 16 * k, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = rgbString(dark);
    ctx.fillRect(hx - 1 * k, y - 46 * k, 2 * k, 10 * k);
  }
}

/** Provansalska kamena kuća (mas): kamen, crep, plavi kapci, čempresi i maslina. */
function drawMas(f: FCtx, rand: Rand, x: number, y: number, k: number): void {
  const { ctx } = f;
  const stone = shade(f, [215, 195, 160], 0.2);
  const roof = shade(f, [190, 100, 65], 0.1);
  for (const cx of [x - 70 * k, x - 82 * k]) drawCypressF(f, cx, y, 60 * k);
  ctx.fillStyle = rgbString(stone);
  ctx.fillRect(x - 45 * k, y - 30 * k, 90 * k, 30 * k);
  ctx.fillRect(x + 10 * k, y - 44 * k, 30 * k, 14 * k);
  ctx.fillStyle = rgbString(roof);
  ctx.beginPath();
  ctx.moveTo(x - 50 * k, y - 30 * k);
  ctx.lineTo(x - 30 * k, y - 40 * k);
  ctx.lineTo(x + 8 * k, y - 40 * k);
  ctx.lineTo(x + 8 * k, y - 30 * k);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + 6 * k, y - 44 * k);
  ctx.lineTo(x + 25 * k, y - 52 * k);
  ctx.lineTo(x + 44 * k, y - 44 * k);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = f.night ? "rgb(255,205,120)" : rgbString(shade(f, [90, 130, 160], 0.1));
  for (let i = 0; i < 3; i++) ctx.fillRect(x - 35 * k + i * 20 * k, y - 22 * k, 7 * k, 9 * k);
  ctx.fillStyle = "rgba(0,0,0,0.12)";
  ctx.fillRect(f.lightDir > 0 ? x + 10 * k : x - 45 * k, y - 30 * k, 35 * k, 30 * k);
  // Maslina
  const ox = x + 75 * k;
  ctx.strokeStyle = rgbString(shade(f, [90, 75, 60], 0));
  ctx.lineWidth = 3 * k;
  ctx.beginPath();
  ctx.moveTo(ox, y);
  ctx.quadraticCurveTo(ox + 4 * k, y - 12 * k, ox - 2 * k, y - 20 * k);
  ctx.stroke();
  ctx.fillStyle = rgbString(shade(f, [130, 145, 110], 0.15));
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const bx = ox + (rand() - 0.5) * 34 * k;
    const by = y - 26 * k + (rand() - 0.5) * 12 * k;
    ctx.moveTo(bx + 11 * k, by);
    ctx.arc(bx, by, (8 + rand() * 5) * k, 0, Math.PI * 2);
  }
  ctx.fill();
}

function drawCypressF(f: FCtx, x: number, y: number, H: number): void {
  const { ctx } = f;
  ctx.fillStyle = rgbString(shade(f, [40, 70, 45], 0.05));
  ctx.beginPath();
  ctx.moveTo(x, y - H);
  ctx.quadraticCurveTo(x + H * 0.11, y - H * 0.55, x + H * 0.06, y);
  ctx.lineTo(x - H * 0.06, y);
  ctx.quadraticCurveTo(x - H * 0.11, y - H * 0.55, x, y - H);
  ctx.fill();
}

/** Toskana: kuća na vrhu brda, vijugav beli put sa drvoredom čempresa. */
function drawTuscanHill(f: FCtx, rand: Rand): void {
  const { ctx, w, h, s, horizonY } = f;
  const hx = w * (0.2 + 0.6 * rand());
  const topY = horizonY + (h - horizonY) * 0.08;
  // Brdo ispod kuće
  ctx.fillStyle = rgbString(mix(shade(f, [110, 130, 70], 0.2), f.haze, 0.3));
  ctx.beginPath();
  ctx.moveTo(hx - 260 * s, topY + 70 * s);
  ctx.quadraticCurveTo(hx, topY - 30 * s, hx + 260 * s, topY + 70 * s);
  ctx.closePath();
  ctx.fill();
  // Kuća
  const k = s;
  const stone = shade(f, [225, 195, 150], 0.2);
  ctx.fillStyle = rgbString(stone);
  ctx.fillRect(hx - 30 * k, topY - 20 * k, 60 * k, 22 * k);
  ctx.fillRect(hx - 8 * k, topY - 38 * k, 16 * k, 20 * k);
  ctx.fillStyle = rgbString(shade(f, [175, 90, 60], 0.1));
  ctx.beginPath();
  ctx.moveTo(hx - 34 * k, topY - 20 * k);
  ctx.lineTo(hx, topY - 30 * k);
  ctx.lineTo(hx + 34 * k, topY - 20 * k);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(hx - 10 * k, topY - 42 * k, 20 * k, 4 * k);
  // Vijugav put od dna do kuće + čempresi duž puta
  const road = shade(f, [235, 220, 190], 0.25);
  const pts: [number, number][] = [];
  const steps = 40;
  const x0 = w * (0.3 + 0.4 * rand());
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const y = h - (h - topY) * t;
    const x = x0 + (hx - x0) * t + Math.sin(t * Math.PI * 3) * 120 * s * (1 - t);
    pts.push([x, y]);
  }
  ctx.strokeStyle = rgbString(road);
  ctx.lineCap = "round";
  for (let i = 1; i < pts.length; i++) {
    const t = i / steps;
    ctx.lineWidth = (18 * (1 - t) + 2) * s;
    ctx.beginPath();
    ctx.moveTo(pts[i - 1]![0], pts[i - 1]![1]);
    ctx.lineTo(pts[i]![0], pts[i]![1]);
    ctx.stroke();
  }
  for (let i = steps; i >= 2; i -= 2) {
    const t = i / steps;
    const [px, py] = pts[i]!;
    const off = (18 * (1 - t) + 6) * s;
    const H = (14 + 80 * (1 - t)) * s;
    drawCypressF(f, px - off, py, H);
    drawCypressF(f, px + off, py, H);
  }
}

/** Prvi plan: veliki suncokreti / žbunovi lavande / klasje sa bulkama / loza sa grožđem. */
function drawForeground(f: FCtx, rand: Rand, crop: Crop, sunX: number): void {
  const { ctx, w, h, s } = f;
  if (crop === "sunflower") {
    const n = 7 + Math.floor(rand() * 6);
    for (let i = 0; i < n; i++) {
      const x = (i + 0.5 + (rand() - 0.5) * 0.6) * (w / n);
      const r = (24 + rand() * 18) * s;
      const y = h - (30 + rand() * 90) * s;
      // Stabljika i list
      ctx.strokeStyle = rgbString(shade(f, [80, 120, 50], 0.15));
      ctx.lineWidth = 5 * s;
      ctx.beginPath();
      ctx.moveTo(x, h + 2);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.fillStyle = rgbString(shade(f, [70, 115, 45], 0.15));
      ctx.beginPath();
      ctx.ellipse(x + 16 * s, y + 45 * s, 18 * s, 8 * s, 0.5, 0, Math.PI * 2);
      ctx.fill();
      // Glava okrenuta ka suncu (elipsa u perspektivi)
      const face = sunX < x ? -1 : 1;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(0.75, 1);
      const petals = 18;
      ctx.fillStyle = rgbString(shade(f, [250, 195, 30], 0.25));
      for (let p = 0; p < petals; p++) {
        const a = (p / petals) * Math.PI * 2;
        ctx.beginPath();
        ctx.ellipse(Math.cos(a) * r * 0.8 + face * 4 * s, Math.sin(a) * r * 0.8, r * 0.38, r * 0.14, a, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = rgbString(shade(f, [95, 60, 25], 0));
      ctx.beginPath();
      ctx.arc(face * 4 * s, 0, r * 0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(40,25,10,0.5)";
      for (let d = 0; d < 20; d++) {
        const a = d * 2.4;
        const rr = Math.sqrt(d / 20) * r * 0.5;
        ctx.beginPath();
        ctx.arc(face * 4 * s + Math.cos(a) * rr, Math.sin(a) * rr, 1.4 * s, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  } else if (crop === "lavender") {
    const n = 9 + Math.floor(rand() * 6);
    for (let i = 0; i < n; i++) {
      const x = (i + 0.5) * (w / n) + (rand() - 0.5) * 30 * s;
      const by = h + 10 * s;
      const bw = (45 + rand() * 30) * s;
      for (let st = 0; st < 26; st++) {
        const a = -Math.PI / 2 + (st / 25 - 0.5) * 1.6;
        const len = (50 + rand() * 40) * s;
        const ex = x + Math.cos(a) * len * 0.9;
        const ey = by + Math.sin(a) * len;
        ctx.strokeStyle = rgbString(shade(f, [100, 120, 80], 0.1));
        ctx.lineWidth = 1.4 * s;
        ctx.beginPath();
        ctx.moveTo(x + (st / 25 - 0.5) * bw * 0.4, by);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        ctx.fillStyle = rgbString(shade(f, [150, 110, 200], 0.2)); // cvet lavande
        ctx.beginPath();
        ctx.ellipse(ex, ey - 5 * s, 3 * s, 9 * s, a + Math.PI / 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (crop === "wheat" || crop === "patchwork") {
    // Klasje + bulke
    const n = 160;
    for (let i = 0; i < n; i++) {
      const x = rand() * w;
      const len = (40 + rand() * 70) * s;
      const bend = (rand() - 0.3) * 14 * s;
      ctx.strokeStyle = rgbString(shade(f, [205, 170, 90], 0.25));
      ctx.lineWidth = 1.5 * s;
      ctx.beginPath();
      ctx.moveTo(x, h + 2);
      ctx.quadraticCurveTo(x + bend * 0.3, h - len * 0.6, x + bend, h - len);
      ctx.stroke();
      ctx.fillStyle = rgbString(shade(f, [225, 190, 100], 0.25));
      ctx.beginPath();
      ctx.ellipse(x + bend, h - len - 6 * s, 2.4 * s, 8 * s, bend / (30 * s), 0, Math.PI * 2);
      ctx.fill();
    }
    const poppies = 10 + Math.floor(rand() * 14);
    for (let i = 0; i < poppies; i++) {
      const x = rand() * w;
      const y = h - (10 + rand() * 80) * s;
      const r = (5 + rand() * 4) * s;
      ctx.fillStyle = rgbString(shade(f, [220, 40, 35], 0.15));
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(30,20,20,0.85)";
      ctx.beginPath();
      ctx.arc(x, y, r * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (crop === "vineyard") {
    // Loza sa grozdovima u prvom planu
    const n = 4 + Math.floor(rand() * 3);
    for (let i = 0; i < n; i++) {
      const x = (i + 0.5) * (w / n) + (rand() - 0.5) * 40 * s;
      ctx.fillStyle = rgbString(shade(f, [90, 120, 55], 0.15));
      for (let l = 0; l < 6; l++) {
        const lx = x + (rand() - 0.5) * 70 * s;
        const ly = h - (20 + rand() * 60) * s;
        ctx.beginPath();
        ctx.arc(lx, ly, (12 + rand() * 8) * s, 0, Math.PI * 2);
        ctx.fill();
      }
      const gx = x + (rand() - 0.5) * 30 * s;
      const gy = h - (25 + rand() * 30) * s;
      ctx.fillStyle = rgbString(shade(f, [95, 45, 110], 0.2));
      for (let row = 0; row < 5; row++) {
        for (let c = 0; c < 5 - row; c++) {
          ctx.beginPath();
          ctx.arc(gx + (c - (5 - row) / 2) * 5 * s, gy + row * 5 * s, 3 * s, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }
}
