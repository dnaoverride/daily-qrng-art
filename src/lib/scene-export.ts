/**
 * Izvoz scene (slika dana, arhiva, Studio scena) u PNG u izabranoj rezoluciji.
 *
 * Scena se uvek crta u logičkih 1200×675 (kao na ekranu), uvećano k puta
 * (RenderOptions.pixelRatio) — ista kompozicija u svakoj rezoluciji, i za v1 i za v2.
 */
import { QRNGStream } from "./qrng";
import { renderArt, type RenderOptions } from "./scenarios";
import type { RenderVersion } from "./render-version";
import { EXPORT_PRESETS, canvasToBlob, type ExportPresetId } from "./algorithmic/export-png";

const LOGICAL_W = 1200;
const LOGICAL_H = 675;

export async function exportScenePng(
  values: number[],
  version: RenderVersion,
  opts: Omit<RenderOptions, "pixelRatio">,
  presetId: ExportPresetId,
  filename: string
): Promise<void> {
  const preset = EXPORT_PRESETS.find((p) => p.id === presetId) ?? EXPORT_PRESETS[0];
  const canvas = document.createElement("canvas");
  canvas.width = preset.width;
  canvas.height = preset.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D unavailable");
  // Pusti UI da prikaže „Izvoz..." pre teškog crtanja (4K post-fx traje ~sekundu).
  await new Promise((r) => setTimeout(r, 30));
  renderArt(ctx, new QRNGStream(values), LOGICAL_W, LOGICAL_H, version, {
    ...opts,
    pixelRatio: preset.width / LOGICAL_W,
  });
  const blob = await canvasToBlob(canvas);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
