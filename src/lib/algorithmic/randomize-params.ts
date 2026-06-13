import { QRNGStream } from "../qrng";
import {
  PALETTE_ORDER,
  PHILOSOPHIES,
  type AlgoParams,
  type PhilosophyId,
  type Palette,
  type FlowFieldParams,
  type WaveParams,
  type VoronoiParams,
  type LSystemParams,
  type CellularAutomataParams,
  type TruchetParams,
  type JuliaParams,
  type NewtonParams,
  type ApollonianParams,
} from "./types";

export interface RandomizeOptions {
  keepPhilosophy: boolean;
  keepPalette: boolean;
  currentPhilosophy: PhilosophyId;
  currentParams: AlgoParams;
  values: number[];
  /** Inkrementira se po kliku da svaki randomize ne čita iste QRNG vrednosti. */
  tick?: number;
}

function pickPalette(stream: QRNGStream, current: Palette): Palette {
  const idx = Math.floor(stream.next_f() * PALETTE_ORDER.length);
  return PALETTE_ORDER[idx] ?? current;
}

function randRange(stream: QRNGStream, min: number, max: number, step: number): number {
  const steps = Math.round((max - min) / step);
  const n = Math.floor(stream.next_f() * (steps + 1));
  return Math.round((min + n * step) * 1000) / 1000;
}

function randInt(stream: QRNGStream, min: number, max: number): number {
  return min + Math.floor(stream.next_f() * (max - min + 1));
}

function randomizeFlowField(
  stream: QRNGStream,
  current: FlowFieldParams,
  keepPalette: boolean
): FlowFieldParams {
  return {
    particles: randInt(stream, 200, 900),
    speed: randRange(stream, 0.8, 3.5, 0.1),
    trailWidth: randRange(stream, 0.8, 2.5, 0.1),
    trailAlpha: randRange(stream, 0.03, 0.12, 0.01),
    palette: keepPalette ? current.palette : pickPalette(stream, current.palette),
  };
}

function randomizeWave(stream: QRNGStream, current: WaveParams, keepPalette: boolean): WaveParams {
  return {
    waves: randInt(stream, 6, 20),
    amplitude: randRange(stream, 0.4, 0.95, 0.05),
    contrast: randRange(stream, 1.2, 2.8, 0.1),
    palette: keepPalette ? current.palette : pickPalette(stream, current.palette),
  };
}

function randomizeVoronoi(
  stream: QRNGStream,
  current: VoronoiParams,
  keepPalette: boolean
): VoronoiParams {
  return {
    cells: randInt(stream, 80, 320),
    borderWidth: randRange(stream, 0.5, 3, 0.5),
    palette: keepPalette ? current.palette : pickPalette(stream, current.palette),
  };
}

function randomizeLSystem(
  stream: QRNGStream,
  current: LSystemParams,
  keepPalette: boolean
): LSystemParams {
  return {
    depth: randInt(stream, 4, 7),
    angle: randInt(stream, 18, 40),
    lengthFactor: randRange(stream, 0.58, 0.82, 0.01),
    palette: keepPalette ? current.palette : pickPalette(stream, current.palette),
  };
}

function randomizeCellular(
  stream: QRNGStream,
  current: CellularAutomataParams,
  keepPalette: boolean
): CellularAutomataParams {
  return {
    rule: randInt(stream, 0, 255),
    cellSize: randInt(stream, 1, 3),
    palette: keepPalette ? current.palette : pickPalette(stream, current.palette),
  };
}

function randomizeTruchet(
  stream: QRNGStream,
  current: TruchetParams,
  keepPalette: boolean
): TruchetParams {
  return {
    tileSize: randInt(stream, 24, 64),
    lineWidth: randRange(stream, 2, 6, 0.5),
    palette: keepPalette ? current.palette : pickPalette(stream, current.palette),
  };
}

function randomizeJulia(
  stream: QRNGStream,
  current: JuliaParams,
  keepPalette: boolean
): JuliaParams {
  return {
    maxIter: randInt(stream, 80, 220),
    zoom: randRange(stream, 0.7, 2.5, 0.1),
    palette: keepPalette ? current.palette : pickPalette(stream, current.palette),
  };
}

function randomizeNewton(
  stream: QRNGStream,
  current: NewtonParams,
  keepPalette: boolean
): NewtonParams {
  return {
    degree: randInt(stream, 3, 6),
    maxIter: randInt(stream, 30, 100),
    zoom: randRange(stream, 0.8, 2.2, 0.1),
    palette: keepPalette ? current.palette : pickPalette(stream, current.palette),
  };
}

function randomizeApollonian(
  stream: QRNGStream,
  current: ApollonianParams,
  keepPalette: boolean
): ApollonianParams {
  return {
    maxCircles: randInt(stream, 1500, 6000),
    minRadiusPx: randRange(stream, 0.8, 2.5, 0.1),
    lineWidth: randRange(stream, 0.8, 1.6, 0.1),
    palette: keepPalette ? current.palette : pickPalette(stream, current.palette),
  };
}

export function randomizeParams(opts: RandomizeOptions): {
  philosophy: PhilosophyId;
  params: AlgoParams;
} {
  const tick = opts.tick ?? 0;
  const streamValues =
    tick > 0 ? deriveVariantValues(opts.values, tick) : opts.values;
  const stream = new QRNGStream(streamValues);
  const philosophy = opts.keepPhilosophy
    ? opts.currentPhilosophy
    : PHILOSOPHIES[Math.floor(stream.next_f() * PHILOSOPHIES.length)]!.id;

  const current = opts.currentParams;

  switch (philosophy) {
    case "flow-field":
      return {
        philosophy,
        params: randomizeFlowField(stream, current as FlowFieldParams, opts.keepPalette),
      };
    case "wave":
      return {
        philosophy,
        params: randomizeWave(stream, current as WaveParams, opts.keepPalette),
      };
    case "voronoi":
      return {
        philosophy,
        params: randomizeVoronoi(stream, current as VoronoiParams, opts.keepPalette),
      };
    case "l-system":
      return {
        philosophy,
        params: randomizeLSystem(stream, current as LSystemParams, opts.keepPalette),
      };
    case "cellular-automata":
      return {
        philosophy,
        params: randomizeCellular(stream, current as CellularAutomataParams, opts.keepPalette),
      };
    case "truchet":
      return {
        philosophy,
        params: randomizeTruchet(stream, current as TruchetParams, opts.keepPalette),
      };
    case "julia":
      return {
        philosophy,
        params: randomizeJulia(stream, current as JuliaParams, opts.keepPalette),
      };
    case "newton":
      return {
        philosophy,
        params: randomizeNewton(stream, current as NewtonParams, opts.keepPalette),
      };
    case "apollonian":
      return {
        philosophy,
        params: randomizeApollonian(stream, current as ApollonianParams, opts.keepPalette),
      };
  }
}

/** Derive a variant values array from base set (deterministic). */
export function deriveVariantValues(base: number[], variantIndex: number): number[] {
  const out = base.slice();
  const mix = ((variantIndex * 2654435761) >>> 0) & 0xffff;
  for (let i = 0; i < out.length; i++) {
    out[i] = ((out[i]! ^ mix ^ (i & 0xffff)) >>> 0) & 0xffff;
  }
  return out;
}
