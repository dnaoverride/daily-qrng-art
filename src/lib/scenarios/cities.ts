/**
 * Gradovi sveta — render v2. Pogled preko reke na grad sa znamenitostima.
 *
 * QRNG bira grad (registar CITIES, sa težinama), paletu (doba dana) i koje se
 * znamenitosti pojavljuju. Gornja polovina (nebo, sunce/mesec, grad) crta se dva
 * puta — normalno i preslikano u reku (pravi odraz, kao kod jezera). Geometrija
 * grada koristi zaseban PRNG sa fiksnim seed-om po slici, pa su oba prolaza identična.
 *
 * Scenario javlja hooks.meta({ place }) — ispod slike piše ime grada.
 * Gradovi: Beograd (Pariz, Rim… slede).
 */
import type { QRNGStream } from "../qrng";
import { hslToRgb, rgbString, type RGB } from "../color";
import { mulberry32, prngFromStream, type Rand } from "../prng";
import { NO_HOOKS, type SceneHooks, type SkyLight } from "../sky-events";

type HSL = [number, number, number];

interface CityPalette {
  name: string;
  light: SkyLight;
  sky: [HSL, HSL, HSL];
  sun: HSL;
  moon?: boolean;
  stars?: boolean;
  near: HSL; // boja najbližih zgrada (senovita strana)
  lit: HSL; // boja osvetljenih fasada
  water: HSL;
  windows: number; // udeo upaljenih prozora 0–1
  floodlight: boolean; // noćno osvetljenje znamenitosti
  fog: number;
}

const PALETTES: readonly CityPalette[] = [
  {
    name: "day",
    light: "day",
    sky: [[210, 0.6, 0.5], [205, 0.5, 0.67], [200, 0.4, 0.82]],
    sun: [50, 1, 0.94],
    near: [215, 0.15, 0.42],
    lit: [35, 0.25, 0.82],
    water: [205, 0.45, 0.32],
    windows: 0,
    floodlight: false,
    fog: 0.3,
  },
  {
    name: "golden",
    light: "dusk",
    sky: [[215, 0.4, 0.5], [35, 0.6, 0.68], [38, 0.9, 0.7]],
    sun: [40, 1, 0.75],
    near: [250, 0.15, 0.32],
    lit: [32, 0.6, 0.72],
    water: [215, 0.35, 0.25],
    windows: 0.1,
    floodlight: false,
    fog: 0.4,
  },
  {
    name: "sunset",
    light: "dusk",
    sky: [[255, 0.4, 0.28], [335, 0.5, 0.5], [22, 0.95, 0.6]],
    sun: [25, 1, 0.66],
    near: [270, 0.25, 0.18],
    lit: [15, 0.55, 0.55],
    water: [265, 0.4, 0.16],
    windows: 0.35,
    floodlight: false,
    fog: 0.4,
  },
  {
    name: "blue-hour",
    light: "dusk",
    sky: [[228, 0.55, 0.2], [225, 0.45, 0.35], [215, 0.4, 0.55]],
    sun: [30, 0.8, 0.7],
    near: [228, 0.35, 0.12],
    lit: [220, 0.25, 0.4],
    water: [228, 0.5, 0.12],
    windows: 0.6,
    floodlight: true,
    fog: 0.3,
  },
  {
    name: "night",
    light: "night",
    sky: [[232, 0.55, 0.06], [230, 0.45, 0.12], [25, 0.35, 0.22]],
    sun: [50, 0.25, 0.92],
    moon: true,
    stars: true,
    near: [235, 0.35, 0.07],
    lit: [230, 0.2, 0.2],
    water: [232, 0.55, 0.06],
    windows: 0.75,
    floodlight: true,
    fog: 0.25,
  },
  {
    name: "winter-fog",
    light: "day",
    sky: [[210, 0.12, 0.62], [210, 0.1, 0.74], [210, 0.1, 0.84]],
    sun: [45, 0.3, 0.92],
    near: [215, 0.1, 0.45],
    lit: [210, 0.08, 0.75],
    water: [210, 0.15, 0.45],
    windows: 0.15,
    floodlight: false,
    fog: 0.9,
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

/** Kontekst crtanja zajednički za sve gradove. */
interface CityCtx {
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
  s: number;
  horizonY: number;
  lightDir: number;
  pal: CityPalette;
  far: RGB;
  mid: RGB;
  near: RGB;
  lit: RGB;
  skyHorizon: RGB;
  warmWin: RGB;
  night: boolean;
}

interface CityDef {
  key: string; // ključ za prevod (scene.place.*)
  weight: number;
  /** Odluke iz QRNG-a (pre crtanja). */
  decide(stream: QRNGStream): unknown;
  /** Crtanje grada u gornjoj polovini (poziva se 2× — normalno i za odraz). */
  draw(c: CityCtx, rand: Rand, d: unknown): void;
}

// ===========================================================================
// Beograd
// ===========================================================================

interface BelgradeDecision {
  hram: boolean;
  usce: boolean;
  beogradjanka: boolean;
  kula: boolean;
  avala: boolean;
  kalemegdan: boolean;
  bridge: boolean;
  kalemegdanLeft: boolean;
}

const BELGRADE: CityDef = {
  key: "belgrade",
  weight: 1,
  decide(stream) {
    const d: BelgradeDecision = {
      hram: stream.next_f() < 0.75,
      usce: stream.next_f() < 0.6,
      beogradjanka: stream.next_f() < 0.45,
      kula: stream.next_f() < 0.4,
      avala: stream.next_f() < 0.5,
      kalemegdan: stream.next_f() < 0.55,
      bridge: stream.next_f() < 0.4,
      kalemegdanLeft: stream.next_f() < 0.5,
    };
    // Bar dve upečatljive znamenitosti u srednjem planu
    if ([d.hram, d.usce, d.beogradjanka, d.kula].filter(Boolean).length < 2) {
      d.hram = true;
      d.usce = true;
    }
    return d;
  },
  draw(c, rand, dd) {
    const d = dd as BelgradeDecision;
    const { ctx, w, s, horizonY } = c;

    // 1) Avala u daljini (brdo + toranj)
    if (d.avala) {
      const ax = w * (0.15 + 0.7 * rand());
      const hillW = 300 * s;
      const hillH = 55 * s;
      ctx.fillStyle = rgbString(c.far);
      ctx.beginPath();
      ctx.moveTo(ax - hillW, horizonY);
      ctx.quadraticCurveTo(ax, horizonY - hillH * 2, ax + hillW, horizonY);
      ctx.closePath();
      ctx.fill();
      drawAvala(c, ax, horizonY - hillH * 0.95, 1.05 * s);
    }

    // 2) Daleki red zgrada (u izmaglici)
    buildingRow(c, rand, c.far, 30, 80, 0.15, false);

    // 3) Srednji red + znamenitosti u slotovima
    const marks: ((x: number) => void)[] = [];
    if (d.hram) marks.push((x) => drawHram(c, x, horizonY, 1.45 * s));
    if (d.usce) marks.push((x) => drawUsce(c, rand, x, horizonY, 1.2 * s));
    if (d.beogradjanka) marks.push((x) => drawBeogradjanka(c, rand, x, horizonY, 1.2 * s));
    if (d.kula) marks.push((x) => drawKulaBeograd(c, rand, x, horizonY, 1.15 * s));
    buildingRow(c, rand, c.mid, 40, 130, 0.35, true);
    const slots = marks.length;
    const order = marks.map((_, i) => i).sort(() => rand() - 0.5);
    order.forEach((mi, i) => {
      const x = w * ((i + 0.5) / slots) + (rand() - 0.5) * (w / slots) * 0.35;
      marks[mi]!(x);
    });

    // 4) Kalemegdan na bližoj obali
    if (d.kalemegdan) drawKalemegdan(c, rand, d.kalemegdanLeft, 1.2 * s);

    // 5) Most na Adi preko reke
    if (d.bridge) {
      const xc = d.kalemegdanLeft ? w * (0.6 + 0.25 * rand()) : w * (0.15 + 0.25 * rand());
      drawMostNaAdi(c, xc, horizonY - 12 * s, 330 * s, 1.0 * s);
    }

    // 6) Linija obale
    ctx.fillStyle = rgbString(mix(c.near, [0, 0, 0], 0.3));
    ctx.fillRect(0, horizonY - 3 * s, w, 4 * s);
  },
};

/** Red generičkih zgrada (socijalistički blokovi, stare zgrade, tornjevi crkava). */
function buildingRow(c: CityCtx, rand: Rand, col: RGB, hMin: number, hMax: number, winShare: number, withSpires: boolean): void {
  const { ctx, w, s, horizonY } = c;
  let x = -10 * s;
  while (x < w) {
    const kind = rand();
    const bw = (kind < 0.45 ? 40 + rand() * 60 : 25 + rand() * 35) * s;
    const bh = (hMin + rand() * (hMax - hMin)) * s * (kind < 0.45 ? 1 : 0.6);
    const top = horizonY - bh;
    ctx.fillStyle = rgbString(col);
    ctx.fillRect(x, top, bw, bh + 1);
    if (kind >= 0.45 && kind < 0.85) {
      // Stara zgrada: kosi krov + mansarda
      ctx.beginPath();
      ctx.moveTo(x - 1, top);
      ctx.lineTo(x + bw * 0.15, top - bw * 0.22);
      ctx.lineTo(x + bw * 0.85, top - bw * 0.22);
      ctx.lineTo(x + bw + 1, top);
      ctx.closePath();
      ctx.fill();
    } else if (kind >= 0.85 && withSpires) {
      // Crkveni toranj sa baroknim šiljkom (Saborna crkva)
      const tx = x + bw / 2;
      const tw = bw * 0.35;
      ctx.fillRect(tx - tw / 2, top - bh * 0.7, tw, bh * 0.7);
      ctx.beginPath();
      ctx.moveTo(tx - tw * 0.6, top - bh * 0.7);
      ctx.quadraticCurveTo(tx - tw * 0.2, top - bh * 0.85, tx, top - bh * 1.25);
      ctx.quadraticCurveTo(tx + tw * 0.2, top - bh * 0.85, tx + tw * 0.6, top - bh * 0.7);
      ctx.closePath();
      ctx.fill();
    }
    // Svetla fasada sa strane sunca
    if (!c.night) {
      ctx.fillStyle = rgba(c.lit, 0.25);
      ctx.fillRect(c.lightDir > 0 ? x : x + bw * 0.6, top, bw * 0.4, bh);
    }
    windows(c, rand, x, top, bw, bh, winShare);
    x += bw + (rand() < 0.3 ? rand() * 8 * s : -rand() * 4 * s);
  }
}

function windows(c: CityCtx, rand: Rand, x: number, top: number, bw: number, bh: number, share: number): void {
  const p = c.pal.windows * share * 2;
  if (p <= 0.01) return;
  const { ctx, s } = c;
  const ww = Math.max(1.2, 2.6 * s);
  const wh = Math.max(1.2, 3.4 * s);
  const gx = Math.max(2.5, 5.5 * s);
  const gy = Math.max(3.5, 7 * s);
  for (let yy = top + gy; yy < c.horizonY - gy; yy += wh + gy) {
    const floor = rand() < 0.3 ? 0 : p * (0.4 + rand());
    for (let xx = x + gx; xx < x + bw - ww - 1; xx += ww + gx) {
      if (rand() < floor) {
        ctx.fillStyle = rgba(c.warmWin, 0.55 + 0.4 * rand());
        ctx.fillRect(xx, yy, ww, wh);
      }
    }
  }
}

function floodGlow(c: CityCtx, x: number, y: number, r: number, col: RGB, a: number): void {
  if (!c.pal.floodlight) return;
  const g = c.ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(col, a));
  g.addColorStop(1, rgba(col, 0));
  c.ctx.fillStyle = g;
  c.ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

/** Hram Svetog Save: belo telo, ugaone kule sa kupolicama, velika kupola na tamburu, zlatni krst. */
function drawHram(c: CityCtx, x: number, baseY: number, k: number): void {
  const { ctx } = c;
  const W = 150 * k;
  const marble = c.pal.floodlight ? mix(c.lit, [255, 240, 210], 0.65) : c.night ? c.near : mix(c.lit, [255, 255, 255], 0.35);
  const shade = mix(marble, c.near, 0.45);
  const dome = c.pal.floodlight ? mix(marble, [150, 190, 175], 0.3) : mix(mix(c.lit, [140, 175, 165], 0.6), c.near, c.night ? 0.6 : 0.1);
  const gold: RGB = [235, 195, 90];
  floodGlow(c, x, baseY - W * 0.6, W * 1.1, [255, 225, 170], 0.3);
  const bodyTop = baseY - W * 0.45;
  // Telo
  ctx.fillStyle = rgbString(marble);
  ctx.fillRect(x - W / 2, bodyTop, W, W * 0.45 + 1);
  // Ugaone kule
  for (const side of [-1, 1]) {
    const tx = x + side * (W / 2 - W * 0.08);
    ctx.fillStyle = rgbString(marble);
    ctx.fillRect(tx - W * 0.08, baseY - W * 0.62, W * 0.16, W * 0.62);
    ctx.fillStyle = rgbString(dome);
    ctx.beginPath();
    ctx.ellipse(tx, baseY - W * 0.62, W * 0.08, W * 0.1, 0, Math.PI, 0);
    ctx.fill();
    cross(ctx, tx, baseY - W * 0.72, W * 0.05, gold);
  }
  // Polu-kupole uz tambur
  ctx.fillStyle = rgbString(dome);
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(x + side * W * 0.3, bodyTop, W * 0.16, Math.PI, 0);
    ctx.fill();
  }
  // Tambur + velika kupola
  ctx.fillStyle = rgbString(marble);
  ctx.fillRect(x - W * 0.25, bodyTop - W * 0.16, W * 0.5, W * 0.16 + 1);
  ctx.fillStyle = rgbString(dome);
  ctx.beginPath();
  ctx.ellipse(x, bodyTop - W * 0.16, W * 0.29, W * 0.33, 0, Math.PI, 0);
  ctx.fill();
  // Fenjer + krst
  ctx.fillStyle = rgbString(marble);
  ctx.fillRect(x - W * 0.03, bodyTop - W * 0.55, W * 0.06, W * 0.07);
  ctx.fillStyle = rgbString(dome);
  ctx.beginPath();
  ctx.arc(x, bodyTop - W * 0.55, W * 0.035, Math.PI, 0);
  ctx.fill();
  cross(ctx, x, bodyTop - W * 0.6, W * 0.09, gold);
  // Senovita strana: telo (samo telo) + polovina kupole (klip na oblik kupole)
  ctx.fillStyle = rgba(shade, 0.55);
  if (c.lightDir > 0) ctx.fillRect(x, bodyTop, W / 2, W * 0.45);
  else ctx.fillRect(x - W / 2, bodyTop, W / 2, W * 0.45);
  ctx.save();
  ctx.beginPath();
  ctx.rect(c.lightDir > 0 ? x : x - W, bodyTop - W, W, W);
  ctx.clip();
  ctx.fillStyle = rgba(shade, 0.4);
  ctx.beginPath();
  ctx.ellipse(x, bodyTop - W * 0.16, W * 0.29, W * 0.33, 0, Math.PI, 0);
  ctx.rect(x - W * 0.25, bodyTop - W * 0.16, W * 0.5, W * 0.16);
  ctx.fill();
  ctx.restore();
  // Lučni prozori
  ctx.fillStyle = rgba(c.night && c.pal.floodlight ? [120, 90, 60] : mix(c.near, [0, 0, 0], 0.2), 0.7);
  for (let i = 0; i < 7; i++) {
    const wx = x - W * 0.42 + i * W * 0.14;
    ctx.beginPath();
    ctx.moveTo(wx - W * 0.025, bodyTop + W * 0.3);
    ctx.lineTo(wx - W * 0.025, bodyTop + W * 0.15);
    ctx.arc(wx, bodyTop + W * 0.15, W * 0.025, Math.PI, 0);
    ctx.lineTo(wx + W * 0.025, bodyTop + W * 0.3);
    ctx.closePath();
    ctx.fill();
  }
}

function cross(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, col: RGB): void {
  ctx.fillStyle = rgbString(col);
  ctx.fillRect(x - size * 0.08, y - size, size * 0.16, size);
  ctx.fillRect(x - size * 0.32, y - size * 0.75, size * 0.64, size * 0.14);
}

/** Avalski toranj: tronožac, tanko telo, osmatračnica, antena sa crvenim svetlima. */
function drawAvala(c: CityCtx, x: number, baseY: number, k: number): void {
  const { ctx } = c;
  const H = 200 * k;
  ctx.fillStyle = rgbString(mix(c.far, c.near, 0.25));
  // Noge tronošca
  ctx.beginPath();
  ctx.moveTo(x - 14 * k, baseY);
  ctx.lineTo(x - 3 * k, baseY - H * 0.25);
  ctx.lineTo(x + 3 * k, baseY - H * 0.25);
  ctx.lineTo(x + 14 * k, baseY);
  ctx.lineTo(x + 5 * k, baseY);
  ctx.lineTo(x, baseY - H * 0.12);
  ctx.lineTo(x - 5 * k, baseY);
  ctx.closePath();
  ctx.fill();
  // Telo
  ctx.beginPath();
  ctx.moveTo(x - 3.5 * k, baseY - H * 0.25);
  ctx.lineTo(x - 2.5 * k, baseY - H * 0.8);
  ctx.lineTo(x + 2.5 * k, baseY - H * 0.8);
  ctx.lineTo(x + 3.5 * k, baseY - H * 0.25);
  ctx.closePath();
  ctx.fill();
  // Osmatračnica
  ctx.beginPath();
  ctx.ellipse(x, baseY - H * 0.82, 9 * k, 6 * k, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(x - 6 * k, baseY - H * 0.88, 12 * k, 5 * k);
  // Antena
  ctx.fillRect(x - 1 * k, baseY - H, 2 * k, H * 0.14);
  const g = ctx.createRadialGradient(x, baseY - H, 0, x, baseY - H, 6 * k);
  g.addColorStop(0, "rgba(255,70,60,0.9)");
  g.addColorStop(1, "rgba(255,70,60,0)");
  ctx.fillStyle = g;
  ctx.fillRect(x - 6 * k, baseY - H - 6 * k, 12 * k, 12 * k);
}

/** Ušće kula: stakleni neboder sa okvirom na vrhu (+ niža Ušće 2 pored). */
function drawUsce(c: CityCtx, rand: Rand, x: number, baseY: number, k: number): void {
  const { ctx } = c;
  const drawTower = (tx: number, tw: number, th: number) => {
    const top = baseY - th;
    const g = ctx.createLinearGradient(tx - tw / 2, 0, tx + tw / 2, 0);
    const glass = c.night ? mix(c.near, [40, 60, 90], 0.3) : mix(c.skyHorizon, [60, 100, 140], 0.45);
    g.addColorStop(0, rgbString(c.lightDir > 0 ? mix(glass, [255, 255, 255], 0.25) : mix(glass, [0, 0, 0], 0.25)));
    g.addColorStop(1, rgbString(c.lightDir > 0 ? mix(glass, [0, 0, 0], 0.25) : mix(glass, [255, 255, 255], 0.25)));
    ctx.fillStyle = g;
    ctx.fillRect(tx - tw / 2, top, tw, th + 1);
    // Vertikalne linije stakla
    ctx.strokeStyle = rgba(mix(glass, [255, 255, 255], 0.3), 0.35);
    ctx.lineWidth = Math.max(1, 0.8 * k);
    for (let i = 1; i < 6; i++) {
      ctx.beginPath();
      ctx.moveTo(tx - tw / 2 + (tw * i) / 6, top + 8 * k);
      ctx.lineTo(tx - tw / 2 + (tw * i) / 6, baseY);
      ctx.stroke();
    }
    // Okvir na vrhu
    ctx.fillStyle = rgbString(mix(glass, c.near, 0.5));
    ctx.fillRect(tx - tw / 2, top - 10 * k, 3 * k, 10 * k);
    ctx.fillRect(tx + tw / 2 - 3 * k, top - 10 * k, 3 * k, 10 * k);
    ctx.fillRect(tx - tw / 2, top - 12 * k, tw, 3 * k);
    if (c.pal.floodlight) {
      ctx.fillStyle = "rgba(120,200,255,0.85)";
      ctx.fillRect(tx - tw * 0.3, top + 3 * k, tw * 0.6, 3 * k);
    }
    windows(c, rand, tx - tw / 2, top, tw, th, 0.6);
  };
  drawTower(x + 34 * k, 40 * k, 150 * k);
  drawTower(x, 48 * k, 220 * k);
}

/** Beograđanka: tamna kula sa „krunom" — fasada se produžava iznad krova kao okvir. */
function drawBeogradjanka(c: CityCtx, rand: Rand, x: number, baseY: number, k: number): void {
  const { ctx } = c;
  const tw = 46 * k;
  const th = 185 * k;
  const top = baseY - th;
  const col = mix(c.near, [40, 30, 25], 0.35);
  ctx.fillStyle = rgbString(col);
  ctx.fillRect(x - tw / 2, top, tw, th + 1);
  // Kruna: okvir sa zasečenim uglovima
  ctx.beginPath();
  ctx.moveTo(x - tw / 2, top);
  ctx.lineTo(x - tw / 2, top - 22 * k);
  ctx.lineTo(x - tw / 2 + 8 * k, top - 22 * k);
  ctx.lineTo(x - tw / 2 + 8 * k, top - 14 * k);
  ctx.lineTo(x + tw / 2 - 8 * k, top - 14 * k);
  ctx.lineTo(x + tw / 2 - 8 * k, top - 22 * k);
  ctx.lineTo(x + tw / 2, top - 22 * k);
  ctx.lineTo(x + tw / 2, top);
  ctx.closePath();
  ctx.fill();
  // Horizontalne trake prozora (tamno staklo)
  ctx.fillStyle = rgba(mix(col, c.skyHorizon, 0.35), 0.45);
  for (let y = top + 6 * k; y < baseY - 4 * k; y += 7 * k) ctx.fillRect(x - tw / 2 + 3 * k, y, tw - 6 * k, 2.5 * k);
  windows(c, rand, x - tw / 2, top, tw, th, 0.5);
  if (c.pal.floodlight) floodGlow(c, x, top - 10 * k, 30 * k, [255, 120, 80], 0.4);
}

/** Kula Beograd: vitka kula sa blago uvijenim (konkavnim) obrisom. */
function drawKulaBeograd(c: CityCtx, rand: Rand, x: number, baseY: number, k: number): void {
  const { ctx } = c;
  const H = 260 * k;
  const glass = c.night ? mix(c.near, [50, 70, 100], 0.3) : mix(c.skyHorizon, [80, 120, 150], 0.4);
  const g = ctx.createLinearGradient(x - 25 * k, 0, x + 25 * k, 0);
  g.addColorStop(0, rgbString(mix(glass, [255, 255, 255], c.lightDir > 0 ? 0.3 : 0)));
  g.addColorStop(1, rgbString(mix(glass, [0, 0, 0], c.lightDir > 0 ? 0.3 : 0.1)));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x - 22 * k, baseY);
  ctx.quadraticCurveTo(x - 10 * k, baseY - H * 0.5, x - 16 * k, baseY - H);
  ctx.lineTo(x + 8 * k, baseY - H - 6 * k);
  ctx.quadraticCurveTo(x + 18 * k, baseY - H * 0.5, x + 22 * k, baseY);
  ctx.closePath();
  ctx.fill();
  windows(c, rand, x - 14 * k, baseY - H * 0.92, 28 * k, H * 0.92, 0.5);
}

/** Kalemegdan: brdo na obali, zidine sa kulama, drveće, Pobednik na stubu. */
function drawKalemegdan(c: CityCtx, rand: Rand, left: boolean, k: number): void {
  const { ctx, w, horizonY } = c;
  const span = w * 0.36;
  const x0 = left ? 0 : w - span;
  const hillH = 85 * k;
  const hill = (u: number) => horizonY - hillH * Math.sin(Math.PI * Math.min(1, (left ? 1 - u : u) * 0.9 + 0.1)) * (left ? 1 : 1);
  ctx.fillStyle = rgbString(mix(c.near, [40, 70, 40], c.night ? 0.05 : 0.25));
  ctx.beginPath();
  ctx.moveTo(x0, horizonY + 1);
  for (let i = 0; i <= 30; i++) {
    const u = i / 30;
    ctx.lineTo(x0 + span * u, hill(u));
  }
  ctx.lineTo(x0 + span, horizonY + 1);
  ctx.closePath();
  ctx.fill();
  // Drveće
  ctx.fillStyle = rgbString(mix(c.near, [30, 60, 35], c.night ? 0.05 : 0.35));
  for (let i = 0; i < 18; i++) {
    const u = rand();
    const tx = x0 + span * u;
    const ty = hill(u) + 2 * k;
    ctx.beginPath();
    ctx.arc(tx, ty, (6 + rand() * 9) * k, 0, Math.PI * 2);
    ctx.fill();
  }
  // Zidine sa zupcima i kulama (donji deo brda)
  // Zidine u boji kamena, niske, u podnožju brda
  const stone: RGB = [150, 135, 115];
  const wallCol = c.pal.floodlight ? mix(stone, [240, 205, 150], 0.45) : mix(mix(stone, c.lit, 0.3), c.near, c.night ? 0.7 : 0.3);
  ctx.fillStyle = rgbString(wallCol);
  const wy = horizonY - hillH * 0.2;
  const wx0 = x0 + span * 0.08;
  const wx1 = x0 + span * 0.92;
  ctx.fillRect(wx0, wy, wx1 - wx0, horizonY - wy);
  for (let x = wx0; x < wx1; x += 8 * k) ctx.fillRect(x, wy - 4 * k, 4.5 * k, 4 * k);
  for (let i = 0; i < 3; i++) {
    const tx = wx0 + ((wx1 - wx0) * (i + 0.5)) / 3;
    ctx.fillRect(tx - 9 * k, wy - 22 * k, 18 * k, 22 * k);
    for (let m = -1; m <= 1; m++) ctx.fillRect(tx + m * 6 * k - 2 * k, wy - 27 * k, 4 * k, 5 * k);
  }
  floodGlow(c, (wx0 + wx1) / 2, wy, span * 0.6, [255, 210, 150], 0.18);
  // Pobednik na stubu (na vrhu brda, ka reci)
  const px = left ? x0 + span * 0.78 : x0 + span * 0.22;
  const py = hill(left ? 0.78 : 0.22) + 4 * k;
  const colH = 75 * k;
  ctx.fillStyle = rgbString(c.pal.floodlight ? mix(c.lit, [240, 220, 180], 0.5) : mix(c.near, c.lit, 0.2));
  ctx.fillRect(px - 6 * k, py - 10 * k, 12 * k, 10 * k);
  ctx.fillRect(px - 2.5 * k, py - colH, 5 * k, colH);
  // Figura: telo, glava, podignuta ruka sa sokolom, spuštena sa mačem
  const fy = py - colH;
  ctx.fillStyle = rgbString(mix(c.near, [60, 70, 60], 0.3));
  ctx.fillRect(px - 2.2 * k, fy - 14 * k, 4.4 * k, 14 * k);
  ctx.beginPath();
  ctx.arc(px, fy - 16.5 * k, 2.4 * k, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = rgbString(mix(c.near, [60, 70, 60], 0.3));
  ctx.lineWidth = 1.6 * k;
  ctx.lineCap = "round";
  const dir = left ? -1 : 1;
  ctx.beginPath();
  ctx.moveTo(px, fy - 12 * k);
  ctx.lineTo(px + dir * 6 * k, fy - 20 * k);
  ctx.moveTo(px, fy - 11 * k);
  ctx.lineTo(px - dir * 5 * k, fy - 3 * k);
  ctx.stroke();
  ctx.fillRect(px + dir * 6 * k - 2 * k, fy - 23 * k, 4 * k, 3 * k);
}

/** Most na Adi: jedan visoki pilon i lepeza kablova ka kolovozu. */
function drawMostNaAdi(c: CityCtx, xc: number, deckY: number, span: number, k: number): void {
  const { ctx } = c;
  const H = 210 * k;
  const col = c.pal.floodlight ? mix(c.lit, [235, 235, 245], 0.6) : mix(c.lit, [235, 235, 235], c.night ? 0 : 0.4);
  // Kolovoz + stubovi u vodi
  ctx.fillStyle = rgbString(col);
  ctx.fillRect(xc - span, deckY - 3 * k, span * 2, 6 * k);
  for (const fx of [-0.75, 0.75]) ctx.fillRect(xc + fx * span - 3 * k, deckY, 6 * k, c.horizonY - deckY + 2);
  // Pilon (igla, širi pri dnu)
  ctx.beginPath();
  ctx.moveTo(xc - 9 * k, c.horizonY);
  ctx.lineTo(xc - 3 * k, deckY - H);
  ctx.lineTo(xc + 3 * k, deckY - H);
  ctx.lineTo(xc + 9 * k, c.horizonY);
  ctx.closePath();
  ctx.fill();
  // Kablovi (lepeza)
  ctx.strokeStyle = rgba(col, c.pal.floodlight ? 0.85 : 0.6);
  ctx.lineWidth = Math.max(0.8, 0.9 * k);
  const n = 12;
  for (let i = 0; i < n; i++) {
    const ay = deckY - H * (0.55 + 0.42 * (i / n));
    for (const side of [-1, 1]) {
      const bx = xc + side * span * (0.15 + 0.82 * (i / n));
      ctx.beginPath();
      ctx.moveTo(xc, ay);
      ctx.lineTo(bx, deckY - 2 * k);
      ctx.stroke();
    }
  }
  if (c.pal.floodlight) {
    for (let i = 0; i < 40; i++) {
      const t = i / 40;
      const g = ctx.createRadialGradient(xc - span + span * 2 * t, deckY, 0, xc - span + span * 2 * t, deckY, 4 * k);
      g.addColorStop(0, "rgba(255,240,200,0.8)");
      g.addColorStop(1, "rgba(255,240,200,0)");
      ctx.fillStyle = g;
      ctx.fillRect(xc - span + span * 2 * t - 4 * k, deckY - 4 * k, 8 * k, 8 * k);
    }
  }
}

// ===========================================================================

const CITIES: readonly CityDef[] = [BELGRADE];

export function renderCities(
  ctx: CanvasRenderingContext2D,
  stream: QRNGStream,
  w: number,
  h: number,
  hooks: SceneHooks = NO_HOOKS
): void {
  const s = w / 1200;

  // ---- Odluke (QRNG) ----
  const totalW = CITIES.reduce((a, c) => a + c.weight, 0);
  let roll = stream.next_f() * totalW;
  let city = CITIES[0]!;
  for (const c of CITIES) {
    if (roll < c.weight) {
      city = c;
      break;
    }
    roll -= c.weight;
  }
  const pal = PALETTES[stream.next_int(0, PALETTES.length - 1)]!;
  const dh = stream.next_int(-8, 8);
  const horizonY = Math.floor(h * (0.56 + 0.1 * stream.next_f()));
  const sunX = w * (0.12 + 0.76 * stream.next_f());
  const sunR = (pal.moon ? 16 + 10 * stream.next_f() : 22 + 18 * stream.next_f()) * s;
  const sunY = pal.light === "dusk" ? horizonY * (0.45 + 0.35 * stream.next_f()) : horizonY * (0.12 + 0.25 * stream.next_f());
  const decision = city.decide(stream);
  const splavRoll = stream.next_f();
  const rand = prngFromStream(stream);
  const citySeed = Math.floor(rand() * 4294967296) >>> 0 || 1;
  hooks.meta?.({ place: city.key });

  const sky = pal.sky.map((c) => hsl(c, dh));
  const skyHorizon = sky[2]!;
  const sunCol = hsl(pal.sun);
  const sunCore = mix(sunCol, [255, 252, 240], 0.6);
  const near = hsl(pal.near, dh);
  const lit = hsl(pal.lit, dh);
  const fogCol = mix(skyHorizon, [255, 255, 255], pal.moon ? 0.02 : 0.2);
  const c: CityCtx = {
    ctx,
    w,
    h,
    s,
    horizonY,
    lightDir: sunX < w / 2 ? 1 : -1,
    pal,
    far: mix(near, fogCol, 0.62),
    mid: mix(near, fogCol, 0.3),
    near,
    lit,
    skyHorizon,
    warmWin: pal.moon ? [255, 210, 130] : [255, 225, 160],
    night: pal.light === "night" || pal.name === "blue-hour",
  };
  const stars: [number, number, number][] = [];
  if (pal.stars) for (let i = 0; i < 160; i++) stars.push([rand() * w, Math.pow(rand(), 1.4) * horizonY * 0.7, 0.25 + 0.6 * rand()]);

  const drawUpper = (mirror: boolean) => {
    const g = ctx.createLinearGradient(0, 0, 0, horizonY);
    g.addColorStop(0, rgbString(sky[0]!));
    g.addColorStop(0.6, rgbString(sky[1]!));
    g.addColorStop(1, rgbString(skyHorizon));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, horizonY + 1);
    for (const [x, y, a] of stars) {
      ctx.fillStyle = `rgba(255,255,255,${(a * (mirror ? 0.5 : 1)).toFixed(3)})`;
      ctx.fillRect(x, y, Math.max(0.8, s), Math.max(0.8, s));
    }
    if (!mirror) hooks.sky({ horizonY, light: pal.light });
    const glowR = sunR * (pal.moon ? 6 : 8);
    const glow = ctx.createRadialGradient(sunX, sunY, sunR * 0.6, sunX, sunY, glowR);
    glow.addColorStop(0, rgba(sunCol, pal.moon ? 0.25 : 0.5));
    glow.addColorStop(0.3, rgba(sunCol, pal.moon ? 0.07 : 0.18));
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
    // Grad (isti seed u oba prolaza → identična geometrija)
    city.draw(c, mulberry32(citySeed), decision);
    // Izmaglica nad gradom (zimska magla jače)
    const fh = horizonY * 0.35;
    const fg = ctx.createLinearGradient(0, horizonY - fh, 0, horizonY);
    fg.addColorStop(0, rgba(fogCol, 0));
    fg.addColorStop(1, rgba(fogCol, 0.25 + 0.45 * pal.fog));
    ctx.fillStyle = fg;
    ctx.fillRect(0, horizonY - fh, w, fh + 1);
  };

  // 1) Normalan prolaz
  drawUpper(false);
  // 2) Odraz u reci
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
  // 3) Voda: boja reke + zatamnjenje ka dnu
  const water = hsl(pal.water, dh);
  const wg = ctx.createLinearGradient(0, horizonY, 0, h);
  wg.addColorStop(0, rgba(water, 0.35));
  wg.addColorStop(1, rgba(water, 0.8));
  ctx.fillStyle = wg;
  ctx.fillRect(0, horizonY, w, h - horizonY);
  // 4) Talasići koji lome odraz
  let y = horizonY + 3 * s;
  let gap = 2.5 * s;
  const lineCol = mix(skyHorizon, [255, 255, 255], 0.3);
  while (y < h) {
    const t = (y - horizonY) / (h - horizonY);
    const segs = 3 + Math.floor(rand() * 4);
    for (let k = 0; k < segs; k++) {
      const len = (30 + rand() * 130) * s * (0.6 + t * 1.5);
      ctx.fillStyle = rand() < 0.5 ? rgba(lineCol, 0.05 + 0.1 * rand()) : rgba(water, 0.25 + 0.2 * rand());
      ctx.fillRect(rand() * w - len / 2, y, len, Math.max(1, (0.8 + t * 1.4) * s));
    }
    y += gap;
    gap *= 1.08;
  }
  // 5) Splav (plutajući restoran) — noću sa svetlima
  if (splavRoll < 0.35) {
    const sx = w * (0.15 + 0.7 * rand());
    const sy = horizonY + (h - horizonY) * (0.35 + 0.3 * rand());
    drawSplav(ctx, sx, sy, s * (1 + 0.4 * rand()), c);
  }
}

function drawSplav(ctx: CanvasRenderingContext2D, x: number, y: number, k: number, c: CityCtx): void {
  const body = mix(c.near, [0, 0, 0], 0.3);
  const lit = c.night || c.pal.windows > 0.3;
  ctx.fillStyle = rgbString(body);
  ctx.fillRect(x - 70 * k, y - 6 * k, 140 * k, 8 * k); // ponton
  ctx.fillRect(x - 55 * k, y - 26 * k, 110 * k, 20 * k); // kućica
  ctx.beginPath();
  ctx.moveTo(x - 62 * k, y - 26 * k);
  ctx.lineTo(x + 62 * k, y - 26 * k);
  ctx.lineTo(x + 50 * k, y - 34 * k);
  ctx.lineTo(x - 50 * k, y - 34 * k);
  ctx.closePath();
  ctx.fill();
  if (lit) {
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = "rgba(255,215,140,0.9)";
      ctx.fillRect(x - 48 * k + i * 12.5 * k, y - 21 * k, 7 * k, 8 * k);
    }
    // Lampice i odraz
    for (let i = 0; i < 14; i++) {
      const lx = x - 62 * k + i * 9.5 * k;
      const g = ctx.createRadialGradient(lx, y - 30 * k, 0, lx, y - 30 * k, 4 * k);
      g.addColorStop(0, "rgba(255,230,170,0.9)");
      g.addColorStop(1, "rgba(255,230,170,0)");
      ctx.fillStyle = g;
      ctx.fillRect(lx - 4 * k, y - 34 * k, 8 * k, 8 * k);
    }
    ctx.fillStyle = "rgba(255,210,130,0.25)";
    for (let i = 0; i < 10; i++) ctx.fillRect(x - 50 * k + i * 11 * k, y + 4 * k, 6 * k, (10 + (i % 3) * 6) * k);
  }
}
