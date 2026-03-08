"use client";

import { useEffect, useRef, useState } from "react";
import { QRNGStream } from "@/lib/qrng";
import { renderArt } from "@/lib/scenarios";

const W = 600;
const H = 338;

export function ArchiveThumbnail({ date }: { date: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    let cancelled = false;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        observer.disconnect();

        fetch(`/api/art/${date}`)
          .then((res) => res.json())
          .then((data: { values?: number[] }) => {
            if (cancelled || !Array.isArray(data.values)) return;
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext("2d");
            if (!ctx) return;
            renderArt(ctx, new QRNGStream(data.values), W, H);
            setLoaded(true);
          })
          .catch(() => {});
      },
      { rootMargin: "200px" }
    );

    observer.observe(wrapper);

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [date]);

  return (
    <div
      ref={wrapperRef}
      className="rounded overflow-hidden bg-zinc-800"
      style={{ aspectRatio: "16/9", width: "100%" }}
    >
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        style={{ width: "100%", height: "100%", opacity: loaded ? 1 : 0.3 }}
      />
    </div>
  );
}
