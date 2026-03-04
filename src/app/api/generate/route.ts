import { NextResponse } from "next/server";
import { fetchQRNG, randomEntropySeed } from "@/lib/qrng-server";

export async function GET() {
  try {
    const values = await fetchQRNG();
    return NextResponse.json({ values, source: "qrng" });
  } catch (e) {
    console.warn("ANU QRNG fallback to entropy:", e);
    const values = randomEntropySeed();
    return NextResponse.json({ values, source: "entropy" });
  }
}
