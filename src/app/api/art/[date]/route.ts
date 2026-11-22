import { NextResponse } from "next/server";
import { FutureDateError, getDailyValues } from "@/lib/daily-art";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ date: string }> }
) {
  const { date } = await params;
  const match = date.match(/^\d{4}-\d{2}-\d{2}$/);
  if (!match) {
    return NextResponse.json({ error: "Invalid date format (YYYY-MM-DD)" }, { status: 400 });
  }
  try {
    // Kvantni dani su trajno vezani za datum, stari dani su iz datuma → oba su nepromenljiva.
    const { values, source, fetchedAt } = await getDailyValues(date);
    return NextResponse.json({ values, date, source, fetchedAt }, {
      headers: {
        "Cache-Control": "public, max-age=86400, s-maxage=86400, immutable",
      },
    });
  } catch (e) {
    if (e instanceof FutureDateError) {
      return NextResponse.json({ error: "No image for a future date yet" }, { status: 404, headers: { "Cache-Control": "no-store" } });
    }
    console.error("[daily-art]", e);
    return NextResponse.json({ error: "Daily values unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
