/**
 * Kosmos — render v2.
 *
 * Redosled: pozadina → maglina (meki oblaci duž vlakana + tamne prašinaste
 * pruge) → (hooks.sky) → zvezde (sjajnije sa difrakcionim zracima) →
 * spiralna galaksija (opciono) → zvezda-sunce → planete (tip površine,
 * osvetljena/noćna strana, atmosfera, prstenovi iza/ispred, meseci).
 *
 * Kompozicija: „sistem" (2–4 planete) ili „krupni plan" (ogromna planeta čiji
 * horizont je luk + manje telo). Kosmos ne prijavljuje hooks.body, pa je
 * legendarni događaj ovde kvantni glitch.
 *
 * QRNG bira odluke (paleta, kompozicija, tipovi planeta); detalji iz PRNG-a
 * seedovanog QRNG-om. Dimenzije relativne (s = w/1200).
 */
import type { QRNGStream } from "../qrng";
import { hslToRgb, rgbString, type RGB } from "../color";
import { prngFromStream, type Rand } from "../prng";
import { NO_HOOKS, type SceneHooks } from "../sky-events";

type HSL = [number, number, number];

interface SpacePalette {
  name: string;
  bg: [HSL, HSL];
  nebula: HSL[];
  star: HSL;
}

const PALETTES: readonly SpacePalette[] = [
  { name: "violet-magenta", bg: [[260, 0.5, 0.05], [280, 0.45, 0.02]], nebula: [[290, 0.7, 0.5], [320, 0.75, 0.55], [230, 0.6, 0.5]], star: [45, 0.9, 0.85] },
  { name: "teal-blue", bg: [[210, 0.55, 0.05], [225, 0.5, 0.02]], nebula: [[185, 0.7, 0.45], [210, 0.7, 0.5], [160, 0.5, 0.45]], star: [200, 0.6, 0.9] },
  { name: "emission-red", bg: [[350, 0.4, 0.05], [260, 0.4, 0.02]], nebula: [[355, 0.75, 0.5], [20, 0.85, 0.55], [300, 0.5, 0.45]], star: [35, 1, 0.8] },
  { name: "green-cyan", bg: [[200, 0.45, 0.04], [190, 0.5, 0.02]], nebula: [[150, 0.6, 0.45], [180, 0.7, 0.5], [90, 0.5, 0.45]], star: [60, 0.8, 0.88] },
  { name: "blue-gold", bg: [[225, 0.6, 0.05], [235, 0.55, 0.02]], nebula: [[220, 0.7, 0.5], [40, 0.85, 0.55], [260, 0.5, 0.45]], star: [42, 1, 0.82] },
  { name: "dark", bg: [[240, 0.25, 0.035], [250, 0.2, 0.015]], nebula: [[240, 0.25, 0.4], [210, 0.3, 0.45]], star: [40, 0.6, 0.9] },
];

type PlanetType = "gas" | "rocky" | "ocean" | "ice" | "lava";

interface Planet {
  x: number;
  y: number;
  r: number;
  type: PlanetType;
  hue: number;
  tilt: number;
  rings: boolean;
  moons: number;
}

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

const TYPES: PlanetType[] = ["gas", "gas", "rocky", "ocean", "ice", "lava"];
const TYPE_HUES: Record<PlanetType, [number, number]> = {
  gas: [15, 50],
  rocky: [15, 40],
  ocean: [195, 220],
  ice: [180, 205],
  lava: [5, 25],
};

export function renderCosmos(
  ctx: CanvasRenderingContext2D,
  stream: QRNGStream,
  w: number,
  h: number,
  hooks: SceneHooks = NO_HOOKS
): void {
  const s = w / 1200;

  // ---- Odluke (QRNG) ----
  const pal = PALETTES[stream.next_int(0, PALETTES.length - 1)]!;
  const dh = stream.next_int(-10, 10);
  const closeUp = stream.next_f() < 0.35;
  const hasGalaxy = stream.next_f() < 0.2;
  const starInFrame = stream.next_f() < 0.6;
  const starX = starInFrame ? w * (0.1 + 0.8 * stream.next_f()) : stream.next_f() < 0.5 ? -w * 0.15 : w * 1.15;
  const starY = h * (0.1 + 0.4 * stream.next_f());
  const planets: Planet[] = [];
  if (closeUp) {
    const r = w * (0.55 + 0.25 * stream.next_f());
    const type = TYPES[stream.next_int(0, TYPES.length - 1)]!;
    const [h0, h1] = TYPE_HUES[type];
    planets.push({
      x: w * (0.3 + 0.4 * stream.next_f()),
      y: h + r * (0.55 + 0.25 * stream.next_f()),
      r,
      type,
      hue: h0 + (h1 - h0) * stream.next_f(),
      tilt: (stream.next_f() - 0.5) * 0.5,
      rings: false,
      moons: 0,
    });
  }
  const others = closeUp ? stream.next_int(1, 2) : stream.next_int(2, 4);
  for (let i = 0; i < others; i++) {
    const type = TYPES[stream.next_int(0, TYPES.length - 1)]!;
    const [h0, h1] = TYPE_HUES[type];
    const r = (closeUp ? 18 + 40 * stream.next_f() : 35 + 110 * stream.next_f() * stream.next_f()) * s;
    planets.push({
      x: w * ((i + 0.15 + 0.7 * stream.next_f()) / others),
      y: closeUp ? h * (0.15 + 0.35 * stream.next_f()) : h * (0.2 + 0.6 * stream.next_f()),
      r,
      type,
      hue: h0 + (h1 - h0) * stream.next_f(),
      tilt: (stream.next_f() - 0.5) * 0.6,
      rings: (type === "gas" || type === "ice") && r > 45 * s && stream.next_f() < 0.55,
      moons: r > 40 * s ? stream.next_int(0, 2) : 0,
    });
  }
  // Planete ne smeju da preklope zvezdu u kadru (deterministički pomak, bez QRNG-a)
  if (starInFrame) {
    for (const p of planets) {
      const minD = p.r + 70 * s;
      const d = Math.hypot(p.x - starX, p.y - starY);
      if (d < minD) {
        const dir = p.x >= starX ? 1 : -1;
        p.x = starX + dir * minD;
        if (p.x < p.r * 0.5 || p.x > w - p.r * 0.5) p.x = starX - dir * minD;
      }
    }
  }
  const rand = prngFromStream(stream);
  const starCol = hsl(pal.star);

  // ---- 1. Pozadina ----
  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, rgbString(hsl(pal.bg[0], dh)));
  bg.addColorStop(1, rgbString(hsl(pal.bg[1], dh)));
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // ---- 2. Maglina ----
  drawNebula(ctx, rand, w, h, s, pal.nebula.map((c) => hsl(c, dh)));
  hooks.sky({ horizonY: h, light: "night", hasHorizon: false });

  // ---- 3. Zvezde ----
  const n = 500 + Math.floor(rand() * 400);
  for (let i = 0; i < n; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const b = 0.3 + 0.7 * Math.pow(rand(), 2);
    const tint = rand() < 0.2 ? [200, 220, 255] : rand() < 0.15 ? [255, 225, 190] : [255, 255, 255];
    ctx.fillStyle = `rgba(${tint[0]},${tint[1]},${tint[2]},${b.toFixed(3)})`;
    const r = (rand() < 0.93 ? 0.6 : 1.2) * Math.max(0.6, s);
    ctx.fillRect(x - r / 2, y - r / 2, r, r);
  }
  const bright = 6 + Math.floor(rand() * 10);
  for (let i = 0; i < bright; i++) drawSpikeStar(ctx, rand() * w, rand() * h, (3 + rand() * 6) * s, [255, 255, 255]);

  // ---- 4. Spiralna galaksija ----
  if (hasGalaxy) drawGalaxy(ctx, rand, w * (0.15 + 0.7 * rand()), h * (0.2 + 0.5 * rand()), (70 + rand() * 90) * s, rand() * Math.PI, pal.nebula.map((c) => hsl(c)));

  // ---- 5. Zvezda-sunce ----
  if (starInFrame) {
    const sr = (10 + rand() * 12) * s;
    const g = ctx.createRadialGradient(starX, starY, 0, starX, starY, sr * 14);
    g.addColorStop(0, rgba(mix(starCol, [255, 255, 255], 0.7), 0.95));
    g.addColorStop(0.08, rgba(starCol, 0.5));
    g.addColorStop(0.3, rgba(starCol, 0.12));
    g.addColorStop(1, rgba(starCol, 0));
    ctx.fillStyle = g;
    ctx.fillRect(starX - sr * 14, starY - sr * 14, sr * 28, sr * 28);
    drawSpikeStar(ctx, starX, starY, sr * 4, mix(starCol, [255, 255, 255], 0.5));
    ctx.fillStyle = "rgb(255,253,245)";
    ctx.beginPath();
    ctx.arc(starX, starY, sr, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Zvezda van kadra: blagi sjaj sa strane
    const ex = starX < 0 ? 0 : w;
    const g = ctx.createRadialGradient(ex, starY, 0, ex, starY, w * 0.6);
    g.addColorStop(0, rgba(starCol, 0.25));
    g.addColorStop(1, rgba(starCol, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  // ---- 6. Planete (manje/dalje prvo, krupni plan poslednji) ----
  const order = [...planets].sort((a, b) => a.r - b.r);
  for (const p of order) drawPlanet(ctx, rand, p, starX, starY, starCol, s);
}

// ---------------------------------------------------------------------------

function drawNebula(ctx: CanvasRenderingContext2D, rand: Rand, w: number, h: number, s: number, cols: RGB[]): void {
  const filaments = 2 + Math.floor(rand() * 3);
  for (let f = 0; f < filaments; f++) {
    const x0 = rand() * w;
    const y0 = rand() * h;
    const x1 = rand() * w;
    const y1 = rand() * h;
    const cx = rand() * w;
    const cy = rand() * h;
    const col = cols[f % cols.length]!;
    const blobs = 70 + Math.floor(rand() * 60);
    for (let i = 0; i < blobs; i++) {
      const t = rand();
      const bx = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cx + t * t * x1 + (rand() - 0.5) * 140 * s;
      const by = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * cy + t * t * y1 + (rand() - 0.5) * 140 * s;
      const r = (30 + rand() * 110) * s;
      const c = rand() < 0.25 ? cols[Math.floor(rand() * cols.length)]! : col;
      const g = ctx.createRadialGradient(bx, by, 0, bx, by, r);
      const a = 0.025 + 0.05 * rand();
      g.addColorStop(0, rgba(c, a));
      g.addColorStop(1, rgba(c, 0));
      ctx.fillStyle = g;
      ctx.fillRect(bx - r, by - r, r * 2, r * 2);
    }
    // Svetlija jezgra
    for (let i = 0; i < 8; i++) {
      const t = rand();
      const bx = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cx + t * t * x1;
      const by = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * cy + t * t * y1;
      const r = (15 + rand() * 40) * s;
      const g = ctx.createRadialGradient(bx, by, 0, bx, by, r);
      g.addColorStop(0, rgba(mix(col, [255, 255, 255], 0.4), 0.08));
      g.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = g;
      ctx.fillRect(bx - r, by - r, r * 2, r * 2);
    }
  }
  // Tamne prašinaste pruge
  for (let i = 0; i < 25; i++) {
    const bx = rand() * w;
    const by = rand() * h;
    const r = (20 + rand() * 70) * s;
    const g = ctx.createRadialGradient(bx, by, 0, bx, by, r);
    g.addColorStop(0, "rgba(0,0,8,0.18)");
    g.addColorStop(1, "rgba(0,0,8,0)");
    ctx.fillStyle = g;
    ctx.fillRect(bx - r, by - r, r * 2, r * 2);
  }
}

function drawSpikeStar(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, c: RGB): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, len * 0.6);
  g.addColorStop(0, rgba(c, 0.9));
  g.addColorStop(1, rgba(c, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - len * 0.6, y - len * 0.6, len * 1.2, len * 1.2);
  for (const [dx, dy] of [[1, 0], [0, 1]] as const) {
    const lg = ctx.createLinearGradient(x - dx * len, y - dy * len, x + dx * len, y + dy * len);
    lg.addColorStop(0, rgba(c, 0));
    lg.addColorStop(0.5, rgba(c, 0.8));
    lg.addColorStop(1, rgba(c, 0));
    ctx.fillStyle = lg;
    const t = Math.max(0.6, len * 0.06);
    if (dx) ctx.fillRect(x - len, y - t / 2, len * 2, t);
    else ctx.fillRect(x - t / 2, y - len, t, len * 2);
  }
}

function drawGalaxy(ctx: CanvasRenderingContext2D, rand: Rand, x: number, y: number, R: number, rot: number, cols: RGB[]): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(1, 0.45);
  const core = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.35);
  core.addColorStop(0, "rgba(255,245,225,0.75)");
  core.addColorStop(1, "rgba(255,235,200,0)");
  ctx.fillStyle = core;
  ctx.fillRect(-R, -R, R * 2, R * 2);
  for (let arm = 0; arm < 2; arm++) {
    for (let i = 0; i < 260; i++) {
      const t = rand();
      const a = arm * Math.PI + t * Math.PI * 2.4;
      const rr = R * (0.1 + t * 0.9);
      const px = Math.cos(a) * rr + (rand() - 0.5) * R * 0.12;
      const py = Math.sin(a) * rr + (rand() - 0.5) * R * 0.12;
      const c = rand() < 0.6 ? ([230, 235, 255] as RGB) : cols[Math.floor(rand() * cols.length)]!;
      ctx.fillStyle = rgba(c, 0.15 + 0.35 * rand() * (1 - t));
      ctx.fillRect(px, py, 1.4, 1.4);
    }
  }
  ctx.restore();
}

/** Planeta: površina po tipu (klipovano na disk), senka prema zvezdi, atmosfera, prstenovi, meseci. */
function drawPlanet(
  ctx: CanvasRenderingContext2D,
  rand: Rand,
  p: Planet,
  starX: number,
  starY: number,
  starCol: RGB,
  s: number
): void {
  const { x, y, r } = p;
  const dx = starX - x;
  const dy = starY - y;
  const dl = Math.hypot(dx, dy) || 1;
  const lx = dx / dl;
  const ly = dy / dl;
  const base = hslToRgb(p.hue, p.type === "rocky" ? 0.25 : 0.5, p.type === "ice" ? 0.78 : p.type === "lava" ? 0.18 : 0.5);

  const ring = p.rings
    ? { rx: r * (2.0 + 0.4 * rand()), ry: r * (0.28 + 0.2 * rand()), inner: 1.25 + 0.15 * rand(), col: hslToRgb(p.hue + 10, 0.3, 0.72), bands: 5 + Math.floor(rand() * 5), alphas: [] as number[] }
    : null;
  if (ring) for (let i = 0; i < ring.bands; i++) ring.alphas.push(rand() < 0.2 ? 0.05 : 0.35 + 0.5 * rand());

  const drawRing = (front: boolean) => {
    if (!ring) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(p.tilt);
    ctx.beginPath();
    if (front) ctx.rect(-ring.rx * 1.1, 0, ring.rx * 2.2, ring.ry * 1.2);
    else ctx.rect(-ring.rx * 1.1, -ring.ry * 1.2, ring.rx * 2.2, ring.ry * 1.2);
    ctx.clip();
    for (let i = 0; i < ring.bands; i++) {
      const t0 = ring.inner + ((1 - ring.inner / (ring.rx / r)) * 0 + (ring.rx / r - ring.inner) * i) / ring.bands;
      const rr = r * t0;
      const k = rr / ring.rx;
      ctx.strokeStyle = rgba(ring.col, ring.alphas[i]!);
      ctx.lineWidth = ((ring.rx - r * ring.inner) / ring.bands) * 0.9;
      ctx.beginPath();
      ctx.ellipse(0, 0, rr, ring.ry * k, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  };

  drawRing(false);

  // Atmosfera (sjaj oko diska, jači na osvetljenoj strani)
  if (p.type !== "rocky") {
    const ag = ctx.createRadialGradient(x, y, r * 0.95, x, y, r * 1.12);
    const ac = p.type === "lava" ? ([255, 120, 60] as RGB) : mix(base, [190, 220, 255], 0.5);
    ag.addColorStop(0, rgba(ac, 0.45));
    ag.addColorStop(1, rgba(ac, 0));
    ctx.fillStyle = ag;
    ctx.beginPath();
    ctx.arc(x, y, r * 1.12, 0, Math.PI * 2);
    ctx.fill();
  }

  // Površina
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = rgbString(base);
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(p.tilt);
  surface(ctx, rand, p, base, r, s);
  ctx.restore();

  // Zatamnjenje ka ivici diska (sferičnost)
  const limb = ctx.createRadialGradient(x, y, r * 0.55, x, y, r);
  limb.addColorStop(0, "rgba(2,2,10,0)");
  limb.addColorStop(1, "rgba(2,2,10,0.38)");
  ctx.fillStyle = limb;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  // Senka: noćna strana suprotno od zvezde
  const sg = ctx.createLinearGradient(x + lx * r * 0.2, y + ly * r * 0.2, x - lx * r, y - ly * r);
  sg.addColorStop(0, "rgba(2,2,10,0)");
  sg.addColorStop(0.45, "rgba(2,2,10,0.55)");
  sg.addColorStop(1, "rgba(2,2,10,0.93)");
  ctx.fillStyle = sg;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  // Odsjaj na osvetljenoj strani
  const hx = x + lx * r * 0.45;
  const hy = y + ly * r * 0.45;
  const hg = ctx.createRadialGradient(hx, hy, 0, hx, hy, r * 0.8);
  hg.addColorStop(0, rgba(mix(starCol, [255, 255, 255], 0.5), 0.22));
  hg.addColorStop(1, rgba(starCol, 0));
  ctx.fillStyle = hg;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();

  // Tanak osvetljeni obod (polumesec) na strani zvezde
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, Math.atan2(ly, lx) - 1.1, Math.atan2(ly, lx) + 1.1);
  ctx.strokeStyle = rgba(mix(base, [255, 255, 255], 0.6), 0.5);
  ctx.lineWidth = Math.max(1, r * 0.025);
  ctx.stroke();
  ctx.restore();

  drawRing(true);

  // Meseci
  for (let i = 0; i < p.moons; i++) {
    const a = rand() * Math.PI * 2;
    const d = r * (1.6 + rand() * 1.2);
    const mx = x + Math.cos(a) * d;
    const my = y + Math.sin(a) * d * 0.5;
    const mr = r * (0.08 + 0.1 * rand());
    const mc = hslToRgb(30, 0.08, 0.6 + 0.2 * rand());
    ctx.fillStyle = rgbString(mc);
    ctx.beginPath();
    ctx.arc(mx, my, mr, 0, Math.PI * 2);
    ctx.fill();
    const mdx = starX - mx;
    const mdy = starY - my;
    const md = Math.hypot(mdx, mdy) || 1;
    const mg = ctx.createLinearGradient(mx + (mdx / md) * mr * 0.2, my + (mdy / md) * mr * 0.2, mx - (mdx / md) * mr, my - (mdy / md) * mr);
    mg.addColorStop(0, "rgba(2,2,10,0)");
    mg.addColorStop(1, "rgba(2,2,10,0.9)");
    ctx.fillStyle = mg;
    ctx.beginPath();
    ctx.arc(mx, my, mr, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Detalji površine u lokalnim koordinatama (centar 0,0, rotirano za tilt). */
function surface(ctx: CanvasRenderingContext2D, rand: Rand, p: Planet, base: RGB, r: number, s: number): void {
  switch (p.type) {
    case "gas": {
      // Trake sa talasastim ivicama
      let y = -r;
      let k = 0;
      while (y < r) {
        // Velike planete (krupni plan) imaju uže trake
        const bh = r > 250 * s ? r * (0.02 + 0.05 * rand()) : r * (0.06 + 0.14 * rand());
        const c = k % 2 === 0 ? mix(base, [255, 245, 225], 0.15 + 0.2 * rand()) : mix(base, [60, 30, 20], 0.1 + 0.25 * rand());
        ctx.fillStyle = rgbString(c);
        ctx.beginPath();
        ctx.moveTo(-r, y);
        const amp = bh * 0.25;
        const f = 3 + rand() * 5;
        const ph = rand() * 6.28;
        for (let x = -r; x <= r; x += r / 30) ctx.lineTo(x, y + Math.sin((x / r) * f + ph) * amp);
        for (let x = r; x >= -r; x -= r / 30) ctx.lineTo(x, y + bh + Math.sin((x / r) * f + ph + 1) * amp);
        ctx.closePath();
        ctx.fill();
        y += bh;
        k++;
      }
      if (rand() < 0.5) {
        // Velika olujna pega
        const sx = (rand() - 0.5) * r;
        const sy = (rand() - 0.5) * r * 0.8;
        ctx.fillStyle = rgbString(mix(base, [180, 60, 40], 0.45));
        ctx.beginPath();
        ctx.ellipse(sx, sy, r * 0.16, r * 0.08, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = rgba(mix(base, [255, 240, 220], 0.4), 0.6);
        ctx.lineWidth = Math.max(1, r * 0.015);
        ctx.stroke();
      }
      break;
    }
    case "rocky": {
      for (let i = 0; i < 12; i++) {
        ctx.fillStyle = rgba(rand() < 0.5 ? mix(base, [0, 0, 0], 0.2) : mix(base, [255, 255, 255], 0.12), 0.5);
        ctx.beginPath();
        ctx.arc((rand() - 0.5) * 2 * r, (rand() - 0.5) * 2 * r, r * (0.15 + 0.3 * rand()), 0, Math.PI * 2);
        ctx.fill();
      }
      const craters = 14 + Math.floor(rand() * 14);
      for (let i = 0; i < craters; i++) {
        const cx = (rand() - 0.5) * 1.8 * r;
        const cy = (rand() - 0.5) * 1.8 * r;
        const cr = r * (0.03 + 0.1 * Math.pow(rand(), 2));
        ctx.fillStyle = rgbString(mix(base, [0, 0, 0], 0.25));
        ctx.beginPath();
        ctx.arc(cx, cy, cr, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = rgba(mix(base, [255, 255, 255], 0.3), 0.6);
        ctx.lineWidth = Math.max(0.8, cr * 0.2);
        ctx.beginPath();
        ctx.arc(cx, cy, cr, Math.PI * 0.9, Math.PI * 1.9);
        ctx.stroke();
      }
      break;
    }
    case "ocean": {
      const land: RGB = rand() < 0.5 ? [85, 140, 70] : [160, 130, 85];
      const conts = 4 + Math.floor(rand() * 5);
      for (let c = 0; c < conts; c++) {
        const cx = (rand() - 0.5) * 1.8 * r;
        const cy = (rand() - 0.5) * 1.6 * r;
        ctx.fillStyle = rgbString(mix(land, [0, 0, 0], 0.1 * rand()));
        ctx.beginPath();
        const blobs = 5 + Math.floor(rand() * 6);
        for (let b = 0; b < blobs; b++) {
          const bx = cx + (rand() - 0.5) * r * 0.5;
          const by = cy + (rand() - 0.5) * r * 0.35;
          const br = r * (0.06 + 0.12 * rand());
          ctx.moveTo(bx + br, by);
          ctx.arc(bx, by, br, 0, Math.PI * 2);
        }
        ctx.fill();
      }
      // Oblaci
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      for (let i = 0; i < 18; i++) {
        ctx.beginPath();
        ctx.ellipse((rand() - 0.5) * 2 * r, (rand() - 0.5) * 2 * r, r * (0.1 + 0.25 * rand()), r * (0.02 + 0.03 * rand()), (rand() - 0.5) * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
      // Polarne kape
      ctx.fillStyle = "rgba(245,250,255,0.85)";
      ctx.beginPath();
      ctx.ellipse(0, -r, r * 0.5, r * 0.14, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "ice": {
      for (let i = 0; i < 16; i++) {
        ctx.strokeStyle = rgba(rand() < 0.5 ? mix(base, [80, 140, 180], 0.4) : [255, 255, 255], 0.35);
        ctx.lineWidth = Math.max(1, r * (0.005 + 0.012 * rand()));
        ctx.beginPath();
        const y0 = (rand() - 0.5) * 2 * r;
        ctx.moveTo(-r, y0);
        ctx.bezierCurveTo(-r * 0.3, y0 + (rand() - 0.5) * r * 0.6, r * 0.3, y0 + (rand() - 0.5) * r * 0.6, r, y0 + (rand() - 0.5) * r * 0.4);
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.95, r * 0.6, r * 0.22, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "lava": {
      // Tamna kora + užarene pukotine
      for (let i = 0; i < 10; i++) {
        ctx.fillStyle = rgba(mix(base, [0, 0, 0], 0.4), 0.5);
        ctx.beginPath();
        ctx.arc((rand() - 0.5) * 2 * r, (rand() - 0.5) * 2 * r, r * (0.15 + 0.25 * rand()), 0, Math.PI * 2);
        ctx.fill();
      }
      // Pukotine: glatke, duže, prate pravac (sa po jednom granom)
      const cracks = 6 + Math.floor(rand() * 6);
      const crack = (sx: number, sy: number, ang: number, steps: number, width: number) => {
        const pts: [number, number][] = [[sx, sy]];
        let cx = sx;
        let cy = sy;
        let a = ang;
        for (let k = 0; k < steps; k++) {
          a += (rand() - 0.5) * 0.7;
          cx += Math.cos(a) * r * 0.1;
          cy += Math.sin(a) * r * 0.1;
          pts.push([cx, cy]);
        }
        for (const [lw, col] of [[width * 3.5, "rgba(255,90,30,0.3)"], [width, "rgba(255,200,90,0.95)"]] as const) {
          ctx.strokeStyle = col;
          ctx.lineWidth = Math.max(1, lw);
          ctx.lineJoin = "round";
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(pts[0]![0], pts[0]![1]);
          for (let j = 1; j < pts.length - 1; j++) {
            const mx = (pts[j]![0] + pts[j + 1]![0]) / 2;
            const my = (pts[j]![1] + pts[j + 1]![1]) / 2;
            ctx.quadraticCurveTo(pts[j]![0], pts[j]![1], mx, my);
          }
          ctx.stroke();
        }
        return pts;
      };
      for (let i = 0; i < cracks; i++) {
        const pts = crack((rand() - 0.5) * 1.6 * r, (rand() - 0.5) * 1.6 * r, rand() * Math.PI * 2, 6 + Math.floor(rand() * 6), r * 0.014);
        const bp = pts[Math.floor(pts.length / 2)]!;
        crack(bp[0], bp[1], rand() * Math.PI * 2, 3 + Math.floor(rand() * 3), r * 0.009);
      }
      break;
    }
  }
  void s;
}
