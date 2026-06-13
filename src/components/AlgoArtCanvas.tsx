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
  type AlgoParams,
} from "@/lib/algorithmic/types";
import { parseFavoriteScenarioToPhilosophyId } from "@/lib/algorithmic/scenario-name";
import { renderAlgorithmicToContext } from "@/lib/algorithmic/render-algorithmic";

const W = 1200;
const H = 675;

const DEFAULT_PARAMS: Record<PhilosophyId, AlgoParams> = {
  "flow-field": DEFAULT_FLOW_FIELD,
  wave: DEFAULT_WAVE,
  voronoi: DEFAULT_VORONOI,
  "l-system": DEFAULT_L_SYSTEM,
  "cellular-automata": DEFAULT_CELLULAR,
  truchet: DEFAULT_TRUCHET,
  julia: DEFAULT_JULIA,
  newton: DEFAULT_NEWTON,
  apollonian: DEFAULT_APOLLONIAN,
};

interface AlgoArtCanvasProps {
  values: number[];
  scenarioName?: string | null;
  className?: string;
}

export function AlgoArtCanvas({ values, scenarioName, className = "" }: AlgoArtCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !values.length) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const philosophyId = parseFavoriteScenarioToPhilosophyId(scenarioName);

    if (philosophyId) {
      renderAlgorithmicToContext(ctx, philosophyId, values, DEFAULT_PARAMS[philosophyId], {
        width: W,
        height: H,
        flowFieldWarmupFrames: 120,
      });
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
