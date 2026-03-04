"use client";

import { useEffect, useRef, useState } from "react";
import { QRNGStream } from "@/lib/qrng";
import { renderLandscape } from "@/lib/landscape";

const W = 240;
const H = 135;

interface ArchiveThumbnailProps {
  date: string;
}

export function ArchiveThumbnail({ date }: ArchiveThumbnailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/art/${date}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || !data.values) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const stream = new QRNGStream(data.values);
        renderLandscape(ctx, stream, W, H);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setError(true);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [date]);

  if (error) {
    return (
      <div className="aspect-video bg-zinc-200 dark:bg-zinc-800 rounded flex items-center justify-center text-zinc-500 text-xs">
        ?
      </div>
    );
  }

  return (
    <div className="relative aspect-video bg-zinc-100 dark:bg-zinc-800 rounded overflow-hidden">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-100 dark:bg-zinc-800">
          <span className="text-zinc-400 text-xs">...</span>
        </div>
      )}
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="w-full h-full object-cover"
        style={{ aspectRatio: `${W} / ${H}` }}
      />
    </div>
  );
}
