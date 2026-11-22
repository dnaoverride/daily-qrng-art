/**
 * Multi-scenario router. Mešanje prvih 4 vrednosti za uniformnu distribuciju.
 * 8 scenarija na Landscape nivou.
 *
 * Verzionisanje: renderArt(..., version) — v1 je zamrznut u ./v1/,
 * ovaj fajl i scenariji u ovom folderu su v2 (aktivni razvoj).
 * Vidi src/lib/render-version.ts.
 */
import { LATEST_RENDER_VERSION, type RenderVersion } from "../render-version";
import { renderArtV1 } from "./v1/router";
import { applyPostFx, pickPostFxParams } from "../post-fx";
import { createSceneHooks, type SceneHooks, type SceneMeta } from "../sky-events";
import type { RarityResult } from "../rarity";
import { sinkCtx, type SceneControls } from "./controls";
import { QRNGStream } from "../qrng";
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
  /** Samo v2: prirodne (kvantne) odluke koje kontrole mogu da promene — za Studio UI. */
  naturals: Record<string, boolean | number>;
}

export interface RenderOptions {
  /**
   * Samo v2 (Studio): ručno izabran scenario umesto onog koji biraju brojevi.
   * Stream se troši isto (v0..v3 se i dalje čitaju), pa su ostale odluke iste.
   */
  scenario?: number;
  /** Samo v2 (Studio): kontrole scene — vidi ./controls.ts. */
  controls?: SceneControls;
}

export function renderArt(
  ctx: CanvasRenderingContext2D,
  stream: QRNGStream,
  w: number,
  h: number,
  version: RenderVersion = LATEST_RENDER_VERSION,
  opts: RenderOptions = {}
): RenderResult {
  const v = stream.getValues();
  const forced =
    version !== 1 &&
    opts.scenario !== undefined &&
    Number.isInteger(opts.scenario) &&
    opts.scenario >= 0 &&
    opts.scenario < NUM_SCENARIOS_V2
      ? opts.scenario
      : undefined;
  const scenarioIndex = forced ?? scenarioIndexFor(v, version);
  if (version === 1) {
    renderArtV1(ctx, stream, w, h);
    return { version, scenarioIndex, rarity: null, meta: {}, naturals: {} };
  }
  // Rarity: nebeski događaji preko hook-ova u scenariju (ne troše QRNGStream)
  const { hooks, finish } = createSceneHooks(ctx, v, w, h);
  const meta: SceneMeta = {};
  const ctl =
    opts.controls && Object.keys(opts.controls).length
      ? { controls: opts.controls, forkSeed: ((v[4] ?? 1) << 16) ^ (v[5] ?? 7) ^ (v[999] ?? 0) }
      : {};
  const naturals: Record<string, boolean | number> = {};
  const report = (k: string, n: boolean | number) => {
    if (!(k in naturals)) naturals[k] = n;
  };
  // Sa kontrolama scena može potrošiti drugačiji broj vrednosti iz streama (npr. druga silueta),
  // a post-fx čita stream posle scene. Zato se post-fx parametri uzimaju iz probnog prolaza
  // bez kontrola (1×1 platno) — obrada slike ostaje ista kao u kvantnoj verziji.
  // Pretpostavka: stream je svež (pozicija 0), kao u svim pozivaocima.
  let postFx: ReturnType<typeof pickPostFxParams> | null = null;
  if (ctl.controls) {
    const probe = new QRNGStream([...v]);
    renderArtV2(sinkCtx(), probe, w, h, { sky: () => {}, body: () => {} }, forced);
    postFx = pickPostFxParams(probe);
  }
  renderArtV2(ctx, stream, w, h, { ...hooks, ...ctl, report, meta: (m) => Object.assign(meta, m) }, forced);
  const rarity = finish();
  // Post-fx (grain, vinjeta, split-tone, kontrast) — samo v2, posle scene.
  applyPostFx(ctx, w, h, postFx ?? pickPostFxParams(stream));
  return { version, scenarioIndex, rarity, meta, naturals };
}

function renderArtV2(
  ctx: CanvasRenderingContext2D,
  stream: QRNGStream,
  w: number,
  h: number,
  hooks: SceneHooks,
  forced?: number
): void {
  const v0 = stream.next_u16();
  const v1 = stream.next_u16();
  const v2 = stream.next_u16();
  const v3 = stream.next_u16();
  const mix = (v0 ^ v1 ^ v2 ^ v3) >>> 0;
  const scenarioIndex = forced ?? mix % NUM_SCENARIOS_V2;

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
