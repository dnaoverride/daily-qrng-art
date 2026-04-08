import type { NewtonParams } from "./types";
import { getPaletteColors } from "./types";

const W = 1200;
const H = 675;

// Renderujemo na pola rezolucije radi performansi, pa skaliramo
const HW = 600;
const HH = 338;

// Kompleksna aritmetika (inline, bez alokacije)
function cmul(ar: number, ai: number, br: number, bi: number): [number, number] {
  return [ar * br - ai * bi, ar * bi + ai * br];
}
function cdiv(ar: number, ai: number, br: number, bi: number): [number, number] {
  const denom = br * br + bi * bi;
  return [(ar * br + ai * bi) / denom, (ai * br - ar * bi) / denom];
}

/**
 * Izračunava p(z) i p'(z) za polinom oblika p(z) = (z-r1)(z-r2)...(z-rd).
 * Koristi Horner-ovu shemu za produkte.
 * Vraća [pRe, pIm, dpRe, dpIm].
 */
function evalPoly(
  zr: number, zi: number,
  roots: { re: number; im: number }[]
): [number, number, number, number] {
  const d = roots.length;

  // p(z) = produkt (z - ri)
  let pr = 1, pi = 0;
  for (const root of roots) {
    const [nr, ni] = cmul(pr, pi, zr - root.re, zi - root.im);
    pr = nr; pi = ni;
  }

  // p'(z) = suma_{k=0}^{d-1} produkt_{j≠k} (z - rj)
  let dpr = 0, dpi = 0;
  for (let k = 0; k < d; k++) {
    let termR = 1, termI = 0;
    for (let j = 0; j < d; j++) {
      if (j === k) continue;
      const [nr, ni] = cmul(termR, termI, zr - roots[j]!.re, zi - roots[j]!.im);
      termR = nr; termI = ni;
    }
    dpr += termR;
    dpi += termI;
  }

  return [pr, pi, dpr, dpi];
}

/**
 * Newton fraktal renderer.
 *
 * QRNG ulaz:
 *   QRNG[0..degree-1]       → Re deo svakog korena ∈ [-1.5, 1.5]
 *   QRNG[degree..2*degree-1] → Im deo svakog korena ∈ [-1.5, 1.5]
 *
 * Bojenje:
 *   - Boja = boja korena ka kome konvergira
 *   - Osvetljenost = 1 - (iter / maxIter), znači granice (sporija konvergencija) su tamnije
 */
export function renderNewton(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  values: number[],
  params: NewtonParams
): void {
  const colors = getPaletteColors(params.palette);
  const degree = Math.max(3, Math.min(7, Math.round(params.degree)));
  const maxIter = Math.max(20, Math.min(150, Math.round(params.maxIter)));
  const zoom = Math.max(0.5, Math.min(3.0, params.zoom));

  // Koreni iz QRNG vrednosti
  const roots: { re: number; im: number }[] = [];
  for (let i = 0; i < degree; i++) {
    const vRe = (values[i] ?? 32767) / 65535;
    const vIm = (values[degree + i] ?? 32767) / 65535;
    roots.push({
      re: -1.5 + vRe * 3.0,
      im: -1.5 + vIm * 3.0,
    });
  }

  // Za renderovanje koristimo pola rezolucije
  const imageData = ctx.createImageData(HW, HH);
  const data = imageData.data;

  const scaleX = (3.5 / zoom) / HW;
  const scaleY = (2.0 / zoom) / HH;
  const offX = -1.75 / zoom;
  const offY = -1.0 / zoom;

  const tol = 1e-6; // Tolerancija za konvergenciju ka korenu

  // Prekalkuliši RGB boje za svaki koren (+ boja za nekonvergentne piksele)
  const rootColors: [number, number, number][] = roots.map((_, i) => {
    const c = colors[i % colors.length]!;
    return [c[0], c[1], c[2]];
  });

  for (let py = 0; py < HH; py++) {
    for (let px = 0; px < HW; px++) {
      let zr = px * scaleX + offX;
      let zi = py * scaleY + offY;

      let convergedTo = -1;
      let iter = 0;

      for (iter = 0; iter < maxIter; iter++) {
        const [pr, pi, dpr, dpi] = evalPoly(zr, zi, roots);

        // z = z - p(z)/p'(z)
        const [divR, divI] = cdiv(pr, pi, dpr, dpi);
        zr -= divR;
        zi -= divI;

        // Provjeri da li smo blizu nekog korena
        for (let k = 0; k < roots.length; k++) {
          const dr = zr - roots[k]!.re;
          const di = zi - roots[k]!.im;
          if (dr * dr + di * di < tol) {
            convergedTo = k;
            break;
          }
        }
        if (convergedTo >= 0) break;
      }

      const pixIdx = (py * HW + px) * 4;

      if (convergedTo < 0) {
        // Ne konvergira → crno
        data[pixIdx] = 5;
        data[pixIdx + 1] = 5;
        data[pixIdx + 2] = 15;
        data[pixIdx + 3] = 255;
      } else {
        // Smooth shading: sporo konvergentni pikseli su tamniji (bogati detalji na granici)
        const brightness = 0.15 + 0.85 * (1 - iter / maxIter);
        const [r, g, b] = rootColors[convergedTo]!;
        data[pixIdx]     = Math.round(r * brightness);
        data[pixIdx + 1] = Math.round(g * brightness);
        data[pixIdx + 2] = Math.round(b * brightness);
        data[pixIdx + 3] = 255;
      }
    }
  }

  // Skaliranje na puni W×H
  const tempCanvas = typeof OffscreenCanvas !== "undefined"
    ? new OffscreenCanvas(HW, HH)
    : (() => {
        const c = document.createElement("canvas");
        c.width = HW;
        c.height = HH;
        return c;
      })();

  const tempCtx = (tempCanvas as HTMLCanvasElement).getContext?.("2d") ??
    (tempCanvas as OffscreenCanvas).getContext("2d");

  if (tempCtx) {
    tempCtx.putImageData(imageData, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(tempCanvas as HTMLCanvasElement, 0, 0, W, H);
  }
}
