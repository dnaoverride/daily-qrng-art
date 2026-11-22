/**
 * Šuma — render v2: pogled sa proplanka na šumovitu dolinu.
 *
 * Redosled: nebo → zvezde (noć) → (hooks.sky) → sunce/mesec → (hooks.body) →
 * 4 sloja šumovitih brda (siluete jelki i listopadnog drveća, dalji u izmaglici)
 * sa maglom između → sunčevi zraci (opciono) → proplanak sa travom →
 * velika drveta sa strane (krošnje od dvobojnih grozdova) → srna / ptice / svici.
 *
 * QRNG bira odluke (paleta, horizont, sunce, šta se pojavljuje);
 * drveće i detalji iz PRNG-a seedovanog QRNG-om. Dimenzije relativne (s = w/1200).
 */
import type { QRNGStream } from "../qrng";
import { hslToRgb, rgbString, type RGB } from "../color";
import { prngFromStream, type Rand } from "../prng";
import { choice, optional, type ControlDef } from "./controls";
import { NO_HOOKS, type SceneHooks, type SkyLight } from "../sky-events";

type HSL = [number, number, number];

interface ForestPalette {
  name: string;
  light: SkyLight;
  sky: [HSL, HSL, HSL];
  sun: HSL;
  moon?: boolean;
  stars?: boolean;
  /** Boje lišća (bira se po grozdu) */
  foliage: HSL[];
  conifer: HSL;
  ground: [HSL, HSL]; // dalje → bliže
  trunk: HSL;
  mist: number;
  rays: number; // verovatnoća sunčevih zraka
  snow?: boolean;
}

const PALETTES: readonly ForestPalette[] = [
  {
    name: "spring-morning",
    light: "day",
    sky: [[205, 0.5, 0.62], [195, 0.4, 0.76], [55, 0.5, 0.86]],
    sun: [50, 1, 0.9],
    foliage: [[95, 0.5, 0.45], [110, 0.45, 0.4], [80, 0.55, 0.5]],
    conifer: [150, 0.35, 0.28],
    ground: [[95, 0.4, 0.5], [105, 0.45, 0.36]],
    trunk: [25, 0.3, 0.28],
    mist: 0.8,
    rays: 0.6,
  },
  {
    name: "summer",
    light: "day",
    sky: [[210, 0.6, 0.5], [205, 0.5, 0.66], [195, 0.4, 0.8]],
    sun: [50, 1, 0.94],
    foliage: [[120, 0.45, 0.32], [135, 0.4, 0.28], [105, 0.45, 0.36]],
    conifer: [155, 0.4, 0.2],
    ground: [[110, 0.4, 0.42], [120, 0.45, 0.28]],
    trunk: [25, 0.35, 0.22],
    mist: 0.3,
    rays: 0.3,
  },
  {
    name: "autumn",
    light: "day",
    sky: [[210, 0.45, 0.58], [35, 0.35, 0.75], [40, 0.6, 0.82]],
    sun: [45, 1, 0.88],
    foliage: [[28, 0.85, 0.5], [12, 0.75, 0.45], [45, 0.85, 0.55], [80, 0.35, 0.38]],
    conifer: [150, 0.3, 0.22],
    ground: [[40, 0.45, 0.5], [30, 0.5, 0.34]],
    trunk: [20, 0.35, 0.22],
    mist: 0.5,
    rays: 0.4,
  },
  {
    name: "golden-hour",
    light: "dusk",
    sky: [[220, 0.35, 0.5], [30, 0.6, 0.66], [38, 0.95, 0.66]],
    sun: [38, 1, 0.72],
    foliage: [[75, 0.45, 0.38], [55, 0.55, 0.42], [95, 0.4, 0.3]],
    conifer: [140, 0.3, 0.2],
    ground: [[60, 0.45, 0.45], [80, 0.4, 0.28]],
    trunk: [20, 0.4, 0.2],
    mist: 0.5,
    rays: 0.9,
  },
  {
    name: "night-fireflies",
    light: "night",
    sky: [[230, 0.55, 0.07], [228, 0.45, 0.14], [215, 0.35, 0.22]],
    sun: [50, 0.25, 0.92],
    moon: true,
    stars: true,
    foliage: [[180, 0.3, 0.16], [200, 0.3, 0.14], [165, 0.3, 0.18]],
    conifer: [200, 0.35, 0.1],
    ground: [[190, 0.3, 0.16], [200, 0.35, 0.09]],
    trunk: [220, 0.2, 0.1],
    mist: 0.4,
    rays: 0,
  },
  {
    name: "winter",
    light: "day",
    sky: [[210, 0.35, 0.68], [205, 0.25, 0.8], [210, 0.2, 0.9]],
    sun: [45, 0.6, 0.94],
    foliage: [[25, 0.15, 0.35]],
    conifer: [170, 0.25, 0.24],
    ground: [[210, 0.25, 0.92], [215, 0.2, 0.82]],
    trunk: [20, 0.2, 0.25],
    mist: 0.6,
    rays: 0.2,
    snow: true,
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

/** Kontrole za Studio. */
export const FOREST_CONTROLS: ControlDef[] = [
  { key: "palette", type: "choice", label: "palette", options: PALETTES.map((p) => p.name) },
  { key: "rays", type: "toggle", label: "rays" },
  { key: "deer", type: "toggle", label: "deer" },
  { key: "birds", type: "toggle", label: "birds" },
];

export function renderForest(
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
  const horizonY = Math.floor(h * (0.36 + 0.12 * stream.next_f()));
  const sunX = w * (0.15 + 0.7 * stream.next_f());
  const sunR = (pal.moon ? 16 + 12 * stream.next_f() : 24 + 20 * stream.next_f()) * s;
  const sunY = pal.light === "dusk" ? horizonY * (0.65 + 0.3 * stream.next_f()) : horizonY * (0.2 + 0.35 * stream.next_f());
  const hasRays = stream.next_f() < pal.rays;
  const coniferShare = 0.3 + 0.5 * stream.next_f();
  const deerRoll = stream.next_f();
  const birdsRoll = stream.next_f();
  const rand = prngFromStream(stream);

  const lightDir = sunX < w / 2 ? 1 : -1; // +1: svetlo sleva
  const sky = pal.sky.map((c) => hsl(c, dh));
  const skyHorizon = sky[2]!;
  const sunCol = hsl(pal.sun);
  const sunCore = mix(sunCol, [255, 252, 240], 0.6);
  const foliage = pal.foliage.map((c) => hsl(c, dh * 0.5));
  const conifer = hsl(pal.conifer, dh * 0.5);
  const groundFar = hsl(pal.ground[0], dh * 0.5);
  const groundNear = hsl(pal.ground[1], dh * 0.5);
  const trunk = hsl(pal.trunk);
  const fog = mix(skyHorizon, [255, 255, 255], pal.moon ? 0.05 : 0.25);
  const snowCol: RGB = pal.moon ? [190, 200, 225] : [248, 250, 255];

  // ---- 1. Nebo ----
  const g = ctx.createLinearGradient(0, 0, 0, horizonY);
  g.addColorStop(0, rgbString(sky[0]!));
  g.addColorStop(0.6, rgbString(sky[1]!));
  g.addColorStop(1, rgbString(skyHorizon));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

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
  ctx.fillRect(sunX - glowR, sunY - glowR, glowR * 2, glowR * 2);
  const core = ctx.createRadialGradient(sunX - sunR * 0.25, sunY - sunR * 0.25, 0, sunX, sunY, sunR);
  core.addColorStop(0, rgbString(sunCore));
  core.addColorStop(1, rgbString(sunCol));
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
  ctx.fill();
  hooks.body({ x: sunX, y: sunY, r: sunR, kind: pal.moon ? "moon" : "sun" });

  // ---- 4. Šumovita brda u 4 sloja ----
  const meadowY = horizonY + (h - horizonY) * (0.55 + 0.12 * rand());
  const layers = 4;
  for (let li = 0; li < layers; li++) {
    const t = li / (layers - 1);
    const baseY = horizonY + (meadowY - horizonY) * (0.05 + 0.85 * t);
    const haze = 0.7 * (1 - t) + 0.05;
    const treeCol = mix(mix(conifer, foliage[0]!, 0.4), fog, haze);
    const hillCol = mix(mix(groundNear, conifer, 0.5), fog, haze);
    // Brdo: dve sinusoide
    const amp = (20 + 40 * rand()) * s * (1 - t * 0.4);
    const f1 = (1 + rand() * 2) * Math.PI * 2;
    const p1 = rand() * 6.28;
    const f2 = (3 + rand() * 3) * Math.PI * 2;
    const p2 = rand() * 6.28;
    const hill = (x: number) => baseY - amp * (0.6 + 0.4 * Math.sin((x / w) * f1 + p1)) - amp * 0.25 * Math.sin((x / w) * f2 + p2);
    ctx.fillStyle = rgbString(hillCol);
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 8 * s) ctx.lineTo(x, hill(x));
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
    // Drveće na brdu (siluete)
    ctx.fillStyle = rgbString(treeCol);
    const treeH = (14 + 26 * t) * s;
    let x = -10 * s;
    while (x < w + 10 * s) {
      const th = treeH * (0.6 + 0.8 * rand());
      const y = hill(x) + 3 * s;
      if (rand() < coniferShare) {
        silhouetteConifer(ctx, x, y, th, th * 0.32);
      } else {
        silhouetteDeciduous(ctx, rand, x, y, th, th * 0.45);
      }
      x += th * (0.25 + 0.3 * rand());
    }
    if (pal.snow) {
      // Sneg na brdu ispod drveća — svetliji obod
      ctx.fillStyle = rgba(mix(snowCol, fog, haze), 0.6);
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let xx = 0; xx <= w; xx += 8 * s) ctx.lineTo(xx, hill(xx) + 4 * s);
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();
    }
    // Magla iznad sledećeg sloja
    if (li < layers - 1) {
      const mh = (meadowY - horizonY) * 0.18;
      const mg = ctx.createLinearGradient(0, baseY - mh, 0, baseY + mh * 0.6);
      mg.addColorStop(0, rgba(fog, 0));
      mg.addColorStop(0.7, rgba(fog, 0.45 * pal.mist));
      mg.addColorStop(1, rgba(fog, 0.25 * pal.mist));
      ctx.fillStyle = mg;
      ctx.fillRect(0, baseY - mh, w, mh * 1.6);
    }
  }

  // ---- 5. Sunčevi zraci ----
  optional(ctx, hooks, "rays", hasRays && !pal.moon, rand, (ctx, rand) => {
    const n = 5 + Math.floor(rand() * 6);
    for (let i = 0; i < n; i++) {
      const a = Math.PI / 2 + lightDir * -1 * (0.25 + rand() * 0.6) + (rand() - 0.5) * 0.25;
      const len = h * 1.4;
      const wdt = (20 + rand() * 60) * s;
      const ex = sunX + Math.cos(a) * len;
      const ey = sunY + Math.sin(a) * len;
      const rg = ctx.createLinearGradient(sunX, sunY, ex, ey);
      rg.addColorStop(0, rgba(sunCore, 0.0));
      rg.addColorStop(0.15, rgba(sunCore, 0.12 + 0.1 * rand()));
      rg.addColorStop(1, rgba(sunCore, 0));
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.moveTo(sunX, sunY);
      ctx.lineTo(ex + Math.cos(a + Math.PI / 2) * wdt, ey + Math.sin(a + Math.PI / 2) * wdt);
      ctx.lineTo(ex - Math.cos(a + Math.PI / 2) * wdt, ey - Math.sin(a + Math.PI / 2) * wdt);
      ctx.closePath();
      ctx.fill();
    }
  });

  // ---- 6. Proplanak ----
  const mg2 = ctx.createLinearGradient(0, meadowY, 0, h);
  mg2.addColorStop(0, rgbString(groundFar));
  mg2.addColorStop(1, rgbString(groundNear));
  ctx.fillStyle = mg2;
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let x = 0; x <= w; x += 10 * s) ctx.lineTo(x, meadowY + Math.sin(x / (90 * s)) * 4 * s);
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();
  // Travke
  if (!pal.snow) {
    const tufts = 160 + Math.floor(rand() * 120);
    for (let i = 0; i < tufts; i++) {
      const ty = meadowY + Math.pow(rand(), 0.7) * (h - meadowY);
      const tt = (ty - meadowY) / (h - meadowY);
      const tx = rand() * w;
      const len = (3 + rand() * 7) * s * (0.5 + tt * 1.8);
      ctx.strokeStyle = rgba(rand() < 0.5 ? mix(groundNear, [0, 0, 0], 0.25) : mix(groundFar, [255, 255, 220], 0.15), 0.6);
      ctx.lineWidth = Math.max(1, (0.8 + tt) * s);
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(tx + (rand() - 0.5) * len * 0.6, ty - len);
      ctx.stroke();
    }
  }

  // ---- 7. Srna na proplanku ----
  optional(ctx, hooks, "deer", deerRoll < 0.25, rand, (ctx, rand) => {
    const dx = w * (0.3 + 0.4 * rand());
    const dy = meadowY + (h - meadowY) * (0.2 + 0.25 * rand());
    drawDeer(ctx, dx, dy, s * (0.9 + 0.5 * rand()), mix(trunk, [0, 0, 0], 0.35), rand() < 0.5 ? 1 : -1);
  });

  // Boja svetla na drveću: toplo danju, hladna mesečina noću
  const tint: RGB = pal.moon ? [150, 175, 220] : [255, 250, 205];
  const tintAmt = pal.moon ? 0.1 : 0.2;

  // ---- 8a. Manja stabla u srednjem planu proplanka ----
  const mid = 2 + Math.floor(rand() * 4);
  for (let i = 0; i < mid; i++) {
    const x = w * (0.2 + 0.6 * rand());
    const by = meadowY + (h - meadowY) * (0.04 + 0.22 * rand());
    const th = (50 + rand() * 70) * s * (1 + (by - meadowY) / (h - meadowY));
    if (rand() < coniferShare) {
      drawConifer(ctx, rand, x, by, th, th * 0.3, conifer, lightDir, pal.snow ? snowCol : null, trunk, tint, tintAmt);
    } else {
      drawDeciduous(ctx, rand, x, by, th, foliage, trunk, lightDir, !!pal.snow, s, tint, tintAmt);
    }
  }

  // ---- 8b. Velika drveta sa strane ----
  const big = 2 + Math.floor(rand() * 3);
  for (let i = 0; i < big; i++) {
    const left = i % 2 === 0;
    const x = left ? w * (0.02 + 0.16 * rand()) : w * (0.82 + 0.16 * rand());
    const by = h - (h - meadowY) * (0.05 + 0.4 * rand());
    const th = (h - meadowY) * 0.6 + (180 + rand() * 160) * s;
    if (rand() < coniferShare) {
      drawConifer(ctx, rand, x, by, th, th * (0.28 + 0.08 * rand()), conifer, lightDir, pal.snow ? snowCol : null, trunk, tint, tintAmt);
    } else {
      drawDeciduous(ctx, rand, x, by, th, foliage, trunk, lightDir, !!pal.snow, s, tint, tintAmt);
    }
  }

  // ---- 9. Ptice / svici ----
  if (pal.moon) {
    const n = 40 + Math.floor(rand() * 50);
    for (let i = 0; i < n; i++) {
      const fx = rand() * w;
      const fy = meadowY - (meadowY - horizonY) * 0.2 + rand() * (h - meadowY) * 1.1;
      const r = (5 + rand() * 7) * s;
      const fg = ctx.createRadialGradient(fx, fy, 0, fx, fy, r);
      fg.addColorStop(0, "rgba(240,255,150,0.95)");
      fg.addColorStop(0.25, "rgba(200,255,120,0.35)");
      fg.addColorStop(1, "rgba(200,255,120,0)");
      ctx.fillStyle = fg;
      ctx.fillRect(fx - r, fy - r, r * 2, r * 2);
    }
  } else optional(ctx, hooks, "birds", birdsRoll < 0.4, rand, (ctx, rand) => {
    const n = 2 + Math.floor(rand() * 5);
    const bx = w * (0.2 + 0.6 * rand());
    const byy = horizonY * (0.2 + 0.4 * rand());
    ctx.strokeStyle = rgba(mix(trunk, [0, 0, 0], 0.4), 0.8);
    ctx.lineWidth = Math.max(1, 1.5 * s);
    ctx.lineCap = "round";
    for (let i = 0; i < n; i++) {
      const x = bx + (rand() - 0.5) * 150 * s;
      const y = byy + (rand() - 0.5) * 60 * s;
      const sp = (4 + rand() * 6) * s;
      ctx.beginPath();
      ctx.moveTo(x - sp, y - sp * 0.35);
      ctx.quadraticCurveTo(x - sp * 0.4, y - sp * 0.5, x, y);
      ctx.quadraticCurveTo(x + sp * 0.4, y - sp * 0.5, x + sp, y - sp * 0.35);
      ctx.stroke();
    }
  });
}

// ---------------------------------------------------------------------------
// Drveće
// ---------------------------------------------------------------------------

function silhouetteConifer(ctx: CanvasRenderingContext2D, x: number, y: number, th: number, tw: number): void {
  ctx.beginPath();
  ctx.moveTo(x, y - th);
  ctx.lineTo(x + tw * 0.55, y - th * 0.45);
  ctx.lineTo(x + tw * 0.35, y - th * 0.45);
  ctx.lineTo(x + tw, y);
  ctx.lineTo(x - tw, y);
  ctx.lineTo(x - tw * 0.35, y - th * 0.45);
  ctx.lineTo(x - tw * 0.55, y - th * 0.45);
  ctx.closePath();
  ctx.fill();
}

function silhouetteDeciduous(ctx: CanvasRenderingContext2D, rand: Rand, x: number, y: number, th: number, r: number): void {
  ctx.beginPath();
  const n = 3 + Math.floor(rand() * 2);
  for (let i = 0; i < n; i++) {
    const cx = x + (rand() - 0.5) * r * 1.1;
    const cy = y - th * (0.45 + 0.35 * rand());
    const rr = r * (0.55 + 0.35 * rand());
    ctx.moveTo(cx + rr, cy);
    ctx.arc(cx, cy, rr, 0, Math.PI * 2);
  }
  ctx.rect(x - r * 0.08, y - th * 0.4, r * 0.16, th * 0.4);
  ctx.fill();
}

/** Velika jelka: slojevi grana (tiers), osvetljena i senovita polovina, opcioni sneg. */
function drawConifer(
  ctx: CanvasRenderingContext2D,
  rand: Rand,
  x: number,
  baseY: number,
  th: number,
  tw: number,
  col: RGB,
  lightDir: number,
  snow: RGB | null,
  trunk: RGB,
  tint: RGB,
  tintAmt: number
): void {
  ctx.fillStyle = rgbString(mix(trunk, [0, 0, 0], 0.2));
  ctx.fillRect(x - tw * 0.07, baseY - th * 0.15, tw * 0.14, th * 0.15 + 2);
  const tiers = 5 + Math.floor(rand() * 3);
  const litCol = mix(col, tint, tintAmt);
  const shadeCol = mix(col, [0, 0, 0], 0.3);
  for (let i = 0; i < tiers; i++) {
    const t0 = i / tiers;
    const topY = baseY - th + th * t0 * 0.85;
    const botY = baseY - th * 0.12 - (th * 0.85 * (tiers - 1 - i)) / tiers + th * 0.08;
    const halfW = tw * (0.25 + 0.75 * ((i + 1) / tiers));
    const droop = (botY - topY) * 0.15;
    const tier = (side: number) => {
      ctx.beginPath();
      ctx.moveTo(x, topY);
      ctx.quadraticCurveTo(x + side * halfW * 0.5, topY + (botY - topY) * 0.55, x + side * halfW, botY);
      ctx.quadraticCurveTo(x + side * halfW * 0.5, botY - droop, x, botY - droop * 0.5);
      ctx.closePath();
      ctx.fill();
    };
    ctx.fillStyle = rgbString(lightDir > 0 ? litCol : shadeCol);
    tier(-1);
    ctx.fillStyle = rgbString(lightDir > 0 ? shadeCol : litCol);
    tier(1);
    if (snow) {
      ctx.fillStyle = rgbString(snow);
      ctx.beginPath();
      ctx.moveTo(x, topY);
      ctx.quadraticCurveTo(x - halfW * 0.45, topY + (botY - topY) * 0.45, x - halfW * 0.9, botY - droop * 0.4);
      ctx.quadraticCurveTo(x - halfW * 0.4, topY + (botY - topY) * 0.62, x, topY + (botY - topY) * 0.5);
      ctx.quadraticCurveTo(x + halfW * 0.4, topY + (botY - topY) * 0.62, x + halfW * 0.9, botY - droop * 0.4);
      ctx.quadraticCurveTo(x + halfW * 0.45, topY + (botY - topY) * 0.45, x, topY);
      ctx.fill();
    }
  }
}

/** Listopadno drvo: deblo sa granama + krošnja od dvobojnih grozdova (ili golo zimi). */
function drawDeciduous(
  ctx: CanvasRenderingContext2D,
  rand: Rand,
  x: number,
  baseY: number,
  th: number,
  foliage: RGB[],
  trunk: RGB,
  lightDir: number,
  bare: boolean,
  s: number,
  tint: RGB,
  tintAmt: number
): void {
  const trunkW = th * 0.055;
  const crownY = baseY - th * 0.58;
  const crownR = th * 0.38;
  // Deblo
  ctx.fillStyle = rgbString(trunk);
  ctx.beginPath();
  ctx.moveTo(x - trunkW, baseY);
  ctx.quadraticCurveTo(x - trunkW * 0.6, baseY - th * 0.3, x - trunkW * 0.45, crownY);
  ctx.lineTo(x + trunkW * 0.45, crownY);
  ctx.quadraticCurveTo(x + trunkW * 0.6, baseY - th * 0.3, x + trunkW, baseY);
  ctx.closePath();
  ctx.fill();
  // Grane
  ctx.strokeStyle = rgbString(trunk);
  ctx.lineCap = "round";
  const branches = bare ? 7 + Math.floor(rand() * 4) : 4;
  for (let i = 0; i < branches; i++) {
    const a = -Math.PI / 2 + (rand() - 0.5) * 2.2;
    const sy = crownY + th * 0.12 * rand();
    const len = crownR * (0.6 + 0.6 * rand());
    ctx.lineWidth = trunkW * (0.35 + 0.3 * rand());
    ctx.beginPath();
    ctx.moveTo(x, sy);
    const ex = x + Math.cos(a) * len;
    const ey = sy + Math.sin(a) * len;
    ctx.quadraticCurveTo(x + Math.cos(a) * len * 0.4, sy + Math.sin(a) * len * 0.7, ex, ey);
    ctx.stroke();
    if (bare) {
      for (let k = 0; k < 3; k++) {
        const b = a + (rand() - 0.5) * 1.4;
        const l2 = len * (0.25 + 0.3 * rand());
        ctx.lineWidth = Math.max(1, trunkW * 0.15);
        ctx.beginPath();
        ctx.moveTo(ex - Math.cos(a) * len * 0.3 * k * 0.4, ey - Math.sin(a) * len * 0.3 * k * 0.4);
        ctx.lineTo(ex + Math.cos(b) * l2, ey + Math.sin(b) * l2);
        ctx.stroke();
      }
    }
  }
  if (bare) {
    // Malo snega na granama
    ctx.fillStyle = "rgba(250,252,255,0.85)";
    for (let i = 0; i < 14; i++) {
      ctx.beginPath();
      ctx.ellipse(x + (rand() - 0.5) * crownR * 1.6, crownY - crownR * 0.2 + (rand() - 0.5) * crownR * 1.2, 5 * s, 2 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }
  // Krošnja: grozdovi — prvo senovita osnova, pa osvetljeni deo pomeren ka svetlu
  const clusters = 12 + Math.floor(rand() * 8);
  const cl: [number, number, number, RGB][] = [];
  for (let i = 0; i < clusters; i++) {
    const a = rand() * Math.PI * 2;
    const d = Math.sqrt(rand()) * crownR * 0.75;
    cl.push([x + Math.cos(a) * d * 1.15, crownY - crownR * 0.25 + Math.sin(a) * d * 0.85, crownR * (0.36 + 0.24 * rand()), foliage[Math.floor(rand() * foliage.length)]!]);
  }
  cl.sort((p, q) => p[1] - q[1]);
  for (const [cx, cy, r, c] of cl) {
    ctx.fillStyle = rgbString(mix(c, [0, 0, 0], 0.32));
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = rgbString(c);
    ctx.beginPath();
    ctx.arc(cx - lightDir * r * 0.18, cy - r * 0.18, r * 0.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = rgba(mix(c, tint, tintAmt * 1.5), 0.5);
    ctx.beginPath();
    ctx.arc(cx - lightDir * r * 0.3, cy - r * 0.32, r * 0.42, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawDeer(ctx: CanvasRenderingContext2D, x: number, y: number, k: number, col: RGB, dir: number): void {
  ctx.fillStyle = rgbString(col);
  ctx.strokeStyle = rgbString(col);
  ctx.lineCap = "round";
  const by = y - 22 * k;
  ctx.beginPath();
  ctx.ellipse(x, by, 14 * k, 6.5 * k, 0, 0, Math.PI * 2); // telo
  ctx.fill();
  ctx.lineWidth = 3.4 * k;
  ctx.beginPath();
  ctx.moveTo(x + dir * 10 * k, by - 3 * k);
  ctx.lineTo(x + dir * 15 * k, by - 16 * k); // vrat
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(x + dir * 18 * k, by - 17 * k, 4.5 * k, 2.6 * k, dir * 0.3, 0, Math.PI * 2); // glava
  ctx.fill();
  ctx.lineWidth = 1.2 * k;
  // rogovi
  for (const off of [-1.5, 1.5]) {
    ctx.beginPath();
    ctx.moveTo(x + dir * (15 + off * 0.3) * k, by - 19 * k);
    ctx.lineTo(x + dir * (13 + off) * k, by - 27 * k);
    ctx.moveTo(x + dir * (13.6 + off * 0.8) * k, by - 23.5 * k);
    ctx.lineTo(x + dir * (10 + off) * k, by - 25 * k);
    ctx.stroke();
  }
  ctx.lineWidth = 2 * k;
  for (const [lx, sw] of [[-10, -1], [-7, 1], [8, -1], [11, 1]] as const) {
    ctx.beginPath();
    ctx.moveTo(x + dir * lx * k, by + 4 * k);
    ctx.lineTo(x + dir * (lx + sw) * k, y);
    ctx.stroke();
  }
  // rep
  ctx.lineWidth = 2 * k;
  ctx.beginPath();
  ctx.moveTo(x - dir * 13 * k, by - 3 * k);
  ctx.lineTo(x - dir * 16 * k, by - 6 * k);
  ctx.stroke();
}
