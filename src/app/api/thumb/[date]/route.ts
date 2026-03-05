import { NextRequest, NextResponse } from "next/server";
import { createCanvas } from "@napi-rs/canvas";
import { seedFromDate } from "@/lib/qrng-server";
import { QRNGStream } from "@/lib/qrng";
import { renderLandscape } from "@/lib/landscape";

export const revalidate = false;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  const { date } = await params;

  const values = seedFromDate(date);
  const canvas = createCanvas(600, 338);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ctx = canvas.getContext("2d") as any as CanvasRenderingContext2D;
  const stream = new QRNGStream(values);
  renderLandscape(ctx, stream, 600, 338);

  const buffer = new Uint8Array(await canvas.encode("png"));

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400, s-maxage=86400, immutable",
    },
  });
}
