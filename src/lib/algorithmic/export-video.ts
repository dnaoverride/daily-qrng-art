import type { FlowFieldParams } from "./types";
import {
  initFlowField,
  initFlowFieldCanvas,
  drawFlowFieldFrame,
} from "./flow-field";

export interface FlowFieldVideoOptions {
  values: number[];
  params: FlowFieldParams;
  width?: number;
  height?: number;
  fps?: number;
  loopSeconds?: number;
  filename?: string;
}

export function supportsWebmExport(): boolean {
  return (
    typeof HTMLCanvasElement !== "undefined" &&
    typeof MediaRecorder !== "undefined" &&
    MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
  );
}

/** Record a seamless flow-field loop to WebM via canvas captureStream. */
export async function exportFlowFieldWebm(opts: FlowFieldVideoOptions): Promise<void> {
  const w = opts.width ?? 1200;
  const h = opts.height ?? 675;
  const fps = opts.fps ?? 30;
  const loopSeconds = opts.loopSeconds ?? 4;
  const totalFrames = Math.round(fps * loopSeconds);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D unavailable");

  const state = initFlowField(opts.values, opts.params, 0);
  initFlowFieldCanvas(ctx, w, h);

  const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
    ? "video/webm;codecs=vp9"
    : "video/webm";

  const stream = canvas.captureStream(0);
  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4_000_000 });
  const chunks: Blob[] = [];

  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const done = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => {
      resolve(new Blob(chunks, { type: mime }));
    };
    recorder.onerror = () => reject(new Error("Video recording failed"));
  });

  recorder.start();

  for (let frame = 0; frame < totalFrames; frame++) {
    const phase = frame / totalFrames;
    drawFlowFieldFrame(ctx, state, w, h, phase);
    const track = stream.getVideoTracks()[0] as (MediaStreamTrack & { requestFrame?: () => void }) | undefined;
    track?.requestFrame?.();
    await new Promise((r) => setTimeout(r, 1000 / fps));
  }

  recorder.stop();
  const blob = await done;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = opts.filename ?? `qrng-flow-field-${Date.now()}.webm`;
  a.click();
  URL.revokeObjectURL(url);
}
