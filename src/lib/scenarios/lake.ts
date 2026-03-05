/**
 * Jezero — mirna voda, ogledalo neba, sunce sa refleksom, brda na horizontu.
 */
import type { QRNGStream } from "../qrng";
import { hslToRgb, rgbString, type RGB } from "../color";
import { ridgePoints, drawSunGlow } from "../draw-utils";

export function renderLake(
  ctx: CanvasRenderingContext2D,
  stream: QRNGStream,
  w: number,
  h: number
): void {
  const horizonY = Math.floor(h * (0.32 + 0.06 * stream.next_f()));
  const isNight = stream.next_f() < 0.3;

  const skyHue = isNight ? 230 + stream.next_int(0, 20) : 205 + stream.next_int(0, 40);
  const skyTop = hslToRgb(skyHue, 0.5, isNight ? 0.15 : 0.62);
  const skyMid = hslToRgb((skyHue + 25) % 360, 0.55, isNight ? 0.12 : 0.5);
  const skyBot = hslToRgb((skyHue + 40) % 360, 0.5, isNight ? 0.1 : 0.4);
  const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
  skyGrad.addColorStop(0, rgbString(skyTop));
  skyGrad.addColorStop(0.5, rgbString(skyMid));
  skyGrad.addColorStop(1, rgbString(skyBot));
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, w, horizonY);

  const sunX = Math.floor(w * (0.3 + 0.4 * stream.next_f()));
  const sunY = Math.floor(horizonY * (0.25 + 0.2 * stream.next_f()));
  const sunR = Math.floor(35 + 35 * stream.next_f());
  const glowColor: RGB = isNight ? [235, 240, 255] : [255, 248, 220];
  const coreColor: RGB = isNight ? [245, 248, 255] : [255, 252, 240];
  drawSunGlow(ctx, sunX, sunY, sunR, glowColor, coreColor, 16);

  const numBirds = stream.next_int(2, 6);
  ctx.save();
  ctx.strokeStyle = isNight ? "rgba(200,210,255,0.5)" : "rgba(80,80,100,0.6)";
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  for (let i = 0; i < numBirds; i++) {
    const bx = stream.next_int(80, w - 80);
    const by = stream.next_int(40, Math.floor(horizonY * 0.7));
    const span = 12 + 16 * stream.next_f();
    const wingUp = stream.next_f() < 0.5;
    ctx.beginPath();
    ctx.moveTo(bx - span, by);
    ctx.quadraticCurveTo(bx, by + (wingUp ? -8 : 6), bx + span, by);
    ctx.stroke();
  }
  ctx.restore();

  const waterHue = 200 + stream.next_int(0, 35);
  const waterTop = hslToRgb(waterHue, 0.5, isNight ? 0.12 : 0.32);
  const waterBot = hslToRgb(waterHue + 15, 0.45, isNight ? 0.06 : 0.2);
  const waterGrad = ctx.createLinearGradient(0, horizonY, 0, h);
  waterGrad.addColorStop(0, rgbString(waterTop));
  waterGrad.addColorStop(1, rgbString(waterBot));
  ctx.fillStyle = waterGrad;
  ctx.fillRect(0, horizonY, w, h - horizonY);

  const reflexY = 2 * horizonY - sunY;
  if (reflexY > horizonY && reflexY < h) {
    ctx.save();
    ctx.globalAlpha = 0.25 + 0.15 * stream.next_f();
    const reflexR = sunR * 0.9;
    const grad = ctx.createRadialGradient(
      sunX, reflexY, 0,
      sunX, reflexY, reflexR * 2
    );
    grad.addColorStop(0, `rgba(${coreColor[0]},${coreColor[1]},${coreColor[2]},0.5)`);
    grad.addColorStop(0.4, `rgba(${glowColor[0]},${glowColor[1]},${glowColor[2]},0.12)`);
    grad.addColorStop(1, "transparent");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(sunX, reflexY, reflexR * 1.8, reflexR * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  const numHills = stream.next_int(1, 2);
  const hillHue = 210 + stream.next_int(0, 30);
  const hillBandH = Math.floor(70 + 60 * stream.next_f());
  const hillBottomY = horizonY + hillBandH;
  for (let hi = 0; hi < numHills; hi++) {
    const yBase = horizonY + stream.next_int(15, 35);
    const amplitude = Math.floor(35 + 30 * stream.next_f());
    const rough = 0.75 + 0.15 * stream.next_f();
    const pts = ridgePoints(stream, w, yBase, amplitude, rough, 8);
    ctx.fillStyle = rgbString(hslToRgb(hillHue, 0.45, 0.1));
    ctx.beginPath();
    ctx.moveTo(0, hillBottomY);
    ctx.lineTo(pts[0]!.x, pts[0]!.y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]!.x, pts[i]!.y);
    ctx.lineTo(w + 10, hillBottomY);
    ctx.closePath();
    ctx.fill();
  }

  const waveLines = stream.next_int(2, 4);
  ctx.save();
  ctx.globalAlpha = 0.06 + 0.04 * stream.next_f();
  for (let i = 0; i < waveLines; i++) {
    const wy = horizonY + stream.next_int(30, Math.floor((h - horizonY) * 0.6));
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, wy + (stream.next_f() - 0.5) * 4);
    for (let x = 20; x < w; x += 40) {
      ctx.lineTo(x, wy + (stream.next_f() - 0.5) * 8);
    }
    ctx.lineTo(w, wy);
    ctx.stroke();
  }
  ctx.restore();
}
