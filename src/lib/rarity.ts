/**
 * Rarity sistem (render v2) — retki nebeski događaji.
 *
 * Nivo retkosti se računa iz SVIH 1000 brojeva (FNV-1a hash), nezavisno od
 * QRNGStream-a, pa ne menja ni jednu odluku scenarija. Konkretan događaj zavisi
 * od scene (dan/sumrak/noć, ima li horizont, ima li sunce/mesec) i bira se
 * tokom crtanja — vidi src/lib/sky-events.ts.
 */
import { mulberry32, type Rand } from "./prng";

export type RarityTier = "common" | "rare" | "epic" | "legendary";

export type RarityEvent =
  | "meteors" // zvezde padalice
  | "rainbow" // duga
  | "comet" // kometa
  | "aurora" // polarna svetlost
  | "double-rainbow" // dupla duga
  | "eclipse" // pomračenje Sunca
  | "blood-moon" // krvavi mesec
  | "glitch" // kvantni glitch
  | "manta" // raža (pod vodom)
  | "whale" // kit (pod vodom)
  | "kraken"; // kraken (pod vodom)

export interface RarityResult {
  tier: RarityTier;
  event: RarityEvent | null;
}

/** Pragovi (kumulativno): 2% legendary, 8% epic, 20% rare, 70% common. */
export const RARITY_THRESHOLDS = { legendary: 0.02, epic: 0.1, rare: 0.3 } as const;

/** FNV-1a 32-bit nad svih 1000 uint16 vrednosti. */
export function valuesHash(values: readonly number[]): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < values.length; i++) {
    const v = values[i]! & 0xffff;
    h ^= v & 0xff;
    h = Math.imul(h, 0x01000193);
    h ^= v >>> 8;
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function rarityTier(values: readonly number[]): RarityTier {
  const roll = valuesHash(values) / 4294967296;
  if (roll < RARITY_THRESHOLDS.legendary) return "legendary";
  if (roll < RARITY_THRESHOLDS.epic) return "epic";
  if (roll < RARITY_THRESHOLDS.rare) return "rare";
  return "common";
}

/** PRNG za crtanje događaja — iz hash-a, ne troši QRNGStream. */
export function rarityRand(values: readonly number[]): Rand {
  return mulberry32((valuesHash(values) ^ 0x9e3779b9) >>> 0 || 1);
}
