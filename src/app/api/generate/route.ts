import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { qrng_pool } from "@/lib/schema";
import { eq, asc } from "drizzle-orm";
import { fetchQRNG, randomEntropySeed } from "@/lib/qrng-server";

export async function GET() {
  // 1. Pokušaj iz DB pool-a
  try {
    const [row] = await db
      .select()
      .from(qrng_pool)
      .where(eq(qrng_pool.used, false))
      .orderBy(asc(qrng_pool.fetchedAt))
      .limit(1);

    if (row) {
      await db
        .update(qrng_pool)
        .set({ used: true, usedAt: new Date() })
        .where(eq(qrng_pool.id, row.id));

      const values = Array.isArray(row.values)
        ? (row.values as number[])
        : (JSON.parse(row.values as string) as number[]);

      return NextResponse.json({ values, source: "pool" });
    }

    console.warn("[qrng] Pool is empty, falling back to direct ANU fetch");
  } catch (e) {
    console.warn("[qrng] Pool read failed, falling back to direct ANU fetch:", e);
  }

  // 2. Pool prazan ili nedostupan — direktan ANU poziv
  try {
    const values = await fetchQRNG();
    return NextResponse.json({ values, source: "qrng" });
  } catch (e) {
    console.warn("[qrng] Direct ANU fetch failed, falling back to entropy:", e);
  }

  // 3. Poslednja odbrana — kriptografski entropy
  const values = randomEntropySeed();
  return NextResponse.json({ values, source: "entropy" });
}
