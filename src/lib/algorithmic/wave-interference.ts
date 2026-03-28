import { QRNGStream } from "../qrng";
import type { WaveParams, RGBA } from "./types";
import { getPaletteColors } from "./types";

const W = 1200;
const H = 675;

interface Wave {
  fx: number;   // frekvencija x
  fy: number;   // frekvencija y
  phase: number;
  amplitude: number;
}

export function renderWaveInterference(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  values: number[],
  params: WaveParams
): void {
  const stream = new QRNGStream(values);
  const colors = getPaletteColors(params.palette);
  const n = Math.max(4, Math.min(24, params.waves));

  // Definisanje talasa iz QRNG vrednosti
  const waves: Wave[] = [];
  for (let i = 0; i < n; i++) {
    waves.push({
      fx: (stream.next_f() * 6 + 1) * (Math.PI * 2) / W,
      fy: (stream.next_f() * 4 + 0.5) * (Math.PI * 2) / H,
      phase: stream.next_f() * Math.PI * 2,
      amplitude: 0.4 + stream.next_f() * 0.6,
    });
  }

  // Crna pozadina
  ctx.fillStyle = "rgb(5, 5, 15)";
  ctx.fillRect(0, 0, W, H);

  // Pixel-level rendering koristeći ImageData
  const imageData = ctx.createImageData(W, H);
  const data = imageData.data;

  const contrast = params.contrast;
  const amplitude = params.amplitude;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      // Suma svih talasa za ovaj piksel
      let sum = 0;
      for (const w of waves) {
        sum += Math.sin(x * w.fx + y * w.fy + w.phase) * w.amplitude;
      }
      // Normalizacija u [0, 1]
      const norm = (sum / n) * amplitude;
      const t = Math.max(0, Math.min(1, (norm + 1) * 0.5));
      const boosted = Math.pow(t, 1 / contrast);

      // Boja iz palete na osnovu intenziteta
      const colorT = boosted * (colors.length - 1);
      const ci = Math.floor(colorT);
      const cf = colorT - ci;
      const c0 = colors[Math.min(ci, colors.length - 1)]!;
      const c1 = colors[Math.min(ci + 1, colors.length - 1)]!;

      const idx = (y * W + x) * 4;
      data[idx]     = Math.round(c0[0] * (1 - cf) + c1[0] * cf);
      data[idx + 1] = Math.round(c0[1] * (1 - cf) + c1[1] * cf);
      data[idx + 2] = Math.round(c0[2] * (1 - cf) + c1[2] * cf);
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);

  // Overlay lagani glow efekt koristeći globalCompositeOperation
  addGlowOverlay(ctx, colors, stream);
}

function addGlowOverlay(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  colors: RGBA[],
  stream: QRNGStream
): void {
  const numGlows = 3 + Math.floor(stream.next_f() * 4);
  for (let i = 0; i < numGlows; i++) {
    const gx = stream.next_f() * W;
    const gy = stream.next_f() * H;
    const gr = 80 + stream.next_f() * 200;
    const [r, g, b] = colors[i % colors.length]!;
    const grad = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
    grad.addColorStop(0, `rgba(${r},${g},${b},0.15)`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }
}
