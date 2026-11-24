import type { RenderVersion } from "../render-version";
import { scenarioIndexFor } from "./router";

export {
  renderArt,
  NUM_SCENARIOS,
  NUM_SCENARIOS_V1,
  NUM_SCENARIOS_V2,
  scenarioCount,
  scenarioIndexFor,
  type RenderResult,
  type RenderOptions,
} from "./router";

/** Imena scenarija (indeks 0–7 isti u v1 i v2; 8+ samo v2). */
export const SCENARIO_NAMES: Record<number, string> = {
  0: "Pejzaž",
  1: "Plaža",
  2: "Zalazak",
  3: "Pustinja",
  4: "Noćni grad",
  5: "Kosmos",
  6: "Šuma",
  7: "Jezero",
  8: "Gradovi",
  9: "Podvodni svet",
  10: "Savana",
  11: "Polja",
  12: "Oluja",
  13: "Arktik",
  14: "Japanski vrt",
};

/** Ime scenarija za brojeve i verziju renderera (za omiljene i prikaz). */
export function scenarioNameFor(values: readonly number[] | null | undefined, version: RenderVersion): string | null {
  if (!values || values.length < 4) return null;
  return SCENARIO_NAMES[scenarioIndexFor(values, version)] ?? "Pejzaž";
}
