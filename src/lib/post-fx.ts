/**
 * Post-fx sloj (render v2) — primenjuje se na kraju renderArt, preko svih scenarija.
 *
 * Jedan prolaz kroz piksele (getImageData/putImageData), bez ctx.filter i bez
 * composite modova, da browser i server (@napi-rs/canvas) daju isti rezultat.
 *
 * Efekti (redom po pikselu):
 *   1. Blagi S-kontrast
 *   2. Split-tone: topliji highlights / hladnije senke (kurirani parovi)
 *   3. Vinjeta (eliptična, meka)
 *   4. Film grain (monohromatski, najjači u srednjim tonovima)
 *
 * Parametri se biraju iz QRNG stream-a POSLE scenarija, pa ne utiču na samu scenu.
 */
import type { QRNGStream } from "./qrng";

type Tint = readonly [number, number, number];

interface SplitTone {
  name: string;
  highlights: Tint;
  shadows: Tint;
}

/** Kurirani split-tone parovi (pomak u 0–255 skali pri punoj jačini). */
const SPLIT_TONES: readonly SplitTone[] = [
  { name: "amber-teal", highlights: [28, 12, -14], shadows: [-14, 6, 22] },
  { name: "peach-violet", highlights: [24, 8, -6], shadows: [6, -8, 24] },
  { name: "gold-blue", highlights: [22, 16, -16], shadows: [-10, -2, 26] },
  { name: "rose-indigo", highlights: [22, 4, 4], shadows: [-6, -6, 26] },
  { name: "neutral-warm", highlights: [14, 8, -4], shadows: [0, 0, 8] },
];

export interface PostFxParams {
  grain: number; // amplituda šuma u 0–255
  vignette: number; // 0–1, koliko se ivice zatamne
  toneStrength: number; // 0–1
  contrast: number; // 0–1, jačina S-krive
  tone: SplitTone;
  seed: number;
}

export function pickPostFxParams(stream: QRNGStream): PostFxParams {
  const seed = ((stream.next_u16() << 16) | stream.next_u16()) >>> 0;
  return {
    grain: 4 + 4 * stream.next_f(),
    vignette: 0.2 + 0.14 * stream.next_f(),
    toneStrength: 0.4 + 0.35 * stream.next_f(),
    contrast: 0.12 + 0.12 * stream.next_f(),
    tone: SPLIT_TONES[stream.next_int(0, SPLIT_TONES.length - 1)]!,
    seed: seed || 1,
  };
}

/** mulberry32 — brz deterministički PRNG za grain (ne troši QRNG). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

export function applyPostFx(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  p: PostFxParams
): void {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const rand = mulberry32(p.seed);
  // Grain skaliran na rezoluciju: thumbnail (600px) dobija manje šuma po pikselu.
  const grainAmp = p.grain * Math.min(1, w / 1200);
  const cx = w / 2;
  const cy = h / 2;
  const invRx = 1 / (w * 0.5);
  const invRy = 1 / (h * 0.5);
  const [hr, hg, hb] = p.tone.highlights;
  const [sr, sg, sb] = p.tone.shadows;
  const ts = p.toneStrength;
  const k = p.contrast;

  for (let y = 0; y < h; y++) {
    const dy = (y - cy) * invRy;
    const dy2 = dy * dy;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      let r = d[i]!;
      let g = d[i + 1]!;
      let b = d[i + 2]!;

      // 1. S-kontrast po kanalu (mešavina linearnog i smoothstep krive)
      const rn = r / 255;
      const gn = g / 255;
      const bn = b / 255;
      r = 255 * (rn + k * (rn * rn * (3 - 2 * rn) - rn));
      g = 255 * (gn + k * (gn * gn * (3 - 2 * gn) - gn));
      b = 255 * (bn + k * (bn * bn * (3 - 2 * bn) - bn));

      // 2. Split-tone po luminansi
      const L = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      // Highlights: raste ka beloj. Senke: vrh oko L≈0.33, ka čistoj crnoj opada
      // (da tamne površine ne dobiju plavi/ljubičasti cast).
      const hw = L * L * ts;
      const sw = 6.75 * L * (1 - L) * (1 - L) * ts;
      r += hr * hw + sr * sw;
      g += hg * hw + sg * sw;
      b += hb * hw + sb * sw;

      // 3. Vinjeta
      const dx = (x - cx) * invRx;
      const dist = Math.sqrt(dx * dx + dy2) / Math.SQRT2;
      const v = 1 - p.vignette * smoothstep(0.35, 1.0, dist);
      r *= v;
      g *= v;
      b *= v;

      // 4. Grain (monohromatski), najvidljiviji u srednjim tonovima (kao film)
      const n = (rand() - 0.5) * 2 * grainAmp * (0.35 + 2.6 * L * (1 - L));
      d[i] = r + n;
      d[i + 1] = g + n;
      d[i + 2] = b + n;
    }
  }
  ctx.putImageData(img, 0, 0);
}
