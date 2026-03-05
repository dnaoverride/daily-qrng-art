"use client";

import { useEffect, useRef, useState } from "react";
import { QRNGStream } from "@/lib/qrng";
import { renderLandscape } from "@/lib/landscape";

const W = 600;
const H = 338;

export function ArchiveThumbnail({ date }: { date: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/art/${date}`)
      .then((res) => res.json())
      .then((data: { values?: number[] }) => {
        if (cancelled || !Array.isArray(data.values)) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        renderLandscape(ctx, new QRNGStream(data.values), W, H);
        setLoaded(true);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [date]);

  return (
    <div
      className="rounded overflow-hidden bg-zinc-800"
      style={{ aspectRatio: "16/9", width: "100%" }}
    >
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        style={{ width: "100%", height: "100%", display: loaded ? "block" : "block", opacity: loaded ? 1 : 0.3 }}
      />
    </div>
  );
}
