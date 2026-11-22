import type { PhilosophyId } from "@/lib/algorithmic/types";

/** Klizači po algoritmu (opsezi isti kao u starom /algorithmic). Labela = ključ u messages → algorithmic.* */
export interface SliderSpec {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  decimals?: number;
}

export const SLIDERS: Record<PhilosophyId, SliderSpec[]> = {
  "flow-field": [
    { key: "particles", label: "particles", min: 100, max: 1000, step: 50 },
    { key: "speed", label: "speed", min: 0.5, max: 4, step: 0.1, decimals: 1 },
    { key: "trailWidth", label: "trailWidth", min: 0.5, max: 3, step: 0.1, decimals: 1 },
    { key: "trailAlpha", label: "trailAlpha", min: 0.01, max: 0.15, step: 0.01, decimals: 2 },
  ],
  wave: [
    { key: "waves", label: "waves", min: 4, max: 24, step: 1 },
    { key: "amplitude", label: "amplitude", min: 0.3, max: 1, step: 0.05, decimals: 2 },
    { key: "contrast", label: "contrast", min: 1, max: 3, step: 0.1, decimals: 1 },
  ],
  voronoi: [
    { key: "cells", label: "cells", min: 20, max: 400, step: 10 },
    { key: "borderWidth", label: "borderWidth", min: 0, max: 4, step: 0.5, decimals: 1 },
  ],
  "l-system": [
    { key: "depth", label: "lsDepth", min: 3, max: 7, step: 1 },
    { key: "angle", label: "lsAngle", min: 15, max: 45, step: 1 },
    { key: "lengthFactor", label: "lsLengthFactor", min: 0.5, max: 0.85, step: 0.01, decimals: 2 },
  ],
  "cellular-automata": [
    { key: "rule", label: "caRule", min: 0, max: 255, step: 1 },
    { key: "cellSize", label: "caCellSize", min: 1, max: 4, step: 1 },
  ],
  truchet: [
    { key: "tileSize", label: "trTileSize", min: 20, max: 80, step: 5 },
    { key: "lineWidth", label: "trLineWidth", min: 1, max: 8, step: 0.5, decimals: 1 },
  ],
  julia: [
    { key: "maxIter", label: "juliaMaxIter", min: 50, max: 300, step: 10 },
    { key: "zoom", label: "juliaZoom", min: 0.5, max: 3, step: 0.1, decimals: 1 },
  ],
  newton: [
    { key: "degree", label: "newtonDegree", min: 3, max: 7, step: 1 },
    { key: "maxIter", label: "newtonMaxIter", min: 20, max: 150, step: 5 },
    { key: "zoom", label: "newtonZoom", min: 0.5, max: 3, step: 0.1, decimals: 1 },
  ],
  apollonian: [
    { key: "maxCircles", label: "apollonianMaxCircles", min: 500, max: 8000, step: 100 },
    { key: "minRadiusPx", label: "apollonianMinRadius", min: 0.5, max: 4, step: 0.1, decimals: 1 },
    { key: "lineWidth", label: "apollonianLineWidth", min: 0.5, max: 2, step: 0.1, decimals: 1 },
  ],
};

export const PALETTE_LABEL_KEY: Record<string, string> = {
  quantum: "paletteQuantum",
  warm: "paletteWarm",
  cool: "paletteCool",
  mono: "paletteMono",
  sunset: "paletteSunset",
  neon: "paletteNeon",
  forest: "paletteForest",
  ocean: "paletteOcean",
  aurora: "paletteAurora",
  ember: "paletteEmber",
};
