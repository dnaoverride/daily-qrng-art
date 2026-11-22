import { PHILOSOPHIES, type PhilosophyId } from "./types";
import { decodeControls, encodeControls, type SceneControls } from "../scenarios/controls";
import { NUM_SCENARIOS_V2, SCENARIO_NAMES } from "../scenarios";

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

/* ───────────── Favorit scene iz Studija ───────────── */

/** Kolona favorites.scenarioName je varchar(191). */
const SCENARIO_NAME_MAX = 191;

export interface FavoriteScene {
  /** Indeks v2 scenarija koji je nacrtan. */
  scenario: number;
  /** Kontrole scene (prazno = sve kvantno). */
  controls: SceneControls;
}

/**
 * scenarioName za favorit scene iz Studija.
 *  - kvantni izbor bez podešavanja → staro ime ("Savana"), isto kao igraonica i slika dana;
 *  - ručno izabrana scena i/ili podešavanja → `scene:<idx>` ili `scene:<idx>|c=birds:off,palette:3`.
 */
export function encodeFavoriteScene(scenario: number, controls: SceneControls, manual: boolean): string {
  const c = encodeControls(controls);
  if (!manual && !c) return SCENARIO_NAMES[scenario] ?? "Pejzaž";
  const full = c ? `scene:${scenario}|c=${c}` : `scene:${scenario}`;
  if (full.length <= SCENARIO_NAME_MAX) return full;
  // Ne bi trebalo da se desi (najduža scena ~150 znakova), ali nikad ne seci usred kontrole.
  const parts = c.split(",");
  let out = `scene:${scenario}|c=`;
  for (const part of parts) {
    const next = out.endsWith("=") ? out + part : `${out},${part}`;
    if (next.length > SCENARIO_NAME_MAX) break;
    out = next;
  }
  return out;
}

/** `scene:<idx>[|c=…]` → scena i kontrole; sve ostalo (staro ime, algo:…) → null. */
export function parseFavoriteScene(scenarioName: string | null | undefined): FavoriteScene | null {
  const m = /^scene:(\d{1,2})(?:\|c=(.*))?$/.exec(scenarioName?.trim() ?? "");
  if (!m) return null;
  const scenario = Number(m[1]);
  if (scenario >= NUM_SCENARIOS_V2) return null;
  return { scenario, controls: decodeControls(m[2]) };
}

/**
 * Ime za prikaz favorita (profil, /f/[token]).
 * `algoLabel(labelKey)` i `sceneLabel(idx)` su prevodi; `tuned` je oznaka „podešeno".
 */
export function favoriteDisplayName(
  raw: string | null | undefined,
  t: { algoLabel: (labelKey: string) => string; sceneLabel: (idx: number) => string; tuned: string }
): string | null {
  if (!raw) return null;
  const scene = parseFavoriteScene(raw);
  if (scene) {
    const name = t.sceneLabel(scene.scenario);
    return Object.keys(scene.controls).length ? `${name} · ${t.tuned}` : name;
  }
  const pid = parseFavoriteScenarioToPhilosophyId(raw);
  if (pid) {
    const ph = PHILOSOPHIES.find((p) => p.id === pid);
    if (ph) return t.algoLabel(ph.labelKey);
  }
  return raw;
}
