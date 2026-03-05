/**
 * Beach scenario — nebo, sunce, more, pesak, palme.
 * Landscape nivo: 3-stop gradijenti, ridgePoints za pesak, 17 glow slojeva, palme.
 */
import type { QRNGStream } from "../qrng";
import { hslToRgb, rgbString, type RGB } from "../color";
import { ridgePoints, drawSunGlow } from "../draw-utils";

export function renderBeach(
  ctx: CanvasRenderingContext2D,
  stream: QRNGStream,
  w: number,
  h: number
): void {
  const skyHue = 200 + stream.next_int(0, 40);
  const horizonY = Math.floor(h * (0.45 + 0.15 * stream.next_f()));

  const skyTop = hslToRgb(skyHue, 0.45, 0.72);
  const skyMid = hslToRgb(skyHue + 15, 0.4, 0.58);
  const skyBot = hslToRgb(skyHue + 25, 0.35, 0.48);
  const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
  skyGrad.addColorStop(0, rgbString(skyTop));
  skyGrad.addColorStop(0.5, rgbString(skyMid));
  skyGrad.addColorStop(1, rgbString(skyBot));
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, w, horizonY);

  const sunX = Math.floor(w * (0.3 + 0.4 * stream.next_f()));
  const sunY = Math.floor(horizonY * (0.25 + 0.2 * stream.next_f()));
  const sunR = Math.floor(40 + 35 * stream.next_f());
  const glowColor: RGB = [255, 220, 180];
  const coreColor: RGB = [255, 248, 220];
  drawSunGlow(ctx, sunX, sunY, sunR, glowColor, coreColor, 17);

  const seaTop = hslToRgb(195 + stream.next_int(0, 15), 0.65, 0.38);
  const seaMid = hslToRgb(185 + stream.next_int(0, 20), 0.6, 0.3);
  const seaBot = hslToRgb(200 + stream.next_int(0, 15), 0.65, 0.18);
  const seaGrad = ctx.createLinearGradient(0, horizonY, 0, h);
  seaGrad.addColorStop(0, rgbString(seaTop));
  seaGrad.addColorStop(0.4, rgbString(seaMid));
  seaGrad.addColorStop(1, rgbString(seaBot));
  ctx.fillStyle = seaGrad;
  ctx.fillRect(0, horizonY, w, h - horizonY);

  const numWaves = stream.next_int(8, 16);
  ctx.save();
  ctx.globalAlpha = 0.2 + 0.18 * stream.next_f();
  for (let i = 0; i < numWaves; i++) {
    const wx = stream.next_int(-50, w + 50);
    const wy = horizonY + stream.next_int(15, Math.floor((h - horizonY) * 0.85));
    const wa = stream.next_int(70, 180);
    const wb = stream.next_int(6, 22);
    ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
    ctx.beginPath();
    ctx.ellipse(wx, wy, wa, wb, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  const sandHue = 35 + stream.next_int(0, 25);
  const seaHeight = h - horizonY;
  const sandYBase = horizonY + Math.floor(seaHeight * 0.4);

  for (let si = 0; si < 3; si++) {
    const depth = si / 2;
    const yBase = Math.floor(sandYBase + depth * 80 + 20 * stream.next_f());
    const amplitude = Math.floor(14 + 12 * stream.next_f());
    const rough = 0.72 + 0.15 * stream.next_f();
    const pts = ridgePoints(stream, w, yBase, amplitude, rough, 8);

    const col = hslToRgb(
      (sandHue + si * 4) % 360,
      0.4 + 0.1 * stream.next_f(),
      0.38 + depth * 0.12
    );
    ctx.fillStyle = rgbString(col);
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (const p of pts) ctx.lineTo(p.x, p.y);
    ctx.lineTo(w + 10, h);
    ctx.closePath();
    ctx.fill();
  }

  const numPalms = stream.next_int(2, 5);
  ctx.save();
  ctx.globalAlpha = 0.9;
  for (let i = 0; i < numPalms; i++) {
    const x = stream.next_int(40, w - 40);
    const baseY = horizonY + Math.floor(seaHeight * 0.5) + stream.next_int(0, Math.floor(seaHeight * 0.4));
    const trunkH = stream.next_int(80, 160);
    const tilt = (stream.next_f() - 0.5) * 0.15;

    ctx.fillStyle = rgbString(hslToRgb(sandHue - 10, 0.4, 0.2));
    ctx.beginPath();
    const topW = 8 + 6 * stream.next_f();
    const botW = 14 + 8 * stream.next_f();
    ctx.moveTo(x - botW / 2, baseY);
    ctx.lineTo(x + botW / 2, baseY);
    ctx.lineTo(x + topW / 2 + tilt * 40, baseY - trunkH);
    ctx.lineTo(x - topW / 2 + tilt * 40, baseY - trunkH);
    ctx.closePath();
    ctx.fill();

    const crownY = baseY - trunkH;
    const crownX = x + tilt * 50;
    const leafBlobs = stream.next_int(4, 8);
    const leafHue = 125 + stream.next_int(-15, 20);
    ctx.fillStyle = rgbString(hslToRgb(leafHue, 0.5, 0.15));
    for (let b = 0; b < leafBlobs; b++) {
      const ox = (stream.next_f() - 0.5) * 100;
      const oy = (stream.next_f() - 0.5) * 60;
      const r = 25 + 35 * stream.next_f();
      ctx.beginPath();
      ctx.arc(crownX + ox, crownY + oy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}
