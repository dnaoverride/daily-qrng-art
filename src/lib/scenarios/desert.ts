/**
 * Pustinja — dune, toplo nebo, minimalno.
 */
import type { QRNGStream } from "../qrng";
import { hslToRgb, rgbString, type RGB } from "../color";
import { ridgePoints, drawSunGlow } from "../draw-utils";

export function renderDesert(
  ctx: CanvasRenderingContext2D,
  stream: QRNGStream,
  w: number,
  h: number
): void {
  const horizonY = Math.floor(h * (0.48 + 0.1 * stream.next_f()));

  const skyTop = hslToRgb(45 + stream.next_int(0, 25), 0.5, 0.7);
  const skyMid = hslToRgb(25 + stream.next_int(0, 30), 0.55, 0.55);
  const skyBot = hslToRgb(310 + stream.next_int(0, 20), 0.4, 0.45);
  const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
  skyGrad.addColorStop(0, rgbString(skyTop));
  skyGrad.addColorStop(0.5, rgbString(skyMid));
  skyGrad.addColorStop(1, rgbString(skyBot));
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, w, horizonY);

  const sunX = Math.floor(w * (0.4 + 0.35 * stream.next_f()));
  const sunY = Math.floor(horizonY * (0.25 + 0.25 * stream.next_f()));
  const sunR = Math.floor(28 + 25 * stream.next_f());
  const glowColor: RGB = [255, 200, 140];
  const coreColor: RGB = [255, 235, 200];
  drawSunGlow(ctx, sunX, sunY, sunR, glowColor, coreColor, 14);

  const sandHue = 35 + stream.next_int(0, 20);
  const baseSand = hslToRgb(sandHue, 0.4, 0.38);
  ctx.fillStyle = rgbString(baseSand);
  ctx.fillRect(0, horizonY, w, h - horizonY);

  for (let di = 0; di < 4; di++) {
    const depth = di / 2;
    const amplitude = Math.floor(45 + 35 * stream.next_f());
    const yBase =
      di === 0
        ? Math.floor(horizonY - 25 + 35 * stream.next_f())
        : Math.floor(horizonY + depth * 110 + 25 * stream.next_f());
    const pts = ridgePoints(stream, w, yBase, amplitude, 0.9, 6, 0.06, 60);

    const col = hslToRgb(
      (sandHue + di * 5) % 360,
      0.4 + 0.15 * stream.next_f(),
      0.42 + depth * 0.08
    );
    ctx.fillStyle = rgbString(col);
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (const p of pts) ctx.lineTo(p.x, p.y);
    ctx.lineTo(w + 10, h);
    ctx.closePath();
    ctx.fill();
  }
}
