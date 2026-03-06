/**
 * Open Graph image — prava slika dana kao PNG.
 * Viber, Facebook i ostali koriste ovaj URL za share preview.
 */
import { NextResponse } from "next/server";
import { createCanvas } from "@napi-rs/canvas/node-canvas";
import { seedFromDate } from "@/lib/qrng-server";
import { getTodayBelgrade } from "@/lib/date";
import { QRNGStream } from "@/lib/qrng";
import { renderArt } from "@/lib/scenarios";

const W = 1200;
const H = 630;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const dateParam = searchParams.get("date");
  const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
    ? dateParam
    : getTodayBelgrade();

  try {
    const values = seedFromDate(date);
    const stream = new QRNGStream(values);

    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;

    renderArt(ctx, stream, W, H);

    const png = canvas.toBuffer("image/png");

    return new NextResponse(new Uint8Array(png), {
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
