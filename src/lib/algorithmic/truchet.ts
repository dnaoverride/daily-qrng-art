import { QRNGStream } from "../qrng";
import type { TruchetParams } from "./types";
import { getPaletteColors } from "./types";

const W = 1200;
const H = 675;

/**
 * Truchet pločice: svaka ćelija dobija jednu od 2 rotacije (0° ili 90°).
 * Svaka pločica sadrži dve dijagonalne četvrtine lukova koji se spajaju sa susedima.
 * QRNG[i] % 2 određuje rotaciju pločice.
 */
export function renderTruchet(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  values: number[],
  params: TruchetParams
): void {
  const stream = new QRNGStream(values);
  const colors = getPaletteColors(params.palette);

  const ts = Math.max(20, Math.min(80, Math.round(params.tileSize)));
  const lw = Math.max(1, Math.min(8, params.lineWidth));

  const cols = Math.ceil(W / ts) + 1;
  const rows = Math.ceil(H / ts) + 1;

  // Tamna pozadina
  ctx.fillStyle = "rgb(8, 8, 20)";
  ctx.fillRect(0, 0, W, H);

  const totalTiles = cols * rows;

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const tileIdx = row * cols + col;
      const rotation = stream.next_u16() % 2; // 0 ili 1

      const x = col * ts;
      const y = row * ts;

      // Boja na osnovu pozicije i rotacije
      const colorIdx = (tileIdx + rotation) % colors.length;
      const [r, g, b] = colors[colorIdx]!;

      // Intenzitet varira od centra
      const cx = x + ts / 2;
      const cy = y + ts / 2;
      const distFromCenter = Math.sqrt(
        Math.pow((cx - W / 2) / W, 2) + Math.pow((cy - H / 2) / H, 2)
      );
      const alpha = 0.7 + 0.3 * (1 - distFromCenter * 1.5);

      ctx.strokeStyle = `rgba(${r},${g},${b},${Math.max(0.3, alpha)})`;
      ctx.lineWidth = lw;

      ctx.save();
      ctx.beginPath();

      if (rotation === 0) {
        // Tip A: luk iz gornjeg-levog ugla i donjeg-desnog ugla
        ctx.arc(x, y, ts / 2, 0, Math.PI / 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x + ts, y + ts, ts / 2, Math.PI, (3 * Math.PI) / 2);
        ctx.stroke();
      } else {
        // Tip B: luk iz gornjeg-desnog ugla i donjeg-levog ugla
        ctx.arc(x + ts, y, ts / 2, Math.PI / 2, Math.PI);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y + ts, ts / 2, (3 * Math.PI) / 2, 2 * Math.PI);
        ctx.stroke();
      }

      ctx.restore();

      // Tanki "glow" sloj sa drugom bojom
      if (totalTiles < 800 && stream.next_u16() % 5 === 0) {
        const glowColor = colors[(colorIdx + 2) % colors.length]!;
        ctx.strokeStyle = `rgba(${glowColor[0]},${glowColor[1]},${glowColor[2]},0.25)`;
        ctx.lineWidth = lw * 2.5;
        ctx.save();
        ctx.beginPath();
        if (rotation === 0) {
          ctx.arc(x, y, ts / 2, 0, Math.PI / 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(x + ts, y + ts, ts / 2, Math.PI, (3 * Math.PI) / 2);
          ctx.stroke();
        } else {
          ctx.arc(x + ts, y, ts / 2, Math.PI / 2, Math.PI);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(x, y + ts, ts / 2, (3 * Math.PI) / 2, 2 * Math.PI);
          ctx.stroke();
        }
        ctx.restore();
      }
    }
  }

  // Vignette
  const vign = ctx.createRadialGradient(W / 2, H / 2, H * 0.15, W / 2, H / 2, H * 0.85);
  vign.addColorStop(0, "rgba(0,0,0,0)");
  vign.addColorStop(1, "rgba(0,0,0,0.6)");
  ctx.fillStyle = vign;
  ctx.fillRect(0, 0, W, H);
}
