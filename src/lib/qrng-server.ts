/**
 * Server-only: seed iz datuma, fetch ANU, entropy fallback.
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

export async function fetchQRNG(): Promise<number[]> {
  const res = await fetch(
    "https://qrng.anu.edu.au/API/jsonI.php?length=1000&type=uint16",
    {
      headers: {
        "User-Agent": "qrng-art/1.0 (+next.js; respectful rate)",
        Accept: "application/json",
      },
      next: { revalidate: 0 },
    }
  );
  if (!res.ok) throw new Error(`ANU API error: ${res.status}`);
  const obj = await res.json();
  if (!obj?.success || !Array.isArray(obj.data) || obj.data.length !== 1000) {
    throw new Error("Invalid ANU QRNG response");
  }
  return obj.data.map((v: unknown) => Number(v) & 0xffff);
}

export function randomEntropySeed(): number[] {
  const raw = randomBytes(2000);
  const values: number[] = [];
  for (let i = 0; i < 1000; i++) {
    values.push(raw.readUInt16LE(i * 2));
  }
  return values;
}
