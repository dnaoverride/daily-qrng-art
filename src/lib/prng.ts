/**
 * Deterministički PRNG za masovne detalje (grain, odsjaji, sitne zvezde…).
 *
 * Pravilo za render v2: QRNG vrednosti trošiti na ODLUKE (paleta, kompozicija,
 * pozicije glavnih objekata), a za stotine sitnih detalja koristiti mulberry32
 * seedovan iz QRNG-a — tako budžet od 1000 kvantnih vrednosti ostaje za važne stvari.
 */
import type { QRNGStream } from "./qrng";

export type Rand = () => number;

/** mulberry32 — vraća float [0, 1). */
export function mulberry32(seed: number): Rand {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** PRNG seedovan sa 2 QRNG vrednosti (32 bita). */
export function prngFromStream(stream: QRNGStream): Rand {
  const seed = ((stream.next_u16() << 16) | stream.next_u16()) >>> 0;
  return mulberry32(seed || 1);
}
