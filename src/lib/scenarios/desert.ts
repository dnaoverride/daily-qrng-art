/**
 * Pustinja — render v2.
 *
 * Redosled: nebo → zvezde + Mlečni put (noć) → (hooks.sky) → sunce/mesec →
 * (hooks.body) → toplotna izmaglica → mese u daljini (opciono) → 4–5 slojeva
 * asimetričnih dina (blaga osvetljena strana ka suncu, strma senovita strana
 * na suprotnoj) → jaranice od vetra → karavan na grebenu / oaza / kaktusi.
 *
 * QRNG bira odluke (paleta, horizont, sunce, šta se pojavljuje); geometrija
 * dina i detalji iz PRNG-a seedovanog QRNG-om. Dimenzije relativne (s = w/1200).
 */
import type { QRNGStream } from "../qrng";
import { hslToRgb, rgbString, type RGB } from "../color";
import { prngFromStream, type Rand } from "../prng";
import { NO_HOOKS, type SceneHooks, type SkyLight } from "../sky-events";

type HSL = [number, number, number];

interface DesertPalette {
  name: string;
  light: SkyLight;
  sky: [HSL, HSL, HSL]; // vrh → sredina → horizont
  sun: HSL;
  moon?: boolean;
  sandLit: HSL; // osvetljena strana najbliže dine
  sandShade: HSL; // senka
  stars?: boolean;
  mesas: number; // verovatnoća mesa
}

const PALETTES: readonly DesertPalette[] = [
  {
    name: "noon",
    light: "day",
    sky: [[205, 0.55, 0.55], [200, 0.45, 0.72], [40, 0.5, 0.86]],
    sun: [50, 1, 0.94],
    sandLit: [38, 0.65, 0.68],
    sandShade: [28, 0.45, 0.45],
    mesas: 0.3,
  },
  {
    name: "golden-dunes",
    light: "dusk",
    sky: [[210, 0.4, 0.55], [35, 0.6, 0.7], [38, 0.9, 0.72]],
    sun: [42, 1, 0.8],
    sandLit: [30, 0.8, 0.6],
    sandShade: [15, 0.5, 0.32],
    mesas: 0.3,
  },
  {
    name: "sahara-sunset",
    light: "dusk",
    sky: [[250, 0.4, 0.3], [345, 0.55, 0.5], [22, 0.95, 0.6]],
    sun: [28, 1, 0.68],
    sandLit: [20, 0.75, 0.52],
    sandShade: [285, 0.3, 0.25],
    mesas: 0.25,
  },
  {
    name: "dusk-violet",
    light: "dusk",
    sky: [[255, 0.35, 0.4], [300, 0.3, 0.6], [345, 0.55, 0.75]],
    sun: [30, 1, 0.82],
    sandLit: [350, 0.45, 0.66],
    sandShade: [265, 0.25, 0.38],
    mesas: 0.25,
  },
  {
    name: "night",
    light: "night",
    sky: [[235, 0.55, 0.06], [232, 0.45, 0.12], [228, 0.35, 0.2]],
    sun: [50, 0.25, 0.92],
    moon: true,
    sandLit: [225, 0.2, 0.36],
    sandShade: [235, 0.35, 0.13],
    stars: true,
    mesas: 0.25,
  },
  {
    name: "red-rock",
    light: "day",
    sky: [[210, 0.6, 0.5], [205, 0.45, 0.68], [30, 0.5, 0.8]],
    sun: [48, 1, 0.92],
    sandLit: [15, 0.65, 0.55],
    sandShade: [5, 0.5, 0.3],
    mesas: 1,
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

interface Dune {
  px: number; // x vrha
  hgt: number; // visina vrha iznad podnožja
  gentle: number; // širina blage (osvetljene) strane
  steep: number; // širina strme (senovite) strane
}

/** Podnožje sloja — blago talasasto (da između dina nema savršeno ravnih traka). */
type Base = (x: number) => number;

/** Visina grebena sloja na x (min preko dina; podnožje ako nema dine). */
function crestAt(dunes: Dune[], base: Base, x: number, lightDir: number): number {
  const baseY = base(x);
  let y = baseY;
  for (const d of dunes) {
    // lightDir = +1: svetlo sleva → blaga strana levo, strma desno
    const dx = (x - d.px) * lightDir;
    const half = dx < 0 ? d.gentle : d.steep;
    const t = Math.abs(dx) / half;
    if (t < 1) {
      // blaga strana: glatka kosinusna kriva; strma: skoro prava, zaobljeno dno
      const k = dx < 0 ? 0.5 - 0.5 * Math.cos(Math.PI * (1 - t)) : Math.pow(1 - t, 1.25);
      y = Math.min(y, baseY - d.hgt * k);
    }
  }
  return y;
}

export function renderDesert(
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
  const horizonY = Math.floor(h * (0.42 + 0.14 * stream.next_f()));
  const sunX = w * (0.12 + 0.76 * stream.next_f());
  const sunR = (pal.moon ? 16 + 12 * stream.next_f() : 24 + 24 * stream.next_f()) * s;
  const sunY =
    pal.light === "dusk" ? horizonY * (0.6 + 0.3 * stream.next_f()) : horizonY * (0.15 + 0.35 * stream.next_f());
  const layerCount = stream.next_int(4, 5);
  const hasMesas = stream.next_f() < pal.mesas;
  const propRoll = stream.next_f();
  const rand = prngFromStream(stream);

  const lightDir = sunX < w / 2 ? 1 : -1; // +1: svetlo sleva
  const sky = pal.sky.map((c) => hsl(c, dh));
  const skyHorizon = sky[2]!;
  const sunCol = hsl(pal.sun);
  const sunCore = mix(sunCol, [255, 252, 240], 0.6);
  const lit = hsl(pal.sandLit, dh);
  const shade = hsl(pal.sandShade, dh);

  // ---- 1. Nebo ----
  const g = ctx.createLinearGradient(0, 0, 0, horizonY);
  g.addColorStop(0, rgbString(sky[0]!));
  g.addColorStop(0.6, rgbString(sky[1]!));
  g.addColorStop(1, rgbString(skyHorizon));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // ---- 2. Zvezde + Mlečni put (noć) ----
  if (pal.stars) {
    drawMilkyWay(ctx, rand, w, horizonY, s);
    const n = 260 + Math.floor(rand() * 200);
    for (let i = 0; i < n; i++) {
      const y = Math.pow(rand(), 1.3) * horizonY * 0.95;
      const a = (0.25 + 0.7 * rand()) * (1 - (y / horizonY) * 0.6);
      ctx.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(rand() * w, y, (rand() < 0.92 ? 0.7 : 1.4) * Math.max(0.6, s), 0, Math.PI * 2);
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

  // ---- 4. Toplotna izmaglica na horizontu ----
  const hazeH = h * 0.08;
  const hz = ctx.createLinearGradient(0, horizonY - hazeH, 0, horizonY + hazeH * 0.3);
  hz.addColorStop(0, rgba(skyHorizon, 0));
  hz.addColorStop(1, rgba(mix(skyHorizon, sunCore, 0.3), pal.moon ? 0.25 : 0.6));
  ctx.fillStyle = hz;
  ctx.fillRect(0, horizonY - hazeH, w, hazeH * 1.3);

  // ---- 5. Mese u daljini ----
  if (hasMesas) {
    const mesaCol = mix(mix(shade, lit, 0.5), skyHorizon, 0.5);
    const n = 1 + Math.floor(rand() * 3);
    // Svaka mesa u svom delu širine — bez preklapanja (preklop je pravio „odsečene" ivice)
    for (let i = 0; i < n; i++) {
      const slot = w / n;
      const mw = Math.min(slot * 0.5, (70 + rand() * 150) * s);
      const mh = (60 + rand() * 90) * s;
      const cx = slot * i + slot / 2 + (rand() - 0.5) * (slot - mw * 2) * 0.5;
      drawMesa(ctx, rand, cx, horizonY + 2 * s, mw, mh, mesaCol, mix(mesaCol, shade, 0.45), lightDir, s);
    }
  }

  // ---- 6. Slojevi dina (dalji → bliži) ----
  const step = Math.max(2, 3 * s);
  let caravanLayer: { dunes: Dune[]; base: Base } | null = null;
  for (let li = 0; li < layerCount; li++) {
    const t = li / (layerCount - 1); // 0 dalji … 1 najbliži
    const baseY = horizonY + (h - horizonY) * (0.12 + 0.95 * t);
    const maxH = (h - horizonY) * (0.18 + 0.35 * t) + 10 * s;
    const haze = 0.6 * (1 - t);
    const layerLit = mix(lit, skyHorizon, haze);
    const layerShade = mix(shade, skyHorizon, haze * 0.9);

    const ua = (5 + rand() * 10) * s * (0.5 + t);
    const uf1 = (1 + rand() * 2) * Math.PI * 2;
    const uf2 = (3 + rand() * 4) * Math.PI * 2;
    const up1 = rand() * 6.28;
    const up2 = rand() * 6.28;
    const base: Base = (x) => baseY + ua * (Math.sin((x / w) * uf1 + up1) + 0.4 * Math.sin((x / w) * uf2 + up2));

    const dunes: Dune[] = [];
    const n = 3 + Math.floor(rand() * 3);
    for (let i = 0; i < n; i++) {
      const dhgt = maxH * (0.45 + 0.55 * rand());
      dunes.push({
        px: (i + 0.1 + rand() * 0.8) * (w / n) + (rand() - 0.5) * 60 * s,
        hgt: dhgt,
        gentle: dhgt * (2.6 + rand() * 1.8),
        steep: dhgt * (0.9 + rand() * 0.5),
      });
    }
    if (li === 1) caravanLayer = { dunes, base };

    // Telo sloja (osvetljeno), gradijent ka podnožju
    const crest: { x: number; y: number }[] = [];
    for (let x = -step; x <= w + step; x += step) crest.push({ x, y: crestAt(dunes, base, x, lightDir) });
    const bodyPath = () => {
      ctx.beginPath();
      ctx.moveTo(-step, h + 2);
      for (const p of crest) ctx.lineTo(p.x, p.y);
      ctx.lineTo(w + step, h + 2);
      ctx.closePath();
    };
    const minY = Math.min(...crest.map((p) => p.y));
    const bg = ctx.createLinearGradient(0, minY, 0, h);
    bg.addColorStop(0, rgbString(mix(layerLit, [255, 250, 235], pal.moon ? 0 : 0.12)));
    bg.addColorStop(1, rgbString(mix(layerLit, layerShade, 0.25)));
    bodyPath();
    ctx.fillStyle = bg;
    ctx.fill();

    // Senke: strma strana svake dine (klip na telo sloja)
    ctx.save();
    bodyPath();
    ctx.clip();
    for (const d of dunes) {
      const py = crestAt([d], base, d.px, lightDir);
      const footX = d.px + lightDir * d.steep;
      const innerX = d.px + lightDir * d.steep * 0.15;
      const sg = ctx.createLinearGradient(d.px, py, footX, base(footX));
      sg.addColorStop(0, rgba(layerShade, 0.95));
      sg.addColorStop(1, rgba(layerShade, 0.75));
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.moveTo(d.px, py);
      // duž strmog grebena
      for (let k = 1; k <= 12; k++) {
        const x = d.px + lightDir * d.steep * (k / 12);
        ctx.lineTo(x, crestAt([d], base, x, lightDir));
      }
      // nazad do podnožja ispod vrha i blagom krivom gore do vrha (senka ostaje na strmoj strani)
      const backX = d.px - lightDir * d.steep * 0.12;
      ctx.lineTo(backX, base(backX) + 2 * s);
      ctx.quadraticCurveTo(innerX + lightDir * d.steep * 0.1, base(d.px) - d.hgt * 0.45, d.px, py);
      ctx.closePath();
      ctx.fill();
    }
    // Jaranice od vetra na bližim slojevima (paralelno sa grebenom, na svetloj strani)
    if (t > 0.4) {
      ctx.strokeStyle = rgba(layerShade, 0.18 + 0.12 * t);
      ctx.lineWidth = Math.max(1, 1.2 * s);
      const lines = Math.floor(6 + 10 * t);
      for (let k = 0; k < lines; k++) {
        const off = (10 + rand() * (h - minY) * 0.8) * (0.4 + t);
        const x0 = rand() * w;
        const len = (60 + rand() * 200) * s;
        ctx.beginPath();
        for (let x = x0; x < x0 + len; x += 6 * s) {
          const y = crestAt(dunes, base, x, lightDir) + off + Math.sin(x * 0.05 / s) * 2 * s;
          if (x === x0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }
    ctx.restore();

    // Tanka svetla linija na grebenu (rim light)
    ctx.strokeStyle = rgba(mix(layerLit, [255, 255, 255], 0.5), pal.moon ? 0.2 : 0.35);
    ctx.lineWidth = Math.max(1, 1.3 * s);
    ctx.beginPath();
    let pen = false;
    for (const p of crest) {
      const onDune = p.y < base(p.x) - 3 * s;
      if (onDune && pen) ctx.lineTo(p.x, p.y);
      else if (onDune) ctx.moveTo(p.x, p.y);
      pen = onDune;
    }
    ctx.stroke();

    // Oaza na srednjem sloju
    if (li === Math.floor(layerCount / 2) && propRoll >= 0.55 && propRoll < 0.7) {
      drawOasis(ctx, rand, w, crest, s, skyHorizon, mix(shade, [0, 0, 0], 0.35));
    }
  }

  // ---- 7. Karavan na grebenu / kaktusi ----
  const silCol = mix(shade, [0, 0, 0], 0.55);
  if (propRoll < 0.25 && caravanLayer) {
    const { dunes, base } = caravanLayer;
    const startX = w * (0.15 + 0.5 * rand());
    const n = 3 + Math.floor(rand() * 4);
    const k = s * (0.45 + 0.25 * rand());
    for (let i = 0; i < n; i++) {
      const x = startX + i * 34 * k * lightDir * -1 + i * 6 * s;
      drawCamel(ctx, x, crestAt(dunes, base, x, lightDir), k, silCol, lightDir);
    }
  } else if (propRoll >= 0.25 && propRoll < 0.55) {
    const n = 1 + Math.floor(rand() * 3);
    for (let i = 0; i < n; i++) {
      const x = w * (0.08 + 0.84 * rand());
      const y = h - (h - horizonY) * (0.05 + 0.2 * rand());
      drawSaguaro(ctx, rand, x, y, s * (0.7 + 0.6 * rand()), silCol, lightDir);
    }
  }
}

/** Mesa (butte): ravan vrh, strma litica (caprock), konkavna siparna padina; senka klipovana na obris. */
function drawMesa(
  ctx: CanvasRenderingContext2D,
  rand: Rand,
  cx: number,
  baseY: number,
  mw: number,
  mh: number,
  col: RGB,
  shadeCol: RGB,
  lightDir: number,
  s: number
): void {
  const top = baseY - mh;
  const capH = mh * (0.25 + 0.15 * rand());
  const half = mw / 2;
  const flare = mh * (0.6 + 0.4 * rand());
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(cx - half - flare, baseY);
    ctx.quadraticCurveTo(cx - half - flare * 0.15, baseY - (mh - capH) * 0.35, cx - half - mh * 0.04, top + capH);
    ctx.lineTo(cx - half, top);
    // blago neravan vrh
    const steps = 6;
    for (let k = 1; k < steps; k++) ctx.lineTo(cx - half + (mw * k) / steps, top + (rand() - 0.5) * 2 * s);
    ctx.lineTo(cx + half, top);
    ctx.lineTo(cx + half + mh * 0.04, top + capH);
    ctx.quadraticCurveTo(cx + half + flare * 0.15, baseY - (mh - capH) * 0.35, cx + half + flare, baseY);
    ctx.closePath();
  };
  path();
  ctx.fillStyle = rgbString(col);
  ctx.fill();
  // Senovita strana: neprovidna, samo unutar obrisa
  ctx.save();
  path();
  ctx.clip();
  const side = lightDir > 0 ? 1 : -1; // svetlo sleva → senka desno
  const innerTop = cx + side * half * (0.35 + 0.25 * rand());
  const innerBase = cx + side * (half * 0.2);
  ctx.fillStyle = rgbString(shadeCol);
  ctx.beginPath();
  ctx.moveTo(innerTop, top - 4 * s);
  ctx.lineTo(cx + side * (half + flare + 10 * s), top - 4 * s);
  ctx.lineTo(cx + side * (half + flare + 10 * s), baseY + 2 * s);
  ctx.lineTo(innerBase, baseY + 2 * s);
  ctx.closePath();
  ctx.fill();
  // Tanka svetla ivica vrha (sunce greje caprock)
  ctx.fillStyle = rgba(mix(col, [255, 245, 225], 0.4), 0.5);
  ctx.fillRect(cx - half, top, mw, Math.max(1, 2 * s));
  ctx.restore();
}

function drawMilkyWay(ctx: CanvasRenderingContext2D, rand: Rand, w: number, horizonY: number, s: number): void {
  // Dijagonalna traka: meki sjaj + gusti sitni zvezdani prah
  const x0 = w * (0.1 + 0.3 * rand());
  const x1 = w * (0.6 + 0.3 * rand());
  const ang = Math.atan2(-horizonY * 0.9, x1 - x0);
  ctx.save();
  ctx.translate(x0, horizonY * 0.95);
  ctx.rotate(ang);
  const len = Math.hypot(x1 - x0, horizonY * 0.9) * 1.4;
  const bw = horizonY * 0.28;
  const g = ctx.createLinearGradient(0, -bw, 0, bw);
  g.addColorStop(0, "rgba(200,190,255,0)");
  g.addColorStop(0.5, "rgba(210,200,255,0.12)");
  g.addColorStop(1, "rgba(200,190,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(-len * 0.2, -bw, len, bw * 2);
  for (let i = 0; i < 700; i++) {
    const u = rand() * len - len * 0.2;
    const v = (rand() + rand() + rand() - 1.5) * bw * 0.6;
    ctx.fillStyle = `rgba(255,255,255,${(0.15 + 0.45 * rand()).toFixed(3)})`;
    ctx.fillRect(u, v, Math.max(0.6, 0.9 * s), Math.max(0.6, 0.9 * s));
  }
  // Tamne prašinaste pruge
  ctx.fillStyle = "rgba(10,10,30,0.07)";
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.ellipse(rand() * len * 0.9, (rand() - 0.5) * bw * 0.4, (40 + rand() * 90) * s, (3 + rand() * 6) * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawCamel(ctx: CanvasRenderingContext2D, x: number, y: number, k: number, col: RGB, lightDir: number): void {
  // Silueta kamile koja hoda (okrenuta ka suprotnoj strani od svetla)
  const d = -lightDir;
  ctx.fillStyle = rgbString(col);
  ctx.strokeStyle = rgbString(col);
  ctx.lineCap = "round";
  const by = y - 22 * k;
  ctx.beginPath();
  ctx.ellipse(x, by, 14 * k, 6 * k, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x - d * 1 * k, by - 6 * k, 6 * k, 5 * k, 0, 0, Math.PI * 2); // grba
  ctx.fill();
  ctx.lineWidth = 3 * k;
  ctx.beginPath();
  ctx.moveTo(x + d * 11 * k, by - 2 * k);
  ctx.quadraticCurveTo(x + d * 18 * k, by - 4 * k, x + d * 19 * k, by - 14 * k); // vrat
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(x + d * 22 * k, by - 15 * k, 4 * k, 2.4 * k, 0, 0, Math.PI * 2); // glava
  ctx.fill();
  ctx.lineWidth = 2 * k;
  for (const [lx, sw] of [[-9, -2], [-5, 2], [7, -2], [11, 2]] as const) {
    ctx.beginPath();
    ctx.moveTo(x + d * lx * k, by + 4 * k);
    ctx.lineTo(x + d * (lx + sw) * k, y);
    ctx.stroke();
  }
}

function drawSaguaro(ctx: CanvasRenderingContext2D, rand: Rand, x: number, y: number, k: number, col: RGB, lightDir: number): void {
  const H = (90 + rand() * 80) * k;
  const W = (12 + rand() * 6) * k;
  const lit = mix(col, [60, 110, 70], 0.35);
  const limb = (x0: number, y0: number, wdt: number, hgt: number) => {
    ctx.beginPath();
    ctx.moveTo(x0 - wdt / 2, y0);
    ctx.lineTo(x0 - wdt / 2, y0 - hgt + wdt / 2);
    ctx.arc(x0, y0 - hgt + wdt / 2, wdt / 2, Math.PI, 0);
    ctx.lineTo(x0 + wdt / 2, y0);
    ctx.closePath();
    ctx.fill();
  };
  ctx.fillStyle = rgbString(col);
  limb(x, y, W, H);
  const arms = 1 + Math.floor(rand() * 3);
  for (let i = 0; i < arms; i++) {
    const side = i % 2 === 0 ? (rand() < 0.5 ? -1 : 1) : -1;
    const ay = y - H * (0.35 + 0.3 * rand());
    const reach = W * (1.1 + rand() * 0.6);
    const aw = W * 0.7;
    const up = H * (0.2 + 0.25 * rand());
    // horizontalni deo (zaobljen) + vertikalni
    ctx.beginPath();
    ctx.moveTo(x, ay);
    ctx.lineTo(x + side * (reach - aw / 2), ay);
    ctx.quadraticCurveTo(x + side * (reach + aw / 2), ay, x + side * (reach + aw / 2), ay - aw);
    ctx.lineTo(x + side * (reach - aw / 2), ay - aw);
    ctx.lineTo(x + side * (reach - aw / 2), ay - aw * 0.4);
    ctx.lineTo(x, ay - aw * 0.4);
    ctx.closePath();
    ctx.fill();
    limb(x + side * reach, ay - aw * 0.6, aw, up);
  }
  // Osvetljena ivica stabla
  ctx.fillStyle = rgba(lit, 0.6);
  ctx.fillRect(x - lightDir * W * 0.35 - W * 0.12, y - H + W * 0.6, W * 0.24, H - W * 0.6);
  // Senka na pesku
  ctx.fillStyle = rgba(col, 0.25);
  ctx.beginPath();
  ctx.ellipse(x - lightDir * H * 0.35, y, H * 0.4, 3 * k, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawOasis(
  ctx: CanvasRenderingContext2D,
  rand: Rand,
  w: number,
  crest: { x: number; y: number }[],
  s: number,
  sky: RGB,
  col: RGB
): void {
  // Oaza u udolini (najniža tačka grebena u srednjem delu)
  let best = crest[Math.floor(crest.length / 2)]!;
  for (const p of crest) if (p.x > w * 0.2 && p.x < w * 0.8 && p.y > best.y) best = p;
  const cx = best.x;
  const cy = best.y + 6 * s;
  const pw = (70 + rand() * 60) * s;
  ctx.fillStyle = rgbString(mix(sky, [40, 90, 120], 0.45));
  ctx.beginPath();
  ctx.ellipse(cx, cy, pw, 6 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = rgba([255, 255, 255], 0.25);
  ctx.fillRect(cx - pw * 0.5, cy - 1 * s, pw * 0.6, Math.max(1, s));
  const palms = 2 + Math.floor(rand() * 3);
  for (let i = 0; i < palms; i++) {
    const px = cx + (rand() - 0.5) * pw * 1.8;
    const ph = (30 + rand() * 30) * s;
    const lean = (rand() - 0.5) * 14 * s;
    ctx.strokeStyle = rgbString(col);
    ctx.lineWidth = 2.4 * s;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(px, cy);
    ctx.quadraticCurveTo(px + lean * 0.3, cy - ph * 0.6, px + lean, cy - ph);
    ctx.stroke();
    ctx.lineWidth = 2 * s;
    for (let f = 0; f < 7; f++) {
      const a = -Math.PI / 2 + (f - 3) * 0.48;
      const len = (12 + rand() * 6) * s;
      ctx.beginPath();
      ctx.moveTo(px + lean, cy - ph);
      ctx.quadraticCurveTo(
        px + lean + Math.cos(a) * len * 0.7,
        cy - ph + Math.sin(a) * len * 0.7 - 3 * s,
        px + lean + Math.cos(a) * len,
        cy - ph + Math.sin(a) * len + len * 0.35
      );
      ctx.stroke();
    }
  }
}
