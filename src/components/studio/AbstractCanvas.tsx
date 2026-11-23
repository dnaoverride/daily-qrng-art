"use client";

import { useEffect, useRef, useState } from "react";
import type { AlgoParams, FlowFieldParams, PhilosophyId } from "@/lib/algorithmic/types";
import { drawFlowFieldFrame, initFlowField, initFlowFieldCanvas } from "@/lib/algorithmic/flow-field";
import { ART_H, ART_W, requestThumb } from "./thumb-render";

interface AbstractCanvasProps {
  values: number[];
  id: PhilosophyId;
  params: AlgoParams;
  /** Flow-field: živa animacija (petlja od 4 s) umesto statičnog kadra. */
  animate: boolean;
  onCanvasReady?: (canvas: HTMLCanvasElement | null) => void;
}

const LOOP_MS = 4000;

/**
 * Glavna slika apstrakcije.
 *  - statični algoritmi se crtaju u workeru (sa prioritetom), pa klizači ne zamrzavaju stranicu;
 *    promene parametara se crtaju sa malim zakašnjenjem (debounce);
 *  - flow-field animacija ide na glavnom thread-u (jeftino po kadru), kao u starom /algorithmic.
 */
export function AbstractCanvas({ values, id, params, animate, onCanvasReady }: AbstractCanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [drawn, setDrawn] = useState<string | null>(null);
  const key = `${id}`;
  const live = id === "flow-field" && animate;

  useEffect(() => {
    onCanvasReady?.(ref.current);
  }, [onCanvasReady]);

  // Statičan crtež (worker)
  useEffect(() => {
    if (live) return;
    const c = ref.current;
    if (!c) return;
    let cancel = () => {};
    const timer = setTimeout(() => {
      cancel = requestThumb(c, values, { kind: "abstract", id, params, warmup: 120 }, () => setDrawn(key), {
        priority: true,
      });
    }, 90);
    return () => {
      clearTimeout(timer);
      cancel();
    };
  }, [values, id, params, key, live]);

  // Živa animacija (flow-field)
  useEffect(() => {
    if (!live) return;
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const state = initFlowField(values, params as FlowFieldParams, 0);
    initFlowFieldCanvas(ctx, ART_W, ART_H);
    const start = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      drawFlowFieldFrame(ctx, state, ART_W, ART_H, ((now - start) % LOOP_MS) / LOOP_MS);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    setDrawn(key);
    return () => cancelAnimationFrame(raf);
  }, [values, params, key, live]);

  const ready = drawn === key;

  return (
    <div className="relative">
      <canvas
        ref={ref}
        width={ART_W}
        height={ART_H}
        className={`block w-full h-auto rounded-lg shadow-xl transition-opacity duration-300 ${ready ? "opacity-100" : "opacity-40"}`}
        style={{ aspectRatio: `${ART_W} / ${ART_H}` }}
      />
      {!ready && <span className="studio-shimmer absolute inset-0 rounded-lg" aria-hidden />}
    </div>
  );
}
