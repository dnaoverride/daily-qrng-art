/**
 * Noćni grad — zgrade kao siluete, zvezde, mesec, prozori.
 */
import type { QRNGStream } from "../qrng";
import { hslToRgb, rgbString, type RGB } from "../color";
import { drawSunGlow } from "../draw-utils";

export function renderCityNight(
  ctx: CanvasRenderingContext2D,
  stream: QRNGStream,
  w: number,
  h: number
): void {
  const horizonY = Math.floor(h * (0.6 + 0.15 * stream.next_f()));

  const skyTop = hslToRgb(235 + stream.next_int(0, 25), 0.5, 0.1);
  const skyBot = hslToRgb(245 + stream.next_int(0, 20), 0.55, 0.16);
  const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
  skyGrad.addColorStop(0, rgbString(skyTop));
  skyGrad.addColorStop(1, rgbString(skyBot));
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, w, horizonY);

  const groundColor = hslToRgb(230, 0.3, 0.05);
  ctx.fillStyle = rgbString(groundColor);
  ctx.fillRect(0, horizonY, w, h - horizonY);

  const stars = stream.next_int(250, 400);
  for (let i = 0; i < stars; i++) {
    const x = stream.next_int(0, w - 1);
    const y = stream.next_int(0, Math.floor(horizonY * 0.9));
    const b = stream.next_int(150, 255);
    const r = stream.next_f() < 0.9 ? 1 : 2;
    ctx.fillStyle = `rgb(${b},${b},${b})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const moonX = Math.floor(w * (0.65 + 0.25 * stream.next_f()));
  const moonY = Math.floor(horizonY * (0.2 + 0.25 * stream.next_f()));
  const moonR = Math.floor(22 + 18 * stream.next_f());
  const glowColor: RGB = [240, 245, 255];
  const coreColor: RGB = [250, 252, 255];
  drawSunGlow(ctx, moonX, moonY, moonR, glowColor, coreColor, 10);

  const buildingColor = hslToRgb(220 + stream.next_int(-10, 15), 0.4, 0.06);
  ctx.fillStyle = rgbString(buildingColor);

  const numBuildings = stream.next_int(8, 20);
  let xPos = -20;
  const buildingRects: { x: number; y: number; w: number; h: number }[] = [];

  while (xPos < w + 50) {
    const bw = stream.next_int(25, 80);
    const bh = stream.next_int(Math.floor(h * 0.2), Math.floor(h * 0.7));
    const by = horizonY + (h - horizonY) - bh;
    buildingRects.push({ x: xPos, y: by, w: bw, h: bh });
    ctx.fillRect(xPos, by, bw, bh);
    xPos += bw + stream.next_int(5, 25);
  }

  const windowCount = stream.next_int(15, 40);
  ctx.fillStyle = "rgba(255, 248, 200, 0.9)";
  for (let i = 0; i < windowCount && buildingRects.length > 0; i++) {
    const rect = buildingRects[stream.next_int(0, buildingRects.length - 1)]!;
    const wx = rect.x + stream.next_int(4, Math.max(5, rect.w - 12));
    const wy = rect.y + stream.next_int(8, Math.max(10, rect.h - 20));
    const wr = stream.next_f() < 0.7 ? 2 : 3;
    ctx.beginPath();
    ctx.arc(wx, wy, wr, 0, Math.PI * 2);
    ctx.fill();
  }
}
