/**
 * Pustinja — dune, toplo nebo, minimalno.
 */
import type { QRNGStream } from "../qrng";
import { hslToRgb, rgbString, type RGB } from "../color";
import { ridgePoints, drawSunGlow, fillStrokeEllipse } from "../draw-utils";

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
  const sunR = Math.floor(22 + 14 * stream.next_f());
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

  if (stream.next_f() < 0.45) {
    const vegType: "cactus" | "palm" =
      stream.next_f() < 0.7 ? "cactus" : "palm";
    ctx.save();
    ctx.globalAlpha = 0.9;

    if (vegType === "cactus") {
      const numCacti = stream.next_int(1, 3);
      const cactusHue = 110 + stream.next_int(-15, 25);
      for (let c = 0; c < numCacti; c++) {
        const cx = stream.next_int(50, w - 50);
        const baseY =
          horizonY +
          Math.floor((h - horizonY) * (0.5 + 0.35 * stream.next_f()));
        const segments = 2 + stream.next_int(0, 2);
        const segH = 25 + 25 * stream.next_f();
        let y = baseY;
        for (let s = 0; s < segments; s++) {
          const segW = 12 + 10 * stream.next_f();
          const segCol = hslToRgb(
            cactusHue,
            0.45,
            0.28 + 0.1 * stream.next_f()
          );
          fillStrokeEllipse(
            ctx,
            cx,
            y - segH / 2,
            Math.max(0.5, segW / 2),
            Math.max(0.5, segH / 2),
            rgbString(segCol),
            rgbString(hslToRgb(cactusHue, 0.4, 0.18)),
            1
          );
          y -= segH;
        }
      }
    } else {
      const px = stream.next_int(80, w - 80);
      const baseY =
        horizonY +
        Math.floor((h - horizonY) * (0.55 + 0.3 * stream.next_f()));
      const trunkH = stream.next_int(50, 90);
      const trunkW = 6 + 4 * stream.next_f();
      ctx.fillStyle = rgbString(hslToRgb(sandHue - 12, 0.35, 0.16));
      ctx.beginPath();
      ctx.moveTo(px - trunkW / 2, baseY);
      ctx.lineTo(px + trunkW / 2, baseY);
      ctx.lineTo(px + trunkW / 3, baseY - trunkH);
      ctx.lineTo(px - trunkW / 3, baseY - trunkH);
      ctx.closePath();
      ctx.fill();
      const crownX = px;
      const crownY = baseY - trunkH;
      const leafHue = 115 + stream.next_int(-10, 20);
      const numFronds = 5 + stream.next_int(0, 3);
      for (let i = 0; i < numFronds; i++) {
        const angle = (2 * Math.PI * i) / numFronds + (stream.next_f() - 0.5) * 0.3;
        const len = 25 + 15 * stream.next_f();
        const tipX = crownX + len * 0.7 * Math.sin(angle);
        const tipY = crownY + len * Math.cos(angle);
        ctx.strokeStyle = rgbString(
          hslToRgb((leafHue + stream.next_int(-5, 10)) % 360, 0.5, 0.2)
        );
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(crownX, crownY);
        ctx.lineTo(tipX, tipY);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}
