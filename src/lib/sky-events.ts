/**
 * Nebeski događaji za rarity sistem (render v2).
 *
 * Scenariji pozivaju hook-ove u pravom trenutku crtanja:
 *   hooks.sky({ horizonY, light, hasHorizon }) — odmah posle neba, PRE prednjeg plana
 *     → događaji na nebu (zvezde padalice, duga, kometa, polarna svetlost) ostaju
 *       iza drveća/zgrada/planina
 *   hooks.body({ x, y, r, kind }) — posle crtanja sunca/meseca
 *     → legendarni događaji vezani za telo (pomračenje, krvavi mesec) crtaju se u finish()
 *
 * Nijedna funkcija ovde ne troši QRNGStream — koristi se rarityRand(values),
 * pa scenario izgleda isto sa i bez događaja (osim samog događaja).
 */
import { rarityRand, rarityTier, type RarityEvent, type RarityResult, type RarityTier } from "./rarity";
import type { Rand } from "./prng";

export type SkyLight = "day" | "dusk" | "night" | "underwater";

export interface SkyInfo {
  horizonY: number;
  light: SkyLight;
  /** false za scene bez horizonta (kosmos) — nema polarne svetlosti */
  hasHorizon?: boolean;
}

export interface CelestialBody {
  x: number;
  y: number;
  r: number;
  kind: "sun" | "moon";
}

/** Dodatne informacije o sceni za prikaz (npr. ime grada). */
export interface SceneMeta {
  /** Ključ mesta za prevod (messages → scene.place.*), npr. "belgrade". */
  place?: string;
}

export interface SceneHooks {
  /** Studio: kontrole scene (samo kad korisnik nešto menja). */
  controls?: import("./scenarios/controls").SceneControls;
  /** Studio: seme za fork PRNG-a forsirano uključenih elemenata. */
  forkSeed?: number;
  /** Studio: beleži prirodne odluke (vidi scenarios/controls.ts). */
  report?: (key: string, natural: boolean | number) => void;
  sky(info: SkyInfo): void;
  body(b: CelestialBody): void;
  /** Opciono: scenario javlja meta podatke (ime mesta). Ne utiče na crtanje. */
  meta?(m: SceneMeta): void;
}

export const NO_HOOKS: SceneHooks = { sky: () => {}, body: () => {} };

export function createSceneHooks(
  ctx: CanvasRenderingContext2D,
  values: readonly number[],
  w: number,
  h: number,
  /** Izvoz u većoj rezoluciji (vidi RenderOptions.pixelRatio): ctx je već uvećan k puta. */
  pixelRatio = 1
): { hooks: SceneHooks; finish: () => RarityResult } {
  const tier: RarityTier = rarityTier(values);
  const rand = rarityRand(values);
  const pick = rand();
  const s = w / 1200;
  let info: SkyInfo | null = null;
  let body: CelestialBody | null = null;
  let event: RarityEvent | null = null;
  let bodyDrawn = false;

  /**
   * Pomračenje / krvavi mesec se crtaju ODMAH posle tela (iza planina, drveća,
   * životinja), klipovano na nebo iznad horizonta. Treba nam i telo i horizont:
   * većina scenarija zove sky pa body, oluja obrnuto — zato se poziva iz oba.
   */
  function tryDrawBody(): void {
    if (bodyDrawn || !info || !body || !event) return;
    const b = body as CelestialBody;
    const hy = (info as SkyInfo).horizonY;
    if (event === "eclipse" && b.kind === "sun") {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, w, hy);
      ctx.clip();
      drawEclipse(ctx, rand, b, s);
      ctx.restore();
      bodyDrawn = true;
    } else if (event === "blood-moon" && b.kind === "moon") {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, w, hy);
      ctx.clip();
      drawBloodMoon(ctx, b);
      ctx.restore();
      bodyDrawn = true;
    }
  }

  const hooks: SceneHooks = {
    sky(i) {
      if (info) return; // samo prvi poziv
      info = i;
      if (tier === "common") return;
      event = chooseEvent(tier, i, pick);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, w, i.horizonY);
      ctx.clip();
      switch (event) {
        case "meteors":
        case "meteoroids":
          drawMeteors(ctx, rand, w, i.horizonY, s);
          break;
        case "rainbow":
          drawRainbow(ctx, rand, w, i.horizonY, false);
          break;
        case "double-rainbow":
          drawRainbow(ctx, rand, w, i.horizonY, true);
          break;
        case "comet":
          drawComet(ctx, rand, w, i.horizonY, s);
          break;
        case "aurora":
          drawAurora(ctx, rand, w, i.horizonY, s);
          break;
        case "manta":
          drawManta(ctx, rand, w, i.horizonY, s);
          break;
        case "whale":
          drawWhale(ctx, rand, w, i.horizonY, s);
          break;
        case "kraken":
          drawKraken(ctx, rand, w, i.horizonY, s);
          break;
      }
      ctx.restore();
      tryDrawBody();
    },
    body(b) {
      if (!body) body = b;
      tryDrawBody();
    },
  };

  function finish(): RarityResult {
    if (tier === "common") return { tier, event: null };
    if (!info) {
      // Scenario bez hook-ova: samo glitch radi bez informacija o sceni
      if (tier !== "legendary") return { tier: "common", event: null };
      event = "glitch";
    }
    if (bodyDrawn) {
      // Sumrak usred dana — cela scena (i prednji plan) tamni; korona je već iza scene
      if (event === "eclipse") {
        ctx.fillStyle = "rgba(6,6,24,0.34)";
        ctx.fillRect(0, 0, w, h);
      }
    } else if (event === "eclipse" || event === "blood-moon" || event === "glitch") {
      event = "glitch";
      // Piksel prolaz radi u pravim pikselima platna (bez transformacije).
      const k = pixelRatio;
      if (k !== 1) {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
      }
      drawGlitch(ctx, rand, Math.round(w * k), Math.round(h * k), s * k);
      if (k !== 1) ctx.restore();
    }
    return { tier, event };
  }

  return { hooks, finish };
}

function chooseEvent(tier: RarityTier, i: SkyInfo, pick: number): RarityEvent {
  // Pod vodom: sopstveni događaji (crtaju se odmah, iza grebena)
  if (i.light === "underwater") {
    if (tier === "rare") return "manta";
    if (tier === "epic") return "whale";
    return pick < 0.3 ? "glitch" : "kraken";
  }
  const night = i.light === "night";
  const day = i.light === "day";
  // Zvezde padalice samo noću (u svetlom sumraku se ne vide); danju i u sumraku duga
  // Bez horizonta (kosmos) nema atmosfere: isti crtež, ali se zovu meteoroidi.
  if (tier === "rare") return night ? (i.hasHorizon === false ? "meteoroids" : "meteors") : "rainbow";
  if (tier === "epic") {
    if (day) return "double-rainbow";
    if (night && i.hasHorizon !== false && pick < 0.55) return "aurora";
    return "comet";
  }
  // legendary
  if (pick < 0.3) return "glitch";
  return night ? "blood-moon" : "eclipse";
}

// ---------------------------------------------------------------------------
// Crtanje događaja
// ---------------------------------------------------------------------------

function drawMeteors(ctx: CanvasRenderingContext2D, rand: Rand, w: number, horizonY: number, s: number): void {
  const n = 1 + Math.floor(rand() * 4);
  const dir = rand() < 0.5 ? -1 : 1;
  const angle = (0.35 + rand() * 0.35) * (Math.PI / 2); // 30–55° ka dole
  for (let k = 0; k < n; k++) {
    const hx = w * (0.1 + 0.8 * rand());
    const hy = horizonY * (0.08 + 0.45 * rand());
    const len = (90 + rand() * 170) * s;
    const tx = hx - dir * Math.cos(angle) * len;
    const ty = hy - Math.sin(angle) * len;
    const g = ctx.createLinearGradient(tx, ty, hx, hy);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.7, "rgba(220,235,255,0.45)");
    g.addColorStop(1, "rgba(255,255,255,0.95)");
    ctx.strokeStyle = g;
    ctx.lineWidth = (1.4 + rand() * 1.4) * s;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(hx, hy);
    ctx.stroke();
    const hg = ctx.createRadialGradient(hx, hy, 0, hx, hy, 7 * s);
    hg.addColorStop(0, "rgba(255,255,255,0.9)");
    hg.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = hg;
    ctx.fillRect(hx - 7 * s, hy - 7 * s, 14 * s, 14 * s);
  }
}

const RAINBOW = ["255,70,60", "255,150,50", "255,225,70", "90,215,100", "70,150,255", "105,85,225", "160,85,215"];

function drawRainbow(ctx: CanvasRenderingContext2D, rand: Rand, w: number, horizonY: number, double: boolean): void {
  const cx = w * (0.2 + 0.6 * rand());
  const R = w * (0.36 + 0.22 * rand());
  const cy = horizonY + R * (0.08 + 0.3 * rand());
  const bw = R * 0.02;
  // Nebo unutar luka je malo svetlije
  const inner = ctx.createRadialGradient(cx, cy, R * 0.4, cx, cy, R - RAINBOW.length * bw);
  inner.addColorStop(0, "rgba(255,255,255,0)");
  inner.addColorStop(1, "rgba(255,255,255,0.08)");
  ctx.fillStyle = inner;
  ctx.beginPath();
  ctx.arc(cx, cy, R - RAINBOW.length * bw, 0, Math.PI * 2);
  ctx.fill();
  drawBands(ctx, cx, cy, R, bw, RAINBOW, 0.24);
  if (double) {
    const R2 = R * 1.24;
    // Tamnija traka između (Aleksandrova traka)
    ctx.strokeStyle = "rgba(0,0,20,0.06)";
    ctx.lineWidth = R2 - R - bw * 2;
    ctx.beginPath();
    ctx.arc(cx, cy, (R + R2) / 2 - bw * 3, 0, Math.PI * 2);
    ctx.stroke();
    drawBands(ctx, cx, cy, R2 - RAINBOW.length * bw * 1.2, bw * 1.2, [...RAINBOW].reverse(), 0.12);
  }
}

function drawBands(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  R: number,
  bw: number,
  colors: string[],
  alpha: number
): void {
  ctx.lineWidth = bw * 1.15;
  colors.forEach((c, i) => {
    ctx.strokeStyle = `rgba(${c},${alpha})`;
    ctx.beginPath();
    ctx.arc(cx, cy, R - i * bw, 0, Math.PI * 2);
    ctx.stroke();
  });
}

function drawComet(ctx: CanvasRenderingContext2D, rand: Rand, w: number, horizonY: number, s: number): void {
  const hx = w * (0.2 + 0.6 * rand());
  const hy = horizonY * (0.2 + 0.4 * rand());
  const L = w * (0.18 + 0.14 * rand());
  // Rep ide nagore-ustranu
  const ang = -Math.PI / 2 + (rand() < 0.5 ? -1 : 1) * (0.5 + rand() * 0.7);
  const tail = (len: number, width: number, color: string, angOff: number) => {
    const a = ang + angOff;
    const ex = hx + Math.cos(a) * len;
    const ey = hy + Math.sin(a) * len;
    const nx = -Math.sin(a);
    const ny = Math.cos(a);
    const g = ctx.createLinearGradient(hx, hy, ex, ey);
    g.addColorStop(0, `rgba(${color},0.75)`);
    g.addColorStop(0.4, `rgba(${color},0.28)`);
    g.addColorStop(1, `rgba(${color},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(hx + nx * 3 * s, hy + ny * 3 * s);
    ctx.quadraticCurveTo(
      hx + Math.cos(a) * len * 0.5 + nx * width * 0.7,
      hy + Math.sin(a) * len * 0.5 + ny * width * 0.7,
      ex + nx * width,
      ey + ny * width
    );
    ctx.lineTo(ex - nx * width * 0.6, ey - ny * width * 0.6);
    ctx.quadraticCurveTo(
      hx + Math.cos(a) * len * 0.5 - nx * width * 0.3,
      hy + Math.sin(a) * len * 0.5 - ny * width * 0.3,
      hx - nx * 3 * s,
      hy - ny * 3 * s
    );
    ctx.closePath();
    ctx.fill();
  };
  tail(L, L * 0.13, "235,240,255", 0); // prašinasti rep
  tail(L * 1.15, L * 0.04, "150,200,255", 0.08); // jonski rep (plavi, uži)
  const hg = ctx.createRadialGradient(hx, hy, 0, hx, hy, 14 * s);
  hg.addColorStop(0, "rgba(255,255,255,1)");
  hg.addColorStop(0.25, "rgba(220,240,255,0.7)");
  hg.addColorStop(1, "rgba(200,230,255,0)");
  ctx.fillStyle = hg;
  ctx.fillRect(hx - 14 * s, hy - 14 * s, 28 * s, 28 * s);
}

function drawAurora(ctx: CanvasRenderingContext2D, rand: Rand, w: number, horizonY: number, s: number): void {
  const ribbons = 2 + Math.floor(rand() * 2);
  const step = Math.max(2, 3 * s);
  for (let r = 0; r < ribbons; r++) {
    const baseY = horizonY * (0.45 + 0.3 * rand());
    const height = horizonY * (0.25 + 0.25 * rand());
    const f1 = 1.5 + rand() * 3;
    const f2 = 4 + rand() * 6;
    const p1 = rand() * Math.PI * 2;
    const p2 = rand() * Math.PI * 2;
    const amp = horizonY * (0.04 + 0.06 * rand());
    const hueShift = rand() < 0.35; // ponekad ljubičasto-plava varijanta
    for (let x = 0; x < w; x += step) {
      const u = x / w;
      const y = baseY + Math.sin(u * Math.PI * f1 + p1) * amp + Math.sin(u * Math.PI * f2 + p2) * amp * 0.3;
      const intensity = 0.5 + 0.5 * Math.sin(u * Math.PI * f2 * 1.7 + p1 + r);
      const a = (0.06 + 0.16 * intensity) * (0.7 + 0.3 * rand());
      const ht = height * (0.6 + 0.4 * intensity);
      const g = ctx.createLinearGradient(0, y, 0, y - ht);
      const low = hueShift ? "120,160,255" : "90,255,170";
      const high = hueShift ? "210,110,255" : "190,90,255";
      g.addColorStop(0, `rgba(${low},0)`);
      g.addColorStop(0.08, `rgba(${low},${a})`);
      g.addColorStop(0.55, `rgba(${low},${a * 0.45})`);
      g.addColorStop(0.85, `rgba(${high},${a * 0.25})`);
      g.addColorStop(1, `rgba(${high},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(x, y - ht, step + 0.5, ht + 2 * s);
    }
  }
}

function drawEclipse(ctx: CanvasRenderingContext2D, rand: Rand, b: CelestialBody, s: number): void {
  // Zatamnjenje cele scene radi finish(); ovde samo korona i mesec (iza prednjeg plana)
  const r = Math.max(b.r, 18 * s);
  // Kod ogromnog sunca (savana) korona ne raste srazmerno — inače prekrije pola slike
  const cr = Math.min(r, 55 * s);
  const outer = r + cr * 3.5;
  const cg = ctx.createRadialGradient(b.x, b.y, r * 0.95, b.x, b.y, outer);
  cg.addColorStop(0, "rgba(255,252,240,0.95)");
  cg.addColorStop(0.15, "rgba(240,240,255,0.45)");
  cg.addColorStop(1, "rgba(220,225,255,0)");
  ctx.fillStyle = cg;
  ctx.beginPath();
  ctx.arc(b.x, b.y, outer, 0, Math.PI * 2);
  ctx.fill();
  // Streameri korone
  const rays = 14 + Math.floor(rand() * 10);
  for (let i = 0; i < rays; i++) {
    const a = rand() * Math.PI * 2;
    const len = cr * (1.4 + rand() * 2.2);
    const wdt = cr * (0.06 + rand() * 0.1);
    const ex = b.x + Math.cos(a) * (r + len);
    const ey = b.y + Math.sin(a) * (r + len);
    const g = ctx.createLinearGradient(b.x, b.y, ex, ey);
    g.addColorStop(0, "rgba(255,255,255,0.55)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    const ha = 0.25 * (cr / r);
    ctx.moveTo(b.x + Math.cos(a + ha) * r, b.y + Math.sin(a + ha) * r);
    ctx.lineTo(ex + Math.cos(a + Math.PI / 2) * wdt, ey + Math.sin(a + Math.PI / 2) * wdt);
    ctx.lineTo(b.x + Math.cos(a - ha) * r, b.y + Math.sin(a - ha) * r);
    ctx.closePath();
    ctx.fill();
  }
  // Mesec ispred sunca
  ctx.fillStyle = "rgb(8,8,16)";
  ctx.beginPath();
  ctx.arc(b.x, b.y, r * 1.01, 0, Math.PI * 2);
  ctx.fill();
  // „Dijamantski prsten"
  const da = rand() * Math.PI * 2;
  const dx = b.x + Math.cos(da) * r;
  const dy = b.y + Math.sin(da) * r;
  const dr = Math.min(r * 0.9, 50 * s);
  const dg = ctx.createRadialGradient(dx, dy, 0, dx, dy, dr);
  dg.addColorStop(0, "rgba(255,255,255,1)");
  dg.addColorStop(0.15, "rgba(255,250,230,0.6)");
  dg.addColorStop(1, "rgba(255,250,230,0)");
  ctx.fillStyle = dg;
  ctx.fillRect(dx - dr, dy - dr, dr * 2, dr * 2);
}

function drawBloodMoon(ctx: CanvasRenderingContext2D, b: CelestialBody): void {
  const r = b.r;
  const glow = ctx.createRadialGradient(b.x, b.y, r, b.x, b.y, r * 4);
  glow.addColorStop(0, "rgba(200,50,30,0.35)");
  glow.addColorStop(1, "rgba(200,50,30,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(b.x - r * 4, b.y - r * 4, r * 8, r * 8);
  const g = ctx.createRadialGradient(b.x - r * 0.35, b.y - r * 0.35, 0, b.x, b.y, r * 1.02);
  g.addColorStop(0, "rgba(215,95,45,0.95)");
  g.addColorStop(0.7, "rgba(150,35,20,0.97)");
  g.addColorStop(1, "rgba(90,18,12,1)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(b.x, b.y, r * 1.02, 0, Math.PI * 2);
  ctx.fill();
}

// ---------------------------------------------------------------------------
// Podvodni događaji (sky() poziv sa light: "underwater"; horizonY = dno vode)
// ---------------------------------------------------------------------------

/** Raža: velika silueta u srednjoj vodi, krila u blagom zamahu, dug rep. */
function drawManta(ctx: CanvasRenderingContext2D, rand: Rand, w: number, depthY: number, s: number): void {
  const x = w * (0.2 + 0.6 * rand());
  const y = depthY * (0.2 + 0.3 * rand());
  const k = s * (1.2 + 0.8 * rand());
  const dir = rand() < 0.5 ? -1 : 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir, 1);
  ctx.rotate(-0.12);
  ctx.fillStyle = "rgba(15,25,45,0.55)";
  ctx.beginPath();
  ctx.moveTo(40 * k, 0);
  ctx.quadraticCurveTo(10 * k, -12 * k, -15 * k, -55 * k);
  ctx.quadraticCurveTo(-22 * k, -10 * k, -35 * k, 0);
  ctx.quadraticCurveTo(-22 * k, 10 * k, -15 * k, 55 * k);
  ctx.quadraticCurveTo(10 * k, 12 * k, 40 * k, 0);
  ctx.fill();
  ctx.strokeStyle = "rgba(15,25,45,0.5)";
  ctx.lineWidth = 2 * k;
  ctx.beginPath();
  ctx.moveTo(-34 * k, 0);
  ctx.quadraticCurveTo(-60 * k, 4 * k, -85 * k, -2 * k);
  ctx.stroke();
  // Rogovi (cefalična peraja)
  ctx.lineWidth = 3 * k;
  ctx.beginPath();
  ctx.moveTo(38 * k, -4 * k);
  ctx.lineTo(46 * k, -7 * k);
  ctx.moveTo(38 * k, 4 * k);
  ctx.lineTo(46 * k, 7 * k);
  ctx.stroke();
  ctx.restore();
}

/** Kit (grbavac): velika tamna silueta sa dugim prsnim perajima, u daljini. */
function drawWhale(ctx: CanvasRenderingContext2D, rand: Rand, w: number, depthY: number, s: number): void {
  const x = w * (0.25 + 0.5 * rand());
  const y = depthY * (0.25 + 0.25 * rand());
  const k = s * (2.2 + 0.8 * rand());
  const dir = rand() < 0.5 ? -1 : 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir, 1);
  ctx.rotate(-0.08);
  ctx.fillStyle = "rgba(10,20,40,0.45)";
  ctx.beginPath();
  ctx.moveTo(70 * k, 0);
  ctx.quadraticCurveTo(60 * k, -18 * k, 10 * k, -20 * k);
  ctx.quadraticCurveTo(-40 * k, -18 * k, -70 * k, -4 * k);
  ctx.lineTo(-90 * k, -16 * k);
  ctx.lineTo(-86 * k, 0);
  ctx.lineTo(-92 * k, 14 * k);
  ctx.lineTo(-70 * k, 4 * k);
  ctx.quadraticCurveTo(-30 * k, 16 * k, 20 * k, 16 * k);
  ctx.quadraticCurveTo(60 * k, 14 * k, 70 * k, 0);
  ctx.fill();
  // Dugo prsno peraje
  ctx.beginPath();
  ctx.moveTo(30 * k, 10 * k);
  ctx.quadraticCurveTo(10 * k, 40 * k, -15 * k, 48 * k);
  ctx.quadraticCurveTo(5 * k, 30 * k, 18 * k, 10 * k);
  ctx.fill();
  // Svetliji stomak (žlebovi)
  ctx.strokeStyle = "rgba(180,200,220,0.12)";
  ctx.lineWidth = 1.2 * k;
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.moveTo(60 * k - i * 4 * k, 6 * k + i * 1.4 * k);
    ctx.lineTo(10 * k - i * 3 * k, 13 * k + i * 0.6 * k);
    ctx.stroke();
  }
  ctx.restore();
}

/** Kraken: debeli pipci koji izranjaju iz dubine sa strana, senčeni, sa pijavkama. */
function drawKraken(ctx: CanvasRenderingContext2D, rand: Rand, w: number, depthY: number, s: number): void {
  const n = 4 + Math.floor(rand() * 3);
  for (let i = 0; i < n; i++) {
    const fromLeft = i % 2 === 0;
    const bx = fromLeft ? w * (0.0 + 0.28 * rand()) : w * (0.72 + 0.28 * rand());
    const by = depthY + 60 * s;
    const len = depthY * (0.7 + 0.35 * rand());
    const wdt = (28 + rand() * 18) * s;
    const curl = (fromLeft ? 1 : -1) * (0.5 + 0.7 * rand());
    const pts: [number, number, number][] = [];
    const steps = 60;
    let px = bx;
    let py = by;
    for (let k = 0; k <= steps; k++) {
      const t = k / steps;
      const ang = -Math.PI / 2 + curl * (0.35 * Math.sin(t * Math.PI * 1.3) + 1.9 * t * t * t);
      pts.push([px, py, wdt * (1 - t * 0.93)]);
      px += Math.cos(ang) * (len / steps);
      py += Math.sin(ang) * (len / steps);
    }
    // Telo: tamnija senka pa svetlije telo pomereno (zaobljenost)
    for (const [cx, cy, r] of pts) {
      ctx.fillStyle = "rgba(70,15,40,0.95)";
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const [cx, cy, r] of pts) {
      ctx.fillStyle = "rgba(165,50,80,0.95)";
      ctx.beginPath();
      ctx.arc(cx - (fromLeft ? r * 0.25 : -r * 0.25), cy - r * 0.15, r * 0.72, 0, Math.PI * 2);
      ctx.fill();
    }
    // Pijavke na unutrašnjoj strani
    for (let k = 2; k < pts.length - 4; k += 3) {
      const [cx, cy, r] = pts[k]!;
      const sx = cx + (fromLeft ? r * 0.55 : -r * 0.55);
      ctx.fillStyle = "rgba(245,190,195,0.85)";
      ctx.beginPath();
      ctx.arc(sx, cy, Math.max(1.2, r * 0.26), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(120,30,55,0.9)";
      ctx.beginPath();
      ctx.arc(sx, cy, Math.max(0.6, r * 0.11), 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** Kvantni glitch: horizontalne trake pomerene levo/desno + razdvojen crveni kanal. */
function drawGlitch(ctx: CanvasRenderingContext2D, rand: Rand, w: number, h: number, s: number): void {
  const img = ctx.getImageData(0, 0, w, h);
  const src = new Uint8ClampedArray(img.data);
  const d = img.data;
  const bands = 4 + Math.floor(rand() * 6);
  for (let k = 0; k < bands; k++) {
    const y0 = Math.floor(rand() * h);
    const bh = Math.max(2, Math.floor((4 + rand() * 26) * s));
    const dx = Math.round((rand() < 0.5 ? -1 : 1) * (10 + rand() * 60) * s);
    const rdx = Math.round((3 + rand() * 6) * s);
    for (let y = y0; y < Math.min(h, y0 + bh); y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const sx = Math.min(w - 1, Math.max(0, x - dx));
        const sr = Math.min(w - 1, Math.max(0, x - dx - rdx));
        const j = (y * w + sx) * 4;
        d[i] = src[(y * w + sr) * 4]!;
        d[i + 1] = src[j + 1]!;
        d[i + 2] = src[j + 2]!;
      }
    }
  }
  // Par tankih svetlih „scanline" linija
  const lines = 2 + Math.floor(rand() * 3);
  // Debljina linije prati razmeru (1 px na ekranu; veći izvoz → deblja, ista slika)
  const lw = Math.max(1, Math.round(s));
  for (let k = 0; k < lines; k++) {
    const y0 = Math.floor(rand() * h);
    for (let y = y0; y < Math.min(h, y0 + lw); y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        d[i] = Math.min(255, d[i]! + 60);
        d[i + 1] = Math.min(255, d[i + 1]! + 60);
        d[i + 2] = Math.min(255, d[i + 2]! + 60);
      }
    }
  }
  ctx.putImageData(img, 0, 0);
}
