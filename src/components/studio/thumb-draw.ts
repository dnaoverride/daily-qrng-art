/*
 * Crtanje jedne stavke Studija (scena ili apstrakcija) — bez DOM-a,
 * pa radi i u workeru (OffscreenCanvas) i na glavnom thread-u.
 */
import { QRNGStream } from "@/lib/qrng";
import { renderArt } from "@/lib/scenarios";
import { currentRenderVersion } from "@/lib/render-version";
import { renderAlgorithmicToContext } from "@/lib/algorithmic/render-algorithmic";
import { PHILOSOPHIES, type AlgoParams, type PhilosophyId } from "@/lib/algorithmic/types";

/** Puna rezolucija crteža. Pikselski algoritmi (wave, voronoi) ignorišu skaliranje, pa se crta puno i smanjuje. */
export const ART_W = 1200;
export const ART_H = 675;

export type StudioItem =
  | { kind: "scene"; scenario: number | null } // null = „Kvantni izbor" (scenu biraju brojevi)
  | { kind: "abstract"; id: PhilosophyId; params?: AlgoParams; warmup?: number };

export function itemKey(item: StudioItem): string {
  return item.kind === "scene" ? `s:${item.scenario ?? "auto"}` : `a:${item.id}`;
}

export const DEFAULT_ALGO_PARAMS = Object.fromEntries(
  PHILOSOPHIES.map((p) => [p.id, p.defaultParams])
) as Record<PhilosophyId, AlgoParams>;

type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;
type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

let work: AnyCanvas | null = null;

function newCanvas(w: number, h: number): AnyCanvas {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(w, h);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function ctxOf(c: AnyCanvas): Ctx2D | null {
  return c.getContext("2d") as Ctx2D | null;
}

/** Nacrta stavku u punoj rezoluciji (zajedničko radno platno) i smanji je na `target`. */
export function drawItem(target: AnyCanvas, values: number[], item: StudioItem): void {
  work ??= newCanvas(ART_W, ART_H);
  const ctx = ctxOf(work);
  const out = ctxOf(target);
  if (!ctx || !out) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.clearRect(0, 0, ART_W, ART_H);
  if (item.kind === "scene") {
    // Scene koriste samo Canvas 2D API koji OffscreenCanvas ima.
    renderArt(ctx as CanvasRenderingContext2D, new QRNGStream(values), ART_W, ART_H, currentRenderVersion(), {
      scenario: item.scenario ?? undefined,
    });
  } else {
    renderAlgorithmicToContext(ctx, item.id, values, item.params ?? DEFAULT_ALGO_PARAMS[item.id], {
      width: ART_W,
      height: ART_H,
      flowFieldWarmupFrames: item.warmup ?? 60,
    });
  }
  out.imageSmoothingQuality = "high";
  out.drawImage(work, 0, 0, target.width, target.height);
}
