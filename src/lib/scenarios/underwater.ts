/**
 * Podvodni svet — render v2.
 *
 * Redosled: voda (svetlo pri površini → dubina) → talasasta površina odozgo
 * (opciono) → zraci sa površine → daleke stene u izmaglici → (hooks.sky, light:
 * "underwater" → raža / kit / kraken, iza grebena) → daleko jato → peščano dno
 * sa kaustikama → greben (razgranati korali, lepezasti korali, mozak-korali,
 * sunđeri, morske sase, kelp) → ribe (jato + tropske), kornjača, meduze,
 * udičarka (ponor) → sidro (opciono) → plankton / mehurići.
 *
 * Nema neba ni sunca → ne zove hooks.body. QRNG bira odluke; detalji iz PRNG-a.
 * Dimenzije relativne (s = w/1200).
 */
import type { QRNGStream } from "../qrng";
import { hslToRgb, rgbString, type RGB } from "../color";
import { prngFromStream, type Rand } from "../prng";
import { choice, optional, type ControlDef } from "./controls";
import { NO_HOOKS, type SceneHooks } from "../sky-events";

type HSL = [number, number, number];

interface SeaPalette {
  name: string;
  top: HSL; // pri površini
  mid: HSL;
  deep: HSL; // pri dnu
  sand: HSL;
  coral: HSL[]; // boje korala
  fish: HSL[];
  rays: number; // jačina zraka 0–1
  kelp: number; // udeo kelpa 0–1
  abyss?: boolean; // ponor: tamno, bioluminiscencija
  surfaceTint?: HSL; // boja svetla odozgo (zalazak)
}

const PALETTES: readonly SeaPalette[] = [
  {
    name: "tropical-reef",
    top: [185, 0.7, 0.62],
    mid: [195, 0.75, 0.42],
    deep: [210, 0.75, 0.22],
    sand: [45, 0.45, 0.7],
    coral: [[350, 0.75, 0.62], [20, 0.85, 0.6], [290, 0.5, 0.6], [50, 0.85, 0.6]],
    fish: [[45, 1, 0.55], [200, 0.9, 0.55], [15, 0.95, 0.55], [300, 0.6, 0.6]],
    rays: 0.8,
    kelp: 0.1,
  },
  {
    name: "deep-blue",
    top: [200, 0.65, 0.42],
    mid: [215, 0.7, 0.26],
    deep: [225, 0.75, 0.1],
    sand: [210, 0.25, 0.35],
    coral: [[200, 0.4, 0.5], [260, 0.35, 0.5], [180, 0.4, 0.45]],
    fish: [[200, 0.5, 0.7], [50, 0.6, 0.6]],
    rays: 0.5,
    kelp: 0.2,
  },
  {
    name: "kelp-forest",
    top: [165, 0.45, 0.52],
    mid: [175, 0.5, 0.32],
    deep: [190, 0.6, 0.14],
    sand: [50, 0.3, 0.45],
    coral: [[30, 0.6, 0.5], [10, 0.5, 0.45]],
    fish: [[30, 0.8, 0.55], [60, 0.5, 0.6]],
    rays: 0.7,
    kelp: 0.95,
  },
  {
    name: "sunset-surface",
    top: [30, 0.6, 0.62],
    mid: [210, 0.5, 0.35],
    deep: [235, 0.6, 0.14],
    sand: [30, 0.4, 0.5],
    coral: [[340, 0.6, 0.55], [25, 0.8, 0.55], [280, 0.4, 0.5]],
    fish: [[40, 1, 0.6], [330, 0.7, 0.6]],
    rays: 0.9,
    kelp: 0.2,
    surfaceTint: [35, 0.9, 0.7],
  },
  {
    name: "abyss",
    top: [225, 0.55, 0.14],
    mid: [235, 0.6, 0.07],
    deep: [240, 0.6, 0.03],
    sand: [235, 0.3, 0.1],
    coral: [[180, 0.6, 0.35], [290, 0.5, 0.35]],
    fish: [[190, 0.8, 0.6], [300, 0.7, 0.6]],
    rays: 0.1,
    kelp: 0.1,
    abyss: true,
  },
  {
    name: "lagoon-shallow",
    top: [175, 0.6, 0.72],
    mid: [180, 0.6, 0.55],
    deep: [190, 0.6, 0.38],
    sand: [45, 0.55, 0.82],
    coral: [[10, 0.8, 0.65], [50, 0.85, 0.62], [330, 0.65, 0.65], [140, 0.4, 0.5]],
    fish: [[50, 1, 0.55], [210, 0.9, 0.5], [0, 0, 0.95]],
    rays: 1,
    kelp: 0.05,
  },
];

function hsl(c: HSL, dh = 0, dl = 0): RGB {
  return hslToRgb(c[0] + dh, c[1], Math.min(0.97, Math.max(0.01, c[2] + dl)));
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
export const UNDERWATER_CONTROLS: ControlDef[] = [
  { key: "palette", type: "choice", label: "palette", options: PALETTES.map((p) => p.name) },
  { key: "surface", type: "toggle", label: "surface" },
  { key: "turtle", type: "toggle", label: "turtle" },
  { key: "jellies", type: "toggle", label: "jellies" },
  { key: "anchor", type: "toggle", label: "anchor" },
  { key: "angler", type: "toggle", label: "angler" },
];

export function renderUnderwater(
  ctx: CanvasRenderingContext2D,
  stream: QRNGStream,
  w: number,
  h: number,
  hooks: SceneHooks = NO_HOOKS
): void {
  const s = w / 1200;

  // ---- Odluke (QRNG) ----
  const pal = PALETTES[choice(hooks, "palette", stream.next_int(0, PALETTES.length - 1), PALETTES.length)]!;
  const dh = stream.next_int(-10, 10);
  const floorY = h * (0.72 + 0.12 * stream.next_f());
  const showSurface = stream.next_f() < (pal.abyss ? 0 : 0.45);
  const turtle = stream.next_f() < 0.25;
  const jellies = stream.next_f() < (pal.abyss ? 0.9 : 0.35);
  const anchor = stream.next_f() < 0.15;
  const angler = pal.abyss && stream.next_f() < 0.5;
  const schoolCurve = stream.next_f();
  const rand = prngFromStream(stream);

  const top = hsl(pal.top, dh);
  const mid = hsl(pal.mid, dh);
  const deep = hsl(pal.deep, dh);
  const sand = hsl(pal.sand, dh * 0.5);
  const haze = mix(mid, top, 0.25);
  const lightCol = pal.surfaceTint ? hsl(pal.surfaceTint) : mix(top, [255, 255, 255], 0.6);
  const corals = pal.coral.map((c) => hsl(c, dh * 0.3));
  const fishCols = pal.fish.map((c) => hsl(c));

  // ---- 1. Voda ----
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, rgbString(top));
  g.addColorStop(0.45, rgbString(mid));
  g.addColorStop(1, rgbString(deep));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // ---- 2. Površina odozdo ----
  optional(ctx, hooks, "surface", showSurface, rand, (ctx, rand) => {
    const sh = h * 0.07;
    ctx.fillStyle = rgba(mix(lightCol, [255, 255, 255], 0.3), 0.55);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    for (let x = 0; x <= w; x += 6 * s) ctx.lineTo(x, sh + Math.sin(x / (40 * s)) * 6 * s + Math.sin(x / (13 * s)) * 3 * s);
    ctx.lineTo(w, 0);
    ctx.closePath();
    ctx.fill();
    // Mreža svetla na površini
    ctx.strokeStyle = rgba([255, 255, 255], 0.35);
    ctx.lineWidth = Math.max(1, 1.2 * s);
    for (let i = 0; i < 40; i++) {
      const x = rand() * w;
      const y = rand() * sh * 0.9;
      ctx.beginPath();
      ctx.ellipse(x, y, (10 + rand() * 30) * s, (2 + rand() * 4) * s, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  });

  // ---- 3. Zraci sa površine ----
  if (pal.rays > 0.05) {
    const n = 6 + Math.floor(rand() * 7);
    const tilt = (rand() - 0.5) * 0.5;
    for (let i = 0; i < n; i++) {
      const x0 = rand() * w;
      const bw = (20 + rand() * 70) * s;
      const len = h * (0.6 + 0.4 * rand());
      const x1 = x0 + Math.tan(tilt) * len;
      const rg = ctx.createLinearGradient(0, 0, 0, len);
      rg.addColorStop(0, rgba(lightCol, 0.18 * pal.rays));
      rg.addColorStop(1, rgba(lightCol, 0));
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.moveTo(x0 - bw * 0.3, 0);
      ctx.lineTo(x0 + bw * 0.3, 0);
      ctx.lineTo(x1 + bw, len);
      ctx.lineTo(x1 - bw, len);
      ctx.closePath();
      ctx.fill();
    }
  }


  // ---- 4. Daleke stene ----
  for (let layer = 0; layer < 2; layer++) {
    const col = mix(mix(deep, sand, 0.2), haze, 0.65 - layer * 0.25);
    ctx.fillStyle = rgbString(col);
    ctx.beginPath();
    ctx.moveTo(0, h);
    const base = floorY - (30 + layer * 10) * s;
    // Oble stene: niz kvadratnih krivih sa nasumičnim vrhovima
    let x = 0;
    let prevY = base;
    ctx.lineTo(0, prevY);
    while (x <= w + 60 * s) {
      const step = (50 + rand() * 110) * s;
      const rh = (15 + rand() * (75 - layer * 20)) * s;
      const ny = base - rh * (0.3 + 0.7 * rand());
      ctx.quadraticCurveTo(x + step * 0.5, base - rh * 1.25, x + step, ny);
      x += step;
      prevY = ny;
    }
    void prevY;
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
  }

  // Retki podvodni događaji (raža, kit, kraken) — ispred dalekih stena, iza grebena.
  // horizonY = cela visina: pipci krakena rastu odozdo, greben im prekriva podnožje.
  hooks.sky({ horizonY: h, light: "underwater", hasHorizon: false });

  // ---- 5. Daleko jato (sitne tačke duž krive) ----
  {
    const cx = w * (0.2 + 0.6 * schoolCurve);
    const cy = floorY * (0.3 + 0.3 * rand());
    const col = mix(haze, [255, 255, 255], 0.25);
    for (let i = 0; i < 90; i++) {
      const t = rand();
      const x = cx + (t - 0.5) * 300 * s + Math.sin(t * 6) * 20 * s;
      const y = cy + Math.sin(t * Math.PI * 2) * 30 * s + (rand() - 0.5) * 18 * s;
      ctx.fillStyle = rgba(col, 0.5);
      ctx.beginPath();
      ctx.ellipse(x, y, 3 * s, 1.2 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ---- 6. Peščano dno + kaustike ----
  const sg = ctx.createLinearGradient(0, floorY, 0, h);
  sg.addColorStop(0, rgbString(mix(sand, haze, 0.35)));
  sg.addColorStop(1, rgbString(mix(sand, deep, 0.25)));
  ctx.fillStyle = sg;
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let x = 0; x <= w; x += 8 * s) ctx.lineTo(x, floorY + Math.sin(x / (110 * s) + 1) * 8 * s + Math.sin(x / (37 * s)) * 3 * s);
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();
  if (!pal.abyss) {
    ctx.strokeStyle = rgba(mix(lightCol, [255, 255, 255], 0.4), 0.22 * pal.rays + 0.05);
    ctx.lineWidth = Math.max(1, 1.3 * s);
    for (let i = 0; i < 70; i++) {
      const x = rand() * w;
      const y = floorY + 10 * s + rand() * (h - floorY);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.bezierCurveTo(x + 10 * s, y - 6 * s, x + 20 * s, y + 6 * s, x + (25 + rand() * 20) * s, y + (rand() - 0.5) * 6 * s);
      ctx.stroke();
    }
  }

  // ---- 7. Greben (sortirano po dubini: dalje → bliže) ----
  const items: { y: number; draw: () => void }[] = [];
  const nKelp = Math.floor(pal.kelp * 26);
  for (let i = 0; i < nKelp; i++) {
    const x = rand() * w;
    const y = floorY + rand() * (h - floorY) * 0.6;
    const hh = (h * 0.5 + rand() * h * 0.4) * (0.6 + (y - floorY) / (h - floorY));
    const seed = rand();
    items.push({ y, draw: () => drawKelp(ctx, x, y, hh, s, mix(hsl([110, 0.45, 0.3], dh * 0.3), haze, 0.3), seed) });
  }
  const nCoral = 18 + Math.floor(rand() * 12);
  for (let i = 0; i < nCoral; i++) {
    const x = rand() * w;
    const y = floorY + 5 * s + Math.sqrt(rand()) * (h - floorY - 5 * s);
    const t = (y - floorY) / (h - floorY);
    const k = s * (0.85 + t * 1.6);
    const col = mix(corals[Math.floor(rand() * corals.length)]!, haze, 0.35 * (1 - t));
    const kind = rand();
    const sub = rand;
    if (kind < 0.3) items.push({ y, draw: () => drawBranchCoral(ctx, sub, x, y, k, col) });
    else if (kind < 0.48) items.push({ y, draw: () => drawFanCoral(ctx, sub, x, y, k, col) });
    else if (kind < 0.65) items.push({ y, draw: () => drawBrainCoral(ctx, sub, x, y, k, col) });
    else if (kind < 0.82) items.push({ y, draw: () => drawSponges(ctx, sub, x, y, k, col) });
    else items.push({ y, draw: () => drawAnemone(ctx, sub, x, y, k, col, !!pal.abyss) });
  }
  optional(ctx, hooks, "anchor", anchor, rand, (ctx, rand) => {
    const x = w * (0.15 + 0.7 * rand());
    const y = floorY + (h - floorY) * (0.3 + 0.3 * rand());
    items.push({ y, draw: () => drawAnchor(ctx, x, y, s * 1.2, mix(deep, [60, 50, 45], 0.4)) });
  });
  items.sort((a, b) => a.y - b.y);
  // Greben se crta deterministički: svaki item koristi zajednički rand redom posle sortiranja
  for (const it of items) it.draw();

  // ---- 8. Ribe ----
  // Jato duž krive
  {
    const cx = w * (0.15 + 0.7 * rand());
    const cy = floorY * (0.45 + 0.3 * rand());
    const dir = rand() < 0.5 ? -1 : 1;
    const col = fishCols[Math.floor(rand() * fishCols.length)]!;
    const n = 30 + Math.floor(rand() * 40);
    for (let i = 0; i < n; i++) {
      const t = rand();
      const x = cx + (t - 0.5) * 360 * s;
      const y = cy + Math.sin(t * Math.PI * 1.6 + 0.5) * 50 * s + (rand() - 0.5) * 30 * s;
      drawFish(ctx, x, y, (5 + rand() * 3) * s, dir, mix(col, [200, 220, 235], 0.4), null, pal.abyss ? 0.9 : 0.85);
    }
  }
  // Tropske ribe
  const tropical = 2 + Math.floor(rand() * 5);
  for (let i = 0; i < tropical; i++) {
    const x = w * (0.08 + 0.84 * rand());
    const y = floorY * (0.35 + 0.6 * rand());
    const c1 = fishCols[Math.floor(rand() * fishCols.length)]!;
    const c2 = fishCols[Math.floor(rand() * fishCols.length)]!;
    drawFish(ctx, x, y, (14 + rand() * 16) * s, rand() < 0.5 ? -1 : 1, c1, c2, 1);
  }
  optional(ctx, hooks, "turtle", turtle, rand, (ctx, rand) => drawTurtle(ctx, rand, w * (0.2 + 0.6 * rand()), floorY * (0.3 + 0.35 * rand()), s * (1 + 0.5 * rand()), mix(hsl([90, 0.3, 0.35]), haze, 0.2)));
  optional(ctx, hooks, "jellies", jellies, rand, (ctx, rand) => {
    const n = pal.abyss ? 3 + Math.floor(rand() * 5) : 1 + Math.floor(rand() * 4);
    for (let i = 0; i < n; i++) drawJelly(ctx, rand, w * rand(), floorY * (0.15 + 0.6 * rand()), s * (0.7 + 0.8 * rand()), pal.abyss ? hsl([190 + rand() * 120, 0.8, 0.65]) : mix(top, [255, 220, 240], 0.6), !!pal.abyss);
  });
  optional(ctx, hooks, "angler", !!angler, rand, (ctx, rand) => drawAngler(ctx, w * (0.2 + 0.6 * rand()), floorY * (0.55 + 0.3 * rand()), s * (1.2 + 0.6 * rand()), rand() < 0.5 ? -1 : 1));

  // ---- 9. Plankton (ponor) / mehurići ----
  if (pal.abyss) {
    for (let i = 0; i < 120; i++) {
      const x = rand() * w;
      const y = rand() * h;
      const r = (2 + rand() * 4) * s;
      const pg = ctx.createRadialGradient(x, y, 0, x, y, r);
      const pc = rand() < 0.5 ? "120,240,255" : "180,140,255";
      pg.addColorStop(0, `rgba(${pc},0.8)`);
      pg.addColorStop(1, `rgba(${pc},0)`);
      ctx.fillStyle = pg;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }
  const columns = 2 + Math.floor(rand() * 4);
  ctx.strokeStyle = rgba([255, 255, 255], 0.45);
  ctx.lineWidth = Math.max(1, 1 * s);
  for (let c = 0; c < columns; c++) {
    let x = w * rand();
    let y = floorY + rand() * (h - floorY) * 0.5;
    const n = 8 + Math.floor(rand() * 12);
    for (let i = 0; i < n; i++) {
      const r = (1.5 + rand() * 4) * s * (1 + i * 0.05);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
      y -= (14 + rand() * 30) * s;
      x += (rand() - 0.5) * 10 * s;
      if (y < 0) break;
    }
  }
}

// ---------------------------------------------------------------------------

function drawKelp(ctx: CanvasRenderingContext2D, x: number, baseY: number, hh: number, s: number, col: RGB, seed: number): void {
  const segs = 24;
  const ph = seed * 6.28;
  ctx.strokeStyle = rgbString(col);
  ctx.lineCap = "round";
  ctx.lineWidth = Math.max(2, 5 * s);
  ctx.beginPath();
  ctx.moveTo(x, baseY);
  const pts: [number, number][] = [];
  for (let i = 1; i <= segs; i++) {
    const t = i / segs;
    const px = x + Math.sin(t * 4 + ph) * 25 * s * t;
    const py = baseY - hh * t;
    pts.push([px, py]);
    ctx.lineTo(px, py);
  }
  ctx.stroke();
  // Listovi
  ctx.fillStyle = rgbString(mix(col, [255, 255, 200], 0.08));
  pts.forEach(([px, py], i) => {
    if (i % 2) return;
    const side = i % 4 === 0 ? 1 : -1;
    ctx.beginPath();
    ctx.ellipse(px + side * 10 * s, py + 4 * s, 12 * s, 4 * s, side * 0.6, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawBranchCoral(ctx: CanvasRenderingContext2D, rand: Rand, x: number, y: number, k: number, col: RGB): void {
  ctx.strokeStyle = rgbString(col);
  ctx.lineCap = "round";
  const branch = (bx: number, by: number, ang: number, len: number, wdt: number, depth: number) => {
    const ex = bx + Math.cos(ang) * len;
    const ey = by + Math.sin(ang) * len;
    ctx.lineWidth = wdt;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    if (depth <= 0) {
      ctx.fillStyle = rgbString(mix(col, [255, 255, 255], 0.3));
      ctx.beginPath();
      ctx.arc(ex, ey, wdt * 0.6, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    const n = 2;
    for (let i = 0; i < n; i++) branch(ex, ey, ang + (i === 0 ? -1 : 1) * (0.35 + 0.35 * rand()), len * (0.65 + 0.15 * rand()), wdt * 0.75, depth - 1);
  };
  for (let i = 0; i < 3; i++) branch(x + (i - 1) * 6 * k, y, -Math.PI / 2 + (i - 1) * 0.4, (18 + 10 * rand()) * k, 6 * k, 3);
}

function drawFanCoral(ctx: CanvasRenderingContext2D, rand: Rand, x: number, y: number, k: number, col: RGB): void {
  const R = (40 + rand() * 25) * k;
  ctx.fillStyle = rgba(col, 0.35);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y - 4 * k, R, Math.PI * 1.1, Math.PI * 1.9);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = rgbString(col);
  ctx.lineWidth = Math.max(1, 1.4 * k);
  for (let i = 0; i < 12; i++) {
    const a = Math.PI * (1.12 + (0.76 * i) / 11);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(a) * R * 0.5, y + Math.sin(a) * R * 0.5 - 4 * k, x + Math.cos(a) * R, y - 4 * k + Math.sin(a) * R);
    ctx.stroke();
  }
  for (let r = 0.35; r < 1; r += 0.18) {
    ctx.beginPath();
    ctx.arc(x, y - 4 * k, R * r, Math.PI * 1.12, Math.PI * 1.88);
    ctx.stroke();
  }
}

function drawBrainCoral(ctx: CanvasRenderingContext2D, rand: Rand, x: number, y: number, k: number, col: RGB): void {
  const R = (18 + rand() * 16) * k;
  ctx.fillStyle = rgbString(col);
  ctx.beginPath();
  ctx.ellipse(x, y, R * 1.2, R, 0, Math.PI, 0);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(x, y, R * 1.2, R, 0, Math.PI, 0);
  ctx.clip();
  ctx.strokeStyle = rgba(mix(col, [0, 0, 0], 0.35), 0.7);
  ctx.lineWidth = Math.max(1, 1.5 * k);
  for (let i = 0; i < 7; i++) {
    const yy = y - R + (i / 6) * R;
    ctx.beginPath();
    for (let xx = x - R * 1.3; xx <= x + R * 1.3; xx += 3 * k) {
      const v = yy + Math.sin((xx - x) / (4 * k) + i * 1.7) * 2.5 * k;
      if (xx === x - R * 1.3) ctx.moveTo(xx, v);
      else ctx.lineTo(xx, v);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawSponges(ctx: CanvasRenderingContext2D, rand: Rand, x: number, y: number, k: number, col: RGB): void {
  const n = 2 + Math.floor(rand() * 3);
  for (let i = 0; i < n; i++) {
    const tx = x + (i - n / 2) * 11 * k;
    const th = (25 + rand() * 35) * k;
    const tw = (7 + rand() * 4) * k;
    ctx.fillStyle = rgbString(mix(col, [0, 0, 0], 0.08 * i));
    ctx.beginPath();
    ctx.moveTo(tx - tw * 0.8, y);
    ctx.lineTo(tx - tw, y - th);
    ctx.lineTo(tx + tw, y - th);
    ctx.lineTo(tx + tw * 0.8, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = rgba(mix(col, [0, 0, 0], 0.5), 0.8);
    ctx.beginPath();
    ctx.ellipse(tx, y - th, tw * 0.75, tw * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawAnemone(ctx: CanvasRenderingContext2D, rand: Rand, x: number, y: number, k: number, col: RGB, glow: boolean): void {
  const n = 14 + Math.floor(rand() * 10);
  ctx.strokeStyle = rgbString(col);
  ctx.lineCap = "round";
  ctx.lineWidth = Math.max(1.5, 3 * k);
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + ((i / (n - 1)) - 0.5) * 2.4;
    const len = (14 + rand() * 12) * k;
    ctx.beginPath();
    ctx.moveTo(x, y - 6 * k);
    ctx.quadraticCurveTo(x + Math.cos(a) * len * 0.6 + 4 * k, y - 6 * k + Math.sin(a) * len * 0.6, x + Math.cos(a) * len, y - 6 * k + Math.sin(a) * len);
    ctx.stroke();
    if (glow) {
      const gx = x + Math.cos(a) * len;
      const gy = y - 6 * k + Math.sin(a) * len;
      const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, 5 * k);
      g.addColorStop(0, rgba(mix(col, [255, 255, 255], 0.5), 0.9));
      g.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = g;
      ctx.fillRect(gx - 5 * k, gy - 5 * k, 10 * k, 10 * k);
    }
  }
  ctx.fillStyle = rgbString(mix(col, [0, 0, 0], 0.3));
  ctx.beginPath();
  ctx.ellipse(x, y - 3 * k, 8 * k, 5 * k, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawFish(ctx: CanvasRenderingContext2D, x: number, y: number, L: number, dir: number, c1: RGB, c2: RGB | null, alpha: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir, 1);
  ctx.fillStyle = rgba(c1, alpha);
  ctx.beginPath();
  ctx.ellipse(0, 0, L, L * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();
  // Rep
  ctx.beginPath();
  ctx.moveTo(-L * 0.85, 0);
  ctx.lineTo(-L * 1.45, -L * 0.45);
  ctx.lineTo(-L * 1.35, 0);
  ctx.lineTo(-L * 1.45, L * 0.45);
  ctx.closePath();
  ctx.fill();
  if (c2) {
    // Leđno peraje + pruge + oko
    ctx.beginPath();
    ctx.moveTo(-L * 0.3, -L * 0.38);
    ctx.quadraticCurveTo(0, -L * 0.8, L * 0.35, -L * 0.36);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = rgba(c2, 0.9);
    for (const sx of [-0.35, 0.1]) {
      ctx.beginPath();
      ctx.ellipse(sx * L, 0, L * 0.09, L * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(20,20,30,0.9)";
    ctx.beginPath();
    ctx.arc(L * 0.6, -L * 0.08, L * 0.08, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawTurtle(ctx: CanvasRenderingContext2D, rand: Rand, x: number, y: number, k: number, col: RGB): void {
  const dir = rand() < 0.5 ? -1 : 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir, 1);
  ctx.rotate(-0.15);
  const skin = mix(col, [180, 170, 120], 0.35);
  ctx.fillStyle = rgbString(skin);
  // Peraja
  ctx.beginPath();
  ctx.ellipse(18 * k, -16 * k, 22 * k, 7 * k, -0.7, 0, Math.PI * 2);
  ctx.ellipse(18 * k, 16 * k, 20 * k, 6 * k, 0.6, 0, Math.PI * 2);
  ctx.ellipse(-26 * k, -10 * k, 10 * k, 4 * k, 0.5, 0, Math.PI * 2);
  ctx.ellipse(-26 * k, 10 * k, 10 * k, 4 * k, -0.5, 0, Math.PI * 2);
  ctx.fill();
  // Glava
  ctx.beginPath();
  ctx.ellipse(40 * k, 0, 10 * k, 7 * k, 0, 0, Math.PI * 2);
  ctx.fill();
  // Oklop sa šarom
  ctx.fillStyle = rgbString(col);
  ctx.beginPath();
  ctx.ellipse(0, 0, 32 * k, 22 * k, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = rgba(mix(col, [255, 240, 200], 0.35), 0.6);
  ctx.lineWidth = 1.5 * k;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.ellipse(i * 14 * k, 0, 9 * k, 12 * k, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawJelly(ctx: CanvasRenderingContext2D, rand: Rand, x: number, y: number, k: number, col: RGB, glow: boolean): void {
  if (glow) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, 50 * k);
    g.addColorStop(0, rgba(col, 0.35));
    g.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - 50 * k, y - 50 * k, 100 * k, 100 * k);
  }
  ctx.strokeStyle = rgba(col, 0.55);
  ctx.lineWidth = Math.max(1, 1.4 * k);
  for (let i = 0; i < 7; i++) {
    const tx = x - 14 * k + i * 4.6 * k;
    ctx.beginPath();
    ctx.moveTo(tx, y);
    const len = (40 + rand() * 50) * k;
    for (let t = 0; t <= 1; t += 0.1) ctx.lineTo(tx + Math.sin(t * 8 + i) * 4 * k, y + t * len);
    ctx.stroke();
  }
  const bg = ctx.createRadialGradient(x, y - 8 * k, 2 * k, x, y - 4 * k, 22 * k);
  bg.addColorStop(0, rgba(mix(col, [255, 255, 255], 0.5), 0.75));
  bg.addColorStop(1, rgba(col, 0.35));
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.ellipse(x, y, 20 * k, 16 * k, 0, Math.PI, 0);
  ctx.quadraticCurveTo(x, y + 6 * k, x - 20 * k, y);
  ctx.fill();
}

function drawAngler(ctx: CanvasRenderingContext2D, x: number, y: number, k: number, dir: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir, 1);
  ctx.fillStyle = "rgba(25,20,35,0.95)";
  ctx.beginPath();
  ctx.ellipse(0, 0, 30 * k, 22 * k, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-26 * k, 0);
  ctx.lineTo(-48 * k, -14 * k);
  ctx.lineTo(-44 * k, 0);
  ctx.lineTo(-48 * k, 14 * k);
  ctx.closePath();
  ctx.fill();
  // Zubi
  ctx.fillStyle = "rgba(230,230,220,0.9)";
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.moveTo(14 * k + i * 2.6 * k, 4 * k);
    ctx.lineTo(15.3 * k + i * 2.6 * k, 9 * k);
    ctx.lineTo(16.6 * k + i * 2.6 * k, 4 * k);
    ctx.fill();
  }
  // Mamac
  ctx.strokeStyle = "rgba(25,20,35,0.95)";
  ctx.lineWidth = 1.6 * k;
  ctx.beginPath();
  ctx.moveTo(10 * k, -18 * k);
  ctx.quadraticCurveTo(30 * k, -48 * k, 44 * k, -26 * k);
  ctx.stroke();
  const g = ctx.createRadialGradient(44 * k, -24 * k, 0, 44 * k, -24 * k, 22 * k);
  g.addColorStop(0, "rgba(220,255,200,1)");
  g.addColorStop(0.2, "rgba(150,255,200,0.6)");
  g.addColorStop(1, "rgba(150,255,200,0)");
  ctx.fillStyle = g;
  ctx.fillRect(22 * k, -46 * k, 44 * k, 44 * k);
  ctx.fillStyle = "rgba(240,240,200,0.9)";
  ctx.beginPath();
  ctx.arc(16 * k, -6 * k, 3 * k, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawAnchor(ctx: CanvasRenderingContext2D, x: number, y: number, k: number, col: RGB): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(0.35);
  ctx.strokeStyle = rgbString(col);
  ctx.lineWidth = 6 * k;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(0, -60 * k);
  ctx.lineTo(0, 0);
  ctx.moveTo(-18 * k, -48 * k);
  ctx.lineTo(18 * k, -48 * k);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, -66 * k, 7 * k, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, -22 * k, 26 * k, Math.PI * 0.15, Math.PI * 0.85);
  ctx.stroke();
  ctx.restore();
  // Lanac
  ctx.strokeStyle = rgba(col, 0.8);
  ctx.lineWidth = 2 * k;
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.ellipse(x - 30 * k - i * 9 * k, y - 75 * k - i * 12 * k, 4 * k, 6 * k, 0.6, 0, Math.PI * 2);
    ctx.stroke();
  }
}
