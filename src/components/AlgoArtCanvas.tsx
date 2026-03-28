"use client";

import { useEffect, useRef } from "react";
import { QRNGStream } from "@/lib/qrng";
import { renderArt } from "@/lib/scenarios";
import {
  PHILOSOPHIES,
  DEFAULT_FLOW_FIELD,
  DEFAULT_WAVE,
  DEFAULT_VORONOI,
  DEFAULT_L_SYSTEM,
  DEFAULT_CELLULAR,
  DEFAULT_TRUCHET,
  DEFAULT_JULIA,
  DEFAULT_NEWTON,
  type PhilosophyId,
} from "@/lib/algorithmic/types";
import { initFlowField, drawFlowFieldFrame } from "@/lib/algorithmic/flow-field";
import { renderWaveInterference } from "@/lib/algorithmic/wave-interference";
import { renderVoronoi } from "@/lib/algorithmic/voronoi";
import { renderLSystem } from "@/lib/algorithmic/l-system";
import { renderCellularAutomata } from "@/lib/algorithmic/cellular-automata";
import { renderTruchet } from "@/lib/algorithmic/truchet";
import { renderJulia } from "@/lib/algorithmic/julia";
import { renderNewton } from "@/lib/algorithmic/newton";

const W = 1200;
const H = 675;

/**
 * Mapiranje lokalizovanih labela (stari format "Algo: <label>") na philosophy ID.
 * Pokriva i srpski i engleski za backward-compat sa starim zapisima u bazi.
 */
const LABEL_TO_PHILOSOPHY_ID: Record<string, PhilosophyId> = {
  // engleski
  "Quantum Turbulence": "flow-field",
  "Wave Interference": "wave",
  "Stochastic Crystallization": "voronoi",
  "L-System Tree": "l-system",
  "Cellular Automaton": "cellular-automata",
  "Truchet Tiles": "truchet",
  "Julia Fractal": "julia",
  "Julia Set": "julia",
  "Newton Fractal": "newton",
  // srpski
  "Kvantna turbulencija": "flow-field",
  "Talasna interferencija": "wave",
  "Stoha\u0161ti\u010dka kristalizacija": "voronoi",
  "Stohasti\u010dka kristalizacija": "voronoi",
  "L-System drvo": "l-system",
  "Celularni automat": "cellular-automata",
  "Truchet plo\u010dice": "truchet",
  "Julia fraktal": "julia",
  "Newton fraktal": "newton",
};

function extractPhilosophyId(scenarioName: string | null | undefined): PhilosophyId | null {
  if (!scenarioName) return null;

  // Novi format: "algo:newton", "algo:flow-field" itd.
  if (scenarioName.startsWith("algo:")) {
    const id = scenarioName.slice(5) as PhilosophyId;
    if (PHILOSOPHIES.some((p) => p.id === id)) return id;
  }

  // Stari format: "Algo: Newton fraktal" (lokalizovano)
  const oldPrefix = "Algo: ";
  if (scenarioName.startsWith(oldPrefix)) {
    const label = scenarioName.slice(oldPrefix.length).trim();
    return LABEL_TO_PHILOSOPHY_ID[label] ?? null;
  }

  return null;
}

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

    const philosophyId = extractPhilosophyId(scenarioName);

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
