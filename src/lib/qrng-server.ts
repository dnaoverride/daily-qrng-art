/**
 * Server-only: seed iz datuma, kvantno seme + xorshift, entropy fallback.
 * ANU se NE zove iz aplikacije (limit 100 poziva/mes) — bazen puni qrng-pool/refill.php.
 * Koristi se u API rutama.
 */

import { createHash, randomBytes } from "crypto";

export function seedFromDate(dateStr: string): number[] {
  const hash = createHash("sha256").update(dateStr).digest("hex");
  let state = parseInt(hash.slice(0, 16), 16) || 1;
  state &= 0xffffffff;

  function xorshift(): number {
    let x = state;
    x ^= (x << 13) & 0xffffffff;
    x ^= x >>> 17;
    x ^= (x << 5) & 0xffffffff;
    state = x & 0xffffffff;
    return state & 0xffff;
  }

  const values: number[] = [];
  for (let i = 0; i < 1000; i++) {
    values.push(xorshift());
  }
  return values;
}

/**
 * 1000 brojeva izvedenih iz kvantnog semena (Studio, kad je bazen na rezervi).
 * Stanje xorshift128 = SHA-256(seme ‖ nonce): svi kvantni brojevi semena ulaze u stanje,
 * a nasumičan nonce čini svako izvlačenje drugačijim. Brojevi NISU kvantni — samo seme jeste.
 */
export function expandQuantumSeed(seed: number[], nonce: Buffer = randomBytes(16)): number[] {
  const buf = Buffer.alloc(seed.length * 2);
  seed.forEach((v, i) => buf.writeUInt16LE(v & 0xffff, i * 2));
  const h = createHash("sha256").update(buf).update(nonce).digest();
  let x = h.readUInt32LE(0), y = h.readUInt32LE(4), z = h.readUInt32LE(8), w = h.readUInt32LE(12);
  if ((x | y | z | w) === 0) w = 1;
  const values: number[] = [];
  for (let i = 0; i < 1000; i++) {
    const t = (x ^ (x << 11)) >>> 0;
    x = y;
    y = z;
    z = w;
    w = (w ^ (w >>> 19) ^ (t ^ (t >>> 8))) >>> 0;
    values.push(w >>> 16);
  }
  return values;
}

export function randomEntropySeed(): number[] {
  const raw = randomBytes(2000);
  const values: number[] = [];
  for (let i = 0; i < 1000; i++) {
    values.push(raw.readUInt16LE(i * 2));
  }
  return values;
}
