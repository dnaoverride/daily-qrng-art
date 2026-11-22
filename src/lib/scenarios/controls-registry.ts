/**
 * Registar kontrola scene po indeksu scenarija (v2) — Studio UI iz njega pravi kontrole.
 * Indeksi prate switch u router.ts (renderArtV2).
 */
import type { ControlDef } from "./controls";
import { LANDSCAPE_CONTROLS } from "../landscape";
import { BEACH_CONTROLS } from "./beach";
import { OCEAN_SUNSET_CONTROLS } from "./ocean-sunset";
import { DESERT_CONTROLS } from "./desert";
import { CITY_NIGHT_CONTROLS } from "./city-night";
import { COSMOS_CONTROLS } from "./cosmos";
import { FOREST_CONTROLS } from "./forest";
import { LAKE_CONTROLS } from "./lake";
import { CITIES_CONTROLS } from "./cities";
import { UNDERWATER_CONTROLS } from "./underwater";
import { SAVANNA_CONTROLS } from "./savanna";
import { FIELDS_CONTROLS } from "./fields";
import { STORM_CONTROLS } from "./storm";
import { ARCTIC_CONTROLS } from "./arctic";
import { JAPANESE_GARDEN_CONTROLS } from "./japanese-garden";

export const SCENE_CONTROLS: readonly (readonly ControlDef[])[] = [
  LANDSCAPE_CONTROLS,
  BEACH_CONTROLS,
  OCEAN_SUNSET_CONTROLS,
  DESERT_CONTROLS,
  CITY_NIGHT_CONTROLS,
  COSMOS_CONTROLS,
  FOREST_CONTROLS,
  LAKE_CONTROLS,
  CITIES_CONTROLS,
  UNDERWATER_CONTROLS,
  SAVANNA_CONTROLS,
  FIELDS_CONTROLS,
  STORM_CONTROLS,
  ARCTIC_CONTROLS,
  JAPANESE_GARDEN_CONTROLS,
];

export type { ControlDef, SceneControls } from "./controls";
