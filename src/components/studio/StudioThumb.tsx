"use client";

import { useEffect, useRef, useState } from "react";
import { requestThumb, type StudioItem } from "./thumb-render";

interface StudioThumbProps {
  values: number[];
  item: StudioItem;
  label: string;
  active: boolean;
  /** Redni broj u traci — za kaskadno paljenje posle izvlačenja. */
  index: number;
  onSelect: () => void;
}

const TW = 320;
const TH = 180;

export function StudioThumb({ values, item, label, active, index, onSelect }: StudioThumbProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);
  // Za koje brojeve je sličica nacrtana; različito od `values` → shimmer.
  const [drawnFor, setDrawnFor] = useState<number[] | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    const c = canvasRef.current;
    if (!c) return;
    return requestThumb(c, values, item, () => setDrawnFor(values));
    // item je stabilan po ključu (roditelj ga pravi iz konstanti)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, values]);

  useEffect(() => {
    // Samo horizontalno, unutar trake (telefon). Na desktopu je mreža, pa se stranica ne pomera.
    const el = ref.current;
    const strip = el?.parentElement;
    if (!active || !el || !strip || strip.scrollWidth <= strip.clientWidth) return;
    const dx = el.getBoundingClientRect().left - strip.getBoundingClientRect().left;
    strip.scrollTo({ left: strip.scrollLeft + dx - (strip.clientWidth - el.offsetWidth) / 2, behavior: "smooth" });
  }, [active]);

  const ready = drawnFor === values;

  return (
    <button
      ref={ref}
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={`group shrink-0 snap-center w-36 sm:w-40 md:w-auto min-w-0 text-left rounded-lg p-1 transition-colors ${
        active
          ? "bg-violet-500/15 ring-2 ring-violet-500"
          : "hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60"
      }`}
    >
      <span className="relative block aspect-video overflow-hidden rounded-md bg-zinc-200 dark:bg-zinc-800">
        <canvas
          ref={canvasRef}
          width={TW}
          height={TH}
          className={`absolute inset-0 h-full w-full transition-opacity duration-500 ${ready ? "opacity-100" : "opacity-0"}`}
          style={{ transitionDelay: ready ? `${Math.min(index, 12) * 40}ms` : "0ms" }}
        />
        {!ready && <span className="studio-shimmer absolute inset-0" aria-hidden />}
      </span>
      <span
        className={`mt-1 block truncate px-0.5 text-xs ${
          active ? "font-medium text-violet-700 dark:text-violet-300" : "text-zinc-600 dark:text-zinc-400"
        }`}
      >
        {label}
      </span>
    </button>
  );
}
