/**
 * Open Graph image — prava slika dana kao PNG.
 * Viber, Facebook i ostali koriste ovaj URL za share preview.
 *
 * In-memory LRU cache: čuva do MAX_CACHE_ENTRIES rendiranih PNG-ova.
 * Rezultat za isti datum je uvek isti (deterministički), pa ga možemo keširati
 * bez brige o invalidaciji.
 */
import { NextResponse } from "next/server";
import { createCanvas } from "@napi-rs/canvas/node-canvas";
import { seedFromDate } from "@/lib/qrng-server";
import { getTodayBelgrade } from "@/lib/date";
import { QRNGStream } from "@/lib/qrng";
import { renderArt } from "@/lib/scenarios";

const W = 1200;
const H = 630;
const MAX_CACHE_ENTRIES = 30;

const pngCache = new Map<string, Buffer>();

function renderPng(date: string): Buffer {
  const values = seedFromDate(date);
  const stream = new QRNGStream(values);
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
  renderArt(ctx, stream, W, H);
  return canvas.toBuffer("image/png");
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const dateParam = searchParams.get("date");
  const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
    ? dateParam
    : getTodayBelgrade();

  try {
    let png = pngCache.get(date);

    if (!png) {
      png = renderPng(date);
      if (pngCache.size >= MAX_CACHE_ENTRIES) {
        const oldestKey = pngCache.keys().next().value;
        if (oldestKey) pngCache.delete(oldestKey);
      }
      pngCache.set(date, png);
    }

    return new NextResponse(png as unknown as BodyInit, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600, s-maxage=86400",
      },
    });
  } catch (e) {
    console.error("[og-image]", e);
    return new NextResponse("Failed to generate image", { status: 500 });
  }
}
