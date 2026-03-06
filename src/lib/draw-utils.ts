/**
 * Shared drawing utilities — ridgePoints, drawSunGlow. Koristi se u scenarijima.
 */
import type { QRNGStream } from "./qrng";
import type { RGB } from "./color";
import { rgbString } from "./color";

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function ridgePoints(
  stream: QRNGStream,
  w: number,
  yBase: number,
  amplitude: number,
  roughness: number,
  step = 6,
  detailScale = 0.35,
  anchorStep = 50
): { x: number; y: number }[] {
  const anchors: number[] = [];
  const numAnchors = Math.floor(w / anchorStep) + 3;
  for (let i = 0; i < numAnchors; i++) {
    anchors.push(stream.next_f());
  }

  function smoothstep(t: number): number {
    return t * t * (3 - 2 * t);
  }

  const pts: { x: number; y: number }[] = [];
  for (let x = 0; x <= w + step; x += step) {
    const ai = Math.floor(x / anchorStep);
    const t = (x % anchorStep) / anchorStep;
    const v0 = anchors[ai % anchors.length]!;
    const v1 = anchors[(ai + 1) % anchors.length]!;
    let v = lerp(v0, v1, smoothstep(t));

    let detail = 0;
    if (detailScale > 0) {
      let octAmp = 0.45;
      for (let i = 0; i < 3; i++) {
        detail += (stream.next_f() - 0.5) * octAmp;
        octAmp *= roughness;
      }
    }
    const y = Math.floor(
      yBase - (v - 0.5) * amplitude + detail * amplitude * detailScale
    );
    pts.push({ x, y });
  }
  return pts;
}

export function drawSunGlow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  glowColor: RGB,
  coreColor: RGB,
  layers = 18,
  alphaBase = 10,
  alphaStep = 12,
  glowSpread = 0.18
): void {
  for (let k = layers; k >= 0; k--) {
    const rr = Math.floor(radius * (1 + k * glowSpread));
    const alpha = alphaBase + k * alphaStep;
    ctx.fillStyle = `rgba(${glowColor[0]},${glowColor[1]},${glowColor[2]},${alpha / 255})`;
    ctx.beginPath();
    ctx.arc(cx, cy, rr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = rgbString(coreColor);
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
}
