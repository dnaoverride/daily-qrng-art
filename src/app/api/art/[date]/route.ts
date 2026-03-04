import { NextResponse } from "next/server";
import { seedFromDate } from "@/lib/qrng-server";

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
    const values = seedFromDate(date);
    return NextResponse.json({ values, date });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Seed generation failed" }, { status: 500 });
  }
}
