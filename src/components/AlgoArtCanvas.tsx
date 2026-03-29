"use client";

import { useEffect, useRef } from "react";
import { QRNGStream } from "@/lib/qrng";
import { renderArt } from "@/lib/scenarios";
import {
  DEFAULT_FLOW_FIELD,
  DEFAULT_WAVE,
  DEFAULT_VORONOI,
  DEFAULT_L_SYSTEM,
  DEFAULT_CELLULAR,
  DEFAULT_TRUCHET,
  DEFAULT_JULIA,
  DEFAULT_NEWTON,
  DEFAULT_APOLLONIAN,
  type PhilosophyId,
} from "@/lib/algorithmic/types";
import { parseFavoriteScenarioToPhilosophyId } from "@/lib/algorithmic/scenario-name";
import { initFlowField, drawFlowFieldFrame } from "@/lib/algorithmic/flow-field";
import { renderWaveInterference } from "@/lib/algorithmic/wave-interference";
import { renderVoronoi } from "@/lib/algorithmic/voronoi";
import { renderLSystem } from "@/lib/algorithmic/l-system";
import { renderCellularAutomata } from "@/lib/algorithmic/cellular-automata";
import { renderTruchet } from "@/lib/algorithmic/truchet";
import { renderJulia } from "@/lib/algorithmic/julia";
import { renderNewton } from "@/lib/algorithmic/newton";
import { renderApollonian } from "@/lib/algorithmic/apollonian";

const W = 1200;
const H = 675;

function renderAlgorithmic(
  ctx: CanvasRenderingContext2D,
  philosophyId: PhilosophyId,
  values: number[]
): void {
  switch (philosophyId) {
    case "flow-field": {
      const state = initFlowField(values, DEFAULT_FLOW_FIELD);
      // Render slike na offscreen i kopiramo jedan statični frame
      const offscreen = new OffscreenCanvas(W, H);
      const offCtx = offscreen.getContext("2d");
      if (!offCtx) return;
      // Renderuj nekoliko frame-ova da čestice imaju trag
      for (let i = 0; i < 120; i++) {
        drawFlowFieldFrame(offCtx, state);
      }
      ctx.drawImage(offscreen, 0, 0);
      break;
    }
    case "wave":
      renderWaveInterference(ctx, values, DEFAULT_WAVE);
      break;
    case "voronoi":
      renderVoronoi(ctx, values, DEFAULT_VORONOI);
      break;
    case "l-system":
      renderLSystem(ctx, values, DEFAULT_L_SYSTEM);
      break;
    case "cellular-automata":
      renderCellularAutomata(ctx, values, DEFAULT_CELLULAR);
      break;
    case "truchet":
      renderTruchet(ctx, values, DEFAULT_TRUCHET);
      break;
    case "julia":
      renderJulia(ctx, values, DEFAULT_JULIA);
      break;
    case "newton":
      renderNewton(ctx, values, DEFAULT_NEWTON);
      break;
    case "apollonian":
      renderApollonian(ctx, values, DEFAULT_APOLLONIAN);
      break;
  }
}

interface AlgoArtCanvasProps {
  values: number[];
  scenarioName?: string | null;
  className?: string;
}

/**
 * Smart canvas koji automatski bira renderer na osnovu scenarioName.
 * - "algo:newton" / "algo:flow-field" → algoritamski renderer
 * - "Algo: Newton fraktal" (stari format) → isti, backward-compat
 * - sve ostalo → renderArt (landscape)
 */
export function AlgoArtCanvas({ values, scenarioName, className = "" }: AlgoArtCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !values.length) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const philosophyId = parseFavoriteScenarioToPhilosophyId(scenarioName);

    if (philosophyId) {
      renderAlgorithmic(ctx, philosophyId, values);
    } else {
      const stream = new QRNGStream(values);
      renderArt(ctx, stream, W, H);
    }
  }, [values, scenarioName]);

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      className={className}
      style={{ aspectRatio: `${W} / ${H}` }}
    />
  );
}
