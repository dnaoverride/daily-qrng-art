/**
 * Open Graph image — prava slika dana kao PNG.
 * Viber, Facebook i ostali koriste ovaj URL za share preview.
 *
 * ?size=thumb → 600×338 JPEG za arhivske thumbnails (odvojen LRU cache).
 *
 * In-memory LRU cache: PNG do 30, JPEG thumb do 90 unosa.
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
const W_THUMB = 600;
const H_THUMB = 338;
const MAX_PNG = 30;
const MAX_THUMB = 90;

const pngCache = new Map<string, Buffer>();
const thumbCache = new Map<string, Buffer>();

function renderBuffer(date: string, thumb: boolean): Buffer {
  const values = seedFromDate(date);
  const stream = new QRNGStream(values);
  const w = thumb ? W_THUMB : W;
  const h = thumb ? H_THUMB : H;
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
  renderArt(ctx, stream, w, h);
  if (thumb) {
    return canvas.toBuffer("image/jpeg");
  }
  return canvas.toBuffer("image/png");
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const dateParam = searchParams.get("date");
  const isThumb = searchParams.get("size") === "thumb";
  const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
    ? dateParam
    : getTodayBelgrade();

  const cache = isThumb ? thumbCache : pngCache;
  const maxEntries = isThumb ? MAX_THUMB : MAX_PNG;

  try {
    let buf = cache.get(date);

    if (!buf) {
      buf = renderBuffer(date, isThumb);
      if (cache.size >= maxEntries) {
        const oldestKey = cache.keys().next().value;
        if (oldestKey) cache.delete(oldestKey);
      }
      cache.set(date, buf);
    }

    return new NextResponse(buf as unknown as BodyInit, {
      headers: {
        "Content-Type": isThumb ? "image/jpeg" : "image/png",
        "Cache-Control": "public, max-age=3600, s-maxage=86400",
      },
    });
  } catch (e) {
    console.error("[og-image]", e);
    return new NextResponse("Failed to generate image", { status: 500 });
  }
}
