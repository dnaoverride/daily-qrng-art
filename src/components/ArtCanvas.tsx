"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { QRNGStream } from "@/lib/qrng";
import { renderArt } from "@/lib/scenarios";

const W = 1200;
const H = 675;

interface ArtCanvasProps {
  values: number[];
  date?: string;
  className?: string;
  /** Called with the canvas element after draw (e.g. for PNG download) */
  onCanvasReady?: (canvas: HTMLCanvasElement | null) => void;
}

export function ArtCanvas({
  values,
  date,
  className = "",
  onCanvasReady,
}: ArtCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !values.length) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const stream = new QRNGStream(values);
    renderArt(ctx, stream, W, H);
    setReady(true);
    onCanvasReady?.(canvas);
  }, [values, onCanvasReady]);

  useEffect(() => {
    draw();
  }, [draw]);

  return (
    <div className={`relative ${className}`}>
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="w-full max-w-4xl h-auto rounded-lg shadow-xl"
        style={{ aspectRatio: `${W} / ${H}` }}
      />
      {date && ready && (
        <p className="mt-2 text-sm text-zinc-500 text-center">
          Slika za {date}
        </p>
      )}
    </div>
  );
}
