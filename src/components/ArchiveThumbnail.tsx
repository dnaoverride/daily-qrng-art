"use client";

import { useEffect, useRef } from "react";
import { QRNGStream } from "@/lib/qrng";
import { renderLandscape } from "@/lib/landscape";

const W = 600;
const H = 338;

/**
 * Isti algoritam kao server-side seedFromDate (qrng-server.ts):
 * SHA-256 → parseInt(hex[0..16], 16) → xorshift → 1000 uint16 vrednosti
 */
async function computeSeed(dateStr: string): Promise<number[]> {
  const data = new TextEncoder().encode(dateStr);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hex = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // mora biti identično server-side: parseInt sa 16 hex znakova pa & 0xffffffff
  let state = (parseInt(hex.slice(0, 16), 16) & 0xffffffff) || 1;

  function xorshift(): number {
    let x = state;
    x ^= (x << 13) & 0xffffffff;
    x ^= x >>> 17;
    x ^= (x << 5) & 0xffffffff;
    state = x & 0xffffffff;
    return state & 0xffff;
  }

  const values: number[] = [];
  for (let i = 0; i < 1000; i++) values.push(xorshift());
  return values;
}

export function ArchiveThumbnail({ date }: { date: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    computeSeed(date).then((values) => {
      if (cancelled) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      renderLandscape(ctx, new QRNGStream(values), W, H);
    });
    return () => {
      cancelled = true;
    };
  }, [date]);

  return (
    <div className="aspect-video rounded overflow-hidden bg-zinc-800">
      <canvas ref={canvasRef} width={W} height={H} className="w-full h-full" />
    </div>
  );
}
