import type { PhilosophyId, AlgoParams } from "./types";
import { deriveVariantValues } from "./randomize-params";
import { renderAlgorithmicToCanvas } from "./render-algorithmic";
import { canvasToBlob } from "./export-png";
import { buildStoreZip, downloadBlob } from "./zip-store";

export async function exportVariationSetZip(
  philosophy: PhilosophyId,
  baseValues: number[],
  params: AlgoParams,
  count: number,
  width: number,
  height: number,
  zipName: string
): Promise<void> {
  const n = Math.max(4, Math.min(12, count));
  const entries: { name: string; data: Uint8Array }[] = [];

  for (let i = 0; i < n; i++) {
    const values = i === 0 ? baseValues : deriveVariantValues(baseValues, i);
    const canvas = renderAlgorithmicToCanvas(
      philosophy,
      values,
      params,
      width,
      height,
      { flowFieldWarmupFrames: 100 }
    );
    const blob = await canvasToBlob(canvas);
    const buf = new Uint8Array(await blob.arrayBuffer());
    entries.push({
      name: `qrng-${philosophy}-${String(i + 1).padStart(2, "0")}.png`,
      data: buf,
    });
  }

  downloadBlob(buildStoreZip(entries), zipName);
}
