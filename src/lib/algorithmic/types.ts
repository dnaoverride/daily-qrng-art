/** Redosled u UI padajućeg menija */
export const PALETTE_ORDER = [
  "quantum",
  "warm",
  "cool",
  "mono",
  "sunset",
  "neon",
  "forest",
  "ocean",
  "aurora",
  "ember",
] as const;

export type Palette = (typeof PALETTE_ORDER)[number];

export interface FlowFieldParams {
  particles: number;   // 200 – 1000
  speed: number;       // 0.5 – 4.0
  trailWidth: number;  // 0.5 – 3.0
  trailAlpha: number;  // 0.02 – 0.15
  palette: Palette;
}

export interface WaveParams {
  waves: number;       // 4 – 24
  amplitude: number;   // 0.3 – 1.0
  contrast: number;    // 1.0 – 3.0
  palette: Palette;
}

export interface VoronoiParams {
  cells: number;       // 50 – 400
  borderWidth: number; // 0 – 4
  palette: Palette;
}

export interface LSystemParams {
  depth: number;       // 3 – 8
  angle: number;       // 15 – 45 (degrees)
  lengthFactor: number; // 0.5 – 0.85
  palette: Palette;
}

export interface CellularAutomataParams {
  rule: number;        // 0 – 255 (elementarni CA rule)
  cellSize: number;    // 1 – 4 px
  palette: Palette;
}

export interface TruchetParams {
  tileSize: number;    // 20 – 80 px
  lineWidth: number;   // 1 – 8
  palette: Palette;
}

export interface JuliaParams {
  maxIter: number;     // 50 – 300
  zoom: number;        // 0.5 – 3.0
  palette: Palette;
}

export interface NewtonParams {
  degree: number;   // 3 – 7 (stepen polinoma = broj korena = broj boja)
  maxIter: number;  // 20 – 150
  zoom: number;     // 0.5 – 3.0
  palette: Palette;
}

export interface ApollonianParams {
  maxCircles: number;   // 500 – 8000
  minRadiusPx: number; // 0.5 – 4
  lineWidth: number;   // 0.5 – 2
  palette: Palette;
}

export type AlgoParams =
  | FlowFieldParams
  | WaveParams
  | VoronoiParams
  | LSystemParams
  | CellularAutomataParams
  | TruchetParams
  | JuliaParams
  | NewtonParams
  | ApollonianParams;

export type PhilosophyId =
  | "flow-field"
  | "wave"
  | "voronoi"
  | "l-system"
  | "cellular-automata"
  | "truchet"
  | "julia"
  | "newton"
  | "apollonian";

export interface Philosophy {
  id: PhilosophyId;
  labelKey: string;
  defaultParams: AlgoParams;
}

export const DEFAULT_FLOW_FIELD: FlowFieldParams = {
  particles: 600,
  speed: 1.5,
  trailWidth: 1.2,
  trailAlpha: 0.06,
  palette: "quantum",
};

export const DEFAULT_WAVE: WaveParams = {
  waves: 12,
  amplitude: 0.7,
  contrast: 2.0,
  palette: "cool",
};

export const DEFAULT_VORONOI: VoronoiParams = {
  cells: 200,
  borderWidth: 1.5,
  palette: "quantum",
};

export const DEFAULT_L_SYSTEM: LSystemParams = {
  depth: 6,
  angle: 25,
  lengthFactor: 0.72,
  palette: "warm",
};

export const DEFAULT_CELLULAR: CellularAutomataParams = {
  rule: 110,
  cellSize: 2,
  palette: "cool",
};

export const DEFAULT_TRUCHET: TruchetParams = {
  tileSize: 40,
  lineWidth: 3,
  palette: "quantum",
};

export const DEFAULT_JULIA: JuliaParams = {
  maxIter: 150,
  zoom: 1.0,
  palette: "quantum",
};

export const DEFAULT_NEWTON: NewtonParams = {
  degree: 4,
  maxIter: 60,
  zoom: 1.2,
  palette: "quantum",
};

export const DEFAULT_APOLLONIAN: ApollonianParams = {
  maxCircles: 3500,
  minRadiusPx: 1.2,
  lineWidth: 1,
  palette: "quantum",
};

export const PHILOSOPHIES: Philosophy[] = [
  { id: "flow-field",        labelKey: "flowField",       defaultParams: DEFAULT_FLOW_FIELD },
  { id: "wave",              labelKey: "wave",             defaultParams: DEFAULT_WAVE },
  { id: "voronoi",           labelKey: "voronoi",          defaultParams: DEFAULT_VORONOI },
  { id: "l-system",          labelKey: "lSystem",          defaultParams: DEFAULT_L_SYSTEM },
  { id: "cellular-automata", labelKey: "cellularAutomata", defaultParams: DEFAULT_CELLULAR },
  { id: "truchet",           labelKey: "truchet",          defaultParams: DEFAULT_TRUCHET },
  { id: "julia",             labelKey: "julia",            defaultParams: DEFAULT_JULIA },
  { id: "newton",            labelKey: "newton",           defaultParams: DEFAULT_NEWTON },
  { id: "apollonian",        labelKey: "apollonian",       defaultParams: DEFAULT_APOLLONIAN },
];

/** Paleta → RGBA boje koje scenariji koriste */
export type RGBA = [number, number, number, number];

export function getPaletteColors(palette: Palette): RGBA[] {
  switch (palette) {
    case "warm":
      return [
        [255, 80, 30, 255],
        [255, 160, 50, 255],
        [220, 60, 100, 255],
        [255, 200, 100, 255],
        [180, 40, 60, 255],
      ];
    case "cool":
      return [
        [30, 100, 220, 255],
        [60, 200, 255, 255],
        [100, 50, 200, 255],
        [20, 180, 160, 255],
        [80, 130, 240, 255],
      ];
    case "mono":
      return [
        [240, 240, 240, 255],
        [180, 180, 180, 255],
        [120, 120, 120, 255],
        [60, 60, 60, 255],
        [255, 255, 255, 255],
      ];
    case "sunset":
      return [
        [255, 94, 77, 255],
        [255, 154, 0, 255],
        [255, 61, 127, 255],
        [255, 206, 84, 255],
        [199, 36, 177, 255],
      ];
    case "neon":
      return [
        [0, 255, 247, 255],
        [255, 0, 222, 255],
        [57, 255, 20, 255],
        [255, 252, 49, 255],
        [191, 0, 255, 255],
      ];
    case "forest":
      return [
        [34, 139, 34, 255],
        [107, 142, 35, 255],
        [0, 100, 80, 255],
        [154, 205, 50, 255],
        [46, 125, 50, 255],
      ];
    case "ocean":
      return [
        [0, 119, 190, 255],
        [0, 180, 216, 255],
        [72, 202, 228, 255],
        [0, 72, 118, 255],
        [144, 224, 239, 255],
      ];
    case "aurora":
      return [
        [46, 213, 115, 255],
        [0, 245, 212, 255],
        [138, 43, 226, 255],
        [72, 209, 204, 255],
        [180, 120, 255, 255],
      ];
    case "ember":
      return [
        [255, 69, 0, 255],
        [255, 140, 0, 255],
        [220, 20, 60, 255],
        [255, 215, 0, 255],
        [139, 0, 0, 255],
      ];
    case "quantum":
    default:
      return [
        [80, 200, 255, 255],
        [255, 80, 180, 255],
        [60, 255, 160, 255],
        [255, 200, 60, 255],
        [160, 80, 255, 255],
      ];
  }
}
