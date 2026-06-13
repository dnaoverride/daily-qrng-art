import type { PhilosophyId, AlgoParams, FlowFieldParams } from "./types";
import {
  initFlowField,
  drawFlowFieldFrame,
  initFlowFieldCanvas,
  type FlowFieldState,
} from "./flow-field";
import { renderWaveInterference } from "./wave-interference";
import { renderVoronoi } from "./voronoi";
import { renderLSystem } from "./l-system";
import { renderCellularAutomata } from "./cellular-automata";
import { renderTruchet } from "./truchet";
import { renderJulia } from "./julia";
import { renderNewton } from "./newton";
import { renderApollonian } from "./apollonian";

export const DEFAULT_ALGO_W = 1200;
export const DEFAULT_ALGO_H = 675;

export interface RenderOptions {
  width?: number;
  height?: number;
  /** Flow-field: number of animation frames before capture (static snapshot). */
  flowFieldWarmupFrames?: number;
  /** Flow-field loop phase 0..1 for deterministic animation frame. */
  loopPhase?: number;
}

function scaleCtx(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  w: number,
  h: number
): void {
  const sx = w / DEFAULT_ALGO_W;
  const sy = h / DEFAULT_ALGO_H;
  if (sx !== 1 || sy !== 1) {
    ctx.scale(sx, sy);
  }
}

export function renderAlgorithmicToContext(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  philosophy: PhilosophyId,
  values: number[],
  params: AlgoParams,
  opts: RenderOptions = {}
): void {
  const w = opts.width ?? DEFAULT_ALGO_W;
  const h = opts.height ?? DEFAULT_ALGO_H;

  ctx.save();
  scaleCtx(ctx, w, h);

  switch (philosophy) {
    case "flow-field": {
      const ffParams = params as FlowFieldParams;
      const state = initFlowField(values, ffParams, opts.loopPhase ?? 0);
      initFlowFieldCanvas(ctx, DEFAULT_ALGO_W, DEFAULT_ALGO_H);
      const frames = opts.flowFieldWarmupFrames ?? 120;
      for (let i = 0; i < frames; i++) {
        const phase =
          opts.loopPhase !== undefined
            ? (opts.loopPhase + i / frames) % 1
            : undefined;
        drawFlowFieldFrame(ctx, state, DEFAULT_ALGO_W, DEFAULT_ALGO_H, phase);
      }
      break;
    }
    case "wave":
      renderWaveInterference(ctx, values, params as Parameters<typeof renderWaveInterference>[2]);
      break;
    case "voronoi":
      renderVoronoi(ctx, values, params as Parameters<typeof renderVoronoi>[2]);
      break;
    case "l-system":
      renderLSystem(ctx, values, params as Parameters<typeof renderLSystem>[2]);
      break;
    case "cellular-automata":
      renderCellularAutomata(
        ctx,
        values,
        params as Parameters<typeof renderCellularAutomata>[2]
      );
      break;
    case "truchet":
      renderTruchet(ctx, values, params as Parameters<typeof renderTruchet>[2]);
      break;
    case "julia":
      renderJulia(ctx, values, params as Parameters<typeof renderJulia>[2]);
      break;
    case "newton":
      renderNewton(ctx, values, params as Parameters<typeof renderNewton>[2]);
      break;
    case "apollonian":
      renderApollonian(ctx, values, params as Parameters<typeof renderApollonian>[2]);
      break;
  }

  ctx.restore();
}

export function createOffscreenCanvas(w: number, h: number): HTMLCanvasElement | OffscreenCanvas {
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(w, h);
  }
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

export function renderAlgorithmicToCanvas(
  philosophy: PhilosophyId,
  values: number[],
  params: AlgoParams,
  width: number,
  height: number,
  opts: Omit<RenderOptions, "width" | "height"> = {}
): HTMLCanvasElement | OffscreenCanvas {
  const canvas = createOffscreenCanvas(width, height);
  const ctx =
    "getContext" in canvas
      ? (canvas as HTMLCanvasElement).getContext("2d")
      : (canvas as OffscreenCanvas).getContext("2d");
  if (!ctx) throw new Error("Canvas 2D unavailable");
  renderAlgorithmicToContext(ctx, philosophy, values, params, {
    ...opts,
    width,
    height,
  });
  return canvas;
}

export function renderFlowFieldLoopFrame(
  state: FlowFieldState,
  ctx: CanvasRenderingContext2D,
  loopPhase: number,
  w = DEFAULT_ALGO_W,
  h = DEFAULT_ALGO_H
): void {
  drawFlowFieldFrame(ctx, state, w, h, loopPhase);
}
