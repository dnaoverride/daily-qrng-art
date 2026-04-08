/**
 * Shared drawing utilities — ridgePoints, drawSunGlow. Koristi se u scenarijima.
 */
import type { QRNGStream } from "./qrng";
import type { RGB } from "./color";
import { rgbString } from "./color";

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Elipsa preko scale+arc — pouzdanije od ctx.ellipse na nekim Node/Skia canvas backendima. */
export function fillStrokeEllipse(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  fillStyle: string,
  strokeStyle: string,
  lineWidthDevicePx: number
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(rx, ry);
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.fillStyle = fillStyle;
  ctx.fill();
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = lineWidthDevicePx / Math.max(rx, ry);
  ctx.stroke();
  ctx.restore();
}

/** Širina po kojoj ridgePoints troši QRNG — mora biti ista bez obzira na stvarno `w` da bi thumb (npr. 600px) i puni canvas (1200px) davali istu sliku. */
const RIDGE_STREAM_W = 1200;

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
  const streamW = RIDGE_STREAM_W;
  const anchors: number[] = [];
  const numAnchors = Math.floor(streamW / anchorStep) + 3;
  for (let i = 0; i < numAnchors; i++) {
    anchors.push(stream.next_f());
  }

  function smoothstep(t: number): number {
    return t * t * (3 - 2 * t);
  }

  const pts: { x: number; y: number }[] = [];
  for (let x = 0; x <= streamW + step; x += step) {
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
    const outX = Math.min(w, Math.floor((x * w) / streamW));
    pts.push({ x: outX, y });
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
