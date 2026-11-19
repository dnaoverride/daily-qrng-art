"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { QRNGStream } from "@/lib/qrng";
import { renderArt } from "@/lib/scenarios";
import type { RarityEvent, RarityResult, RarityTier } from "@/lib/rarity";
import {
  currentRenderVersion,
  renderVersionForDate,
  type RenderVersion,
} from "@/lib/render-version";

const W = 1200;
const H = 675;

/** Ključ prevoda (messages → rarity.event.*) za događaj. */
const EVENT_KEY: Record<RarityEvent, string> = {
  meteors: "meteors",
  rainbow: "rainbow",
  comet: "comet",
  aurora: "aurora",
  "double-rainbow": "doubleRainbow",
  eclipse: "eclipse",
  "blood-moon": "bloodMoon",
  glitch: "glitch",
  manta: "manta",
  whale: "whale",
  kraken: "kraken",
};

const TIER_STYLE: Record<Exclude<RarityTier, "common">, string> = {
  rare: "border-sky-500/40 bg-sky-500/10 text-sky-300",
  epic: "border-violet-500/40 bg-violet-500/10 text-violet-300",
  legendary: "border-amber-400/50 bg-amber-400/10 text-amber-300",
};

interface ArtCanvasProps {
  values: number[];
  date?: string;
  className?: string;
  /**
   * Verzija renderera. Ako nije zadata: po `date` (slika dana/arhiva),
   * a bez datuma — verzija za današnji dan (create-art).
   */
  renderVersion?: RenderVersion;
  /** Called with the canvas element after draw (e.g. for PNG download) */
  onCanvasReady?: (canvas: HTMLCanvasElement | null) => void;
}

export function ArtCanvas({
  values,
  date,
  className = "",
  renderVersion,
  onCanvasReady,
}: ArtCanvasProps) {
  const version =
    renderVersion ?? (date ? renderVersionForDate(date) : currentRenderVersion());
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const [rarity, setRarity] = useState<RarityResult | null>(null);
  const [place, setPlace] = useState<string | null>(null);
  const tArt = useTranslations("art");
  const tRarity = useTranslations("rarity");
  const tScene = useTranslations("scene");

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !values.length) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const stream = new QRNGStream(values);
    const result = renderArt(ctx, stream, W, H, version);
    setRarity(result.rarity);
    setPlace(result.meta.place ?? null);
    setReady(true);
    onCanvasReady?.(canvas);
  }, [values, version, onCanvasReady]);

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
      {ready && (date || place) && (
        <p className="mt-2 text-sm text-zinc-500 text-center">
          {date && tArt("title", { date })}
          {date && place && " · "}
          {place && tScene(`place.${place}`)}
        </p>
      )}
      {ready && rarity && rarity.tier !== "common" && rarity.event && (
        <p className="mt-2 flex justify-center">
          <span
            title={tRarity("hint")}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-0.5 text-xs font-medium ${TIER_STYLE[rarity.tier]}`}
          >
            <span aria-hidden>✦</span>
            {tRarity(`tier.${rarity.tier}`)} · {tRarity(`event.${EVENT_KEY[rarity.event]}`)}
          </span>
        </p>
      )}
    </div>
  );
}
