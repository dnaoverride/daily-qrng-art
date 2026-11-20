/**
 * Arktik / fjord — render v2.
 *
 * Tri lokacije (QRNG):
 *  - fjord (40%): strme litice sa obe strane u 3 sloja, snežne planine u dnu
 *    fjorda, mirna voda sa pravim odrazom (tehnika iz jezera), opciono crvene
 *    kućice na obali i kit koji izranja;
 *  - presek (30%): otvoreno more, velika santa sa podvodnim delom „presečenim"
 *    kroz vodu (vodena linija preko cele slike), zraci svetla pod vodom,
 *    opciono kit/foka u dubini;
 *  - ledena obala (30%): ledena ploča u prvom planu (pukotine, sastrugi), more
 *    sa santama i ledenim pločama; polarni medved ILI pingvini (nikad zajedno),
 *    opciono iglo ili kućica.
 *
 * Polarna svetlost je ovde česta (polarna noć, plavi čas), ali blaža od
 * legendarnog rarity događaja, da on ostane poseban.
 *
 * QRNG bira odluke; geometrija se računa unapred (PRNG seedovan QRNG-om),
 * pa su normalan prolaz i odraz identični. Sve dimenzije relativne (s = w/1200).
 */
import type { QRNGStream } from "../qrng";
import { hslToRgb, rgbString, type RGB } from "../color";
import { prngFromStream, type Rand } from "../prng";
import { NO_HOOKS, type SceneHooks, type SkyLight } from "../sky-events";

type HSL = [number, number, number];

interface ArcticPalette {
  name: string;
  light: SkyLight;
  sky: [HSL, HSL, HSL]; // vrh → sredina → horizont
  body: "sun" | "moon" | "none";
  bodyCol: HSL;
  /** Sunce nisko (ponoćno sunce / zora) */
  lowSun?: boolean;
  stars: number; // 0–1 gustina zvezda
  aurora: number; // verovatnoća sopstvene polarne svetlosti
  snowLit: HSL;
  snowShade: HSL;
  rock: HSL;
  water: HSL;
  under: [HSL, HSL]; // pod vodom: pri površini → dubina
  iceLit: HSL;
  iceShade: HSL;
  mist: number;
  snowfall: number; // verovatnoća snega u vazduhu
}

const PALETTES: readonly ArcticPalette[] = [
  {
    name: "polar-day",
    light: "day",
    sky: [[212, 0.7, 0.45], [205, 0.6, 0.65], [195, 0.45, 0.86]],
    body: "sun",
    bodyCol: [50, 1, 0.94],
    stars: 0,
    aurora: 0,
    snowLit: [205, 0.35, 0.96],
    snowShade: [212, 0.45, 0.7],
    rock: [215, 0.16, 0.24],
    water: [205, 0.6, 0.2],
    under: [[192, 0.6, 0.42], [215, 0.7, 0.1]],
    iceLit: [190, 0.45, 0.95],
    iceShade: [196, 0.6, 0.66],
    mist: 0.2,
    snowfall: 0.05,
  },
  {
    name: "midnight-sun",
    light: "dusk",
    sky: [[228, 0.4, 0.48], [330, 0.45, 0.74], [35, 0.85, 0.74]],
    body: "sun",
    bodyCol: [36, 1, 0.78],
    lowSun: true,
    stars: 0,
    aurora: 0,
    snowLit: [25, 0.65, 0.9],
    snowShade: [252, 0.3, 0.62],
    rock: [262, 0.2, 0.24],
    water: [232, 0.35, 0.22],
    under: [[205, 0.45, 0.34], [238, 0.55, 0.1]],
    iceLit: [22, 0.6, 0.92],
    iceShade: [240, 0.35, 0.68],
    mist: 0.45,
    snowfall: 0,
  },
  {
    name: "polar-night",
    light: "night",
    sky: [[232, 0.6, 0.05], [222, 0.5, 0.11], [200, 0.4, 0.2]],
    body: "moon",
    bodyCol: [50, 0.3, 0.92],
    stars: 1,
    aurora: 0.85,
    snowLit: [212, 0.25, 0.6],
    snowShade: [225, 0.35, 0.32],
    rock: [225, 0.3, 0.09],
    water: [225, 0.6, 0.06],
    under: [[200, 0.5, 0.17], [228, 0.6, 0.04]],
    iceLit: [195, 0.35, 0.68],
    iceShade: [215, 0.45, 0.38],
    mist: 0.15,
    snowfall: 0.25,
  },
  {
    name: "blue-hour",
    light: "dusk",
    sky: [[236, 0.5, 0.2], [228, 0.42, 0.4], [325, 0.4, 0.66]],
    body: "moon",
    bodyCol: [45, 0.4, 0.9],
    stars: 0.4,
    aurora: 0.45,
    snowLit: [230, 0.3, 0.74],
    snowShade: [240, 0.35, 0.45],
    rock: [240, 0.25, 0.14],
    water: [235, 0.5, 0.12],
    under: [[215, 0.5, 0.25], [240, 0.6, 0.07]],
    iceLit: [215, 0.4, 0.82],
    iceShade: [235, 0.4, 0.52],
    mist: 0.3,
    snowfall: 0.2,
  },
  {
    name: "overcast-pastel",
    light: "day",
    sky: [[228, 0.16, 0.68], [255, 0.16, 0.79], [28, 0.3, 0.86]],
    body: "none",
    bodyCol: [40, 0.6, 0.9],
    stars: 0,
    aurora: 0,
    snowLit: [230, 0.2, 0.92],
    snowShade: [240, 0.2, 0.7],
    rock: [235, 0.12, 0.3],
    water: [220, 0.25, 0.3],
    under: [[200, 0.3, 0.4], [225, 0.4, 0.14]],
    iceLit: [200, 0.3, 0.93],
    iceShade: [205, 0.35, 0.72],
    mist: 0.6,
    snowfall: 0.55,
  },
  {
    name: "ice-fog-dawn",
    light: "dusk",
    sky: [[205, 0.35, 0.6], [15, 0.5, 0.8], [40, 0.8, 0.83]],
    body: "sun",
    bodyCol: [40, 1, 0.86],
    lowSun: true,
    stars: 0,
    aurora: 0,
    snowLit: [30, 0.6, 0.93],
    snowShade: [215, 0.3, 0.7],
    rock: [220, 0.15, 0.32],
    water: [210, 0.35, 0.3],
    under: [[195, 0.45, 0.4], [220, 0.55, 0.12]],
    iceLit: [30, 0.5, 0.94],
    iceShade: [200, 0.4, 0.72],
    mist: 0.9,
    snowfall: 0,
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

type Pt = { x: number; y: number };
type Peak = { x: number; y: number; hw: number };

/** Snežni greben: „šatori" sa konkavnim padinama + šum jači pri vrhu (kao u jezeru). */
function ridge(rand: Rand, w: number, baseY: number, maxH: number, peaks: number, sharp: number, x0 = 0, x1 = w): { pts: Pt[]; tops: Peak[] } {
  const span = x1 - x0;
  const tops: Peak[] = [];
  const tents: { x: number; y: number; hw: number; exp: number }[] = [];
  for (let i = 0; i < peaks; i++) {
    const x = x0 + (i + 0.15 + rand() * 0.7) * (span / peaks);
    const y = baseY - maxH * (0.5 + 0.5 * rand());
    const hw = (baseY - y) * sharp * (0.8 + 0.5 * rand());
    tops.push({ x, y, hw });
    tents.push({ x, y, hw, exp: 0.9 + rand() * 0.5 });
    const subs = 1 + Math.floor(rand() * 2);
    for (let k = 0; k < subs; k++) {
      const side = rand() < 0.5 ? -1 : 1;
      const sh = (baseY - y) * (0.45 + 0.3 * rand());
      tents.push({ x: x + side * (baseY - y) * sharp * (0.35 + 0.4 * rand()), y: baseY - sh, hw: sh * sharp * (0.7 + 0.4 * rand()), exp: 0.9 + rand() * 0.4 });
    }
  }
  const octaves = [
    { n: 14, a: 0.08 },
    { n: 40, a: 0.04 },
    { n: 110, a: 0.018 },
  ].map((o) => ({ ...o, v: Array.from({ length: o.n + 2 }, () => rand() - 0.5) }));
  const sample = (v: number[], n: number, u: number) => {
    const f = u * n;
    const i = Math.floor(f);
    const t = f - i;
    const sm = t * t * (3 - 2 * t);
    return v[i]! + (v[i + 1]! - v[i]!) * sm;
  };
  const pts: Pt[] = [];
  const step = w / 300;
  for (let x = -step; x <= w + step; x += step) {
    let y = baseY;
    for (const t of tents) {
      const d = Math.abs(x - t.x) / t.hw;
      if (d < 1) y = Math.min(y, t.y + (baseY - t.y) * Math.pow(d, t.exp));
    }
    const u = Math.min(1, Math.max(0, x / w));
    const height = (baseY - y) / maxH;
    let n = 0;
    for (const o of octaves) n += sample(o.v, o.n, u) * o.a;
    pts.push({ x, y: Math.min(baseY, y + n * maxH * (0.2 + 0.9 * height)) });
  }
  return { pts, tops };
}

/** Litica fjorda: od ivice slike ka unutra, strmo pada ka vodi. */
interface Cliff {
  side: -1 | 1; // -1 levo, 1 desno
  pts: Pt[]; // gornja ivica od spoljne ivice ka unutrašnjoj
  inner: number; // x unutrašnjeg podnožja
  gullies: [number, number, number, number][]; // snežni žlebovi
  strata: [number, number, number][];
}

function makeCliff(rand: Rand, w: number, horizonY: number, side: -1 | 1, innerU: number, height: number, s: number): Cliff {
  const outer = side < 0 ? -10 * s : w + 10 * s;
  const inner = side < 0 ? w * innerU : w * (1 - innerU);
  const n = 70;
  const noise = Array.from({ length: 16 }, () => rand() - 0.5);
  const fine = Array.from({ length: 50 }, () => rand() - 0.5);
  const smp = (v: number[], u: number) => {
    const f = u * (v.length - 2);
    const i = Math.floor(f);
    const t = f - i;
    return v[i]! + (v[i + 1]! - v[i]!) * t * t * (3 - 2 * t);
  };
  const shoulder = 0.55 + 0.25 * rand();
  const exp = 0.35 + 0.25 * rand();
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n; // 0 spolja → 1 unutra
    const x = outer + (inner - outer) * u;
    // Plato pa strm pad pri unutrašnjem kraju
    const prof = u < shoulder ? 1 - 0.18 * (u / shoulder) : 0.82 * Math.pow(Math.max(0, 1 - (u - shoulder) / (1 - shoulder)), exp);
    const y = horizonY - height * prof * (1 + smp(noise, u) * 0.18 + smp(fine, u) * 0.025 * (0.3 + prof));
    pts.push({ x, y: Math.min(horizonY, y) });
  }
  const gullies: [number, number, number, number][] = [];
  const ng = 3 + Math.floor(rand() * 4);
  for (let i = 0; i < ng; i++) {
    const p = pts[Math.floor(rand() * (n * 0.92))]!;
    const len = (horizonY - p.y) * (0.25 + 0.55 * rand());
    gullies.push([p.x, p.y + 3 * s, (rand() - 0.5) * 0.35 + side * 0.25, len]);
  }
  const strata: [number, number, number][] = [];
  const ns = 4 + Math.floor(rand() * 5);
  for (let i = 0; i < ns; i++) strata.push([rand(), 0.2 + 0.7 * rand(), (rand() - 0.5) * 0.3]);
  return { side, pts, inner, gullies, strata };
}

/** Santa: obris nadvodnog dela (od leve do desne tačke vodene linije). */
interface Berg {
  cx: number;
  wl: number; // vodena linija
  W: number;
  H: number;
  top: Pt[]; // tačke gornje ivice (relativno: x u [-W/2, W/2], y ≤ 0)
  peaks: number[]; // indeksi vrhova (za senčenje faseta)
  under: Pt[]; // podvodni obris (relativno, y ≥ 0)
}

function makeBerg(rand: Rand, cx: number, wl: number, W: number, H: number, tabular: boolean): Berg {
  const top: Pt[] = [];
  const peaks: number[] = [];
  if (tabular) {
    // Tabularna: skoro vertikalne strane, ravan vrh sa stepenicima
    const lip = 0.06 + 0.06 * rand();
    top.push({ x: -W / 2, y: 0 });
    top.push({ x: -W / 2 + W * lip * 0.4, y: -H * (0.85 + 0.1 * rand()) });
    const steps = 2 + Math.floor(rand() * 3);
    let level = -H * (0.92 + 0.08 * rand());
    for (let i = 0; i < steps; i++) {
      const x0 = -W / 2 + W * lip + (W * (1 - 2 * lip) * i) / steps;
      const x1 = -W / 2 + W * lip + (W * (1 - 2 * lip) * (i + 1)) / steps;
      top.push({ x: x0, y: level });
      peaks.push(top.length - 1);
      top.push({ x: x1 - W * 0.02, y: level + H * 0.02 * rand() });
      level = -H * (0.8 + 0.2 * rand());
    }
    top.push({ x: W / 2 - W * lip * 0.4, y: -H * (0.75 + 0.15 * rand()) });
    top.push({ x: W / 2, y: 0 });
  } else {
    // Šiljasta: 1–3 vrha; tačke se grade redom po x (bez sortiranja), sve unutar širine
    const np = 1 + Math.floor(rand() * 3);
    const main = Math.floor(rand() * np);
    const tips: Pt[] = [];
    for (let i = 0; i < np; i++) {
      const u = np === 1 ? 0.35 + 0.3 * rand() : 0.2 + (0.6 * (i + 0.2 + 0.6 * rand())) / np;
      tips.push({ x: -W / 2 + W * u, y: -H * (i === main ? 1 : 0.5 + 0.3 * rand()) });
    }
    top.push({ x: -W / 2, y: 0 });
    top.push({ x: -W / 2 + W * (0.04 + 0.06 * rand()), y: -H * (0.12 + 0.18 * rand()) });
    for (let i = 0; i < tips.length; i++) {
      const tp = tips[i]!;
      const prev = top[top.length - 1]!;
      // rame/faseta na usponu ka vrhu
      top.push({ x: prev.x + (tp.x - prev.x) * (0.45 + 0.2 * rand()), y: prev.y + (tp.y - prev.y) * (0.45 + 0.25 * rand()) });
      top.push(tp);
      peaks.push(top.length - 1);
      if (i + 1 < tips.length) {
        const nx = tips[i + 1]!;
        top.push({ x: tp.x + (nx.x - tp.x) * (0.4 + 0.2 * rand()), y: Math.max(tp.y, nx.y) * (0.45 + 0.25 * rand()) });
      }
    }
    const last = top[top.length - 1]!;
    const rx = W / 2 - W * (0.04 + 0.06 * rand());
    top.push({ x: last.x + (rx - last.x) * (0.45 + 0.2 * rand()), y: last.y * (0.4 + 0.25 * rand()) });
    top.push({ x: rx, y: -H * (0.1 + 0.15 * rand()) });
    top.push({ x: W / 2, y: 0 });
  }
  // Podvodni deo: širi i 3–4× dublji, zaobljen nepravilan obris
  const under: Pt[] = [];
  const UW = W * (1.25 + 0.4 * rand());
  const UD = H * (2.6 + 1.2 * rand());
  const nu = 26;
  const lump = Array.from({ length: 8 }, () => rand() - 0.5);
  const skew = (rand() - 0.5) * 0.5;
  for (let i = 0; i <= nu; i++) {
    const u = i / nu;
    const a = u * Math.PI; // 0 desno → π levo
    const f = u * 6;
    const j = Math.floor(f);
    const tt = f - j;
    const r = 1 + 0.35 * (lump[j]! + (lump[j + 1]! - lump[j]!) * tt * tt * (3 - 2 * tt)) + (rand() - 0.5) * 0.08;
    const sa = Math.sin(a);
    under.push({ x: (Math.cos(a) * (UW / 2) + skew * UW * sa * sa) * r, y: sa * UD * r * (0.55 + 0.45 * sa) });
  }
  under[0]!.y = 0;
  under[nu]!.y = 0;
  under[0]!.x = W / 2;
  under[nu]!.x = -W / 2;
  return { cx, wl, W, H, top, peaks, under };
}

export function renderArctic(
  ctx: CanvasRenderingContext2D,
  stream: QRNGStream,
  w: number,
  h: number,
  hooks: SceneHooks = NO_HOOKS
): void {
  const s = w / 1200;

  // ---- Odluke (QRNG) ----
  const pal = PALETTES[stream.next_int(0, PALETTES.length - 1)]!;
  const dh = stream.next_int(-6, 6);
  const locRoll = stream.next_f();
  const loc: "fjord" | "split" | "coast" = locRoll < 0.4 ? "fjord" : locRoll < 0.7 ? "split" : "coast";
  const horizonY = Math.floor(h * (loc === "split" ? 0.36 + 0.06 * stream.next_f() : loc === "coast" ? 0.42 + 0.08 * stream.next_f() : 0.5 + 0.08 * stream.next_f()));
  const sunX = w * (0.15 + 0.7 * stream.next_f());
  const sunY = horizonY * (pal.lowSun ? 0.72 + 0.18 * stream.next_f() : 0.18 + 0.3 * stream.next_f());
  const sunR = (pal.body === "moon" ? 14 + 10 * stream.next_f() : 20 + 18 * stream.next_f()) * s;
  const hasAurora = stream.next_f() < pal.aurora;
  const hasSnowfall = stream.next_f() < pal.snowfall;
  const faunaRoll = stream.next_f(); // medved / pingvini / kit / ništa
  const extraRoll = stream.next_f(); // kućice / iglo
  const tabularHero = stream.next_f() < 0.45;
  const rand = prngFromStream(stream);

  const sky = pal.sky.map((c) => hsl(c, dh));
  const skyTop = sky[0]!;
  const skyHorizon = sky[2]!;
  const bodyCol = hsl(pal.bodyCol);
  const bodyCore = mix(bodyCol, [255, 252, 240], 0.6);
  const snowLit = hsl(pal.snowLit, dh);
  const snowShade = hsl(pal.snowShade, dh);
  const rock = hsl(pal.rock, dh);
  const water = hsl(pal.water, dh);
  const iceLit = hsl(pal.iceLit, dh);
  const iceShade = hsl(pal.iceShade, dh);
  const underTop = hsl(pal.under[0], dh);
  const underDeep = hsl(pal.under[1], dh);
  const night = pal.light === "night";
  const lightDir = sunX > w / 2 ? 1 : -1; // sa koje strane dolazi svetlo

  // ---- Geometrija (jednom, za oba prolaza) ----
  const stars: [number, number, number, number][] = [];
  if (pal.stars > 0) {
    const n = Math.floor((140 + rand() * 160) * pal.stars);
    for (let i = 0; i < n; i++) stars.push([rand() * w, Math.pow(rand(), 1.3) * horizonY * 0.9, 0.25 + 0.7 * rand(), rand() < 0.9 ? 0.8 : 1.5]);
  }
  // Polarna svetlost: 1–3 zavese
  const aurora: { y: number; amp: number; f: number; ph: number; f2: number; ph2: number; len: number; hue: number; alpha: number; x0: number; x1: number }[] = [];
  if (hasAurora) {
    const n = 1 + Math.floor(rand() * 3);
    for (let i = 0; i < n; i++) {
      const x0 = w * (rand() * 0.4 - 0.1);
      aurora.push({
        y: horizonY * (0.35 + 0.35 * rand()),
        amp: horizonY * (0.06 + 0.1 * rand()),
        f: (1.5 + rand() * 3) / w,
        ph: rand() * 6.28,
        f2: (5 + rand() * 8) / w,
        ph2: rand() * 6.28,
        len: horizonY * (0.25 + 0.3 * rand()),
        hue: rand() < 0.75 ? 135 + rand() * 25 : 170 + rand() * 20,
        alpha: (night ? 0.42 : 0.28) * (0.7 + 0.5 * rand()),
        x0,
        x1: x0 + w * (0.6 + 0.6 * rand()),
      });
    }
  }
  // Stratusi (tanki pramenovi) — ne noću
  const streaks: [number, number, number, number][] = [];
  if (!night) {
    const n = pal.body === "none" ? 6 + Math.floor(rand() * 6) : Math.floor(rand() * 5);
    for (let i = 0; i < n; i++) streaks.push([rand() * w, horizonY * (0.12 + 0.6 * rand()), w * (0.15 + 0.3 * rand()), (2 + 5 * rand()) * s]);
  }

  // Planine (u dnu fjorda / na horizontu)
  const mtnH = loc === "fjord" ? 0.42 + 0.15 * rand() : loc === "coast" ? 0.25 + 0.2 * rand() : 0.12 + 0.12 * rand();
  const hasMtn = loc !== "split" || rand() < 0.65;
  const mtn = ridge(rand, w, horizonY, horizonY * mtnH, 3 + Math.floor(rand() * 4), 1.0 + rand() * 0.5);

  // Litice fjorda: 3 sloja po strani (daleko → blizu)
  const cliffs: Cliff[] = [];
  if (loc === "fjord") {
    const gap = 0.3 + 0.12 * rand(); // širina prolaza na dalekom sloju
    for (let k = 0; k < 3; k++) {
      for (const side of [-1, 1] as const) {
        const innerU = (0.5 - gap / 2) * (0.95 - k * 0.27) + (side < 0 ? 0 : 0.02 * rand());
        const ht = horizonY * (0.38 + k * 0.22 + 0.1 * rand());
        cliffs.push(makeCliff(rand, w, horizonY, side, Math.max(0.08, innerU), ht, s));
      }
    }
  }
  // Kućice na obali fjorda (u podnožju srednjeg sloja)
  const houses: { x: number; w: number; h: number; col: RGB }[] = [];
  if (loc === "fjord" && extraRoll < 0.4) {
    const c = cliffs[2 + Math.floor(rand() * 2)]!; // srednji sloj
    const baseX = c.inner - c.side * (8 + rand() * 30) * s;
    const n = 2 + Math.floor(rand() * 4);
    const cols: RGB[] = [[170, 40, 35], [200, 150, 60], [235, 230, 220], [150, 45, 40]];
    for (let i = 0; i < n; i++) {
      houses.push({ x: baseX - c.side * i * (10 + rand() * 6) * s, w: (7 + rand() * 4) * s, h: (5 + rand() * 3) * s, col: cols[Math.floor(rand() * cols.length)]! });
    }
  }
  // Daleke sante na horizontu
  const farBergs: Berg[] = [];
  if (loc !== "fjord") {
    const n = 2 + Math.floor(rand() * 4);
    for (let i = 0; i < n; i++) {
      const W = (20 + rand() * 50) * s;
      farBergs.push(makeBerg(rand, rand() * w, horizonY, W, W * (0.2 + 0.25 * rand()), rand() < 0.6));
    }
  }

  // ---- Gornja polovina (pass: normal ili odraz) ----
  const drawUpper = (mirror: boolean) => {
    const g = ctx.createLinearGradient(0, 0, 0, horizonY);
    g.addColorStop(0, rgbString(skyTop));
    g.addColorStop(0.55, rgbString(sky[1]!));
    g.addColorStop(1, rgbString(skyHorizon));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, horizonY + 2);
    for (const [x, y, a, r] of stars) {
      ctx.fillStyle = `rgba(255,255,255,${(a * (mirror ? 0.55 : 1)).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(x, y, r * Math.max(0.6, s), 0, Math.PI * 2);
      ctx.fill();
    }
    for (const a of aurora) drawAurora(ctx, a, s, mirror ? 0.7 : 1);
    if (!mirror) hooks.sky({ horizonY, light: pal.light });
    if (pal.body !== "none") {
      const moon = pal.body === "moon";
      const glowR = sunR * (moon ? 6 : 9);
      const glow = ctx.createRadialGradient(sunX, sunY, sunR * 0.6, sunX, sunY, glowR);
      glow.addColorStop(0, rgba(bodyCol, moon ? 0.25 : 0.5));
      glow.addColorStop(0.3, rgba(bodyCol, moon ? 0.07 : 0.18));
      glow.addColorStop(1, rgba(bodyCol, 0));
      ctx.fillStyle = glow;
      ctx.fillRect(sunX - glowR, sunY - glowR, glowR * 2, glowR * 2);
      const core = ctx.createRadialGradient(sunX - sunR * 0.25, sunY - sunR * 0.25, 0, sunX, sunY, sunR);
      core.addColorStop(0, rgbString(bodyCore));
      core.addColorStop(1, rgbString(bodyCol));
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
      ctx.fill();
      if (!mirror) hooks.body({ x: sunX, y: sunY, r: sunR, kind: moon ? "moon" : "sun" });
    } else {
      // Oblačno: samo blag sjaj iza oblaka
      const gx = sunX;
      const gy = horizonY * 0.4;
      const gr = horizonY * 0.6;
      const glow = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
      glow.addColorStop(0, rgba([255, 248, 235], 0.35));
      glow.addColorStop(1, rgba([255, 248, 235], 0));
      ctx.fillStyle = glow;
      ctx.fillRect(gx - gr, gy - gr, gr * 2, gr * 2);
    }
    // Pramenovi
    for (const [x, y, len, th] of streaks) {
      const sg = ctx.createLinearGradient(x - len / 2, 0, x + len / 2, 0);
      const c = mix(skyHorizon, [255, 255, 255], 0.45);
      sg.addColorStop(0, rgba(c, 0));
      sg.addColorStop(0.5, rgba(c, 0.45));
      sg.addColorStop(1, rgba(c, 0));
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.ellipse(x, y, len / 2, th, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // Planine sa senčenim fasetama
    if (hasMtn) {
      const far = mix(snowLit, skyHorizon, loc === "fjord" ? 0.35 : 0.45);
      const farShade = mix(snowShade, skyHorizon, loc === "fjord" ? 0.35 : 0.45);
      drawSnowRidge(ctx, mtn, w, horizonY, far, farShade, lightDir, rand);
      const hz = ctx.createLinearGradient(0, horizonY - horizonY * 0.3, 0, horizonY);
      hz.addColorStop(0, rgba(skyHorizon, 0));
      hz.addColorStop(1, rgba(skyHorizon, 0.35 + 0.4 * pal.mist));
      ctx.fillStyle = hz;
      ctx.fillRect(0, horizonY - horizonY * 0.3, w, horizonY * 0.3 + 2);
    }
    // Daleke sante
    for (const b of farBergs) drawBergTop(ctx, b, mix(iceLit, skyHorizon, 0.3), mix(iceShade, skyHorizon, 0.3), lightDir, s);
    // Litice: sloj po sloj, magla između
    if (cliffs.length) {
      for (let k = 0; k < 3; k++) {
        const fade = [0.55, 0.3, 0][k]!;
        const rk = mix(mix(rock, snowShade, 0.25 - k * 0.1), skyHorizon, fade);
        const sn = mix(snowLit, skyHorizon, fade * 0.8);
        for (const c of [cliffs[k * 2]!, cliffs[k * 2 + 1]!]) drawCliff(ctx, c, horizonY, rk, sn, lightDir, s, k);
        if (k === 1) for (const hs of houses) drawHouse(ctx, hs, horizonY, night, s);
        if (k < 2) {
          const mh = horizonY * 0.18;
          const mg = ctx.createLinearGradient(0, horizonY - mh, 0, horizonY);
          mg.addColorStop(0, rgba(skyHorizon, 0));
          mg.addColorStop(1, rgba(mix(skyHorizon, [255, 255, 255], 0.2), 0.25 + 0.4 * pal.mist));
          ctx.fillStyle = mg;
          ctx.fillRect(0, horizonY - mh, w, mh + 2);
        }
      }
    }
  };

  // 1) Normalan prolaz
  drawUpper(false);

  // 2) Odraz u vodi (preslikano preko horizonta)
  ctx.fillStyle = rgbString(skyTop);
  ctx.fillRect(0, horizonY, w, h - horizonY);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, horizonY, w, h - horizonY);
  ctx.clip();
  ctx.translate(0, 2 * horizonY);
  ctx.scale(1, -1);
  drawUpper(true);
  ctx.restore();

  // 3) Boja vode + talasići
  const wg = ctx.createLinearGradient(0, horizonY, 0, h);
  wg.addColorStop(0, rgba(water, 0.3));
  wg.addColorStop(0.5, rgba(water, 0.55));
  wg.addColorStop(1, rgba(water, 0.8));
  ctx.fillStyle = wg;
  ctx.fillRect(0, horizonY, w, h - horizonY);
  {
    const lightLine = mix(skyHorizon, [255, 255, 255], 0.35);
    let y = horizonY + 3 * s;
    let gap = 2.5 * s;
    while (y < h) {
      const t = (y - horizonY) / (h - horizonY);
      const segs = 2 + Math.floor(rand() * 4);
      for (let k = 0; k < segs; k++) {
        const len = (30 + rand() * 130) * s * (0.6 + t * 1.6);
        ctx.fillStyle = rand() < 0.55 ? rgba(lightLine, 0.05 + 0.1 * rand()) : rgba(water, 0.15 + 0.15 * rand());
        ctx.fillRect(rand() * w - len / 2, y, len, Math.max(1, (0.8 + t * 1.4) * s));
      }
      y += gap;
      gap *= 1.08;
    }
  }
  // Odsjaj sunca/meseca
  if (pal.body !== "none") {
    const mirrorY = 2 * horizonY - sunY;
    const n = 110 + Math.floor(rand() * 110);
    for (let i = 0; i < n; i++) {
      const t = rand();
      const gy = horizonY + 2 + t * Math.min(h - horizonY, (mirrorY - horizonY) * 1.6 + 40 * s);
      const off = (rand() + rand() - 1) * sunR * (0.8 + t * 2.2);
      const len = (6 + rand() * 22) * s;
      ctx.fillStyle = rgba(bodyCore, (pal.body === "moon" ? 0.35 : 0.55) * (1 - t * 0.6) * rand());
      ctx.fillRect(sunX + off - len / 2, gy, len, Math.max(1, 1.2 * s));
    }
  }

  // 4) Lokacija — prednji plan
  const animalCol = mix([236, 225, 192], skyHorizon, night ? 0.45 : 0.12);
  if (loc === "fjord") {
    // Ledene ploče na vodi
    const nf = 3 + Math.floor(rand() * 7);
    const floes: [number, number, number][] = [];
    for (let i = 0; i < nf; i++) {
      const t = Math.pow(rand(), 1.4);
      floes.push([rand() * w, horizonY + 4 * s + t * (h - horizonY) * 0.85, (12 + rand() * 40) * s * (0.3 + t * 1.8)]);
    }
    floes.sort((a, b) => a[1] - b[1]);
    for (const [x, y, r] of floes) drawFloe(ctx, rand, x, y, r, iceLit, iceShade, water, s);
    // Mala santa u fjordu (opciono)
    if (rand() < 0.5) {
      const t = 0.25 + 0.4 * rand();
      const W = (60 + rand() * 90) * s * (0.5 + t);
      const b = makeBerg(rand, w * (0.25 + 0.5 * rand()), horizonY + (h - horizonY) * t, W, W * (0.3 + 0.25 * rand()), rand() < 0.4);
      drawBergReflection(ctx, b, iceLit, water);
      drawBergUnderHint(ctx, b, iceShade);
      drawBergTop(ctx, b, iceLit, iceShade, lightDir, s);
    }
    if (faunaRoll < 0.2) drawWhaleTail(ctx, rand, w * (0.25 + 0.5 * rand()), horizonY + (h - horizonY) * (0.3 + 0.3 * rand()), s * (0.7 + 0.5 * rand()), mix(rock, [0, 0, 0], 0.4), water);
  } else if (loc === "split") {
    // Vodena linija preko cele slike; ispod nje presek kroz vodu
    const wl = horizonY + (h - horizonY) * (0.2 + 0.1 * rand());
    const W = w * (0.3 + 0.18 * rand());
    const H = (wl - horizonY) + horizonY * (0.35 + 0.3 * rand());
    const hero = makeBerg(rand, w * (0.35 + 0.3 * rand()), wl, W, H, tabularHero);
    // Pod vodom
    const ug = ctx.createLinearGradient(0, wl, 0, h);
    ug.addColorStop(0, rgbString(underTop));
    ug.addColorStop(1, rgbString(underDeep));
    ctx.fillStyle = ug;
    ctx.fillRect(0, wl, w, h - wl);
    // Zraci svetla
    const rays = 5 + Math.floor(rand() * 6);
    const rayCol = mix(underTop, [255, 255, 255], 0.5);
    for (let i = 0; i < rays; i++) {
      const x = rand() * w;
      const rw = (15 + rand() * 50) * s;
      const slant = (sunX - w / 2) * 0.15 + (rand() - 0.5) * 60 * s;
      const len = (h - wl) * (0.5 + 0.5 * rand());
      const rg = ctx.createLinearGradient(0, wl, 0, wl + len);
      rg.addColorStop(0, rgba(rayCol, night ? 0.05 : 0.14));
      rg.addColorStop(1, rgba(rayCol, 0));
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.moveTo(x - rw / 2, wl);
      ctx.lineTo(x + rw / 2, wl);
      ctx.lineTo(x + rw + slant, wl + len);
      ctx.lineTo(x - rw + slant, wl + len);
      ctx.closePath();
      ctx.fill();
    }
    // Kit ili foka u dubini (iza sante)
    if (faunaRoll < 0.3) {
      const k = (0.8 + 0.6 * rand()) * s;
      const wx = hero.cx + (rand() < 0.5 ? -1 : 1) * (W * 0.7 + 120 * k);
      drawWhaleUnder(ctx, wx, wl + (h - wl) * (0.55 + 0.25 * rand()), k * 1.6, wx > hero.cx ? -1 : 1, mix(underDeep, [0, 0, 0], 0.2), underTop);
    }
    // Podvodni deo sante
    drawBergUnder(ctx, hero, iceLit, iceShade, underTop, underDeep, lightDir, h);
    // Mehurići
    const nb = 10 + Math.floor(rand() * 20);
    for (let i = 0; i < nb; i++) {
      const bx = hero.cx + (rand() - 0.5) * W * 1.6;
      const by = wl + (h - wl) * rand();
      ctx.strokeStyle = rgba(mix(underTop, [255, 255, 255], 0.6), 0.3 + 0.3 * rand());
      ctx.lineWidth = Math.max(1, s);
      ctx.beginPath();
      ctx.arc(bx, by, (1 + rand() * 3) * s, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Vodena linija: svetla traka + tamni rub ispod
    const lg = ctx.createLinearGradient(0, wl - 3 * s, 0, wl + 8 * s);
    lg.addColorStop(0, rgba(mix(skyHorizon, [255, 255, 255], 0.5), 0.9));
    lg.addColorStop(0.3, rgba(mix(underTop, [255, 255, 255], 0.4), 0.6));
    lg.addColorStop(1, rgba(underTop, 0));
    ctx.fillStyle = lg;
    ctx.fillRect(0, wl - 3 * s, w, 11 * s);
    // Nadvodni deo + medved na santi (retko)
    drawBergTop(ctx, hero, iceLit, iceShade, lightDir, s);
    if (faunaRoll >= 0.3 && faunaRoll < 0.45) {
      const pi = hero.peaks[Math.floor(rand() * hero.peaks.length)] ?? 0;
      const p = hero.top[pi]!;
      if (tabularHero) drawPolarBear(ctx, hero.cx + p.x + 20 * s, hero.wl + p.y, s * 0.9, animalCol, iceShade, rand() < 0.5 ? 1 : -1);
    }
  } else {
    // Ledena obala: more sa santama, pa ledena ploča u prvom planu
    const shelfY = horizonY + (h - horizonY) * (0.35 + 0.2 * rand());
    const nb = 1 + Math.floor(rand() * 3);
    const bergs: Berg[] = [];
    for (let i = 0; i < nb; i++) {
      const t = 0.15 + 0.6 * rand();
      const wl = horizonY + (shelfY - horizonY) * t;
      const W = (50 + rand() * 120) * s * (0.5 + t);
      bergs.push(makeBerg(rand, rand() * w, wl, W, W * (0.3 + 0.3 * rand()), rand() < 0.5));
    }
    bergs.sort((a, b) => a.wl - b.wl);
    for (const b of bergs) {
      drawBergReflection(ctx, b, iceLit, water);
      drawBergUnderHint(ctx, b, iceShade);
      drawBergTop(ctx, b, iceLit, iceShade, lightDir, s);
    }
    const nf = 2 + Math.floor(rand() * 5);
    for (let i = 0; i < nf; i++) {
      const t = rand();
      drawFloe(ctx, rand, rand() * w, horizonY + (shelfY - horizonY) * (0.2 + 0.75 * t), (15 + rand() * 35) * s * (0.4 + t), iceLit, iceShade, water, s);
    }
    drawShelf(ctx, rand, w, h, shelfY, snowLit, snowShade, iceShade, lightDir, s);
    // Iglo ili kućica
    if (extraRoll < 0.3) {
      drawIgloo(ctx, w * (0.12 + 0.76 * rand()), shelfY + (h - shelfY) * (0.35 + 0.2 * rand()), s * (0.9 + 0.4 * rand()), snowLit, snowShade, night || pal.light === "dusk", lightDir);
    } else if (extraRoll < 0.5) {
      drawHut(ctx, w * (0.12 + 0.76 * rand()), shelfY + (h - shelfY) * (0.3 + 0.2 * rand()), s * (0.9 + 0.4 * rand()), snowLit, night || pal.light === "dusk");
    }
    // Medved ILI pingvini — nikad zajedno
    if (faunaRoll < 0.35) {
      const y = shelfY + (h - shelfY) * (0.45 + 0.35 * rand());
      const k = s * (1 + 0.8 * ((y - shelfY) / (h - shelfY)));
      drawPolarBear(ctx, w * (0.15 + 0.7 * rand()), y, k, animalCol, snowShade, rand() < 0.5 ? 1 : -1);
    } else if (faunaRoll < 0.7) {
      const n = 3 + Math.floor(rand() * 6);
      const gx = w * (0.15 + 0.7 * rand());
      const gy = shelfY + (h - shelfY) * (0.4 + 0.3 * rand());
      const list: [number, number, number][] = [];
      for (let i = 0; i < n; i++) {
        const y = gy + (rand() - 0.3) * 40 * s;
        list.push([gx + (rand() - 0.5) * 180 * s, y, s * (0.8 + 0.4 * rand()) * (1 + 0.6 * ((y - shelfY) / (h - shelfY)))]);
      }
      list.sort((a, b) => a[1] - b[1]);
      for (const [x, y, k] of list) drawPenguin(ctx, rand, x, y, k, snowShade);
    }
  }

  // 5) Magla pri horizontu (jača za maglovitu zoru)
  if (pal.mist > 0.1) {
    const mistCol = mix(skyHorizon, [255, 255, 255], 0.45);
    const bands = 1 + Math.floor(rand() * 3);
    for (let i = 0; i < bands; i++) {
      const my = horizonY + (rand() * 0.12 - 0.04) * h;
      const mh = (12 + rand() * 28) * s * (0.6 + pal.mist);
      const mg = ctx.createLinearGradient(0, my - mh, 0, my + mh);
      mg.addColorStop(0, rgba(mistCol, 0));
      mg.addColorStop(0.5, rgba(mistCol, 0.4 * pal.mist));
      mg.addColorStop(1, rgba(mistCol, 0));
      ctx.fillStyle = mg;
      ctx.fillRect(0, my - mh, w, mh * 2);
    }
  }

  // 6) Sneg u vazduhu
  if (hasSnowfall) {
    const n = 250 + Math.floor(rand() * 350);
    const sc = mix([255, 255, 255], skyHorizon, night ? 0.3 : 0.05);
    for (let i = 0; i < n; i++) {
      const z = rand();
      ctx.fillStyle = rgba(sc, 0.35 + 0.5 * z);
      ctx.beginPath();
      ctx.arc(rand() * w, rand() * h, (0.6 + z * 2.2) * s, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ---------------------------------------------------------------------------
// Crtanje

type AuroraBand = { y: number; amp: number; f: number; ph: number; f2: number; ph2: number; len: number; hue: number; alpha: number; x0: number; x1: number };

/** Zavesa polarne svetlosti: vertikalni stubovi duž talasaste krive. */
function drawAurora(ctx: CanvasRenderingContext2D, a: AuroraBand, s: number, k: number): void {
  const base = hslToRgb(a.hue, 0.85, 0.6);
  const topCol = hslToRgb(a.hue + 140, 0.6, 0.6); // ka ljubičastoj na vrhu
  const L0 = 100;
  const g = ctx.createLinearGradient(0, 0, 0, -L0);
  g.addColorStop(0, rgba(base, 0));
  g.addColorStop(0.06, rgba(base, 1));
  g.addColorStop(0.45, rgba(base, 0.45));
  g.addColorStop(1, rgba(topCol, 0));
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = g;
  const step = 3 * s;
  for (let x = Math.max(0, a.x0); x < a.x1; x += step) {
    const u = (x - a.x0) / (a.x1 - a.x0);
    const env = Math.sin(u * Math.PI);
    const y = a.y + Math.sin(x * a.f * 6.28 + a.ph) * a.amp + Math.sin(x * a.f2 * 6.28 + a.ph2) * a.amp * 0.3;
    const flick = 0.55 + 0.45 * Math.sin(x * a.f2 * 17 + a.ph2 * 3) * Math.sin(x * a.f * 23 + a.ph);
    const len = a.len * (0.6 + 0.4 * flick) * (0.5 + 0.5 * env);
    ctx.globalAlpha = Math.max(0, a.alpha * env * (0.5 + 0.5 * flick) * k);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, len / L0);
    ctx.fillRect(0, -L0, step + 0.5, L0);
    ctx.restore();
  }
  ctx.restore();
}

/** Snežni greben: osvetljena osnova + senovite fasete na strani dalje od svetla. */
function drawSnowRidge(ctx: CanvasRenderingContext2D, r: { pts: Pt[]; tops: Peak[] }, w: number, baseY: number, lit: RGB, shade: RGB, lightDir: number, rand: Rand): void {
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(-5, baseY + 2);
    for (const p of r.pts) ctx.lineTo(p.x, p.y);
    ctx.lineTo(w + 5, baseY + 2);
    ctx.closePath();
  };
  path();
  ctx.fillStyle = rgbString(lit);
  ctx.fill();
  ctx.save();
  path();
  ctx.clip();
  for (const t of r.tops) {
    const side = -lightDir; // senka na strani suprotnoj od svetla
    const hgt = baseY - t.y;
    ctx.fillStyle = rgba(shade, 0.85);
    ctx.beginPath();
    ctx.moveTo(t.x, t.y - 2);
    // nazubljena linija grebena od vrha ka podnožju
    let x = t.x;
    let y = t.y;
    const n = 5;
    for (let i = 1; i <= n; i++) {
      y = t.y + (hgt * i) / n;
      x = t.x + side * t.hw * 0.12 * (i / n) + (rand() - 0.5) * t.hw * 0.08;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(t.x + side * t.hw * 1.15, baseY + 2);
    ctx.lineTo(t.x + side * t.hw * 0.75, t.y + hgt * 0.3);
    ctx.closePath();
    ctx.fill();
    // nekoliko kosih žlebova na osvetljenoj strani
    ctx.strokeStyle = rgba(shade, 0.35);
    ctx.lineWidth = Math.max(1, hgt * 0.012);
    for (let i = 0; i < 3; i++) {
      const sx = t.x - side * t.hw * (0.1 + 0.4 * rand());
      const sy = t.y + hgt * (0.15 + 0.3 * rand());
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx - side * hgt * 0.15, sy + hgt * (0.25 + 0.3 * rand()));
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawCliff(ctx: CanvasRenderingContext2D, c: Cliff, horizonY: number, rk: RGB, sn: RGB, lightDir: number, s: number, layer: number): void {
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(c.pts[0]!.x, horizonY + 2);
    for (const p of c.pts) ctx.lineTo(p.x, p.y);
    ctx.lineTo(c.inner, horizonY + 2);
    ctx.closePath();
  };
  // Litica okrenuta ka svetlu je svetlija
  const facing = c.side === -lightDir ? 1 : 0; // leva litica gleda desno
  const base = mix(rk, sn, facing * 0.12);
  const top = c.pts.reduce((m, p) => Math.min(m, p.y), horizonY);
  const g = ctx.createLinearGradient(0, top, 0, horizonY);
  g.addColorStop(0, rgbString(mix(base, sn, 0.08)));
  g.addColorStop(1, rgbString(mix(base, [0, 0, 0], 0.15)));
  path();
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  path();
  ctx.clip();
  // Slojevi stene (kosi)
  ctx.strokeStyle = rgba(mix(base, [0, 0, 0], 0.4), 0.45);
  ctx.lineWidth = Math.max(1, (1 + layer) * s);
  const x0 = c.pts[0]!.x;
  for (const [u, v, tilt] of c.strata) {
    const y = top + (horizonY - top) * v;
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x0 + (c.inner - x0) * (0.4 + 0.6 * u), y + tilt * (horizonY - top));
    ctx.stroke();
  }
  // Snežna kapa duž gornje ivice
  ctx.strokeStyle = rgba(sn, 0.85);
  ctx.lineWidth = (2.5 + layer * 2.5) * s;
  ctx.lineCap = "round";
  ctx.beginPath();
  for (let i = 1; i < c.pts.length; i++) {
    const a = c.pts[i - 1]!;
    const p = c.pts[i]!;
    if (Math.abs(p.y - a.y) < Math.abs(p.x - a.x) * 0.9) {
      ctx.moveTo(a.x, a.y + 1);
      ctx.lineTo(p.x, p.y + 1);
    }
  }
  ctx.stroke();
  // Snežni žlebovi
  ctx.lineCap = "round";
  for (const [gx, gy, dx, len] of c.gullies) {
    ctx.strokeStyle = rgba(sn, 0.3);
    ctx.lineWidth = (1.5 + layer * 1.5) * s;
    ctx.beginPath();
    ctx.moveTo(gx, gy);
    ctx.quadraticCurveTo(gx + dx * len * 0.3, gy + len * 0.5, gx + dx * len, gy + len);
    ctx.stroke();
  }
  // Unutrašnje lice litice u senci (uska traka uz unutrašnju ivicu)
  if (!facing) {
    const fw = (40 + layer * 40) * s;
    const fg = ctx.createLinearGradient(c.inner, 0, c.inner - c.side * fw, 0);
    fg.addColorStop(0, rgba([0, 0, 0], 0.25));
    fg.addColorStop(1, rgba([0, 0, 0], 0));
    ctx.fillStyle = fg;
    ctx.fillRect(Math.min(c.inner, c.inner - c.side * fw), top, fw, horizonY - top + 2);
  }
  ctx.restore();
}

function drawHouse(ctx: CanvasRenderingContext2D, hs: { x: number; w: number; h: number; col: RGB }, horizonY: number, night: boolean, s: number): void {
  const y = horizonY;
  ctx.fillStyle = rgbString(night ? mix(hs.col, [10, 15, 30], 0.6) : hs.col);
  ctx.fillRect(hs.x - hs.w / 2, y - hs.h, hs.w, hs.h + 1);
  ctx.fillStyle = rgbString(night ? [40, 45, 60] : [235, 240, 248]);
  ctx.beginPath();
  ctx.moveTo(hs.x - hs.w / 2 - 1 * s, y - hs.h);
  ctx.lineTo(hs.x, y - hs.h - hs.h * 0.7);
  ctx.lineTo(hs.x + hs.w / 2 + 1 * s, y - hs.h);
  ctx.closePath();
  ctx.fill();
  if (night) {
    ctx.fillStyle = "rgba(255,210,120,0.95)";
    ctx.fillRect(hs.x - 1.2 * s, y - hs.h * 0.7, 2.4 * s, 2.2 * s);
  }
}

function bergPath(ctx: CanvasRenderingContext2D, b: Berg): void {
  ctx.beginPath();
  ctx.moveTo(b.cx + b.top[0]!.x, b.wl);
  for (const p of b.top) ctx.lineTo(b.cx + p.x, b.wl + p.y);
  ctx.closePath();
}

/** Nadvodni deo sante: osvetljena osnova, senovite fasete, svetla vodena linija. */
function drawBergTop(ctx: CanvasRenderingContext2D, b: Berg, lit: RGB, shade: RGB, lightDir: number, s: number): void {
  const g = ctx.createLinearGradient(0, b.wl - b.H, 0, b.wl);
  g.addColorStop(0, rgbString(mix(lit, [255, 255, 255], 0.3)));
  g.addColorStop(1, rgbString(mix(lit, shade, 0.35)));
  bergPath(ctx, b);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  bergPath(ctx, b);
  ctx.clip();
  const side = -lightDir;
  for (const pi of b.peaks) {
    const p = b.top[pi]!;
    const px = b.cx + p.x;
    const py = b.wl + p.y;
    ctx.fillStyle = rgba(shade, 0.9);
    ctx.beginPath();
    ctx.moveTo(px, py - 2);
    ctx.lineTo(px + side * b.W * 0.05, py + b.H * 0.35);
    ctx.lineTo(px + side * b.W * 0.02, b.wl + 2);
    ctx.lineTo(px + side * b.W, b.wl + 2);
    ctx.lineTo(px + side * b.W, py - 2);
    ctx.closePath();
    ctx.fill();
  }
  // Ivica strane okrenute od svetla (tabularna: vertikalni zid)
  const edgeX = b.cx + (side > 0 ? b.W / 2 : -b.W / 2);
  const eg = ctx.createLinearGradient(edgeX, 0, edgeX - side * b.W * 0.25, 0);
  eg.addColorStop(0, rgba(mix(shade, [0, 20, 60], 0.25), 0.7));
  eg.addColorStop(1, rgba(shade, 0));
  ctx.fillStyle = eg;
  ctx.fillRect(b.cx - b.W / 2, b.wl - b.H * 1.1, b.W, b.H * 1.1 + 2);
  // Pukotine
  ctx.strokeStyle = rgba(mix(shade, [0, 30, 80], 0.2), 0.4);
  ctx.lineWidth = Math.max(1, b.W * 0.006);
  for (let i = 0; i < 4; i++) {
    const x = b.cx + b.W * (i / 4 - 0.4);
    ctx.beginPath();
    ctx.moveTo(x, b.wl - b.H * (0.2 + 0.1 * i));
    ctx.lineTo(x + b.W * 0.02, b.wl);
    ctx.stroke();
  }
  ctx.restore();
  // Vodena linija
  ctx.fillStyle = rgba([255, 255, 255], 0.75);
  ctx.fillRect(b.cx - b.W / 2, b.wl - Math.max(1, 1.2 * s), b.W, Math.max(1, 1.6 * s));
}

function drawBergReflection(ctx: CanvasRenderingContext2D, b: Berg, lit: RGB, water: RGB): void {
  ctx.save();
  ctx.translate(0, 2 * b.wl);
  ctx.scale(1, -1);
  bergPath(ctx, b);
  ctx.fillStyle = rgba(mix(lit, water, 0.45), 0.45);
  ctx.fill();
  ctx.restore();
}

/** Nagoveštaj podvodnog dela (kroz mirnu vodu, kratko i prozirno). */
function drawBergUnderHint(ctx: CanvasRenderingContext2D, b: Berg, shade: RGB): void {
  ctx.save();
  ctx.translate(b.cx, b.wl);
  ctx.scale(1, 0.35);
  ctx.beginPath();
  ctx.moveTo(b.under[0]!.x, 0);
  for (const p of b.under) ctx.lineTo(p.x, p.y);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, 0, 0, b.H * 3);
  g.addColorStop(0, rgba(mix(shade, [120, 220, 230], 0.3), 0.18));
  g.addColorStop(1, rgba(shade, 0));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
}

/** Pun podvodni deo (presek): tirkizni led koji bledi u dubinu. */
function drawBergUnder(ctx: CanvasRenderingContext2D, b: Berg, lit: RGB, shade: RGB, underTop: RGB, underDeep: RGB, lightDir: number, h: number): void {
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(b.cx + b.under[0]!.x, b.wl);
    for (const p of b.under) ctx.lineTo(b.cx + p.x, b.wl + p.y);
    ctx.closePath();
  };
  const depth = b.under.reduce((m, p) => Math.max(m, p.y), 0);
  const iceU = mix(mix(lit, [140, 230, 240], 0.35), underTop, 0.35);
  const g = ctx.createLinearGradient(0, b.wl, 0, Math.min(h, b.wl + depth));
  g.addColorStop(0, rgba(iceU, 0.9));
  g.addColorStop(0.6, rgba(mix(iceU, underDeep, 0.5), 0.7));
  g.addColorStop(1, rgba(underDeep, 0.35));
  path();
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  path();
  ctx.clip();
  // Senovita polovina + fasete
  const side = -lightDir;
  const sg = ctx.createLinearGradient(b.cx - side * b.W * 0.1, 0, b.cx + side * b.W, 0);
  sg.addColorStop(0, rgba(shade, 0));
  sg.addColorStop(1, rgba(mix(shade, underDeep, 0.6), 0.55));
  ctx.fillStyle = sg;
  ctx.fillRect(b.cx - b.W * 1.5, b.wl, b.W * 3, depth + 2);
  // Fasete: blage vertikalne trake od vodene linije ka obodu (bez lepeze iz centra)
  const lightC = mix(iceU, [255, 255, 255], 0.5);
  const darkC = mix(shade, underDeep, 0.4);
  const nU = b.under.length - 1;
  for (let i = 0; i + 4 <= nU; i += 4) {
    const p0 = b.under[i]!;
    const p1 = b.under[i + 4]!;
    ctx.fillStyle = rgba((i / 4) % 2 ? lightC : darkC, 0.06);
    ctx.beginPath();
    ctx.moveTo(b.cx + p0.x * 0.75, b.wl);
    ctx.lineTo(b.cx + p1.x * 0.75, b.wl);
    ctx.lineTo(b.cx + p1.x, b.wl + p1.y);
    ctx.lineTo(b.cx + p0.x, b.wl + p0.y);
    ctx.closePath();
    ctx.fill();
  }
  // Svetliji sloj tik ispod vodene linije
  const tg = ctx.createLinearGradient(0, b.wl, 0, b.wl + depth * 0.25);
  tg.addColorStop(0, rgba(lightC, 0.35));
  tg.addColorStop(1, rgba(lightC, 0));
  ctx.fillStyle = tg;
  ctx.fillRect(b.cx - b.W * 1.5, b.wl, b.W * 3, depth * 0.25);
  ctx.restore();
}

function drawFloe(ctx: CanvasRenderingContext2D, rand: Rand, x: number, y: number, r: number, lit: RGB, shade: RGB, water: RGB, s: number): void {
  const n = 7 + Math.floor(rand() * 4);
  const pts: Pt[] = [];
  const flat = 0.22 + 0.1 * rand();
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = r * (0.7 + 0.45 * rand());
    pts.push({ x: x + Math.cos(a) * rr, y: y + Math.sin(a) * rr * flat });
  }
  const th = Math.max(1.5 * s, r * 0.08);
  // Bočna strana (debljina ploče)
  ctx.fillStyle = rgbString(mix(shade, water, 0.25));
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y + th) : ctx.moveTo(p.x, p.y + th)));
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = rgbString(mix(lit, shade, 0.15));
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
  ctx.fill();
  // Odraz
  ctx.fillStyle = rgba(mix(lit, water, 0.5), 0.25);
  ctx.beginPath();
  ctx.ellipse(x, y + th + r * flat * 0.9, r * 0.85, r * flat * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** Ledena ploča u prvom planu: plavi zid ka vodi, sneg, sastrugi, pukotine. */
function drawShelf(ctx: CanvasRenderingContext2D, rand: Rand, w: number, h: number, y0: number, lit: RGB, shade: RGB, ice: RGB, lightDir: number, s: number): void {
  const n = 40;
  const edge: Pt[] = [];
  const amp = (6 + rand() * 10) * s;
  const ph = rand() * 6;
  for (let i = 0; i <= n; i++) {
    const x = (i / n) * (w + 20 * s) - 10 * s;
    edge.push({ x, y: y0 + Math.sin(i * 0.4 + ph) * amp * 0.5 + (rand() - 0.5) * amp });
  }
  const wallH = (10 + rand() * 18) * s;
  // Snežna površina (ploča se vidi odozgo, iza zida — prednja ivica zida je gornja)
  // Površina počinje od gornje ivice i ide do dna slike.
  ctx.beginPath();
  edge.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.lineTo(w + 10 * s, h + 2);
  ctx.lineTo(-10 * s, h + 2);
  ctx.closePath();
  const sg = ctx.createLinearGradient(0, y0, 0, h);
  sg.addColorStop(0, rgbString(mix(lit, shade, 0.25)));
  sg.addColorStop(0.4, rgbString(lit));
  sg.addColorStop(1, rgbString(mix(lit, shade, 0.4)));
  ctx.fillStyle = sg;
  ctx.fill();
  // Plava ivica (zid ka vodi se vidi kao tanka traka pri vrhu ploče)
  ctx.strokeStyle = rgba(mix(ice, [255, 255, 255], 0.1), 0.85);
  ctx.lineWidth = Math.max(1.5, wallH * 0.35);
  ctx.beginPath();
  edge.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.stroke();
  // Sastrugi: blagi talasi snega sa senkom
  const rows = 9 + Math.floor(rand() * 8);
  for (let i = 0; i < rows; i++) {
    const t = Math.pow((i + rand()) / rows, 1.3);
    const yy = y0 + amp + (h - y0) * t;
    const len = (80 + rand() * 260) * s * (0.5 + t);
    const xx = rand() * w;
    const hgt = (2 + 5 * t) * s;
    ctx.strokeStyle = rgba(shade, 0.25 + 0.2 * t);
    ctx.lineWidth = Math.max(1, (1 + 2 * t) * s);
    ctx.beginPath();
    ctx.moveTo(xx - len / 2, yy);
    ctx.quadraticCurveTo(xx + lightDir * len * 0.1, yy - hgt * 2, xx + len / 2, yy);
    ctx.stroke();
    ctx.strokeStyle = rgba([255, 255, 255], 0.35);
    ctx.lineWidth = Math.max(1, s);
    ctx.beginPath();
    ctx.moveTo(xx - len * 0.4, yy - hgt * 0.8);
    ctx.quadraticCurveTo(xx + lightDir * len * 0.1, yy - hgt * 2.1, xx + len * 0.35, yy - hgt * 0.9);
    ctx.stroke();
  }
  // Pukotine u ledu (plave, razgranate)
  const cracks = 1 + Math.floor(rand() * 3);
  for (let c = 0; c < cracks; c++) {
    let x = rand() * w;
    let y = y0 + (h - y0) * (0.3 + 0.5 * rand());
    ctx.strokeStyle = rgba(mix(ice, [0, 60, 140], 0.3), 0.6);
    ctx.lineWidth = Math.max(1, 1.5 * s);
    ctx.beginPath();
    ctx.moveTo(x, y);
    const segs = 6 + Math.floor(rand() * 6);
    const dir = rand() < 0.5 ? -1 : 1;
    for (let i = 0; i < segs; i++) {
      x += dir * (10 + rand() * 30) * s;
      y += (rand() - 0.5) * 12 * s;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

function drawPolarBear(ctx: CanvasRenderingContext2D, x: number, y: number, k: number, col: RGB, shade: RGB, dir: number): void {
  const L = 95 * k; // dužina tela
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir, 1);
  ctx.lineJoin = "round";
  // Senka na snegu
  ctx.fillStyle = rgba(shade, 0.45);
  ctx.beginPath();
  ctx.ellipse(0, 0, L * 0.6, L * 0.06, 0, 0, Math.PI * 2);
  ctx.fill();
  const body = mix(col, shade, 0.05);
  const dark = mix(col, shade, 0.38);
  const outline = rgba(shade, 0.85);
  const lw = Math.max(1.2, L * 0.022);
  // Noga: debela, blago sužena, sa šapom; vrh skriven u telu
  const leg = (lx: number, lean: number) => {
    ctx.beginPath();
    ctx.moveTo(lx - L * 0.075, -L * 0.36);
    ctx.quadraticCurveTo(lx - L * 0.085 + lean * 0.5, -L * 0.15, lx - L * 0.07 + lean, -L * 0.03);
    ctx.quadraticCurveTo(lx - L * 0.08 + lean, 0, lx + lean, 0);
    ctx.quadraticCurveTo(lx + L * 0.1 + lean, 0, lx + L * 0.07 + lean, -L * 0.04);
    ctx.quadraticCurveTo(lx + L * 0.07 + lean * 0.5, -L * 0.18, lx + L * 0.075, -L * 0.36);
    ctx.closePath();
  };
  const drawLeg = (lx: number, lean: number, c: RGB) => {
    leg(lx, lean);
    ctx.strokeStyle = outline;
    ctx.lineWidth = lw;
    ctx.stroke();
    ctx.fillStyle = rgbString(c);
    ctx.fill();
  };
  // Zadnje (dalje) noge — tamnije
  drawLeg(-L * 0.24, -L * 0.03, dark);
  drawLeg(L * 0.24, L * 0.03, dark);
  // Silueta tela: zadnjica, leđa sa grbom iza ramena, vrat ka spuštenoj glavi
  const torso = () => {
    ctx.beginPath();
    ctx.moveTo(-L * 0.36, -L * 0.22);
    ctx.quadraticCurveTo(-L * 0.52, -L * 0.3, -L * 0.48, -L * 0.45);
    ctx.quadraticCurveTo(-L * 0.42, -L * 0.6, -L * 0.22, -L * 0.6);
    ctx.quadraticCurveTo(L * 0.05, -L * 0.56, L * 0.16, -L * 0.6);
    ctx.quadraticCurveTo(L * 0.3, -L * 0.62, L * 0.4, -L * 0.5);
    ctx.quadraticCurveTo(L * 0.48, -L * 0.44, L * 0.52, -L * 0.42);
    ctx.lineTo(L * 0.54, -L * 0.3);
    ctx.quadraticCurveTo(L * 0.42, -L * 0.28, L * 0.32, -L * 0.24);
    ctx.quadraticCurveTo(L * 0.05, -L * 0.18, -L * 0.36, -L * 0.22);
    ctx.closePath();
  };
  torso();
  ctx.strokeStyle = outline;
  ctx.lineWidth = lw;
  ctx.stroke();
  const bg = ctx.createLinearGradient(0, -L * 0.62, 0, -L * 0.18);
  bg.addColorStop(0, rgbString(mix(body, [255, 250, 225], 0.35)));
  bg.addColorStop(1, rgbString(mix(body, shade, 0.4)));
  ctx.fillStyle = bg;
  torso();
  ctx.fill();
  // Glava + njuška
  const head = () => {
    ctx.beginPath();
    ctx.ellipse(L * 0.56, -L * 0.37, L * 0.12, L * 0.085, 0.2, 0, Math.PI * 2);
    ctx.moveTo(L * 0.72, -L * 0.33);
    ctx.ellipse(L * 0.67, -L * 0.33, L * 0.07, L * 0.05, 0.25, 0, Math.PI * 2);
  };
  head();
  ctx.strokeStyle = outline;
  ctx.stroke();
  ctx.fillStyle = rgbString(mix(body, [255, 250, 225], 0.2));
  head();
  ctx.fill();
  // Uvo, oko, nos
  ctx.beginPath();
  ctx.arc(L * 0.5, -L * 0.44, L * 0.03, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = outline;
  ctx.lineWidth = lw * 0.7;
  ctx.stroke();
  ctx.fillStyle = "rgb(25,25,30)";
  ctx.beginPath();
  ctx.arc(L * 0.725, -L * 0.335, Math.max(0.9, L * 0.017), 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(L * 0.585, -L * 0.39, Math.max(0.7, L * 0.011), 0, Math.PI * 2);
  ctx.fill();
  // Prednje (bliže) noge — svetle
  drawLeg(-L * 0.12, 0, mix(body, shade, 0.15));
  drawLeg(L * 0.34, L * 0.02, mix(body, shade, 0.15));
  ctx.restore();
}

function drawPenguin(ctx: CanvasRenderingContext2D, rand: Rand, x: number, y: number, k: number, shade: RGB): void {
  const H = 46 * k;
  const lean = (rand() - 0.5) * 0.15;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = rgba(shade, 0.4);
  ctx.beginPath();
  ctx.ellipse(H * 0.1, 0, H * 0.28, H * 0.05, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(lean);
  // Telo (crno)
  ctx.fillStyle = "rgb(22,24,32)";
  ctx.beginPath();
  ctx.ellipse(0, -H * 0.42, H * 0.2, H * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();
  // Glava
  ctx.beginPath();
  ctx.arc(0, -H * 0.88, H * 0.13, 0, Math.PI * 2);
  ctx.fill();
  // Beli stomak
  ctx.fillStyle = "rgb(240,242,245)";
  ctx.beginPath();
  ctx.ellipse(H * 0.04, -H * 0.38, H * 0.13, H * 0.33, 0, 0, Math.PI * 2);
  ctx.fill();
  // Žuto-narandžasta mrlja na vratu i kljun
  ctx.fillStyle = "rgba(245,170,60,0.85)";
  ctx.beginPath();
  ctx.ellipse(H * 0.08, -H * 0.76, H * 0.06, H * 0.04, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(H * 0.1, -H * 0.9);
  ctx.lineTo(H * 0.24, -H * 0.86);
  ctx.lineTo(H * 0.1, -H * 0.84);
  ctx.closePath();
  ctx.fill();
  // Krilo
  ctx.fillStyle = "rgb(30,32,42)";
  ctx.beginPath();
  ctx.ellipse(-H * 0.12, -H * 0.45, H * 0.05, H * 0.22, 0.25, 0, Math.PI * 2);
  ctx.fill();
  // Stopala
  ctx.fillStyle = "rgba(230,140,50,0.9)";
  ctx.fillRect(-H * 0.1, -H * 0.03, H * 0.1, H * 0.04);
  ctx.fillRect(H * 0.03, -H * 0.03, H * 0.1, H * 0.04);
  ctx.restore();
}

function drawWhaleTail(ctx: CanvasRenderingContext2D, rand: Rand, x: number, y: number, k: number, col: RGB, water: RGB): void {
  const S = 40 * k;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = rgbString(col);
  // Peraja (repna) iznad vode
  ctx.beginPath();
  ctx.moveTo(-S * 0.12, 0);
  ctx.quadraticCurveTo(-S * 0.08, -S * 0.45, -S * 0.05, -S * 0.7);
  ctx.quadraticCurveTo(-S * 0.5, -S * 0.8, -S * 0.75, -S * 1.15);
  ctx.quadraticCurveTo(-S * 0.3, -S * 1.05, 0, -S * 0.9);
  ctx.quadraticCurveTo(S * 0.3, -S * 1.05, S * 0.75, -S * 1.15);
  ctx.quadraticCurveTo(S * 0.5, -S * 0.8, S * 0.05, -S * 0.7);
  ctx.quadraticCurveTo(S * 0.08, -S * 0.45, S * 0.12, 0);
  ctx.closePath();
  ctx.fill();
  // Kapi koje padaju sa repa
  ctx.fillStyle = rgba([255, 255, 255], 0.7);
  for (let i = 0; i < 14; i++) {
    const side = rand() < 0.5 ? -1 : 1;
    ctx.beginPath();
    ctx.arc(side * S * (0.2 + 0.55 * rand()), -S * (0.1 + 0.9 * rand()), Math.max(0.8, S * 0.012 * (1 + rand())), 0, Math.PI * 2);
    ctx.fill();
  }
  // Pena i krugovi na vodi
  ctx.strokeStyle = rgba(mix([255, 255, 255], water, 0.3), 0.6);
  ctx.lineWidth = Math.max(1, S * 0.02);
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.ellipse(0, S * 0.02, S * (0.3 + i * 0.25), S * (0.05 + i * 0.03), 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Odraz
  ctx.fillStyle = rgba(col, 0.25);
  ctx.beginPath();
  ctx.moveTo(-S * 0.12, S * 0.05);
  ctx.lineTo(-S * 0.4, S * 0.6);
  ctx.lineTo(S * 0.4, S * 0.6);
  ctx.lineTo(S * 0.12, S * 0.05);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Kit pod vodom (silueta u dubini, bledi u boju vode). */
function drawWhaleUnder(ctx: CanvasRenderingContext2D, x: number, y: number, k: number, dir: number, col: RGB, water: RGB): void {
  const L = 120 * k;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir, 1);
  ctx.fillStyle = rgba(mix(col, water, 0.25), 0.75);
  ctx.beginPath();
  ctx.moveTo(L * 0.5, 0);
  ctx.quadraticCurveTo(L * 0.45, -L * 0.12, L * 0.15, -L * 0.13);
  ctx.quadraticCurveTo(-L * 0.25, -L * 0.12, -L * 0.42, -L * 0.03);
  ctx.lineTo(-L * 0.58, -L * 0.12);
  ctx.quadraticCurveTo(-L * 0.55, -L * 0.02, -L * 0.62, L * 0.08);
  ctx.lineTo(-L * 0.42, L * 0.02);
  ctx.quadraticCurveTo(-L * 0.1, L * 0.1, L * 0.2, L * 0.09);
  ctx.quadraticCurveTo(L * 0.45, L * 0.07, L * 0.5, 0);
  ctx.closePath();
  ctx.fill();
  // Prsna peraja
  ctx.beginPath();
  ctx.moveTo(L * 0.18, L * 0.06);
  ctx.quadraticCurveTo(L * 0.05, L * 0.2, -L * 0.05, L * 0.24);
  ctx.quadraticCurveTo(L * 0.08, L * 0.12, L * 0.1, L * 0.07);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawIgloo(ctx: CanvasRenderingContext2D, x: number, y: number, k: number, lit: RGB, shade: RGB, glow: boolean, lightDir: number): void {
  const R = 34 * k;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = rgba(shade, 0.4);
  ctx.beginPath();
  ctx.ellipse(-lightDir * R * 0.3, 0, R * 1.3, R * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();
  const g = ctx.createLinearGradient(lightDir * R, -R, -lightDir * R, 0);
  g.addColorStop(0, rgbString(mix(lit, [255, 255, 255], 0.3)));
  g.addColorStop(1, rgbString(mix(lit, shade, 0.6)));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, R, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  // Blokovi
  ctx.strokeStyle = rgba(shade, 0.55);
  ctx.lineWidth = Math.max(1, R * 0.03);
  for (let i = 1; i < 4; i++) {
    const yy = -R * (i / 4);
    const hw = Math.sqrt(R * R - yy * yy);
    ctx.beginPath();
    ctx.moveTo(-hw, yy);
    ctx.lineTo(hw, yy);
    ctx.stroke();
    const n = 5 - i;
    for (let j = 0; j <= n; j++) {
      const bx = -hw + ((2 * hw) / (n + 1)) * (j + (i % 2 ? 0.5 : 1));
      const yb = -R * ((i - 1) / 4);
      ctx.beginPath();
      ctx.moveTo(bx, yy);
      ctx.lineTo(bx, yb);
      ctx.stroke();
    }
  }
  // Ulazni tunel
  ctx.fillStyle = rgbString(mix(lit, shade, 0.3));
  ctx.beginPath();
  ctx.arc(R * 0.55, 0, R * 0.38, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = glow ? "rgba(255,190,90,0.95)" : rgbString(mix(shade, [0, 0, 0], 0.5));
  ctx.beginPath();
  ctx.arc(R * 0.62, 0, R * 0.2, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  if (glow) {
    const gl = ctx.createRadialGradient(R * 0.62, 0, 0, R * 0.62, 0, R * 1.2);
    gl.addColorStop(0, "rgba(255,190,90,0.35)");
    gl.addColorStop(1, "rgba(255,190,90,0)");
    ctx.fillStyle = gl;
    ctx.fillRect(-R * 0.6, -R * 1.2, R * 2.4, R * 1.4);
  }
  ctx.restore();
}

function drawHut(ctx: CanvasRenderingContext2D, x: number, y: number, k: number, snow: RGB, glow: boolean): void {
  const W = 46 * k;
  const H = 26 * k;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "rgba(0,20,50,0.18)";
  ctx.beginPath();
  ctx.ellipse(W * 0.2, 0, W * 0.9, H * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgb(150,38,32)";
  ctx.fillRect(-W / 2, -H, W, H);
  ctx.strokeStyle = "rgba(60,10,10,0.35)";
  ctx.lineWidth = Math.max(1, k);
  for (let i = 1; i < 6; i++) {
    ctx.beginPath();
    ctx.moveTo(-W / 2, -H * (i / 6));
    ctx.lineTo(W / 2, -H * (i / 6));
    ctx.stroke();
  }
  // Krov sa snegom
  ctx.fillStyle = rgbString(snow);
  ctx.beginPath();
  ctx.moveTo(-W / 2 - 5 * k, -H);
  ctx.lineTo(0, -H - H * 0.75);
  ctx.lineTo(W / 2 + 5 * k, -H);
  ctx.lineTo(W / 2 + 5 * k, -H + 3 * k);
  ctx.lineTo(-W / 2 - 5 * k, -H + 3 * k);
  ctx.closePath();
  ctx.fill();
  // Prozor i vrata
  ctx.fillStyle = glow ? "rgba(255,200,110,0.95)" : "rgba(40,60,80,0.9)";
  ctx.fillRect(-W * 0.32, -H * 0.7, W * 0.18, H * 0.3);
  ctx.fillStyle = "rgb(70,25,20)";
  ctx.fillRect(W * 0.12, -H * 0.62, W * 0.16, H * 0.62);
  // Dimnjak + dim
  ctx.fillStyle = "rgb(80,60,55)";
  ctx.fillRect(W * 0.18, -H - H * 0.62, W * 0.08, H * 0.35);
  ctx.fillStyle = "rgba(220,225,235,0.35)";
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.arc(W * 0.22 + i * 6 * k, -H - H * 0.75 - i * 9 * k, (3 + i * 2) * k, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
