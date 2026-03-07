/**
 * Zalazak nad vodom — jaki gradijenti neba, sunce na horizontu, refleks na vodi.
 */
import type { QRNGStream } from "../qrng";
import { hslToRgb, rgbString, type RGB } from "../color";
import { ridgePoints, drawSunGlow } from "../draw-utils";

export function renderOceanSunset(
  ctx: CanvasRenderingContext2D,
  stream: QRNGStream,
  w: number,
  h: number
): void {
  const horizonY = Math.floor(h * (0.52 + 0.06 * stream.next_f()));

  const sky1 = hslToRgb(15 + stream.next_int(0, 20), 0.85, 0.55);
  const sky2 = hslToRgb(290 + stream.next_int(0, 30), 0.75, 0.45);
  const sky3 = hslToRgb(250 + stream.next_int(0, 20), 0.7, 0.35);
  const sky4 = hslToRgb(240, 0.6, 0.2);
  const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
  skyGrad.addColorStop(0, rgbString(sky1));
  skyGrad.addColorStop(0.25, rgbString(sky2));
  skyGrad.addColorStop(0.6, rgbString(sky3));
  skyGrad.addColorStop(1, rgbString(sky4));
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, w, horizonY);

  const sunX = Math.floor(w * (0.35 + 0.3 * stream.next_f()));
  const sunY = horizonY;
  const sunR = Math.floor(22 + 14 * stream.next_f());
  const glowColor: RGB = [255, 180, 100];
  const coreColor: RGB = [255, 200, 120];
  drawSunGlow(ctx, sunX, sunY, sunR, glowColor, coreColor, 17);

  const waterTop = hslToRgb(235, 0.65, 0.18);
  const waterReflex = hslToRgb(25, 0.7, 0.35);
  const waterBot = hslToRgb(230, 0.6, 0.08);
  const waterGrad = ctx.createLinearGradient(0, horizonY, 0, h);
  waterGrad.addColorStop(0, rgbString(waterTop));
  waterGrad.addColorStop(0.15, rgbString(waterReflex));
  waterGrad.addColorStop(0.4, rgbString(hslToRgb(230, 0.6, 0.12)));
  waterGrad.addColorStop(1, rgbString(waterBot));
  ctx.fillStyle = waterGrad;
  ctx.fillRect(0, horizonY, w, h - horizonY);

  const waveCount = stream.next_int(5, 12);
  ctx.save();
  ctx.globalAlpha = 0.12 + 0.1 * stream.next_f();
  for (let i = 0; i < waveCount; i++) {
    const yBase = horizonY + stream.next_int(20, Math.floor((h - horizonY) * 0.7));
    const amplitude = 8 + 12 * stream.next_f();
    const rough = 0.75 + 0.1 * stream.next_f();
    const pts = ridgePoints(stream, w, yBase, amplitude, rough, 12);
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pts[0]!.x, pts[0]!.y);
    for (let j = 1; j < pts.length; j++) {
      ctx.lineTo(pts[j]!.x, pts[j]!.y);
    }
    ctx.stroke();
  }
  ctx.restore();
}
