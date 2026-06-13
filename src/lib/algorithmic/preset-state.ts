import type { AlgoPreset } from "./preset-code";
import type {
  PhilosophyId,
  FlowFieldParams,
  WaveParams,
  VoronoiParams,
  LSystemParams,
  CellularAutomataParams,
  TruchetParams,
  JuliaParams,
  NewtonParams,
  ApollonianParams,
  AlgoParams,
} from "./types";
import {
  DEFAULT_FLOW_FIELD,
  DEFAULT_WAVE,
  DEFAULT_VORONOI,
  DEFAULT_L_SYSTEM,
  DEFAULT_CELLULAR,
  DEFAULT_TRUCHET,
  DEFAULT_JULIA,
  DEFAULT_NEWTON,
  DEFAULT_APOLLONIAN,
} from "./types";

export interface AlgoParamState {
  philosophy: PhilosophyId;
  ffParams: FlowFieldParams;
  waveParams: WaveParams;
  voronoiParams: VoronoiParams;
  lSystemParams: LSystemParams;
  cellularParams: CellularAutomataParams;
  truchetParams: TruchetParams;
  juliaParams: JuliaParams;
  newtonParams: NewtonParams;
  apollonianParams: ApollonianParams;
}

export function defaultParamState(philosophy: PhilosophyId = "flow-field"): AlgoParamState {
  return {
    philosophy,
    ffParams: { ...DEFAULT_FLOW_FIELD },
    waveParams: { ...DEFAULT_WAVE },
    voronoiParams: { ...DEFAULT_VORONOI },
    lSystemParams: { ...DEFAULT_L_SYSTEM },
    cellularParams: { ...DEFAULT_CELLULAR },
    truchetParams: { ...DEFAULT_TRUCHET },
    juliaParams: { ...DEFAULT_JULIA },
    newtonParams: { ...DEFAULT_NEWTON },
    apollonianParams: { ...DEFAULT_APOLLONIAN },
  };
}

export function getParamsFromState(state: AlgoParamState): AlgoParams {
  switch (state.philosophy) {
    case "flow-field":
      return state.ffParams;
    case "wave":
      return state.waveParams;
    case "voronoi":
      return state.voronoiParams;
    case "l-system":
      return state.lSystemParams;
    case "cellular-automata":
      return state.cellularParams;
    case "truchet":
      return state.truchetParams;
    case "julia":
      return state.juliaParams;
    case "newton":
      return state.newtonParams;
    case "apollonian":
      return state.apollonianParams;
  }
}

export function applyPresetToState(preset: AlgoPreset): AlgoParamState {
  const base = defaultParamState(preset.philosophy);
  switch (preset.philosophy) {
    case "flow-field":
      return { ...base, ffParams: preset.params as FlowFieldParams };
    case "wave":
      return { ...base, waveParams: preset.params as WaveParams };
    case "voronoi":
      return { ...base, voronoiParams: preset.params as VoronoiParams };
    case "l-system":
      return { ...base, lSystemParams: preset.params as LSystemParams };
    case "cellular-automata":
      return { ...base, cellularParams: preset.params as CellularAutomataParams };
    case "truchet":
      return { ...base, truchetParams: preset.params as TruchetParams };
    case "julia":
      return { ...base, juliaParams: preset.params as JuliaParams };
    case "newton":
      return { ...base, newtonParams: preset.params as NewtonParams };
    case "apollonian":
      return { ...base, apollonianParams: preset.params as ApollonianParams };
  }
}

export function applyParamsToPhilosophy(
  philosophy: PhilosophyId,
  params: AlgoParams,
  prev: AlgoParamState
): AlgoParamState {
  const next = { ...prev, philosophy };
  switch (philosophy) {
    case "flow-field":
      return { ...next, ffParams: params as FlowFieldParams };
    case "wave":
      return { ...next, waveParams: params as WaveParams };
    case "voronoi":
      return { ...next, voronoiParams: params as VoronoiParams };
    case "l-system":
      return { ...next, lSystemParams: params as LSystemParams };
    case "cellular-automata":
      return { ...next, cellularParams: params as CellularAutomataParams };
    case "truchet":
      return { ...next, truchetParams: params as TruchetParams };
    case "julia":
      return { ...next, juliaParams: params as JuliaParams };
    case "newton":
      return { ...next, newtonParams: params as NewtonParams };
    case "apollonian":
      return { ...next, apollonianParams: params as ApollonianParams };
  }
}
