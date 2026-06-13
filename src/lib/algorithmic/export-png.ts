import type { PhilosophyId, AlgoParams } from "./types";
import { renderAlgorithmicToCanvas } from "./render-algorithmic";

export const EXPORT_PRESETS = [
  { id: "hd", label: "1200×675", width: 1200, height: 675 },
  { id: "2k", label: "2400×1350", width: 2400, height: 1350 },
  { id: "4k", label: "3840×2160", width: 3840, height: 2160 },
] as const;

export type ExportPresetId = (typeof EXPORT_PRESETS)[number]["id"];

export function downloadCanvasPng(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  filename: string
): void {
  const link = document.createElement("a");
  if (canvas instanceof OffscreenCanvas) {
    canvas.convertToBlob({ type: "image/png" }).then((blob) => {
      if (!blob) return;
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
      URL.revokeObjectURL(link.href);
    });
    return;
  }
  link.href = canvas.toDataURL("image/png");
  link.download = filename;
  link.click();
}

export async function exportAlgorithmicPng(
  philosophy: PhilosophyId,
  values: number[],
  params: AlgoParams,
  presetId: ExportPresetId,
  filename: string
): Promise<void> {
  const preset = EXPORT_PRESETS.find((p) => p.id === presetId) ?? EXPORT_PRESETS[0];
  const canvas = renderAlgorithmicToCanvas(
    philosophy,
    values,
    params,
    preset.width,
    preset.height,
    { flowFieldWarmupFrames: 120 }
  );
  downloadCanvasPng(canvas, filename);
}

export async function canvasToBlob(
  canvas: HTMLCanvasElement | OffscreenCanvas
): Promise<Blob> {
  if (canvas instanceof OffscreenCanvas) {
    const blob = await canvas.convertToBlob({ type: "image/png" });
    if (!blob) throw new Error("PNG export failed");
    return blob;
  }
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG export failed"))), "image/png");
  });
}
