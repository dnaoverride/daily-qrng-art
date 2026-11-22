import { NextResponse } from "next/server";
import { drawStudioValues } from "@/lib/daily-art";
import { randomEntropySeed } from "@/lib/qrng-server";

export const dynamic = "force-dynamic";

/** Studio „Izvuci": qrng_pool (iznad rezerve) → kvantno seme + xorshift → entropija. */
export async function GET() {
  try {
    const { values, source, fetchedAt } = await drawStudioValues();
    return NextResponse.json({ values, source, fetchedAt });
  } catch (e) {
    console.error("[qrng] GET failed completely:", e);
    const values = randomEntropySeed();
    return NextResponse.json({ values, source: "entropy", fetchedAt: null });
  }
}
