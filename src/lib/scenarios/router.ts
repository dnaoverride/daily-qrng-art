/**
 * Multi-scenario router. Mešanje prvih 4 vrednosti za uniformnu distribuciju.
 * 8 scenarija na Landscape nivou.
 *
 * Verzionisanje: renderArt(..., version) — v1 je zamrznut u ./v1/,
 * ovaj fajl i scenariji u ovom folderu su v2 (aktivni razvoj).
 * Vidi src/lib/render-version.ts.
 */
import type { QRNGStream } from "../qrng";
import { LATEST_RENDER_VERSION, type RenderVersion } from "../render-version";
import { renderArtV1 } from "./v1/router";
import { applyPostFx, pickPostFxParams } from "../post-fx";
import { createSceneHooks, type SceneHooks, type SceneMeta } from "../sky-events";
import type { RarityResult } from "../rarity";
import { renderLandscape } from "../landscape";
import { renderBeach } from "./beach";
import { renderOceanSunset } from "./ocean-sunset";
import { renderDesert } from "./desert";
import { renderCityNight } from "./city-night";
import { renderCosmos } from "./cosmos";
import { renderForest } from "./forest";
import { renderLake } from "./lake";
import { renderCities } from "./cities";
import { renderUnderwater } from "./underwater";
import { renderSavanna } from "./savanna";
import { renderFields } from "./fields";
import { renderStorm } from "./storm";
import { renderArctic } from "./arctic";
import { renderJapaneseGarden } from "./japanese-garden";

/** Broj scenarija u v1 (zamrznuto — ne menjati). */
export const NUM_SCENARIOS_V1 = 8;
/** Broj scenarija u v2 (raste sa novim scenarijima). */
export const NUM_SCENARIOS_V2 = 15;
/** @deprecated koristi scenarioCount(version) — zadržano zbog kompatibilnosti (v1 broj). */
export const NUM_SCENARIOS = NUM_SCENARIOS_V1;

export function scenarioCount(version: RenderVersion): number {
  return version === 1 ? NUM_SCENARIOS_V1 : NUM_SCENARIOS_V2;
}

/** Indeks scenarija za date brojeve i verziju (prva 4 broja XOR, pa % broj scenarija). */
export function scenarioIndexFor(values: readonly number[], version: RenderVersion): number {
  if (values.length < 4) return 0;
  return ((values[0]! ^ values[1]! ^ values[2]! ^ values[3]!) >>> 0) % scenarioCount(version);
}

export interface RenderResult {
  version: RenderVersion;
  scenarioIndex: number;
  /** Samo v2; v1 nema rarity sistem. */
  rarity: RarityResult | null;
  /** Samo v2: meta podaci scene (npr. ime grada). */
  meta: SceneMeta;
}

export function renderArt(
  ctx: CanvasRenderingContext2D,
  stream: QRNGStream,
  w: number,
  h: number,
  version: RenderVersion = LATEST_RENDER_VERSION
): RenderResult {
  const v = stream.getValues();
  const scenarioIndex = scenarioIndexFor(v, version);
  if (version === 1) {
    renderArtV1(ctx, stream, w, h);
    return { version, scenarioIndex, rarity: null, meta: {} };
  }
  // Rarity: nebeski događaji preko hook-ova u scenariju (ne troše QRNGStream)
  const { hooks, finish } = createSceneHooks(ctx, v, w, h);
  const meta: SceneMeta = {};
  renderArtV2(ctx, stream, w, h, { ...hooks, meta: (m) => Object.assign(meta, m) });
  const rarity = finish();
  // Post-fx (grain, vinjeta, split-tone, kontrast) — samo v2, posle scene.
  applyPostFx(ctx, w, h, pickPostFxParams(stream));
  return { version, scenarioIndex, rarity, meta };
}

function renderArtV2(
  ctx: CanvasRenderingContext2D,
  stream: QRNGStream,
  w: number,
  h: number,
  hooks: SceneHooks
): void {
  const v0 = stream.next_u16();
  const v1 = stream.next_u16();
  const v2 = stream.next_u16();
  const v3 = stream.next_u16();
  const mix = (v0 ^ v1 ^ v2 ^ v3) >>> 0;
  const scenarioIndex = mix % NUM_SCENARIOS_V2;

  switch (scenarioIndex) {
    case 0:
      renderLandscape(ctx, stream, w, h, hooks);
      break;
    case 1:
      renderBeach(ctx, stream, w, h, hooks);
      break;
    case 2:
      renderOceanSunset(ctx, stream, w, h, hooks);
      break;
    case 3:
      renderDesert(ctx, stream, w, h, hooks);
      break;
    case 4:
      renderCityNight(ctx, stream, w, h, hooks);
      break;
    case 5:
      renderCosmos(ctx, stream, w, h, hooks);
      break;
    case 6:
      renderForest(ctx, stream, w, h, hooks);
      break;
    case 7:
      renderLake(ctx, stream, w, h, hooks);
      break;
    case 8:
      renderCities(ctx, stream, w, h, hooks);
      break;
    case 9:
      renderUnderwater(ctx, stream, w, h, hooks);
      break;
    case 10:
      renderSavanna(ctx, stream, w, h, hooks);
      break;
    case 11:
      renderFields(ctx, stream, w, h, hooks);
      break;
    case 12:
      renderStorm(ctx, stream, w, h, hooks);
      break;
    case 13:
      renderArctic(ctx, stream, w, h, hooks);
      break;
    case 14:
      renderJapaneseGarden(ctx, stream, w, h, hooks);
      break;
    default:
      renderLandscape(ctx, stream, w, h, hooks);
  }
}
