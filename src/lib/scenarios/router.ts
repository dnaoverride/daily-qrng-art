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
import { renderLandscape } from "../landscape";
import { renderBeach } from "./beach";
import { renderOceanSunset } from "./ocean-sunset";
import { renderDesert } from "./desert";
import { renderCityNight } from "./city-night";
import { renderCosmos } from "./cosmos";
import { renderForest } from "./forest";
import { renderLake } from "./lake";

export const NUM_SCENARIOS = 8;

export function renderArt(
  ctx: CanvasRenderingContext2D,
  stream: QRNGStream,
  w: number,
  h: number,
  version: RenderVersion = LATEST_RENDER_VERSION
): void {
  if (version === 1) {
    renderArtV1(ctx, stream, w, h);
    return;
  }
  renderArtV2(ctx, stream, w, h);
}

function renderArtV2(
  ctx: CanvasRenderingContext2D,
  stream: QRNGStream,
  w: number,
  h: number
): void {
  const v0 = stream.next_u16();
  const v1 = stream.next_u16();
  const v2 = stream.next_u16();
  const v3 = stream.next_u16();
  const mix = (v0 ^ v1 ^ v2 ^ v3) >>> 0;
  const scenarioIndex = mix % NUM_SCENARIOS;

  switch (scenarioIndex) {
    case 0:
      renderLandscape(ctx, stream, w, h);
      break;
    case 1:
      renderBeach(ctx, stream, w, h);
      break;
    case 2:
      renderOceanSunset(ctx, stream, w, h);
      break;
    case 3:
      renderDesert(ctx, stream, w, h);
      break;
    case 4:
      renderCityNight(ctx, stream, w, h);
      break;
    case 5:
      renderCosmos(ctx, stream, w, h);
      break;
    case 6:
      renderForest(ctx, stream, w, h);
      break;
    case 7:
      renderLake(ctx, stream, w, h);
      break;
    default:
      renderLandscape(ctx, stream, w, h);
  }
}
