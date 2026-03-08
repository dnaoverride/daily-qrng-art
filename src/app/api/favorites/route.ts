import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { randomBytes } from "crypto";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { favorites } from "@/lib/schema";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });
  }

  const favs = await db
    .select({
      id: favorites.id,
      title: favorites.title,
      scenarioName: favorites.scenarioName,
      isPublic: favorites.isPublic,
      shareToken: favorites.shareToken,
      createdAt: favorites.createdAt,
    })
    .from(favorites)
    .where(eq(favorites.userId, session.user.id))
    .orderBy(desc(favorites.createdAt));

  return NextResponse.json({ favorites: favs }, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });
  }

  const body = await req.json() as {
    values?: unknown;
    title?: string;
    scenarioName?: string;
    isPublic?: boolean;
  };

  if (!Array.isArray(body.values) || body.values.length !== 1000) {
    return NextResponse.json({ error: "Neispravan set vrednosti." }, { status: 400 });
  }

  const shareToken = body.isPublic ? randomBytes(8).toString("hex") : null;
  const id = crypto.randomUUID();

  await db.insert(favorites).values({
    id,
    userId: session.user.id,
    values: body.values as number[],
    title: body.title?.trim() || "Bez naziva",
    scenarioName: body.scenarioName ?? null,
    isPublic: body.isPublic ?? false,
    shareToken,
    createdAt: new Date(),
  });

  const [favorite] = await db
    .select()
    .from(favorites)
    .where(eq(favorites.id, id))
    .limit(1);

  return NextResponse.json({ favorite }, { status: 201 });
}
