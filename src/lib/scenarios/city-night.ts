/**
 * Noćni grad — render v2.
 *
 * Redosled: nebo + svetlosno zagađenje → zvezde → mesec (pun/srp) + sjaj →
 * oblaci obasjani mesecom (opciono) → 3 sloja zgrada (dalji svetliji, u izmaglici)
 * sa prozorima po spratovima → izmaglica između slojeva → reka sa odrazima
 * (opciono) ili sjaj ulice.
 *
 * QRNG bira odluke (paleta, horizont, reka, mesec, gustina grada);
 * zgrade, prozori i zvezde idu iz PRNG-a seedovanog QRNG-om.
 * Sve dimenzije su relativne (s = w/1200).
 */
import type { QRNGStream } from "../qrng";
import { hslToRgb, rgbString, type RGB } from "../color";
import { prngFromStream, type Rand } from "../prng";

type HSL = [number, number, number];

interface NightPalette {
  name: string;
  skyTop: HSL;
  skyHorizon: HSL; // svetlosno zagađenje pri horizontu
  building: HSL; // najbliži sloj
  windowsWarm: HSL;
  windowsCool: HSL;
  /** Udeo hladnih prozora 0–1 */
  coolShare: number;
  stars: number; // 0–1 gustina zvezda
}

const PALETTES: readonly NightPalette[] = [
  {
    name: "midnight",
    skyTop: [228, 0.55, 0.07],
    skyHorizon: [225, 0.4, 0.24],
    building: [225, 0.35, 0.06],
    windowsWarm: [45, 0.95, 0.72],
    windowsCool: [200, 0.6, 0.78],
    coolShare: 0.2,
    stars: 1,
  },
  {
    name: "neon-violet",
    skyTop: [265, 0.55, 0.07],
    skyHorizon: [300, 0.5, 0.26],
    building: [265, 0.35, 0.07],
    windowsWarm: [320, 0.9, 0.72],
    windowsCool: [190, 0.9, 0.65],
    coolShare: 0.45,
    stars: 0.5,
  },
  {
    name: "teal",
    skyTop: [200, 0.6, 0.06],
    skyHorizon: [185, 0.45, 0.22],
    building: [200, 0.4, 0.06],
    windowsWarm: [40, 0.9, 0.7],
    windowsCool: [175, 0.7, 0.7],
    coolShare: 0.3,
    stars: 0.8,
  },
  {
    name: "smog-amber",
    skyTop: [240, 0.3, 0.08],
    skyHorizon: [28, 0.6, 0.32],
    building: [250, 0.25, 0.07],
    windowsWarm: [38, 1, 0.66],
    windowsCool: [50, 0.5, 0.82],
    coolShare: 0.15,
    stars: 0.25,
  },
  {
    name: "winter",
    skyTop: [215, 0.35, 0.1],
    skyHorizon: [210, 0.25, 0.33],
    building: [215, 0.25, 0.08],
    windowsWarm: [42, 0.85, 0.75],
    windowsCool: [205, 0.5, 0.85],
    coolShare: 0.35,
    stars: 0.7,
  },
  {
    name: "indigo",
    skyTop: [245, 0.6, 0.05],
    skyHorizon: [255, 0.45, 0.2],
    building: [245, 0.4, 0.05],
    windowsWarm: [35, 0.95, 0.65],
    windowsCool: [230, 0.7, 0.8],
    coolShare: 0.25,
    stars: 1,
  },
];

function hsl(c: HSL, dh = 0, dl = 0): RGB {
  return hslToRgb(c[0] + dh, c[1], Math.min(0.95, Math.max(0.02, c[2] + dl)));
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

type Roof = "flat" | "stepped" | "spire" | "dome" | "slant" | "tower";

interface Building {
  x: number;
  w: number;
  top: number; // y vrha tela zgrade
  roof: Roof;
  warm: boolean;
}

export function renderCityNight(
  ctx: CanvasRenderingContext2D,
  stream: QRNGStream,
  w: number,
  h: number
): void {
  const s = w / 1200;

  // ---- Odluke (QRNG) ----
  const pal = PALETTES[stream.next_int(0, PALETTES.length - 1)]!;
  const dh = stream.next_int(-8, 8);
  const hasRiver = stream.next_f() < 0.5;
  // Linija na kojoj zgrade stoje (obala ili ulica)
  const groundY = Math.floor(h * (hasRiver ? 0.6 + 0.1 * stream.next_f() : 0.82 + 0.1 * stream.next_f()));
  const density = 0.7 + 0.6 * stream.next_f(); // visina/gustina grada
  const moonX = w * (0.1 + 0.8 * stream.next_f());
  const moonY = groundY * (0.12 + 0.3 * stream.next_f());
  const moonR = (16 + 16 * stream.next_f()) * s;
  const crescent = stream.next_f() < 0.45;
  const cloudsRoll = stream.next_f();
  const rand = prngFromStream(stream);

  const skyTop = hsl(pal.skyTop, dh);
  const skyHorizon = hsl(pal.skyHorizon, dh);
  const nearCol = hsl(pal.building, dh);
  const warmWin = hsl(pal.windowsWarm);
  const coolWin = hsl(pal.windowsCool);

  // ---- 1. Nebo + svetlosno zagađenje ----
  const sky = ctx.createLinearGradient(0, 0, 0, groundY);
  sky.addColorStop(0, rgbString(skyTop));
  sky.addColorStop(0.55, rgbString(mix(skyTop, skyHorizon, 0.35)));
  sky.addColorStop(1, rgbString(skyHorizon));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // ---- 2. Zvezde (ređe pri horizontu i u smogu) ----
  const starN = Math.floor((120 + rand() * 220) * pal.stars);
  for (let i = 0; i < starN; i++) {
    const y = Math.pow(rand(), 1.5) * groundY * 0.75;
    const x = rand() * w;
    const a = (0.25 + 0.7 * rand()) * (1 - y / (groundY * 0.8));
    if (a < 0.05) continue;
    ctx.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(x, y, (rand() < 0.92 ? 0.7 : 1.3) * Math.max(0.6, s), 0, Math.PI * 2);
    ctx.fill();
  }

  // ---- 3. Mesec ----
  const moonCol: RGB = [246, 244, 230];
  const glow = ctx.createRadialGradient(moonX, moonY, moonR * 0.8, moonX, moonY, moonR * 7);
  glow.addColorStop(0, rgba(moonCol, crescent ? 0.16 : 0.3));
  glow.addColorStop(0.3, rgba(moonCol, crescent ? 0.05 : 0.1));
  glow.addColorStop(1, rgba(moonCol, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(moonX - moonR * 7, moonY - moonR * 7, moonR * 14, moonR * 14);
  ctx.save();
  ctx.beginPath();
  ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2);
  ctx.clip();
  ctx.beginPath();
  ctx.rect(moonX - moonR, moonY - moonR, moonR * 2, moonR * 2);
  if (crescent) {
    const side = rand() < 0.5 ? -1 : 1;
    ctx.arc(moonX + side * moonR * 0.55, moonY - moonR * 0.2, moonR * 0.95, 0, Math.PI * 2);
  }
  const core = ctx.createRadialGradient(moonX - moonR * 0.3, moonY - moonR * 0.3, 0, moonX, moonY, moonR);
  core.addColorStop(0, "rgb(255,253,243)");
  core.addColorStop(1, rgbString(moonCol));
  ctx.fillStyle = core;
  ctx.fill("evenodd");
  // Blage „mare" mrlje na punom mesecu
  if (!crescent) {
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = "rgba(200,198,185,0.25)";
      ctx.beginPath();
      ctx.arc(
        moonX + (rand() - 0.5) * moonR,
        moonY + (rand() - 0.5) * moonR,
        moonR * (0.15 + 0.2 * rand()),
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
  }
  ctx.restore();

  // ---- 4. Tanki oblaci obasjani mesecom (opciono) ----
  if (cloudsRoll < 0.45) {
    const n = 2 + Math.floor(rand() * 4);
    for (let i = 0; i < n; i++) {
      const cy = groundY * (0.1 + 0.45 * rand());
      const cx = rand() * w;
      const cw = w * (0.15 + 0.25 * rand());
      const near = 1 - Math.min(1, Math.hypot(cx - moonX, cy - moonY) / (w * 0.5));
      const col = mix(mix(skyTop, skyHorizon, 0.5), moonCol, 0.12 + near * 0.35);
      ctx.fillStyle = rgba(col, 0.55);
      ctx.beginPath();
      const blobs = 6 + Math.floor(rand() * 6);
      for (let b = 0; b < blobs; b++) {
        const bx = cx + (rand() - 0.5) * cw;
        const rx = cw * (0.08 + 0.12 * rand());
        const ry = (4 + 8 * rand()) * s;
        ctx.save();
        ctx.translate(bx, cy - ry * 0.4 * rand());
        ctx.scale(rx, ry);
        ctx.moveTo(1, 0);
        ctx.arc(0, 0, 1, 0, Math.PI * 2);
        ctx.restore();
      }
      ctx.fill();
    }
  }

  // ---- 5. Zgrade u 3 sloja (dalji → bliži) ----
  const layers = [
    { haze: 0.62, hMin: 0.18, hMax: 0.42, wMin: 30, wMax: 70, lit: 0.18, winA: 0.35 },
    { haze: 0.35, hMin: 0.14, hMax: 0.36, wMin: 40, wMax: 90, lit: 0.3, winA: 0.6 },
    { haze: 0, hMin: 0.08, hMax: 0.3, wMin: 50, wMax: 120, lit: 0.42, winA: 0.95 },
  ];
  const nearLayer: { b: Building; col: RGB }[] = [];

  layers.forEach((L, li) => {
    const col = mix(nearCol, skyHorizon, L.haze);
    let x = -rand() * 40 * s;
    while (x < w) {
      const bw = (L.wMin + rand() * (L.wMax - L.wMin)) * s;
      const bh = groundY * (L.hMin + rand() * (L.hMax - L.hMin)) * density * (rand() < 0.12 ? 1.6 : 1);
      const roofs: Roof[] = ["flat", "flat", "stepped", "spire", "dome", "slant", "tower"];
      const b: Building = {
        x,
        w: bw,
        top: groundY - bh,
        roof: roofs[Math.floor(rand() * roofs.length)]!,
        warm: rand() > pal.coolShare,
      };
      drawBuilding(ctx, b, groundY, col, s, li >= 1 && rand() < 0.35);
      drawWindows(ctx, rand, b, groundY, s, b.warm ? warmWin : coolWin, L.lit, L.winA);
      if (li === 2) nearLayer.push({ b, col });
      x += bw + (rand() < 0.3 ? rand() * 20 * s : -rand() * 6 * s);
    }

    // Izmaglica ispred svakog daljeg sloja
    if (li < 2) {
      const hazeTop = groundY - groundY * 0.35;
      const g = ctx.createLinearGradient(0, hazeTop, 0, groundY);
      g.addColorStop(0, rgba(skyHorizon, 0));
      g.addColorStop(1, rgba(skyHorizon, 0.35));
      ctx.fillStyle = g;
      ctx.fillRect(0, hazeTop, w, groundY - hazeTop);
    }
  });

  // ---- 6. Reka sa odrazima ili ulica ----
  if (hasRiver) {
    const water = ctx.createLinearGradient(0, groundY, 0, h);
    water.addColorStop(0, rgbString(mix(skyHorizon, nearCol, 0.55)));
    water.addColorStop(1, rgbString(mix(skyTop, [0, 0, 0], 0.4)));
    ctx.fillStyle = water;
    ctx.fillRect(0, groundY, w, h - groundY);

    // Odrazi zgrada (prigušeni, skraćeni)
    for (const { b, col } of nearLayer) {
      const rh = Math.min(h - groundY, (groundY - b.top) * 0.8);
      ctx.fillStyle = rgba(mix(col, skyHorizon, 0.15), 0.7);
      ctx.fillRect(b.x, groundY, b.w, rh);
    }
    // Odsjaji svetala: vertikalne isprekidane crtice
    for (const { b } of nearLayer) {
      const c = b.warm ? warmWin : coolWin;
      const streaks = 2 + Math.floor(rand() * 4);
      for (let k = 0; k < streaks; k++) {
        const sx = b.x + rand() * b.w;
        let y = groundY + 2 * s;
        const maxY = groundY + Math.min(h - groundY, (groundY - b.top) * 0.9);
        while (y < maxY) {
          const len = (2 + rand() * 6) * s;
          const a = 0.85 * (1 - (y - groundY) / (maxY - groundY + 1)) * (0.3 + 0.7 * rand());
          if (a > 0.05) {
            ctx.fillStyle = rgba(c, a);
            ctx.fillRect(sx + (rand() - 0.5) * 6 * s, y, (2 + rand() * 6) * s, Math.max(1, 1.2 * s));
          }
          y += len;
        }
      }
    }
    // Odsjaj meseca
    const mPath = 40 + Math.floor(rand() * 40);
    for (let i = 0; i < mPath; i++) {
      const t = rand();
      const y = groundY + 4 * s + t * (h - groundY);
      const len = (8 + rand() * 30) * s;
      ctx.fillStyle = rgba(moonCol, (crescent ? 0.18 : 0.35) * (1 - t) * rand());
      ctx.fillRect(moonX + (rand() - 0.5) * moonR * 3 - len / 2, y, len, Math.max(1, s));
    }
    // Linija obale
    ctx.fillStyle = rgba(mix(nearCol, [0, 0, 0], 0.4), 1);
    ctx.fillRect(0, groundY - 1, w, Math.max(2, 3 * s));
  } else {
    // Ulica: tamna podloga + topli sjaj odozdo
    ctx.fillStyle = rgbString(mix(nearCol, [0, 0, 0], 0.3));
    ctx.fillRect(0, groundY, w, h - groundY);
    const g = ctx.createLinearGradient(0, groundY - 40 * s, 0, h);
    g.addColorStop(0, rgba(warmWin, 0));
    g.addColorStop(0.5, rgba(warmWin, 0.12));
    g.addColorStop(1, rgba(warmWin, 0.05));
    ctx.fillStyle = g;
    ctx.fillRect(0, groundY - 40 * s, w, h - groundY + 40 * s);
    // Ulične svetiljke: stub + mala lampa + meki krug svetla na tlu
    const lamps = 4 + Math.floor(rand() * 5);
    const postH = Math.min((h - groundY) * 0.8, 34 * s);
    for (let i = 0; i < lamps; i++) {
      const lx = (i + 0.5 + (rand() - 0.5) * 0.6) * (w / lamps);
      const baseY = groundY + (h - groundY) * (0.75 + 0.2 * rand());
      const topY = baseY - postH;
      const pool = ctx.createRadialGradient(lx, baseY, 0, lx, baseY, 40 * s);
      pool.addColorStop(0, rgba(warmWin, 0.22));
      pool.addColorStop(1, rgba(warmWin, 0));
      ctx.fillStyle = pool;
      ctx.fillRect(lx - 40 * s, baseY - 40 * s, 80 * s, 80 * s);
      ctx.fillStyle = rgbString(mix(nearCol, [0, 0, 0], 0.5));
      ctx.fillRect(lx - 0.9 * s, topY, 1.8 * s, postH);
      ctx.fillRect(lx - 0.9 * s, topY, 6 * s, 1.6 * s);
      const lg = ctx.createRadialGradient(lx + 5 * s, topY + 2 * s, 0, lx + 5 * s, topY + 2 * s, 12 * s);
      lg.addColorStop(0, rgba(mix(warmWin, [255, 255, 255], 0.5), 0.95));
      lg.addColorStop(0.3, rgba(warmWin, 0.35));
      lg.addColorStop(1, rgba(warmWin, 0));
      ctx.fillStyle = lg;
      ctx.fillRect(lx - 7 * s, topY - 10 * s, 24 * s, 24 * s);
    }
  }
}

function drawBuilding(
  ctx: CanvasRenderingContext2D,
  b: Building,
  groundY: number,
  col: RGB,
  s: number,
  beacon: boolean
): void {
  ctx.fillStyle = rgbString(col);
  const { x, w: bw, top } = b;
  ctx.fillRect(x, top, bw, groundY - top + 1);
  ctx.beginPath();
  switch (b.roof) {
    case "stepped": {
      ctx.rect(x + bw * 0.15, top - bw * 0.35, bw * 0.7, bw * 0.35 + 1);
      ctx.rect(x + bw * 0.32, top - bw * 0.6, bw * 0.36, bw * 0.25 + 1);
      break;
    }
    case "spire": {
      ctx.moveTo(x + bw * 0.3, top + 1);
      ctx.lineTo(x + bw * 0.5, top - bw * 0.9);
      ctx.lineTo(x + bw * 0.7, top + 1);
      ctx.closePath();
      ctx.rect(x + bw * 0.5 - 0.8 * s, top - bw * 1.4, 1.6 * s, bw * 0.6);
      break;
    }
    case "dome": {
      ctx.arc(x + bw / 2, top + 1, bw * 0.38, Math.PI, 0);
      break;
    }
    case "slant": {
      ctx.moveTo(x, top + 1);
      ctx.lineTo(x, top - bw * 0.3);
      ctx.lineTo(x + bw, top + 1);
      ctx.closePath();
      break;
    }
    case "tower": {
      // Vodotoranj na nogarima
      const tx = x + bw * 0.55;
      const tw = Math.max(8 * s, bw * 0.25);
      ctx.rect(tx, top - tw * 1.4, tw, tw * 0.9);
      ctx.rect(tx + tw * 0.1, top - tw * 0.5, 1.5 * s, tw * 0.5);
      ctx.rect(tx + tw * 0.8, top - tw * 0.5, 1.5 * s, tw * 0.5);
      ctx.moveTo(tx - 1 * s, top - tw * 1.4);
      ctx.lineTo(tx + tw / 2, top - tw * 1.8);
      ctx.lineTo(tx + tw + 1 * s, top - tw * 1.4);
      ctx.closePath();
      break;
    }
    default:
      ctx.rect(x + bw * 0.1, top - 4 * s, bw * 0.25, 4 * s + 1);
  }
  ctx.fill();

  // Crveno svetlo na visokim zgradama
  if (beacon && (b.roof === "spire" || groundY - top > groundY * 0.3)) {
    const ax = x + bw * 0.5;
    const ay = b.roof === "spire" ? top - bw * 1.4 : top - 6 * s;
    if (b.roof !== "spire") {
      ctx.fillRect(ax - 0.7 * s, ay, 1.4 * s, 6 * s);
    }
    const g = ctx.createRadialGradient(ax, ay, 0, ax, ay, 7 * s);
    g.addColorStop(0, "rgba(255,70,60,0.95)");
    g.addColorStop(1, "rgba(255,70,60,0)");
    ctx.fillStyle = g;
    ctx.fillRect(ax - 7 * s, ay - 7 * s, 14 * s, 14 * s);
  }
}

function drawWindows(
  ctx: CanvasRenderingContext2D,
  rand: Rand,
  b: Building,
  groundY: number,
  s: number,
  c: RGB,
  litShare: number,
  alpha: number
): void {
  const ww = Math.max(1.5, 3 * s);
  const wh = Math.max(1.5, 4 * s);
  const gapX = Math.max(3, 6 * s);
  const gapY = Math.max(4, 8 * s);
  const cols = Math.floor((b.w - gapX) / (ww + gapX));
  if (cols < 1) return;
  const offX = b.x + (b.w - cols * (ww + gapX) + gapX) / 2;
  for (let y = b.top + gapY; y < groundY - wh - gapY * 0.5; y += wh + gapY) {
    // Sprat: neki potpuno mračni, neki skoro ceo upaljen
    const floorLit = rand() < 0.25 ? 0 : litShare * (0.4 + 1.2 * rand());
    if (floorLit <= 0) continue;
    for (let i = 0; i < cols; i++) {
      if (rand() > floorLit) continue;
      const a = alpha * (0.55 + 0.45 * rand());
      ctx.fillStyle = rgba(rand() < 0.15 ? mix(c, [255, 255, 255], 0.4) : c, a);
      ctx.fillRect(offX + i * (ww + gapX), y, ww, wh);
    }
  }
}
