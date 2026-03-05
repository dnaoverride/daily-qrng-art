/**
 * Forest scenario — siluete drveća na sumrak/rano jutro.
 * Landscape nivo: tamne krošnje od 6-12 blobova, 3 sloja dubine, poboljšane light rays.
 */
import type { QRNGStream } from "../qrng";
import { hslToRgb, rgbString, type RGB } from "../color";
import { drawSunGlow } from "../draw-utils";

export function renderForest(
  ctx: CanvasRenderingContext2D,
  stream: QRNGStream,
  w: number,
  h: number
): void {
  const isNight = stream.next_f() < 0.25;
  const baseHueRoll = stream.next_f();
  const greenHue = 100 + stream.next_int(0, 50);
  const skyHue = isNight ? 235 + stream.next_int(0, 25) : baseHueRoll < 0.5 ? 200 + stream.next_int(0, 40) : 25 + stream.next_int(0, 35);
  const accentHue = (skyHue + 40) % 360;
  const horizonY = Math.floor(h * (0.35 + 0.15 * stream.next_f()));

  const skyTop = hslToRgb(skyHue, 0.45, isNight ? 0.15 : baseHueRoll < 0.5 ? 0.6 : 0.55);
  const skyMid = hslToRgb(accentHue, isNight ? 0.4 : 0.5, isNight ? 0.12 : 0.48);
  const skyBot = hslToRgb(skyHue + 10, 0.35, isNight ? 0.1 : 0.4);
  const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
  skyGrad.addColorStop(0, rgbString(skyTop));
  skyGrad.addColorStop(0.45, rgbString(skyMid));
  skyGrad.addColorStop(1, rgbString(skyBot));
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, w, horizonY);

  const sunX = Math.floor(w * (0.2 + 0.6 * stream.next_f()));
  const sunY = Math.floor(horizonY * (0.15 + 0.3 * stream.next_f()));
  const sunR = Math.floor(30 + 45 * stream.next_f());
  const glowColor: RGB = isNight ? [235, 240, 255] : [255, 240, 200];
  const coreColor: RGB = isNight ? [245, 248, 255] : [255, 250, 230];
  drawSunGlow(ctx, sunX, sunY, sunR, glowColor, coreColor, isNight ? 10 : 16);

  if (isNight) {
    const stars = stream.next_int(200, 400);
    for (let i = 0; i < stars; i++) {
      const sx = stream.next_int(0, w - 1);
      const sy = stream.next_int(0, Math.floor(horizonY * 0.9));
      const sb = stream.next_int(140, 255);
      const sr = stream.next_f() < 0.9 ? 1 : 2;
      ctx.fillStyle = `rgb(${sb},${sb},${sb})`;
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.save();
    ctx.strokeStyle = "rgba(180,175,200,0.5)";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    if (stream.next_f() < 0.5) {
      const numOwls = stream.next_int(1, 2);
      for (let i = 0; i < numOwls; i++) {
        const ox = stream.next_int(80, w - 80);
        const oy = stream.next_int(50, Math.floor(horizonY * 0.7));
        const span = 18 + 12 * stream.next_f();
        const wingUp = stream.next_f() < 0.5;
        ctx.beginPath();
        ctx.arc(ox, oy - 4, 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(ox - span, oy);
        ctx.quadraticCurveTo(ox, oy + (wingUp ? -10 : 8), ox + span, oy);
        ctx.stroke();
      }
    } else {
      const numBats = stream.next_int(1, 3);
      for (let i = 0; i < numBats; i++) {
        const bx = stream.next_int(80, w - 80);
        const by = stream.next_int(50, Math.floor(horizonY * 0.7));
        const span = 20 + 20 * stream.next_f();
        const wingUp = stream.next_f() < 0.5;
        ctx.beginPath();
        ctx.moveTo(bx - span, by);
        ctx.quadraticCurveTo(bx, by + (wingUp ? -12 : 10), bx + span, by);
        ctx.stroke();
      }
    }
    ctx.restore();
  } else {
    const numBirds = stream.next_int(1, 4);
    ctx.save();
    ctx.strokeStyle = "rgba(60,50,40,0.6)";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    for (let i = 0; i < numBirds; i++) {
      const bx = stream.next_int(60, w - 60);
      const by = stream.next_int(40, Math.floor(horizonY * 0.8));
      const span = 12 + 14 * stream.next_f();
      const wingUp = stream.next_f() < 0.5;
      ctx.beginPath();
      ctx.moveTo(bx - span, by);
      ctx.quadraticCurveTo(bx, by + (wingUp ? -8 : 6), bx + span, by);
      ctx.stroke();
    }
    ctx.restore();

    const lightRays = stream.next_int(6, 14);
    ctx.save();
    ctx.globalAlpha = 0.04 + 0.06 * stream.next_f();
    for (let i = 0; i < lightRays; i++) {
    const angle = -0.4 + 0.8 * stream.next_f();
    const x = w * (0.1 + 0.8 * stream.next_f());
    const grad = ctx.createLinearGradient(x, 0, x + Math.cos(angle) * w * 1.2, h);
    grad.addColorStop(0, "rgba(255,255,245,0.25)");
    grad.addColorStop(0.4, "rgba(255,255,245,0.08)");
    grad.addColorStop(1, "rgba(255,255,245,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.restore();
  }

  const grassHue = 95 + stream.next_int(0, 35);
  const groundDark = hslToRgb(grassHue, 0.5, 0.12);
  const groundMid = hslToRgb(grassHue + 8, 0.45, 0.18);
  const groundLight = hslToRgb(grassHue + 15, 0.4, 0.26);
  const groundGrad = ctx.createLinearGradient(0, horizonY, 0, h);
  groundGrad.addColorStop(0, rgbString(groundMid));
  groundGrad.addColorStop(0.5, rgbString(groundDark));
  groundGrad.addColorStop(1, rgbString(groundLight));
  ctx.fillStyle = groundGrad;
  ctx.fillRect(0, horizonY, w, h - horizonY);

  const layers = [
    { count: stream.next_int(6, 12), scale: 0.35, yRange: 0.15, alpha: 0.75 },
    { count: stream.next_int(8, 14), scale: 0.65, yRange: 0.28, alpha: 0.92 },
    { count: stream.next_int(6, 12), scale: 1.0, yRange: 0.45, alpha: 1.0 },
  ];

  for (const layer of layers) {
    ctx.save();
    ctx.globalAlpha = layer.alpha;

    for (let i = 0; i < layer.count; i++) {
      const x = stream.next_int(-80, w + 80);
      const baseY =
        horizonY +
        stream.next_int(0, Math.floor((h - horizonY) * layer.yRange));
      const trunkH = Math.floor((70 + 90 * stream.next_f()) * layer.scale);
      const trunkW = Math.max(5, Math.floor(12 * layer.scale));

      const trunkTopY = baseY - trunkH;
      const trunkHue = 25 + stream.next_int(0, 25);
      const trunkColor = hslToRgb(trunkHue, 0.4, 0.22 + 0.1 * layer.scale);
      ctx.fillStyle = rgbString(trunkColor);
      ctx.fillRect(x - trunkW / 2, trunkTopY, trunkW, trunkH);

      const crownBaseY = trunkTopY - stream.next_int(0, Math.floor(15 * layer.scale));
      const crownBaseX = x;
      const blobs = stream.next_int(6, 12);
      const crownHue = greenHue + stream.next_int(-15, 25);

      for (let b = 0; b < blobs; b++) {
        const ox = (stream.next_f() - 0.5) * 150 * layer.scale;
        const oy = (stream.next_f() - 0.5) * 90 * layer.scale;
        const r = (20 + 55 * stream.next_f()) * layer.scale;
        const blobHue = crownHue + stream.next_int(-10, 15);
        const blobSat = 0.4 + 0.25 * stream.next_f();
        const blobLight = 0.18 + 0.2 * stream.next_f();
        ctx.fillStyle = rgbString(hslToRgb(blobHue, blobSat, blobLight));
        ctx.beginPath();
        ctx.arc(crownBaseX + ox, crownBaseY + oy, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  if (!isNight && stream.next_f() < 0.5) {
    const sqX = stream.next_int(80, w - 80);
    const sqY = horizonY + Math.floor((h - horizonY) * (0.4 + 0.35 * stream.next_f()));
    ctx.fillStyle = rgbString(hslToRgb(28 + stream.next_int(0, 15), 0.45, 0.28));
    ctx.beginPath();
    ctx.ellipse(sqX, sqY, 14, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(sqX + 12, sqY - 4, 10, 6, 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
}
