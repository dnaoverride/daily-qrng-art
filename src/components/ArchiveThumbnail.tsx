"use client";

import { useEffect, useRef } from "react";
import { QRNGStream } from "@/lib/qrng";
import { renderLandscape } from "@/lib/landscape";

const W = 600;
const H = 338;

interface ArchiveThumbnailProps {
  values: number[];
}

export function ArchiveThumbnail({ values }: ArchiveThumbnailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const stream = new QRNGStream(values);
    renderLandscape(ctx, stream, W, H);
  }, [values]);

  return (
    <div className="aspect-video rounded overflow-hidden">
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="w-full h-full"
      />
    </div>
  );
}
