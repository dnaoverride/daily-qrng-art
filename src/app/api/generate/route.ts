import { NextResponse } from "next/server";
import { claimQuantumValues } from "@/lib/daily-art";
import { randomEntropySeed } from "@/lib/qrng-server";

export const dynamic = "force-dynamic";

/** Novih 1000 kvantnih brojeva (Studio „Izvuci"): qrng_pool → ANU → entropija. */
export async function GET() {
  try {
    const { values, source } = await claimQuantumValues();
    return NextResponse.json({ values, source });
  } catch (e) {
    console.error("[qrng] GET failed completely:", e);
    const values = randomEntropySeed();
    return NextResponse.json({ values, source: "entropy" });
  }
}
