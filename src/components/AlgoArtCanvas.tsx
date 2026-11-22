"use client";

import { useEffect, useRef } from "react";
import { QRNGStream } from "@/lib/qrng";
import { renderArt } from "@/lib/scenarios";
import { currentRenderVersion, renderVersionForTimestamp } from "@/lib/render-version";
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
import { parseFavoriteScenarioToPhilosophyId, parseFavoriteScene } from "@/lib/algorithmic/scenario-name";
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
  /** Trenutak nastanka (favorit.createdAt) — određuje verziju renderera za scenarije. */
  createdAt?: string | Date | null;
}

export function AlgoArtCanvas({ values, scenarioName, className = "", createdAt }: AlgoArtCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const version = createdAt ? renderVersionForTimestamp(createdAt) : currentRenderVersion();

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
      // Favorit iz Studija: ručno izabrana scena i kontrole (`scene:<idx>|c=…`)
      const scene = parseFavoriteScene(scenarioName);
      const stream = new QRNGStream(values);
      renderArt(ctx, stream, W, H, version, scene ? { scenario: scene.scenario, controls: scene.controls } : undefined);
    }
  }, [values, scenarioName, version]);

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
