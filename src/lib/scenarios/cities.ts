/**
 * Gradovi sveta — render v2. Pogled preko reke na grad sa znamenitostima.
 *
 * QRNG bira grad (registar CITIES, sa težinama), paletu (doba dana) i koje se
 * znamenitosti pojavljuju. Gornja polovina (nebo, sunce/mesec, grad) crta se dva
 * puta — normalno i preslikano u reku (pravi odraz, kao kod jezera). Geometrija
 * grada koristi zaseban PRNG sa fiksnim seed-om po slici, pa su oba prolaza identična.
 *
 * Scenario javlja hooks.meta({ place }) — ispod slike piše ime grada.
 * Gradovi: Beograd (35%), Pariz (32.5%), Rim (32.5%).
 */
import type { QRNGStream } from "../qrng";
import { hslToRgb, rgbString, type RGB } from "../color";
import { mulberry32, prngFromStream, type Rand } from "../prng";
import { choice, optional, type ControlDef } from "./controls";
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
  /** Opciono: plovilo na reci (Beograd splav, Pariz bateau-mouche). */
  boat?(c: CityCtx, x: number, y: number, k: number): void;
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
  weight: 35,
  boat: (c, x, y, k) => drawSplav(c.ctx, x, y, k, c),
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

// ===========================================================================
// Pariz
// ===========================================================================

interface ParisDecision {
  eiffel: boolean;
  sacreCoeur: boolean;
  notreDame: boolean;
  bridge: boolean;
  eiffelSide: number; // 0..1 položaj Ajfelove kule
}

const PARIS: CityDef = {
  key: "paris",
  weight: 32.5,
  boat: (c, x, y, k) => drawBateau(c, x, y, k),
  decide(stream) {
    const d: ParisDecision = {
      eiffel: stream.next_f() < 0.85,
      sacreCoeur: stream.next_f() < 0.55,
      notreDame: stream.next_f() < 0.55,
      bridge: stream.next_f() < 0.6,
      eiffelSide: stream.next_f(),
    };
    if (!d.eiffel && !d.notreDame) d.eiffel = true;
    return d;
  },
  draw(c, rand, dd) {
    const d = dd as ParisDecision;
    const { ctx, w, s, horizonY } = c;
    // Monmartr sa Sacré-Cœur u daljini
    if (d.sacreCoeur) {
      const mx = w * (0.15 + 0.7 * rand());
      ctx.fillStyle = rgbString(c.far);
      ctx.beginPath();
      ctx.moveTo(mx - 280 * s, horizonY);
      ctx.quadraticCurveTo(mx, horizonY - 110 * s, mx + 280 * s, horizonY);
      ctx.closePath();
      ctx.fill();
      drawSacreCoeur(c, mx, horizonY - 52 * s, 0.9 * s);
    }
    parisRow(c, rand, c.far, 40, 70, 0.15);
    // Bliži red u boji bliskog plana (kontrast), dalji u izmaglici
    parisRow(c, rand, mix(c.near, c.mid, 0.35), 55, 95, 0.4);
    const marks: ((x: number) => void)[] = [];
    if (d.notreDame) marks.push((x) => drawNotreDame(c, x, horizonY, 1.15 * s));
    // Ajfelova kula na zadatom položaju, ostalo u slotovima
    marks.forEach((m, i) => m(w * ((i + 0.5) / Math.max(1, marks.length)) * 0.5 + (d.eiffelSide < 0.5 ? w * 0.5 : 0)));
    if (d.eiffel) drawEiffel(c, rand, d.eiffelSide < 0.5 ? w * (0.15 + 0.25 * d.eiffelSide * 2) : w * (0.6 + 0.25 * (d.eiffelSide - 0.5) * 2), horizonY, 1.3 * s);
    // Kej
    ctx.fillStyle = rgbString(mix(mix(c.lit, [190, 175, 150], 0.5), c.near, c.night ? 0.7 : 0.35));
    ctx.fillRect(0, horizonY - 10 * s, w, 10 * s);
    if (d.bridge) drawStoneBridge(c, w * (0.05 + 0.2 * rand()), w * (0.55 + 0.4 * rand()), horizonY - 26 * s, 5 + Math.floor(rand() * 3), [185, 170, 145]);
  },
};

/** Haussmann red: kremaste fasade, sivo-plavi mansardni krovovi sa prozorčićima i dimnjacima. */
function parisRow(c: CityCtx, rand: Rand, col: RGB, hMin: number, hMax: number, winShare: number): void {
  const { ctx, w, s, horizonY } = c;
  const stone = mix(mix(c.lit, [215, 195, 160], 0.45), col, 0.62);
  const zinc = mix(mix([80, 95, 115], c.near, 0.5), col, 0.25);
  let x = -10 * s;
  while (x < w) {
    const bw = (35 + rand() * 50) * s;
    const bh = (hMin + rand() * (hMax - hMin)) * s;
    const top = horizonY - bh;
    ctx.fillStyle = rgbString(c.night ? col : stone);
    ctx.fillRect(x, top, bw, bh + 1);
    // Mansarda
    const mh = bh * 0.22;
    ctx.fillStyle = rgbString(zinc);
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x + mh * 0.35, top - mh);
    ctx.lineTo(x + bw - mh * 0.35, top - mh);
    ctx.lineTo(x + bw, top);
    ctx.closePath();
    ctx.fill();
    // Prozorčići u mansardi i dimnjaci
    ctx.fillStyle = rgbString(c.night ? zinc : stone);
    for (let dx = x + 6 * s; dx < x + bw - 8 * s; dx += 10 * s) ctx.fillRect(dx, top - mh * 0.7, 3.5 * s, mh * 0.55);
    ctx.fillStyle = rgbString(mix(zinc, [150, 80, 60], 0.3));
    for (let k = 0; k < 2; k++) ctx.fillRect(x + bw * (0.2 + 0.55 * rand()), top - mh - 6 * s, 4 * s, 6 * s);
    if (!c.night) {
      ctx.fillStyle = rgba(c.lit, 0.2);
      ctx.fillRect(c.lightDir > 0 ? x : x + bw * 0.6, top, bw * 0.4, bh);
    }
    windows(c, rand, x, top, bw, bh, winShare);
    x += bw + rand() * 2 * s;
  }
}

/** Ajfelova kula: noge sa lukom, dve platforme, sužavanje, antena; rešetka; noću zlatna sa snopovima. */
function drawEiffel(c: CityCtx, rand: Rand, x: number, baseY: number, k: number): void {
  const { ctx } = c;
  const H = 300 * k;
  const iron = c.pal.floodlight ? ([230, 170, 80] as RGB) : mix(mix([95, 80, 70], c.near, 0.3), c.lit, c.night ? 0 : 0.15);
  // Snopovi reflektora sa vrha (noću)
  if (c.pal.floodlight) {
    const tx = x;
    const ty = baseY - H * 0.97;
    for (const a of [-2.6, -0.5]) {
      const ex = tx + Math.cos(a) * c.w;
      const ey = ty + Math.sin(a) * c.w * 0.3;
      const g = ctx.createLinearGradient(tx, ty, ex, ey);
      g.addColorStop(0, "rgba(255,240,200,0.35)");
      g.addColorStop(1, "rgba(255,240,200,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(ex, ey - 20 * k);
      ctx.lineTo(ex, ey + 20 * k);
      ctx.closePath();
      ctx.fill();
    }
  }
  const half = (y: number) => {
    // polu-širina siluete na visini y (od dna)
    const t = (baseY - y) / H;
    return 60 * k * Math.pow(1 - Math.min(1, t), 2.4) + 3 * k;
  };
  const path = () => {
    ctx.beginPath();
    const steps = 30;
    ctx.moveTo(x - half(baseY), baseY);
    for (let i = 1; i <= steps; i++) {
      const y = baseY - (H * 0.92 * i) / steps;
      ctx.lineTo(x - half(y), y);
    }
    ctx.lineTo(x, baseY - H);
    for (let i = steps; i >= 1; i--) {
      const y = baseY - (H * 0.92 * i) / steps;
      ctx.lineTo(x + half(y), y);
    }
    ctx.lineTo(x + half(baseY), baseY);
    // Luk između nogu
    const ay = baseY - H * 0.1;
    ctx.lineTo(x + half(baseY) * 0.55, baseY);
    ctx.quadraticCurveTo(x, ay - H * 0.06, x - half(baseY) * 0.55, baseY);
    ctx.closePath();
  };
  path();
  ctx.fillStyle = rgba(iron, 0.55);
  ctx.fill();
  // Rešetka (ukrštene linije klipovane na siluetu)
  ctx.save();
  path();
  ctx.clip();
  ctx.strokeStyle = rgbString(iron);
  ctx.lineWidth = Math.max(0.7, 0.9 * k);
  for (let i = -30; i < 30; i++) {
    ctx.beginPath();
    ctx.moveTo(x + i * 7 * k, baseY);
    ctx.lineTo(x + i * 7 * k + H * 0.6, baseY - H);
    ctx.moveTo(x + i * 7 * k, baseY);
    ctx.lineTo(x + i * 7 * k - H * 0.6, baseY - H);
    ctx.stroke();
  }
  ctx.restore();
  // Obris i platforme
  ctx.strokeStyle = rgbString(iron);
  ctx.lineWidth = Math.max(1, 1.6 * k);
  path();
  ctx.stroke();
  ctx.fillStyle = rgbString(iron);
  for (const t of [0.2, 0.42, 0.88]) {
    const y = baseY - H * t;
    const hw = half(y) + 6 * k;
    ctx.fillRect(x - hw, y - 3 * k, hw * 2, 5 * k);
  }
  ctx.fillRect(x - 1 * k, baseY - H - 18 * k, 2 * k, 18 * k);
  // Svetlucanje (noću)
  if (c.pal.floodlight) {
    for (let i = 0; i < 70; i++) {
      const y = baseY - rand() * H * 0.95;
      const px = x + (rand() - 0.5) * 2 * half(y);
      ctx.fillStyle = `rgba(255,250,230,${(0.4 + 0.6 * rand()).toFixed(2)})`;
      ctx.fillRect(px, y, 1.6 * k, 1.6 * k);
    }
  }
}

/** Sacré-Cœur: belo telo, izdužena centralna kupola, manje kupole, kampanila. */
function drawSacreCoeur(c: CityCtx, x: number, baseY: number, k: number): void {
  const { ctx } = c;
  const white = c.pal.floodlight ? mix(c.lit, [250, 245, 230], 0.6) : mix(mix(c.lit, [250, 248, 240], 0.5), c.far, 0.35);
  ctx.fillStyle = rgbString(white);
  ctx.fillRect(x - 60 * k, baseY - 40 * k, 120 * k, 40 * k);
  ctx.fillRect(x + 50 * k, baseY - 95 * k, 14 * k, 60 * k); // kampanila
  ctx.beginPath();
  ctx.ellipse(x + 57 * k, baseY - 95 * k, 7 * k, 12 * k, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillRect(x - 18 * k, baseY - 62 * k, 36 * k, 22 * k); // tambur
  ctx.beginPath();
  ctx.ellipse(x, baseY - 62 * k, 20 * k, 34 * k, 0, Math.PI, 0); // izdužena kupola
  ctx.fill();
  ctx.fillRect(x - 3 * k, baseY - 104 * k, 6 * k, 10 * k);
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(x + side * 40 * k, baseY - 40 * k, 10 * k, 16 * k, 0, Math.PI, 0);
    ctx.fill();
  }
  floodGlow(c, x, baseY - 50 * k, 90 * k, [255, 240, 220], 0.25);
}

/** Notre-Dame: dve četvrtaste kule, rozeta, šiljak (flèche), kontrafori. */
function drawNotreDame(c: CityCtx, x: number, baseY: number, k: number): void {
  const { ctx } = c;
  const stone = c.pal.floodlight ? mix(c.lit, [235, 215, 175], 0.55) : mix(mix(c.lit, [170, 160, 140], 0.5), c.near, c.night ? 0.6 : 0.25);
  const W = 110 * k;
  ctx.fillStyle = rgbString(stone);
  // Brod crkve iza
  ctx.fillRect(x - W * 0.2, baseY - 70 * k, W * 1.5, 70 * k);
  ctx.beginPath();
  ctx.moveTo(x - W * 0.2, baseY - 70 * k);
  ctx.lineTo(x + W * 0.55, baseY - 95 * k);
  ctx.lineTo(x + W * 1.3, baseY - 70 * k);
  ctx.closePath();
  ctx.fill();
  // Šiljak
  ctx.beginPath();
  ctx.moveTo(x + W * 0.75 - 5 * k, baseY - 92 * k);
  ctx.lineTo(x + W * 0.75, baseY - 160 * k);
  ctx.lineTo(x + W * 0.75 + 5 * k, baseY - 92 * k);
  ctx.closePath();
  ctx.fill();
  // Kontrafori (lukovi)
  ctx.strokeStyle = rgbString(stone);
  ctx.lineWidth = 2.5 * k;
  for (let i = 0; i < 5; i++) {
    const bx = x + W * 0.1 + i * W * 0.25;
    ctx.beginPath();
    ctx.moveTo(bx, baseY - 20 * k);
    ctx.quadraticCurveTo(bx + 6 * k, baseY - 60 * k, bx + 14 * k, baseY - 66 * k);
    ctx.stroke();
  }
  // Fasada sa kulama
  ctx.fillRect(x - W / 2, baseY - 95 * k, W, 95 * k);
  for (const side of [-1, 1]) ctx.fillRect(x + side * W * 0.32 - W * 0.18, baseY - 140 * k, W * 0.36, 45 * k);
  // Rozeta i portali
  ctx.fillStyle = rgba(mix(stone, [0, 0, 0], 0.45), 0.8);
  ctx.beginPath();
  ctx.arc(x, baseY - 70 * k, 11 * k, 0, Math.PI * 2);
  ctx.fill();
  for (const dx of [-0.3, 0, 0.3]) {
    const px = x + dx * W;
    ctx.beginPath();
    ctx.moveTo(px - 8 * k, baseY);
    ctx.lineTo(px - 8 * k, baseY - 20 * k);
    ctx.quadraticCurveTo(px, baseY - 34 * k, px + 8 * k, baseY - 20 * k);
    ctx.lineTo(px + 8 * k, baseY);
    ctx.closePath();
    ctx.fill();
  }
  for (const side of [-1, 1]) {
    for (let i = 0; i < 2; i++) ctx.fillRect(x + side * W * 0.32 - 7 * k + i * 9 * k, baseY - 135 * k, 5 * k, 30 * k);
  }
  floodGlow(c, x, baseY - 80 * k, 120 * k, [255, 225, 170], 0.25);
}

function drawBateau(c: CityCtx, x: number, y: number, k: number): void {
  const { ctx } = c;
  const body = mix(c.near, [0, 0, 0], 0.25);
  ctx.fillStyle = rgbString(body);
  ctx.beginPath();
  ctx.moveTo(x - 80 * k, y - 8 * k);
  ctx.lineTo(x + 70 * k, y - 8 * k);
  ctx.quadraticCurveTo(x + 90 * k, y - 8 * k, x + 84 * k, y + 2 * k);
  ctx.lineTo(x - 78 * k, y + 2 * k);
  ctx.closePath();
  ctx.fill();
  // Staklena kabina
  ctx.fillStyle = c.night || c.pal.windows > 0.3 ? "rgba(255,220,150,0.85)" : rgba(mix(c.skyHorizon, [255, 255, 255], 0.3), 0.8);
  ctx.fillRect(x - 65 * k, y - 20 * k, 120 * k, 12 * k);
  ctx.strokeStyle = rgbString(body);
  ctx.lineWidth = 1.5 * k;
  for (let i = 0; i <= 12; i++) {
    ctx.beginPath();
    ctx.moveTo(x - 65 * k + i * 10 * k, y - 20 * k);
    ctx.lineTo(x - 65 * k + i * 10 * k, y - 8 * k);
    ctx.stroke();
  }
  ctx.fillRect(x - 67 * k, y - 22 * k, 124 * k, 2.5 * k);
}

/**
 * Kameni most sa segmentnim lukovima (Pont-Neuf / Ponte Sant'Angelo).
 * Visina kolovoza se računa iz širine luka (centar luka malo ispod vode), pa
 * odraz zajedno sa lukom daje prepoznatljive „krugove". `deckYHint` se ignoriše
 * ako je prenizak za lukove.
 */
function drawStoneBridge(c: CityCtx, x0: number, x1: number, deckYHint: number, arches: number, stone: RGB): void {
  const { ctx, horizonY, s } = c;
  const col = c.pal.floodlight ? mix(stone, [240, 210, 160], 0.4) : mix(mix(stone, c.lit, 0.3), c.near, c.night ? 0.7 : 0.3);
  const span = (x1 - x0) / arches;
  const r = span * 0.4;
  const cy = horizonY + r * 0.2;
  const deckY = Math.min(deckYHint, cy - r - 7 * s);
  ctx.fillStyle = rgbString(col);
  ctx.beginPath();
  ctx.moveTo(x0, deckY);
  ctx.lineTo(x1, deckY);
  ctx.lineTo(x1, horizonY + 1);
  for (let i = arches - 1; i >= 0; i--) {
    const ax = x0 + span * (i + 0.5);
    // presek kruga sa linijom vode
    const dx = Math.sqrt(Math.max(0, r * r - (cy - horizonY) * (cy - horizonY)));
    const a0 = Math.atan2(horizonY - cy, dx);
    ctx.lineTo(ax + dx, horizonY + 1);
    ctx.arc(ax, cy, r, a0, Math.PI - a0, true);
    ctx.lineTo(ax - dx, horizonY + 1);
  }
  ctx.lineTo(x0, horizonY + 1);
  ctx.closePath();
  ctx.fill();
  // Ograda + venac
  ctx.fillRect(x0, deckY - 5 * s, x1 - x0, 2.5 * s);
  for (let x = x0; x < x1; x += 7 * s) ctx.fillRect(x, deckY - 5 * s, 1.5 * s, 5 * s);
  ctx.fillStyle = rgba(mix(col, [0, 0, 0], 0.35), 0.6);
  ctx.fillRect(x0, deckY + 2 * s, x1 - x0, 2 * s);
  if (c.pal.floodlight) {
    for (let i = 0; i <= arches; i++) floodGlow(c, x0 + span * i, deckY - 10 * s, 14 * s, [255, 220, 150], 0.8);
  }
}

// ===========================================================================
// Rim
// ===========================================================================

interface RomeDecision {
  colosseum: boolean;
  stPeter: boolean;
  castel: boolean;
  bridge: boolean;
  pines: number;
}

const ROME: CityDef = {
  key: "rome",
  weight: 32.5,
  decide(stream) {
    const d: RomeDecision = {
      colosseum: stream.next_f() < 0.7,
      stPeter: stream.next_f() < 0.75,
      castel: stream.next_f() < 0.45,
      bridge: stream.next_f() < 0.5,
      pines: stream.next_int(2, 6),
    };
    if (!d.colosseum && !d.stPeter) d.stPeter = true;
    return d;
  },
  draw(c, rand, dd) {
    const d = dd as RomeDecision;
    const { ctx, w, s, horizonY } = c;
    romeRow(c, rand, c.far, 30, 60, 0.15);
    // Kupola Sv. Petra (u daljini, ali velika)
    if (d.stPeter) drawStPeter(c, w * (0.2 + 0.6 * rand()), horizonY - 8 * s, 1.25 * s);
    romeRow(c, rand, c.mid, 40, 80, 0.35);
    if (d.colosseum) drawColosseum(c, w * (0.15 + 0.7 * rand()), horizonY, 1.15 * s);
    if (d.castel) drawCastelSantAngelo(c, w * (0.1 + 0.8 * rand()), horizonY, 1.1 * s);
    // Pinije i čempresi
    for (let i = 0; i < d.pines; i++) {
      const px = w * rand();
      if (rand() < 0.6) drawUmbrellaPine(c, rand, px, horizonY, (0.9 + 0.5 * rand()) * s);
      else drawCypress(c, px, horizonY, (0.9 + 0.5 * rand()) * s);
    }
    ctx.fillStyle = rgbString(mix(mix(c.lit, [200, 170, 130], 0.5), c.near, c.night ? 0.7 : 0.35));
    ctx.fillRect(0, horizonY - 8 * s, w, 8 * s);
    if (d.bridge) drawStoneBridge(c, w * (0.1 + 0.2 * rand()), w * (0.6 + 0.3 * rand()), horizonY - 24 * s, 3 + Math.floor(rand() * 3), [205, 185, 150]);
  },
};

/** Rimski red: oker/terakota fasade, crep, zvonici i kupolice crkava. */
function romeRow(c: CityCtx, rand: Rand, col: RGB, hMin: number, hMax: number, winShare: number): void {
  const { ctx, w, s, horizonY } = c;
  const ochres: RGB[] = [[215, 160, 90], [200, 120, 70], [225, 185, 120], [190, 105, 75]];
  let x = -10 * s;
  while (x < w) {
    const bw = (30 + rand() * 50) * s;
    const bh = (hMin + rand() * (hMax - hMin)) * s;
    const top = horizonY - bh;
    const fac = c.night ? col : mix(mix(ochres[Math.floor(rand() * ochres.length)]!, c.lit, 0.25), col, 0.45);
    ctx.fillStyle = rgbString(fac);
    ctx.fillRect(x, top, bw, bh + 1);
    // Crep (nizak kos krov)
    ctx.fillStyle = rgbString(c.night ? mix(col, [0, 0, 0], 0.2) : mix(mix([175, 85, 55], c.lit, 0.15), col, 0.4));
    ctx.beginPath();
    ctx.moveTo(x - 2 * s, top);
    ctx.lineTo(x + bw / 2, top - bw * 0.12);
    ctx.lineTo(x + bw + 2 * s, top);
    ctx.closePath();
    ctx.fill();
    const r = rand();
    if (r < 0.1) {
      // Romanički zvonik
      const tx = x + bw * 0.5;
      ctx.fillStyle = rgbString(fac);
      ctx.fillRect(tx - 8 * s, top - bh * 0.9, 16 * s, bh * 0.9);
      ctx.fillStyle = rgba(mix(fac, [0, 0, 0], 0.5), 0.7);
      for (let k = 0; k < 3; k++) {
        ctx.fillRect(tx - 5 * s, top - bh * 0.85 + k * 12 * s, 3 * s, 7 * s);
        ctx.fillRect(tx + 2 * s, top - bh * 0.85 + k * 12 * s, 3 * s, 7 * s);
      }
      ctx.fillStyle = rgbString(mix([175, 85, 55], col, 0.4));
      ctx.beginPath();
      ctx.moveTo(tx - 10 * s, top - bh * 0.9);
      ctx.lineTo(tx, top - bh * 0.9 - 12 * s);
      ctx.lineTo(tx + 10 * s, top - bh * 0.9);
      ctx.closePath();
      ctx.fill();
    } else if (r < 0.18) {
      // Mala kupola crkve
      ctx.fillStyle = rgbString(mix(mix([160, 150, 135], c.lit, 0.2), col, 0.4));
      ctx.beginPath();
      ctx.arc(x + bw / 2, top - 4 * s, bw * 0.25, Math.PI, 0);
      ctx.fill();
    }
    if (!c.night) {
      ctx.fillStyle = rgba(c.lit, 0.18);
      ctx.fillRect(c.lightDir > 0 ? x : x + bw * 0.6, top, bw * 0.4, bh);
    }
    windows(c, rand, x, top, bw, bh, winShare);
    x += bw + rand() * 3 * s;
  }
}

/** Koloseum: tri reda lukova + atika, oštećena (niža) ivica sa jedne strane. */
function drawColosseum(c: CityCtx, x: number, baseY: number, k: number): void {
  const { ctx } = c;
  const W = 230 * k;
  const H = 85 * k;
  const trav = c.pal.floodlight ? mix(c.lit, [245, 215, 160], 0.6) : mix(mix(c.lit, [220, 195, 160], 0.55), c.near, c.night ? 0.65 : 0.15);
  const shade = mix(trav, [40, 30, 25], 0.55);
  floodGlow(c, x, baseY - H * 0.5, W * 0.7, [255, 215, 150], 0.3);
  // Obris: puna visina levo, oštećena (stepenasto niža) desno
  ctx.fillStyle = rgbString(trav);
  ctx.beginPath();
  ctx.moveTo(x - W / 2, baseY);
  ctx.lineTo(x - W / 2, baseY - H * 0.95);
  ctx.quadraticCurveTo(x - W * 0.1, baseY - H * 1.05, x + W * 0.12, baseY - H);
  ctx.lineTo(x + W * 0.2, baseY - H * 0.78);
  ctx.lineTo(x + W * 0.32, baseY - H * 0.72);
  ctx.lineTo(x + W * 0.4, baseY - H * 0.5);
  ctx.lineTo(x + W / 2, baseY - H * 0.45);
  ctx.lineTo(x + W / 2, baseY);
  ctx.closePath();
  ctx.fill();
  // Lukovi u tri reda (+ atika sa pravougaonim otvorima)
  ctx.save();
  ctx.clip();
  ctx.fillStyle = rgbString(shade);
  const rows = 3;
  const rowH = (H * 0.78) / rows;
  for (let r = 0; r < rows; r++) {
    const y0 = baseY - r * rowH;
    const n = 14;
    for (let i = 0; i < n; i++) {
      const ax = x - W / 2 + (W * (i + 0.5)) / n;
      // Zakrivljenost: lukovi uži ka ivicama (elipsa u perspektivi)
      const u = (ax - x) / (W / 2);
      const aw = (W / n) * 0.55 * Math.sqrt(1 - u * u * 0.6);
      ctx.beginPath();
      ctx.moveTo(ax - aw / 2, y0 - rowH * 0.12);
      ctx.lineTo(ax - aw / 2, y0 - rowH * 0.6);
      ctx.arc(ax, y0 - rowH * 0.6, aw / 2, Math.PI, 0);
      ctx.lineTo(ax + aw / 2, y0 - rowH * 0.12);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillRect(x - W / 2, y0 - rowH - 1.5 * k, W, 2.5 * k);
  }
  for (let i = 0; i < 18; i++) {
    const ax = x - W / 2 + (W * (i + 0.5)) / 18;
    ctx.fillRect(ax - 2 * k, baseY - H * 0.9, 4 * k, 5 * k);
  }
  // Senovita strana zakrivljenog zida
  const g = ctx.createLinearGradient(x - W / 2, 0, x + W / 2, 0);
  g.addColorStop(0, rgba([0, 0, 0], c.lightDir > 0 ? 0 : 0.3));
  g.addColorStop(1, rgba([0, 0, 0], c.lightDir > 0 ? 0.3 : 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - W / 2, baseY - H * 1.1, W, H * 1.1);
  ctx.restore();
}

/** Kupola Sv. Petra: tambur sa stubovima, rebrasta kupola, fenjer, bočne kupolice, fasada. */
function drawStPeter(c: CityCtx, x: number, baseY: number, k: number): void {
  const { ctx } = c;
  const stone = c.pal.floodlight ? mix(c.lit, [240, 225, 195], 0.55) : mix(mix(c.lit, [215, 205, 185], 0.5), c.far, 0.3);
  const dome = c.pal.floodlight ? mix(stone, [170, 175, 180], 0.3) : mix(mix([150, 160, 165], c.lit, 0.2), c.far, 0.3);
  floodGlow(c, x, baseY - 110 * k, 140 * k, [255, 230, 190], 0.25);
  ctx.fillStyle = rgbString(stone);
  ctx.fillRect(x - 90 * k, baseY - 45 * k, 180 * k, 45 * k); // fasada/bazilika
  ctx.fillRect(x - 32 * k, baseY - 80 * k, 64 * k, 35 * k); // tambur
  ctx.fillStyle = rgba(mix(stone, [0, 0, 0], 0.35), 0.7);
  for (let i = 0; i < 8; i++) ctx.fillRect(x - 30 * k + i * 8 * k, baseY - 78 * k, 3 * k, 30 * k);
  ctx.fillStyle = rgbString(dome);
  ctx.beginPath();
  ctx.ellipse(x, baseY - 80 * k, 36 * k, 52 * k, 0, Math.PI, 0);
  ctx.fill();
  ctx.strokeStyle = rgba(mix(dome, [255, 255, 255], 0.35), 0.6);
  ctx.lineWidth = Math.max(1, 1.2 * k);
  for (const t of [-0.6, -0.25, 0.25, 0.6]) {
    ctx.beginPath();
    ctx.moveTo(x + t * 36 * k, baseY - 80 * k);
    ctx.quadraticCurveTo(x + t * 30 * k, baseY - 125 * k, x, baseY - 132 * k);
    ctx.stroke();
  }
  ctx.fillStyle = rgbString(stone);
  ctx.fillRect(x - 6 * k, baseY - 146 * k, 12 * k, 16 * k); // fenjer
  ctx.beginPath();
  ctx.arc(x, baseY - 146 * k, 6 * k, Math.PI, 0);
  ctx.fill();
  ctx.fillRect(x - 1 * k, baseY - 162 * k, 2 * k, 12 * k);
  ctx.fillRect(x - 4 * k, baseY - 158 * k, 8 * k, 2 * k);
  ctx.fillStyle = rgbString(dome);
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(x + side * 62 * k, baseY - 45 * k, 12 * k, 16 * k, 0, Math.PI, 0);
    ctx.fill();
  }
}

/** Anđeoska tvrđava: okrugli bubanj na kvadratnoj osnovi, anđeo na vrhu. */
function drawCastelSantAngelo(c: CityCtx, x: number, baseY: number, k: number): void {
  const { ctx } = c;
  const stone = c.pal.floodlight ? mix(c.lit, [235, 205, 160], 0.5) : mix(mix(c.lit, [190, 165, 130], 0.5), c.near, c.night ? 0.65 : 0.25);
  ctx.fillStyle = rgbString(stone);
  ctx.fillRect(x - 85 * k, baseY - 30 * k, 170 * k, 30 * k);
  for (let i = -85; i < 85; i += 9) ctx.fillRect(x + i * k, baseY - 34 * k, 5 * k, 4 * k);
  ctx.fillRect(x - 55 * k, baseY - 72 * k, 110 * k, 42 * k);
  ctx.fillStyle = rgba(mix(stone, [0, 0, 0], 0.3), 0.6);
  ctx.fillRect(c.lightDir > 0 ? x + 15 * k : x - 55 * k, baseY - 72 * k, 40 * k, 42 * k);
  ctx.fillStyle = rgbString(stone);
  ctx.fillRect(x - 20 * k, baseY - 95 * k, 40 * k, 23 * k);
  // Anđeo (silueta sa krilima)
  ctx.fillStyle = rgbString(mix(stone, [60, 70, 60], 0.4));
  ctx.fillRect(x - 2 * k, baseY - 112 * k, 4 * k, 17 * k);
  ctx.beginPath();
  ctx.arc(x, baseY - 114 * k, 2.5 * k, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x, baseY - 108 * k);
  ctx.lineTo(x - 9 * k, baseY - 116 * k);
  ctx.lineTo(x - 4 * k, baseY - 104 * k);
  ctx.moveTo(x, baseY - 108 * k);
  ctx.lineTo(x + 9 * k, baseY - 116 * k);
  ctx.lineTo(x + 4 * k, baseY - 104 * k);
  ctx.fill();
  floodGlow(c, x, baseY - 60 * k, 110 * k, [255, 215, 160], 0.22);
}

/** Pinija: visoko golo stablo + široka ravna krošnja. */
function drawUmbrellaPine(c: CityCtx, rand: Rand, x: number, baseY: number, k: number): void {
  const { ctx } = c;
  const H = (90 + rand() * 50) * k;
  const col = mix(mix([60, 85, 50], c.lit, 0.1), c.near, c.night ? 0.8 : 0.35);
  ctx.strokeStyle = rgbString(mix(col, [70, 50, 40], 0.4));
  ctx.lineWidth = 3.5 * k;
  ctx.lineCap = "round";
  const lean = (rand() - 0.5) * 20 * k;
  ctx.beginPath();
  ctx.moveTo(x, baseY);
  ctx.quadraticCurveTo(x + lean * 0.3, baseY - H * 0.6, x + lean, baseY - H);
  ctx.stroke();
  ctx.fillStyle = rgbString(col);
  ctx.beginPath();
  const cw = (55 + rand() * 30) * k;
  for (let i = 0; i < 7; i++) {
    const u = (i / 6 - 0.5) * 2;
    const bx = x + lean + u * cw * 0.8;
    const by = baseY - H - (1 - u * u) * 10 * k;
    const r = (17 + 7 * rand()) * k * (1 - Math.abs(u) * 0.3);
    ctx.moveTo(bx + r, by);
    ctx.ellipse(bx, by, r, r * 0.6, 0, 0, Math.PI * 2);
  }
  ctx.fill();
}

function drawCypress(c: CityCtx, x: number, baseY: number, k: number): void {
  const { ctx } = c;
  const H = 110 * k;
  ctx.fillStyle = rgbString(mix(mix([40, 70, 45], c.lit, 0.05), c.near, c.night ? 0.8 : 0.35));
  ctx.beginPath();
  ctx.moveTo(x, baseY - H);
  ctx.quadraticCurveTo(x + 11 * k, baseY - H * 0.55, x + 6 * k, baseY);
  ctx.lineTo(x - 6 * k, baseY);
  ctx.quadraticCurveTo(x - 11 * k, baseY - H * 0.55, x, baseY - H);
  ctx.fill();
}

const CITIES: readonly CityDef[] = [BELGRADE, PARIS, ROME];

/** Kontrole za Studio. */
export const CITIES_CONTROLS: ControlDef[] = [
  { key: "palette", type: "choice", label: "palette", options: PALETTES.map((p) => p.name) },
  { key: "city", type: "choice", label: "city", options: ["belgrade", "paris", "rome"] },
  { key: "boat", type: "toggle", label: "boat" },
];

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
  let cityIdx = 0;
  for (let i = 0; i < CITIES.length; i++) {
    if (roll < CITIES[i]!.weight) {
      cityIdx = i;
      break;
    }
    roll -= CITIES[i]!.weight;
  }
  const city = CITIES[choice(hooks, "city", cityIdx, CITIES.length)]!;
  const pal = PALETTES[choice(hooks, "palette", stream.next_int(0, PALETTES.length - 1), PALETTES.length)]!;
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
    fg.addColorStop(1, rgba(fogCol, 0.15 + 0.4 * pal.fog));
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
  const boat = city.boat;
  if (boat) {
    optional(c.ctx, hooks, "boat", splavRoll < 0.35, rand, (bctx, rand) => {
      const sx = w * (0.15 + 0.7 * rand());
      const sy = horizonY + (h - horizonY) * (0.35 + 0.3 * rand());
      boat({ ...c, ctx: bctx }, sx, sy, s * (1 + 0.4 * rand()));
    });
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
