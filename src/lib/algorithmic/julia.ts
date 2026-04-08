import type { JuliaParams } from "./types";
import { getPaletteColors } from "./types";

const W = 1200;
const H = 675;

// Renderujemo na pola rezolucije za performanse, pa skaliramo
const HW = 600;
const HH = 338;

/**
 * Julia skup renderer.
 * QRNG[0] → cRe ∈ [-0.8, 0.8], QRNG[1] → cIm ∈ [-0.8, 0.8]
 * Ostale vrednosti se koriste za sitne perturbacije c parametra.
 */
export function renderJulia(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  values: number[],
  params: JuliaParams
): void {
  const colors = getPaletteColors(params.palette);
  const maxIter = Math.max(50, Math.min(300, Math.round(params.maxIter)));
  const zoom = Math.max(0.5, Math.min(3.0, params.zoom));

  // Mapiramo QRNG[0] i QRNG[1] na c parametar Julia skupa
  const v0 = (values[0] ?? 32767) / 65535; // 0..1
  const v1 = (values[1] ?? 32767) / 65535; // 0..1

  // Interesantni regioni c parametra: [-0.8, 0.8] za Re i Im
  const cRe = -0.8 + v0 * 1.6;
  const cIm = -0.8 + v1 * 1.6;

  // Lagana perturbacija iz ostalih QRNG vrednosti
  const perturbRe = ((values[2] ?? 32767) / 65535 - 0.5) * 0.05;
  const perturbIm = ((values[3] ?? 32767) / 65535 - 0.5) * 0.05;

  const finalCRe = cRe + perturbRe;
  const finalCIm = cIm + perturbIm;

  // Kreiraj ImageData na pola rezolucije
  const imageData = ctx.createImageData(HW, HH);
  const data = imageData.data;

  const scaleX = (3.5 / zoom) / HW;
  const scaleY = (2.0 / zoom) / HH;
  const offX = -1.75 / zoom;
  const offY = -1.0 / zoom;

  // Prekalkuliši boje za smooth coloring
  const paletteSize = 256;
  const palette = new Uint8Array(paletteSize * 4);
  for (let i = 0; i < paletteSize; i++) {
    const t = i / paletteSize;
    const colorIdx = t * (colors.length - 1);
    const ci = Math.floor(colorIdx);
    const cf = colorIdx - ci;
    const c1 = colors[ci % colors.length]!;
    const c2 = colors[(ci + 1) % colors.length]!;
    palette[i * 4]     = Math.round(c1[0] + (c2[0] - c1[0]) * cf);
    palette[i * 4 + 1] = Math.round(c1[1] + (c2[1] - c1[1]) * cf);
    palette[i * 4 + 2] = Math.round(c1[2] + (c2[2] - c1[2]) * cf);
    palette[i * 4 + 3] = 255;
  }

  for (let py = 0; py < HH; py++) {
    for (let px = 0; px < HW; px++) {
      let zx = px * scaleX + offX;
      let zy = py * scaleY + offY;

      let iter = 0;
      let zx2 = zx * zx;
      let zy2 = zy * zy;

      while (zx2 + zy2 < 4 && iter < maxIter) {
        zy = 2 * zx * zy + finalCIm;
        zx = zx2 - zy2 + finalCRe;
        zx2 = zx * zx;
        zy2 = zy * zy;
        iter++;
      }

      const pixIdx = (py * HW + px) * 4;

      if (iter === maxIter) {
        // Unutrašnjost: crna
        data[pixIdx] = 5;
        data[pixIdx + 1] = 5;
        data[pixIdx + 2] = 15;
        data[pixIdx + 3] = 255;
      } else {
        // Smooth coloring: normalizuj i mapiraj na paletu
        const smooth = iter + 1 - Math.log2(Math.log2(zx2 + zy2));
        const t = (smooth / maxIter) % 1;
        const palIdx = Math.floor(t * (paletteSize - 1)) * 4;
        data[pixIdx]     = palette[palIdx]!;
        data[pixIdx + 1] = palette[palIdx + 1]!;
        data[pixIdx + 2] = palette[palIdx + 2]!;
        data[pixIdx + 3] = 255;
      }
    }
  }

  // Postavi ImageData na mali canvas privremeno, pa skaliraj na W×H
  // Koristimo putImageData + drawImage scale trik
  const tempCanvas = typeof OffscreenCanvas !== "undefined"
    ? new OffscreenCanvas(HW, HH)
    : (() => {
        const c = document.createElement("canvas");
        c.width = HW;
        c.height = HH;
        return c;
      })();

  const tempCtx = (tempCanvas as HTMLCanvasElement).getContext("2d") ??
    (tempCanvas as OffscreenCanvas).getContext("2d");

  if (tempCtx) {
    tempCtx.putImageData(imageData, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(tempCanvas as HTMLCanvasElement, 0, 0, W, H);
  }
}
