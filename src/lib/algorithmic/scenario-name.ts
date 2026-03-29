import { PHILOSOPHIES, type PhilosophyId } from "./types";

/**
 * Mapiranje lokalizovanih labela (stari format "Algo: <label>") na philosophy ID.
 */
const LABEL_TO_PHILOSOPHY_ID: Record<string, PhilosophyId> = {
  "Quantum Turbulence": "flow-field",
  "Wave Interference": "wave",
  "Stochastic Crystallization": "voronoi",
  "L-System Tree": "l-system",
  "Cellular Automaton": "cellular-automata",
  "Truchet Tiles": "truchet",
  "Julia Fractal": "julia",
  "Julia Set": "julia",
  "Newton Fractal": "newton",
  "Apollonian gasket": "apollonian",
  "Apollonian Gasket": "apollonian",
  "Kvantna turbulencija": "flow-field",
  "Talasna interferencija": "wave",
  "Stoha\u0161ti\u010dka kristalizacija": "voronoi",
  "Stohasti\u010dka kristalizacija": "voronoi",
  "L-System drvo": "l-system",
  "Celularni automat": "cellular-automata",
  "Truchet plo\u010dice": "truchet",
  "Julia fraktal": "julia",
  "Newton fraktal": "newton",
  "Apolonijev paket": "apollonian",
};

/**
 * Iz scenarioName iz omiljenog zapisa izvlači philosophy ID ako je algoritamski favorite.
 * - "algo:julia", "ALGO:newton" …
 * - "Algo: Julia fraktal" (stari lokalizovani format u bazi)
 */
export function parseFavoriteScenarioToPhilosophyId(
  scenarioName: string | null | undefined
): PhilosophyId | null {
  if (!scenarioName) return null;
  const trimmed = scenarioName.trim();

  // Novi format: "algo:julia" (samo slug). Case-insensitive "algo:" ne sme da proguta
  // stari "Algo: Julia fraktal" — tu je posle dvotačke lokalizovani label, ne ID.
  if (/^algo:/i.test(trimmed)) {
    const rawId = trimmed.slice(5).trim();
    const found = PHILOSOPHIES.find(
      (p) => p.id === rawId || p.id === rawId.toLowerCase()
    );
    if (found) return found.id;
  }

  const oldPrefix = "Algo: ";
  if (trimmed.startsWith(oldPrefix)) {
    const label = trimmed.slice(oldPrefix.length).trim();
    return LABEL_TO_PHILOSOPHY_ID[label] ?? null;
  }

  return null;
}

export function isAlgorithmicFavoriteScenario(
  scenarioName: string | null | undefined
): boolean {
  return parseFavoriteScenarioToPhilosophyId(scenarioName) !== null;
}
