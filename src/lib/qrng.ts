/**
 * QRNGStream — potrošnja 1000 uint16 vrednosti.
 * Port iz Python qrng_landscape_batch.py
 * Client-safe: bez Node.js API-ja.
 */

const U16_MAX = 65535;

export class QRNGStream {
  private values: number[];
  private i: number;
  private state: number;

  constructor(values: number[]) {
    this.values = values;
    this.i = 0;
    const seedStr = values.slice(0, 1000).join(",");
    this.state = hashToState(seedStr);
  }

  private xorshift32(): number {
    let x = this.state;
    x ^= (x << 13) & 0xffffffff;
    x ^= x >>> 17;
    x ^= (x << 5) & 0xffffffff;
    this.state = x & 0xffffffff;
    return this.state;
  }

  next_u16(): number {
    if (this.i < this.values.length) {
      const v = this.values[this.i]! & 0xffff;
      this.state ^= (v << (this.i % 16)) & 0xffffffff;
      this.i += 1;
      return v;
    }
    // Nakon 1000 vrednosti: XOR-ujemo PRNG izlaz sa cikličnim QRNG vrednostima
    // čime proširene vrednosti zadržavaju kvantnu entropiju iz originalnog seta.
    const prng = this.xorshift32() & 0xffff;
    const qrng = this.values[this.i % this.values.length]! & 0xffff;
    this.i += 1;
    return prng ^ qrng;
  }

  next_f(): number {
    return this.next_u16() / U16_MAX;
  }

  next_int(a: number, b: number): number {
    return a + Math.floor(this.next_f() * (b - a + 1));
  }
}

/** Jednostavan hash za seed (samo za mixing, ne kriptografski) */
function hashToState(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return (Math.abs(h) || 1) & 0xffffffff;
}

export const ANU_QRNG_URL =
  "https://qrng.anu.edu.au/API/jsonI.php?length=1000&type=uint16";
