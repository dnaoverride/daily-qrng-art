/**
 * L-system inspirisano rekurzivno grananje za drveće.
 * Koristi QRNG za determinističke parametre.
 */
import type { QRNGStream } from "./qrng";
import { hslToRgb, rgbString } from "./color";

const DEG = Math.PI / 180;

export interface RecursiveBranchParams {
  angleSpread: number;
  angleSpreadRandom: number;
  lengthRatio: number;
  lengthRatioRandom: number;
  branchCountMin: number;
  branchCountMax: number;
  directionBias: number;
  lineWidthBase: number;
  lineWidthTip: number;
}

export function drawRecursiveBranch(
  ctx: CanvasRenderingContext2D,
  stream: QRNGStream,
  x: number,
  y: number,
  angle: number,
  length: number,
  depth: number,
  maxDepth: number,
  params: RecursiveBranchParams,
  baseHue: number,
  /** Kad je dat: trunkLean > 0 = stablo naginje desno; grane idu levo. Koristi se samo na top-level (depth===maxDepth). */
  avoidTrunkSide?: number
): void {
  if (depth <= 0 || length < 2) return;

  let drawAngle = angle;
  if (avoidTrunkSide !== undefined && depth === maxDepth && Math.abs(avoidTrunkSide) > 0.05) {
    drawAngle = angle + avoidTrunkSide * 0.55;
  }
  const tipX = x + Math.cos(drawAngle) * length;
  const tipY = y + Math.sin(drawAngle) * length;

  const depthFactor = 1 - depth / maxDepth;
  const lineWidth =
    params.lineWidthBase * (1 - depthFactor) + params.lineWidthTip * depthFactor;
  const branchHue = baseHue + stream.next_int(-6, 10);
  const branchLight = 0.2 + 0.12 * depthFactor + 0.08 * stream.next_f();
  ctx.strokeStyle = rgbString(hslToRgb(branchHue, 0.45, branchLight));
  ctx.lineWidth = Math.max(0.8, lineWidth);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const useCurve = stream.next_f() < 0.4;
  ctx.beginPath();
  ctx.moveTo(x, y);
  if (useCurve && length > 8) {
    const cpOffset = length * (0.3 + 0.3 * stream.next_f());
    const cpX = (x + tipX) / 2 + Math.cos(drawAngle + Math.PI / 2) * cpOffset * (stream.next_f() - 0.5) * 2;
    const cpY = (y + tipY) / 2 + Math.sin(drawAngle + Math.PI / 2) * cpOffset * (stream.next_f() - 0.5) * 2;
    ctx.quadraticCurveTo(cpX, cpY, tipX, tipY);
  } else {
    ctx.lineTo(tipX, tipY);
  }
  ctx.stroke();

  if (depth <= 1) return;

  const branchCount = stream.next_int(params.branchCountMin, params.branchCountMax);
  const lengthRatio =
    params.lengthRatio + (stream.next_f() - 0.5) * params.lengthRatioRandom;
  const angleSpread =
    params.angleSpread + (stream.next_f() - 0.5) * params.angleSpreadRandom;

  for (let i = 0; i < branchCount; i++) {
    const bias = (stream.next_f() - 0.5) * 2 * params.directionBias;
    const side = i % 2 === 0 ? 1 : -1;
    const childAngle = drawAngle + side * angleSpread * (0.7 + 0.6 * stream.next_f()) + bias * DEG * 30;
    const childLength = length * lengthRatio * (0.75 + 0.5 * stream.next_f());
    drawRecursiveBranch(
      ctx,
      stream,
      tipX,
      tipY,
      childAngle,
      childLength,
      depth - 1,
      maxDepth,
      params,
      baseHue
    );
  }
}

export const DECIDUOUS_PARAMS: RecursiveBranchParams = {
  angleSpread: 35 * DEG,
  angleSpreadRandom: 20 * DEG,
  lengthRatio: 0.7,
  lengthRatioRandom: 0.18,
  branchCountMin: 2,
  branchCountMax: 4,
  directionBias: 0,
  lineWidthBase: 3.2,
  lineWidthTip: 1.1,
};
