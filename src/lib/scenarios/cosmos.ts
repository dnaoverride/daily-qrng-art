/**
 * Kosmos — planete, zvezde, tamna pozadina.
 */
import type { QRNGStream } from "../qrng";
import { hslToRgb, rgbString } from "../color";

export function renderCosmos(
  ctx: CanvasRenderingContext2D,
  stream: QRNGStream,
  w: number,
  h: number
): void {
  const bgTop = hslToRgb(250 + stream.next_int(0, 30), 0.6, 0.08);
  const bgBot = hslToRgb(270 + stream.next_int(0, 25), 0.5, 0.04);
  const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
  bgGrad.addColorStop(0, rgbString(bgTop));
  bgGrad.addColorStop(1, rgbString(bgBot));
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, w, h);

  const stars = stream.next_int(300, 600);
  for (let i = 0; i < stars; i++) {
    const x = stream.next_int(0, w - 1);
    const y = stream.next_int(0, h - 1);
    const b = stream.next_int(160, 255);
    const r = stream.next_f() < 0.85 ? 1 : stream.next_f() < 0.95 ? 2 : 3;
    ctx.fillStyle = `rgb(${b},${b},${b})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const numPlanets = stream.next_int(3, 7);
  for (let i = 0; i < numPlanets; i++) {
    const px = stream.next_int(50, w - 50);
    const py = stream.next_int(80, h - 80);
    const pr = stream.next_int(30, 120);
    const hue = stream.next_int(0, 359);
    const planetGrad = ctx.createRadialGradient(
      px - pr * 0.3,
      py - pr * 0.3,
      0,
      px,
      py,
      pr
    );
    planetGrad.addColorStop(0, rgbString(hslToRgb(hue, 0.5, 0.5)));
    planetGrad.addColorStop(0.6, rgbString(hslToRgb(hue, 0.6, 0.3)));
    planetGrad.addColorStop(1, rgbString(hslToRgb(hue, 0.4, 0.15)));
    ctx.fillStyle = planetGrad;
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fill();
  }
}
